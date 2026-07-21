begin;

revoke usage on schema public from public;

-- Fail closed if a provider subject resolves to more than one principal.
do $auth_owner_grant$
begin
  execute pg_catalog.format(
    'grant werehere_auth_session_definer to %I with inherit false, set true',
    current_user
  );
end
$auth_owner_grant$;

grant create on schema public to werehere_auth_session_definer;
set local role werehere_auth_session_definer;

create or replace function public.auth_create_session_v2(
  p_session_id uuid,
  p_token_hash bytea,
  p_provider_subject text,
  p_idle_lifetime_seconds integer,
  p_absolute_lifetime_seconds integer,
  p_auth_time timestamptz,
  p_trace_id uuid
)
returns table (
  result_status text,
  company_id uuid,
  identity_id uuid,
  session_id uuid,
  user_id uuid,
  user_type text,
  display_name text,
  must_change_password boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_principal record;
  v_inserted_session_id uuid;
begin
  if p_session_id is null
     or p_token_hash is null
     or pg_catalog.octet_length(p_token_hash) <> 32
     or p_provider_subject is null
     or p_provider_subject <> pg_catalog.btrim(p_provider_subject)
     or pg_catalog.octet_length(p_provider_subject) not between 1 and 1024
     or p_idle_lifetime_seconds is null
     or p_idle_lifetime_seconds not between 60 and 28800
     or p_absolute_lifetime_seconds is null
     or p_absolute_lifetime_seconds < p_idle_lifetime_seconds
     or p_absolute_lifetime_seconds > 86400
     or p_auth_time is null
     or p_auth_time > v_now + interval '5 minutes'
     or p_trace_id is null
  then
    raise exception 'invalid auth session request' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.runtime_database_capabilities capability_record
    where capability_record.role_name = session_user
      and capability_record.capability = 'API_RUNTIME'
  ) then
    return query select 'RUNTIME_DENIED'::text,
      null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::boolean;
    return;
  end if;

  begin
    select identity.company_id,
           identity.id as identity_id,
           identity.user_id,
           app_user.user_type,
           app_user.display_name,
           app_user.must_change_password,
           app_user.status as user_status,
           company.status as company_status
    into strict v_principal
    from public.auth_identities identity
    join public.users app_user
      on app_user.company_id = identity.company_id
     and app_user.id = identity.user_id
    join public.companies company on company.id = identity.company_id
    where identity.provider = 'ZITADEL'
      and identity.provider_subject = p_provider_subject
    for share of identity, app_user, company;
  exception
    when no_data_found then
      return query select 'IDENTITY_NOT_PROVISIONED'::text,
        null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::boolean;
      return;
    when too_many_rows then
      raise exception 'ambiguous auth identity' using errcode = '21000';
  end;

  if v_principal.user_status not in ('ACTIVE', 'PENDING_SETUP')
     or v_principal.company_status <> 'ACTIVE' then
    return query select 'PRINCIPAL_INACTIVE'::text,
      null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::boolean;
    return;
  end if;

  insert into public.auth_sessions (
    id, company_id, user_id, identity_id, token_hash,
    created_at, last_seen_at, idle_expires_at, absolute_expires_at,
    auth_time, authentication_method
  ) values (
    p_session_id, v_principal.company_id, v_principal.user_id,
    v_principal.identity_id, p_token_hash,
    v_now, v_now,
    v_now + pg_catalog.make_interval(secs => p_idle_lifetime_seconds),
    v_now + pg_catalog.make_interval(secs => p_absolute_lifetime_seconds),
    p_auth_time, 'OIDC_PKCE'
  ) returning id into v_inserted_session_id;

  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id,
    company_id, resource_type, resource_id, after_summary, result, trace_id
  ) values (
    pg_catalog.gen_random_uuid(), 'AUTH_LOGIN_SUCCEEDED', v_principal.user_id,
    v_principal.user_type, v_inserted_session_id, v_principal.company_id,
    'SESSION', v_inserted_session_id,
    pg_catalog.jsonb_build_object('authenticationMethod', 'OIDC_PKCE'),
    'SUCCEEDED', p_trace_id
  );

  return query select 'CREATED'::text, session_record.company_id,
    session_record.identity_id, session_record.id, session_record.user_id,
    v_principal.user_type::text, v_principal.display_name::text,
    v_principal.must_change_password::boolean
  from public.auth_sessions session_record
  where session_record.id = v_inserted_session_id;
  if not found then
    raise exception 'auth session read-back failed' using errcode = 'P0001';
  end if;
end
$function$;

reset role;
revoke create on schema public from werehere_auth_session_definer;

do $auth_owner_revoke$
begin
  execute pg_catalog.format(
    'revoke werehere_auth_session_definer from %I granted by %I',
    current_user,
    current_user
  );
end
$auth_owner_revoke$;

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
