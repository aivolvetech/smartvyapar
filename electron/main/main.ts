import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { initializeLogger, logInfo, logError, closeLogger } from '../utils/logger';
import { initializeDatabase } from '../database/database-initializer';
import { registerAppIpc } from '../ipc/app.ipc';
import { registerShopIpc } from '../ipc/shop.ipc';
import { registerProductIpc } from '../ipc/product.ipc';
import { registerInventoryIpc } from '../ipc/inventory.ipc';
import { registerSupplierPurchaseIpc } from '../ipc/supplier-purchase.ipc';
import { registerImportIpc } from '../ipc/import.ipc';
import { registerCustomerIpc } from '../ipc/customer.ipc';
import { registerSalesIpc } from '../ipc/sales.ipc';

let mainWindow: BrowserWindow | null = null;

function getSafeWindowBounds(width: number, height: number) {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  return {
    x: Math.round(workArea.x + Math.max(0, (workArea.width - width) / 2)),
    y: Math.round(workArea.y + Math.max(0, (workArea.height - height) / 2)),
    width: Math.min(width, workArea.width),
    height: Math.min(height, workArea.height),
  };
}

function isWindowOnVisibleDisplay(window: BrowserWindow): boolean {
  const bounds = window.getBounds();
  return screen.getAllDisplays().some(display => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

function ensureMainWindowVisibleAndFocused() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (!isWindowOnVisibleDisplay(mainWindow)) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds(getSafeWindowBounds(bounds.width, bounds.height));
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.moveTop();
  mainWindow.focus();
}

if (process.env.SMART_VYAPAR_ELECTRON_SMOKE === 'true') {
  app.setPath(
    'userData',
    process.env.SMART_VYAPAR_ELECTRON_SMOKE_USER_DATA
      ? path.resolve(process.env.SMART_VYAPAR_ELECTRON_SMOKE_USER_DATA)
      : path.resolve(process.cwd(), 'test-data', 'electron-product-smoke', 'user-data')
  );
}

// 1. Single-Instance Application Protection
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('Another instance of Smart Vyapar is already running. Exiting...');
  app.quit();
} else {
  // Focus the primary window if another instance tries to launch
  app.on('second-instance', () => {
    if (app.isReady()) {
      ensureMainWindowVisibleAndFocused();
    }
  });

  // App ready listener initiating the strict startup sequence
  app.whenReady().then(async () => {
    try {
      // 2. Create Required Application Directories
      const userDataPath = app.getPath('userData');
      const directories = [
        path.join(userDataPath, 'data'),
        path.join(userDataPath, 'logs'),
        path.join(userDataPath, 'backups'),
      ];
      
      for (const dir of directories) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // 3. Initialize File Logger
      initializeLogger();
      logInfo('Startup Sequence Initiated.');

      // 4. Initialize SQLCipher Database, runs conversion and migrations programmatically
      const dbSucceeded = await initializeDatabase();
      if (!dbSucceeded) {
        logError('Startup sequence aborted due to database initialization failure.', new Error('Database initialization failure'));
        app.quit();
        return;
      }

      // 7. Register Secure IPC Handlers
      registerAppIpc();
      registerShopIpc();
      registerProductIpc();
      registerInventoryIpc();
      registerSupplierPurchaseIpc();
      registerImportIpc();
      registerCustomerIpc();
      registerSalesIpc();
      logInfo('IPC Handlers registered successfully.');

      // 8. Create BrowserWindow & Load Renderer
      createWindow();
    } catch (err) {
      logError('Fatal error during startup sequence', err);
      app.quit();
    }
  });
}

function createWindow() {
  logInfo('Creating Browser Window...');

  const preloadPath = path.join(__dirname, 'preload.js');
  logInfo(`Resolved preload script path: ${preloadPath}`);

  mainWindow = new BrowserWindow({
    width: process.env.SMART_VYAPAR_ELECTRON_SMOKE === 'true' ? 1366 : 1000,
    height: process.env.SMART_VYAPAR_ELECTRON_SMOKE === 'true' ? 768 : 750,
    minWidth: 800,
    minHeight: 600,
    title: 'Smart Vyapar',
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
      webSecurity: true, // enforce CORS & CSP
    },
  });

  const windowRef = mainWindow;

  mainWindow.once('ready-to-show', () => {
    if (mainWindow === windowRef) ensureMainWindowVisibleAndFocused();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow === windowRef) ensureMainWindowVisibleAndFocused();
  });

  setTimeout(() => {
    if (mainWindow === windowRef) ensureMainWindowVisibleAndFocused();
  }, 3000);

  // 9. Load Renderer based on Dev Server presence
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    logInfo(`Loading development dev server URL: ${devServerUrl}`);
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    const prodPath = path.join(__dirname, '../dist/index.html');
    logInfo(`Loading production HTML bundle: ${prodPath}`);
    mainWindow.loadFile(prodPath);
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  }

  // 10. Web Security Protections: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow self-navigating of the loaded dev server or file path
    const isAllowed = devServerUrl 
      ? url.startsWith(devServerUrl) 
      : url.startsWith('file://');

    if (!isAllowed) {
      logError('Security Event', new Error(`Prevented unauthorized navigation attempt to: ${url}`));
      event.preventDefault();
    }
  });

  // 11. Prevent spawning new browser windows (popups)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logError('Security Event', new Error(`Prevented popup window request to: ${url}`));
    // Optionally open in external default user browser if it is an approved external links (like help guides)
    // For safety, we block everything here
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    logInfo('Main window closed.');
    mainWindow = null;
  });
}

// Manage lifecycle hooks
app.on('window-all-closed', () => {
  logInfo('All windows closed. Terminating logging & application.');
  closeLogger();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  ensureMainWindowVisibleAndFocused();
});
