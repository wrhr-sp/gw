begin;

create table if not exists fleet_vehicles (
  id text primary key,
  company_id text not null references companies(id),
  vehicle_number text not null,
  display_name text not null,
  fuel_type text not null default 'gasoline',
  default_driver_employee_id text references employees(id),
  odometer_km numeric(12, 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fleet_vehicles_fuel_type_check check (fuel_type in ('gasoline', 'diesel', 'lpg', 'electric', 'hybrid', 'hydrogen', 'other')),
  constraint fleet_vehicles_company_number_unique unique (company_id, vehicle_number)
);

create table if not exists vehicle_operation_logs (
  id text primary key,
  company_id text not null references companies(id),
  vehicle_id text not null references fleet_vehicles(id),
  driver_user_id text not null references users(id),
  driver_employee_id text not null references employees(id),
  operation_date date not null,
  purpose text not null,
  purpose_detail text,
  departure_place text not null,
  arrival_place text not null,
  started_at timestamptz,
  ended_at timestamptz,
  start_odometer_km numeric(12, 1),
  end_odometer_km numeric(12, 1),
  distance_km numeric(12, 1) not null default 0,
  fuel_cost integer not null default 0,
  toll_cost integer not null default 0,
  parking_cost integer not null default 0,
  other_cost integer not null default 0,
  memo text,
  status text not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vehicle_operation_logs_purpose_check check (purpose in ('sales', 'delivery', 'commute', 'site_visit', 'maintenance', 'other')),
  constraint vehicle_operation_logs_status_check check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  constraint vehicle_operation_logs_odometer_check check (start_odometer_km is null or end_odometer_km is null or end_odometer_km >= start_odometer_km)
);

create index if not exists idx_fleet_vehicles_company_active on fleet_vehicles(company_id, is_active, vehicle_number) where deleted_at is null;
create index if not exists idx_vehicle_operation_logs_company_date on vehicle_operation_logs(company_id, operation_date desc, created_at desc) where deleted_at is null;
create index if not exists idx_vehicle_operation_logs_vehicle_date on vehicle_operation_logs(company_id, vehicle_id, operation_date desc) where deleted_at is null;
create index if not exists idx_vehicle_operation_logs_driver_date on vehicle_operation_logs(company_id, driver_employee_id, operation_date desc) where deleted_at is null;

insert into fleet_vehicles (id, company_id, vehicle_number, display_name, fuel_type, default_driver_employee_id, odometer_km, created_at, updated_at)
select 'vehicle_demo_1', 'company_demo', '12가3456', '업무용 차량 1호', 'hybrid', 'employee_admin', 12500.0, now(), now()
where exists (select 1 from companies where id = 'company_demo')
  and exists (select 1 from employees where id = 'employee_admin')
on conflict (company_id, vehicle_number) do update
set display_name = excluded.display_name,
    fuel_type = excluded.fuel_type,
    default_driver_employee_id = excluded.default_driver_employee_id,
    updated_at = now(),
    deleted_at = null;

commit;
