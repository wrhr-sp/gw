\set ON_ERROR_STOP on

begin;

do $fixture$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_internal_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_internal uuid;
  v_housekeeping uuid;
  v_owner uuid;
  v_permission text;
  v_index integer;
begin
  select user_id into strict v_internal from public.auth_sessions
   where company_id=v_company and id=v_internal_session;

  select user_id into v_housekeeping from public.housekeeping_hotel_links
   where company_id=v_company and branch_id=v_hotel and terminated_at is null
     and start_date<=statement_timestamp()::date
     and (end_date is null or end_date>=statement_timestamp()::date)
   order by created_at limit 1;
  if v_housekeeping is null then
    v_housekeeping := 'd9100000-0000-4000-8000-000000000001';
    insert into public.users(id,company_id,user_type,display_name)
    values(v_housekeeping,v_company,'HOUSEKEEPING','운영이슈 하우스키핑 검증자');
    insert into public.housekeeping_hotel_links(
      id,company_id,branch_id,user_id,start_date,reason,created_by
    ) values(
      'd9110000-0000-4000-8000-000000000001',v_company,v_hotel,
      v_housekeeping,statement_timestamp()::date,'운영이슈 통합검증',v_internal
    );
  end if;

  select user_id into v_owner from public.hotel_owner_assignments
   where company_id=v_company and branch_id=v_hotel and terminated_at is null
     and start_date<=statement_timestamp()::date
     and (end_date is null or end_date>=statement_timestamp()::date)
   order by created_at limit 1;
  if v_owner is null then
    v_owner := 'd9200000-0000-4000-8000-000000000001';
    insert into public.users(id,company_id,user_type,display_name)
    values(v_owner,v_company,'HOTEL_OWNER','운영이슈 소유주 검증자');
    insert into public.hotel_owner_assignments(
      id,company_id,branch_id,user_id,start_date,reason,created_by
    ) values(
      'd9210000-0000-4000-8000-000000000001',v_company,v_hotel,
      v_owner,statement_timestamp()::date,'운영이슈 통합검증',v_internal
    );
  end if;

  insert into public.auth_identities(id,company_id,user_id,provider,provider_subject)
  values
    ('d9120000-0000-4000-8000-000000000001',v_company,v_housekeeping,'ZITADEL','operational-issue-housekeeping'),
    ('d9220000-0000-4000-8000-000000000001',v_company,v_owner,'ZITADEL','operational-issue-owner');
  insert into public.auth_sessions(
    id,company_id,user_id,identity_id,token_hash,idle_expires_at,
    absolute_expires_at,auth_time,authentication_method
  ) values
    ('d9130000-0000-4000-8000-000000000001',v_company,v_housekeeping,
     'd9120000-0000-4000-8000-000000000001',sha256(convert_to(repeat('H',43),'UTF8')),
     statement_timestamp()+interval '30 minutes',statement_timestamp()+interval '8 hours',statement_timestamp(),'OIDC_PKCE'),
    ('d9230000-0000-4000-8000-000000000001',v_company,v_owner,
     'd9220000-0000-4000-8000-000000000001',sha256(convert_to(repeat('O',43),'UTF8')),
     statement_timestamp()+interval '30 minutes',statement_timestamp()+interval '8 hours',statement_timestamp(),'OIDC_PKCE');

  v_index:=0;
  foreach v_permission in array array[
    'HOTEL_ISSUE_READ','HOTEL_ISSUE_CREATE','HOTEL_ISSUE_WORK','HOTEL_ISSUE_MANAGE'
  ] loop
    v_index:=v_index+1;
    insert into public.permission_grants(
      id,company_id,branch_id,subject_type,subject_id,permission_code,effect,
      valid_from,granted_by,reason
    ) values(
      ('d9300000-0000-4000-8000-'||lpad(v_index::text,12,'0'))::uuid,
      v_company,v_hotel,'USER',v_internal,v_permission,'ALLOW',
      statement_timestamp()-interval '1 day',v_internal,'운영이슈 통합검증 권한'
    );
  end loop;
  v_index:=0;
  foreach v_permission in array array['HOTEL_ISSUE_READ','HOTEL_ISSUE_CREATE','HOTEL_ISSUE_WORK'] loop
    v_index:=v_index+1;
    insert into public.permission_grants(
      id,company_id,branch_id,subject_type,subject_id,permission_code,effect,
      valid_from,granted_by,reason
    ) values(
      ('d9310000-0000-4000-8000-'||lpad(v_index::text,12,'0'))::uuid,
      v_company,v_hotel,'USER',v_housekeeping,v_permission,'ALLOW',
      statement_timestamp()-interval '1 day',v_internal,'운영이슈 하우스키핑 권한'
    );
  end loop;
  v_index:=0;
  foreach v_permission in array array['HOTEL_OWNER_ISSUE_READ','HOTEL_OWNER_ISSUE_COMMENT'] loop
    v_index:=v_index+1;
    insert into public.permission_grants(
      id,company_id,branch_id,subject_type,subject_id,permission_code,effect,
      valid_from,granted_by,reason
    ) values(
      ('d9320000-0000-4000-8000-'||lpad(v_index::text,12,'0'))::uuid,
      v_company,v_hotel,'USER',v_owner,v_permission,'ALLOW',
      statement_timestamp()-interval '1 day',v_internal,'운영이슈 소유주 권한'
    );
  end loop;
  v_index:=0;
  foreach v_permission in array array[
    'HOTEL_ISSUE_READ','HOTEL_ISSUE_CREATE','HOTEL_ISSUE_WORK','HOTEL_ISSUE_MANAGE'
  ] loop
    v_index:=v_index+1;
    insert into public.permission_grants(
      id,company_id,branch_id,subject_type,subject_id,permission_code,effect,
      valid_from,granted_by,reason
    ) values(
      ('d9330000-0000-4000-8000-'||lpad(v_index::text,12,'0'))::uuid,
      v_company,v_hotel,'USER',v_owner,v_permission,'ALLOW',
      statement_timestamp()-interval '1 day',v_internal,
      '소유주 내부권한 오배정 격리 검증'
    );
  end loop;
