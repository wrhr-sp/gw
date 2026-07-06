import { getDbClient, type DatabaseEnv } from "../utils/db";
import { createOperationalNotification } from "./operational-notifications";

type MessengerNotificationKind = "messenger_mention" | "messenger_message";

type RoomType = "direct" | "group" | "department" | "project" | "site" | "notice" | "approval" | "system" | "bot" | "external";
type MessageType = "text" | "system" | "notice" | "bot_response" | "bot_status" | "bot_error";

function toIso(value: Date | string | null | undefined) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRoom(row: Record<string, any>) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    roomType: row.room_type as RoomType,
    roomName: String(row.room_name),
    description: row.description == null ? null : String(row.description),
    isExternal: Boolean(row.is_external),
    status: row.status as "active" | "inactive" | "archived" | "deleted" | "locked",
    memberCount: Number(row.member_count ?? 0),
    unreadCount: Number(row.unread_count ?? 0),
    mentionUnreadCount: Number(row.mention_unread_count ?? 0),
    hasUnreadMentions: Number(row.mention_unread_count ?? 0) > 0,
    lastReadAt: toIso(row.last_read_at),
    lastMessageId: row.last_message_id == null ? null : String(row.last_message_id),
    lastMessageBody: row.last_message_body == null ? null : String(row.last_message_body),
    lastMessageAt: toIso(row.last_message_at),
    createdBy: row.created_by == null ? null : String(row.created_by),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapMember(row: Record<string, any>) {
  return {
    roomId: String(row.room_id),
    userId: String(row.user_id),
    memberRole: row.member_role as "owner" | "manager" | "member" | "readonly" | "guest" | "bot",
    isActive: Boolean(row.is_active),
    joinedAt: toIso(row.joined_at) ?? new Date().toISOString(),
    leftAt: toIso(row.left_at),
    lastReadMessageId: row.last_read_message_id == null ? null : String(row.last_read_message_id),
    lastReadAt: toIso(row.last_read_at),
    unreadCount: Number(row.unread_count ?? 0),
    muted: Boolean(row.muted),
  };
}

