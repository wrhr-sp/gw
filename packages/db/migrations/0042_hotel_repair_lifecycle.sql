begin;

insert into public.permissions(code, description) values
 ('REPAIR_PRIORITY_MANAGE','호텔 보수 우선순위 설정'),
 ('REPAIR_CREATE','호텔 보수 등록'),
 ('REPAIR_READ','호텔 보수 자료 조회'),
 ('REPAIR_VISIT_CREATE','호텔 보수 방문일정 생성'),
 ('REPAIR_VISIT_UPDATE','호텔 보수 방문일정 변경·완료'),
 ('REPAIR_VISIT_DELETE','호텔 보수 방문일정 논리삭제'),
 ('REPAIR_COMPLETE','호텔 보수 최종완료'),
 ('REPAIR_REVIEW','호텔 보수 프로세스 검토'),
 ('REPAIR_EXTERNAL_CONTACT_VIEW','외부 보수업체 연락처 원문 조회')
on conflict(code) do update set description=excluded.description;

alter table public.process_definitions drop constraint if exists process_definitions_application_type_check;
alter table public.process_definitions add constraint process_definitions_application_type_check check(application_type in ('ROOM_INSPECTION','REPAIR_CASE'));
alter table public.hotel_process_defaults drop constraint if exists hotel_process_defaults_application_type_check;
alter table public.hotel_process_defaults add constraint hotel_process_defaults_application_type_check check(application_type in ('ROOM_INSPECTION','REPAIR_CASE'));
alter table public.process_executions drop constraint if exists process_executions_application_type_check;
alter table public.process_executions add constraint process_executions_application_type_check check(application_type in ('ROOM_INSPECTION','REPAIR_CASE'));

create table public.hotel_repair_priorities(
 id uuid primary key,
 company_id uuid not null references public.companies(id),
 branch_id uuid not null,
 name text not null check(char_length(btrim(name)) between 1 and 100),
 normalized_name text generated always as (lower(btrim(name))) stored,
 sort_order integer not null check(sort_order between 0 and 100000),
 color text not null check(color ~ '^[A-Z][A-Z0-9_]{0,39}$'),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','DELETED')),
 version integer not null default 1 check(version>=1),
 created_by uuid not null,
 updated_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(company_id,branch_id,id),
 unique (company_id, branch_id, normalized_name),
 foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id),
 foreign key(company_id,created_by) references public.users(company_id,id),
 foreign key(company_id,updated_by) references public.users(company_id,id)
);

create table public.hotel_repair_priority_history(
 id uuid primary key,
 company_id uuid not null,
 branch_id uuid not null,
 priority_id uuid not null,
 priority_version integer not null check(priority_version>=1),
 action text not null,
 reason text not null check(char_length(btrim(reason)) between 2 and 500),
 before_summary jsonb,
 after_summary jsonb not null,
 actor_user_id uuid not null,
 occurred_at timestamptz not null default now(),
 unique(company_id,priority_id,priority_version),
 foreign key(company_id,branch_id,priority_id) references public.hotel_repair_priorities(company_id,branch_id,id),
 foreign key(company_id,actor_user_id) references public.users(company_id,id)
);

create table public.hotel_repair_cases(
 id uuid primary key,
 company_id uuid not null references public.companies(id),
 branch_id uuid not null,
 version integer not null default 1 check(version>=1),
 status text not null default 'OPEN' check(status in ('OPEN','COMPLETED')),
 source_type text not null check(source_type in ('INSPECTION','DIRECT')),
 target_type text not null check(target_type in ('ROOM','COMMON_AREA','FACILITY')),
 room_id uuid,
 common_area_id uuid,
 facility_id uuid,
 target_name_snapshot text not null check(btrim(target_name_snapshot)<>''),
 facility_type_name_snapshot text,
 location_name_snapshot text,
 inspection_id uuid,
 inspection_execution_target_id uuid,
 inspection_item_snapshot_id uuid,
 inspection_result_id uuid,
 inspection_result_version integer,
 defect_description text not null check(char_length(btrim(defect_description)) between 2 and 2000),
 defect_file_version_ids uuid[] not null default '{}',
 defect_unavailable_reason text,
 priority_id uuid not null,
 priority_version_snapshot integer not null check(priority_version_snapshot>=1),
 priority_name_snapshot text not null,
 priority_sort_order_snapshot integer not null,
 priority_color_snapshot text not null,
 process_execution_id uuid not null,
 follow_up_of_repair_case_id uuid,
 completion_result text,
 completed_by uuid,
 completed_at timestamptz,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(company_id,branch_id,id),
 constraint repair_target_exactly_one_check check(
   (target_type='ROOM' and room_id is not null and common_area_id is null and facility_id is null) or
   (target_type='COMMON_AREA' and room_id is null and common_area_id is not null and facility_id is null) or
   (target_type='FACILITY' and room_id is null and common_area_id is null and facility_id is not null)
 ),
 constraint repair_source_exactly_one_check check(
   (source_type='INSPECTION' and inspection_id is not null and inspection_execution_target_id is not null and inspection_item_snapshot_id is not null and inspection_result_id is not null and inspection_result_version is not null and defect_unavailable_reason is null) or
   (source_type='DIRECT' and inspection_id is null and inspection_execution_target_id is null and inspection_item_snapshot_id is null and inspection_result_id is null and inspection_result_version is null and (cardinality(defect_file_version_ids)>0 or coalesce(char_length(btrim(defect_unavailable_reason)),0) between 2 and 500))
 ),
 check((status='OPEN' and completion_result is null and completed_by is null and completed_at is null) or (status='COMPLETED' and char_length(btrim(completion_result)) between 2 and 2000 and completed_by is not null and completed_at is not null)),
 foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id),
 foreign key (company_id, branch_id, room_id) references public.hotel_rooms(company_id,branch_id,id),
 foreign key (company_id, branch_id, common_area_id) references public.hotel_common_areas(company_id,branch_id,id),
 foreign key (company_id, branch_id, facility_id) references public.hotel_facilities(company_id,branch_id,id),
 foreign key(company_id,branch_id,priority_id) references public.hotel_repair_priorities(company_id,branch_id,id),
 foreign key(company_id,branch_id,inspection_id) references public.hotel_inspections(company_id,branch_id,id),
 foreign key(company_id,inspection_item_snapshot_id) references public.inspection_item_snapshots(company_id,id),
 foreign key(company_id,inspection_result_id) references public.inspection_item_results(company_id,id),
 foreign key(company_id,process_execution_id) references public.process_executions(company_id,id) deferrable initially deferred,
 foreign key(company_id,branch_id,follow_up_of_repair_case_id) references public.hotel_repair_cases(company_id,branch_id,id) deferrable initially deferred,
 foreign key(company_id,created_by) references public.users(company_id,id),
 foreign key(company_id,completed_by) references public.users(company_id,id)
);

alter table public.hotel_repair_cases
  add constraint repair_inspection_target_fkey
    foreign key (company_id, branch_id, inspection_id, inspection_execution_target_id)
    references public.inspection_execution_targets(company_id, branch_id, execution_id, id),
  add constraint repair_inspection_result_history_fkey
    foreign key (company_id, inspection_result_id, inspection_result_version)
    references public.inspection_item_result_history(company_id, result_id, version);

create function public.repair_inspection_source_guard_v1() returns trigger
language plpgsql set search_path=pg_catalog as $function$
declare source_record record;
begin
 if new.source_type<>'INSPECTION' then return new; end if;
 select target.target_type,target.room_id,target.facility_id,
        target.room_number_snapshot,target.facility_name_snapshot,
        target.facility_type_name_snapshot,target.facility_location_name_snapshot,
        history.description,history.file_version_ids
   into source_record
   from public.inspection_execution_targets target
   join public.inspection_item_snapshots item
     on item.company_id=target.company_id and item.branch_id=target.branch_id
    and item.inspection_id=target.execution_id and item.execution_target_id=target.id
    and item.id=new.inspection_item_snapshot_id
   join public.inspection_item_result_history history
     on history.company_id=item.company_id and history.branch_id=item.branch_id
    and history.inspection_id=item.inspection_id and history.item_snapshot_id=item.id
    and history.result_id=new.inspection_result_id
    and history.version=new.inspection_result_version
  where target.company_id=new.company_id and target.branch_id=new.branch_id
    and target.execution_id=new.inspection_id
    and target.id=new.inspection_execution_target_id;
 if not found
    or new.target_type<>source_record.target_type
    or new.room_id is distinct from source_record.room_id
    or new.facility_id is distinct from source_record.facility_id
    or new.common_area_id is not null
    or new.target_name_snapshot is distinct from (case source_record.target_type when 'ROOM' then source_record.room_number_snapshot else source_record.facility_name_snapshot end)
    or new.facility_type_name_snapshot is distinct from source_record.facility_type_name_snapshot
    or new.location_name_snapshot is distinct from source_record.facility_location_name_snapshot
    or new.defect_description is distinct from source_record.description
    or new.defect_file_version_ids is distinct from source_record.file_version_ids
 then raise check_violation using message='repair inspection source snapshot mismatch'; end if;
 return new;
end
$function$;
revoke all on function public.repair_inspection_source_guard_v1() from public;
create trigger repair_inspection_source_guard
before insert or update of source_type,target_type,room_id,common_area_id,facility_id,
  target_name_snapshot,facility_type_name_snapshot,location_name_snapshot,
  inspection_id,inspection_execution_target_id,inspection_item_snapshot_id,
  inspection_result_id,inspection_result_version,defect_description,defect_file_version_ids
on public.hotel_repair_cases for each row execute function public.repair_inspection_source_guard_v1();

create table public.hotel_repair_case_history(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, repair_case_id uuid not null,
 case_version integer not null check(case_version>=1), action text not null, reason text not null check(char_length(btrim(reason)) between 2 and 500),
 before_summary jsonb, after_summary jsonb, actor_user_id uuid not null, occurred_at timestamptz not null default now(),
 unique(company_id,repair_case_id,case_version),
 foreign key(company_id,branch_id,repair_case_id) references public.hotel_repair_cases(company_id,branch_id,id),
 foreign key(company_id,actor_user_id) references public.users(company_id,id)
);

create table public.hotel_repair_visits(
 id uuid primary key, company_id uuid not null references public.companies(id), branch_id uuid not null,
 repair_case_id uuid not null, title text not null check(char_length(btrim(title)) between 1 and 150),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 status text not null default 'SCHEDULED' check(status in ('SCHEDULED','COMPLETED','CANCELLED','DELETED')),
 result text, completion_file_version_ids uuid[] not null default '{}', completion_unavailable_reason text,
 completed_by uuid, completed_at timestamptz, cancel_reason text, cancelled_by uuid, cancelled_at timestamptz,
 delete_reason text, deleted_by uuid, deleted_at timestamptz,
 version integer not null default 1 check(version>=1), created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,branch_id,id),
 check((status<>'COMPLETED' and result is null and completed_by is null and completed_at is null) or (status='COMPLETED' and char_length(btrim(result)) between 2 and 2000 and (cardinality(completion_file_version_ids)>0 or coalesce(char_length(btrim(completion_unavailable_reason)),0) between 2 and 500) and completed_by is not null and completed_at is not null)),
 foreign key(company_id,branch_id,repair_case_id) references public.hotel_repair_cases(company_id,branch_id,id),
 foreign key(company_id,created_by) references public.users(company_id,id),
 foreign key(company_id,completed_by) references public.users(company_id,id),
 foreign key(company_id,cancelled_by) references public.users(company_id,id),
 foreign key(company_id,deleted_by) references public.users(company_id,id)
);

