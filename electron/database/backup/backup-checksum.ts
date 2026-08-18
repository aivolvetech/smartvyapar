import crypto from 'crypto';
import fs from 'fs';

export function computeBackupChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
