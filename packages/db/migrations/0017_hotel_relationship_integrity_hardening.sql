begin;

do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0016_hotel_relationship_management'
  ) then
    raise exception 'migration 0016 must be applied first' using errcode = '55000';
  end if;
end
$$;

alter table hotel_staff_assignments
  drop constraint hotel_staff_assignments_termination_shape,
  add constraint hotel_staff_assignments_termination_shape check (
    (terminated_at is null and termination_reason is null and terminated_by is null)
    or (
      terminated_at is not null
      and termination_reason is not null
      and btrim(termination_reason) <> ''
      and terminated_by is not null
      and end_date is not null
    )
  );

alter table housekeeping_hotel_links
  drop constraint housekeeping_hotel_links_termination_shape,
  add constraint housekeeping_hotel_links_termination_shape check (
    (terminated_at is null and termination_reason is null and terminated_by is null)
    or (
      terminated_at is not null
      and termination_reason is not null
      and btrim(termination_reason) <> ''
      and terminated_by is not null
      and end_date is not null
    )
  );

alter table hotel_owner_assignments
  drop constraint hotel_owner_assignments_termination_shape,
  add constraint hotel_owner_assignments_termination_shape check (
    (terminated_at is null and termination_reason is null and terminated_by is null)
    or (
      terminated_at is not null
      and termination_reason is not null
      and btrim(termination_reason) <> ''
      and terminated_by is not null
      and end_date is not null
    )
  );

insert into schema_migrations (version)
values ('0017_hotel_relationship_integrity_hardening');

commit;