create table public.hotel_repair_visit_performers(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, repair_visit_id uuid not null,
 performer_type text not null check(performer_type in ('INTERNAL','EXTERNAL')), internal_user_id uuid,
 contractor_name text, contact_name text, contact_phone text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,branch_id,repair_visit_id),
 constraint repair_performer_exactly_one_check check(
  (performer_type='INTERNAL' and internal_user_id is not null and contractor_name is null and contact_name is null and contact_phone is null) or
  (performer_type='EXTERNAL' and internal_user_id is null and char_length(btrim(contractor_name)) between 1 and 150 and (contact_name is null or char_length(btrim(contact_name)) between 1 and 100) and char_length(btrim(contact_phone)) between 3 and 50)
 ),
 foreign key(company_id,branch_id,repair_visit_id) references public.hotel_repair_visits(company_id,branch_id,id),
 foreign key(company_id,internal_user_id) references public.users(company_id,id)
);

create table public.hotel_repair_visit_performer_history(
 id uuid primary key,
 company_id uuid not null,
 branch_id uuid not null,
 repair_visit_id uuid not null,
 visit_version integer not null check(visit_version>=1),
 action text not null,
 before_summary jsonb,
 after_summary jsonb,
 actor_user_id uuid not null,
 occurred_at timestamptz not null default now(),
 unique(company_id,repair_visit_id,visit_version),
 foreign key(company_id,branch_id,repair_visit_id) references public.hotel_repair_visits(company_id,branch_id,id),
 foreign key(company_id,actor_user_id) references public.users(company_id,id)
);

alter table public.hotel_file_uploads
  drop constraint hotel_file_uploads_parent_type_check,
  alter column inspection_id drop not null,
  alter column item_snapshot_id drop not null,
  add column repair_case_id uuid,
  add column repair_visit_id uuid,
  add constraint hotel_file_uploads_parent_exact_check check (
    (parent_type='INSPECTION_ITEM_EVIDENCE' and inspection_id is not null and item_snapshot_id is not null and repair_case_id is null and repair_visit_id is null) or
    (parent_type='REPAIR_CASE_EVIDENCE' and inspection_id is null and item_snapshot_id is null and repair_case_id is not null and repair_visit_id is null) or
    (parent_type='REPAIR_VISIT_COMPLETION_EVIDENCE' and inspection_id is null and item_snapshot_id is null and repair_case_id is not null and repair_visit_id is not null)
  );

alter table public.hotel_file_links
  drop constraint hotel_file_links_parent_type_check,
  alter column inspection_id drop not null,
  alter column item_snapshot_id drop not null,
  alter column result_id drop not null,
  alter column result_version drop not null,
  add column repair_case_id uuid,
  add column repair_visit_id uuid,
  add constraint hotel_file_links_parent_exact_check check (
    (parent_type='INSPECTION_ITEM_EVIDENCE' and inspection_id is not null and item_snapshot_id is not null and result_id is not null and result_version is not null and repair_case_id is null and repair_visit_id is null) or
    (parent_type='REPAIR_CASE_EVIDENCE' and inspection_id is null and item_snapshot_id is null and result_id is null and result_version is null and repair_case_id is not null and repair_visit_id is null) or
    (parent_type='REPAIR_VISIT_COMPLETION_EVIDENCE' and inspection_id is null and item_snapshot_id is null and result_id is null and result_version is null and repair_case_id is not null and repair_visit_id is not null)
  ),
  add constraint hotel_file_links_repair_case_fkey foreign key(company_id,branch_id,repair_case_id) references public.hotel_repair_cases(company_id,branch_id,id),
  add constraint hotel_file_links_repair_visit_fkey foreign key(company_id,branch_id,repair_visit_id) references public.hotel_repair_visits(company_id,branch_id,id);

create or replace function public.guard_hotel_file_link_parent_v1()
returns trigger language plpgsql set search_path=pg_catalog as $function$
declare existing_link public.hotel_file_links%rowtype;
begin
 perform 1 from public.hotel_file_versions version_record where version_record.company_id=new.company_id and version_record.id=new.file_version_id for update;
 select link.* into existing_link from public.hotel_file_links link where link.company_id=new.company_id and link.file_version_id=new.file_version_id order by link.linked_at,link.id limit 1;
 if found and (
   existing_link.parent_type is distinct from new.parent_type or
   existing_link.inspection_id is distinct from new.inspection_id or
   existing_link.item_snapshot_id is distinct from new.item_snapshot_id or
   existing_link.result_id is distinct from new.result_id or
   existing_link.result_version is distinct from new.result_version or
   existing_link.repair_case_id is distinct from new.repair_case_id or
   existing_link.repair_visit_id is distinct from new.repair_visit_id
 ) then raise exception 'EVIDENCE_PARENT_IMMUTABLE' using errcode='23514'; end if;
 return new;
end $function$;
revoke all on function public.guard_hotel_file_link_parent_v1() from public;

create table public.hotel_repair_visit_history(
 id uuid primary key, company_id uuid not null, branch_id uuid not null, repair_visit_id uuid not null,
 visit_version integer not null check(visit_version>=1), action text not null, reason text not null check(char_length(btrim(reason)) between 2 and 500),
 before_summary jsonb, after_summary jsonb, actor_user_id uuid not null, occurred_at timestamptz not null default now(),
 unique(company_id,repair_visit_id,visit_version),
 foreign key(company_id,branch_id,repair_visit_id) references public.hotel_repair_visits(company_id,branch_id,id),
 foreign key(company_id,actor_user_id) references public.users(company_id,id)
);

create function public.repair_history_append_only() returns trigger language plpgsql set search_path=pg_catalog as $function$ begin raise exception 'repair history is append-only' using errcode='55000'; end $function$;
revoke all on function public.repair_history_append_only() from public;
create trigger repair_priority_history_append_only before update or delete on public.hotel_repair_priority_history for each row execute function public.repair_history_append_only();
create trigger repair_case_history_append_only before update or delete on public.hotel_repair_case_history for each row execute function public.repair_history_append_only();
create trigger repair_visit_history_append_only before update or delete on public.hotel_repair_visit_history for each row execute function public.repair_history_append_only();
create trigger repair_visit_performer_history_append_only before update or delete on public.hotel_repair_visit_performer_history for each row execute function public.repair_history_append_only();

create function public.repair_priority_lifecycle_guard() returns trigger language plpgsql set search_path=pg_catalog as $function$
begin
 if tg_op='DELETE' then raise exception 'repair priority physical deletion is forbidden' using errcode='55000'; end if;
 if old.status='DELETED' and new is distinct from old then raise exception 'deleted repair priority is immutable' using errcode='55000'; end if;
 return new;
end $function$;
revoke all on function public.repair_priority_lifecycle_guard() from public;
create trigger repair_priority_lifecycle before update or delete on public.hotel_repair_priorities for each row execute function public.repair_priority_lifecycle_guard();

create function public.repair_visit_performer_cardinality() returns trigger language plpgsql set search_path=pg_catalog as $function$
declare v_company uuid; v_branch uuid; v_visit uuid;
begin
 if tg_table_name='hotel_repair_visits' then
  v_company:=coalesce(new.company_id,old.company_id); v_branch:=coalesce(new.branch_id,old.branch_id); v_visit:=coalesce(new.id,old.id);
 else
  v_company:=coalesce(new.company_id,old.company_id); v_branch:=coalesce(new.branch_id,old.branch_id); v_visit:=coalesce(new.repair_visit_id,old.repair_visit_id);
 end if;
 if exists(select 1 from public.hotel_repair_visits visit where visit.company_id=v_company and visit.branch_id=v_branch and visit.id=v_visit and visit.status<>'DELETED') and (select count(*) from public.hotel_repair_visit_performers performer where performer.company_id=v_company and performer.branch_id=v_branch and performer.repair_visit_id=v_visit)<>1 then raise exception 'REPAIR_PERFORMER_INVALID' using errcode='55000'; end if;
 return null;
end $function$;
revoke all on function public.repair_visit_performer_cardinality() from public;
create constraint trigger repair_visit_performer_cardinality_visit after insert or update or delete on public.hotel_repair_visits deferrable initially deferred for each row execute function public.repair_visit_performer_cardinality();
create constraint trigger repair_visit_performer_cardinality_performer after insert or update or delete on public.hotel_repair_visit_performers deferrable initially deferred for each row execute function public.repair_visit_performer_cardinality();

create function public.repair_follow_up_integrity() returns trigger language plpgsql set search_path=pg_catalog as $function$
declare parent public.hotel_repair_cases%rowtype; cursor_id uuid; seen uuid[]:='{}';
begin
 if new.follow_up_of_repair_case_id is null then return new; end if;
 if new.follow_up_of_repair_case_id=new.id then raise exception 'REPAIR_FOLLOW_UP_INVALID' using errcode='55000'; end if;
 select * into parent from public.hotel_repair_cases p where p.company_id=new.company_id and p.branch_id=new.branch_id and p.id=new.follow_up_of_repair_case_id for update;
 if not found or parent.status<>'COMPLETED' or parent.target_type<>new.target_type or parent.room_id is distinct from new.room_id or parent.common_area_id is distinct from new.common_area_id or parent.facility_id is distinct from new.facility_id then raise exception 'REPAIR_FOLLOW_UP_INVALID' using errcode='55000'; end if;
 cursor_id:=parent.follow_up_of_repair_case_id;
 while cursor_id is not null loop if cursor_id=new.id or cursor_id=any(seen) then raise exception 'REPAIR_FOLLOW_UP_INVALID' using errcode='55000'; end if; seen:=array_append(seen,cursor_id); select p.follow_up_of_repair_case_id into cursor_id from public.hotel_repair_cases p where p.company_id=new.company_id and p.branch_id=new.branch_id and p.id=cursor_id; end loop;
 if tg_op='UPDATE' and new.follow_up_of_repair_case_id is distinct from old.follow_up_of_repair_case_id then raise exception 'REPAIR_FOLLOW_UP_INVALID' using errcode='55000'; end if;
 return new;
end $function$;
revoke all on function public.repair_follow_up_integrity() from public;
create constraint trigger repair_follow_up_integrity after insert or update on public.hotel_repair_cases deferrable initially deferred for each row execute function public.repair_follow_up_integrity();

create function public.repair_completed_locked() returns trigger language plpgsql set search_path=pg_catalog as $function$
begin
 if old.status='COMPLETED' and new is distinct from old then raise exception 'REPAIR_COMPLETED_LOCKED' using errcode='55000'; end if; return new;
end $function$;
revoke all on function public.repair_completed_locked() from public;
create trigger repair_completed_locked before update or delete on public.hotel_repair_cases for each row execute function public.repair_completed_locked();

