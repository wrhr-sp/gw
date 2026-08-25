begin;

alter table public.hotel_knowledge_versions
  drop constraint hotel_knowledge_versions_action_check,
  add constraint hotel_knowledge_versions_action_check check(
    action in ('CREATE','UPDATE','REQUEST_REVIEW','PUBLISH','MARK_NEEDS_REVIEW','AUTO_NEEDS_REVIEW','REPUBLISH','ARCHIVE','ATTACHMENTS_UPDATE')
  );

alter table public.hotel_file_uploads
  drop constraint hotel_file_uploads_parent_exact_check,
  alter column branch_id drop not null,
  add column knowledge_id uuid,
  add constraint hotel_file_uploads_knowledge_fkey
    foreign key(company_id,knowledge_id)
    references public.hotel_knowledge_entries(company_id,id),
  add constraint hotel_file_uploads_parent_exact_check check(
    (parent_type='INSPECTION_ITEM_EVIDENCE' and branch_id is not null and inspection_id is not null and item_snapshot_id is not null and repair_case_id is null and repair_visit_id is null and daily_sales_id is null and inquiry_id is null and knowledge_id is null)
    or(parent_type='REPAIR_CASE_EVIDENCE' and branch_id is not null and inspection_id is null and item_snapshot_id is null and repair_case_id is not null and repair_visit_id is null and daily_sales_id is null and inquiry_id is null and knowledge_id is null)
    or(parent_type='REPAIR_VISIT_COMPLETION_EVIDENCE' and branch_id is not null and inspection_id is null and item_snapshot_id is null and repair_case_id is not null and repair_visit_id is not null and daily_sales_id is null and inquiry_id is null and knowledge_id is null)
    or(parent_type='DAILY_SALES_EVIDENCE' and branch_id is not null and inspection_id is null and item_snapshot_id is null and repair_case_id is null and repair_visit_id is null and daily_sales_id is not null and inquiry_id is null and knowledge_id is null)
    or(parent_type='OWNER_INQUIRY_ATTACHMENT' and branch_id is not null and inspection_id is null and item_snapshot_id is null and repair_case_id is null and repair_visit_id is null and daily_sales_id is null and inquiry_id is not null and knowledge_id is null)
    or(parent_type='KNOWLEDGE_ATTACHMENT' and inspection_id is null and item_snapshot_id is null and repair_case_id is null and repair_visit_id is null and daily_sales_id is null and inquiry_id is null and knowledge_id is not null)
  );

alter table public.hotel_file_scan_jobs alter column branch_id drop not null;
alter table public.hotel_file_versions alter column branch_id drop not null;

alter table public.hotel_file_access_grants
  drop constraint hotel_file_access_grants_parent_check,
  alter column branch_id drop not null,
  add column knowledge_id uuid,
  add constraint hotel_file_access_grants_knowledge_fkey
    foreign key(company_id,knowledge_id)
    references public.hotel_knowledge_entries(company_id,id),
  add constraint hotel_file_access_grants_parent_check check(
    (branch_id is not null and inspection_id is not null and repair_case_id is null and daily_sales_id is null and inquiry_id is null and knowledge_id is null)
    or(branch_id is not null and inspection_id is null and repair_case_id is not null and daily_sales_id is null and inquiry_id is null and knowledge_id is null)
    or(branch_id is not null and inspection_id is null and repair_case_id is null and daily_sales_id is not null and inquiry_id is null and knowledge_id is null)
    or(branch_id is not null and inspection_id is null and repair_case_id is null and daily_sales_id is null and inquiry_id is not null and knowledge_id is null)
    or(inspection_id is null and repair_case_id is null and daily_sales_id is null and inquiry_id is null and knowledge_id is not null)
  );

create table public.hotel_knowledge_attachments(
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid,
  knowledge_id uuid not null,
  knowledge_version integer not null check(knowledge_version>0),
  file_version_id uuid not null,
  display_order integer not null check(display_order between 0 and 9),
  linked_by uuid not null,
  linked_at timestamptz not null default now(),
  unique(company_id,knowledge_id,knowledge_version,file_version_id),
  unique(company_id,knowledge_id,knowledge_version,display_order),
  foreign key(company_id,knowledge_id)references public.hotel_knowledge_entries(company_id,id),
  foreign key(company_id,file_version_id)references public.hotel_file_versions(company_id,id),
  foreign key(company_id,linked_by)references public.users(company_id,id)
);
create index hotel_knowledge_attachments_current_idx on public.hotel_knowledge_attachments(company_id,knowledge_id,knowledge_version desc,display_order);
create trigger hotel_knowledge_attachments_append_only before update or delete on public.hotel_knowledge_attachments for each row execute function public.hotel_knowledge_append_only_v1();

