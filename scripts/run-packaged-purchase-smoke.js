const fs = require('fs');
const path = require('path');
const http = require('http');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const smokeRoot = path.join(root, 'test-data', 'electron-purchase-smoke');
const userDataDir = path.join(smokeRoot, 'user-data');
const evidenceDir = path.join(root, 'docs', 'evidence', 'supplier-purchase-foundation');
const exePath = path.join(root, 'dist-package', 'win-unpacked', 'Smart Vyapar.exe');
const port = 9335;
const screenshots = [];
const checkpoints = [];
const defects = [];
const consoleMessages = [];
const progressPath = path.join(evidenceDir, 'purchase-smoke-progress.log');

// 1. Mandatory isolation path check
if (!userDataDir.endsWith(path.join('test-data', 'electron-purchase-smoke', 'user-data'))) {
  console.error("Error: Isolated user-data path is not active. Aborting.");
  process.exit(1);
}

function progress(message) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.appendFileSync(progressPath, `[${new Date().toISOString()}] ${message}\n`);
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function rel(filePath) { return path.relative(root, filePath).replace(/\\/g, '/'); }
function assertCheckpoint(name, passed, notes = '') {
  checkpoints.push({ name, status: passed ? 'PASS' : 'FAIL', notes });
  if (!passed) defects.push(`${name}: ${notes}`);
}
function js(value) { return JSON.stringify(value); }
function safeClear(dir) {
  const resolved = path.resolve(dir);
  const allowed = path.resolve(smokeRoot);
  if (resolved !== allowed && !resolved.startsWith(allowed + path.sep)) throw new Error(`Refusing to clear ${resolved}`);
  if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function waitForTarget() {
  const started = Date.now();
  while (Date.now() - started < 45000) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await wait(500);
  }
  throw new Error('Timed out waiting for purchase smoke CDP target.');
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        consoleMessages.push({ type: msg.params.type, args: msg.params.args.map(a => a.value ?? a.description ?? '') });
      } else if (msg.method === 'Log.entryAdded') {
        consoleMessages.push({ type: msg.params.entry.level, args: [msg.params.entry.text] });
      }
    });
    this.ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('CDP websocket closed.'));
      this.pending.clear();
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }
      }, 15000).unref();
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
    return result.result.value;
  }
  close() { if (this.ws) this.ws.close(); }
}

async function waitForText(cdp, text) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (await cdp.eval(`document.body.innerText.includes(${js(text)})`)) return true;
    await wait(500);
  }
  return false;
}
async function clickByText(cdp, text) {
  const ok = await cdp.eval(`
    (() => {
      const el = Array.from(document.querySelectorAll('button')).find(button => button.textContent && button.textContent.includes(${js(text)}));
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Button not found: ${text}`);
  await wait(700);
}
async function fill(cdp, selector, value) {
  await cdp.eval(`
    (() => {
      const el = document.querySelector(${js(selector)});
      if (!el) throw new Error('Missing selector ${selector}');
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (el._valueTracker) el._valueTracker.setValue('');
      setter.call(el, ${js(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `);
}
async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(evidenceDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
  screenshots.push(rel(file));
}