function parseJsonArray(row: Record<string, any>, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapAttachment(row: Record<string, any>) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    roomId: String(row.room_id),
    messageId: row.message_id == null ? null : String(row.message_id),
    fileName: String(row.file_name),
    contentType: String(row.content_type),
    fileSize: Number(row.file_size ?? 0),
    storageProvider: "r2" as const,
    storageStatus: row.storage_status as "pending" | "uploaded" | "deleted",
    checksumSha256: row.checksum_sha256 == null ? null : String(row.checksum_sha256),
    createdBy: String(row.created_by),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function parseMentions(row: Record<string, any>) {
  return parseJsonArray(row, "mentions");
}

function normalizePreferenceObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isMessengerNotificationPreferenceEnabled(preferences: Record<string, unknown>, kind: MessengerNotificationKind) {
  const notificationPreferences = normalizePreferenceObject(preferences.notificationPreferences);
  if (kind === "messenger_mention") {
    return notificationPreferences.mentions !== false;
  }
  return notificationPreferences.mail !== false;
}

async function shouldCreateMessengerNotification(
  sql: ReturnType<typeof getDbClient>,
  input: { companyId: string; userId: string; kind: MessengerNotificationKind },
) {
  const rows = await sql`
    select preferences
    from user_preferences
    where company_id = ${input.companyId}
      and user_id = ${input.userId}
    limit 1
  `;
  const row = rows[0] as { preferences?: unknown } | undefined;
  return isMessengerNotificationPreferenceEnabled(normalizePreferenceObject(row?.preferences), input.kind);
}

function mapMessage(row: Record<string, any>) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    roomId: String(row.room_id),
    senderId: row.sender_id == null ? null : String(row.sender_id),
    senderName: row.sender_name == null ? null : String(row.sender_name),
    messageType: row.message_type as MessageType,
    body: row.body == null ? null : String(row.body),
    replyToMessageId: row.reply_to_message_id == null ? null : String(row.reply_to_message_id),
    sequenceNo: Number(row.sequence_no ?? 0),
    status: row.status as "draft" | "sending" | "sent" | "delivered" | "read" | "failed" | "deleted" | "hidden" | "blocked" | "edited" | "pinned",
    edited: Boolean(row.edited),
    deleted: Boolean(row.deleted),
    readCount: Number(row.read_count ?? 0),
    mentions: parseMentions(row),
    attachments: parseJsonArray(row, "attachments"),
    sentAt: toIso(row.sent_at) ?? new Date().toISOString(),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function canManageMembers(role: string | undefined) {
  return role === "owner" || role === "manager";
}

function canSendMessage(role: string | undefined) {
  return role === "owner" || role === "manager" || role === "member" || role === "guest" || role === "bot";
}

async function assertActiveMember(sql: ReturnType<typeof getDbClient>, input: { companyId: string; roomId: string; userId: string }) {
  const rows = await sql`
    select member_role
    from messenger_room_members
    where company_id = ${input.companyId}
      and room_id = ${input.roomId}
      and user_id = ${input.userId}
      and is_active is true
      and left_at is null
    limit 1
  `;
  return rows[0] ?? null;
}

async function getRoomForMember(sql: ReturnType<typeof getDbClient>, input: { companyId: string; roomId: string; userId: string }) {
  const rows = await sql`
    select
      r.*,
      coalesce(member_counts.member_count, 0) as member_count,
      coalesce(me.unread_count, 0) as unread_count,
      me.last_read_at as last_read_at,
      coalesce(unread_mentions.mention_unread_count, 0) as mention_unread_count,
      last_message.body as last_message_body
    from messenger_rooms r
    join messenger_room_members me
      on me.company_id = r.company_id
     and me.room_id = r.id
     and me.user_id = ${input.userId}
     and me.is_active is true
     and me.left_at is null
    left join lateral (
      select count(*)::int as member_count
      from messenger_room_members m
      where m.company_id = r.company_id
        and m.room_id = r.id
        and m.is_active is true
        and m.left_at is null
    ) member_counts on true
    left join lateral (
      select count(*)::int as mention_unread_count
      from messenger_message_mentions mm
      join messenger_messages msg
        on msg.company_id = mm.company_id
       and msg.id = mm.message_id
       and msg.room_id = r.id
      where mm.company_id = r.company_id
        and mm.room_id = r.id
        and mm.mentioned_user_id = ${input.userId}
        and msg.sender_id <> ${input.userId}
        and msg.deleted is false
        and msg.status <> 'hidden'
        and (me.last_read_at is null or msg.sent_at > me.last_read_at)
    ) unread_mentions on true
    left join messenger_messages last_message
      on last_message.company_id = r.company_id
     and last_message.id = r.last_message_id
    where r.company_id = ${input.companyId}
      and r.id = ${input.roomId}
      and r.status = 'active'
    limit 1
  `;
  return rows[0] ? mapRoom(rows[0]) : null;
}

export async function listOperationalMessengerRooms(env: DatabaseEnv | undefined, input: { companyId: string; userId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select
      r.*,
      coalesce(member_counts.member_count, 0) as member_count,
      coalesce(me.unread_count, 0) as unread_count,
      me.last_read_at as last_read_at,
      coalesce(unread_mentions.mention_unread_count, 0) as mention_unread_count,
      last_message.body as last_message_body
    from messenger_rooms r
    join messenger_room_members me
      on me.company_id = r.company_id
     and me.room_id = r.id
     and me.user_id = ${input.userId}
     and me.is_active is true
     and me.left_at is null
    left join lateral (
      select count(*)::int as member_count
      from messenger_room_members m
      where m.company_id = r.company_id
        and m.room_id = r.id
        and m.is_active is true
        and m.left_at is null
    ) member_counts on true
    left join lateral (
      select count(*)::int as mention_unread_count
      from messenger_message_mentions mm
      join messenger_messages msg
        on msg.company_id = mm.company_id
       and msg.id = mm.message_id
       and msg.room_id = r.id
      where mm.company_id = r.company_id
        and mm.room_id = r.id
        and mm.mentioned_user_id = ${input.userId}
        and msg.sender_id <> ${input.userId}
        and msg.deleted is false
        and msg.status <> 'hidden'
        and (me.last_read_at is null or msg.sent_at > me.last_read_at)
    ) unread_mentions on true
    left join messenger_messages last_message
      on last_message.company_id = r.company_id
     and last_message.id = r.last_message_id
    where r.company_id = ${input.companyId}
      and r.status = 'active'
    order by coalesce(r.last_message_at, r.updated_at, r.created_at) desc
    limit 100
  `;
  return rows.map(mapRoom);
}

export async function createOperationalMessengerRoom(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; roomId: string; roomType: RoomType; roomName: string; description?: string; memberIds: string[]; isExternal: boolean },
) {
  const sql = getDbClient(env ?? {});
  const memberIds = Array.from(new Set([input.userId, ...input.memberIds]));
  const roomRows = await sql`
    insert into messenger_rooms (
      company_id, id, room_type, room_name, description, is_external, status, created_by, created_at, updated_at
    ) values (
      ${input.companyId}, ${input.roomId}, ${input.roomType}, ${input.roomName}, ${input.description ?? null}, ${input.isExternal}, 'active', ${input.userId}, now(), now()
    )
    returning *
  `;

  for (const memberId of memberIds) {
    await sql`
      insert into messenger_room_members (
        company_id, room_id, user_id, member_role, joined_at, is_active, created_at, updated_at
      ) values (
        ${input.companyId}, ${input.roomId}, ${memberId}, ${memberId === input.userId ? "owner" : "member"}, now(), true, now(), now()
      )
      on conflict (company_id, room_id, user_id)
      do update set is_active = true, left_at = null, updated_at = now()
    `;
  }

  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_ROOM_CREATE', 'messenger_room', ${input.roomId}, ${input.roomId}, ${JSON.stringify({ roomType: input.roomType, memberCount: memberIds.length })}, now())
  `;

  const members = await sql`
    select *
    from messenger_room_members
    where company_id = ${input.companyId}
      and room_id = ${input.roomId}
    order by joined_at asc
  `;

  return {
    room: mapRoom({ ...roomRows[0], member_count: memberIds.length, unread_count: 0, last_message_body: null }),
    members: members.map(mapMember),
  };
}


export async function getOperationalMessengerRoomDetail(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; roomId: string }) {
  const sql = getDbClient(env ?? {});
  const member = await assertActiveMember(sql, input);
  if (!member) return null;
  const room = await getRoomForMember(sql, input);
  if (!room) return null;
  const members = await sql`
    select *
    from messenger_room_members
    where company_id = ${input.companyId}
      and room_id = ${input.roomId}
      and is_active is true
      and left_at is null
    order by case member_role when 'owner' then 1 when 'manager' then 2 when 'member' then 3 when 'readonly' then 4 when 'guest' then 5 else 6 end, joined_at asc
  `;
  return { room, members: members.map(mapMember), currentMemberRole: String(member.member_role) as "owner" | "manager" | "member" | "readonly" | "guest" | "bot" };
}

export async function listOperationalMessengerRoomMembers(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; roomId: string }) {
  const detail = await getOperationalMessengerRoomDetail(env, input);
  return detail ? { room: detail.room, members: detail.members } : null;
}