create table public.hotel_knowledge_file_access_rate_windows(
  company_id uuid not null,
  branch_id uuid,
  scope_type text not null check(scope_type in('USER','HOTEL','COMPANY')),
  scope_id uuid not null,
  window_started_at timestamptz not null,
  request_count integer not null check(request_count between 1 and 100),
  updated_at timestamptz not null default now(),
  primary key(company_id,scope_type,scope_id,window_started_at),
  check((scope_type='HOTEL'and branch_id=scope_id)or(scope_type='COMPANY'and branch_id is null and scope_id=company_id)or scope_type='USER')
);

create function public.hotel_knowledge_idempotency_begin_v1(
 p_company_id uuid,p_actor_user_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text
) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare existing record; now_at timestamptz:=statement_timestamp();
begin
 if btrim(coalesce(p_idempotency_key,''))='' or p_http_method<>'PUT' or btrim(coalesce(p_operation_path,''))='' or btrim(coalesce(p_request_hash,''))='' then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||':'||p_actor_user_id::text||':'||p_idempotency_key||':'||p_http_method||':'||p_operation_path,0));
 delete from public.idempotency_records where company_id=p_company_id and actor_user_id=p_actor_user_id and idempotency_key=p_idempotency_key and http_method=p_http_method and operation_path=p_operation_path and expires_at<=now_at;
 select record.request_hash,record.result_snapshot into existing from public.idempotency_records record where record.company_id=p_company_id and record.actor_user_id=p_actor_user_id and record.idempotency_key=p_idempotency_key and record.http_method=p_http_method and record.operation_path=p_operation_path and record.status='COMPLETED';
 if found then return query select case when existing.request_hash=p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end,case when existing.request_hash=p_request_hash then existing.result_snapshot else null::jsonb end; end if;
end $function$;
revoke all on function public.hotel_knowledge_idempotency_begin_v1(uuid,uuid,text,text,text,text) from public;

create function public.hotel_knowledge_visible_v1(p_company_id uuid,p_knowledge_id uuid,p_user_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog as $function$
 select exists(select 1 from public.hotel_knowledge_entries e where e.company_id=p_company_id and e.id=p_knowledge_id and(
  (e.status in('PUBLISHED','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,e.branch_id,'KNOWLEDGE_READ'))or
  (e.author_user_id=p_user_id and public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,e.branch_id,'KNOWLEDGE_CREATE'))or
  (e.status in('REVIEW_REQUESTED','ARCHIVED')and(public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,e.branch_id,'KNOWLEDGE_REVIEW')or public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,e.branch_id,'KNOWLEDGE_ARCHIVE')))
 ))
$function$;
revoke all on function public.hotel_knowledge_visible_v1(uuid,uuid,uuid)from public;

