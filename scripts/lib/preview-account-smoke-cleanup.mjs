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

export async function discoverCleanupAccount({
  attempts,
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
      if (value !== undefined && value !== null)
        return assertAccountState(value);
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts) await wait(waitMilliseconds);
  }
  if (lastError) throw new Error("Preview account cleanup discovery failed");
  return undefined;
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
  attempts,
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
      if (
        value?.user?.userId !== expectedSubject ||
        value.user?.details?.resourceOwner !== expectedOrganizationId
      ) {
        throw new Error("Preview provider identity boundary mismatch");
      }
      if (value.user.state === "USER_STATE_INACTIVE") return value;
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
