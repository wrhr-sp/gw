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
    ) where (assignment_type = 'PRIMARY' and terminated_at is null)
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
      ) where (assignment_type = 'PRIMARY' and terminated_at is null)
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
  const damageRole = "werehere_auth_grant_option_damage";
  await sql.unsafe(`create role ${damageRole} nologin noinherit`);
  await sql.unsafe(
    `grant execute on function ${authFunctionSignature} to ${damageRole} with grant option`,
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
      `revoke execute on function ${authFunctionSignature} from ${damageRole}`,
    );
    await sql.unsafe(`drop role ${damageRole}`);
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

async function verifyHotelOwnerSessionRevokeVolatilityDamage() {
  const signature = "public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)";
  await sql.unsafe(`alter function ${signature} stable`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `hotel owner session revoke volatility damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter function ${signature} volatile`);
  }
}

async function assertReadinessReady(label: string) {
  const readiness = await probeDatabaseReadiness(probeUrl);
  if (readiness.status !== "READY") {
    throw new Error(`${label} baseline was reported as ${readiness.status}`);
  }
}

async function verifyRestorableDamage(
  label: string,
  damage: () => Promise<void>,
) {
  await assertReadinessReady(`${label} pre-damage`);
  await damage();
  await assertReadinessReady(`${label} restored`);
}

async function verifyLoginRegistryPrimaryKeyDamage() {
  await sql`alter table login_id_registry drop constraint login_id_registry_pkey`;
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `missing login registry primary key was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql`alter table login_id_registry add constraint login_id_registry_pkey primary key (login_id)`;
  }
}

async function verifyLoginRegistryForeignKeyDamage(
  name: string,
  approvedDefinition: string,
) {
  await sql.unsafe(`alter table login_id_registry drop constraint ${name}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} damage was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(
      `alter table login_id_registry add constraint ${name} ${approvedDefinition}`,
    );
  }
}

async function verifyLoginRegistryNamedUniqueDamage(
  name: string,
  columns: string,
) {
  await sql.unsafe(`alter table login_id_registry drop constraint ${name}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} damage was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(
      `alter table login_id_registry add constraint ${name} unique (${columns})`,
    );
  }
}

async function verifyUsersLoginRegistryForeignKeyDamage() {
  const name = "users_login_name_registry_fk";
  await sql.unsafe(`alter table users drop constraint ${name}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(`${name} damage was reported as ${readiness.status}`);
    }
  } finally {
    await sql.unsafe(`
      alter table users add constraint ${name}
      foreign key (login_name, company_id, id)
      references login_id_registry (login_id, company_id, target_user_id)
    `);
  }
}

async function verifyLoginRegistryTupleUniqueConstraintDamage() {
  await sql`alter table users drop constraint users_login_name_registry_fk`;
  await sql`alter table login_id_registry drop constraint login_id_registry_login_id_company_id_target_user_id_key`;
  await sql`create unique index login_id_registry_tuple_damage_idx on login_id_registry (login_id, company_id, target_user_id)`;
  await sql`
    alter table users add constraint users_login_name_registry_fk
    foreign key (login_name, company_id, id)
    references login_id_registry (login_id, company_id, target_user_id)
  `;
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `tuple unique index substitution was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql`alter table users drop constraint users_login_name_registry_fk`;
    await sql`drop index login_id_registry_tuple_damage_idx`;
    await sql`
      alter table login_id_registry
      add constraint login_id_registry_login_id_company_id_target_user_id_key
      unique (login_id, company_id, target_user_id)
    `;
    await sql`
      alter table users add constraint users_login_name_registry_fk
      foreign key (login_name, company_id, id)
      references login_id_registry (login_id, company_id, target_user_id)
    `;
  }
}

async function verifyLoginRegistryPolicyExtraBranchDamage() {
  const name = "login_id_registry_company_isolation";
  await sql.unsafe(`drop policy ${name} on login_id_registry`);
  await sql.unsafe(`
    create policy ${name} on login_id_registry
    using (
      case
        when runtime_is_schema_owner() then true
        when current_user = 'werehere_auth_session_definer' then true
        when current_user = 'werehere_tenant_authority_definer' then true
        when runtime_has_capability('API_RUNTIME') then company_id = api_current_company_id()
        when runtime_has_capability('RECONCILER') then company_id = reconciler_current_company_id()
        when true then true
        else false
      end
    )
    with check (
      case
        when runtime_is_schema_owner() then true
        when current_user = 'werehere_auth_session_definer' then true
        when current_user = 'werehere_tenant_authority_definer' then true
        when runtime_has_capability('API_RUNTIME') then company_id = api_current_company_id()
        when runtime_has_capability('RECONCILER') then company_id = reconciler_current_company_id()
        when true then true
        else false
      end
    )
  `);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `extra-branch login registry policy was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`drop policy ${name} on login_id_registry`);
    await restoreTenantPolicy("login_id_registry", name);
  }
}