export async function inviteOperationalMessengerRoomMembers(
  env: DatabaseEnv | undefined,
  input: { companyId: string; actorId: string; roomId: string; userIds: string[]; memberRole: "owner" | "manager" | "member" | "readonly" | "guest" | "bot" },
) {
  const sql = getDbClient(env ?? {});
  const actor = await assertActiveMember(sql, { companyId: input.companyId, roomId: input.roomId, userId: input.actorId });
  if (!actor || !canManageMembers(String(actor.member_role))) return null;
  const roomRows = await sql`
    select status
    from messenger_rooms
    where company_id = ${input.companyId} and id = ${input.roomId}
    limit 1
  `;
  if (!roomRows[0] || roomRows[0].status !== "active") return null;
  const uniqueUserIds = Array.from(new Set(input.userIds)).filter((userId) => userId !== input.actorId);
  const changed: Record<string, any>[] = [];
  for (const userId of uniqueUserIds) {
    const userRows = await sql`select id from users where company_id = ${input.companyId} and id = ${userId} and status = 'active' and deleted_at is null limit 1`;
    if (!userRows[0]) continue;
    const rows = await sql`
      insert into messenger_room_members (company_id, room_id, user_id, member_role, joined_at, is_active, created_at, updated_at)
      values (${input.companyId}, ${input.roomId}, ${userId}, ${input.memberRole}, now(), true, now(), now())
      on conflict (company_id, room_id, user_id)
      do update set member_role = excluded.member_role, is_active = true, left_at = null, updated_at = now()
      returning *
    `;
    if (rows[0]) changed.push(rows[0]);
  }
  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.actorId}, 'MESSENGER_ROOM_MEMBER_INVITE', 'messenger_room', ${input.roomId}, ${input.roomId}, ${JSON.stringify({ userIds: uniqueUserIds, memberRole: input.memberRole })}, now())
  `;
  return { roomId: input.roomId, members: changed.map(mapMember) };
}

export async function removeOperationalMessengerRoomMember(
  env: DatabaseEnv | undefined,
  input: { companyId: string; actorId: string; roomId: string; userId: string; reason?: string },
) {
  const sql = getDbClient(env ?? {});
  const actor = await assertActiveMember(sql, { companyId: input.companyId, roomId: input.roomId, userId: input.actorId });
  if (!actor || !canManageMembers(String(actor.member_role))) return null;
  if (input.userId === input.actorId) return null;
  const targetRows = await sql`
    update messenger_room_members
    set is_active = false, left_at = now(), updated_at = now()
    where company_id = ${input.companyId}
      and room_id = ${input.roomId}
      and user_id = ${input.userId}
      and is_active is true
      and left_at is null
    returning *
  `;
  if (!targetRows[0]) return null;
  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.actorId}, 'MESSENGER_ROOM_MEMBER_REMOVE', 'messenger_room_member', ${input.userId}, ${input.roomId}, ${JSON.stringify({ removedUserId: input.userId, reason: input.reason ?? null })}, now())
  `;
  return { roomId: input.roomId, members: [mapMember(targetRows[0])] };
}


