import type { DocumentFile } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

export const DOCUMENT_DOWNLOAD_TICKET_TTL_MINUTES = 15;

export async function hashDocumentDownloadToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createOperationalDocumentDownloadTicket(
  env: PostgresEnv | undefined,
  input: {
    companyId: string;
    actorUserId: string;
    file: DocumentFile;
    token: string;
    objectKey: string;
    expiresAt: string;
    createdAt: string;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const rows = await sql`
      insert into document_file_download_tickets (id, company_id, file_id, version_id, actor_user_id, object_key, token_hash, expires_at, created_at)
      values (
        ${`document_download_ticket_${input.file.id}_${crypto.randomUUID()}`},
        ${input.companyId},
        ${input.file.id},
        ${input.file.versionId},
        ${input.actorUserId},
        ${input.objectKey},
        ${await hashDocumentDownloadToken(input.token)},
        ${input.expiresAt}::timestamptz,
        ${input.createdAt}::timestamptz
      )
      returning id, expires_at
    `;
    const row = rows[0] as { id: string; expires_at: string | Date } | undefined;
    if (!row) return null;
    return {
      id: row.id,
      expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function consumeOperationalDocumentDownloadTicket(
  env: PostgresEnv | undefined,
  input: { companyId: string; actorUserId: string; fileId: string; token: string; usedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return undefined;

  try {
    const rows = await sql`
      update document_file_download_tickets
      set used_at = ${input.usedAt}::timestamptz
      where company_id = ${input.companyId}
        and actor_user_id = ${input.actorUserId}
        and file_id = ${input.fileId}
        and token_hash = ${await hashDocumentDownloadToken(input.token)}
        and used_at is null
        and expires_at > ${input.usedAt}::timestamptz
      returning id, object_key, expires_at
    `;
    const row = rows[0] as { id: string; object_key: string; expires_at: string | Date } | undefined;
    if (!row) return null;
    return {
      id: row.id,
      objectKey: row.object_key,
      expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return undefined;
    throw error;
  }
}