create or replace function public.hotel_knowledge_snapshot_v1(p_company_id uuid,p_knowledge_id uuid,p_session_token text) returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'id',e.id,'scopeType',e.scope_type,'hotelId',e.branch_id,'title',e.title,'summary',e.summary,'knowledgeType',e.knowledge_type,'riskClassification',e.risk_classification,
  'situation',e.situation,'symptomsAndContext',e.symptoms_and_context,'checks',to_jsonb(e.checks),'recommendedResponse',to_jsonb(e.recommended_response),
  'prohibitedOrCautionResponse',to_jsonb(e.prohibited_or_caution_response),'escalationCriteria',e.escalation_criteria,'requiredPermissionOrApproval',e.required_permission_or_approval,
  'caseSummary',e.case_summary,'outcomeAndLesson',e.outcome_and_lesson,'tags',to_jsonb(e.tags),'relatedManualRefs',to_jsonb(e.related_manual_refs),
  'relatedIssueIds',coalesce((select jsonb_agg(l.issue_id order by l.issue_id)from public.hotel_knowledge_links l where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='ISSUE'and exists(select 1 from public.hotel_issue_actor_v1(e.company_id,l.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER'then'HOTEL_OWNER_ISSUE_READ'else'ISSUE_READ'end))),'[]'::jsonb),
  'relatedRepairIds',coalesce((select jsonb_agg(l.repair_id order by l.repair_id)from public.hotel_knowledge_links l where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='REPAIR'and exists(select 1 from public.hotel_command_actor_v1(e.company_id,l.branch_id,p_session_token,'REPAIR_READ',true))),'[]'::jsonb),
  'status',e.status,'author',jsonb_build_object('displayName',author.display_name),'reviewer',case when reviewer.id is null then null else jsonb_build_object('displayName',reviewer.display_name)end,'designatedReviewer',case when designated.id is null then null else jsonb_build_object('displayName',designated.display_name)end,'reviewRequestedVersion',e.review_requested_version,
  'publishedAt',case when e.published_at is null then null else to_char(e.published_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')end,
  'reviewedAt',case when e.reviewed_at is null then null else to_char(e.reviewed_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')end,
  'reviewDueAt',to_char(e.review_due_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'version',e.version,
  'createdAt',to_char(e.created_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(e.updated_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'actions',jsonb_build_object(
   'canEdit',e.author_user_id=actor.user_id and e.status in('DRAFT','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE'),
   'canRequestReview',e.author_user_id=actor.user_id and e.status in('DRAFT','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE'),
   'canPublish',e.author_user_id<>actor.user_id and e.status in('REVIEW_REQUESTED','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_PUBLISH')and(e.risk_classification='STANDARD'or(e.designated_reviewer_user_id=actor.user_id and e.review_requested_version=e.version and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_HIGH_RISK_PUBLISH'))),
   'canMarkNeedsReview',e.status='PUBLISHED'and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_REVIEW'),
   'canArchive',e.status<>'ARCHIVED'and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_ARCHIVE'),
   'canAttach',e.author_user_id=actor.user_id and e.status in('DRAFT','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE')),
  'isStale',(e.status='NEEDS_REVIEW'or(e.status='PUBLISHED'and e.review_due_at<=statement_timestamp())),
  'helpfulCount',(select count(*)from public.hotel_knowledge_feedback f where f.company_id=e.company_id and f.knowledge_id=e.id and f.entry_version=e.version and f.kind='HELPFUL'),
  'notHelpfulCount',(select count(*)from public.hotel_knowledge_feedback f where f.company_id=e.company_id and f.knowledge_id=e.id and f.entry_version=e.version and f.kind='NOT_HELPFUL'),
  'history',coalesce((select jsonb_agg(jsonb_build_object('version',v.entry_version,'action',v.action,'status',v.status,'reason',v.reason,'actor',jsonb_build_object('displayName',coalesce(vu.display_name,'시스템')),'occurredAt',to_char(v.occurred_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))order by v.entry_version)from public.hotel_knowledge_versions v left join public.users vu on vu.company_id=v.company_id and vu.id=v.actor_user_id where v.company_id=e.company_id and v.knowledge_id=e.id),'[]'::jsonb),
  'links',coalesce((select jsonb_agg(link order by link->>'kind',link->>'id')from(
   select jsonb_build_object('kind','ISSUE','id',l.issue_id,'title',i.title,'href',format('/hotels/%s/issues?issueId=%s',l.branch_id,l.issue_id))link from public.hotel_knowledge_links l join public.hotel_operational_issues i on i.company_id=l.company_id and i.branch_id=l.branch_id and i.id=l.issue_id where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='ISSUE'and exists(select 1 from public.hotel_issue_actor_v1(e.company_id,l.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER'then'HOTEL_OWNER_ISSUE_READ'else'ISSUE_READ'end))
   union all
   select jsonb_build_object('kind','REPAIR','id',l.repair_id,'title',r.defect_description,'href',format('/hotels/%s/repairs?repairId=%s',l.branch_id,l.repair_id))from public.hotel_knowledge_links l join public.hotel_repair_cases r on r.company_id=l.company_id and r.branch_id=l.branch_id and r.id=l.repair_id where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='REPAIR'and exists(select 1 from public.hotel_command_actor_v1(e.company_id,l.branch_id,p_session_token,'REPAIR_READ',true))
  )authorized_links),'[]'::jsonb),
  'attachments',coalesce((select jsonb_agg(jsonb_build_object('fileVersionId',v.id,'displayName',v.display_name,'mimeType',v.detected_mime,'sizeBytes',v.clean_size,'viewHref',format('/api/knowledge/%s/files/%s/view',e.id,v.id))order by a.display_order)from public.hotel_knowledge_attachments a join public.hotel_file_versions v on v.company_id=a.company_id and v.id=a.file_version_id where a.company_id=e.company_id and a.knowledge_id=e.id and a.knowledge_version=(select max(x.knowledge_version)from public.hotel_knowledge_attachments x where x.company_id=e.company_id and x.knowledge_id=e.id and x.knowledge_version<=e.version)and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'HOTEL_FILE_READ')),'[]'::jsonb)
 )
 from public.hotel_knowledge_entries e join public.users author on author.company_id=e.company_id and author.id=e.author_user_id left join public.users reviewer on reviewer.company_id=e.company_id and reviewer.id=e.reviewer_user_id left join public.users designated on designated.company_id=e.company_id and designated.id=e.designated_reviewer_user_id cross join lateral public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token)actor
 where e.company_id=p_company_id and e.id=p_knowledge_id
$function$;
revoke all on function public.hotel_knowledge_snapshot_v1(uuid,uuid,text)from public;

create or replace function public.hotel_knowledge_version_snapshot_v1(p_company_id uuid,p_knowledge_id uuid)returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'entry',to_jsonb(e)-'knowledge_search_vector',
  'relatedIssueIds',coalesce((select jsonb_agg(issue_id order by issue_id)from public.hotel_knowledge_links where company_id=e.company_id and knowledge_id=e.id and link_kind='ISSUE'),'[]'::jsonb),
  'relatedRepairIds',coalesce((select jsonb_agg(repair_id order by repair_id)from public.hotel_knowledge_links where company_id=e.company_id and knowledge_id=e.id and link_kind='REPAIR'),'[]'::jsonb),
  'attachmentFileVersionIds',coalesce((select jsonb_agg(a.file_version_id order by a.display_order)from public.hotel_knowledge_attachments a where a.company_id=e.company_id and a.knowledge_id=e.id and a.knowledge_version=(select max(x.knowledge_version)from public.hotel_knowledge_attachments x where x.company_id=e.company_id and x.knowledge_id=e.id and x.knowledge_version<=e.version)),'[]'::jsonb))
 from public.hotel_knowledge_entries e where e.company_id=p_company_id and e.id=p_knowledge_id
$function$;
revoke all on function public.hotel_knowledge_version_snapshot_v1(uuid,uuid)from public;

create function public.hotel_knowledge_file_parent_scope_v1(p_company_id uuid,p_knowledge_id uuid,p_session_token text)returns table(branch_id uuid)language sql stable security definer set search_path=pg_catalog as $function$
 select e.branch_id from public.hotel_knowledge_entries e cross join lateral public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token)a
 where e.company_id=p_company_id and e.id=p_knowledge_id and e.author_user_id=a.user_id and e.status in('DRAFT','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,a.user_id,e.branch_id,'KNOWLEDGE_CREATE')
$function$;
revoke all on function public.hotel_knowledge_file_parent_scope_v1(uuid,uuid,text)from public;

create function public.hotel_knowledge_file_scope_v1(p_company_id uuid,p_upload_id uuid,p_session_token text)returns table(branch_id uuid,knowledge_id uuid)language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare u public.hotel_file_uploads%rowtype;a record;e public.hotel_knowledge_entries%rowtype;
begin
 select upload.* into u from public.hotel_file_uploads upload where upload.company_id=p_company_id and upload.id=p_upload_id and upload.knowledge_id is not null for share;if not found then return;end if;
 select*into e from public.hotel_knowledge_entries where company_id=p_company_id and id=u.knowledge_id for share;if not found or not(u.branch_id is not distinct from e.branch_id)then return;end if;
 select*into a from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);if not found or u.initiated_by<>a.user_id or e.author_user_id<>a.user_id or not public.hotel_knowledge_has_permission_v1(p_company_id,a.user_id,e.branch_id,'KNOWLEDGE_CREATE')then return;end if;
 return query select u.branch_id,u.knowledge_id;
end $function$;
revoke all on function public.hotel_knowledge_file_scope_v1(uuid,uuid,text)from public;

create function public.hotel_knowledge_file_command_v1(p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_audit_event_id uuid,p_trace_id uuid)returns table(command_status text,result_snapshot jsonb)language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare now_at timestamptz:=statement_timestamp();a record;e public.hotel_knowledge_entries%rowtype;u public.hotel_file_uploads%rowtype;replay record;snapshot jsonb;scan_id uuid;target_knowledge_id uuid;total_count integer;total_size bigint;
begin
 if p_action not in('UPLOAD_INIT','UPLOAD_AUTHORIZE','UPLOAD_COMPLETE','STATUS')then return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;
 if p_action='UPLOAD_INIT'then target_knowledge_id:=(p_value->'parent'->>'knowledgeId')::uuid;else select upload.knowledge_id into target_knowledge_id from public.hotel_file_uploads upload where upload.company_id=p_company_id and upload.id=p_resource_id and upload.knowledge_id is not null;end if;
 if target_knowledge_id is null then return query select'NOT_FOUND',null::jsonb;return;end if;
 select*into e from public.hotel_knowledge_entries where company_id=p_company_id and id=target_knowledge_id for update;if not found or not(p_branch_id is not distinct from e.branch_id)then return query select'NOT_FOUND',null::jsonb;return;end if;
 select*into a from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);if not found or e.author_user_id<>a.user_id or not public.hotel_knowledge_has_permission_v1(p_company_id,a.user_id,e.branch_id,'KNOWLEDGE_CREATE')then return query select'NOT_FOUND',null::jsonb;return;end if;
 if p_action='STATUS'then select*into u from public.hotel_file_uploads where company_id=p_company_id and id=p_resource_id and knowledge_id=e.id and branch_id is not distinct from e.branch_id and initiated_by=a.user_id;if not found then return query select'NOT_FOUND',null::jsonb;return;end if;return query select'OK',public.hotel_file_status_snapshot_v1(p_company_id,p_resource_id);return;
 elsif p_action='UPLOAD_AUTHORIZE'then select*into u from public.hotel_file_uploads where company_id=p_company_id and id=p_resource_id and knowledge_id=e.id and branch_id is not distinct from e.branch_id and initiated_by=a.user_id for share;if not found or u.status not in('PENDING_UPLOAD','QUARANTINED','SCANNING','CLEAN_PENDING_PROMOTION','READY_UNLINKED','LINKED')or(u.status='PENDING_UPLOAD'and u.expires_at<=now_at)then return query select'NOT_FOUND',null::jsonb;return;end if;return query select'OK',jsonb_build_object('id',u.id,'quarantineObjectKey',u.quarantine_object_key,'reservationFingerprint',u.reservation_fingerprint,'sizeBytes',u.reserved_size,'mimeType',u.declared_mime,'expiresAt',to_char(u.expires_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));return;end if;
 select*into replay from public.repair_idempotency_begin_v1(p_company_id,a.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash);if found then return query select replay.command_status,replay.result_snapshot;return;end if;
 if p_action='UPLOAD_INIT'then
  if e.status not in('DRAFT','NEEDS_REVIEW')or p_value->'parent'->>'type'<>'KNOWLEDGE_ATTACHMENT'or(p_value->'parent'->>'knowledgeId')::uuid<>e.id then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_STATE_REJECTED','현재 상태 또는 첨부 parent 불일치','DENIED');return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;
  select count(*),coalesce(sum(reserved_size),0)into total_count,total_size from public.hotel_file_uploads where company_id=p_company_id and knowledge_id=e.id and status not in('EXPIRED','REJECTED','SCAN_FAILED');if total_count>=10 or total_size+(p_value->>'sizeBytes')::bigint>209715200 then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_QUOTA_REJECTED','첨부 업로드 수량 또는 용량 제한','DENIED');return query select'FILE_QUOTA_EXCEEDED',null::jsonb;return;end if;
  if(p_value->>'quarantineObjectKey')!~'^quarantine/[0-9a-f-]{36}/[A-Za-z0-9_-]{43}$'or(p_value->>'reservationFingerprint')!~'^[a-f0-9]{64}$'or(p_value->>'mimeType')not in('image/jpeg','image/png','image/webp','image/heic')or(p_value->>'sizeBytes')::bigint not between 1 and 20971520 then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_RESERVATION_REJECTED','첨부 예약 metadata 불일치','DENIED');return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;
  insert into public.hotel_file_uploads(id,company_id,branch_id,parent_type,knowledge_id,display_name,declared_mime,reserved_size,quarantine_object_key,reservation_fingerprint,status,initiated_by,initiated_session_id,expires_at)values(p_resource_id,p_company_id,e.branch_id,'KNOWLEDGE_ATTACHMENT',e.id,p_value->>'fileName',p_value->>'mimeType',(p_value->>'sizeBytes')::bigint,p_value->>'quarantineObjectKey',p_value->>'reservationFingerprint','PENDING_UPLOAD',a.user_id,a.session_id,now_at+interval'5 minutes');
  snapshot:=jsonb_build_object('id',p_resource_id,'status','PENDING_UPLOAD','expiresAt',to_char((now_at+interval'5 minutes')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 else
  select*into u from public.hotel_file_uploads where company_id=p_company_id and id=p_resource_id and knowledge_id=e.id and branch_id is not distinct from e.branch_id and initiated_by=a.user_id for update;if not found then return query select'NOT_FOUND',null::jsonb;return;end if;
  if u.status='QUARANTINED'and u.source_etag=p_value->>'etag'and u.source_object_version=p_value->>'objectVersion'then snapshot:=public.hotel_file_status_snapshot_v1(p_company_id,p_resource_id);
  elsif u.status<>'PENDING_UPLOAD'or u.expires_at<=now_at then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_EXPIRED_REJECTED','첨부 업로드 기한 또는 상태 만료','DENIED');return query select'FILE_UPLOAD_EXPIRED',null::jsonb;return;
  elsif(p_value->>'reservationFingerprint')<>u.reservation_fingerprint or(p_value->>'etag')!~'^"[a-f0-9]{32}"$'or btrim(coalesce(p_value->>'objectVersion',''))=''or(p_value->>'sizeBytes')::bigint<>u.reserved_size or p_value->>'mimeType'<>u.declared_mime then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_COMPLETION_REJECTED','첨부 완료 metadata 불일치','DENIED');return query select'FILE_INTEGRITY_MISMATCH',null::jsonb;return;
  else scan_id:=(p_value->>'scanJobId')::uuid;update public.hotel_file_uploads set status='QUARANTINED',source_etag=p_value->>'etag',source_object_version=p_value->>'objectVersion',updated_at=now_at where company_id=p_company_id and id=p_resource_id;insert into public.outbox_jobs(id,company_id,branch_id,job_type,payload,status,available_at)values(scan_id,p_company_id,e.branch_id,'HOTEL_FILE_SCAN',jsonb_build_object('schemaVersion',1,'jobId',scan_id::text),'PENDING',now_at);insert into public.hotel_file_scan_jobs(id,company_id,branch_id,upload_id,dispatch_job_id,status)values(scan_id,p_company_id,e.branch_id,p_resource_id,scan_id,'PENDING');snapshot:=public.hotel_file_status_snapshot_v1(p_company_id,p_resource_id);end if;
 end if;
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id)values(p_audit_event_id,case when p_action='UPLOAD_INIT'then'HOTEL_KNOWLEDGE_FILE_UPLOAD_INITIATED'else'HOTEL_KNOWLEDGE_FILE_UPLOAD_COMPLETED'end,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,'HOTEL_FILE_UPLOAD',p_resource_id,jsonb_build_object('knowledgeId',e.id),'SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,a.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'HOTEL_FILE_UPLOAD',p_resource_id,p_audit_event_id,snapshot);
 return query select case when p_action='UPLOAD_INIT'then'CREATED'else'UPDATED'end,snapshot;
exception when invalid_text_representation or foreign_key_violation or check_violation then if a.user_id is not null and e.id is not null then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_INTEGRITY_REJECTED','첨부 업로드 무결성 검증 실패','DENIED');end if;return query select'INVALID_STATE_TRANSITION',null::jsonb;when unique_violation then if a.user_id is not null and e.id is not null then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_DUPLICATE_REJECTED','첨부 업로드 중복','DENIED');end if;return query select'DUPLICATE',null::jsonb;
end $function$;
revoke all on function public.hotel_knowledge_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)from public;

create function public.hotel_knowledge_attachment_command_v1(p_company_id uuid,p_knowledge_id uuid,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_audit_event_id uuid,p_trace_id uuid)returns table(command_status text,result_snapshot jsonb)language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare a record;e public.hotel_knowledge_entries%rowtype;replay record;snapshot jsonb;requested integer;matched integer;new_version integer;now_at timestamptz:=statement_timestamp();
begin
 select*into a from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);if not found then return query select'FORBIDDEN',null::jsonb;return;end if;
 select*into e from public.hotel_knowledge_entries where company_id=p_company_id and id=p_knowledge_id for update;if not found then return query select'NOT_FOUND',null::jsonb;return;end if;
 if e.author_user_id<>a.user_id or not public.hotel_knowledge_has_permission_v1(p_company_id,a.user_id,e.branch_id,'KNOWLEDGE_CREATE')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_DENIED','첨부 변경 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;
 select*into replay from public.hotel_knowledge_idempotency_begin_v1(p_company_id,a.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash);if found then return query select replay.command_status,replay.result_snapshot;return;end if;
 if public.hotel_knowledge_personal_data_v1(jsonb_build_object('reason',p_value->>'reason'))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_REASON_REJECTED','첨부 변경 사유 민감정보 감지','DENIED');return query select'VALIDATION_ERROR',null::jsonb;return;end if;
 if p_expected_version<>e.version then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_VERSION_CONFLICT','첨부 version 불일치','DENIED');return query select'VERSION_CONFLICT',null::jsonb;return;end if;if e.status not in('DRAFT','NEEDS_REVIEW')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_DENIED','현재 상태에서 첨부 변경 불가','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;
 select count(*),count(distinct value)into requested,matched from jsonb_array_elements_text(coalesce(p_value->'fileVersionIds','[]'::jsonb));if requested<1 or requested>10 or requested<>matched then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_SET_REJECTED','첨부 집합 개수 또는 중복 검증 실패','DENIED');return query select'VALIDATION_ERROR',null::jsonb;return;end if;
 if exists(select 1 from public.hotel_knowledge_attachments existing where existing.company_id=p_company_id and existing.knowledge_id=e.id and existing.knowledge_version=(select max(current_attachment.knowledge_version)from public.hotel_knowledge_attachments current_attachment where current_attachment.company_id=p_company_id and current_attachment.knowledge_id=e.id and current_attachment.knowledge_version<=e.version)and not exists(select 1 from jsonb_array_elements_text(p_value->'fileVersionIds')requested_file where requested_file.value::uuid=existing.file_version_id))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_REMOVAL_REJECTED','기존 첨부 제거 시도','DENIED');return query select'VALIDATION_ERROR',null::jsonb;return;end if;
 select count(*)into matched from jsonb_array_elements_text(coalesce(p_value->'fileVersionIds','[]'::jsonb))x join public.hotel_file_versions v on v.company_id=p_company_id and v.id=x.value::uuid join public.hotel_file_uploads u on u.company_id=v.company_id and u.id=v.upload_id and u.knowledge_id=e.id and u.parent_type='KNOWLEDGE_ATTACHMENT'and u.branch_id is not distinct from e.branch_id and u.status in('READY_UNLINKED','LINKED') join public.hotel_file_scan_jobs j on j.company_id=v.company_id and j.upload_id=u.id and j.file_version_id=v.id and j.status='COMPLETED';if matched<>requested then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_PARENT_REJECTED','첨부 parent 또는 검역 상태 불일치','DENIED');return query select'NOT_FOUND',null::jsonb;return;end if;
 new_version:=e.version+1;insert into public.hotel_knowledge_attachments(id,company_id,branch_id,knowledge_id,knowledge_version,file_version_id,display_order,linked_by)select gen_random_uuid(),p_company_id,e.branch_id,e.id,new_version,x.value::uuid,x.ordinality-1,a.user_id from jsonb_array_elements_text(coalesce(p_value->'fileVersionIds','[]'::jsonb))with ordinality x(value,ordinality);
 update public.hotel_file_uploads u set status='LINKED',updated_at=now_at where u.company_id=p_company_id and u.knowledge_id=e.id and exists(select 1 from jsonb_array_elements_text(coalesce(p_value->'fileVersionIds','[]'::jsonb))x join public.hotel_file_versions v on v.company_id=p_company_id and v.id=x.value::uuid where v.upload_id=u.id);
 update public.hotel_knowledge_entries set version=new_version,updated_at=now_at where company_id=p_company_id and id=e.id;select*into e from public.hotel_knowledge_entries where company_id=p_company_id and id=p_knowledge_id;
 insert into public.hotel_knowledge_versions(id,company_id,knowledge_id,entry_version,action,status,snapshot,reason,actor_user_id)values(gen_random_uuid(),p_company_id,e.id,e.version,'ATTACHMENTS_UPDATE',e.status,public.hotel_knowledge_version_snapshot_v1(p_company_id,e.id),p_value->>'reason',a.user_id);
 snapshot:=public.hotel_knowledge_snapshot_v1(p_company_id,e.id,p_session_token);insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id)values(p_audit_event_id,'KNOWLEDGE_ATTACHMENTS_UPDATE',a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,'KNOWLEDGE_ENTRY',e.id,jsonb_build_object('version',e.version,'attachmentCount',requested),p_value->>'reason','SUCCEEDED',p_trace_id);perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,a.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'KNOWLEDGE_ENTRY',e.id,p_audit_event_id,snapshot);return query select'UPDATED',snapshot;
exception when invalid_text_representation or check_violation then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_INTEGRITY_REJECTED','첨부 연결 무결성 검증 실패','DENIED');return query select'VALIDATION_ERROR',null::jsonb;when unique_violation then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_ATTACHMENT_DUPLICATE_REJECTED','첨부 연결 중복','DENIED');return query select'DUPLICATE',null::jsonb;
end $function$;
revoke all on function public.hotel_knowledge_attachment_command_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)from public;

create function public.hotel_knowledge_file_view_v1(p_company_id uuid,p_knowledge_id uuid,p_file_version_id uuid,p_action text,p_session_token text,p_grant_id uuid,p_completion_token text,p_audit_event_id uuid,p_alert_audit_event_id uuid,p_trace_id uuid)returns table(command_status text,result_snapshot jsonb)language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare a record;e public.hotel_knowledge_entries%rowtype;f record;g public.hotel_file_access_grants%rowtype;window_at timestamptz:=date_bin(interval'5 minutes',statement_timestamp(),timestamptz'1970-01-01 00:00:00+00');user_count integer;scope_count integer;scope_type text;scope_id uuid;
begin
 if p_action not in('AUTHORIZE','SUCCEEDED','FAILED','ABORTED')or p_completion_token!~'^[A-Za-z0-9_-]{43}$'then return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;
 if p_action<>'AUTHORIZE'then select*into g from public.hotel_file_access_grants where company_id=p_company_id and id=p_grant_id and knowledge_id=p_knowledge_id and file_version_id=p_file_version_id and trace_id=p_trace_id and completion_token_hash=sha256(convert_to(p_completion_token,'UTF8'))for update;if not found then return query select'NOT_FOUND',null::jsonb;return;end if;if g.status=p_action then return query select'RECORDED',null::jsonb;return;end if;if g.status<>'STARTED'then return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;update public.hotel_file_access_grants set status=p_action,completed_at=statement_timestamp()where company_id=p_company_id and id=p_grant_id;insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id)values(p_audit_event_id,'HOTEL_KNOWLEDGE_FILE_VIEW_'||p_action,g.actor_user_id,g.actor_type,g.session_id,p_company_id,g.branch_id,'HOTEL_FILE_VERSION',p_file_version_id,jsonb_build_object('knowledgeId',p_knowledge_id),case when p_action='SUCCEEDED'then'SUCCEEDED'else'FAILED'end,p_trace_id);return query select'RECORDED',null::jsonb;return;end if;
 select*into a from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);select*into e from public.hotel_knowledge_entries where company_id=p_company_id and id=p_knowledge_id;if not found or a.user_id is null then return query select'NOT_FOUND',null::jsonb;return;end if;if not public.hotel_knowledge_visible_v1(p_company_id,p_knowledge_id,a.user_id)or not public.hotel_knowledge_has_permission_v1(p_company_id,a.user_id,e.branch_id,'HOTEL_FILE_READ')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_VIEW_DENIED','본문 또는 파일 조회 권한 없음','DENIED');return query select'NOT_FOUND',null::jsonb;return;end if;
 select v.clean_object_key,v.clean_etag,v.clean_object_version,encode(v.clean_sha256,'hex')clean_sha256,v.clean_size,v.detected_mime,v.display_name into f from public.hotel_knowledge_attachments x join public.hotel_file_versions v on v.company_id=x.company_id and v.id=x.file_version_id join public.hotel_file_uploads u on u.company_id=v.company_id and u.id=v.upload_id and u.knowledge_id=x.knowledge_id and u.branch_id is not distinct from x.branch_id and u.status='LINKED'join public.hotel_file_scan_jobs j on j.company_id=v.company_id and j.upload_id=u.id and j.file_version_id=v.id and j.status='COMPLETED'where x.company_id=p_company_id and x.knowledge_id=p_knowledge_id and x.file_version_id=p_file_version_id and x.knowledge_version=(select max(y.knowledge_version)from public.hotel_knowledge_attachments y where y.company_id=p_company_id and y.knowledge_id=p_knowledge_id and y.knowledge_version<=e.version);if not found then return query select'NOT_FOUND',null::jsonb;return;end if;
 insert into public.hotel_knowledge_file_access_rate_windows(company_id,branch_id,scope_type,scope_id,window_started_at,request_count)values(p_company_id,e.branch_id,'USER',a.user_id,window_at,1)on conflict on constraint hotel_knowledge_file_access_rate_windows_pkey do update set request_count=public.hotel_knowledge_file_access_rate_windows.request_count+1,updated_at=statement_timestamp()where public.hotel_knowledge_file_access_rate_windows.request_count<30 returning request_count into user_count;if user_count is null then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_VIEW_RATE_LIMITED','사용자 파일 조회 제한','DENIED');return query select'RATE_LIMITED',null::jsonb;return;end if;
 scope_type:=case when e.branch_id is null then'COMPANY'else'HOTEL'end;scope_id:=coalesce(e.branch_id,p_company_id);insert into public.hotel_knowledge_file_access_rate_windows(company_id,branch_id,scope_type,scope_id,window_started_at,request_count)values(p_company_id,e.branch_id,scope_type,scope_id,window_at,1)on conflict on constraint hotel_knowledge_file_access_rate_windows_pkey do update set request_count=public.hotel_knowledge_file_access_rate_windows.request_count+1,updated_at=statement_timestamp()where public.hotel_knowledge_file_access_rate_windows.request_count<100 returning request_count into scope_count;if scope_count=80 then insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,result,trace_id)values(p_alert_audit_event_id,'HOTEL_KNOWLEDGE_FILE_BULK_EXPORT_ALERT',a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,'HOTEL_KNOWLEDGE_FILE_ACCESS_WINDOW',scope_id,jsonb_build_object('windowStartedAt',window_at,'requestCount',80),'SUCCEEDED',p_trace_id);end if;if scope_count is null then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,a.user_id,a.user_type,a.session_id,p_company_id,e.branch_id,e.id,'KNOWLEDGE_FILE_VIEW_RATE_LIMITED','범위 파일 조회 제한','DENIED');return query select'RATE_LIMITED',null::jsonb;return;end if;
 insert into public.hotel_file_access_grants(id,company_id,branch_id,actor_user_id,actor_type,session_id,knowledge_id,file_version_id,completion_token_hash,status,trace_id)values(p_grant_id,p_company_id,e.branch_id,a.user_id,a.user_type,a.session_id,p_knowledge_id,p_file_version_id,sha256(convert_to(p_completion_token,'UTF8')),'STARTED',p_trace_id);return query select'OK',jsonb_build_object('grantId',p_grant_id,'cleanObjectKey',f.clean_object_key,'etag',f.clean_etag,'objectVersion',f.clean_object_version,'sha256',f.clean_sha256,'sizeBytes',f.clean_size,'mimeType',f.detected_mime,'displayName',f.display_name);
