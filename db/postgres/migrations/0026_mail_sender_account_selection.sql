begin;

alter table mail_messages
  add column if not exists sender_mail_account_id text references mail_accounts(id),
  add column if not exists sender_mail_alias_id text references mail_account_aliases(id),
  add column if not exists sender_email text,
  add column if not exists sender_display_name text;

create index if not exists idx_mail_messages_sender_account
  on mail_messages (company_id, sender_mail_account_id, sent_at desc, updated_at desc)
  where deleted_at is null;

commit;
