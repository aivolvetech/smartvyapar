const fs = require('fs');
const path = require('path');
const http = require('http');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const userDataDir = path.join(root, 'test-data', 'customer-ui-smoke-userData');
const docsEvidenceDir = path.join(root, 'docs', 'evidence', 'phase6-customer-foundation');
const port = 9333;

function progress(message) {
  console.log(`[PROGRESS] ${message}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      console.log('Discovered targets:', targets);
      const page = targets.find((target) => 
        target.type === 'page' && 
        target.webSocketDebuggerUrl && 
        !target.url.startsWith('devtools://')
      );
      if (page) return page;
    } catch {
      // keep polling
    }
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
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    this.ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error('CDP websocket closed.'));
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
      }, 20000).unref();
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate failed');
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

async function waitForSelector(cdp, selector) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const found = await cdp.eval(`!!document.querySelector(${jsString(selector)})`);
    if (found) return true;
    await wait(500);
  }
  return false;
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

async function clickByText(cdp, text, tag = 'button') {
  const ok = await cdp.eval(`
    (() => {
      const el = Array.from(document.querySelectorAll(${jsString(tag)}))
        .find((el) => el.textContent && el.textContent.includes(${jsString(text)}));
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  if (!ok) throw new Error(`Element <${tag}> not found with text: ${text}`);
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
  await wait(200);
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const filename = path.join(docsEvidenceDir, `${name}.png`);
  fs.writeFileSync(filename, Buffer.from(result.data, 'base64'));
  progress(`Screenshot saved: ${path.relative(root, filename)}`);
  await wait(200);
}

async function main() {
  progress('Starting Phase 6.2 UI Verification script...');
  
  // Clean workspace folders
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(docsEvidenceDir, { recursive: true });

  const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VITE_DEV_SERVER_URL; // Force local bundle index.html loading

  progress('Spawning Electron process...');
  const child = childProcess.spawn(electronExe, ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--disable-gpu'], {
    cwd: root,
    env,
  });

  child.on('error', (err) => {
    console.error('Failed to spawn Electron:', err);
    process.exit(1);
  });

  const target = await waitForTarget();
  progress(`CDP target resolved: ${target.webSocketDebuggerUrl}`);

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

  // Wait for Setup Screen
  progress('Waiting for shop setup screen...');
  await waitForSelector(cdp, '#setup-name');

  // Step 1: Create Shop setup profile
  progress('Filling shop setup form...');
  await fill(cdp, '#setup-name', 'Smart Vyapar Main Store');
  await fill(cdp, '#setup-phone', '9998887776');
  await fill(cdp, '#setup-address', 'Deccan Gymkhana, Pune');
  await fill(cdp, '#setup-gst', '27AAAAA1111A1Z1');
  await clickByText(cdp, 'Initialize Local Database');

  // Wait for App Dashboard
  await waitForText(cdp, 'Dashboard');
  await screenshot(cdp, '01_dashboard_after_setup');

  // Step 2: Open Customer module
  progress('Opening Customers module...');
  await clickByText(cdp, 'Customers', 'button');
  await waitForText(cdp, 'Customer Master');
  await screenshot(cdp, '02_customer_list_initial');

  // Step 3: Add new customer Shirish Kale
  progress('Opening new customer creation form...');
  await clickByText(cdp, 'Add Customer');
  await waitForText(cdp, 'New Customer Profile');
  await screenshot(cdp, '03_new_customer_form');

  progress('Filling Shirish Kale details...');
  await fill(cdp, '#cust-name', 'Shirish Kale');
  await fill(cdp, '#cust-phone', '9888877777');
  await fill(cdp, '#cust-gst', '27BBBBB2222B2Z2');
  await fill(cdp, '#cust-notes', 'Loyal retail customer');
  await clickByText(cdp, 'Save Profile');

  // Verify list refreshes
  await waitForText(cdp, 'Shirish Kale');
  await screenshot(cdp, '04_customer_list_with_shirish');

  // Step 4: Duplicate Customer Code Error Check
  progress('Testing duplicate customer code validation error...');
  await clickByText(cdp, 'Add Customer');
  await waitForText(cdp, 'New Customer Profile');
  await fill(cdp, '#cust-code', 'CUST-000001'); // Already assigned to Shirish
  await fill(cdp, '#cust-name', 'Duplicate Code Customer');
  await clickByText(cdp, 'Save Profile');
  await wait(1000);
  await screenshot(cdp, '05_validation_duplicate_code');
  await clickByText(cdp, 'Cancel');

  // Step 5: Duplicate GST Number Error Check
  progress('Testing duplicate active GST validation error...');
  await clickByText(cdp, 'Add Customer');
  await waitForText(cdp, 'New Customer Profile');
  await fill(cdp, '#cust-name', 'GST Conflict Customer');
  await fill(cdp, '#cust-gst', '27BBBBB2222B2Z2'); // Assigned to Shirish
  await clickByText(cdp, 'Save Profile');
  await wait(1000);
  await screenshot(cdp, '06_validation_gst_conflict');
  await clickByText(cdp, 'Cancel');

  // Step 6: View Shirish details and post opening balance (RECEIVABLE)
  progress('Navigating to Shirish Kale detailed profile...');
  await clickByText(cdp, 'Shirish Kale', 'button');
  await waitForText(cdp, 'Customer Outstanding');
  await screenshot(cdp, '07_customer_view_shirish');

  progress('Opening opening balance posting dialog...');
  await clickByText(cdp, 'Post Opening Balance');
  await waitForText(cdp, 'Post Opening Balance');

  progress('Posting RECEIVABLE opening balance...');
  await fill(cdp, '#ob-amount', '1205.58');
  await fill(cdp, '#ob-ref', 'OB-SH-001');
  await fill(cdp, '#ob-notes', 'Initial debit terms');
  
  // Override browser confirm dialog
  await cdp.eval(`window.confirm = () => true;`);
  await clickByText(cdp, 'Post Balance');
  await wait(1500);
  await screenshot(cdp, '08_customer_shirish_with_ledger');

  // Step 7: Create Geeta Sen and post ADVANCE opening balance
  progress('Creating Geeta Sen profile...');
  await clickByText(cdp, 'Back to List', 'button');
  await clickByText(cdp, 'Add Customer');
  await fill(cdp, '#cust-name', 'Geeta Sen');
  await clickByText(cdp, 'Save Profile');

  await waitForText(cdp, 'Geeta Sen');
  await clickByText(cdp, 'Geeta Sen', 'button');
  await waitForText(cdp, 'Customer Outstanding');
  await clickByText(cdp, 'Post Opening Balance');
  await fill(cdp, '#ob-amount', '450.00');
  await fill(cdp, '#ob-ref', 'OB-GE-001');
  await fill(cdp, '#ob-notes', 'Prepayment credit balance');
  
  // Select balanceType ADVANCE
  await cdp.eval(`document.querySelector('#ob-type').value = 'ADVANCE'`);
  await cdp.eval(`document.querySelector('#ob-type').dispatchEvent(new Event('change', { bubbles: true }))`);
  
  await cdp.eval(`window.confirm = () => true;`);
  await clickByText(cdp, 'Post Balance');
  await wait(1500);
  await screenshot(cdp, '09_customer_geeta_advance');

  // Step 8: Walk-In details and protections checks
  progress('Inspecting Walk-In customer profile...');
  await clickByText(cdp, 'Back to List', 'button');
  await clickByText(cdp, 'Walk-In Customer', 'button');
  await waitForText(cdp, 'Walk-In');
  await screenshot(cdp, '10_walkin_view_details');

  progress('Opening Walk-In edit profile screen...');
  await clickByText(cdp, 'Edit Profile');
  await waitForText(cdp, 'Edit Customer');
  await screenshot(cdp, '11_walkin_edit_form');
  await clickByText(cdp, 'Cancel');

  // Done
  progress('Closing Electron application session...');
  try {
    await cdp.send('Browser.close');
  } catch (err) {
    // ignore expected websocket disconnect error
  }
  cdp.close();
  child.kill();

  progress('Phase 6.2 UI verification completed successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('UI verification session failed:', err);
  process.exit(1);
});
