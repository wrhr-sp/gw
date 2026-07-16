const baseUrl = process.env.WEB_PREVIEW_URL?.trim().replace(/\/+$/u, "");
if (!baseUrl || !baseUrl.startsWith("https://")) {
  throw new Error("WEB_PREVIEW_URL must be an HTTPS URL");
}

async function json(path, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  if (response.status !== expectedStatus) {
    throw new Error(
      `${path} returned ${response.status}, expected ${expectedStatus}`,
    );
  }
  return { response, body: await response.json() };
}

const home = await fetch(baseUrl, { redirect: "manual" });
if (home.status !== 200) throw new Error(`home returned ${home.status}`);

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
