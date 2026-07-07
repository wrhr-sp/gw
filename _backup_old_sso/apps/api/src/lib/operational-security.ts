import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

type SecurityRow = {
  secondary_password_hash: string | null;
  secondary_password_updated_at: string | Date | null;
};

function toIso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function createSalt() {
  const values = new Uint8Array(16);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(digest);
}

export async function hashSecondaryPasswordPin(pin: string) {
  const salt = createSalt();
  const hash = await sha256Hex(`${salt}:${pin}`);
  return `sha256:${salt}:${hash}`;
}

export async function verifySecondaryPasswordPin(pin: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithm, salt, expectedHash] = storedHash.split(":");
  if (algorithm !== "sha256" || !salt || !expectedHash) return false;
  const actualHash = await sha256Hex(`${salt}:${pin}`);
  return actualHash === expectedHash;
}

export async function getOperationalSecondaryPasswordStatus(env: PostgresEnv | undefined, companyId: string, userId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const rows = await sql`
      select secondary_password_hash, secondary_password_updated_at
      from user_security_settings
      where company_id = ${companyId} and user_id = ${userId}
      limit 1
    `;
    const row = rows[0] as SecurityRow | undefined;
    return {
      hasSecondaryPassword: Boolean(row?.secondary_password_hash),
      hash: row?.secondary_password_hash ?? null,
      updatedAt: toIso(row?.secondary_password_updated_at),
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function saveOperationalSecondaryPassword(env: PostgresEnv | undefined, companyId: string, userId: string, pin: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const now = new Date().toISOString();
  const hash = await hashSecondaryPasswordPin(pin);
  const id = `security_${companyId}_${userId}`;

  try {
    const rows = await sql`
      insert into user_security_settings (id, company_id, user_id, secondary_password_hash, secondary_password_updated_at, created_at, updated_at)
      values (${id}, ${companyId}, ${userId}, ${hash}, ${now}, ${now}, ${now})
      on conflict (company_id, user_id) do update set
        secondary_password_hash = excluded.secondary_password_hash,
        secondary_password_updated_at = excluded.secondary_password_updated_at,
        updated_at = excluded.updated_at
      returning secondary_password_updated_at
    `;
    const row = rows[0] as { secondary_password_updated_at?: string | Date | null } | undefined;
    return { updatedAt: toIso(row?.secondary_password_updated_at) ?? now };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
