import { registerAs } from '@nestjs/config';

export interface QrHmacKey {
  kid: string;
  secret: string;
}

export default registerAs('qr', () => {
  const raw = process.env['QR_HMAC_SECRETS'] ?? '[{"kid":"v1","secret":"change-me-to-random-32-bytes"}]';

  let keys: QrHmacKey[];
  try {
    keys = JSON.parse(raw) as QrHmacKey[];
  } catch {
    throw new Error('QR_HMAC_SECRETS must be a valid JSON array of { kid, secret } objects');
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('QR_HMAC_SECRETS must contain at least one key');
  }

  // The last entry in the array is the active signing key.
  const activeKey = keys[keys.length - 1] as QrHmacKey;

  return { keys, activeKey };
});
