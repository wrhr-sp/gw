import { runClamAvSelfTest } from "./clamav-self-test";
import { pingClamAv, scanWithClamAv } from "./clamav";

const options = {
  host: process.env.CLAMAV_HOST?.trim() ?? "127.0.0.1",
  port: Number(process.env.CLAMAV_PORT ?? "3310"),
  timeoutMs: 10_000,
};

runClamAvSelfTest({
  ping: () => pingClamAv(options),
  scan: (body) => scanWithClamAv(body, options),
})
  .then(() => {
    process.stdout.write("FILE_PROCESSOR_CLAMAV_SELF_TEST_OK\n");
  })
  .catch((error: unknown) => {
    const code =
      error instanceof Error && /^[A-Z0-9_]{3,80}$/u.test(error.message)
        ? error.message
        : "CLAMAV_SELF_TEST_FAILED";
    process.stderr.write(
      `FILE_PROCESSOR_CLAMAV_SELF_TEST_FAILED code=${code}\n`,
    );
    process.exitCode = 1;
  });