create function public.repair_snapshot_v1(p_company_id uuid,p_branch_id uuid,p_repair_id uuid,p_show_contact boolean) returns jsonb language sql stable set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'id',c.id,'hotelId',c.branch_id,'status',c.status,'version',c.version,
  'target',jsonb_build_object('type',c.target_type,'id',coalesce(c.room_id,c.common_area_id,c.facility_id),'name',c.target_name_snapshot,'facilityTypeName',c.facility_type_name_snapshot,'locationName',c.location_name_snapshot),
  'priority',jsonb_build_object('id',c.priority_id,'version',c.priority_version_snapshot,'name',c.priority_name_snapshot,'sortOrder',c.priority_sort_order_snapshot,'color',c.priority_color_snapshot),
  'source',case when c.source_type='INSPECTION' then jsonb_build_object('type','INSPECTION','inspectionId',c.inspection_id,'executionTargetId',c.inspection_execution_target_id,'itemSnapshotId',c.inspection_item_snapshot_id,'resultId',c.inspection_result_id,'resultVersion',c.inspection_result_version) else jsonb_build_object('type','DIRECT','description',c.defect_description,'fileVersionIds',to_jsonb(c.defect_file_version_ids),'unavailableReason',c.defect_unavailable_reason) end,
  'process',jsonb_build_object('executionId',p.id,'version',p.version,'state',p.state,'currentStageName',p.current_stage_name),
  'visits',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'repairCaseId',v.repair_case_id,'title',v.title,'startsAt',to_char(v.starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'endsAt',to_char(v.ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'status',v.status,'version',v.version,'performer',case when pf.performer_type='INTERNAL' then jsonb_build_object('type','INTERNAL','userId',pf.internal_user_id) else jsonb_build_object('type','EXTERNAL','contractorName',pf.contractor_name,'contactName',case when p_show_contact then pf.contact_name else null end,'contactPhone',case when p_show_contact then pf.contact_phone else regexp_replace(pf.contact_phone,'.(?=.{2})','*','g') end) end,'result',v.result,'unavailableReason',v.completion_unavailable_reason,'fileVersionIds',to_jsonb(v.completion_file_version_ids),'calendarProjectionStatus','NOT_CONNECTED') order by v.starts_at,v.id) from public.hotel_repair_visits v join public.hotel_repair_visit_performers pf on pf.company_id=v.company_id and pf.branch_id=v.branch_id and pf.repair_visit_id=v.id where v.company_id=c.company_id and v.branch_id=c.branch_id and v.repair_case_id=c.id),'[]'::jsonb),
  'predecessor',(select jsonb_build_object('id',parent.id,'targetName',parent.target_name_snapshot,'completedAt',to_char(parent.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) from public.hotel_repair_cases parent where parent.company_id=c.company_id and parent.branch_id=c.branch_id and parent.id=c.follow_up_of_repair_case_id),
  'followUpCount',(select count(*) from public.hotel_repair_cases child where child.company_id=c.company_id and child.branch_id=c.branch_id and child.follow_up_of_repair_case_id=c.id),
  'calendarProjectionStatus','NOT_CONNECTED','createdAt',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(c.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ) from public.hotel_repair_cases c join public.process_executions p on p.company_id=c.company_id and p.id=c.process_execution_id where c.company_id=p_company_id and c.branch_id=p_branch_id and c.id=p_repair_id
$function$;
revoke all on function public.repair_snapshot_v1(uuid,uuid,uuid,boolean) from public;

create function public.repair_idempotency_begin_v1(
 p_company_id uuid,p_actor_user_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text
) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare existing record; now_at timestamptz:=statement_timestamp();
begin
 if btrim(coalesce(p_idempotency_key,''))='' or p_http_method not in ('POST','PATCH','DELETE') or btrim(coalesce(p_operation_path,''))='' or btrim(coalesce(p_request_hash,''))='' then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||':'||p_actor_user_id::text||':'||p_idempotency_key||':'||p_http_method||':'||p_operation_path,0));
 delete from public.idempotency_records where company_id=p_company_id and actor_user_id=p_actor_user_id and idempotency_key=p_idempotency_key and http_method=p_http_method and operation_path=p_operation_path and expires_at<=now_at;
 select record.request_hash,record.result_snapshot into existing from public.idempotency_records record where record.company_id=p_company_id and record.actor_user_id=p_actor_user_id and record.idempotency_key=p_idempotency_key and record.http_method=p_http_method and record.operation_path=p_operation_path and record.status='COMPLETED';
 if found then return query select case when existing.request_hash=p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end,case when existing.request_hash=p_request_hash then existing.result_snapshot else null::jsonb end; end if;
end $function$;
revoke all on function public.repair_idempotency_begin_v1(uuid,uuid,text,text,text,text) from public;

create function public.repair_idempotency_store_v1(
 p_id uuid,p_company_id uuid,p_actor_user_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_resource_type text,p_resource_id uuid,p_audit_event_id uuid,p_result_snapshot jsonb
) returns void language sql volatile security definer set search_path=pg_catalog as $function$
 insert into public.idempotency_records(id,company_id,actor_user_id,idempotency_key,http_method,operation_path,request_hash,status,resource_type,resource_id,audit_event_id,result_snapshot,completed_at,expires_at)
 values(p_id,p_company_id,p_actor_user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'COMPLETED',p_resource_type,p_resource_id,p_audit_event_id,p_result_snapshot,statement_timestamp(),statement_timestamp()+interval '24 hours')
$function$;
revoke all on function public.repair_idempotency_store_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,jsonb) from public;

create function public.hotel_repair_file_upload_init_v1(
 p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,
 p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_audit_event_id uuid,p_trace_id uuid
) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; file_actor record; replay record; v_parent_type text:=p_value->>'parentType'; now_at timestamptz:=statement_timestamp(); total_count integer; total_size bigint; snapshot jsonb;
begin
 if p_action<>'UPLOAD_INIT' or p_expected_version<>0 or v_parent_type not in ('REPAIR_CASE_EVIDENCE','REPAIR_VISIT_COMPLETION_EVIDENCE') then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 select * into actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,case when v_parent_type='REPAIR_CASE_EVIDENCE' then 'REPAIR_CREATE' else 'REPAIR_VISIT_UPDATE' end,true); if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
 select * into file_actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_FILE_UPLOAD',true); if not found or file_actor.user_id<>actor.user_id or file_actor.session_id<>actor.session_id then return query select 'NOT_FOUND',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 if v_parent_type='REPAIR_CASE_EVIDENCE' then
   if exists(select 1 from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=(p_value->>'repairCaseId')::uuid) then return query select 'DUPLICATE',null::jsonb; return; end if;
 else
   perform 1 from public.hotel_repair_visits v join public.hotel_repair_cases c on c.company_id=v.company_id and c.branch_id=v.branch_id and c.id=v.repair_case_id where v.company_id=p_company_id and v.branch_id=p_branch_id and v.id=(p_value->>'repairVisitId')::uuid and v.repair_case_id=(p_value->>'repairCaseId')::uuid and v.status='SCHEDULED' and c.status='OPEN' for share of v,c;
   if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
 end if;
 select count(*),coalesce(sum(u.reserved_size),0) into total_count,total_size from public.hotel_file_uploads u where u.company_id=p_company_id and u.branch_id=p_branch_id and u.parent_type=v_parent_type and u.repair_case_id=(p_value->>'repairCaseId')::uuid and u.repair_visit_id is not distinct from nullif(p_value->>'repairVisitId','')::uuid and u.status not in ('EXPIRED','REJECTED','SCAN_FAILED');
 if total_count>=20 or total_size+(p_value->>'sizeBytes')::bigint>209715200 then return query select 'FILE_QUOTA_EXCEEDED',null::jsonb; return; end if;
 if (p_value->>'quarantineObjectKey') !~ '^quarantine/[0-9a-f-]{36}/[A-Za-z0-9_-]{43}$' or (p_value->>'reservationFingerprint') !~ '^[a-f0-9]{64}$' or (p_value->>'mimeType') not in ('image/jpeg','image/png','image/webp','image/heic') or (p_value->>'sizeBytes')::bigint not between 1 and 20971520 then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 insert into public.hotel_file_uploads(id,company_id,branch_id,parent_type,repair_case_id,repair_visit_id,display_name,declared_mime,reserved_size,quarantine_object_key,reservation_fingerprint,status,initiated_by,initiated_session_id,expires_at) values(p_resource_id,p_company_id,p_branch_id,v_parent_type,(p_value->>'repairCaseId')::uuid,nullif(p_value->>'repairVisitId','')::uuid,p_value->>'fileName',p_value->>'mimeType',(p_value->>'sizeBytes')::bigint,p_value->>'quarantineObjectKey',p_value->>'reservationFingerprint','PENDING_UPLOAD',actor.user_id,actor.session_id,now_at+interval '5 minutes');
 snapshot:=jsonb_build_object('id',p_resource_id,'status','PENDING_UPLOAD','expiresAt',to_char((now_at+interval '5 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_FILE_UPLOAD_INITIATED',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_FILE_UPLOAD',p_resource_id,jsonb_build_object('parentType',v_parent_type,'repairCaseId',p_value->>'repairCaseId'),'보수 비공개 증빙 업로드 시작','SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'HOTEL_FILE_UPLOAD',p_resource_id,p_audit_event_id,snapshot);
 return query select 'CREATED',snapshot;
exception when invalid_text_representation or check_violation or foreign_key_violation then return query select 'INVALID_STATE_TRANSITION',null::jsonb; when unique_violation then return query select 'DUPLICATE',null::jsonb;
end $function$;
revoke all on function public.hotel_repair_file_upload_init_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

create function public.hotel_repair_read_v1(p_company_id uuid,p_branch_id uuid,p_repair_id uuid,p_query jsonb,p_session_token text) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; show_contact boolean; page_no int:=greatest(coalesce((p_query->>'page')::int,1),1); page_size int:=least(greatest(coalesce((p_query->>'pageSize')::int,20),1),100); total_count int;
begin
 select * into actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'REPAIR_READ',true); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 show_contact:=exists(select 1 from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'REPAIR_EXTERNAL_CONTACT_VIEW',true));
 if p_query->>'kind'='PRIORITIES' then return query select 'OK',jsonb_build_object('priorities',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,'name',p.name,'sortOrder',p.sort_order,'color',p.color,'status',p.status) order by p.sort_order,p.id) from public.hotel_repair_priorities p where p.company_id=p_company_id and p.status='ACTIVE'),'[]'::jsonb)); return; end if;
 if p_repair_id is not null then return query select case when public.repair_snapshot_v1(p_company_id,p_branch_id,p_repair_id,show_contact) is null then 'NOT_FOUND' else 'OK' end,public.repair_snapshot_v1(p_company_id,p_branch_id,p_repair_id,show_contact); return; end if;
 select count(*) into total_count from public.hotel_repair_cases c where c.company_id=p_company_id and c.branch_id=p_branch_id and (p_query->>'parentId' is null or c.follow_up_of_repair_case_id=(p_query->>'parentId')::uuid) and (p_query->>'status' is null or c.status=p_query->>'status');
 return query select 'OK',jsonb_build_object('repairs',coalesce((select jsonb_agg(public.repair_snapshot_v1(p_company_id,p_branch_id,c.id,show_contact)-'visits' order by c.created_at desc,c.id) from (select c.id,c.created_at from public.hotel_repair_cases c where c.company_id=p_company_id and c.branch_id=p_branch_id and (p_query->>'parentId' is null or c.follow_up_of_repair_case_id=(p_query->>'parentId')::uuid) and (p_query->>'status' is null or c.status=p_query->>'status') order by c.created_at desc,c.id limit page_size offset ((page_no-1)*page_size)) c),'[]'::jsonb),'pagination',jsonb_build_object('page',page_no,'pageSize',page_size,'total',total_count,'totalPages',case when total_count=0 then 0 else ceil(total_count::numeric/page_size)::int end));
exception when invalid_text_representation then return query select 'NOT_FOUND',null::jsonb;
end $function$;
revoke all on function public.hotel_repair_read_v1(uuid,uuid,uuid,jsonb,text) from public;

