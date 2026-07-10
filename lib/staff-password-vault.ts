import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY = crypto
  .createHash('sha256')
  .update(process.env.JWT_SECRET || 'dev-secret-change-me')
  .digest();

/** Seal a plaintext staff password for All Super Admin recovery. */
export function sealStaffPassword(password: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

/** Open a sealed staff password. Returns null if missing or corrupt. */
export function openStaffPassword(vault: string | null | undefined): string | null {
  if (!vault) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = vault.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}
