\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0001_platform_foundation'
  ) then
    raise exception 'foundation migration version was not recorded';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0002_auth_session_runtime'
  ) then
    raise exception 'auth runtime migration version was not recorded';
  end if;

  begin
    insert into auth_login_transactions (
      id, state_hash, browser_binding_hash, nonce_hash,
      code_verifier_ciphertext, code_verifier_iv, redirect_uri, expires_at
    ) values (
      '01000000-0000-0000-0000-000000000001',
      decode('abcd', 'hex'),
      decode(repeat('44', 32), 'hex'),
      decode(repeat('11', 32), 'hex'),
      decode(repeat('55', 59), 'hex'),
      decode(repeat('66', 12), 'hex'),
      'https://hotel.example.test/api/auth/callback',
      now() + interval '10 minutes'
    );
    raise exception 'short OAuth state hash was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into auth_login_transactions (
      id, state_hash, browser_binding_hash, nonce_hash,
      code_verifier_ciphertext, code_verifier_iv, redirect_uri, expires_at
    ) values (
      '01000000-0000-0000-0000-000000000002',
      decode(repeat('22', 32), 'hex'),
      decode(repeat('44', 32), 'hex'),
      decode(repeat('33', 32), 'hex'),
      decode(repeat('55', 59), 'hex'),
      decode('abcd', 'hex'),
      'https://hotel.example.test/api/auth/callback',
      now() + interval '10 minutes'
    );
    raise exception 'short PKCE verifier IV was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into auth_login_transactions (
      id, state_hash, browser_binding_hash, nonce_hash,
      code_verifier_ciphertext, code_verifier_iv, redirect_uri, expires_at
    ) values (
      '01000000-0000-0000-0000-000000000003',
      decode(repeat('77', 32), 'hex'),
      decode(repeat('88', 32), 'hex'),
      decode(repeat('99', 32), 'hex'),
      decode(repeat('aa', 59), 'hex'),
      decode(repeat('bb', 12), 'hex'),
      'https://hotel.example.test/api/auth/callback',
      now() + interval '11 minutes'
    );
    raise exception 'OAuth transaction longer than 10 minutes was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

insert into companies (id, legal_name) values
  ('10000000-0000-0000-0000-000000000001', '위아히어'),
  ('10000000-0000-0000-0000-000000000002', '다른 법인');

insert into users (id, company_id, user_type, display_name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'INTERNAL_STAFF', '사내 임직원'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'ROOM_OPERATIONS', '하우스키핑'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'BRANCH_OWNER', '호텔 소유주'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'INTERNAL_STAFF', '다른 법인 임직원');

do $$
begin
  begin
    insert into users (id, company_id, user_type, display_name)
    values ('20000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001', 'PARTNER_EMPLOYEE', '범위 밖 사용자');
    raise exception 'future user type was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

insert into auth_identities (id, company_id, user_id, provider, provider_subject)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'ZITADEL',
  'subject-1'
);

insert into auth_identities (id, company_id, user_id, provider, provider_subject)
values (
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'ZITADEL',
  'subject-2'
);

insert into auth_identities (id, company_id, user_id, provider, provider_subject)
values (
  '30000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000004',
  'ZITADEL',
  'subject-other-company'
);

