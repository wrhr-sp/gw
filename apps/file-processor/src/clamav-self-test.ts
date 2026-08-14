type Verdict = { verdict: "CLEAN" | "INFECTED" };

export async function runClamAvSelfTest(input: {
  ping: () => Promise<boolean>;
  scan: (body: Uint8Array) => Promise<Verdict>;
}): Promise<void> {
  if (!(await input.ping().catch(() => false))) {
    throw new Error("CLAMAV_SELF_TEST_UNAVAILABLE");
  }
  const clean = await input.scan(
    Buffer.from("werehere-clamav-clean-canary-v1", "utf8"),
  );
  if (clean.verdict !== "CLEAN") {
    throw new Error("CLAMAV_SELF_TEST_CLEAN_CANARY_FAILED");
  }
  const eicar = Buffer.from(
    [
      "X5O!P%@AP[4",
      "\\",
      "PZX54(P^)7CC)7}$",
      "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    ].join(""),
    "utf8",
  );
  const infected = await input.scan(eicar);
  if (infected.verdict !== "INFECTED") {
    throw new Error("CLAMAV_SELF_TEST_EICAR_FAILED");
  }
}
