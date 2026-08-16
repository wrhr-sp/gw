const ADVANCED = new Set([
  "QUARANTINED",
  "SCANNING",
  "READY_UNLINKED",
  "LINKED",
]);
const TERMINAL = new Set(["EXPIRED", "REJECTED", "SCAN_FAILED"]);

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
