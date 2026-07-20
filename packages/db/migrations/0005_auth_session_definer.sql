begin;

revoke create on schema public from public;

do $role$
declare
  v_role record;
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'werehere_auth_session_definer') then
    create role werehere_auth_session_definer
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;

  select * into v_role
  from pg_catalog.pg_roles
  where rolname = 'werehere_auth_session_definer';
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
    raise exception 'unsafe auth session definer role' using errcode = '42501';
  end if;
end
$role$;

create or replace function public.auth_create_session(
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
  display_name text
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

  select identity.company_id,
         identity.id as identity_id,
         identity.user_id,
         app_user.user_type,
         app_user.display_name,
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
    return query select
      'IDENTITY_NOT_PROVISIONED'::text,
      null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  if v_principal.user_status <> 'ACTIVE' or v_principal.company_status <> 'ACTIVE' then
    return query select
      'PRINCIPAL_INACTIVE'::text,
      null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text;
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
    company_id, resource_type, resource_id, after_summary,
    result, trace_id
  ) values (
    pg_catalog.gen_random_uuid(), 'AUTH_LOGIN_SUCCEEDED', v_principal.user_id,
    v_principal.user_type, v_inserted_session_id, v_principal.company_id,
    'SESSION', v_inserted_session_id,
    pg_catalog.jsonb_build_object('authenticationMethod', 'OIDC_PKCE'),
    'SUCCEEDED', p_trace_id
  );

  return query
    select 'CREATED'::text,
           session_record.company_id,
           session_record.identity_id,
           session_record.id,
           session_record.user_id,
           v_principal.user_type::text,
           v_principal.display_name::text
    from public.auth_sessions session_record
    where session_record.id = v_inserted_session_id;
  if not found then
    raise exception 'auth session read-back failed' using errcode = 'P0001';
  end if;
end
$function$;

grant create on schema public to werehere_auth_session_definer;
do $ownership_grant$
begin
  execute pg_catalog.format(
    'grant werehere_auth_session_definer to %I with inherit false, set true',
    current_user
  );
end
$ownership_grant$;

alter function public.auth_create_session(
  uuid, bytea, text, integer, integer, timestamptz, uuid
) owner to werehere_auth_session_definer;

set local role werehere_auth_session_definer;
revoke all on function public.auth_create_session(
  uuid, bytea, text, integer, integer, timestamptz, uuid
) from public;
reset role;

do $ownership_revoke$
begin
  execute pg_catalog.format(
    'revoke werehere_auth_session_definer from %I granted by %I',
    current_user,
    current_user
  );
end
$ownership_revoke$;
revoke create on schema public from werehere_auth_session_definer;

grant usage on schema public to werehere_auth_session_definer;
grant select, update on public.auth_identities, public.users, public.companies
  to werehere_auth_session_definer;
grant select, insert on public.auth_sessions to werehere_auth_session_definer;
grant insert on public.audit_events to werehere_auth_session_definer;

insert into public.schema_migrations (version)
values ('0005_auth_session_definer');

commit;
