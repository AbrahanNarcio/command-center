import crypto from "crypto";

/**
 * Token-at-rest encryption. Access tokens are NEVER stored in plaintext and
 * NEVER sent to the browser. Key comes from env TOKEN_ENC_KEY (64 hex chars = 32 bytes).
 * Generate one with:  openssl rand -hex 32
 */

function getKey(): Buffer | null {
  const hex = process.env.TOKEN_ENC_KEY;
  if (!hex || hex.length !== 64) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

export function hasEncryptionKey(): boolean {
  return getKey() !== null;
}

export interface Sealed {
  tokenEnc: string;
  tokenIv: string;
  tokenTag: string;
}

export function seal(plaintext: string): Sealed {
  const key = getKey();
  if (!key) throw new Error("TOKEN_ENC_KEY missing or invalid (need 64 hex chars).");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    tokenEnc: enc.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenTag: cipher.getAuthTag().toString("base64"),
  };
}

export function open(sealed: Sealed): string {
  const key = getKey();
  if (!key) throw new Error("TOKEN_ENC_KEY missing or invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.tokenIv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tokenTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.tokenEnc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
