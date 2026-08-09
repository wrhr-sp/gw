import { base64UrlDecode, base64UrlEncode, decryptText, encryptText, hmacSha256 } from "../auth/crypto";

const encoder = new TextEncoder();
function buffer(bytes: Uint8Array): ArrayBuffer { return Uint8Array.from(bytes).buffer; }
export type CalendarKeyring = ReadonlyMap<number, Uint8Array>;
export type EncryptedCalendarValue = { ciphertext: Uint8Array; iv: Uint8Array; keyVersion: number };

export function parseCalendarKeyring(value: string): CalendarKeyring {
  let input: unknown;
  try { input = JSON.parse(value); } catch { throw new Error("calendar keyring is invalid"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("calendar keyring is invalid");
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length < 1 || entries.length > 16) throw new Error("calendar keyring is invalid");
  const output = new Map<number, Uint8Array>();
  for (const [versionText, encoded] of entries) {
    if (!/^[1-9][0-9]*$/u.test(versionText) || typeof encoded !== "string") throw new Error("calendar keyring is invalid");
    const version = Number(versionText);
    const decoded = base64UrlDecode(encoded);
    if (!Number.isSafeInteger(version) || decoded.byteLength !== 32 || base64UrlEncode(decoded) !== encoded) throw new Error("calendar keyring is invalid");
    output.set(version, decoded);
  }
  return output;
}

export function createCalendarCrypto(input: {
  aesCurrentVersion: number; aesKeyring: CalendarKeyring;
  hmacCurrentVersion: number; hmacKeyring: CalendarKeyring;
}) {
  const aesRaw = input.aesKeyring.get(input.aesCurrentVersion);
  const hmacRaw = input.hmacKeyring.get(input.hmacCurrentVersion);
  if (!aesRaw || !hmacRaw) throw new Error("calendar current key version is unavailable");
  const aesKeys = new Map<number, Promise<CryptoKey>>();
  const hmacKeys = new Map<number, Promise<CryptoKey>>();
  const aesKey = (version: number) => {
    const raw = input.aesKeyring.get(version);
    if (!raw) throw new Error("calendar encryption key version is unavailable");
    let imported = aesKeys.get(version);
    if (!imported) { imported = crypto.subtle.importKey("raw",buffer(raw),{ name: "AES-GCM" },false,["encrypt","decrypt"]); aesKeys.set(version,imported); }
    return imported;
  };
  const hmacKey = (version: number) => {
    const raw = input.hmacKeyring.get(version);
    if (!raw) throw new Error("calendar fingerprint key version is unavailable");
    let imported = hmacKeys.get(version);
    if (!imported) { imported = crypto.subtle.importKey("raw",buffer(raw),{ name: "HMAC", hash: "SHA-256" },false,["sign"]); hmacKeys.set(version,imported); }
    return imported;
  };
  return {
    currentHmacVersion: input.hmacCurrentVersion,
    async encrypt(value: string, aad: string): Promise<EncryptedCalendarValue> {
      const encrypted = await encryptText(await aesKey(input.aesCurrentVersion),value,encoder.encode(aad));
      return { ...encrypted, keyVersion: input.aesCurrentVersion };
    },
    async decrypt(value: EncryptedCalendarValue, aad: string): Promise<string> {
      return decryptText(await aesKey(value.keyVersion),value.ciphertext,value.iv,encoder.encode(aad));
    },
    async fingerprint(
      value: string,
      domain: string,
      version = input.hmacCurrentVersion,
    ): Promise<Uint8Array> {
      return hmacSha256(await hmacKey(version), `${domain}\0${value}`);
    },
  };
}
export type CalendarCrypto = ReturnType<typeof createCalendarCrypto>;
