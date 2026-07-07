-- 사용자 보안 설정 preview DB 영속화
-- 2차 비밀번호는 원문 PIN을 저장하지 않고 salt+hash만 저장한다.

begin;

create table if not exists user_security_settings (
  id text primary key,
  company_id text not null references companies(id),
  user_id text not null references users(id),
  secondary_password_hash text,
  secondary_password_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists idx_user_security_settings_user
  on user_security_settings(company_id, user_id);

commit;
