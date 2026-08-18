const fs = require('fs');
const path = require('path');
const http = require('http');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const smokeRoot = path.join(root, 'test-data', 'electron-import-smoke');
const userDataDir = path.join(smokeRoot, 'user-data');
const evidenceDir = path.join(root, 'docs', 'evidence', 'bulk-import-foundation');
const exePath = path.join(root, 'dist-package', 'win-unpacked', 'Smart Vyapar.exe');
const port = 9336;
const screenshots = [];
const checkpoints = [];
const defects = [];
const consoleMessages = [];
const progressPath = path.join(evidenceDir, 'import-smoke-progress.log');

let session = null;

if (!userDataDir.endsWith(path.join('test-data', 'electron-import-smoke', 'user-data'))) {
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
  throw new Error('Timed out waiting for import smoke CDP target.');
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
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(`Exception: ${res.exceptionDetails.exception.description}`);
    }
    return res.result.value;
  }
}

async function runSession() {
  progress('Launching packaged app session for bulk data import...');
  const child = childProcess.spawn(exePath, [
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    `--user-data-dir=${userDataDir}`
  ], {
    env: {
      ...process.env,
      SMART_VYAPAR_ELECTRON_SMOKE: 'true',
      SMART_VYAPAR_ELECTRON_SMOKE_USER_DATA: userDataDir,
    },
    detached: false
  });

  child.on('error', err => {
    console.error('Failed to spawn executable:', err);
  });

  try {
    const target = await waitForTarget();
    const cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    progress('Connected to packaged app instance via CDP.');
    return { child, cdp };
  } catch (err) {
    child.kill();
    throw err;
  }
}

async function closeSession(session) {
  progress('Requesting app session shutdown...');
  let stdout = '';
  let stderr = '';
  session.child.stdout && session.child.stdout.on('data', d => stdout += d.toString());
  session.child.stderr && session.child.stderr.on('data', d => stderr += d.toString());

  session.child.kill();
  const started = Date.now();
  let forced = false;
  while (Date.now() - started < 5000) {
    if (session.child.killed) break;
    await wait(200);
  }
  if (!session.child.killed) {
    session.child.kill('SIGKILL');
    forced = true;
    progress('App killed forcibly.');
  } else {
    progress('App closed cleanly.');
  }
  return { stdout, stderr, forced };
}

async function screenshot(cdp, name) {
  const outputName = `${name}.png`;
  const outputPath = path.join(evidenceDir, outputName);
  progress(`Capturing screenshot: ${outputName}`);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
  screenshots.push(rel(outputPath));
}

async function waitForText(cdp, text, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await cdp.eval(`document.body.innerText.includes(${js(text)})`);
    if (found) return;
    await wait(400);
  }
  throw new Error(`Timed out waiting for text "${text}" inside the renderer.`);
}

async function clickByText(cdp, text) {
  progress(`Clicking element with text: "${text}"`);
  const success = await cdp.eval(`
    (() => {
      const elements = Array.from(document.querySelectorAll('button, div, span, a, label'));
      const matches = elements.filter(el => el.innerText && el.innerText.trim().includes(${js(text)}));
      if (matches.length === 0) return false;
      matches.sort((a, b) => {
        const aIsClickable = a.tagName === 'BUTTON' || a.tagName === 'A';
        const bIsClickable = b.tagName === 'BUTTON' || b.tagName === 'A';
        if (aIsClickable && !bIsClickable) return -1;
        if (!aIsClickable && bIsClickable) return 1;
        return a.querySelectorAll('*').length - b.querySelectorAll('*').length;
      });
      matches[0].click();
      return true;
    })()
  `);
  if (!success) throw new Error(`Could not find click target containing text "${text}"`);
  await wait(500);
}

