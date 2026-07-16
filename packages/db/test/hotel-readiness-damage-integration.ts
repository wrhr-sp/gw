import { probeDatabaseReadiness } from "../src/client";
import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function verifyConstraintDamage(name: string, definition: string) {
  await sql.unsafe(`alter table hotel_profiles drop constraint ${name}`);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} damage was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`alter table hotel_profiles add constraint ${name} ${definition}`);
  }
}

async function verifyBranchCodeConstraintWeakening() {
  const name = "branches_branch_code_canonical_check";
  await sql.unsafe(`alter table branches drop constraint ${name}`);
  await sql.unsafe(`alter table branches add constraint ${name} check (branch_code = upper(btrim(branch_code)))`);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`weakened branch code constraint was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`alter table branches drop constraint ${name}`);
    await sql.unsafe(`
      alter table branches add constraint ${name}
      check (branch_code = upper(btrim(branch_code)) and branch_code ~ '^[A-Z0-9][A-Z0-9_-]*$')
    `);
  }
}

async function verifyPolicyDamage(table: string, name: string) {
  await sql.unsafe(`drop policy ${name} on ${table}`);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} damage was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`
      create policy ${name} on ${table}
      using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
      with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
    `);
  }
}

async function verifyPolicyWeakening(table: string, name: string) {
  await sql.unsafe(`drop policy ${name} on ${table}`);
  await sql.unsafe(`
    create policy ${name} on ${table}
    using (company_id = nullif(current_setting('app.company_id', true), '')::uuid or true)
    with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid or true)
  `);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} weakened policy was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`drop policy ${name} on ${table}`);
    await sql.unsafe(`
      create policy ${name} on ${table}
      using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
      with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
    `);
  }
}

async function verifyRlsDisabled(table: string) {
  await sql.unsafe(`alter table ${table} disable row level security`);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${table} disabled RLS was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`alter table ${table} enable row level security`);
  }
}

async function verifyRlsNotForced(table: string) {
  await sql.unsafe(`alter table ${table} no force row level security`);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${table} non-forced RLS was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`alter table ${table} force row level security`);
  }
}

try {
  await verifyConstraintDamage(
    "hotel_profiles_road_address_nonempty",
    "check (btrim(road_address) <> '')",
  );
  await verifyConstraintDamage(
    "hotel_profiles_representative_phone_format",
    "check (representative_phone ~ '^[0-9+() -]{8,30}$')",
  );
  await verifyBranchCodeConstraintWeakening();
  await verifyPolicyDamage("branches", "branches_company_isolation");
  await verifyPolicyDamage("hotel_profiles", "hotel_profiles_company_isolation");
  await verifyPolicyWeakening("branches", "branches_company_isolation");
  await verifyRlsDisabled("branches");
  await verifyRlsDisabled("hotel_profiles");
  await verifyRlsNotForced("branches");
  await verifyRlsNotForced("hotel_profiles");
  console.log("HOTEL_READINESS_DAMAGE_INTEGRATION_OK");
} finally {
  await sql.end({ timeout: 1 });
}
