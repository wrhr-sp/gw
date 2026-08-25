begin;

create extension if not exists pg_trgm;

insert into public.permissions(code,description) values
 ('KNOWLEDGE_READ','호텔 운영 지식 조회'),
 ('KNOWLEDGE_CREATE','호텔 운영 지식 초안 작성'),
 ('KNOWLEDGE_REVIEW','호텔 운영 지식 검토'),
 ('KNOWLEDGE_PUBLISH','호텔 운영 지식 게시'),
 ('KNOWLEDGE_HIGH_RISK_PUBLISH','호텔 운영 고위험 지식 지정 검토·게시'),
 ('KNOWLEDGE_ARCHIVE','호텔 운영 지식 보관')
on conflict(code) do update set description=excluded.description;

create table public.hotel_knowledge_entries(
 id uuid primary key,
 company_id uuid not null references public.companies(id),
 scope_type text not null check(scope_type in ('COMPANY','HOTEL')),
 branch_id uuid,
 title text not null check(char_length(btrim(title)) between 2 and 160),
 summary text not null check(char_length(btrim(summary)) between 2 and 500),
 knowledge_type text not null check(knowledge_type in ('DEFECT_REPAIR','FACILITY_MAINTENANCE','COMPLAINT_RESPONSE','ROOM_OPERATION','HOUSEKEEPING','SAFETY_CAUTION','CONTRACTOR','OTHER')),
 risk_classification text not null check(risk_classification in ('STANDARD','SAFETY','LEGAL','PRIVACY','REFUND_COMPENSATION')),
 situation text not null check(char_length(btrim(situation)) between 2 and 4000),
 symptoms_and_context text not null check(char_length(btrim(symptoms_and_context)) between 2 and 4000),
 checks text[] not null check(cardinality(checks) between 1 and 30),
 recommended_response text[] not null check(cardinality(recommended_response) between 1 and 30),
 prohibited_or_caution_response text[] not null check(cardinality(prohibited_or_caution_response) between 1 and 30),
 escalation_criteria text not null check(char_length(btrim(escalation_criteria)) between 2 and 3000),
 required_permission_or_approval text not null check(char_length(btrim(required_permission_or_approval)) between 2 and 2000),
 case_summary text not null default '' check(char_length(case_summary)<=4000),
 outcome_and_lesson text not null default '' check(char_length(outcome_and_lesson)<=4000),
 tags text[] not null default '{}',
 related_manual_refs text[] not null default '{}',
 status text not null default 'DRAFT' check(status in ('DRAFT','REVIEW_REQUESTED','PUBLISHED','NEEDS_REVIEW','ARCHIVED')),
 author_user_id uuid not null,
 reviewer_user_id uuid,
 designated_reviewer_user_id uuid,
 review_requested_version integer check(review_requested_version is null or review_requested_version>0),
 published_at timestamptz,
 reviewed_at timestamptz,
 review_due_at timestamptz not null,
 version integer not null default 1 check(version>0),
 knowledge_search_vector tsvector not null default ''::tsvector,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 unique(company_id,id),
 foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id),
 foreign key(company_id,author_user_id) references public.users(company_id,id),
 foreign key(company_id,reviewer_user_id) references public.users(company_id,id),
 foreign key(company_id,designated_reviewer_user_id) references public.users(company_id,id),
 check((scope_type='COMPANY' and branch_id is null)or(scope_type='HOTEL' and branch_id is not null)),
 check(cardinality(tags)<=20 and cardinality(related_manual_refs)<=20),
 check(risk_classification='STANDARD' or designated_reviewer_user_id is not null)
);

create table public.hotel_knowledge_versions(
 id uuid primary key,
 company_id uuid not null,
 knowledge_id uuid not null,
 entry_version integer not null check(entry_version>0),
 action text not null check(action in ('CREATE','UPDATE','REQUEST_REVIEW','PUBLISH','MARK_NEEDS_REVIEW','AUTO_NEEDS_REVIEW','REPUBLISH','ARCHIVE')),
 status text not null check(status in ('DRAFT','REVIEW_REQUESTED','PUBLISHED','NEEDS_REVIEW','ARCHIVED')),
 snapshot jsonb not null,
 reason text not null check(char_length(btrim(reason)) between 2 and 500),
 actor_user_id uuid,
 occurred_at timestamptz not null default statement_timestamp(),
 unique(company_id,knowledge_id,entry_version),
 foreign key(company_id,knowledge_id) references public.hotel_knowledge_entries(company_id,id),
 foreign key(company_id,actor_user_id) references public.users(company_id,id)
);

create table public.hotel_knowledge_feedback(
 id uuid primary key,
 company_id uuid not null,
 knowledge_id uuid not null,
 entry_version integer not null check(entry_version>0),
 actor_user_id uuid not null,
 kind text not null check(kind in ('HELPFUL','NOT_HELPFUL','REPORT_ERROR')),
 comment text check(comment is null or char_length(btrim(comment)) between 2 and 1000),
 created_at timestamptz not null default statement_timestamp(),
 foreign key(company_id,knowledge_id) references public.hotel_knowledge_entries(company_id,id),
 foreign key(company_id,actor_user_id) references public.users(company_id,id),
 check((kind='REPORT_ERROR' and comment is not null)or(kind in('HELPFUL','NOT_HELPFUL') and comment is null))
);
create unique index hotel_knowledge_feedback_one_vote_idx on public.hotel_knowledge_feedback(company_id,knowledge_id,entry_version,actor_user_id)where kind in('HELPFUL','NOT_HELPFUL');
create unique index hotel_knowledge_feedback_one_report_idx on public.hotel_knowledge_feedback(company_id,knowledge_id,entry_version,actor_user_id)where kind='REPORT_ERROR';

create table public.hotel_knowledge_links(
 id uuid primary key,
 company_id uuid not null,
 knowledge_id uuid not null,
 link_kind text not null check(link_kind in ('ISSUE','REPAIR')),
 branch_id uuid not null,
 issue_id uuid,
 repair_id uuid,
 created_at timestamptz not null default statement_timestamp(),
 unique(company_id,knowledge_id,link_kind,issue_id,repair_id),
 foreign key(company_id,knowledge_id) references public.hotel_knowledge_entries(company_id,id),
 foreign key(company_id,branch_id,issue_id) references public.hotel_operational_issues(company_id,branch_id,id),
 foreign key(company_id,branch_id,repair_id) references public.hotel_repair_cases(company_id,branch_id,id),
 check((link_kind='ISSUE' and issue_id is not null and repair_id is null)or(link_kind='REPAIR' and issue_id is null and repair_id is not null))
);

create unique index hotel_knowledge_links_issue_unique_idx on public.hotel_knowledge_links(company_id,knowledge_id,issue_id)where link_kind='ISSUE';
create unique index hotel_knowledge_links_repair_unique_idx on public.hotel_knowledge_links(company_id,knowledge_id,repair_id)where link_kind='REPAIR';

create function public.hotel_knowledge_search_vector_v1() returns trigger language plpgsql set search_path=pg_catalog as $function$
begin
 new.knowledge_search_vector:=
  setweight(to_tsvector('simple',coalesce(new.title,'')),'A')||
  setweight(to_tsvector('simple',coalesce(new.summary,'')),'A')||
  setweight(to_tsvector('simple',coalesce(new.situation,'')||' '||coalesce(new.symptoms_and_context,'')),'B')||
  setweight(to_tsvector('simple',array_to_string(new.checks,' ')||' '||array_to_string(new.recommended_response,' ')||' '||array_to_string(new.prohibited_or_caution_response,' ')),'B')||
  setweight(to_tsvector('simple',array_to_string(new.tags,' ')),'A');
 return new;
