import { type MailMessage, type MailMessageMoveTarget, type MailRecipient } from "@gw/shared";
import { getDbClient, type DatabaseEnv } from "../utils/db";
type MailRow = {
  id: string;
  company_id: string;
  sender_user_id: string;
  sender_name: string;
  sender_mail_account_id?: string | null;
  sender_mail_alias_id?: string | null;
  sender_email?: string | null;
  sender_display_name?: string | null;
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

export type MailBox = "favorites" | "inbox" | "sent" | "drafts" | "spam" | "trash";

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
    senderMailAccountId: row.sender_mail_account_id ?? null,
    senderMailAliasId: row.sender_mail_alias_id ?? null,
    senderEmail: row.sender_email ?? null,
    senderDisplayName: row.sender_display_name ?? null,
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

export async function listOperationalMailRecipients(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; query?: string }) {
  const sql = getDbClient(env ?? {});
  const trimmedQuery = (input.query ?? "").trim().toLowerCase();
  const hasKeyword = trimmedQuery.length > 0;
  const keyword = `%${trimmedQuery}%`;
  const rows = await sql`
    with internal_recipients as (
      select
        u.id as user_id,
        e.id as employee_id,
        coalesce(e.full_name, u.display_name, u.login_id) as display_name,
        coalesce(u.email, u.login_id) as email,
        d.name as department_name,
        p.name as position_name,
        'internal' as source_kind,
        1 as source_rank,
        null::timestamptz as last_used_at
      from users u
      left join employees e
        on e.user_id = u.id
        and e.company_id = u.company_id
        and e.deleted_at is null
      left join departments d
        on d.id = e.department_id
        and d.company_id = e.company_id
        and d.deleted_at is null
      left join positions p
        on p.id = e.position_id
        and p.company_id = e.company_id
        and p.deleted_at is null
      where u.company_id = ${input.companyId}
        and u.status = 'active'
        and u.deleted_at is null
        and (
          ${!hasKeyword}
          or lower(coalesce(e.full_name, u.display_name, u.login_id)) like ${keyword}
          or lower(coalesce(u.email, u.login_id)) like ${keyword}
          or lower(coalesce(d.name, '')) like ${keyword}
          or lower(coalesce(p.name, '')) like ${keyword}
        )
      limit 20
    ),
    history_recipients as (
      select distinct on (counterparty.id)
        counterparty.id as user_id,
        e.id as employee_id,
        coalesce(e.full_name, counterparty.display_name, counterparty.login_id) as display_name,
        coalesce(counterparty.email, counterparty.login_id) as email,
        d.name as department_name,
        p.name as position_name,
        'history' as source_kind,
        2 as source_rank,
        max(coalesce(m.sent_at, m.updated_at)) over (partition by counterparty.id) as last_used_at
      from mail_messages m
      join users counterparty
        on counterparty.id = case when m.sender_user_id = ${input.userId} then m.recipient_user_id else m.sender_user_id end
        and counterparty.company_id = m.company_id
        and counterparty.status = 'active'
        and counterparty.deleted_at is null
      left join employees e
        on e.user_id = counterparty.id
        and e.company_id = counterparty.company_id
        and e.deleted_at is null
      left join departments d
        on d.id = e.department_id
        and d.company_id = e.company_id
        and d.deleted_at is null
      left join positions p
        on p.id = e.position_id
        and p.company_id = e.company_id
        and p.deleted_at is null
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and m.status = 'sent'
        and (m.sender_user_id = ${input.userId} or m.recipient_user_id = ${input.userId})
        and (
          ${!hasKeyword}
          or lower(coalesce(e.full_name, counterparty.display_name, counterparty.login_id)) like ${keyword}
          or lower(coalesce(counterparty.email, counterparty.login_id)) like ${keyword}
          or lower(coalesce(d.name, '')) like ${keyword}
          or lower(coalesce(p.name, '')) like ${keyword}
        )
    ),
    combined as (
      select * from internal_recipients
      union all
      select * from history_recipients h
      where not exists (
        select 1 from internal_recipients i where lower(i.email) = lower(h.email)
      )
    )
    select * from combined
    order by source_rank, coalesce(last_used_at, now()) desc, coalesce(department_name, ''), display_name
    limit 20
  `;

  return rows.map((row) => {
    const typed = row as {
      user_id: string;
      employee_id: string | null;
      display_name: string;
      email: string;
      department_name: string | null;
      position_name: string | null;
      source_kind: "internal" | "history";
    };
    return {
      userId: typed.user_id,
      employeeId: typed.employee_id,
      displayName: typed.display_name,
      email: typed.email,
      departmentName: typed.department_name,
      positionName: typed.position_name,
      sourceKind: typed.source_kind,
    } satisfies MailRecipient;
  });
}

