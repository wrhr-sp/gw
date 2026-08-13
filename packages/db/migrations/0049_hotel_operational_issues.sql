begin;

insert into public.permissions(code,description) values
 ('HOTEL_ISSUE_READ','호텔 운영이슈 조회'),
 ('HOTEL_ISSUE_CREATE','호텔 운영이슈 등록'),
 ('HOTEL_ISSUE_WORK','담당 운영이슈 작업·조치완료'),
 ('HOTEL_ISSUE_MANAGE','운영이슈 담당·상태 관리'),
 ('HOTEL_OWNER_ISSUE_READ','호텔 소유주 공개 운영이슈 조회'),
 ('HOTEL_OWNER_ISSUE_COMMENT','호텔 소유주 운영이슈 공개댓글')
on conflict(code) do update set description=excluded.description;

create table public.hotel_issue_sla_policies(
 company_id uuid not null references public.companies(id), severity text not null check(severity in ('OBSERVATION','MINOR','MAJOR','EMERGENCY')),
 response_minutes integer check(response_minutes is null or response_minutes>0), action_minutes integer check(action_minutes is null or action_minutes>0),
 version integer not null default 1 check(version>0), updated_by uuid not null, updated_at timestamptz not null default now(),
 primary key(company_id,severity), foreign key(company_id,updated_by) references public.users(company_id,id)
);
create table public.hotel_operational_issues(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, room_id uuid,
 title text not null check(char_length(btrim(title)) between 2 and 160), description text not null check(char_length(btrim(description)) between 2 and 2000),
 severity text not null check(severity in ('OBSERVATION','MINOR','MAJOR','EMERGENCY')),
 status text not null default 'RECEIVED' check(status in ('RECEIVED','ASSIGNED','IN_PROGRESS','ON_HOLD','ACTION_COMPLETED','CLOSED','CANCELLED')),
 version integer not null default 1 check(version>0), resume_due_at timestamptz, assigned_user_id uuid,
 created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz,
 unique(company_id,branch_id,id), foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id),
 foreign key(company_id,branch_id,room_id) references public.hotel_rooms(company_id,branch_id,id),
 foreign key(company_id,created_by) references public.users(company_id,id), foreign key(company_id,assigned_user_id) references public.users(company_id,id),
 check((status='ON_HOLD') or resume_due_at is null), check((status in ('CLOSED','CANCELLED'))=(closed_at is not null))
);
create index hotel_operational_issues_list_idx on public.hotel_operational_issues(company_id,branch_id,status,severity,updated_at desc,id);
create table public.hotel_issue_assignments(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, issue_id uuid not null, assignee_user_id uuid not null,
 issue_version integer not null check(issue_version>0), reason text not null check(char_length(btrim(reason)) between 2 and 500), assigned_by uuid not null, assigned_at timestamptz not null default now(),
 unique(company_id,branch_id,issue_id,issue_version), foreign key(company_id,branch_id,issue_id) references public.hotel_operational_issues(company_id,branch_id,id),
 foreign key(company_id,assignee_user_id) references public.users(company_id,id), foreign key(company_id,assigned_by) references public.users(company_id,id)
);
create table public.hotel_issue_status_history(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, issue_id uuid not null, issue_version integer not null check(issue_version>0),
 action text not null, from_status text, to_status text not null check(to_status in ('RECEIVED','ASSIGNED','IN_PROGRESS','ON_HOLD','ACTION_COMPLETED','CLOSED','CANCELLED')),
 reason text not null check(char_length(btrim(reason)) between 2 and 500), actor_user_id uuid not null, occurred_at timestamptz not null default now(),
 unique(company_id,branch_id,issue_id,issue_version), foreign key(company_id,branch_id,issue_id) references public.hotel_operational_issues(company_id,branch_id,id), foreign key(company_id,actor_user_id) references public.users(company_id,id)
);
create table public.hotel_issue_work_logs(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, issue_id uuid not null, issue_version integer not null check(issue_version>0),
 body text not null check(char_length(btrim(body)) between 2 and 2000), actor_user_id uuid not null, created_at timestamptz not null default now(),
 unique(company_id,branch_id,id), foreign key(company_id,branch_id,issue_id) references public.hotel_operational_issues(company_id,branch_id,id), foreign key(company_id,actor_user_id) references public.users(company_id,id)
);
create table public.hotel_issue_comments(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, issue_id uuid not null, issue_version integer not null check(issue_version>0),
 body text not null check(char_length(btrim(body)) between 2 and 2000), actor_user_id uuid not null, actor_display_name_snapshot text not null, created_at timestamptz not null default now(),
 unique(company_id,branch_id,id), foreign key(company_id,branch_id,issue_id) references public.hotel_operational_issues(company_id,branch_id,id), foreign key(company_id,actor_user_id) references public.users(company_id,id)
);
create table public.hotel_issue_internal_notes(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, issue_id uuid not null, issue_version integer not null check(issue_version>0),
 body text not null check(char_length(btrim(body)) between 2 and 2000), actor_user_id uuid not null, created_at timestamptz not null default now(),
 unique(company_id,branch_id,id), foreign key(company_id,branch_id,issue_id) references public.hotel_operational_issues(company_id,branch_id,id), foreign key(company_id,actor_user_id) references public.users(company_id,id)
);
create table public.hotel_issue_notification_outbox(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, issue_id uuid not null, recipient_user_id uuid not null,
 channel text not null default 'IN_APP' check(channel='IN_APP'), event_code text not null, delivery_status text not null default 'PENDING' check(delivery_status in ('PENDING','DELIVERED','FAILED')),
 push_status text not null default 'NOT_REQUESTED' check(push_status in ('NOT_REQUESTED','PENDING','DELIVERED','FAILED')),
 created_at timestamptz not null default now(), delivered_at timestamptz,
 unique(company_id,issue_id,recipient_user_id,event_code), foreign key(company_id,branch_id,issue_id) references public.hotel_operational_issues(company_id,branch_id,id), foreign key(company_id,recipient_user_id) references public.users(company_id,id)
);

