import { app } from 'electron';
import path from 'path';

export function getKeyFilePath(): string {
  if (process.env.SMART_VYAPAR_TEST === 'true') {
    return path.join(process.cwd(), 'test-data', 'primary-integration', 'security', 'database-key.bin');
  }
  return path.join(app.getPath('userData'), 'security', 'database-key.bin');
}
