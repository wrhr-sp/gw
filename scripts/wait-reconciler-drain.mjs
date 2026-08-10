import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const postgres = requireFromDb("postgres");

const databaseUrlFile = process.env.RECONCILER_DATABASE_URL_FILE?.trim();
if (!databaseUrlFile) {
  throw new Error("RECONCILER_DATABASE_URL_FILE is required");
}

const databaseUrl = (await readFile(databaseUrlFile, "utf8")).trim();
if (!databaseUrl) {
  throw new Error("Reconciler database URL is unavailable");
}

const sql = postgres(databaseUrl, {
  connect_timeout: 5,
  max: 1,
  prepare: false,
});
try {
  await sql.begin(async (tx) => {
    await tx`select set_config('lock_timeout','10min',true)`;
    await tx`select public.scheduled_reconciler_drain_barrier_v1()`;
  });
} finally {
  await sql.end({ timeout: 5 });
}

console.log("PREVIEW_RECONCILER_DRAIN_BARRIER_OK");
