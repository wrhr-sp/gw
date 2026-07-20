import type { AuthenticatedPrincipal, HotelUserType } from "@werehere/contracts";
import postgres from "postgres";

export type LoginTransaction = {
  codeVerifierCiphertext: Uint8Array;
  codeVerifierIv: Uint8Array;
  encryptionKeyVersion: number;
  nonceHash: Uint8Array;
  redirectUri: string;
};

export type CreateLoginTransactionInput = LoginTransaction & {
  browserBindingHash: Uint8Array;
  id: string;
  lifetimeSeconds: number;
  stateHash: Uint8Array;
};

export type CreateCustomLoginTransactionInput = CreateLoginTransactionInput & {
  authRequestHash: Uint8Array;
  csrfHash: Uint8Array;
  csrfLifetimeSeconds: number;
};

export type CreateSessionInput = {
  absoluteLifetimeSeconds: number;
  authTime: Date;
  idleLifetimeSeconds: number;
  sessionId: string;
  tokenHash: Uint8Array;
  traceId: string;
  providerSubject: string;
};

export type CreateSessionResult =
  | { status: "CREATED"; principal: AuthenticatedPrincipal }
  | { status: "IDENTITY_NOT_PROVISIONED" }
  | { status: "PRINCIPAL_INACTIVE" };

export type CreateLoginTransactionResult =
  | { status: "CREATED" }
  | { status: "CAPACITY_EXCEEDED" };

export type CreateCustomLoginTransactionResult =
  | CreateLoginTransactionResult
  | { status: "REPLAYED" };

export type PrepareCustomLoginResult =
  | { status: "PREPARED" }
  | { status: "FLOW_INVALID" }
  | { status: "RATE_LIMITED" };

export type ReserveCustomLoginValidationResult =
  | { status: "RESERVED" }
  | { status: "VALIDATED" }
  | { status: "FLOW_INVALID" }
  | { status: "RATE_LIMITED" };

export type ConsumeCustomLoginAttemptResult =
  | { status: "CONSUMED" }
  | { status: "FLOW_INVALID" }
  | { status: "RATE_LIMITED" };

export interface AuthRepository {
  close?(): Promise<void>;
  consumeLoginTransaction(
    stateHash: Uint8Array,
    browserBindingHash: Uint8Array,
  ): Promise<LoginTransaction | null>;
  consumeCustomLoginAttempt(input: {
    accountHash: Uint8Array;
    authRequestHash: Uint8Array;
    browserBindingHash: Uint8Array;
    csrfHash: Uint8Array;
    ipHash: Uint8Array;
  }): Promise<ConsumeCustomLoginAttemptResult>;
  createCustomLoginTransaction(
    input: CreateCustomLoginTransactionInput,
  ): Promise<CreateCustomLoginTransactionResult>;
  createLoginTransaction(input: CreateLoginTransactionInput): Promise<CreateLoginTransactionResult>;
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  prepareCustomLogin(input: {
    authRequestHash: Uint8Array;
    browserBindingHash: Uint8Array;
    csrfHash: Uint8Array;
    csrfLifetimeSeconds: number;
  }): Promise<PrepareCustomLoginResult>;
  reserveCustomLoginValidation(input: {
    authRequestHash: Uint8Array;
    browserBindingHash: Uint8Array;
  }): Promise<ReserveCustomLoginValidationResult>;
  reserveCustomLoginStart(ipHash: Uint8Array): Promise<{ status: "RESERVED" | "RATE_LIMITED" }>;
  resolvePrincipal(tokenHash: Uint8Array, idleLifetimeSeconds: number): Promise<AuthenticatedPrincipal | null>;
  revokeSession(tokenHash: Uint8Array, reason: string, traceId: string): Promise<boolean>;
}

type PrincipalRow = {
  company_id: string;
  identity_id: string;
  session_id: string;
  user_id: string;
  user_type: HotelUserType;
  display_name: string;
};

function mapPrincipal(row: PrincipalRow): AuthenticatedPrincipal {
  return {
    companyId: row.company_id,
    identityId: row.identity_id,
    sessionId: row.session_id,
    userId: row.user_id,
    userType: row.user_type,
    displayName: row.display_name,
  };
}