export async function listOperationalMailMessages(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; box: MailBox }) {
  const sql = getDbClient(env ?? {});
  const baseSelect = sql`
      select
        m.id,
        m.company_id,
        m.sender_user_id,
        coalesce(sender.display_name, sender.login_id, '알 수 없음') as sender_name,
        m.sender_mail_account_id,
        m.sender_mail_alias_id,
        m.sender_email,
        m.sender_display_name,
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
  `;
  const itemsPromise = input.box === "sent"
    ? sql`${baseSelect}
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and m.sender_user_id = ${input.userId}
        and m.status = 'sent'
      order by coalesce(m.sent_at, m.updated_at) desc
      limit 50
    `
    : input.box === "drafts"
      ? sql`${baseSelect}
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and m.sender_user_id = ${input.userId}
        and m.status = 'draft'
      order by coalesce(m.sent_at, m.updated_at) desc
      limit 50
    `
      : input.box === "favorites"
        ? sql`${baseSelect}
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and (m.sender_user_id = ${input.userId} or m.recipient_user_id = ${input.userId})
        and m.importance = 'important'
        and m.status in ('sent', 'draft')
      order by coalesce(m.sent_at, m.updated_at) desc
      limit 50
    `
      : input.box === "spam" || input.box === "trash"
        ? sql`${baseSelect}
      where m.company_id = ${input.companyId}
        and m.deleted_at is null
        and (m.sender_user_id = ${input.userId} or m.recipient_user_id = ${input.userId})
        and m.status = ${input.box}
      order by coalesce(m.sent_at, m.updated_at) desc
      limit 50
    `
        : sql`${baseSelect}
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
        count(*) filter (where sender_user_id = ${input.userId} and status = 'draft' and deleted_at is null) as drafts,
        count(*) filter (where (sender_user_id = ${input.userId} or recipient_user_id = ${input.userId}) and importance = 'important' and status in ('sent', 'draft') and deleted_at is null) as favorites,
        count(*) filter (where (sender_user_id = ${input.userId} or recipient_user_id = ${input.userId}) and status = 'spam' and deleted_at is null) as spam,
        count(*) filter (where (sender_user_id = ${input.userId} or recipient_user_id = ${input.userId}) and status = 'trash' and deleted_at is null) as trash
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
      favorites: Number(countRow.favorites ?? 0),
      spam: Number(countRow.spam ?? 0),
      trash: Number(countRow.trash ?? 0),
    },
  };
}

export async function moveOperationalMailMessage(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; messageId: string; target: MailMessageMoveTarget }) {
  const sql = getDbClient(env ?? {});
  if (input.target === "delete") {
    const rows = await sql`
      update mail_messages
      set deleted_at = now(), updated_at = now()
      where id = ${input.messageId}
        and company_id = ${input.companyId}
        and deleted_at is null
        and (sender_user_id = ${input.userId} or recipient_user_id = ${input.userId})
        and status = 'trash'
      returning
        id,
        company_id,
        sender_user_id,
        (select coalesce(sender.display_name, sender.login_id, '알 수 없음') from users sender where sender.id = mail_messages.sender_user_id) as sender_name,
        sender_mail_account_id,
        sender_mail_alias_id,
        sender_email,
        sender_display_name,
        recipient_user_id,
        (select coalesce(recipient.display_name, recipient.login_id) from users recipient where recipient.id = mail_messages.recipient_user_id) as recipient_name,
        subject,
        body,
        status,
        importance,
        sent_at,
        read_at,
        created_at,
        updated_at
    `;
    return (rows[0] as MailRow | undefined) ? mapMailMessage(rows[0] as MailRow) : null;
  }
  const nextStatus = input.target === "archive" ? "archived" : input.target === "inbox" ? "sent" : input.target;
  const rows = await sql`
    update mail_messages
    set status = ${nextStatus}, updated_at = now()
    where id = ${input.messageId}
      and company_id = ${input.companyId}
      and deleted_at is null
      and (sender_user_id = ${input.userId} or recipient_user_id = ${input.userId})
      and (
        ${input.target !== "inbox"}
        or status in ('spam', 'trash', 'archived')
      )
    returning
      id,
      company_id,
      sender_user_id,
      (select coalesce(sender.display_name, sender.login_id, '알 수 없음') from users sender where sender.id = mail_messages.sender_user_id) as sender_name,
      sender_mail_account_id,
      sender_mail_alias_id,
      sender_email,
      sender_display_name,
      recipient_user_id,
      (select coalesce(recipient.display_name, recipient.login_id) from users recipient where recipient.id = mail_messages.recipient_user_id) as recipient_name,
      subject,
      body,
      status,
      importance,
      sent_at,
      read_at,
      created_at,
      updated_at
  `;
  return (rows[0] as MailRow | undefined) ? mapMailMessage(rows[0] as MailRow) : null;
}

export async function setOperationalMailMessageFavorite(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; messageId: string; isFavorite: boolean }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    update mail_messages
    set importance = ${input.isFavorite ? "important" : "normal"}, updated_at = now()
    where id = ${input.messageId}
      and company_id = ${input.companyId}
      and deleted_at is null
      and (sender_user_id = ${input.userId} or recipient_user_id = ${input.userId})
      and status in ('sent', 'draft')
    returning
      id,
      company_id,
      sender_user_id,
      (select coalesce(sender.display_name, sender.login_id, '알 수 없음') from users sender where sender.id = mail_messages.sender_user_id) as sender_name,
      sender_mail_account_id,
      sender_mail_alias_id,
      sender_email,
      sender_display_name,
      recipient_user_id,
      (select coalesce(recipient.display_name, recipient.login_id) from users recipient where recipient.id = mail_messages.recipient_user_id) as recipient_name,
      subject,
      body,
      status,
      importance,
      sent_at,
      read_at,
      created_at,
      updated_at
  `;
  return (rows[0] as MailRow | undefined) ? mapMailMessage(rows[0] as MailRow) : null;
}

