create table if not exists messenger_thread_members (
  company_id text not null,
  thread_id text not null,
  user_id text not null,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, thread_id, user_id),
  constraint messenger_thread_members_company_fk foreign key (company_id) references companies(id) on delete cascade,
  constraint messenger_thread_members_user_fk foreign key (user_id) references users(id) on delete cascade
);

create index if not exists idx_messenger_thread_members_user_active
  on messenger_thread_members(company_id, user_id, thread_id)
  where left_at is null;

create index if not exists idx_messenger_thread_members_user_left
  on messenger_thread_members(company_id, user_id, left_at desc)
  where left_at is not null;
