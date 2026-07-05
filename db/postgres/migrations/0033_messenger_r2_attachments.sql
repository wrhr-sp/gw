-- Messenger R2-backed attachments

create table if not exists messenger_attachments (
  company_id text not null,
  id text not null,
  room_id text not null,
  message_id text null,
  file_name text not null,
  content_type text not null,
  file_size bigint not null,
  storage_provider text not null default 'r2',
  storage_status text not null default 'pending',
  object_key text null,
  checksum_sha256 text null,
  upload_token text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  primary key (company_id, id),
  foreign key (company_id, room_id) references messenger_rooms(company_id, id) on delete cascade,
  foreign key (company_id, message_id) references messenger_messages(company_id, id) on delete set null,
  constraint messenger_attachments_storage_provider_check check (storage_provider in ('r2')),
  constraint messenger_attachments_storage_status_check check (storage_status in ('pending', 'uploaded', 'deleted')),
  constraint messenger_attachments_checksum_check check (checksum_sha256 is null or checksum_sha256 ~* '^[a-f0-9]{64}$')
);

create index if not exists idx_messenger_attachments_room
  on messenger_attachments(company_id, room_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_messenger_attachments_message
  on messenger_attachments(company_id, message_id)
  where deleted_at is null;
