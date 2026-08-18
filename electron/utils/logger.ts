import { app } from 'electron';
import fs from 'fs';
import path from 'path';

let logStream: fs.WriteStream | null = null;
let logFilePath = '';

function sanitize(msg: string): string {
  // Standard sensitive key scrubbing
  return msg
    .replace(/(password["\s:]+)[^\s",]+/gi, '$1"***"')
    .replace(/(card[^\s",]*["\s:]+)[^\s",]+/gi, '$1"***"');
}

export function initializeLogger() {
  const logDir = path.join(app.getPath('userData'), 'logs');

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  logFilePath = path.join(logDir, 'app.log');

  // Rotate log on startup if > 5MB
  if (fs.existsSync(logFilePath)) {
    try {
      const stats = fs.statSync(logFilePath);
      const maxLogSize = 5 * 1024 * 1024; // 5 MB
      if (stats.size > maxLogSize) {
        const backupPath = path.join(logDir, 'app.log.1');
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        fs.renameSync(logFilePath, backupPath);
      }
    } catch (err) {
      console.error('Failed to rotate log file:', err);
    }
  }

  logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });

  // Handle uncaught exceptions globally
  process.on('uncaughtException', (error) => {
    logError('Uncaught Exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    logError('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });

  logInfo('--- Smart Vyapar Application Logging Started ---');
}

export function logInfo(message: string) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] [INFO] ${sanitize(message)}`;
  
  if (logStream) {
    logStream.write(formatted + '\n');
  }
  // Print to stdout in dev, server, or explicit logging mode
  if (!app.isPackaged || process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_ENABLE_LOGGING) {
    console.log(formatted);
  }
}

export function logError(context: string, error: Error | unknown) {
  const timestamp = new Date().toISOString();
  const errMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  const formatted = `[${timestamp}] [ERROR] [${context}] ${sanitize(errMsg)}`;

  if (logStream) {
    logStream.write(formatted + '\n');
  }
  if (!app.isPackaged || process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_ENABLE_LOGGING) {
    console.error(formatted);
  }
}

export function getLogFilePath(): string {
  return logFilePath;
}
export function closeLogger() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}
