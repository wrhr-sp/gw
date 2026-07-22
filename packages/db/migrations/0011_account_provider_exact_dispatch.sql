begin;

-- Legacy compensation jobs did not preserve enough information to fence the
-- exact provisioning attempt or reproduce the original completion error. They
-- must never reach the provider after this migration.
update public.account_provisioning_attempts attempt
set status = 'DEAD_LETTER',
    failure_code = 'LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE',
    dead_lettered_at = now(),
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
where attempt.status = 'COMPENSATION_REQUIRED'
  and exists (
    select 1
    from public.outbox_jobs job
    where job.company_id = attempt.company_id
      and job.job_type = 'ACCOUNT_PROVIDER_COMPENSATE'
      and job.payload->>'userId' = attempt.target_user_id::text
      and job.status in ('PENDING', 'FAILED', 'PROCESSING')
      and not coalesce((
        pg_catalog.jsonb_typeof(job.payload->'provisioningAttemptId') = 'string'
        and job.payload->>'provisioningAttemptId' ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and job.payload->>'provisioningAttemptId' = attempt.id::text
        and pg_catalog.jsonb_typeof(job.payload->'originalErrorCode') = 'string'
        and job.payload->>'originalErrorCode' in (
          'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
        )
      ), false)
  );

update public.outbox_jobs job
set status = 'DEAD_LETTER',
    last_error_code = 'LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE',
    locked_at = null,
    claim_token = null,
    completed_at = coalesce(completed_at, now()),
    dead_lettered_at = coalesce(dead_lettered_at, now()),
    updated_at = now()
where job.job_type = 'ACCOUNT_PROVIDER_COMPENSATE'
  and job.status in ('PENDING', 'FAILED', 'PROCESSING')
  and not coalesce((
    pg_catalog.jsonb_typeof(job.payload->'provisioningAttemptId') = 'string'
    and job.payload->>'provisioningAttemptId' ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and pg_catalog.jsonb_typeof(job.payload->'originalErrorCode') = 'string'
    and job.payload->>'originalErrorCode' in (
      'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
    )
  ), false);

-- EXPAND intentionally does not add the new payload CHECK. The previous Worker
-- must remain able to write its legacy compensation shape until the new Worker
-- has been deployed and verified. CONTRACT migration 0012 repeats isolation
-- for rows written during that window and then adds the CHECK.
insert into public.schema_migrations (version)
values ('0011_account_provider_exact_dispatch');

commit;
