begin;

do $$
begin
  if not exists (
    select 1 from schema_migrations
    where version = '0017_hotel_relationship_integrity_hardening'
  ) then
    raise exception 'migration 0017 must be applied first' using errcode = '55000';
  end if;
end
$$;

alter table hotel_staff_assignments
  add constraint hotel_staff_assignments_support_hotel_period_excl
  exclude using gist (
    company_id with =,
    branch_id with =,
    user_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (assignment_type = 'SUPPORT' and terminated_at is null);

insert into schema_migrations (version)
values ('0018_hotel_support_assignment_overlap');

commit;