export async function createOperationalMessengerAttachment(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; roomId: string; attachmentId: string; fileName: string; contentType: string; fileSize: number },
) {
  const sql = getDbClient(env ?? {});
  const member = await assertActiveMember(sql, input);
  if (!member || !canSendMessage(String(member.member_role))) return null;
  const uploadToken = `upload_token_${input.attachmentId}_v1`;
  const rows = await sql`
    insert into messenger_attachments (company_id, id, room_id, file_name, content_type, file_size, storage_provider, storage_status, upload_token, created_by, created_at, updated_at)
    values (${input.companyId}, ${input.attachmentId}, ${input.roomId}, ${input.fileName}, ${input.contentType}, ${input.fileSize}, 'r2', 'pending', ${uploadToken}, ${input.userId}, now(), now())
    returning *
  `;
  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_ATTACHMENT_INIT', 'messenger_attachment', ${input.attachmentId}, ${input.roomId}, ${JSON.stringify({ fileName: input.fileName, fileSize: input.fileSize })}, now())
  `;
  return { attachment: mapAttachment(rows[0]), uploadToken };
}

export async function completeOperationalMessengerAttachmentUpload(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; attachmentId: string; uploadToken: string; checksumSha256?: string; objectKey: string },
) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select * from messenger_attachments
    where company_id = ${input.companyId} and id = ${input.attachmentId} and upload_token = ${input.uploadToken} and deleted_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const member = await assertActiveMember(sql, { companyId: input.companyId, roomId: String(row.room_id), userId: input.userId });
  if (!member || !canSendMessage(String(member.member_role))) return null;
  const updated = await sql`
    update messenger_attachments
    set storage_status = 'uploaded', object_key = ${input.objectKey}, checksum_sha256 = ${input.checksumSha256 ?? null}, updated_at = now()
    where company_id = ${input.companyId} and id = ${input.attachmentId}
    returning *
  `;
  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_ATTACHMENT_UPLOAD_COMPLETE', 'messenger_attachment', ${input.attachmentId}, ${String(row.room_id)}, ${JSON.stringify({ checksumSha256: input.checksumSha256 ?? null })}, now())
  `;
  return mapAttachment(updated[0]);
}