create function public.issue_history_append_only() returns trigger language plpgsql set search_path=pg_catalog as $function$ begin raise exception 'issue history is append-only' using errcode='55000'; end $function$;
revoke all on function public.issue_history_append_only() from public;
create trigger issue_history_append_only before update or delete on public.hotel_issue_status_history for each row execute function public.issue_history_append_only();
create trigger issue_assignment_history_append_only before update or delete on public.hotel_issue_assignments for each row execute function public.issue_history_append_only();
create trigger issue_work_log_append_only before update or delete on public.hotel_issue_work_logs for each row execute function public.issue_history_append_only();
create trigger issue_comment_append_only before update or delete on public.hotel_issue_comments for each row execute function public.issue_history_append_only();
create trigger issue_internal_note_append_only before update or delete on public.hotel_issue_internal_notes for each row execute function public.issue_history_append_only();

create function public.hotel_issue_actor_v1(p_company_id uuid,p_branch_id uuid,p_session_token text,p_permission_code text)
returns table(session_id uuid,user_id uuid,user_type text,display_name text) language sql stable security definer set search_path=pg_catalog as $function$
 with actor as (
  select s.id session_id,u.id user_id,u.user_type,u.display_name from public.auth_sessions s join public.users u on u.company_id=s.company_id and u.id=s.user_id join public.companies c on c.id=s.company_id
  where public.runtime_has_capability('API_RUNTIME') and p_session_token~'^[A-Za-z0-9_-]{43}$' and s.id=nullif(current_setting('app.session_id',true),'')::uuid and s.company_id=p_company_id
   and s.token_hash=sha256(convert_to(p_session_token,'UTF8')) and s.revoked_at is null and s.idle_expires_at>statement_timestamp() and s.absolute_expires_at>statement_timestamp() and u.status='ACTIVE' and c.status='ACTIVE'
 ), subjects as (
  select 'USER'::text subject_type,a.user_id subject_id from actor a union all
  select 'ROLE',m.role_id from actor a join public.user_role_memberships m on m.company_id=p_company_id and m.user_id=a.user_id join public.roles r on r.company_id=m.company_id and r.id=m.role_id and r.status='ACTIVE' where m.valid_from<=statement_timestamp() and (m.valid_until is null or m.valid_until>statement_timestamp()) union all
  select 'GROUP',m.group_id from actor a join public.user_group_memberships m on m.company_id=p_company_id and m.user_id=a.user_id join public.user_groups g on g.company_id=m.company_id and g.id=m.group_id and g.status='ACTIVE' where m.valid_from<=statement_timestamp() and (m.valid_until is null or m.valid_until>statement_timestamp())
 ), effects as (select pg.effect from public.permission_grants pg join subjects s on s.subject_type=pg.subject_type and s.subject_id=pg.subject_id where pg.company_id=p_company_id and pg.permission_code=p_permission_code and (pg.branch_id is null or pg.branch_id=p_branch_id) and pg.valid_from<=statement_timestamp() and (pg.valid_until is null or pg.valid_until>statement_timestamp()))
 select a.* from actor a where not exists(select 1 from effects where effect='DENY') and exists(select 1 from effects where effect='ALLOW')
 and ((a.user_type='HOTEL_OWNER' and p_permission_code in ('HOTEL_OWNER_ISSUE_READ','HOTEL_OWNER_ISSUE_COMMENT')) or (a.user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and p_permission_code in ('HOTEL_ISSUE_READ','HOTEL_ISSUE_CREATE','HOTEL_ISSUE_WORK','HOTEL_ISSUE_MANAGE')))
 and case a.user_type
  when 'INTERNAL_STAFF' then exists(select 1 from public.hotel_staff_assignments x where x.company_id=p_company_id and x.branch_id=p_branch_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date))
  when 'HOUSEKEEPING' then exists(select 1 from public.housekeeping_hotel_links x where x.company_id=p_company_id and x.branch_id=p_branch_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date))
  when 'HOTEL_OWNER' then exists(select 1 from public.hotel_owner_assignments x where x.company_id=p_company_id and x.branch_id=p_branch_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date))
  else false end
