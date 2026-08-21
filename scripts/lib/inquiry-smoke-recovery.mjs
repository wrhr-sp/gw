const ADVANCED = new Set([
  "QUARANTINED",
  "SCANNING",
  "READY_UNLINKED",
  "LINKED",
]);
const TERMINAL = new Set(["EXPIRED", "REJECTED", "SCAN_FAILED"]);

export function classifyInquirySmokeFailure(error, failureStage) {
  if (
    error instanceof Error &&
    /^PREVIEW_OWNER_INQUIRY_[A-Z0-9_]+$/u.test(error.message)
  )
    return error.message;
  const code =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  const sqlState = /^[0-9A-Z]{5}$/u.test(code) ? `_SQLSTATE_${code}` : "";
  return `PREVIEW_OWNER_INQUIRY_FAILED_${failureStage}${sqlState}`;
}

export async function completeUploadWithReplay({
  attempts = 10,
  complete,
  readStatus,
  sleep,
}) {
  let firstError;
  try {
    await complete();
    return { state: "COMPLETED" };
  } catch (error) {
    firstError = error;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await readStatus();
    const uploadStatus = status?.upload?.status;
    if (ADVANCED.has(uploadStatus)) {
      return { state: "ADVANCED", upload: status.upload };
    }
    if (TERMINAL.has(uploadStatus)) {
      return { state: "TERMINAL", upload: status.upload };
    }
    if (uploadStatus === "PENDING") {
      try {
        await complete();
        return { state: "COMPLETED" };
      } catch {
        // The same idempotency key is deliberately retried after status read-back.
      }
    }
    await sleep();
  }

  throw firstError;
}
