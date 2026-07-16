begin;

do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0002_auth_session_runtime'
  ) then
    raise exception 'auth session runtime migration must be applied first' using errcode = '55000';
  end if;
  if exists (select 1 from hotel_profiles) then
    raise exception 'existing hotel profiles require an approved basic-information backfill' using errcode = '55000';
  end if;
end;
$$;

alter table hotel_profiles
  add column road_address text not null,
  add column detail_address text not null,
  add column representative_phone text not null,
  add column contract_start_date date not null,
  add column contract_end_date date not null,
  add constraint hotel_profiles_road_address_nonempty
    check (btrim(road_address) <> ''),
  add constraint hotel_profiles_representative_phone_format
    check (representative_phone ~ '^[0-9+() -]{8,30}$'),
  add constraint hotel_profiles_contract_period
    check (contract_end_date >= contract_start_date);

alter table branches
  add constraint branches_branch_code_canonical_check
    check (
      branch_code = upper(btrim(branch_code))
      and branch_code ~ '^[A-Z0-9][A-Z0-9_-]*$'
    );

alter table idempotency_records
  add constraint idempotency_records_completed_result_check
    check (
      status <> 'COMPLETED'
      or (
        completed_at is not null
        and resource_type is not null
        and resource_id is not null
        and audit_event_id is not null
        and result_snapshot is not null
      )
    );

create unique index branches_active_hotel_name_unique_idx
  on branches (company_id, lower(btrim(name)))
  where branch_type = 'HOTEL' and status = 'ACTIVE';

alter table branches enable row level security;
alter table branches force row level security;
create policy branches_company_isolation on branches
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

alter table hotel_profiles enable row level security;
alter table hotel_profiles force row level security;
create policy hotel_profiles_company_isolation on hotel_profiles
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

insert into permissions (code, description)
values ('HOTEL_MANAGE', '호텔 생성 및 기본정보 관리')
on conflict (code) do nothing;

insert into schema_migrations (version)
values ('0003_hotel_basic_information');

commit;
