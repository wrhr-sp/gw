import { probeDatabaseReadiness } from "../src/client";
import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL ?? "";
const probeUrl = process.env.TEST_PROBE_URL ?? "";
if (!databaseUrl) throw new Error("TEST_READY_URL is required");
if (!probeUrl) throw new Error("TEST_PROBE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function verifyConstraintDamage(name: string, definition: string) {
  await sql.unsafe(`alter table hotel_profiles drop constraint ${name}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} damage was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(
      `alter table hotel_profiles add constraint ${name} ${definition}`,
    );
  }
}

async function verifySecurityConstraintWeakening(
  table: string,
  name: string,
  damagedDefinition: string,
  approvedDefinition: string,
) {
  await sql.unsafe(`alter table ${table} drop constraint ${name}`);
  await sql.unsafe(
    `alter table ${table} add constraint ${name} ${damagedDefinition}`,
  );
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `${name} weakened constraint was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter table ${table} drop constraint ${name}`);
    await sql.unsafe(
      `alter table ${table} add constraint ${name} ${approvedDefinition}`,
    );
  }
}

async function verifyExclusionExtraKeyWeakening() {
  const name = "hotel_staff_assignments_primary_period_excl";
  await sql.unsafe(
    `alter table hotel_staff_assignments drop constraint ${name}`,
  );
  await sql.unsafe(`
    alter table hotel_staff_assignments add constraint ${name}
    exclude using gist (
      company_id with =,
      branch_id with =,
      user_id with =,
      daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
    ) where (assignment_type = 'PRIMARY')
  `);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `extra-key weakened exclusion was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `alter table hotel_staff_assignments drop constraint ${name}`,
    );
    await sql.unsafe(`
      alter table hotel_staff_assignments add constraint ${name}
      exclude using gist (
        company_id with =,
        user_id with =,
        daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
      ) where (assignment_type = 'PRIMARY')
    `);
  }
}

async function verifyBranchCodeConstraintWeakening() {
  const name = "branches_branch_code_canonical_check";
  await sql.unsafe(`alter table branches drop constraint ${name}`);
  await sql.unsafe(
    `alter table branches add constraint ${name} check (branch_code = upper(btrim(branch_code)))`,
  );
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `weakened branch code constraint was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter table branches drop constraint ${name}`);
    await sql.unsafe(`
      alter table branches add constraint ${name}
      check (branch_code = upper(btrim(branch_code)) and branch_code ~ '^[A-Z0-9][A-Z0-9_-]*$')
    `);
  }
}

async function verifyPhoneConstraintReplacement(
  damagedDefinition: string,
  label: string,
) {
  const name = "hotel_profiles_representative_phone_format";
  await sql.unsafe(`alter table hotel_profiles drop constraint ${name}`);
  await sql.unsafe(
    `alter table hotel_profiles add constraint ${name} ${damagedDefinition}`,
  );
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `${label} phone constraint was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter table hotel_profiles drop constraint ${name}`);
    await sql.unsafe(`
      alter table hotel_profiles add constraint ${name}
      check (representative_phone ~ '^[0-9+() -]{8,30}$')
    `);
  }
}

async function restoreTenantPolicy(table: string, name: string) {
  const tenantKey = table === "companies" ? "id" : "company_id";
  await sql.unsafe(`
    create policy ${name} on ${table}
    using (
      case
        when runtime_is_schema_owner() then true
        when current_user = 'werehere_auth_session_definer' then true
        when current_user = 'werehere_tenant_authority_definer' then true
        when runtime_has_capability('API_RUNTIME') then ${tenantKey} = api_current_company_id()
        when runtime_has_capability('RECONCILER') then ${tenantKey} = reconciler_current_company_id()
        else false
      end
    )
    with check (
      case
        when runtime_is_schema_owner() then true
        when current_user = 'werehere_auth_session_definer' then true
        when current_user = 'werehere_tenant_authority_definer' then true
        when runtime_has_capability('API_RUNTIME') then ${tenantKey} = api_current_company_id()
        when runtime_has_capability('RECONCILER') then ${tenantKey} = reconciler_current_company_id()
        else false
      end
    )
  `);
}

async function verifyPolicyDamage(table: string, name: string) {
  await sql.unsafe(`drop policy ${name} on ${table}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} damage was reported as ${readiness.status}`);
    }
  } finally {
    await restoreTenantPolicy(table, name);
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
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `${name} weakened policy was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`drop policy ${name} on ${table}`);
    await restoreTenantPolicy(table, name);
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
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `additional permissive policy was reported as ${readiness.status}`,
      );
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
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`restrictive policy was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`drop policy ${name} on branches`);
    await restoreTenantPolicy("branches", name);
  }
}