export async function createOperationalMailMessage(env: DatabaseEnv | undefined, input: { id: string; companyId: string; senderUserId: string; recipientUserId: string; subject: string; body: string; importance: MailMessage["importance"]; senderMailAccountId?: string | null; senderMailAliasId?: string | null; senderEmail?: string | null; senderDisplayName?: string | null }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into mail_messages (
      id, company_id, sender_user_id, recipient_user_id, sender_mail_account_id, sender_mail_alias_id, sender_email, sender_display_name, subject, body, status, importance, sent_at, created_at, updated_at
    )
    select
      ${input.id},
      ${input.companyId},
      ${input.senderUserId},
      u.id,
      ${input.senderMailAccountId ?? null},
      ${input.senderMailAliasId ?? null},
      ${input.senderEmail ?? null},
      ${input.senderDisplayName ?? null},
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
      mail_messages.sender_mail_account_id,
      mail_messages.sender_mail_alias_id,
      mail_messages.sender_email,
      mail_messages.sender_display_name,
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

export async function createOperationalMailMessages(env: DatabaseEnv | undefined, input: { idPrefix: string; companyId: string; senderUserId: string; recipientUserIds: string[]; subject: string; body: string; importance: MailMessage["importance"]; senderMailAccountId?: string | null; senderMailAliasId?: string | null; senderEmail?: string | null; senderDisplayName?: string | null }) {
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
      senderMailAccountId: input.senderMailAccountId,
      senderMailAliasId: input.senderMailAliasId,
      senderEmail: input.senderEmail,
      senderDisplayName: input.senderDisplayName,
    });
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

