const defaultWait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function assertAttempts(attempts) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(
      "Preview smoke polling attempts must be a positive integer",
    );
  }
}

function assertAccountState(value) {
  if (
    !value ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    !Number.isInteger(value.version) ||
    typeof value.status !== "string"
  ) {
    throw new Error("Preview account cleanup state was malformed");
  }
  return value;
}

export function assertCreateResponseMatchesAttempt(account, attempt) {
  if (!attempt || account?.id !== attempt.id) {
    throw new Error(
      "Created Preview account did not match its durable attempt",
    );
  }
  return account;
}

export function assertHousekeepingAssignmentRows(
  rows,
  { expectedHotelIds, expectedReason, expectedStartDate },
) {
  const persistedHotelIds = rows.map((row) => row.branch_id).sort();
  if (
    JSON.stringify(persistedHotelIds) !== JSON.stringify(expectedHotelIds) ||
    rows.some(
      (row) =>
        row.start_date !== expectedStartDate || row.reason !== expectedReason,
    )
  ) {
    throw new Error("Preview housekeeping assignment persistence mismatch");
  }
}

export function validateCleanupAttempt(
  value,
  { expectedEmail, expectedLoginName },
) {
  if (
    !value ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.attemptStatus !== "string" ||
    value.requestEmail !== expectedEmail ||
    value.requestLoginName !== expectedLoginName ||
    (value.providerSubject !== null && value.providerSubject !== value.id) ||
    (value.userStatus === null
      ? value.userVersion !== null
      : typeof value.userStatus !== "string" ||
        !Number.isInteger(value.userVersion))
  ) {
    throw new Error("Preview account cleanup attempt identity mismatch");
  }
  return {
    ...value,
    providerSubject: value.id,
  };
}

export async function discoverCleanupAttempt({
  attempts,
  expectedEmail,
  expectedLoginName,
  read,
  wait = defaultWait,
  waitMilliseconds,
}) {
  assertAttempts(attempts);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await read();
      lastError = undefined;
      if (value !== undefined && value !== null) {
        return validateCleanupAttempt(value, {
          expectedEmail,
          expectedLoginName,
        });
      }
    } catch (error) {
      if (
        error?.message === "Preview account cleanup attempt identity mismatch"
      ) {
        throw error;
      }
      lastError = error;
    }
    if (attempt + 1 < attempts) await wait(waitMilliseconds);
  }
  if (lastError)
    throw new Error("Preview account cleanup attempt lookup failed");
  return undefined;
}

export async function orchestratePreviewAccountCleanup({
  cleanupDatabase,
  cleanupProvider,
  discoverAttempt,
  refreshAttempt,
  requireAttempt = false,
  responseAccountId,
}) {
  const cleanupAttempt = await discoverAttempt();
  if (!cleanupAttempt) {
    if (requireAttempt) {
      throw new Error("Preview account cleanup attempt was not observable");
    }
    return { responseIdMatched: false, targetId: null };
  }
  let databaseCleanupComplete = false;
  if (cleanupAttempt.userStatus !== null) {
    await cleanupDatabase(cleanupAttempt.id);
    databaseCleanupComplete = true;
  }
  await cleanupProvider(cleanupAttempt.providerSubject);
  const finalAttempt = await refreshAttempt();
  if (
    !finalAttempt ||
    finalAttempt.id !== cleanupAttempt.id ||
    finalAttempt.providerSubject !== cleanupAttempt.providerSubject
  ) {
    throw new Error("Preview account cleanup attempt changed identity");
  }
  if (finalAttempt.userStatus !== null && !databaseCleanupComplete) {
    await cleanupDatabase(cleanupAttempt.id);
    databaseCleanupComplete = true;
  }
  if (
    finalAttempt.userStatus === null &&
    finalAttempt.attemptStatus !== "COMPENSATED"
  ) {
    throw new Error("Preview account cleanup requires operator recovery");
  }
  return {
    databaseCleanupComplete,
    responseIdMatched: responseAccountId === cleanupAttempt.id,
    targetId: cleanupAttempt.id,
  };
}

