-- Forward-only inspection evidence submission and post-submit mutation hardening.
-- Existing command v1 remains the internal implementation; API runtime callers use v2.

begin;

create function public.hotel_inspection_command_v2(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_inspection_status text;
  v_inspection_version integer;
begin
  if p_action in ('SAVE_RESULT', 'SUBMIT') then
    select * into v_actor
      from public.hotel_command_actor_v1(
        p_company_id, p_branch_id, p_session_token,
        'HOTEL_INSPECTION_RUN', true
      );
    if not found then
      return query select 'FORBIDDEN'::text, null::jsonb;
      return;
    end if;

    select inspection.status, inspection.version
      into v_inspection_status, v_inspection_version
      from public.hotel_inspections inspection
     where inspection.company_id = p_company_id
       and inspection.branch_id = p_branch_id
       and inspection.id = p_resource_id
     for update;
    if not found then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;

    if p_action = 'SAVE_RESULT'
       and v_inspection_status <> 'PENDING_INPUT'
       and not exists (
         select 1
           from public.idempotency_records idempotency
          where idempotency.company_id = p_company_id
            and idempotency.actor_user_id = v_actor.user_id
            and idempotency.idempotency_key = p_idempotency_key
            and idempotency.http_method = p_http_method
            and idempotency.operation_path = p_operation_path
            and idempotency.status = 'COMPLETED'
       ) then
      return query select 'INSPECTION_FINAL_LOCKED'::text, null::jsonb;
      return;
    end if;

    if p_action = 'SUBMIT'
       and v_inspection_status = 'PENDING_INPUT'
       and v_inspection_version = p_expected_version
       and exists (
         select 1
           from public.inspection_item_results result_record
          where result_record.company_id = p_company_id
            and result_record.branch_id = p_branch_id
            and result_record.inspection_id = p_resource_id
            and (
              (
                result_record.result = 'ABNORMAL'
                and (
                  (
                    select pg_catalog.count(*)
                      from public.hotel_file_links file_link
                     where file_link.company_id = result_record.company_id
                       and file_link.branch_id = result_record.branch_id
                       and file_link.inspection_id = result_record.inspection_id
                       and file_link.item_snapshot_id = result_record.item_snapshot_id
                       and file_link.result_id = result_record.id
                       and file_link.result_version = result_record.version
                       and file_link.parent_type = 'INSPECTION_ITEM_EVIDENCE'
                  ) not between 1 and 5
                  or exists (
                    select 1
                      from public.hotel_file_links file_link
                     where file_link.company_id = result_record.company_id
                       and file_link.branch_id = result_record.branch_id
                       and file_link.inspection_id = result_record.inspection_id
                       and file_link.item_snapshot_id = result_record.item_snapshot_id
                       and file_link.result_id = result_record.id
                       and file_link.result_version = result_record.version
                       and file_link.parent_type = 'INSPECTION_ITEM_EVIDENCE'
                       and not exists (
                         select 1
                           from public.hotel_file_versions file_version
                           join public.hotel_file_uploads upload
                             on upload.company_id = file_version.company_id
                            and upload.id = file_version.upload_id
                           join public.hotel_file_scan_jobs scan_job
                             on scan_job.company_id = file_version.company_id
                            and scan_job.upload_id = file_version.upload_id
                            and scan_job.file_version_id = file_version.id
                          where file_version.company_id = file_link.company_id
                            and file_version.branch_id = file_link.branch_id
                            and file_version.id = file_link.file_version_id
                            and upload.branch_id = result_record.branch_id
                            and upload.inspection_id = result_record.inspection_id
                            and upload.item_snapshot_id = result_record.item_snapshot_id
                            and upload.status = 'LINKED'
                            and scan_job.status = 'COMPLETED'
                       )
                  )
                )
              )
              or (
                result_record.result <> 'ABNORMAL'
                and exists (
                  select 1
                    from public.hotel_file_links file_link
                   where file_link.company_id = result_record.company_id
                     and file_link.result_id = result_record.id
                     and file_link.result_version = result_record.version
                )
              )
            )
       ) then
      return query select 'INSPECTION_RESULT_EVIDENCE_REQUIRED'::text, null::jsonb;
      return;
    end if;
  end if;

  return query
  select command.command_status, command.result_snapshot
    from public.hotel_inspection_command_v1(
      p_company_id, p_branch_id, p_resource_id, p_action,
      p_expected_version, p_value, p_session_token,
      p_idempotency_record_id, p_idempotency_key, p_http_method,
      p_operation_path, p_request_hash, p_audit_event_id, p_trace_id
    ) command;
end
$function$;

revoke all on function public.hotel_inspection_command_v2(
  uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text,
  text, text, uuid, uuid
) from public;

-- Existing deployments may already have API runtime roles. Revoke the legacy
-- callable surface during migration; provisioning grants v2 explicitly.
do $block$
declare
  runtime_role text;
begin
  for runtime_role in
    select capability.role_name
      from public.runtime_database_capabilities capability
     where capability.capability = 'API_RUNTIME'
  loop
    execute pg_catalog.format(
      'revoke execute on function public.hotel_inspection_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from %I',
      runtime_role
    );
  end loop;
end
$block$;

insert into public.schema_migrations(version)
values ('0034_hotel_inspection_evidence_submission')
on conflict (version) do nothing;

commit;
