import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function readKey(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error("Email credential encryption is unavailable");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Email credential encryption is unavailable");
  return key;
}

export function emailEncryptionReady(value: string | undefined) {
  try { readKey(value); return true; } catch { return false; }
}

// Agency-bound AES-256-GCM: copying ciphertext to another tenant cannot decrypt it.
export function encryptEmailPassword(password: string, agencyId: string, keyValue: string | undefined) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readKey(keyValue), iv);
  cipher.setAAD(Buffer.from(`mosaic-email-password:v1:${agencyId}`));
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptEmailPassword(value: string, agencyId: string, keyValue: string | undefined) {
  const [version, iv, tag, ciphertext, extra] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) throw new Error("Invalid encrypted credential");
  const nonce = Buffer.from(iv, "base64"), authTag = Buffer.from(tag, "base64");
  if (nonce.length !== 12 || authTag.length !== 16) throw new Error("Invalid encrypted credential");
  const decipher = createDecipheriv("aes-256-gcm", readKey(keyValue), nonce);
  decipher.setAAD(Buffer.from(`mosaic-email-password:v1:${agencyId}`));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
