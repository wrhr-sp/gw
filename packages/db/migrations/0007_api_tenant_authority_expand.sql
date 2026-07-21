begin;

revoke create on schema public from public;

create table public.runtime_database_capabilities (
  role_name name primary key,
  capability text not null check (capability in ('API_RUNTIME', 'RECONCILER')),
  provisioned_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (role_name, capability)
);
revoke all on public.runtime_database_capabilities from public;

do $roles$
declare
  v_role record;
  v_role_name text;
begin
  foreach v_role_name in array array['werehere_auth_session_definer', 'werehere_tenant_authority_definer'] loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = v_role_name) then
      if v_role_name = 'werehere_auth_session_definer' then
        raise exception 'auth session definer role from migration 0005 is missing' using errcode = '42501';
      end if;
      create role werehere_tenant_authority_definer
        nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    end if;

    select * into v_role from pg_catalog.pg_roles where rolname = v_role_name;
    if v_role.rolcanlogin or v_role.rolinherit or v_role.rolsuper or v_role.rolcreatedb
      or v_role.rolcreaterole or v_role.rolreplication or v_role.rolbypassrls
      or exists (
        select 1 from pg_catalog.pg_auth_members membership
        where membership.member = v_role.oid
          or (
            membership.roleid = v_role.oid
            and (membership.inherit_option or membership.set_option)
          )
      ) then
      raise exception 'unsafe definer role: %', v_role_name using errcode = '42501';
    end if;
  end loop;
end
$roles$;

create function public.runtime_is_schema_owner()
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  select current_user = pg_catalog.pg_get_userbyid(table_record.relowner)
    or exists (
      select 1
      from pg_catalog.pg_roles trusted_definer
      where trusted_definer.rolname = current_user
        and trusted_definer.rolname in (
          'werehere_auth_session_definer',
          'werehere_tenant_authority_definer'
        )
        and not trusted_definer.rolcanlogin
        and not trusted_definer.rolinherit
        and not trusted_definer.rolsuper
        and not trusted_definer.rolcreatedb
        and not trusted_definer.rolcreaterole
        and not trusted_definer.rolreplication
        and not trusted_definer.rolbypassrls
        and not exists (
          select 1
          from pg_catalog.pg_auth_members membership
          where membership.member = trusted_definer.oid
            or (
              membership.roleid = trusted_definer.oid
              and (membership.inherit_option or membership.set_option)
            )
        )
    )
  from pg_catalog.pg_class table_record
  join pg_catalog.pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
  where table_namespace.nspname = 'public'
    and table_record.relname = 'companies'
$function$;

create function public.runtime_has_capability(required_capability text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.runtime_database_capabilities capability_record
    where capability_record.role_name = session_user
      and capability_record.capability = required_capability
  )
$function$;

create function public.api_current_company_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select session_record.company_id
  from public.auth_sessions session_record
  join public.users app_user
    on app_user.company_id = session_record.company_id
   and app_user.id = session_record.user_id
  join public.companies company on company.id = session_record.company_id
  where public.runtime_has_capability('API_RUNTIME')
    and session_record.id = nullif(pg_catalog.current_setting('app.session_id', true), '')::uuid
    and session_record.revoked_at is null
    and session_record.idle_expires_at > pg_catalog.statement_timestamp()
    and session_record.absolute_expires_at > pg_catalog.statement_timestamp()
    and app_user.status in ('ACTIVE', 'PENDING_SETUP')
    and company.status = 'ACTIVE'
$function$;

create function public.reconciler_current_company_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select registry.company_id
  from public.reconciliation_company_registry registry
  where public.runtime_has_capability('RECONCILER')
    and registry.company_status = 'ACTIVE'
    and registry.company_id = nullif(
      pg_catalog.current_setting('app.reconciler_company_id', true), ''
    )::uuid
$function$;

