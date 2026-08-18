const fs = require('fs');
const path = require('path');
const http = require('http');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const smokeRoot = path.join(root, 'test-data', 'electron-product-smoke');
const userDataDir = path.join(smokeRoot, 'user-data');
const smokeEvidenceDir = path.join(smokeRoot, 'evidence');
const docsEvidenceDir = path.join(root, 'docs', 'evidence', 'product-electron-smoke');
const exePath = path.join(root, 'dist-package', 'win-unpacked', 'Smart Vyapar.exe');
const port = 9333;

const screenshots = [];
const defects = [];
const checkpoints = [];
const consoleMessages = [];
const progressLogPath = path.join(docsEvidenceDir, 'smoke-progress.log');

function progress(message) {
  fs.mkdirSync(docsEvidenceDir, { recursive: true });
  fs.appendFileSync(progressLogPath, `[${new Date().toISOString()}] ${message}\n`);
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertCheckpoint(name, passed, notes = '') {
  checkpoints.push({ name, status: passed ? 'PASS' : 'FAIL', notes });
  if (!passed) {
    defects.push(`${name}: ${notes}`);
  }
}

function safeClearDir(dir) {
  const resolved = path.resolve(dir);
  const allowed = path.resolve(smokeRoot);
  if (resolved !== allowed && !resolved.startsWith(allowed + path.sep)) {
    throw new Error(`Refusing to clear path outside smoke root: ${resolved}`);
  }
  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  fs.mkdirSync(resolved, { recursive: true });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function waitForTarget() {
  const started = Date.now();
  while (Date.now() - started < 45000) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // keep polling
    }
    await wait(500);
  }
  throw new Error('Timed out waiting for packaged app CDP target.');
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
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        consoleMessages.push({ type: msg.params.type, args: msg.params.args.map((arg) => arg.value ?? arg.description ?? '') });
      } else if (msg.method === 'Log.entryAdded') {
        consoleMessages.push({ type: msg.params.entry.level, args: [msg.params.entry.text] });
      }
    });
    this.ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error('CDP websocket closed before command completed.'));
      }
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

  async eval(expression, awaitPromise = true) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
    }
    return result.result.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

function jsString(value) {
  return JSON.stringify(value);
}

async function waitForText(cdp, text) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const found = await cdp.eval(`document.body.innerText.includes(${jsString(text)})`);
    if (found) return true;
    await wait(500);
  }
  return false;
}

async function clickByText(cdp, text) {
  const ok = await cdp.eval(`
    (() => {
      const el = Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent && button.textContent.includes(${jsString(text)}));
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Button not found: ${text}`);
  await wait(700);
}

