begin;

revoke usage on schema public from public;

-- The legacy request-scoped company GUC authority is intentionally removed. Runtimes without a
-- registered capability now fail closed; API tenant scope is derived only from an
-- active server-side session and reconciler scope only from its registry.
do $tenant_authority$
declare
  tenant_table text;
  tenant_key text;
  policy_name text;
begin
  for tenant_table, policy_name in
    select * from (values
      ('companies', 'companies_company_isolation'),
      ('users', 'users_company_isolation'),
      ('auth_identities', 'auth_identities_company_isolation'),
      ('auth_sessions', 'auth_sessions_company_isolation'),
      ('branches', 'branches_company_isolation'),
      ('hotel_profiles', 'hotel_profiles_company_isolation'),
      ('roles', 'roles_company_isolation'),
      ('user_groups', 'user_groups_company_isolation'),
      ('user_group_memberships', 'user_group_memberships_company_isolation'),
      ('user_role_memberships', 'user_role_memberships_company_isolation'),
      ('permission_grants', 'permission_grants_company_isolation'),
      ('audit_events', 'audit_events_company_isolation'),
      ('idempotency_records', 'idempotency_records_company_isolation'),
      ('outbox_jobs', 'outbox_jobs_company_isolation'),
      ('account_provisioning_attempts', 'account_provisioning_attempts_company_isolation'),
      ('initial_password_change_attempts', 'initial_password_change_attempts_company_isolation'),
      ('hotel_staff_assignments', 'hotel_staff_assignments_company_isolation'),
      ('housekeeping_hotel_links', 'housekeeping_hotel_links_company_isolation'),
      ('hotel_owner_assignments', 'hotel_owner_assignments_company_isolation')
    ) policies(table_name, policy_name)
  loop
    tenant_key := case when tenant_table = 'companies' then 'id' else 'company_id' end;
    execute pg_catalog.format('drop policy if exists %I on public.%I', policy_name, tenant_table);
    execute pg_catalog.format('alter table public.%I enable row level security', tenant_table);
    execute pg_catalog.format('alter table public.%I force row level security', tenant_table);
    execute pg_catalog.format(
      'create policy %I on public.%I using (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then %I = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then %I = public.reconciler_current_company_id()
          else false
        end
      ) with check (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then %I = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then %I = public.reconciler_current_company_id()
          else false
        end
      )',
      policy_name, tenant_table,
      tenant_key, tenant_key,
      tenant_key, tenant_key
    );
  end loop;
end
$tenant_authority$;

insert into public.schema_migrations (version)
values ('0008_remove_legacy_company_id_fallback');

commit;
