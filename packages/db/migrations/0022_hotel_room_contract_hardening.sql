begin;

do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0019_hotel_room_management'
  ) or not exists (
    select 1 from schema_migrations where version = '0015_neon_definer_contract_hardening'
  ) then
    raise exception 'room EXPAND and platform CONTRACT migrations must be applied first'
      using errcode = '55000';
  end if;
end
$$;

do $room_contract_policies$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'hotel_room_types',
    'hotel_rooms',
    'hotel_room_status_history'
  ]
  loop
    execute format(
      'drop policy if exists %I_company_isolation on public.%I',
      tenant_table,
      tenant_table
    );
    execute format(
      'create policy %I_company_isolation on public.%I using (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          else false
        end
      ) with check (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          else false
        end
      )',
      tenant_table,
      tenant_table
    );
  end loop;
end
$room_contract_policies$;

insert into schema_migrations (version)
values ('0022_hotel_room_contract_hardening');

commit;
