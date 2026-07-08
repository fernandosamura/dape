import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.SESSION_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("SESSION_ENCRYPTION_KEY nao configurada no .env");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptSession(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return ENCRYPTED_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

// Dados legados (pre-criptografia) nao tem o prefixo e sao devolvidos como
// estao. Falha de decriptacao devolve null em vez de lancar erro, pra
// forcar reautenticacao (QR novo) daquela conexao especifica em vez de
// derrubar toda a inicializacao do WhatsApp.
export function decryptSession(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  try {
    const raw = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[sessionCrypto] Falha ao decriptar sessao WA:", (err as Error).message);
    return null;
  }
}
