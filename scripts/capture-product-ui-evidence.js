const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'docs', 'evidence', 'product-ui');
const logPath = path.join(evidenceDir, 'capture.log');

function log(message) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForLoad(win) {
  return new Promise((resolve) => {
    if (!win.webContents.isLoading()) {
      resolve();
      return;
    }
    win.webContents.once('did-finish-load', resolve);
  });
}

async function clickByText(win, text) {
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const target = Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent && button.textContent.includes(${JSON.stringify(text)}));
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
  if (!clicked) {
    throw new Error(`Could not find button containing text: ${text}`);
  }
  await wait(450);
}

async function clickByTitle(win, title) {
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const target = document.querySelector(${JSON.stringify(`button[title="${title}"]`)});
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
  if (!clicked) {
    throw new Error(`Could not find button with title: ${title}`);
  }
  await wait(450);
}

async function clickProductNav(win, text) {
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const nav = document.querySelector('.product-module > .sub-nav');
      const target = nav && Array.from(nav.querySelectorAll('button'))
        .find((button) => button.textContent && button.textContent.includes(${JSON.stringify(text)}));
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
  if (!clicked) {
    throw new Error(`Could not find product nav button containing text: ${text}`);
  }
  await wait(450);
}

async function clickProductNavIndex(win, index) {
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('.product-module > .sub-nav button'));
      const target = buttons[${index}];
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
  if (!clicked) {
    throw new Error(`Could not find product nav button at index: ${index}`);
  }
  await wait(650);
}

async function screenshot(win, name) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(evidenceDir, `${name}.png`), image.toPNG());
}

async function createSeedProduct(win) {
  await win.webContents.executeJavaScript(`
    window.smartVyapar.createProduct({
      product: {
        productCode: 'PROD-001',
        name: 'Amul Butter 500g',
        primaryUnitId: 'uom-pcs',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        hsnSacCode: '0405',
        taxRateId: 'tax-gst-18',
        productType: 'GOODS',
        trackInventory: true,
        sku: 'SKU-AMUL-500'
      },
      barcodes: [{ barcode: '8901234567890', barcodeType: 'EAN13', isPrimary: true }],
      defaultPrice: { purchasePrice: 210, sellingPrice: 245, mrp: 250 },
      openingBalance: { quantity: 12, unitCost: 210 }
    })
  `);
}

async function fillProductForm(win, { code, name, barcode }) {
  await win.webContents.executeJavaScript(`
    (() => {
      const set = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error('Missing selector ' + selector);
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        if (el._valueTracker) el._valueTracker.setValue('');
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('#pf-code', ${JSON.stringify(code)});
      set('#pf-name', ${JSON.stringify(name)});
      set('#pf-unit', 'uom-pcs');
      set('#pf-sell', '99');
      set('#pf-mrp', '109');
      set('#pf-purchase', '75');
      if (${JSON.stringify(barcode)} !== '') {
        set('#pf-barcode', ${JSON.stringify(barcode)});
        const primary = Array.from(document.querySelectorAll('label'))
          .find((label) => label.textContent && label.textContent.includes('Primary'))
          ?.querySelector('input');
        if (primary && !primary.checked) primary.click();
        Array.from(document.querySelectorAll('button'))
          .find((button) => button.textContent && button.textContent.trim().endsWith('Add'))
          ?.click();
      }
    })()
  `);
  await wait(1000);
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(logPath, '');
  setTimeout(() => {
    log('Timed out.');
    app.exit(1);
  }, 60000).unref();

  log('Waiting for Electron app readiness.');
  await app.whenReady();
  log('Electron app ready.');
  app.commandLine.appendSwitch('disable-gpu');

  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const consoleMessages = [];
  win.webContents.on('console-message', (_event, level, message) => {
    consoleMessages.push({ level, message });
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`Renderer failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });
  win.webContents.on('did-finish-load', () => {
    log('did-finish-load event fired.');
  });

  const indexUrl = `file:///${path.join(root, 'dist', 'index.html').replace(/\\/g, '/')}`;
  log(`Loading ${indexUrl}`);
  win.loadURL(indexUrl);
  await waitForLoad(win);
  log('Initial renderer loaded.');
  await win.webContents.executeJavaScript(`
    window.confirm = () => true;
    localStorage.setItem('mock_shop', JSON.stringify({
      id: 'mock-shop-product-ui',
      name: 'Product UI Evidence Store',
      phone: '9876543210',
      address: 'Evidence Road',
      gstNumber: '07AAAAA1111A1Z1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  `);
  await win.reload();
  await waitForLoad(win);
  await wait(900);
  log('Renderer reloaded with mock shop.');

  await createSeedProduct(win);
  log('Seed product created.');
  await clickByText(win, 'Products');
  await screenshot(win, '01-product-list-1366x768');
  log('Captured product list.');

  await clickProductNavIndex(win, 1);
  await screenshot(win, '02-create-product');
  log('Captured create product.');

  await clickProductNavIndex(win, 0);
  await clickByTitle(win, 'Edit');
  await screenshot(win, '03-edit-product');
  log('Captured edit product.');

  await clickProductNavIndex(win, 0);
  await clickByTitle(win, 'View');
  await screenshot(win, '04-product-view');
  log('Captured product view.');

  await clickProductNavIndex(win, 2);
  await screenshot(win, '05-unit-manager');
  await clickByText(win, 'Categories');
  await screenshot(win, '06-category-manager');
  await clickByText(win, 'Brands');
  await screenshot(win, '07-brand-manager');
  await clickByText(win, 'Tax Rates');
  await screenshot(win, '08-tax-rate-manager');
  log('Captured master managers.');

  await clickProductNavIndex(win, 1);
  await fillProductForm(win, { code: 'PROD-001', name: 'Duplicate Code Product', barcode: '8901111111111' });
  await clickByText(win, 'Create Product');
  await wait(1200);
  log(await win.webContents.executeJavaScript('document.body.innerText.includes("already exists") ? "Duplicate code text present." : "Duplicate code text missing."'));
  await screenshot(win, '09-duplicate-product-code');
  log('Captured duplicate product code.');

  await clickProductNavIndex(win, 0);
  await clickProductNavIndex(win, 1);
  await fillProductForm(win, { code: 'PROD-002', name: 'Duplicate Barcode Product', barcode: '8901234567890' });
  await clickByText(win, 'Create Product');
  await wait(1200);
  await screenshot(win, '10-duplicate-barcode');
  log('Captured duplicate barcode.');

  const manifest = {
    label: 'Renderer UI verification using browser mock APIs',
    capturedAt: new Date().toISOString(),
    viewport: { width: 1366, height: 768 },
    files: fs.readdirSync(evidenceDir).filter((file) => file.endsWith('.png')).sort(),
    consoleMessages,
  };
  fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log('Wrote manifest.');

  await win.close();
  app.quit();
}

main().catch((error) => {
  log(`Failed: ${error.stack || error.message || String(error)}`);
  console.error(error);
  app.exit(1);
});
