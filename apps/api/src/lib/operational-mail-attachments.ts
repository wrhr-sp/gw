import type { MailAttachment } from "@gw/shared";
import { getDbClient, type DatabaseEnv } from "../utils/db";

type MailAttachmentRow = {
  id: string;
  company_id: string;
  message_id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  object_key: string;
  uploaded_by: string;
  uploaded_at: Date | string;
};

export type MailAttachmentAccessRow = MailAttachmentRow & {
  sender_user_id: string;
  recipient_user_id: string | null;
};

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAttachment(row: MailAttachmentRow): MailAttachment {
  return {
    id: row.id,
    companyId: row.company_id,
    messageId: row.message_id,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSize: Number(row.file_size),
    objectKeyPreview: row.object_key,
    uploadedBy: row.uploaded_by,
    uploadedAt: toIso(row.uploaded_at),
  };
}

export function buildMailAttachmentObjectKey(input: { companyId: string; messageId: string; attachmentId: string; fileName: string }) {
  const safeName = input.fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "") || "attachment";
  return `companies/${input.companyId}/mail/${input.messageId}/attachments/${input.attachmentId}/${safeName}`;
}

export async function canAccessOperationalMailMessage(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; messageId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select id
    from mail_messages
    where id = ${input.messageId}
      and company_id = ${input.companyId}
      and deleted_at is null
      and (sender_user_id = ${input.userId} or recipient_user_id = ${input.userId})
    limit 1
  `;
  return rows.length > 0;
}

export async function listOperationalMailAttachments(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; messageId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select
      a.id,
      a.company_id,
      a.message_id,
      a.file_name,
      a.content_type,
      a.file_size,
      a.object_key,
      a.uploaded_by,
      a.uploaded_at
    from mail_attachments a
    join mail_messages m on m.id = a.message_id and m.company_id = a.company_id
    where a.company_id = ${input.companyId}
      and a.message_id = ${input.messageId}
      and a.deleted_at is null
      and m.deleted_at is null
      and (m.sender_user_id = ${input.userId} or m.recipient_user_id = ${input.userId})
    order by a.uploaded_at desc
  `;
  return (rows as MailAttachmentRow[]).map(toAttachment);
}

export async function createOperationalMailAttachment(env: DatabaseEnv | undefined, input: { id: string; companyId: string; userId: string; messageId: string; fileName: string; contentType: string; fileSize: number; objectKey: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into mail_attachments (id, company_id, message_id, file_name, content_type, file_size, object_key, uploaded_by, uploaded_at)
    select
      ${input.id},
      ${input.companyId},
      m.id,
      ${input.fileName},
      ${input.contentType},
      ${input.fileSize},
      ${input.objectKey},
      ${input.userId},
      now()
    from mail_messages m
    where m.id = ${input.messageId}
      and m.company_id = ${input.companyId}
      and m.deleted_at is null
      and m.sender_user_id = ${input.userId}
    returning id, company_id, message_id, file_name, content_type, file_size, object_key, uploaded_by, uploaded_at
  `;
  const row = rows[0] as MailAttachmentRow | undefined;
  return row ? toAttachment(row) : null;
}

export async function findOperationalMailAttachmentForAccess(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; attachmentId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select
      a.id,
      a.company_id,
      a.message_id,
      a.file_name,
      a.content_type,
      a.file_size,
      a.object_key,
      a.uploaded_by,
      a.uploaded_at,
      m.sender_user_id,
      m.recipient_user_id
    from mail_attachments a
    join mail_messages m on m.id = a.message_id and m.company_id = a.company_id
    where a.id = ${input.attachmentId}
      and a.company_id = ${input.companyId}
      and a.deleted_at is null
      and m.deleted_at is null
      and (m.sender_user_id = ${input.userId} or m.recipient_user_id = ${input.userId})
    limit 1
  `;
  const row = rows[0] as MailAttachmentAccessRow | undefined;
  return row ? { attachment: toAttachment(row), objectKey: row.object_key } : null;
}
