-- Common in-app notification read model over existing inquiry and operational-issue authorities.
-- Domain transactions remain the notification producers; this migration only unifies recipient reads.

begin;

alter table public.hotel_issue_notification_outbox add column read_at timestamptz;
revoke all on public.hotel_inquiry_notifications,public.hotel_issue_notification_outbox from public;
create function public.hotel_notification_actor_v1(p_company_id uuid,p_session_token text)
returns table(session_id uuid,user_id uuid,user_type text,display_name text)
language sql stable security definer set search_path=pg_catalog as $function$
 select s.id,u.id,u.user_type,u.display_name
 from public.auth_sessions s
 join public.users u on u.company_id=s.company_id and u.id=s.user_id
 join public.companies c on c.id=s.company_id
 where public.runtime_has_capability('API_RUNTIME')
   and p_session_token~'^[A-Za-z0-9_-]{43}$'
   and s.id=nullif(current_setting('app.session_id',true),'')::uuid
   and s.company_id=p_company_id
   and s.token_hash=sha256(convert_to(p_session_token,'UTF8'))
   and s.revoked_at is null
   and s.idle_expires_at>statement_timestamp()
   and s.absolute_expires_at>statement_timestamp()
   and u.status='ACTIVE'
   and c.status='ACTIVE'
$function$;
revoke all on function public.hotel_notification_actor_v1(uuid,text) from public;

