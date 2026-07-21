import { createPostgresAuthRepository, type AuthRepository } from "../src/auth";
import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const repository = createPostgresAuthRepository(databaseUrl);
const parallelRepository = createPostgresAuthRepository(databaseUrl);
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const encode = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

async function createPreparedFlow(
  targetRepository: AuthRepository,
  redirectUri: string,
) {
  const stateHash = randomBytes(32);
  const browserBindingHash = randomBytes(32);
  const authRequestHash = randomBytes(32);
  const csrfHash = randomBytes(32);
  const created = await targetRepository.createLoginTransaction({
    id: crypto.randomUUID(),
    stateHash,
    browserBindingHash,
    nonceHash: randomBytes(32),
    codeVerifierCiphertext: randomBytes(59),
    codeVerifierIv: randomBytes(12),
    encryptionKeyVersion: 1,
    lifetimeSeconds: 600,
    redirectUri,
  });
  if (created.status !== "CREATED") throw new Error(`parallel flow create failed: ${created.status}`);
  const prepared = await targetRepository.prepareCustomLogin({
    authRequestHash,
    browserBindingHash,
    csrfHash,
    csrfLifetimeSeconds: 300,
  });
  if (prepared.status !== "PREPARED") throw new Error(`parallel flow prepare failed: ${prepared.status}`);
  return { authRequestHash, browserBindingHash, csrfHash, stateHash };
}

