-- Forward correction: authenticated uploaders must be able to poll their own
-- upload after completion moves it beyond PENDING_UPLOAD.

begin;

create or replace function public.hotel_file_upload_scope_v1(
  p_company_id uuid,
  p_upload_id uuid,
  p_session_token text
)
returns table(branch_id uuid)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_upload record;
begin
  select
    upload.branch_id,
    upload.initiated_by,
    upload.initiated_session_id
  into v_upload
  from public.hotel_file_uploads upload
  where upload.company_id = p_company_id
    and upload.id = p_upload_id
  for share;

  if not found then
    return;
  end if;

  select * into v_actor
  from public.hotel_command_actor_v1(
    p_company_id,
    v_upload.branch_id,
    p_session_token,
    'HOTEL_FILE_UPLOAD',
    true
  );

  if not found
     or v_upload.initiated_by <> v_actor.user_id
     or v_upload.initiated_session_id <> v_actor.session_id then
    return;
  end if;

  return query select v_upload.branch_id::uuid;
end
$function$;

revoke all on function public.hotel_file_upload_scope_v1(uuid, uuid, text) from public;

insert into public.schema_migrations (version)
values ('0054_file_upload_polling_scope_correction')
on conflict (version) do nothing;

commit;