$function$;
revoke all on function public.hotel_issue_actor_v1(uuid,uuid,text,text) from public;

create function public.hotel_issue_snapshot_v1(p_company_id uuid,p_branch_id uuid,p_issue_id uuid,p_internal boolean) returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object('id',i.id,'hotelId',i.branch_id,'title',i.title,'description',i.description,'severity',i.severity,'status',i.status,'version',i.version,
  'assignee',case when au.id is null then null when p_internal then jsonb_build_object('userId',au.id,'displayName',au.display_name) else jsonb_build_object('displayName',au.display_name) end,
  'resumeDueAt',case when i.resume_due_at is null then null else to_char(i.resume_due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
  'isOverdue',i.status='ON_HOLD' and i.resume_due_at is not null and i.resume_due_at<statement_timestamp(),
  'publicComments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'body',c.body,'actor',case when p_internal then jsonb_build_object('userId',c.actor_user_id,'displayName',c.actor_display_name_snapshot) else jsonb_build_object('displayName',c.actor_display_name_snapshot) end,'createdAt',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by c.created_at,c.id) from public.hotel_issue_comments c where c.company_id=i.company_id and c.branch_id=i.branch_id and c.issue_id=i.id),'[]'::jsonb),
  'createdAt',to_char(i.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(i.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) || case when p_internal then jsonb_build_object(
  'workLogs',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'body',w.body,'actor',jsonb_build_object('userId',u.id,'displayName',u.display_name),'createdAt',to_char(w.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by w.created_at,w.id) from public.hotel_issue_work_logs w join public.users u on u.company_id=w.company_id and u.id=w.actor_user_id where w.company_id=i.company_id and w.branch_id=i.branch_id and w.issue_id=i.id),'[]'::jsonb),
  'internalNotes',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'body',n.body,'actor',jsonb_build_object('userId',u.id,'displayName',u.display_name),'createdAt',to_char(n.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by n.created_at,n.id) from public.hotel_issue_internal_notes n join public.users u on u.company_id=n.company_id and u.id=n.actor_user_id where n.company_id=i.company_id and n.branch_id=i.branch_id and n.issue_id=i.id),'[]'::jsonb),
  'statusHistory',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,'fromStatus',h.from_status,'toStatus',h.to_status,'reason',h.reason,'actor',jsonb_build_object('userId',u.id,'displayName',u.display_name),'createdAt',to_char(h.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'version',h.issue_version) order by h.issue_version) from public.hotel_issue_status_history h join public.users u on u.company_id=h.company_id and u.id=h.actor_user_id where h.company_id=i.company_id and h.branch_id=i.branch_id and h.issue_id=i.id),'[]'::jsonb)) else '{}'::jsonb end
 from public.hotel_operational_issues i left join public.users au on au.company_id=i.company_id and au.id=i.assigned_user_id where i.company_id=p_company_id and i.branch_id=p_branch_id and i.id=p_issue_id
