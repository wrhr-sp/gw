import type { MailExternalDeliveryLog, MailProviderSettings, MailProviderSettingsUpdateRequest } from "@gw/shared";
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

type MailProviderSettingsRow = {
  company_id: string;
  provider_kind: MailProviderSettings["providerKind"];
  provider_name: string;
  from_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  api_endpoint: string | null;
  dns_spf_status: MailProviderSettings["dnsSpfStatus"];
  dns_dkim_status: MailProviderSettings["dnsDkimStatus"];
  dns_dmarc_status: MailProviderSettings["dnsDmarcStatus"];
  secret_status: MailProviderSettings["secretStatus"];
  notes: string | null;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
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

function buildProviderReadiness(row: Pick<MailProviderSettingsRow, "provider_kind" | "from_email" | "smtp_host" | "smtp_port" | "api_endpoint" | "dns_spf_status" | "dns_dkim_status" | "dns_dmarc_status" | "secret_status">): MailProviderSettings["readiness"] {
  const hasProvider = row.provider_kind === "smtp" || row.provider_kind === "api";
  const hasSender = Boolean(row.from_email);
  const hasHostOrEndpoint = row.provider_kind === "smtp" ? Boolean(row.smtp_host && row.smtp_port) : row.provider_kind === "api" ? Boolean(row.api_endpoint) : false;
  const hasSecret = row.secret_status === "connected";
  const hasDnsAuth = row.dns_spf_status === "verified" && row.dns_dkim_status === "verified" && row.dns_dmarc_status === "verified";
  return { hasProvider, hasSender, hasHostOrEndpoint, hasSecret, hasDnsAuth, canSendExternally: hasProvider && hasSender && hasHostOrEndpoint && hasSecret && hasDnsAuth };
}

function toProviderSettings(row: MailProviderSettingsRow): MailProviderSettings {
  return {
    companyId: row.company_id,
    providerKind: row.provider_kind,
    providerName: row.provider_name,
    fromEmail: row.from_email,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure,
    apiEndpoint: row.api_endpoint,
    dnsSpfStatus: row.dns_spf_status,
    dnsDkimStatus: row.dns_dkim_status,
    dnsDmarcStatus: row.dns_dmarc_status,
    secretStatus: row.secret_status,
    notes: row.notes,
    readiness: buildProviderReadiness(row),
    updatedBy: row.updated_by,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
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

export async function getOperationalMailProviderSettings(env: DatabaseEnv | undefined, companyId: string) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into mail_provider_settings (company_id, provider_kind, provider_name, created_at, updated_at)
    values (${companyId}, 'unconfigured', 'unconfigured', now(), now())
    on conflict (company_id) do update set company_id = excluded.company_id
    returning company_id, provider_kind, provider_name, from_email, smtp_host, smtp_port, smtp_secure, api_endpoint, dns_spf_status, dns_dkim_status, dns_dmarc_status, secret_status, notes, updated_by, created_at, updated_at
  `;
  return toProviderSettings(rows[0] as MailProviderSettingsRow);
}

export async function updateOperationalMailProviderSettings(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; settings: MailProviderSettingsUpdateRequest }) {
  const sql = getDbClient(env ?? {});
  const providerKind = input.settings.providerKind;
  const providerName = input.settings.providerName?.trim() || providerKind;
  const rows = await sql`
    insert into mail_provider_settings (
      company_id, provider_kind, provider_name, from_email, smtp_host, smtp_port, smtp_secure, api_endpoint, dns_spf_status, dns_dkim_status, dns_dmarc_status, secret_status, notes, updated_by, created_at, updated_at
    ) values (
      ${input.companyId}, ${providerKind}, ${providerName}, ${input.settings.fromEmail ?? null}, ${input.settings.smtpHost?.trim() || null}, ${input.settings.smtpPort ?? null}, ${input.settings.smtpSecure ?? true}, ${input.settings.apiEndpoint?.trim() || null}, ${input.settings.dnsSpfStatus ?? "not_checked"}, ${input.settings.dnsDkimStatus ?? "not_checked"}, ${input.settings.dnsDmarcStatus ?? "not_checked"}, ${input.settings.secretStatus ?? "not_connected"}, ${input.settings.notes?.trim() || null}, ${input.userId}, now(), now()
    )
    on conflict (company_id) do update set
      provider_kind = excluded.provider_kind,
      provider_name = excluded.provider_name,
      from_email = excluded.from_email,
      smtp_host = excluded.smtp_host,
      smtp_port = excluded.smtp_port,
      smtp_secure = excluded.smtp_secure,
      api_endpoint = excluded.api_endpoint,
      dns_spf_status = excluded.dns_spf_status,
      dns_dkim_status = excluded.dns_dkim_status,
      dns_dmarc_status = excluded.dns_dmarc_status,
      secret_status = excluded.secret_status,
      notes = excluded.notes,
      updated_by = excluded.updated_by,
      updated_at = now()
    returning company_id, provider_kind, provider_name, from_email, smtp_host, smtp_port, smtp_secure, api_endpoint, dns_spf_status, dns_dkim_status, dns_dmarc_status, secret_status, notes, updated_by, created_at, updated_at
  `;
  return toProviderSettings(rows[0] as MailProviderSettingsRow);
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
