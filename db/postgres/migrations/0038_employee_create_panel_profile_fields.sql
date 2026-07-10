-- HR employee create/detail panel persistence fields
-- 목적: 사원생성패널에서 입력받는 비민감 프로필 값을 운영 DB employees row에 저장한다.
-- 주민등록번호 원문은 민감정보이므로 이 migration 범위에서 저장하지 않는다.

begin;

alter table employees add column if not exists contact_phone text;
alter table employees add column if not exists external_email text;
alter table employees add column if not exists address_postal_code text;
alter table employees add column if not exists address_base text;
alter table employees add column if not exists address_detail text;
alter table employees add column if not exists recognized_hire_date date;
alter table employees add column if not exists employment_category text;

create index if not exists idx_employees_contact_phone on employees(company_id, contact_phone) where deleted_at is null and contact_phone is not null;
create index if not exists idx_employees_external_email on employees(company_id, lower(external_email)) where deleted_at is null and external_email is not null;

commit;
