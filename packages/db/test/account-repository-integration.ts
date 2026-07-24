import { createPostgresAccountRepository } from "../src/accounts";
import { createPostgresAccountReconciliationRepository } from "../src/account-reconciliation";
import { createPostgresHotelRepository } from "../src/hotels";
import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL;
const probeUrl = process.env.TEST_PROBE_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");
if (!probeUrl) throw new Error("TEST_PROBE_URL is required");
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const repository = createPostgresAccountRepository(databaseUrl);
const hotelRepository = createPostgresHotelRepository(databaseUrl);
const reconciliationRepository =
  createPostgresAccountReconciliationRepository(probeUrl);

const companyId = "8a000000-0000-4000-8000-000000000001";
const actorId = "8a100000-0000-4000-8000-000000000001";
const targetAdminId = "8a100000-0000-4000-8000-000000000002";
const remainingAdminId = "8a100000-0000-4000-8000-000000000003";
const sessionId = "8a200000-0000-4000-8000-000000000001";
const identityId = "8a300000-0000-4000-8000-000000000001";
const roleId = "8a400000-0000-4000-8000-000000000001";
const groupId = "8a500000-0000-4000-8000-000000000001";
const hotelId = "8a510000-0000-4000-8000-000000000001";
const secondHotelId = "8a510000-0000-4000-8000-000000000002";
const actor = {
  companyId,
  sessionId,
  userId: actorId,
  userType: "INTERNAL_STAFF" as const,
};
const completionPayload = {
  action: "CREATE" as const,
  userId: "8a900000-0000-4000-8000-000000000001",
  displayName: "Recovered Account",
  loginName: "recoveredaccount",
  email: "recovered-account@example.invalid",
  userType: "HOUSEKEEPING" as const,
  hotelId,
  hotelIds: [hotelId, secondHotelId],
  assignmentStartDate: "2026-07-19",
  reason: "do-not-audit-free-text-sentinel",
};
const auditPasswordSentinel = "AuditPasswordValue-7vX9!DoNotPersist";
const auditTokenSentinel = "audit-token-value-4f81c7d2-do-not-persist";
const auditProviderBodySentinel = "provider-body-value-91e6-do-not-persist";
const auditProviderSubjectSentinel =
  "provider-subject-value-52a3-do-not-persist";
const sensitiveAuditPayload = {
  ...completionPayload,
  reason: [
    completionPayload.reason,
    auditPasswordSentinel,
    auditTokenSentinel,
    auditProviderBodySentinel,
  ].join(" | "),
};

