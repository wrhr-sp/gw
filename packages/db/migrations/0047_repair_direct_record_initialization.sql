begin;

-- CREATE_DIRECT must be valid as the first invocation in a backend. Generic
-- PL/pgSQL record fields have no tuple descriptor until SELECT INTO runs, so
-- inspection-only fields use typed scalars that remain NULL for direct repairs.
create or replace function public.hotel_repair_case_command_v1(p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_trace_id uuid,p_audit_event_id uuid) returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; replay record; priority public.hotel_repair_priorities%rowtype; process_default record; process_revision record; inspection_source_target_type text; inspection_source_room_id uuid; inspection_source_facility_id uuid; inspection_source_room_number_snapshot text; inspection_source_facility_name_snapshot text; inspection_source_facility_type_name_snapshot text; inspection_source_facility_location_name_snapshot text; inspection_source_result_id uuid; inspection_source_result_version integer; inspection_source_description text; inspection_source_file_version_ids uuid[]; target_name text; facility_type_name text; location_name text; process_id uuid:=gen_random_uuid(); source_type text:=p_value#>>'{source,type}'; target_type text:=p_value#>>'{target,type}'; case_row public.hotel_repair_cases%rowtype; parent public.hotel_repair_cases%rowtype; file_count int; now_at timestamptz:=statement_timestamp(); snapshot jsonb;
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
     into inspection_source_target_type,inspection_source_room_id,inspection_source_facility_id,
         inspection_source_room_number_snapshot,inspection_source_facility_name_snapshot,
         inspection_source_facility_type_name_snapshot,inspection_source_facility_location_name_snapshot,
         inspection_source_result_id,inspection_source_result_version,
         inspection_source_description,inspection_source_file_version_ids
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
      or target_type<>inspection_source_target_type
      or nullif(p_value#>>'{target,roomId}','')::uuid is distinct from inspection_source_room_id
      or nullif(p_value#>>'{target,facilityId}','')::uuid is distinct from inspection_source_facility_id
      or p_value#>>'{target,commonAreaId}' is not null
   then return query select 'NOT_FOUND',null::jsonb; return; end if;
   target_name:=case inspection_source_target_type when 'ROOM' then inspection_source_room_number_snapshot else inspection_source_facility_name_snapshot end;
   facility_type_name:=inspection_source_facility_type_name_snapshot;
   location_name:=inspection_source_facility_location_name_snapshot;
  elsif target_type='ROOM' then select room.room_number into target_name from public.hotel_rooms room where room.company_id=p_company_id and room.branch_id=p_branch_id and room.id=(p_value#>>'{target,roomId}')::uuid and room.status='ACTIVE' for share;
  elsif target_type='COMMON_AREA' then select area.name into target_name from public.hotel_common_areas area where area.company_id=p_company_id and area.branch_id=p_branch_id and area.id=(p_value#>>'{target,commonAreaId}')::uuid and area.status='ACTIVE' for share;
  elsif target_type='FACILITY' then select facility.name,ft.name,case when facility.location_type='ROOM' then room.room_number else area.name end into target_name,facility_type_name,location_name from public.hotel_facilities facility join public.hotel_facility_types ft on ft.company_id=facility.company_id and ft.branch_id=facility.branch_id and ft.id=facility.facility_type_id left join public.hotel_rooms room on room.company_id=facility.company_id and room.branch_id=facility.branch_id and room.id=facility.room_id left join public.hotel_common_areas area on area.company_id=facility.company_id and area.branch_id=facility.branch_id and area.id=facility.common_area_id where facility.company_id=p_company_id and facility.branch_id=p_branch_id and facility.id=(p_value#>>'{target,facilityId}')::uuid and facility.status='ACTIVE' for share of facility,ft,room,area; end if;
  if target_name is null then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if p_action='CREATE_FOLLOW_UP' then select * into parent from public.hotel_repair_cases where company_id=p_company_id and branch_id=p_branch_id and id=(p_value->>'followUpOfRepairCaseId')::uuid for update; if not found or parent.version<>(p_value->>'followUpParentVersion')::int or parent.status<>'COMPLETED' then return query select 'REPAIR_FOLLOW_UP_INVALID',null::jsonb; return; end if; end if;
  select d.definition_id,d.revision_id into process_default from public.hotel_process_defaults d where d.company_id=p_company_id and d.branch_id=p_branch_id and d.application_type='REPAIR_CASE'; if not found then return query select 'PROCESS_DEFAULT_REQUIRED',null::jsonb; return; end if;
  select r.start_stage_key,s.stage_name,s.reviewer_user_id,s.delegate_user_id,case when s.due_unit='HOURS' then now_at+make_interval(hours=>s.due_amount) when s.due_unit='DAYS' then now_at+make_interval(days=>s.due_amount) end due_at into process_revision from public.process_definition_revisions r join public.process_stage_snapshots s on s.company_id=r.company_id and s.revision_id=r.id and s.stage_key=r.start_stage_key where r.company_id=p_company_id and r.id=process_default.revision_id;
  insert into public.process_executions(id,company_id,branch_id,application_type,resource_id,definition_id,revision_id,state,current_stage_key,current_stage_name,current_reviewer_user_id,current_delegate_user_id,current_due_at,version,started_at,created_by) values(process_id,p_company_id,p_branch_id,'REPAIR_CASE',p_resource_id,process_default.definition_id,process_default.revision_id,'PENDING_INPUT',null,null,null,null,null,1,null,actor.user_id);
  insert into public.hotel_repair_cases(id,company_id,branch_id,source_type,target_type,room_id,common_area_id,facility_id,target_name_snapshot,facility_type_name_snapshot,location_name_snapshot,inspection_id,inspection_execution_target_id,inspection_item_snapshot_id,inspection_result_id,inspection_result_version,defect_description,defect_file_version_ids,defect_unavailable_reason,priority_id,priority_version_snapshot,priority_name_snapshot,priority_sort_order_snapshot,priority_color_snapshot,process_execution_id,follow_up_of_repair_case_id,created_by) values(p_resource_id,p_company_id,p_branch_id,source_type,target_type,nullif(p_value#>>'{target,roomId}','')::uuid,nullif(p_value#>>'{target,commonAreaId}','')::uuid,nullif(p_value#>>'{target,facilityId}','')::uuid,target_name,facility_type_name,location_name,case when p_action='CREATE_INSPECTION' then (p_value#>>'{source,inspectionId}')::uuid end,case when p_action='CREATE_INSPECTION' then (p_value#>>'{source,executionTargetId}')::uuid end,case when p_action='CREATE_INSPECTION' then (p_value#>>'{source,itemSnapshotId}')::uuid end,case when p_action='CREATE_INSPECTION' then inspection_source_result_id end,case when p_action='CREATE_INSPECTION' then inspection_source_result_version end,case when p_action='CREATE_INSPECTION' then inspection_source_description else p_value#>>'{source,description}' end,case when p_action='CREATE_INSPECTION' then inspection_source_file_version_ids else coalesce(array(select jsonb_array_elements_text(p_value#>'{source,fileVersionIds}'))::uuid[],'{}') end,case when p_action='CREATE_INSPECTION' then null else nullif(p_value#>>'{source,unavailableReason}','') end,priority.id,priority.version,priority.name,priority.sort_order,priority.color,process_id,nullif(p_value->>'followUpOfRepairCaseId','')::uuid,actor.user_id) returning * into case_row;
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

insert into public.schema_migrations(version)
values ('0047_repair_direct_record_initialization')
on conflict (version) do nothing;

commit;
