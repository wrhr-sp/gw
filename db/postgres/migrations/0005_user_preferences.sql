-- 사용자별 UI/설정 preview DB 영속화
-- 기본 설정, 알림 설정, 사이드바 커스텀, 하단바 접힘 상태, 관리자 설정 preview 토글을 JSONB로 보관한다.

begin;

create table if not exists user_preferences (
  id text primary key,
  company_id text not null references companies(id),
  user_id text not null references users(id),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists idx_user_preferences_user
  on user_preferences(company_id, user_id);

commit;