create function public.hotel_repair_priority_command_v1(p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; row_record public.hotel_repair_priorities%rowtype; now_at timestamptz:=statement_timestamp(); snapshot jsonb; before_snapshot jsonb;
begin
 select * into actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'REPAIR_PRIORITY_MANAGE',true); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 if p_action='CREATE' then insert into public.hotel_repair_priorities(id,company_id,branch_id,name,sort_order,color,created_by,updated_by) values(p_resource_id,p_company_id,p_branch_id,p_value->>'name',(p_value->>'sortOrder')::int,p_value->>'color',actor.user_id,actor.user_id) returning * into row_record;
 else select * into row_record from public.hotel_repair_priorities where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if row_record.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if; before_snapshot:=jsonb_build_object('version',row_record.version,'name',row_record.name,'sortOrder',row_record.sort_order,'color',row_record.color,'status',row_record.status); update public.hotel_repair_priorities set name=coalesce(p_value->>'name',name),sort_order=coalesce((p_value->>'sortOrder')::int,sort_order),color=coalesce(p_value->>'color',color),status=coalesce(p_value->>'status',status),version=version+1,updated_by=actor.user_id,updated_at=now_at where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id returning * into row_record; end if;
 insert into public.hotel_repair_priority_history(id,company_id,branch_id,priority_id,priority_version,action,reason,before_summary,after_summary,actor_user_id) values(gen_random_uuid(),p_company_id,p_branch_id,row_record.id,row_record.version,p_action,coalesce(p_value->>'reason','우선순위 설정'),before_snapshot,jsonb_build_object('version',row_record.version,'name',row_record.name,'sortOrder',row_record.sort_order,'color',row_record.color,'status',row_record.status),actor.user_id);
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_PRIORITY_'||p_action,actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'REPAIR_PRIORITY',row_record.id,jsonb_build_object('id',row_record.id,'version',row_record.version,'name',row_record.name,'status',row_record.status),coalesce(p_value->>'reason','우선순위 설정'),'SUCCEEDED',p_trace_id);
 snapshot:=jsonb_build_object('priority',jsonb_build_object('id',row_record.id,'version',row_record.version,'name',row_record.name,'sortOrder',row_record.sort_order,'color',row_record.color,'status',row_record.status));
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'REPAIR_PRIORITY',row_record.id,p_audit_event_id,snapshot);
 return query select case when p_action='CREATE' then 'CREATED' else 'UPDATED' end,snapshot;
exception when unique_violation then return query select 'VERSION_CONFLICT',null::jsonb;
end $function$;
revoke all on function public.hotel_repair_priority_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

