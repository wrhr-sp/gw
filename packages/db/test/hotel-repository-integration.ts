import postgres from "postgres";
import { createPostgresHotelRepository } from "../src/hotels";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const companyId = "10000000-0000-0000-0000-000000000001";
const otherCompanyId = "10000000-0000-0000-0000-000000000002";
const actorUserId = "20000000-0000-0000-0000-000000000001";
const otherUserId = "20000000-0000-0000-0000-000000000004";
const sessionId = "40000000-0000-0000-0000-000000000001";
const branchId = "51000000-0000-4000-8000-000000000001";
const repository = createPostgresHotelRepository(databaseUrl);
const testSql = postgres(databaseUrl, { max: 1, prepare: false });

const ids = (suffix: string) => ({
  auditEventId: `61000000-0000-4000-8000-${suffix}`,
  idempotencyRecordId: `71000000-0000-4000-8000-${suffix}`,
  traceId: `81000000-0000-4000-8000-${suffix}`,
});

try {
  await testSql`
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '91000000-0000-4000-8000-000000000001', ${companyId}, 'USER', ${actorUserId},
      'HOTEL_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorUserId}, '호텔관리 테스트 권한'
    )
  `;

  const createInput = {
    branchCode: "TEST-HOTEL-02",
    name: "위아히어 강남호텔",
    roadAddress: "서울특별시 강남구 테헤란로 1",
    detailAddress: "10층",
    representativePhone: "02-1234-5678",
    contractStartDate: "2026-07-01",
    contractEndDate: "2027-06-30",
  };
  const created = await repository.createHotel({
    ...ids("000000000001"),
    actor: {
      companyId,
      sessionId,
      userId: actorUserId,
      userType: "INTERNAL_STAFF",
    },
    branchId,
    idempotencyKey: "hotel-create-1",
    operationPath: "/api/hotels",
    requestHash: "create-request-hash-1",
    value: createInput,
  });
  if (
    created.status !== "CREATED" ||
    created.hotel.status !== "PREPARING" ||
    created.hotel.version !== 1
  ) {
    throw new Error(
      "hotel create did not return the persisted PREPARING hotel",
    );
  }

  await testSql`
    insert into users (id, company_id, user_type, display_name)
    values ('20000000-0000-4000-8000-000000000005', ${companyId}, 'INTERNAL_STAFF', '호텔별 권한 사용자')
  `;
  await testSql`
    insert into auth_identities (id, company_id, user_id, provider, provider_subject)
    values (
      '30000000-0000-4000-8000-000000000005', ${companyId},
      '20000000-0000-4000-8000-000000000005', 'ZITADEL', 'hotel-scope-user'
    )
  `;
  await testSql`
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '40000000-0000-4000-8000-000000000005', ${companyId},
      '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005',
      decode(repeat('cd', 32), 'hex'), now() + interval '8 hours', now() + interval '24 hours',
      now(), 'integration'
    )
  `;
  await testSql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '91000000-0000-4000-8000-000000000005', ${companyId}, ${branchId}, 'USER',
      '20000000-0000-4000-8000-000000000005', 'HOTEL_MANAGE', 'ALLOW', now(),
      ${actorUserId}, '호텔별 목록 권한 테스트'
    )
  `;
  const hotelScopedActor = {
    companyId,
    sessionId: "40000000-0000-4000-8000-000000000005",
    userId: "20000000-0000-4000-8000-000000000005",
    userType: "INTERNAL_STAFF" as const,
  };
  const scopedList = await repository.listHotels(hotelScopedActor);
  if (
    scopedList.status !== "OK" ||
    scopedList.capabilities.canCreate ||
    scopedList.hotels.length !== 1 ||
    scopedList.hotels[0]?.id !== branchId
  ) {
    throw new Error(
      "branch-scoped HOTEL_MANAGE did not expose the authorized hotel list",
    );
  }
  const scopedDetail = await repository.getHotel(hotelScopedActor, branchId);
  if (scopedDetail?.id !== branchId) {
    throw new Error(
      "branch-scoped HOTEL_MANAGE did not expose the authorized hotel detail",
    );
  }
  await testSql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '91000000-0000-4000-8000-000000000006', ${companyId}, ${branchId}, 'USER',
      '20000000-0000-4000-8000-000000000005', 'HOTEL_MANAGE', 'DENY', now(),
      ${actorUserId}, '유일한 호텔별 권한 DENY 우선 테스트'
    )
  `;
  const scopedDeniedList = await repository.listHotels(
    hotelScopedActor,
    undefined,
    {
      auditEventId: "61000000-0000-4000-8000-000000000015",
      traceId: "81000000-0000-4000-8000-000000000015",
    },
  );
  if (scopedDeniedList.status !== "FORBIDDEN") {
    throw new Error(
      "branch deny did not remove the actor's only effective hotel scope",
    );
  }
  const scopedDeniedAudit = await testSql<{ count: number }[]>`
    select count(*)::int as count from audit_events
    where id = '61000000-0000-4000-8000-000000000015'
      and event_code = 'HOTEL_LIST_DENIED' and result = 'DENIED'
  `;
  if (scopedDeniedAudit[0]?.count !== 1)
    throw new Error("branch-only list denial was not audited");
  await testSql`delete from permission_grants where id = '91000000-0000-4000-8000-000000000006'`;

  const replay = await repository.createHotel({
    ...ids("000000000002"),
    actor: {
      companyId,
      sessionId,
      userId: actorUserId,
      userType: "INTERNAL_STAFF",
    },
    branchId: "51000000-0000-4000-8000-000000000002",
    idempotencyKey: "hotel-create-1",
    operationPath: "/api/hotels",
    requestHash: "create-request-hash-1",
    value: createInput,
  });
  if (replay.status !== "REPLAYED" || replay.hotel.id !== branchId) {
    throw new Error(
      "hotel create idempotency replay did not return the original hotel",
    );
  }

  const mismatch = await repository.createHotel({
    ...ids("000000000003"),
    actor: {
      companyId,
      sessionId,
      userId: actorUserId,
      userType: "INTERNAL_STAFF",
    },
    branchId: "51000000-0000-4000-8000-000000000003",
    idempotencyKey: "hotel-create-1",
    operationPath: "/api/hotels",
    requestHash: "different-request-hash",
    value: { ...createInput, name: "다른 호텔" },
  });
  if (mismatch.status !== "IDEMPOTENCY_CONFLICT")
    throw new Error("idempotency mismatch was accepted");

  await testSql`
    insert into idempotency_records (
      id, company_id, actor_user_id, idempotency_key, http_method,
      operation_path, request_hash, status, created_at, expires_at
    )
    select (
      substr(md5('expired-backlog-' || item::text), 1, 8) || '-' ||
      substr(md5('expired-backlog-' || item::text), 9, 4) || '-' ||
      substr(md5('expired-backlog-' || item::text), 13, 4) || '-' ||
      substr(md5('expired-backlog-' || item::text), 17, 4) || '-' ||
      substr(md5('expired-backlog-' || item::text), 21, 12)
    )::uuid,
      ${companyId}, ${actorUserId}, 'expired-backlog-' || item::text,
      'POST', '/api/hotels', 'expired-hash-' || item::text, 'IN_PROGRESS',
      now() - interval '3 hours', now() - interval '2 hours'
    from generate_series(1, 256) item
  `;
  await testSql`
    insert into idempotency_records (
      id, company_id, actor_user_id, idempotency_key, http_method,
      operation_path, request_hash, status, created_at, expires_at
    ) values (
      '71000000-0000-4000-8000-000000000012', ${companyId}, ${actorUserId},
      'hotel-create-expired-target', 'POST', '/api/hotels', 'expired-target-hash',
      'IN_PROGRESS', now() - interval '2 hours', now() - interval '1 hour'
    )
  `;
  const expiredTarget = await repository.createHotel({
    ...ids("000000000012"),
    actor: {
      companyId,
      sessionId,
      userId: actorUserId,
      userType: "INTERNAL_STAFF",
    },
    branchId: "51000000-0000-4000-8000-000000000012",
    idempotencyKey: "hotel-create-expired-target",
    operationPath: "/api/hotels",
    requestHash: "fresh-target-hash",
    value: {
      ...createInput,
      branchCode: "TEST-HOTEL-EXPIRED",
      name: "위아히어 만료키호텔",
    },
  });
  if (expiredTarget.status !== "CREATED") {
    throw new Error(
      "expired target idempotency key was blocked behind cleanup backlog",
    );
  }
  const deniedScopedDetail = await repository.getHotel(
    hotelScopedActor,
    expiredTarget.hotel.id,
    {
      auditEventId: "61000000-0000-4000-8000-000000000013",
      traceId: "81000000-0000-4000-8000-000000000013",
    },
  );
  if (deniedScopedDetail)
    throw new Error("branch-scoped user accessed a hotel outside the grant");
  const detailDeniedAudit = await testSql<{ count: number }[]>`
    select count(*)::int as count from audit_events
    where id = '61000000-0000-4000-8000-000000000013'
      and event_code = 'HOTEL_DETAIL_DENIED'
      and result = 'DENIED'
      and resource_id = ${expiredTarget.hotel.id}
  `;
  if (detailDeniedAudit[0]?.count !== 1)
    throw new Error("out-of-scope hotel detail denial was not audited");

  const actor = {
    companyId,
    sessionId,
    userId: actorUserId,
    userType: "INTERNAL_STAFF" as const,
  };
  await testSql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values
      ('91000000-0000-4000-8000-000000000040', ${companyId}, ${branchId}, 'USER', ${actorUserId},
       'HOTEL_ASSIGNMENT_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorUserId}, '관계 조회 테스트'),
      ('91000000-0000-4000-8000-000000000041', ${companyId}, ${branchId}, 'USER', ${actorUserId},
       'HOTEL_OWNER_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorUserId}, '소유주 조회 테스트'),
      ('91000000-0000-4000-8000-000000000043', ${companyId}, null, 'USER', ${actorUserId},
       'HOTEL_ASSIGNMENT_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorUserId}, '회사 관계 조회 테스트'),
      ('91000000-0000-4000-8000-000000000044', ${companyId}, null, 'USER', ${actorUserId},
       'HOTEL_OWNER_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorUserId}, '회사 소유주 조회 테스트')
  `;
  await testSql`
    insert into users (id, company_id, user_type, display_name, status) values
      ('20000000-0000-4000-8000-000000000040', ${companyId}, 'INTERNAL_STAFF', '기존 주배정', 'ACTIVE'),
      ('20000000-0000-4000-8000-000000000041', ${companyId}, 'INTERNAL_STAFF', '신규 배정후보', 'PENDING_SETUP'),
      ('20000000-0000-4000-8000-000000000042', ${companyId}, 'BRANCH_OWNER', '현재 소유주', 'ACTIVE'),
      ('20000000-0000-4000-8000-000000000043', ${companyId}, 'BRANCH_OWNER', '신규 소유주후보', 'ACTIVE')
  `;
  await testSql`
    insert into hotel_staff_assignments (
      id, company_id, branch_id, user_id, assignment_type, start_date, reason, created_by
    ) values (
      '52000000-0000-4000-8000-000000000040', ${companyId}, ${branchId},
      '20000000-0000-4000-8000-000000000040', 'PRIMARY', '2026-07-01', '기존 배정', ${actorUserId}
    )
  `;
  await testSql`
    insert into hotel_owner_assignments (
      id, company_id, branch_id, user_id, start_date, reason, created_by
    ) values (
      '53000000-0000-4000-8000-000000000040', ${companyId}, ${branchId},
      '20000000-0000-4000-8000-000000000042', '2026-07-01', '현재 소유주', ${actorUserId}
    )
  `;
  const assignmentView = await repository.listAssignments(actor, branchId);
  if (
    assignmentView.status !== "OK" ||
    assignmentView.assignments.length !== 1 ||
    assignmentView.assignments[0]?.assignee.displayName !== "기존 주배정" ||
    assignmentView.assignments.some((item) => item.relationshipType === "OWNER")
  ) {
    throw new Error(
      "assignment read model exposed owner data or omitted the assignee display name",
    );
  }
  const ownerView = await repository.listOwnerRelationships(actor, branchId);
  if (
    ownerView.status !== "OK" ||
    ownerView.owners.length !== 1 ||
    ownerView.owners[0]?.assignee.displayName !== "현재 소유주" ||
    ownerView.owners[0]?.assignee.userType !== "HOTEL_OWNER"
  ) {
    throw new Error(
      "owner read model did not enforce its minimal normalized view",
    );
  }
  const staffCandidates = await repository.listEligibleCandidates(
    actor,
    branchId,
    {
      relationshipType: "STAFF",
      assignmentType: "PRIMARY",
      startDate: "2026-07-24",
      q: "배정",
      page: 999,
      pageSize: 100,
    },
  );
  if (
    staffCandidates.status !== "OK" ||
    staffCandidates.candidates.some(
      (item) => item.displayName === "기존 주배정",
    ) ||
    !staffCandidates.candidates.some(
      (item) => item.displayName === "신규 배정후보",
    ) ||
    staffCandidates.pagination.page !== staffCandidates.pagination.totalPages
  ) {
    throw new Error(
      "primary staff candidates did not exclude overlaps or normalize pagination",
    );
  }
  const ownerCandidates = await repository.listEligibleCandidates(
    actor,
    branchId,
    {
      relationshipType: "OWNER",
      page: 1,
      pageSize: 20,
    },
  );
  if (
    ownerCandidates.status !== "OK" ||
    ownerCandidates.candidates.some(
      (item) => item.displayName === "현재 소유주",
    ) ||
    !ownerCandidates.candidates.some(
      (item) => item.displayName === "신규 소유주후보",
    )
  ) {
    throw new Error(
      "owner candidates did not exclude active owner relationships",
    );
  }
  await testSql`
    insert into hotel_staff_assignments (
      id, company_id, branch_id, user_id, assignment_type, start_date, reason, created_by
    ) values (
      '52000000-0000-4000-8000-000000000041', ${companyId}, ${branchId},
      '20000000-0000-4000-8000-000000000041', 'SUPPORT', '2026-07-01', '기존 지원배정', ${actorUserId}
    )
  `;
  const supportCandidates = await repository.listEligibleCandidates(
    actor,
    branchId,
    {
      relationshipType: "STAFF",
      assignmentType: "SUPPORT",
      startDate: "2026-07-24",
      q: "신규 배정후보",
      page: 1,
      pageSize: 20,
    },
  );
  if (
    supportCandidates.status !== "OK" ||
    supportCandidates.candidates.length !== 0
  ) {
    throw new Error(
      "overlapping same-hotel SUPPORT relationship remained eligible",
    );
  }
  const duplicateSupport = await repository.createAssignment({
    ...ids("000000000043"),
    actor,
    assignmentId: "52000000-0000-4000-8000-000000000043",
    hotelId: branchId,
    idempotencyKey: "duplicate-support-period",
    operationPath: `/api/hotels/${branchId}/assignments`,
    requestHash: "duplicate-support-period-hash",
    value: {
      userId: "20000000-0000-4000-8000-000000000041",
      relationshipType: "STAFF",
      assignmentType: "SUPPORT",
      startDate: "2026-07-24",
      reason: "중복 지원배정 차단",
      hotelVersion: 1,
    },
  });
  if (duplicateSupport.status !== "RELATIONSHIP_CONFLICT") {
    throw new Error(
      "SUPPORT exclusion violation was not mapped to stable relationship conflict",
    );
  }
  const missingHotelId = "51000000-0000-4000-8000-000000000099";
  const missingOwner = await repository.listOwnerRelationships(
    actor,
    missingHotelId,
  );
  const missingCandidates = await repository.listEligibleCandidates(
    actor,
    missingHotelId,
    {
      relationshipType: "OWNER",
      page: 1,
      pageSize: 20,
    },
  );
  if (
    missingOwner.status !== "NOT_FOUND" ||
    missingCandidates.status !== "NOT_FOUND"
  ) {
    throw new Error(
      "company-scoped relationship reads exposed a missing hotel as empty success",
    );
  }
  await testSql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '91000000-0000-4000-8000-000000000042', ${companyId}, ${branchId}, 'USER', ${actorUserId},
      'HOTEL_OWNER_MANAGE', 'DENY', now(), ${actorUserId}, '소유주 조회 DENY 우선'
    )
  `;
  const deniedOwnerView = await repository.listOwnerRelationships(
    actor,
    branchId,
    {
      auditEventId: "61000000-0000-4000-8000-000000000042",
      traceId: "81000000-0000-4000-8000-000000000042",
    },
  );
  if (deniedOwnerView.status !== "NOT_FOUND")
    throw new Error("owner DENY did not hide relationship existence");
  const deniedOwnerAudit = await testSql<{ count: number }[]>`
    select count(*)::int as count from audit_events
    where id = '61000000-0000-4000-8000-000000000042'
      and event_code = 'HOTEL_OWNER_LIST_DENIED' and result = 'DENIED'
  `;
  if (deniedOwnerAudit[0]?.count !== 1)
    throw new Error("owner read denial was not audited");
  await testSql`delete from permission_grants where id = '91000000-0000-4000-8000-000000000042'`;

  const listed = await repository.listHotels(actor);
  if (
    listed.status !== "OK" ||
    !listed.capabilities.canCreate ||
    !listed.hotels.some(
      (hotel) =>
        hotel.id === branchId && hotel.roadAddress === createInput.roadAddress,
    )
  ) {
    throw new Error("created hotel was not read back from PostgreSQL");
  }
  const normalizedPage = await repository.listHotels(actor, {
    page: 999,
    pageSize: 1,
  });
  if (
    normalizedPage.status !== "OK" ||
    normalizedPage.pagination.total < 2 ||
    normalizedPage.pagination.page !== normalizedPage.pagination.totalPages ||
    normalizedPage.hotels.length !== 1
  ) {
    throw new Error(
      "out-of-range hotel page was not normalized to the final page",
    );
  }
  if (
    await repository.getHotel(
      {
        companyId: otherCompanyId,
        sessionId,
        userId: otherUserId,
        userType: "INTERNAL_STAFF",
      },
      branchId,
    )
  ) {
    throw new Error("cross-company hotel detail was exposed");
  }

  const duplicate = await repository.createHotel({
    ...ids("000000000006"),
    actor: {
      companyId,
      sessionId,
      userId: actorUserId,
      userType: "INTERNAL_STAFF",
    },
    branchId: "51000000-0000-4000-8000-000000000006",
    idempotencyKey: "hotel-create-duplicate",
    operationPath: "/api/hotels",
    requestHash: "create-request-hash-duplicate",
    value: {
      ...createInput,
      branchCode: "TEST-HOTEL-03",
      name: "  위아히어 강남호텔  ",
    },
  });
  if (duplicate.status !== "DUPLICATE")
    throw new Error("active hotel name duplicate was accepted");
  const duplicateResidue = await testSql<{ count: number }[]>`
    select (
      (select count(*) from branches where id = '51000000-0000-4000-8000-000000000006')
      + (select count(*) from hotel_profiles where branch_id = '51000000-0000-4000-8000-000000000006')
      + (select count(*) from audit_events where branch_id = '51000000-0000-4000-8000-000000000006')
      + (select count(*) from idempotency_records where idempotency_key = 'hotel-create-duplicate')
    )::int as count
  `;
  if (duplicateResidue[0]?.count !== 0)
    throw new Error("duplicate hotel left transaction residue");

  const concurrentValue = {
    ...createInput,
    branchCode: "TEST-HOTEL-CONCURRENT",
    name: "위아히어 동시성호텔",
  };
  const concurrentActor = {
    companyId,
    sessionId,
    userId: actorUserId,
    userType: "INTERNAL_STAFF" as const,
  };
  const concurrentResults = await Promise.all([
    repository.createHotel({
      ...ids("000000000008"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000008",
      idempotencyKey: "hotel-create-concurrent",
      operationPath: "/api/hotels",
      requestHash: "create-request-hash-concurrent",
      value: concurrentValue,
    }),
    repository.createHotel({
      ...ids("000000000009"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000009",
      idempotencyKey: "hotel-create-concurrent",
      operationPath: "/api/hotels",
      requestHash: "create-request-hash-concurrent",
      value: concurrentValue,
    }),
  ]);
  const concurrentStatuses = concurrentResults
    .map((result) => result.status)
    .sort();
  if (concurrentStatuses.join(",") !== "CREATED,REPLAYED") {
    throw new Error(
      `concurrent idempotency was not serialized: ${concurrentStatuses.join(",")}`,
    );
  }
  const concurrentCounts = await testSql<
    { audits: number; hotels: number; records: number }[]
  >`
    select
      (select count(*)::int from branches where company_id = ${companyId} and branch_code = 'TEST-HOTEL-CONCURRENT') as hotels,
      (select count(*)::int from audit_events where company_id = ${companyId} and event_code = 'HOTEL_CREATED'
        and branch_id in ('51000000-0000-4000-8000-000000000008', '51000000-0000-4000-8000-000000000009')) as audits,
      (select count(*)::int from idempotency_records where company_id = ${companyId}
        and idempotency_key = 'hotel-create-concurrent') as records
  `;
  if (
    concurrentCounts[0]?.hotels !== 1 ||
    concurrentCounts[0].audits !== 1 ||
    concurrentCounts[0].records !== 1
  ) {
    throw new Error(
      "concurrent idempotency persisted more than one business result",
    );
  }

  const mismatchRaceResults = await Promise.all([
    repository.createHotel({
      ...ids("000000000020"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000020",
      idempotencyKey: "hotel-create-mismatch-race",
      operationPath: "/api/hotels",
      requestHash: "mismatch-race-a",
      value: {
        ...createInput,
        branchCode: "MISMATCH-RACE-A",
        name: "멱등 충돌 A",
      },
    }),
    repository.createHotel({
      ...ids("000000000021"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000021",
      idempotencyKey: "hotel-create-mismatch-race",
      operationPath: "/api/hotels",
      requestHash: "mismatch-race-b",
      value: {
        ...createInput,
        branchCode: "MISMATCH-RACE-B",
        name: "멱등 충돌 B",
      },
    }),
  ]);
  const mismatchRaceStatuses = mismatchRaceResults
    .map((result) => result.status)
    .sort();
  if (mismatchRaceStatuses.join(",") !== "CREATED,IDEMPOTENCY_CONFLICT") {
    throw new Error(
      `concurrent idempotency mismatch was not serialized: ${mismatchRaceStatuses.join(",")}`,
    );
  }
  const mismatchRaceCounts = await testSql<
    { audits: number; hotels: number; records: number }[]
  >`
    select
      (select count(*)::int from branches where company_id = ${companyId}
        and branch_code in ('MISMATCH-RACE-A', 'MISMATCH-RACE-B')) as hotels,
      (select count(*)::int from audit_events where company_id = ${companyId}
        and branch_id in ('51000000-0000-4000-8000-000000000020', '51000000-0000-4000-8000-000000000021')) as audits,
      (select count(*)::int from idempotency_records where company_id = ${companyId}
        and idempotency_key = 'hotel-create-mismatch-race') as records
  `;
  if (
    mismatchRaceCounts[0]?.hotels !== 1 ||
    mismatchRaceCounts[0].audits !== 1 ||
    mismatchRaceCounts[0].records !== 1
  ) {
    throw new Error(
      "concurrent idempotency mismatch left more than one business result",
    );
  }

  const sameNameRaceResults = await Promise.all([
    repository.createHotel({
      ...ids("000000000022"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000022",
      idempotencyKey: "hotel-create-name-race-a",
      operationPath: "/api/hotels",
      requestHash: "name-race-a",
      value: {
        ...createInput,
        branchCode: "NAME-RACE-A",
        name: "동일 활성 호텔명",
      },
    }),
    repository.createHotel({
      ...ids("000000000023"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000023",
      idempotencyKey: "hotel-create-name-race-b",
      operationPath: "/api/hotels",
      requestHash: "name-race-b",
      value: {
        ...createInput,
        branchCode: "NAME-RACE-B",
        name: " 동일 활성 호텔명 ",
      },
    }),
  ]);
  const sameNameRaceStatuses = sameNameRaceResults
    .map((result) => result.status)
    .sort();
  if (sameNameRaceStatuses.join(",") !== "CREATED,DUPLICATE") {
    throw new Error(
      `concurrent active hotel names were not constrained: ${sameNameRaceStatuses.join(",")}`,
    );
  }
  const sameNameRaceCounts = await testSql<
    { audits: number; hotels: number; records: number }[]
  >`
    select
      (select count(*)::int from branches where company_id = ${companyId}
        and lower(btrim(name)) = lower('동일 활성 호텔명')) as hotels,
      (select count(*)::int from audit_events where company_id = ${companyId}
        and branch_id in ('51000000-0000-4000-8000-000000000022', '51000000-0000-4000-8000-000000000023')) as audits,
      (select count(*)::int from idempotency_records where company_id = ${companyId}
        and idempotency_key in ('hotel-create-name-race-a', 'hotel-create-name-race-b')) as records
  `;
  if (
    sameNameRaceCounts[0]?.hotels !== 1 ||
    sameNameRaceCounts[0].audits !== 1 ||
    sameNameRaceCounts[0].records !== 1
  ) {
    throw new Error(
      "concurrent duplicate name failure left transaction residue",
    );
  }

  await testSql.unsafe(`
    create function hotel_test_fail_profile() returns trigger language plpgsql as $$
    begin
      if new.branch_id = '51000000-0000-4000-8000-000000000030'::uuid then
        raise exception 'profile failpoint' using errcode = 'P0001';
      end if;
      return new;
    end $$;
    create trigger hotel_test_fail_profile before insert on hotel_profiles
      for each row execute function hotel_test_fail_profile();
  `);
  let profileFailureRolledBack = false;
  try {
    await repository.createHotel({
      ...ids("000000000030"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000030",
      idempotencyKey: "hotel-create-profile-fail",
      operationPath: "/api/hotels",
      requestHash: "profile-fail",
      value: {
        ...createInput,
        branchCode: "PROFILE-FAIL",
        name: "프로필 실패 호텔",
      },
    });
  } catch {
    profileFailureRolledBack = true;
  } finally {
    await testSql.unsafe(
      "drop trigger hotel_test_fail_profile on hotel_profiles; drop function hotel_test_fail_profile();",
    );
  }
  if (!profileFailureRolledBack)
    throw new Error("profile failpoint did not fail hotel creation");

  await testSql.unsafe(`
    create function hotel_test_fail_audit() returns trigger language plpgsql as $$
    begin
      if new.branch_id = '51000000-0000-4000-8000-000000000031'::uuid then
        raise exception 'audit failpoint' using errcode = 'P0001';
      end if;
      return new;
    end $$;
    create trigger hotel_test_fail_audit before insert on audit_events
      for each row execute function hotel_test_fail_audit();
  `);
  let auditFailureRolledBack = false;
  try {
    await repository.createHotel({
      ...ids("000000000031"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000031",
      idempotencyKey: "hotel-create-audit-fail",
      operationPath: "/api/hotels",
      requestHash: "audit-fail",
      value: {
        ...createInput,
        branchCode: "AUDIT-FAIL",
        name: "감사 실패 호텔",
      },
    });
  } catch {
    auditFailureRolledBack = true;
  } finally {
    await testSql.unsafe(
      "drop trigger hotel_test_fail_audit on audit_events; drop function hotel_test_fail_audit();",
    );
  }
  if (!auditFailureRolledBack)
    throw new Error("audit failpoint did not fail hotel creation");

  await testSql.unsafe(`
    create function hotel_test_fail_completion() returns trigger language plpgsql as $$
    begin
      if new.idempotency_key = 'hotel-create-completion-fail' and new.status = 'COMPLETED' then
        raise exception 'completion failpoint' using errcode = 'P0001';
      end if;
      return new;
    end $$;
    create trigger hotel_test_fail_completion before insert on idempotency_records
      for each row execute function hotel_test_fail_completion();
  `);
  let completionFailureRolledBack = false;
  try {
    await repository.createHotel({
      ...ids("000000000032"),
      actor: concurrentActor,
      branchId: "51000000-0000-4000-8000-000000000032",
      idempotencyKey: "hotel-create-completion-fail",
      operationPath: "/api/hotels",
      requestHash: "completion-fail",
      value: {
        ...createInput,
        branchCode: "COMPLETION-FAIL",
        name: "멱등 완료 실패 호텔",
      },
    });
  } catch {
    completionFailureRolledBack = true;
  } finally {
    await testSql.unsafe(
      "drop trigger hotel_test_fail_completion on idempotency_records; drop function hotel_test_fail_completion();",
    );
  }
  if (!completionFailureRolledBack)
    throw new Error(
      "idempotency completion failpoint did not fail hotel creation",
    );

  const failpointResidue = await testSql<{ count: number }[]>`
    select (
      (select count(*) from branches where id in (
        '51000000-0000-4000-8000-000000000030',
        '51000000-0000-4000-8000-000000000031',
        '51000000-0000-4000-8000-000000000032'
      ))
      + (select count(*) from hotel_profiles where branch_id in (
        '51000000-0000-4000-8000-000000000030',
        '51000000-0000-4000-8000-000000000031',
        '51000000-0000-4000-8000-000000000032'
      ))
      + (select count(*) from audit_events where branch_id in (
        '51000000-0000-4000-8000-000000000030',
        '51000000-0000-4000-8000-000000000031',
        '51000000-0000-4000-8000-000000000032'
      ))
      + (select count(*) from idempotency_records where idempotency_key in (
        'hotel-create-profile-fail', 'hotel-create-audit-fail', 'hotel-create-completion-fail'
      ))
    )::int as count
  `;
  if (failpointResidue[0]?.count !== 0)
    throw new Error("hotel create failpoints left transaction residue");

  const auditRows = await testSql<
    { event_code: string; has_sensitive_fields: boolean }[]
  >`
    select event_code,
      (after_summary ?| array['roadAddress', 'detailAddress', 'representativePhone']) as has_sensitive_fields
    from audit_events
    where company_id = ${companyId} and branch_id = ${branchId}
      and event_code = 'HOTEL_CREATED'
  `;
  if (auditRows.length !== 1 || auditRows[0]?.has_sensitive_fields) {
    throw new Error(
      "hotel create audit was missing or contained sensitive contact/address fields",
    );
  }

  await testSql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '91000000-0000-4000-8000-000000000002', ${companyId}, ${branchId}, 'USER', ${actorUserId},
      'HOTEL_MANAGE', 'DENY', now() - interval '1 minute', ${actorUserId}, '호텔별 차단 테스트'
    )
  `;
  if (await repository.getHotel(actor, branchId)) {
    throw new Error("branch-specific deny did not override the company allow");
  }

  const forbiddenList = await repository.listHotels({
    companyId: otherCompanyId,
    sessionId,
    userId: otherUserId,
    userType: "INTERNAL_STAFF",
  });
  if (forbiddenList.status !== "FORBIDDEN") {
    throw new Error(
      "missing HOTEL_MANAGE was disguised as an empty hotel list",
    );
  }

  await testSql`
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '91000000-0000-4000-8000-000000000003', ${companyId}, 'USER', ${actorUserId},
      'HOTEL_MANAGE', 'DENY', now(), ${actorUserId}, '회사범위 거부 감사 테스트'
    )
  `;

  const deniedList = await repository.listHotels(actor, undefined, {
    auditEventId: "61000000-0000-4000-8000-000000000014",
    traceId: "81000000-0000-4000-8000-000000000014",
  });
  if (deniedList.status !== "FORBIDDEN")
    throw new Error("company HOTEL_MANAGE deny did not block the list");
  const listDeniedAudit = await testSql<{ count: number }[]>`
    select count(*)::int as count from audit_events
    where id = '61000000-0000-4000-8000-000000000014'
      and event_code = 'HOTEL_LIST_DENIED'
      and result = 'DENIED'
      and resource_id is null
  `;
  if (listDeniedAudit[0]?.count !== 1)
    throw new Error("hotel list denial was not audited");

  const forbidden = await repository.createHotel({
    ...ids("000000000007"),
    actor,
    branchId: "51000000-0000-4000-8000-000000000007",
    idempotencyKey: "hotel-create-forbidden",
    operationPath: "/api/hotels",
    requestHash: "create-request-hash-forbidden",
    value: { ...createInput, branchCode: "DENIED-01", name: "거부 대상 호텔" },
  });
  if (forbidden.status !== "FORBIDDEN")
    throw new Error("hotel create without HOTEL_MANAGE was accepted");
  const deniedAudit = await testSql<{ count: number }[]>`
    select count(*)::int as count from audit_events
    where id = '61000000-0000-4000-8000-000000000007'
      and event_code = 'HOTEL_CREATE_DENIED'
      and result = 'DENIED'
      and branch_id is null
      and resource_id is null
      and after_summary ? 'branchCode'
      and not (after_summary ? 'roadAddress')
      and not (after_summary ? 'representativePhone')
  `;
  if (deniedAudit[0]?.count !== 1)
    throw new Error("valid permission denial was not audited safely");
  await testSql`delete from permission_grants where id = '91000000-0000-4000-8000-000000000003'`;

  console.log("HOTEL_REPOSITORY_INTEGRATION_OK");
} finally {
  await repository.close();
  await testSql.end({ timeout: 1 });
}
