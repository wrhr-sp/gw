function parseSameOrigin(value, issuerOrigin) {
  try {
    const candidate = new URL(value);
    return candidate.origin === issuerOrigin ? candidate : null;
  } catch {
    return null;
  }
}

export function isSuccessfulConsoleCallbackResponse({ issuerOrigin, status, url }) {
  const candidate = parseSameOrigin(url, issuerOrigin);
  return Boolean(
    candidate &&
    status >= 200 &&
    status < 400 &&
    candidate.pathname === "/ui/console/auth/callback" &&
    !candidate.searchParams.has("error") &&
    candidate.searchParams.has("code") &&
    candidate.searchParams.has("state"),
  );
}

export function isAuthenticatedConsoleResponse({ issuerOrigin, status, url }) {
  const candidate = parseSameOrigin(url, issuerOrigin);
  return Boolean(
    candidate &&
    status === 200 &&
    (
      candidate.pathname === "/zitadel.auth.v1.AuthService/GetMyUser" ||
      candidate.pathname === "/auth/v1/users/me"
    ),
  );
}

export function isValidConsoleLanding(value, issuerOrigin) {
  const candidate = parseSameOrigin(value, issuerOrigin);
  if (
    !candidate ||
    (candidate.pathname !== "/ui/console" && !candidate.pathname.startsWith("/ui/console/"))
  ) return false;
  if (candidate.searchParams.has("error")) return false;
  const relativePath = candidate.pathname.slice("/ui/console".length).toLowerCase();
  const segments = relativePath.split("/").filter(Boolean);
  return !segments.some((segment) =>
    segment === "auth" || segment === "callback" || segment === "error" ||
    segment === "login" || segment === "signedout"
  );
}
