import type { MailDeliveryBatch, MailDeliveryRecipient, MailMessage } from "@gw/shared";
import { getDbClient, type DatabaseEnv } from "../utils/db";

type DeliveryRecipientInput = {
  id: string;
  messageId?: string | null;
  recipientUserId?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  recipientType?: "to" | "cc" | "bcc";
  status: MailDeliveryRecipient["status"];
  errorCode?: string | null;
  errorMessage?: string | null;
  providerKind?: MailDeliveryRecipient["providerKind"];
  providerName?: string;
  sentAt?: string | null;
  failedAt?: string | null;
};

type DeliveryBatchRow = {
  id: string;
  company_id: string;
  sender_user_id: string;
  sender_name: string;
  sender_mail_account_id: string | null;
  sender_mail_alias_id: string | null;
  sender_email: string | null;
  sender_display_name: string | null;
  email_type: MailDeliveryBatch["emailType"];
  delivery_mode: MailDeliveryBatch["deliveryMode"];
  subject: string;
  status: MailDeliveryBatch["status"];
  recipient_count: number;
  success_count: number;
  failed_count: number;
  blocked_count: number;
  external_recipient_count: number;
  provider_kind: MailDeliveryBatch["providerKind"];
  provider_name: string;
  requested_by: string | null;
  requested_at: Date | string;
  scheduled_at: Date | string | null;
  sent_at: Date | string | null;
  failed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type DeliveryRecipientRow = {
  id: string;
  batch_id: string;
  message_id: string | null;
  recipient_user_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  recipient_type: MailDeliveryRecipient["recipientType"];
  status: MailDeliveryRecipient["status"];
  provider_kind: MailDeliveryRecipient["providerKind"];
  provider_name: string;
  error_code: string | null;
  error_message: string | null;
  provider_message_id: string | null;
  retry_count: number;
  next_retry_at: Date | string | null;
  sent_at: Date | string | null;
  failed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRecipient(row: DeliveryRecipientRow): MailDeliveryRecipient {
  return {
    id: row.id,
    batchId: row.batch_id,
    messageId: row.message_id,
    recipientUserId: row.recipient_user_id,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    recipientType: row.recipient_type,
    status: row.status,
    providerKind: row.provider_kind,
    providerName: row.provider_name,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    providerMessageId: row.provider_message_id,
    retryCount: Number(row.retry_count ?? 0),
    nextRetryAt: toIso(row.next_retry_at),
    sentAt: toIso(row.sent_at),
    failedAt: toIso(row.failed_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapBatch(row: DeliveryBatchRow, recipients: MailDeliveryRecipient[]): MailDeliveryBatch {
  return {
    id: row.id,
    companyId: row.company_id,
    senderUserId: row.sender_user_id,
    senderName: row.sender_name,
    senderMailAccountId: row.sender_mail_account_id,
    senderMailAliasId: row.sender_mail_alias_id,
    senderEmail: row.sender_email,
    senderDisplayName: row.sender_display_name,
    emailType: row.email_type,
    deliveryMode: row.delivery_mode,
    subject: row.subject,
    status: row.status,
    recipientCount: Number(row.recipient_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    blockedCount: Number(row.blocked_count ?? 0),
    externalRecipientCount: Number(row.external_recipient_count ?? 0),
    providerKind: row.provider_kind,
    providerName: row.provider_name,
    requestedBy: row.requested_by,
    requestedAt: toIso(row.requested_at) ?? new Date().toISOString(),
    scheduledAt: toIso(row.scheduled_at),
    sentAt: toIso(row.sent_at),
    failedAt: toIso(row.failed_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    recipients,
  };
}

export async function createOperationalMailDeliveryHistory(env: DatabaseEnv | undefined, input: {
  id: string;
  companyId: string;
  senderUserId: string;
  senderMailAccountId?: string | null;
  senderMailAliasId?: string | null;
  senderEmail?: string | null;
  senderDisplayName?: string | null;
  emailType?: MailDeliveryBatch["emailType"];
  deliveryMode?: MailDeliveryBatch["deliveryMode"];
  subject: string;
  bodySnapshot: string;
  status: MailDeliveryBatch["status"];
  providerKind?: MailDeliveryBatch["providerKind"];
  providerName?: string;
  requestedBy: string;
  scheduledAt?: string | null;
  recipients: DeliveryRecipientInput[];
}) {
  const sql = getDbClient(env ?? {});
  const successCount = input.recipients.filter((recipient) => recipient.status === "sent").length;
  const failedCount = input.recipients.filter((recipient) => recipient.status === "failed").length;
  const blockedCount = input.recipients.filter((recipient) => recipient.status === "blocked").length;
  const externalRecipientCount = input.recipients.filter((recipient) => !recipient.recipientUserId).length;
  const batchRows = await sql`
    insert into mail_delivery_batches (
      id, company_id, sender_user_id, sender_mail_account_id, sender_mail_alias_id, sender_email, sender_display_name, email_type, delivery_mode, subject, body_snapshot, status, recipient_count, success_count, failed_count, blocked_count, external_recipient_count, provider_kind, provider_name, requested_by, requested_at, scheduled_at, sent_at, failed_at, created_at, updated_at
    ) values (
      ${input.id}, ${input.companyId}, ${input.senderUserId}, ${input.senderMailAccountId ?? null}, ${input.senderMailAliasId ?? null}, ${input.senderEmail ?? null}, ${input.senderDisplayName ?? null}, ${input.emailType ?? "manual"}, ${input.deliveryMode ?? "immediate"}, ${input.subject}, ${input.bodySnapshot}, ${input.status}, ${input.recipients.length}, ${successCount}, ${failedCount}, ${blockedCount}, ${externalRecipientCount}, ${input.providerKind ?? "unconfigured"}, ${input.providerName ?? "unconfigured"}, ${input.requestedBy}, now(), ${input.scheduledAt ?? null}, ${successCount > 0 ? sql`now()` : null}, ${failedCount > 0 || blockedCount > 0 ? sql`now()` : null}, now(), now()
    )
    returning id, company_id, sender_user_id, (select coalesce(display_name, login_id, '알 수 없음') from users where id = ${input.senderUserId}) as sender_name, sender_mail_account_id, sender_mail_alias_id, sender_email, sender_display_name, email_type, delivery_mode, subject, status, recipient_count, success_count, failed_count, blocked_count, external_recipient_count, provider_kind, provider_name, requested_by, requested_at, scheduled_at, sent_at, failed_at, created_at, updated_at
  `;
  const recipientRows: DeliveryRecipientRow[] = [];
  for (const recipient of input.recipients) {
    const rows = await sql`
      insert into mail_delivery_recipients (
        id, batch_id, company_id, message_id, recipient_user_id, recipient_email, recipient_name, recipient_type, status, provider_kind, provider_name, error_code, error_message, sent_at, failed_at, created_at, updated_at
      ) values (
        ${recipient.id}, ${input.id}, ${input.companyId}, ${recipient.messageId ?? null}, ${recipient.recipientUserId ?? null}, ${recipient.recipientEmail}, ${recipient.recipientName ?? null}, ${recipient.recipientType ?? "to"}, ${recipient.status}, ${recipient.providerKind ?? input.providerKind ?? "unconfigured"}, ${recipient.providerName ?? input.providerName ?? "unconfigured"}, ${recipient.errorCode ?? null}, ${recipient.errorMessage ?? null}, ${recipient.status === "sent" ? sql`now()` : null}, ${recipient.status === "failed" || recipient.status === "blocked" ? sql`now()` : null}, now(), now()
      )
      returning id, batch_id, message_id, recipient_user_id, recipient_email, recipient_name, recipient_type, status, provider_kind, provider_name, error_code, error_message, provider_message_id, retry_count, next_retry_at, sent_at, failed_at, created_at, updated_at
    `;
    if (rows[0]) recipientRows.push(rows[0] as DeliveryRecipientRow);
  }
  return mapBatch(batchRows[0] as DeliveryBatchRow, recipientRows.map(mapRecipient));
}

export function buildInternalDeliveryRecipients(messages: MailMessage[], idPrefix: string, options?: { status?: DeliveryRecipientInput["status"]; providerKind?: DeliveryRecipientInput["providerKind"]; providerName?: string }): DeliveryRecipientInput[] {
  return messages.map((message, index) => ({
    id: `${idPrefix}_recipient_${index + 1}`,
    messageId: message.id,
    recipientUserId: message.recipientUserId,
    recipientEmail: `${message.recipientUserId ?? "unknown"}@internal.local`,
    recipientName: message.recipientName,
    recipientType: "to",
    status: options?.status ?? "sent",
    providerKind: options?.providerKind,
    providerName: options?.providerName,
    sentAt: options?.status === "queued" ? null : message.sentAt,
  }));
}

export async function listOperationalMailDeliveryHistory(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; isAdmin: boolean }) {
  const sql = getDbClient(env ?? {});
  const batchRows = await sql`
    select
      b.id, b.company_id, b.sender_user_id, coalesce(sender.display_name, sender.login_id, '알 수 없음') as sender_name,
      b.sender_mail_account_id, b.sender_mail_alias_id, b.sender_email, b.sender_display_name, b.email_type, b.delivery_mode, b.subject, b.status,
      b.recipient_count, b.success_count, b.failed_count, b.blocked_count, b.external_recipient_count, b.provider_kind, b.provider_name, b.requested_by, b.requested_at, b.scheduled_at, b.sent_at, b.failed_at, b.created_at, b.updated_at
    from mail_delivery_batches b
    join users sender on sender.id = b.sender_user_id and sender.company_id = b.company_id
    where b.company_id = ${input.companyId}
      and b.deleted_at is null
      and (${input.isAdmin} or b.sender_user_id = ${input.userId})
    order by b.requested_at desc
    limit 50
  `;
  const ids = (batchRows as DeliveryBatchRow[]).map((row) => row.id);
  const recipientRows = ids.length ? await sql`
    select id, batch_id, message_id, recipient_user_id, recipient_email, recipient_name, recipient_type, status, provider_kind, provider_name, error_code, error_message, provider_message_id, retry_count, next_retry_at, sent_at, failed_at, created_at, updated_at
    from mail_delivery_recipients
    where company_id = ${input.companyId}
      and batch_id = any(${ids})
    order by created_at asc
  ` : [];
  const recipientsByBatch = new Map<string, MailDeliveryRecipient[]>();
  for (const row of recipientRows as DeliveryRecipientRow[]) {
    const mapped = mapRecipient(row);
    recipientsByBatch.set(row.batch_id, [...(recipientsByBatch.get(row.batch_id) ?? []), mapped]);
  }
  const items = (batchRows as DeliveryBatchRow[]).map((row) => mapBatch(row, recipientsByBatch.get(row.id) ?? []));
  const counts = await sql`
    select
      count(*) as total,
      count(*) filter (where status = 'sent') as sent,
      count(*) filter (where status = 'failed') as failed,
      count(*) filter (where status = 'blocked') as blocked,
      count(*) filter (where status in ('pending', 'queued', 'sending', 'retrying', 'scheduled')) as queued
    from mail_delivery_batches
    where company_id = ${input.companyId}
      and deleted_at is null
      and (${input.isAdmin} or sender_user_id = ${input.userId})
  `;
  const countRow = counts[0] ?? {};
  return {
    items,
    counts: {
      total: Number(countRow.total ?? 0),
      sent: Number(countRow.sent ?? 0),
      failed: Number(countRow.failed ?? 0),
      blocked: Number(countRow.blocked ?? 0),
      queued: Number(countRow.queued ?? 0),
    },
  };
}
