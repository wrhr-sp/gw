const encoder = new TextEncoder();
const SECONDARY_PASSWORD_PIN_REGEX = /^\d{4}$/;
const HASH_ITERATIONS = 150_000;
const HASH_LENGTH_BYTES = 32;
const SALT_BYTES = 16;

export const secondaryPasswordPolicy = {
  verificationTtlMinutes: 15,
  highRiskFreshnessMinutes: 5,
  maxAttempts: 5,
  lockMinutes: 15,
} as const;

export type SecondaryPasswordCredentialStatus = "active" | "reset_required" | "disabled";
export type SecondaryPasswordVerificationScope =
  | "admin_settings"
  | "admin_high_risk"
  | "admin_users"
  | "admin_policies"
  | "secondary_password";

export type SecondaryPasswordStatusSnapshot = {
  required: boolean;
  enrollmentRequired: boolean;
  hasSecondaryPassword: boolean;
  credentialStatus: SecondaryPasswordCredentialStatus;
  verification: {
    verified: boolean;
    verifiedAt: string | null;
    expiresAt: string | null;
    freshUntil: string | null;
  };
  lock: {
    locked: boolean;
    lockedUntil: string | null;
    failedAttemptCount: number;
  };
  policy: typeof secondaryPasswordPolicy;
};

type SecondaryPasswordCredentialRecord = {
  id: string;
  companyId: string;
  userId: string;
  passwordHash: string | null;
  hashAlgorithm: "pbkdf2-sha256-preview";
  salt: string | null;
  status: SecondaryPasswordCredentialStatus;
  failedAttemptCount: number;
  lastFailedAt: string | null;
  lockedUntil: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  resetByUserId: string | null;
  resetReason: string | null;
};

type SecondaryPasswordVerificationRecord = {
  id: string;
  companyId: string;
  userId: string;
  sessionId: string;
  verifiedAt: string;
  expiresAt: string;
  lastHighRiskVerifiedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  ipHashOrMaskedIp: string;
  userAgentSummary: string;
  createdAt: string;
};

type UserRef = {
  companyId: string;
  userId: string;
  sessionId: string;
};

type ActorRef = UserRef & {
  actorUserId: string;
};

type RequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type VerificationState = {
  verified: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
  freshUntil: string | null;
};

type StatusInput = UserRef & {
  required: boolean;
  now?: Date;
};

type EnrollInput = ActorRef & {
  nextPin: string;
  confirmPin: string;
  now?: Date;
  requestContext?: RequestContext;
};

type VerifyInput = UserRef & {
  pin: string;
  scope: SecondaryPasswordVerificationScope;
  now?: Date;
  requestContext?: RequestContext;
};

type ChangeInput = ActorRef & {
  currentPin: string;
  nextPin: string;
  confirmPin: string;
  now?: Date;
  requestContext?: RequestContext;
};

type ResetRequestInput = ActorRef & {
  reason: string;
  now?: Date;
};

type AdminResetInput = ActorRef & {
  targetUserId: string;
  reason: string;
  now?: Date;
};

type GuardInput = UserRef & {
  required: boolean;
  minFreshnessMinutes?: number;
  now?: Date;
};

type VerificationResult = {
  ok: true;
  status: SecondaryPasswordStatusSnapshot;
} | {
  ok: false;
  reason: "validation" | "locked" | "enrollment_required" | "forbidden" | "missing" | "expired" | "stale";
  message: string;
  status: SecondaryPasswordStatusSnapshot;
};

type MutationResult = {
  ok: true;
  status: SecondaryPasswordStatusSnapshot;
  auditEvent: string;
} | {
  ok: false;
  reason: "validation" | "locked" | "enrollment_required" | "forbidden";
  message: string;
  status: SecondaryPasswordStatusSnapshot;
};

const credentialStore = new Map<string, SecondaryPasswordCredentialRecord>();
const verificationStore = new Map<string, SecondaryPasswordVerificationRecord>();

function userKey(companyId: string, userId: string) {
  return `${companyId}:${userId}`;
}

