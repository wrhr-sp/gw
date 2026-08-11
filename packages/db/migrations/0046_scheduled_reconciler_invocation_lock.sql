begin;

-- Generic scheduled Reconciler invocation lock. This survives retirement of any
-- individual provider and must be available during EXPAND before a new Worker runs.
create or replace function public.scheduled_reconciler_invocation_enter_v1()
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.runtime_has_capability('RECONCILER') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  perform pg_catalog.pg_advisory_lock_shared(
    pg_catalog.hashtextextended('werehere:scheduled-reconciler:v1', 0)
  );
end
$function$;
revoke all on function public.scheduled_reconciler_invocation_enter_v1() from public;

create or replace function public.scheduled_reconciler_invocation_exit_v1()
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.runtime_has_capability('RECONCILER') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not pg_catalog.pg_advisory_unlock_shared(
    pg_catalog.hashtextextended('werehere:scheduled-reconciler:v1', 0)
  ) then
    raise exception using
      errcode = '55000',
      message = 'RECONCILER_INVOCATION_LOCK_NOT_HELD';
  end if;
end
$function$;
revoke all on function public.scheduled_reconciler_invocation_exit_v1() from public;

create or replace function public.scheduled_reconciler_drain_barrier_v1()
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.runtime_has_capability('RECONCILER') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('werehere:scheduled-reconciler:v1', 0)
  );
end
$function$;
revoke all on function public.scheduled_reconciler_drain_barrier_v1() from public;

insert into public.schema_migrations(version)
values ('0046_scheduled_reconciler_invocation_lock')
on conflict (version) do nothing;

commit;