async function clickProductNavIndex(cdp, index) {
  const ok = await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('.product-module > .sub-nav button'));
      const el = buttons[${index}];
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Product nav index not found: ${index}`);
  await wait(800);
}

async function clickRowAction(cdp, title) {
  const ok = await cdp.eval(`
    (() => {
      const el = document.querySelector(${jsString(`button[title="${title}"]`)});
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Row action not found: ${title}`);
  await wait(800);
}

async function fill(cdp, selector, value) {
  await cdp.eval(`
    (() => {
      const el = document.querySelector(${jsString(selector)});
      if (!el) throw new Error('Missing selector ${selector}');
      const proto = el.tagName === 'SELECT'
        ? HTMLSelectElement.prototype
        : el.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (el._valueTracker) el._valueTracker.setValue('');
      setter.call(el, ${jsString(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `);
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const docsPath = path.join(docsEvidenceDir, `${name}.png`);
  const smokePath = path.join(smokeEvidenceDir, `${name}.png`);
  const buffer = Buffer.from(result.data, 'base64');
  fs.writeFileSync(docsPath, buffer);
  fs.writeFileSync(smokePath, buffer);
  screenshots.push(rel(docsPath));
}

async function createShopViaUi(cdp) {
  await fill(cdp, '#setup-name', 'Packaged Product Smoke Store');
  await fill(cdp, '#setup-phone', '9876543210');
  await fill(cdp, '#setup-address', 'Isolated Smoke Test Address');
  await fill(cdp, '#setup-gst', '07AAAAA1111A1Z1');
  await clickByText(cdp, 'Initialize Local Database');
  await waitForText(cdp, 'Dashboard');
}

async function createProductViaApi(cdp) {
  return cdp.eval(`
    window.smartVyapar.createProduct({
      product: {
        productCode: 'PKG-PROD-001',
        name: 'Packaged Smoke Product',
        primaryUnitId: 'uom-pcs',
        categoryId: 'cat-packaged-smoke',
        brandId: 'brand-packaged-smoke',
        hsnSacCode: '0405',
        taxRateId: 'tax-gst-18',
        productType: 'GOODS',
        trackInventory: true,
        sku: 'PKG-SKU-001'
      },
      barcodes: [{ barcode: '989898989801', barcodeType: 'EAN13', isPrimary: true }],
      defaultPrice: { purchasePrice: 210, sellingPrice: 245, mrp: 250 },
      openingBalance: { quantity: 12, unitCost: 210 }
    })
  `);
}

async function updateProductViaApi(cdp, id, categoryId, brandId) {
  return cdp.eval(`
    window.smartVyapar.updateProduct(${jsString(id)}, {
      product: {
        productCode: 'PKG-PROD-001',
        name: 'Packaged Smoke Product Edited',
        primaryUnitId: 'uom-pcs',
        categoryId: ${jsString(categoryId)},
        brandId: ${jsString(brandId)},
        hsnSacCode: '0405',
        taxRateId: 'tax-gst-18',
        productType: 'GOODS',
        trackInventory: true,
        sku: 'PKG-SKU-001'
      },
      barcodes: [{ barcode: '989898989801', barcodeType: 'EAN13', isPrimary: true }],
      defaultPrice: { purchasePrice: 215, sellingPrice: 255, mrp: 260 }
    })
  `);
}

async function runAppSession({ restart = false } = {}) {
  const env = {
    ...process.env,
    SMART_VYAPAR_ELECTRON_SMOKE: 'true',
    ELECTRON_ENABLE_LOGGING: 'true',
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = childProcess.spawn(exePath, [`--remote-debugging-port=${port}`, '--disable-gpu'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  const target = await waitForTarget();
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await waitForText(cdp, restart ? 'Product Master' : 'Smart Vyapar');
  return { child, cdp, stdoutRef: () => stdout, stderrRef: () => stderr };
}

function readDatabaseSummary() {
  const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  const result = childProcess.spawnSync(electronExe, [path.join(root, 'scripts', 'summarize-electron-smoke-db.js')], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Failed to summarize smoke DB: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

async function closeSession(session) {
  progress('Closing packaged app session.');
  let forced = false;
  const exitPromise = new Promise((resolve) => {
    if (session.child.exitCode !== null || session.child.signalCode !== null) {
      resolve();
    } else {
      session.child.once('exit', resolve);
    }
  });

  try {
    await Promise.race([
      session.cdp.send('Browser.close'),
      wait(3000),
    ]);
  } catch {
    // app may already be closing
  }
  session.cdp.close();

  const exited = await Promise.race([
    exitPromise.then(() => true),
    wait(7000).then(() => false),
  ]);
  if (!exited && !session.child.killed) {
    forced = true;
    session.child.kill();
    await Promise.race([
      exitPromise,
      wait(3000),
    ]);
  }
  progress(`Packaged app session closed${forced ? ' with forced kill' : ''}.`);
  return {
    stdout: session.stdoutRef(),
    stderr: session.stderrRef(),
    forced,
  };
}

async function main() {
  progress('Smoke script started.');
  if (!fs.existsSync(exePath)) {
    throw new Error(`Packaged executable not found: ${exePath}`);
  }

  safeClearDir(smokeRoot);
  safeClearDir(path.join(smokeRoot, 'user-data'));
  fs.mkdirSync(smokeEvidenceDir, { recursive: true });
  fs.mkdirSync(docsEvidenceDir, { recursive: true });
  fs.writeFileSync(progressLogPath, `[${new Date().toISOString()}] Smoke directories prepared.\n`);

  let packagedLog = '';
  let productId = '';
  let categoryId = '';
  let brandId = '';

  const session = await runAppSession();
  progress('First packaged app session connected.');
  try {
    const setupVisible = await waitForText(session.cdp, 'Smart Vyapar Setup');
    assertCheckpoint('Packaged Shop Setup appears', setupVisible);
    await screenshot(session.cdp, '01-packaged-shop-setup');
    progress('Captured shop setup.');

    await createShopViaUi(session.cdp);
    progress('Shop created through packaged UI.');
    assertCheckpoint('Test Shop can be created', await waitForText(session.cdp, 'Dashboard'));

    const dbStatus = await session.cdp.eval('window.smartVyapar.getDatabaseStatus()');
    assertCheckpoint('Database status connected and encrypted', dbStatus.success && dbStatus.data.state === 'CONNECTED' && dbStatus.data.encrypted === true, JSON.stringify(dbStatus));

    await clickByText(session.cdp, 'Products');
    assertCheckpoint('Products module opens', await waitForText(session.cdp, 'Product Master'));
    progress('Products module opened.');

    const units = await session.cdp.eval('window.smartVyapar.listUnits(true)');
    assertCheckpoint('Unit records load from SQLCipher', units.success && units.data.length > 0, `count=${units.data?.length || 0}`);

    const taxRates = await session.cdp.eval('window.smartVyapar.listTaxRates(true)');
    assertCheckpoint('Tax Rate seed records load', taxRates.success && taxRates.data.length > 0, `count=${taxRates.data?.length || 0}`);

    const cat = await session.cdp.eval('window.smartVyapar.createCategory({ name: "Packaged Smoke Category", description: "Smoke test category" })');
    assertCheckpoint('Category can be created', cat.success, cat.error || '');
    const brand = await session.cdp.eval('window.smartVyapar.createBrand({ name: "Packaged Smoke Brand", description: "Smoke test brand" })');
    assertCheckpoint('Brand can be created', brand.success, brand.error || '');
    categoryId = cat.data.id;
    brandId = brand.data.id;

    await session.cdp.eval(`window.__smokeCatId = ${jsString(categoryId)}; window.__smokeBrandId = ${jsString(brandId)};`);
    await session.cdp.eval(`
      window.smartVyapar.createCategory = ((orig) => (...args) => orig(...args))(window.smartVyapar.createCategory);
    `);

    // Use the deterministic IDs expected by createProductViaApi.
    await session.cdp.eval(`window.smartVyapar.updateCategory(${jsString(categoryId)}, { name: "Packaged Smoke Category" })`);
    await session.cdp.eval(`window.smartVyapar.updateBrand(${jsString(brandId)}, { name: "Packaged Smoke Brand" })`);
    await session.cdp.eval(`
      window.__createSmokeProduct = async () => window.smartVyapar.createProduct({
        product: {
          productCode: 'PKG-PROD-001',
          name: 'Packaged Smoke Product',
          primaryUnitId: 'uom-pcs',
          categoryId: window.__smokeCatId,
          brandId: window.__smokeBrandId,
          hsnSacCode: '0405',
          taxRateId: 'tax-gst-18',
          productType: 'GOODS',
          trackInventory: true,
          sku: 'PKG-SKU-001'
        },
        barcodes: [{ barcode: '989898989801', barcodeType: 'EAN13', isPrimary: true }],
        defaultPrice: { purchasePrice: 210, sellingPrice: 245, mrp: 250 },
        openingBalance: { quantity: 12, unitCost: 210 }
      });
    `);
    const product = await session.cdp.eval('window.__createSmokeProduct()');
    progress('Product created through real preload IPC.');
    assertCheckpoint('Product creation succeeds', product.success, product.error || '');
    productId = product.data.id;
    assertCheckpoint('Product has persisted default ProductPrice', product.data.sellingPrice === 245 && product.data.mrp === 250);
    assertCheckpoint('Product barcode persists', product.data.barcodes.some((b) => b.barcode === '989898989801' && b.isPrimary));

    const dbSummaryAfterCreate = readDatabaseSummary();
    assertCheckpoint('Opening balance persists for GOODS product', dbSummaryAfterCreate.openingBalance?.quantity === 12);

    await clickProductNavIndex(session.cdp, 0);
    await fill(session.cdp, '#product-search', 'PKG-PROD-001');
    await clickByText(session.cdp, 'Search');
    await waitForText(session.cdp, 'PKG-PROD-001');
    await screenshot(session.cdp, '02-packaged-product-list');
    progress('Captured product list.');
    assertCheckpoint('Product appears in Product List', await waitForText(session.cdp, 'PKG-PROD-001'));

    await clickProductNavIndex(session.cdp, 1);
    await screenshot(session.cdp, '03-packaged-create-product');
    progress('Captured create product form.');

    await clickProductNavIndex(session.cdp, 0);
    await clickRowAction(session.cdp, 'View');
    await screenshot(session.cdp, '04-packaged-product-view');
    progress('Captured product view.');
    assertCheckpoint('Product View loads persisted values', await waitForText(session.cdp, 'Packaged Smoke Product'));

    const updated = await updateProductViaApi(session.cdp, productId, categoryId, brandId);
    assertCheckpoint('Product Edit persists changes', updated.success && updated.data.name === 'Packaged Smoke Product Edited', updated.error || '');
    await clickProductNavIndex(session.cdp, 0);
    await clickRowAction(session.cdp, 'Edit');
    await screenshot(session.cdp, '05-packaged-edit-product');
    progress('Captured product edit view.');

    await clickProductNavIndex(session.cdp, 1);
    await fill(session.cdp, '#pf-code', 'PKG-PROD-001');
    await fill(session.cdp, '#pf-name', 'Duplicate Code Product');
    await fill(session.cdp, '#pf-unit', 'uom-pcs');
    await fill(session.cdp, '#pf-sell', '99');
    await fill(session.cdp, '#pf-mrp', '109');
    await clickByText(session.cdp, 'Create Product');
    await waitForText(session.cdp, 'already exists');
    await screenshot(session.cdp, '06-duplicate-product-code-error');
    progress('Captured duplicate product code validation.');
    assertCheckpoint('Duplicate Product Code is rejected', await session.cdp.eval('document.body.innerText.includes("already exists")'));

    await clickProductNavIndex(session.cdp, 1);
    await fill(session.cdp, '#pf-code', 'PKG-PROD-002');
    await fill(session.cdp, '#pf-name', 'Duplicate Barcode Product');
    await fill(session.cdp, '#pf-unit', 'uom-pcs');
    await fill(session.cdp, '#pf-sell', '99');
    await fill(session.cdp, '#pf-mrp', '109');
    await fill(session.cdp, '#pf-barcode', '989898989801');
    await clickByText(session.cdp, '+ Add');
    await clickByText(session.cdp, 'Create Product');
    await waitForText(session.cdp, 'already assigned');
    await screenshot(session.cdp, '07-duplicate-barcode-error');
    progress('Captured duplicate barcode validation.');
    assertCheckpoint('Duplicate Barcode is rejected', await session.cdp.eval('document.body.innerText.includes("already assigned")'));

    await clickProductNavIndex(session.cdp, 0);
    await fill(session.cdp, '#product-search', 'PKG-PROD-001');
    await clickByText(session.cdp, 'Search');
    await wait(800);
    await screenshot(session.cdp, '08-product-search-result');
    progress('Captured product search result.');
    assertCheckpoint('Search by Product Code works', await session.cdp.eval('document.body.innerText.includes("PKG-PROD-001")'));

    const barcodeSearch = await session.cdp.eval(`window.smartVyapar.listProducts({ search: '989898989801', page: 1, pageSize: 10, sortBy: 'name', sortDirection: 'ASC' })`);
    assertCheckpoint('Search by Barcode works', barcodeSearch.success && barcodeSearch.data.items.some((item) => item.productCode === 'PKG-PROD-001'));

    const inactive = await session.cdp.eval(`window.smartVyapar.setProductActive(${jsString(productId)}, false)`);
    const active = await session.cdp.eval(`window.smartVyapar.setProductActive(${jsString(productId)}, true)`);
    assertCheckpoint('Product deactivate/activate persists', inactive.success && inactive.data.isActive === false && active.success && active.data.isActive === true);

    const security = await session.cdp.eval(`({
      requireType: typeof window.require,
      processType: typeof window.process,
      ipcRendererType: typeof window.ipcRenderer,
      fsType: typeof window.fs,
      genericInvokeType: typeof window.invoke,
      smartInvokeType: typeof window.smartVyapar.invoke,
      bodyLeaks: /smart-vyapar\\.db|database-key|BEGIN SQLCIPHER|recovery|DPAPI blob/i.test(document.body.innerText)
    })`);
    assertCheckpoint('Renderer security boundaries pass', security.requireType === 'undefined' && security.processType === 'undefined' && security.ipcRendererType === 'undefined' && security.fsType === 'undefined' && security.genericInvokeType === 'undefined' && security.smartInvokeType === 'undefined' && security.bodyLeaks === false, JSON.stringify(security));

    await screenshot(session.cdp, '09-full-window-1366x768');
    progress('Captured full window evidence.');
  } finally {
    const closed = await closeSession(session);
    packagedLog += `--- first session stdout ---\n${closed.stdout}\n--- first session stderr ---\n${closed.stderr}\n`;
    assertCheckpoint('First packaged app session closes cleanly', !closed.forced);
  }

  progress('Starting packaged app restart session.');
  const restartSession = await runAppSession({ restart: true });
  progress('Restart packaged app session connected.');
  try {
    await waitForText(restartSession.cdp, 'Dashboard');
    await clickByText(restartSession.cdp, 'Products');
    await clickProductNavIndex(restartSession.cdp, 0);
    await fill(restartSession.cdp, '#product-search', 'PKG-PROD-001');
    await clickByText(restartSession.cdp, 'Search');
    await waitForText(restartSession.cdp, 'PKG-PROD-001');
    await screenshot(restartSession.cdp, '10-product-after-restart');
    progress('Captured restart product list.');
    const persisted = await restartSession.cdp.eval(`Promise.all([
      window.smartVyapar.getShop(),
      window.smartVyapar.listProducts({ search: 'PKG-PROD-001', page: 1, pageSize: 10, sortBy: 'name', sortDirection: 'ASC' }),
      window.smartVyapar.getProductByBarcode('989898989801')
    ])`);
    assertCheckpoint('Restart persistence works', persisted[0].success && persisted[0].data?.name === 'Packaged Product Smoke Store' && persisted[1].data.items.length === 1 && persisted[2].data?.name === 'Packaged Smoke Product Edited');
  } finally {
    const closed = await closeSession(restartSession);
    packagedLog += `--- restart session stdout ---\n${closed.stdout}\n--- restart session stderr ---\n${closed.stderr}\n`;
    assertCheckpoint('Restart packaged app session closes cleanly', !closed.forced);
  }

  const appLogPath = path.join(userDataDir, 'logs', 'app.log');
  if (fs.existsSync(appLogPath)) {
    packagedLog += `--- app.log ---\n${fs.readFileSync(appLogPath, 'utf8')}\n`;
  }
  fs.writeFileSync(path.join(docsEvidenceDir, 'packaged-app.log'), packagedLog);
  fs.writeFileSync(path.join(smokeRoot, 'packaged-app.log'), packagedLog);
  progress('Packaged app logs written.');

  const dbSummary = readDatabaseSummary();
  fs.writeFileSync(path.join(docsEvidenceDir, 'test-database-summary.json'), JSON.stringify(dbSummary, null, 2));
  fs.writeFileSync(path.join(smokeRoot, 'test-database-summary.json'), JSON.stringify(dbSummary, null, 2));
  progress('Database summary written.');

  const packageChecks = {
    executableExists: fs.existsSync(exePath),
    productMigrationBundled: fs.existsSync(path.join(root, 'dist-package', 'win-unpacked', 'resources', 'prisma', 'migrations', '20260802120000_product_master', 'migration.sql')),
    sqlcipherNativeBundled: fs.existsSync(path.join(root, 'dist-package', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3-multiple-ciphers', 'build', 'Release', 'better_sqlite3.node')),
    dpapiNativeBundled: fs.existsSync(path.join(root, 'dist-package', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', '@primno', 'dpapi', 'prebuilds', 'win32-x64', '@primno+dpapi.node')),
    queryEngineCount: findFiles(path.join(root, 'dist-package', 'win-unpacked', 'resources'), /query_engine/i).length,
  };
  assertCheckpoint('Native and packaging verification passes', packageChecks.executableExists && packageChecks.productMigrationBundled && packageChecks.sqlcipherNativeBundled && packageChecks.dpapiNativeBundled && packageChecks.queryEngineCount === 0, JSON.stringify(packageChecks));

  const results = {
    label: 'Real packaged Electron Product Master smoke test',
    capturedAt: new Date().toISOString(),
    isolatedUserDataPath: rel(userDataDir),
    packagedExecutablePath: rel(exePath),
    launchCommand: `SMART_VYAPAR_ELECTRON_SMOKE=true "${rel(exePath)}" --remote-debugging-port=${port} --disable-gpu`,
    screenshots,
    checkpoints,
    defects,
    packageChecks,
    consoleMessages,
  };
  fs.writeFileSync(path.join(docsEvidenceDir, 'smoke-results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(smokeRoot, 'smoke-results.json'), JSON.stringify(results, null, 2));
  progress('Smoke results written.');

  if (defects.length > 0) {
    throw new Error(`Smoke test completed with defects: ${defects.join('; ')}`);
  }
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

main().catch((error) => {
  fs.mkdirSync(docsEvidenceDir, { recursive: true });
  fs.writeFileSync(path.join(docsEvidenceDir, 'smoke-error.log'), error.stack || error.message || String(error));
  console.error(error);
  process.exit(1);
});
