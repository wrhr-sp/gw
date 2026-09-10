// Diagnostics only: never return an upstream message or arbitrary code.
const uploadCodes = new Set([
  "INTERNAL_ERROR", "DB_NOT_CONFIGURED", "AUTHENTICATION_REQUIRED",
  "AUTH_PROVIDER_UNAVAILABLE", "FORBIDDEN", "RESOURCE_NOT_FOUND",
  "VALIDATION_ERROR", "VALIDATION_FAILED", "RATE_LIMITED",
  "FILE_INTEGRITY_MISMATCH", "FILE_NOT_READY", "FILE_RATE_LIMITED",
  "FILE_STORAGE_NOT_CONFIGURED", "FILE_STORAGE_UNAVAILABLE",
  "HOTEL_RELATIONSHIP_CONFLICT",
]);

const uploadStages = new Set(["AUTHENTICATION", "HEADERS", "SERVICE_INIT", "AUTHORIZE", "KNOWLEDGE_SCOPE", "INQUIRY_SCOPE", "DEFAULT_SCOPE", "AUTHORIZE_QUERY", "AUTHORIZE_PARSE", "R2_PUT", "CLOSE", "RESPONSE"]);

export function classifyUploadFailure(status, payload, stage) {
  try {
    const error = payload?.error;
    const code = error?.code;
    if (!uploadCodes.has(code)) return "";
    if (code === "AUTH_PROVIDER_UNAVAILABLE") {
      if (payload.ok === false && payload.data === null && error.retryable === true &&
          status === 503 && error.message === "인증 API에 연결할 수 없습니다.")
        return "_AUTH_PROVIDER_UNAVAILABLE_ORIGIN_WEB_PROXY";
      return "_AUTH_PROVIDER_UNAVAILABLE_ORIGIN_UNCLASSIFIED";
    }
    if (code !== "INTERNAL_ERROR") return `_${code}`;
    if (payload.ok === false && payload.data === null && error.retryable === true) {
      if (status === 503 && error.message === "호텔 API에 연결할 수 없습니다.")
        return "_INTERNAL_ERROR_ORIGIN_WEB_PROXY";
      if (status === 500 && error.message === "호텔 요청을 처리할 수 없습니다.") {
        if (stage == null) return "_INTERNAL_ERROR_ORIGIN_API";
        return uploadStages.has(stage)
          ? `_INTERNAL_ERROR_ORIGIN_API_STAGE_${stage}`
          : "_INTERNAL_ERROR_ORIGIN_API_STAGE_UNCLASSIFIED";
      }
    }
    return "_INTERNAL_ERROR_ORIGIN_UNCLASSIFIED";
  } catch {
    return "";
  }
}
