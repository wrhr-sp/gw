begin;

-- Existing rows must be globally unambiguous before the application starts resolving
-- a short login ID without a company selector.
do $global_login_preflight$
begin
  if exists (
    select 1
    from public.users
    where login_name is not null
    group by pg_catalog.lower(pg_catalog.btrim(login_name))
    having count(*) > 1
  ) then
    raise exception 'global login ID collision requires operator remediation'
      using errcode = '23505';
  end if;
end
$global_login_preflight$;

create unique index users_login_name_global_unique_idx
  on public.users (pg_catalog.lower(pg_catalog.btrim(login_name)))
  where login_name is not null;

create table public.login_id_registry (
  login_id text primary key check (
    login_id ~ '^[a-z0-9]{3,30}$'
    and login_id not in (
      'admin', 'administrator', 'root', 'system', 'security', 'api',
      'service', 'support', 'test', 'preview', 'werehere'
    )
  ),
  company_id uuid not null references public.companies(id),
  target_user_id uuid not null,
  actor_user_id uuid,
  idempotency_key text,
  request_hash text,
  claimed_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (login_id, company_id, target_user_id),
  unique (company_id, target_user_id),
  unique (company_id, actor_user_id, idempotency_key),
  foreign key (company_id, actor_user_id) references public.users(company_id, id),
  check (
    (actor_user_id is null and idempotency_key is null and request_hash is null)
    or
    (actor_user_id is not null and idempotency_key is not null and request_hash is not null
      and pg_catalog.btrim(idempotency_key) <> ''
      and pg_catalog.btrim(request_hash) <> '')
  )
);

alter table public.login_id_registry enable row level security;
create policy login_id_registry_company_isolation on public.login_id_registry
  using (
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_auth_session_definer' then true
      when current_user = 'werehere_tenant_authority_definer' then true
      when public.runtime_has_capability('API_RUNTIME')
        then company_id = public.api_current_company_id()
      when public.runtime_has_capability('RECONCILER')
        then company_id = public.reconciler_current_company_id()
      when not public.runtime_has_capability('API_RUNTIME')
        and not public.runtime_has_capability('RECONCILER')
        then company_id = nullif(current_setting('app.company_id', true), '')::uuid
      else false
    end
  )
  with check (
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_auth_session_definer' then true
      when current_user = 'werehere_tenant_authority_definer' then true
      when public.runtime_has_capability('API_RUNTIME')
        then company_id = public.api_current_company_id()
      when public.runtime_has_capability('RECONCILER')
        then company_id = public.reconciler_current_company_id()
      when not public.runtime_has_capability('API_RUNTIME')
        and not public.runtime_has_capability('RECONCILER')
        then company_id = nullif(current_setting('app.company_id', true), '')::uuid
      else false
    end
  );

create function public.prevent_login_id_registry_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception 'login ID registry rows are immutable' using errcode = '55000';
end
$function$;
revoke all privileges on function public.prevent_login_id_registry_mutation() from public;
create trigger login_id_registry_immutable
before update or delete on public.login_id_registry
for each row execute function public.prevent_login_id_registry_mutation();

insert into public.login_id_registry (login_id, company_id, target_user_id)
select app_user.login_name, app_user.company_id, app_user.id
from public.users app_user
where app_user.login_name ~ '^[a-z0-9]{3,30}$'
  and app_user.login_name not in (
    'admin', 'administrator', 'root', 'system', 'security', 'api',
    'service', 'support', 'test', 'preview', 'werehere'
  );

alter table public.login_id_registry force row level security;

-- Login is unauthenticated, so tenant RLS cannot safely resolve this mapping directly.
-- A narrow definer returns only the provider subject for one active canonical ID.
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

create function public.auth_resolve_login_identity_v1(p_login_name text)
returns table (provider_subject text)
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select identity.provider_subject
  from public.users app_user
  join public.companies company on company.id = app_user.company_id
  join public.auth_identities identity
    on identity.company_id = app_user.company_id
   and identity.user_id = app_user.id
   and identity.provider = 'ZITADEL'
  where app_user.login_name = p_login_name
    and app_user.status in ('ACTIVE', 'PENDING_SETUP')
    and company.status = 'ACTIVE'
$function$;

revoke all privileges on function public.auth_resolve_login_identity_v1(text) from public;
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

insert into public.schema_migrations (version)
values ('0009_global_login_id_expand');

commit;
