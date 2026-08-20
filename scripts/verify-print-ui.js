const fs = require('fs');
const path = require('path');
const http = require('http');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const port = 9334;
const artifactDir = 'C:\\Users\\Akash Gaikwad\\.gemini\\antigravity-ide\\brain\\1fc11c8d-060d-446f-9516-0f0458b0ec22';

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function js(value) { return JSON.stringify(value); }

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
  while (Date.now() - started < 30000) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await wait(500);
  }
  throw new Error('Timed out waiting for Electron CDP target.');
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
  while (Date.now() - started < 20000) {
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
  await wait(1000);
}

async function capture(cdp, filename) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(artifactDir, filename);
  fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
  console.log(`Screenshot saved to: ${file}`);
}

async function run() {
  console.log('Spawning Electron process with remote debugging...');
  const child = childProcess.spawn('npx', [
    'electron',
    '.',
    `--remote-debugging-port=${port}`,
    '--disable-gpu'
  ], {
    cwd: root,
    stdio: 'ignore',
    shell: true
  });

  try {
    const target = await waitForTarget();
    console.log(`Connected to target: ${target.title}`);
    const cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    console.log('Waiting for App to load...');
    await waitForText(cdp, 'Smart Vyapar');
    console.log('App loaded! Navigating to Sales History...');
    
    await clickByText(cdp, 'Sales History');
    await wait(2000);

    console.log('Opening details modal for the first posted invoice...');
    const hasViewButton = await cdp.eval(`
      (() => {
        const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'View');
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    `);
    if (!hasViewButton) {
      console.log('No View button found.');
    }

    await wait(2000); // wait for details modal to fetch invoice details
    console.log('Capturing details modal screenshot...');
    await capture(cdp, 'print_details_modal.png');

    console.log('Clicking Print / Reprint button...');
    const printClicked = await cdp.eval(`
      (() => {
        const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Print / Reprint');
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    `);
    
    if (printClicked) {
      console.log('Print / Reprint clicked successfully.');
      // Wait for native system dialog popup / async trigger
      await wait(3000);
      console.log('Capturing print layout / dialog state screenshot...');
      await capture(cdp, 'print_triggered_state.png');
    } else {
      console.error('Print / Reprint button not found in details modal.');
    }

    cdp.close();
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    console.log('Killing Electron process...');
    child.kill();
  }
}

run();
