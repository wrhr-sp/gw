begin;

create table if not exists mail_attachments (
  id text primary key,
  company_id text not null references companies(id),
  message_id text not null references mail_messages(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  file_size integer not null default 0,
  object_key text not null,
  uploaded_by text not null references users(id),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_mail_attachments_message on mail_attachments (company_id, message_id, uploaded_at desc);
create unique index if not exists idx_mail_attachments_object_key on mail_attachments (object_key);

commit;
