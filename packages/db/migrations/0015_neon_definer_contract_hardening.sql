begin;

do $ownership_grant$
begin
  execute pg_catalog.format(
    'grant werehere_tenant_authority_definer to %I with inherit false, set true',
    current_user
  );
end
$ownership_grant$;

grant create on schema public to werehere_tenant_authority_definer;

set local role werehere_tenant_authority_definer;

create or replace function public.runtime_is_schema_owner()
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
              and not (
                membership.member = (
                  select database_record.datdba
                  from pg_catalog.pg_database database_record
                  where database_record.datname = pg_catalog.current_database()
                )
                and membership.grantor = (
                  select grantor_role.oid
                  from pg_catalog.pg_roles grantor_role
                  where grantor_role.rolname = 'cloud_admin'
                    and grantor_role.rolsuper
                )
                and membership.admin_option
                and not membership.inherit_option
                and not membership.set_option
              )
            )
        )
        and (
          select pg_catalog.count(*) = 0
            or (
              pg_catalog.count(*) = 2
              and pg_catalog.count(distinct granted_role.rolname) = 2
              and pg_catalog.bool_and(
                membership.member = database_record.datdba
                and grantor_role.rolname = 'cloud_admin'
                and grantor_role.rolsuper
                and membership.admin_option
                and not membership.inherit_option
                and not membership.set_option
              )
            )
          from pg_catalog.pg_auth_members membership
          join pg_catalog.pg_roles granted_role
            on granted_role.oid = membership.roleid
          join pg_catalog.pg_roles grantor_role
            on grantor_role.oid = membership.grantor
          join pg_catalog.pg_database database_record
            on database_record.datname = pg_catalog.current_database()
          where granted_role.rolname in (
            'werehere_auth_session_definer',
            'werehere_tenant_authority_definer'
          )
        )
    )
  from pg_catalog.pg_class table_record
  join pg_catalog.pg_namespace table_namespace
    on table_namespace.oid = table_record.relnamespace
  where table_namespace.nspname = 'public'
    and table_record.relname = 'companies'
$function$;

reset role;

revoke create on schema public from werehere_tenant_authority_definer;

do $ownership_revoke$
begin
  execute pg_catalog.format(
    'revoke werehere_tenant_authority_definer from %I granted by %I',
    current_user,
    current_user
  );
end
$ownership_revoke$;

insert into public.schema_migrations(version)
values ('0015_neon_definer_contract_hardening')
on conflict (version) do nothing;

commit;