end $function$;
revoke all on function public.hotel_knowledge_search_vector_v1() from public;
create trigger hotel_knowledge_search_vector before insert or update of title,summary,situation,symptoms_and_context,checks,recommended_response,prohibited_or_caution_response,tags on public.hotel_knowledge_entries for each row execute function public.hotel_knowledge_search_vector_v1();

create index hotel_knowledge_search_vector_idx on public.hotel_knowledge_entries using gin(knowledge_search_vector);
create index hotel_knowledge_title_trgm_idx on public.hotel_knowledge_entries using gin((lower(title||' '||summary)) gin_trgm_ops);
create function public.hotel_knowledge_response_search_text_v1(p_checks text[],p_recommended text[],p_caution text[])returns text language sql immutable set search_path=pg_catalog as $function$
 select lower(coalesce(array_to_string(p_checks,' '),'')||' '||coalesce(array_to_string(p_recommended,' '),'')||' '||coalesce(array_to_string(p_caution,' '),''))
$function$;
revoke all on function public.hotel_knowledge_response_search_text_v1(text[],text[],text[])from public;
create index hotel_knowledge_response_trgm_idx on public.hotel_knowledge_entries using gin((public.hotel_knowledge_response_search_text_v1(checks,recommended_response,prohibited_or_caution_response)) gin_trgm_ops);
create index hotel_knowledge_visible_recent_idx on public.hotel_knowledge_entries(company_id,scope_type,branch_id,status,updated_at desc,id);
create index hotel_knowledge_tags_idx on public.hotel_knowledge_entries using gin(tags);

create function public.hotel_knowledge_append_only_v1() returns trigger language plpgsql set search_path=pg_catalog as $function$
begin raise exception 'knowledge history is append-only' using errcode='55000'; end $function$;
revoke all on function public.hotel_knowledge_append_only_v1() from public;
create trigger hotel_knowledge_versions_append_only before update or delete on public.hotel_knowledge_versions for each row execute function public.hotel_knowledge_append_only_v1();
create trigger hotel_knowledge_feedback_append_only before update or delete on public.hotel_knowledge_feedback for each row execute function public.hotel_knowledge_append_only_v1();

create function public.hotel_knowledge_session_actor_v1(p_company_id uuid,p_session_token text)
returns table(session_id uuid,user_id uuid,user_type text,display_name text) language sql stable security definer set search_path=pg_catalog as $function$
 select s.id,u.id,u.user_type,u.display_name
 from public.auth_sessions s join public.users u on u.company_id=s.company_id and u.id=s.user_id join public.companies c on c.id=s.company_id
 where public.runtime_has_capability('API_RUNTIME') and p_session_token~'^[A-Za-z0-9_-]{43}$'
  and s.id=nullif(current_setting('app.session_id',true),'')::uuid and s.company_id=p_company_id
  and s.token_hash=sha256(convert_to(p_session_token,'UTF8')) and s.revoked_at is null
  and s.idle_expires_at>statement_timestamp() and s.absolute_expires_at>statement_timestamp()
  and u.status='ACTIVE' and u.user_type in('INTERNAL_STAFF','HOUSEKEEPING','HOTEL_OWNER') and c.status='ACTIVE'
$function$;
revoke all on function public.hotel_knowledge_session_actor_v1(uuid,text) from public;

create function public.hotel_knowledge_has_permission_v1(p_company_id uuid,p_user_id uuid,p_branch_id uuid,p_permission_code text)
returns boolean language sql stable security definer set search_path=pg_catalog as $function$
 with actor as(select u.id user_id,u.user_type from public.users u where u.company_id=p_company_id and u.id=p_user_id and u.status='ACTIVE'),
 subjects as(
  select 'USER'::text subject_type,a.user_id subject_id from actor a
  union all select 'ROLE',m.role_id from actor a join public.user_role_memberships m on m.company_id=p_company_id and m.user_id=a.user_id join public.roles r on r.company_id=m.company_id and r.id=m.role_id and r.status='ACTIVE' where m.valid_from<=statement_timestamp() and(m.valid_until is null or m.valid_until>statement_timestamp())
  union all select 'GROUP',m.group_id from actor a join public.user_group_memberships m on m.company_id=p_company_id and m.user_id=a.user_id join public.user_groups g on g.company_id=m.company_id and g.id=m.group_id and g.status='ACTIVE' where m.valid_from<=statement_timestamp() and(m.valid_until is null or m.valid_until>statement_timestamp())
 ), effects as(
  select pg.effect from public.permission_grants pg join subjects s on s.subject_type=pg.subject_type and s.subject_id=pg.subject_id
  where pg.company_id=p_company_id and pg.permission_code=p_permission_code and(pg.branch_id is null or pg.branch_id=p_branch_id)
   and pg.valid_from<=statement_timestamp() and(pg.valid_until is null or pg.valid_until>statement_timestamp())
 ), assignment as(
  select case when p_branch_id is null then exists(
   select 1 from actor a where a.user_type='INTERNAL_STAFF'
   union all select 1 from actor a join public.hotel_staff_assignments x on x.company_id=p_company_id and x.user_id=a.user_id where a.user_type='HOUSEKEEPING' and x.terminated_at is null and x.start_date<=statement_timestamp()::date and(x.end_date is null or x.end_date>=statement_timestamp()::date)
   union all select 1 from actor a join public.hotel_owner_assignments x on x.company_id=p_company_id and x.user_id=a.user_id where a.user_type='HOTEL_OWNER' and x.terminated_at is null and x.start_date<=statement_timestamp()::date and(x.end_date is null or x.end_date>=statement_timestamp()::date)
  ) else exists(
   select 1 from actor a join public.hotel_staff_assignments x on x.company_id=p_company_id and x.branch_id=p_branch_id and x.user_id=a.user_id where a.user_type in('INTERNAL_STAFF','HOUSEKEEPING') and x.terminated_at is null and x.start_date<=statement_timestamp()::date and(x.end_date is null or x.end_date>=statement_timestamp()::date)
   union all select 1 from actor a join public.hotel_owner_assignments x on x.company_id=p_company_id and x.branch_id=p_branch_id and x.user_id=a.user_id where a.user_type='HOTEL_OWNER' and x.terminated_at is null and x.start_date<=statement_timestamp()::date and(x.end_date is null or x.end_date>=statement_timestamp()::date)
  ) end allowed
 )
 select exists(select 1 from actor) and(select allowed from assignment) and not exists(select 1 from effects where effect='DENY') and exists(select 1 from effects where effect='ALLOW')
$function$;
revoke all on function public.hotel_knowledge_has_permission_v1(uuid,uuid,uuid,text) from public;

create function public.hotel_knowledge_actor_v1(p_company_id uuid,p_branch_id uuid,p_session_token text,p_permission_code text)
returns table(session_id uuid,user_id uuid,user_type text,display_name text) language sql stable security definer set search_path=pg_catalog as $function$
 select a.* from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token)a
 where public.hotel_knowledge_has_permission_v1(p_company_id,a.user_id,p_branch_id,p_permission_code)