async function verifyLoginRegistryPolicyLiteralCaseDamage() {
  const name = "login_id_registry_company_isolation";
  await sql.unsafe(`drop policy ${name} on login_id_registry`);
  await sql.unsafe(`
    create policy ${name} on login_id_registry
    using (
      case
        when runtime_is_schema_owner() then true
        when current_user = 'werehere_auth_session_definer' then true
        when current_user = 'werehere_tenant_authority_definer' then true
        when runtime_has_capability('api_runtime') then company_id = api_current_company_id()
        when runtime_has_capability('RECONCILER') then company_id = reconciler_current_company_id()
        else false
      end
    )
    with check (
      case
        when runtime_is_schema_owner() then true
        when current_user = 'werehere_auth_session_definer' then true
        when current_user = 'werehere_tenant_authority_definer' then true
        when runtime_has_capability('api_runtime') then company_id = api_current_company_id()
        when runtime_has_capability('RECONCILER') then company_id = reconciler_current_company_id()
        else false
      end
    )
  `);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `lowercase capability policy was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`drop policy ${name} on login_id_registry`);
    await restoreTenantPolicy("login_id_registry", name);
  }
}

async function verifyLoginRegistryTriggerBodyDamage() {
  const signature = "public.prevent_login_id_registry_mutation()";
  const [record] = await sql<{ definition: string }[]>`
    select pg_get_functiondef(${signature}::regprocedure) as definition
  `;
  if (!record) throw new Error("login registry trigger function is missing");
  const damaged = record.definition.replace(
    "raise exception 'login ID registry rows are immutable' using errcode = '55000';",
    "return old;",
  );
  if (damaged === record.definition)
    throw new Error("trigger body damage fixture did not apply");
  await sql.unsafe(damaged);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `weakened login registry trigger was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(record.definition);
  }
}

async function verifyLoginRegistryTriggerEventMaskDamage() {
  await sql`drop trigger login_id_registry_immutable on login_id_registry`;
  await sql`
    create trigger login_id_registry_immutable
    before update on login_id_registry
    for each row execute function prevent_login_id_registry_mutation()
  `;
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `trigger event mask damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql`drop trigger login_id_registry_immutable on login_id_registry`;
    await sql`
      create trigger login_id_registry_immutable
      before update or delete on login_id_registry
      for each row execute function prevent_login_id_registry_mutation()
    `;
  }
}

async function verifyHotelRelationshipDeleteTriggerBodyDamage() {
  const signature = "public.reject_hotel_relationship_delete()";
  const [record] = await sql<{ definition: string }[]>`
    select pg_get_functiondef(${signature}::regprocedure) as definition
  `;
  if (!record) throw new Error("hotel relationship delete trigger is missing");
  const damaged = record.definition.replace(
    "raise exception 'hotel relationship history cannot be physically deleted' using errcode = '55000';",
    "return old;",
  );
  if (damaged === record.definition)
    throw new Error("hotel delete trigger body damage fixture did not apply");
  await sql.unsafe(damaged);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `weakened hotel delete trigger was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(record.definition);
  }
}

