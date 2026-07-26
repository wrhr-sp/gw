import { createHash, timingSafeEqual } from "node:crypto";

export type ZitadelBootstrapPasswordResetInput = {
  approvedEmail: string;
  approvedIssuerFingerprint: string;
  approvedOrganizationFingerprint: string;
  approvedSubjectFingerprint: string;
  beforeResetRequest?: () => Promise<"PROCEED" | "REPLAYED">;
  fetcher?: typeof fetch;
  issuer: string;
  onResetIndeterminate?: () => Promise<void>;
  onResetRequested?: () => Promise<void>;
  organizationId: string;
  subject: string;
  token: string;
  webBaseUrl: string;
};

const FAILURE = "ZITADEL bootstrap password reset request failed";

function fail(): never {
  throw new Error(FAILURE);
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function canonicalHttpsOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/u, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fail();
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.origin !== trimmed
  ) {
    fail();
  }
  return parsed.origin;
}

function verifyFingerprint(value: string, approvedFingerprint: string): void {
  const approved = approvedFingerprint.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(approved)) fail();
  const actual = createHash("sha256").update(value, "utf8").digest();
  const expected = Buffer.from(approved, "hex");
  if (
    expected.byteLength !== actual.byteLength ||
    !timingSafeEqual(actual, expected)
  ) {
    fail();
  }
}

export function canonicalApprovedEmail(value: string): string {
  const canonical = value.trim().toLowerCase();
  if (
    canonical.length < 3 ||
    canonical.length > 320 ||
    !/^[^\s@]+@[^\s@]+$/u.test(canonical)
  ) {
    fail();
  }
  return canonical;
}

function verifyApprovedEmail(value: string, approvedEmail: string): void {
  const actual = createHash("sha256")
    .update(canonicalApprovedEmail(value), "utf8")
    .digest();
  const expected = createHash("sha256")
    .update(canonicalApprovedEmail(approvedEmail), "utf8")
    .digest();
  if (!timingSafeEqual(actual, expected)) fail();
}

async function json(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0 || text.length > 65_536) fail();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    fail();
  }
}

function containsReturnedVerificationCredential(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsReturnedVerificationCredential);
  }
  const candidate = object(value);
  if (!candidate) return false;
  return Object.entries(candidate).some(
    ([key, nested]) =>
      ["code", "verificationcode"].includes(key.toLowerCase()) ||
      containsReturnedVerificationCredential(nested),
  );
}

async function markIndeterminateThenFail(
  callback: (() => Promise<void>) | undefined,
): Promise<never> {
  try {
    await callback?.();
  } finally {
    fail();
  }
}

export async function requestZitadelBootstrapPasswordReset(
  input: ZitadelBootstrapPasswordResetInput,
): Promise<{ status: "REPLAYED" | "REQUESTED" }> {
  const issuer = canonicalHttpsOrigin(input.issuer);
  const webBaseUrl = canonicalHttpsOrigin(input.webBaseUrl);
  const subject = input.subject.trim();
  const organizationId = input.organizationId.trim();
  const token = input.token.trim();
  const approvedEmail = canonicalApprovedEmail(input.approvedEmail);
  if (
    !/^[A-Za-z0-9_-]{1,200}$/u.test(subject) ||
    !/^[A-Za-z0-9_-]{1,200}$/u.test(organizationId) ||
    !token
  ) {
    fail();
  }
  verifyFingerprint(issuer, input.approvedIssuerFingerprint);
  verifyFingerprint(organizationId, input.approvedOrganizationFingerprint);
  verifyFingerprint(subject, input.approvedSubjectFingerprint);

  const fetcher = input.fetcher ?? fetch;
  let discoveryResponse: Response;
  try {
    discoveryResponse = await fetcher(
      `${issuer}/.well-known/openid-configuration`,
      {
        method: "GET",
        redirect: "manual",
        headers: { accept: "application/json" },
      },
    );
  } catch {
    fail();
  }
  if (
    !discoveryResponse.ok ||
    (discoveryResponse.status >= 300 && discoveryResponse.status < 400)
  ) {
    fail();
  }
  const discovery = object(await json(discoveryResponse));
  if (
    typeof discovery?.issuer !== "string" ||
    canonicalHttpsOrigin(discovery.issuer) !== issuer
  ) {
    fail();
  }

  const headers = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    "x-zitadel-orgid": organizationId,
  };
  let userResponse: Response;
  try {
    userResponse = await fetcher(
      `${issuer}/v2/users/${encodeURIComponent(subject)}`,
      {
        method: "GET",
        redirect: "manual",
        headers,
      },
    );
  } catch {
    fail();
  }
  if (
    !userResponse.ok ||
    (userResponse.status >= 300 && userResponse.status < 400)
  ) {
    fail();
  }
  const userBody = object(await json(userResponse));
  const user = object(userBody?.user);
  const details = object(user?.details);
  const human = object(user?.human);
  const email = object(human?.email);
  if (
    user?.userId !== subject ||
    user?.state !== "USER_STATE_ACTIVE" ||
    details?.resourceOwner !== organizationId ||
    typeof email?.email !== "string" ||
    email.email.trim().length === 0 ||
    email.isVerified !== true
  ) {
    fail();
  }
  verifyApprovedEmail(email.email, approvedEmail);

  const urlTemplate = `${webBaseUrl}/password/set#userID={{.UserID}}&code={{.Code}}&orgID={{.OrgID}}`;
  if (urlTemplate.length > 200) fail();
  const reservation = await input.beforeResetRequest?.();
  if (reservation === "REPLAYED") return { status: "REPLAYED" };
  if (reservation !== undefined && reservation !== "PROCEED") fail();

  let resetResponse: Response;
  try {
    resetResponse = await fetcher(
      `${issuer}/v2/users/${encodeURIComponent(subject)}/password_reset`,
      {
        method: "POST",
        redirect: "manual",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sendLink: {
            notificationType: "NOTIFICATION_TYPE_Email",
            urlTemplate,
          },
        }),
      },
    );
  } catch {
    return markIndeterminateThenFail(input.onResetIndeterminate);
  }
  if (
    !resetResponse.ok ||
    (resetResponse.status >= 300 && resetResponse.status < 400)
  ) {
    return markIndeterminateThenFail(input.onResetIndeterminate);
  }
  const responseText = await resetResponse.text();
  if (responseText.length > 65_536) {
    return markIndeterminateThenFail(input.onResetIndeterminate);
  }
  if (responseText.length > 0) {
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText) as unknown;
    } catch {
      return markIndeterminateThenFail(input.onResetIndeterminate);
    }
    if (containsReturnedVerificationCredential(responseBody)) {
      return markIndeterminateThenFail(input.onResetIndeterminate);
    }
  }
  await input.onResetRequested?.();

  return { status: "REQUESTED" };
}
