import { createPostgresAuthRepository } from "../src/auth";
import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const repository = createPostgresAuthRepository(databaseUrl);
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const encode = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

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
  await sql.end({ timeout: 1 });
}