async function main() {
  progress('Initializing clean smoke test isolated data directories...');
  safeClear(userDataDir);

  let appLog = '';
  session = await runSession();

  try {
    // 1. Initial Setup: Shop Profile Creation
    await waitForText(session.cdp, 'Smart Vyapar Setup');
    await session.cdp.eval(`
      (() => {
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (!el) return;
          const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setVal('setup-name', 'Maharashtra Import Warehouse');
        setVal('setup-phone', '9111122222');
        setVal('setup-address', 'Import Hub, Pune, Maharashtra');
        setVal('setup-gst', '27AAAAA1111A1Z1');
        document.querySelector('button[type="submit"]').click();
      })()
    `);

    // Wait for Dashboard
    await waitForText(session.cdp, 'Dashboard');
    assertCheckpoint('Shop profile created successfully and redirected to dashboard', true);

    // 2. Navigate to Data Import
    await clickByText(session.cdp, 'Data Import');
    await waitForText(session.cdp, 'Step 1: Select What You Want to Import');
    assertCheckpoint('Bulk data import grid fully loaded', true);

    // 3. Confirm 9 entities are listed
    const entities = await session.cdp.eval(`
      (() => {
        const cards = document.querySelectorAll('.import-type-card');
        return Array.from(cards).map(c => c.querySelector('h3').innerText.trim());
      })()
    `);
    
    assertCheckpoint('UOM card exists', entities.includes('Units of Measure'));
    assertCheckpoint('Tax Rate card exists', entities.includes('Tax Rates & GST Slabs'));
    assertCheckpoint('Price Book card exists', entities.includes('Price Books'));
    assertCheckpoint('Product card exists', entities.includes('Product Master'));
    assertCheckpoint('Barcode card exists', entities.includes('Product Barcodes'));
    assertCheckpoint('Price card exists', entities.includes('Product Prices'));
    assertCheckpoint('Opening Stock card exists', entities.includes('Opening Stock'));
    assertCheckpoint('Supplier card exists', entities.includes('Supplier Master'));
    assertCheckpoint('Supplier balance card exists', entities.includes('Supplier Opening Balance'));

    // Capture dashboard evidence screenshot
    await screenshot(session.cdp, 'import_dashboard');

    // 4. Click Units of Measure card to verify step routing
    await clickByText(session.cdp, 'Units of Measure');
    await waitForText(session.cdp, 'Download Sample UNIT Template');
    assertCheckpoint('Step 2: File upload & column mapper page loaded', true);
    
    await screenshot(session.cdp, 'import_step2_uom');

  } catch (error) {
    try {
      if (session && session.cdp) {
        const html = await session.cdp.eval('document.documentElement.outerHTML');
        fs.writeFileSync(path.join(evidenceDir, 'import-smoke-page.html'), html);
        await screenshot(session.cdp, 'import-smoke-failure-page');
      }
    } catch (e) {
      fs.writeFileSync(path.join(evidenceDir, 'import-smoke-page-error.log'), String(e));
    }
    throw error;
  } finally {
    const closed = await closeSession(session);
    appLog += `--- session stdout ---\n${closed.stdout}\n--- session stderr ---\n${closed.stderr}\n`;
    assertCheckpoint('Packaged application closes cleanly', !closed.forced);
  }

  // Write app logs and metadata outputs
  const logPath = path.join(userDataDir, 'logs', 'app.log');
  if (fs.existsSync(logPath)) appLog += `--- app.log ---\n${fs.readFileSync(logPath, 'utf8')}\n`;
  fs.writeFileSync(path.join(evidenceDir, 'import-packaged-app.log'), appLog);

  // Write results json
  const results = {
    label: 'Real packaged Electron Bulk Data Import smoke test',
    capturedAt: new Date().toISOString(),
    isolatedUserDataPath: rel(userDataDir),
    packagedExecutablePath: rel(exePath),
    screenshots,
    checkpoints,
    defects,
    consoleMessages,
  };
  fs.writeFileSync(path.join(evidenceDir, 'import-smoke-results.json'), JSON.stringify(results, null, 2));
  progress('Import smoke results written.');

  if (defects.length) throw new Error(`Import smoke test completed with defects: ${defects.join('; ')}`);
  console.log('\nALL BULK DATA IMPORT PACKAGED SMOKE TESTS PASSED!');
}

main().catch(async error => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'import-smoke-error.log'), error.stack || error.message || String(error));
  fs.writeFileSync(path.join(evidenceDir, 'import-smoke-console.log'), JSON.stringify(consoleMessages, null, 2));

  try {
    if (session && session.cdp) {
      const html = await session.cdp.eval('document.documentElement.outerHTML');
      fs.writeFileSync(path.join(evidenceDir, 'import-smoke-page.html'), html);
    }
  } catch (htmlErr) {
    fs.writeFileSync(path.join(evidenceDir, 'import-smoke-page-error.log'), String(htmlErr));
  }

  console.error(error);
  process.exit(1);
});