create function public.auth_create_session_v2(
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

  select identity.company_id,
         identity.id as identity_id,
         identity.user_id,
         app_user.user_type,
         app_user.display_name,
         app_user.must_change_password,
         app_user.status as user_status,
         company.status as company_status
  into v_principal
  from public.auth_identities identity
  join public.users app_user
    on app_user.company_id = identity.company_id
   and app_user.id = identity.user_id
  join public.companies company on company.id = identity.company_id
  where identity.provider = 'ZITADEL'
    and identity.provider_subject = p_provider_subject
  for share of identity, app_user, company;

  if not found then
    return query select 'IDENTITY_NOT_PROVISIONED'::text,
      null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::boolean;
    return;
  end if;

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

create function public.auth_resolve_principal_v2(
  p_token_hash bytea,
  p_idle_lifetime_seconds integer
)
returns table (
  company_id uuid,
  identity_id uuid,
  session_id uuid,
  user_id uuid,
  user_type text,
  display_name text,
  must_change_password boolean
)
language sql
security definer
set search_path = pg_catalog
as $function$
  with active_principal as (
    select session_record.id as session_id,
           session_record.company_id,
           session_record.identity_id,
           session_record.user_id,
           app_user.user_type,
           app_user.display_name,
           app_user.must_change_password
    from public.auth_sessions session_record
    join public.users app_user
      on app_user.company_id = session_record.company_id
     and app_user.id = session_record.user_id
    join public.companies company on company.id = session_record.company_id
    join public.auth_identities identity
      on identity.company_id = session_record.company_id
     and identity.id = session_record.identity_id
     and identity.user_id = session_record.user_id
    where exists (
        select 1
        from public.runtime_database_capabilities capability_record
        where capability_record.role_name = session_user
          and capability_record.capability = 'API_RUNTIME'
      )
      and p_token_hash is not null
      and pg_catalog.octet_length(p_token_hash) = 32
      and p_idle_lifetime_seconds between 60 and 28800
      and session_record.token_hash = p_token_hash
      and session_record.revoked_at is null
      and session_record.idle_expires_at > pg_catalog.statement_timestamp()
      and session_record.absolute_expires_at > pg_catalog.statement_timestamp()
      and app_user.status in ('ACTIVE', 'PENDING_SETUP')
      and company.status = 'ACTIVE'
      and identity.provider = 'ZITADEL'
  ), touch_session as (
    update public.auth_sessions session_record
    set last_seen_at = pg_catalog.statement_timestamp(),
        idle_expires_at = least(
          pg_catalog.statement_timestamp() + pg_catalog.make_interval(secs => p_idle_lifetime_seconds),
          session_record.absolute_expires_at
        )
    from active_principal principal
    where session_record.id = principal.session_id
      and session_record.last_seen_at <= pg_catalog.statement_timestamp() - interval '5 minutes'
    returning session_record.id
  )
  select principal.company_id, principal.identity_id, principal.session_id,
         principal.user_id, principal.user_type::text, principal.display_name::text,
         principal.must_change_password
  from active_principal principal
$function$;

create function public.auth_revoke_session_v2(
  p_token_hash bytea,
  p_reason text,
  p_trace_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_principal record;
begin
  if not exists (
       select 1
       from public.runtime_database_capabilities capability_record
       where capability_record.role_name = session_user
         and capability_record.capability = 'API_RUNTIME'
     )
     or p_token_hash is null
     or pg_catalog.octet_length(p_token_hash) <> 32
     or p_reason is null
     or pg_catalog.btrim(p_reason) = ''
     or p_trace_id is null then
    return false;
  end if;

  select session_record.company_id, session_record.identity_id,
         session_record.id as session_id, session_record.user_id, app_user.user_type
  into v_principal
  from public.auth_sessions session_record
  join public.users app_user
    on app_user.company_id = session_record.company_id
   and app_user.id = session_record.user_id
  where session_record.token_hash = p_token_hash
    and session_record.revoked_at is null
  for update of session_record;
  if not found then return false; end if;

  update public.auth_sessions
  set revoked_at = pg_catalog.statement_timestamp(), revoke_reason = p_reason
  where id = v_principal.session_id;
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id,
    company_id, resource_type, resource_id, reason, result, trace_id
  ) values (
    pg_catalog.gen_random_uuid(), 'AUTH_LOGOUT_SUCCEEDED', v_principal.user_id,
    v_principal.user_type, v_principal.session_id, v_principal.company_id,
    'SESSION', v_principal.session_id, p_reason, 'SUCCEEDED', p_trace_id
  );
  return true;
end
$function$;

create function public.auth_revoke_user_sessions_v1(
  p_company_id uuid,
  p_user_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_revoked_count integer;
begin
  if p_company_id is null
     or p_user_id is null
     or p_reason not in ('ACCOUNT_DEACTIVATED', 'INITIAL_PASSWORD_CHANGED')
     or p_company_id is distinct from public.api_current_company_id() then
    raise insufficient_privilege using message = 'active API tenant authority is required';
  end if;

  update public.auth_sessions
  set revoked_at = pg_catalog.statement_timestamp(), revoke_reason = p_reason
  where company_id = p_company_id
    and user_id = p_user_id
    and revoked_at is null;
  get diagnostics v_revoked_count = row_count;
  return v_revoked_count;
end
$function$;

-- Match migration 0005's temporary SET-only ownership membership pattern.
grant usage, create on schema public to werehere_auth_session_definer;
grant usage, create on schema public to werehere_tenant_authority_definer;
do $ownership_grant$
begin
  execute pg_catalog.format(
    'grant werehere_auth_session_definer to %I with inherit false, set true', current_user
  );
  execute pg_catalog.format(
    'grant werehere_tenant_authority_definer to %I with inherit false, set true', current_user
  );
end
$ownership_grant$;

alter function public.auth_create_session_v2(uuid, bytea, text, integer, integer, timestamptz, uuid)
  owner to werehere_auth_session_definer;
alter function public.auth_resolve_principal_v2(bytea, integer)
  owner to werehere_auth_session_definer;
alter function public.auth_revoke_session_v2(bytea, text, uuid)
  owner to werehere_auth_session_definer;
alter function public.auth_revoke_user_sessions_v1(uuid, uuid, text)
  owner to werehere_auth_session_definer;

alter table public.runtime_database_capabilities owner to werehere_tenant_authority_definer;
alter function public.runtime_is_schema_owner() owner to werehere_tenant_authority_definer;
alter function public.runtime_has_capability(text) owner to werehere_tenant_authority_definer;
alter function public.api_current_company_id() owner to werehere_tenant_authority_definer;
alter function public.reconciler_current_company_id() owner to werehere_tenant_authority_definer;
alter function public.sync_reconciliation_company_registry() owner to werehere_tenant_authority_definer;
alter function public.reconciliation_company_ids() owner to werehere_tenant_authority_definer;

set local role werehere_auth_session_definer;
revoke all on function public.auth_create_session_v2(uuid, bytea, text, integer, integer, timestamptz, uuid) from public;
revoke all on function public.auth_resolve_principal_v2(bytea, integer) from public;
revoke all on function public.auth_revoke_session_v2(bytea, text, uuid) from public;
revoke all on function public.auth_revoke_user_sessions_v1(uuid, uuid, text) from public;
reset role;

set local role werehere_tenant_authority_definer;
grant select, insert, update on public.runtime_database_capabilities to session_user;
grant select on public.runtime_database_capabilities to werehere_auth_session_definer;
revoke all on function public.runtime_is_schema_owner() from public;
revoke all on function public.runtime_has_capability(text) from public;
revoke all on function public.api_current_company_id() from public;
revoke all on function public.reconciler_current_company_id() from public;
revoke all on function public.sync_reconciliation_company_registry() from public;
revoke all on function public.reconciliation_company_ids() from public;
grant execute on function public.runtime_is_schema_owner(),
  public.runtime_has_capability(text),
  public.api_current_company_id(),
  public.reconciler_current_company_id()
  to werehere_auth_session_definer, session_user;
reset role;

do $ownership_revoke$
begin
  execute pg_catalog.format(
    'revoke werehere_auth_session_definer from %I granted by %I', current_user, current_user
  );
  execute pg_catalog.format(
    'revoke werehere_tenant_authority_definer from %I granted by %I', current_user, current_user
  );
end
$ownership_revoke$;
revoke create on schema public from werehere_auth_session_definer;
revoke create on schema public from werehere_tenant_authority_definer;

-- Exact least-privilege object access for each isolated definer.
grant usage on schema public to werehere_auth_session_definer, werehere_tenant_authority_definer;
grant select, update on public.auth_identities, public.users, public.companies
  to werehere_auth_session_definer;
grant select, insert, update on public.auth_sessions to werehere_auth_session_definer;
grant insert on public.audit_events to werehere_auth_session_definer;

grant select on public.runtime_database_capabilities,
  public.auth_sessions, public.users, public.companies,
  public.reconciliation_company_registry
  to werehere_tenant_authority_definer;
grant insert, update on public.reconciliation_company_registry
  to werehere_tenant_authority_definer;

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
          when public.runtime_has_capability(''API_RUNTIME'') then %I = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then %I = public.reconciler_current_company_id()
          when not public.runtime_has_capability(''API_RUNTIME'')
           and not public.runtime_has_capability(''RECONCILER'')
            then %I = nullif(pg_catalog.current_setting(''app.company_id'', true), '''')::uuid
          else false
        end
      ) with check (
        case
          when public.runtime_is_schema_owner() then true
          when public.runtime_has_capability(''API_RUNTIME'') then %I = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then %I = public.reconciler_current_company_id()
          when not public.runtime_has_capability(''API_RUNTIME'')
           and not public.runtime_has_capability(''RECONCILER'')
            then %I = nullif(pg_catalog.current_setting(''app.company_id'', true), '''')::uuid
          else false
        end
      )',
      policy_name, tenant_table,
      tenant_key, tenant_key, tenant_key,
      tenant_key, tenant_key, tenant_key
    );
  end loop;
end
$tenant_authority$;

insert into public.schema_migrations (version)
values ('0007_api_tenant_authority_expand');

commit;
