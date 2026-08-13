begin;

insert into public.permissions(code,description) values
 ('HOTEL_SALES_VIEW','호텔 일매출 조회'),
 ('HOTEL_SALES_MANAGE','호텔 일매출 임시저장·수정'),
 ('HOTEL_SALES_CONFIRM','호텔 일매출 확정'),
 ('HOTEL_SALES_CORRECT','호텔 일매출 정정'),
 ('HOTEL_OWNER_SALES_READ','호텔 소유주 확정 일매출 조회')
on conflict(code) do update set description=excluded.description;

alter table public.hotel_file_uploads
 drop constraint hotel_file_uploads_parent_exact_check,
 add column daily_sales_id uuid,
 add constraint hotel_file_uploads_parent_exact_check check (
  (parent_type='INSPECTION_ITEM_EVIDENCE' and inspection_id is not null and item_snapshot_id is not null and repair_case_id is null and repair_visit_id is null and daily_sales_id is null) or
  (parent_type='REPAIR_CASE_EVIDENCE' and inspection_id is null and item_snapshot_id is null and repair_case_id is not null and repair_visit_id is null and daily_sales_id is null) or
  (parent_type='REPAIR_VISIT_COMPLETION_EVIDENCE' and inspection_id is null and item_snapshot_id is null and repair_case_id is not null and repair_visit_id is not null and daily_sales_id is null) or
  (parent_type='DAILY_SALES_EVIDENCE' and inspection_id is null and item_snapshot_id is null and repair_case_id is null and repair_visit_id is null and daily_sales_id is not null)
 );

create table public.hotel_sales_categories(
 id uuid primary key, company_id uuid not null, branch_id uuid not null,
 name text not null check(char_length(btrim(name)) between 1 and 100), status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
 display_order integer not null default 0 check(display_order>=0), created_by uuid not null, created_at timestamptz not null default now(),
 unique(company_id,branch_id,id), unique(company_id,branch_id,name),
 foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id), foreign key(company_id,created_by) references public.users(company_id,id)
);
create table public.hotel_payment_methods(
 id uuid primary key, company_id uuid not null, branch_id uuid not null,
 name text not null check(char_length(btrim(name)) between 1 and 100), status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
 display_order integer not null default 0 check(display_order>=0), created_by uuid not null, created_at timestamptz not null default now(),
 unique(company_id,branch_id,id), unique(company_id,branch_id,name),
 foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id), foreign key(company_id,created_by) references public.users(company_id,id)
);
create table public.hotel_daily_sales(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, business_date date not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','LOCKED')), version integer not null default 1 check(version>0),
 internal_memo text check(internal_memo is null or char_length(internal_memo)<=2000),
 gross_amount bigint not null default 0 check(gross_amount>=0), discount_amount bigint not null default 0 check(discount_amount>=0), refund_amount bigint not null default 0 check(refund_amount>=0),
 net_amount bigint generated always as (gross_amount - discount_amount - refund_amount) stored,
 created_by uuid not null, confirmed_by uuid, confirmed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,branch_id,id), unique(company_id,branch_id,business_date),
 foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id), foreign key(company_id,created_by) references public.users(company_id,id), foreign key(company_id,confirmed_by) references public.users(company_id,id),
 check(discount_amount+refund_amount<=gross_amount), check((status='LOCKED')=(confirmed_at is not null and confirmed_by is not null))
);
create index hotel_daily_sales_list_idx on public.hotel_daily_sales(company_id,branch_id,business_date desc,id);
create table public.hotel_daily_sales_lines(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, sales_id uuid not null,
 category_id uuid not null, payment_method_id uuid not null, gross_amount bigint not null check(gross_amount>=0), discount_amount bigint not null check(discount_amount>=0), refund_amount bigint not null check(refund_amount>=0),
 net_amount bigint generated always as (gross_amount - discount_amount - refund_amount) stored,
 refund_reason text check(refund_reason is null or char_length(btrim(refund_reason)) between 2 and 500), display_order integer not null check(display_order>=0),
 unique(company_id,branch_id,sales_id,category_id,payment_method_id), unique(company_id,branch_id,sales_id,id),
 foreign key(company_id,branch_id,sales_id) references public.hotel_daily_sales(company_id,branch_id,id) on delete cascade,
 foreign key(company_id,branch_id,category_id) references public.hotel_sales_categories(company_id,branch_id,id),
 foreign key(company_id,branch_id,payment_method_id) references public.hotel_payment_methods(company_id,branch_id,id),
 check(discount_amount+refund_amount<=gross_amount), check((refund_amount>0)=(refund_reason is not null))
);
create table public.hotel_daily_sales_versions(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, sales_id uuid not null, sales_version integer not null check(sales_version>0), action text not null check(action in ('CONFIRM','CORRECT')),
 snapshot jsonb not null, actor_user_id uuid not null, reason text not null check(char_length(btrim(reason)) between 2 and 500), created_at timestamptz not null default now(),
 unique(company_id,branch_id,sales_id,sales_version), foreign key(company_id,branch_id,sales_id) references public.hotel_daily_sales(company_id,branch_id,id), foreign key(company_id,actor_user_id) references public.users(company_id,id)
);
create table public.hotel_daily_sales_corrections(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, sales_id uuid not null,
 from_version integer not null check(from_version>0), to_version integer not null check(to_version=from_version+1), reason text not null check(char_length(btrim(reason)) between 2 and 500),
 before_snapshot jsonb not null, after_snapshot jsonb not null, corrected_by uuid not null, corrected_at timestamptz not null default now(),
 unique(company_id,branch_id,sales_id,to_version), foreign key(company_id,branch_id,sales_id) references public.hotel_daily_sales(company_id,branch_id,id), foreign key(company_id,corrected_by) references public.users(company_id,id)
);
create table public.hotel_daily_sales_attachments(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, sales_id uuid not null, sales_version integer not null check(sales_version>0), file_version_id uuid not null,
 purpose text not null check(purpose in ('CLOSING_EVIDENCE','CORRECTION_EVIDENCE')), linked_by uuid not null, linked_at timestamptz not null default now(),
 unique(company_id,branch_id,sales_id,sales_version,file_version_id), unique(company_id,file_version_id),
 foreign key(company_id,branch_id,sales_id) references public.hotel_daily_sales(company_id,branch_id,id), foreign key(company_id,file_version_id) references public.hotel_file_versions(company_id,id), foreign key(company_id,linked_by) references public.users(company_id,id)
);

