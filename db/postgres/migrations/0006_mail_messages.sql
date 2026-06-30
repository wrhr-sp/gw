begin;

create table if not exists mail_messages (
  id text primary key,
  company_id text not null references companies(id),
  sender_user_id text not null references users(id),
  recipient_user_id text references users(id),
  subject text not null,
  body text not null,
  status text not null default 'sent',
  importance text not null default 'normal',
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_mail_messages_inbox on mail_messages (company_id, recipient_user_id, sent_at desc, updated_at desc);
create index if not exists idx_mail_messages_sent on mail_messages (company_id, sender_user_id, sent_at desc, updated_at desc);
create index if not exists idx_mail_messages_status on mail_messages (company_id, status, updated_at desc);

commit;
