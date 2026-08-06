\set ON_ERROR_STOP on

do $facility_execution$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_token text := repeat('I',43);
  v_actor uuid;
  v_facility_type uuid := '7ab00000-0000-4000-8000-000000000001';
  v_room uuid := 'fa300000-0000-4000-8000-000000000001';
  v_room_type uuid;
  v_facility uuid := 'fa400000-0000-4000-8000-000000000001';
  v_inactive_facility uuid := 'fa400000-0000-4000-8000-000000000002';
  v_source_item uuid;
  v_inspection uuid := 'fa500000-0000-4000-8000-000000000001';
  v_process_execution uuid := 'fa600000-0000-4000-8000-000000000001';
  v_item_snapshot uuid;
  v_result record;
  v_snapshot jsonb;
  v_before_count integer;
  v_routine uuid := 'fa700000-0000-4000-8000-000000000001';
  v_routine_value jsonb;
  v_claim record;
  v_complete record;
begin
  perform set_config('app.session_id',v_session::text,true);
  select session_record.user_id into strict v_actor
    from public.auth_sessions session_record
   where session_record.company_id=v_company and session_record.id=v_session;
  select room_type.id into strict v_room_type
    from public.hotel_room_types room_type
   where room_type.company_id=v_company and room_type.is_active
   order by room_type.id limit 1;
  insert into public.hotel_rooms(
    id,company_id,branch_id,room_number,floor_label,floor_sort_key,
    room_type_id,status,created_by,updated_by
  ) values (
    v_room,v_company,v_hotel,'FACILITY-EXEC-9001','시설점검 통합',901,
    v_room_type,'ACTIVE',v_actor,v_actor
  );
  if not exists(
    select 1 from public.hotel_facility_types facility_type
     where facility_type.company_id=v_company and facility_type.branch_id=v_hotel
       and facility_type.id=v_facility_type and facility_type.status='ACTIVE'
  ) then raise exception 'facility checklist type fixture is missing'; end if;

  insert into public.hotel_facilities(
    id,company_id,branch_id,facility_type_id,name,location_type,
    room_id,status,created_by,updated_by
  ) values
    (v_facility,v_company,v_hotel,v_facility_type,'시설물 실행 통합','ROOM',v_room,'ACTIVE',v_actor,v_actor),
    (v_inactive_facility,v_company,v_hotel,v_facility_type,'비활성 시설물 실행 통합','ROOM',v_room,'INACTIVE',v_actor,v_actor);

  select item.source_item_id into strict v_source_item
    from public.inspection_checklist_v2_items item
    join public.inspection_checklist_v2_revisions revision
      on revision.company_id=item.company_id and revision.id=item.revision_id
   where revision.company_id=v_company and revision.branch_id=v_hotel
     and item.target_type='FACILITY' and item.facility_type_id=v_facility_type
   order by revision.version desc,item.display_order,item.id limit 1;

  select * into v_result from public.hotel_inspection_command_v3(
    v_company,v_hotel,v_inspection,'CREATE_MANUAL_V2',0,
    pg_catalog.jsonb_build_object(
      'processDefinitionId',null,'processExecutionId',v_process_execution,
      'reason','시설물 수시점검 실제 통합',
      'targets',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'type','FACILITY','facilityId',v_facility,
        'selectedItemIds',pg_catalog.jsonb_build_array(v_source_item)
      ))
    ),v_token,'fa800000-0000-4000-8000-000000000001',
    'facility-manual-create','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/v2/manual',
    'facility-manual-hash','fa900000-0000-4000-8000-000000000001',
    'faa00000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'CREATED'
     or v_result.result_snapshot #>> '{targets,0,type}'<>'FACILITY'
     or v_result.result_snapshot #>> '{targets,0,facilityId}'<>v_facility::text
     or v_result.result_snapshot #>> '{targets,0,facilityNameSnapshot}'<>'시설물 실행 통합'
     or pg_catalog.jsonb_array_length(v_result.result_snapshot->'items')<>1
  then raise exception 'facility manual create mismatch: % %',v_result.command_status,v_result.result_snapshot; end if;

  select pg_catalog.count(*) into v_before_count
    from public.hotel_inspections inspection
   where inspection.company_id=v_company and inspection.id=v_inspection;
  select * into v_result from public.hotel_inspection_command_v3(
    v_company,v_hotel,v_inspection,'CREATE_MANUAL_V2',0,
    pg_catalog.jsonb_build_object(
      'processDefinitionId',null,'processExecutionId',v_process_execution,
      'reason','시설물 수시점검 실제 통합',
      'targets',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'type','FACILITY','facilityId',v_facility,
        'selectedItemIds',pg_catalog.jsonb_build_array(v_source_item)
      ))
    ),v_token,'fab00000-0000-4000-8000-000000000001',
    'facility-manual-create','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/v2/manual',
    'facility-manual-hash','fac00000-0000-4000-8000-000000000001',
    'fad00000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'REPLAYED'
     or (select pg_catalog.count(*) from public.hotel_inspections inspection where inspection.company_id=v_company and inspection.id=v_inspection)<>v_before_count
  then raise exception 'facility manual replay mismatch: %',v_result.command_status; end if;

  select item.id into strict v_item_snapshot
    from public.inspection_item_snapshots item
   where item.company_id=v_company and item.inspection_id=v_inspection
     and item.facility_id=v_facility and item.source_item_id=v_source_item;
  select * into v_result from public.hotel_inspection_command_v3(
    v_company,v_hotel,v_inspection,'SAVE_RESULT',0,
    pg_catalog.jsonb_build_object(
      'itemSnapshotId',v_item_snapshot,
      'resultId','fae00000-0000-4000-8000-000000000001',
      'historyId','faf00000-0000-4000-8000-000000000001',
      'result','NORMAL','description',null,'severity',null,
      'fileVersionIds','[]'::jsonb
    ),v_token,'fb000000-0000-4000-8000-000000000001',
    'facility-result-save','PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/fa500000-0000-4000-8000-000000000001/items/fa000000-0000-4000-8000-000000000000/result',
    'facility-result-hash','fb100000-0000-4000-8000-000000000001',
    'fb200000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'CREATED'
     or v_result.result_snapshot #>> '{items,0,result,result}'<>'NORMAL'
     or v_result.result_snapshot #>> '{items,0,targetType}'<>'FACILITY'
  then raise exception 'facility result save mismatch: % %',v_result.command_status,v_result.result_snapshot; end if;

  select * into v_result from public.hotel_inspection_command_v3(
    v_company,v_hotel,'fb300000-0000-4000-8000-000000000001','CREATE_MANUAL_V2',0,
    pg_catalog.jsonb_build_object(
      'processDefinitionId',null,'processExecutionId','fb400000-0000-4000-8000-000000000001',
      'reason','비활성 시설물 차단',
      'targets',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'type','FACILITY','facilityId',v_inactive_facility,
        'selectedItemIds',pg_catalog.jsonb_build_array(v_source_item)
      ))
    ),v_token,'fb500000-0000-4000-8000-000000000001',
    'inactive-facility-create','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/v2/manual',
    'inactive-facility-hash','fb600000-0000-4000-8000-000000000001',
    'fb700000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'INVALID_TARGET'
     or exists(select 1 from public.hotel_inspections where company_id=v_company and id='fb300000-0000-4000-8000-000000000001')
  then raise exception 'inactive facility was accepted: %',v_result.command_status; end if;

  select * into v_result from public.hotel_inspection_command_v3(
    v_company,v_hotel,'fc000000-0000-4000-8000-000000000001','CREATE_MANUAL_V2',0,
    pg_catalog.jsonb_build_object(
      'processDefinitionId',null,'processExecutionId','fc100000-0000-4000-8000-000000000001',
      'reason','빈 항목 차단',
      'targets',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'type','FACILITY','facilityId',v_facility,'selectedItemIds','[]'::jsonb
      ))
    ),v_token,'fc200000-0000-4000-8000-000000000001',
    'empty-items-create','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/v2/manual',
    'empty-items-hash','fc300000-0000-4000-8000-000000000001',
    'fc400000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'INVALID_TARGET'
     or exists(select 1 from public.hotel_inspections where company_id=v_company and id='fc000000-0000-4000-8000-000000000001')
  then raise exception 'empty selected items were accepted: %',v_result.command_status; end if;

  update public.idempotency_records
     set created_at=pg_catalog.statement_timestamp()-interval '2 days',
         completed_at=pg_catalog.statement_timestamp()-interval '2 days',
         expires_at=pg_catalog.statement_timestamp()-interval '1 day'
   where company_id=v_company and actor_user_id=v_actor
     and idempotency_key='facility-manual-create' and http_method='POST';
  select * into v_result from public.hotel_inspection_command_v3(
    v_company,v_hotel,'fc500000-0000-4000-8000-000000000001','CREATE_MANUAL_V2',0,
    pg_catalog.jsonb_build_object(
      'processDefinitionId',null,'processExecutionId','fc600000-0000-4000-8000-000000000001',
      'reason','시설물 수시점검 실제 통합',
      'targets',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'type','FACILITY','facilityId',v_facility,
        'selectedItemIds',pg_catalog.jsonb_build_array(v_source_item)
      ))
    ),v_token,'fc700000-0000-4000-8000-000000000001',
    'facility-manual-create','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/v2/manual',
    'facility-manual-hash','fc800000-0000-4000-8000-000000000001',
    'fc900000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'CREATED'
     or v_result.result_snapshot->>'id'<>'fc500000-0000-4000-8000-000000000001'
  then raise exception 'expired idempotency receipt was not replaced: % %',v_result.command_status,v_result.result_snapshot; end if;

  insert into public.process_executions(
    id,company_id,branch_id,application_type,resource_id,
    definition_id,revision_id,state,created_by
  )
  select 'fe100000-0000-4000-8000-000000000001',v_company,v_hotel,
    'ROOM_INSPECTION','fe000000-0000-4000-8000-000000000001',
    definition.id,definition.current_revision_id,'PENDING_INPUT',v_actor
    from public.hotel_process_defaults default_record
    join public.process_definitions definition
      on definition.company_id=default_record.company_id
     and definition.id=default_record.definition_id
   where default_record.company_id=v_company and default_record.branch_id=v_hotel
     and default_record.application_type='ROOM_INSPECTION';
  insert into public.hotel_inspections(
    id,company_id,branch_id,source,business_date,due_at,status,
    process_execution_id,created_by
  ) values(
    'fe000000-0000-4000-8000-000000000001',v_company,v_hotel,'MANUAL',
    (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    pg_catalog.statement_timestamp()+interval '1 hour','PENDING_INPUT',
    'fe100000-0000-4000-8000-000000000001',v_actor
  );
  insert into public.inspection_execution_targets(
    id,company_id,branch_id,execution_id,target_type,facility_id,
    facility_name_snapshot,facility_type_id_snapshot,facility_type_name_snapshot,
    facility_location_type_snapshot,facility_location_room_id_snapshot,
    facility_location_name_snapshot
  )
  select 'fe200000-0000-4000-8000-000000000001',v_company,v_hotel,
    'fe000000-0000-4000-8000-000000000001','FACILITY',facility.id,
    facility.name,facility_type.id,facility_type.name,facility.location_type,
    facility.room_id,room.room_number
    from public.hotel_facilities facility
    join public.hotel_facility_types facility_type
      on facility_type.company_id=facility.company_id
     and facility_type.branch_id=facility.branch_id
     and facility_type.id=facility.facility_type_id
    join public.hotel_rooms room
      on room.company_id=facility.company_id and room.branch_id=facility.branch_id
     and room.id=facility.room_id
   where facility.company_id=v_company and facility.branch_id=v_hotel
     and facility.id=v_facility;
  select * into v_result from public.hotel_inspection_command_v3(
    v_company,v_hotel,'fe000000-0000-4000-8000-000000000001','SUBMIT',1,
    pg_catalog.jsonb_build_object('historyId','fe300000-0000-4000-8000-000000000001','reason','빈 제출 차단'),
    v_token,'fe400000-0000-4000-8000-000000000001','empty-submit','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/v2/fe000000-0000-4000-8000-000000000001/submit',
    'empty-submit-hash','fe500000-0000-4000-8000-000000000001',
    'fe600000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'INSPECTION_CHECKLIST_EMPTY'
     or (select status from public.hotel_inspections where company_id=v_company and id='fe000000-0000-4000-8000-000000000001')<>'PENDING_INPUT'
  then raise exception 'empty inspection submission was accepted: %',v_result.command_status; end if;

  v_routine_value:=pg_catalog.jsonb_build_object(
    'name','시설물 정기점검 실제 통합','status','ACTIVE','mode','FIXED',
    'recurrence',pg_catalog.jsonb_build_object('type','DAILY'),
    'startDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'endDate',null,'localDueTime','23:30','processDefinitionId',null,
    'rounds',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'order',1,'target',pg_catalog.jsonb_build_object(
        'type','FACILITIES','facilityIds',pg_catalog.jsonb_build_array(v_facility)
      )
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v2(
    v_company,v_hotel,v_routine,0,v_routine_value,v_token,
    'facility-routine-create','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/v2',
    'facility-routine-hash','fb800000-0000-4000-8000-000000000001',
    'fb900000-0000-4000-8000-000000000001','fba00000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'OK'
     or v_result.result_snapshot #>> '{revision,rounds,0,target,type}'<>'FACILITIES'
  then raise exception 'facility routine create mismatch: % %',v_result.command_status,v_result.result_snapshot; end if;

  update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user;
  perform set_config('app.reconciler_company_id',v_company::text,true);
  select * into v_claim from public.hotel_inspection_claim_next_materialization_v2(
    pg_catalog.sha256(pg_catalog.convert_to(repeat('F',43),'UTF8')),60
  );
  if v_claim.result_status<>'CLAIMED'
     or v_claim.company_id<>v_company or v_claim.routine_id<>v_routine
  then raise exception 'facility routine claim failed: % % %',v_claim.result_status,v_claim.company_id,v_claim.routine_id; end if;
  select * into v_complete from public.hotel_inspection_complete_materialization_v2(
    v_routine,v_claim.claim_generation,
    pg_catalog.sha256(pg_catalog.convert_to(repeat('F',43),'UTF8')),
    'fbb00000-0000-4000-8000-000000000001'
  );
  perform set_config('app.reconciler_company_id','',true);
  update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user;
  if v_complete.result_status<>'COMPLETED' or v_complete.created_count<>1
     or not exists(
       select 1 from public.hotel_inspections inspection
       join public.inspection_execution_targets target on target.company_id=inspection.company_id and target.execution_id=inspection.id
       join public.inspection_item_snapshots item on item.company_id=inspection.company_id and item.inspection_id=inspection.id and item.execution_target_id=target.id
       where inspection.company_id=v_company and inspection.routine_id=v_routine
         and target.target_type='FACILITY' and target.facility_id=v_facility
         and item.facility_id=v_facility and item.source_item_id=v_source_item
     )
  then raise exception 'facility routine materialization mismatch: % %',v_complete.result_status,v_complete.created_count; end if;

  v_routine:='fce00000-0000-4000-8000-000000000001';
  select * into v_result from public.hotel_inspection_routine_command_v2(
    v_company,v_hotel,v_routine,0,v_routine_value,v_token,
    'claim-invalidation-create','POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/v2',
    'claim-invalidation-create-hash','fce10000-0000-4000-8000-000000000001',
    'fce20000-0000-4000-8000-000000000001','fce30000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'OK' then raise exception 'claim invalidation routine create failed: %',v_result.command_status; end if;
  update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user;
  perform set_config('app.reconciler_company_id',v_company::text,true);
  select * into v_complete from public.hotel_inspection_complete_materialization_v2(
    v_routine,0,pg_catalog.sha256(pg_catalog.convert_to(repeat('H',43),'UTF8')),
    'fce70000-0000-4000-8000-000000000002'
  );
  if v_complete.result_status<>'STALE_CLAIM'
     or exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine)
  then raise exception 'unclaimed completion was accepted: %',v_complete.result_status; end if;
  select * into v_claim from public.hotel_inspection_claim_materialization_v1(
    v_routine,pg_catalog.sha256(pg_catalog.convert_to(repeat('G',43),'UTF8')),60
  );
  select * into v_complete from public.hotel_inspection_complete_materialization_v2(
    v_routine,null,null,'fce71000-0000-4000-8000-000000000001'
  );
  if v_complete.result_status<>'FORBIDDEN'
     or exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine)
  then raise exception 'null claim fence was bypassed: %',v_complete.result_status; end if;
  perform set_config('app.reconciler_company_id','',true);
  update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user;
  if v_claim.result_status<>'CLAIMED' then raise exception 'claim invalidation claim failed: %',v_claim.result_status; end if;
  v_routine_value:=pg_catalog.jsonb_build_object(
    'name','legacy v1 claim 무효화','status','ACTIVE','mode','FIXED',
    'recurrence',pg_catalog.jsonb_build_object('type','DAILY'),
    'startDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'endDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'localDueTime','23:30','processDefinitionId',null,
    'rounds',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'order',1,'target',pg_catalog.jsonb_build_object(
        'type','ROOMS','roomIds',pg_catalog.jsonb_build_array(v_room)
      )
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company,v_hotel,v_routine,1,v_routine_value,v_token,
    'claim-invalidation-v1-update','PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/fce00000-0000-4000-8000-000000000001',
    'claim-invalidation-v1-update-hash','fce40000-0000-4000-8000-000000000001',
    'fce50000-0000-4000-8000-000000000001','fce60000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'OK' then raise exception 'legacy claim invalidation update failed: %',v_result.command_status; end if;
  update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user;
  perform set_config('app.reconciler_company_id',v_company::text,true);
  select * into v_complete from public.hotel_inspection_complete_materialization_v2(
    v_routine,v_claim.claim_generation,
    pg_catalog.sha256(pg_catalog.convert_to(repeat('G',43),'UTF8')),
    'fce70000-0000-4000-8000-000000000001'
  );
  perform set_config('app.reconciler_company_id','',true);
  update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user;
  if v_complete.result_status<>'STALE_CLAIM'
     or exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine)
  then raise exception 'claimed revision remained writable after update: %',v_complete.result_status; end if;

  v_routine:='fd000000-0000-4000-8000-000000000001';
  v_routine_value:=pg_catalog.jsonb_build_object(
    'name','회차 지속 실제 통합','status','ACTIVE','mode','ROTATING',
    'recurrence',pg_catalog.jsonb_build_object('type','DAILY'),
    'startDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date-1,
    'endDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'localDueTime','23:30','processDefinitionId',null,
    'rounds',pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('order',1,'target',pg_catalog.jsonb_build_object('type','FACILITIES','facilityIds',pg_catalog.jsonb_build_array(v_facility))),
      pg_catalog.jsonb_build_object('order',2,'target',pg_catalog.jsonb_build_object('type','FACILITIES','facilityIds',pg_catalog.jsonb_build_array(v_facility)))
    )
  );
  select * into v_result from public.hotel_inspection_routine_command_v2(
    v_company,v_hotel,v_routine,0,v_routine_value,v_token,
    'rotation-create','POST','/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/v2',
    'rotation-create-hash','fd010000-0000-4000-8000-000000000001',
    'fd020000-0000-4000-8000-000000000001','fd030000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'OK' then raise exception 'rotation routine create failed: %',v_result.command_status; end if;
  update public.inspection_routines
     set materialized_through_date=(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date-1,
         next_due_date=(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
         materialized_occurrence_count=1
   where company_id=v_company and id=v_routine;
  update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user;
  perform set_config('app.reconciler_company_id',v_company::text,true);
  update public.inspection_routines set next_due_date=case when id=v_routine then (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date else 'infinity'::date end where company_id=v_company;
  select * into v_claim from public.hotel_inspection_claim_next_materialization_v2(pg_catalog.sha256(pg_catalog.convert_to(repeat('J',43),'UTF8')),60);
  if v_claim.routine_id is distinct from v_routine then raise exception 'rotation claim selected wrong routine: %',v_claim.routine_id; end if;
  select * into v_complete from public.hotel_inspection_complete_materialization_v2(v_routine,v_claim.claim_generation,pg_catalog.sha256(pg_catalog.convert_to(repeat('J',43),'UTF8')),'fd040000-0000-4000-8000-000000000001');
  perform set_config('app.reconciler_company_id','',true);
  update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user;
  if v_complete.result_status<>'COMPLETED' or v_complete.created_count<>1
     or not exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine and routine_round_order=2 and business_date=(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date)
     or exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine and routine_round_order=1)
     or (select materialized_occurrence_count from public.inspection_routines where company_id=v_company and id=v_routine)<>2
  then raise exception 'rotation split checkpoint failed: % %',v_complete.result_status,v_complete.created_count; end if;

  v_routine:='fd060000-0000-4000-8000-000000000001';
  v_routine_value:=pg_catalog.jsonb_set(v_routine_value,'{name}','"회차 catch-up 실제 통합"'::jsonb);
  select * into v_result from public.hotel_inspection_routine_command_v2(
    v_company,v_hotel,v_routine,0,v_routine_value,v_token,
    'rotation-catchup-create','POST','/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/v2',
    'rotation-catchup-create-hash','fd070000-0000-4000-8000-000000000001',
    'fd080000-0000-4000-8000-000000000001','fd090000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'OK' then raise exception 'rotation catch-up create failed: %',v_result.command_status; end if;
  update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user;
  perform set_config('app.reconciler_company_id',v_company::text,true);
  update public.inspection_routines set next_due_date=case when id=v_routine then (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date else 'infinity'::date end where company_id=v_company;
  select * into v_claim from public.hotel_inspection_claim_next_materialization_v2(pg_catalog.sha256(pg_catalog.convert_to(repeat('L',43),'UTF8')),60);
  if v_claim.routine_id is distinct from v_routine then raise exception 'rotation catch-up claim selected wrong routine: %',v_claim.routine_id; end if;
  select * into v_complete from public.hotel_inspection_complete_materialization_v2(v_routine,v_claim.claim_generation,pg_catalog.sha256(pg_catalog.convert_to(repeat('L',43),'UTF8')),'fd0a0000-0000-4000-8000-000000000001');
  perform set_config('app.reconciler_company_id','',true);
  update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user;
  if v_complete.result_status<>'COMPLETED' or v_complete.created_count<>2
     or not exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine and routine_round_order=1 and business_date=(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date-1)
     or not exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine and routine_round_order=2 and business_date=(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date)
     or (select materialized_occurrence_count from public.inspection_routines where company_id=v_company and id=v_routine)<>2
  then raise exception 'rotation catch-up equivalence failed: % %',v_complete.result_status,v_complete.created_count; end if;

  begin
    insert into public.inspection_checklist_revisions(id,company_id,branch_id,version,reason,created_by)
  select 'fd140000-0000-4000-8000-000000000001',v_company,v_hotel,pg_catalog.max(version)+1,'적용항목 없음 검증',v_actor
    from public.inspection_checklist_revisions where company_id=v_company and branch_id=v_hotel;
  insert into public.inspection_checklist_v2_revisions(id,company_id,branch_id,version,reason,created_by)
  select 'fd150000-0000-4000-8000-000000000001',v_company,v_hotel,version,'적용항목 없음 검증',v_actor
    from public.inspection_checklist_revisions where company_id=v_company and id='fd140000-0000-4000-8000-000000000001';
  v_routine:='fd100000-0000-4000-8000-000000000001';
  v_routine_value:=pg_catalog.jsonb_build_object(
    'name','적용항목 없음 실제 통합','status','ACTIVE','mode','FIXED',
    'recurrence',pg_catalog.jsonb_build_object('type','DAILY'),
    'startDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'endDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'localDueTime','23:30','processDefinitionId',null,
    'rounds',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'order',1,'target',pg_catalog.jsonb_build_object(
        'type','FACILITIES','facilityIds',pg_catalog.jsonb_build_array(v_facility)
      )
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v2(
    v_company,v_hotel,v_routine,0,v_routine_value,v_token,
    'empty-routine-create','POST','/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/v2',
    'empty-routine-create-hash','fd110000-0000-4000-8000-000000000001',
    'fd120000-0000-4000-8000-000000000001','fd130000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'OK' then raise exception 'empty routine create failed: %',v_result.command_status; end if;
  update public.runtime_database_capabilities set capability='RECONCILER' where role_name=session_user;
  perform set_config('app.reconciler_company_id',v_company::text,true);
  update public.inspection_routines set next_due_date=case when id=v_routine then (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date else 'infinity'::date end where company_id=v_company;
  select * into v_claim from public.hotel_inspection_claim_next_materialization_v2(pg_catalog.sha256(pg_catalog.convert_to(repeat('K',43),'UTF8')),60);
  if v_claim.routine_id is distinct from v_routine then raise exception 'empty checklist claim selected wrong routine: %',v_claim.routine_id; end if;
  select * into v_complete from public.hotel_inspection_complete_materialization_v2(v_routine,v_claim.claim_generation,pg_catalog.sha256(pg_catalog.convert_to(repeat('K',43),'UTF8')),'fd160000-0000-4000-8000-000000000001');
  perform set_config('app.reconciler_company_id','',true);
  update public.runtime_database_capabilities set capability='API_RUNTIME' where role_name=session_user;
  if v_complete.result_status<>'COMPLETED' or v_complete.created_count<>0
     or exists(select 1 from public.hotel_inspections where company_id=v_company and routine_id=v_routine)
  then raise exception 'routine without applicable items persisted: % %',v_complete.result_status,v_complete.created_count; end if;
    raise exception 'EMPTY_ROUTINE_FIXTURE_ROLLBACK';
  exception when raise_exception then
    if sqlerrm<>'EMPTY_ROUTINE_FIXTURE_ROLLBACK' then raise; end if;
  end;

  v_routine:='fd200000-0000-4000-8000-000000000001';
  v_routine_value:=pg_catalog.jsonb_build_object(
    'name','Scheduled adapter 실제 통합','status','ACTIVE','mode','FIXED',
    'recurrence',pg_catalog.jsonb_build_object('type','DAILY'),
    'startDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'endDate',(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date,
    'localDueTime','23:30','processDefinitionId',null,
    'rounds',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'order',1,'target',pg_catalog.jsonb_build_object(
        'type','FACILITIES','facilityIds',pg_catalog.jsonb_build_array(v_facility)
      )
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v2(
    v_company,v_hotel,v_routine,0,v_routine_value,v_token,
    'scheduled-adapter-create','POST','/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/v2',
    'scheduled-adapter-create-hash','fd210000-0000-4000-8000-000000000001',
    'fd220000-0000-4000-8000-000000000001','fd230000-0000-4000-8000-000000000001'
  );
  if v_result.command_status<>'OK' then raise exception 'scheduled adapter routine create failed: %',v_result.command_status; end if;

  v_snapshot:=public.inspection_execution_snapshot_v2(v_company,v_hotel,v_inspection);
  if v_snapshot #>> '{targets,0,facilityNameSnapshot}'<>'시설물 실행 통합'
  then raise exception 'facility execution snapshot was not preserved: %',v_snapshot; end if;
end
$facility_execution$;

select 'HOTEL_INSPECTION_FACILITY_EXECUTION_ACTUAL_OK';