$function$;
revoke all on function public.hotel_knowledge_actor_v1(uuid,uuid,text,text) from public;

create function public.hotel_knowledge_reviewer_candidates_v1(p_company_id uuid,p_branch_id uuid,p_session_token text)returns table(command_status text,result_snapshot jsonb)language sql stable security definer set search_path=pg_catalog as $function$
 select 'OK',jsonb_build_object('candidates',coalesce(jsonb_agg(jsonb_build_object('userId',u.id,'displayName',u.display_name)order by u.display_name,u.id),'[]'::jsonb))
 from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token) actor
 join public.users u on u.company_id=p_company_id and u.status='ACTIVE'and u.user_type='INTERNAL_STAFF'and u.id<>actor.user_id
 where public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,p_branch_id,'KNOWLEDGE_CREATE')
  and public.hotel_knowledge_has_permission_v1(p_company_id,u.id,p_branch_id,'KNOWLEDGE_REVIEW')
  and public.hotel_knowledge_has_permission_v1(p_company_id,u.id,p_branch_id,'KNOWLEDGE_PUBLISH')
  and public.hotel_knowledge_has_permission_v1(p_company_id,u.id,p_branch_id,'KNOWLEDGE_HIGH_RISK_PUBLISH')
$function$;
revoke all on function public.hotel_knowledge_reviewer_candidates_v1(uuid,uuid,text)from public;

create function public.hotel_knowledge_content_v1(p_value jsonb) returns jsonb language sql immutable set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'scopeType',p_value->>'scopeType','hotelId',p_value->'hotelId','title',p_value->>'title','summary',p_value->>'summary','knowledgeType',p_value->>'knowledgeType','riskClassification',p_value->>'riskClassification',
  'situation',p_value->>'situation','symptomsAndContext',p_value->>'symptomsAndContext','checks',coalesce(p_value->'checks','[]'::jsonb),
  'recommendedResponse',coalesce(p_value->'recommendedResponse','[]'::jsonb),'prohibitedOrCautionResponse',coalesce(p_value->'prohibitedOrCautionResponse','[]'::jsonb),
  'escalationCriteria',p_value->>'escalationCriteria','requiredPermissionOrApproval',p_value->>'requiredPermissionOrApproval','caseSummary',coalesce(p_value->>'caseSummary',''),
  'outcomeAndLesson',coalesce(p_value->>'outcomeAndLesson',''),'tags',coalesce(p_value->'tags','[]'::jsonb),'relatedManualRefs',coalesce(p_value->'relatedManualRefs','[]'::jsonb),
  'relatedIssueIds',coalesce(p_value->'relatedIssueIds','[]'::jsonb),'relatedRepairIds',coalesce(p_value->'relatedRepairIds','[]'::jsonb),'designatedReviewerUserId',p_value->'designatedReviewerUserId','reviewDueAt',p_value->>'reviewDueAt')
$function$;
revoke all on function public.hotel_knowledge_content_v1(jsonb) from public;

create function public.hotel_knowledge_personal_data_v1(p_value jsonb) returns boolean language sql immutable set search_path=pg_catalog as $function$
 select coalesce(p_value::text~*'([[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|01[016789][ -]?[0-9]{3,4}[ -]?[0-9]{4}|주민등록|예약번호|비밀번호|password|token|access[ _-]?code)',false)
$function$;
revoke all on function public.hotel_knowledge_personal_data_v1(jsonb) from public;

create function public.hotel_knowledge_failure_audit_v1(p_event_id uuid,p_trace_id uuid,p_actor_user_id uuid,p_actor_type text,p_session_id uuid,p_company_id uuid,p_branch_id uuid,p_knowledge_id uuid,p_event_code text,p_reason text,p_result text)returns void language sql volatile security definer set search_path=pg_catalog as $function$
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id)
 values(p_event_id,p_event_code,p_actor_user_id,p_actor_type,p_session_id,p_company_id,p_branch_id,'KNOWLEDGE_ENTRY',p_knowledge_id,'{}'::jsonb,p_reason,p_result,p_trace_id)
$function$;
revoke all on function public.hotel_knowledge_failure_audit_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid,text,text,text)from public;

create function public.hotel_knowledge_version_snapshot_v1(p_company_id uuid,p_knowledge_id uuid)returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'entry',to_jsonb(e)-'knowledge_search_vector',
  'relatedIssueIds',coalesce((select jsonb_agg(issue_id order by issue_id)from public.hotel_knowledge_links where company_id=e.company_id and knowledge_id=e.id and link_kind='ISSUE'),'[]'::jsonb),
  'relatedRepairIds',coalesce((select jsonb_agg(repair_id order by repair_id)from public.hotel_knowledge_links where company_id=e.company_id and knowledge_id=e.id and link_kind='REPAIR'),'[]'::jsonb),
  'attachmentFileVersionIds','[]'::jsonb)
 from public.hotel_knowledge_entries e where e.company_id=p_company_id and e.id=p_knowledge_id
$function$;
revoke all on function public.hotel_knowledge_version_snapshot_v1(uuid,uuid)from public;