$function$;
revoke all on function public.hotel_issue_snapshot_v1(uuid,uuid,uuid,boolean) from public;

create function public.hotel_issue_capabilities_v1(p_company_id uuid,p_session_token text) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
begin
 return query
 with actor as (
  select s.id session_id,u.id user_id,u.user_type from public.auth_sessions s join public.users u on u.company_id=s.company_id and u.id=s.user_id join public.companies c on c.id=s.company_id
  where public.runtime_has_capability('API_RUNTIME') and p_session_token~'^[A-Za-z0-9_-]{43}$' and s.id=nullif(current_setting('app.session_id',true),'')::uuid and s.company_id=p_company_id
   and s.token_hash=sha256(convert_to(p_session_token,'UTF8')) and s.revoked_at is null and s.idle_expires_at>statement_timestamp() and s.absolute_expires_at>statement_timestamp() and u.status='ACTIVE' and c.status='ACTIVE'
 ), subjects as (
  select 'USER'::text subject_type,a.user_id subject_id from actor a union all
  select 'ROLE',m.role_id from actor a join public.user_role_memberships m on m.company_id=p_company_id and m.user_id=a.user_id join public.roles r on r.company_id=m.company_id and r.id=m.role_id and r.status='ACTIVE' where m.valid_from<=statement_timestamp() and (m.valid_until is null or m.valid_until>statement_timestamp()) union all
  select 'GROUP',m.group_id from actor a join public.user_group_memberships m on m.company_id=p_company_id and m.user_id=a.user_id join public.user_groups g on g.company_id=m.company_id and g.id=m.group_id and g.status='ACTIVE' where m.valid_from<=statement_timestamp() and (m.valid_until is null or m.valid_until>statement_timestamp())
 ), scopes as (
  select h.branch_id,b.name,a.user_type from actor a join public.hotel_staff_assignments x on a.user_type='INTERNAL_STAFF' and x.company_id=p_company_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date) join public.hotel_profiles h on h.company_id=x.company_id and h.branch_id=x.branch_id join public.branches b on b.company_id=h.company_id and b.id=h.branch_id
  union select h.branch_id,b.name,a.user_type from actor a join public.housekeeping_hotel_links x on a.user_type='HOUSEKEEPING' and x.company_id=p_company_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date) join public.hotel_profiles h on h.company_id=x.company_id and h.branch_id=x.branch_id join public.branches b on b.company_id=h.company_id and b.id=h.branch_id
  union select h.branch_id,b.name,a.user_type from actor a join public.hotel_owner_assignments x on a.user_type='HOTEL_OWNER' and x.company_id=p_company_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date) join public.hotel_profiles h on h.company_id=x.company_id and h.branch_id=x.branch_id join public.branches b on b.company_id=h.company_id and b.id=h.branch_id
 ), flags as (
  select s.*,p.code,exists(select 1 from public.permission_grants pg join subjects x on x.subject_type=pg.subject_type and x.subject_id=pg.subject_id where pg.company_id=p_company_id and (pg.branch_id is null or pg.branch_id=s.branch_id) and pg.permission_code=p.code and pg.effect='ALLOW' and pg.valid_from<=statement_timestamp() and (pg.valid_until is null or pg.valid_until>statement_timestamp())) and not exists(select 1 from public.permission_grants pg join subjects x on x.subject_type=pg.subject_type and x.subject_id=pg.subject_id where pg.company_id=p_company_id and (pg.branch_id is null or pg.branch_id=s.branch_id) and pg.permission_code=p.code and pg.effect='DENY' and pg.valid_from<=statement_timestamp() and (pg.valid_until is null or pg.valid_until>statement_timestamp())) allowed
  from scopes s cross join (values('HOTEL_ISSUE_READ'),('HOTEL_ISSUE_CREATE'),('HOTEL_ISSUE_WORK'),('HOTEL_ISSUE_MANAGE'),('HOTEL_OWNER_ISSUE_READ'),('HOTEL_OWNER_ISSUE_COMMENT'))p(code)
 ), result as (
  select branch_id,name,user_type,
   bool_or(user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and code='HOTEL_ISSUE_READ' and allowed) or bool_or(user_type='HOTEL_OWNER' and code='HOTEL_OWNER_ISSUE_READ' and allowed) can_read,
   bool_or(user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and code='HOTEL_ISSUE_CREATE' and allowed) can_create,
   bool_or(user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and code='HOTEL_ISSUE_WORK' and allowed) can_work,
   bool_or(user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and code='HOTEL_ISSUE_MANAGE' and allowed) can_manage,
   bool_or(user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and code='HOTEL_ISSUE_WORK' and allowed) or bool_or(user_type='HOTEL_OWNER' and code='HOTEL_OWNER_ISSUE_COMMENT' and allowed) can_comment
  from flags group by branch_id,name,user_type
 )
 select case when exists(select 1 from actor) then 'OK' else 'FORBIDDEN' end,
  case when exists(select 1 from actor) then jsonb_build_object('hotels',coalesce((select jsonb_agg((jsonb_build_object('hotelId',branch_id,'hotelName',name,'canRead',can_read,'canCreate',can_create,'canWork',can_work,'canManage',can_manage,'canComment',can_comment) || case when can_work then jsonb_build_object('actorUserId',(select user_id from actor)) else '{}'::jsonb end) order by name,branch_id) from result where can_read or can_create or can_work or can_manage or can_comment),'[]'::jsonb)) else null::jsonb end;