function verificationKey(companyId: string, userId: string, sessionId: string) {
  return `${companyId}:${userId}:${sessionId}`;
}

function toIso(date: Date) {
  return date.toISOString();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function isFourDigitPin(value: string) {
  return SECONDARY_PASSWORD_PIN_REGEX.test(value);
}

function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function derivePinHash(pin: string, salt: string) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: HASH_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH_BYTES * 8,
  );
  return toHex(derivedBits);
}

async function hashContextValue(prefix: string, value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${prefix}:${value}`));
  return toHex(digest).slice(0, 24);
}

function summarizeUserAgent(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, 120) || "unknown";
}

async function normalizeRequestContext(context?: RequestContext) {
  return {
    ipHashOrMaskedIp: context?.ip ? await hashContextValue("ip", context.ip) : "unknown",
    userAgentSummary: summarizeUserAgent(context?.userAgent),
  };
}

function getCredentialRecord(companyId: string, userId: string) {
  return credentialStore.get(userKey(companyId, userId)) ?? null;
}

function saveCredentialRecord(record: SecondaryPasswordCredentialRecord) {
  credentialStore.set(userKey(record.companyId, record.userId), record);
}

function getVerificationRecord(companyId: string, userId: string, sessionId: string) {
  return verificationStore.get(verificationKey(companyId, userId, sessionId)) ?? null;
}

function saveVerificationRecord(record: SecondaryPasswordVerificationRecord) {
  verificationStore.set(verificationKey(record.companyId, record.userId, record.sessionId), record);
}

function revokeUserVerifications(companyId: string, userId: string, revokedAt: string, reason: string) {
  for (const [key, record] of verificationStore.entries()) {
    if (record.companyId !== companyId || record.userId !== userId || record.revokedAt) {
      continue;
    }
    verificationStore.set(key, {
      ...record,
      revokedAt,
      revokedReason: reason,
    });
  }
}

function resolveVerificationState(record: SecondaryPasswordVerificationRecord | null, now: Date): VerificationState {
  if (!record || record.revokedAt) {
    return { verified: false, verifiedAt: null, expiresAt: null, freshUntil: null };
  }

  if (new Date(record.expiresAt).getTime() <= now.getTime()) {
    return { verified: false, verifiedAt: record.verifiedAt, expiresAt: record.expiresAt, freshUntil: null };
  }

  return {
    verified: true,
    verifiedAt: record.verifiedAt,
    expiresAt: record.expiresAt,
    freshUntil: addMinutes(new Date(record.verifiedAt), secondaryPasswordPolicy.highRiskFreshnessMinutes).toISOString(),
  };
}

function buildStatusSnapshot(input: StatusInput): SecondaryPasswordStatusSnapshot {
  const now = input.now ?? new Date();
  const credential = getCredentialRecord(input.companyId, input.userId);
  const verification = getVerificationRecord(input.companyId, input.userId, input.sessionId);
  const verificationState = resolveVerificationState(verification, now);
  const locked = credential?.lockedUntil ? new Date(credential.lockedUntil).getTime() > now.getTime() : false;

  return {
    required: input.required,
    enrollmentRequired: input.required && (!credential || credential.status === "reset_required" || !credential.passwordHash),
    hasSecondaryPassword: credential?.status === "active" && Boolean(credential.passwordHash),
    credentialStatus: credential?.status ?? "reset_required",
    verification: verificationState,
    lock: {
      locked,
      lockedUntil: locked ? credential?.lockedUntil ?? null : null,
      failedAttemptCount: credential?.failedAttemptCount ?? 0,
    },
    policy: secondaryPasswordPolicy,
  };
}

function ensureMutableCredential(companyId: string, userId: string, actorUserId: string, now: Date) {
  const current = getCredentialRecord(companyId, userId);
  if (current) {
    return current;
  }

  const created = {
    id: `secondary_password_${crypto.randomUUID()}`,
    companyId,
    userId,
    passwordHash: null,
    hashAlgorithm: "pbkdf2-sha256-preview" as const,
    salt: null,
    status: "reset_required" as const,
    failedAttemptCount: 0,
    lastFailedAt: null,
    lockedUntil: null,
    lastVerifiedAt: null,
    createdAt: toIso(now),
    updatedAt: toIso(now),
    createdByUserId: actorUserId,
    resetByUserId: null,
    resetReason: null,
  } satisfies SecondaryPasswordCredentialRecord;
  saveCredentialRecord(created);
  return created;
}

function applyFailedAttempt(record: SecondaryPasswordCredentialRecord, now: Date) {
  const failedAttemptCount = record.failedAttemptCount + 1;
  const lockedUntil =
    failedAttemptCount >= secondaryPasswordPolicy.maxAttempts ? addMinutes(now, secondaryPasswordPolicy.lockMinutes).toISOString() : null;
  const updated = {
    ...record,
    failedAttemptCount,
    lastFailedAt: toIso(now),
    lockedUntil,
    updatedAt: toIso(now),
  } satisfies SecondaryPasswordCredentialRecord;
  saveCredentialRecord(updated);
  return updated;
}

function resetFailureState(record: SecondaryPasswordCredentialRecord, now: Date) {
  const updated = {
    ...record,
    failedAttemptCount: 0,
    lastFailedAt: null,
    lockedUntil: null,
    lastVerifiedAt: toIso(now),
    updatedAt: toIso(now),
  } satisfies SecondaryPasswordCredentialRecord;
  saveCredentialRecord(updated);
  return updated;
}

async function createVerificationRecord(input: UserRef & { verifiedAt: Date; requestContext?: RequestContext }) {
  const requestContext = await normalizeRequestContext(input.requestContext);
  const record = {
    id: `secondary_password_verification_${crypto.randomUUID()}`,
    companyId: input.companyId,
    userId: input.userId,
    sessionId: input.sessionId,
    verifiedAt: toIso(input.verifiedAt),
    expiresAt: addMinutes(input.verifiedAt, secondaryPasswordPolicy.verificationTtlMinutes).toISOString(),
    lastHighRiskVerifiedAt: toIso(input.verifiedAt),
    revokedAt: null,
    revokedReason: null,
    ipHashOrMaskedIp: requestContext.ipHashOrMaskedIp,
    userAgentSummary: requestContext.userAgentSummary,
    createdAt: toIso(input.verifiedAt),
  } satisfies SecondaryPasswordVerificationRecord;
  saveVerificationRecord(record);
  return record;
}

async function verifyStoredPin(record: SecondaryPasswordCredentialRecord, pin: string) {
  if (!record.passwordHash || !record.salt) {
    return false;
  }
  const actualHash = await derivePinHash(pin, record.salt);
  return actualHash === record.passwordHash;
}

export function resetAdminSecondaryPasswordPreviewState() {
  credentialStore.clear();
  verificationStore.clear();
}

export function getSecondaryPasswordStatus(input: StatusInput) {
  return buildStatusSnapshot(input);
}

export async function enrollSecondaryPassword(input: EnrollInput): Promise<MutationResult> {
  const now = input.now ?? new Date();
  const current = ensureMutableCredential(input.companyId, input.userId, input.actorUserId, now);
  const statusBefore = buildStatusSnapshot({ ...input, required: true, now });

  if (current.status === "active" && current.passwordHash) {
    return {
      ok: false,
      reason: "forbidden",
      message: "이미 등록된 2차 비밀번호가 있습니다. 변경 API를 사용해 주세요.",
      status: statusBefore,
    };
  }

  if (!isFourDigitPin(input.nextPin) || input.nextPin !== input.confirmPin) {
    return {
      ok: false,
      reason: "validation",
      message: "새 2차 비밀번호는 4자리 숫자이며 확인 입력과 같아야 합니다.",
      status: statusBefore,
    };
  }

  const salt = generateSalt();
  const passwordHash = await derivePinHash(input.nextPin, salt);
  const updated = {
    ...current,
    passwordHash,
    salt,
    status: "active" as const,
    failedAttemptCount: 0,
    lastFailedAt: null,
    lockedUntil: null,
    lastVerifiedAt: toIso(now),
    updatedAt: toIso(now),
    resetByUserId: null,
    resetReason: null,
  } satisfies SecondaryPasswordCredentialRecord;
  saveCredentialRecord(updated);
  await createVerificationRecord({ ...input, verifiedAt: now, requestContext: input.requestContext });

  return {
    ok: true,
    status: buildStatusSnapshot({ ...input, required: true, now }),
    auditEvent: "admin.secondary_password.enrollment_completed",
  };
}

export async function verifySecondaryPassword(input: VerifyInput): Promise<MutationResult> {
  const now = input.now ?? new Date();
  const credential = getCredentialRecord(input.companyId, input.userId);
  const statusBefore = buildStatusSnapshot({ ...input, required: true, now });

  if (!credential || credential.status === "reset_required" || !credential.passwordHash) {
    return {
      ok: false,
      reason: "enrollment_required",
      message: "2차 비밀번호를 먼저 등록해 주세요.",
      status: statusBefore,
    };
  }

  if (credential.status === "disabled") {
    return {
      ok: false,
      reason: "forbidden",
      message: "비활성화된 2차 비밀번호입니다.",
      status: statusBefore,
    };
  }

  if (credential.lockedUntil && new Date(credential.lockedUntil).getTime() > now.getTime()) {
    return {
      ok: false,
      reason: "locked",
      message: "비밀번호를 여러 번 틀려 잠시 잠겼습니다. 잠시 후 다시 시도해 주세요.",
      status: buildStatusSnapshot({ ...input, required: true, now }),
    };
  }

  if (!isFourDigitPin(input.pin)) {
    return {
      ok: false,
      reason: "validation",
      message: "2차 비밀번호는 4자리 숫자여야 합니다.",
      status: statusBefore,
    };
  }

  if (!(await verifyStoredPin(credential, input.pin))) {
    const failed = applyFailedAttempt(credential, now);
    return {
      ok: false,
      reason: failed.lockedUntil ? "locked" : "forbidden",
      message: failed.lockedUntil
        ? "비밀번호를 여러 번 틀려 잠시 잠겼습니다. 잠시 후 다시 시도해 주세요."
        : "2차 비밀번호가 일치하지 않습니다.",
      status: buildStatusSnapshot({ ...input, required: true, now }),
    };
  }

  resetFailureState(credential, now);
  await createVerificationRecord({ ...input, verifiedAt: now, requestContext: input.requestContext });

  return {
    ok: true,
    status: buildStatusSnapshot({ ...input, required: true, now }),
    auditEvent: input.scope === "admin_high_risk" ? "admin.secondary_password.reauth_required" : "admin.secondary_password.verify_succeeded",
  };
}

export async function changeSecondaryPassword(input: ChangeInput): Promise<MutationResult> {
  const now = input.now ?? new Date();
  const credential = getCredentialRecord(input.companyId, input.userId);
  const statusBefore = buildStatusSnapshot({ ...input, required: true, now });

  if (!credential || credential.status === "reset_required" || !credential.passwordHash) {
    return {
      ok: false,
      reason: "enrollment_required",
      message: "등록된 2차 비밀번호가 없어 먼저 등록이 필요합니다.",
      status: statusBefore,
    };
  }

  if (credential.lockedUntil && new Date(credential.lockedUntil).getTime() > now.getTime()) {
    return {
      ok: false,
      reason: "locked",
      message: "비밀번호를 여러 번 틀려 잠시 잠겼습니다. 잠시 후 다시 시도해 주세요.",
      status: buildStatusSnapshot({ ...input, required: true, now }),
    };
  }

  if (!isFourDigitPin(input.nextPin) || input.nextPin !== input.confirmPin) {
    return {
      ok: false,
      reason: "validation",
      message: "새 2차 비밀번호는 4자리 숫자이며 확인 입력과 같아야 합니다.",
      status: statusBefore,
    };
  }

  if (!(await verifyStoredPin(credential, input.currentPin))) {
    const failed = applyFailedAttempt(credential, now);
    return {
      ok: false,
      reason: failed.lockedUntil ? "locked" : "forbidden",
      message: failed.lockedUntil
        ? "비밀번호를 여러 번 틀려 잠시 잠겼습니다. 잠시 후 다시 시도해 주세요."
        : "현재 2차 비밀번호가 일치하지 않습니다.",
      status: buildStatusSnapshot({ ...input, required: true, now }),
    };
  }

  const salt = generateSalt();
  const passwordHash = await derivePinHash(input.nextPin, salt);
  const updated = {
    ...credential,
    passwordHash,
    salt,
    status: "active" as const,
    failedAttemptCount: 0,
    lastFailedAt: null,
    lockedUntil: null,
    lastVerifiedAt: toIso(now),
    updatedAt: toIso(now),
    resetByUserId: null,
    resetReason: null,
  } satisfies SecondaryPasswordCredentialRecord;
  saveCredentialRecord(updated);
  revokeUserVerifications(input.companyId, input.userId, toIso(now), "changed");
  await createVerificationRecord({ ...input, verifiedAt: now, requestContext: input.requestContext });

  return {
    ok: true,
    status: buildStatusSnapshot({ ...input, required: true, now }),
    auditEvent: "admin.secondary_password.changed",
  };
}

export function requestSecondaryPasswordReset(input: ResetRequestInput) {
  return {
    ok: true as const,
    status: buildStatusSnapshot({ ...input, required: true, now: input.now ?? new Date() }),
    auditEvent: "admin.secondary_password.reset_requested",
  };
}

export function resetSecondaryPasswordByAdmin(input: AdminResetInput): Extract<MutationResult, { ok: true }> {
  const now = input.now ?? new Date();
  const target = ensureMutableCredential(input.companyId, input.targetUserId, input.actorUserId, now);
  const updated = {
    ...target,
    passwordHash: null,
    salt: null,
    status: "reset_required" as const,
    failedAttemptCount: 0,
    lastFailedAt: null,
    lockedUntil: null,
    lastVerifiedAt: null,
    updatedAt: toIso(now),
    resetByUserId: input.actorUserId,
    resetReason: input.reason,
  } satisfies SecondaryPasswordCredentialRecord;
  saveCredentialRecord(updated);
  revokeUserVerifications(input.companyId, input.targetUserId, toIso(now), "admin_reset");

  return {
    ok: true,
    status: buildStatusSnapshot({ companyId: input.companyId, userId: input.targetUserId, sessionId: input.sessionId, required: true, now }),
    auditEvent: "admin.secondary_password.reset_completed",
  };
}

export function ensureSecondaryPasswordVerification(input: GuardInput): VerificationResult {
  const now = input.now ?? new Date();
  const status = buildStatusSnapshot({ ...input, now });

  if (!input.required) {
    return { ok: true, status };
  }

  if (status.enrollmentRequired) {
    return {
      ok: false,
      reason: "enrollment_required",
      message: "관리자 설정을 계속하려면 2차 비밀번호를 먼저 등록해 주세요.",
      status,
    };
  }

  if (status.lock.locked) {
    return {
      ok: false,
      reason: "locked",
      message: "2차 비밀번호가 잠겨 있어 보호된 작업을 진행할 수 없습니다.",
      status,
    };
  }

  if (!status.verification.verified || !status.verification.expiresAt) {
    return {
      ok: false,
      reason: "missing",
      message: "이 작업을 계속하려면 2차 비밀번호를 다시 확인해 주세요.",
      status,
    };
  }

  if (new Date(status.verification.expiresAt).getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: "expired",
      message: "2차 비밀번호 확인 시간이 만료되었습니다. 다시 확인해 주세요.",
      status,
    };
  }

  if (input.minFreshnessMinutes && status.verification.verifiedAt) {
    const freshnessDeadline = addMinutes(new Date(status.verification.verifiedAt), input.minFreshnessMinutes);
    if (freshnessDeadline.getTime() <= now.getTime()) {
      return {
        ok: false,
        reason: "stale",
        message: "이 작업은 최근 2차 비밀번호 재확인이 필요합니다.",
        status,
      };
    }
  }

  return { ok: true, status };
}
