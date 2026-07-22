begin;

-- CONTRACT runs only after Preview bootstrap alias alignment and strict Worker deploy.
do $canonical_login_preflight$
begin
  if exists (
    select 1
    from public.users
    where login_name is not null
      and login_name !~ '^[a-z0-9]{3,30}$'
  ) then
    raise exception 'non-canonical login ID requires operator remediation'
      using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.users
    where login_name in (
      'admin', 'administrator', 'root', 'system', 'security', 'api',
      'service', 'support', 'test', 'preview', 'werehere'
    )
  ) then
    raise exception 'reserved login ID requires operator remediation'
      using errcode = '23514';
  end if;
end
$canonical_login_preflight$;

alter table public.users
  add constraint users_login_name_format_check
  check (login_name is null or login_name ~ '^[a-z0-9]{3,30}$');

alter table public.users
  add constraint users_login_name_reserved_check check (
      login_name is null or login_name not in (
        'admin', 'administrator', 'root', 'system', 'security', 'api',
        'service', 'support', 'test', 'preview', 'werehere'
      )
    ),
    add constraint users_login_name_registry_fk foreign key (
      login_name, company_id, id
    ) references public.login_id_registry (
      login_id, company_id, target_user_id
    );

drop policy login_id_registry_company_isolation on public.login_id_registry;
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
      else false
    end
  );

insert into public.schema_migrations (version)
values ('0010_global_login_id_contract');

commit;