end
$function$;
revoke all on function public.hotel_issue_capabilities_v1(uuid,text) from public;

create function public.hotel_issue_read_v1(p_company_id uuid,p_branch_id uuid,p_issue_id uuid,p_query jsonb,p_session_token text) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; internal boolean; page_no int:=greatest(coalesce((p_query->>'page')::int,1),1); page_size int:=least(greatest(coalesce((p_query->>'pageSize')::int,20),1),100); total_count int;
begin
 select * into actor from public.hotel_issue_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_ISSUE_READ'); internal:=found;
 if not internal then select * into actor from public.hotel_issue_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_OWNER_ISSUE_READ'); end if;
 if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 if p_issue_id is not null then return query select case when public.hotel_issue_snapshot_v1(p_company_id,p_branch_id,p_issue_id,internal) is null then 'NOT_FOUND' else 'OK' end,public.hotel_issue_snapshot_v1(p_company_id,p_branch_id,p_issue_id,internal); return; end if;
 select count(*) into total_count from public.hotel_operational_issues i where i.company_id=p_company_id and i.branch_id=p_branch_id and (p_query->>'status' is null or i.status=p_query->>'status') and (p_query->>'severity' is null or i.severity=p_query->>'severity');
 return query select 'OK',jsonb_build_object('issues',coalesce((select jsonb_agg(public.hotel_issue_snapshot_v1(p_company_id,p_branch_id,x.id,false) order by x.updated_at desc,x.id) from (select i.id,i.updated_at from public.hotel_operational_issues i where i.company_id=p_company_id and i.branch_id=p_branch_id and (p_query->>'status' is null or i.status=p_query->>'status') and (p_query->>'severity' is null or i.severity=p_query->>'severity') order by i.updated_at desc,i.id offset (page_no-1)*page_size limit page_size)x),'[]'::jsonb),'pagination',jsonb_build_object('page',page_no,'pageSize',page_size,'total',total_count));
exception when invalid_text_representation then return query select 'NOT_FOUND',null::jsonb;
end $function$;
revoke all on function public.hotel_issue_read_v1(uuid,uuid,uuid,jsonb,text) from public;