create function public.sales_history_append_only() returns trigger language plpgsql set search_path=pg_catalog as $function$ begin raise exception 'sales history is append-only' using errcode='55000'; end $function$;
revoke all on function public.sales_history_append_only() from public;
create trigger hotel_daily_sales_versions_append_only before update or delete on public.hotel_daily_sales_versions for each row execute function public.sales_history_append_only();
create trigger hotel_daily_sales_corrections_append_only before update or delete on public.hotel_daily_sales_corrections for each row execute function public.sales_history_append_only();
create trigger hotel_daily_sales_attachments_append_only before update or delete on public.hotel_daily_sales_attachments for each row execute function public.sales_history_append_only();

alter table public.hotel_file_access_grants
 drop constraint hotel_file_access_grants_parent_check,
 add column daily_sales_id uuid,
 add constraint hotel_file_access_grants_daily_sales_fkey foreign key(company_id,branch_id,daily_sales_id) references public.hotel_daily_sales(company_id,branch_id,id),
 add constraint hotel_file_access_grants_parent_check check (
  (inspection_id is not null and repair_case_id is null and daily_sales_id is null) or
  (inspection_id is null and repair_case_id is not null and daily_sales_id is null) or
  (inspection_id is null and repair_case_id is null and daily_sales_id is not null)
 );

create function public.hotel_daily_sales_actor_v1(p_company_id uuid,p_branch_id uuid,p_session_token text,p_permission_code text)
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
 and ((a.user_type='HOTEL_OWNER' and p_permission_code in ('HOTEL_OWNER_SALES_READ','HOTEL_FILE_READ')) or (a.user_type='INTERNAL_STAFF' and p_permission_code in ('HOTEL_SALES_VIEW','HOTEL_SALES_MANAGE','HOTEL_SALES_CONFIRM','HOTEL_SALES_CORRECT','HOTEL_FILE_READ')))
 and case a.user_type when 'INTERNAL_STAFF' then exists(select 1 from public.hotel_staff_assignments x where x.company_id=p_company_id and x.branch_id=p_branch_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date)) when 'HOTEL_OWNER' then exists(select 1 from public.hotel_owner_assignments x where x.company_id=p_company_id and x.branch_id=p_branch_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date)) else false end
$function$;
revoke all on function public.hotel_daily_sales_actor_v1(uuid,uuid,text,text) from public;