create function public.hotel_knowledge_snapshot_v1(p_company_id uuid,p_knowledge_id uuid,p_session_token text) returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'id',e.id,'scopeType',e.scope_type,'hotelId',e.branch_id,'title',e.title,'summary',e.summary,'knowledgeType',e.knowledge_type,'riskClassification',e.risk_classification,
  'situation',e.situation,'symptomsAndContext',e.symptoms_and_context,'checks',to_jsonb(e.checks),'recommendedResponse',to_jsonb(e.recommended_response),
  'prohibitedOrCautionResponse',to_jsonb(e.prohibited_or_caution_response),'escalationCriteria',e.escalation_criteria,'requiredPermissionOrApproval',e.required_permission_or_approval,
  'caseSummary',e.case_summary,'outcomeAndLesson',e.outcome_and_lesson,'tags',to_jsonb(e.tags),'relatedManualRefs',to_jsonb(e.related_manual_refs),
  'relatedIssueIds',coalesce((select jsonb_agg(l.issue_id order by l.issue_id) from public.hotel_knowledge_links l where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='ISSUE'and exists(select 1 from public.hotel_issue_actor_v1(e.company_id,l.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER'then'HOTEL_OWNER_ISSUE_READ'else'ISSUE_READ'end))),'[]'::jsonb),
  'relatedRepairIds',coalesce((select jsonb_agg(l.repair_id order by l.repair_id) from public.hotel_knowledge_links l where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='REPAIR'and exists(select 1 from public.hotel_command_actor_v1(e.company_id,l.branch_id,p_session_token,'REPAIR_READ',true))),'[]'::jsonb),
  'status',e.status,'author',jsonb_build_object('displayName',author.display_name),'reviewer',case when reviewer.id is null then null else jsonb_build_object('displayName',reviewer.display_name)end,'designatedReviewer',case when designated.id is null then null else jsonb_build_object('displayName',designated.display_name)end,'reviewRequestedVersion',e.review_requested_version,
  'publishedAt',case when e.published_at is null then null else to_char(e.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')end,
  'reviewedAt',case when e.reviewed_at is null then null else to_char(e.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')end,
  'reviewDueAt',to_char(e.review_due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'version',e.version,
  'createdAt',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(e.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'actions',jsonb_build_object(
    'canEdit',e.author_user_id=actor.user_id and e.status in('DRAFT','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE'),
    'canRequestReview',e.author_user_id=actor.user_id and e.status in('DRAFT','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE'),
    'canPublish',e.author_user_id<>actor.user_id and e.status in('REVIEW_REQUESTED','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_PUBLISH')and(e.risk_classification='STANDARD'or(e.designated_reviewer_user_id=actor.user_id and e.review_requested_version=e.version and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_HIGH_RISK_PUBLISH'))),
    'canMarkNeedsReview',e.status='PUBLISHED'and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_REVIEW'),
    'canArchive',e.status<>'ARCHIVED'and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_ARCHIVE'),
    'canAttach',e.author_user_id=actor.user_id and e.status in('DRAFT','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE')),
  'isStale',(e.status='NEEDS_REVIEW' or(e.status='PUBLISHED' and e.review_due_at<=statement_timestamp())),
  'helpfulCount',(select count(*) from public.hotel_knowledge_feedback f where f.company_id=e.company_id and f.knowledge_id=e.id and f.entry_version=e.version and f.kind='HELPFUL'),
  'notHelpfulCount',(select count(*) from public.hotel_knowledge_feedback f where f.company_id=e.company_id and f.knowledge_id=e.id and f.entry_version=e.version and f.kind='NOT_HELPFUL'),
  'history',coalesce((select jsonb_agg(jsonb_build_object('version',v.entry_version,'action',v.action,'status',v.status,'reason',v.reason,'actor',jsonb_build_object('displayName',coalesce(vu.display_name,'시스템')),'occurredAt',to_char(v.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))order by v.entry_version) from public.hotel_knowledge_versions v left join public.users vu on vu.company_id=v.company_id and vu.id=v.actor_user_id where v.company_id=e.company_id and v.knowledge_id=e.id),'[]'::jsonb),
  'links',coalesce((select jsonb_agg(link order by link->>'kind',link->>'id') from(
    select jsonb_build_object('kind','ISSUE','id',l.issue_id,'title',i.title,'href',format('/hotels/%s/issues?issueId=%s',l.branch_id,l.issue_id))link
    from public.hotel_knowledge_links l join public.hotel_operational_issues i on i.company_id=l.company_id and i.branch_id=l.branch_id and i.id=l.issue_id
    where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='ISSUE' and exists(select 1 from public.hotel_issue_actor_v1(e.company_id,l.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER'then'HOTEL_OWNER_ISSUE_READ'else'ISSUE_READ'end))
    union all
    select jsonb_build_object('kind','REPAIR','id',l.repair_id,'title',r.defect_description,'href',format('/hotels/%s/repairs?repairId=%s',l.branch_id,l.repair_id))
    from public.hotel_knowledge_links l join public.hotel_repair_cases r on r.company_id=l.company_id and r.branch_id=l.branch_id and r.id=l.repair_id
    where l.company_id=e.company_id and l.knowledge_id=e.id and l.link_kind='REPAIR' and exists(select 1 from public.hotel_command_actor_v1(e.company_id,l.branch_id,p_session_token,'REPAIR_READ',true))
  )authorized_links),'[]'::jsonb)
 )
 from public.hotel_knowledge_entries e join public.users author on author.company_id=e.company_id and author.id=e.author_user_id left join public.users reviewer on reviewer.company_id=e.company_id and reviewer.id=e.reviewer_user_id left join public.users designated on designated.company_id=e.company_id and designated.id=e.designated_reviewer_user_id cross join lateral public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token)actor
 where e.company_id=p_company_id and e.id=p_knowledge_id
$function$;
revoke all on function public.hotel_knowledge_snapshot_v1(uuid,uuid,text) from public;

create function public.hotel_knowledge_scope_capabilities_v1(p_company_id uuid,p_user_id uuid,p_branch_id uuid) returns jsonb language sql stable security definer set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'canRead',public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,p_branch_id,'KNOWLEDGE_READ'),
  'canCreate',public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,p_branch_id,'KNOWLEDGE_CREATE'),
  'canReview',public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,p_branch_id,'KNOWLEDGE_REVIEW'),
  'canPublish',public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,p_branch_id,'KNOWLEDGE_PUBLISH'),
  'canHighRiskPublish',public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,p_branch_id,'KNOWLEDGE_HIGH_RISK_PUBLISH'),
  'canArchive',public.hotel_knowledge_has_permission_v1(p_company_id,p_user_id,p_branch_id,'KNOWLEDGE_ARCHIVE'))
$function$;
revoke all on function public.hotel_knowledge_scope_capabilities_v1(uuid,uuid,uuid)from public;

create function public.hotel_knowledge_capabilities_v1(p_company_id uuid,p_session_token text) returns table(command_status text,result_snapshot jsonb) language plpgsql stable security definer set search_path=pg_catalog as $function$
declare actor record;
begin
 select*into actor from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);if not found then return query select'FORBIDDEN',null::jsonb;return;end if;
 return query select'OK',jsonb_build_object(
  'canRead',public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,null,'KNOWLEDGE_READ')or exists(select 1 from public.hotel_profiles p where p.company_id=p_company_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,p.branch_id,'KNOWLEDGE_READ')),
  'canCreate',public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,null,'KNOWLEDGE_CREATE')or exists(select 1 from public.hotel_profiles p where p.company_id=p_company_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,p.branch_id,'KNOWLEDGE_CREATE')),
  'canReview',public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,null,'KNOWLEDGE_REVIEW')or exists(select 1 from public.hotel_profiles p where p.company_id=p_company_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,p.branch_id,'KNOWLEDGE_REVIEW')),
  'canPublish',public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,null,'KNOWLEDGE_PUBLISH')or exists(select 1 from public.hotel_profiles p where p.company_id=p_company_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,p.branch_id,'KNOWLEDGE_PUBLISH')),
  'canArchive',public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,null,'KNOWLEDGE_ARCHIVE')or exists(select 1 from public.hotel_profiles p where p.company_id=p_company_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,p.branch_id,'KNOWLEDGE_ARCHIVE')),
  'company',public.hotel_knowledge_scope_capabilities_v1(p_company_id,actor.user_id,null),
  'hotels',coalesce((select jsonb_agg(jsonb_build_object('hotelId',p.branch_id,'hotelName',b.name,'permissions',public.hotel_knowledge_scope_capabilities_v1(p_company_id,actor.user_id,p.branch_id))order by b.name,p.branch_id)from public.hotel_profiles p join public.branches b on b.company_id=p.company_id and b.id=p.branch_id where p.company_id=p_company_id and exists(select 1 from unnest(array['KNOWLEDGE_READ','KNOWLEDGE_CREATE','KNOWLEDGE_REVIEW','KNOWLEDGE_PUBLISH','KNOWLEDGE_HIGH_RISK_PUBLISH','KNOWLEDGE_ARCHIVE'])permission_code where public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,p.branch_id,permission_code))),'[]'::jsonb));
end $function$;
revoke all on function public.hotel_knowledge_capabilities_v1(uuid,text) from public;