async function verifyHotelRelationshipDeleteTriggerEventMaskDamage() {
  await sql`drop trigger hotel_staff_assignments_no_delete on hotel_staff_assignments`;
  await sql`
    create trigger hotel_staff_assignments_no_delete
    before update on hotel_staff_assignments
    for each row execute function reject_hotel_relationship_delete()
  `;
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `hotel delete trigger event-mask damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql`drop trigger hotel_staff_assignments_no_delete on hotel_staff_assignments`;
    await sql`
      create trigger hotel_staff_assignments_no_delete
      before delete on hotel_staff_assignments
      for each row execute function reject_hotel_relationship_delete()
    `;
  }
}

async function verifyLoginRegistryTriggerEnabledDamage() {
  await sql`alter table login_id_registry enable always trigger login_id_registry_immutable`;
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `always-enabled trigger was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql`alter table login_id_registry enable trigger login_id_registry_immutable`;
  }
}

async function verifyLoginRegistryTriggerOwnerDamage() {
  const signature = "public.prevent_login_id_registry_mutation()";
  const damageOwner = "werehere_login_registry_trigger_owner_damage";
  const [owner] = await sql<{ role_name: string }[]>`
    select pg_get_userbyid(proowner) as role_name
    from pg_proc where oid = ${signature}::regprocedure
  `;
  if (!owner) throw new Error("trigger function owner is missing");
  await sql.unsafe(`create role ${damageOwner} nologin noinherit`);
  await sql.unsafe(`alter function ${signature} owner to ${damageOwner}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `trigger function owner damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter function ${signature} owner to ${owner.role_name}`);
    await sql.unsafe(`drop role ${damageOwner}`);
  }
}

async function verifyLoginRegistryTriggerSearchPathDamage() {
  const signature = "public.prevent_login_id_registry_mutation()";
  await sql.unsafe(`alter function ${signature} reset search_path`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `trigger function search path damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `alter function ${signature} set search_path = pg_catalog`,
    );
  }
}

async function verifyLoginRegistryTriggerPublicExecuteDamage() {
  const signature = "public.prevent_login_id_registry_mutation()";
  await sql.unsafe(`grant execute on function ${signature} to public`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `trigger function PUBLIC execute damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`revoke execute on function ${signature} from public`);
  }
}

async function verifyLoginRegistryTriggerNamedExecuteDamage() {
  const signature = "public.prevent_login_id_registry_mutation()";
  const damageRole = "werehere_login_registry_trigger_acl_damage";
  await sql.unsafe(`create role ${damageRole} nologin noinherit`);
  await sql.unsafe(`grant execute on function ${signature} to ${damageRole}`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `trigger function named execute damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `revoke execute on function ${signature} from ${damageRole}`,
    );
    await sql.unsafe(`drop role ${damageRole}`);
  }
}

