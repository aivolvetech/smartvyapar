import crypto from 'crypto';
import fs from 'fs';

export function computeFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