create function public.hotel_knowledge_read_v1(p_company_id uuid,p_knowledge_id uuid,p_query jsonb,p_session_token text) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; page_no integer:=greatest(coalesce((p_query->>'page')::integer,1),1);page_size integer:=least(greatest(coalesce((p_query->>'pageSize')::integer,20),1),100);search_text text:=btrim(coalesce(p_query->>'search','')); total_count integer;snapshot jsonb;denied_branch uuid;
begin
 select*into actor from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);if not found then return query select'FORBIDDEN',null::jsonb;return;end if;
 if p_knowledge_id is not null then
  select public.hotel_knowledge_snapshot_v1(p_company_id,e.id,p_session_token)into snapshot from public.hotel_knowledge_entries e where e.company_id=p_company_id and e.id=p_knowledge_id and(
   (e.status in('PUBLISHED','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_READ'))or
   (e.author_user_id=actor.user_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE'))or
   (e.status in('REVIEW_REQUESTED','ARCHIVED')and(public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_REVIEW')or public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_ARCHIVE'))));
  if snapshot is null then
   select e.branch_id into denied_branch from public.hotel_knowledge_entries e where e.company_id=p_company_id and e.id=p_knowledge_id;
   if found then perform public.hotel_knowledge_failure_audit_v1(gen_random_uuid(),gen_random_uuid(),actor.user_id,actor.user_type,actor.session_id,p_company_id,denied_branch,p_knowledge_id,'KNOWLEDGE_READ_DENIED','현재 권한으로 지식 상세를 조회할 수 없음','DENIED');end if;
   return query select'NOT_FOUND',null::jsonb;return;
  end if;return query select'OK',snapshot;return;
 end if;
 with visible_entries as(
  select e.* from public.hotel_knowledge_entries e where e.company_id=p_company_id
   and((e.status in('PUBLISHED','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_READ'))or(e.author_user_id=actor.user_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE'))or(e.status in('REVIEW_REQUESTED','ARCHIVED')and(public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_REVIEW')or public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_ARCHIVE'))))
   and(p_query->>'scopeType'is null or e.scope_type=p_query->>'scopeType')and(p_query->>'hotelId'is null or e.branch_id=(p_query->>'hotelId')::uuid)
   and(p_query->>'knowledgeType'is null or e.knowledge_type=p_query->>'knowledgeType')and(p_query->>'status'is null or e.status=p_query->>'status')
   and(p_query->>'reviewedBefore'is null or e.reviewed_at<(p_query->>'reviewedBefore')::timestamptz)
 ),search_rank as(
  select e.*,case when search_text=''then 0 else ts_rank_cd(e.knowledge_search_vector,websearch_to_tsquery('simple',search_text))*4+public.similarity(lower(e.title||' '||e.summary||' '||array_to_string(e.checks,' ')||' '||array_to_string(e.recommended_response,' ')||' '||array_to_string(e.prohibited_or_caution_response,' ')),lower(search_text))*2 end rank
  from visible_entries e where search_text=''or e.knowledge_search_vector@@websearch_to_tsquery('simple',search_text)or public.similarity(lower(e.title||' '||e.summary||' '||array_to_string(e.checks,' ')||' '||array_to_string(e.recommended_response,' ')||' '||array_to_string(e.prohibited_or_caution_response,' ')),lower(search_text))>0.12 or position(lower(search_text)in lower(e.title||' '||e.summary||' '||e.situation||' '||e.symptoms_and_context||' '||array_to_string(e.checks,' ')||' '||array_to_string(e.recommended_response,' ')||' '||array_to_string(e.prohibited_or_caution_response,' ')||' '||array_to_string(e.tags,' ')))>0
 ),paged as(select*from search_rank order by rank desc,updated_at desc,id limit page_size offset(page_no-1)*page_size)
 select count(*)from search_rank into total_count;
 with visible_entries as(
  select e.* from public.hotel_knowledge_entries e where e.company_id=p_company_id
   and((e.status in('PUBLISHED','NEEDS_REVIEW')and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_READ'))or(e.author_user_id=actor.user_id and public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_CREATE'))or(e.status in('REVIEW_REQUESTED','ARCHIVED')and(public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_REVIEW')or public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,e.branch_id,'KNOWLEDGE_ARCHIVE'))))
   and(p_query->>'scopeType'is null or e.scope_type=p_query->>'scopeType')and(p_query->>'hotelId'is null or e.branch_id=(p_query->>'hotelId')::uuid)
   and(p_query->>'knowledgeType'is null or e.knowledge_type=p_query->>'knowledgeType')and(p_query->>'status'is null or e.status=p_query->>'status')
   and(p_query->>'reviewedBefore'is null or e.reviewed_at<(p_query->>'reviewedBefore')::timestamptz)
 ),search_rank as(
  select e.*,case when search_text=''then 0 else ts_rank_cd(e.knowledge_search_vector,websearch_to_tsquery('simple',search_text))*4+public.similarity(lower(e.title||' '||e.summary||' '||array_to_string(e.checks,' ')||' '||array_to_string(e.recommended_response,' ')||' '||array_to_string(e.prohibited_or_caution_response,' ')),lower(search_text))*2 end rank
  from visible_entries e where search_text=''or e.knowledge_search_vector@@websearch_to_tsquery('simple',search_text)or public.similarity(lower(e.title||' '||e.summary||' '||array_to_string(e.checks,' ')||' '||array_to_string(e.recommended_response,' ')||' '||array_to_string(e.prohibited_or_caution_response,' ')),lower(search_text))>0.12 or position(lower(search_text)in lower(e.title||' '||e.summary||' '||e.situation||' '||e.symptoms_and_context||' '||array_to_string(e.checks,' ')||' '||array_to_string(e.recommended_response,' ')||' '||array_to_string(e.prohibited_or_caution_response,' ')||' '||array_to_string(e.tags,' ')))>0
 ),paged as(select*from search_rank order by rank desc,updated_at desc,id limit page_size offset(page_no-1)*page_size)
 select jsonb_build_object(
  'entries',coalesce(jsonb_agg(jsonb_build_object(
   'id',paged.id,'scopeType',paged.scope_type,'hotelId',paged.branch_id,
   'hotelName',(select b.name from public.branches b where b.company_id=p_company_id and b.id=paged.branch_id),
   'title',paged.title,'summary',paged.summary,'knowledgeType',paged.knowledge_type,'riskClassification',paged.risk_classification,'tags',to_jsonb(paged.tags),
   'status',paged.status,'version',paged.version,'updatedAt',to_char(paged.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'isStale',(paged.status='NEEDS_REVIEW'or(paged.status='PUBLISHED'and paged.review_due_at<=statement_timestamp()))
  )order by paged.rank desc,paged.updated_at desc,paged.id),'[]'::jsonb),
  'page',page_no,'pageSize',page_size,'totalCount',total_count)into snapshot from paged;
 return query select'OK',snapshot;
exception when invalid_text_representation or numeric_value_out_of_range then return query select'VALIDATION_ERROR',null::jsonb;
end $function$;
revoke all on function public.hotel_knowledge_read_v1(uuid,uuid,jsonb,text) from public;

create function public.hotel_knowledge_command_v1(p_company_id uuid,p_knowledge_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid)
returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record;entry_record record;replay record;scope_branch uuid;requested_branch uuid;designated_reviewer uuid;next_status text;now_at timestamptz:=statement_timestamp();snapshot jsonb;content jsonb;issue_count integer;repair_count integer;
begin
 select*into actor from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);if not found then return query select'FORBIDDEN',null::jsonb;return;end if;
 content:=public.hotel_knowledge_content_v1(p_value);requested_branch:=nullif(content->>'hotelId','')::uuid;designated_reviewer:=nullif(content->>'designatedReviewerUserId','')::uuid;scope_branch:=requested_branch;
 if p_action='CREATE'then
  if p_expected_version<>0 or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_CREATE')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','초안 작성 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;
 else
  select*into entry_record from public.hotel_knowledge_entries e where e.company_id=p_company_id and e.id=p_knowledge_id for update;if not found then return query select'NOT_FOUND',null::jsonb;return;end if;
  scope_branch:=entry_record.branch_id;
 end if;
 if p_action<>'CREATE'then
  if p_action='UPDATE'and(not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_CREATE')or entry_record.author_user_id<>actor.user_id)then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','수정 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;
  elsif p_action='REQUEST_REVIEW'and(not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_CREATE')or entry_record.author_user_id<>actor.user_id)then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','검토요청 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;
  elsif p_action in('PUBLISH','REPUBLISH')and entry_record.author_user_id=actor.user_id then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_SELF_PUBLISH_DENIED','작성자와 게시 검토자는 분리되어야 함','DENIED');return query select'FORBIDDEN',null::jsonb;return;
  elsif p_action in('PUBLISH','REPUBLISH')and(not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_REVIEW')or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_PUBLISH'))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','검토 또는 게시 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;
  elsif p_action='MARK_NEEDS_REVIEW'and not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_REVIEW')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','재검토 전환 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;
  elsif p_action='ARCHIVE'and not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_ARCHIVE')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','보관 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;
  elsif p_action not in('UPDATE','REQUEST_REVIEW','PUBLISH','REPUBLISH','MARK_NEEDS_REVIEW','ARCHIVE')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_ACTION_REJECTED','지원하지 않는 지식 전이','DENIED');return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;
 end if;
 select*into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash);if found then return query select replay.command_status,replay.result_snapshot;return;end if;
 if p_action<>'CREATE'then if p_expected_version<>entry_record.version then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_VERSION_CONFLICT','최신 version 불일치','DENIED');return query select'VERSION_CONFLICT',null::jsonb;return;end if;if public.hotel_knowledge_personal_data_v1(jsonb_build_object('reason',p_value->>'reason'))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_REASON_REJECTED','처리 사유 민감정보 감지','DENIED');return query select'KNOWLEDGE_PERSONAL_DATA_DETECTED',null::jsonb;return;end if;end if;
 if p_action in('CREATE','UPDATE')then
  if public.hotel_knowledge_personal_data_v1(content)then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_CONTENT_REJECTED','본문 민감정보 감지','DENIED');return query select'KNOWLEDGE_PERSONAL_DATA_DETECTED',null::jsonb;return;end if;
  if content->>'riskClassification'<>'STANDARD'and(designated_reviewer is null or designated_reviewer=actor.user_id or not public.hotel_knowledge_has_permission_v1(p_company_id,designated_reviewer,scope_branch,'KNOWLEDGE_REVIEW')or not public.hotel_knowledge_has_permission_v1(p_company_id,designated_reviewer,scope_branch,'KNOWLEDGE_PUBLISH')or not public.hotel_knowledge_has_permission_v1(p_company_id,designated_reviewer,scope_branch,'KNOWLEDGE_HIGH_RISK_PUBLISH'))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_REVIEWER_REJECTED','고위험 지정 검토자 조건 불충족','DENIED');return query select'VALIDATION_ERROR',null::jsonb;return;end if;
  if not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_CREATE')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','작성 권한 없음','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;
  if p_action='UPDATE'then if entry_record.status not in('DRAFT','NEEDS_REVIEW')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_STATE_REJECTED','현재 상태에서 수정 불가','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;end if;
  if(content->>'scopeType'='COMPANY'and requested_branch is not null)or(content->>'scopeType'='HOTEL'and requested_branch is null)then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_SCOPE_REJECTED','지식 범위 조합 불일치','DENIED');return query select'VALIDATION_ERROR',null::jsonb;return;end if;
  if p_action='UPDATE'then if entry_record.scope_type<>content->>'scopeType'or entry_record.branch_id is distinct from requested_branch then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_SCOPE_REJECTED','기존 지식 범위 변경 불가','DENIED');return query select'VALIDATION_ERROR',null::jsonb;return;end if;end if;
  select count(*)into issue_count from jsonb_array_elements_text(content->'relatedIssueIds')x join public.hotel_operational_issues i on i.company_id=p_company_id and i.id=x.value::uuid where(scope_branch is null or i.branch_id=scope_branch)and exists(select 1 from public.hotel_issue_actor_v1(p_company_id,i.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER'then'HOTEL_OWNER_ISSUE_READ'else'ISSUE_READ'end));
  select count(*)into repair_count from jsonb_array_elements_text(content->'relatedRepairIds')x join public.hotel_repair_cases r on r.company_id=p_company_id and r.id=x.value::uuid where(scope_branch is null or r.branch_id=scope_branch)and exists(select 1 from public.hotel_command_actor_v1(p_company_id,r.branch_id,p_session_token,'REPAIR_READ',true));
  if issue_count<>jsonb_array_length(content->'relatedIssueIds')or repair_count<>jsonb_array_length(content->'relatedRepairIds')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_RELATED_RESOURCE_REJECTED','관련 자료 권한 또는 범위 불일치','DENIED');return query select'NOT_FOUND',null::jsonb;return;end if;
  if p_action='CREATE'then
   insert into public.hotel_knowledge_entries(id,company_id,scope_type,branch_id,title,summary,knowledge_type,risk_classification,situation,symptoms_and_context,checks,recommended_response,prohibited_or_caution_response,escalation_criteria,required_permission_or_approval,case_summary,outcome_and_lesson,tags,related_manual_refs,status,author_user_id,designated_reviewer_user_id,review_due_at)
   values(p_knowledge_id,p_company_id,content->>'scopeType',scope_branch,content->>'title',content->>'summary',content->>'knowledgeType',content->>'riskClassification',content->>'situation',content->>'symptomsAndContext',array(select jsonb_array_elements_text(content->'checks')),array(select jsonb_array_elements_text(content->'recommendedResponse')),array(select jsonb_array_elements_text(content->'prohibitedOrCautionResponse')),content->>'escalationCriteria',content->>'requiredPermissionOrApproval',content->>'caseSummary',content->>'outcomeAndLesson',array(select jsonb_array_elements_text(content->'tags')),array(select jsonb_array_elements_text(content->'relatedManualRefs')),'DRAFT',actor.user_id,designated_reviewer,(content->>'reviewDueAt')::timestamptz);
  else
   update public.hotel_knowledge_entries set scope_type=content->>'scopeType',branch_id=scope_branch,title=content->>'title',summary=content->>'summary',knowledge_type=content->>'knowledgeType',risk_classification=content->>'riskClassification',situation=content->>'situation',symptoms_and_context=content->>'symptomsAndContext',checks=array(select jsonb_array_elements_text(content->'checks')),recommended_response=array(select jsonb_array_elements_text(content->'recommendedResponse')),prohibited_or_caution_response=array(select jsonb_array_elements_text(content->'prohibitedOrCautionResponse')),escalation_criteria=content->>'escalationCriteria',required_permission_or_approval=content->>'requiredPermissionOrApproval',case_summary=content->>'caseSummary',outcome_and_lesson=content->>'outcomeAndLesson',tags=array(select jsonb_array_elements_text(content->'tags')),related_manual_refs=array(select jsonb_array_elements_text(content->'relatedManualRefs')),designated_reviewer_user_id=designated_reviewer,review_requested_version=null,version=version+1,updated_at=now_at where company_id=p_company_id and id=p_knowledge_id;
  end if;
  delete from public.hotel_knowledge_links where company_id=p_company_id and knowledge_id=p_knowledge_id;
  insert into public.hotel_knowledge_links(id,company_id,knowledge_id,link_kind,branch_id,issue_id)select gen_random_uuid(),p_company_id,p_knowledge_id,'ISSUE',i.branch_id,i.id from jsonb_array_elements_text(content->'relatedIssueIds')x join public.hotel_operational_issues i on i.company_id=p_company_id and i.id=x.value::uuid;
  insert into public.hotel_knowledge_links(id,company_id,knowledge_id,link_kind,branch_id,repair_id)select gen_random_uuid(),p_company_id,p_knowledge_id,'REPAIR',r.branch_id,r.id from jsonb_array_elements_text(content->'relatedRepairIds')x join public.hotel_repair_cases r on r.company_id=p_company_id and r.id=x.value::uuid;
 else
  if p_action='REQUEST_REVIEW'then
   if entry_record.status not in('DRAFT','NEEDS_REVIEW')or entry_record.author_user_id<>actor.user_id or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_CREATE')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_REVIEW_REQUEST_REJECTED','현재 상태 또는 작성 권한으로 검토요청 불가','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;if entry_record.risk_classification<>'STANDARD'and(entry_record.designated_reviewer_user_id is null or entry_record.designated_reviewer_user_id=actor.user_id or not public.hotel_knowledge_has_permission_v1(p_company_id,entry_record.designated_reviewer_user_id,scope_branch,'KNOWLEDGE_REVIEW')or not public.hotel_knowledge_has_permission_v1(p_company_id,entry_record.designated_reviewer_user_id,scope_branch,'KNOWLEDGE_PUBLISH')or not public.hotel_knowledge_has_permission_v1(p_company_id,entry_record.designated_reviewer_user_id,scope_branch,'KNOWLEDGE_HIGH_RISK_PUBLISH'))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_REVIEWER_REJECTED','검토요청 지정 검토자 조건 불충족','DENIED');return query select'VALIDATION_ERROR',null::jsonb;return;end if;next_status:='REVIEW_REQUESTED';
  elsif p_action in('PUBLISH','REPUBLISH')then
   if(p_action='PUBLISH'and entry_record.status<>'REVIEW_REQUESTED')or(p_action='REPUBLISH'and entry_record.status<>'NEEDS_REVIEW')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_STATE_REJECTED','현재 상태에서 게시 전이 불가','DENIED');return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;
   if entry_record.author_user_id=actor.user_id then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_SELF_PUBLISH_DENIED','작성자와 게시 검토자는 분리되어야 함','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;
   if entry_record.risk_classification<>'STANDARD'and(entry_record.designated_reviewer_user_id<>actor.user_id or entry_record.review_requested_version<>entry_record.version or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_HIGH_RISK_PUBLISH'))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_HIGH_RISK_PUBLISH_DENIED','지정 검토자 또는 검토 version 불일치','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;
   if not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_REVIEW')or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_PUBLISH')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_COMMAND_DENIED','게시 권한 재검증 실패','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;
   if public.hotel_knowledge_personal_data_v1(to_jsonb(entry_record))then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_PUBLISH_CONTENT_REJECTED','게시 시 본문 민감정보 감지','DENIED');return query select'KNOWLEDGE_PERSONAL_DATA_DETECTED',null::jsonb;return;end if;next_status:='PUBLISHED';
  elsif p_action='MARK_NEEDS_REVIEW'then
   if entry_record.status<>'PUBLISHED'or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_REVIEW')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_STATE_REJECTED','현재 상태 또는 권한으로 재검토 전환 불가','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;next_status:='NEEDS_REVIEW';
  elsif p_action='ARCHIVE'then
   if entry_record.status not in('PUBLISHED','NEEDS_REVIEW')or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,scope_branch,'KNOWLEDGE_ARCHIVE')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_STATE_REJECTED','현재 상태 또는 권한으로 보관 불가','DENIED');return query select'FORBIDDEN',null::jsonb;return;end if;next_status:='ARCHIVED';
  else perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_ACTION_REJECTED','지원하지 않는 지식 전이','DENIED');return query select'INVALID_STATE_TRANSITION',null::jsonb;return;end if;
  update public.hotel_knowledge_entries set status=next_status,reviewer_user_id=case when p_action in('PUBLISH','REPUBLISH')then actor.user_id else reviewer_user_id end,review_requested_version=case when p_action='REQUEST_REVIEW'then version+1 when p_action='MARK_NEEDS_REVIEW'then null else review_requested_version end,reviewed_at=case when p_action in('PUBLISH','REPUBLISH')then now_at else reviewed_at end,published_at=case when p_action in('PUBLISH','REPUBLISH')then coalesce(published_at,now_at)else published_at end,version=version+1,updated_at=now_at where company_id=p_company_id and id=p_knowledge_id;
 end if;
 select*into entry_record from public.hotel_knowledge_entries where company_id=p_company_id and id=p_knowledge_id;
 insert into public.hotel_knowledge_versions(id,company_id,knowledge_id,entry_version,action,status,snapshot,reason,actor_user_id)values(gen_random_uuid(),p_company_id,p_knowledge_id,entry_record.version,p_action,entry_record.status,public.hotel_knowledge_version_snapshot_v1(p_company_id,p_knowledge_id),case when p_action='CREATE'then'지식 초안 작성'else p_value->>'reason'end,actor.user_id);
 snapshot:=public.hotel_knowledge_snapshot_v1(p_company_id,p_knowledge_id,p_session_token);
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id)values(p_audit_event_id,'KNOWLEDGE_'||p_action,actor.user_id,actor.user_type,actor.session_id,p_company_id,entry_record.branch_id,'KNOWLEDGE_ENTRY',p_knowledge_id,jsonb_build_object('scopeType',entry_record.scope_type,'status',entry_record.status,'version',entry_record.version),case when p_action='CREATE'then'지식 초안 작성'else p_value->>'reason'end,'SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'KNOWLEDGE_ENTRY',p_knowledge_id,p_audit_event_id,snapshot);
 return query select case when p_action='CREATE'then'CREATED'else'UPDATED'end,snapshot;
exception when invalid_text_representation or check_violation or foreign_key_violation then if actor.user_id is not null then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_INTEGRITY_REJECTED','지식 무결성 검증 실패','DENIED');end if;return query select'VALIDATION_ERROR',null::jsonb;when unique_violation then if actor.user_id is not null then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,scope_branch,p_knowledge_id,'KNOWLEDGE_DUPLICATE_REJECTED','지식 중복 또는 멱등 충돌','DENIED');end if;return query select'IDEMPOTENCY_CONFLICT',null::jsonb;
end $function$;
revoke all on function public.hotel_knowledge_command_v1(uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

create function public.hotel_knowledge_feedback_v1(p_company_id uuid,p_knowledge_id uuid,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid)
returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record;entry_record record;replay record;snapshot jsonb;
begin
 select*into actor from public.hotel_knowledge_session_actor_v1(p_company_id,p_session_token);if not found then return query select'FORBIDDEN',null::jsonb;return;end if;
 select*into entry_record from public.hotel_knowledge_entries where company_id=p_company_id and id=p_knowledge_id for share;if not found then return query select'NOT_FOUND',null::jsonb;return;end if;if entry_record.status not in('PUBLISHED','NEEDS_REVIEW')or not public.hotel_knowledge_has_permission_v1(p_company_id,actor.user_id,entry_record.branch_id,'KNOWLEDGE_READ')then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,entry_record.branch_id,p_knowledge_id,'KNOWLEDGE_FEEDBACK_DENIED','조회 또는 평가 권한 없음','DENIED');return query select'NOT_FOUND',null::jsonb;return;end if;
 select*into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash);if found then return query select replay.command_status,replay.result_snapshot;return;end if;
 if entry_record.version<>p_expected_version then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,entry_record.branch_id,p_knowledge_id,'KNOWLEDGE_FEEDBACK_VERSION_CONFLICT','평가 version 불일치','DENIED');return query select'VERSION_CONFLICT',null::jsonb;return;end if;if public.hotel_knowledge_personal_data_v1(p_value)then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,entry_record.branch_id,p_knowledge_id,'KNOWLEDGE_FEEDBACK_REJECTED','평가 내용 민감정보 감지','DENIED');return query select'KNOWLEDGE_PERSONAL_DATA_DETECTED',null::jsonb;return;end if;
 insert into public.hotel_knowledge_feedback(id,company_id,knowledge_id,entry_version,actor_user_id,kind,comment)values(gen_random_uuid(),p_company_id,p_knowledge_id,p_expected_version,actor.user_id,p_value->>'kind',nullif(p_value->>'comment',''));
 select jsonb_build_object('helpfulCount',count(*)filter(where kind='HELPFUL'),'notHelpfulCount',count(*)filter(where kind='NOT_HELPFUL'))into snapshot from public.hotel_knowledge_feedback where company_id=p_company_id and knowledge_id=p_knowledge_id and entry_version=p_expected_version;
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id)values(p_audit_event_id,case when p_value->>'kind'='REPORT_ERROR'then'KNOWLEDGE_ERROR_REPORTED'else'KNOWLEDGE_HELPFULNESS_RECORDED'end,actor.user_id,actor.user_type,actor.session_id,p_company_id,entry_record.branch_id,'KNOWLEDGE_ENTRY',p_knowledge_id,jsonb_build_object('kind',p_value->>'kind','entryVersion',p_expected_version),'지식 평가','SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'KNOWLEDGE_ENTRY',p_knowledge_id,p_audit_event_id,snapshot);
 return query select'RECORDED',snapshot;
exception when unique_violation then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,entry_record.branch_id,p_knowledge_id,'KNOWLEDGE_FEEDBACK_DUPLICATE_REJECTED','동일 version 평가 중복','DENIED');return query select'VALIDATION_ERROR',null::jsonb;when invalid_text_representation or numeric_value_out_of_range then perform public.hotel_knowledge_failure_audit_v1(p_audit_event_id,p_trace_id,actor.user_id,actor.user_type,actor.session_id,p_company_id,entry_record.branch_id,p_knowledge_id,'KNOWLEDGE_FEEDBACK_INTEGRITY_REJECTED','평가 무결성 검증 실패','DENIED');return query select'VALIDATION_ERROR',null::jsonb;
end $function$;
revoke all on function public.hotel_knowledge_feedback_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

