\set ON_ERROR_STOP on

begin;

do $upload_scope$
declare
  v_company constant uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel constant uuid := '50000000-0000-4000-8000-000000000001';
  v_session constant uuid := '4f000000-0000-4000-8000-000000000001';
  v_other_session constant uuid := '4f000000-0000-4000-8000-000000000099';
  v_upload constant uuid := 'c6400000-0000-4000-8000-000000000001';
  v_scope uuid;
begin
  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    display_name, declared_mime, reserved_size, quarantine_object_key,
    reservation_fingerprint, status, initiated_by, initiated_session_id,
    expires_at
  )
  select
    v_upload, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    'scope.jpg', 'image/jpeg', 4,
    'quarantine/' || v_upload || '/' || repeat('S', 43),
    repeat('a', 64), 'PENDING_UPLOAD', initiated_by, initiated_session_id,
    pg_catalog.now() + interval '5 minutes'
  from public.hotel_file_uploads
  where id = 'c6000000-0000-4000-8000-000000000001';

  perform pg_catalog.set_config('app.session_id', v_session::text, true);
  select scope.branch_id into v_scope
  from public.hotel_file_upload_scope_v1(v_company, v_upload, repeat('I', 43)) scope;
  if v_scope is distinct from v_hotel then
    raise exception 'canonical upload branch was not restored';
  end if;

  if exists (
    select 1 from public.hotel_file_upload_scope_v1(
      v_company, v_upload, repeat('X', 43)
    )
  ) then
    raise exception 'invalid session token restored upload scope';
  end if;

  insert into public.auth_sessions (
    id, company_id, user_id, identity_id, token_hash,
    idle_expires_at, absolute_expires_at, auth_time, authentication_method
  )
  select
    v_other_session, company_id, user_id, identity_id,
    pg_catalog.sha256(pg_catalog.convert_to(repeat('Y', 43), 'UTF8')),
    pg_catalog.now() + interval '1 hour',
    pg_catalog.now() + interval '2 hours',
    pg_catalog.now(), authentication_method
  from public.auth_sessions
  where company_id = v_company and id = v_session;

  update public.hotel_file_uploads
     set initiated_session_id = v_other_session
   where id = v_upload;
  if exists (
    select 1 from public.hotel_file_upload_scope_v1(
      v_company, v_upload, repeat('I', 43)
    )
  ) then
    raise exception 'another initiating session restored upload scope';
  end if;

  update public.hotel_file_uploads
     set initiated_session_id = v_session,
         created_at = pg_catalog.now() - interval '10 minutes',
         expires_at = pg_catalog.now() - interval '1 second'
   where id = v_upload;
  if exists (
    select 1 from public.hotel_file_upload_scope_v1(
      v_company, v_upload, repeat('I', 43)
    )
  ) then
    raise exception 'expired upload restored scope';
  end if;
end
$upload_scope$;

rollback;

select 'HOTEL_FILE_UPLOAD_SCOPE_OK' as result;
