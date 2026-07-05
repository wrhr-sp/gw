begin;

alter table mail_messages
  add column if not exists scheduled_at timestamptz;

create index if not exists idx_mail_messages_scheduled
  on mail_messages (company_id, sender_user_id, scheduled_at asc, updated_at desc)
  where deleted_at is null and status = 'scheduled';

commit;
