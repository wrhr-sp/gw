begin;

create table if not exists notice_boards (
  id text primary key,
  company_id text not null references companies (id),
  board_type text not null default 'general',
  name text not null,
  slug text not null,
  visibility text not null default 'company',
  is_notice_only integer not null default 0,
  status text not null default 'active',
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (company_id, slug)
);

create table if not exists board_posts (
  id text primary key,
  company_id text not null references companies (id),
  board_id text not null references notice_boards (id),
  author_employee_id text not null references employees (id),
  title text not null,
  body_preview text,
  is_notice integer not null default 0,
  published_at text,
  pinned_until text,
  status text not null default 'draft',
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists board_comments (
  id text primary key,
  company_id text not null references companies (id),
  post_id text not null references board_posts (id),
  author_employee_id text not null references employees (id),
  parent_comment_id text references board_comments (id),
  body text not null,
  deleted_at text,
  status text not null default 'active',
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists document_spaces (
  id text primary key,
  company_id text not null references companies (id),
  name text not null,
  slug text not null,
  visibility text not null default 'company',
  owner_employee_id text not null references employees (id),
  is_public_within_company integer not null default 0,
  status text not null default 'active',
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (company_id, slug)
);

create table if not exists document_files (
  id text primary key,
  company_id text not null references companies (id),
  space_id text not null references document_spaces (id),
  owner_employee_id text not null references employees (id),
  file_name text not null,
  content_type text not null,
  file_size integer not null default 0,
  storage_key text,
  version_label text not null,
  is_public_within_company integer not null default 0,
  status text not null default 'active',
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists read_receipts (
  id text primary key,
  company_id text not null references companies (id),
  target_type text not null,
  target_id text not null,
  employee_id text not null references employees (id),
  read_at text not null default current_timestamp,
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (company_id, target_type, target_id, employee_id)
);

create index if not exists idx_notice_boards_company_visibility
  on notice_boards (company_id, board_type, visibility, status, updated_at desc);
create index if not exists idx_board_posts_company_board
  on board_posts (company_id, board_id, status, published_at desc);
create index if not exists idx_board_posts_company_author
  on board_posts (company_id, author_employee_id, created_at desc);
create index if not exists idx_board_comments_company_post
  on board_comments (company_id, post_id, status, created_at asc);
create index if not exists idx_document_spaces_company_visibility
  on document_spaces (company_id, visibility, status, updated_at desc);
create index if not exists idx_document_files_company_space
  on document_files (company_id, space_id, status, updated_at desc);
create index if not exists idx_document_files_company_owner
  on document_files (company_id, owner_employee_id, created_at desc);
create index if not exists idx_read_receipts_company_target
  on read_receipts (company_id, target_type, target_id, read_at desc);

commit;
