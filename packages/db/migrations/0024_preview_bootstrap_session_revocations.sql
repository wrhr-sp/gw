begin;

create table public.preview_bootstrap_session_revocations (
  operation_key text
    constraint preview_bootstrap_session_revocations_pkey primary key
    constraint preview_bootstrap_revocations_operation_key_check check (
      operation_key ~ '^[0-9a-f]{64}$'
    ),
  operation_fingerprint text not null
    constraint preview_bootstrap_session_revocations_operation_fingerprint_key unique
    constraint preview_bootstrap_revocations_operation_fingerprint_check check (
      operation_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  source_reset_operation_key text not null
    constraint preview_bootstrap_session_revocations_source_reset_key unique
    constraint preview_bootstrap_session_revocations_source_reset_fkey
      references public.preview_bootstrap_operations(operation_key),
  subject_fingerprint text not null
    constraint preview_bootstrap_session_revocations_subject_fingerprint_check check (
      subject_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  company_id uuid not null,
  user_id uuid not null,
  identity_id uuid not null,
  status text not null
    constraint preview_bootstrap_session_revocations_status_check check (
      status in ('REQUESTING', 'COMPLETED', 'INDETERMINATE')
    ),
  provider_revoked_count integer
    constraint preview_bootstrap_session_revocations_provider_count_check check (
      provider_revoked_count >= 0
    ),
  application_revoked_count integer
    constraint preview_bootstrap_session_revocations_application_count_check check (
      application_revoked_count >= 0
    ),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  completed_at timestamptz,
  constraint preview_bootstrap_session_revocations_user_fkey
    foreign key (company_id, user_id) references public.users(company_id, id),
  constraint preview_bootstrap_session_revocations_identity_fkey
    foreign key (company_id, identity_id, user_id)
      references public.auth_identities(company_id, id, user_id),
  constraint preview_bootstrap_session_revocations_completion_check check (
    (status = 'COMPLETED') = (
      completed_at is not null
      and provider_revoked_count is not null
      and application_revoked_count is not null
    )
  ),
  constraint preview_bootstrap_session_revocations_incomplete_check check (
    status = 'COMPLETED'
    or (
      completed_at is null
      and provider_revoked_count is null
      and application_revoked_count is null
    )
  )
);

revoke all privileges on table public.preview_bootstrap_session_revocations from public;

insert into public.schema_migrations (version)
values ('0024_preview_bootstrap_session_revocations');

commit;