insert into auth_sessions (
  id, company_id, user_id, identity_id, token_hash,
  idle_expires_at, absolute_expires_at, auth_time, authentication_method
) values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  decode(repeat('ab', 32), 'hex'),
  now() + interval '30 minutes',
  now() + interval '8 hours',
  now(),
  'OIDC_PKCE'
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'auth_sessions'
      and column_name in ('session_token', 'access_token', 'refresh_token')
  ) then
    raise exception 'raw credential column exists';
  end if;

  begin
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '40000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      decode(repeat('ab', 32), 'hex'),
      now() + interval '30 minutes',
      now() + interval '8 hours',
      now(),
      'OIDC_PKCE'
    );
    raise exception 'duplicate session hash was accepted';
  exception when unique_violation then
    null;
  end;

  begin
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '40000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      decode(repeat('cd', 32), 'hex'),
      now() + interval '30 minutes',
      now() + interval '8 hours',
      now(),
      'OIDC_PKCE'
    );
    raise exception 'identity belonging to another user was accepted';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '40000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      decode(repeat('ce', 32), 'hex'),
      now() + interval '30 minutes',
      now() + interval '8 hours',
      now(),
      'OIDC_PKCE'
    );
    raise exception 'cross-company identity session was accepted';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '40000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      decode(repeat('cf', 32), 'hex'),
      now() + interval '8 hours 1 second',
      now() + interval '24 hours',
      now(),
      'OIDC_PKCE'
    );
    raise exception 'session idle lifetime above eight hours was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '40000000-0000-0000-0000-000000000007',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      decode(repeat('d0', 32), 'hex'),
      now() + interval '8 hours',
      now() + interval '24 hours 1 second',
      now(),
      'OIDC_PKCE'
    );
    raise exception 'session absolute lifetime above twenty-four hours was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '40000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      decode('abcd', 'hex'),
      now() + interval '30 minutes',
      now() + interval '8 hours',
      now(),
      'OIDC_PKCE'
    );
    raise exception 'short session hash was accepted';
  exception when check_violation then
    null;
  end;

  begin
    update auth_sessions
    set revoked_at = now()
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'session revoke without a reason was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

insert into branches (id, company_id, branch_type, branch_code, name)
values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'HOTEL',
  'SEOUL-01',
  '서울호텔'
);

insert into hotel_profiles (company_id, branch_id)
values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001');

do $$
begin
  begin
    insert into hotel_profiles (company_id, branch_id)
    values ('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001');
    raise exception 'cross-company hotel profile was accepted';
  exception when foreign_key_violation then
    null;
  end;

  begin
    update hotel_profiles
    set version = 0
    where company_id = '10000000-0000-0000-0000-000000000001'
      and branch_id = '50000000-0000-0000-0000-000000000001';
    raise exception 'invalid version was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

insert into audit_events (
  id, event_code, actor_user_id, actor_type, session_id,
  company_id, branch_id, resource_type, resource_id,
  after_summary, result, trace_id
) values (
  '60000000-0000-0000-0000-000000000001',
  'HOTEL_CREATED',
  '20000000-0000-0000-0000-000000000001',
  'INTERNAL_STAFF',
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'HOTEL',
  '50000000-0000-0000-0000-000000000001',
  '{"status":"PREPARING"}',
  'SUCCEEDED',
  '70000000-0000-0000-0000-000000000001'
);

do $$
begin
  begin
    update audit_events set reason = '변조' where id = '60000000-0000-0000-0000-000000000001';
    raise exception 'audit event update was accepted';
  exception when sqlstate '55000' then
    null;
  end;
end;
$$;

do $$
begin
  begin
    insert into audit_events (
      id, event_code, actor_user_id, actor_type, session_id,
      company_id, resource_type, result, trace_id
    ) values (
      '60000000-0000-0000-0000-000000000002',
      'CROSS_COMPANY_SESSION_TEST',
      '20000000-0000-0000-0000-000000000004',
      'INTERNAL_STAFF',
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      'SESSION',
      'FAILED',
      '70000000-0000-0000-0000-000000000002'
    );
    raise exception 'cross-company audit session was accepted';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

insert into permissions (code, description)
values ('HOTEL_VIEW', '호텔 기본정보 조회');

insert into roles (id, company_id, name)
values (
  '91000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '호텔 조회 역할'
);

insert into permission_grants (
  id, company_id, subject_type, subject_id, permission_code,
  effect, valid_from, granted_by, reason
) values (
  '90000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'ROLE',
  '91000000-0000-0000-0000-000000000001',
  'HOTEL_VIEW',
  'ALLOW',
  now(),
  '20000000-0000-0000-0000-000000000001',
  '역할 삭제 방지 테스트'
);