export function createPostgresAuthRepository(databaseUrl: string): AuthRepository {
  const sql = postgres(databaseUrl, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });

  return {
    async close() {
      await sql.end({ timeout: 1 });
    },

    async createLoginTransaction(input) {
      return sql.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(915202607160001)`;
        await transaction`
          delete from auth_login_transactions
          where id in (
            select id
            from auth_login_transactions
            where expires_at <= now()
            order by expires_at
            limit 256
            for update skip locked
          )
        `;
        const capacity = await transaction<{ active_count: number; recent_count: number }[]>`
          select count(*) filter (where expires_at > now())::int as active_count,
                 count(*) filter (where created_at > now() - interval '1 minute')::int as recent_count
          from auth_login_transactions
        `;
        if ((capacity[0]?.active_count ?? 0) >= 10000
          || (capacity[0]?.recent_count ?? 0) >= 1000) {
          return { status: "CAPACITY_EXCEEDED" } as const;
        }
        await transaction`
          insert into auth_login_transactions (
            id, state_hash, browser_binding_hash, nonce_hash,
            code_verifier_ciphertext, code_verifier_iv, encryption_key_version,
            redirect_uri, expires_at
          ) values (
            ${input.id}, ${input.stateHash}, ${input.browserBindingHash}, ${input.nonceHash},
            ${input.codeVerifierCiphertext}, ${input.codeVerifierIv}, ${input.encryptionKeyVersion},
            ${input.redirectUri}, now() + make_interval(secs => ${input.lifetimeSeconds})
          )
        `;
        return { status: "CREATED" } as const;
      });
    },

    async createCustomLoginTransaction(input) {
      return sql.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(915202607160001)`;
        await transaction`
          delete from auth_login_transactions
          where id in (
            select id
            from auth_login_transactions
            where expires_at <= now()
            order by expires_at
            limit 256
            for update skip locked
          )
        `;
        const claimed = await transaction<{ claimed: boolean }[]>`
          select exists (
            select 1
            from auth_login_transactions
            where custom_auth_request_hash = ${input.authRequestHash}
              and expires_at > now()
          ) as claimed
        `;
        if (claimed[0]?.claimed) return { status: "REPLAYED" } as const;
        const capacity = await transaction<{ active_count: number; recent_count: number }[]>`
          select count(*) filter (where expires_at > now())::int as active_count,
                 count(*) filter (where created_at > now() - interval '1 minute')::int as recent_count
          from auth_login_transactions
        `;
        if ((capacity[0]?.active_count ?? 0) >= 10000
          || (capacity[0]?.recent_count ?? 0) >= 1000) {
          return { status: "CAPACITY_EXCEEDED" } as const;
        }
        await transaction`
          insert into auth_login_transactions (
            id, state_hash, browser_binding_hash, nonce_hash,
            code_verifier_ciphertext, code_verifier_iv, encryption_key_version,
            redirect_uri, expires_at, custom_auth_request_hash,
            custom_csrf_hash, custom_csrf_expires_at, custom_validation_count
          ) values (
            ${input.id}, ${input.stateHash}, ${input.browserBindingHash}, ${input.nonceHash},
            ${input.codeVerifierCiphertext}, ${input.codeVerifierIv}, ${input.encryptionKeyVersion},
            ${input.redirectUri}, now() + make_interval(secs => ${input.lifetimeSeconds}),
            ${input.authRequestHash}, ${input.csrfHash},
            now() + make_interval(secs => ${input.csrfLifetimeSeconds}), 1
          )
        `;
        return { status: "CREATED" } as const;
      });
    },

    async consumeLoginTransaction(stateHash, browserBindingHash) {
      const rows = await sql<{
        code_verifier_ciphertext: Uint8Array;
        code_verifier_iv: Uint8Array;
        encryption_key_version: number;
        nonce_hash: Uint8Array;
        redirect_uri: string;
      }[]>`
        delete from auth_login_transactions
        where state_hash = ${stateHash}
          and browser_binding_hash = ${browserBindingHash}
          and expires_at > now()
        returning code_verifier_ciphertext, code_verifier_iv,
                  encryption_key_version, nonce_hash, redirect_uri
      `;
      const row = rows[0];
      return row ? {
        codeVerifierCiphertext: row.code_verifier_ciphertext,
        codeVerifierIv: row.code_verifier_iv,
        encryptionKeyVersion: row.encryption_key_version,
        nonceHash: row.nonce_hash,
        redirectUri: row.redirect_uri,
      } : null;
    },

    async prepareCustomLogin(input) {
      const rows = await sql<{ id: string }[]>`
        update auth_login_transactions
        set custom_auth_request_hash = ${input.authRequestHash},
            custom_csrf_hash = ${input.csrfHash},
            custom_csrf_expires_at = now() + make_interval(secs => ${input.csrfLifetimeSeconds})
        where browser_binding_hash = ${input.browserBindingHash}
          and expires_at > now() + make_interval(secs => ${input.csrfLifetimeSeconds})
          and custom_attempt_count < 5
          and (custom_auth_request_hash is null or custom_auth_request_hash = ${input.authRequestHash})
        returning id
      `;
      if (rows[0]) return { status: "PREPARED" } as const;
      const limited = await sql<{ limited: boolean }[]>`
        select exists (
          select 1 from auth_login_transactions
          where browser_binding_hash = ${input.browserBindingHash}
            and expires_at > now()
            and custom_attempt_count >= 5
        ) as limited
      `;
      return limited[0]?.limited
        ? { status: "RATE_LIMITED" } as const
        : { status: "FLOW_INVALID" } as const;
    },

    async reserveCustomLoginValidation(input) {
      const validated = await sql<{ validated: boolean }[]>`
        select exists (
          select 1 from auth_login_transactions
          where browser_binding_hash = ${input.browserBindingHash}
            and custom_auth_request_hash = ${input.authRequestHash}
            and expires_at > now()
        ) as validated
      `;
      if (validated[0]?.validated) return { status: "VALIDATED" } as const;

      const reserved = await sql<{ id: string }[]>`
        update auth_login_transactions
        set custom_validation_count = custom_validation_count + 1
        where browser_binding_hash = ${input.browserBindingHash}
          and custom_auth_request_hash is null
          and custom_validation_count < 5
          and expires_at > now()
        returning id
      `;
      if (reserved[0]) return { status: "RESERVED" } as const;

      const limited = await sql<{ limited: boolean }[]>`
        select exists (
          select 1 from auth_login_transactions
          where browser_binding_hash = ${input.browserBindingHash}
            and custom_auth_request_hash is null
            and custom_validation_count >= 5
            and expires_at > now()
        ) as limited
      `;
      return limited[0]?.limited
        ? { status: "RATE_LIMITED" } as const
        : { status: "FLOW_INVALID" } as const;
    },

    async reserveCustomLoginStart(ipHash) {
      const rows = await sql<{ attempt_count: number }[]>`
        insert into auth_credential_rate_limits (
          scope, subject_hash, window_started_at, attempt_count, expires_at
        ) values (
          'IP', ${ipHash}, now(), 1, now() + interval '15 minutes'
        )
        on conflict (scope, subject_hash) do update
        set window_started_at = case
              when auth_credential_rate_limits.expires_at <= now() then now()
              else auth_credential_rate_limits.window_started_at
            end,
            attempt_count = case
              when auth_credential_rate_limits.expires_at <= now() then 1
              else least(auth_credential_rate_limits.attempt_count + 1, 1000)
            end,
            expires_at = case
              when auth_credential_rate_limits.expires_at <= now() then now() + interval '15 minutes'
              else auth_credential_rate_limits.expires_at
            end
        returning attempt_count
      `;
      return (rows[0]?.attempt_count ?? 1000) > 20
        ? { status: "RATE_LIMITED" } as const
        : { status: "RESERVED" } as const;
    },

    async consumeCustomLoginAttempt(input) {
      return sql.begin(async (transaction) => {
        const consumed = await transaction<{ id: string }[]>`
          update auth_login_transactions
          set custom_csrf_hash = null,
              custom_csrf_expires_at = null,
              custom_attempt_count = custom_attempt_count + 1
          where browser_binding_hash = ${input.browserBindingHash}
            and custom_auth_request_hash = ${input.authRequestHash}
            and custom_csrf_hash = ${input.csrfHash}
            and custom_csrf_expires_at > now()
            and expires_at > now()
            and custom_attempt_count < 5
          returning id
        `;
        if (!consumed[0]) return { status: "FLOW_INVALID" } as const;

        await transaction`
          delete from auth_credential_rate_limits
          where (scope, subject_hash) in (
            select scope, subject_hash
            from auth_credential_rate_limits
            where expires_at <= now()
            order by expires_at
            limit 256
            for update skip locked
          )
        `;
        const counts: number[] = [];
        for (const [scope, subjectHash] of [
          ["IP", input.ipHash] as const,
          ["ACCOUNT", input.accountHash] as const,
        ]) {
          const rows = await transaction<{ attempt_count: number }[]>`
            insert into auth_credential_rate_limits (
              scope, subject_hash, window_started_at, attempt_count, expires_at
            ) values (
              ${scope}, ${subjectHash}, now(), 1, now() + interval '15 minutes'
            )
            on conflict (scope, subject_hash) do update
            set window_started_at = case
                  when auth_credential_rate_limits.expires_at <= now() then now()
                  else auth_credential_rate_limits.window_started_at
                end,
                attempt_count = case
                  when auth_credential_rate_limits.expires_at <= now() then 1
                  else least(auth_credential_rate_limits.attempt_count + 1, 1000)
                end,
                expires_at = case
                  when auth_credential_rate_limits.expires_at <= now() then now() + interval '15 minutes'
                  else auth_credential_rate_limits.expires_at
                end
            returning attempt_count
          `;
          counts.push(rows[0]?.attempt_count ?? 1000);
        }
        return counts[0]! > 30 || counts[1]! > 10
          ? { status: "RATE_LIMITED" } as const
          : { status: "CONSUMED" } as const;
      });
    },

    async createSession(input) {
      const rows = await sql<{
        company_id: string | null;
        display_name: string | null;
        identity_id: string | null;
        result_status: string;
        session_id: string | null;
        user_id: string | null;
        user_type: HotelUserType | null;
      }[]>`
        select * from public.auth_create_session(
          ${input.sessionId}::uuid,
          ${input.tokenHash}::bytea,
          ${input.providerSubject}::text,
          ${input.idleLifetimeSeconds}::integer,
          ${input.absoluteLifetimeSeconds}::integer,
          ${input.authTime}::timestamptz,
          ${input.traceId}::uuid
        )
      `;
      if (rows.length !== 1) {
        throw new Error("auth session function returned an unexpected row count");
      }
      const result = rows[0]!;
      if (
        result.result_status === "IDENTITY_NOT_PROVISIONED" ||
        result.result_status === "PRINCIPAL_INACTIVE"
      ) {
        if (
          result.company_id !== null || result.identity_id !== null ||
          result.session_id !== null || result.user_id !== null ||
          result.user_type !== null || result.display_name !== null
        ) {
          throw new Error("auth session denial returned principal data");
        }
        return { status: result.result_status } as const;
      }
      if (result.result_status !== "CREATED") {
        throw new Error("auth session function returned an unexpected status");
      }
      if (
        !result.company_id || !result.identity_id || !result.session_id ||
        !result.user_id || !result.user_type || !result.display_name
      ) {
        throw new Error("auth session function returned an incomplete principal");
      }
      return {
        status: "CREATED",
        principal: {
          companyId: result.company_id,
          identityId: result.identity_id,
          sessionId: result.session_id,
          userId: result.user_id,
          userType: result.user_type,
          displayName: result.display_name,
        },
      } as const;
    },

    async resolvePrincipal(tokenHash, idleLifetimeSeconds) {
      const rows = await sql<PrincipalRow[]>`
        with active_principal as (
          select session.id as session_id,
                 session.company_id,
                 session.identity_id,
                 session.user_id,
                 app_user.user_type,
                 app_user.display_name
          from auth_sessions session
          join users app_user
            on app_user.company_id = session.company_id
           and app_user.id = session.user_id
          join companies company on company.id = session.company_id
          join auth_identities identity
            on identity.company_id = session.company_id
           and identity.id = session.identity_id
           and identity.user_id = session.user_id
          where session.token_hash = ${tokenHash}
            and session.revoked_at is null
            and session.idle_expires_at > now()
            and session.absolute_expires_at > now()
            and app_user.status = 'ACTIVE'
            and company.status = 'ACTIVE'
            and identity.provider = 'ZITADEL'
        ), touch_session as (
          update auth_sessions session
          set last_seen_at = now(),
              idle_expires_at = least(
                now() + make_interval(secs => ${idleLifetimeSeconds}),
                session.absolute_expires_at
              )
          from active_principal principal
          where session.id = principal.session_id
            and session.last_seen_at <= now() - interval '5 minutes'
          returning session.id
        )
        select company_id, identity_id, session_id, user_id, user_type, display_name
        from active_principal
      `;
      return rows[0] ? mapPrincipal(rows[0]) : null;
    },

    async revokeSession(tokenHash, reason, traceId) {
      return sql.begin(async (transaction) => {
        const rows = await transaction<PrincipalRow[]>`
          select session.company_id,
                 session.identity_id,
                 session.id as session_id,
                 session.user_id,
                 app_user.user_type,
                 app_user.display_name
          from auth_sessions session
          join users app_user
            on app_user.company_id = session.company_id
           and app_user.id = session.user_id
          where session.token_hash = ${tokenHash}
            and session.revoked_at is null
          for update of session
        `;
        const principal = rows[0];
        if (!principal) return false;

        await transaction`
          update auth_sessions
          set revoked_at = now(), revoke_reason = ${reason}
          where id = ${principal.session_id}
        `;
        await transaction`
          insert into audit_events (
            id, event_code, actor_user_id, actor_type, session_id,
            company_id, resource_type, resource_id, reason, result, trace_id
          ) values (
            ${crypto.randomUUID()}, 'AUTH_LOGOUT_SUCCEEDED', ${principal.user_id},
            ${principal.user_type}, ${principal.session_id}, ${principal.company_id},
            'SESSION', ${principal.session_id}, ${reason}, 'SUCCEEDED', ${traceId}
          )
        `;
        return true;
      });
    },
  };
}
