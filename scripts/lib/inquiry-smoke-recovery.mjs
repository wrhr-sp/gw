const ADVANCED = new Set([
  "QUARANTINED",
  "SCANNING",
  "READY_UNLINKED",
  "LINKED",
]);
const TERMINAL = new Set(["EXPIRED", "REJECTED", "SCAN_FAILED"]);

export function isRetryableTransportError(error) {
  return (
    error instanceof TypeError ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      ["AbortError", "TimeoutError"].includes(error.name))
  );
}

export async function loadCapabilitiesWithTransportRetry({ load, sleep }) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      if (!isRetryableTransportError(error)) throw error;
      if (attempt === 5)
        throw new Error(
          "PREVIEW_OWNER_INQUIRY_SCOPE_CAPABILITIES_TRANSPORT_UNAVAILABLE",
        );
      await sleep(attempt * 1_000);
    }
  }
  throw new Error(
    "PREVIEW_OWNER_INQUIRY_SCOPE_CAPABILITIES_TRANSPORT_UNAVAILABLE",
  );
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
