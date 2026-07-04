import type { MailExternalDeliveryLog } from "@gw/shared";
import { getDbClient, type DatabaseEnv } from "../utils/db";

type MailExternalDeliveryLogRow = {
  id: string;
  company_id: string;
  message_id: string | null;
  sender_user_id: string;
  recipient_type: "to" | "cc";
  recipient_email: string;
  provider_kind: "smtp" | "api" | "unconfigured";
  provider_name: string;
  status: "blocked" | "pending" | "sent" | "failed";
  error_code: string | null;
  error_message: string | null;
  provider_message_id: string | null;
  attempted_at: Date | string;
  sent_at: Date | string | null;
  failed_at: Date | string | null;
};

export type ExternalMailRecipientInput = {
  recipientType: "to" | "cc";
  email: string;
};

export type ExternalMailProviderConfig = {
  kind: "smtp" | "api" | "unconfigured";
  name: string;
  configured: boolean;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toExternalDeliveryLog(row: MailExternalDeliveryLogRow): MailExternalDeliveryLog {
  return {
    id: row.id,
    companyId: row.company_id,
    messageId: row.message_id,
    senderUserId: row.sender_user_id,
    recipientType: row.recipient_type,
    recipientEmail: row.recipient_email,
    providerKind: row.provider_kind,
    providerName: row.provider_name,
    status: row.status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    providerMessageId: row.provider_message_id,
    attemptedAt: toIso(row.attempted_at) ?? new Date().toISOString(),
    sentAt: toIso(row.sent_at),
    failedAt: toIso(row.failed_at),
  };
}

export function normalizeExternalMailRecipients(input: { to?: string[]; cc?: string[] }) {
  const seen = new Set<string>();
  const result: ExternalMailRecipientInput[] = [];
  for (const recipientType of ["to", "cc"] as const) {
    for (const rawEmail of input[recipientType] ?? []) {
      const email = rawEmail.trim().toLowerCase();
      if (!email || seen.has(`${recipientType}:${email}`)) continue;
      seen.add(`${recipientType}:${email}`);
      result.push({ recipientType, email });
    }
  }
  return result;
}

export function getExternalMailProviderConfig(env: Record<string, unknown> | undefined): ExternalMailProviderConfig {
  const provider = typeof env?.MAIL_PROVIDER === "string" ? env.MAIL_PROVIDER.trim().toLowerCase() : "";
  if (provider === "smtp") {
    const hasSmtp = Boolean(env?.SMTP_HOST && env?.SMTP_PORT && env?.SMTP_USER && env?.SMTP_PASSWORD && env?.MAIL_FROM_EMAIL);
    return { kind: "smtp", name: "smtp", configured: hasSmtp };
  }
  if (provider === "api") {
    const providerName = typeof env?.MAIL_API_PROVIDER === "string" && env.MAIL_API_PROVIDER.trim() ? env.MAIL_API_PROVIDER.trim().toLowerCase() : "api";
    const hasApi = Boolean(env?.MAIL_API_ENDPOINT && env?.MAIL_API_KEY && env?.MAIL_FROM_EMAIL);
    return { kind: "api", name: providerName, configured: hasApi };
  }
  return { kind: "unconfigured", name: "unconfigured", configured: false };
}

export async function createBlockedExternalMailDeliveryLogs(env: DatabaseEnv | undefined, input: {
  idPrefix: string;
  companyId: string;
  senderUserId: string;
  messageId?: string | null;
  recipients: ExternalMailRecipientInput[];
  provider: ExternalMailProviderConfig;
  errorCode: string;
  errorMessage: string;
}) {
  if (!input.recipients.length) return [];
  const sql = getDbClient(env ?? {});
  const rows = [] as MailExternalDeliveryLogRow[];
  for (const [index, recipient] of input.recipients.entries()) {
    const id = `${input.idPrefix}_external_${index + 1}`;
    const inserted = await sql`
      insert into mail_external_delivery_logs (
        id,
        company_id,
        message_id,
        sender_user_id,
        recipient_type,
        recipient_email,
        provider_kind,
        provider_name,
        status,
        error_code,
        error_message,
        attempted_at,
        failed_at,
        created_at,
        updated_at
      ) values (
        ${id},
        ${input.companyId},
        ${input.messageId ?? null},
        ${input.senderUserId},
        ${recipient.recipientType},
        ${recipient.email},
        ${input.provider.kind},
        ${input.provider.name},
        'blocked',
        ${input.errorCode},
        ${input.errorMessage},
        now(),
        now(),
        now(),
        now()
      )
      returning id, company_id, message_id, sender_user_id, recipient_type, recipient_email, provider_kind, provider_name, status, error_code, error_message, provider_message_id, attempted_at, sent_at, failed_at
    `;
    if (inserted[0]) rows.push(inserted[0] as MailExternalDeliveryLogRow);
  }
  return rows.map(toExternalDeliveryLog);
}