try {
  await sql.begin(async (tx) => {
    await tx`insert into companies (id, legal_name, status) values (${companyId}, 'Account Integration', 'ACTIVE')`;
    await tx`
      insert into branches (id, company_id, branch_code, name, branch_type, status)
      values
      (${hotelId}, ${companyId}, 'ACCOUNT-HOTEL-01', 'Account Integration Hotel', 'HOTEL', 'ACTIVE'),
      (${secondHotelId}, ${companyId}, 'ACCOUNT-HOTEL-02', 'Account Integration Hotel 2', 'HOTEL', 'ACTIVE')
    `;
    await tx`
      insert into hotel_profiles (
        company_id, branch_id, hotel_status, road_address, detail_address,
        representative_phone, contract_start_date, contract_end_date
      ) values
      (
        ${companyId}, ${hotelId}, 'PREPARING', '서울특별시 계정통합로 1', '',
        '02-0000-0001', date '2026-01-01', date '2027-12-31'
      ),
      (
        ${companyId}, ${secondHotelId}, 'PREPARING', '서울특별시 계정통합로 2', '',
        '02-0000-0002', date '2026-01-01', date '2027-12-31'
      )
    `;
    await tx`
      insert into login_id_registry (login_id, company_id, target_user_id) values
      ('accountactor', ${companyId}, ${actorId}),
      ('accounttarget', ${companyId}, ${targetAdminId}),
      ('accountremaining', ${companyId}, ${remainingAdminId})
    `;
    await tx`
      insert into users (id, company_id, user_type, display_name, status, login_name, email) values
      (${actorId}, ${companyId}, 'INTERNAL_STAFF', 'Actor Admin', 'ACTIVE', 'accountactor', 'account-actor@example.invalid'),
      (${targetAdminId}, ${companyId}, 'INTERNAL_STAFF', 'Target Admin', 'ACTIVE', 'accounttarget', 'account-target@example.invalid'),
      (${remainingAdminId}, ${companyId}, 'INTERNAL_STAFF', 'Remaining Admin', 'ACTIVE', 'accountremaining', 'account-remaining@example.invalid')
    `;
    await tx`
      insert into auth_identities (id, company_id, user_id, provider, provider_subject)
      values
        (${identityId}, ${companyId}, ${actorId}, 'ZITADEL', 'account-integration-actor'),
        ('8a300000-0000-4000-8000-000000000002', ${companyId}, ${targetAdminId}, 'ZITADEL', 'zitadel-target-admin-subject'),
        ('8a300000-0000-4000-8000-000000000003', ${companyId}, ${remainingAdminId}, 'ZITADEL', 'zitadel-remaining-admin-subject')
    `;
    await tx`
      insert into auth_sessions (
        id, company_id, user_id, identity_id, token_hash,
        idle_expires_at, absolute_expires_at, auth_time, authentication_method
      ) values (
        ${sessionId}, ${companyId}, ${actorId}, ${identityId}, decode(repeat('ef', 32), 'hex'),
        now() + interval '8 hours', now() + interval '24 hours', now(), 'OIDC_PKCE'
      )
    `;
    await tx`insert into roles (id, company_id, name, status) values (${roleId}, ${companyId}, 'Account Reader', 'ACTIVE')`;
    await tx`insert into user_groups (id, company_id, name, status, created_by) values (${groupId}, ${companyId}, 'Account Creators', 'ACTIVE', ${actorId})`;
    await tx`
      insert into user_role_memberships (id, company_id, user_id, role_id, valid_from, granted_by, reason)
      values ('8a600000-0000-4000-8000-000000000001', ${companyId}, ${actorId}, ${roleId}, now() - interval '1 minute', ${actorId}, 'integration role')
    `;
    await tx`
      insert into user_group_memberships (id, company_id, group_id, user_id, valid_from, granted_by, reason)
      values ('8a700000-0000-4000-8000-000000000001', ${companyId}, ${groupId}, ${actorId}, now() - interval '1 minute', ${actorId}, 'integration group')
    `;
    await tx`
      insert into permission_grants (
        id, company_id, branch_id, subject_type, subject_id,
        permission_code, effect, valid_from, granted_by, reason
      ) values
      ('8a800000-0000-4000-8000-000000000001', ${companyId}, null, 'ROLE', ${roleId}, 'USER_READ', 'ALLOW', now() - interval '1 minute', ${actorId}, 'reader role'),
      ('8a800000-0000-4000-8000-000000000002', ${companyId}, null, 'GROUP', ${groupId}, 'USER_CREATE', 'ALLOW', now() - interval '1 minute', ${actorId}, 'creator group'),
      ('8a800000-0000-4000-8000-000000000003', ${companyId}, null, 'USER', ${actorId}, 'USER_SUSPEND', 'ALLOW', now() - interval '1 minute', ${actorId}, 'actor suspend'),
      ('8a800000-0000-4000-8000-000000000004', ${companyId}, null, 'USER', ${targetAdminId}, 'USER_SUSPEND', 'ALLOW', now() - interval '1 minute', ${actorId}, 'target admin'),
      ('8a800000-0000-4000-8000-000000000005', ${companyId}, null, 'USER', ${remainingAdminId}, 'USER_SUSPEND', 'ALLOW', now() - interval '1 minute', ${actorId}, 'remaining admin'),
      ('8a800000-0000-4000-8000-000000000010', ${companyId}, null, 'USER', ${actorId}, 'HOTEL_ASSIGNMENT_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorId}, 'account relationship integration'),
      ('8a800000-0000-4000-8000-000000000011', ${companyId}, null, 'USER', ${actorId}, 'HOTEL_OWNER_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorId}, 'account owner integration'),
      ('8a800000-0000-4000-8000-000000000012', ${companyId}, null, 'USER', ${actorId}, 'HOTEL_STATUS_MANAGE', 'ALLOW', now() - interval '1 minute', ${actorId}, 'hotel status integration')
    `;
  });

  await sql`
    insert into hotel_staff_assignments (
      id, company_id, branch_id, user_id, assignment_type,
      start_date, end_date, reason, created_by
    ) values (
      '8a520000-0000-4000-8000-000000000010', ${companyId}, ${hotelId}, ${actorId}, 'PRIMARY',
      date '2026-01-01', date '2026-01-31', 'overlap baseline', ${actorId}
    )
  `;
  let overlappingAssignmentRejected = false;
  try {
    await sql`
      insert into hotel_staff_assignments (
        id, company_id, branch_id, user_id, assignment_type,
        start_date, end_date, reason, created_by
      ) values (
        '8a520000-0000-4000-8000-000000000011', ${companyId}, ${hotelId}, ${actorId}, 'PRIMARY',
        date '2026-01-31', date '2026-02-10', 'overlap rejection', ${actorId}
      )
    `;
  } catch (error) {
    overlappingAssignmentRejected =
      (error as { code?: string }).code === "23P01";
  }
  if (!overlappingAssignmentRejected)
    throw new Error("overlapping primary hotel assignment was accepted");
  await sql`
    insert into hotel_staff_assignments (
      id, company_id, branch_id, user_id, assignment_type,
      start_date, end_date, reason, created_by
    ) values (
      '8a520000-0000-4000-8000-000000000012', ${companyId}, ${hotelId}, ${actorId}, 'PRIMARY',
      date '2026-02-01', date '2026-02-10', 'adjacent assignment', ${actorId}
    )
  `;

  const invalidAssignmentTarget = await hotelRepository.createAssignment({
    actor,
    assignmentId: "8a520000-0000-4000-8000-000000000019",
    auditEventId: "8ac00000-0000-4000-8000-000000000019",
    hotelId,
    idempotencyKey: "hotel-assignment-invalid-target-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000019",
    operationPath: `/api/hotels/${hotelId}/assignments`,
    requestHash: "hotel-assignment-invalid-target-hash",
    traceId: "8ae00000-0000-4000-8000-000000000019",
    value: {
      hotelVersion: 1,
      userId: "8a100000-0000-4000-8000-000000000099",
      relationshipType: "STAFF",
      assignmentType: "PRIMARY",
      startDate: "2026-03-01",
      reason: "invalid target must not change hotel version",
    },
  });
  if (invalidAssignmentTarget.status !== "NOT_FOUND") {
    throw new Error(
      `invalid assignment target was not rejected: ${invalidAssignmentTarget.status}`,
    );
  }
  const [versionAfterInvalidTarget] = await sql<{ version: number }[]>`
    select version from hotel_profiles
    where company_id = ${companyId} and branch_id = ${hotelId}
  `;
  if (versionAfterInvalidTarget?.version !== 1) {
    throw new Error("invalid assignment target changed hotel version");
  }

  const createdHotelAssignment = await hotelRepository.createAssignment({
    actor,
    assignmentId: "8a520000-0000-4000-8000-000000000020",
    auditEventId: "8ac00000-0000-4000-8000-000000000020",
    hotelId,
    idempotencyKey: "hotel-assignment-create-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000020",
    operationPath: `/api/hotels/${hotelId}/assignments`,
    requestHash: "hotel-assignment-create-hash",
    traceId: "8ae00000-0000-4000-8000-000000000020",
    value: {
      hotelVersion: 1,
      userId: targetAdminId,
      relationshipType: "STAFF",
      assignmentType: "PRIMARY",
      startDate: "2026-03-01",
      reason: "relationship integration create",
    },
  });
  if (
    createdHotelAssignment.status !== "CREATED" ||
    createdHotelAssignment.assignment.version !== 1
  ) {
    throw new Error(
      `hotel assignment create/read-back failed: ${createdHotelAssignment.status}`,
    );
  }
  const relationshipConflict = await hotelRepository.createAssignment({
    actor,
    assignmentId: "8a520000-0000-4000-8000-000000000021",
    auditEventId: "8ac00000-0000-4000-8000-000000000021",
    hotelId,
    idempotencyKey: "hotel-assignment-conflict-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000021",
    operationPath: `/api/hotels/${hotelId}/assignments`,
    requestHash: "hotel-assignment-conflict-hash",
    traceId: "8ae00000-0000-4000-8000-000000000021",
    value: {
      hotelVersion: 2,
      userId: targetAdminId,
      relationshipType: "STAFF",
      assignmentType: "PRIMARY",
      startDate: "2026-03-01",
      reason: "relationship integration overlap",
    },
  });
  if (relationshipConflict.status !== "RELATIONSHIP_CONFLICT") {
    throw new Error(
      `relationship overlap was not mapped to stable conflict: ${relationshipConflict.status}`,
    );
  }
  let nullTerminationReasonRejected = false;
  try {
    await sql`
      update hotel_staff_assignments
      set end_date = current_date,
          terminated_at = now(),
          termination_reason = null,
          terminated_by = ${actorId}
      where company_id = ${companyId}
        and id = ${createdHotelAssignment.assignment.id}
    `;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23514"
    ) {
      nullTerminationReasonRejected = true;
    } else {
      throw error;
    }
  }
  if (!nullTerminationReasonRejected) {
    throw new Error("NULL relationship termination reason was accepted");
  }
  const endedHotelAssignment = await hotelRepository.endAssignment({
    actor,
    assignmentId: createdHotelAssignment.assignment.id,
    auditEventId: "8ac00000-0000-4000-8000-000000000022",
    hotelId,
    idempotencyKey: "hotel-assignment-end-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000022",
    operationPath: `/api/hotels/${hotelId}/assignments/${createdHotelAssignment.assignment.id}/end`,
    requestHash: "hotel-assignment-end-hash",
    traceId: "8ae00000-0000-4000-8000-000000000022",
    value: {
      version: 1,
      emergency: true,
      reason: "relationship integration emergency end",
    },
  });
  if (
    endedHotelAssignment.status !== "ENDED" ||
    endedHotelAssignment.assignment.version !== 2 ||
    !endedHotelAssignment.assignment.terminatedAt
  ) {
    throw new Error(
      `hotel assignment emergency end/read-back failed: ${endedHotelAssignment.status}`,
    );
  }
  const staleHotelAssignmentEnd = await hotelRepository.endAssignment({
    actor,
    assignmentId: createdHotelAssignment.assignment.id,
    auditEventId: "8ac00000-0000-4000-8000-000000000023",
    hotelId,
    idempotencyKey: "hotel-assignment-stale-end-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000023",
    operationPath: `/api/hotels/${hotelId}/assignments/${createdHotelAssignment.assignment.id}/end`,
    requestHash: "hotel-assignment-stale-end-hash",
    traceId: "8ae00000-0000-4000-8000-000000000023",
    value: {
      version: 1,
      emergency: true,
      reason: "relationship integration stale end",
    },
  });
  if (staleHotelAssignmentEnd.status !== "VERSION_CONFLICT") {
    throw new Error(
      `stale hotel assignment end was not rejected: ${staleHotelAssignmentEnd.status}`,
    );
  }
  const activationReadiness = await hotelRepository.activateHotel({
    actor,
    assignmentId: hotelId,
    auditEventId: "8ac00000-0000-4000-8000-000000000024",
    hotelId,
    idempotencyKey: "hotel-activation-readiness-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000024",
    operationPath: `/api/hotels/${hotelId}/activate`,
    requestHash: "hotel-activation-readiness-hash",
    traceId: "8ae00000-0000-4000-8000-000000000024",
    value: { version: 2 },
  });
  if (
    activationReadiness.status !== "READINESS_REQUIRED" ||
    !activationReadiness.missing.includes("ROOM") ||
    !activationReadiness.missing.includes("CONTACT")
  ) {
    throw new Error("hotel activation did not fail closed with missing items");
  }
  const activationReplay = await hotelRepository.activateHotel({
    actor,
    assignmentId: hotelId,
    auditEventId: "8ac00000-0000-4000-8000-000000000025",
    hotelId,
    idempotencyKey: "hotel-activation-readiness-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000025",
    operationPath: `/api/hotels/${hotelId}/activate`,
    requestHash: "hotel-activation-readiness-hash",
    traceId: "8ae00000-0000-4000-8000-000000000025",
    value: { version: 2 },
  });
  if (
    activationReplay.status !== "READINESS_REQUIRED" ||
    activationReplay.missing.join(",") !== activationReadiness.missing.join(",")
  ) {
    throw new Error("hotel activation readiness replay was not stable");
  }

  const listed = await repository.listAccounts(actor, {
    page: 1,
    pageSize: 20,
  });
  if (listed.status !== "OK" || listed.accounts.length !== 3)
    throw new Error("role-based USER_READ was not effective");
  const eligibleHotels = await repository.listEligibleHotels(actor);
  if (
    eligibleHotels.status !== "OK" ||
    eligibleHotels.hotels.length !== 2 ||
    eligibleHotels.hotels[0]?.id !== hotelId ||
    eligibleHotels.hotels[1]?.id !== secondHotelId
  ) {
    throw new Error(
      "USER_CREATE eligible hotels were not tenant-scoped and deterministically sorted",
    );
  }
  await sql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id,
      permission_code, effect, valid_from, granted_by, reason
    ) values (
      '8a800000-0000-4000-8000-000000000006', ${companyId}, null, 'USER', ${actorId},
      'USER_CREATE', 'DENY', now() - interval '1 minute', ${actorId}, 'eligible hotel deny probe'
    )
  `;
  const deniedEligibleHotels = await repository.listEligibleHotels(actor);
  if (deniedEligibleHotels.status !== "FORBIDDEN") {
    throw new Error(
      "explicit USER_CREATE DENY did not block eligible hotel discovery",
    );
  }
  await sql`delete from permission_grants where id = '8a800000-0000-4000-8000-000000000006'`;
  const canonicalLastPage = await repository.listAccounts(actor, {
    page: 99,
    pageSize: 2,
  });
  if (
    canonicalLastPage.status !== "OK" ||
    canonicalLastPage.pagination.page !== 2 ||
    canonicalLastPage.pagination.totalPages !== 2 ||
    canonicalLastPage.accounts.length !== 1
  ) {
    throw new Error(
      "out-of-range account page was not canonicalized to the last page",
    );
  }
  const canonicalEmptyPage = await repository.listAccounts(actor, {
    page: 99,
    pageSize: 2,
    q: "없는사용자",
  });
  if (
    canonicalEmptyPage.status !== "OK" ||
    canonicalEmptyPage.pagination.page !== 1 ||
    canonicalEmptyPage.pagination.total !== 0 ||
    canonicalEmptyPage.accounts.length !== 0
  ) {
    throw new Error(
      "empty filtered account page was not canonicalized to page one",
    );
  }

  const invalidHotelReservation = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000090",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000090",
    hotelIds: ["8a510000-0000-4000-8000-000000000099"],
    completionPayload: {
      ...completionPayload,
      hotelId: "8a510000-0000-4000-8000-000000000099",
    },
    idempotencyKey: "invalid-hotel-create",
    requestHash: "invalid-hotel-create-hash",
  });
  if (
    (invalidHotelReservation as { status: string }).status !== "HOTEL_NOT_FOUND"
  ) {
    throw new Error(
      "out-of-tenant or missing hotel was not rejected before provider mutation",
    );
  }

  const reserved = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000001",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000001",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: sensitiveAuditPayload,
    idempotencyKey: "role-group-create",
    requestHash: "role-group-create-hash",
  });
  if (reserved.status !== "RESERVED_NOT_DISPATCHED")
    throw new Error("group-based USER_CREATE was not effective");
  const conflictingIdempotency = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000099",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000099",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: {
      ...completionPayload,
      displayName: "Conflicting Idempotency Account",
      loginName: "unclaimedaccount",
      email: "unclaimed-account@example.invalid",
    },
    idempotencyKey: "role-group-create",
    requestHash: "different-role-group-create-hash",
  });
  if (conflictingIdempotency.status !== "IDEMPOTENCY_CONFLICT") {
    throw new Error("changed idempotency payload was not rejected");
  }
  const [leakedClaim] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from login_id_registry
    where login_id = 'unclaimedaccount'
  `;
  if (leakedClaim?.count !== 0) {
    throw new Error(
      "failed idempotency request leaked an immutable login ID claim",
    );
  }

  const concurrentLoginNames = [
    "concurrentclaimone",
    "concurrentclaimtwo",
  ] as const;
  const concurrentReservations = await Promise.all(
    concurrentLoginNames.map((concurrentLoginName, index) => {
      const accountId = `8a900000-0000-4000-8000-${String(100 + index).padStart(12, "0")}`;
      return repository.reserveCreate({
        accountId,
        actor,
        attemptId: `8a910000-0000-4000-8000-${String(100 + index).padStart(12, "0")}`,
        hotelIds: [hotelId, secondHotelId],
        completionPayload: {
          ...completionPayload,
          displayName: `Concurrent Claim ${index + 1}`,
          loginName: concurrentLoginName,
          email: `${concurrentLoginName}@example.invalid`,
        },
        idempotencyKey: "concurrent-idempotency-claim",
        requestHash: `concurrent-request-hash-${index + 1}`,
      });
    }),
  );
  const concurrentStatuses = concurrentReservations
    .map((result) => result.status)
    .sort();
  if (
    JSON.stringify(concurrentStatuses) !==
    JSON.stringify(["IDEMPOTENCY_CONFLICT", "RESERVED_NOT_DISPATCHED"])
  ) {
    throw new Error(
      `concurrent idempotency serialization failed: ${concurrentStatuses.join(",")}`,
    );
  }
  const [concurrentClaims] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from login_id_registry
    where login_id in (${concurrentLoginNames[0]}, ${concurrentLoginNames[1]})
  `;
  if (concurrentClaims?.count !== 1) {
    throw new Error(
      "concurrent idempotency loser leaked an immutable login ID claim",
    );
  }

  if (
    (await repository.markCreateDispatched({
      accountId: "8a900000-0000-4000-8000-000000000001",
      companyId,
      leaseVersion: reserved.leaseVersion,
    })) !== "UPDATED"
  )
    throw new Error("group-based create was not durably dispatched");
  await repository.markProviderCreated({
    accountId: "8a900000-0000-4000-8000-000000000001",
    companyId,
    leaseVersion: reserved.leaseVersion,
    subject: "8a900000-0000-4000-8000-000000000001",
  });
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = '8a900000-0000-4000-8000-000000000001'
  `;
  const resumed = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000001",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000099",
    hotelIds: [hotelId, secondHotelId],
    completionPayload,
    idempotencyKey: "role-group-create",
    requestHash: "role-group-create-hash",
  });
  if (resumed.status !== "PROVIDER_CONFIRMED") {
    throw new Error(
      `provider-created attempt was not resumable: ${resumed.status}`,
    );
  }
  const unlinkedCompensationJobId = "6b100000-0000-4000-8000-000000000099";
  await sql`
    insert into outbox_jobs (id, company_id, job_type, payload, status)
    values (
      ${unlinkedCompensationJobId}, ${companyId}, 'ACCOUNT_PROVIDER_COMPENSATE',
      ${sql.json({
        action: "COMPENSATE",
        originalErrorCode: "ACCOUNT_DUPLICATE",
        providerSubject: "unlinked-provider-subject",
        provisioningAttemptId: "6a100000-0000-4000-8000-000000000099",
        userId: "6c100000-0000-4000-8000-000000000099",
      })},
      'PENDING'
    )
  `;
  const unlinkedExactClaim = await repository.claimExactProviderJob({
    companyId,
    sessionId: actor.sessionId,
    jobId: unlinkedCompensationJobId,
    expectedJobType: "ACCOUNT_PROVIDER_COMPENSATE",
  });
  if (unlinkedExactClaim.status !== "BUSY") {
    throw new Error(
      "unlinked compensation must not receive an API provider claim",
    );
  }
  const unlinkedBatchClaims = await reconciliationRepository.claimJobs(10);
  if (unlinkedBatchClaims.some((job) => job.id === unlinkedCompensationJobId)) {
    throw new Error(
      "unlinked compensation must not receive a reconciler provider claim",
    );
  }
  await sql`
    update outbox_jobs
    set status = 'DEAD_LETTER', last_error_code = 'UNLINKED_COMPENSATION_TEST',
        dead_lettered_at = now(), completed_at = now()
    where id = ${unlinkedCompensationJobId}
  `;
  await sql`
    update account_provisioning_attempts
    set completion_payload = completion_payload - 'traceId',
        provider_subject = ${auditProviderSubjectSentinel}
    where company_id = ${companyId}
      and target_user_id = '8a900000-0000-4000-8000-000000000001'
  `;

  const preparedCompensation = await repository.prepareCompensation({
    accountId: "8a900000-0000-4000-8000-000000000001",
    companyId,
    leaseVersion: resumed.leaseVersion,
    originalErrorCode: "ACCOUNT_DUPLICATE",
  });
  if (preparedCompensation.status !== "PREPARED")
    throw new Error("compensation was not durably prepared");
  const [legacyPreparedTrace] = await sql<
    { audit_trace_id: string; attempt_trace_id: string }[]
  >`
    select attempt.completion_payload->>'traceId' as attempt_trace_id,
           audit.trace_id::text as audit_trace_id
    from account_provisioning_attempts attempt
    join audit_events audit
      on audit.company_id = attempt.company_id
     and audit.resource_id = attempt.target_user_id
     and audit.event_code = 'ACCOUNT_CREATE_FAILED'
    where attempt.company_id = ${companyId}
      and attempt.target_user_id = '8a900000-0000-4000-8000-000000000001'
  `;
  if (
    !legacyPreparedTrace?.attempt_trace_id ||
    legacyPreparedTrace.audit_trace_id !== legacyPreparedTrace.attempt_trace_id
  ) {
    throw new Error(
      "legacy provider-confirmed attempt did not receive a durable trace backfill",
    );
  }
  const exactCompensationClaim = await repository.claimExactProviderJob({
    companyId,
    sessionId: actor.sessionId,
    jobId: preparedCompensation.providerJobId,
    expectedJobType: "ACCOUNT_PROVIDER_COMPENSATE",
  });
  if (
    exactCompensationClaim.status !== "CLAIMED" ||
    exactCompensationClaim.job.provisioningAttemptId !==
      "8a910000-0000-4000-8000-000000000001" ||
    exactCompensationClaim.job.providerSubject !==
      auditProviderSubjectSentinel ||
    exactCompensationClaim.job.originalErrorCode !== "ACCOUNT_DUPLICATE"
  ) {
    throw new Error(
      "API exact compensation claim lost saga ownership metadata",
    );
  }
  const compensationJobs = await reconciliationRepository.claimJobs(10);
  if (
    compensationJobs.some((job) => job.id === exactCompensationClaim.job.id)
  ) {
    throw new Error("reconciler double-claimed an API-owned compensation job");
  }
  const compensationFailed = await repository.markProviderJobFailed({
    companyId,
    sessionId: actor.sessionId,
    job: exactCompensationClaim.job,
    errorCode: "EXTERNAL_AUTH_UNAVAILABLE",
  });
  if (compensationFailed !== "UPDATED") {
    throw new Error("API exact compensation failure was not persisted");
  }
  const staleFailure = await repository.markProviderJobFailed({
    companyId,
    sessionId: actor.sessionId,
    job: exactCompensationClaim.job,
    errorCode: "EXTERNAL_AUTH_UNAVAILABLE",
  });
  if (staleFailure !== "STALE_CLAIM") {
    throw new Error("stale compensation failure marker was accepted");
  }
  await sql`
    update outbox_jobs set available_at = now()
    where company_id = ${companyId} and id = ${preparedCompensation.providerJobId}
  `;
  const retriedCompensationClaim = await repository.claimExactProviderJob({
    companyId,
    sessionId: actor.sessionId,
    jobId: preparedCompensation.providerJobId,
    expectedJobType: "ACCOUNT_PROVIDER_COMPENSATE",
  });
  if (
    retriedCompensationClaim.status !== "CLAIMED" ||
    retriedCompensationClaim.job.claimToken ===
      exactCompensationClaim.job.claimToken
  ) {
    throw new Error(
      "failed compensation was not reclaimed with a rotated token",
    );
  }
  const compensationMarked = await repository.markProviderJobSucceeded({
    companyId,
    sessionId: actor.sessionId,
    job: retriedCompensationClaim.job,
  });
  if (compensationMarked !== "UPDATED") {
    throw new Error("API exact compensation success was not persisted");
  }
  const compensationAudit = await sql<
    {
      after_summary: unknown;
      count: number;
      event_code: string;
      trace_id: string;
    }[]
  >`
    select event_code, count(*)::int as count, min(trace_id::text) as trace_id,
           jsonb_agg(after_summary order by occurred_at) as after_summary
    from audit_events
    where company_id = ${companyId}
      and resource_type = 'USER'
      and resource_id = '8a900000-0000-4000-8000-000000000001'
      and event_code in (
        'ACCOUNT_PROVISION_REQUESTED', 'ACCOUNT_CREATE_FAILED',
        'ACCOUNT_COMPENSATION_FAILED', 'ACCOUNT_COMPENSATION_SUCCEEDED'
      )
    group by event_code
    order by event_code
  `;
  const compensationAuditCounts = Object.fromEntries(
    compensationAudit.map((row) => [row.event_code, row.count]),
  );
  for (const code of [
    "ACCOUNT_PROVISION_REQUESTED",
    "ACCOUNT_CREATE_FAILED",
    "ACCOUNT_COMPENSATION_FAILED",
    "ACCOUNT_COMPENSATION_SUCCEEDED",
  ]) {
    if (compensationAuditCounts[code] !== 1) {
      throw new Error(`${code} audit event was not persisted exactly once`);
    }
  }
  if (
    compensationAudit.some((row) => !row.trace_id) ||
    JSON.stringify(compensationAudit).includes(
      "recovered-account@example.invalid",
    ) ||
    JSON.stringify(compensationAudit).includes("recoveredaccount")
  ) {
    throw new Error(
      "compensation audit metadata is missing or contains sensitive identity data",
    );
  }
  const [fullAuditDump] = await sql<{ rows: unknown }[]>`
    select jsonb_agg(to_jsonb(audit_events) order by occurred_at) as rows
    from audit_events
    where company_id = ${companyId}
      and resource_id = '8a900000-0000-4000-8000-000000000001'
  `;
  const serializedAuditDump = JSON.stringify(fullAuditDump?.rows ?? []);
  for (const forbidden of [
    "recovered-account@example.invalid",
    "recoveredaccount",
    "do-not-audit-free-text-sentinel",
    auditPasswordSentinel,
    auditTokenSentinel,
    auditProviderBodySentinel,
    auditProviderSubjectSentinel,
  ]) {
    if (serializedAuditDump.includes(forbidden)) {
      throw new Error(
        "account saga audit persisted forbidden sensitive metadata",
      );
    }
  }
  const [compensationAuditMetadata] = await sql<
    {
      actor_preserved: boolean;
      branch_scope_preserved: boolean;
      hotel_scope_preserved: boolean;
      reason_safe: boolean;
      session_preserved: boolean;
    }[]
  >`
    select
      bool_and(actor_user_id = ${actorId} and actor_type = 'INTERNAL_STAFF') as actor_preserved,
      bool_and(session_id = ${sessionId}) as session_preserved,
      bool_and(branch_id is null) as branch_scope_preserved,
      bool_and(after_summary->'hotelIds' = to_jsonb(array[${hotelId}::uuid, ${secondHotelId}::uuid])) as hotel_scope_preserved,
      bool_and(reason not like '%recoveredaccount%'
        and reason not like '%recovered-account@example.invalid%') as reason_safe
    from audit_events
    where company_id = ${companyId}
      and resource_id = '8a900000-0000-4000-8000-000000000001'
      and event_code in (
        'ACCOUNT_PROVISION_REQUESTED', 'ACCOUNT_CREATE_FAILED',
        'ACCOUNT_COMPENSATION_FAILED', 'ACCOUNT_COMPENSATION_SUCCEEDED'
      )
  `;
  if (
    !compensationAuditMetadata?.actor_preserved ||
    !compensationAuditMetadata.session_preserved ||
    !compensationAuditMetadata.branch_scope_preserved ||
    !compensationAuditMetadata.hotel_scope_preserved ||
    !compensationAuditMetadata.reason_safe
  ) {
    throw new Error(
      "account saga audit origin or multi-hotel metadata was not preserved safely",
    );
  }
  const compensatedReplay = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000099",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000097",
    hotelIds: [hotelId, secondHotelId],
    completionPayload,
    idempotencyKey: "role-group-create",
    requestHash: "role-group-create-hash",
  });
  if (
    compensatedReplay.status !== "COMPENSATED" ||
    compensatedReplay.originalErrorCode !== "ACCOUNT_DUPLICATE"
  ) {
    throw new Error(
      `compensated create replay was not terminal: ${compensatedReplay.status}`,
    );
  }
  await sql`
    update outbox_jobs
    set payload = jsonb_set(payload, '{originalErrorCode}', '"INTERNAL_ERROR"'::jsonb)
    where id = ${preparedCompensation.providerJobId}
  `;
  const internalCompensatedReplay = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000098",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000096",
    hotelIds: [hotelId, secondHotelId],
    completionPayload,
    idempotencyKey: "role-group-create",
    requestHash: "role-group-create-hash",
  });
  if (
    internalCompensatedReplay.status !== "COMPENSATED" ||
    internalCompensatedReplay.originalErrorCode !== "INTERNAL_ERROR"
  ) {
    throw new Error("compensated operational failure lost its original error");
  }
  const replayAuditCounts = await sql<{ count: number; event_code: string }[]>`
    select event_code, count(*)::int as count
    from audit_events
    where company_id = ${companyId}
      and resource_id = '8a900000-0000-4000-8000-000000000001'
      and event_code in (
        'ACCOUNT_PROVISION_REQUESTED', 'ACCOUNT_CREATE_FAILED',
        'ACCOUNT_COMPENSATION_FAILED', 'ACCOUNT_COMPENSATION_SUCCEEDED'
      )
    group by event_code
  `;
  if (
    replayAuditCounts.some((row) => row.count !== 1) ||
    replayAuditCounts.length !== 4
  ) {
    throw new Error("compensated create replay duplicated saga audit events");
  }

  const scheduledAuditAccountId = "8a900000-0000-4000-8000-000000000044";
  const scheduledAuditAttemptId = "8a910000-0000-4000-8000-000000000044";
  const scheduledAuditPayload = {
    ...completionPayload,
    userId: scheduledAuditAccountId,
    displayName: "Scheduled Compensation Audit",
    loginName: "scheduledcompensationaudit",
    email: "scheduled-compensation-audit@example.invalid",
  };
  const scheduledAuditReserved = await repository.reserveCreate({
    accountId: scheduledAuditAccountId,
    actor,
    attemptId: scheduledAuditAttemptId,
    hotelIds: [hotelId, secondHotelId],
    completionPayload: scheduledAuditPayload,
    idempotencyKey: "scheduled-compensation-audit",
    requestHash: "scheduled-compensation-audit-hash",
  });
  if (scheduledAuditReserved.status !== "RESERVED_NOT_DISPATCHED") {
    throw new Error("scheduled compensation audit fixture was not reserved");
  }
  if (
    (await repository.markCreateDispatched({
      accountId: scheduledAuditAccountId,
      companyId,
      leaseVersion: scheduledAuditReserved.leaseVersion,
    })) !== "UPDATED" ||
    (await repository.markProviderCreated({
      accountId: scheduledAuditAccountId,
      companyId,
      leaseVersion: scheduledAuditReserved.leaseVersion,
      subject: scheduledAuditAccountId,
    })) !== "UPDATED"
  ) {
    throw new Error(
      "scheduled compensation audit fixture was not provider-confirmed",
    );
  }
  const scheduledAuditPrepared = await repository.prepareCompensation({
    accountId: scheduledAuditAccountId,
    companyId,
    leaseVersion: scheduledAuditReserved.leaseVersion,
    originalErrorCode: "INTERNAL_ERROR",
  });
  if (scheduledAuditPrepared.status !== "PREPARED") {
    throw new Error("scheduled compensation audit fixture was not prepared");
  }
  await sql`
    update account_provisioning_attempts
    set completion_payload = completion_payload - 'traceId'
    where company_id = ${companyId} and id = ${scheduledAuditAttemptId}
  `;
  const scheduledFailureClaims = await reconciliationRepository.claimJobs(10);
  const scheduledFailureClaim = scheduledFailureClaims.find(
    (job) => job.id === scheduledAuditPrepared.providerJobId,
  );
  if (!scheduledFailureClaim) {
    throw new Error(
      "scheduled compensation audit failure claim was unavailable",
    );
  }
  await sql`
    alter table audit_events add constraint audit_events_test_reject_compensation_failed
    check (event_code <> 'ACCOUNT_COMPENSATION_FAILED') not valid
  `;
  let compensationAuditRollbackObserved = false;
  try {
    await reconciliationRepository.markFailed(
      scheduledFailureClaim,
      "EXTERNAL_AUTH_UNAVAILABLE",
    );
  } catch {
    compensationAuditRollbackObserved = true;
  } finally {
    await sql`
      alter table audit_events drop constraint audit_events_test_reject_compensation_failed
    `;
  }
  const [rolledBackCompensation] = await sql<
    { attempt_status: string; audit_count: number; job_status: string }[]
  >`
    select attempt.status as attempt_status, job.status as job_status,
           (select count(*)::int from audit_events audit
             where audit.company_id = ${companyId}
               and audit.resource_id = ${scheduledAuditAccountId}
               and audit.event_code = 'ACCOUNT_COMPENSATION_FAILED') as audit_count
    from account_provisioning_attempts attempt
    join outbox_jobs job
      on job.company_id = attempt.company_id
     and job.id = ${scheduledAuditPrepared.providerJobId}
    where attempt.company_id = ${companyId}
      and attempt.id = ${scheduledAuditAttemptId}
  `;
  if (
    !compensationAuditRollbackObserved ||
    rolledBackCompensation?.attempt_status !== "COMPENSATION_REQUIRED" ||
    rolledBackCompensation.job_status !== "PROCESSING" ||
    rolledBackCompensation.audit_count !== 0
  ) {
    throw new Error(
      "failed compensation audit did not roll back its state transition",
    );
  }
  await reconciliationRepository.markFailed(
    scheduledFailureClaim,
    "EXTERNAL_AUTH_UNAVAILABLE",
  );
  await sql`
    update outbox_jobs set available_at = now()
    where company_id = ${companyId} and id = ${scheduledAuditPrepared.providerJobId}
  `;
  const scheduledSuccessClaims = await reconciliationRepository.claimJobs(10);
  const scheduledSuccessClaim = scheduledSuccessClaims.find(
    (job) => job.id === scheduledAuditPrepared.providerJobId,
  );
  if (!scheduledSuccessClaim) {
    throw new Error(
      "scheduled compensation audit success claim was unavailable",
    );
  }
  await reconciliationRepository.markSucceeded(scheduledSuccessClaim);
  const scheduledAuditCounts = await sql<
    { count: number; event_code: string }[]
  >`
    select event_code, count(*)::int as count
    from audit_events
    where company_id = ${companyId}
      and resource_id = ${scheduledAuditAccountId}
      and event_code in (
        'ACCOUNT_PROVISION_REQUESTED', 'ACCOUNT_CREATE_FAILED',
        'ACCOUNT_COMPENSATION_FAILED', 'ACCOUNT_COMPENSATION_SUCCEEDED'
      )
    group by event_code
  `;
  if (
    scheduledAuditCounts.some((row) => row.count !== 1) ||
    scheduledAuditCounts.length !== 4
  ) {
    throw new Error(
      "scheduled compensation transitions did not persist exact audit events",
    );
  }
  const scheduledCompensationTraces = await sql<{ trace_id: string }[]>`
    select distinct trace_id::text as trace_id
    from audit_events
    where company_id = ${companyId}
      and resource_id = ${scheduledAuditAccountId}
      and event_code in ('ACCOUNT_COMPENSATION_FAILED', 'ACCOUNT_COMPENSATION_SUCCEEDED')
  `;
  if (
    scheduledCompensationTraces.length !== 1 ||
    scheduledCompensationTraces[0]?.trace_id !==
      scheduledAuditPrepared.providerJobId
  ) {
    throw new Error(
      "legacy active compensation did not use its durable job trace fallback",
    );
  }

  const ambiguousAuditAccountId = "8a900000-0000-4000-8000-000000000045";
  const ambiguousAuditReserved = await repository.reserveCreate({
    accountId: ambiguousAuditAccountId,
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000045",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: {
      ...completionPayload,
      displayName: "Ambiguous Provider Audit",
      loginName: "ambiguousprovideraudit",
      email: "ambiguous-provider-audit@example.invalid",
    },
    idempotencyKey: "ambiguous-provider-audit",
    requestHash: "ambiguous-provider-audit-hash",
  });
  if (ambiguousAuditReserved.status !== "RESERVED_NOT_DISPATCHED") {
    throw new Error("ambiguous provider audit fixture was not reserved");
  }
  if (
    (await repository.markCreateDispatched({
      accountId: ambiguousAuditAccountId,
      companyId,
      leaseVersion: ambiguousAuditReserved.leaseVersion,
    })) !== "UPDATED" ||
    (await repository.markCreateRecoveryRequired({
      accountId: ambiguousAuditAccountId,
      companyId,
      leaseVersion: ambiguousAuditReserved.leaseVersion,
      errorCode: "EXTERNAL_AUTH_UNAVAILABLE",
    })) !== "UPDATED"
  ) {
    throw new Error("ambiguous provider audit fixture did not enter recovery");
  }
  const [ambiguousAuditCounts] = await sql<
    { create_failed_count: number; requested_count: number }[]
  >`
    select
      count(*) filter (where event_code = 'ACCOUNT_PROVISION_REQUESTED')::int as requested_count,
      count(*) filter (where event_code = 'ACCOUNT_CREATE_FAILED')::int as create_failed_count
    from audit_events
    where company_id = ${companyId} and resource_id = ${ambiguousAuditAccountId}
  `;
  if (
    ambiguousAuditCounts?.requested_count !== 1 ||
    ambiguousAuditCounts.create_failed_count !== 0
  ) {
    throw new Error(
      "ambiguous provider recovery emitted a terminal create failure audit",
    );
  }

  const stalePayload = {
    ...completionPayload,
    displayName: "Stale Recovery Account",
    loginName: "staleaccount",
    email: "stale-account@example.invalid",
  };
  const staleReserved = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000002",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000002",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: stalePayload,
    idempotencyKey: "stale-create",
    requestHash: "stale-create-hash",
  });
  if (staleReserved.status !== "RESERVED_NOT_DISPATCHED")
    throw new Error("stale recovery fixture was not reserved");
  if (!("leaseVersion" in staleReserved))
    throw new Error("initial create lease has no fencing version");
  const staleLeaseVersion = staleReserved.leaseVersion;
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where id = '8a910000-0000-4000-8000-000000000002'
  `;
  const recoveredLease = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000002",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000098",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: stalePayload,
    idempotencyKey: "stale-create",
    requestHash: "stale-create-hash",
  });
  if (recoveredLease.status !== "RESERVED_NOT_DISPATCHED")
    throw new Error(
      `expired create lease was not recovered: ${recoveredLease.status}`,
    );
  if (
    !("leaseVersion" in recoveredLease) ||
    recoveredLease.leaseVersion <= staleLeaseVersion
  ) {
    throw new Error("create lease fencing version did not advance");
  }
  if (
    (await repository.markCreateDispatched({
      accountId: "8a900000-0000-4000-8000-000000000002",
      companyId,
      leaseVersion: recoveredLease.leaseVersion,
    })) !== "UPDATED"
  )
    throw new Error("recovered create was not durably dispatched");
  const staleMark = await repository.markProviderCreated({
    accountId: "8a900000-0000-4000-8000-000000000002",
    companyId,
    leaseVersion: staleLeaseVersion,
    subject: "8a900000-0000-4000-8000-000000000002",
  });
  if (staleMark !== "STALE_LEASE")
    throw new Error("stale create lease updated provider state");
  const currentMark = await repository.markProviderCreated({
    accountId: "8a900000-0000-4000-8000-000000000002",
    companyId,
    leaseVersion: recoveredLease.leaseVersion,
    subject: "8a900000-0000-4000-8000-000000000002",
  });
  if (currentMark !== "UPDATED")
    throw new Error("current create lease could not update provider state");
  await sql`
    update account_provisioning_attempts set status = 'COMPLETED', completed_at = now()
    where company_id = ${companyId} and target_user_id = '8a900000-0000-4000-8000-000000000002'
  `;
  const completedCompensation = await repository.prepareCompensation({
    accountId: "8a900000-0000-4000-8000-000000000002",
    companyId,
    leaseVersion: recoveredLease.leaseVersion,
    originalErrorCode: "ACCOUNT_DUPLICATE",
  });
  if (completedCompensation.status !== "STALE_LEASE")
    throw new Error("completed create acquired compensation ownership");
  const [completedAttempt] = await sql<{ status: string }[]>`
    select status from account_provisioning_attempts
    where company_id = ${companyId} and target_user_id = '8a900000-0000-4000-8000-000000000002'
  `;
  if (completedAttempt?.status !== "COMPLETED")
    throw new Error("completed create was overwritten by compensation");

  const recoveryPayload = {
    ...completionPayload,
    displayName: "Recovered Scheduled User",
    loginName: "recoveredscheduleduser",
    email: "recovered-scheduled-user@example.invalid",
  };
  const recoveryAccountId = "8a900000-0000-4000-8000-000000000003";
  const recoveryReserved = await repository.reserveCreate({
    accountId: recoveryAccountId,
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000003",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: recoveryPayload,
    idempotencyKey: "scheduled-create-recovery",
    requestHash: "scheduled-create-recovery-hash",
  });
  if (recoveryReserved.status !== "RESERVED_NOT_DISPATCHED")
    throw new Error("scheduled recovery fixture was not reserved");
  if (
    (await repository.markCreateDispatched({
      accountId: recoveryAccountId,
      companyId,
      leaseVersion: recoveryReserved.leaseVersion,
    })) !== "UPDATED"
  )
    throw new Error("scheduled recovery fixture was not dispatched");
  const recoveryMarked = await repository.markProviderCreated({
    accountId: recoveryAccountId,
    companyId,
    leaseVersion: recoveryReserved.leaseVersion,
    subject: recoveryAccountId,
  });
  if (recoveryMarked !== "UPDATED")
    throw new Error("scheduled recovery provider marker failed");
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = ${recoveryAccountId}
  `;
  const recoveryJobs =
    await reconciliationRepository.claimRecoverableCreates(10);
  const recoveryJob = recoveryJobs.find(
    (job) => job.userId === recoveryAccountId,
  );
  if (!recoveryJob || recoveryJob.status !== "PROVIDER_CONFIRMED") {
    throw new Error(
      "provider-created attempt was not claimed for scheduled DB completion",
    );
  }
  const recoveryCompletionInput = {
    accountId: recoveryJob.userId,
    ...(recoveryJob.originActorType
      ? { actorType: recoveryJob.originActorType }
      : {}),
    actorUserId: recoveryJob.actorUserId,
    assignmentIds: [
      "8a920000-0000-4000-8000-000000000003",
      "8a920000-0000-4000-8000-000000000004",
    ],
    auditEventId: "8aa00000-0000-4000-8000-000000000003",
    companyId: recoveryJob.companyId,
    idempotencyKey: recoveryJob.idempotencyKey,
    leaseVersion: recoveryJob.leaseVersion,
    ...(recoveryJob.originSessionId
      ? { sessionId: recoveryJob.originSessionId }
      : {}),
    subject: recoveryJob.userId,
    traceId: recoveryJob.traceId ?? recoveryJob.attemptId,
    value: recoveryJob.completionPayload,
  };
  let staleCompletionRejected = false;
  try {
    await repository.completeCreate({
      ...recoveryCompletionInput,
      leaseVersion: recoveryReserved.leaseVersion,
    });
  } catch {
    staleCompletionRejected = true;
  }
  if (!staleCompletionRejected)
    throw new Error("stale recovery generation completed an account");
  const staleCompensation = await repository.prepareCompensation({
    accountId: recoveryJob.userId,
    companyId: recoveryJob.companyId,
    leaseVersion: recoveryReserved.leaseVersion,
    originalErrorCode: "FORBIDDEN",
  });
  if (staleCompensation.status !== "STALE_LEASE")
    throw new Error(
      "stale recovery generation acquired compensation ownership",
    );
  await sql`update branches set status = 'INACTIVE' where company_id = ${companyId} and id = ${secondHotelId}`;
  const ineligibleCompletion = await repository.completeCreate(
    recoveryCompletionInput,
  );
  if (ineligibleCompletion.status !== "FORBIDDEN") {
    throw new Error(
      `inactive hotel completed an account: ${ineligibleCompletion.status}`,
    );
  }
  const [partialAccount] = await sql<{ count: number }[]>`
    select count(*)::int as count from users where company_id = ${companyId} and id = ${recoveryAccountId}
  `;
  if (partialAccount?.count !== 0)
    throw new Error("ineligible hotel completion persisted a partial account");
  await sql`update branches set status = 'ACTIVE' where company_id = ${companyId} and id = ${secondHotelId}`;
  const completionDenyGrantId = "8a800000-0000-4000-8000-000000000099";
  await sql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      ${completionDenyGrantId}, ${companyId}, null, 'USER', ${actorId},
      'USER_CREATE', 'DENY', now() - interval '1 minute',
      ${actorId}, 'completion user-create revocation integration'
    )
  `;
  const revokedPermissionCompletion = await repository.completeCreate(
    recoveryCompletionInput,
  );
  if (revokedPermissionCompletion.status !== "FORBIDDEN") {
    throw new Error(
      `revoked USER_CREATE permission completed an account: ${revokedPermissionCompletion.status}`,
    );
  }
  const [revokedPermissionResidue] = await sql<
    {
      completed_attempt_count: number;
      identity_count: number;
      relationship_count: number;
      success_audit_count: number;
      user_count: number;
    }[]
  >`
    select
      (select count(*)::int from users
       where company_id = ${companyId} and id = ${recoveryAccountId}) as user_count,
      (select count(*)::int from auth_identities
       where company_id = ${companyId} and user_id = ${recoveryAccountId}) as identity_count,
      (select count(*)::int from housekeeping_hotel_links
       where company_id = ${companyId} and user_id = ${recoveryAccountId}) as relationship_count,
      (select count(*)::int from audit_events
       where company_id = ${companyId} and resource_id = ${recoveryAccountId}
         and event_code = 'ACCOUNT_CREATED' and result = 'SUCCEEDED') as success_audit_count,
      (select count(*)::int from account_provisioning_attempts
       where company_id = ${companyId} and target_user_id = ${recoveryAccountId}
         and status = 'COMPLETED') as completed_attempt_count
  `;
  if (
    !revokedPermissionResidue ||
    Object.values(revokedPermissionResidue).some((count) => count !== 0)
  ) {
    throw new Error(
      "revoked USER_CREATE completion persisted local success residue",
    );
  }
  await sql`
    delete from permission_grants
    where company_id = ${companyId} and id = ${completionDenyGrantId}
  `;
  const relationshipDenyAccountId = "8a900000-0000-4000-8000-000000000004";
  const relationshipDenyPayload = {
    ...completionPayload,
    displayName: "Relationship Denied User",
    loginName: "relationshipdenieduser",
    email: "relationship-denied-user@example.invalid",
  };
  const relationshipDenyReserved = await repository.reserveCreate({
    accountId: relationshipDenyAccountId,
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000004",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: relationshipDenyPayload,
    idempotencyKey: "relationship-denied-create",
    requestHash: "relationship-denied-create-hash",
  });
  if (relationshipDenyReserved.status !== "RESERVED_NOT_DISPATCHED") {
    throw new Error("relationship-denied fixture was not reserved");
  }
  if (
    (await repository.markCreateDispatched({
      accountId: relationshipDenyAccountId,
      companyId,
      leaseVersion: relationshipDenyReserved.leaseVersion,
    })) !== "UPDATED"
  ) {
    throw new Error("relationship-denied fixture was not dispatched");
  }
  if (
    (await repository.markProviderCreated({
      accountId: relationshipDenyAccountId,
      companyId,
      leaseVersion: relationshipDenyReserved.leaseVersion,
      subject: relationshipDenyAccountId,
    })) !== "UPDATED"
  ) {
    throw new Error("relationship-denied provider marker failed");
  }
  const relationshipDenyGrantId = "8a800000-0000-4000-8000-000000000098";
  await sql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      ${relationshipDenyGrantId}, ${companyId}, null, 'USER', ${actorId},
      'HOTEL_ASSIGNMENT_MANAGE', 'DENY', now() - interval '1 minute',
      ${actorId}, 'completion relationship permission revocation integration'
    )
  `;
  const relationshipDeniedCompletion = await repository.completeCreate({
    accountId: relationshipDenyAccountId,
    actorUserId: actor.userId,
    actorType: actor.userType,
    assignmentIds: [
      "8a920000-0000-4000-8000-000000000005",
      "8a920000-0000-4000-8000-000000000006",
    ],
    auditEventId: "8aa00000-0000-4000-8000-000000000004",
    companyId,
    idempotencyKey: "relationship-denied-create",
    leaseVersion: relationshipDenyReserved.leaseVersion,
    sessionId: actor.sessionId,
    subject: relationshipDenyAccountId,
    traceId: "8ae00000-0000-4000-8000-000000000004",
    value: relationshipDenyPayload,
  });
  if (relationshipDeniedCompletion.status !== "FORBIDDEN") {
    throw new Error(
      `revoked relationship permission completed an account: ${relationshipDeniedCompletion.status}`,
    );
  }
  const [relationshipDenyResidue] = await sql<
    {
      completed_attempt_count: number;
      identity_count: number;
      relationship_count: number;
      success_audit_count: number;
      user_count: number;
    }[]
  >`
    select
      (select count(*)::int from users
       where company_id = ${companyId} and id = ${relationshipDenyAccountId}) as user_count,
      (select count(*)::int from auth_identities
       where company_id = ${companyId} and user_id = ${relationshipDenyAccountId}) as identity_count,
      (select count(*)::int from housekeeping_hotel_links
       where company_id = ${companyId} and user_id = ${relationshipDenyAccountId}) as relationship_count,
      (select count(*)::int from audit_events
       where company_id = ${companyId} and resource_id = ${relationshipDenyAccountId}
         and event_code = 'ACCOUNT_CREATED' and result = 'SUCCEEDED') as success_audit_count,
      (select count(*)::int from account_provisioning_attempts
       where company_id = ${companyId} and target_user_id = ${relationshipDenyAccountId}
         and status = 'COMPLETED') as completed_attempt_count
  `;
  if (
    !relationshipDenyResidue ||
    Object.values(relationshipDenyResidue).some((count) => count !== 0)
  ) {
    throw new Error(
      "revoked relationship completion persisted local success residue",
    );
  }
  await sql`
    delete from permission_grants
    where company_id = ${companyId} and id = ${relationshipDenyGrantId}
  `;

  const recoveredCreate = await repository.completeCreate(
    recoveryCompletionInput,
  );
  if (
    recoveredCreate.status !== "CREATED" ||
    recoveredCreate.account.id !== recoveryAccountId
  ) {
    throw new Error(
      `scheduled DB completion failed: ${recoveredCreate.status}`,
    );
  }
  const recoveredHotelIds =
    recoveredCreate.account.hotels?.map((hotel) => hotel.id).sort() ?? [];
  if (
    recoveredHotelIds.join(",") !== [hotelId, secondHotelId].sort().join(",")
  ) {
    throw new Error(
      "multi-hotel housekeeping assignments were not returned by account read-back",
    );
  }
  const recoveredLinks = await sql<{ branch_id: string }[]>`
    select branch_id from housekeeping_hotel_links
    where company_id = ${companyId} and user_id = ${recoveryAccountId}
    order by branch_id
  `;
  if (
    recoveredLinks.map((link) => link.branch_id).join(",") !==
    [hotelId, secondHotelId].sort().join(",")
  ) {
    throw new Error("multi-hotel housekeeping assignments were not persisted");
  }
  const [createdAudit] = await sql<
    { actor_type: string; session_id: string; trace_id: string }[]
  >`
    select actor_type, session_id::text as session_id, trace_id::text as trace_id
    from audit_events
    where company_id = ${companyId}
      and event_code = 'ACCOUNT_CREATED'
      and resource_id = ${recoveryAccountId}
  `;
  if (
    createdAudit?.actor_type !== recoveryJob.originActorType ||
    createdAudit?.session_id !== recoveryJob.originSessionId ||
    createdAudit?.trace_id !== recoveryJob.traceId
  ) {
    throw new Error("scheduled account-created audit lost its origin context");
  }

  const lateProviderAccountId = "8a900000-0000-4000-8000-000000000005";
  const lateProviderAttempt = await repository.reserveCreate({
    accountId: lateProviderAccountId,
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000005",
    hotelIds: [hotelId, secondHotelId],
    completionPayload: {
      ...completionPayload,
      displayName: "Late Provider User",
      loginName: "lateprovideruser",
      email: "late-provider-user@example.invalid",
    },
    idempotencyKey: "late-provider-recovery",
    requestHash: "late-provider-recovery-hash",
  });
  if (lateProviderAttempt.status !== "RESERVED_NOT_DISPATCHED")
    throw new Error("late provider recovery fixture was not reserved");
  if (
    (await repository.markCreateDispatched({
      accountId: lateProviderAccountId,
      companyId,
      leaseVersion: lateProviderAttempt.leaseVersion,
    })) !== "UPDATED"
  )
    throw new Error("late provider fixture was not dispatched");
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  const firstLateClaims =
    await reconciliationRepository.claimRecoverableCreates(10);
  const firstLateClaim = firstLateClaims.find(
    (job) => job.userId === lateProviderAccountId,
  );
  if (!firstLateClaim)
    throw new Error("late provider attempt was not initially claimable");
  await reconciliationRepository.markCreateMissing(firstLateClaim);
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  const repeatedLateClaims =
    await reconciliationRepository.claimRecoverableCreates(10);
  const repeatedLateClaim = repeatedLateClaims.find(
    (job) => job.userId === lateProviderAccountId,
  );
  if (!repeatedLateClaim || repeatedLateClaim.status !== "RECOVERY_REQUIRED") {
    throw new Error(
      "provider-not-visible attempt did not remain claimable during grace",
    );
  }
  await reconciliationRepository.markCreateMissing(repeatedLateClaim);
  await sql`
    update account_provisioning_attempts
    set created_at = now() - interval '2 days',
        expires_at = now() - interval '1 second',
        lease_expires_at = now() - interval '2 seconds'
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  const expiredLateClaims =
    await reconciliationRepository.claimRecoverableCreates(10);
  const expiredLateClaim = expiredLateClaims.find(
    (job) => job.userId === lateProviderAccountId,
  );
  if (!expiredLateClaim)
    throw new Error(
      "expired provider recovery was not claimed for terminal evidence",
    );
  await reconciliationRepository.markCreateMissing(expiredLateClaim);
  const [lateTerminal] = await sql<
    { operator_reason: string | null; status: string }[]
  >`
    select status, operator_reason from account_provisioning_attempts
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  if (
    lateTerminal?.status !== "OPERATOR_REQUIRED" ||
    lateTerminal.operator_reason !== "PROVIDER_NOT_FOUND_AFTER_GRACE"
  ) {
    throw new Error(
      "provider-not-found evidence did not enter operator-required sweep state",
    );
  }
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  const operatorSweepClaims =
    await reconciliationRepository.claimRecoverableCreates(10);
  if (
    !operatorSweepClaims.some(
      (job) =>
        job.userId === lateProviderAccountId &&
        job.status === "OPERATOR_REQUIRED",
    )
  ) {
    throw new Error(
      "operator-required orphan was not retained in the long-horizon sweep",
    );
  }

  const pendingUserId = "8a100000-0000-4000-8000-000000000004";
  const pendingSessionId = "8a200000-0000-4000-8000-000000000004";
  await sql.begin(async (tx) => {
    await tx`
      insert into login_id_registry (login_id, company_id, target_user_id)
      values ('pendingsetup', ${companyId}, ${pendingUserId})
    `;
    await tx`
      insert into users (id, company_id, user_type, display_name, status, login_name, email, must_change_password)
      values (${pendingUserId}, ${companyId}, 'ROOM_OPERATIONS', 'Pending Setup', 'PENDING_SETUP',
              'pendingsetup', 'pending-setup@example.invalid', true)
    `;
    await tx`
      insert into auth_identities (id, company_id, user_id, provider, provider_subject)
      values ('8a300000-0000-4000-8000-000000000004', ${companyId}, ${pendingUserId}, 'ZITADEL', ${pendingUserId})
    `;
    await tx`
      insert into auth_sessions (
        id, company_id, user_id, identity_id, token_hash,
        idle_expires_at, absolute_expires_at, auth_time, authentication_method
      ) values (
        ${pendingSessionId}, ${companyId}, ${pendingUserId}, '8a300000-0000-4000-8000-000000000004',
        decode(repeat('f0', 32), 'hex'), now() + interval '8 hours', now() + interval '24 hours', now(), 'OIDC_PKCE'
      )
    `;
  });
  const legacyAliasFiltered = await repository.listAccounts(actor, {
    page: 1,
    pageSize: 20,
    userType: "HOUSEKEEPING",
  });
  if (
    legacyAliasFiltered.status !== "OK" ||
    !legacyAliasFiltered.accounts.some(
      (account) => account.id === pendingUserId,
    )
  ) {
    throw new Error(
      "legacy HOUSEKEEPING storage alias was not filterable through the new API type",
    );
  }
  const passwordRepository = repository as unknown as {
    reserveInitialPassword(input: {
      companyId: string;
      userId: string;
      sessionId: string;
      idempotencyKey: string;
    }): Promise<{
      status: string;
      subject?: string;
      loginName?: string;
      idempotencyKey?: string;
      leaseVersion?: number;
    }>;
    markInitialPasswordDispatched(input: {
      companyId: string;
      userId: string;
      idempotencyKey: string;
      leaseVersion: number;
    }): Promise<"UPDATED" | "STALE_LEASE">;
    confirmInitialPasswordProviderState(input: {
      companyId: string;
      userId: string;
      idempotencyKey: string;
      leaseVersion: number;
    }): Promise<"UPDATED" | "STALE_LEASE">;
    markInitialPasswordProviderUpdated(input: {
      companyId: string;
      userId: string;
      idempotencyKey: string;
      leaseVersion: number;
    }): Promise<"UPDATED" | "STALE_LEASE">;
    completeInitialPassword(input: {
      companyId: string;
      userId: string;
      sessionId: string;
      idempotencyKey: string;
      auditEventId: string;
      traceId: string;
    }): Promise<{ status: string }>;
  };
  const passwordReserved = await passwordRepository.reserveInitialPassword({
    companyId,
    userId: pendingUserId,
    sessionId: pendingSessionId,
    idempotencyKey: "initial-password-change",
  });
  if (
    passwordReserved.status !== "RESERVED_NOT_DISPATCHED" ||
    passwordReserved.subject !== pendingUserId ||
    passwordReserved.leaseVersion !== 1
  ) {
    throw new Error(
      `initial password was not reserved before provider mutation: ${passwordReserved.status}`,
    );
  }
  if (
    (await passwordRepository.markInitialPasswordDispatched({
      companyId,
      userId: pendingUserId,
      idempotencyKey: "initial-password-change",
      leaseVersion: 1,
    })) !== "UPDATED"
  )
    throw new Error("initial password mutation was not durably dispatched");
  await sql`
    update initial_password_change_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and user_id = ${pendingUserId}
      and idempotency_key = 'initial-password-change'
  `;
  const expiredSameAttempt = await passwordRepository.reserveInitialPassword({
    companyId,
    userId: pendingUserId,
    sessionId: pendingSessionId,
    idempotencyKey: "initial-password-change",
  });
  if (expiredSameAttempt.status !== "RECOVERY_REQUIRED") {
    throw new Error(
      "expired initial-password attempt did not enter recovery-required state",
    );
  }
  const competingAttempt = await passwordRepository.reserveInitialPassword({
    companyId,
    userId: pendingUserId,
    sessionId: pendingSessionId,
    idempotencyKey: "competing-password-change",
  });
  if (
    competingAttempt.status !== "RECOVERY_CONFIRMABLE" ||
    competingAttempt.idempotencyKey !== "initial-password-change" ||
    competingAttempt.leaseVersion !== 1 ||
    competingAttempt.subject !== pendingUserId ||
    competingAttempt.loginName !== "pendingsetup"
  ) {
    throw new Error(
      "recovery-required initial-password attempt was not exposed for credential proof",
    );
  }
  const stalePasswordMarker =
    await passwordRepository.markInitialPasswordProviderUpdated({
      companyId,
      userId: pendingUserId,
      idempotencyKey: "competing-password-change",
      leaseVersion: 2,
    });
  if (stalePasswordMarker !== "STALE_LEASE")
    throw new Error("unverified recovery changed the provider marker");
  const confirmedPasswordMarker =
    await passwordRepository.confirmInitialPasswordProviderState({
      companyId,
      userId: pendingUserId,
      idempotencyKey: "initial-password-change",
      leaseVersion: 1,
    });
  if (confirmedPasswordMarker !== "UPDATED")
    throw new Error("verified password state was not accepted");
  const passwordResumed = await passwordRepository.reserveInitialPassword({
    companyId,
    userId: pendingUserId,
    sessionId: pendingSessionId,
    idempotencyKey: "initial-password-change",
  });
  if (passwordResumed.status !== "PROVIDER_UPDATED")
    throw new Error(
      `provider-updated password attempt was not resumable: ${passwordResumed.status}`,
    );
  const passwordCompleted = await passwordRepository.completeInitialPassword({
    companyId,
    userId: pendingUserId,
    sessionId: pendingSessionId,
    idempotencyKey: "initial-password-change",
    auditEventId: "8aa00000-0000-4000-8000-000000000099",
    traceId: "8ab00000-0000-4000-8000-000000000099",
  });
  if (passwordCompleted.status !== "UPDATED")
    throw new Error(
      `initial password local completion failed: ${passwordCompleted.status}`,
    );
  const [activated] = await sql<
    { status: string; must_change_password: boolean }[]
  >`
    select status, must_change_password from users where company_id = ${companyId} and id = ${pendingUserId}
  `;
  if (activated?.status !== "ACTIVE" || activated.must_change_password)
    throw new Error("initial password state was not read back as ACTIVE");
  const [setupSession] = await sql<
    { revoke_reason: string | null; revoked_at: Date | null }[]
  >`
    select revoked_at, revoke_reason from auth_sessions
    where company_id = ${companyId} and id = ${pendingSessionId}
  `;
  if (
    !setupSession?.revoked_at ||
    setupSession.revoke_reason !== "INITIAL_PASSWORD_CHANGED"
  ) {
    throw new Error(
      "current setup session was not revoked with the initial-password reason",
    );
  }
  const [passwordCompletion] = await sql<
    { attempt_status: string; audit_count: number }[]
  >`
    select
      (select status from initial_password_change_attempts
       where company_id = ${companyId} and user_id = ${pendingUserId}
         and idempotency_key = 'initial-password-change') as attempt_status,
      (select count(*)::int from audit_events
       where company_id = ${companyId}
         and id = '8aa00000-0000-4000-8000-000000000099'
         and event_code = 'ACCOUNT_INITIAL_PASSWORD_CHANGED'
         and result = 'SUCCEEDED') as audit_count
  `;
  if (
    passwordCompletion?.attempt_status !== "COMPLETED" ||
    passwordCompletion.audit_count !== 1
  ) {
    throw new Error(
      "initial password completion did not atomically persist attempt and audit state",
    );
  }

  const deactivationRollbackSessionId = "8a400000-0000-4000-8000-000000000099";
  await sql`
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      ${deactivationRollbackSessionId}, ${companyId}, ${targetAdminId},
      '8a300000-0000-4000-8000-000000000002', decode(repeat('d7', 32), 'hex'),
      now() + interval '8 hours', now() + interval '24 hours', now(), 'OIDC_PKCE'
    )
  `;
  await sql`
    alter table audit_events add constraint audit_events_test_reject_session_revoked
    check (event_code <> 'ACCOUNT_SESSION_REVOKED') not valid
  `;
  let deactivationAuditRollbackObserved = false;
  try {
    await repository.deactivateAccount({
      actor,
      auditEventId: "8aa00000-0000-4000-8000-000000000099",
      idempotencyKey: "deactivate-audit-rollback-probe",
      targetUserId: targetAdminId,
      traceId: "8ab00000-0000-4000-8000-000000000099",
      value: { version: 1, reason: "do-not-audit-deactivation-sentinel" },
    });
  } catch {
    deactivationAuditRollbackObserved = true;
  } finally {
    await sql`
      alter table audit_events drop constraint audit_events_test_reject_session_revoked
    `;
  }
  const [deactivationRollback] = await sql<
    { outbox_count: number; revoked_at: Date | null; user_status: string }[]
  >`
    select target.status as user_status, session.revoked_at,
           (select count(*)::int from outbox_jobs job
             where job.company_id = ${companyId}
               and job.job_type = 'ACCOUNT_PROVIDER_DEACTIVATE'
               and job.payload->>'userId' = ${targetAdminId}) as outbox_count
    from users target
    join auth_sessions session
      on session.company_id = target.company_id
     and session.id = ${deactivationRollbackSessionId}
    where target.company_id = ${companyId} and target.id = ${targetAdminId}
  `;
  if (
    !deactivationAuditRollbackObserved ||
    deactivationRollback?.user_status !== "ACTIVE" ||
    deactivationRollback.revoked_at !== null ||
    deactivationRollback.outbox_count !== 0
  ) {
    throw new Error(
      "failed session-revoked audit did not roll back deactivation state",
    );
  }

  const first = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000001",
    idempotencyKey: "deactivate-target-admin",
    targetUserId: targetAdminId,
    traceId: "8ab00000-0000-4000-8000-000000000001",
    value: { version: 1, reason: "integration deactivation" },
  });
  if (first.status !== "UPDATED" || first.account.status !== "INACTIVE") {
    throw new Error(`non-last admin deactivation failed: ${first.status}`);
  }
  const [pendingOutbox] = await sql<
    { count: number; provider_subject: string | null }[]
  >`
    select count(*)::int as count, min(payload->>'providerSubject') as provider_subject from outbox_jobs
    where company_id = ${companyId}
      and job_type = 'ACCOUNT_PROVIDER_DEACTIVATE'
      and payload->>'userId' = ${targetAdminId}
      and payload->>'idempotencyKey' = 'deactivate-target-admin'
      and status = 'PENDING'
  `;
  if (
    pendingOutbox?.count !== 1 ||
    pendingOutbox.provider_subject !== "zitadel-target-admin-subject"
  ) {
    throw new Error(
      "provider deactivation intent did not preserve the tenant-bound provider subject",
    );
  }
  const foreignCompanyClaim = await repository.claimExactProviderJob({
    companyId: "10000000-0000-4000-8000-000000000099",
    sessionId: actor.sessionId,
    jobId: first.providerJobId,
    expectedJobType: "ACCOUNT_PROVIDER_DEACTIVATE",
  });
  if (foreignCompanyClaim.status !== "NOT_FOUND") {
    throw new Error("foreign company claimed a provider deactivation job");
  }
  const wrongTypeClaim = await repository.claimExactProviderJob({
    companyId,
    sessionId: actor.sessionId,
    jobId: first.providerJobId,
    expectedJobType: "ACCOUNT_PROVIDER_COMPENSATE",
  });
  if (wrongTypeClaim.status !== "NOT_FOUND") {
    throw new Error("wrong provider job type acquired exact ownership");
  }
  const exactDeactivationClaim = await repository.claimExactProviderJob({
    companyId,
    sessionId: actor.sessionId,
    jobId: first.providerJobId,
    expectedJobType: "ACCOUNT_PROVIDER_DEACTIVATE",
  });
  if (
    exactDeactivationClaim.status !== "CLAIMED" ||
    exactDeactivationClaim.job.providerSubject !==
      "zitadel-target-admin-subject"
  ) {
    throw new Error(
      "API exact deactivation claim did not preserve provider ownership",
    );
  }
  const claimedJobs = await reconciliationRepository.claimJobs(10);
  if (claimedJobs.some((job) => job.id === exactDeactivationClaim.job.id)) {
    throw new Error("reconciler double-claimed an API-owned deactivation job");
  }
  await sql`
    update outbox_jobs set locked_at = now() - interval '6 minutes'
    where company_id = ${companyId} and id = ${exactDeactivationClaim.job.id}
  `;
  const reclaimedJobs = await reconciliationRepository.claimJobs(10);
  const winningClaim = reclaimedJobs.find(
    (job) => job.id === exactDeactivationClaim.job.id,
  );
  if (!winningClaim)
    throw new Error("stale provider deactivation claim was not reclaimed");
  if (exactDeactivationClaim.job.claimToken === winningClaim.claimToken) {
    throw new Error(
      "reclaimed provider deactivation job did not rotate its claim token",
    );
  }
  const staleMarker = await repository.markProviderJobSucceeded({
    companyId,
    sessionId: actor.sessionId,
    job: exactDeactivationClaim.job,
  });
  if (staleMarker !== "STALE_CLAIM") {
    throw new Error("stale API worker completed a newer provider claim");
  }
  await reconciliationRepository.markSucceeded(winningClaim);
  const [succeededOutbox] = await sql<{ count: number }[]>`
    select count(*)::int as count from outbox_jobs
    where company_id = ${companyId}
      and job_type = 'ACCOUNT_PROVIDER_DEACTIVATE'
      and payload->>'userId' = ${targetAdminId}
      and status = 'SUCCEEDED'
  `;
  if (succeededOutbox?.count !== 1)
    throw new Error("provider deactivation success was not persisted");

  const deadLetterJobId = "8ac00000-0000-4000-8000-000000000008";
  await sql`
    insert into outbox_jobs (
      id, company_id, job_type, payload, status, attempt_count, available_at
    ) values (
      ${deadLetterJobId}, ${companyId}, 'ACCOUNT_PROVIDER_DEACTIVATE',
      ${sql.json({
        userId: targetAdminId,
        providerSubject: "zitadel-target-admin-subject",
        idempotencyKey: "dead-letter-integration",
        action: "DEACTIVATE",
      })},
      'PENDING', 7, now()
    )
  `;
  const deadLetterClaims = await reconciliationRepository.claimJobs(10);
  const deadLetterClaim = deadLetterClaims.find(
    (job) => job.id === deadLetterJobId,
  );
  if (!deadLetterClaim)
    throw new Error("eighth-attempt outbox job was not claimable");
  await reconciliationRepository.markFailed(
    deadLetterClaim,
    "EXTERNAL_AUTH_UNAVAILABLE",
  );
  const [deadLettered] = await sql<
    {
      claim_token: string | null;
      dead_lettered_at: Date | null;
      status: string;
    }[]
  >`
    select status, claim_token, dead_lettered_at from outbox_jobs
    where company_id = ${companyId} and id = ${deadLetterJobId}
  `;
  if (
    deadLettered?.status !== "DEAD_LETTER" ||
    !deadLettered.dead_lettered_at ||
    deadLettered.claim_token !== null
  ) {
    throw new Error(
      "eighth outbox failure did not enter fenced dead-letter state",
    );
  }

  const replay = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000002",
    idempotencyKey: "deactivate-target-admin",
    targetUserId: targetAdminId,
    traceId: "8ab00000-0000-4000-8000-000000000002",
    value: { version: 1, reason: "integration deactivation" },
  });
  if (
    replay.status !== "REPLAYED" ||
    replay.account.version !== first.account.version ||
    replay.providerJobId !== first.providerJobId ||
    replay.providerJobStatus !== "SUCCEEDED"
  ) {
    throw new Error(`deactivation replay was not stable: ${replay.status}`);
  }
  const [sessionRevokedAudit] = await sql<
    {
      actor_type: string;
      actor_user_id: string;
      after_summary: { revokedCount?: number };
      count: number;
      reason: string;
      session_id: string;
      trace_id: string;
    }[]
  >`
    select count(*)::int as count,
           min(actor_user_id::text) as actor_user_id,
           min(actor_type) as actor_type,
           min(session_id::text) as session_id,
           min(reason) as reason,
           min(trace_id::text) as trace_id,
           (jsonb_agg(after_summary order by occurred_at)->0) as after_summary
    from audit_events
    where company_id = ${companyId}
      and resource_type = 'USER'
      and resource_id = ${targetAdminId}
      and event_code = 'ACCOUNT_SESSION_REVOKED'
  `;
  if (
    sessionRevokedAudit?.count !== 1 ||
    sessionRevokedAudit.actor_user_id !== actorId ||
    sessionRevokedAudit.actor_type !== "INTERNAL_STAFF" ||
    sessionRevokedAudit.session_id !== sessionId ||
    sessionRevokedAudit.reason !== "ACCOUNT_DEACTIVATED" ||
    sessionRevokedAudit.trace_id !== "8ab00000-0000-4000-8000-000000000001" ||
    typeof sessionRevokedAudit.after_summary.revokedCount !== "number"
  ) {
    throw new Error(
      "session revocation audit was not persisted exactly once with the original trace",
    );
  }

  const conflict = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000003",
    idempotencyKey: "deactivate-target-admin",
    targetUserId: targetAdminId,
    traceId: "8ab00000-0000-4000-8000-000000000003",
    value: { version: 1, reason: "different request" },
  });
  if ((conflict as { status: string }).status !== "IDEMPOTENCY_CONFLICT")
    throw new Error("deactivation idempotency conflict was not rejected");

  const secondAdmin = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000004",
    idempotencyKey: "deactivate-second-admin",
    targetUserId: remainingAdminId,
    traceId: "8ab00000-0000-4000-8000-000000000004",
    value: { version: 1, reason: "actor remains active" },
  });
  if (secondAdmin.status !== "UPDATED")
    throw new Error(`second admin deactivation failed: ${secondAdmin.status}`);

  const last = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000005",
    idempotencyKey: "deactivate-last-admin",
    targetUserId: actorId,
    traceId: "8ab00000-0000-4000-8000-000000000005",
    value: { version: 1, reason: "must remain active" },
  });
  if (last.status !== "LAST_ADMIN")
    throw new Error(`last admin was not protected: ${last.status}`);

  const previousOwnerId = "8a100000-0000-4000-8000-000000000020";
  const nextOwnerId = "8a100000-0000-4000-8000-000000000021";
  const previousOwnerSessionId = "8a200000-0000-4000-8000-000000000020";
  await sql.begin(async (tx) => {
    await tx`
      insert into login_id_registry (login_id, company_id, target_user_id) values
      ('previousowner', ${companyId}, ${previousOwnerId}),
      ('nextowner', ${companyId}, ${nextOwnerId})
    `;
    await tx`
      insert into users (id, company_id, user_type, display_name, status, login_name, email) values
      (${previousOwnerId}, ${companyId}, 'HOTEL_OWNER', 'Previous Owner', 'ACTIVE', 'previousowner', 'previous-owner@example.invalid'),
      (${nextOwnerId}, ${companyId}, 'HOTEL_OWNER', 'Next Owner', 'ACTIVE', 'nextowner', 'next-owner@example.invalid')
    `;
    await tx`
      insert into auth_identities (id, company_id, user_id, provider, provider_subject) values
      ('8a300000-0000-4000-8000-000000000020', ${companyId}, ${previousOwnerId}, 'ZITADEL', 'previous-owner-subject'),
      ('8a300000-0000-4000-8000-000000000021', ${companyId}, ${nextOwnerId}, 'ZITADEL', 'next-owner-subject')
    `;
    await tx`
      insert into auth_sessions (
        id, company_id, user_id, identity_id, token_hash,
        idle_expires_at, absolute_expires_at, auth_time, authentication_method
      ) values (
        ${previousOwnerSessionId}, ${companyId}, ${previousOwnerId},
        '8a300000-0000-4000-8000-000000000020', decode(repeat('9c', 32), 'hex'),
        now() + interval '8 hours', now() + interval '24 hours', now(), 'OIDC_PKCE'
      )
    `;
    await tx`
      insert into hotel_owner_assignments (
        id, company_id, branch_id, user_id, start_date, reason, created_by
      ) values (
        '8a520000-0000-4000-8000-000000000030', ${companyId}, ${hotelId},
        ${previousOwnerId}, current_date, 'owner transfer baseline', ${actorId}
      )
    `;
  });
  await sql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      '8a800000-0000-4000-8000-000000000098', ${companyId}, ${hotelId},
      'USER', ${previousOwnerId}, 'HOTEL_OWNER_MANAGE', 'ALLOW',
      now() - interval '1 minute', ${actorId}, 'self owner transfer integration'
    )
  `;
  const previousOwnerActor = {
    companyId,
    sessionId: previousOwnerSessionId,
    userId: previousOwnerId,
    userType: "HOTEL_OWNER" as const,
  };
  const transferredOwner = await hotelRepository.transferOwner({
    actor: previousOwnerActor,
    assignmentId: "8a520000-0000-4000-8000-000000000031",
    auditEventId: "8ac00000-0000-4000-8000-000000000031",
    hotelId,
    idempotencyKey: "hotel-owner-transfer-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000031",
    operationPath: `/api/hotels/${hotelId}/owner-transfer`,
    requestHash: "hotel-owner-transfer-hash",
    traceId: "8ae00000-0000-4000-8000-000000000031",
    value: {
      version: 2,
      newOwnerUserId: nextOwnerId,
      reason: "owner transfer integration",
    },
  });
  if (
    transferredOwner.status !== "TRANSFERRED" ||
    transferredOwner.assignment.userId !== nextOwnerId
  ) {
    throw new Error(
      `owner transfer/read-back failed: ${transferredOwner.status}`,
    );
  }
  const [previousOwnerSession] = await sql<
    { revoke_reason: string | null; revoked_at: Date | null }[]
  >`
    select revoked_at, revoke_reason from auth_sessions
    where company_id = ${companyId} and id = ${previousOwnerSessionId}
  `;
  if (
    !previousOwnerSession?.revoked_at ||
    previousOwnerSession.revoke_reason !== "HOTEL_OWNER_TRANSFERRED"
  ) {
    throw new Error("previous owner session was not revoked atomically");
  }
  const sameOwnerTransfer = await hotelRepository.transferOwner({
    actor,
    assignmentId: "8a520000-0000-4000-8000-000000000033",
    auditEventId: "8ac00000-0000-4000-8000-000000000033",
    hotelId,
    idempotencyKey: "hotel-owner-same-owner-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000033",
    operationPath: `/api/hotels/${hotelId}/owner-transfer`,
    requestHash: "hotel-owner-same-owner-hash",
    traceId: "8ae00000-0000-4000-8000-000000000033",
    value: {
      version: 3,
      newOwnerUserId: nextOwnerId,
      reason: "same owner must not revoke current access",
    },
  });
  if (sameOwnerTransfer.status !== "RELATIONSHIP_CONFLICT") {
    throw new Error(
      `same-owner transfer was not rejected: ${sameOwnerTransfer.status}`,
    );
  }
  await sql`
    update auth_sessions set auth_time = now() - interval '6 minutes'
    where company_id = ${companyId} and id = ${sessionId}
  `;
  const staleReauthTransfer = await hotelRepository.transferOwner({
    actor,
    assignmentId: "8a520000-0000-4000-8000-000000000032",
    auditEventId: "8ac00000-0000-4000-8000-000000000032",
    hotelId,
    idempotencyKey: "hotel-owner-stale-reauth-integration",
    idempotencyRecordId: "8ad00000-0000-4000-8000-000000000032",
    operationPath: `/api/hotels/${hotelId}/owner-transfer`,
    requestHash: "hotel-owner-stale-reauth-hash",
    traceId: "8ae00000-0000-4000-8000-000000000032",
    value: {
      version: 3,
      newOwnerUserId: previousOwnerId,
      reason: "stale reauthentication must fail",
    },
  });
  if (staleReauthTransfer.status !== "REAUTHENTICATION_REQUIRED") {
    throw new Error(
      `stale owner transfer was not rejected: ${staleReauthTransfer.status}`,
    );
  }

  console.log("ACCOUNT_REPOSITORY_INTEGRATION_OK");
} finally {
  await reconciliationRepository.close();
  await hotelRepository.close?.();
  await repository.close?.();
  await sql.end({ timeout: 1 });
}
