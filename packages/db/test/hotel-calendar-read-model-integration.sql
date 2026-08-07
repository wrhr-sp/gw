\set ON_ERROR_STOP on
begin;

do $calendar_fixture$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_actor uuid;
  v_permission text;
  v_index integer := 0;
begin
  select user_id into strict v_actor from public.auth_sessions
   where company_id = v_company and id = v_session;

  update public.hotel_profiles
     set hotel_status = 'ACTIVE', version = version + 1,
         updated_at = statement_timestamp()
   where company_id = v_company and branch_id = v_hotel
     and hotel_status <> 'ACTIVE';
  if not found and not exists (
    select 1 from public.hotel_profiles
     where company_id = v_company and branch_id = v_hotel
       and hotel_status = 'ACTIVE'
  ) then
    raise exception 'Calendar fixture hotel profile is missing';
  end if;

  foreach v_permission in array array[
    'HOTEL_CALENDAR_READ',
    'REPAIR_VISIT_CANCELLED_READ',
    'REPAIR_VISIT_CANCEL_REASON_READ',
    'HOTEL_INSPECTION_RUN'
  ] loop
    v_index := v_index + 1;
    if not exists (
      select 1 from public.permission_grants permission_grant
       where permission_grant.company_id = v_company
         and permission_grant.branch_id = v_hotel
         and permission_grant.subject_type = 'USER'
         and permission_grant.subject_id = v_actor
         and permission_grant.permission_code = v_permission
         and permission_grant.effect = 'ALLOW'
    ) then
      insert into public.permission_grants(
        id, company_id, branch_id, subject_type, subject_id, permission_code,
        effect, valid_from, valid_until, granted_by, reason
      ) values (
        ('ae100000-0000-4000-8000-' || lpad(v_index::text, 12, '0'))::uuid,
        v_company, v_hotel, 'USER', v_actor, v_permission,
        'ALLOW', statement_timestamp() - interval '1 day', null, v_actor,
        'Calendar 실제 통합검증 권한'
      );
    end if;
  end loop;

  if not exists (
    select 1 from public.permission_grants permission_grant
     where permission_grant.company_id = v_company
       and permission_grant.branch_id is null
       and permission_grant.subject_type = 'USER'
       and permission_grant.subject_id = v_actor
       and permission_grant.permission_code = 'HOTEL_CALENDAR_ALL_READ'
       and permission_grant.effect = 'ALLOW'
  ) then
    insert into public.permission_grants(
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, valid_until, granted_by, reason
    ) values (
      'ae200000-0000-4000-8000-000000000001', v_company, null,
      'USER', v_actor, 'HOTEL_CALENDAR_ALL_READ', 'ALLOW',
      statement_timestamp() - interval '1 day', null, v_actor,
      'Calendar 전체호텔 실제 통합검증 권한'
    );
  end if;
end
$calendar_fixture$;

commit;
select 'HOTEL_CALENDAR_READ_MODEL_INTEGRATION_OK';
