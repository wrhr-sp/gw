import type {
  Account,
  AccountEligibleHotel,
  AccountPermission,
  AccountListQuery,
  AuthenticatedPrincipal,
  CreateAccountRequest,
  DeactivateAccountRequest,
  HotelErrorCode,
  InitialPasswordRequest,
} from "@werehere/contracts";
import {
  createAccountRequestSchema,
  initialPasswordRequestSchema,
} from "@werehere/contracts";
import type { AccountRepository as DbAccountRepository } from "@werehere/db";

type ApiSessionMethod =
  | "markCreateDispatched"
  | "markProviderCreated"
  | "markCreateRecoveryRequired"
  | "completeCreate"
  | "getCreateOutcome"
  | "prepareCompensation"
  | "markInitialPasswordDispatched"
  | "markInitialPasswordRecoveryRequired"
  | "confirmInitialPasswordProviderState"
  | "markInitialPasswordProviderUpdated";
type RequireSession<F> = F extends (input: infer I) => infer R
  ? (input: I & { sessionId: string }) => R
  : never;
export type AccountRepository = Omit<DbAccountRepository, ApiSessionMethod> & {
  [Method in ApiSessionMethod]: RequireSession<DbAccountRepository[Method]>;
};

export interface UserProvisioningProvider {
  createHumanUser(input: {
    displayName: string;
    email: string;
    initialPassword: string;
    loginName: string;
    userId: string;
  }): Promise<{ subject: string }>;
  humanUserExists(subject: string): Promise<boolean>;
  verifyPassword(input: {
    expectedSubject: string;
    loginName: string;
    password: string;
  }): Promise<boolean>;
  deactivateHumanUser(subject: string): Promise<"DEACTIVATED" | "NOT_FOUND">;
  setPassword(subject: string, newPassword: string): Promise<void>;
}

export class AccountServiceError extends Error {
  constructor(
    readonly code: HotelErrorCode,
    readonly httpStatus: number,
    readonly retryable: boolean,
    readonly fieldErrors: Array<{ field: string; message: string }> = [],
  ) {
    super(code);
    this.name = "AccountServiceError";
  }
}

