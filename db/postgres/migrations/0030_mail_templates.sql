begin;

create table if not exists mail_templates (
  id text primary key,
  company_id text not null references companies(id),
  template_code text not null,
  template_name text not null,
  email_type text not null default 'manual' check (email_type in ('auth', 'password_reset', 'notification', 'announcement', 'transactional', 'marketing', 'system', 'manual')),
  subject_template text not null,
  body_template text not null,
  body_type text not null default 'html' check (body_type in ('text', 'html')),
  required_variables text[] not null default '{}',
  is_active boolean not null default true,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint uq_mail_templates_company_code_active unique (company_id, template_code)
);

create table if not exists mail_template_versions (
  id text primary key,
  template_id text not null references mail_templates(id),
  company_id text not null references companies(id),
  version_no integer not null,
  subject_template text not null,
  body_template text not null,
  body_type text not null default 'html' check (body_type in ('text', 'html')),
  required_variables text[] not null default '{}',
  changed_by text not null references users(id),
  change_reason text,
  created_at timestamptz not null default now(),
  constraint uq_mail_template_versions_template_version unique (template_id, version_no)
);

create index if not exists idx_mail_templates_company_active on mail_templates (company_id, is_active, updated_at desc) where deleted_at is null;
create index if not exists idx_mail_templates_company_type on mail_templates (company_id, email_type, updated_at desc) where deleted_at is null;
create index if not exists idx_mail_template_versions_template on mail_template_versions (template_id, version_no desc);

commit;