try {
  await sql`
    insert into auth_login_transactions (
      id, state_hash, browser_binding_hash, nonce_hash,
      code_verifier_ciphertext, code_verifier_iv, encryption_key_version,
      redirect_uri, created_at, expires_at
    ) values (
      ${crypto.randomUUID()}, ${encode("aa".repeat(32))}, ${encode("ab".repeat(32))},
      ${encode("ac".repeat(32))}, ${encode("ad".repeat(59))}, ${encode("ae".repeat(12))},
      1, 'https://hotel.example.test/api/auth/callback',
      now() - interval '20 minutes', now() - interval '10 minutes'
    )
  `;
  const stateHash = encode("11".repeat(32));
  const browserBindingHash = encode("12".repeat(32));
  const nonceHash = encode("22".repeat(32));
  const loginTransactionResult = await repository.createLoginTransaction({
    id: crypto.randomUUID(),
    stateHash,
    browserBindingHash,
    nonceHash,
    codeVerifierCiphertext: encode("44".repeat(59)),
    codeVerifierIv: encode("55".repeat(12)),
    encryptionKeyVersion: 1,
    lifetimeSeconds: 600,
    redirectUri: "https://hotel.example.test/api/auth/callback",
  });
  if (loginTransactionResult.status !== "CREATED") {
    throw new Error("login transaction capacity rejected a normal insert");
  }
  const expiredRows = await sql<{ count: number }[]>`
    select count(*)::int as count from auth_login_transactions
    where expires_at <= now()
  `;
  if (expiredRows[0]?.count !== 0) throw new Error("expired login transaction cleanup did not run");

  const atomicAuthRequestHash = randomBytes(32);
  const atomicInput = () => ({
    id: crypto.randomUUID(),
    stateHash: randomBytes(32),
    browserBindingHash: randomBytes(32),
    nonceHash: randomBytes(32),
    codeVerifierCiphertext: randomBytes(59),
    codeVerifierIv: randomBytes(12),
    encryptionKeyVersion: 1,
    lifetimeSeconds: 600,
    redirectUri: "https://hotel.example.test/api/auth/callback",
    authRequestHash: atomicAuthRequestHash,
    csrfHash: randomBytes(32),
    csrfLifetimeSeconds: 300,
  });
  const atomicClaimResults = await Promise.all([
    repository.createCustomLoginTransaction(atomicInput()),
    parallelRepository.createCustomLoginTransaction(atomicInput()),
  ]);
  const atomicClaimStatuses = atomicClaimResults.map((result) => result.status).sort();
  if (atomicClaimStatuses.join(",") !== "CREATED,REPLAYED") {
    throw new Error(`atomic custom request claim mismatch: ${atomicClaimStatuses.join(",")}`);
  }
  const atomicClaimRows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from auth_login_transactions
    where custom_auth_request_hash = ${atomicAuthRequestHash}
  `;
  if (atomicClaimRows[0]?.count !== 1) {
    throw new Error("replayed custom request created more than one transaction");
  }

  const startIpHash = randomBytes(32);
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const reservation = await repository.reserveCustomLoginStart(startIpHash);
    if (reservation.status !== "RESERVED") {
      throw new Error(`custom login start reservation ${attempt} failed`);
    }
  }
  const limitedStart = await repository.reserveCustomLoginStart(startIpHash);
  if (limitedStart.status !== "RATE_LIMITED") {
    throw new Error("custom login start IP limit was not enforced");
  }

  const saturatedCredentialFlow = await createPreparedFlow(
    repository,
    "https://saturated-credential.example.test/callback",
  );
  const saturatedCredentialIpHash = randomBytes(32);
  await sql`
    insert into auth_credential_rate_limits (
      scope, subject_hash, window_started_at, attempt_count, expires_at
    ) values ('IP', ${saturatedCredentialIpHash}, now(), 1000, now() + interval '15 minutes')
  `;
  const saturatedCredentialAttempt = await repository.consumeCustomLoginAttempt({
    accountHash: randomBytes(32),
    authRequestHash: saturatedCredentialFlow.authRequestHash,
    browserBindingHash: saturatedCredentialFlow.browserBindingHash,
    csrfHash: saturatedCredentialFlow.csrfHash,
    ipHash: saturatedCredentialIpHash,
  });
  if (saturatedCredentialAttempt.status !== "RATE_LIMITED") {
    throw new Error("saturated credential IP bucket did not fail closed");
  }
  const saturatedCredentialRows = await sql<{
    attempt_count: number;
    csrf_cleared: boolean;
    ip_attempt_count: number;
  }[]>`
    select login_tx.custom_attempt_count as attempt_count,
           login_tx.custom_csrf_hash is null as csrf_cleared,
           rate_limit.attempt_count as ip_attempt_count
    from auth_login_transactions login_tx
    join auth_credential_rate_limits rate_limit
      on rate_limit.scope = 'IP' and rate_limit.subject_hash = ${saturatedCredentialIpHash}
    where login_tx.state_hash = ${saturatedCredentialFlow.stateHash}
  `;
  if (
    saturatedCredentialRows[0]?.attempt_count !== 1 ||
    !saturatedCredentialRows[0]?.csrf_cleared ||
    saturatedCredentialRows[0]?.ip_attempt_count !== 1000
  ) {
    throw new Error("saturated credential limit did not commit bounded CSRF consumption");
  }

  const parallelCsrfFlow = await createPreparedFlow(repository, "https://parallel-csrf.example.test/callback");
  const parallelCsrfInput = {
    accountHash: randomBytes(32),
    authRequestHash: parallelCsrfFlow.authRequestHash,
    browserBindingHash: parallelCsrfFlow.browserBindingHash,
    csrfHash: parallelCsrfFlow.csrfHash,
    ipHash: randomBytes(32),
  };
  const parallelCsrfResults = await Promise.all([
    repository.consumeCustomLoginAttempt(parallelCsrfInput),
    parallelRepository.consumeCustomLoginAttempt(parallelCsrfInput),
  ]);
  const parallelCsrfStatuses = parallelCsrfResults.map((result) => result.status).sort();
  if (parallelCsrfStatuses.join(",") !== "CONSUMED,FLOW_INVALID") {
    throw new Error(`parallel CSRF consume mismatch: ${parallelCsrfStatuses.join(",")}`);
  }
  const parallelCsrfRows = await sql<{ attempt_count: number; csrf_cleared: boolean }[]>`
    select custom_attempt_count as attempt_count,
           custom_csrf_hash is null and custom_csrf_expires_at is null as csrf_cleared
    from auth_login_transactions
    where state_hash = ${parallelCsrfFlow.stateHash}
  `;
  if (parallelCsrfRows[0]?.attempt_count !== 1 || !parallelCsrfRows[0]?.csrf_cleared) {
    throw new Error("parallel CSRF consume did not commit exactly once");
  }

  const authRequestHash = encode("13".repeat(32));
  const csrfHash = encode("14".repeat(32));
  const validationReservation = await repository.reserveCustomLoginValidation({
    authRequestHash,
    browserBindingHash,
  });
  if (validationReservation.status !== "RESERVED") {
    throw new Error(`custom login validation reservation failed: ${validationReservation.status}`);
  }
  const prepared = await repository.prepareCustomLogin({
    authRequestHash,
    browserBindingHash,
    csrfHash,
    csrfLifetimeSeconds: 300,
  });
  if (prepared.status !== "PREPARED") throw new Error(`custom login prepare failed: ${prepared.status}`);
  const cachedValidation = await repository.reserveCustomLoginValidation({
    authRequestHash,
    browserBindingHash,
  });
  if (cachedValidation.status !== "VALIDATED") {
    throw new Error(`validated auth request was not cached: ${cachedValidation.status}`);
  }
  const wrongAttempt = await repository.consumeCustomLoginAttempt({
    accountHash: encode("15".repeat(32)),
    authRequestHash,
    browserBindingHash,
    csrfHash: encode("99".repeat(32)),
    ipHash: encode("16".repeat(32)),
  });
  if (wrongAttempt.status !== "FLOW_INVALID") throw new Error("wrong CSRF was accepted");
  const crossRequestAttempt = await repository.consumeCustomLoginAttempt({
    accountHash: encode("15".repeat(32)),
    authRequestHash: encode("98".repeat(32)),
    browserBindingHash,
    csrfHash,
    ipHash: encode("16".repeat(32)),
  });
  if (crossRequestAttempt.status !== "FLOW_INVALID") throw new Error("cross-auth-request CSRF was accepted");
  const consumedAttempt = await repository.consumeCustomLoginAttempt({
    accountHash: encode("15".repeat(32)),
    authRequestHash,
    browserBindingHash,
    csrfHash,
    ipHash: encode("16".repeat(32)),
  });
  if (consumedAttempt.status !== "CONSUMED") throw new Error("valid custom login attempt was rejected");
  const replayedAttempt = await repository.consumeCustomLoginAttempt({
    accountHash: encode("15".repeat(32)),
    authRequestHash,
    browserBindingHash,
    csrfHash,
    ipHash: encode("16".repeat(32)),
  });
  if (replayedAttempt.status !== "FLOW_INVALID") throw new Error("custom login CSRF replay was accepted");

  for (let attemptNumber = 2; attemptNumber <= 5; attemptNumber += 1) {
    const nextCsrfHash = encode(attemptNumber.toString(16).padStart(2, "0").repeat(32));
    const nextPrepared = await repository.prepareCustomLogin({
      authRequestHash,
      browserBindingHash,
      csrfHash: nextCsrfHash,
      csrfLifetimeSeconds: 300,
    });
    if (nextPrepared.status !== "PREPARED") throw new Error(`attempt ${attemptNumber} was not prepared`);
    const nextAttempt = await repository.consumeCustomLoginAttempt({
      accountHash: encode((20 + attemptNumber).toString(16).repeat(32)),
      authRequestHash,
      browserBindingHash,
      csrfHash: nextCsrfHash,
      ipHash: encode((40 + attemptNumber).toString(16).repeat(32)),
    });
    if (nextAttempt.status !== "CONSUMED") throw new Error(`attempt ${attemptNumber} was not consumed`);
  }
  const exhausted = await repository.prepareCustomLogin({
    authRequestHash,
    browserBindingHash,
    csrfHash: encode("70".repeat(32)),
    csrfLifetimeSeconds: 300,
  });
  if (exhausted.status !== "RATE_LIMITED") throw new Error("auth request attempt limit was not enforced");

  if (await repository.consumeLoginTransaction(stateHash, encode("99".repeat(32)))) {
    throw new Error("wrong browser binding consumed login transaction");
  }
  const transaction = await repository.consumeLoginTransaction(stateHash, browserBindingHash);
  if (!transaction || transaction.codeVerifierCiphertext.byteLength !== 59) {
    throw new Error("active login transaction was not consumed");
  }
  if (await repository.consumeLoginTransaction(stateHash, browserBindingHash)) {
    throw new Error("login transaction replay was accepted");
  }
  const consumedRows = await sql<{ count: number }[]>`
    select count(*)::int as count from auth_login_transactions
    where state_hash = ${stateHash}
  `;
  if (consumedRows[0]?.count !== 0) throw new Error("consumed login transaction was retained");

  const validationLimitStateHash = randomBytes(32);
  const validationLimitBrowserHash = randomBytes(32);
  const validationLimitAuthHash = randomBytes(32);
  const validationLimitCreated = await repository.createLoginTransaction({
    id: crypto.randomUUID(),
    stateHash: validationLimitStateHash,
    browserBindingHash: validationLimitBrowserHash,
    nonceHash: randomBytes(32),
    codeVerifierCiphertext: randomBytes(59),
    codeVerifierIv: randomBytes(12),
    encryptionKeyVersion: 1,
    lifetimeSeconds: 600,
    redirectUri: "https://validation-limit.example.test/callback",
  });
  if (validationLimitCreated.status !== "CREATED") throw new Error("validation limit flow create failed");
  for (let validationAttempt = 1; validationAttempt <= 5; validationAttempt += 1) {
    const reserved = await repository.reserveCustomLoginValidation({
      authRequestHash: validationLimitAuthHash,
      browserBindingHash: validationLimitBrowserHash,
    });
    if (reserved.status !== "RESERVED") {
      throw new Error(`validation reservation ${validationAttempt} failed: ${reserved.status}`);
    }
  }
  const validationLimited = await repository.reserveCustomLoginValidation({
    authRequestHash: validationLimitAuthHash,
    browserBindingHash: validationLimitBrowserHash,
  });
  if (validationLimited.status !== "RATE_LIMITED") {
    throw new Error(`validation reservation limit failed: ${validationLimited.status}`);
  }
  const validationCountRows = await sql<{ validation_count: number }[]>`
    select custom_validation_count as validation_count
    from auth_login_transactions
    where state_hash = ${validationLimitStateHash}
  `;
  if (validationCountRows[0]?.validation_count !== 5) {
    throw new Error("validation reservation count did not commit at five");
  }

  for (const scope of ["ACCOUNT", "IP"] as const) {
    const seed = scope === "ACCOUNT" ? "71" : "72";
    const probeStateHash = encode(seed.repeat(32));
    const probeBrowserHash = encode((scope === "ACCOUNT" ? "73" : "74").repeat(32));
    const probeAuthHash = encode((scope === "ACCOUNT" ? "75" : "76").repeat(32));
    const probeCsrfHash = encode((scope === "ACCOUNT" ? "77" : "78").repeat(32));
    const accountHash = encode((scope === "ACCOUNT" ? "79" : "7a").repeat(32));
    const ipHash = encode((scope === "IP" ? "7b" : "7c").repeat(32));
    const createdProbe = await repository.createLoginTransaction({
      id: crypto.randomUUID(),
      stateHash: probeStateHash,
      browserBindingHash: probeBrowserHash,
      nonceHash: encode((scope === "ACCOUNT" ? "7d" : "7e").repeat(32)),
      codeVerifierCiphertext: encode("7f".repeat(59)),
      codeVerifierIv: encode("80".repeat(12)),
      encryptionKeyVersion: 1,
      lifetimeSeconds: 600,
      redirectUri: `https://rate-${scope.toLowerCase()}.example.test/callback`,
    });
    if (createdProbe.status !== "CREATED") throw new Error(`${scope} rate probe transaction failed`);
    const preparedProbe = await repository.prepareCustomLogin({
      authRequestHash: probeAuthHash,
      browserBindingHash: probeBrowserHash,
      csrfHash: probeCsrfHash,
      csrfLifetimeSeconds: 300,
    });
    if (preparedProbe.status !== "PREPARED") throw new Error(`${scope} rate probe prepare failed`);
    const subjectHash = scope === "ACCOUNT" ? accountHash : ipHash;
    const threshold = scope === "ACCOUNT" ? 10 : 30;
    await sql`
      insert into auth_credential_rate_limits (
        scope, subject_hash, window_started_at, attempt_count, expires_at
      ) values (${scope}, ${subjectHash}, now(), ${threshold}, now() + interval '15 minutes')
    `;
    const limitedAttempt = await repository.consumeCustomLoginAttempt({
      accountHash,
      authRequestHash: probeAuthHash,
      browserBindingHash: probeBrowserHash,
      csrfHash: probeCsrfHash,
      ipHash,
    });
    if (limitedAttempt.status !== "RATE_LIMITED") throw new Error(`${scope} rate limit was not enforced`);
    const committedLimit = await sql<{ attempt_count: number; csrf_cleared: boolean }[]>`
      select custom_attempt_count as attempt_count,
             custom_csrf_hash is null and custom_csrf_expires_at is null as csrf_cleared
      from auth_login_transactions
      where state_hash = ${probeStateHash}
    `;
    if (committedLimit[0]?.attempt_count !== 1 || !committedLimit[0]?.csrf_cleared) {
      throw new Error(`${scope} rate-limited attempt did not commit`);
    }
    const limitedReplay = await repository.consumeCustomLoginAttempt({
      accountHash,
      authRequestHash: probeAuthHash,
      browserBindingHash: probeBrowserHash,
      csrfHash: probeCsrfHash,
      ipHash,
    });
    if (limitedReplay.status !== "FLOW_INVALID") throw new Error(`${scope} rate-limited CSRF replay was accepted`);
    await sql`delete from auth_login_transactions where state_hash = ${probeStateHash}`;
    await sql`delete from auth_credential_rate_limits where subject_hash in (${accountHash}, ${ipHash})`;
  }

  for (const { scope, allowed, total } of [
    { scope: "ACCOUNT" as const, allowed: 10, total: 12 },
    { scope: "IP" as const, allowed: 30, total: 32 },
  ]) {
    const redirectUri = `https://parallel-rate-${scope.toLowerCase()}.example.test/callback`;
    const sharedHash = randomBytes(32);
    const flows = await Promise.all(Array.from(
      { length: total },
      () => createPreparedFlow(repository, redirectUri),
    ));
    const inputs = flows.map((flow) => ({
      accountHash: scope === "ACCOUNT" ? sharedHash : randomBytes(32),
      authRequestHash: flow.authRequestHash,
      browserBindingHash: flow.browserBindingHash,
      csrfHash: flow.csrfHash,
      ipHash: scope === "IP" ? sharedHash : randomBytes(32),
    }));
    const results = await Promise.all(inputs.map((input) => repository.consumeCustomLoginAttempt(input)));
    const consumedCount = results.filter((result) => result.status === "CONSUMED").length;
    const limitedCount = results.filter((result) => result.status === "RATE_LIMITED").length;
    if (consumedCount !== allowed || limitedCount !== total - allowed) {
      throw new Error(`${scope} parallel limit mismatch: consumed=${consumedCount} limited=${limitedCount}`);
    }
    const replayResults = await Promise.all(inputs
      .filter((_, index) => results[index]?.status === "RATE_LIMITED")
      .map((input) => parallelRepository.consumeCustomLoginAttempt(input)));
    if (replayResults.some((result) => result.status !== "FLOW_INVALID")) {
      throw new Error(`${scope} parallel rate-limited CSRF replay was accepted`);
    }
    const committedRows = await sql<{ committed: number }[]>`
      select count(*) filter (
        where custom_attempt_count = 1
          and custom_csrf_hash is null
          and custom_csrf_expires_at is null
      )::int as committed
      from auth_login_transactions
      where redirect_uri = ${redirectUri}
    `;
    if (committedRows[0]?.committed !== total) {
      throw new Error(`${scope} parallel attempts did not all commit`);
    }
    await sql`delete from auth_login_transactions where redirect_uri = ${redirectUri}`;
    await sql`delete from auth_credential_rate_limits where scope = ${scope} and subject_hash = ${sharedHash}`;
  }

  const resetFlow = await createPreparedFlow(repository, "https://rate-reset.example.test/callback");
  const resetAccountHash = randomBytes(32);
  await sql`
    insert into auth_credential_rate_limits (
      scope, subject_hash, window_started_at, attempt_count, expires_at
    ) values (
      'ACCOUNT', ${resetAccountHash}, now() - interval '16 minutes', 10, now() - interval '1 minute'
    )
  `;
  const resetAttempt = await repository.consumeCustomLoginAttempt({
    accountHash: resetAccountHash,
    authRequestHash: resetFlow.authRequestHash,
    browserBindingHash: resetFlow.browserBindingHash,
    csrfHash: resetFlow.csrfHash,
    ipHash: randomBytes(32),
  });
  if (resetAttempt.status !== "CONSUMED") throw new Error("expired account rate window did not reset");
  const resetRows = await sql<{ attempt_count: number; valid_window: boolean }[]>`
    select attempt_count,
           expires_at > now() and expires_at <= window_started_at + interval '15 minutes' as valid_window
    from auth_credential_rate_limits
    where scope = 'ACCOUNT' and subject_hash = ${resetAccountHash}
  `;
  if (resetRows[0]?.attempt_count !== 1 || !resetRows[0]?.valid_window) {
    throw new Error("expired account rate bucket reset incorrectly");
  }

  const plaintextColumns = await sql<{ count: number }[]>`
    select count(*)::int as count
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('auth_login_transactions', 'auth_credential_rate_limits')
      and column_name in ('login_name', 'loginname', 'ip', 'ip_address')
  `;
  if (plaintextColumns[0]?.count !== 0) throw new Error("credential rate tables expose plaintext identifiers");
  const invalidHashRows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from auth_credential_rate_limits
    where octet_length(subject_hash) <> 32
  `;
  if (invalidHashRows[0]?.count !== 0) throw new Error("credential rate table retained a non-HMAC identifier");

  await sql`
    insert into auth_login_transactions (
      id, state_hash, browser_binding_hash, nonce_hash,
      code_verifier_ciphertext, code_verifier_iv, encryption_key_version,
      redirect_uri, expires_at
    )
    select gen_random_uuid(),
           decode(md5(series::text) || md5('state-' || series::text), 'hex'),
           decode(md5('browser-' || series::text) || md5('binding-' || series::text), 'hex'),
           decode(md5('nonce-' || series::text) || md5('value-' || series::text), 'hex'),
           decode(repeat('aa', 59), 'hex'), decode(repeat('bb', 12), 'hex'), 1,
           'https://capacity.example.test/callback', now() + interval '10 minutes'
    from generate_series(1, 1000) as series
  `;
  const capacityResult = await repository.createLoginTransaction({
    id: crypto.randomUUID(),
    stateHash: encode("66".repeat(32)),
    browserBindingHash: encode("67".repeat(32)),
    nonceHash: encode("68".repeat(32)),
    codeVerifierCiphertext: encode("69".repeat(59)),
    codeVerifierIv: encode("6a".repeat(12)),
    encryptionKeyVersion: 1,
    lifetimeSeconds: 600,
    redirectUri: "https://hotel.example.test/api/auth/callback",
  });
  if (capacityResult.status !== "CAPACITY_EXCEEDED") {
    throw new Error("login transaction recent-rate capacity was not enforced");
  }
  await sql`delete from auth_login_transactions where redirect_uri = 'https://capacity.example.test/callback'`;

  const tokenHash = encode("33".repeat(32));
  const created = await repository.createSession({
    absoluteLifetimeSeconds: 86_400,
    authTime: new Date(),
    idleLifetimeSeconds: 28_800,
    sessionId: crypto.randomUUID(),
    tokenHash,
    traceId: crypto.randomUUID(),
    providerSubject: "subject-1",
  });
  if (created.status !== "CREATED") throw new Error(`session create failed: ${created.status}`);
  if (created.principal.userType !== "INTERNAL_STAFF") throw new Error("principal user type mismatch");

  const stored = await sql<{ hash_length: number; idle_seconds: number; absolute_seconds: number }[]>`
    select octet_length(token_hash)::int as hash_length,
           extract(epoch from (idle_expires_at - created_at))::int as idle_seconds,
           extract(epoch from (absolute_expires_at - created_at))::int as absolute_seconds
    from auth_sessions
    where id = ${created.principal.sessionId}
  `;
  if (stored[0]?.hash_length !== 32) throw new Error("session token hash length mismatch");
  if (stored[0]?.idle_seconds !== 28_800) throw new Error("idle lifetime mismatch");
  if (stored[0]?.absolute_seconds !== 86_400) throw new Error("absolute lifetime mismatch");

  const throttleBefore = await sql<{ absolute_expires_at: Date; last_seen_at: Date }[]>`
    update auth_sessions
    set created_at = now() - interval '10 minutes',
        auth_time = now() - interval '10 minutes',
        last_seen_at = now() - interval '6 minutes',
        absolute_expires_at = now() + interval '23 hours 50 minutes',
        idle_expires_at = now() - interval '6 minutes' + interval '8 hours'
    where id = ${created.principal.sessionId}
    returning last_seen_at, absolute_expires_at
  `;
  const resolved = await repository.resolvePrincipal(tokenHash, 28_800);
  if (resolved?.sessionId !== created.principal.sessionId) throw new Error("active principal was not resolved");
  const throttleAfter = await sql<{ absolute_expires_at: Date; last_seen_at: Date }[]>`
    select last_seen_at, absolute_expires_at from auth_sessions
    where id = ${created.principal.sessionId}
  `;
  if (!(throttleAfter[0]!.last_seen_at > throttleBefore[0]!.last_seen_at)) {
    throw new Error("last_seen throttle update did not run");
  }
  if (throttleAfter[0]!.absolute_expires_at.getTime() !== throttleBefore[0]!.absolute_expires_at.getTime()) {
    throw new Error("absolute expiry was extended");
  }
  await repository.resolvePrincipal(tokenHash, 28_800);
  const throttleRepeated = await sql<{ last_seen_at: Date }[]>`
    select last_seen_at from auth_sessions where id = ${created.principal.sessionId}
  `;
  if (throttleRepeated[0]!.last_seen_at.getTime() !== throttleAfter[0]!.last_seen_at.getTime()) {
    throw new Error("last_seen changed inside throttle window");
  }

  await sql`update users set status = 'INACTIVE' where id = ${created.principal.userId}`;
  if (await repository.resolvePrincipal(tokenHash, 28_800)) throw new Error("inactive user session was accepted");
  await sql`update users set status = 'ACTIVE' where id = ${created.principal.userId}`;
  await sql`update users set status = 'LOCKED' where id = ${created.principal.userId}`;
  if (await repository.resolvePrincipal(tokenHash, 28_800)) throw new Error("locked user session was accepted");
  await sql`update users set status = 'ACTIVE' where id = ${created.principal.userId}`;
  await sql`update users set status = 'PENDING_SETUP', must_change_password = true where id = ${created.principal.userId}`;
  const pendingSetupPrincipal = await repository.resolvePrincipal(tokenHash, 28_800);
  if (pendingSetupPrincipal?.mustChangePassword !== true) throw new Error("pending setup principal was not gated");
  await sql`update users set status = 'ACTIVE', must_change_password = false where id = ${created.principal.userId}`;

  await sql`update companies set status = 'SUSPENDED' where id = ${created.principal.companyId}`;
  if (await repository.resolvePrincipal(tokenHash, 28_800)) throw new Error("suspended company session was accepted");
  await sql`update companies set status = 'ACTIVE' where id = ${created.principal.companyId}`;

  const expiredBefore = await sql<{ last_seen_at: Date }[]>`
    update auth_sessions
    set created_at = now() - interval '10 hours',
        last_seen_at = now() - interval '9 hours',
        idle_expires_at = now() - interval '1 hour',
        absolute_expires_at = now() + interval '10 hours',
        auth_time = now() - interval '10 hours'
    where id = ${created.principal.sessionId}
    returning last_seen_at
  `;
  if (await repository.resolvePrincipal(tokenHash, 28_800)) throw new Error("expired session was accepted");
  const expiredAfter = await sql<{ last_seen_at: Date }[]>`
    select last_seen_at from auth_sessions where id = ${created.principal.sessionId}
  `;
  if (expiredAfter[0]!.last_seen_at.getTime() !== expiredBefore[0]!.last_seen_at.getTime()) {
    throw new Error("expired session last_seen was updated");
  }

  if (!await repository.revokeSession(tokenHash, "INTEGRATION_TEST_LOGOUT", crypto.randomUUID())) {
    throw new Error("active session was not revoked");
  }
  if (await repository.resolvePrincipal(tokenHash, 28_800)) throw new Error("revoked session was accepted");
  if (await repository.revokeSession(tokenHash, "REPLAY", crypto.randomUUID())) {
    throw new Error("session revoke replay was accepted");
  }

  const countsBefore = await sql<{ identities: number; users: number }[]>`
    select (select count(*)::int from auth_identities) as identities,
           (select count(*)::int from users) as users
  `;
  const missing = await repository.createSession({
    absoluteLifetimeSeconds: 86_400,
    authTime: new Date(),
    idleLifetimeSeconds: 28_800,
    sessionId: crypto.randomUUID(),
    tokenHash: encode("44".repeat(32)),
    traceId: crypto.randomUUID(),
    providerSubject: "unknown-subject",
  });
  if (missing.status !== "IDENTITY_NOT_PROVISIONED") throw new Error("unknown identity was provisioned");
  const countsAfter = await sql<{ identities: number; users: number }[]>`
    select (select count(*)::int from auth_identities) as identities,
           (select count(*)::int from users) as users
  `;
  if (countsAfter[0]!.identities !== countsBefore[0]!.identities
    || countsAfter[0]!.users !== countsBefore[0]!.users) {
    throw new Error("unknown identity changed provisioned account rows");
  }

  for (const invalidInput of [
    { tokenHash: encode("55".repeat(31)), idleLifetimeSeconds: 28_800, absoluteLifetimeSeconds: 86_400 },
    { tokenHash: encode("56".repeat(32)), idleLifetimeSeconds: 59, absoluteLifetimeSeconds: 86_400 },
    { tokenHash: encode("57".repeat(32)), idleLifetimeSeconds: 28_800, absoluteLifetimeSeconds: 86_401 },
  ]) {
    let code = "";
    try {
      await repository.createSession({
        ...invalidInput,
        authTime: new Date(),
        sessionId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
        providerSubject: "subject-1",
      });
    } catch (error) {
      code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    }
    if (code !== "22023") throw new Error("invalid auth session function input was accepted");
  }

  let releaseStatusUpdate!: () => void;
  let statusUpdateStarted!: () => void;
  const statusUpdateStartedPromise = new Promise<void>((resolve) => { statusUpdateStarted = resolve; });
  const releaseStatusUpdatePromise = new Promise<void>((resolve) => { releaseStatusUpdate = resolve; });
  const statusUpdate = sql.begin(async (transaction) => {
    await transaction`update users set status = 'INACTIVE' where id = ${created.principal.userId}`;
    statusUpdateStarted();
    await releaseStatusUpdatePromise;
  });
  await statusUpdateStartedPromise;
  const blockedSession = parallelRepository.createSession({
    absoluteLifetimeSeconds: 86_400,
    authTime: new Date(),
    idleLifetimeSeconds: 28_800,
    sessionId: crypto.randomUUID(),
    tokenHash: encode("58".repeat(32)),
    traceId: crypto.randomUUID(),
    providerSubject: "subject-1",
  });
  const lockObservation = await Promise.race([
    blockedSession.then(() => "completed" as const),
    new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 100)),
  ]);
  if (lockObservation !== "blocked") throw new Error("session creation bypassed the active-state row lock");
  releaseStatusUpdate();
  await statusUpdate;
  const inactiveResult = await blockedSession;
  if (inactiveResult.status !== "PRINCIPAL_INACTIVE") {
    throw new Error("session was created after a concurrent user deactivation");
  }
  await sql`update users set status = 'ACTIVE' where id = ${created.principal.userId}`;

  const auditRows = await sql<{ event_code: string }[]>`
    select event_code from audit_events
    where session_id = ${created.principal.sessionId}
    order by occurred_at
  `;
  if (!auditRows.some((row) => row.event_code === "AUTH_LOGIN_SUCCEEDED")) {
    throw new Error("login audit event missing");
  }
  if (!auditRows.some((row) => row.event_code === "AUTH_LOGOUT_SUCCEEDED")) {
    throw new Error("logout audit event missing");
  }

  console.log("AUTH_REPOSITORY_INTEGRATION_OK");
} finally {
  await Promise.all([
    repository.close?.(),
    parallelRepository.close?.(),
    sql.end({ timeout: 1 }),
  ]);
}
