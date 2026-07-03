begin;

create table if not exists document_file_download_tickets (
  id text primary key,
  company_id text not null references companies(id),
  file_id text not null references file_objects(id),
  version_id text not null references documents(id),
  actor_user_id text not null references users(id),
  object_key text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_file_download_tickets_company_file on document_file_download_tickets(company_id, file_id, created_at desc);
create index if not exists idx_document_file_download_tickets_token_hash on document_file_download_tickets(token_hash, expires_at desc);

commit;
