const fs = require('fs');
const path = require('path');
const http = require('http');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const smokeRoot = path.join(root, 'test-data', 'electron-inventory-smoke');
const userDataDir = path.join(smokeRoot, 'user-data');
const evidenceDir = path.join(root, 'docs', 'evidence', 'inventory-foundation');
const exePath = path.join(root, 'dist-package', 'win-unpacked', 'Smart Vyapar.exe');
const port = 9334;
const screenshots = [];
const checkpoints = [];
const defects = [];
const consoleMessages = [];
const progressPath = path.join(evidenceDir, 'inventory-smoke-progress.log');

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
  throw new Error('Timed out waiting for inventory smoke CDP target.');
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
  progress('Closing inventory smoke session.');
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
  progress(`Inventory smoke session closed${forced ? ' with forced kill' : ''}.`);
  return { stdout: session.stdoutRef(), stderr: session.stderrRef(), forced };
}

function dbSummary() {
  const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  const result = childProcess.spawnSync(electronExe, [path.join(root, 'scripts', 'summarize-electron-inventory-smoke-db.js')], {
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
  fs.writeFileSync(progressPath, `[${new Date().toISOString()}] Inventory smoke started.\n`);

  let appLog = '';
  let productId = '';
  const session = await runSession();
  progress('Packaged app connected.');
  try {
    await screenshot(session.cdp, '01-inventory-shop-setup');
    await fill(session.cdp, '#setup-name', 'Inventory Smoke Store');
    await fill(session.cdp, '#setup-phone', '9876543210');
    await fill(session.cdp, '#setup-address', 'Inventory Smoke Address');
    await clickByText(session.cdp, 'Initialize Local Database');
    assertCheckpoint('Packaged app launches and creates Shop', await waitForText(session.cdp, 'Dashboard'));

    await clickByText(session.cdp, 'Products');
    const category = await session.cdp.eval(`window.smartVyapar.createCategory({ name: 'Inventory Smoke Category' })`);
    const product = await session.cdp.eval(`
      window.smartVyapar.createProduct({
        product: {
          productCode: 'INV-SMOKE-001',
          name: 'Inventory Smoke Product',
          primaryUnitId: 'uom-pcs',
          categoryId: ${js(category.data.id)},
          productType: 'GOODS',
          trackInventory: true,
          allowNegativeStock: false,
          minimumStockLevel: 10,
          reorderLevel: 8,
          maximumStockLevel: 30,
          sku: 'INV-SMOKE-SKU'
        },
        barcodes: [{ barcode: '799999999901', isPrimary: true }],
        defaultPrice: { purchasePrice: 50, sellingPrice: 70, mrp: 80 },
        openingBalance: { quantity: 12, unitCost: 50 }
      })
    `);
    assertCheckpoint('Existing Product Master works and creates inventory product', product.success, product.error || '');
    productId = product.data.id;

    assertCheckpoint('Opening balance posts to ledger', (await session.cdp.eval(`window.smartVyapar.getProductStock(${js(productId)})`)).data.quantityOnHand === 12);
    assertCheckpoint('Adjustment-in works', (await session.cdp.eval(`window.smartVyapar.postStockAdjustment({ productId: ${js(productId)}, adjustmentType: 'ADJUSTMENT_IN', quantity: 5, unitCost: 52, reason: 'SMOKE_IN' })`)).success);
    assertCheckpoint('Adjustment-out works', (await session.cdp.eval(`window.smartVyapar.postStockAdjustment({ productId: ${js(productId)}, adjustmentType: 'ADJUSTMENT_OUT', quantity: 2, reason: 'SMOKE_OUT' })`)).success);
    assertCheckpoint('Damage works', (await session.cdp.eval(`window.smartVyapar.postDamageStock({ productId: ${js(productId)}, quantity: 1, reason: 'DAMAGED' })`)).success);
    assertCheckpoint('Expiry works', (await session.cdp.eval(`window.smartVyapar.postExpiredStock({ productId: ${js(productId)}, quantity: 1, expiryDate: '2026-08-02', reason: 'EXPIRED' })`)).success);
    assertCheckpoint('Loss works', (await session.cdp.eval(`window.smartVyapar.postLostStock({ productId: ${js(productId)}, quantity: 1, reason: 'LOST' })`)).success);
    const negative = await session.cdp.eval(`window.smartVyapar.postLostStock({ productId: ${js(productId)}, quantity: 100, reason: 'BLOCK' })`);
    assertCheckpoint('Negative stock blocked where configured', negative.success === false && /Insufficient stock/.test(negative.error || ''), negative.error || '');

    await clickByText(session.cdp, 'Inventory');
    assertCheckpoint('Inventory module opens', await waitForText(session.cdp, 'Inventory Actions'));
    await screenshot(session.cdp, '02-inventory-overview');
    await clickByText(session.cdp, 'Stock List');
    await waitForText(session.cdp, 'INV-SMOKE-001');
    await screenshot(session.cdp, '03-stock-list');
    await clickByText(session.cdp, 'View');
    const productStockViewVisible = await waitForText(session.cdp, 'Quantity On Hand');
    await screenshot(session.cdp, '04-product-stock-view');
    assertCheckpoint('Product View displays stock', productStockViewVisible);
    await clickByText(session.cdp, 'Movements');
    await waitForText(session.cdp, 'DAMAGE_OUT');
    await screenshot(session.cdp, '05-movement-history');
    await clickByText(session.cdp, 'Adjust In');
    await screenshot(session.cdp, '06-adjustment-in');
    await clickByText(session.cdp, 'Adjust Out');
    await screenshot(session.cdp, '07-adjustment-out');
    await clickByText(session.cdp, 'Damage');
    await screenshot(session.cdp, '08-damage-stock');
    await clickByText(session.cdp, 'Expiry');
    await screenshot(session.cdp, '09-expired-stock');
    await clickByText(session.cdp, 'Loss');
    await screenshot(session.cdp, '10-lost-stock');
    await screenshot(session.cdp, '11-full-window-1366x768');

    const finalStock = await session.cdp.eval(`window.smartVyapar.getProductStock(${js(productId)})`);
    assertCheckpoint('Current stock displays correctly', finalStock.data.quantityOnHand === 12);
    const dashboard = await session.cdp.eval('window.smartVyapar.getInventoryDashboardSummary()');
    assertCheckpoint('Dashboard low-stock count displays', dashboard.success && typeof dashboard.data.lowStockProducts === 'number');
    const security = await session.cdp.eval(`({
      requireType: typeof window.require,
      processType: typeof window.process,
      ipcRendererType: typeof window.ipcRenderer,
      fsType: typeof window.fs,
      genericInvokeType: typeof window.invoke,
      bodyLeaks: /smart-vyapar\\.db|database-key|BEGIN SQLCIPHER|DPAPI blob/i.test(document.body.innerText)
    })`);
    assertCheckpoint('Renderer security passes', security.requireType === 'undefined' && security.processType === 'undefined' && security.ipcRendererType === 'undefined' && security.fsType === 'undefined' && security.genericInvokeType === 'undefined' && security.bodyLeaks === false, JSON.stringify(security));
  } finally {
    const closed = await closeSession(session);
    appLog += `--- first session stdout ---\n${closed.stdout}\n--- first session stderr ---\n${closed.stderr}\n`;
    assertCheckpoint('App closes', !closed.forced);
  }

  const restart = await runSession();
  progress('Restart session connected.');
  try {
    await waitForText(restart.cdp, 'Dashboard');
    const persisted = await restart.cdp.eval(`Promise.all([
      window.smartVyapar.getProductStock(${js(productId)}),
      window.smartVyapar.getInventoryMovements({ productId: ${js(productId)}, page: 1, pageSize: 20, sortBy: 'occurredAt', sortDirection: 'DESC' })
    ])`);
    assertCheckpoint('Stock and movements persist after restart', persisted[0].data.quantityOnHand === 12 && persisted[1].data.items.length >= 6);
    await clickByText(restart.cdp, 'Inventory');
    await screenshot(restart.cdp, '12-low-stock-dashboard');
  } finally {
    const closed = await closeSession(restart);
    appLog += `--- restart session stdout ---\n${closed.stdout}\n--- restart session stderr ---\n${closed.stderr}\n`;
    assertCheckpoint('Restart app closes', !closed.forced);
  }

  const logPath = path.join(userDataDir, 'logs', 'app.log');
  if (fs.existsSync(logPath)) appLog += `--- app.log ---\n${fs.readFileSync(logPath, 'utf8')}\n`;
  fs.writeFileSync(path.join(evidenceDir, 'inventory-packaged-app.log'), appLog);
  const summary = dbSummary();
  fs.writeFileSync(path.join(evidenceDir, 'inventory-database-summary.json'), JSON.stringify(summary, null, 2));

  const packageChecks = {
    migrationBundled: fs.existsSync(path.join(root, 'dist-package', 'win-unpacked', 'resources', 'prisma', 'migrations', '20260802150000_inventory_foundation', 'migration.sql')),
    queryEngineCount: findFiles(path.join(root, 'dist-package', 'win-unpacked', 'resources'), /query_engine/i).length,
  };
  assertCheckpoint('No Prisma runtime/query engine returns', packageChecks.queryEngineCount === 0, JSON.stringify(packageChecks));
  assertCheckpoint('No native module error', !/native module.*error|cannot find module.*better-sqlite3|cannot find module.*dpapi/i.test(appLog));

  const results = {
    label: 'Real packaged Electron Inventory Foundation smoke test',
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
  fs.writeFileSync(path.join(evidenceDir, 'inventory-smoke-results.json'), JSON.stringify(results, null, 2));
  progress('Inventory smoke results written.');
  if (defects.length) throw new Error(`Inventory smoke completed with defects: ${defects.join('; ')}`);
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
  fs.writeFileSync(path.join(evidenceDir, 'inventory-smoke-error.log'), error.stack || error.message || String(error));
  console.error(error);
  process.exit(1);
});
