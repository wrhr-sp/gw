begin;

create or replace function public.hotel_process_default_read_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_snapshot jsonb;
begin
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id,
      p_branch_id,
      p_session_token,
      'PROCESS_DEFINITION_MANAGE',
      true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select pg_catalog.jsonb_build_object(
    'hotelId', default_record.branch_id,
    'applicationType', default_record.application_type,
    'definition', public.process_definition_snapshot_v1(
      default_record.company_id,
      default_record.definition_id
    ),
    'version', default_record.version,
    'updatedAt', default_record.updated_at
  )
    into v_snapshot
    from public.hotel_process_defaults default_record
   where default_record.company_id = p_company_id
     and default_record.branch_id = p_branch_id
     and default_record.application_type = 'ROOM_INSPECTION';

  return query select 'OK'::text, v_snapshot;
end
$function$;

revoke all on function public.hotel_process_default_read_v1(uuid, uuid, text) from public;

insert into schema_migrations (version)
values ('0028_hotel_process_default_read_contract');

commit;