export async function getOperationalMessengerAttachmentForDownload(env: DatabaseEnv | undefined, input: { companyId: string; userId: string; attachmentId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select * from messenger_attachments
    where company_id = ${input.companyId} and id = ${input.attachmentId} and storage_status = 'uploaded' and deleted_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const member = await assertActiveMember(sql, { companyId: input.companyId, roomId: String(row.room_id), userId: input.userId });
  if (!member) return null;
  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_ATTACHMENT_DOWNLOAD', 'messenger_attachment', ${input.attachmentId}, ${String(row.room_id)}, ${JSON.stringify({ fileName: String(row.file_name) })}, now())
  `;
  return mapAttachment(row);
}

export async function listOperationalMessengerMessages(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; roomId: string; limit: number; beforeSequenceNo?: number },
) {
  const sql = getDbClient(env ?? {});
  const room = await getRoomForMember(sql, input);
  if (!room) return null;

  const rows = input.beforeSequenceNo
    ? await sql`
        select msg.*, coalesce(sender.display_name, sender.email, msg.sender_id) as sender_name, coalesce(reads.read_count, 0) as read_count, coalesce(attachments.attachments, '[]'::json) as attachments
        from messenger_messages msg
        left join users sender on sender.id = msg.sender_id
        left join lateral (
          select json_agg(json_build_object('id', a.id, 'companyId', a.company_id, 'roomId', a.room_id, 'messageId', a.message_id, 'fileName', a.file_name, 'contentType', a.content_type, 'fileSize', a.file_size, 'storageProvider', a.storage_provider, 'storageStatus', a.storage_status, 'checksumSha256', a.checksum_sha256, 'createdBy', a.created_by, 'createdAt', a.created_at, 'updatedAt', a.updated_at)) as attachments
          from messenger_attachments a
          where a.company_id = msg.company_id and a.message_id = msg.id and a.deleted_at is null
        ) attachments on true
        left join lateral (
          select count(*)::int as read_count
          from messenger_message_reads r
          where r.company_id = msg.company_id and r.message_id = msg.id
        ) reads on true
        where msg.company_id = ${input.companyId}
          and msg.room_id = ${input.roomId}
          and msg.sequence_no < ${input.beforeSequenceNo}
          and msg.deleted is false
          and msg.status <> 'hidden'
        order by msg.sequence_no desc
        limit ${input.limit + 1}
      `
    : await sql`
        select msg.*, coalesce(sender.display_name, sender.email, msg.sender_id) as sender_name, coalesce(reads.read_count, 0) as read_count, coalesce(attachments.attachments, '[]'::json) as attachments
        from messenger_messages msg
        left join users sender on sender.id = msg.sender_id
        left join lateral (
          select json_agg(json_build_object('id', a.id, 'companyId', a.company_id, 'roomId', a.room_id, 'messageId', a.message_id, 'fileName', a.file_name, 'contentType', a.content_type, 'fileSize', a.file_size, 'storageProvider', a.storage_provider, 'storageStatus', a.storage_status, 'checksumSha256', a.checksum_sha256, 'createdBy', a.created_by, 'createdAt', a.created_at, 'updatedAt', a.updated_at)) as attachments
          from messenger_attachments a
          where a.company_id = msg.company_id and a.message_id = msg.id and a.deleted_at is null
        ) attachments on true
        left join lateral (
          select count(*)::int as read_count
          from messenger_message_reads r
          where r.company_id = msg.company_id and r.message_id = msg.id
        ) reads on true
        where msg.company_id = ${input.companyId}
          and msg.room_id = ${input.roomId}
          and msg.deleted is false
          and msg.status <> 'hidden'
        order by msg.sequence_no desc
        limit ${input.limit + 1}
      `;

  return {
    room,
    messages: rows.slice(0, input.limit).reverse().map(mapMessage),
    hasMore: rows.length > input.limit,
  };
}

export async function sendOperationalMessengerMessage(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; roomId: string; messageId: string; messageType: MessageType; body?: string; replyToMessageId?: string | null; mentionUserIds?: string[]; attachmentIds?: string[] },
) {
  const sql = getDbClient(env ?? {});
  const member = await assertActiveMember(sql, input);
  if (!member || !canSendMessage(String(member.member_role))) return null;

  const roomRows = await sql`
    select status
    from messenger_rooms
    where company_id = ${input.companyId}
      and id = ${input.roomId}
    limit 1
  `;
  if (!roomRows[0] || roomRows[0].status !== "active") return null;

  const sequenceRows = await sql`
    select coalesce(max(sequence_no), 0)::bigint + 1 as next_sequence_no
    from messenger_messages
    where company_id = ${input.companyId}
      and room_id = ${input.roomId}
  `;
  const sequenceNo = Number(sequenceRows[0]?.next_sequence_no ?? 1);

  const messageRows = await sql`
    insert into messenger_messages (
      company_id, id, room_id, sender_id, message_type, body, reply_to_message_id, sequence_no, status, sent_at, created_at, updated_at
    ) values (
      ${input.companyId}, ${input.messageId}, ${input.roomId}, ${input.userId}, ${input.messageType}, ${input.body ?? null}, ${input.replyToMessageId ?? null}, ${sequenceNo}, 'sent', now(), now(), now()
    )
    returning *
  `;

  const mentionUserIds = Array.from(new Set(input.mentionUserIds ?? []));
  for (const mentionedUserId of mentionUserIds) {
    const mentionMember = await assertActiveMember(sql, { companyId: input.companyId, roomId: input.roomId, userId: mentionedUserId });
    if (!mentionMember) continue;
    await sql`
      insert into messenger_message_mentions (company_id, room_id, message_id, mentioned_user_id, created_at)
      values (${input.companyId}, ${input.roomId}, ${input.messageId}, ${mentionedUserId}, now())
      on conflict (company_id, message_id, mentioned_user_id) do nothing
    `;
  }

  await sql`
    insert into messenger_message_reads (company_id, message_id, room_id, user_id, read_at, created_at)
    values (${input.companyId}, ${input.messageId}, ${input.roomId}, ${input.userId}, now(), now())
    on conflict (company_id, message_id, user_id)
    do update set read_at = excluded.read_at
  `;

  await sql`
    update messenger_room_members
    set unread_count = case when user_id = ${input.userId} then unread_count else unread_count + 1 end,
        updated_at = now()
    where company_id = ${input.companyId}
      and room_id = ${input.roomId}
      and is_active is true
      and left_at is null
  `;

  await sql`
    update messenger_rooms
    set last_message_id = ${input.messageId}, last_message_at = now(), updated_at = now()
    where company_id = ${input.companyId}
      and id = ${input.roomId}
  `;

  const recipientRows = await sql`
    select user_id
    from messenger_room_members
    where company_id = ${input.companyId}
      and room_id = ${input.roomId}
      and user_id <> ${input.userId}
      and is_active is true
      and left_at is null
  `;
  const mentionSet = new Set(mentionUserIds);
  for (const recipient of recipientRows as Array<{ user_id: string }>) {
    const recipientId = String(recipient.user_id);
    const mentioned = mentionSet.has(recipientId);
    const notificationType: MessengerNotificationKind = mentioned ? "messenger_mention" : "messenger_message";
    const preferenceEnabled = await shouldCreateMessengerNotification(sql, { companyId: input.companyId, userId: recipientId, kind: notificationType });
    if (!preferenceEnabled) continue;
    await createOperationalNotification(env, {
      companyId: input.companyId,
      userId: recipientId,
      title: mentioned ? "메신저 멘션" : "새 메신저 메시지",
      body: mentioned ? `${input.roomId} 대화방에서 나를 멘션했습니다.` : `${input.roomId} 대화방에 새 메시지가 도착했습니다.`,
      notificationType,
      notificationId: `notification_${input.companyId}_${recipientId}_${input.messageId}_${mentioned ? "mention" : "message"}`,
    });
  }

  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_MESSAGE_SEND', 'messenger_message', ${input.messageId}, ${input.roomId}, ${JSON.stringify({ messageType: input.messageType, dbSavedBeforeEvent: true, mentionUserIds })}, now())
  `;

  return mapMessage({
    ...messageRows[0],
    sender_name: input.userId,
    read_count: 1,
    mentions: mentionUserIds.map((userId) => ({ userId, displayName: null })),
  });
}

export async function searchOperationalMessengerMessages(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; query: string; roomId?: string; limit: number },
) {
  const sql = getDbClient(env ?? {});
  const query = input.query.trim();
  if (!query) return { query, roomId: input.roomId ?? null, messages: [] };
  if (input.roomId) {
    const member = await assertActiveMember(sql, { companyId: input.companyId, roomId: input.roomId, userId: input.userId });
    if (!member) return null;
  }
  const likeQuery = `%${query.replace(/%/g, "\%").replace(/_/g, "\_")}%`;
  const rows = input.roomId
    ? await sql`
        select msg.*, coalesce(sender.display_name, sender.email, msg.sender_id) as sender_name, coalesce(reads.read_count, 0) as read_count,
          coalesce(mentions.mentions, '[]'::json) as mentions
        from messenger_messages msg
        join messenger_room_members me
          on me.company_id = msg.company_id
         and me.room_id = msg.room_id
         and me.user_id = ${input.userId}
         and me.is_active is true
         and me.left_at is null
        left join users sender on sender.id = msg.sender_id
        left join lateral (
          select json_agg(json_build_object('id', a.id, 'companyId', a.company_id, 'roomId', a.room_id, 'messageId', a.message_id, 'fileName', a.file_name, 'contentType', a.content_type, 'fileSize', a.file_size, 'storageProvider', a.storage_provider, 'storageStatus', a.storage_status, 'checksumSha256', a.checksum_sha256, 'createdBy', a.created_by, 'createdAt', a.created_at, 'updatedAt', a.updated_at)) as attachments
          from messenger_attachments a
          where a.company_id = msg.company_id and a.message_id = msg.id and a.deleted_at is null
        ) attachments on true
        left join lateral (select count(*)::int as read_count from messenger_message_reads r where r.company_id = msg.company_id and r.message_id = msg.id) reads on true
        left join lateral (
          select json_agg(json_build_object('userId', mm.mentioned_user_id, 'displayName', coalesce(u.display_name, u.email))) as mentions
          from messenger_message_mentions mm
          left join users u on u.company_id = mm.company_id and u.id = mm.mentioned_user_id
          where mm.company_id = msg.company_id and mm.message_id = msg.id
        ) mentions on true
        where msg.company_id = ${input.companyId}
          and msg.room_id = ${input.roomId}
          and msg.deleted is false
          and msg.status <> 'hidden'
          and msg.body ilike ${likeQuery}
        order by msg.sent_at desc
        limit ${input.limit}
      `
    : await sql`
        select msg.*, coalesce(sender.display_name, sender.email, msg.sender_id) as sender_name, coalesce(reads.read_count, 0) as read_count,
          coalesce(mentions.mentions, '[]'::json) as mentions
        from messenger_messages msg
        join messenger_room_members me
          on me.company_id = msg.company_id
         and me.room_id = msg.room_id
         and me.user_id = ${input.userId}
         and me.is_active is true
         and me.left_at is null
        left join users sender on sender.id = msg.sender_id
        left join lateral (
          select json_agg(json_build_object('id', a.id, 'companyId', a.company_id, 'roomId', a.room_id, 'messageId', a.message_id, 'fileName', a.file_name, 'contentType', a.content_type, 'fileSize', a.file_size, 'storageProvider', a.storage_provider, 'storageStatus', a.storage_status, 'checksumSha256', a.checksum_sha256, 'createdBy', a.created_by, 'createdAt', a.created_at, 'updatedAt', a.updated_at)) as attachments
          from messenger_attachments a
          where a.company_id = msg.company_id and a.message_id = msg.id and a.deleted_at is null
        ) attachments on true
        left join lateral (select count(*)::int as read_count from messenger_message_reads r where r.company_id = msg.company_id and r.message_id = msg.id) reads on true
        left join lateral (
          select json_agg(json_build_object('userId', mm.mentioned_user_id, 'displayName', coalesce(u.display_name, u.email))) as mentions
          from messenger_message_mentions mm
          left join users u on u.company_id = mm.company_id and u.id = mm.mentioned_user_id
          where mm.company_id = msg.company_id and mm.message_id = msg.id
        ) mentions on true
        where msg.company_id = ${input.companyId}
          and msg.deleted is false
          and msg.status <> 'hidden'
          and msg.body ilike ${likeQuery}
        order by msg.sent_at desc
        limit ${input.limit}
      `;
  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_MESSAGE_SEARCH', 'messenger_message', ${input.roomId ?? 'all'}, ${input.roomId ?? null}, ${JSON.stringify({ queryLength: query.length, roomScoped: Boolean(input.roomId) })}, now())
  `;
  return { query, roomId: input.roomId ?? null, messages: rows.map(mapMessage) };
}

export async function markOperationalMessengerMessageRead(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; messageId: string },
) {
  const sql = getDbClient(env ?? {});
  const messageRows = await sql`
    select id, room_id
    from messenger_messages
    where company_id = ${input.companyId}
      and id = ${input.messageId}
      and deleted is false
    limit 1
  `;
  const message = messageRows[0] as { id: string; room_id: string } | undefined;
  if (!message) return null;

  const member = await assertActiveMember(sql, { companyId: input.companyId, roomId: message.room_id, userId: input.userId });
  if (!member) return null;

  const readRows = await sql`
    insert into messenger_message_reads (company_id, message_id, room_id, user_id, read_at, created_at)
    values (${input.companyId}, ${input.messageId}, ${message.room_id}, ${input.userId}, now(), now())
    on conflict (company_id, message_id, user_id)
    do update set read_at = excluded.read_at
    returning read_at
  `;

  await sql`
    update messenger_room_members
    set last_read_message_id = ${input.messageId}, last_read_at = now(), unread_count = 0, updated_at = now()
    where company_id = ${input.companyId}
      and room_id = ${message.room_id}
      and user_id = ${input.userId}
  `;

  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_MESSAGE_READ', 'messenger_message', ${input.messageId}, ${message.room_id}, ${JSON.stringify({ read: true })}, now())
  `;

  return {
    messageId: input.messageId,
    roomId: message.room_id,
    readAt: toIso(readRows[0]?.read_at) ?? new Date().toISOString(),
    unreadCount: 0,
  };
}

