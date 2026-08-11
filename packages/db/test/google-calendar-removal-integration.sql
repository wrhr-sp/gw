\set ON_ERROR_STOP on

begin;

do $calendar_removal$
declare
  v_repair record;
  v_snapshot jsonb;
begin
  if exists (
    select 1
      from pg_catalog.pg_class relation_record
      join pg_catalog.pg_namespace relation_namespace
        on relation_namespace.oid = relation_record.relnamespace
     where relation_namespace.nspname = 'public'
       and relation_record.relname = any(array[
         'calendar_catch_up_items',
         'calendar_sync_failures',
         'calendar_projection_attempts',
         'calendar_projection_jobs',
         'calendar_event_links',
         'calendar_hotel_links',
         'calendar_oauth_transactions',
         'calendar_crypto_settings',
         'calendar_connection_credentials',
         'calendar_connections'
       ])
  ) then
    raise exception 'retired Calendar projection relation remains';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_proc procedure_record
      join pg_catalog.pg_namespace procedure_namespace
        on procedure_namespace.oid = procedure_record.pronamespace
     where procedure_namespace.nspname = 'public'
       and procedure_record.proname = any(array[
         'calendar_projection_visit_signal_v1',
         'calendar_projection_evidence_read_v1',
         'calendar_projection_finalize_v1',
         'calendar_projection_repair_stale_v1',
         'calendar_projection_reset_event_existence_v1',
         'calendar_projection_mark_create_dispatched_v1',
         'calendar_projection_claim_v1',
         'calendar_repair_projection_status_v1',
         'calendar_visit_projection_status_v1',
         'calendar_projection_failure_retry_v1',
         'calendar_hotel_link_command_v1',
         'calendar_connection_command_v1',
         'calendar_candidate_finalize_v1',
         'calendar_candidate_claim_v1',
         'calendar_oauth_finalize_v1',
         'calendar_oauth_fail_v1',
         'calendar_oauth_claim_v1',
         'calendar_oauth_start_v1',
         'calendar_authorization_lock_v1',
         'calendar_connection_status_read_v1',
         'calendar_connection_manage_hotel_allowed_v1'
       ])
  ) then
    raise exception 'retired Calendar projection routine remains';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_trigger trigger_record
     where not trigger_record.tgisinternal
       and trigger_record.tgname = 'calendar_projection_visit_signal'
  ) then
    raise exception 'retired Calendar projection trigger remains';
  end if;

  if exists (
    select 1 from public.permissions
     where code in ('CALENDAR_CONNECTION_MANAGE', 'CALENDAR_PROJECTION_RETRY')
  ) or exists (
    select 1 from public.permission_grants
     where permission_code in ('CALENDAR_CONNECTION_MANAGE', 'CALENDAR_PROJECTION_RETRY')
  ) then
    raise exception 'retired Calendar projection permission remains';
  end if;

  if to_regprocedure('public.hotel_calendar_events_read_v1(uuid,uuid,jsonb,text)') is null then
    raise exception 'own Calendar read function is missing';
  end if;

  select repair_case.company_id, repair_case.branch_id, repair_case.id
    into v_repair
    from public.hotel_repair_cases repair_case
   order by repair_case.created_at, repair_case.id
   limit 1;
  if found then
    v_snapshot := public.repair_snapshot_v1(
      v_repair.company_id,
      v_repair.branch_id,
      v_repair.id,
      true
    );
    if v_snapshot is null then
      raise exception 'canonical repair snapshot is missing';
    end if;
    if jsonb_path_exists(v_snapshot, 'strict $.**.calendarProjectionStatus') then
      raise exception 'retired projection key remains in repair snapshot';
    end if;
  end if;

  if pg_catalog.pg_get_functiondef(
    'public.hotel_calendar_events_read_v1(uuid,uuid,jsonb,text)'::regprocedure
  ) like '%calendarProjectionStatus%' then
    raise exception 'retired projection key remains in own Calendar function';
  end if;
end
$calendar_removal$;

commit;
select 'GOOGLE_CALENDAR_REMOVAL_INTEGRATION_OK';