async function verifyLoginRegistryTriggerGrantOptionDamage() {
  const signature = "public.prevent_login_id_registry_mutation()";
  const [owner] = await sql<{ role_name: string }[]>`
    select pg_get_userbyid(proowner) as role_name
    from pg_proc where oid = ${signature}::regprocedure
  `;
  if (!owner) throw new Error("trigger function owner is missing");
  await sql.unsafe(
    `grant execute on function ${signature} to ${owner.role_name} with grant option`,
  );
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `trigger function grant option damage was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(
      `revoke grant option for execute on function ${signature} from ${owner.role_name}`,
    );
  }
}

async function verifyLoginIdentityVolatilityDamage() {
  const signature = "public.auth_resolve_login_identity_v1(text)";
  await sql.unsafe(`alter function ${signature} volatile`);
  try {
    const readiness = await probeDatabaseReadiness(probeUrl);
    if (readiness.status !== "SCHEMA_NOT_READY") {
      throw new Error(
        `volatile login identity lookup was reported as ${readiness.status}`,
      );
    }
  } finally {
    await sql.unsafe(`alter function ${signature} stable`);
  }
}

try {
  const damageCases: ReadonlyArray<readonly [string, () => Promise<void>]> = [
    ["login registry primary key", () => verifyLoginRegistryPrimaryKeyDamage()],
    [
      "login registry company foreign key",
      () =>
        verifyLoginRegistryForeignKeyDamage(
          "login_id_registry_company_id_fkey",
          "foreign key (company_id) references companies(id)",
        ),
    ],
    [
      "login registry actor foreign key",
      () =>
        verifyLoginRegistryForeignKeyDamage(
          "login_id_registry_company_id_actor_user_id_fkey",
          "foreign key (company_id, actor_user_id) references users(company_id, id)",
        ),
    ],
    [
      "login registry company target unique",
      () =>
        verifyLoginRegistryNamedUniqueDamage(
          "login_id_registry_company_id_target_user_id_key",
          "company_id, target_user_id",
        ),
    ],
    [
      "login registry actor idempotency unique",
      () =>
        verifyLoginRegistryNamedUniqueDamage(
          "login_id_registry_company_id_actor_user_id_idempotency_key_key",
          "company_id, actor_user_id, idempotency_key",
        ),
    ],
    [
      "login registry tuple unique",
      () => verifyLoginRegistryTupleUniqueConstraintDamage(),
    ],
    [
      "login registry canonical reserved check",
      () =>
        verifySecurityConstraintWeakening(
          "login_id_registry",
          "login_id_registry_login_id_check",
          "check (true)",
          "check (login_id ~ '^[a-z0-9]{3,30}$' and login_id not in ('admin', 'administrator', 'root', 'system', 'security', 'api', 'service', 'support', 'test', 'preview', 'werehere'))",
        ),
    ],
    [
      "login registry metadata check",
      () =>
        verifySecurityConstraintWeakening(
          "login_id_registry",
          "login_id_registry_check",
          "check (true)",
          "check ((actor_user_id is null and idempotency_key is null and request_hash is null) or (actor_user_id is not null and idempotency_key is not null and request_hash is not null and btrim(idempotency_key) <> '' and btrim(request_hash) <> ''))",
        ),
    ],
    [
      "users login format check",
      () =>
        verifySecurityConstraintWeakening(
          "users",
          "users_login_name_format_check",
          "check (login_name is null or true)",
          "check (login_name is null or login_name ~ '^[a-z0-9]{3,30}$')",
        ),
    ],
    [
      "users reserved login check",
      () =>
        verifySecurityConstraintWeakening(
          "users",
          "users_login_name_reserved_check",
          "check (login_name is null or true)",
          "check (login_name is null or login_name not in ('admin', 'administrator', 'root', 'system', 'security', 'api', 'service', 'support', 'test', 'preview', 'werehere'))",
        ),
    ],
    [
      "users login registry foreign key",
      () => verifyUsersLoginRegistryForeignKeyDamage(),
    ],
    [
      "login registry policy extra branch",
      () => verifyLoginRegistryPolicyExtraBranchDamage(),
    ],
    [
      "login registry policy literal case",
      () => verifyLoginRegistryPolicyLiteralCaseDamage(),
    ],
    [
      "login registry trigger body",
      () => verifyLoginRegistryTriggerBodyDamage(),
    ],
    [
      "login registry trigger event mask",
      () => verifyLoginRegistryTriggerEventMaskDamage(),
    ],
    [
      "hotel relationship delete trigger body",
      () => verifyHotelRelationshipDeleteTriggerBodyDamage(),
    ],
    [
      "hotel relationship delete trigger event mask",
      () => verifyHotelRelationshipDeleteTriggerEventMaskDamage(),
    ],
    [
      "login registry trigger enabled",
      () => verifyLoginRegistryTriggerEnabledDamage(),
    ],
    [
      "login registry trigger owner",
      () => verifyLoginRegistryTriggerOwnerDamage(),
    ],
    [
      "login registry trigger search path",
      () => verifyLoginRegistryTriggerSearchPathDamage(),
    ],
    [
      "login registry trigger PUBLIC execute",
      () => verifyLoginRegistryTriggerPublicExecuteDamage(),
    ],
    [
      "login registry trigger named execute",
      () => verifyLoginRegistryTriggerNamedExecuteDamage(),
    ],
    [
      "login registry trigger grant option",
      () => verifyLoginRegistryTriggerGrantOptionDamage(),
    ],
    ["login identity volatility", () => verifyLoginIdentityVolatilityDamage()],
    [
      "tenant authority helper body",
      () => verifyTenantAuthorityHelperBodyDamage(),
    ],
    [
      "tenant authority helper owner",
      () => verifyTenantAuthorityHelperOwnerDamage(),
    ],
    [
      "tenant authority helper PUBLIC execute",
      () => verifyTenantAuthorityHelperPublicExecuteDamage(),
    ],
    [
      "auth function PUBLIC execute",
      () => verifyAuthFunctionPublicExecuteDamage(),
    ],
    [
      "auth function named execute",
      () => verifyAuthFunctionNamedExecuteDamage(),
    ],
    ["auth function grant option", () => verifyAuthFunctionGrantOptionDamage()],
    ["auth function owner", () => verifyAuthFunctionOwnerDamage()],
    [
      "hotel owner session revoke volatility",
      () => verifyHotelOwnerSessionRevokeVolatilityDamage(),
    ],
    [
      "auth function control flow",
      () =>
        verifyAuthFunctionBodyDamage(
          "if v_principal.user_status not in ('ACTIVE', 'PENDING_SETUP')\n     or v_principal.company_status <> 'ACTIVE' then",
          "if false then",
          "control-flow",
        ),
    ],
    [
      "auth function string literal",
      () =>
        verifyAuthFunctionBodyDamage("'ACTIVE'", "'active'", "string-literal"),
    ],
    [
      "hotel road address check",
      () =>
        verifyConstraintDamage(
          "hotel_profiles_road_address_nonempty",
          "check (btrim(road_address) <> '')",
        ),
    ],
    [
      "hotel phone format check",
      () =>
        verifyConstraintDamage(
          "hotel_profiles_representative_phone_format",
          "check (representative_phone ~ '^[0-9+() -]{8,30}$')",
        ),
    ],
    [
      "auth attempt count widening",
      () =>
        verifySecurityConstraintWeakening(
          "auth_login_transactions",
          "auth_login_transactions_custom_attempt_count_check",
          "check (custom_attempt_count between 0 and 50)",
          "check (custom_attempt_count between 0 and 5)",
        ),
    ],
    [
      "auth attempt count OR true",
      () =>
        verifySecurityConstraintWeakening(
          "auth_login_transactions",
          "auth_login_transactions_custom_attempt_count_check",
          "check ((custom_attempt_count between 0 and 5) or true)",
          "check (custom_attempt_count between 0 and 5)",
        ),
    ],
    [
      "credential rate expiry widening",
      () =>
        verifySecurityConstraintWeakening(
          "auth_credential_rate_limits",
          "auth_credential_rate_limits_expiry_max_check",
          "check (expires_at <= window_started_at + interval '1 hour')",
          "check (expires_at <= window_started_at + interval '15 minutes')",
        ),
    ],
    ["exclusion extra key", () => verifyExclusionExtraKeyWeakening()],
    ["branch code check", () => verifyBranchCodeConstraintWeakening()],
    [
      "phone OR true",
      () =>
        verifyPhoneConstraintReplacement(
          "check (representative_phone ~ '^[0-9+() -]{8,30}$' or true)",
          "OR-true weakened",
        ),
    ],
    [
      "phone not valid",
      () =>
        verifyPhoneConstraintReplacement(
          "check (representative_phone ~ '^[0-9+() -]{8,30}$') not valid",
          "not-valid",
        ),
    ],
    [
      "branches policy missing",
      () => verifyPolicyDamage("branches", "branches_company_isolation"),
    ],
    [
      "hotel profiles policy missing",
      () =>
        verifyPolicyDamage(
          "hotel_profiles",
          "hotel_profiles_company_isolation",
        ),
    ],
    [
      "branches policy weakened",
      () => verifyPolicyWeakening("branches", "branches_company_isolation"),
    ],
    ["additional permissive policy", () => verifyAdditionalPermissivePolicy()],
    ["restrictive policy", () => verifyRestrictivePolicy()],
    ["policy role restriction", () => verifyPolicyRoleRestriction()],
    ["branches RLS disabled", () => verifyRlsDisabled("branches")],
    ["hotel profiles RLS disabled", () => verifyRlsDisabled("hotel_profiles")],
    ["branches RLS not forced", () => verifyRlsNotForced("branches")],
    [
      "hotel profiles RLS not forced",
      () => verifyRlsNotForced("hotel_profiles"),
    ],
  ];

  for (const [label, damage] of damageCases) {
    await verifyRestorableDamage(label, damage);
  }
  await assertReadinessReady("final readiness");
  console.log("HOTEL_READINESS_DAMAGE_INTEGRATION_OK");
} finally {
  await sql.end({ timeout: 1 });
}