create or replace function public.hotel_repair_file_upload_init_v1(
 p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,
 p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_audit_event_id uuid,p_trace_id uuid
) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; file_actor record; replay record; v_parent_type text:=p_value->>'parentType'; sales_status text; now_at timestamptz:=statement_timestamp(); total_count integer; total_size bigint; snapshot jsonb;
begin
 if p_action<>'UPLOAD_INIT' or p_expected_version<>0 or v_parent_type not in ('REPAIR_CASE_EVIDENCE','REPAIR_VISIT_COMPLETION_EVIDENCE','DAILY_SALES_EVIDENCE') then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 if v_parent_type='DAILY_SALES_EVIDENCE' then
  select s.status into sales_status from public.hotel_daily_sales s where s.company_id=p_company_id and s.branch_id=p_branch_id and s.id=(p_value->>'dailySalesId')::uuid and s.status in ('DRAFT','LOCKED') for share;
  if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
  select * into actor from public.hotel_daily_sales_actor_v1(p_company_id,p_branch_id,p_session_token,case sales_status when 'DRAFT' then 'HOTEL_SALES_MANAGE' else 'HOTEL_SALES_CORRECT' end);
 else
  select * into actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,case when v_parent_type='REPAIR_CASE_EVIDENCE' then 'REPAIR_CREATE' else 'REPAIR_VISIT_UPDATE' end,true);
 end if;
 if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
 select * into file_actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_FILE_UPLOAD',true); if not found or file_actor.user_id<>actor.user_id or file_actor.session_id<>actor.session_id then return query select 'NOT_FOUND',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 if v_parent_type='REPAIR_CASE_EVIDENCE' then
  if exists(select 1 from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=(p_value->>'repairCaseId')::uuid) then return query select 'DUPLICATE',null::jsonb; return; end if;
 elsif v_parent_type='REPAIR_VISIT_COMPLETION_EVIDENCE' then
  perform 1 from public.hotel_repair_visits v join public.hotel_repair_cases c on c.company_id=v.company_id and c.branch_id=v.branch_id and c.id=v.repair_case_id where v.company_id=p_company_id and v.branch_id=p_branch_id and v.id=(p_value->>'repairVisitId')::uuid and v.repair_case_id=(p_value->>'repairCaseId')::uuid and v.status='SCHEDULED' and c.status='OPEN' for share of v,c;
  if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
 end if;
 if v_parent_type='DAILY_SALES_EVIDENCE' then
  select count(*),coalesce(sum(u.reserved_size),0) into total_count,total_size from public.hotel_file_uploads u where u.company_id=p_company_id and u.branch_id=p_branch_id and u.parent_type=v_parent_type and u.daily_sales_id=(p_value->>'dailySalesId')::uuid and u.status not in ('EXPIRED','REJECTED','SCAN_FAILED');
 else
  select count(*),coalesce(sum(u.reserved_size),0) into total_count,total_size from public.hotel_file_uploads u where u.company_id=p_company_id and u.branch_id=p_branch_id and u.parent_type=v_parent_type and u.repair_case_id=(p_value->>'repairCaseId')::uuid and u.repair_visit_id is not distinct from nullif(p_value->>'repairVisitId','')::uuid and u.status not in ('EXPIRED','REJECTED','SCAN_FAILED');
 end if;
 if total_count>=20 or total_size+(p_value->>'sizeBytes')::bigint>209715200 then return query select 'FILE_QUOTA_EXCEEDED',null::jsonb; return; end if;
 if (p_value->>'quarantineObjectKey') !~ '^quarantine/[0-9a-f-]{36}/[A-Za-z0-9_-]{43}$' or (p_value->>'reservationFingerprint') !~ '^[a-f0-9]{64}$' or (p_value->>'mimeType') not in ('image/jpeg','image/png','image/webp','image/heic') or (p_value->>'sizeBytes')::bigint not between 1 and 20971520 then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 insert into public.hotel_file_uploads(id,company_id,branch_id,parent_type,repair_case_id,repair_visit_id,daily_sales_id,display_name,declared_mime,reserved_size,quarantine_object_key,reservation_fingerprint,status,initiated_by,initiated_session_id,expires_at) values(p_resource_id,p_company_id,p_branch_id,v_parent_type,nullif(p_value->>'repairCaseId','')::uuid,nullif(p_value->>'repairVisitId','')::uuid,nullif(p_value->>'dailySalesId','')::uuid,p_value->>'fileName',p_value->>'mimeType',(p_value->>'sizeBytes')::bigint,p_value->>'quarantineObjectKey',p_value->>'reservationFingerprint','PENDING_UPLOAD',actor.user_id,actor.session_id,now_at+interval '5 minutes');
 snapshot:=jsonb_build_object('id',p_resource_id,'status','PENDING_UPLOAD','expiresAt',to_char((now_at+interval '5 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,case when v_parent_type='DAILY_SALES_EVIDENCE' then 'HOTEL_DAILY_SALES_FILE_UPLOAD_INITIATED' else 'HOTEL_REPAIR_FILE_UPLOAD_INITIATED' end,actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_FILE_UPLOAD',p_resource_id,jsonb_build_object('parentType',v_parent_type,'dailySalesId',p_value->>'dailySalesId','repairCaseId',p_value->>'repairCaseId'),case when v_parent_type='DAILY_SALES_EVIDENCE' then '일매출 비공개 증빙 업로드 시작' else '보수 비공개 증빙 업로드 시작' end,'SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'HOTEL_FILE_UPLOAD',p_resource_id,p_audit_event_id,snapshot);
 return query select 'CREATED',snapshot;
exception when invalid_text_representation or check_violation or foreign_key_violation then return query select 'INVALID_STATE_TRANSITION',null::jsonb; when unique_violation then return query select 'DUPLICATE',null::jsonb;
end $function$;
revoke all on function public.hotel_repair_file_upload_init_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

create function public.hotel_daily_sales_snapshot_v1(p_company_id uuid,p_branch_id uuid,p_sales_id uuid,p_internal boolean) returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object('id',s.id,'hotelId',s.branch_id,'businessDate',s.business_date,'status',s.status,'version',s.version,
  'totals',jsonb_build_object('grossAmount',s.gross_amount,'discountAmount',s.discount_amount,'refundAmount',s.refund_amount,'netAmount',s.net_amount),
  'lines',coalesce((select jsonb_agg(jsonb_build_object('categoryId',l.category_id,'paymentMethodId',l.payment_method_id,'grossAmount',l.gross_amount,'discountAmount',l.discount_amount,'refundAmount',l.refund_amount,'refundReason',l.refund_reason) order by l.display_order,l.id) from public.hotel_daily_sales_lines l where l.company_id=s.company_id and l.branch_id=s.branch_id and l.sales_id=s.id),'[]'::jsonb),
  'evidence',coalesce((select jsonb_agg(jsonb_build_object('fileVersionId',a.file_version_id,'displayName',fv.display_name) order by a.linked_at,a.id) from public.hotel_daily_sales_attachments a join public.hotel_file_versions fv on fv.company_id=a.company_id and fv.id=a.file_version_id where a.company_id=s.company_id and a.branch_id=s.branch_id and a.sales_id=s.id and a.sales_version=s.version),'[]'::jsonb),
  'corrections',coalesce((select jsonb_agg(jsonb_build_object('version',c.to_version,'reason',c.reason,'correctedAt',to_char(c.corrected_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by c.to_version) from public.hotel_daily_sales_corrections c where c.company_id=s.company_id and c.branch_id=s.branch_id and c.sales_id=s.id),'[]'::jsonb),
  'confirmedAt',case when s.confirmed_at is null then null else to_char(s.confirmed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,'updatedAt',to_char(s.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ||
  case when p_internal then jsonb_build_object('internalMemo',s.internal_memo,'createdBy',jsonb_build_object('userId',u.id,'displayName',u.display_name)) else '{}'::jsonb end
 from public.hotel_daily_sales s join public.users u on u.company_id=s.company_id and u.id=s.created_by where s.company_id=p_company_id and s.branch_id=p_branch_id and s.id=p_sales_id and (p_internal or s.status='LOCKED')
$function$;
revoke all on function public.hotel_daily_sales_snapshot_v1(uuid,uuid,uuid,boolean) from public;

create function public.hotel_daily_sales_capabilities_v1(p_company_id uuid,p_session_token text) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
begin
 return query with actor as (
  select s.id session_id,u.id user_id,u.user_type from public.auth_sessions s join public.users u on u.company_id=s.company_id and u.id=s.user_id join public.companies c on c.id=s.company_id where public.runtime_has_capability('API_RUNTIME') and p_session_token~'^[A-Za-z0-9_-]{43}$' and s.id=nullif(current_setting('app.session_id',true),'')::uuid and s.company_id=p_company_id and s.token_hash=sha256(convert_to(p_session_token,'UTF8')) and s.revoked_at is null and s.idle_expires_at>statement_timestamp() and s.absolute_expires_at>statement_timestamp() and u.status='ACTIVE' and c.status='ACTIVE'
 ), scopes as (
  select h.branch_id,b.name,a.user_type from actor a join public.hotel_staff_assignments x on a.user_type='INTERNAL_STAFF' and x.company_id=p_company_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date) join public.hotel_profiles h on h.company_id=x.company_id and h.branch_id=x.branch_id join public.branches b on b.company_id=h.company_id and b.id=h.branch_id
  union select h.branch_id,b.name,a.user_type from actor a join public.hotel_owner_assignments x on a.user_type='HOTEL_OWNER' and x.company_id=p_company_id and x.user_id=a.user_id and x.terminated_at is null and x.start_date<=statement_timestamp()::date and (x.end_date is null or x.end_date>=statement_timestamp()::date) join public.hotel_profiles h on h.company_id=x.company_id and h.branch_id=x.branch_id join public.branches b on b.company_id=h.company_id and b.id=h.branch_id
 ) select case when exists(select 1 from actor) then 'OK' else 'FORBIDDEN' end, case when exists(select 1 from actor) then jsonb_build_object('hotels',coalesce((select jsonb_agg(jsonb_build_object('hotelId',s.branch_id,'hotelName',s.name,'canRead',exists(select 1 from public.hotel_daily_sales_actor_v1(p_company_id,s.branch_id,p_session_token,case when s.user_type='HOTEL_OWNER' then 'HOTEL_OWNER_SALES_READ' else 'HOTEL_SALES_VIEW' end)),'canManage',exists(select 1 from public.hotel_daily_sales_actor_v1(p_company_id,s.branch_id,p_session_token,'HOTEL_SALES_MANAGE')),'canConfirm',exists(select 1 from public.hotel_daily_sales_actor_v1(p_company_id,s.branch_id,p_session_token,'HOTEL_SALES_CONFIRM')),'canCorrect',exists(select 1 from public.hotel_daily_sales_actor_v1(p_company_id,s.branch_id,p_session_token,'HOTEL_SALES_CORRECT')),'ownerView',s.user_type='HOTEL_OWNER') order by s.name,s.branch_id) from scopes s),'[]'::jsonb)) else null::jsonb end;
end $function$;
revoke all on function public.hotel_daily_sales_capabilities_v1(uuid,text) from public;

create function public.hotel_daily_sales_read_v1(p_company_id uuid,p_branch_id uuid,p_sales_id uuid,p_query jsonb,p_session_token text) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; internal boolean; page_no int:=greatest(coalesce((p_query->>'page')::int,1),1); page_size int:=least(greatest(coalesce((p_query->>'pageSize')::int,20),1),100); total_count int;
begin
 select * into actor from public.hotel_daily_sales_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_SALES_VIEW'); internal:=found;
 if not internal then select * into actor from public.hotel_daily_sales_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_OWNER_SALES_READ'); end if;
 if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 if p_query->>'references'='true' then return query select 'OK',jsonb_build_object('categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by display_order,name,id) from public.hotel_sales_categories where company_id=p_company_id and branch_id=p_branch_id and status='ACTIVE'),'[]'::jsonb),'paymentMethods',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by display_order,name,id) from public.hotel_payment_methods where company_id=p_company_id and branch_id=p_branch_id and status='ACTIVE'),'[]'::jsonb)); return; end if;
 if p_sales_id is not null then return query select case when public.hotel_daily_sales_snapshot_v1(p_company_id,p_branch_id,p_sales_id,internal) is null then 'NOT_FOUND' else 'OK' end,public.hotel_daily_sales_snapshot_v1(p_company_id,p_branch_id,p_sales_id,internal); return; end if;
 select count(*) into total_count from public.hotel_daily_sales s where s.company_id=p_company_id and s.branch_id=p_branch_id and (internal or s.status='LOCKED') and (p_query->>'status' is null or s.status=p_query->>'status') and (p_query->>'from' is null or s.business_date>=(p_query->>'from')::date) and (p_query->>'to' is null or s.business_date<=(p_query->>'to')::date);
 return query select 'OK',jsonb_build_object('sales',coalesce((select jsonb_agg(public.hotel_daily_sales_snapshot_v1(p_company_id,p_branch_id,x.id,internal) order by x.business_date desc,x.id) from (select s.id,s.business_date from public.hotel_daily_sales s where s.company_id=p_company_id and s.branch_id=p_branch_id and (internal or s.status='LOCKED') and (p_query->>'status' is null or s.status=p_query->>'status') and (p_query->>'from' is null or s.business_date>=(p_query->>'from')::date) and (p_query->>'to' is null or s.business_date<=(p_query->>'to')::date) order by s.business_date desc,s.id offset (page_no-1)*page_size limit page_size)x),'[]'::jsonb),'pagination',jsonb_build_object('page',page_no,'pageSize',page_size,'total',total_count));
exception when invalid_text_representation then return query select 'NOT_FOUND',null::jsonb;
end $function$;
revoke all on function public.hotel_daily_sales_read_v1(uuid,uuid,uuid,jsonb,text) from public;

create function public.hotel_daily_sales_file_view_command_v1(
 p_company_id uuid,p_branch_id uuid,p_sales_id uuid,p_file_version_id uuid,
 p_action text,p_session_token text,p_grant_id uuid,p_completion_token text,
 p_audit_event_id uuid,p_alert_audit_event_id uuid,p_trace_id uuid
) returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; file_actor record; file_record record; grant_record public.hotel_file_access_grants%rowtype; window_at timestamptz:=date_bin(interval '5 minutes',statement_timestamp(),timestamptz '1970-01-01 00:00:00+00'); user_count int; hotel_count int; internal boolean;
begin
 if p_action not in ('AUTHORIZE','SUCCEEDED','FAILED','ABORTED') or p_completion_token !~ '^[A-Za-z0-9_-]{43}$' then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 if p_action<>'AUTHORIZE' then
  select g.* into grant_record from public.hotel_file_access_grants g where g.company_id=p_company_id and g.branch_id=p_branch_id and g.id=p_grant_id and g.daily_sales_id=p_sales_id and g.file_version_id=p_file_version_id and g.trace_id=p_trace_id and g.completion_token_hash=sha256(convert_to(p_completion_token,'UTF8')) for update;
  if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if grant_record.status=p_action then return query select 'RECORDED',null::jsonb; return; end if;
  if grant_record.status<>'STARTED' then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
  update public.hotel_file_access_grants set status=p_action,completed_at=statement_timestamp() where company_id=p_company_id and id=p_grant_id;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) values(p_audit_event_id,'HOTEL_DAILY_SALES_FILE_VIEW_'||p_action,grant_record.actor_user_id,grant_record.actor_type,grant_record.session_id,p_company_id,p_branch_id,'HOTEL_FILE_VERSION',p_file_version_id,jsonb_build_object('dailySalesId',p_sales_id),case when p_action='SUCCEEDED' then 'SUCCEEDED' else 'FAILED' end,p_trace_id);
  return query select 'RECORDED',null::jsonb; return;
 end if;
 select * into actor from public.hotel_daily_sales_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_SALES_VIEW'); internal:=found;
 if not internal then select * into actor from public.hotel_daily_sales_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_OWNER_SALES_READ'); end if;
 if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into file_actor from public.hotel_daily_sales_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_FILE_READ');
 if not found or file_actor.user_id<>actor.user_id or file_actor.session_id<>actor.session_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
 with recovered as (update public.hotel_file_access_grants g set status='ABORTED',completed_at=statement_timestamp() where g.company_id=p_company_id and g.branch_id=p_branch_id and g.daily_sales_id is not null and g.status='STARTED' and g.expires_at<=statement_timestamp() returning g.*)
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) select md5(recovered.id::text||':stale-daily-sales-file-view')::uuid,'HOTEL_DAILY_SALES_FILE_VIEW_ABANDONED',recovered.actor_user_id,recovered.actor_type,recovered.session_id,recovered.company_id,recovered.branch_id,'HOTEL_FILE_VERSION',recovered.file_version_id,jsonb_build_object('dailySalesId',recovered.daily_sales_id),'FAILED',recovered.trace_id from recovered on conflict(id) do nothing;
 insert into public.hotel_file_access_rate_windows(company_id,branch_id,scope_type,scope_id,window_started_at,request_count) values(p_company_id,p_branch_id,'USER',actor.user_id,window_at,1) on conflict(company_id,branch_id,scope_type,scope_id,window_started_at) do update set request_count=public.hotel_file_access_rate_windows.request_count+1,updated_at=statement_timestamp() where public.hotel_file_access_rate_windows.request_count<30 returning request_count into user_count;
 insert into public.hotel_file_access_rate_windows(company_id,branch_id,scope_type,scope_id,window_started_at,request_count) values(p_company_id,p_branch_id,'HOTEL',p_branch_id,window_at,1) on conflict(company_id,branch_id,scope_type,scope_id,window_started_at) do update set request_count=public.hotel_file_access_rate_windows.request_count+1,updated_at=statement_timestamp() where public.hotel_file_access_rate_windows.request_count<100 returning request_count into hotel_count;
 if hotel_count=80 then insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) values(p_alert_audit_event_id,'HOTEL_FILE_BULK_EXPORT_ALERT',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_FILE_ACCESS_WINDOW',p_branch_id,jsonb_build_object('windowStartedAt',window_at,'requestCount',80),'SUCCEEDED',p_trace_id); end if;
 if user_count is null or hotel_count is null then insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) values(p_audit_event_id,'HOTEL_DAILY_SALES_FILE_VIEW_RATE_LIMITED',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_FILE_VERSION',p_file_version_id,jsonb_build_object('dailySalesId',p_sales_id),'DENIED',p_trace_id); return query select 'RATE_LIMITED',null::jsonb; return; end if;
 select fv.clean_object_key,fv.clean_etag,fv.clean_object_version,encode(fv.clean_sha256,'hex') clean_sha256,fv.clean_size,fv.detected_mime,fv.display_name into file_record
 from public.hotel_daily_sales s join public.hotel_daily_sales_attachments a on a.company_id=s.company_id and a.branch_id=s.branch_id and a.sales_id=s.id and a.sales_version=s.version join public.hotel_file_versions fv on fv.company_id=a.company_id and fv.branch_id=a.branch_id and fv.id=a.file_version_id join public.hotel_file_uploads u on u.company_id=fv.company_id and u.branch_id=fv.branch_id and u.id=fv.upload_id and u.parent_type='DAILY_SALES_EVIDENCE' and u.daily_sales_id=s.id and u.status='LINKED' join public.hotel_file_scan_jobs j on j.company_id=fv.company_id and j.branch_id=fv.branch_id and j.upload_id=fv.upload_id and j.file_version_id=fv.id and j.status='COMPLETED'
 where s.company_id=p_company_id and s.branch_id=p_branch_id and s.id=p_sales_id and a.file_version_id=p_file_version_id and (internal or s.status='LOCKED') for share of s;
 if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
 insert into public.hotel_file_access_grants(id,company_id,branch_id,actor_user_id,actor_type,session_id,daily_sales_id,file_version_id,completion_token_hash,status,trace_id) values(p_grant_id,p_company_id,p_branch_id,actor.user_id,actor.user_type,actor.session_id,p_sales_id,p_file_version_id,sha256(convert_to(p_completion_token,'UTF8')),'STARTED',p_trace_id);
 return query select 'OK',jsonb_build_object('grantId',p_grant_id,'cleanObjectKey',file_record.clean_object_key,'etag',file_record.clean_etag,'objectVersion',file_record.clean_object_version,'sha256',file_record.clean_sha256,'sizeBytes',file_record.clean_size,'mimeType',file_record.detected_mime,'displayName',file_record.display_name);
end $function$;
revoke all on function public.hotel_daily_sales_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid) from public;

create function public.hotel_daily_sales_command_v1(p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; sales public.hotel_daily_sales%rowtype; before_snapshot jsonb; snapshot jsonb; permission text; line jsonb; file_id text; line_count int; sum_gross bigint; sum_discount bigint; sum_refund bigint; evidence_count int; now_at timestamptz:=statement_timestamp();
begin
 permission:=case p_action when 'CREATE' then 'HOTEL_SALES_MANAGE' when 'UPDATE' then 'HOTEL_SALES_MANAGE' when 'CONFIRM' then 'HOTEL_SALES_CONFIRM' else 'HOTEL_SALES_CORRECT' end;
 select * into actor from public.hotel_daily_sales_actor_v1(p_company_id,p_branch_id,p_session_token,permission); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 if p_action not in ('CREATE','UPDATE','CONFIRM','CORRECT') then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 if p_action='CREATE' then
  if exists(select 1 from public.hotel_daily_sales where company_id=p_company_id and branch_id=p_branch_id and business_date=(p_value->>'businessDate')::date) then return query select 'HOTEL_SALES_DUPLICATE_DATE',null::jsonb; return; end if;
 else
  select * into sales from public.hotel_daily_sales where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update;
  if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if sales.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if p_action='UPDATE' and sales.status='LOCKED' then return query select 'HOTEL_SALES_LOCKED',null::jsonb; return; end if;
  if p_action='CORRECT' and sales.status<>'LOCKED' then return query select 'HOTEL_SALES_LOCKED',null::jsonb; return; end if;
  if p_action='CONFIRM' and sales.status<>'DRAFT' then return query select 'HOTEL_SALES_LOCKED',null::jsonb; return; end if;
 end if;

 -- Validate the complete command before the first mutation. Returning an error from a
 -- PL/pgSQL function does not roll back prior statements in the surrounding transaction.
 if p_action in ('CREATE','UPDATE','CORRECT') then
  if jsonb_typeof(p_value->'lines') is distinct from 'array' or jsonb_array_length(p_value->'lines') not between 1 and 200 or char_length(coalesce(p_value->>'memo',''))>2000 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
  if p_action='CORRECT' and char_length(btrim(coalesce(p_value->>'reason',''))) not between 2 and 500 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
  line_count:=0; sum_gross:=0; sum_discount:=0; sum_refund:=0;
  for line in select value from jsonb_array_elements(p_value->'lines') loop
   line_count:=line_count+1;
   if jsonb_typeof(line) is distinct from 'object' or (line->>'grossAmount')::bigint not between 0 and 9000000000000 or (line->>'discountAmount')::bigint not between 0 and 9000000000000 or (line->>'refundAmount')::bigint not between 0 and 9000000000000 or (line->>'discountAmount')::bigint+(line->>'refundAmount')::bigint>(line->>'grossAmount')::bigint or (((line->>'refundAmount')::bigint>0)<>(nullif(btrim(line->>'refundReason'),'') is not null)) or (nullif(btrim(line->>'refundReason'),'') is not null and char_length(btrim(line->>'refundReason')) not between 2 and 500) then return query select 'HOTEL_SALES_TOTAL_MISMATCH',null::jsonb; return; end if;
   perform 1 from public.hotel_sales_categories where company_id=p_company_id and branch_id=p_branch_id and id=(line->>'categoryId')::uuid and status='ACTIVE'; if not found then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
   perform 1 from public.hotel_payment_methods where company_id=p_company_id and branch_id=p_branch_id and id=(line->>'paymentMethodId')::uuid and status='ACTIVE'; if not found then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
   sum_gross:=sum_gross+(line->>'grossAmount')::bigint; sum_discount:=sum_discount+(line->>'discountAmount')::bigint; sum_refund:=sum_refund+(line->>'refundAmount')::bigint;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_value->'lines') x group by x->>'categoryId',x->>'paymentMethodId' having count(*)>1) then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 end if;
 if p_action in ('CONFIRM','CORRECT') then
  if jsonb_typeof(p_value->'evidenceFileVersionIds') is distinct from 'array' or jsonb_array_length(p_value->'evidenceFileVersionIds') not between 1 and 20 then return query select 'HOTEL_SALES_EVIDENCE_REQUIRED',null::jsonb; return; end if;
  perform 1 from public.hotel_file_versions fv join public.hotel_file_uploads u on u.company_id=fv.company_id and u.id=fv.upload_id where fv.company_id=p_company_id and fv.branch_id=p_branch_id and fv.id in (select value::text::uuid from jsonb_array_elements_text(p_value->'evidenceFileVersionIds')) and u.branch_id=p_branch_id and u.parent_type='DAILY_SALES_EVIDENCE' and u.daily_sales_id=p_resource_id and u.status='READY_UNLINKED' for update of u;
  get diagnostics evidence_count = row_count;
  if evidence_count<>jsonb_array_length(p_value->'evidenceFileVersionIds') then return query select 'HOTEL_SALES_EVIDENCE_REQUIRED',null::jsonb; return; end if;
 end if;

 if p_action='CREATE' then
  insert into public.hotel_daily_sales(id,company_id,branch_id,business_date,internal_memo,created_by) values(p_resource_id,p_company_id,p_branch_id,(p_value->>'businessDate')::date,nullif(p_value->>'memo',''),actor.user_id) returning * into sales;
 end if;
 if p_action in ('CREATE','UPDATE','CORRECT') then
  before_snapshot:=case when p_action='CORRECT' then public.hotel_daily_sales_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true) else null end;
  delete from public.hotel_daily_sales_lines where company_id=p_company_id and branch_id=p_branch_id and sales_id=p_resource_id;
  line_count:=0;
  for line in select value from jsonb_array_elements(p_value->'lines') loop
   line_count:=line_count+1;
   insert into public.hotel_daily_sales_lines(id,company_id,branch_id,sales_id,category_id,payment_method_id,gross_amount,discount_amount,refund_amount,refund_reason,display_order) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,(line->>'categoryId')::uuid,(line->>'paymentMethodId')::uuid,(line->>'grossAmount')::bigint,(line->>'discountAmount')::bigint,(line->>'refundAmount')::bigint,nullif(btrim(line->>'refundReason'),''),line_count-1);
  end loop;
  update public.hotel_daily_sales set gross_amount=sum_gross,discount_amount=sum_discount,refund_amount=sum_refund,internal_memo=nullif(p_value->>'memo',''),version=case when p_action='CREATE' then version else version+1 end,updated_at=now_at where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id returning * into sales;
 end if;
 if p_action in ('CONFIRM','CORRECT') then
  update public.hotel_daily_sales set status='LOCKED',version=case when p_action='CONFIRM' then version+1 else version end,confirmed_by=actor.user_id,confirmed_at=coalesce(confirmed_at,now_at),updated_at=now_at where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id returning * into sales;
  for file_id in select value from jsonb_array_elements_text(p_value->'evidenceFileVersionIds') loop insert into public.hotel_daily_sales_attachments(id,company_id,branch_id,sales_id,sales_version,file_version_id,purpose,linked_by) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,sales.version,file_id::uuid,case when p_action='CONFIRM' then 'CLOSING_EVIDENCE' else 'CORRECTION_EVIDENCE' end,actor.user_id); update public.hotel_file_uploads u set status='LINKED',updated_at=now_at from public.hotel_file_versions fv where fv.company_id=p_company_id and fv.upload_id=u.id and fv.id=file_id::uuid and u.status='READY_UNLINKED'; end loop;
  snapshot:=public.hotel_daily_sales_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true);
  if p_action='CORRECT' then
   insert into public.hotel_daily_sales_corrections(id,company_id,branch_id,sales_id,from_version,to_version,reason,before_snapshot,after_snapshot,corrected_by) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,p_expected_version,sales.version,p_value->>'reason',before_snapshot,snapshot,actor.user_id);
   snapshot:=public.hotel_daily_sales_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true);
  end if;
  insert into public.hotel_daily_sales_versions(id,company_id,branch_id,sales_id,sales_version,action,snapshot,actor_user_id,reason) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,sales.version,p_action,snapshot,actor.user_id,case when p_action='CONFIRM' then '일매출 확정' else p_value->>'reason' end);
 end if;
 snapshot:=coalesce(snapshot,public.hotel_daily_sales_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true));
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_DAILY_SALES_'||p_action,actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_DAILY_SALES',p_resource_id,jsonb_build_object('businessDate',sales.business_date,'status',sales.status,'version',sales.version,'netAmount',sales.net_amount),coalesce(p_value->>'reason','일매출 저장'),'SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'HOTEL_DAILY_SALES',p_resource_id,p_audit_event_id,snapshot);
 return query select case when p_action='CREATE' then 'CREATED' else 'UPDATED' end,snapshot;