create function public.hotel_knowledge_reconcile_due_v1(p_limit integer)returns integer language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare candidate record;updated_entry record;processed integer:=0;trace uuid;
begin
 if not public.runtime_has_capability('RECONCILER')or p_limit is null or p_limit not between 1 and 500 then raise exception using errcode='42501',message='FORBIDDEN';end if;
 for candidate in select e.company_id,e.id from public.hotel_knowledge_entries e where e.status='PUBLISHED'and e.review_due_at<=statement_timestamp()order by e.review_due_at,e.id for update skip locked limit p_limit loop
  update public.hotel_knowledge_entries set status='NEEDS_REVIEW',review_requested_version=null,version=version+1,updated_at=statement_timestamp()where company_id=candidate.company_id and id=candidate.id and status='PUBLISHED'and review_due_at<=statement_timestamp()returning*into updated_entry;
  if found then
   trace:=gen_random_uuid();
   insert into public.hotel_knowledge_versions(id,company_id,knowledge_id,entry_version,action,status,snapshot,reason,actor_user_id)values(gen_random_uuid(),updated_entry.company_id,updated_entry.id,updated_entry.version,'AUTO_NEEDS_REVIEW','NEEDS_REVIEW',public.hotel_knowledge_version_snapshot_v1(updated_entry.company_id,updated_entry.id),'재검토 기한 만료',null);
   insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id)values(gen_random_uuid(),'KNOWLEDGE_AUTO_NEEDS_REVIEW',null,'SYSTEM',null,updated_entry.company_id,updated_entry.branch_id,'KNOWLEDGE_ENTRY',updated_entry.id,jsonb_build_object('status','NEEDS_REVIEW','version',updated_entry.version),'재검토 기한 만료','SUCCEEDED',trace);
   processed:=processed+1;
  end if;
 end loop;
 return processed;