create function public.hotel_issue_command_v1(p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; issue_row public.hotel_operational_issues%rowtype; old_status text; new_status text; permission text; snapshot jsonb; entry_id uuid:=gen_random_uuid(); now_at timestamptz:=statement_timestamp();
begin
 permission:=case when p_action='CREATE' then 'HOTEL_ISSUE_CREATE' when p_action in ('ASSIGN','HOLD','RESUME','CLOSE','CANCEL','REOPEN','ADD_INTERNAL_NOTE') then 'HOTEL_ISSUE_MANAGE' when p_action='ADD_PUBLIC_COMMENT' then 'HOTEL_ISSUE_WORK' else 'HOTEL_ISSUE_WORK' end;
 select * into actor from public.hotel_issue_actor_v1(p_company_id,p_branch_id,p_session_token,permission);
 if not found and p_action='ADD_PUBLIC_COMMENT' then select * into actor from public.hotel_issue_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_OWNER_ISSUE_COMMENT'); end if;
 if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 if p_action='CREATE' then
  if actor.user_type not in ('INTERNAL_STAFF','HOUSEKEEPING') then return query select 'FORBIDDEN',null::jsonb; return; end if;
  insert into public.hotel_operational_issues(id,company_id,branch_id,room_id,title,description,severity,created_by) values(p_resource_id,p_company_id,p_branch_id,nullif(p_value->>'roomId','')::uuid,p_value->>'title',p_value->>'description',p_value->>'severity',actor.user_id) returning * into issue_row;
  insert into public.hotel_issue_status_history(id,company_id,branch_id,issue_id,issue_version,action,from_status,to_status,reason,actor_user_id) values(entry_id,p_company_id,p_branch_id,p_resource_id,1,'CREATE',null,'RECEIVED','운영이슈 접수',actor.user_id);
  if issue_row.severity='EMERGENCY' then
   insert into public.hotel_issue_notification_outbox(id,company_id,branch_id,issue_id,recipient_user_id,channel,event_code,delivery_status,push_status)
   select gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,r.user_id,'IN_APP','HOTEL_ISSUE_EMERGENCY','PENDING','NOT_REQUESTED' from (
    select u.id user_id from public.users u join public.hotel_staff_assignments a on a.company_id=u.company_id and a.user_id=u.id and a.branch_id=p_branch_id and a.terminated_at is null and a.start_date<=now_at::date and (a.end_date is null or a.end_date>=now_at::date) where u.company_id=p_company_id and u.status='ACTIVE' and u.user_type='INTERNAL_STAFF'
    union select u.id from public.users u join public.housekeeping_hotel_links a on a.company_id=u.company_id and a.user_id=u.id and a.branch_id=p_branch_id and a.terminated_at is null and a.start_date<=now_at::date and (a.end_date is null or a.end_date>=now_at::date) where u.company_id=p_company_id and u.status='ACTIVE' and u.user_type='HOUSEKEEPING'
    union select u.id from public.users u join public.hotel_owner_assignments a on a.company_id=u.company_id and a.user_id=u.id and a.branch_id=p_branch_id and a.terminated_at is null and a.start_date<=now_at::date and (a.end_date is null or a.end_date>=now_at::date) where u.company_id=p_company_id and u.status='ACTIVE' and u.user_type='HOTEL_OWNER')r on conflict do nothing;
  end if;
 else
  select * into issue_row from public.hotel_operational_issues where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if issue_row.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if; old_status:=issue_row.status;
  if p_action='ASSIGN' then
   if issue_row.status<>'RECEIVED' then return query select case when issue_row.status in ('CLOSED','CANCELLED') then 'ISSUE_TERMINAL_LOCKED' else 'ISSUE_STATE_INVALID' end,null::jsonb; return; end if;
   perform 1 from public.users u where u.company_id=p_company_id and u.id=(p_value->>'assigneeUserId')::uuid and u.status='ACTIVE' and u.user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and ((u.user_type='INTERNAL_STAFF' and exists(select 1 from public.hotel_staff_assignments a where a.company_id=p_company_id and a.branch_id=p_branch_id and a.user_id=u.id and a.terminated_at is null and a.start_date<=now_at::date and (a.end_date is null or a.end_date>=now_at::date))) or (u.user_type='HOUSEKEEPING' and exists(select 1 from public.housekeeping_hotel_links a where a.company_id=p_company_id and a.branch_id=p_branch_id and a.user_id=u.id and a.terminated_at is null and a.start_date<=now_at::date and (a.end_date is null or a.end_date>=now_at::date))));
   if not found then return query select 'ISSUE_ASSIGNEE_INVALID',null::jsonb; return; end if;
   update public.hotel_operational_issues set assigned_user_id=(p_value->>'assigneeUserId')::uuid,status='ASSIGNED',version=version+1,updated_at=now_at where id=issue_row.id returning * into issue_row;
   insert into public.hotel_issue_assignments(id,company_id,branch_id,issue_id,assignee_user_id,issue_version,reason,assigned_by) values(entry_id,p_company_id,p_branch_id,p_resource_id,issue_row.assigned_user_id,issue_row.version,p_value->>'reason',actor.user_id); new_status:='ASSIGNED';
   insert into public.hotel_issue_status_history(id,company_id,branch_id,issue_id,issue_version,action,from_status,to_status,reason,actor_user_id) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,issue_row.version,'ASSIGN',old_status,new_status,p_value->>'reason',actor.user_id);
  elsif p_action in ('ADD_WORK_LOG','ADD_PUBLIC_COMMENT','ADD_INTERNAL_NOTE') then
   if issue_row.status in ('CLOSED','CANCELLED') then return query select 'ISSUE_TERMINAL_LOCKED',null::jsonb; return; end if;
   if p_action in ('ADD_WORK_LOG') and (issue_row.assigned_user_id is distinct from actor.user_id) then return query select 'FORBIDDEN',null::jsonb; return; end if;
   update public.hotel_operational_issues set version=version+1,updated_at=now_at where id=issue_row.id returning * into issue_row;
   if p_action='ADD_WORK_LOG' then insert into public.hotel_issue_work_logs(id,company_id,branch_id,issue_id,issue_version,body,actor_user_id) values(entry_id,p_company_id,p_branch_id,p_resource_id,issue_row.version,p_value->>'body',actor.user_id);
   elsif p_action='ADD_PUBLIC_COMMENT' then insert into public.hotel_issue_comments(id,company_id,branch_id,issue_id,issue_version,body,actor_user_id,actor_display_name_snapshot) values(entry_id,p_company_id,p_branch_id,p_resource_id,issue_row.version,p_value->>'body',actor.user_id,actor.display_name);
   else insert into public.hotel_issue_internal_notes(id,company_id,branch_id,issue_id,issue_version,body,actor_user_id) values(entry_id,p_company_id,p_branch_id,p_resource_id,issue_row.version,p_value->>'body',actor.user_id); end if;
  else
   if p_action in ('START','COMPLETE_ACTION') and issue_row.assigned_user_id is distinct from actor.user_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
   new_status:=case p_action when 'START' then 'IN_PROGRESS' when 'HOLD' then 'ON_HOLD' when 'RESUME' then case when issue_row.assigned_user_id is null then 'RECEIVED' else 'IN_PROGRESS' end when 'COMPLETE_ACTION' then 'ACTION_COMPLETED' when 'CLOSE' then 'CLOSED' when 'CANCEL' then 'CANCELLED' when 'REOPEN' then case when issue_row.assigned_user_id is null then 'RECEIVED' else 'ASSIGNED' end else null end;
   if new_status is null or not ((p_action='START' and old_status='ASSIGNED') or (p_action='HOLD' and old_status in ('ASSIGNED','IN_PROGRESS')) or (p_action='RESUME' and old_status='ON_HOLD') or (p_action='COMPLETE_ACTION' and old_status='IN_PROGRESS') or (p_action='CLOSE' and old_status='ACTION_COMPLETED') or (p_action='CANCEL' and old_status not in ('CLOSED','CANCELLED')) or (p_action='REOPEN' and old_status in ('CLOSED','CANCELLED'))) then return query select 'ISSUE_STATE_INVALID',null::jsonb; return; end if;
   update public.hotel_operational_issues set status=new_status,resume_due_at=case when new_status='ON_HOLD' then nullif(p_value->>'resumeDueAt','')::timestamptz else null end,closed_at=case when new_status in ('CLOSED','CANCELLED') then now_at else null end,version=version+1,updated_at=now_at where id=issue_row.id returning * into issue_row;
  end if;
  if p_action not in ('ADD_WORK_LOG','ADD_PUBLIC_COMMENT','ADD_INTERNAL_NOTE','ASSIGN') then insert into public.hotel_issue_status_history(id,company_id,branch_id,issue_id,issue_version,action,from_status,to_status,reason,actor_user_id) values(entry_id,p_company_id,p_branch_id,p_resource_id,issue_row.version,p_action,old_status,issue_row.status,p_value->>'reason',actor.user_id); end if;
 end if;
 snapshot:=public.hotel_issue_snapshot_v1(p_company_id,p_branch_id,p_resource_id,actor.user_type<>'HOTEL_OWNER');
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_ISSUE_'||p_action,actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_OPERATIONAL_ISSUE',p_resource_id,jsonb_build_object('status',issue_row.status,'severity',issue_row.severity,'version',issue_row.version),coalesce(p_value->>'reason','운영이슈 접수'),'SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'HOTEL_OPERATIONAL_ISSUE',p_resource_id,p_audit_event_id,snapshot);
 return query select case when p_action='CREATE' then 'CREATED' else 'UPDATED' end,snapshot;
