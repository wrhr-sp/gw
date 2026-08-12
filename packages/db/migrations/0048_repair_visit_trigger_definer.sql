begin;

-- Deferred constraint triggers run at transaction commit under the invoking
-- role. Keep table privileges private and execute the existing cardinality
-- guard with its migration-owner authority and a fixed catalog search path.
alter function public.repair_visit_performer_cardinality() security definer;
alter function public.repair_visit_performer_cardinality() set search_path = pg_catalog;
revoke all on function public.repair_visit_performer_cardinality() from public;

insert into public.schema_migrations(version)
values ('0048_repair_visit_trigger_definer')
on conflict (version) do nothing;

commit;
