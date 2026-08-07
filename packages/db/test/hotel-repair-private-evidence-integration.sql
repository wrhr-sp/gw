\set ON_ERROR_STOP on

do $repair_private_evidence$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_repair uuid := 'ac000000-0000-4000-8000-000000000001';
  v_file_version uuid := 'ad000000-0000-4000-8000-000000000002';
  v_token text := repeat('I',43);
  v_completion text := repeat('V',43);
  v_actor uuid;
  v_session uuid;
  v_grant uuid := 'ae000000-0000-4000-8000-000000000001';
  v_trace uuid := 'ae000000-0000-4000-8000-000000000002';
  v_stale_grant uuid := 'ae000000-0000-4000-8000-000000000003';
  v_stale_trace uuid := 'ae000000-0000-4000-8000-000000000004';
  v_rate_audit uuid := 'ae000000-0000-4000-8000-000000000005';
  v_window timestamptz := date_bin(interval '5 minutes',statement_timestamp(),timestamptz '1970-01-01 00:00:00+00');
  v_result record;
begin
  select session_record.user_id,session_record.id into strict v_actor,v_session
    from public.auth_sessions session_record
   where session_record.company_id=v_company
     and session_record.token_hash=pg_catalog.sha256(pg_catalog.convert_to(v_token,'UTF8'));
  perform set_config('app.company_id',v_company::text,true);
  perform set_config('app.session_id',v_session::text,true);
  delete from public.hotel_file_access_rate_windows
   where company_id=v_company and branch_id=v_hotel
     and ((scope_type='USER' and scope_id=v_actor)
       or (scope_type='HOTEL' and scope_id=v_hotel));

  select * into v_result from public.hotel_repair_file_view_command_v1(
    v_company,v_hotel,v_repair,v_file_version,'AUTHORIZE',v_token,
    v_grant,v_completion,gen_random_uuid(),gen_random_uuid(),v_trace
  );
  if v_result.command_status<>'OK'
     or v_result.result_snapshot->>'cleanObjectKey'<>'clean/'||v_file_version::text
     or v_result.result_snapshot->>'displayName'<>'보수-실제통합.jpg' then
    raise exception 'repair evidence authorization mismatch: % %',v_result.command_status,v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_repair_file_view_command_v1(
    v_company,v_hotel,v_repair,v_file_version,'SUCCEEDED',v_token,
    v_grant,v_completion,gen_random_uuid(),gen_random_uuid(),v_trace
  );
  if v_result.command_status<>'RECORDED' then
    raise exception 'repair evidence terminal success mismatch: %',v_result.command_status;
  end if;
  select * into v_result from public.hotel_repair_file_view_command_v1(
    v_company,v_hotel,v_repair,v_file_version,'FAILED',v_token,
    v_grant,v_completion,gen_random_uuid(),gen_random_uuid(),v_trace
  );
  if v_result.command_status<>'INVALID_STATE_TRANSITION' then
    raise exception 'repair evidence terminal double-write mismatch: %',v_result.command_status;
  end if;

  select * into v_result from public.hotel_repair_file_view_command_v1(
    v_company,v_hotel,'ae100000-0000-4000-8000-000000000099',v_file_version,
    'AUTHORIZE',v_token,gen_random_uuid(),repeat('W',43),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'NOT_FOUND' then
    raise exception 'repair evidence cross-parent denial mismatch: %',v_result.command_status;
  end if;

  insert into public.hotel_file_access_grants(
    id,company_id,branch_id,actor_user_id,actor_type,session_id,repair_case_id,
    file_version_id,completion_token_hash,status,trace_id,started_at,expires_at
  ) values (
    v_stale_grant,v_company,v_hotel,v_actor,'INTERNAL_STAFF',v_session,v_repair,
    v_file_version,pg_catalog.sha256(pg_catalog.convert_to(repeat('X',43),'UTF8')),
    'STARTED',v_stale_trace,statement_timestamp()-interval '20 minutes',
    statement_timestamp()-interval '5 minutes'
  );
  select * into v_result from public.hotel_repair_file_view_command_v1(
    v_company,v_hotel,v_repair,v_file_version,'AUTHORIZE',v_token,
    gen_random_uuid(),repeat('Y',43),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'OK'
     or (select status from public.hotel_file_access_grants where id=v_stale_grant)<>'ABORTED'
     or not exists(
       select 1 from public.audit_events
        where company_id=v_company and event_code='HOTEL_REPAIR_FILE_VIEW_ABANDONED'
          and resource_id=v_file_version and trace_id=v_stale_trace
     ) then
    raise exception 'repair evidence stale grant recovery mismatch: %',v_result.command_status;
  end if;

  insert into public.hotel_file_access_rate_windows(
    company_id,branch_id,scope_type,scope_id,window_started_at,request_count
  ) values (v_company,v_hotel,'USER',v_actor,v_window,30)
  on conflict(company_id,branch_id,scope_type,scope_id,window_started_at)
  do update set request_count=30;
  select * into v_result from public.hotel_repair_file_view_command_v1(
    v_company,v_hotel,v_repair,v_file_version,'AUTHORIZE',v_token,
    gen_random_uuid(),repeat('Z',43),v_rate_audit,gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'RATE_LIMITED'
     or not exists(
       select 1 from public.audit_events
        where id=v_rate_audit and event_code='HOTEL_REPAIR_FILE_VIEW_RATE_LIMITED'
          and result='DENIED'
     ) then
    raise exception 'repair evidence rate limit mismatch: %',v_result.command_status;
  end if;

  if not exists(
    select 1 from public.audit_events
     where company_id=v_company and event_code='HOTEL_REPAIR_FILE_VIEW_SUCCEEDED'
       and resource_id=v_file_version and result='SUCCEEDED'
  ) then
    raise exception 'repair evidence terminal audit missing';
  end if;
end
$repair_private_evidence$;

select 'HOTEL_REPAIR_PRIVATE_EVIDENCE_INTEGRATION_OK';
