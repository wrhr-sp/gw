import type { MailMessage } from "@gw/shared";
import { getDbClient, type DatabaseEnv } from "../utils/db";

type MailRow = {
  id: string;
  company_id: string;
  sender_user_id: string;
  sender_name: string;
  recipient_user_id: string | null;
  recipient_name: string | null;
  subject: string;
  body: string;
  status: MailMessage["status"];
  importance: MailMessage["importance"];
  sent_at: Date | string | null;
  read_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MailBox = "inbox" | "sent" | "drafts";

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapMailMessage(row: MailRow): MailMessage {
  return {
    id: row.id,
    companyId: row.company_id,
    senderUserId: row.sender_user_id,
    senderName: row.sender_name,
    recipientUserId: row.recipient_user_id,
    recipientName: row.recipient_name,
    subject: row.subject,
    body: row.body,
    status: row.status,
    importance: row.importance,
    sentAt: toIso(row.sent_at),
    readAt: toIso(row.read_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

export async function listOperationalMailMessages(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; box: MailBox }) {
  const sql = getDbClient(env ?? {});
  const itemsPromise = input.box === "sent"
    ? sql`
      select
        m.id,
        m.company_id,
        m.sender_user_id,
        coalesce(sender.display_name, sender.login_id, '알 수 없음') as sender_name,
        m.recipient_user_id,
        coalesce(recipient.display_name, recipient.login_id) as recipient_name,
        m.subject,
        m.body,
        m.status,
        m.importance,
        m.sent_at,
        m.read_at,
        m.created_at,
        m.updated_at
      from mail_messages m
      join users sender on sender.id = m.sender_user_id and sender.company_id = m.company_id
      left join users recipient on recipient.id = m.recipient_user_id and recipient.company_id = m.company_id
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and m.sender_user_id = ${input.userId}
        and m.status = 'sent'
      order by coalesce(m.sent_at, m.updated_at) desc
      limit 50
    `
    : input.box === "drafts"
      ? sql`
      select
        m.id,
        m.company_id,
        m.sender_user_id,
        coalesce(sender.display_name, sender.login_id, '알 수 없음') as sender_name,
        m.recipient_user_id,
        coalesce(recipient.display_name, recipient.login_id) as recipient_name,
        m.subject,
        m.body,
        m.status,
        m.importance,
        m.sent_at,
        m.read_at,
        m.created_at,
        m.updated_at
      from mail_messages m
      join users sender on sender.id = m.sender_user_id and sender.company_id = m.company_id
      left join users recipient on recipient.id = m.recipient_user_id and recipient.company_id = m.company_id
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and m.sender_user_id = ${input.userId}
        and m.status = 'draft'
      order by coalesce(m.sent_at, m.updated_at) desc
      limit 50
    `
      : sql`
      select
        m.id,
        m.company_id,
        m.sender_user_id,
        coalesce(sender.display_name, sender.login_id, '알 수 없음') as sender_name,
        m.recipient_user_id,
        coalesce(recipient.display_name, recipient.login_id) as recipient_name,
        m.subject,
        m.body,
        m.status,
        m.importance,
        m.sent_at,
        m.read_at,
        m.created_at,
        m.updated_at
      from mail_messages m
      join users sender on sender.id = m.sender_user_id and sender.company_id = m.company_id
      left join users recipient on recipient.id = m.recipient_user_id and recipient.company_id = m.company_id
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and m.recipient_user_id = ${input.userId}
        and m.status = 'sent'
      order by coalesce(m.sent_at, m.updated_at) desc
      limit 50
    `;

  const [items, counts] = await Promise.all([
    itemsPromise,
    sql`
      select
        count(*) filter (where recipient_user_id = ${input.userId} and status = 'sent' and deleted_at is null) as inbox,
        count(*) filter (where recipient_user_id = ${input.userId} and status = 'sent' and read_at is null and deleted_at is null) as unread,
        count(*) filter (where sender_user_id = ${input.userId} and status = 'sent' and deleted_at is null) as sent,
        count(*) filter (where sender_user_id = ${input.userId} and status = 'draft' and deleted_at is null) as drafts
      from mail_messages
      where company_id = ${input.companyId}
    `,
  ]);

  const countRow = counts[0] ?? {};
  return {
    items: (items as MailRow[]).map(mapMailMessage),
    counts: {
      inbox: Number(countRow.inbox ?? 0),
      unread: Number(countRow.unread ?? 0),
      sent: Number(countRow.sent ?? 0),
      drafts: Number(countRow.drafts ?? 0),
    },
  };
}

export async function createOperationalMailMessage(env: DatabaseEnv | undefined, input: { id: string; companyId: string; senderUserId: string; recipientUserId: string; subject: string; body: string; importance: MailMessage["importance"] }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into mail_messages (
      id, company_id, sender_user_id, recipient_user_id, subject, body, status, importance, sent_at, created_at, updated_at
    )
    select
      ${input.id},
      ${input.companyId},
      ${input.senderUserId},
      u.id,
      ${input.subject},
      ${input.body},
      'sent',
      ${input.importance},
      now(),
      now(),
      now()
    from users u
    where u.id = ${input.recipientUserId}
      and u.company_id = ${input.companyId}
      and u.status = 'active'
      and u.deleted_at is null
    returning
      mail_messages.id,
      mail_messages.company_id,
      mail_messages.sender_user_id,
      (select coalesce(sender.display_name, sender.login_id, '알 수 없음') from users sender where sender.id = mail_messages.sender_user_id) as sender_name,
      mail_messages.recipient_user_id,
      (select coalesce(recipient.display_name, recipient.login_id) from users recipient where recipient.id = mail_messages.recipient_user_id) as recipient_name,
      mail_messages.subject,
      mail_messages.body,
      mail_messages.status,
      mail_messages.importance,
      mail_messages.sent_at,
      mail_messages.read_at,
      mail_messages.created_at,
      mail_messages.updated_at
  `;

  const row = rows[0] as MailRow | undefined;
  return row ? mapMailMessage(row) : null;
}

export async function createOperationalMailMessages(env: DatabaseEnv | undefined, input: { idPrefix: string; companyId: string; senderUserId: string; recipientUserIds: string[]; subject: string; body: string; importance: MailMessage["importance"] }) {
  const messages: MailMessage[] = [];
  const uniqueRecipientIds = Array.from(new Set(input.recipientUserIds));

  for (const [index, recipientUserId] of uniqueRecipientIds.entries()) {
    const message = await createOperationalMailMessage(env, {
      id: `${input.idPrefix}_${index + 1}`,
      companyId: input.companyId,
      senderUserId: input.senderUserId,
      recipientUserId,
      subject: input.subject,
      body: input.body,
      importance: input.importance,
    });
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

export async function markOperationalMailMessageRead(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; messageId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    with updated as (
      update mail_messages
      set read_at = coalesce(read_at, now()), updated_at = now()
      where id = ${input.messageId}
        and company_id = ${input.companyId}
        and recipient_user_id = ${input.userId}
        and status = 'sent'
        and deleted_at is null
      returning *
    )
    select
      updated.id,
      updated.company_id,
      updated.sender_user_id,
      coalesce(sender.display_name, sender.login_id, '알 수 없음') as sender_name,
      updated.recipient_user_id,
      coalesce(recipient.display_name, recipient.login_id) as recipient_name,
      updated.subject,
      updated.body,
      updated.status,
      updated.importance,
      updated.sent_at,
      updated.read_at,
      updated.created_at,
      updated.updated_at
    from updated
    join users sender on sender.id = updated.sender_user_id and sender.company_id = updated.company_id
    left join users recipient on recipient.id = updated.recipient_user_id and recipient.company_id = updated.company_id
  `;

  const row = rows[0] as MailRow | undefined;
  return row ? mapMailMessage(row) : null;
}
