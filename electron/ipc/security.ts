import { app, IpcMainInvokeEvent } from 'electron';
import { logError } from '../utils/logger';

export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url;
  if (!url) {
    logError('Security Alert', new Error('IPC request received with missing senderFrame URL.'));
    return false;
  }

  const lowerUrl = url.toLowerCase();
  
  // 1. Allow development localhost Vite server
  if (lowerUrl.startsWith('http://localhost:5173')) {
    return true;
  }

  // 2. Allow local production index.html file protocol loads
  if (lowerUrl.startsWith('file://') && (lowerUrl.includes('/dist/index.html') || lowerUrl.includes('\\dist\\index.html'))) {
    return true;
  }

  logError('Security Alert', new Error(`Unauthorized IPC sender blocked: ${url}`));
  return false;
}