async function runSession() {
  const env = {
    ...process.env,
    SMART_VYAPAR_ELECTRON_SMOKE: 'true',
    SMART_VYAPAR_ELECTRON_SMOKE_USER_DATA: userDataDir,
    ELECTRON_ENABLE_LOGGING: 'true',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = childProcess.spawn(exePath, [`--remote-debugging-port=${port}`, '--disable-gpu'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const target = await waitForTarget();
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await waitForText(cdp, 'Smart Vyapar');
  return { child, cdp, stdoutRef: () => stdout, stderrRef: () => stderr };
}

async function closeSession(session) {
  progress('Closing purchase smoke session.');
  let forced = false;
  const exitPromise = new Promise(resolve => {
    if (session.child.exitCode !== null || session.child.signalCode !== null) resolve();
    else session.child.once('exit', resolve);
  });
  try { await Promise.race([session.cdp.send('Browser.close'), wait(3000)]); } catch {}
  session.cdp.close();
  const exited = await Promise.race([exitPromise.then(() => true), wait(7000).then(() => false)]);
  if (!exited && !session.child.killed) {
    forced = true;
    session.child.kill();
    await Promise.race([exitPromise, wait(3000)]);
  }
  progress(`Purchase smoke session closed${forced ? ' with forced kill' : ''}.`);
  return { stdout: session.stdoutRef(), stderr: session.stderrRef(), forced };
}

function dbSummary() {
  const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  const result = childProcess.spawnSync(electronExe, [path.join(root, 'scripts', 'summarize-electron-purchase-smoke-db.js')], {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

async function main() {
  if (!fs.existsSync(exePath)) throw new Error(`Packaged executable not found: ${exePath}`);
  safeClear(smokeRoot);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(progressPath, `[${new Date().toISOString()}] Purchase smoke started.\n`);

  let appLog = '';
  let productId = '';
  let serviceId = '';
  let supplierId = '';
  let purchaseId = '';

  const session = await runSession();
  progress('Packaged app connected.');
  try {
    await screenshot(session.cdp, '01-shop-setup');
    await fill(session.cdp, '#setup-name', 'Supplier Purchase Store');
    await fill(session.cdp, '#setup-phone', '9000000000');
    await fill(session.cdp, '#setup-address', 'Smart Lane, Pune, Maharashtra');
    await fill(session.cdp, '#setup-gst', '27AAAAA1111A1Z1'); // Maharashtra shop GST
    await clickByText(session.cdp, 'Initialize Local Database');
    assertCheckpoint('Packaged app launches and creates Shop', await waitForText(session.cdp, 'Dashboard'));

    // Create categories & products
    const category = await session.cdp.eval(`window.smartVyapar.createCategory({ name: 'Smoke Category' })`);
    const productA = await session.cdp.eval(`
      window.smartVyapar.createProduct({
        product: {
          productCode: 'ITEM-A',
          name: 'Tracked Product A',
          primaryUnitId: 'uom-pcs',
          categoryId: ${js(category.data.id)},
          productType: 'GOODS',
          trackInventory: true,
          allowNegativeStock: false,
          taxRateId: 'tax-gst-18'
        },
        barcodes: [{ barcode: '900000000001', isPrimary: true }],
        defaultPrice: { purchasePrice: 100, sellingPrice: 150, mrp: 200 }
      })
    `);
    assertCheckpoint('Tracked Product A created', productA.success);
    productId = productA.data.id;

    const productS = await session.cdp.eval(`
      window.smartVyapar.createProduct({
        product: {
          productCode: 'ITEM-S',
          name: 'Service Product S',
          primaryUnitId: 'uom-pcs',
          categoryId: ${js(category.data.id)},
          productType: 'SERVICE',
          trackInventory: false,
          allowNegativeStock: false,
          taxRateId: 'tax-gst-18'
        },
        barcodes: [],
        defaultPrice: { purchasePrice: 50, sellingPrice: 80, mrp: 80 }
      })
    `);
    assertCheckpoint('Service Product S created', productS.success);
    serviceId = productS.data.id;

    // Create supplier
    const supplier = await session.cdp.eval(`
      window.smartVyapar.createSupplier({
        supplierCode: 'SUP-A',
        name: 'Maharashtra Supplier A',
        state: 'Maharashtra',
        gstNumber: '27BBBBB2222B2Z2',
        openingBalance: 1200,
        openingBalanceType: 'PAYABLE'
      })
    `);
    assertCheckpoint('Supplier SUP-A created with opening balance', supplier.success);
    supplierId = supplier.data.id;

    // Verify stock and supplier outstanding before posting
    const initStock = await session.cdp.eval(`window.smartVyapar.getProductStock(${js(productId)})`);
    assertCheckpoint('Stock of Product A before post is 0', initStock.data.quantityOnHand === 0, `Initial stock: ${initStock.data.quantityOnHand}`);

    const initOutstanding = await session.cdp.eval(`window.smartVyapar.getSupplierOutstanding(${js(supplierId)})`);
    assertCheckpoint('Supplier outstanding before post is 1200', initOutstanding.data.outstanding === 1200, `Initial outstanding: ${initOutstanding.data.outstanding}`);

    // Create purchase draft
    const draft = await session.cdp.eval(`
      window.smartVyapar.createPurchaseDraft({
        supplierId: ${js(supplierId)},
        invoiceDate: '2026-08-02',
        supplierInvoiceNumber: 'INV-123',
        invoiceDiscountType: 'AMOUNT',
        invoiceDiscountValue: 150,
        lines: [
          {
            productId: ${js(productId)},
            quantity: 10,
            unitPrice: 100,
            mrp: 200,
            discountType: 'PERCENT',
            discountValue: 10,
            taxRateId: 'tax-gst-18'
          },
          {
            productId: ${js(serviceId)},
            quantity: 5,
            unitPrice: 50,
            mrp: 50,
            taxRateId: 'tax-gst-18'
          }
        ]
      })
    `);
    assertCheckpoint('Draft purchase created successfully', draft.success);
    purchaseId = draft.data.invoice.id;

    // Verify proportional totals calculations
    // Base pre-inv-discount taxable: Product A = 900, Product S = 250. Total = 1150.
    // Invoice discount = 150. Net taxable = 1000.
    // CGST 9% (90), SGST 9% (90).
    // Grand total = 1180.
    assertCheckpoint('Draft subtotal matches', draft.data.invoice.subtotal === 1250, `Subtotal: ${draft.data.invoice.subtotal}`);
    assertCheckpoint('Draft taxableAmount matches', draft.data.invoice.taxableAmount === 1000, `Taxable: ${draft.data.invoice.taxableAmount}`);
    assertCheckpoint('Draft cgstTotal matches', draft.data.invoice.cgstTotal === 90, `CGST: ${draft.data.invoice.cgstTotal}`);
    assertCheckpoint('Draft sgstTotal matches', draft.data.invoice.sgstTotal === 90, `SGST: ${draft.data.invoice.sgstTotal}`);
    assertCheckpoint('Draft grandTotal matches', draft.data.invoice.grandTotal === 1180, `Grand total: ${draft.data.invoice.grandTotal}`);

    // Post purchase draft
    const postRes = await session.cdp.eval(`window.smartVyapar.postPurchase(${js(purchaseId)})`);
    assertCheckpoint('Purchase posted successfully', postRes.success);

    // Verify stock and supplier outstanding after posting
    const postStock = await session.cdp.eval(`window.smartVyapar.getProductStock(${js(productId)})`);
    assertCheckpoint('PURCHASE_IN stock increase: Product A is 10', postStock.data.quantityOnHand === 10, `Post stock: ${postStock.data.quantityOnHand}`);

    const postServiceStock = await session.cdp.eval(`window.smartVyapar.getProductStock(${js(serviceId)})`);
    assertCheckpoint('Service stock is unaffected (remains 0)', postServiceStock.data.quantityOnHand === 0, `Service stock: ${postServiceStock.data.quantityOnHand}`);

    const postOutstanding = await session.cdp.eval(`window.smartVyapar.getSupplierOutstanding(${js(supplierId)})`);
    assertCheckpoint('Supplier outstanding increase: Outstanding is 2380', postOutstanding.data.outstanding === 2380, `Post outstanding: ${postOutstanding.data.outstanding}`);

    // Verify posted immutability via main process rejections
    const updateRes = await session.cdp.eval(`
      window.smartVyapar.updatePurchaseDraft(${js(purchaseId)}, {
        supplierId: ${js(supplierId)},
        invoiceDate: '2026-08-02',
        lines: []
      })
    `);
    assertCheckpoint('Posted Purchase immutability: Update fails', updateRes.success === false && /Only draft purchases/i.test(updateRes.error || ''), updateRes.error || '');

    const deleteRes = await session.cdp.eval(`window.smartVyapar.deletePurchaseDraft(${js(purchaseId)})`);
    assertCheckpoint('Posted Purchase immutability: Delete fails', deleteRes.success === false && /Only draft purchases/i.test(deleteRes.error || ''), deleteRes.error || '');

    // Verify duplicate posting rejection
    const dupPostRes = await session.cdp.eval(`window.smartVyapar.postPurchase(${js(purchaseId)})`);
    assertCheckpoint('Duplicate posting rejection: Re-post fails', dupPostRes.success === false && /Only draft purchases/i.test(dupPostRes.error || ''), dupPostRes.error || '');

    await clickByText(session.cdp, 'Purchases');
    await waitForText(session.cdp, 'INV-123');
    await screenshot(session.cdp, '02-purchase-list');
  } finally {
    const closed = await closeSession(session);
    appLog += `--- first session stdout ---\n${closed.stdout}\n--- first session stderr ---\n${closed.stderr}\n`;
    assertCheckpoint('App closes', !closed.forced);
  }

  // 11. Restart persistence check
  const restart = await runSession();
  progress('Restart session connected.');
  try {
    await waitForText(restart.cdp, 'Dashboard');
    const persistedStock = await restart.cdp.eval(`window.smartVyapar.getProductStock(${js(productId)})`);
    assertCheckpoint('Restart persistence: stock remains 10', persistedStock.data.quantityOnHand === 10, `Stock: ${persistedStock.data.quantityOnHand}`);

    const persistedOutstanding = await restart.cdp.eval(`window.smartVyapar.getSupplierOutstanding(${js(supplierId)})`);
    assertCheckpoint('Restart persistence: outstanding remains 2380', persistedOutstanding.data.outstanding === 2380, `Outstanding: ${persistedOutstanding.data.outstanding}`);

    // Cancel posted purchase
    const cancelRes = await restart.cdp.eval(`window.smartVyapar.cancelPurchase(${js(purchaseId)}, 'Cancel Smoke Test')`);
    assertCheckpoint('Purchase cancellation succeeds', cancelRes.success);

    // Verify stock and supplier outstanding after cancellation
    const cancelStock = await restart.cdp.eval(`window.smartVyapar.getProductStock(${js(productId)})`);
    assertCheckpoint('Stock reversal: stock decreased to 0', cancelStock.data.quantityOnHand === 0, `Cancel stock: ${cancelStock.data.quantityOnHand}`);

    const cancelOutstanding = await restart.cdp.eval(`window.smartVyapar.getSupplierOutstanding(${js(supplierId)})`);
    assertCheckpoint('Supplier payable reversal: outstanding decreased to 1200', cancelOutstanding.data.outstanding === 1200, `Cancel outstanding: ${cancelOutstanding.data.outstanding}`);

    // Verify duplicate cancellation rejection
    const dupCancelRes = await restart.cdp.eval(`window.smartVyapar.cancelPurchase(${js(purchaseId)}, 'Cancel again')`);
    assertCheckpoint('Duplicate cancellation rejection', dupCancelRes.success === false && /Only posted purchases/i.test(dupCancelRes.error || ''), dupCancelRes.error || '');

    // Verify cancelled-purchase repost rejection
    const repostRes = await restart.cdp.eval(`window.smartVyapar.postPurchase(${js(purchaseId)})`);
    assertCheckpoint('Cancelled purchase repost rejection', repostRes.success === false && /Only draft purchases/i.test(repostRes.error || ''), repostRes.error || '');

    // Verify renderer security boundaries (DPAPI key / SQLCipher key check)
    const security = await restart.cdp.eval(`({
      requireType: typeof window.require,
      processType: typeof window.process,
      ipcRendererType: typeof window.ipcRenderer,
      fsType: typeof window.fs,
      genericInvokeType: typeof window.invoke,
      bodyLeaks: /smart-vyapar\\.db|database-key|BEGIN SQLCIPHER|DPAPI blob/i.test(document.body.innerText)
    })`);
    assertCheckpoint('Renderer security: No native leakage', security.requireType === 'undefined' && security.processType === 'undefined' && security.ipcRendererType === 'undefined' && security.fsType === 'undefined' && security.genericInvokeType === 'undefined' && security.bodyLeaks === false, JSON.stringify(security));
  } finally {
    const closed = await closeSession(restart);
    appLog += `--- restart session stdout ---\n${closed.stdout}\n--- restart session stderr ---\n${closed.stderr}\n`;
    assertCheckpoint('Restart app closes', !closed.forced);
  }

  // Write app log and parse database summary
  const logPath = path.join(userDataDir, 'logs', 'app.log');
  if (fs.existsSync(logPath)) appLog += `--- app.log ---\n${fs.readFileSync(logPath, 'utf8')}\n`;
  fs.writeFileSync(path.join(evidenceDir, 'purchase-packaged-app.log'), appLog);

  const summary = dbSummary();
  fs.writeFileSync(path.join(evidenceDir, 'purchase-database-summary.json'), JSON.stringify(summary, null, 2));

  // Package checks
  const packageChecks = {
    migrationBundled: fs.existsSync(path.join(root, 'dist-package', 'win-unpacked', 'resources', 'prisma', 'migrations', '20260802190000_supplier_purchase_foundation', 'migration.sql')),
    sqliteBundled: fs.existsSync(path.join(root, 'dist-package', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3-multiple-ciphers')),
    dpapiBundled: fs.existsSync(path.join(root, 'dist-package', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', '@primno', 'dpapi')),
    queryEngineCount: findFiles(path.join(root, 'dist-package', 'win-unpacked', 'resources'), /query_engine/i).length,
  };
  assertCheckpoint('Phase 5 migration SQL bundled', packageChecks.migrationBundled);
  assertCheckpoint('SQLCipher native module bundled', packageChecks.sqliteBundled);
  assertCheckpoint('DPAPI native module bundled', packageChecks.dpapiBundled);
  assertCheckpoint('query_engine_count=0', packageChecks.queryEngineCount === 0, `Query engines found: ${packageChecks.queryEngineCount}`);
  assertCheckpoint('No native module load errors', !/native module.*error|cannot find module.*better-sqlite3|cannot find module.*dpapi/i.test(appLog));

  // Write results
  const results = {
    label: 'Real packaged Electron Supplier & Purchase Foundation smoke test',
    capturedAt: new Date().toISOString(),
    isolatedUserDataPath: rel(userDataDir),
    packagedExecutablePath: rel(exePath),
    screenshots,
    checkpoints,
    defects,
    packageChecks,
    databaseSummary: summary,
    consoleMessages,
  };
  fs.writeFileSync(path.join(evidenceDir, 'purchase-smoke-results.json'), JSON.stringify(results, null, 2));
  progress('Purchase smoke results written.');

  if (defects.length) throw new Error(`Purchase smoke completed with defects: ${defects.join('; ')}`);
  console.log('\nALL PACKAGED ELECTRON SMOKE TESTS PASSED!');
}

function findFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findFiles(full, pattern));
    else if (pattern.test(entry.name)) found.push(full);
  }
  return found;
}

main().catch(error => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'purchase-smoke-error.log'), error.stack || error.message || String(error));
  console.error(error);
  process.exit(1);
});