do $$
begin
  begin
    delete from roles where id = '91000000-0000-0000-0000-000000000001';
    raise exception 'physical role deletion was accepted';
  exception when sqlstate '55000' then
    null;
  end;

  begin
    update roles
    set id = '91000000-0000-0000-0000-000000000099'
    where id = '91000000-0000-0000-0000-000000000001';
    raise exception 'role re-key was accepted';
  exception when sqlstate '55000' then
    null;
  end;
end;
$$;

insert into user_groups (id, company_id, name, created_by)
values (
  '92000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '호텔 조회 그룹',
  '20000000-0000-0000-0000-000000000001'
);

do $$
begin
  begin
    delete from user_groups where id = '92000000-0000-0000-0000-000000000001';
    raise exception 'physical user group deletion was accepted';
  exception when sqlstate '55000' then
    null;
  end;

  begin
    update user_groups
    set id = '92000000-0000-0000-0000-000000000099'
    where id = '92000000-0000-0000-0000-000000000001';
    raise exception 'user group re-key was accepted';
  exception when sqlstate '55000' then
    null;
  end;

  begin
    delete from users where id = '20000000-0000-0000-0000-000000000004';
    raise exception 'physical user deletion was accepted';
  exception when sqlstate '55000' then
    null;
  end;

  begin
    update users
    set id = '20000000-0000-0000-0000-000000000099'
    where id = '20000000-0000-0000-0000-000000000004';
    raise exception 'user re-key was accepted';
  exception when sqlstate '55000' then
    null;
  end;
end;
$$;

do $$
begin
  begin
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '90000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'GROUP',
      '90000000-0000-0000-0000-000000000099',
      'HOTEL_VIEW',
      'ALLOW',
      now(),
      '20000000-0000-0000-0000-000000000001',
      '존재하지 않는 그룹 거부 테스트'
    );
    raise exception 'dangling permission subject was accepted';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

insert into audit_events (
  id, event_code, actor_user_id, actor_type,
  company_id, resource_type, result, trace_id
) values (
  '60000000-0000-0000-0000-000000000003',
  'OTHER_COMPANY_EVENT',
  '20000000-0000-0000-0000-000000000004',
  'BRANCH_OWNER',
  '10000000-0000-0000-0000-000000000002',
  'COMPANY',
  'SUCCEEDED',
  '70000000-0000-0000-0000-000000000003'
);

do $$
begin
  begin
    insert into idempotency_records (
      id, company_id, actor_user_id, idempotency_key, http_method,
      operation_path, request_hash, status, audit_event_id, expires_at
    ) values (
      '80000000-0000-0000-0000-000000000099',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'cross-company-audit',
      'POST',
      '/api/hotels',
      'sha256:cross-company',
      'IN_PROGRESS',
      '60000000-0000-0000-0000-000000000003',
      now() + interval '24 hours'
    );
    raise exception 'cross-company idempotency audit was accepted';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

insert into idempotency_records (
  id, company_id, actor_user_id, idempotency_key, http_method,
  operation_path, request_hash, status, resource_type, resource_id,
  audit_event_id, completed_at, expires_at
) values (
  '80000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'idem-1',
  'POST',
  '/api/hotels',
  'sha256:request-1',
  'COMPLETED',
  'HOTEL',
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  now(),
  now() + interval '24 hours'
);

do $$
begin
  begin
    insert into idempotency_records (
      id, company_id, actor_user_id, idempotency_key, http_method,
      operation_path, request_hash, status, expires_at
    ) values (
      '80000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'idem-1',
      'POST',
      '/api/hotels',
      'sha256:different-request',
      'IN_PROGRESS',
      now() + interval '24 hours'
    );
    raise exception 'duplicate idempotency scope was accepted';
  exception when unique_violation then
    null;
  end;
end;
$$;

begin;
insert into companies (id, legal_name)
values ('10000000-0000-0000-0000-000000000099', '롤백 대상');
rollback;

do $$
begin
  if exists (select 1 from companies where id = '10000000-0000-0000-0000-000000000099') then
    raise exception 'transaction rollback did not remove the row';
  end if;
end;
$$;

select 'PLATFORM_FOUNDATION_INTEGRATION_OK' as result;
