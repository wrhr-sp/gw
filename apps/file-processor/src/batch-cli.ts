import { runFileScannerBatch } from "./batch";
import { pingClamAv, scanWithClamAv } from "./clamav";
import { optimizeEvidenceImage } from "./image-processor";

async function main() {
  const apiUrl = process.env.PREVIEW_API_URL?.trim() ?? "";
  const agentToken = process.env.PREVIEW_FILE_SCANNER_AGENT_TOKEN?.trim() ?? "";
  const batchSize = Number(process.env.FILE_SCANNER_BATCH_SIZE ?? "25");
  const clamHost = process.env.CLAMAV_HOST?.trim() ?? "127.0.0.1";
  const clamPort = Number(process.env.CLAMAV_PORT ?? "3310");
  const ready = await pingClamAv({
    host: clamHost,
    port: clamPort,
    timeoutMs: 5_000,
  }).catch(() => false);
  if (!ready) throw new Error("SCANNER_BATCH_CLAMAV_UNAVAILABLE");
  const result = await runFileScannerBatch({
    agentToken,
    apiUrl,
    batchSize,
    optimize: optimizeEvidenceImage,
    scan: (body) =>
      scanWithClamAv(body, {
        host: clamHost,
        port: clamPort,
        timeoutMs: 30_000,
      }),
  });
  process.stdout.write(
    `PREVIEW_FILE_SCANNER_BATCH claimed=${result.claimed} clean=${result.clean} infected=${result.infected} failed=${result.failed}\n`,
  );
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const code =
    error instanceof Error && /^[A-Z0-9_]{3,80}$/u.test(error.message)
      ? error.message
      : "SCANNER_BATCH_FAILED";
  process.stderr.write(`PREVIEW_FILE_SCANNER_BATCH_FAILED code=${code}\n`);
  process.exitCode = 1;
});
