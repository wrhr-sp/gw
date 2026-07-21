import { createHash, timingSafeEqual } from "node:crypto";

export type ZitadelBootstrapVerificationInput = {
  approvedSubjectFingerprint: string;
  fetcher?: typeof fetch;
  issuer: string;
  organizationId: string;
  subject: string;
  token: string;
};

const FAILURE = "ZITADEL bootstrap identity verification failed";

function fail(): never {
  throw new Error(FAILURE);
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function json(response: Response) {
  const text = await response.text();
  if (text.length === 0 || text.length > 65_536) fail();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    fail();
  }
}

export async function verifyZitadelBootstrapIdentity(
  input: ZitadelBootstrapVerificationInput,
): Promise<{ status: "VERIFIED" }> {
  const subject = input.subject.trim();
  const token = input.token.trim();
  const organizationId = input.organizationId.trim();
  const approved = input.approvedSubjectFingerprint.trim().toLowerCase();
  let issuer: URL;
  try {
    issuer = new URL(input.issuer);
  } catch {
    fail();
  }
  if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.search || issuer.hash
    || !subject || !token || !organizationId || !/^[0-9a-f]{64}$/u.test(approved)) fail();

  const actual = createHash("sha256").update(subject, "utf8").digest();
  const expected = Buffer.from(approved, "hex");
  if (expected.byteLength !== actual.byteLength || !timingSafeEqual(actual, expected)) fail();

  const fetcher = input.fetcher ?? fetch;
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    "x-zitadel-orgid": organizationId,
  };
  let userResponse: Response;
  try {
    userResponse = await fetcher(`${issuer.origin}/v2/users/${encodeURIComponent(subject)}`, {
      method: "GET",
      redirect: "manual",
      headers,
    });
  } catch {
    fail();
  }
  if (!userResponse.ok || (userResponse.status >= 300 && userResponse.status < 400)) fail();
  const userBody = object(await json(userResponse));
  const user = object(userBody?.user);
  const details = object(user?.details);
  if (user?.userId !== subject
    || user?.state !== "USER_STATE_ACTIVE"
    || details?.resourceOwner !== organizationId
    || !object(user?.human)) fail();

  let factorResponse: Response;
  try {
    factorResponse = await fetcher(
      `${issuer.origin}/management/v1/users/${encodeURIComponent(subject)}/auth_factors/_search`,
      {
        method: "POST",
        redirect: "manual",
        headers: { ...headers, "content-type": "application/json" },
        body: "{}",
      },
    );
  } catch {
    fail();
  }
  if (!factorResponse.ok || (factorResponse.status >= 300 && factorResponse.status < 400)) fail();
  const factorBody = object(await json(factorResponse));
  const factors = Array.isArray(factorBody?.result) ? factorBody.result : [];
  const hasReadyMfa = factors.some((value) => {
    const factor = object(value);
    return factor?.state === "AUTH_FACTOR_STATE_READY"
      && ["otp", "u2f", "otpSms", "otpEmail"].some((key) => object(factor[key]) !== null);
  });
  if (!hasReadyMfa) fail();

  return { status: "VERIFIED" };
}
