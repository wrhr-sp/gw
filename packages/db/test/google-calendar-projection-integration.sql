\set ON_ERROR_STOP on
begin;

do $fixture$
declare
  company_id_value uuid := '10000000-0000-0000-0000-000000000001';
  hotel_id_value uuid := '50000000-0000-4000-8000-000000000001';
  session_id_value uuid := '4f000000-0000-4000-8000-000000000001';
  actor_id_value uuid;
  visit_id_value uuid;
begin
  select user_id into strict actor_id_value from public.auth_sessions where company_id=company_id_value and id=session_id_value;
  update public.auth_sessions set auth_time=statement_timestamp() where company_id=company_id_value and id=session_id_value;

  if not exists(select 1 from public.permission_grants where id='ca440000-0000-4000-8000-000000000001') then
    insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
    values('ca440000-0000-4000-8000-000000000001',company_id_value,null,'USER',actor_id_value,'CALENDAR_CONNECTION_MANAGE','ALLOW',statement_timestamp()-interval '1 day',actor_id_value,'Google Calendar actual integration');
  end if;
  if not exists(select 1 from public.permission_grants where id='ca440000-0000-4000-8000-000000000002') then
    insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
    values('ca440000-0000-4000-8000-000000000002',company_id_value,hotel_id_value,'USER',actor_id_value,'CALENDAR_CONNECTION_MANAGE','ALLOW',statement_timestamp()-interval '1 day',actor_id_value,'Google Calendar hotel actual integration');
  end if;

  select id into visit_id_value from public.hotel_repair_visits where company_id=company_id_value and branch_id=hotel_id_value order by id limit 1;
  if visit_id_value is not null then
    update public.hotel_repair_visits set version=version+1 where company_id=company_id_value and branch_id=hotel_id_value and id=visit_id_value;
  end if;
  if (select count(*) from information_schema.columns where table_schema='public' and table_name='calendar_projection_jobs' and column_name in ('attempted_source_version','attempted_starts_at','attempted_ends_at','attempted_visit_status','attempted_hotel_link_generation','attempted_hotel_link_version','attempted_event_link_version','attempted_credential_id','attempted_credential_version','create_dispatch_state'))<>10 then
    raise exception 'projection job durable fence columns missing';
  end if;
  if exists(select 1 from public.calendar_projection_jobs where company_id=company_id_value) then
    raise exception 'projection job existed before an active connection and hotel link';
  end if;
end
$fixture$;
commit;
select 'GOOGLE_CALENDAR_PROJECTION_FIXTURE_OK';