exception when invalid_text_representation or check_violation or foreign_key_violation then return query select 'VALIDATION_ERROR',null::jsonb; when unique_violation then return query select 'VERSION_CONFLICT',null::jsonb;
end $function$;
revoke all on function public.hotel_issue_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

alter table public.hotel_issue_sla_policies enable row level security; alter table public.hotel_issue_sla_policies force row level security;
alter table public.hotel_operational_issues enable row level security; alter table public.hotel_operational_issues force row level security;
alter table public.hotel_issue_assignments enable row level security; alter table public.hotel_issue_assignments force row level security;
alter table public.hotel_issue_status_history enable row level security; alter table public.hotel_issue_status_history force row level security;
alter table public.hotel_issue_work_logs enable row level security; alter table public.hotel_issue_work_logs force row level security;
alter table public.hotel_issue_comments enable row level security; alter table public.hotel_issue_comments force row level security;
alter table public.hotel_issue_internal_notes enable row level security; alter table public.hotel_issue_internal_notes force row level security;
alter table public.hotel_issue_notification_outbox enable row level security; alter table public.hotel_issue_notification_outbox force row level security;
do $policies$ declare t text; begin foreach t in array array['hotel_issue_sla_policies','hotel_operational_issues','hotel_issue_assignments','hotel_issue_status_history','hotel_issue_work_logs','hotel_issue_comments','hotel_issue_internal_notes','hotel_issue_notification_outbox'] loop execute format('create policy %I_company_isolation on public.%I using (case when public.runtime_is_schema_owner() then true when current_user=''werehere_auth_session_definer'' then true when current_user=''werehere_tenant_authority_definer'' then true when public.runtime_has_capability(''API_RUNTIME'') then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER'') then company_id=public.reconciler_current_company_id() else false end) with check (case when public.runtime_is_schema_owner() then true when current_user=''werehere_auth_session_definer'' then true when current_user=''werehere_tenant_authority_definer'' then true when public.runtime_has_capability(''API_RUNTIME'') then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER'') then company_id=public.reconciler_current_company_id() else false end)',t,t); end loop; end $policies$;

do $acl$ declare r text; begin for r in select role_name from public.runtime_database_capabilities where capability='API_RUNTIME' loop execute format('revoke all on public.hotel_issue_sla_policies,public.hotel_operational_issues,public.hotel_issue_assignments,public.hotel_issue_status_history,public.hotel_issue_work_logs,public.hotel_issue_comments,public.hotel_issue_internal_notes,public.hotel_issue_notification_outbox from %I',r); execute format('grant execute on function public.hotel_issue_capabilities_v1(uuid,text) to %I',r); execute format('grant execute on function public.hotel_issue_read_v1(uuid,uuid,uuid,jsonb,text) to %I',r); execute format('grant execute on function public.hotel_issue_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I',r); end loop; end $acl$;

insert into public.schema_migrations(version) values('0049_hotel_operational_issues');
commit;