create function public.hotel_repair_case_command_v1(p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; priority public.hotel_repair_priorities%rowtype; process_default record; process_revision record; inspection_source record; target_name text; facility_type_name text; location_name text; process_id uuid:=gen_random_uuid(); source_type text:=p_value#>>'{source,type}'; target_type text:=p_value#>>'{target,type}'; case_row public.hotel_repair_cases%rowtype; parent public.hotel_repair_cases%rowtype; file_count int; now_at timestamptz:=statement_timestamp(); snapshot jsonb;
begin
 select * into actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,case when p_action in ('SUBMIT_REVIEW','COMPLETE') then 'REPAIR_COMPLETE' else 'REPAIR_CREATE' end,true); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 if p_action in ('CREATE_DIRECT','CREATE_INSPECTION','CREATE_FOLLOW_UP') then
  select p.* into priority from public.hotel_repair_priorities p where p.company_id=p_company_id and p.branch_id=p_branch_id and p.id=(p_value->>'priorityId')::uuid and p.status='ACTIVE' for update; if not found then return query select 'REPAIR_PRIORITY_REQUIRED',null::jsonb; return; end if;
  if p_action='CREATE_INSPECTION' then
   select target.target_type,target.room_id,target.facility_id,
          target.room_number_snapshot,target.facility_name_snapshot,
          target.facility_type_name_snapshot,target.facility_location_name_snapshot,
          result.id result_id,result.version result_version,
          history.description,history.file_version_ids
     into inspection_source
     from public.inspection_item_results result
     join public.inspection_item_result_history history
       on history.company_id=result.company_id and history.branch_id=result.branch_id
      and history.inspection_id=result.inspection_id and history.item_snapshot_id=result.item_snapshot_id
      and history.result_id=result.id and history.version=result.version
     join public.inspection_item_snapshots item
       on item.company_id=result.company_id and item.branch_id=result.branch_id
      and item.inspection_id=result.inspection_id and item.id=result.item_snapshot_id
     join public.inspection_execution_targets target
       on target.company_id=item.company_id and target.branch_id=item.branch_id
      and target.execution_id=item.inspection_id and target.id=item.execution_target_id
    where result.company_id=p_company_id and result.branch_id=p_branch_id
      and result.inspection_id=(p_value#>>'{source,inspectionId}')::uuid
      and result.item_snapshot_id=(p_value#>>'{source,itemSnapshotId}')::uuid
      and result.id=(p_value#>>'{source,resultId}')::uuid
      and result.version=(p_value#>>'{source,resultVersion}')::integer
      and item.execution_target_id=(p_value#>>'{source,executionTargetId}')::uuid
      and result.result in ('CAUTION','ABNORMAL')
    for key share of result,item,target,history;
   if not found
      or target_type<>inspection_source.target_type
      or nullif(p_value#>>'{target,roomId}','')::uuid is distinct from inspection_source.room_id
      or nullif(p_value#>>'{target,facilityId}','')::uuid is distinct from inspection_source.facility_id
      or p_value#>>'{target,commonAreaId}' is not null
   then return query select 'NOT_FOUND',null::jsonb; return; end if;
   target_name:=case inspection_source.target_type when 'ROOM' then inspection_source.room_number_snapshot else inspection_source.facility_name_snapshot end;
   facility_type_name:=inspection_source.facility_type_name_snapshot;
   location_name:=inspection_source.facility_location_name_snapshot;
  elsif target_type='ROOM' then select room.room_number into target_name from public.hotel_rooms room where room.company_id=p_company_id and room.branch_id=p_branch_id and room.id=(p_value#>>'{target,roomId}')::uuid and room.status='ACTIVE' for share;
  elsif target_type='COMMON_AREA' then select area.name into target_name from public.hotel_common_areas area where area.company_id=p_company_id and area.branch_id=p_branch_id and area.id=(p_value#>>'{target,commonAreaId}')::uuid and area.status='ACTIVE' for share;
  elsif target_type='FACILITY' then select facility.name,ft.name,case when facility.location_type='ROOM' then room.room_number else area.name end into target_name,facility_type_name,location_name from public.hotel_facilities facility join public.hotel_facility_types ft on ft.company_id=facility.company_id and ft.branch_id=facility.branch_id and ft.id=facility.facility_type_id left join public.hotel_rooms room on room.company_id=facility.company_id and room.branch_id=facility.branch_id and room.id=facility.room_id left join public.hotel_common_areas area on area.company_id=facility.company_id and area.branch_id=facility.branch_id and area.id=facility.common_area_id where facility.company_id=p_company_id and facility.branch_id=p_branch_id and facility.id=(p_value#>>'{target,facilityId}')::uuid and facility.status='ACTIVE' for share of facility,ft,room,area; end if;
  if target_name is null then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if p_action='CREATE_FOLLOW_UP' then select * into parent from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=(p_value->>'followUpOfRepairCaseId')::uuid for update; if not found or parent.version<>(p_value->>'followUpParentVersion')::int or parent.status<>'COMPLETED' then return query select 'REPAIR_FOLLOW_UP_INVALID',null::jsonb; return; end if; end if;
  select d.definition_id,d.revision_id into process_default from public.hotel_process_defaults d where d.company_id=p_company_id and d.branch_id=p_branch_id and d.application_type='REPAIR_CASE'; if not found then return query select 'PROCESS_DEFAULT_REQUIRED',null::jsonb; return; end if;
  select r.start_stage_key,s.stage_name,s.reviewer_user_id,s.delegate_user_id,case when s.due_unit='HOURS' then now_at+make_interval(hours=>s.due_amount) when s.due_unit='DAYS' then now_at+make_interval(days=>s.due_amount) end due_at into process_revision from public.process_definition_revisions r join public.process_stage_snapshots s on s.company_id=r.company_id and s.revision_id=r.id and s.stage_key=r.start_stage_key where r.company_id=p_company_id and r.id=process_default.revision_id;
  insert into public.process_executions(id,company_id,branch_id,application_type,resource_id,definition_id,revision_id,state,current_stage_key,current_stage_name,current_reviewer_user_id,current_delegate_user_id,current_due_at,version,started_at,created_by) values(process_id,p_company_id,p_branch_id,'REPAIR_CASE',p_resource_id,process_default.definition_id,process_default.revision_id,'PENDING_INPUT',null,null,null,null,null,1,null,actor.user_id);
  insert into public.hotel_repair_cases(id,company_id,branch_id,source_type,target_type,room_id,common_area_id,facility_id,target_name_snapshot,facility_type_name_snapshot,location_name_snapshot,inspection_id,inspection_execution_target_id,inspection_item_snapshot_id,inspection_result_id,inspection_result_version,defect_description,defect_file_version_ids,defect_unavailable_reason,priority_id,priority_version_snapshot,priority_name_snapshot,priority_sort_order_snapshot,priority_color_snapshot,process_execution_id,follow_up_of_repair_case_id,created_by) values(p_resource_id,p_company_id,p_branch_id,source_type,target_type,nullif(p_value#>>'{target,roomId}','')::uuid,nullif(p_value#>>'{target,commonAreaId}','')::uuid,nullif(p_value#>>'{target,facilityId}','')::uuid,target_name,facility_type_name,location_name,case when p_action='CREATE_INSPECTION' then (p_value#>>'{source,inspectionId}')::uuid end,case when p_action='CREATE_INSPECTION' then (p_value#>>'{source,executionTargetId}')::uuid end,case when p_action='CREATE_INSPECTION' then (p_value#>>'{source,itemSnapshotId}')::uuid end,case when p_action='CREATE_INSPECTION' then inspection_source.result_id end,case when p_action='CREATE_INSPECTION' then inspection_source.result_version end,case when p_action='CREATE_INSPECTION' then inspection_source.description else p_value#>>'{source,description}' end,case when p_action='CREATE_INSPECTION' then inspection_source.file_version_ids else coalesce(array(select jsonb_array_elements_text(p_value#>'{source,fileVersionIds}'))::uuid[],'{}') end,case when p_action='CREATE_INSPECTION' then null else nullif(p_value#>>'{source,unavailableReason}','') end,priority.id,priority.version,priority.name,priority.sort_order,priority.color,process_id,nullif(p_value->>'followUpOfRepairCaseId','')::uuid,actor.user_id) returning * into case_row;
  if p_action<>'CREATE_INSPECTION' then
   select count(*) into file_count from public.hotel_file_versions fv join public.hotel_file_uploads u on u.company_id=fv.company_id and u.id=fv.upload_id where fv.company_id=p_company_id and fv.branch_id=p_branch_id and fv.id=any(case_row.defect_file_version_ids) and u.status='READY_UNLINKED'; if file_count<>cardinality(case_row.defect_file_version_ids) then raise exception 'REPAIR_EVIDENCE_REQUIRED' using errcode='55000'; end if;
   insert into public.hotel_file_links(id,company_id,branch_id,file_version_id,parent_type,repair_case_id,linked_by) select gen_random_uuid(),p_company_id,p_branch_id,file_id,'REPAIR_CASE_EVIDENCE',p_resource_id,actor.user_id from unnest(case_row.defect_file_version_ids) file_id; update public.hotel_file_uploads u set status='LINKED',updated_at=now_at from public.hotel_file_versions fv where fv.company_id=p_company_id and fv.upload_id=u.id and fv.id=any(case_row.defect_file_version_ids);
  end if;
  insert into public.hotel_repair_case_history(id,company_id,branch_id,repair_case_id,case_version,action,reason,after_summary,actor_user_id) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,1,p_action,'보수 등록',jsonb_build_object('status','OPEN','targetType',target_type,'priorityId',priority.id),actor.user_id);
  snapshot:=public.repair_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true);
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_CREATED',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'REPAIR_CASE',p_resource_id,jsonb_build_object('status','OPEN','sourceType',source_type,'targetType',target_type),'보수 등록','SUCCEEDED',p_trace_id);
  perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'REPAIR_CASE',p_resource_id,p_audit_event_id,snapshot);
  return query select 'CREATED',snapshot; return;
 elsif p_action='SUBMIT_REVIEW' then
  select * into case_row from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if case_row.status='COMPLETED' then return query select 'REPAIR_COMPLETED_LOCKED',null::jsonb; return; end if; if case_row.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if exists(select 1 from public.hotel_repair_visits v where v.company_id=p_company_id and v.branch_id=p_branch_id and v.repair_case_id=p_resource_id and v.status='SCHEDULED') or not exists(select 1 from public.hotel_repair_visits v where v.company_id=p_company_id and v.branch_id=p_branch_id and v.repair_case_id=p_resource_id and v.status='COMPLETED') then return query select 'REPAIR_VISIT_INVALID',null::jsonb; return; end if;
  select r.start_stage_key,s.stage_name,s.reviewer_user_id,s.delegate_user_id,case when s.due_unit='HOURS' then now_at+make_interval(hours=>s.due_amount) when s.due_unit='DAYS' then now_at+make_interval(days=>s.due_amount) end due_at into process_revision from public.process_executions e join public.process_definition_revisions r on r.company_id=e.company_id and r.id=e.revision_id join public.process_stage_snapshots s on s.company_id=r.company_id and s.revision_id=r.id and s.stage_key=r.start_stage_key where e.company_id=p_company_id and e.id=case_row.process_execution_id and e.state='PENDING_INPUT' and e.version=(p_value->>'processVersion')::int for update of e;
  if not found or not public.hotel_process_reviewer_is_eligible_v1(p_company_id,p_branch_id,process_revision.reviewer_user_id,now_at) then return query select 'PROCESS_ASSIGNEE_INVALID',null::jsonb; return; end if;
  update public.process_executions set state='IN_REVIEW',current_stage_key=process_revision.start_stage_key,current_stage_name=process_revision.stage_name,current_reviewer_user_id=process_revision.reviewer_user_id,current_delegate_user_id=process_revision.delegate_user_id,current_due_at=process_revision.due_at,version=version+1,started_at=now_at,updated_at=now_at where company_id=p_company_id and id=case_row.process_execution_id;
  insert into public.process_execution_history(id,company_id,branch_id,execution_id,previous_state,next_state,previous_stage_key,next_stage_key,event,reason,actor_user_id,occurred_at) values(gen_random_uuid(),p_company_id,p_branch_id,case_row.process_execution_id,'PENDING_INPUT','IN_REVIEW',null,process_revision.start_stage_key,'SUBMIT','보수 검토요청',actor.user_id,now_at);
  update public.hotel_repair_cases set version=version+1,updated_at=now_at where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id returning * into case_row;
  insert into public.hotel_repair_case_history(id,company_id,branch_id,repair_case_id,case_version,action,reason,after_summary,actor_user_id) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,case_row.version,'SUBMIT_REVIEW','보수 검토요청',jsonb_build_object('status','OPEN','processState','IN_REVIEW'),actor.user_id);
  snapshot:=public.repair_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true);
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_REVIEW_SUBMITTED',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'REPAIR_CASE',p_resource_id,jsonb_build_object('processState','IN_REVIEW'),'보수 검토요청','SUCCEEDED',p_trace_id);
  perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'REPAIR_CASE',p_resource_id,p_audit_event_id,snapshot);
  return query select 'UPDATED',snapshot; return;
 elsif p_action='COMPLETE' then
  select * into case_row from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if case_row.status='COMPLETED' then return query select 'REPAIR_COMPLETED_LOCKED',null::jsonb; return; end if; if case_row.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if exists(select 1 from public.hotel_repair_visits v where v.company_id=p_company_id and v.branch_id=p_branch_id and v.repair_case_id=p_resource_id and v.status='SCHEDULED') or not exists(select 1 from public.hotel_repair_visits v where v.company_id=p_company_id and v.branch_id=p_branch_id and v.repair_case_id=p_resource_id and v.status='COMPLETED') then return query select 'REPAIR_VISIT_INVALID',null::jsonb; return; end if;
  perform 1 from public.process_executions where company_id=p_company_id and id=case_row.process_execution_id and state='COMPLETED' and version=(p_value->>'processVersion')::int for update;
  if not found then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  update public.hotel_repair_cases set status='COMPLETED',completion_result=coalesce(p_value->>'result','보수 완료'),completed_by=actor.user_id,completed_at=now_at,version=version+1,updated_at=now_at where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id returning * into case_row;
  insert into public.hotel_repair_case_history(id,company_id,branch_id,repair_case_id,case_version,action,reason,before_summary,after_summary,actor_user_id) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,case_row.version,'COMPLETE','보수 최종완료',jsonb_build_object('status','OPEN'),jsonb_build_object('status','COMPLETED'),actor.user_id);
  snapshot:=public.repair_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true);
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_COMPLETED',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'REPAIR_CASE',p_resource_id,jsonb_build_object('status','COMPLETED','version',case_row.version),'보수 최종완료','SUCCEEDED',p_trace_id);
  perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'REPAIR_CASE',p_resource_id,p_audit_event_id,snapshot);
  return query select 'UPDATED',snapshot; return;
 end if;
 return query select 'VALIDATION_ERROR',null::jsonb;
exception when sqlstate '55000' then return query select case when sqlerrm in ('REPAIR_EVIDENCE_REQUIRED','REPAIR_FOLLOW_UP_INVALID','REPAIR_COMPLETED_LOCKED') then sqlerrm else 'REPAIR_FOLLOW_UP_INVALID' end,null::jsonb; when foreign_key_violation or check_violation or invalid_text_representation then return query select 'REPAIR_FOLLOW_UP_INVALID',null::jsonb;
end $function$;
revoke all on function public.hotel_repair_case_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

create function public.hotel_repair_visit_command_v1(p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; case_row public.hotel_repair_cases%rowtype; visit_row public.hotel_repair_visits%rowtype; performer_id uuid; now_at timestamptz:=statement_timestamp(); permission text:=case when p_action='CREATE' then 'REPAIR_VISIT_CREATE' when p_action='DELETE' then 'REPAIR_VISIT_DELETE' else 'REPAIR_VISIT_UPDATE' end; file_ids uuid[]; file_count int; snapshot jsonb;
begin
 select * into actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,permission,true); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 if p_action='CREATE' then
  select * into case_row from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=(p_value->>'repairCaseId')::uuid for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if case_row.status='COMPLETED' then return query select 'REPAIR_COMPLETED_LOCKED',null::jsonb; return; end if;
  insert into public.hotel_repair_visits(id,company_id,branch_id,repair_case_id,title,starts_at,ends_at,created_by) values(p_resource_id,p_company_id,p_branch_id,case_row.id,p_value->>'title',(p_value->>'startsAt')::timestamptz,(p_value->>'endsAt')::timestamptz,actor.user_id) returning * into visit_row;
  performer_id:=gen_random_uuid(); insert into public.hotel_repair_visit_performers(id,company_id,branch_id,repair_visit_id,performer_type,internal_user_id,contractor_name,contact_name,contact_phone) values(performer_id,p_company_id,p_branch_id,p_resource_id,p_value#>>'{performer,type}',nullif(p_value#>>'{performer,userId}','')::uuid,nullif(p_value#>>'{performer,contractorName}',''),nullif(p_value#>>'{performer,contactName}',''),nullif(p_value#>>'{performer,contactPhone}',''));
 elsif p_action in ('UPDATE','CANCEL','RESTORE','DELETE','COMPLETE') then
  select * into visit_row from public.hotel_repair_visits where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; select * into case_row from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=visit_row.repair_case_id for update; perform 1 from public.process_executions p where p.company_id=p_company_id and p.id=case_row.process_execution_id for update; perform 1 from public.hotel_repair_visit_performers pf where pf.company_id=p_company_id and pf.branch_id=p_branch_id and pf.repair_visit_id=p_resource_id for update;
  if case_row.status='COMPLETED' then return query select 'REPAIR_COMPLETED_LOCKED',null::jsonb; return; end if; if visit_row.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if p_action='UPDATE' then update public.hotel_repair_visits set title=p_value->>'title',starts_at=(p_value->>'startsAt')::timestamptz,ends_at=(p_value->>'endsAt')::timestamptz,version=version+1,updated_at=now_at where id=p_resource_id returning * into visit_row; delete from public.hotel_repair_visit_performers where company_id=p_company_id and branch_id=p_branch_id and repair_visit_id=p_resource_id; insert into public.hotel_repair_visit_performers(id,company_id,branch_id,repair_visit_id,performer_type,internal_user_id,contractor_name,contact_name,contact_phone) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,p_value#>>'{performer,type}',nullif(p_value#>>'{performer,userId}','')::uuid,nullif(p_value#>>'{performer,contractorName}',''),nullif(p_value#>>'{performer,contactName}',''),nullif(p_value#>>'{performer,contactPhone}',''));
  elsif p_action='CANCEL' then update public.hotel_repair_visits set status='CANCELLED',cancel_reason=p_value->>'reason',cancelled_by=actor.user_id,cancelled_at=now_at,version=version+1,updated_at=now_at where id=p_resource_id and status='SCHEDULED' returning * into visit_row;
  elsif p_action='RESTORE' then update public.hotel_repair_visits set status='SCHEDULED',cancel_reason=null,cancelled_by=null,cancelled_at=null,version=version+1,updated_at=now_at where id=p_resource_id and status='CANCELLED' returning * into visit_row;
  elsif p_action='DELETE' then update public.hotel_repair_visits set status='DELETED',delete_reason=p_value->>'reason',deleted_by=actor.user_id,deleted_at=now_at,version=version+1,updated_at=now_at where id=p_resource_id and status='SCHEDULED' and starts_at>now_at and result is null and cardinality(completion_file_version_ids)=0 returning * into visit_row;
  else file_ids:=coalesce(array(select jsonb_array_elements_text(p_value->'fileVersionIds'))::uuid[],'{}'); if cardinality(file_ids)=0 and nullif(p_value->>'unavailableReason','') is null then return query select 'REPAIR_EVIDENCE_REQUIRED',null::jsonb; return; end if; select count(*) into file_count from public.hotel_file_versions fv join public.hotel_file_uploads u on u.company_id=fv.company_id and u.id=fv.upload_id where fv.company_id=p_company_id and fv.branch_id=p_branch_id and fv.id=any(file_ids) and u.status='READY_UNLINKED'; if file_count<>cardinality(file_ids) then return query select 'REPAIR_EVIDENCE_REQUIRED',null::jsonb; return; end if; update public.hotel_repair_visits set status='COMPLETED',result=p_value->>'result',completion_file_version_ids=file_ids,completion_unavailable_reason=nullif(p_value->>'unavailableReason',''),completed_by=actor.user_id,completed_at=now_at,version=version+1,updated_at=now_at where id=p_resource_id and status='SCHEDULED' returning * into visit_row; insert into public.hotel_file_links(id,company_id,branch_id,file_version_id,parent_type,repair_case_id,repair_visit_id,linked_by) select gen_random_uuid(),p_company_id,p_branch_id,file_id,'REPAIR_VISIT_COMPLETION_EVIDENCE',visit_row.repair_case_id,p_resource_id,actor.user_id from unnest(file_ids) file_id; update public.hotel_file_uploads u set status='LINKED',updated_at=now_at from public.hotel_file_versions fv where fv.company_id=p_company_id and fv.upload_id=u.id and fv.id=any(file_ids); end if;
  if visit_row.id is null then return query select 'REPAIR_VISIT_INVALID',null::jsonb; return; end if;
 else return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 if p_action in ('CREATE','UPDATE') and p_value#>>'{performer,type}'='INTERNAL' and not exists(
  with candidate as (
   select u.id from public.users u join public.companies c on c.id=u.company_id where u.company_id=p_company_id and u.id=nullif(p_value#>>'{performer,userId}','')::uuid and u.status='ACTIVE' and u.user_type in ('INTERNAL_STAFF','HOUSEKEEPING') and c.status='ACTIVE' and exists(select 1 from public.hotel_staff_assignments a where a.company_id=p_company_id and a.branch_id=p_branch_id and a.user_id=u.id and a.terminated_at is null and a.start_date<=now_at::date and (a.end_date is null or a.end_date>=now_at::date))
  ), subjects as (
   select 'USER'::text subject_type,id subject_id from candidate union all select 'ROLE',m.role_id from candidate c join public.user_role_memberships m on m.company_id=p_company_id and m.user_id=c.id join public.roles r on r.company_id=m.company_id and r.id=m.role_id where m.valid_from<=now_at and (m.valid_until is null or m.valid_until>now_at) and r.status='ACTIVE' union all select 'GROUP',m.group_id from candidate c join public.user_group_memberships m on m.company_id=p_company_id and m.user_id=c.id join public.user_groups g on g.company_id=m.company_id and g.id=m.group_id where m.valid_from<=now_at and (m.valid_until is null or m.valid_until>now_at) and g.status='ACTIVE'
  ), effects as (
   select pg.effect from public.permission_grants pg join subjects s on s.subject_type=pg.subject_type and s.subject_id=pg.subject_id where pg.company_id=p_company_id and pg.permission_code='REPAIR_VISIT_UPDATE' and (pg.branch_id is null or pg.branch_id=p_branch_id) and pg.valid_from<=now_at and (pg.valid_until is null or pg.valid_until>now_at)
  ) select 1 from candidate where exists(select 1 from effects where effect='ALLOW') and not exists(select 1 from effects where effect='DENY')
 ) then raise exception 'REPAIR_PERFORMER_INVALID' using errcode='55000'; end if;
 insert into public.hotel_repair_visit_history(id,company_id,branch_id,repair_visit_id,visit_version,action,reason,after_summary,actor_user_id) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,visit_row.version,p_action,coalesce(p_value->>'reason',case when p_action='COMPLETE' then '방문 작업완료' else '방문일정 등록' end),jsonb_build_object('status',visit_row.status,'startsAt',visit_row.starts_at,'endsAt',visit_row.ends_at),actor.user_id);
 insert into public.hotel_repair_visit_performer_history(id,company_id,branch_id,repair_visit_id,visit_version,action,after_summary,actor_user_id) select gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,visit_row.version,p_action,jsonb_build_object('performerType',pf.performer_type,'internalUserId',pf.internal_user_id,'contractorName',pf.contractor_name,'contactName',pf.contact_name,'contactPhone',pf.contact_phone),actor.user_id from public.hotel_repair_visit_performers pf where pf.company_id=p_company_id and pf.branch_id=p_branch_id and pf.repair_visit_id=p_resource_id;
 snapshot:=(select element from jsonb_array_elements(public.repair_snapshot_v1(p_company_id,p_branch_id,visit_row.repair_case_id,true)->'visits') element where element->>'id'=p_resource_id::text);
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_VISIT_'||p_action,actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'REPAIR_VISIT',p_resource_id,jsonb_build_object('repairCaseId',visit_row.repair_case_id,'status',visit_row.status,'version',visit_row.version),coalesce(p_value->>'reason','방문 작업 변경'),'SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'REPAIR_VISIT',p_resource_id,p_audit_event_id,snapshot);
 return query select case when p_action='CREATE' then 'CREATED' else 'UPDATED' end,snapshot;
exception when sqlstate '55000' then return query select 'REPAIR_PERFORMER_INVALID',null::jsonb; when foreign_key_violation or check_violation or invalid_text_representation then return query select 'REPAIR_PERFORMER_INVALID',null::jsonb;
end $function$;
revoke all on function public.hotel_repair_visit_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

alter table public.hotel_file_access_grants
  drop constraint hotel_file_access_grants_inspection_fkey,
  alter column inspection_id drop not null,
  add column repair_case_id uuid,
  add constraint hotel_file_access_grants_inspection_fkey
    foreign key (company_id, branch_id, inspection_id)
    references public.hotel_inspections(company_id, branch_id, id),
  add constraint hotel_file_access_grants_repair_case_fkey
    foreign key (company_id, branch_id, repair_case_id)
    references public.hotel_repair_cases(company_id, branch_id, id),
  add constraint hotel_file_access_grants_parent_check check (
    (inspection_id is not null and repair_case_id is null)
    or (inspection_id is null and repair_case_id is not null)
  );

create function public.hotel_repair_file_view_command_v1(
 p_company_id uuid,p_branch_id uuid,p_repair_id uuid,p_file_version_id uuid,
 p_action text,p_session_token text,p_grant_id uuid,p_completion_token text,
 p_audit_event_id uuid,p_alert_audit_event_id uuid,p_trace_id uuid
) returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; review_actor record; file_actor record; file_record record; grant_record public.hotel_file_access_grants%rowtype; window_at timestamptz:=date_bin(interval '5 minutes',statement_timestamp(),timestamptz '1970-01-01 00:00:00+00'); user_count int; hotel_count int;
begin
 if p_action not in ('AUTHORIZE','SUCCEEDED','FAILED','ABORTED') or p_completion_token !~ '^[A-Za-z0-9_-]{43}$' then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 if p_action<>'AUTHORIZE' then
  select g.* into grant_record from public.hotel_file_access_grants g where g.company_id=p_company_id and g.branch_id=p_branch_id and g.id=p_grant_id and g.repair_case_id=p_repair_id and g.file_version_id=p_file_version_id and g.trace_id=p_trace_id and g.completion_token_hash=sha256(convert_to(p_completion_token,'UTF8')) for update;
  if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if grant_record.status=p_action then return query select 'RECORDED',null::jsonb; return; end if;
  if grant_record.status<>'STARTED' then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
  update public.hotel_file_access_grants set status=p_action,completed_at=statement_timestamp() where company_id=p_company_id and id=p_grant_id;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_FILE_VIEW_'||p_action,grant_record.actor_user_id,grant_record.actor_type,grant_record.session_id,p_company_id,p_branch_id,'HOTEL_FILE_VERSION',p_file_version_id,jsonb_build_object('repairCaseId',p_repair_id),case when p_action='SUCCEEDED' then 'SUCCEEDED' else 'FAILED' end,p_trace_id);
  return query select 'RECORDED',null::jsonb; return;
 end if;
 select * into actor from public.hotel_active_actor_v1(p_company_id,p_session_token); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 with recovered as (update public.hotel_file_access_grants g set status='ABORTED',completed_at=statement_timestamp() where g.company_id=p_company_id and g.branch_id=p_branch_id and g.repair_case_id is not null and g.status='STARTED' and g.expires_at<=statement_timestamp() returning g.*)
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) select md5(recovered.id::text||':stale-repair-file-view')::uuid,'HOTEL_REPAIR_FILE_VIEW_ABANDONED',recovered.actor_user_id,recovered.actor_type,recovered.session_id,recovered.company_id,recovered.branch_id,'HOTEL_FILE_VERSION',recovered.file_version_id,jsonb_build_object('repairCaseId',recovered.repair_case_id),'FAILED',recovered.trace_id from recovered on conflict(id) do nothing;
 insert into public.hotel_file_access_rate_windows(company_id,branch_id,scope_type,scope_id,window_started_at,request_count) values(p_company_id,p_branch_id,'USER',actor.user_id,window_at,1) on conflict(company_id,branch_id,scope_type,scope_id,window_started_at) do update set request_count=public.hotel_file_access_rate_windows.request_count+1,updated_at=statement_timestamp() where public.hotel_file_access_rate_windows.request_count<30 returning request_count into user_count;
 insert into public.hotel_file_access_rate_windows(company_id,branch_id,scope_type,scope_id,window_started_at,request_count) values(p_company_id,p_branch_id,'HOTEL',p_branch_id,window_at,1) on conflict(company_id,branch_id,scope_type,scope_id,window_started_at) do update set request_count=public.hotel_file_access_rate_windows.request_count+1,updated_at=statement_timestamp() where public.hotel_file_access_rate_windows.request_count<100 returning request_count into hotel_count;
 if hotel_count=80 then insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) values(p_alert_audit_event_id,'HOTEL_FILE_BULK_EXPORT_ALERT',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_FILE_ACCESS_WINDOW',p_branch_id,jsonb_build_object('windowStartedAt',window_at,'requestCount',80),'SUCCEEDED',p_trace_id); end if;
 if user_count is null or hotel_count is null then insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_FILE_VIEW_RATE_LIMITED',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'HOTEL_FILE_VERSION',p_file_version_id,jsonb_build_object('repairCaseId',p_repair_id),'DENIED',p_trace_id); return query select 'RATE_LIMITED',null::jsonb; return; end if;
 select * into review_actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'REPAIR_REVIEW',true); select * into file_actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_FILE_READ',true);
 if review_actor.user_id is distinct from actor.user_id or file_actor.user_id is distinct from actor.user_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select version_record.clean_object_key,version_record.clean_etag,version_record.clean_object_version,encode(version_record.clean_sha256,'hex') clean_sha256,version_record.clean_size,version_record.detected_mime,version_record.display_name into file_record
 from public.hotel_repair_cases repair join public.process_executions execution on execution.company_id=repair.company_id and execution.id=repair.process_execution_id join public.hotel_file_links link on link.company_id=repair.company_id and link.branch_id=repair.branch_id and ((repair.source_type='DIRECT' and link.repair_case_id=repair.id and link.parent_type in ('REPAIR_CASE_EVIDENCE','REPAIR_VISIT_COMPLETION_EVIDENCE')) or (repair.source_type='INSPECTION' and link.parent_type='INSPECTION_ITEM_EVIDENCE' and link.inspection_id=repair.inspection_id and link.item_snapshot_id=repair.inspection_item_snapshot_id and link.result_id=repair.inspection_result_id and link.result_version=repair.inspection_result_version and link.file_version_id=any(repair.defect_file_version_ids))) join public.hotel_file_versions version_record on version_record.company_id=link.company_id and version_record.branch_id=link.branch_id and version_record.id=link.file_version_id join public.hotel_file_uploads upload on upload.company_id=version_record.company_id and upload.branch_id=link.branch_id and upload.id=version_record.upload_id and upload.status='LINKED' and ((repair.source_type='DIRECT' and upload.repair_case_id=repair.id) or (repair.source_type='INSPECTION' and upload.inspection_id=repair.inspection_id and upload.item_snapshot_id=repair.inspection_item_snapshot_id)) join public.hotel_file_scan_jobs scan_job on scan_job.company_id=version_record.company_id and scan_job.branch_id=link.branch_id and scan_job.upload_id=version_record.upload_id and scan_job.file_version_id=version_record.id and scan_job.status='COMPLETED'
 where repair.company_id=p_company_id and repair.branch_id=p_branch_id and repair.id=p_repair_id and link.file_version_id=p_file_version_id and ((execution.state='IN_REVIEW' and public.hotel_process_actor_is_assigned_v1(p_company_id,execution.id,actor.user_id,statement_timestamp())) or (execution.state='COMPLETED' and exists(select 1 from public.process_execution_history h where h.company_id=execution.company_id and h.execution_id=execution.id and h.next_state='COMPLETED' and h.actor_user_id=actor.user_id))) for share of execution;
 if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
 insert into public.hotel_file_access_grants(id,company_id,branch_id,actor_user_id,actor_type,session_id,repair_case_id,file_version_id,completion_token_hash,status,trace_id) values(p_grant_id,p_company_id,p_branch_id,actor.user_id,actor.user_type,actor.session_id,p_repair_id,p_file_version_id,sha256(convert_to(p_completion_token,'UTF8')),'STARTED',p_trace_id);
 return query select 'OK',jsonb_build_object('grantId',p_grant_id,'cleanObjectKey',file_record.clean_object_key,'etag',file_record.clean_etag,'objectVersion',file_record.clean_object_version,'sha256',file_record.clean_sha256,'sizeBytes',file_record.clean_size,'mimeType',file_record.detected_mime,'displayName',file_record.display_name);
