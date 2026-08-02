\set ON_ERROR_STOP on

begin;

insert into users (id, company_id, user_type, display_name)
values (
  '2f000000-0000-4000-8000-000000000099',
  '10000000-0000-0000-0000-000000000001',
  'INTERNAL_STAFF', '무배정 검토 후보'
) on conflict (id) do nothing;

do $reviewer_candidates$
declare
  v_result record;
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_token text := repeat('I', 43);
begin
  perform set_config('app.session_id', v_session::text, true);

  select * into v_result
    from public.hotel_process_reviewer_candidates_v1(
      v_company, v_hotel, v_token
    );
  if v_result.command_status <> 'OK'
     or not (v_result.result_snapshot -> 'candidates') @>
       jsonb_build_array(jsonb_build_object(
         'id', '2f000000-0000-4000-8000-000000000001',
         'displayName', '점검 통합시험 전용 사용자'
       ))
     or (v_result.result_snapshot -> 'candidates') @>
       jsonb_build_array(jsonb_build_object(
         'id', '2f000000-0000-4000-8000-000000000099'
       )) then
    raise exception 'candidate read did not enforce the active hotel assignment fence';
  end if;

  select * into v_result from public.hotel_process_command_v1(
    v_company, v_hotel,
    'c1000000-0000-4000-8000-000000000099',
    'SAVE_DEFINITION', 0,
    jsonb_build_object(
      'revisionId', 'c2000000-0000-4000-8000-000000000099',
      'applicationType', 'ROOM_INSPECTION',
      'scope', 'HOTEL', 'name', '무배정 검토자 차단 시험',
      'startStageKey', 'FINAL_REVIEW',
      'stages', jsonb_build_array(jsonb_build_object(
        'id', 'c2100000-0000-4000-8000-000000000099',
        'key', 'FINAL_REVIEW', 'name', '최종 검토',
        'reviewerUserId', '2f000000-0000-4000-8000-000000000099',
        'delegate', null, 'due', null, 'isFinal', true
      )),
      'transitions', jsonb_build_array()
    ),
    v_token,
    'c2200000-0000-4000-8000-000000000099',
    'reviewer-candidate-assignment-fence', 'POST',
    '/api/admin/process-definitions',
    'reviewer-candidate-assignment-fence-hash',
    'c2300000-0000-4000-8000-000000000099',
    'c2400000-0000-4000-8000-000000000099'
  );
  if v_result.command_status <> 'PROCESS_ASSIGNEE_INVALID' then
    raise exception 'unassigned reviewer save returned %', v_result.command_status;
  end if;
end
$reviewer_candidates$;

rollback;

select 'HOTEL_PROCESS_REVIEWER_CANDIDATES_OK';
