\set ON_ERROR_STOP on
begin;
do $test$
declare probe_table_name text; function_name text;
begin
 if not exists(select 1 from public.schema_migrations where version='0056_common_in_app_notifications') then raise exception'common notification marker missing';end if;
 if not exists(select 1 from information_schema.columns columns_record where columns_record.table_schema='public'and columns_record.table_name='hotel_issue_notification_outbox'and columns_record.column_name='read_at'and columns_record.data_type='timestamp with time zone')then raise exception'issue notification read_at missing';end if;
 if (select count(*) from pg_catalog.pg_class index_record join pg_catalog.pg_index index_catalog on index_catalog.indexrelid=index_record.oid where index_record.relname in ('hotel_inquiry_notifications_recipient_recent_idx','hotel_inquiry_notifications_recipient_unread_idx','hotel_issue_notification_outbox_recipient_recent_idx','hotel_issue_notification_outbox_recipient_unread_idx')and index_catalog.indisvalid and index_catalog.indisready)<>4 then raise exception'notification recipient indexes missing';end if;
 foreach probe_table_name in array array['hotel_inquiry_notifications','hotel_issue_notification_outbox']loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname=probe_table_name and c.relrowsecurity and c.relforcerowsecurity)then raise exception'notification RLS/FORCE missing: %',probe_table_name;end if;
 end loop;
 foreach function_name in array array['hotel_notification_actor_v1(uuid,text)','hotel_notification_read_v1(uuid,jsonb,text)','hotel_notification_command_v1(uuid,uuid,text,integer,text,uuid,text,text,text,text,uuid,uuid)']loop
  if to_regprocedure('public.'||function_name)is null then raise exception'notification function missing: %',function_name;end if;
  if not(select proconfig @> array['search_path=pg_catalog']from pg_proc where oid=to_regprocedure('public.'||function_name))then raise exception'notification search_path drift: %',function_name;end if;
  if has_function_privilege('public',to_regprocedure('public.'||function_name),'EXECUTE')then raise exception'PUBLIC notification execute leaked: %',function_name;end if;
 end loop;
end $test$;
do $issue_notification$
declare
 c uuid:='10000000-0000-0000-0000-000000000001';
 h uuid:='50000000-0000-4000-8000-000000000001';
 issue_resource_id uuid:='d9400000-0000-4000-8000-000000000001';
 internal_session uuid:='4f000000-0000-4000-8000-000000000001';
 owner_session uuid:='d9230000-0000-4000-8000-000000000001';
 internal_id uuid; notification_id uuid; r record; read_at_snapshot text; audit_before integer; idempotency_before integer;
begin
 select user_id into strict internal_id from public.auth_sessions where company_id=c and id=internal_session;
 select issue_outbox.id into strict notification_id from public.hotel_issue_notification_outbox issue_outbox
  where issue_outbox.company_id=c and issue_outbox.issue_id=issue_resource_id
    and issue_outbox.recipient_user_id=internal_id and issue_outbox.channel='IN_APP' limit 1;
 perform set_config('app.company_id',c::text,true);
 perform set_config('app.session_id',internal_session::text,true);
 select * into r from public.hotel_notification_read_v1(c,jsonb_build_object('limit',20),repeat('I',43));
 if r.command_status<>'OK' or not exists(
  select 1 from jsonb_array_elements(r.result_snapshot->'notifications') notification
   where notification->>'id'=notification_id::text and notification->>'source'='OPERATIONAL_ISSUE'
    and notification->>'href'='/hotels/'||h::text||'/issues?issueId='||issue_resource_id::text
    and (notification->>'version')::integer=0
 ) then raise exception'common operational issue notification projection missing';end if;
 select * into r from public.hotel_notification_command_v1(
  c,notification_id,'MARK_READ',0,repeat('I',43),gen_random_uuid(),'issue-common-read','POST',
  '/api/notifications/'||notification_id::text||'/read','issue-common-read-hash',gen_random_uuid(),gen_random_uuid());
 if r.command_status<>'UPDATED' or r.result_snapshot->'notification'->>'readAt'is null
 then raise exception'common operational issue notification read failed: %',r.command_status;end if;
 read_at_snapshot:=r.result_snapshot->'notification'->>'readAt';
 perform set_config('app.session_id',owner_session::text,true);
 select * into r from public.hotel_notification_command_v1(
  c,notification_id,'MARK_READ',1,repeat('O',43),gen_random_uuid(),'issue-common-cross-read','POST',
  '/api/notifications/'||notification_id::text||'/read','issue-common-cross-read-hash',gen_random_uuid(),gen_random_uuid());
 if r.command_status<>'NOT_FOUND'then raise exception'cross-recipient issue notification read accepted';end if;
 perform set_config('app.session_id',internal_session::text,true);
 select count(*) into audit_before from public.audit_events where company_id=c and resource_id=notification_id and event_code='NOTIFICATION_READ'and actor_user_id=internal_id;
 select count(*) into idempotency_before from public.idempotency_records where company_id=c and actor_user_id=internal_id and resource_id=notification_id and resource_type='IN_APP_NOTIFICATION';
 select * into r from public.hotel_notification_command_v1(
  c,notification_id,'MARK_READ',1,repeat('I',43),gen_random_uuid(),'issue-common-fresh-noop','POST',
  '/api/notifications/'||notification_id::text||'/read','issue-common-fresh-noop-hash',gen_random_uuid(),gen_random_uuid());
 if r.command_status<>'UPDATED' or r.result_snapshot->'notification'->>'readAt'<>read_at_snapshot
 then raise exception'common operational issue no-op snapshot changed';end if;
 if (select count(*) from public.audit_events where company_id=c and resource_id=notification_id and event_code='NOTIFICATION_READ'and actor_user_id=internal_id)<>audit_before
  or (select count(*) from public.idempotency_records where company_id=c and actor_user_id=internal_id and resource_id=notification_id and resource_type='IN_APP_NOTIFICATION')<>idempotency_before
 then raise exception'common operational issue no-op wrote audit or idempotency';end if;
 select * into r from public.hotel_notification_read_v1(c,jsonb_build_object('limit',20),repeat('I',43));
 if not exists(
  select 1 from jsonb_array_elements(r.result_snapshot->'notifications') notification
   where notification->>'id'=notification_id::text and(notification->>'version')::integer=1 and notification->>'readAt'is not null
 ) or not exists(
  select 1 from public.audit_events where company_id=c and resource_id=notification_id and event_code='NOTIFICATION_READ'and actor_user_id=internal_id
 ) then raise exception'common operational issue notification read-back or audit missing';end if;
end $issue_notification$;
rollback;
select 'COMMON_IN_APP_NOTIFICATIONS_INTEGRATION_OK';
