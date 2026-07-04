import type { MailAccount, MailAccountAlias } from "@gw/shared";
import { getDbClient, type DatabaseEnv } from "../utils/db";

type MailAccountRow = {
  id: string;
  company_id: string;
  owner_user_id: string | null;
  owner_department_id: string | null;
  account_type: MailAccount["accountType"];
  email: string;
  display_name: string;
  reply_to_email: string | null;
  provider_kind: MailAccount["providerKind"];
  provider_name: string;
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type MailAliasRow = {
  id: string;
  company_id: string;
  mail_account_id: string;
  alias_email: string;
  display_name: string;
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type MailSettingsActor = {
  companyId: string;
  userId: string;
  isAdmin: boolean;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function mapAccount(row: MailAccountRow): MailAccount {
  return {
    id: row.id,
    companyId: row.company_id,
    ownerUserId: row.owner_user_id,
    ownerDepartmentId: row.owner_department_id,
    accountType: row.account_type,
    email: row.email,
    displayName: row.display_name,
    replyToEmail: row.reply_to_email,
    providerKind: row.provider_kind,
    providerName: row.provider_name,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAlias(row: MailAliasRow): MailAccountAlias {
  return {
    id: row.id,
    companyId: row.company_id,
    mailAccountId: row.mail_account_id,
    aliasEmail: row.alias_email,
    displayName: row.display_name,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function resolveOperationalMailSenderAccount(env: DatabaseEnv | undefined, actor: MailSettingsActor, input: { accountId?: string | null; aliasId?: string | null }) {
  if (!input.accountId && !input.aliasId) return null;
  const sql = getDbClient(env ?? {});
  const rows = input.aliasId
    ? await sql`
      select
        m.id as account_id,
        a.id as alias_id,
        a.alias_email as sender_email,
        a.display_name as sender_display_name,
        m.account_type,
        m.owner_user_id
      from mail_account_aliases a
      join mail_accounts m on m.id = a.mail_account_id and m.company_id = a.company_id and m.deleted_at is null
      where a.id = ${input.aliasId}
        and a.company_id = ${actor.companyId}
        and a.deleted_at is null
        and a.is_active = true
      limit 1
    `
    : await sql`
      select
        m.id as account_id,
        null::text as alias_id,
        m.email as sender_email,
        m.display_name as sender_display_name,
        m.account_type,
        m.owner_user_id
      from mail_accounts m
      where m.id = ${input.accountId}
        and m.company_id = ${actor.companyId}
        and m.deleted_at is null
        and m.is_active = true
      limit 1
    `;
  const row = rows[0] as { account_id: string; alias_id: string | null; sender_email: string; sender_display_name: string; account_type: MailAccount["accountType"]; owner_user_id: string | null } | undefined;
  if (!row) return null;
  if (!actor.isAdmin && (row.account_type !== "personal" || row.owner_user_id !== actor.userId)) return null;
  if (input.accountId && row.account_id !== input.accountId) return null;
  return {
    accountId: row.account_id,
    aliasId: row.alias_id,
    senderEmail: row.sender_email,
    senderDisplayName: row.sender_display_name,
  };
}

export async function listOperationalMailIntegrationSettings(env: DatabaseEnv | undefined, actor: MailSettingsActor) {
  const sql = getDbClient(env ?? {});
  const accountRows = await sql`
    select id, company_id, owner_user_id, owner_department_id, account_type, email, display_name, reply_to_email, provider_kind, provider_name, is_default, is_active, created_by, created_at, updated_at
    from mail_accounts
    where company_id = ${actor.companyId}
      and deleted_at is null
      and (${actor.isAdmin} or account_type = 'personal' and owner_user_id = ${actor.userId})
    order by account_type asc, is_default desc, created_at desc
  `;
  const aliasRows = await sql`
    select a.id, a.company_id, a.mail_account_id, a.alias_email, a.display_name, a.is_default, a.is_active, a.created_by, a.created_at, a.updated_at
    from mail_account_aliases a
    join mail_accounts m on m.id = a.mail_account_id and m.company_id = a.company_id and m.deleted_at is null
    where a.company_id = ${actor.companyId}
      and a.deleted_at is null
      and (${actor.isAdmin} or m.account_type = 'personal' and m.owner_user_id = ${actor.userId})
    order by a.is_default desc, a.created_at desc
  `;
  return { accounts: accountRows.map((row) => mapAccount(row as MailAccountRow)), aliases: aliasRows.map((row) => mapAlias(row as MailAliasRow)) };
}

export async function createOperationalMailAccount(env: DatabaseEnv | undefined, actor: MailSettingsActor, input: {
  id: string;
  accountType: MailAccount["accountType"];
  email: string;
  displayName: string;
  replyToEmail?: string | null;
  ownerDepartmentId?: string | null;
  providerKind: MailAccount["providerKind"];
  providerName?: string | null;
  isDefault: boolean;
}) {
  if (input.accountType === "virtual" && !actor.isAdmin) return null;
  const sql = getDbClient(env ?? {});
  if (input.accountType === "personal" && input.isDefault) {
    await sql`
      update mail_accounts
      set is_default = false, updated_at = now()
      where company_id = ${actor.companyId}
        and owner_user_id = ${actor.userId}
        and account_type = 'personal'
        and deleted_at is null
    `;
  }
  const rows = await sql`
    insert into mail_accounts (id, company_id, owner_user_id, owner_department_id, account_type, email, display_name, reply_to_email, provider_kind, provider_name, is_default, is_active, created_by, created_at, updated_at)
    values (${input.id}, ${actor.companyId}, ${input.accountType === "personal" ? actor.userId : null}, ${input.ownerDepartmentId ?? null}, ${input.accountType}, ${normalizeEmail(input.email)}, ${input.displayName.trim()}, ${input.replyToEmail ? normalizeEmail(input.replyToEmail) : null}, ${input.providerKind}, ${input.providerName?.trim() || input.providerKind}, ${input.isDefault}, true, ${actor.userId}, now(), now())
    returning id, company_id, owner_user_id, owner_department_id, account_type, email, display_name, reply_to_email, provider_kind, provider_name, is_default, is_active, created_by, created_at, updated_at
  `;
  return rows[0] ? mapAccount(rows[0] as MailAccountRow) : null;
}

export async function updateOperationalMailAccount(env: DatabaseEnv | undefined, actor: MailSettingsActor, accountId: string, input: Partial<Pick<MailAccount, "displayName" | "replyToEmail" | "ownerDepartmentId" | "providerKind" | "providerName" | "isDefault" | "isActive">>) {
  const sql = getDbClient(env ?? {});
  const existing = await sql`
    select id, account_type, owner_user_id
    from mail_accounts
    where id = ${accountId} and company_id = ${actor.companyId} and deleted_at is null
    limit 1
  `;
  const row = existing[0] as { account_type: MailAccount["accountType"]; owner_user_id: string | null } | undefined;
  if (!row) return null;
  if (!actor.isAdmin && (row.account_type !== "personal" || row.owner_user_id !== actor.userId)) return null;
  if (row.account_type === "personal" && input.isDefault === true) {
    await sql`
      update mail_accounts
      set is_default = false, updated_at = now()
      where company_id = ${actor.companyId}
        and owner_user_id = ${actor.userId}
        and account_type = 'personal'
        and id <> ${accountId}
        and deleted_at is null
    `;
  }
  const rows = await sql`
    update mail_accounts
    set display_name = coalesce(${input.displayName?.trim() ?? null}, display_name),
        reply_to_email = ${input.replyToEmail === undefined ? null : input.replyToEmail ? normalizeEmail(input.replyToEmail) : null},
        owner_department_id = ${input.ownerDepartmentId === undefined ? null : input.ownerDepartmentId},
        provider_kind = coalesce(${input.providerKind ?? null}, provider_kind),
        provider_name = coalesce(${input.providerName?.trim() ?? null}, provider_name),
        is_default = coalesce(${input.isDefault ?? null}, is_default),
        is_active = coalesce(${input.isActive ?? null}, is_active),
        updated_at = now()
    where id = ${accountId} and company_id = ${actor.companyId} and deleted_at is null
    returning id, company_id, owner_user_id, owner_department_id, account_type, email, display_name, reply_to_email, provider_kind, provider_name, is_default, is_active, created_by, created_at, updated_at
  `;
  return rows[0] ? mapAccount(rows[0] as MailAccountRow) : null;
}

export async function deleteOperationalMailAccount(env: DatabaseEnv | undefined, actor: MailSettingsActor, accountId: string) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    update mail_accounts
    set deleted_at = now(), updated_at = now()
    where id = ${accountId}
      and company_id = ${actor.companyId}
      and deleted_at is null
      and (${actor.isAdmin} or account_type = 'personal' and owner_user_id = ${actor.userId})
    returning id
  `;
  if (rows[0]) {
    await sql`update mail_account_aliases set deleted_at = now(), updated_at = now() where company_id = ${actor.companyId} and mail_account_id = ${accountId} and deleted_at is null`;
  }
  return Boolean(rows[0]);
}

export async function createOperationalMailAlias(env: DatabaseEnv | undefined, actor: MailSettingsActor, input: { id: string; mailAccountId: string; aliasEmail: string; displayName: string; isDefault: boolean }) {
  const sql = getDbClient(env ?? {});
  const accountRows = await sql`
    select id, account_type, owner_user_id
    from mail_accounts
    where id = ${input.mailAccountId} and company_id = ${actor.companyId} and deleted_at is null
    limit 1
  `;
  const account = accountRows[0] as { account_type: MailAccount["accountType"]; owner_user_id: string | null } | undefined;
  if (!account) return null;
  if (!actor.isAdmin && (account.account_type !== "personal" || account.owner_user_id !== actor.userId)) return null;
  if (input.isDefault) {
    await sql`update mail_account_aliases set is_default = false, updated_at = now() where company_id = ${actor.companyId} and mail_account_id = ${input.mailAccountId} and deleted_at is null`;
  }
  const rows = await sql`
    insert into mail_account_aliases (id, company_id, mail_account_id, alias_email, display_name, is_default, is_active, created_by, created_at, updated_at)
    values (${input.id}, ${actor.companyId}, ${input.mailAccountId}, ${normalizeEmail(input.aliasEmail)}, ${input.displayName.trim()}, ${input.isDefault}, true, ${actor.userId}, now(), now())
    returning id, company_id, mail_account_id, alias_email, display_name, is_default, is_active, created_by, created_at, updated_at
  `;
  return rows[0] ? mapAlias(rows[0] as MailAliasRow) : null;
}

export async function updateOperationalMailAlias(env: DatabaseEnv | undefined, actor: MailSettingsActor, aliasId: string, input: Partial<Pick<MailAccountAlias, "displayName" | "isDefault" | "isActive">>) {
  const sql = getDbClient(env ?? {});
  const existing = await sql`
    select a.id, a.mail_account_id, m.account_type, m.owner_user_id
    from mail_account_aliases a
    join mail_accounts m on m.id = a.mail_account_id and m.company_id = a.company_id and m.deleted_at is null
    where a.id = ${aliasId} and a.company_id = ${actor.companyId} and a.deleted_at is null
    limit 1
  `;
  const row = existing[0] as { mail_account_id: string; account_type: MailAccount["accountType"]; owner_user_id: string | null } | undefined;
  if (!row) return null;
  if (!actor.isAdmin && (row.account_type !== "personal" || row.owner_user_id !== actor.userId)) return null;
  if (input.isDefault === true) {
    await sql`update mail_account_aliases set is_default = false, updated_at = now() where company_id = ${actor.companyId} and mail_account_id = ${row.mail_account_id} and id <> ${aliasId} and deleted_at is null`;
  }
  const rows = await sql`
    update mail_account_aliases
    set display_name = coalesce(${input.displayName?.trim() ?? null}, display_name),
        is_default = coalesce(${input.isDefault ?? null}, is_default),
        is_active = coalesce(${input.isActive ?? null}, is_active),
        updated_at = now()
    where id = ${aliasId} and company_id = ${actor.companyId} and deleted_at is null
    returning id, company_id, mail_account_id, alias_email, display_name, is_default, is_active, created_by, created_at, updated_at
  `;
  return rows[0] ? mapAlias(rows[0] as MailAliasRow) : null;
}

export async function deleteOperationalMailAlias(env: DatabaseEnv | undefined, actor: MailSettingsActor, aliasId: string) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    update mail_account_aliases a
    set deleted_at = now(), updated_at = now()
    from mail_accounts m
    where a.id = ${aliasId}
      and a.company_id = ${actor.companyId}
      and a.deleted_at is null
      and m.id = a.mail_account_id
      and m.company_id = a.company_id
      and m.deleted_at is null
      and (${actor.isAdmin} or m.account_type = 'personal' and m.owner_user_id = ${actor.userId})
    returning a.id
  `;
  return Boolean(rows[0]);
}
