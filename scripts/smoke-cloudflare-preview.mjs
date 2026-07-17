const baseUrl = process.env.WEB_PREVIEW_URL?.trim().replace(/\/+$/u, "");
if (!baseUrl || !baseUrl.startsWith("https://")) {
  throw new Error("WEB_PREVIEW_URL must be an HTTPS URL");
}

const retryAttempts = 12;
const retryDelayMilliseconds = 5_000;

function retryableStatus(status) {
  return status === 404 || status === 429 || status >= 500;
}

async function fetchExpected(path, expectedStatus, init = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      if (response.status === expectedStatus) return response;
      lastError = new Error(
        `${path || "/"} returned ${response.status}, expected ${expectedStatus}`,
      );
      if (!retryableStatus(response.status)) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < retryAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMilliseconds),
      );
    }
  }
  throw lastError ?? new Error(`${path || "/"} smoke failed`);
}

async function json(path, expectedStatus) {
  const response = await fetchExpected(path, expectedStatus, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  return { response, body: await response.json() };
}

await fetchExpected("", 200, { redirect: "manual" });

const live = await json("/api/health/live", 200);
if (!live.body.ok || live.body.data?.status !== "UP") {
  throw new Error("liveness payload is invalid");
}

const ready = await json("/api/health/ready", 200);
if (!ready.body.ok || ready.body.data?.status !== "READY") {
  throw new Error("readiness payload is invalid");
}

const session = await json("/api/auth/session", 401);
if (session.body.ok || session.body.error?.code !== "AUTHENTICATION_REQUIRED") {
  throw new Error("anonymous session contract is invalid");
}

const login = await fetch(`${baseUrl}/api/auth/login`, { redirect: "manual" });
if (login.status !== 302) throw new Error(`login returned ${login.status}`);
if (!login.headers.get("location")?.startsWith("https://")) {
  throw new Error("login redirect is not HTTPS");
}
if (!login.headers.get("set-cookie")?.includes("__Host-hotel_oauth_browser=")) {
  throw new Error("login browser binding cookie is missing");
}
if (login.headers.get("cache-control") !== "no-store") {
  throw new Error("login response must disable caching");
}

const invalidCallback = await json("/api/auth/callback", 400);
if (
  invalidCallback.body.ok ||
  invalidCallback.body.error?.code !== "AUTH_FLOW_INVALID"
) {
  throw new Error("invalid callback contract is invalid");
}

console.log("CLOUDFLARE_PREVIEW_PUBLIC_SMOKE_OK");
