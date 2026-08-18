import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WindowsDpapiKeyProvider } from './windows-dpapi-key-provider';

export class RecoveryKeyManager {
  private keyProvider = new WindowsDpapiKeyProvider();

  public async createRecoveryPackage(passphrase: string, outputPath: string): Promise<void> {
    const parent = path.dirname(outputPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }

    // 1. Get current DEK
    const dek = await this.keyProvider.getKey();

    // 2. Derive KEK using scrypt
    const salt = crypto.randomBytes(16);
    const N = 16384;
    const r = 8;
    const p = 1;
    const keyLen = 32;

    const kek = crypto.scryptSync(passphrase, salt, keyLen, { N, r, p });

    // 3. Encrypt DEK using AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    
    let ciphertext = cipher.update(dek, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    // 4. Calculate SHA-256 checksum of ciphertext
    const checksum = crypto.createHash('sha256').update(ciphertext, 'hex').digest('hex');

    // 5. Build recovery package
    const recoveryPackage = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      kdf: {
        name: 'scrypt',
        salt: salt.toString('hex'),
        params: { N, r, p }
      },
      crypto: {
        algorithm: 'aes-256-gcm',
        iv: iv.toString('hex'),
        tag,
        ciphertext
      },
      checksum
    };

    fs.writeFileSync(outputPath, JSON.stringify(recoveryPackage, null, 2), 'utf8');
  }

  public async validateRecoveryPackage(packagePath: string, passphrase: string): Promise<boolean> {
    try {
      if (!fs.existsSync(packagePath)) return false;
      const content = fs.readFileSync(packagePath, 'utf8');
      const recoveryPackage = JSON.parse(content);

      if (recoveryPackage.version !== '1.0.0' || !recoveryPackage.crypto) {
        return false;
      }

      // Check SHA-256 checksum
      const { ciphertext, iv, tag } = recoveryPackage.crypto;
      const calculatedChecksum = crypto.createHash('sha256').update(ciphertext, 'hex').digest('hex');
      if (calculatedChecksum !== recoveryPackage.checksum) {
        return false;
      }

      // Re-derive KEK using scrypt parameters
      const salt = Buffer.from(recoveryPackage.kdf.salt, 'hex');
      const { N, r, p } = recoveryPackage.kdf.params;
      const kek = crypto.scryptSync(passphrase, salt, 32, { N, r, p });

      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Key must be exactly 64 hex characters (256 bits)
      return /^[0-9a-fA-F]{64}$/.test(decrypted);
    } catch (err) {
      return false;
    }
  }

  public async importRecoveryPackage(packagePath: string, passphrase: string): Promise<void> {
    if (!fs.existsSync(packagePath)) {
      throw new Error('Recovery package file not found.');
    }
    const content = fs.readFileSync(packagePath, 'utf8');
    const recoveryPackage = JSON.parse(content);

    // Check checksum
    const { ciphertext, iv, tag } = recoveryPackage.crypto;
    const calculatedChecksum = crypto.createHash('sha256').update(ciphertext, 'hex').digest('hex');
    if (calculatedChecksum !== recoveryPackage.checksum) {
      throw new Error('Recovery package checksum mismatch (package is corrupted).');
    }

    // Derive KEK
    const salt = Buffer.from(recoveryPackage.kdf.salt, 'hex');
    const { N, r, p } = recoveryPackage.kdf.params;
    const kek = crypto.scryptSync(passphrase, salt, 32, { N, r, p });

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decryptedKey: string;
    try {
      decryptedKey = decipher.update(ciphertext, 'hex', 'utf8');
      decryptedKey += decipher.final('utf8');
    } catch (err) {
      throw new Error('Incorrect recovery passphrase.');
    }

    if (!/^[0-9a-fA-F]{64}$/.test(decryptedKey)) {
      throw new Error('Invalid key inside recovery package.');
    }

    // Save decrypted DEK to fresh DPAPI-protected blob
    await this.keyProvider.rotateStoredKey(decryptedKey);
  }
}
