begin;

-- CONTRACT runs only after the exact-linkage-aware Worker has been deployed
-- and its compatibility smoke has passed. Repeat legacy isolation to cover
-- rows written by the previous Worker during the EXPAND-to-deploy window.
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
    and pg_catalog.jsonb_typeof(job.payload->'userId') = 'string'
    and pg_catalog.jsonb_typeof(job.payload->'providerSubject') = 'string'
    and job.payload->>'action' = 'COMPENSATE'
    and exists (
      select 1
      from public.account_provisioning_attempts attempt
      where attempt.company_id = job.company_id
        and attempt.id::text = job.payload->>'provisioningAttemptId'
        and attempt.target_user_id::text = job.payload->>'userId'
        and attempt.provider_subject = job.payload->>'providerSubject'
        and attempt.status = 'COMPENSATION_REQUIRED'
    )
  ), false);

alter table public.outbox_jobs
  add constraint outbox_jobs_compensation_linkage_check check (
    job_type <> 'ACCOUNT_PROVIDER_COMPENSATE'
    or status in ('SUCCEEDED', 'CANCELLED', 'DEAD_LETTER')
    or coalesce((
      pg_catalog.jsonb_typeof(payload->'provisioningAttemptId') = 'string'
      and payload->>'provisioningAttemptId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and pg_catalog.jsonb_typeof(payload->'originalErrorCode') = 'string'
      and payload->>'originalErrorCode' in (
        'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
      )
      and pg_catalog.jsonb_typeof(payload->'userId') = 'string'
      and payload->>'userId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and pg_catalog.jsonb_typeof(payload->'providerSubject') = 'string'
      and length(payload->>'providerSubject') between 1 and 200
      and payload->>'action' = 'COMPENSATE'
    ), false)
  );

insert into public.schema_migrations (version)
values ('0012_account_provider_exact_dispatch_contract');

commit;