create function public.hotel_notification_read_v1(p_company_id uuid,p_query jsonb,p_session_token text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; page_size integer:=least(greatest(coalesce((p_query->>'limit')::integer,20),1),100);
begin
 select * into actor from public.hotel_notification_actor_v1(p_company_id,p_session_token);
 if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 return query
 with visible as (
  select n.id,'INQUIRY'::text source,n.branch_id hotel_id,q.id resource_id,
   left(q.title||' · '||case n.event_code when 'HOTEL_INQUIRY_CREATE' then '문의가 접수되었습니다' when 'HOTEL_INQUIRY_ASSIGN' then '담당자가 배정되었습니다' when 'HOTEL_INQUIRY_ADD_PUBLIC_MESSAGE' then '답변이 등록되었습니다' when 'HOTEL_INQUIRY_REQUEST_SUPPLEMENT' then '보완 요청이 등록되었습니다' when 'HOTEL_INQUIRY_AUTO_CLOSE' then '문의가 자동 종료되었습니다' when 'HOTEL_INQUIRY_REOPEN' then '문의가 재개되었습니다' else '문의 상태가 변경되었습니다' end,240) title,
   n.event_code,n.created_at,n.read_at,
   format('/hotels/%s/inquiries?inquiryId=%s',n.branch_id,q.id) href
  from public.hotel_inquiry_notifications n
  join public.hotel_inquiries q on q.company_id=n.company_id and q.branch_id=n.branch_id and q.id=n.inquiry_id
  where n.company_id=p_company_id and n.recipient_user_id=actor.user_id
   and exists(select 1 from public.hotel_inquiry_actor_v1(p_company_id,n.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER' then 'HOTEL_OWNER_INQUIRY_READ' else 'HOTEL_INQUIRY_READ' end))
   and (actor.user_type<>'HOTEL_OWNER' or public.hotel_inquiry_owner_can_read_v1(p_company_id,n.branch_id,n.inquiry_id,actor.user_id))
  union all
  select n.id,'OPERATIONAL_ISSUE',n.branch_id,i.id,
   left('긴급 운영이슈 · '||i.title,240),n.event_code,n.created_at,n.read_at,
   format('/hotels/%s/issues?issueId=%s',n.branch_id,i.id)
  from public.hotel_issue_notification_outbox n
  join public.hotel_operational_issues i on i.company_id=n.company_id and i.branch_id=n.branch_id and i.id=n.issue_id
  where n.company_id=p_company_id and n.recipient_user_id=actor.user_id and n.channel='IN_APP'
   and exists(select 1 from public.hotel_issue_actor_v1(p_company_id,n.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER' then 'HOTEL_OWNER_ISSUE_READ' else 'HOTEL_ISSUE_READ' end))
 ), page as (select * from visible order by created_at desc,id limit page_size)
 select 'OK',jsonb_build_object(
  'notifications',coalesce((select jsonb_agg(jsonb_build_object(
   'id',id,'source',source,'hotelId',hotel_id,'title',title,'eventCode',event_code,'href',href,
   'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'readAt',case when read_at is null then null else to_jsonb(to_char(read_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end,
   'version',case when read_at is null then 0 else 1 end) order by created_at desc,id) from page),'[]'::jsonb),
  'unreadCount',(select count(*) from visible where read_at is null));
exception when invalid_text_representation then return query select 'VALIDATION_ERROR',null::jsonb;
end $function$;
revoke all on function public.hotel_notification_read_v1(uuid,jsonb,text) from public;

create function public.hotel_notification_command_v1(
 p_company_id uuid,p_notification_id uuid,p_action text,p_expected_version integer,p_session_token text,
 p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_audit_event_id uuid,p_trace_id uuid
) returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; source_type text; hotel_id uuid; resource_id uuid; event_name text; title_text text; created_at_value timestamptz; read_at_value timestamptz; current_version integer; snapshot jsonb;
begin
 if p_action<>'MARK_READ' or p_http_method<>'POST' then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 select * into actor from public.hotel_notification_actor_v1(p_company_id,p_session_token);
 if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select 'INQUIRY',n.branch_id,n.inquiry_id,n.event_code,left(q.title||' · '||case n.event_code when 'HOTEL_INQUIRY_CREATE' then '문의가 접수되었습니다' when 'HOTEL_INQUIRY_ASSIGN' then '담당자가 배정되었습니다' when 'HOTEL_INQUIRY_ADD_PUBLIC_MESSAGE' then '답변이 등록되었습니다' when 'HOTEL_INQUIRY_REQUEST_SUPPLEMENT' then '보완 요청이 등록되었습니다' when 'HOTEL_INQUIRY_AUTO_CLOSE' then '문의가 자동 종료되었습니다' when 'HOTEL_INQUIRY_REOPEN' then '문의가 재개되었습니다' else '문의 상태가 변경되었습니다' end,240),n.created_at,n.read_at
 into source_type,hotel_id,resource_id,event_name,title_text,created_at_value,read_at_value
 from public.hotel_inquiry_notifications n join public.hotel_inquiries q on q.company_id=n.company_id and q.branch_id=n.branch_id and q.id=n.inquiry_id
 where n.company_id=p_company_id and n.id=p_notification_id and n.recipient_user_id=actor.user_id
  and exists(select 1 from public.hotel_inquiry_actor_v1(p_company_id,n.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER' then 'HOTEL_OWNER_INQUIRY_READ' else 'HOTEL_INQUIRY_READ' end))
  and (actor.user_type<>'HOTEL_OWNER' or public.hotel_inquiry_owner_can_read_v1(p_company_id,n.branch_id,n.inquiry_id,actor.user_id))
 for update of n;
 if not found then
  select 'OPERATIONAL_ISSUE',n.branch_id,n.issue_id,n.event_code,left('긴급 운영이슈 · '||i.title,240),n.created_at,n.read_at
  into source_type,hotel_id,resource_id,event_name,title_text,created_at_value,read_at_value
  from public.hotel_issue_notification_outbox n join public.hotel_operational_issues i on i.company_id=n.company_id and i.branch_id=n.branch_id and i.id=n.issue_id
  where n.company_id=p_company_id and n.id=p_notification_id and n.recipient_user_id=actor.user_id and n.channel='IN_APP'
   and exists(select 1 from public.hotel_issue_actor_v1(p_company_id,n.branch_id,p_session_token,case when actor.user_type='HOTEL_OWNER' then 'HOTEL_OWNER_ISSUE_READ' else 'HOTEL_ISSUE_READ' end))
  for update of n;
 end if;
 if source_type is null then return query select 'NOT_FOUND',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash);
 if found then return query select replay.command_status,replay.result_snapshot; return; end if;
 current_version:=case when read_at_value is null then 0 else 1 end;
 if p_expected_version<>current_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
 if read_at_value is not null then
  snapshot:=jsonb_build_object('notification',jsonb_build_object('id',p_notification_id,'source',source_type,'hotelId',hotel_id,'title',title_text,'eventCode',event_name,
   'href',case when source_type='INQUIRY' then format('/hotels/%s/inquiries?inquiryId=%s',hotel_id,resource_id) else format('/hotels/%s/issues?issueId=%s',hotel_id,resource_id) end,
   'createdAt',to_char(created_at_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'readAt',to_char(read_at_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'version',1));
  return query select 'UPDATED',snapshot; return;
 end if;
 if source_type='INQUIRY' then update public.hotel_inquiry_notifications set read_at=coalesce(read_at,statement_timestamp()) where company_id=p_company_id and id=p_notification_id returning read_at into read_at_value;
 else update public.hotel_issue_notification_outbox set read_at=coalesce(read_at,statement_timestamp()) where company_id=p_company_id and id=p_notification_id returning read_at into read_at_value; end if;
 snapshot:=jsonb_build_object('notification',jsonb_build_object('id',p_notification_id,'source',source_type,'hotelId',hotel_id,'title',title_text,'eventCode',event_name,
  'href',case when source_type='INQUIRY' then format('/hotels/%s/inquiries?inquiryId=%s',hotel_id,resource_id) else format('/hotels/%s/issues?issueId=%s',hotel_id,resource_id) end,
  'createdAt',to_char(created_at_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'readAt',to_char(read_at_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'version',1));
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id)
 values(p_audit_event_id,'NOTIFICATION_READ',actor.user_id,actor.user_type,actor.session_id,p_company_id,hotel_id,'IN_APP_NOTIFICATION',p_notification_id,jsonb_build_object('source',source_type,'eventCode',event_name),'인앱 알림 읽음','SUCCEEDED',p_trace_id);
 perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'IN_APP_NOTIFICATION',p_notification_id,p_audit_event_id,snapshot);
 return query select 'UPDATED',snapshot;
exception when unique_violation then return query select 'IDEMPOTENCY_CONFLICT',null::jsonb;
end $function$;
revoke all on function public.hotel_notification_command_v1(uuid,uuid,text,integer,text,uuid,text,text,text,text,uuid,uuid) from public;

insert into public.schema_migrations(version) values('0056_common_in_app_notifications') on conflict(version) do nothing;

commit;