async function verifyPolicyRoleRestriction() {
  const policyName = "branches_company_isolation";
  const unrelatedRole = "hotel_readiness_unrelated_test";

  await sql.unsafe(`create role ${unrelatedRole} nologin`);
  await sql.unsafe(`drop policy ${policyName} on branches`);
  await sql.unsafe(`
    create policy ${policyName} on branches to ${unrelatedRole}
    using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  `);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `role-restricted policy was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`drop policy ${policyName} on branches`);
    await restoreTenantPolicy("branches", policyName);
    await sql.unsafe(`drop role ${unrelatedRole}`);
  }
}

async function verifyRlsDisabled(table: string) {
  await sql.unsafe(`alter table ${table} disable row level security`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `${table} disabled RLS was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter table ${table} enable row level security`);
  }
}

async function verifyRlsNotForced(table: string) {
  await sql.unsafe(`alter table ${table} no force row level security`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `${table} non-forced RLS was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter table ${table} force row level security`);
  }
}

const authFunctionSignature =
  "public.auth_create_session_v2(uuid,bytea,text,integer,integer,timestamptz,uuid)";

async function verifyAuthFunctionPublicExecuteDamage() {
  await sql.unsafe(
    `grant execute on function ${authFunctionSignature} to public`,
  );
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `PUBLIC auth function execute was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `revoke execute on function ${authFunctionSignature} from public`,
    );
  }
}

async function verifyAuthFunctionNamedExecuteDamage() {
  const damageRole = "werehere_auth_named_acl_damage";
  await sql.unsafe(`create role ${damageRole} nologin noinherit`);
  await sql.unsafe(
    `grant execute on function ${authFunctionSignature} to ${damageRole}`,
  );
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `named auth function execute was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `revoke execute on function ${authFunctionSignature} from ${damageRole}`,
    );
    await sql.unsafe(`drop role ${damageRole}`);
  }
}

async function verifyAuthFunctionGrantOptionDamage() {
  await sql.unsafe(
    `grant execute on function ${authFunctionSignature} to gw_runtime_probe with grant option`,
  );
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `grantable auth function execute was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `revoke grant option for execute on function ${authFunctionSignature} from gw_runtime_probe`,
    );
  }
}

async function verifyAuthFunctionBodyDamage(
  from: string,
  to: string,
  label: string,
) {
  const [functionRecord] = await sql<{ definition: string }[]>`
    select pg_get_functiondef(${authFunctionSignature}::regprocedure) as definition
  `;
  if (!functionRecord) throw new Error("auth function definition is missing");
  const damaged = functionRecord.definition.replace(from, to);
  if (damaged === functionRecord.definition)
    throw new Error("auth function damage fixture did not apply");
  await sql.unsafe(damaged);
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `${label} auth function body damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(functionRecord.definition);
  }
}

async function verifyAuthFunctionOwnerDamage() {
  const damageOwner = "werehere_auth_owner_damage";
  await sql.unsafe(`create role ${damageOwner} nologin noinherit`);
  await sql.unsafe(
    `alter function ${authFunctionSignature} owner to ${damageOwner}`,
  );
  try {
    const readiness = await probeDatabaseReadiness(databaseUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `auth function owner damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `alter function ${authFunctionSignature} owner to werehere_auth_session_definer`,
    );
    await sql.unsafe(`drop role ${damageOwner}`);
  }
}

async function verifyTenantAuthorityHelperBodyDamage() {
  const signature = "public.reconciler_current_company_id()";
  const [record] = await sql<{ definition: string }[]>`
    select pg_get_functiondef(${signature}::regprocedure) as definition
  `;
  if (!record) throw new Error("tenant authority helper definition is missing");
  const damaged = record.definition.replace(
    /'RECONCILER'(?:::text)?/u,
    "'reconciler'",
  );
  if (damaged === record.definition)
    throw new Error("tenant authority helper damage fixture did not apply");
  await sql.unsafe(damaged);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `tenant authority body damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(record.definition);
  }
}

async function verifyTenantAuthorityHelperOwnerDamage() {
  const signature = "public.api_current_company_id()";
  const damageOwner = "werehere_tenant_helper_owner_damage";
  await sql.unsafe(`create role ${damageOwner} nologin noinherit`);
  await sql.unsafe(`alter function ${signature} owner to ${damageOwner}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `tenant authority owner damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `alter function ${signature} owner to werehere_tenant_authority_definer`,
    );
    await sql.unsafe(`drop role ${damageOwner}`);
  }
}

async function verifyTenantAuthorityHelperPublicExecuteDamage() {
  const signature = "public.runtime_has_capability(text)";
  await sql.unsafe(`grant execute on function ${signature} to public`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `tenant authority PUBLIC execute damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`revoke execute on function ${signature} from public`);
  }
}

try {
  await verifyTenantAuthorityHelperBodyDamage();
  await verifyTenantAuthorityHelperOwnerDamage();
  await verifyTenantAuthorityHelperPublicExecuteDamage();
  await verifyAuthFunctionPublicExecuteDamage();
  await verifyAuthFunctionNamedExecuteDamage();
  await verifyAuthFunctionGrantOptionDamage();
  await verifyAuthFunctionOwnerDamage();
  await verifyAuthFunctionBodyDamage(
    "if v_principal.user_status not in ('ACTIVE', 'PENDING_SETUP')\n     or v_principal.company_status <> 'ACTIVE' then",
    "if false then",
    "control-flow",
  );
  await verifyAuthFunctionBodyDamage("'ACTIVE'", "'active'", "string-literal");
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
  await verifyExclusionExtraKeyWeakening();
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
  await verifyPolicyDamage(
    "hotel_profiles",
    "hotel_profiles_company_isolation",
  );
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
