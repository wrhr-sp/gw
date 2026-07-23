function parseSameOrigin(value, issuerOrigin) {
  try {
    const candidate = new URL(value);
    return candidate.origin === issuerOrigin ? candidate : null;
  } catch {
    return null;
  }
}

export const CONSOLE_CREDENTIAL_FAILURE_STAGES = Object.freeze([
  "SUBMIT",
  "CALLBACK_REQUEST",
  "CALLBACK_RESPONSE",
  "CALLBACK_RESPONSE_STATUS",
  "CALLBACK_RESPONSE_ERROR",
  "AUTHENTICATED_USER_RESPONSE",
  "TERMINAL_LANDING",
  "TOKEN_IDENTITY",
  "COOKIE_CLEANUP",
  "BROWSER_CLOSE",
]);

export function consoleCredentialFailureMarker(stage) {
  const safeStage = CONSOLE_CREDENTIAL_FAILURE_STAGES.includes(stage) ? stage : "UNCLASSIFIED";
  return `ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_${safeStage}`;
}

export function consoleCredentialFailureStage({
  callbackStatus,
  authenticatedUserStatus,
  landingStatus,
  identityVerified,
  cookieCleared,
}) {
  if (callbackStatus !== "fulfilled") return "CALLBACK_RESPONSE";
  if (authenticatedUserStatus !== "fulfilled") return "AUTHENTICATED_USER_RESPONSE";
  if (landingStatus !== "fulfilled") return "TERMINAL_LANDING";
  if (identityVerified === false) return "TOKEN_IDENTITY";
  if (cookieCleared === false) return "COOKIE_CLEANUP";
  return null;
}

export function consoleCredentialCompletionFailureStage([
  callbackRequestResult,
  callbackResult,
  authenticatedUserResult,
  landingResult,
]) {
  if (callbackRequestResult?.status !== "fulfilled") return "CALLBACK_REQUEST";
  return consoleCredentialFailureStage({
    callbackStatus: callbackResult?.status,
    authenticatedUserStatus: authenticatedUserResult?.status,
    landingStatus: landingResult?.status,
    identityVerified: true,
    cookieCleared: true,
  });
}

export function isConsoleCallbackTarget({ issuerOrigin, url }) {
  const candidate = parseSameOrigin(url, issuerOrigin);
  return candidate?.pathname === "/ui/console/auth/callback";
}

export function consoleCallbackResponseFailureStage({ issuerOrigin, status, url }) {
  if (!isConsoleCallbackTarget({ issuerOrigin, url })) return "CALLBACK_RESPONSE";
  if (!Number.isInteger(status) || status < 200 || status >= 400) {
    return "CALLBACK_RESPONSE_STATUS";
  }
  return new URL(url).searchParams.has("error") ? "CALLBACK_RESPONSE_ERROR" : null;
}

export function isSuccessfulConsoleCallbackResponse({ issuerOrigin, status, url }) {
  return consoleCallbackResponseFailureStage({ issuerOrigin, status, url }) === null;
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