export async function createOperationalMailDraft(env: DatabaseEnv | undefined, input: { id: string; companyId: string; senderUserId: string; recipientUserId: string | null; subject: string; body: string; importance: MailMessage["importance"]; senderMailAccountId?: string | null; senderMailAliasId?: string | null; senderEmail?: string | null; senderDisplayName?: string | null }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into mail_messages (
      id, company_id, sender_user_id, recipient_user_id, sender_mail_account_id, sender_mail_alias_id, sender_email, sender_display_name, subject, body, status, importance, sent_at, created_at, updated_at
    )
    select
      ${input.id},
      ${input.companyId},
      ${input.senderUserId},
      recipient.id,
      ${input.senderMailAccountId ?? null},
      ${input.senderMailAliasId ?? null},
      ${input.senderEmail ?? null},
      ${input.senderDisplayName ?? null},
      ${input.subject},
      ${input.body},
      'draft',
      ${input.importance},
      null,
      now(),
      now()
    from (select ${input.recipientUserId}::text as requested_recipient_user_id) request
    left join users recipient
      on recipient.id = request.requested_recipient_user_id
      and recipient.company_id = ${input.companyId}
      and recipient.status = 'active'
      and recipient.deleted_at is null
    where request.requested_recipient_user_id is null or recipient.id is not null
    returning
      mail_messages.id,
      mail_messages.company_id,
      mail_messages.sender_user_id,
      (select coalesce(sender.display_name, sender.login_id, '알 수 없음') from users sender where sender.id = mail_messages.sender_user_id) as sender_name,
      mail_messages.sender_mail_account_id,
      mail_messages.sender_mail_alias_id,
      mail_messages.sender_email,
      mail_messages.sender_display_name,
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

export async function updateOperationalMailDraft(env: DatabaseEnv | undefined, input: { id: string; companyId: string; senderUserId: string; recipientUserId: string | null; subject: string; body: string; importance: MailMessage["importance"]; senderMailAccountId?: string | null; senderMailAliasId?: string | null; senderEmail?: string | null; senderDisplayName?: string | null }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    update mail_messages
    set
      recipient_user_id = ${input.recipientUserId},
      sender_mail_account_id = ${input.senderMailAccountId ?? null},
      sender_mail_alias_id = ${input.senderMailAliasId ?? null},
      sender_email = ${input.senderEmail ?? null},
      sender_display_name = ${input.senderDisplayName ?? null},
      subject = ${input.subject},
      body = ${input.body},
      importance = ${input.importance},
      updated_at = now()
    where id = ${input.id}
      and company_id = ${input.companyId}
      and sender_user_id = ${input.senderUserId}
      and status = 'draft'
      and deleted_at is null
      and (
        ${input.recipientUserId}::text is null
        or exists (
          select 1 from users recipient
          where recipient.id = ${input.recipientUserId}
            and recipient.company_id = ${input.companyId}
            and recipient.status = 'active'
            and recipient.deleted_at is null
        )
      )
    returning
      mail_messages.id,
      mail_messages.company_id,
      mail_messages.sender_user_id,
      (select coalesce(sender.display_name, sender.login_id, '알 수 없음') from users sender where sender.id = mail_messages.sender_user_id) as sender_name,
      mail_messages.sender_mail_account_id,
      mail_messages.sender_mail_alias_id,
      mail_messages.sender_email,
      mail_messages.sender_display_name,
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
