import { probeDatabaseReadiness } from "../src/client";
import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL ?? "";
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

async function verifySecurityConstraintWeakening(
  table: string,
  name: string,
  damagedDefinition: string,
  approvedDefinition: string,
) {
  await sql.unsafe(`alter table ${table} drop constraint ${name}`);
  await sql.unsafe(`alter table ${table} add constraint ${name} ${damagedDefinition}`);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} weakened constraint was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`alter table ${table} drop constraint ${name}`);
    await sql.unsafe(`alter table ${table} add constraint ${name} ${approvedDefinition}`);
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

async function verifyPhoneConstraintReplacement(damagedDefinition: string, label: string) {
  const name = "hotel_profiles_representative_phone_format";
  await sql.unsafe(`alter table hotel_profiles drop constraint ${name}`);
  await sql.unsafe(`alter table hotel_profiles add constraint ${name} ${damagedDefinition}`);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${label} phone constraint was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`alter table hotel_profiles drop constraint ${name}`);
    await sql.unsafe(`
      alter table hotel_profiles add constraint ${name}
      check (representative_phone ~ '^[0-9+() -]{8,30}$')
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

async function verifyAdditionalPermissivePolicy() {
  const name = "branches_runtime_bypass_damage";
  await sql.unsafe(`
    create policy ${name} on branches
    using (true)
    with check (true)
  `);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`additional permissive policy was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`drop policy ${name} on branches`);
  }
}

async function verifyRestrictivePolicy() {
  const name = "branches_company_isolation";
  await sql.unsafe(`drop policy ${name} on branches`);
  await sql.unsafe(`
    create policy ${name} on branches as restrictive
    using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  `);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`restrictive policy was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`drop policy ${name} on branches`);
    await sql.unsafe(`
      create policy ${name} on branches
      using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
      with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
    `);
  }
}

async function verifyPolicyRoleRestriction() {
  const policyName = "branches_company_isolation";
  const runtimeRole = "hotel_readiness_runtime_test";
  const unrelatedRole = "hotel_readiness_unrelated_test";
  const runtimeUrl = new URL(databaseUrl);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = "";

  await sql.unsafe(`create role ${runtimeRole} login noinherit nobypassrls`);
  await sql.unsafe(`create role ${unrelatedRole} nologin`);
  await sql.unsafe(`grant usage on schema public to ${runtimeRole}`);
  await sql.unsafe(`grant select on schema_migrations, permissions to ${runtimeRole}`);
  await sql.unsafe(`drop policy ${policyName} on branches`);
  await sql.unsafe(`
    create policy ${policyName} on branches to ${unrelatedRole}
    using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  `);
  try {
    const readiness = await probeDatabaseReadiness(runtimeUrl.toString());
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`role-restricted policy was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`drop policy ${policyName} on branches`);
    await sql.unsafe(`
      create policy ${policyName} on branches
      using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
      with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
    `);
    await sql.unsafe(`drop owned by ${runtimeRole}`);
    await sql.unsafe(`drop role ${runtimeRole}`);
    await sql.unsafe(`drop role ${unrelatedRole}`);
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
  await verifySecurityConstraintWeakening(
    "auth_login_transactions",
    "auth_login_transactions_custom_attempt_count_check",
    "check (custom_attempt_count between 0 and 50)",
    "check (custom_attempt_count between 0 and 5)",
  );
  await verifySecurityConstraintWeakening(
    "auth_login_transactions",
    "auth_login_transactions_custom_attempt_count_check",
    "check ((custom_attempt_count between 0 and 5) or true)",
    "check (custom_attempt_count between 0 and 5)",
  );
  await verifySecurityConstraintWeakening(
    "auth_credential_rate_limits",
    "auth_credential_rate_limits_expiry_max_check",
    "check (expires_at <= window_started_at + interval '1 hour')",
    "check (expires_at <= window_started_at + interval '15 minutes')",
  );
  await verifyBranchCodeConstraintWeakening();
  await verifyPhoneConstraintReplacement(
    "check (representative_phone ~ '^[0-9+() -]{8,30}$' or true)",
    "OR-true weakened",
  );
  await verifyPhoneConstraintReplacement(
    "check (representative_phone ~ '^[0-9+() -]{8,30}$') not valid",
    "not-valid",
  );
  await verifyPolicyDamage("branches", "branches_company_isolation");
  await verifyPolicyDamage("hotel_profiles", "hotel_profiles_company_isolation");
  await verifyPolicyWeakening("branches", "branches_company_isolation");
  await verifyAdditionalPermissivePolicy();
  await verifyRestrictivePolicy();
  await verifyPolicyRoleRestriction();
  await verifyRlsDisabled("branches");
  await verifyRlsDisabled("hotel_profiles");
  await verifyRlsNotForced("branches");
  await verifyRlsNotForced("hotel_profiles");
  console.log("HOTEL_READINESS_DAMAGE_INTEGRATION_OK");
} finally {
  await sql.end({ timeout: 1 });
}
