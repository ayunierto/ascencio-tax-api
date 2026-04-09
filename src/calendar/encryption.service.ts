import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.ENCRYPTION_KEY ?? '';
    if (hex.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
          'Generate with: openssl rand -hex 32',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const payload: EncryptedPayload = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
    };
    return JSON.stringify(payload);
  }

  decrypt(encryptedJson: string): string {
    const { iv, authTag, ciphertext }: EncryptedPayload = JSON.parse(
      encryptedJson,
    ) as EncryptedPayload;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'hex'),
      { authTagLength: AUTH_TAG_LENGTH },
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