end
$fixture$;
commit;

do $journey$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_internal_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_housekeeping_session uuid := 'd9130000-0000-4000-8000-000000000001';
  v_owner_session uuid := 'd9230000-0000-4000-8000-000000000001';
  v_internal_token text := repeat('I',43);
  v_housekeeping_token text := repeat('H',43);
  v_owner_token text := repeat('O',43);
  v_internal uuid;
  v_housekeeping uuid;
  v_issue uuid := 'd9400000-0000-4000-8000-000000000001';
  v_housekeeping_issue uuid := 'd9400000-0000-4000-8000-000000000002';
  v_result record;
  v_version integer;
  v_count integer;
begin
  select user_id into strict v_internal from public.auth_sessions where id=v_internal_session;
  select user_id into strict v_housekeeping from public.auth_sessions where id=v_housekeeping_session;

  perform set_config('app.company_id',v_company::text,true);
  perform set_config('app.session_id',v_internal_session::text,true);
  select * into v_result from public.hotel_issue_capabilities_v1(v_company,v_internal_token);
  if v_result.command_status<>'OK'
     or not exists(
       select 1 from jsonb_array_elements(v_result.result_snapshot->'hotels') capability
        where capability->>'hotelId'=v_hotel::text
          and (capability->>'canRead')::boolean
          and (capability->>'canManage')::boolean
          and capability->>'actorUserId'=v_internal::text
     )
  then raise exception 'issue capabilities failed: %',v_result.command_status; end if;
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'CREATE',0,
    jsonb_build_object('title','객실 누수 긴급 확인','description','천장 누수 흔적을 확인했습니다.','severity','EMERGENCY','roomId',null),
    v_internal_token,gen_random_uuid(),'issue-create-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues','issue-create-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'CREATED'
     or v_result.result_snapshot->>'status'<>'RECEIVED'
     or v_result.result_snapshot->>'isOverdue'<>'false'
  then raise exception 'issue create failed: %',v_result.command_status; end if;
  select count(*) into v_count from public.hotel_issue_notification_outbox
   where company_id=v_company and issue_id=v_issue and channel='IN_APP'
     and delivery_status='PENDING' and push_status='NOT_REQUESTED';
  if v_count<3 then raise exception 'emergency in-app outbox recipients missing: %',v_count; end if;
  if not exists(
    select 1 from public.hotel_issue_notification_outbox
     where company_id=v_company and issue_id=v_issue and recipient_user_id=v_internal and channel='IN_APP'
  ) then raise exception 'emergency internal recipient missing'; end if;

  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'ASSIGN',1,
    jsonb_build_object('assigneeUserId',v_housekeeping,'reason','현장 담당 지정'),
    v_internal_token,gen_random_uuid(),'issue-assign-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/actions','issue-assign-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot->>'status'<>'ASSIGNED'
  then raise exception 'issue assignment failed: %',v_result.command_status; end if;
  if not exists(
    select 1 from public.hotel_issue_status_history
     where company_id=v_company and issue_id=v_issue and issue_version=2
       and action='ASSIGN' and from_status='RECEIVED' and to_status='ASSIGNED'
  ) then raise exception 'assignment status history missing'; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'ASSIGN',v_version,
    jsonb_build_object('assigneeUserId',v_internal,'reason','승인되지 않은 처리중 재지정'),
    v_internal_token,gen_random_uuid(),'issue-reassign-invalid-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/assign','issue-reassign-invalid-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'ISSUE_STATE_INVALID' then raise exception 'state-bypassing reassignment accepted'; end if;

  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'START',1,jsonb_build_object('reason','낡은 화면 동시 요청'),
    v_internal_token,gen_random_uuid(),'issue-stale-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/actions','issue-stale-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'VERSION_CONFLICT' then raise exception 'stale version accepted'; end if;

  perform set_config('app.session_id',v_housekeeping_session::text,true);
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'START',v_version,jsonb_build_object('reason','현장 확인 시작'),
    v_housekeeping_token,gen_random_uuid(),'issue-start-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/actions','issue-start-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot->>'status'<>'IN_PROGRESS'
  then raise exception 'assignee start failed: %',v_result.command_status; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'ADD_WORK_LOG',v_version,jsonb_build_object('body','누수 지점을 확인하고 밸브를 잠갔습니다.','reason','현장 작업기록'),
    v_housekeeping_token,gen_random_uuid(),'issue-log-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/work-logs','issue-log-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or jsonb_array_length(v_result.result_snapshot->'workLogs')<>1
  then raise exception 'work log failed: %',v_result.command_status; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;

  perform set_config('app.session_id',v_internal_session::text,true);
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'ADD_INTERNAL_NOTE',v_version,jsonb_build_object('body','보험사 확인 전 비용 언급을 제한합니다.','reason','내부 협의'),
    v_internal_token,gen_random_uuid(),'issue-note-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/internal-notes','issue-note-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or jsonb_array_length(v_result.result_snapshot->'internalNotes')<>1
  then raise exception 'internal note failed: %',v_result.command_status; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;

  perform set_config('app.session_id',v_owner_session::text,true);
  select * into v_result from public.hotel_issue_capabilities_v1(v_company,v_owner_token);
  if v_result.command_status<>'OK'
     or not exists(
       select 1 from jsonb_array_elements(v_result.result_snapshot->'hotels') capability
        where capability->>'hotelId'=v_hotel::text
          and (capability->>'canRead')::boolean
          and (capability->>'canComment')::boolean
          and not (capability->>'canCreate')::boolean
          and not (capability->>'canWork')::boolean
          and not (capability->>'canManage')::boolean
          and not capability ? 'actorUserId'
     )
  then raise exception 'owner internal permission namespace was not isolated'; end if;
  select * into v_result from public.hotel_issue_read_v1(v_company,v_hotel,v_issue,'{}'::jsonb,v_owner_token);
  if v_result.command_status<>'OK'
     or v_result.result_snapshot ? 'internalNotes'
     or v_result.result_snapshot ? 'workLogs'
     or v_result.result_snapshot->'assignee' ? 'userId'
     or exists(
       select 1 from jsonb_array_elements(v_result.result_snapshot->'publicComments') c
        where c->'actor' ? 'userId'
     )
  then raise exception 'owner private response leak'; end if;
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'ADD_INTERNAL_NOTE',v_version,
    jsonb_build_object('body','소유주가 볼 수 없는 내부메모','reason','소유주 내부권한 오배정 검증'),
    v_owner_token,gen_random_uuid(),'issue-owner-note-forbidden-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/internal-notes',
    'issue-owner-note-forbidden-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'FORBIDDEN' then
    raise exception 'owner internal note accepted through misgranted permission';
  end if;
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'ADD_PUBLIC_COMMENT',v_version,jsonb_build_object('body','완료 예상시간을 알려주세요.','reason','소유주 공개댓글'),
    v_owner_token,gen_random_uuid(),'issue-owner-comment-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/comments','issue-owner-comment-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot ? 'internalNotes'
  then raise exception 'owner comment response leak: %',v_result.command_status; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;

  perform set_config('app.session_id',v_housekeeping_session::text,true);
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'COMPLETE_ACTION',v_version,jsonb_build_object('reason','누수 응급조치 완료'),
    v_housekeeping_token,gen_random_uuid(),'issue-complete-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/actions','issue-complete-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot->>'status'<>'ACTION_COMPLETED'
  then raise exception 'action completion failed: %',v_result.command_status; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;

  perform set_config('app.session_id',v_internal_session::text,true);
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'CLOSE',v_version,jsonb_build_object('reason','현장 조치와 보고 확인'),
    v_internal_token,gen_random_uuid(),'issue-close-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/actions','issue-close-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot->>'status'<>'CLOSED'
  then raise exception 'close failed: %',v_result.command_status; end if;
  v_version:=(v_result.result_snapshot->>'version')::integer;
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_issue,'REOPEN',v_version,jsonb_build_object('reason','누수 재발 확인'),
    v_internal_token,gen_random_uuid(),'issue-reopen-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues/'||v_issue::text||'/actions','issue-reopen-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'UPDATED' or v_result.result_snapshot->>'status'<>'ASSIGNED'
  then raise exception 'reopen failed: %',v_result.command_status; end if;

  perform set_config('app.session_id',v_housekeeping_session::text,true);
  select * into v_result from public.hotel_issue_command_v1(
    v_company,v_hotel,v_housekeeping_issue,'CREATE',0,
    jsonb_build_object('title','린넨 수량 부족','description','오늘 교체용 린넨 수량이 부족합니다.','severity','MINOR','roomId',null),
    v_housekeeping_token,gen_random_uuid(),'issue-house-create-1','POST',
    '/api/hotels/'||v_hotel::text||'/issues','issue-house-create-hash',gen_random_uuid(),gen_random_uuid()
  );
  if v_result.command_status<>'CREATED' then raise exception 'housekeeping create failed: %',v_result.command_status; end if;

  begin
    update public.hotel_issue_status_history set reason='변조' where issue_id=v_issue;
    raise exception 'append-only history update accepted';
  exception when sqlstate '55000' then null; end;

  if exists(select 1 from public.hotel_issue_sla_policies where company_id=v_company)
  then raise exception 'unapproved SLA numbers were seeded'; end if;
end
$journey$;

select 'HOTEL_OPERATIONAL_ISSUES_INTEGRATION_OK';
