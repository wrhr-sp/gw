\set ON_ERROR_STOP on

do $execution_journey$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_token text := repeat('I', 43);
  v_inspection uuid := 'e1000000-0000-4000-8000-000000000001';
  v_execution uuid := 'e2000000-0000-4000-8000-000000000001';
  v_room uuid := 'bc000000-0000-4000-8000-000000000001';
  v_item_source uuid := 'c5000000-0000-4000-8000-000000000001';
  v_item_snapshot uuid;
  v_result record;
begin
  perform set_config('app.session_id', v_session::text, true);

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'CREATE_MANUAL', 0,
    jsonb_build_object(
      'processDefinitionId', null,
      'processExecutionId', v_execution,
      'reason', '수행 통합시험 수시점검',
      'targets', jsonb_build_array(jsonb_build_object(
        'roomId', v_room,
        'selectedItemIds', jsonb_build_array(v_item_source)
      ))
    ),
    v_token,
    'e3000000-0000-4000-8000-000000000001',
    'execution-create', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/manual',
    'hash-execution-create',
    'e4000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'manual execution create failed: %', v_result.command_status;
  end if;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, v_hotel, null,
    jsonb_build_object('page', 1, 'pageSize', 20, 'status', 'PENDING_INPUT'),
    v_token
  );
  if v_result.command_status <> 'OK'
     or not exists (
       select 1
         from jsonb_array_elements(v_result.result_snapshot -> 'inspections') value
        where value ->> 'id' = v_inspection::text
          and value #>> '{rooms,0,roomNumber}' = 'INSPECT-9001'
     )
     or (v_result.result_snapshot #>> '{pagination,page}')::integer <> 1 then
    raise exception 'canonical execution list failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, v_hotel, v_inspection, '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{inspection,id}' <> v_inspection::text
     or v_result.result_snapshot #>> '{inspection,rooms,0,roomNumber}' <> 'INSPECT-9001' then
    raise exception 'canonical execution detail failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select item.id into strict v_item_snapshot
    from public.inspection_item_snapshots item
   where item.company_id = v_company
     and item.inspection_id = v_inspection
     and item.source_item_id = v_item_source;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 0,
    jsonb_build_object(
      'itemSnapshotId', v_item_snapshot,
      'resultId', 'e6000000-0000-4000-8000-000000000001',
      'historyId', 'e7000000-0000-4000-8000-000000000001',
      'result', 'ABNORMAL',
      'description', '배수구 아래 누수 확인',
      'severity', 'MAJOR',
      'fileVersionIds', jsonb_build_array(),
      'changeReason', null
    ),
    v_token,
    'e8000000-0000-4000-8000-000000000001',
    'execution-abnormal-draft', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/e1000000-0000-4000-8000-000000000001/items/result',
    'hash-execution-abnormal-draft',
    'e9000000-0000-4000-8000-000000000001',
    'ea000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED'
     or v_result.result_snapshot #>> '{items,0,result,result}' <> 'ABNORMAL' then
    raise exception 'abnormal draft save failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SUBMIT', 1,
    jsonb_build_object(
      'historyId', 'eb000000-0000-4000-8000-000000000001',
      'reason', '증빙 없는 제출 차단 검증'
    ),
    v_token,
    'ec000000-0000-4000-8000-000000000001',
    'execution-submit-without-evidence', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/e1000000-0000-4000-8000-000000000001/submit',
    'hash-execution-submit-without-evidence',
    'ed000000-0000-4000-8000-000000000001',
    'ee000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'INSPECTION_RESULT_EVIDENCE_REQUIRED' then
    raise exception 'evidence-free submit was not blocked: %', v_result.command_status;
  end if;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, '5f000000-0000-4000-8000-000000000099', v_inspection,
    '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'FORBIDDEN' then
    raise exception 'other-hotel execution read was not blocked: %', v_result.command_status;
  end if;
end
$execution_journey$;

select 'HOTEL_INSPECTION_EXECUTION_OK';
