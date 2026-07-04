begin;

create table if not exists mail_delivery_batches (
  id text primary key,
  company_id text not null references companies(id),
  sender_user_id text not null references users(id),
  sender_mail_account_id text references mail_accounts(id),
  sender_mail_alias_id text references mail_account_aliases(id),
  sender_email text,
  sender_display_name text,
  email_type text not null default 'manual' check (email_type in ('auth', 'password_reset', 'notification', 'announcement', 'transactional', 'marketing', 'system', 'manual')),
  delivery_mode text not null default 'immediate' check (delivery_mode in ('immediate', 'scheduled', 'test')),
  subject text not null,
  body_snapshot text not null,
  status text not null default 'queued' check (status in ('draft', 'pending', 'queued', 'sending', 'sent', 'failed', 'retrying', 'cancelled', 'blocked', 'scheduled')),
  recipient_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  blocked_count integer not null default 0,
  external_recipient_count integer not null default 0,
  provider_kind text not null default 'unconfigured' check (provider_kind in ('smtp', 'api', 'unconfigured')),
  provider_name text not null default 'unconfigured',
  requested_by text references users(id),
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists mail_delivery_recipients (
  id text primary key,
  batch_id text not null references mail_delivery_batches(id),
  company_id text not null references companies(id),
  message_id text references mail_messages(id),
  recipient_user_id text references users(id),
  recipient_email text not null,
  recipient_name text,
  recipient_type text not null default 'to' check (recipient_type in ('to', 'cc', 'bcc')),
  status text not null check (status in ('queued', 'sending', 'sent', 'failed', 'retrying', 'cancelled', 'blocked')),
  provider_kind text not null default 'unconfigured' check (provider_kind in ('smtp', 'api', 'unconfigured')),
  provider_name text not null default 'unconfigured',
  error_code text,
  error_message text,
  provider_message_id text,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mail_delivery_batches_company_status on mail_delivery_batches (company_id, status, requested_at desc) where deleted_at is null;
create index if not exists idx_mail_delivery_batches_sender on mail_delivery_batches (company_id, sender_user_id, requested_at desc) where deleted_at is null;
create index if not exists idx_mail_delivery_recipients_batch on mail_delivery_recipients (batch_id, status, created_at desc);
create index if not exists idx_mail_delivery_recipients_message on mail_delivery_recipients (company_id, message_id) where message_id is not null;
create index if not exists idx_mail_delivery_recipients_email on mail_delivery_recipients (company_id, lower(recipient_email), created_at desc);

commit;
