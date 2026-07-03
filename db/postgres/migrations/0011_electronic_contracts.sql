begin;

create table if not exists electronic_contracts (
  id text primary key,
  company_id text not null references companies(id),
  title text not null,
  summary text,
  contract_type text not null,
  status text not null default 'draft',
  owner_user_id text not null references users(id),
  owner_employee_id text not null references employees(id),
  file_id text references file_objects(id),
  effective_from timestamptz,
  expires_at timestamptz,
  external_provider text,
  external_contract_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint electronic_contracts_status_check check (status in ('draft', 'review_requested', 'signature_requested', 'signed', 'rejected', 'cancelled', 'expired'))
);

create table if not exists electronic_contract_parties (
  id text primary key,
  company_id text not null references companies(id),
  contract_id text not null references electronic_contracts(id) on delete cascade,
  employee_id text references employees(id),
  name text not null,
  email text,
  role text not null default 'signer',
  signing_order integer not null default 1,
  status text not null default 'pending',
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint electronic_contract_parties_role_check check (role in ('owner', 'reviewer', 'signer', 'observer')),
  constraint electronic_contract_parties_status_check check (status in ('pending', 'requested', 'signed', 'rejected', 'cancelled'))
);

create index if not exists idx_electronic_contracts_company_status on electronic_contracts(company_id, status, created_at desc);
create index if not exists idx_electronic_contracts_company_file on electronic_contracts(company_id, file_id) where file_id is not null;
create index if not exists idx_electronic_contract_parties_contract_order on electronic_contract_parties(contract_id, signing_order, id);
create index if not exists idx_electronic_contract_parties_employee on electronic_contract_parties(company_id, employee_id, status) where employee_id is not null;

commit;