export async function finalizePreviewSmoke({
  cleanupReference,
  cleanupFailed,
  close,
  journeyError,
  journeyFailureCode,
  writeSuccess,
}) {
  let finalCleanupFailed = cleanupFailed;
  try {
    await close();
  } catch {
    finalCleanupFailed = true;
  }
  if (finalCleanupFailed) {
    throw new Error(
      cleanupReference
        ? `PREVIEW_ACCOUNT_CLEANUP_FAILED [ref=${cleanupReference}]`
        : "PREVIEW_ACCOUNT_CLEANUP_FAILED",
    );
  }
  if (journeyError) {
    const allowedFailureCodes = new Set([
      "ACCOUNT_CREATE",
      "ACCOUNT_CREATE_ACCOUNT_DUPLICATE",
      "ACCOUNT_CREATE_AUTH_REQUIRED",
      "ACCOUNT_CREATE_EXTERNAL_AUTH_NOT_CONFIGURED",
      "ACCOUNT_CREATE_EXTERNAL_AUTH_UNAVAILABLE",
      "ACCOUNT_CREATE_FORBIDDEN",
      "ACCOUNT_CREATE_IDEMPOTENCY_CONFLICT",
      "ACCOUNT_CREATE_INTERNAL_ERROR",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_COMPENSATED",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_COMPENSATION_REQUIRED",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_COMPLETED",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_DEAD_LETTER",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_DISPATCHED",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_OPERATOR_REQUIRED",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_PROVIDER_CONFIRMED",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_RECOVERY_REQUIRED",
      "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_RESERVED_NOT_DISPATCHED",
      "ACCOUNT_CREATE_ATTEMPT_READBACK",
      "ACCOUNT_CREATE_IDENTITY_MATCH",
      "ACCOUNT_CREATE_SCHEMA_NOT_READY",
      "ACCOUNT_CREATE_RESPONSE_SCHEMA",
      "ACCOUNT_CREATE_VALIDATION_ERROR",
      "ACCOUNT_DEACTIVATE",
      "ACCOUNT_DETAIL_READBACK",
      "ACCOUNT_INACTIVE_READBACK",
      "ADMIN_SESSION_CREATE",
      "ADMIN_SESSION_IDENTITY_NOT_PROVISIONED",
      "ADMIN_SESSION_INVALID_RESPONSE",
      "ADMIN_SESSION_PRINCIPAL_INACTIVE",
      "ADMIN_SESSION_RUNTIME_DENIED",
      "CUSTOM_LOGIN_CANONICAL",
      "CUSTOM_LOGIN_LEGACY_REJECT",
      "ELIGIBLE_HOTELS_READ",
      "HOTEL_BOOTSTRAP_CREATE",
      "HOTEL_BOOTSTRAP_VERIFY",
      "HOUSEKEEPING_ASSIGNMENTS",
      "INITIAL_PASSWORD",
      "PENDING_SESSION_CREATE",
      "PENDING_SESSION_IDENTITY_NOT_PROVISIONED",
      "PENDING_SESSION_INVALID_RESPONSE",
      "PENDING_SESSION_PRINCIPAL_INACTIVE",
      "PENDING_SESSION_RUNTIME_DENIED",
      "PROVIDER_IDENTITY_READBACK",
      "PROVIDER_INACTIVE",

      "SESSION_REVOCATION",
      "UNCLASSIFIED",
    ]);
    const safeFailureCode = allowedFailureCodes.has(journeyFailureCode)
      ? journeyFailureCode
      : "UNCLASSIFIED";
    throw new Error(`PREVIEW_ACCOUNT_JOURNEY_FAILED_${safeFailureCode}`);
  }
  writeSuccess();
}

export async function ensureDatabaseInactive({
  attempts,
  deactivate,
  read,
  wait = defaultWait,
  waitMilliseconds,
}) {
  assertAttempts(attempts);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let state;
    try {
      state = assertAccountState(await read());
      lastError = undefined;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await wait(waitMilliseconds);
        continue;
      }
      break;
    }
    if (state.status === "INACTIVE") return state;
    try {
      await deactivate(state);
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts) await wait(waitMilliseconds);
  }
  throw new Error(
    lastError
      ? "Preview account cleanup deactivation failed"
      : "Preview account cleanup database state remained active",
  );
}

export async function waitForProviderInactive({
  allowAbsent = false,
  attempts,
  deactivate,
  expectedOrganizationId,
  expectedSubject,
  read,
  wait = defaultWait,
  waitMilliseconds,
}) {
  assertAttempts(attempts);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await read();
      if (value?.absent === true) {
        if (allowAbsent && attempt + 1 === attempts) return value;
        throw new Error("Preview provider user was unexpectedly absent");
      }
      if (
        value?.user?.userId !== expectedSubject ||
        value.user?.details?.resourceOwner !== expectedOrganizationId
      ) {
        throw new Error("Preview provider identity boundary mismatch");
      }
      if (value.user.state === "USER_STATE_INACTIVE") return value;
      if (deactivate) await deactivate(value);
      lastError = undefined;
    } catch (error) {
      if (error?.message === "Preview provider identity boundary mismatch") {
        throw error;
      }
      lastError = error;
    }
    if (attempt + 1 < attempts) await wait(waitMilliseconds);
  }
  throw new Error(
    lastError
      ? "Preview provider deactivation read-back failed"
      : "Preview provider state remained active",
  );
}

export async function waitForProviderSessionGone({
  attempts,
  read,
  wait = defaultWait,
  waitMilliseconds,
}) {
  assertAttempts(attempts);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const status = await read();
      if (status === 401 || status === 404) return status;
      if (status !== 200) {
        throw new Error("Preview provider session state was malformed");
      }
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts) await wait(waitMilliseconds);
  }
  throw new Error(
    lastError
      ? "Preview provider session deletion read-back failed"
      : "Preview provider session remained active",
  );
}

export async function waitForZeroActiveSessions({
  attempts,
  read,
  wait = defaultWait,
  waitMilliseconds,
}) {
  assertAttempts(attempts);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const count = await read();
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Preview active session count was malformed");
      }
      if (count === 0) return;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts) await wait(waitMilliseconds);
  }
  throw new Error(
    lastError
      ? "Preview active session read-back failed"
      : "Preview account retained active sessions",
  );
}
