const ADVANCED = new Set([
  "QUARANTINED",
  "SCANNING",
  "READY_UNLINKED",
  "LINKED",
]);
const TERMINAL = new Set(["EXPIRED", "REJECTED", "SCAN_FAILED"]);

export function safePostgresCode(error) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  return /^[0-9A-Z]{5}$/u.test(code) ? code : "UNKNOWN";
}

export function isRetryablePostgresCode(code) {
  return (
    /^(?:08|40|53)/u.test(code) ||
    ["55P03", "57P01", "57P02", "57P03"].includes(code)
  );
}

export async function queryHotelScopeWithRetry({ query, sleep }) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await query();
    } catch (error) {
      const safeCode = safePostgresCode(error);
      if (!isRetryablePostgresCode(safeCode) || attempt === 5)
        throw new Error(`PREVIEW_OWNER_INQUIRY_HOTEL_SCOPE_PG_${safeCode}`);
      await sleep(attempt * 1_000);
    }
  }
  throw new Error("PREVIEW_OWNER_INQUIRY_HOTEL_SCOPE_PG_UNKNOWN");
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