end $function$;
revoke all on function public.hotel_knowledge_reconcile_due_v1(integer)from public;

create function public.hotel_knowledge_rls_company_guard_v1(p_row_company_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $function$
 select case when public.runtime_is_schema_owner()then true when current_user='werehere_auth_session_definer'then true when public.runtime_has_capability('API_RUNTIME')then nullif(current_setting('app.company_id',true),'')::uuid=p_row_company_id else false end
$function$;
revoke all on function public.hotel_knowledge_rls_company_guard_v1(uuid) from public;

do $rls$ declare t text;begin
 foreach t in array array['hotel_knowledge_entries','hotel_knowledge_versions','hotel_knowledge_feedback','hotel_knowledge_links']loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('create policy %I_company_isolation on public.%I using(public.hotel_knowledge_rls_company_guard_v1(company_id)) with check(public.hotel_knowledge_rls_company_guard_v1(company_id))',t,t);
 end loop;
end $rls$;

do $acl$ declare r text;begin
 for r in select role_name from public.runtime_database_capabilities where capability='API_RUNTIME'loop
  execute format('revoke all on public.hotel_knowledge_entries,public.hotel_knowledge_versions,public.hotel_knowledge_feedback,public.hotel_knowledge_links from %I',r);
  execute format('revoke all on function public.hotel_knowledge_reconcile_due_v1(integer) from %I',r);
  execute format('grant execute on function public.hotel_knowledge_capabilities_v1(uuid,text),public.hotel_knowledge_reviewer_candidates_v1(uuid,uuid,text),public.hotel_knowledge_read_v1(uuid,uuid,jsonb,text),public.hotel_knowledge_command_v1(uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid),public.hotel_knowledge_feedback_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) to %I',r);
 end loop;
 for r in select role_name from public.runtime_database_capabilities where capability='RECONCILER'loop
  execute format('revoke all on public.hotel_knowledge_entries,public.hotel_knowledge_versions,public.hotel_knowledge_feedback,public.hotel_knowledge_links from %I',r);
  execute format('grant execute on function public.hotel_knowledge_reconcile_due_v1(integer) to %I',r);
 end loop;
end $acl$;

insert into public.schema_migrations(version)values('0058_hotel_knowledge_bank')on conflict(version)do nothing;

commit;
