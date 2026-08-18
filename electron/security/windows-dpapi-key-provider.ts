import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseKeyProvider } from './database-key-provider';
import { Dpapi, isPlatformSupported } from '@primno/dpapi';
import { getKeyFilePath } from './key-paths';
import { MissingKeyError, CorruptedKeyError, DpapiUnprotectError } from './key-errors';

export class WindowsDpapiKeyProvider implements DatabaseKeyProvider {
  private keyFilePath = getKeyFilePath();

  constructor() {
    const parent = path.dirname(this.keyFilePath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
  }

  async hasKey(): Promise<boolean> {
    return fs.existsSync(this.keyFilePath) && fs.statSync(this.keyFilePath).size > 0;
  }

  async createKey(): Promise<string> {
    if (!isPlatformSupported) {
      throw new Error('DPAPI is only supported on Windows platforms.');
    }
    // Generate random 256-bit database key (64 hex characters)
    const newKey = crypto.randomBytes(32).toString('hex');
    const buffer = Buffer.from(newKey, 'utf8');
    
    // Encrypt using DPAPI CurrentUser scope
    const encrypted = Dpapi.protectData(buffer, null, 'CurrentUser');
    fs.writeFileSync(this.keyFilePath, encrypted);
    return newKey;
  }

  async getKey(): Promise<string> {
    if (!isPlatformSupported) {
      throw new Error('DPAPI is only supported on Windows platforms.');
    }
    if (!fs.existsSync(this.keyFilePath)) {
      throw new MissingKeyError();
    }
    
    const encrypted = fs.readFileSync(this.keyFilePath);
    if (encrypted.length === 0) {
      throw new CorruptedKeyError('Key file is empty.');
    }
    
    try {
      const decrypted = Dpapi.unprotectData(encrypted, null, 'CurrentUser');
      return Buffer.from(decrypted).toString('utf8');
    } catch (err) {
      throw new DpapiUnprotectError(err);
    }
  }

  async rotateStoredKey(newKey: string): Promise<void> {
    if (!isPlatformSupported) {
      throw new Error('DPAPI is only supported on Windows platforms.');
    }
    const buffer = Buffer.from(newKey, 'utf8');
    const encrypted = Dpapi.protectData(buffer, null, 'CurrentUser');
    fs.writeFileSync(this.keyFilePath, encrypted);
  }

  async clearKey(): Promise<void> {
    if (fs.existsSync(this.keyFilePath)) {
      fs.unlinkSync(this.keyFilePath);
    }
  }
}
