create table if not exists messenger_rooms (
  company_id text not null,
  id text not null,
  room_type text not null,
  room_name text not null,
  description text,
  is_external boolean not null default false,
  status text not null default 'active',
  created_by text,
  last_message_id text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  constraint messenger_rooms_company_fk foreign key (company_id) references companies(id) on delete cascade,
  constraint messenger_rooms_status_check check (status in ('active', 'inactive', 'archived', 'deleted', 'locked')),
  constraint messenger_rooms_type_check check (room_type in ('direct', 'group', 'department', 'project', 'site', 'notice', 'approval', 'system', 'bot', 'external'))
);

create index if not exists idx_messenger_rooms_company_status
  on messenger_rooms(company_id, status, updated_at desc);

create table if not exists messenger_room_members (
  company_id text not null,
  room_id text not null,
  user_id text not null,
  member_role text not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  is_active boolean not null default true,
  last_read_message_id text,
  last_read_at timestamptz,
  unread_count integer not null default 0,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, room_id, user_id),
  constraint messenger_room_members_room_fk foreign key (company_id, room_id) references messenger_rooms(company_id, id) on delete cascade,
  constraint messenger_room_members_user_fk foreign key (user_id) references users(id) on delete cascade,
  constraint messenger_room_members_role_check check (member_role in ('owner', 'manager', 'member', 'readonly', 'guest', 'bot')),
  constraint messenger_room_members_unread_check check (unread_count >= 0)
);

create index if not exists idx_messenger_room_members_user_active
  on messenger_room_members(company_id, user_id, updated_at desc)
  where is_active is true and left_at is null;

create table if not exists messenger_messages (
  company_id text not null,
  id text not null,
  room_id text not null,
  sender_id text,
  message_type text not null default 'text',
  body text,
  reply_to_message_id text,
  sequence_no bigint not null,
  status text not null default 'sent',
  edited boolean not null default false,
  deleted boolean not null default false,
  deleted_by text,
  deleted_at timestamptz,
  client_sent_at timestamptz,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  constraint messenger_messages_room_fk foreign key (company_id, room_id) references messenger_rooms(company_id, id) on delete cascade,
  constraint messenger_messages_sender_fk foreign key (sender_id) references users(id) on delete set null,
  constraint messenger_messages_type_check check (message_type in ('text', 'system', 'notice', 'bot_response', 'bot_status', 'bot_error')),
  constraint messenger_messages_status_check check (status in ('draft', 'sending', 'sent', 'delivered', 'read', 'failed', 'deleted', 'hidden', 'blocked', 'edited', 'pinned'))
);

create unique index if not exists uq_messenger_messages_room_sequence
  on messenger_messages(company_id, room_id, sequence_no);

create index if not exists idx_messenger_messages_room_sequence
  on messenger_messages(company_id, room_id, sequence_no desc);

create table if not exists messenger_message_reads (
  company_id text not null,
  message_id text not null,
  room_id text not null,
  user_id text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (company_id, message_id, user_id),
  constraint messenger_message_reads_message_fk foreign key (company_id, message_id) references messenger_messages(company_id, id) on delete cascade,
  constraint messenger_message_reads_room_fk foreign key (company_id, room_id) references messenger_rooms(company_id, id) on delete cascade,
  constraint messenger_message_reads_user_fk foreign key (user_id) references users(id) on delete cascade
);

create table if not exists messenger_audit_logs (
  id bigserial primary key,
  company_id text not null,
  actor_id text,
  action text not null,
  target_type text not null,
  target_id text,
  room_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  constraint messenger_audit_logs_company_fk foreign key (company_id) references companies(id) on delete cascade
);

create index if not exists idx_messenger_audit_logs_company_created
  on messenger_audit_logs(company_id, created_at desc);