end $function$;
revoke all on function public.hotel_repair_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid) from public;

create function public.hotel_repair_transition_v1(
 p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_expected_version integer,p_value jsonb,p_session_token text,
 p_idempotency_record_id uuid,p_idempotency_key text,p_operation_path text,p_request_hash text,p_audit_event_id uuid,p_trace_id uuid
) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; case_row public.hotel_repair_cases%rowtype; execution_row public.process_executions%rowtype; transition_row record; current_stage record; next_stage record; now_at timestamptz:=statement_timestamp(); next_state text; next_stage_key text; snapshot jsonb;
begin
 select * into actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'REPAIR_REVIEW',true); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash); if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 select * into case_row from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found or case_row.status<>'OPEN' then return query select 'NOT_FOUND',null::jsonb; return; end if;
 select * into execution_row from public.process_executions where company_id=p_company_id and branch_id=p_branch_id and id=case_row.process_execution_id and application_type='REPAIR_CASE' for update;
 if not found or execution_row.state<>'IN_REVIEW' then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 if execution_row.version<>p_expected_version then return query select 'PROCESS_VERSION_CONFLICT',null::jsonb; return; end if;
 if not public.hotel_process_actor_is_assigned_v1(p_company_id,execution_row.id,actor.user_id,now_at) then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into current_stage from public.process_stage_snapshots s where s.company_id=p_company_id and s.revision_id=execution_row.revision_id and s.stage_key=execution_row.current_stage_key for share;
 if not found then return query select 'PROCESS_GRAPH_INVALID',null::jsonb; return; end if;
 if p_value->>'event'='REJECT' then
  next_state:='PENDING_INPUT'; next_stage_key:=null;
  update public.process_executions set state=next_state,current_stage_key=null,current_stage_name=null,current_reviewer_user_id=null,current_delegate_user_id=null,current_due_at=null,version=version+1,completed_at=null,updated_at=now_at where company_id=p_company_id and id=execution_row.id;
 elsif (p_value->>'event')='APPROVE' and current_stage.is_final then
  next_state:='COMPLETED'; next_stage_key:=null;
  update public.process_executions set state=next_state,current_stage_key=null,current_stage_name=null,current_reviewer_user_id=null,current_delegate_user_id=null,current_due_at=null,version=version+1,completed_at=now_at,updated_at=now_at where company_id=p_company_id and id=execution_row.id;
 else
  select * into transition_row from public.process_transition_snapshots t where t.company_id=p_company_id and t.revision_id=execution_row.revision_id and t.from_stage_key=execution_row.current_stage_key and t.event=p_value->>'event' and t.choice_value is not distinct from nullif(p_value->>'choiceValue','') for share;
  if not found then return query select 'PROCESS_GRAPH_INVALID',null::jsonb; return; end if;
  select s.*,case when s.due_unit='HOURS' then now_at+make_interval(hours=>s.due_amount) when s.due_unit='DAYS' then now_at+make_interval(days=>s.due_amount) end due_at into next_stage from public.process_stage_snapshots s where s.company_id=p_company_id and s.revision_id=execution_row.revision_id and s.stage_key=transition_row.to_stage_key for share;
  if not found or not public.hotel_process_reviewer_is_eligible_v1(p_company_id,p_branch_id,next_stage.reviewer_user_id,now_at) then return query select 'PROCESS_ASSIGNEE_INVALID',null::jsonb; return; end if;
  next_state:=case when next_stage.is_final then 'COMPLETED' else 'IN_REVIEW' end; next_stage_key:=case when next_stage.is_final then null else next_stage.stage_key end;
  update public.process_executions set state=next_state,current_stage_key=next_stage_key,current_stage_name=case when next_stage.is_final then null else next_stage.stage_name end,current_reviewer_user_id=case when next_stage.is_final then null else next_stage.reviewer_user_id end,current_delegate_user_id=case when next_stage.is_final then null else next_stage.delegate_user_id end,current_due_at=case when next_stage.is_final then null else next_stage.due_at end,version=version+1,completed_at=case when next_stage.is_final then now_at else null end,updated_at=now_at where company_id=p_company_id and id=execution_row.id;
 end if;
 insert into public.process_execution_history(id,company_id,branch_id,execution_id,previous_state,next_state,previous_stage_key,next_stage_key,event,choice_value,reason,actor_user_id,occurred_at) values(gen_random_uuid(),p_company_id,p_branch_id,execution_row.id,execution_row.state,next_state,execution_row.current_stage_key,next_stage_key,p_value->>'event',nullif(p_value->>'choiceValue',''),p_value->>'reason',actor.user_id,now_at);
 update public.hotel_repair_cases set version=version+1,updated_at=now_at where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id returning * into case_row;
 insert into public.hotel_repair_case_history(id,company_id,branch_id,repair_case_id,case_version,action,reason,after_summary,actor_user_id) values(gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,case_row.version,'PROCESS_'||(p_value->>'event'),p_value->>'reason',jsonb_build_object('processState',next_state,'stageKey',next_stage_key),actor.user_id);
 snapshot:=public.repair_snapshot_v1(p_company_id,p_branch_id,p_resource_id,true);
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_REPAIR_PROCESS_'||(p_value->>'event'),actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'REPAIR_CASE',p_resource_id,jsonb_build_object('processState',next_state,'processVersion',execution_row.version+1),p_value->>'reason','SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash,'REPAIR_CASE',p_resource_id,p_audit_event_id,snapshot);
 return query select 'UPDATED',snapshot;