end $function$;
revoke all on function public.hotel_knowledge_file_view_v1(uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid)from public;

alter table public.hotel_knowledge_attachments enable row level security;
alter table public.hotel_knowledge_attachments force row level security;
alter table public.hotel_knowledge_file_access_rate_windows enable row level security;
alter table public.hotel_knowledge_file_access_rate_windows force row level security;
create policy hotel_knowledge_attachments_company_isolation on public.hotel_knowledge_attachments using(public.hotel_knowledge_rls_company_guard_v1(company_id))with check(public.hotel_knowledge_rls_company_guard_v1(company_id));
create policy hotel_knowledge_file_access_rate_windows_company_isolation on public.hotel_knowledge_file_access_rate_windows using(public.hotel_knowledge_rls_company_guard_v1(company_id))with check(public.hotel_knowledge_rls_company_guard_v1(company_id));

do $acl$ declare r text;begin
 for r in select role_name from public.runtime_database_capabilities where capability='API_RUNTIME'loop
  execute format('revoke all on public.hotel_knowledge_attachments,public.hotel_knowledge_file_access_rate_windows from %I',r);
  execute format('grant execute on function public.hotel_knowledge_file_parent_scope_v1(uuid,uuid,text)to %I',r);
  execute format('grant execute on function public.hotel_knowledge_file_scope_v1(uuid,uuid,text)to %I',r);
  execute format('grant execute on function public.hotel_knowledge_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)to %I',r);
  execute format('grant execute on function public.hotel_knowledge_attachment_command_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)to %I',r);
  execute format('grant execute on function public.hotel_knowledge_file_view_v1(uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid)to %I',r);
 end loop;
 for r in select role_name from public.runtime_database_capabilities where capability='RECONCILER'loop execute format('revoke all on public.hotel_knowledge_attachments,public.hotel_knowledge_file_access_rate_windows from %I',r);end loop;
end $acl$;

insert into public.schema_migrations(version)values('0059_hotel_knowledge_attachments');
commit;
