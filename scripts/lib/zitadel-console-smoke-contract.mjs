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
  "CUSTOM_LOGIN_RESPONSE",
  "CUSTOM_LOGIN_RESPONSE_STATUS",
  "CUSTOM_LOGIN_REDIRECT_INVALID_FLOW",
  "CUSTOM_LOGIN_REDIRECT_INVALID_CREDENTIALS",
  "CUSTOM_LOGIN_REDIRECT_MFA_REQUIRED",
  "CUSTOM_LOGIN_REDIRECT_RATE_LIMITED",
  "CUSTOM_LOGIN_REDIRECT_UNAVAILABLE",
  "CUSTOM_LOGIN_REDIRECT_OTHER",
  "CUSTOM_LOGIN_PROVIDER_AUTH_REQUEST_INSPECT",
  "CUSTOM_LOGIN_PROVIDER_LOGIN_SETTINGS",
  "CUSTOM_LOGIN_PROVIDER_SESSION_CREATE",
  "CUSTOM_LOGIN_PROVIDER_SESSION_READBACK",
  "CUSTOM_LOGIN_PROVIDER_SESSION_READBACK_SCHEMA",
  "CUSTOM_LOGIN_PROVIDER_SESSION_READBACK_IDENTITY",
  "CUSTOM_LOGIN_PROVIDER_ORGANIZATION_SETTINGS",
  "CUSTOM_LOGIN_PROVIDER_AUTH_REQUEST_FINALIZE",
  "CUSTOM_LOGIN_PROVIDER_NETWORK",
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

export function consoleCustomLoginResponseFailureStage({
  issuerOrigin,
  webOrigin,
  status,
  location,
  providerStage,
}) {
  if (!Number.isInteger(status) || status < 300 || status >= 400) {
    return "CUSTOM_LOGIN_RESPONSE_STATUS";
  }
  let target;
  try {
    target = new URL(location, webOrigin);
  } catch {
    return "CUSTOM_LOGIN_REDIRECT_OTHER";
  }
  if (isConsoleCallbackTarget({ issuerOrigin, url: target.toString() })) return null;
  if (target.origin !== webOrigin) return "CUSTOM_LOGIN_REDIRECT_OTHER";
  const reason = target.searchParams.get("error");
  if (target.pathname === "/login" && reason === "invalid-flow") {
    return "CUSTOM_LOGIN_REDIRECT_INVALID_FLOW";
  }
  if (target.pathname !== "/api/auth/custom-login/start") {
    return "CUSTOM_LOGIN_REDIRECT_OTHER";
  }
  const providerFailureStages = {
    AUTH_REQUEST_INSPECT: "CUSTOM_LOGIN_PROVIDER_AUTH_REQUEST_INSPECT",
    LOGIN_SETTINGS: "CUSTOM_LOGIN_PROVIDER_LOGIN_SETTINGS",
    SESSION_CREATE: "CUSTOM_LOGIN_PROVIDER_SESSION_CREATE",
    SESSION_READBACK: "CUSTOM_LOGIN_PROVIDER_SESSION_READBACK",
    SESSION_READBACK_SCHEMA: "CUSTOM_LOGIN_PROVIDER_SESSION_READBACK_SCHEMA",
    SESSION_READBACK_IDENTITY: "CUSTOM_LOGIN_PROVIDER_SESSION_READBACK_IDENTITY",
    ORGANIZATION_SETTINGS: "CUSTOM_LOGIN_PROVIDER_ORGANIZATION_SETTINGS",
    AUTH_REQUEST_FINALIZE: "CUSTOM_LOGIN_PROVIDER_AUTH_REQUEST_FINALIZE",
    NETWORK: "CUSTOM_LOGIN_PROVIDER_NETWORK",
  };
  if (reason === "unavailable" && providerStage in providerFailureStages) {
    return providerFailureStages[providerStage];
  }
  return {
    "invalid-credentials": "CUSTOM_LOGIN_REDIRECT_INVALID_CREDENTIALS",
    "mfa-required": "CUSTOM_LOGIN_REDIRECT_MFA_REQUIRED",
    "rate-limited": "CUSTOM_LOGIN_REDIRECT_RATE_LIMITED",
    unavailable: "CUSTOM_LOGIN_REDIRECT_UNAVAILABLE",
    "invalid-flow": "CUSTOM_LOGIN_REDIRECT_INVALID_FLOW",
  }[reason] ?? "CUSTOM_LOGIN_REDIRECT_OTHER";
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
