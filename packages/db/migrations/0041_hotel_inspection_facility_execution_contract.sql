-- CONTRACT: switch item snapshot capture only after the compatibility Worker
-- accepts the additive 0040 facility execution schema and commands.

drop trigger inspection_item_execution_target_capture
  on public.inspection_item_snapshots;
drop trigger inspection_item_room_snapshot_capture
  on public.inspection_item_snapshots;

create trigger inspection_item_execution_target_capture
before insert on public.inspection_item_snapshots
for each row execute function public.inspection_item_execution_target_capture_v2();

insert into public.schema_migrations(version)
values ('0041_hotel_inspection_facility_execution_contract');
