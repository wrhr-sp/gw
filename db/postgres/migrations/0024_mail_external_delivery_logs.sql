begin;

create table if not exists mail_external_delivery_logs (
  id text primary key,
  company_id text not null references companies(id),
  message_id text references mail_messages(id) on delete set null,
  sender_user_id text not null references users(id),
  recipient_type text not null check (recipient_type in ('to', 'cc')),
  recipient_email text not null,
  provider_kind text not null check (provider_kind in ('smtp', 'api', 'unconfigured')),
  provider_name text not null default 'unconfigured',
  status text not null check (status in ('blocked', 'pending', 'sent', 'failed')),
  error_code text,
  error_message text,
  provider_message_id text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_mail_external_delivery_logs_company_status on mail_external_delivery_logs (company_id, status, attempted_at desc);
create index if not exists idx_mail_external_delivery_logs_message on mail_external_delivery_logs (company_id, message_id, attempted_at desc);
create index if not exists idx_mail_external_delivery_logs_recipient on mail_external_delivery_logs (company_id, lower(recipient_email), attempted_at desc);

commit;