exception when invalid_text_representation or check_violation or foreign_key_violation then return query select 'VALIDATION_ERROR',null::jsonb; when unique_violation then return query select case when p_action='CREATE' then 'HOTEL_SALES_DUPLICATE_DATE' else 'HOTEL_SALES_TOTAL_MISMATCH' end,null::jsonb;
end $function$;
revoke all on function public.hotel_daily_sales_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

alter table public.hotel_sales_categories enable row level security; alter table public.hotel_sales_categories force row level security;
alter table public.hotel_payment_methods enable row level security; alter table public.hotel_payment_methods force row level security;
alter table public.hotel_daily_sales enable row level security; alter table public.hotel_daily_sales force row level security;
alter table public.hotel_daily_sales_lines enable row level security; alter table public.hotel_daily_sales_lines force row level security;
alter table public.hotel_daily_sales_versions enable row level security; alter table public.hotel_daily_sales_versions force row level security;
alter table public.hotel_daily_sales_corrections enable row level security; alter table public.hotel_daily_sales_corrections force row level security;
alter table public.hotel_daily_sales_attachments enable row level security; alter table public.hotel_daily_sales_attachments force row level security;
do $policies$ declare t text; begin foreach t in array array['hotel_sales_categories','hotel_payment_methods','hotel_daily_sales','hotel_daily_sales_lines','hotel_daily_sales_versions','hotel_daily_sales_corrections','hotel_daily_sales_attachments'] loop execute format('create policy %I_company_isolation on public.%I using (case when public.runtime_is_schema_owner() then true when current_user=''werehere_auth_session_definer'' then true when current_user=''werehere_tenant_authority_definer'' then true when public.runtime_has_capability(''API_RUNTIME'') then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER'') then company_id=public.reconciler_current_company_id() else false end) with check (case when public.runtime_is_schema_owner() then true when current_user=''werehere_auth_session_definer'' then true when current_user=''werehere_tenant_authority_definer'' then true when public.runtime_has_capability(''API_RUNTIME'') then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER'') then company_id=public.reconciler_current_company_id() else false end)',t,t); end loop; end $policies$;
do $acl$ declare r text; begin for r in select role_name from public.runtime_database_capabilities where capability='API_RUNTIME' loop execute format('revoke all on public.hotel_sales_categories,public.hotel_payment_methods,public.hotel_daily_sales,public.hotel_daily_sales_lines,public.hotel_daily_sales_versions,public.hotel_daily_sales_corrections,public.hotel_daily_sales_attachments from %I',r); execute format('grant execute on function public.hotel_daily_sales_capabilities_v1(uuid,text) to %I',r); execute format('grant execute on function public.hotel_daily_sales_read_v1(uuid,uuid,uuid,jsonb,text) to %I',r); execute format('grant execute on function public.hotel_daily_sales_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid) to %I',r); execute format('grant execute on function public.hotel_daily_sales_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I',r); end loop; end $acl$;

insert into public.schema_migrations(version) values('0050_hotel_daily_sales');
commit;
