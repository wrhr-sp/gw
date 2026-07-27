type RevokeZitadelBootstrapSessionsInput = {
  fetcher?: typeof fetch;
  issuer: string;
  mode?: "READ_ONLY" | "REVOKE";
  organizationId: string;
  subject: string;
  token: string;
};

const FAILURE = "ZITADEL bootstrap session revocation failed";
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

function fail(): never {
  throw new Error(FAILURE);
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (text.length === 0 || text.length > 1_048_576) fail();
  try {
    const parsed = object(JSON.parse(text) as unknown);
    if (!parsed) fail();
    return parsed;
  } catch {
    fail();
  }
}

function exactIssuer(value: string): string {
  if (value !== value.trim()) fail();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail();
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.origin !== value
  ) {
    fail();
  }
  return parsed.origin;
}

function exactIdentifier(value: string): string {
  if (value !== value.trim() || !/^[A-Za-z0-9_-]{1,200}$/u.test(value)) {
    fail();
  }
  return value;
}

export async function revokeZitadelBootstrapSessions(
  input: RevokeZitadelBootstrapSessionsInput,
): Promise<{
  remainingCount: number;
  revokedCount: number;
  status: "REVOKED";
}> {
  const issuer = exactIssuer(input.issuer);
  const organizationId = exactIdentifier(input.organizationId);
  const subject = exactIdentifier(input.subject);
  const token = input.token;
  const mode = input.mode ?? "REVOKE";
  if (token !== token.trim() || token.length < 16 || token.length > 16_384)
    fail();

  const fetcher = input.fetcher ?? fetch;
  const headers = {
    accept: "application/json",
    authorization: "Bearer " + token,
    "content-type": "application/json",
    "x-zitadel-orgid": organizationId,
  };
  const list = async (
    queries: Record<string, unknown>[] = [{ userIdQuery: { id: subject } }],
  ): Promise<{ identifiers: string[]; totalResult: number }> => {
    let response: Response;
    try {
      response = await fetcher(`${issuer}/v2/sessions/search`, {
        body: JSON.stringify({
          query: { asc: true, limit: PAGE_LIMIT },
          queries,
        }),
        headers,
        method: "POST",
        redirect: "manual",
      });
    } catch {
      fail();
    }
    if (!response.ok || (response.status >= 300 && response.status < 400))
      fail();
    const body = await json(response);
    const details = object(body.details);
    const totalResultValue = details?.totalResult;
    if (
      typeof totalResultValue !== "string" ||
      !/^(?:0|[1-9][0-9]*)$/u.test(totalResultValue)
    ) {
      fail();
    }
    const totalResult = Number(totalResultValue);
    if (!Number.isSafeInteger(totalResult)) fail();
    const sessions = body.sessions === undefined ? [] : body.sessions;
    if (!Array.isArray(sessions) || sessions.length > PAGE_LIMIT) fail();
    const identifiers = sessions.map((value) => {
      const session = object(value);
      const factors = object(session?.factors);
      const user = object(factors?.user);
      const id = session?.id;
      if (
        typeof id !== "string" ||
        !/^[A-Za-z0-9_-]{1,200}$/u.test(id) ||
        user?.id !== subject ||
        user?.organizationId !== organizationId
      ) {
        fail();
      }
      return id;
    });
    if (new Set(identifiers).size !== identifiers.length) fail();
    if (
      totalResult < identifiers.length ||
      (totalResult === 0) !== (identifiers.length === 0)
    ) {
      fail();
    }
    return { identifiers, totalResult };
  };

  let revokedCount = 0;
  if (mode === "READ_ONLY") {
    const page = await list();
    return {
      remainingCount: page.totalResult,
      revokedCount,
      status: "REVOKED",
    };
  }
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const listed = await list();
    if (listed.totalResult === 0) {
      return { remainingCount: 0, revokedCount, status: "REVOKED" };
    }
    for (const identifier of listed.identifiers) {
      let deleteAccepted = false;
      try {
        const response = await fetcher(
          `${issuer}/v2/sessions/${encodeURIComponent(identifier)}`,
          {
            body: "{}",
            headers,
            method: "DELETE",
            redirect: "manual",
          },
        );
        deleteAccepted =
          response.ok && !(response.status >= 300 && response.status < 400);
      } catch {
        deleteAccepted = false;
      }
      if (!deleteAccepted) {
        const authoritative = await list([{ idsQuery: { ids: [identifier] } }]);
        if (authoritative.totalResult !== 0) fail();
      } else {
        revokedCount += 1;
      }
    }
  }
  const remaining = await list();
  if (remaining.totalResult !== 0) fail();
  return { remainingCount: 0, revokedCount, status: "REVOKED" };
}