export interface AccountService {
  close?(): Promise<void>;
  createAccount(
    principal: AuthenticatedPrincipal,
    value: CreateAccountRequest,
    idempotencyKey: string,
  ): Promise<{ status: "CREATED" | "REPLAYED"; account: Account }>;
  listAccounts(
    principal: AuthenticatedPrincipal,
    query: AccountListQuery,
  ): Promise<
    | {
        status: "OK";
        accounts: Account[];
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      }
    | { status: "FORBIDDEN" }
  >;
  listEligibleHotels(
    principal: AuthenticatedPrincipal,
  ): Promise<
    { status: "OK"; hotels: AccountEligibleHotel[] } | { status: "FORBIDDEN" }
  >;
  getAccount(
    principal: AuthenticatedPrincipal,
    userId: string,
  ): Promise<Account | null | { status: "FORBIDDEN" }>;
  getCapabilities(
    principal: AuthenticatedPrincipal,
  ): Promise<{ permissions: AccountPermission[] }>;
  deactivateAccount(
    principal: AuthenticatedPrincipal,
    userId: string,
    value: DeactivateAccountRequest,
    idempotencyKey?: string,
  ): Promise<{ status: "UPDATED"; account: Account }>;
  changeInitialPassword(
    principal: AuthenticatedPrincipal,
    value: InitialPasswordRequest,
    idempotencyKey: string,
  ): Promise<{ status: "UPDATED" }>;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function actor(principal: AuthenticatedPrincipal) {
  return {
    companyId: principal.companyId,
    sessionId: principal.sessionId,
    userId: principal.userId,
    userType: principal.userType,
  };
}

export function createAccountService(input: {
  provider: UserProvisioningProvider;
  repository: AccountRepository;
}): AccountService {
  return {
    close() {
      return input.repository.close?.() ?? Promise.resolve();
    },

    async createAccount(principal, value, idempotencyKey) {
      const parsed = createAccountRequestSchema.safeParse(value);
      if (!parsed.success)
        throw new AccountServiceError(
          "VALIDATION_ERROR",
          400,
          false,
          parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? "initialPassword"),
            message: issue.message,
          })),
        );
      value = parsed.data;
      const accountId = crypto.randomUUID();
      const hotelIds =
        value.userType === "HOUSEKEEPING"
          ? (value.hotelIds ?? [])
          : value.hotelId
            ? [value.hotelId]
            : [];
      const nonSecretRequest = {
        displayName: value.displayName,
        loginName: value.loginName,
        email: value.email,
        userType: value.userType,
        ...(value.userType === "HOUSEKEEPING"
          ? { hotelIds }
          : { hotelId: hotelIds[0] }),
        assignmentStartDate: value.assignmentStartDate,
        reason: value.reason,
      };
      const reserved = await input.repository.reserveCreate({
        accountId,
        actor: actor(principal),
        attemptId: crypto.randomUUID(),
        hotelIds,
        completionPayload: nonSecretRequest,
        idempotencyKey,
        requestHash: await sha256(JSON.stringify(nonSecretRequest)),
      });
      if (reserved.status === "FORBIDDEN")
        throw new AccountServiceError("FORBIDDEN", 403, false);
      if (reserved.status === "HOTEL_NOT_FOUND")
        throw new AccountServiceError("RESOURCE_NOT_FOUND", 404, false);
      if (
        reserved.status === "COMPENSATED" ||
        reserved.status === "LOGIN_ID_CONFLICT"
      ) {
        throw new AccountServiceError("ACCOUNT_DUPLICATE", 409, false);
      }
      if (reserved.status === "COMPENSATION_REQUIRED")
        throw new AccountServiceError("COMPENSATION_REQUIRED", 503, false);
      if (reserved.status === "RECOVERY_REQUIRED")
        throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      if (
        reserved.status === "OPERATOR_REQUIRED" ||
        reserved.status === "DEAD_LETTER"
      ) {
        throw new AccountServiceError("INTERNAL_ERROR", 500, false);
      }
      if (reserved.status === "IDEMPOTENCY_CONFLICT")
        throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, false);
      if (reserved.status === "IN_PROGRESS")
        throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
      if (reserved.status === "REPLAYED") {
        throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, false);
      }
      if (!("accountId" in reserved))
        throw new AccountServiceError("INTERNAL_ERROR", 500, true);

      const targetId = reserved.accountId;
      const leaseVersion = reserved.leaseVersion;
      let subject =
        reserved.status === "PROVIDER_CONFIRMED" ? reserved.subject : null;
      let providerCreated = subject !== null;
      let compensationAllowed = false;
      try {
        if (
          subject &&
          !(await input.provider.verifyPassword({
            expectedSubject: subject,
            loginName: value.loginName,
            password: value.initialPassword,
          }))
        ) {
          throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, false);
        }
        if (!subject) {
          const dispatched = await input.repository.markCreateDispatched({
            accountId: targetId,
            companyId: principal.companyId,
            sessionId: principal.sessionId,
            leaseVersion,
          });
          if (dispatched === "STALE_LEASE") {
            throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
          }
          try {
            const created = await input.provider.createHumanUser({
              userId: targetId,
              displayName: value.displayName,
              loginName: value.loginName,
              email: value.email,
              initialPassword: value.initialPassword,
            });
            subject = created.subject;
          } catch (error) {
            const providerError =
              error instanceof AccountServiceError
                ? error
                : new AccountServiceError(
                    "EXTERNAL_AUTH_UNAVAILABLE",
                    503,
                    true,
                  );
            await input.repository.markCreateRecoveryRequired({
              accountId: targetId,
              companyId: principal.companyId,
              sessionId: principal.sessionId,
              leaseVersion,
              errorCode: providerError.code,
            });
            throw providerError;
          }
          providerCreated = true;
          const marked = await input.repository.markProviderCreated({
            accountId: targetId,
            companyId: principal.companyId,
            sessionId: principal.sessionId,
            leaseVersion,
            subject,
          });
          if (marked === "STALE_LEASE") {
            providerCreated = false;
            throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
          }
        }
        const completed = await input.repository.completeCreate({
          accountId: targetId,
          actorUserId: principal.userId,
          assignmentIds: hotelIds.map(() => crypto.randomUUID()),
          auditEventId: crypto.randomUUID(),
          companyId: principal.companyId,
          sessionId: principal.sessionId,
          idempotencyKey,
          leaseVersion,
          subject,
          traceId: crypto.randomUUID(),
          value: nonSecretRequest,
        });
        if (completed.status === "FORBIDDEN") {
          compensationAllowed = true;
          throw new AccountServiceError("FORBIDDEN", 403, false);
        }
        if (completed.status === "DUPLICATE") {
          compensationAllowed = true;
          throw new AccountServiceError("ACCOUNT_DUPLICATE", 409, false);
        }
        if (!("account" in completed))
          throw new AccountServiceError("INTERNAL_ERROR", 500, true);
        const outcome = await input.repository.getCreateOutcome({
          accountId: targetId,
          companyId: principal.companyId,
          sessionId: principal.sessionId,
        });
        if (outcome.status !== "COMPLETED")
          throw new AccountServiceError("INTERNAL_ERROR", 500, true);
        return { status: completed.status, account: outcome.account };
      } catch (error) {
        if (providerCreated && !compensationAllowed) {
          try {
            const outcome = await input.repository.getCreateOutcome({
              accountId: targetId,
              companyId: principal.companyId,
              sessionId: principal.sessionId,
            });
            if (outcome.status === "COMPLETED") {
              return { status: "CREATED", account: outcome.account };
            }
          } catch {
            // The original result remains ambiguous. A retry/reconciler must converge it.
          }
        }
        if (providerCreated && compensationAllowed) {
          const prepared = await input.repository.prepareCompensation({
            accountId: targetId,
            companyId: principal.companyId,
            sessionId: principal.sessionId,
            leaseVersion,
          });
          if (prepared === "STALE_LEASE") {
            const outcome = await input.repository.getCreateOutcome({
              accountId: targetId,
              companyId: principal.companyId,
              sessionId: principal.sessionId,
            });
            if (outcome.status === "COMPLETED") {
              return { status: "CREATED", account: outcome.account };
            }
            throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
          }
          throw new AccountServiceError("COMPENSATION_REQUIRED", 503, false);
        }
        if (error instanceof AccountServiceError) throw error;
        throw new AccountServiceError("INTERNAL_ERROR", 500, true);
      }
    },

    listAccounts(principal, query) {
      return input.repository.listAccounts(actor(principal), query);
    },

    listEligibleHotels(principal) {
      return input.repository.listEligibleHotels(actor(principal));
    },

    getAccount(principal, userId) {
      return input.repository.getAccount(actor(principal), userId);
    },

    getCapabilities(principal) {
      return input.repository.getCapabilities(actor(principal));
    },

    async deactivateAccount(
      principal,
      userId,
      value,
      idempotencyKey = crypto.randomUUID(),
    ) {
      if (principal.userId === userId) {
        throw new AccountServiceError(
          "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN",
          409,
          false,
        );
      }
      const result = await input.repository.deactivateAccount({
        actor: actor(principal),
        auditEventId: crypto.randomUUID(),
        idempotencyKey,
        requestHash: await sha256(
          JSON.stringify({
            userId,
            version: value.version,
            reason: value.reason,
          }),
        ),
        targetUserId: userId,
        traceId: crypto.randomUUID(),
        value,
      });
      if (result.status === "FORBIDDEN")
        throw new AccountServiceError("FORBIDDEN", 403, false);
      if (result.status === "NOT_FOUND")
        throw new AccountServiceError("ACCOUNT_NOT_FOUND", 404, false);
      if (result.status === "VERSION_CONFLICT")
        throw new AccountServiceError("ACCOUNT_VERSION_CONFLICT", 409, false);
      if (result.status === "LAST_ADMIN")
        throw new AccountServiceError(
          "LAST_ADMIN_DEACTIVATION_FORBIDDEN",
          409,
          false,
        );
      if (result.status === "IDEMPOTENCY_CONFLICT")
        throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, false);
      if (result.status !== "UPDATED")
        throw new AccountServiceError("INTERNAL_ERROR", 500, true);
      return result;
    },

    async changeInitialPassword(principal, value, idempotencyKey) {
      const parsed = initialPasswordRequestSchema.safeParse(value);
      if (!parsed.success)
        throw new AccountServiceError(
          "VALIDATION_ERROR",
          400,
          false,
          parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? "newPassword"),
            message: issue.message,
          })),
        );
      value = parsed.data;
      if (principal.mustChangePassword !== true) {
        throw new AccountServiceError("INVALID_STATE_TRANSITION", 409, false);
      }
      const reserved = await input.repository.reserveInitialPassword({
        companyId: principal.companyId,
        sessionId: principal.sessionId,
        userId: principal.userId,
        idempotencyKey,
      });
      if (reserved.status === "NOT_PENDING")
        throw new AccountServiceError("INVALID_STATE_TRANSITION", 409, false);
      if (reserved.status === "IN_PROGRESS")
        throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
      if (reserved.status === "RECOVERY_REQUIRED")
        throw new AccountServiceError("PASSWORD_RECOVERY_REQUIRED", 503, true);
      if (reserved.status === "REPLAYED")
        throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, false);
      let operationKey = idempotencyKey;
      if (
        reserved.status === "RECOVERY_CONFIRMABLE" ||
        reserved.status === "PROVIDER_UPDATED"
      ) {
        operationKey = reserved.idempotencyKey;
        const verified = await input.provider.verifyPassword({
          expectedSubject: reserved.subject,
          loginName: reserved.loginName,
          password: value.newPassword,
        });
        if (!verified)
          throw new AccountServiceError(
            "PASSWORD_RECOVERY_REQUIRED",
            409,
            false,
          );
        if (reserved.status === "RECOVERY_CONFIRMABLE") {
          const confirmed =
            await input.repository.confirmInitialPasswordProviderState({
              companyId: principal.companyId,
              sessionId: principal.sessionId,
              userId: principal.userId,
              idempotencyKey: operationKey,
              leaseVersion: reserved.leaseVersion,
            });
          if (confirmed === "STALE_LEASE") {
            throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
          }
        }
      }
      if (reserved.status === "RESERVED_NOT_DISPATCHED") {
        const dispatched = await input.repository.markInitialPasswordDispatched(
          {
            companyId: principal.companyId,
            sessionId: principal.sessionId,
            userId: principal.userId,
            idempotencyKey: operationKey,
            leaseVersion: reserved.leaseVersion,
          },
        );
        if (dispatched === "STALE_LEASE") {
          throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
        }
        try {
          await input.provider.setPassword(reserved.subject, value.newPassword);
        } catch (error) {
          const providerError =
            error instanceof AccountServiceError
              ? error
              : new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
          await input.repository.markInitialPasswordRecoveryRequired({
            companyId: principal.companyId,
            sessionId: principal.sessionId,
            userId: principal.userId,
            idempotencyKey: operationKey,
            leaseVersion: reserved.leaseVersion,
            errorCode: providerError.code,
          });
          throw providerError;
        }
        const marked =
          await input.repository.markInitialPasswordProviderUpdated({
            companyId: principal.companyId,
            sessionId: principal.sessionId,
            userId: principal.userId,
            idempotencyKey: operationKey,
            leaseVersion: reserved.leaseVersion,
          });
        if (marked === "STALE_LEASE") {
          throw new AccountServiceError("IDEMPOTENCY_CONFLICT", 409, true);
        }
      }
      const result = await input.repository.completeInitialPassword({
        auditEventId: crypto.randomUUID(),
        companyId: principal.companyId,
        sessionId: principal.sessionId,
        traceId: crypto.randomUUID(),
        userId: principal.userId,
        idempotencyKey: operationKey,
      });
      if (result.status !== "UPDATED" && result.status !== "REPLAYED") {
        throw new AccountServiceError("INVALID_STATE_TRANSITION", 409, false);
      }
      return { status: "UPDATED" };
    },
  };
}