exception when invalid_text_representation or check_violation or foreign_key_violation then return query select 'VALIDATION_ERROR',null::jsonb;
end $function$;
revoke all on function public.hotel_repair_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid) from public;

-- Calendar projection state is always NOT_CONNECTED in this cycle; provider job count remains zero.

-- Every repair current/history table is tenant-isolated and command-only.
do $security$
declare table_name text;
begin
 foreach table_name in array array[
  'hotel_repair_priorities','hotel_repair_priority_history','hotel_repair_cases','hotel_repair_case_history',
  'hotel_repair_visits','hotel_repair_visit_history','hotel_repair_visit_performers','hotel_repair_visit_performer_history'
 ] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('alter table public.%I force row level security',table_name);
  execute format(
   'create policy %I_company_isolation on public.%I using (
      case
       when public.runtime_is_schema_owner() then true
       when current_user = ''werehere_auth_session_definer'' then true
       when current_user = ''werehere_tenant_authority_definer'' then true
       when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
       when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
       when not public.runtime_has_capability(''API_RUNTIME'') and not public.runtime_has_capability(''RECONCILER'') then company_id = nullif(current_setting(''app.company_id'',true),'''')::uuid
       else false
      end
    ) with check (
      case
       when public.runtime_is_schema_owner() then true
       when current_user = ''werehere_auth_session_definer'' then true
       when current_user = ''werehere_tenant_authority_definer'' then true
       when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
       when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
       when not public.runtime_has_capability(''API_RUNTIME'') and not public.runtime_has_capability(''RECONCILER'') then company_id = nullif(current_setting(''app.company_id'',true),'''')::uuid
       else false
      end
    )',table_name,table_name
  );
  execute format('revoke all on public.%I from public',table_name);
 end loop;
end $security$;