export async function leaveOperationalMessengerThread(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; threadId: string },
) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into messenger_thread_members (
      company_id,
      thread_id,
      user_id,
      left_at,
      created_at,
      updated_at
    ) values (
      ${input.companyId},
      ${input.threadId},
      ${input.userId},
      now(),
      now(),
      now()
    )
    on conflict (company_id, thread_id, user_id)
    do update set
      left_at = excluded.left_at,
      updated_at = excluded.updated_at
    returning thread_id, left_at
  `;

  await sql`
    update messenger_room_members
    set is_active = false, left_at = now(), updated_at = now()
    where company_id = ${input.companyId}
      and room_id = ${input.threadId}
      and user_id = ${input.userId}
  `;

  await sql`
    insert into messenger_audit_logs (company_id, actor_id, action, target_type, target_id, room_id, after_data, created_at)
    values (${input.companyId}, ${input.userId}, 'MESSENGER_ROOM_LEAVE', 'messenger_room', ${input.threadId}, ${input.threadId}, ${JSON.stringify({ left: true })}, now())
  `;

  const row = rows[0] as { thread_id: string; left_at: Date | string } | undefined;
  if (!row) {
    return null;
  }

  const leftAt = row.left_at instanceof Date ? row.left_at.toISOString() : new Date(row.left_at).toISOString();
  return {
    threadId: row.thread_id,
    left: true as const,
    leftAt,
    source: "postgres" as const,
  };
}
