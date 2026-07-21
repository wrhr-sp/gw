import { createPostgresAccountRepository } from "../src/accounts";
import { createPostgresAccountReconciliationRepository } from "../src/account-reconciliation";
import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL;
const probeUrl = process.env.TEST_PROBE_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");
if (!probeUrl) throw new Error("TEST_PROBE_URL is required");
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const repository = createPostgresAccountRepository(databaseUrl);
const reconciliationRepository = createPostgresAccountReconciliationRepository(probeUrl);

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
const actor = { companyId, sessionId, userId: actorId, userType: "INTERNAL_STAFF" as const };
const completionPayload = {
  displayName: "Recovered Account",
  loginName: "recovered-account",
  email: "recovered-account@example.invalid",
  userType: "HOUSEKEEPING" as const,
  hotelId,
  hotelIds: [hotelId, secondHotelId],
  assignmentStartDate: "2026-07-19",
  reason: "account integration recovery",
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
      insert into users (id, company_id, user_type, display_name, status, login_name, email) values
      (${actorId}, ${companyId}, 'INTERNAL_STAFF', 'Actor Admin', 'ACTIVE', 'account-actor', 'account-actor@example.invalid'),
      (${targetAdminId}, ${companyId}, 'INTERNAL_STAFF', 'Target Admin', 'ACTIVE', 'account-target', 'account-target@example.invalid'),
      (${remainingAdminId}, ${companyId}, 'INTERNAL_STAFF', 'Remaining Admin', 'ACTIVE', 'account-remaining', 'account-remaining@example.invalid')
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
      ('8a800000-0000-4000-8000-000000000005', ${companyId}, null, 'USER', ${remainingAdminId}, 'USER_SUSPEND', 'ALLOW', now() - interval '1 minute', ${actorId}, 'remaining admin')
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
    overlappingAssignmentRejected = (error as { code?: string }).code === "23P01";
  }
  if (!overlappingAssignmentRejected) throw new Error("overlapping primary hotel assignment was accepted");
  await sql`
    insert into hotel_staff_assignments (
      id, company_id, branch_id, user_id, assignment_type,
      start_date, end_date, reason, created_by
    ) values (
      '8a520000-0000-4000-8000-000000000012', ${companyId}, ${hotelId}, ${actorId}, 'PRIMARY',
      date '2026-02-01', date '2026-02-10', 'adjacent assignment', ${actorId}
    )
  `;

  const listed = await repository.listAccounts(actor, { page: 1, pageSize: 20 });
  if (listed.status !== "OK" || listed.accounts.length !== 3) throw new Error("role-based USER_READ was not effective");
  const canonicalLastPage = await repository.listAccounts(actor, { page: 99, pageSize: 2 });
  if (canonicalLastPage.status !== "OK"
    || canonicalLastPage.pagination.page !== 2
    || canonicalLastPage.pagination.totalPages !== 2
    || canonicalLastPage.accounts.length !== 1) {
    throw new Error("out-of-range account page was not canonicalized to the last page");
  }
  const canonicalEmptyPage = await repository.listAccounts(actor, { page: 99, pageSize: 2, q: "없는사용자" });
  if (canonicalEmptyPage.status !== "OK"
    || canonicalEmptyPage.pagination.page !== 1
    || canonicalEmptyPage.pagination.total !== 0
    || canonicalEmptyPage.accounts.length !== 0) {
    throw new Error("empty filtered account page was not canonicalized to page one");
  }

  const invalidHotelReservation = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000090",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000090",
    hotelIds: ["8a510000-0000-4000-8000-000000000099"],
    completionPayload: { ...completionPayload, hotelId: "8a510000-0000-4000-8000-000000000099" },
    idempotencyKey: "invalid-hotel-create",
    requestHash: "invalid-hotel-create-hash",
  });
  if ((invalidHotelReservation as { status: string }).status !== "HOTEL_NOT_FOUND") {
    throw new Error("out-of-tenant or missing hotel was not rejected before provider mutation");
  }

  const reserved = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000001",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000001",
    hotelIds: [hotelId, secondHotelId],
    completionPayload,
    idempotencyKey: "role-group-create",
    requestHash: "role-group-create-hash",
  });
  if (reserved.status !== "RESERVED_NOT_DISPATCHED") throw new Error("group-based USER_CREATE was not effective");
  if (await repository.markCreateDispatched({
    accountId: "8a900000-0000-4000-8000-000000000001",
    companyId,
    leaseVersion: reserved.leaseVersion,
  }) !== "UPDATED") throw new Error("group-based create was not durably dispatched");
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
    throw new Error(`provider-created attempt was not resumable: ${resumed.status}`);
  }
  const preparedCompensation = await repository.prepareCompensation({
    accountId: "8a900000-0000-4000-8000-000000000001",
    companyId,
    leaseVersion: resumed.leaseVersion,
  });
  if (preparedCompensation !== "UPDATED") throw new Error("compensation was not durably prepared");
  const finalizedCompensation = await repository.markCompensated({
    accountId: "8a900000-0000-4000-8000-000000000001",
    companyId,
    leaseVersion: resumed.leaseVersion,
  });
  if (finalizedCompensation !== "UPDATED") throw new Error("compensation was not finalized");
  const compensatedReplay = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000099",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000097",
    hotelIds: [hotelId, secondHotelId],
    completionPayload,
    idempotencyKey: "role-group-create",
    requestHash: "role-group-create-hash",
  });
  if ((compensatedReplay as { status: string }).status !== "COMPENSATED") {
    throw new Error(`compensated create replay was not terminal: ${compensatedReplay.status}`);
  }

  const staleReserved = await repository.reserveCreate({
    accountId: "8a900000-0000-4000-8000-000000000002",
    actor,
    attemptId: "8a910000-0000-4000-8000-000000000002",
    hotelIds: [hotelId, secondHotelId],
    completionPayload,
    idempotencyKey: "stale-create",
    requestHash: "stale-create-hash",
  });
  if (staleReserved.status !== "RESERVED_NOT_DISPATCHED") throw new Error("stale recovery fixture was not reserved");
  if (!("leaseVersion" in staleReserved)) throw new Error("initial create lease has no fencing version");
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
    completionPayload,
    idempotencyKey: "stale-create",
    requestHash: "stale-create-hash",
  });
  if (recoveredLease.status !== "RESERVED_NOT_DISPATCHED") throw new Error(`expired create lease was not recovered: ${recoveredLease.status}`);
  if (!("leaseVersion" in recoveredLease) || recoveredLease.leaseVersion <= staleLeaseVersion) {
    throw new Error("create lease fencing version did not advance");
  }
  if (await repository.markCreateDispatched({
    accountId: "8a900000-0000-4000-8000-000000000002",
    companyId,
    leaseVersion: recoveredLease.leaseVersion,
  }) !== "UPDATED") throw new Error("recovered create was not durably dispatched");
  const staleMark = await repository.markProviderCreated({
    accountId: "8a900000-0000-4000-8000-000000000002",
    companyId,
    leaseVersion: staleLeaseVersion,
    subject: "8a900000-0000-4000-8000-000000000002",
  });
  if (staleMark !== "STALE_LEASE") throw new Error("stale create lease updated provider state");
  const currentMark = await repository.markProviderCreated({
    accountId: "8a900000-0000-4000-8000-000000000002",
    companyId,
    leaseVersion: recoveredLease.leaseVersion,
    subject: "8a900000-0000-4000-8000-000000000002",
  });
  if (currentMark !== "UPDATED") throw new Error("current create lease could not update provider state");
  await sql`
    update account_provisioning_attempts set status = 'COMPLETED', completed_at = now()
    where company_id = ${companyId} and target_user_id = '8a900000-0000-4000-8000-000000000002'
  `;
  const completedCompensation = await repository.prepareCompensation({
    accountId: "8a900000-0000-4000-8000-000000000002",
    companyId,
    leaseVersion: recoveredLease.leaseVersion,
  });
  if (completedCompensation !== "STALE_LEASE") throw new Error("completed create acquired compensation ownership");
  const [completedAttempt] = await sql<{ status: string }[]>`
    select status from account_provisioning_attempts
    where company_id = ${companyId} and target_user_id = '8a900000-0000-4000-8000-000000000002'
  `;
  if (completedAttempt?.status !== "COMPLETED") throw new Error("completed create was overwritten by compensation");

  const recoveryPayload = {
    ...completionPayload,
    displayName: "Recovered Scheduled User",
    loginName: "recovered-scheduled-user",
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
  if (recoveryReserved.status !== "RESERVED_NOT_DISPATCHED") throw new Error("scheduled recovery fixture was not reserved");
  if (await repository.markCreateDispatched({
    accountId: recoveryAccountId,
    companyId,
    leaseVersion: recoveryReserved.leaseVersion,
  }) !== "UPDATED") throw new Error("scheduled recovery fixture was not dispatched");
  const recoveryMarked = await repository.markProviderCreated({
    accountId: recoveryAccountId,
    companyId,
    leaseVersion: recoveryReserved.leaseVersion,
    subject: recoveryAccountId,
  });
  if (recoveryMarked !== "UPDATED") throw new Error("scheduled recovery provider marker failed");
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = ${recoveryAccountId}
  `;
  const recoveryJobs = await reconciliationRepository.claimRecoverableCreates(10);
  const recoveryJob = recoveryJobs.find((job) => job.userId === recoveryAccountId);
  if (!recoveryJob || recoveryJob.status !== "PROVIDER_CONFIRMED") {
    throw new Error("provider-created attempt was not claimed for scheduled DB completion");
  }
  const recoveryCompletionInput = {
    accountId: recoveryJob.userId,
    actorUserId: recoveryJob.actorUserId,
    assignmentIds: [
      "8a920000-0000-4000-8000-000000000003",
      "8a920000-0000-4000-8000-000000000004",
    ],
    auditEventId: "8aa00000-0000-4000-8000-000000000003",
    companyId: recoveryJob.companyId,
    idempotencyKey: recoveryJob.idempotencyKey,
    leaseVersion: recoveryJob.leaseVersion,
    subject: recoveryJob.userId,
    traceId: "8ab00000-0000-4000-8000-000000000003",
    value: recoveryJob.completionPayload,
  };
  let staleCompletionRejected = false;
  try {
    await repository.completeCreate({ ...recoveryCompletionInput, leaseVersion: recoveryReserved.leaseVersion });
  } catch {
    staleCompletionRejected = true;
  }
  if (!staleCompletionRejected) throw new Error("stale recovery generation completed an account");
  const staleCompensation = await repository.prepareCompensation({
    accountId: recoveryJob.userId,
    companyId: recoveryJob.companyId,
    leaseVersion: recoveryReserved.leaseVersion,
  });
  if (staleCompensation !== "STALE_LEASE") throw new Error("stale recovery generation acquired compensation ownership");
  await sql`update branches set status = 'INACTIVE' where company_id = ${companyId} and id = ${secondHotelId}`;
  const ineligibleCompletion = await repository.completeCreate(recoveryCompletionInput);
  if (ineligibleCompletion.status !== "FORBIDDEN") {
    throw new Error(`inactive hotel completed an account: ${ineligibleCompletion.status}`);
  }
  const [partialAccount] = await sql<{ count: number }[]>`
    select count(*)::int as count from users where company_id = ${companyId} and id = ${recoveryAccountId}
  `;
  if (partialAccount?.count !== 0) throw new Error("ineligible hotel completion persisted a partial account");
  await sql`update branches set status = 'ACTIVE' where company_id = ${companyId} and id = ${secondHotelId}`;
  const recoveredCreate = await repository.completeCreate(recoveryCompletionInput);
  if (recoveredCreate.status !== "CREATED" || recoveredCreate.account.id !== recoveryAccountId) {
    throw new Error(`scheduled DB completion failed: ${recoveredCreate.status}`);
  }
  const recoveredHotelIds = recoveredCreate.account.hotels?.map((hotel) => hotel.id).sort() ?? [];
  if (recoveredHotelIds.join(",") !== [hotelId, secondHotelId].sort().join(",")) {
    throw new Error("multi-hotel housekeeping assignments were not returned by account read-back");
  }
  const recoveredLinks = await sql<{ branch_id: string }[]>`
    select branch_id from housekeeping_hotel_links
    where company_id = ${companyId} and user_id = ${recoveryAccountId}
    order by branch_id
  `;
  if (recoveredLinks.map((link) => link.branch_id).join(",") !== [hotelId, secondHotelId].sort().join(",")) {
    throw new Error("multi-hotel housekeeping assignments were not persisted");
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
      loginName: "late-provider-user",
      email: "late-provider-user@example.invalid",
    },
    idempotencyKey: "late-provider-recovery",
    requestHash: "late-provider-recovery-hash",
  });
  if (lateProviderAttempt.status !== "RESERVED_NOT_DISPATCHED") throw new Error("late provider recovery fixture was not reserved");
  if (await repository.markCreateDispatched({
    accountId: lateProviderAccountId,
    companyId,
    leaseVersion: lateProviderAttempt.leaseVersion,
  }) !== "UPDATED") throw new Error("late provider fixture was not dispatched");
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  const firstLateClaims = await reconciliationRepository.claimRecoverableCreates(10);
  const firstLateClaim = firstLateClaims.find((job) => job.userId === lateProviderAccountId);
  if (!firstLateClaim) throw new Error("late provider attempt was not initially claimable");
  await reconciliationRepository.markCreateMissing(firstLateClaim);
  await sql`
    update account_provisioning_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  const repeatedLateClaims = await reconciliationRepository.claimRecoverableCreates(10);
  if (repeatedLateClaims.some((job) => job.userId === lateProviderAccountId)) {
    throw new Error("provider-not-found operator terminal remained automatically claimable");
  }
  const [lateTerminal] = await sql<{ operator_reason: string | null; status: string }[]>`
    select status, operator_reason from account_provisioning_attempts
    where company_id = ${companyId} and target_user_id = ${lateProviderAccountId}
  `;
  if (lateTerminal?.status !== "OPERATOR_REQUIRED" || lateTerminal.operator_reason !== "PROVIDER_NOT_FOUND") {
    throw new Error("provider-not-found evidence did not enter operator-required terminal state");
  }

  const pendingUserId = "8a100000-0000-4000-8000-000000000004";
  const pendingSessionId = "8a200000-0000-4000-8000-000000000004";
  await sql.begin(async (tx) => {
    await tx`
      insert into users (id, company_id, user_type, display_name, status, login_name, email, must_change_password)
      values (${pendingUserId}, ${companyId}, 'ROOM_OPERATIONS', 'Pending Setup', 'PENDING_SETUP',
              'pending-setup', 'pending-setup@example.invalid', true)
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
  if (legacyAliasFiltered.status !== "OK"
    || !legacyAliasFiltered.accounts.some((account) => account.id === pendingUserId)) {
    throw new Error("legacy HOUSEKEEPING storage alias was not filterable through the new API type");
  }
  const passwordRepository = repository as unknown as {
    reserveInitialPassword(input: { companyId: string; userId: string; sessionId: string; idempotencyKey: string }): Promise<{ status: string; subject?: string; loginName?: string; idempotencyKey?: string; leaseVersion?: number }>;
    markInitialPasswordDispatched(input: { companyId: string; userId: string; idempotencyKey: string; leaseVersion: number }): Promise<"UPDATED" | "STALE_LEASE">;
    confirmInitialPasswordProviderState(input: { companyId: string; userId: string; idempotencyKey: string; leaseVersion: number }): Promise<"UPDATED" | "STALE_LEASE">;
    markInitialPasswordProviderUpdated(input: { companyId: string; userId: string; idempotencyKey: string; leaseVersion: number }): Promise<"UPDATED" | "STALE_LEASE">;
    completeInitialPassword(input: { companyId: string; userId: string; sessionId: string; idempotencyKey: string; auditEventId: string; traceId: string }): Promise<{ status: string }>;
  };
  const passwordReserved = await passwordRepository.reserveInitialPassword({
    companyId, userId: pendingUserId, sessionId: pendingSessionId, idempotencyKey: "initial-password-change",
  });
  if (passwordReserved.status !== "RESERVED_NOT_DISPATCHED" || passwordReserved.subject !== pendingUserId || passwordReserved.leaseVersion !== 1) {
    throw new Error(`initial password was not reserved before provider mutation: ${passwordReserved.status}`);
  }
  if (await passwordRepository.markInitialPasswordDispatched({
    companyId, userId: pendingUserId, idempotencyKey: "initial-password-change", leaseVersion: 1,
  }) !== "UPDATED") throw new Error("initial password mutation was not durably dispatched");
  await sql`
    update initial_password_change_attempts set lease_expires_at = now() - interval '1 second'
    where company_id = ${companyId} and user_id = ${pendingUserId}
      and idempotency_key = 'initial-password-change'
  `;
  const expiredSameAttempt = await passwordRepository.reserveInitialPassword({
    companyId, userId: pendingUserId, sessionId: pendingSessionId, idempotencyKey: "initial-password-change",
  });
  if (expiredSameAttempt.status !== "RECOVERY_REQUIRED") {
    throw new Error("expired initial-password attempt did not enter recovery-required state");
  }
  const competingAttempt = await passwordRepository.reserveInitialPassword({
    companyId, userId: pendingUserId, sessionId: pendingSessionId, idempotencyKey: "competing-password-change",
  });
  if (competingAttempt.status !== "RECOVERY_CONFIRMABLE"
    || competingAttempt.idempotencyKey !== "initial-password-change"
    || competingAttempt.leaseVersion !== 1
    || competingAttempt.subject !== pendingUserId
    || competingAttempt.loginName !== "pending-setup") {
    throw new Error("recovery-required initial-password attempt was not exposed for credential proof");
  }
  const stalePasswordMarker = await passwordRepository.markInitialPasswordProviderUpdated({
    companyId, userId: pendingUserId, idempotencyKey: "competing-password-change", leaseVersion: 2,
  });
  if (stalePasswordMarker !== "STALE_LEASE") throw new Error("unverified recovery changed the provider marker");
  const confirmedPasswordMarker = await passwordRepository.confirmInitialPasswordProviderState({
    companyId, userId: pendingUserId, idempotencyKey: "initial-password-change", leaseVersion: 1,
  });
  if (confirmedPasswordMarker !== "UPDATED") throw new Error("verified password state was not accepted");
  const passwordResumed = await passwordRepository.reserveInitialPassword({
    companyId, userId: pendingUserId, sessionId: pendingSessionId, idempotencyKey: "initial-password-change",
  });
  if (passwordResumed.status !== "PROVIDER_UPDATED") throw new Error(`provider-updated password attempt was not resumable: ${passwordResumed.status}`);
  const passwordCompleted = await passwordRepository.completeInitialPassword({
    companyId,
    userId: pendingUserId,
    sessionId: pendingSessionId,
    idempotencyKey: "initial-password-change",
    auditEventId: "8aa00000-0000-4000-8000-000000000099",
    traceId: "8ab00000-0000-4000-8000-000000000099",
  });
  if (passwordCompleted.status !== "UPDATED") throw new Error(`initial password local completion failed: ${passwordCompleted.status}`);
  const [activated] = await sql<{ status: string; must_change_password: boolean }[]>`
    select status, must_change_password from users where company_id = ${companyId} and id = ${pendingUserId}
  `;
  if (activated?.status !== "ACTIVE" || activated.must_change_password) throw new Error("initial password state was not read back as ACTIVE");
  const [setupSession] = await sql<{ revoke_reason: string | null; revoked_at: Date | null }[]>`
    select revoked_at, revoke_reason from auth_sessions
    where company_id = ${companyId} and id = ${pendingSessionId}
  `;
  if (!setupSession?.revoked_at || setupSession.revoke_reason !== "INITIAL_PASSWORD_CHANGED") {
    throw new Error("current setup session was not revoked with the initial-password reason");
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
  const [pendingOutbox] = await sql<{ count: number; provider_subject: string | null }[]>`
    select count(*)::int as count, min(payload->>'providerSubject') as provider_subject from outbox_jobs
    where company_id = ${companyId}
      and job_type = 'ACCOUNT_PROVIDER_DEACTIVATE'
      and payload->>'userId' = ${targetAdminId}
      and payload->>'idempotencyKey' = 'deactivate-target-admin'
      and status = 'PENDING'
  `;
  if (pendingOutbox?.count !== 1 || pendingOutbox.provider_subject !== "zitadel-target-admin-subject") {
    throw new Error("provider deactivation intent did not preserve the tenant-bound provider subject");
  }
  const claimedJobs = await reconciliationRepository.claimJobs(10);
  const firstClaim = claimedJobs.find((job) => job.jobType === "ACCOUNT_PROVIDER_DEACTIVATE" && job.userId === targetAdminId);
  if (!firstClaim || firstClaim.providerSubject !== "zitadel-target-admin-subject") {
    throw new Error("provider deactivation outbox did not claim the provider subject");
  }
  await sql`
    update outbox_jobs set locked_at = now() - interval '6 minutes'
    where company_id = ${companyId} and id = ${firstClaim.id}
  `;
  const reclaimedJobs = await reconciliationRepository.claimJobs(10);
  const winningClaim = reclaimedJobs.find((job) => job.id === firstClaim.id);
  if (!winningClaim) throw new Error("stale provider deactivation claim was not reclaimed");
  if ((firstClaim as { claimToken?: string }).claimToken === (winningClaim as { claimToken?: string }).claimToken) {
    throw new Error("reclaimed provider deactivation job did not rotate its claim token");
  }
  let staleWorkerRejected = false;
  try {
    await reconciliationRepository.markSucceeded(firstClaim);
  } catch {
    staleWorkerRejected = true;
  }
  if (!staleWorkerRejected) throw new Error("stale outbox worker was allowed to complete a newer claim");
  await reconciliationRepository.markSucceeded(winningClaim);
  const [succeededOutbox] = await sql<{ count: number }[]>`
    select count(*)::int as count from outbox_jobs
    where company_id = ${companyId}
      and job_type = 'ACCOUNT_PROVIDER_DEACTIVATE'
      and payload->>'userId' = ${targetAdminId}
      and status = 'SUCCEEDED'
  `;
  if (succeededOutbox?.count !== 1) throw new Error("provider deactivation success was not persisted");

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
      })},
      'PENDING', 7, now()
    )
  `;
  const deadLetterClaims = await reconciliationRepository.claimJobs(10);
  const deadLetterClaim = deadLetterClaims.find((job) => job.id === deadLetterJobId);
  if (!deadLetterClaim) throw new Error("eighth-attempt outbox job was not claimable");
  await reconciliationRepository.markFailed(deadLetterClaim, "EXTERNAL_AUTH_UNAVAILABLE");
  const [deadLettered] = await sql<{
    claim_token: string | null;
    dead_lettered_at: Date | null;
    status: string;
  }[]>`
    select status, claim_token, dead_lettered_at from outbox_jobs
    where company_id = ${companyId} and id = ${deadLetterJobId}
  `;
  if (deadLettered?.status !== "DEAD_LETTER" || !deadLettered.dead_lettered_at || deadLettered.claim_token !== null) {
    throw new Error("eighth outbox failure did not enter fenced dead-letter state");
  }

  const replay = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000002",
    idempotencyKey: "deactivate-target-admin",
    targetUserId: targetAdminId,
    traceId: "8ab00000-0000-4000-8000-000000000002",
    value: { version: 1, reason: "integration deactivation" },
  });
  if (replay.status !== "UPDATED" || replay.account.version !== first.account.version) {
    throw new Error(`deactivation replay was not stable: ${replay.status}`);
  }

  const conflict = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000003",
    idempotencyKey: "deactivate-target-admin",
    targetUserId: targetAdminId,
    traceId: "8ab00000-0000-4000-8000-000000000003",
    value: { version: 1, reason: "different request" },
  });
  if ((conflict as { status: string }).status !== "IDEMPOTENCY_CONFLICT") throw new Error("deactivation idempotency conflict was not rejected");

  const secondAdmin = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000004",
    idempotencyKey: "deactivate-second-admin",
    targetUserId: remainingAdminId,
    traceId: "8ab00000-0000-4000-8000-000000000004",
    value: { version: 1, reason: "actor remains active" },
  });
  if (secondAdmin.status !== "UPDATED") throw new Error(`second admin deactivation failed: ${secondAdmin.status}`);

  const last = await repository.deactivateAccount({
    actor,
    auditEventId: "8aa00000-0000-4000-8000-000000000005",
    idempotencyKey: "deactivate-last-admin",
    targetUserId: actorId,
    traceId: "8ab00000-0000-4000-8000-000000000005",
    value: { version: 1, reason: "must remain active" },
  });
  if (last.status !== "LAST_ADMIN") throw new Error(`last admin was not protected: ${last.status}`);

  console.log("ACCOUNT_REPOSITORY_INTEGRATION_OK");
} finally {
  await reconciliationRepository.close();
  await repository.close?.();
  await sql.end({ timeout: 1 });
}