create or replace function public.hotel_process_command_v1(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_existing record;
  v_definition_id uuid;
  v_current_revision_id uuid;
  v_current_version integer;
  v_revision_id uuid;
  v_snapshot jsonb;
  v_scope text;
  v_application_type text;
  v_target_branch_id uuid;
  v_stage jsonb;
  v_transition jsonb;
  v_next_version integer;
  v_reachable_count integer;
  v_has_cycle boolean;
begin
  if p_action not in ('SAVE_DEFINITION', 'SET_DEFAULT', 'LIST_DEFINITIONS', 'READ_DEFAULT') then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  v_scope := coalesce(p_value ->> 'scope', 'HOTEL');
  v_application_type := coalesce(p_value ->> 'applicationType', 'ROOM_INSPECTION');
  if v_application_type not in ('ROOM_INSPECTION', 'REPAIR_CASE') then
    return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb; return;
  end if;
  v_target_branch_id := case
    when p_action = 'SAVE_DEFINITION' and v_scope = 'COMPANY' then null
    else p_branch_id
  end;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, v_target_branch_id, p_session_token,
      'PROCESS_DEFINITION_MANAGE', v_target_branch_id is not null
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  if p_action = 'LIST_DEFINITIONS' then
    select pg_catalog.jsonb_build_object(
      'definitions', coalesce(pg_catalog.jsonb_agg(
        public.process_definition_snapshot_v1(p_company_id, definition.id)
        order by definition.updated_at desc
      ), '[]'::jsonb)
    ) into v_snapshot
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and (definition.branch_id is null or definition.branch_id = p_branch_id)
       and definition.application_type = v_application_type;
    return query select 'OK'::text, v_snapshot;
    return;
  end if;

  if p_action = 'READ_DEFAULT' then
    select public.process_definition_snapshot_v1(p_company_id, default_record.definition_id)
      into v_snapshot
      from public.hotel_process_defaults default_record
     where default_record.company_id = p_company_id
       and default_record.branch_id = p_branch_id
       and default_record.application_type = v_application_type;
    if not found then
      return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb;
    else
      return query select 'OK'::text, v_snapshot;
    end if;
    return;
  end if;

  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method not in ('POST', 'PUT')
     or p_operation_path not like '/api/%'
     or pg_catalog.btrim(coalesce(p_request_hash, '')) = '' then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' || p_idempotency_key || ':' ||
    p_http_method || ':' || p_operation_path, 0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and expires_at <= v_now;
  select idempotency.request_hash, idempotency.result_snapshot into v_existing
    from public.idempotency_records idempotency
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end::text,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  if p_action = 'SAVE_DEFINITION' then
    if v_scope not in ('COMPANY', 'HOTEL')
       or (v_scope = 'COMPANY' and p_branch_id is not null)
       or (v_scope = 'HOTEL' and p_branch_id is null)
       or p_value ->> 'applicationType' not in ('ROOM_INSPECTION', 'REPAIR_CASE')
       or pg_catalog.btrim(coalesce(p_value ->> 'name', '')) = ''
       or pg_catalog.jsonb_typeof(p_value -> 'stages') <> 'array'
       or pg_catalog.jsonb_array_length(p_value -> 'stages') < 1
       or pg_catalog.jsonb_typeof(p_value -> 'transitions') <> 'array'
       or coalesce(p_value ->> 'startStageKey', '') !~ '^[A-Z][A-Z0-9_]{0,39}$'
       or (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p_value -> 'stages') item where (item ->> 'isFinal')::boolean) <> 1
       or not exists (
         select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') item
          where item ->> 'key' = p_value ->> 'startStageKey'
       ) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'stages') item
       where coalesce(item ->> 'key', '') !~ '^[A-Z][A-Z0-9_]{0,39}$'
          or not exists (
            select 1 from public.users app_user
             where app_user.company_id = p_company_id
               and app_user.id = (item ->> 'reviewerUserId')::uuid
               and app_user.status = 'ACTIVE'
               and app_user.user_type = 'INTERNAL_STAFF'
          )
          or (
            item -> 'delegate' <> 'null'::jsonb
            and not exists (
              select 1 from public.users delegate_user
               where delegate_user.company_id = p_company_id
                 and delegate_user.id = (item -> 'delegate' ->> 'userId')::uuid
                 and delegate_user.status = 'ACTIVE'
                 and delegate_user.user_type = 'INTERNAL_STAFF'
            )
          )
    ) then
      return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge
       where edge ->> 'fromStageKey' = edge ->> 'toStageKey'
          or not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'fromStageKey')
          or not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'toStageKey')
          or exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'fromStageKey' and (stage ->> 'isFinal')::boolean)
    ) or exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage
       where not (stage ->> 'isFinal')::boolean
         and not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge where edge ->> 'fromStageKey' = stage ->> 'key')
    ) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;
    with recursive reachable(stage_key, path, cyclic) as (
      select p_value ->> 'startStageKey', array[p_value ->> 'startStageKey'], false
      union all
      select edge ->> 'toStageKey', reachable.path || (edge ->> 'toStageKey'),
             (edge ->> 'toStageKey') = any(reachable.path)
        from reachable
        join lateral pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge
          on edge ->> 'fromStageKey' = reachable.stage_key
       where not reachable.cyclic
    )
    select pg_catalog.count(distinct stage_key), pg_catalog.bool_or(cyclic)
      into v_reachable_count, v_has_cycle
      from reachable;
    if v_reachable_count <> pg_catalog.jsonb_array_length(p_value -> 'stages')
       or coalesce(v_has_cycle, false) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;

    if p_expected_version = 0 then
      insert into public.process_definitions (
        id, company_id, branch_id, application_type, scope, name,
        created_by, updated_by
      ) values (
        p_resource_id, p_company_id, p_branch_id, v_application_type, v_scope,
        p_value ->> 'name', v_actor.user_id, v_actor.user_id
      );
      v_next_version := 1;
    else
      select definition.version into v_current_version
        from public.process_definitions definition
       where definition.company_id = p_company_id
         and definition.id = p_resource_id
       for update;
      if not found then
        return query select 'NOT_FOUND'::text, null::jsonb;
        return;
      end if;
      if v_current_version <> p_expected_version then
        return query select 'PROCESS_VERSION_CONFLICT'::text, null::jsonb;
        return;
      end if;
      update public.process_definitions
         set name = p_value ->> 'name', version = version + 1,
             updated_by = v_actor.user_id, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
      v_next_version := p_expected_version + 1;
    end if;
    v_revision_id := (p_value ->> 'revisionId')::uuid;
    insert into public.process_definition_revisions (
      id, company_id, definition_id, version, start_stage_key, reason, created_by
    ) values (
      v_revision_id, p_company_id, p_resource_id, v_next_version,
      p_value ->> 'startStageKey', '프로세스 설정 저장', v_actor.user_id
    );
    for v_stage in select * from pg_catalog.jsonb_array_elements(p_value -> 'stages') loop
      insert into public.process_stage_snapshots (
        id, company_id, revision_id, stage_key, stage_name, reviewer_user_id,
        delegate_user_id, delegate_starts_at, delegate_ends_at,
        due_amount, due_unit, is_final
      ) values (
        (v_stage ->> 'id')::uuid, p_company_id, v_revision_id,
        v_stage ->> 'key', v_stage ->> 'name', (v_stage ->> 'reviewerUserId')::uuid,
        case when v_stage -> 'delegate' = 'null'::jsonb then null else (v_stage -> 'delegate' ->> 'userId')::uuid end,
        case when v_stage -> 'delegate' = 'null'::jsonb then null else (v_stage -> 'delegate' ->> 'startsAt')::timestamptz end,
        case when v_stage -> 'delegate' = 'null'::jsonb or v_stage -> 'delegate' ->> 'endsAt' is null then null else (v_stage -> 'delegate' ->> 'endsAt')::timestamptz end,
        case when v_stage -> 'due' = 'null'::jsonb then null else (v_stage -> 'due' ->> 'amount')::integer end,
        case when v_stage -> 'due' = 'null'::jsonb then null else v_stage -> 'due' ->> 'unit' end,
        (v_stage ->> 'isFinal')::boolean
      );
    end loop;
    for v_transition in select * from pg_catalog.jsonb_array_elements(p_value -> 'transitions') loop
      insert into public.process_transition_snapshots (
        id, company_id, revision_id, from_stage_key, event, choice_value, to_stage_key
      ) values (
        (v_transition ->> 'id')::uuid, p_company_id, v_revision_id,
        v_transition ->> 'fromStageKey', v_transition ->> 'event',
        v_transition ->> 'choiceValue', v_transition ->> 'toStageKey'
      );
    end loop;
    update public.process_definitions
       set current_revision_id = v_revision_id
     where company_id = p_company_id and id = p_resource_id;
    v_snapshot := public.process_definition_snapshot_v1(p_company_id, p_resource_id);
  else
    select definition.id, definition.current_revision_id
      into v_definition_id, v_current_revision_id
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and definition.id = (p_value ->> 'processDefinitionId')::uuid
       and (definition.branch_id is null or definition.branch_id = p_branch_id)
       and definition.application_type = v_application_type
     for share;
    if not found then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1 from public.process_stage_snapshots stage
       where stage.company_id = p_company_id
         and stage.revision_id = v_current_revision_id
         and (
           not exists (
             select 1 from public.hotel_staff_assignments assignment
              where assignment.company_id = p_company_id
                and assignment.branch_id = p_branch_id
                and assignment.user_id = stage.reviewer_user_id
                and assignment.terminated_at is null
                and assignment.start_date <= v_now::date
                and (assignment.end_date is null or assignment.end_date >= v_now::date)
           )
           or (
             stage.delegate_user_id is not null
             and not exists (
               select 1 from public.hotel_staff_assignments assignment
                where assignment.company_id = p_company_id
                  and assignment.branch_id = p_branch_id
                  and assignment.user_id = stage.delegate_user_id
                  and assignment.terminated_at is null
                  and assignment.start_date <= v_now::date
                  and (assignment.end_date is null or assignment.end_date >= v_now::date)
             )
           )
         )
    ) then
      return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb;
      return;
    end if;
    insert into public.hotel_process_defaults (
      company_id, branch_id, application_type, definition_id, revision_id,
      version, updated_by, updated_at
    ) values (
      p_company_id, p_branch_id, v_application_type, v_definition_id,
      v_current_revision_id, 1, v_actor.user_id, v_now
    )
    on conflict (company_id, branch_id, application_type) do update
      set definition_id = excluded.definition_id,
          revision_id = excluded.revision_id,
          version = hotel_process_defaults.version + 1,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      where hotel_process_defaults.version = p_expected_version;
    if not found then
      return query select 'PROCESS_VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
    v_snapshot := public.process_definition_snapshot_v1(p_company_id, v_definition_id);
  end if;

  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id,
    case when p_action = 'SAVE_DEFINITION' then 'PROCESS_DEFINITION_SAVED' else 'HOTEL_PROCESS_DEFAULT_SET' end,
    v_actor.user_id, v_actor.user_type, v_actor.session_id, p_company_id,
    p_branch_id, 'PROCESS_DEFINITION', p_resource_id,
    pg_catalog.jsonb_build_object('resourceId', p_resource_id),
    '프로세스 설정 저장', 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'PROCESS_DEFINITION', p_resource_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select
    case when p_action = 'SAVE_DEFINITION' and p_expected_version = 0 then 'CREATED' else 'UPDATED' end::text,
    v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation or unique_violation then
    return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_process_command_v1(uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text, text, text, uuid, uuid) from public;

create or replace function public.inspection_execution_snapshot_v2(
  p_company_id uuid,
  p_branch_id uuid,
  p_inspection_id uuid
)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $function$
select pg_catalog.jsonb_build_object(
'id',inspection.id,'hotelId',inspection.branch_id,'source',inspection.source,'businessDate',inspection.business_date,
'dueAt',pg_catalog.to_char(inspection.due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'status',inspection.status,'version',inspection.version,
'process',pg_catalog.jsonb_build_object('executionId',execution.id,'definitionId',execution.definition_id,'revisionId',execution.revision_id,'currentStageKey',execution.current_stage_key,'currentStageName',execution.current_stage_name,'state',execution.state,'version',execution.version),
'targets',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
'id',target.id,'type',target.target_type,'roomId',target.room_id,'roomNumberSnapshot',target.room_number_snapshot,'roomTypeNameSnapshot',target.room_type_name_snapshot,'floorLabelSnapshot',target.floor_label_snapshot,
'facilityId',target.facility_id,'facilityNameSnapshot',target.facility_name_snapshot,'facilityTypeNameSnapshot',target.facility_type_name_snapshot,'facilityLocationNameSnapshot',target.facility_location_name_snapshot)) order by target.created_at,target.id)
from public.inspection_execution_targets target where target.company_id=inspection.company_id and target.branch_id=inspection.branch_id and target.execution_id=inspection.id),'[]'::jsonb),
'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
'id',item.id,'executionTargetId',item.execution_target_id,'targetType',case when item.room_id is not null then 'ROOM' else 'FACILITY' end,'itemId',item.source_item_id,'name',item.name,'description',item.description,'isRequired',item.is_required,'displayOrder',item.display_order,'defaultSeverity',item.default_severity,
'result',case when result_record.id is null then null else pg_catalog.jsonb_build_object('id',result_record.id,'result',result_record.result,'description',result_record.description,'severity',result_record.severity,'fileVersionIds',coalesce((select pg_catalog.jsonb_agg(link.file_version_id order by link.linked_at) from public.hotel_file_links link where link.company_id=item.company_id and link.result_id=result_record.id and link.result_version=result_record.version),'[]'::jsonb),'version',result_record.version) end) order by item.execution_target_id,item.display_order,item.id)
from public.inspection_item_snapshots item left join public.inspection_item_results result_record on result_record.company_id=item.company_id and result_record.inspection_id=item.inspection_id and result_record.item_snapshot_id=item.id where item.company_id=inspection.company_id and item.inspection_id=inspection.id),'[]'::jsonb),
'createdAt',pg_catalog.to_char(inspection.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',pg_catalog.to_char(inspection.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
from public.hotel_inspections inspection join public.process_executions execution on execution.company_id=inspection.company_id and execution.id=inspection.process_execution_id
where inspection.company_id=p_company_id and inspection.branch_id=p_branch_id and inspection.id=p_inspection_id
$function$;
revoke all on function public.inspection_execution_snapshot_v2(uuid,uuid,uuid) from public;

insert into public.schema_migrations(version) values('0042_hotel_repair_lifecycle') on conflict(version) do nothing;
commit;
