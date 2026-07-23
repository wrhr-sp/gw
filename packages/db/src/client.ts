import postgres from "postgres";

export type DatabaseReadiness =
  | { status: "READY" }
  | { status: "NOT_CONFIGURED" }
  | { status: "SCHEMA_NOT_READY" }
  | { status: "UNAVAILABLE" };

const AUTH_CREATE_SESSION_V2_PROSRC_SHA256 =
  "57926aacd5232ddbf118b6614bf7dc6679d9d9dc2cdb5672ebb3d5026e3f986f";
const AUTH_CREATE_SESSION_V2_EXPAND_PROSRC_SHA256 =
  "8b1471fab68cd50dbf0905af4a32a9f5d5642eb1d74e1500ec5cb073d4654790";
const AUTH_RESOLVE_LOGIN_IDENTITY_V1_PROSRC_SHA256 =
  "79e1b325d46176fd001ca6495f5c92182dbf65d2272fd27123c0379fa01774d7";
const AUTH_RESOLVE_PRINCIPAL_V2_PROSRC_SHA256 =
  "59fcd28ea1349f6be3d64faae5e0f80121a21cf90fcabfd041906ed23e4df6dc";
const AUTH_REVOKE_SESSION_V2_PROSRC_SHA256 =
  "58a5cbb3a9370b2b6beb6b10d906a49b3647af6e0c12c2d56a524bc6fae7d6a0";
const AUTH_REVOKE_USER_SESSIONS_V1_PROSRC_SHA256 =
  "061a73c1c7114330cebb91eb10546499665aa6d3f5887cedb4da7253e9faa0e1";
const PREVENT_LOGIN_ID_REGISTRY_MUTATION_PROSRC_SHA256 =
  "be07b10542ba804bb4d3d0a5afa3e4604e9e4e5c32e745a6ad74aea45b214bbd";
const TENANT_AUTHORITY_PROSRC_SHA256 = new Map([
  [
    "runtime_is_schema_owner",
    "48d938d880cd3ae967ca52e9896797d6ef5526ad2e8cf22801d9159b982f1d2f",
  ],
  [
    "runtime_has_capability",
    "aaab0ee916c8b2f8f0b337997d9d554ed04f49ce7e448ba0ce07ee5f6de858f0",
  ],
  [
    "api_current_company_id",
    "73acc26715ec29b9e4344f7c7fc4c2d2476161af125ab90be9e5e42d5d6a6d95",
  ],
  [
    "reconciler_current_company_id",
    "a9bd3f9247c4fd30e4108b2ef60925bb0f1fb0f6db1f52151aa6a366f45f393a",
  ],
  [
    "sync_reconciliation_company_registry",
    "a5b8ca91bdef9a2410095193b7490490bfabc26c6f73402d663724b79d3a2078",
  ],
  [
    "reconciliation_company_ids",
    "adc258a1aa7723d9524afb69a8a773d4190978e12d312aa89a433a2017df5bcb",
  ],
]);

async function sourceSha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type RuntimeCapability = "API_RUNTIME" | "RECONCILER";

const REQUIRED_TABLES = [
  "schema_migrations",
  "companies",
  "users",
  "auth_identities",
  "auth_sessions",
  "auth_login_transactions",
  "auth_credential_rate_limits",
  "branches",
  "hotel_profiles",
  "roles",
  "permissions",
  "user_groups",
  "user_group_memberships",
  "user_role_memberships",
  "permission_grants",
  "audit_events",
  "idempotency_records",
  "outbox_jobs",
  "account_provisioning_attempts",
  "initial_password_change_attempts",
  "login_id_registry",
  "hotel_staff_assignments",
  "housekeeping_hotel_links",
  "hotel_owner_assignments",
  "company_bootstrap_states",
  "reconciliation_company_registry",
] as const;

const REQUIRED_COLUMNS = [
  ["schema_migrations", "version"],
  ["auth_sessions", "company_id"],
  ["auth_sessions", "user_id"],
  ["auth_sessions", "identity_id"],
  ["auth_sessions", "token_hash"],
  ["auth_login_transactions", "state_hash"],
  ["auth_login_transactions", "browser_binding_hash"],
  ["auth_login_transactions", "nonce_hash"],
  ["auth_login_transactions", "code_verifier_ciphertext"],
  ["auth_login_transactions", "code_verifier_iv"],
  ["auth_login_transactions", "encryption_key_version"],
  ["auth_login_transactions", "expires_at"],
  ["auth_login_transactions", "custom_auth_request_hash"],
  ["auth_login_transactions", "custom_csrf_hash"],
  ["auth_login_transactions", "custom_csrf_expires_at"],
  ["auth_login_transactions", "custom_validation_count"],
  ["auth_login_transactions", "custom_attempt_count"],
  ["auth_credential_rate_limits", "scope"],
  ["auth_credential_rate_limits", "subject_hash"],
  ["auth_credential_rate_limits", "window_started_at"],
  ["auth_credential_rate_limits", "attempt_count"],
  ["auth_credential_rate_limits", "expires_at"],
  ["hotel_profiles", "company_id"],
  ["hotel_profiles", "branch_id"],
  ["hotel_profiles", "road_address"],
  ["hotel_profiles", "detail_address"],
  ["hotel_profiles", "representative_phone"],
  ["hotel_profiles", "contract_start_date"],
  ["hotel_profiles", "contract_end_date"],
  ["permission_grants", "subject_type"],
  ["permission_grants", "subject_id"],
  ["audit_events", "company_id"],
  ["audit_events", "session_id"],
  ["idempotency_records", "company_id"],
  ["idempotency_records", "audit_event_id"],
  ["idempotency_records", "request_hash"],
  ["users", "login_name"],
  ["users", "email"],
  ["users", "must_change_password"],
  ["account_provisioning_attempts", "target_user_id"],
  ["account_provisioning_attempts", "lease_expires_at"],
  ["login_id_registry", "login_id"],
  ["login_id_registry", "target_user_id"],
  ["initial_password_change_attempts", "status"],
  ["initial_password_change_attempts", "lease_expires_at"],
] as const;

const REQUIRED_CONSTRAINTS = [
  [
    "auth_sessions",
    "foreign key (company_id, identity_id, user_id) references auth_identities(company_id, id, user_id)",
  ],
  ["hotel_profiles", "primary key (company_id, branch_id)"],
  [
    "hotel_profiles",
    "foreign key (company_id, branch_id) references branches(company_id, id)",
  ],
  [
    "audit_events",
    "foreign key (company_id, session_id) references auth_sessions(company_id, id)",
  ],
  [
    "idempotency_records",
    "foreign key (company_id, audit_event_id) references audit_events(company_id, id)",
  ],
] as const;

const REQUIRED_FOREIGN_KEY_CONSTRAINTS = [
  {
    table: "login_id_registry",
    name: "login_id_registry_company_id_fkey",
    definition: "foreign key (company_id) references companies(id)",
  },
  {
    table: "login_id_registry",
    name: "login_id_registry_company_id_actor_user_id_fkey",
    definition:
      "foreign key (company_id, actor_user_id) references users(company_id, id)",
  },
] as const;

const REQUIRED_PRIMARY_KEY_CONSTRAINTS = [
  {
    table: "login_id_registry",
    name: "login_id_registry_pkey",
    definition: "primary key (login_id)",
  },
] as const;

const REQUIRED_EXCLUSION_CONSTRAINTS = [
  {
    table: "hotel_staff_assignments",
    name: "hotel_staff_assignments_primary_period_excl",
    definition:
      "exclude using gist (company_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&) where ((assignment_type = 'primary'::text))",
  },
  {
    table: "housekeeping_hotel_links",
    name: "housekeeping_hotel_links_period_excl",
    definition:
      "exclude using gist (company_id with =, branch_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&)",
  },
  {
    table: "hotel_owner_assignments",
    name: "hotel_owner_assignments_user_period_excl",
    definition:
      "exclude using gist (company_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&)",
  },
  {
    table: "hotel_owner_assignments",
    name: "hotel_owner_assignments_hotel_period_excl",
    definition:
      "exclude using gist (company_id with =, branch_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&)",
  },
] as const;

const REQUIRED_UNIQUE_CONSTRAINTS = [
  {
    definition: "unique (provider, provider_subject)",
    name: "auth_identities_provider_provider_subject_key",
    table: "auth_identities",
  },
  {
    definition: "unique (company_id, target_user_id)",
    name: "login_id_registry_company_id_target_user_id_key",
    table: "login_id_registry",
  },
  {
    definition: "unique (login_id, company_id, target_user_id)",
    name: "login_id_registry_login_id_company_id_target_user_id_key",
    table: "login_id_registry",
  },
  {
    definition: "unique (company_id, actor_user_id, idempotency_key)",
    name: "login_id_registry_company_id_actor_user_id_idempotency_key_key",
    table: "login_id_registry",
  },
] as const;

const REQUIRED_ACCOUNT_PROVIDER_EXACT_DISPATCH_CHECK =
  "check (((job_type <> 'account_provider_compensate'::text) or (status = any (array['succeeded'::text, 'cancelled'::text, 'dead_letter'::text])) or coalesce(((jsonb_typeof((payload -> 'provisioningattemptid'::text)) = 'string'::text) and ((payload ->> 'provisioningattemptid'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) and (jsonb_typeof((payload -> 'originalerrorcode'::text)) = 'string'::text) and ((payload ->> 'originalerrorcode'::text) = any (array['account_duplicate'::text, 'forbidden'::text, 'internal_error'::text])) and (jsonb_typeof((payload -> 'userid'::text)) = 'string'::text) and ((payload ->> 'userid'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) and (jsonb_typeof((payload -> 'providersubject'::text)) = 'string'::text) and ((length((payload ->> 'providersubject'::text)) >= 1) and (length((payload ->> 'providersubject'::text)) <= 200)) and ((payload ->> 'action'::text) = 'compensate'::text)), false)))";

const REQUIRED_CHECK_CONSTRAINTS = [
  {
    table: "auth_sessions",
    name: "auth_sessions_token_hash_check",
    definition: "check ((octet_length(token_hash) = 32))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_state_hash_check",
    definition: "check ((octet_length(state_hash) = 32))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_browser_binding_hash_check",
    definition: "check ((octet_length(browser_binding_hash) = 32))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_nonce_hash_check",
    definition: "check ((octet_length(nonce_hash) = 32))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_code_verifier_iv_check",
    definition: "check ((octet_length(code_verifier_iv) = 12))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_check",
    definition: "check ((expires_at > created_at))",
  },
  {
    table: "auth_sessions",
    name: "auth_sessions_idle_max_eight_hours",
    definition:
      "check ((idle_expires_at <= (last_seen_at + '08:00:00'::interval)))",
  },
  {
    table: "auth_sessions",
    name: "auth_sessions_absolute_max_twenty_four_hours",
    definition:
      "check ((absolute_expires_at <= (created_at + '24:00:00'::interval)))",
  },
  {
    table: "hotel_profiles",
    name: "hotel_profiles_contract_period",
    definition: "check ((contract_end_date >= contract_start_date))",
  },
  {
    table: "hotel_profiles",
    name: "hotel_profiles_road_address_nonempty",
    definition: "check ((btrim(road_address) <> ''::text))",
  },
  {
    table: "hotel_profiles",
    name: "hotel_profiles_representative_phone_format",
    definition: "check ((representative_phone ~ '^[0-9+() -]{8,30}$'::text))",
  },
  {
    table: "branches",
    name: "branches_branch_code_canonical_check",
    definition:
      "check (((branch_code = upper(btrim(branch_code))) and (branch_code ~ '^[a-z0-9][a-z0-9_-]*$'::text)))",
  },
  {
    table: "idempotency_records",
    name: "idempotency_records_completed_result_check",
    definition:
      "check (((status <> 'completed'::text) or ((completed_at is not null) and (resource_type is not null) and (resource_id is not null) and (audit_event_id is not null) and (result_snapshot is not null))))",
  },
  {
    table: "login_id_registry",
    name: "login_id_registry_login_id_check",
    definition:
      "check (((login_id ~ '^[a-z0-9]{3,30}$'::text) and (login_id <> all (array['admin'::text, 'administrator'::text, 'root'::text, 'system'::text, 'security'::text, 'api'::text, 'service'::text, 'support'::text, 'test'::text, 'preview'::text, 'werehere'::text]))))",
  },
  {
    table: "login_id_registry",
    name: "login_id_registry_check",
    definition:
      "check ((((actor_user_id is null) and (idempotency_key is null) and (request_hash is null)) or ((actor_user_id is not null) and (idempotency_key is not null) and (request_hash is not null) and (btrim(idempotency_key) <> ''::text) and (btrim(request_hash) <> ''::text))))",
  },
] as const;

const REQUIRED_CONTRACT_CONSTRAINTS = [
  {
    table: "users",
    name: "users_login_name_format_check",
    definition:
      "check (((login_name is null) or (login_name ~ '^[a-z0-9]{3,30}$'::text)))",
  },
  {
    table: "users",
    name: "users_login_name_reserved_check",
    definition:
      "check (((login_name is null) or (login_name <> all (array['admin'::text, 'administrator'::text, 'root'::text, 'system'::text, 'security'::text, 'api'::text, 'service'::text, 'support'::text, 'test'::text, 'preview'::text, 'werehere'::text]))))",
  },
  {
    table: "users",
    name: "users_login_name_registry_fk",
    definition:
      "foreign key (login_name, company_id, id) references login_id_registry(login_id, company_id, target_user_id)",
  },
] as const;

const REQUIRED_SECURITY_CHECK_CONSTRAINTS = [
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_custom_auth_request_hash_check",
    definition:
      "check (((custom_auth_request_hash is null) or (octet_length(custom_auth_request_hash) = 32)))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_custom_csrf_hash_check",
    definition:
      "check (((custom_csrf_hash is null) or (octet_length(custom_csrf_hash) = 32)))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_custom_validation_count_check",
    definition:
      "check (((custom_validation_count >= 0) and (custom_validation_count <= 5)))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_custom_attempt_count_check",
    definition:
      "check (((custom_attempt_count >= 0) and (custom_attempt_count <= 5)))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_custom_binding_check",
    definition:
      "check ((((custom_auth_request_hash is null) and (custom_csrf_hash is null) and (custom_csrf_expires_at is null) and (custom_attempt_count = 0)) or (custom_auth_request_hash is not null)))",
  },
  {
    table: "auth_login_transactions",
    name: "auth_login_transactions_custom_csrf_expiry_check",
    definition:
      "check ((((custom_csrf_hash is null) and (custom_csrf_expires_at is null)) or ((custom_csrf_hash is not null) and (custom_csrf_expires_at is not null) and (custom_csrf_expires_at <= expires_at))))",
  },
  {
    table: "auth_credential_rate_limits",
    name: "auth_credential_rate_limits_scope_check",
    definition: "check ((scope = any (array['ip'::text, 'account'::text])))",
  },
  {
    table: "auth_credential_rate_limits",
    name: "auth_credential_rate_limits_subject_hash_check",
    definition: "check ((octet_length(subject_hash) = 32))",
  },
  {
    table: "auth_credential_rate_limits",
    name: "auth_credential_rate_limits_attempt_count_check",
    definition: "check (((attempt_count >= 1) and (attempt_count <= 1000)))",
  },
  {
    table: "auth_credential_rate_limits",
    name: "auth_credential_rate_limits_expiry_after_window_check",
    definition: "check ((expires_at > window_started_at))",
  },
  {
    table: "auth_credential_rate_limits",
    name: "auth_credential_rate_limits_expiry_max_check",
    definition:
      "check ((expires_at <= (window_started_at + '00:15:00'::interval)))",
  },
] as const;

const REQUIRED_INDEXES = [
  {
    name: "branches_active_hotel_name_unique_idx",
    definition:
      "create unique index branches_active_hotel_name_unique_idx on public.branches using btree (company_id, lower(btrim(name))) where ((branch_type = 'hotel'::text) and (status = 'active'::text))",
  },
  {
    name: "auth_login_transactions_browser_binding_unique_idx",
    definition:
      "create unique index auth_login_transactions_browser_binding_unique_idx on public.auth_login_transactions using btree (browser_binding_hash)",
  },
  {
    name: "auth_login_transactions_custom_request_unique_idx",
    definition:
      "create unique index auth_login_transactions_custom_request_unique_idx on public.auth_login_transactions using btree (custom_auth_request_hash) where (custom_auth_request_hash is not null)",
  },
  {
    name: "auth_credential_rate_limits_expiry_idx",
    definition:
      "create index auth_credential_rate_limits_expiry_idx on public.auth_credential_rate_limits using btree (expires_at)",
  },
  {
    name: "users_login_name_unique_idx",
    definition:
      "create unique index users_login_name_unique_idx on public.users using btree (company_id, lower(btrim(login_name))) where (login_name is not null)",
  },
  {
    name: "users_login_name_global_unique_idx",
    definition:
      "create unique index users_login_name_global_unique_idx on public.users using btree (lower(btrim(login_name))) where (login_name is not null)",
  },
  {
    name: "users_email_unique_idx",
    definition:
      "create unique index users_email_unique_idx on public.users using btree (company_id, lower(btrim(email))) where (email is not null)",
  },
  {
    name: "hotel_staff_assignments_active_primary_user_unique_idx",
    definition:
      "create unique index hotel_staff_assignments_active_primary_user_unique_idx on public.hotel_staff_assignments using btree (company_id, user_id) where ((end_date is null) and (assignment_type = 'primary'::text))",
  },
  {
    name: "hotel_staff_assignments_active_lookup_idx",
    definition:
      "create index hotel_staff_assignments_active_lookup_idx on public.hotel_staff_assignments using btree (company_id, user_id, assignment_type, start_date desc) include (branch_id) where (end_date is null)",
  },
  {
    name: "account_provisioning_attempts_active_user_unique_idx",
    definition:
      "create unique index account_provisioning_attempts_active_user_unique_idx on public.account_provisioning_attempts using btree (company_id, target_user_id) where (status = any (array['reserved_not_dispatched'::text, 'dispatched'::text, 'provider_confirmed'::text, 'recovery_required'::text, 'compensation_required'::text]))",
  },
  {
    name: "account_provisioning_recovery_idx",
    definition:
      "create index account_provisioning_recovery_idx on public.account_provisioning_attempts using btree (company_id, status, lease_expires_at, updated_at) where (status = any (array['reserved_not_dispatched'::text, 'dispatched'::text, 'provider_confirmed'::text, 'recovery_required'::text, 'compensation_required'::text, 'operator_required'::text]))",
  },
  {
    name: "initial_password_change_attempts_active_user_unique_idx",
    definition:
      "create unique index initial_password_change_attempts_active_user_unique_idx on public.initial_password_change_attempts using btree (company_id, user_id) where (status = any (array['reserved_not_dispatched'::text, 'dispatched'::text, 'provider_updated'::text, 'recovery_required'::text]))",
  },
  {
    name: "account_provider_outbox_ready_idx",
    definition:
      "create index account_provider_outbox_ready_idx on public.outbox_jobs using btree (company_id, status, available_at, created_at) where ((job_type = any (array['account_provider_deactivate'::text, 'account_provider_compensate'::text])) and (status = any (array['pending'::text, 'failed'::text, 'processing'::text])))",
  },
] as const;

const EXPECTED_API_RUNTIME_TABLE_PRIVILEGES = [
  "account_provisioning_attempts:INSERT",
  "account_provisioning_attempts:SELECT",
  "account_provisioning_attempts:UPDATE",
  "audit_events:INSERT",
  "auth_credential_rate_limits:DELETE",
  "auth_credential_rate_limits:INSERT",
  "auth_credential_rate_limits:SELECT",
  "auth_credential_rate_limits:UPDATE",
  "auth_identities:INSERT",
  "auth_identities:SELECT",
  "auth_login_transactions:DELETE",
  "auth_login_transactions:INSERT",
  "auth_login_transactions:SELECT",
  "auth_login_transactions:UPDATE",
  "auth_sessions:SELECT",
  "branches:INSERT",
  "branches:SELECT",
  "companies:SELECT",
  "hotel_owner_assignments:INSERT",
  "hotel_owner_assignments:SELECT",
  "hotel_profiles:INSERT",
  "hotel_profiles:SELECT",
  "hotel_staff_assignments:INSERT",
  "hotel_staff_assignments:SELECT",
  "housekeeping_hotel_links:INSERT",
  "housekeeping_hotel_links:SELECT",
  "idempotency_records:DELETE",
  "idempotency_records:INSERT",
  "idempotency_records:SELECT",
  "idempotency_records:UPDATE",
  "initial_password_change_attempts:INSERT",
  "initial_password_change_attempts:SELECT",
  "initial_password_change_attempts:UPDATE",
  "login_id_registry:INSERT",
  "login_id_registry:SELECT",
  "outbox_jobs:INSERT",
  "outbox_jobs:SELECT",
  "outbox_jobs:UPDATE",
  "permission_grants:SELECT",
  "permissions:SELECT",
  "roles:SELECT",
  "runtime_database_capabilities:SELECT",
  "schema_migrations:SELECT",
  "user_group_memberships:SELECT",
  "user_groups:SELECT",
  "user_role_memberships:SELECT",
  "users:INSERT",
  "users:SELECT",
  "users:UPDATE",
] as const;

const EXPECTED_RECONCILER_TABLE_PRIVILEGES = [
  "account_provisioning_attempts:SELECT",
  "account_provisioning_attempts:UPDATE",
  "audit_events:INSERT",
  "auth_identities:INSERT",
  "auth_identities:SELECT",
  "branches:SELECT",
  "companies:SELECT",
  "hotel_owner_assignments:INSERT",
  "hotel_owner_assignments:SELECT",
  "hotel_profiles:SELECT",
  "hotel_staff_assignments:INSERT",
  "hotel_staff_assignments:SELECT",
  "housekeeping_hotel_links:INSERT",
  "housekeeping_hotel_links:SELECT",
  "outbox_jobs:INSERT",
  "outbox_jobs:SELECT",
  "outbox_jobs:UPDATE",
  "permissions:SELECT",
  "runtime_database_capabilities:SELECT",
  "schema_migrations:SELECT",
  "users:INSERT",
  "users:SELECT",
] as const;

const REQUIRED_TRIGGERS = [
  {
    name: "login_id_registry_immutable",
    table: "login_id_registry",
    functionName: "prevent_login_id_registry_mutation",
  },
  {
    name: "audit_events_no_update",
    table: "audit_events",
    functionName: "reject_audit_event_change",
  },
  {
    name: "permission_grants_subject_guard",
    table: "permission_grants",
    functionName: "enforce_permission_grant_subject",
  },
  {
    name: "users_no_delete",
    table: "users",
    functionName: "reject_access_subject_delete",
  },
  {
    name: "roles_no_delete",
    table: "roles",
    functionName: "reject_access_subject_delete",
  },
  {
    name: "user_groups_no_delete",
    table: "user_groups",
    functionName: "reject_access_subject_delete",
  },
  {
    name: "users_no_rekey",
    table: "users",
    functionName: "reject_access_subject_delete",
  },
  {
    name: "roles_no_rekey",
    table: "roles",
    functionName: "reject_access_subject_delete",
  },
  {
    name: "user_groups_no_rekey",
    table: "user_groups",
    functionName: "reject_access_subject_delete",
  },
  {
    name: "companies_sync_reconciliation_registry",
    table: "companies",
    functionName: "sync_reconciliation_company_registry",
  },
] as const;

const REQUIRED_RLS_POLICIES = [
  { policy: "companies_company_isolation", table: "companies" },
  { policy: "users_company_isolation", table: "users" },
  { policy: "auth_identities_company_isolation", table: "auth_identities" },
  { policy: "auth_sessions_company_isolation", table: "auth_sessions" },
  { policy: "branches_company_isolation", table: "branches" },
  { policy: "hotel_profiles_company_isolation", table: "hotel_profiles" },
  { policy: "roles_company_isolation", table: "roles" },
  { policy: "user_groups_company_isolation", table: "user_groups" },
  {
    policy: "user_group_memberships_company_isolation",
    table: "user_group_memberships",
  },
  {
    policy: "user_role_memberships_company_isolation",
    table: "user_role_memberships",
  },
  { policy: "permission_grants_company_isolation", table: "permission_grants" },
  { policy: "audit_events_company_isolation", table: "audit_events" },
  {
    policy: "idempotency_records_company_isolation",
    table: "idempotency_records",
  },
  { policy: "outbox_jobs_company_isolation", table: "outbox_jobs" },
  {
    policy: "account_provisioning_attempts_company_isolation",
    table: "account_provisioning_attempts",
  },
  {
    policy: "initial_password_change_attempts_company_isolation",
    table: "initial_password_change_attempts",
  },
  {
    policy: "login_id_registry_company_isolation",
    table: "login_id_registry",
  },
  {
    policy: "hotel_staff_assignments_company_isolation",
    table: "hotel_staff_assignments",
  },
  {
    policy: "housekeeping_hotel_links_company_isolation",
    table: "housekeeping_hotel_links",
  },
  {
    policy: "hotel_owner_assignments_company_isolation",
    table: "hotel_owner_assignments",
  },
] as const;

function normalizeDefinition(value: string) {
  return value.toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
}

function normalizePolicyDefinition(value: string) {
  const sqlLiterals: string[] = [];
  const withLiteralPlaceholders = value.replace(
    /'(?:''|[^'])*'/gu,
    (literal) => {
      const placeholder = `__SQL_LITERAL_${sqlLiterals.length}__`;
      sqlLiterals.push(literal);
      return placeholder;
    },
  );
  return withLiteralPlaceholders
    .toLowerCase()
    .replaceAll('"', "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/__sql_literal_(\d+)__/gu, (_placeholder, index: string) =>
      sqlLiterals[Number(index)] ?? "",
    );
}

function isExactTenantPolicyExpression(
  value: string | null,
  tenantKey: "company_id" | "id",
  schemaPhase: "CONTRACT" | "EXPAND",
) {
  const normalized = normalizePolicyDefinition(value ?? "")
    .replace(/^\(+/u, "")
    .replace(/\)+$/u, "");
  const ownerBranch = "when runtime_is_schema_owner() then true";
  const authDefinerBranch =
    "when (current_user = 'werehere_auth_session_definer'::name) then true";
  const tenantDefinerBranch =
    "when (current_user = 'werehere_tenant_authority_definer'::name) then true";
  const apiBranch = `when runtime_has_capability('API_RUNTIME'::text) then (${tenantKey} = api_current_company_id())`;
  const reconcilerBranch = `when runtime_has_capability('RECONCILER'::text) then (${tenantKey} = reconciler_current_company_id())`;
  const legacyBranch = schemaPhase === "EXPAND"
    ? `when ((not runtime_has_capability('API_RUNTIME'::text)) and (not runtime_has_capability('RECONCILER'::text))) then (${tenantKey} = (nullif(current_setting('app.company_id'::text, true), ''::text))::uuid)`
    : null;
  const expected = [
    "case",
    ownerBranch,
    authDefinerBranch,
    tenantDefinerBranch,
    apiBranch,
    reconcilerBranch,
    legacyBranch,
    "else false end",
  ].filter((fragment): fragment is string => fragment !== null).join(" ");
  return normalized === expected;
}

export async function probeDatabaseReadiness(
  databaseUrl: string | undefined,
  options: {
    capability: RuntimeCapability;
    requiredSchemaPhase?: "CONTRACT" | "EXPAND";
  } = { capability: "RECONCILER" },
): Promise<DatabaseReadiness> {
  if (!databaseUrl?.trim()) return { status: "NOT_CONFIGURED" };

  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 2,
    prepare: false,
  });

  try {
    const tableRows = await sql<{ table_name: string }[]>`
      select table_record.relname as table_name
      from pg_class table_record
      join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
      where table_namespace.nspname = 'public'
        and table_record.relkind in ('r', 'p')
    `;
    const tables = new Set(tableRows.map((row) => row.table_name));
    if (REQUIRED_TABLES.some((table) => !tables.has(table)))
      return { status: "SCHEMA_NOT_READY" };

    const columnRows = await sql<{ table_name: string; column_name: string }[]>`
      select table_record.relname as table_name,
             column_record.attname as column_name
      from pg_attribute column_record
      join pg_class table_record on table_record.oid = column_record.attrelid
      join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
      where table_namespace.nspname = 'public'
        and table_record.relkind in ('r', 'p')
        and column_record.attnum > 0
        and not column_record.attisdropped
    `;
    const columns = new Set(
      columnRows.map((row) => `${row.table_name}.${row.column_name}`),
    );
    if (
      REQUIRED_COLUMNS.some(
        ([table, column]) => !columns.has(`${table}.${column}`),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const migrationRows = await sql<
      { contract_applied: boolean; expand_applied: boolean }[]
    >`
      select count(*) filter (
               where version not in (
                 '0008_remove_legacy_company_id_fallback',
                 '0010_global_login_id_contract'
               )
             ) = 10 as expand_applied,
             count(*) filter (
               where version in (
                 '0008_remove_legacy_company_id_fallback',
                 '0010_global_login_id_contract',
                 '0012_account_provider_exact_dispatch_contract'
               )
             ) = 3 as contract_applied
      from public.schema_migrations
      where version in (
        '0001_platform_foundation',
        '0002_auth_session_runtime',
        '0003_hotel_basic_information',
        '0004_custom_login_security',
        '0005_auth_session_definer',
        '0006_account_administration',
        '0007_api_tenant_authority_expand',
        '0008_remove_legacy_company_id_fallback',
        '0009_global_login_id_expand',
        '0010_global_login_id_contract',
        '0011_account_provider_exact_dispatch',
        '0012_account_provider_exact_dispatch_contract',
        '0013_neon_definer_creator_membership'
      )
    `;
    const schemaPhase = migrationRows[0]?.contract_applied
      ? "CONTRACT"
      : migrationRows[0]?.expand_applied
        ? "EXPAND"
        : null;
    if (
      !schemaPhase ||
      (options.requiredSchemaPhase &&
        options.requiredSchemaPhase !== schemaPhase)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [definerMembershipTopology] = await sql<
      { exact_zero_or_neon_pair: boolean }[]
    >`
      select count(*) = 0
        or (
          count(*) = 2
          and count(distinct granted_role.rolname) = 2
          and bool_and(
            membership.member = database_record.datdba
            and grantor_role.rolname = 'cloud_admin'
            and grantor_role.rolsuper
            and membership.admin_option
            and not membership.inherit_option
            and not membership.set_option
          )
        ) as exact_zero_or_neon_pair
      from pg_auth_members membership
      join pg_roles granted_role on granted_role.oid = membership.roleid
      join pg_roles grantor_role on grantor_role.oid = membership.grantor
      join pg_database database_record
        on database_record.datname = current_database()
      where granted_role.rolname in (
        'werehere_auth_session_definer',
        'werehere_tenant_authority_definer'
      )
    `;
    if (!definerMembershipTopology?.exact_zero_or_neon_pair) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [legacyAuthFunction] = await sql<
      { executable: boolean; exists: boolean }[]
    >`
      select
        to_regprocedure(
          'public.auth_create_session(uuid,bytea,text,integer,integer,timestamptz,uuid)'
        ) is not null as exists,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure(
            'public.auth_create_session(uuid,bytea,text,integer,integer,timestamptz,uuid)'
          ),
          'EXECUTE'
        ), false) as executable
    `;
    if (
      !legacyAuthFunction ||
      (schemaPhase === "CONTRACT" && legacyAuthFunction.exists) ||
      (schemaPhase === "EXPAND" && legacyAuthFunction.executable)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [authFunction] = await sql<
      {
        executable: boolean;
        owner_safe: boolean;
        return_signature_safe: boolean;
        safe_search_path: boolean;
        security_definer: boolean;
        source: string;
        grantable_execute_count: number;
        non_owner_execute_count: number;
        public_execute: boolean;
      }[]
    >`
      select procedure_record.prosecdef as security_definer,
             procedure_record.proconfig = array['search_path=pg_catalog']::text[] as safe_search_path,
             has_function_privilege(
               current_user, procedure_record.oid, 'EXECUTE'
             ) as executable,
             pg_get_function_result(procedure_record.oid) =
               'TABLE(result_status text, company_id uuid, identity_id uuid, session_id uuid, user_id uuid, user_type text, display_name text, must_change_password boolean)'
               as return_signature_safe,
             procedure_record.prosrc as source,
             exists (
               select 1
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee = 0::oid
             ) as public_execute,
             (
               procedure_owner.rolname = 'werehere_auth_session_definer'
               and not procedure_owner.rolcanlogin
               and not procedure_owner.rolinherit
               and not procedure_owner.rolsuper
               and not procedure_owner.rolcreatedb
               and not procedure_owner.rolcreaterole
               and not procedure_owner.rolreplication
               and not procedure_owner.rolbypassrls
               and not exists (
                 select 1
                 from pg_auth_members membership
                 join pg_roles membership_grantor
                   on membership_grantor.oid = membership.grantor
                 where membership.member = procedure_owner.oid
                   or (
                     membership.roleid = procedure_owner.oid
                     and not (
                       membership.member = (
                         select database_record.datdba
                         from pg_database database_record
                         where database_record.datname = current_database()
                       )
                       and membership_grantor.rolname = 'cloud_admin'
                       and membership_grantor.rolsuper
                       and membership.admin_option
                       and not membership.inherit_option
                       and not membership.set_option
                     )
                   )
               )
             ) as owner_safe,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
             ) as non_owner_execute_count,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
                 and acl.is_grantable
             ) as grantable_execute_count
      from pg_proc procedure_record
      join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
      join pg_roles current_role_record on current_role_record.rolname = current_user
      join pg_roles procedure_owner on procedure_owner.oid = procedure_record.proowner
      where procedure_namespace.nspname = 'public'
        and procedure_record.proname = 'auth_create_session_v2'
        and pg_get_function_identity_arguments(procedure_record.oid)
          = 'p_session_id uuid, p_token_hash bytea, p_provider_subject text, p_idle_lifetime_seconds integer, p_absolute_lifetime_seconds integer, p_auth_time timestamp with time zone, p_trace_id uuid'
    `;
    if (
      !authFunction?.security_definer ||
      !authFunction.safe_search_path ||
      authFunction.executable !== (options.capability === "API_RUNTIME") ||
      !authFunction.owner_safe ||
      authFunction.public_execute ||
      !authFunction.return_signature_safe ||
      authFunction.grantable_execute_count !== 0 ||
      authFunction.non_owner_execute_count > 1 ||
      (options.capability === "API_RUNTIME" &&
        authFunction.non_owner_execute_count !== 1) ||
      (await sourceSha256(authFunction.source)) !==
        (schemaPhase === "CONTRACT"
          ? AUTH_CREATE_SESSION_V2_PROSRC_SHA256
          : AUTH_CREATE_SESSION_V2_EXPAND_PROSRC_SHA256)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const authSupportFunctions = await sql<
      {
        contract_safe: boolean;
        executable: boolean;
        function_name: string;
        grantable_execute_count: number;
        non_owner_execute_count: number;
        owner_safe: boolean;
        public_execute: boolean;
        safe_search_path: boolean;
        security_definer: boolean;
        source: string;
      }[]
    >`
      select procedure_record.proname as function_name,
             procedure_record.prosecdef as security_definer,
             procedure_record.proconfig = array['search_path=pg_catalog']::text[] as safe_search_path,
             has_function_privilege(current_user, procedure_record.oid, 'EXECUTE') as executable,
             procedure_record.prosrc as source,
             case
               when procedure_record.proname = 'auth_resolve_login_identity_v1' then
                 pg_get_function_result(procedure_record.oid) = 'TABLE(provider_subject text)'
                 and function_language.lanname = 'sql'
                 and procedure_record.provolatile = 's'
                 and procedure_record.proparallel = 'u'
                 and not procedure_record.proleakproof
               else true
             end as contract_safe,
             exists (
               select 1
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee = 0::oid
             ) as public_execute,
             (
               procedure_owner.rolname = 'werehere_auth_session_definer'
               and not procedure_owner.rolcanlogin
               and not procedure_owner.rolinherit
               and not procedure_owner.rolsuper
               and not procedure_owner.rolcreatedb
               and not procedure_owner.rolcreaterole
               and not procedure_owner.rolreplication
               and not procedure_owner.rolbypassrls
               and not exists (
                 select 1
                 from pg_auth_members membership
                 join pg_roles membership_grantor
                   on membership_grantor.oid = membership.grantor
                 where membership.member = procedure_owner.oid
                   or (
                     membership.roleid = procedure_owner.oid
                     and not (
                       membership.member = (
                         select database_record.datdba
                         from pg_database database_record
                         where database_record.datname = current_database()
                       )
                       and membership_grantor.rolname = 'cloud_admin'
                       and membership_grantor.rolsuper
                       and membership.admin_option
                       and not membership.inherit_option
                       and not membership.set_option
                     )
                   )
               )
             ) as owner_safe,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
             ) as non_owner_execute_count,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
                 and acl.is_grantable
             ) as grantable_execute_count
      from pg_proc procedure_record
      join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
      join pg_roles procedure_owner on procedure_owner.oid = procedure_record.proowner
      join pg_language function_language on function_language.oid = procedure_record.prolang
      where procedure_namespace.nspname = 'public'
        and (
          (procedure_record.proname = 'auth_resolve_login_identity_v1'
            and pg_get_function_identity_arguments(procedure_record.oid)
              = 'p_login_name text')
          or
          (procedure_record.proname = 'auth_resolve_principal_v2'
            and pg_get_function_identity_arguments(procedure_record.oid)
              = 'p_token_hash bytea, p_idle_lifetime_seconds integer')
          or
          (procedure_record.proname = 'auth_revoke_session_v2'
            and pg_get_function_identity_arguments(procedure_record.oid)
              = 'p_token_hash bytea, p_reason text, p_trace_id uuid')
        )
    `;
    const expectedAuthSupportDigests = new Map([
      [
        "auth_resolve_login_identity_v1",
        AUTH_RESOLVE_LOGIN_IDENTITY_V1_PROSRC_SHA256,
      ],
      ["auth_resolve_principal_v2", AUTH_RESOLVE_PRINCIPAL_V2_PROSRC_SHA256],
      ["auth_revoke_session_v2", AUTH_REVOKE_SESSION_V2_PROSRC_SHA256],
    ]);
    if (authSupportFunctions.length !== expectedAuthSupportDigests.size) {
      return { status: "SCHEMA_NOT_READY" };
    }
    for (const authSupportFunction of authSupportFunctions) {
      const expectedDigest = expectedAuthSupportDigests.get(
        authSupportFunction.function_name,
      );
      if (
        !expectedDigest ||
        !authSupportFunction.security_definer ||
        !authSupportFunction.safe_search_path ||
        !authSupportFunction.contract_safe ||
        authSupportFunction.executable !==
          (options.capability === "API_RUNTIME") ||
        !authSupportFunction.owner_safe ||
        authSupportFunction.public_execute ||
        authSupportFunction.grantable_execute_count !== 0 ||
        authSupportFunction.non_owner_execute_count > 1 ||
        (options.capability === "API_RUNTIME" &&
          authSupportFunction.non_owner_execute_count !== 1) ||
        (await sourceSha256(authSupportFunction.source)) !== expectedDigest
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
    }

    const [userSessionRevokeFunction] = await sql<
      {
        executable: boolean;
        owner_safe: boolean;
        return_signature_safe: boolean;
        safe_search_path: boolean;
        security_definer: boolean;
        source: string;
        grantable_execute_count: number;
        non_owner_execute_count: number;
        public_execute: boolean;
      }[]
    >`
      select procedure_record.prosecdef as security_definer,
             procedure_record.proconfig = array['search_path=pg_catalog']::text[] as safe_search_path,
             has_function_privilege(current_user, procedure_record.oid, 'EXECUTE') as executable,
             pg_get_function_result(procedure_record.oid) = 'integer' as return_signature_safe,
             procedure_record.prosrc as source,
             exists (
               select 1
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee = 0::oid
             ) as public_execute,
             (
               procedure_owner.rolname = 'werehere_auth_session_definer'
               and not procedure_owner.rolcanlogin
               and not procedure_owner.rolinherit
               and not procedure_owner.rolsuper
               and not procedure_owner.rolcreatedb
               and not procedure_owner.rolcreaterole
               and not procedure_owner.rolreplication
               and not procedure_owner.rolbypassrls
               and not exists (
                 select 1
                 from pg_auth_members membership
                 join pg_roles membership_grantor
                   on membership_grantor.oid = membership.grantor
                 where membership.member = procedure_owner.oid
                   or (
                     membership.roleid = procedure_owner.oid
                     and not (
                       membership.member = (
                         select database_record.datdba
                         from pg_database database_record
                         where database_record.datname = current_database()
                       )
                       and membership_grantor.rolname = 'cloud_admin'
                       and membership_grantor.rolsuper
                       and membership.admin_option
                       and not membership.inherit_option
                       and not membership.set_option
                     )
                   )
               )
             ) as owner_safe,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
             ) as non_owner_execute_count,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
                 and acl.is_grantable
             ) as grantable_execute_count
      from pg_proc procedure_record
      join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
      join pg_roles procedure_owner on procedure_owner.oid = procedure_record.proowner
      where procedure_namespace.nspname = 'public'
        and procedure_record.proname = 'auth_revoke_user_sessions_v1'
        and pg_get_function_identity_arguments(procedure_record.oid)
          = 'p_company_id uuid, p_user_id uuid, p_reason text'
    `;
    if (
      !userSessionRevokeFunction?.security_definer ||
      !userSessionRevokeFunction.safe_search_path ||
      userSessionRevokeFunction.executable !==
        (options.capability === "API_RUNTIME") ||
      !userSessionRevokeFunction.owner_safe ||
      userSessionRevokeFunction.public_execute ||
      !userSessionRevokeFunction.return_signature_safe ||
      userSessionRevokeFunction.grantable_execute_count !== 0 ||
      userSessionRevokeFunction.non_owner_execute_count > 1 ||
      (options.capability === "API_RUNTIME" &&
        userSessionRevokeFunction.non_owner_execute_count !== 1) ||
      (await sourceSha256(userSessionRevokeFunction.source)) !==
        AUTH_REVOKE_USER_SESSIONS_V1_PROSRC_SHA256
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const tenantAuthorityFunctions = await sql<
      {
        executable: boolean;
        function_name: string;
        grantable_execute_count: number;
        identity_arguments: string;
        owner_safe: boolean;
        public_execute: boolean;
        result_signature: string;
        safe_search_path: boolean;
        security_definer: boolean;
        source: string;
        unexpected_execute_count: number;
      }[]
    >`
      select procedure_record.proname as function_name,
             pg_get_function_identity_arguments(procedure_record.oid) as identity_arguments,
             pg_get_function_result(procedure_record.oid) as result_signature,
             procedure_record.prosecdef as security_definer,
             procedure_record.proconfig = array['search_path=pg_catalog']::text[] as safe_search_path,
             procedure_record.prosrc as source,
             has_function_privilege(
               current_user, procedure_record.oid, 'EXECUTE'
             ) as executable,
             (
               procedure_owner.rolname = 'werehere_tenant_authority_definer'
               and not procedure_owner.rolcanlogin
               and not procedure_owner.rolinherit
               and not procedure_owner.rolsuper
               and not procedure_owner.rolcreatedb
               and not procedure_owner.rolcreaterole
               and not procedure_owner.rolreplication
               and not procedure_owner.rolbypassrls
               and not exists (
                 select 1
                 from pg_auth_members membership
                 join pg_roles membership_grantor
                   on membership_grantor.oid = membership.grantor
                 where membership.member = procedure_owner.oid
                   or (
                     membership.roleid = procedure_owner.oid
                     and not (
                       membership.member = (
                         select database_record.datdba
                         from pg_database database_record
                         where database_record.datname = current_database()
                       )
                       and membership_grantor.rolname = 'cloud_admin'
                       and membership_grantor.rolsuper
                       and membership.admin_option
                       and not membership.inherit_option
                       and not membership.set_option
                     )
                   )
               )
             ) as owner_safe,
             exists (
               select 1
               from aclexplode(coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))) acl
               where acl.privilege_type = 'EXECUTE' and acl.grantee = 0
             ) as public_execute,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
                 and acl.is_grantable
             ) as grantable_execute_count,
             (
               select count(*)::integer
               from aclexplode(coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))) acl
               left join pg_roles grantee_role on grantee_role.oid = acl.grantee
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
                 and (
                   acl.grantee = 0
                   or grantee_role.rolname is null
                   or not (
                     grantee_role.rolname = pg_get_userbyid((
                       select table_record.relowner
                       from pg_class table_record
                       join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
                       where table_namespace.nspname = 'public' and table_record.relname = 'companies'
                     ))
                     or (
                       grantee_role.rolname = 'werehere_auth_session_definer'
                       and procedure_record.proname in (
                         'runtime_is_schema_owner',
                         'runtime_has_capability',
                         'api_current_company_id',
                         'reconciler_current_company_id'
                       )
                     )
                     or exists (
                       select 1
                       from public.runtime_database_capabilities capability_record
                       where capability_record.role_name = grantee_role.rolname
                         and (
                           procedure_record.proname in (
                             'runtime_is_schema_owner',
                             'runtime_has_capability',
                             'api_current_company_id',
                             'reconciler_current_company_id'
                           )
                           or (
                             procedure_record.proname = 'reconciliation_company_ids'
                             and capability_record.capability = 'RECONCILER'
                           )
                         )
                     )
                   )
                 )
             ) as unexpected_execute_count
      from pg_proc procedure_record
      join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
      join pg_roles procedure_owner on procedure_owner.oid = procedure_record.proowner
      where procedure_namespace.nspname = 'public'
        and procedure_record.proname in (
          'runtime_is_schema_owner',
          'runtime_has_capability',
          'api_current_company_id',
          'reconciler_current_company_id',
          'sync_reconciliation_company_registry',
          'reconciliation_company_ids'
        )
    `;
    const expectedTenantAuthorityFunctions = new Map([
      [
        "runtime_is_schema_owner",
        { arguments: "", result: "boolean", securityDefiner: false },
      ],
      [
        "runtime_has_capability",
        {
          arguments: "required_capability text",
          result: "boolean",
          securityDefiner: true,
        },
      ],
      [
        "api_current_company_id",
        { arguments: "", result: "uuid", securityDefiner: true },
      ],
      [
        "reconciler_current_company_id",
        { arguments: "", result: "uuid", securityDefiner: true },
      ],
      [
        "sync_reconciliation_company_registry",
        { arguments: "", result: "trigger", securityDefiner: true },
      ],
      [
        "reconciliation_company_ids",
        {
          arguments: "",
          result: "TABLE(company_id uuid)",
          securityDefiner: true,
        },
      ],
    ]);
    if (
      tenantAuthorityFunctions.length !== expectedTenantAuthorityFunctions.size
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    for (const helper of tenantAuthorityFunctions) {
      const expected = expectedTenantAuthorityFunctions.get(
        helper.function_name,
      );
      const expectedDigest = TENANT_AUTHORITY_PROSRC_SHA256.get(
        helper.function_name,
      );
      if (
        !expected ||
        !expectedDigest ||
        helper.identity_arguments !== expected.arguments ||
        helper.result_signature !== expected.result ||
        helper.security_definer !== expected.securityDefiner ||
        helper.executable !==
          (helper.function_name === "sync_reconciliation_company_registry"
            ? false
            : helper.function_name === "reconciliation_company_ids"
              ? options.capability === "RECONCILER"
              : true) ||
        !helper.safe_search_path ||
        !helper.owner_safe ||
        helper.public_execute ||
        helper.grantable_execute_count !== 0 ||
        helper.unexpected_execute_count !== 0 ||
        (await sourceSha256(helper.source)) !== expectedDigest
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
    }

    const [capabilityIdentity] = await sql<
      { expected: boolean; unexpected: boolean }[]
    >`
      select public.runtime_has_capability(${options.capability}) as expected,
             public.runtime_has_capability(${options.capability === "API_RUNTIME" ? "RECONCILER" : "API_RUNTIME"}) as unexpected
    `;
    if (!capabilityIdentity?.expected || capabilityIdentity.unexpected) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [capabilityTopology] = await sql<
      {
        api_count: number;
        legacy_api_count: number;
        reconciler_count: number;
        total_count: number;
      }[]
    >`
      select count(*)::integer as total_count,
             count(*) filter (where capability = 'API_RUNTIME')::integer as api_count,
             count(*) filter (where capability = 'RECONCILER')::integer as reconciler_count,
             count(*) filter (
               where role_name = 'werehere_preview_runtime'
                 and capability = 'API_RUNTIME'
             )::integer as legacy_api_count
      from public.runtime_database_capabilities
    `;
    const expandTopologyReady =
      schemaPhase === "EXPAND" &&
      capabilityTopology &&
      capabilityTopology.reconciler_count === 1 &&
      ((capabilityTopology.total_count === 2 &&
        capabilityTopology.api_count === 1 &&
        capabilityTopology.legacy_api_count === 0) ||
        (capabilityTopology.total_count === 3 &&
          capabilityTopology.api_count === 2 &&
          capabilityTopology.legacy_api_count === 1));
    const contractTopologyReady =
      schemaPhase === "CONTRACT" &&
      capabilityTopology?.total_count === 2 &&
      capabilityTopology.api_count === 1 &&
      capabilityTopology.reconciler_count === 1 &&
      capabilityTopology.legacy_api_count === 0;
    if (!expandTopologyReady && !contractTopologyReady) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [runtimeRole] = await sql<
      {
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolinherit: boolean;
        rolreplication: boolean;
        rolsuper: boolean;
        rolbypassrls: boolean;
        role_member: boolean;
        table_owner: boolean;
      }[]
    >`
      select role_record.rolsuper,
             role_record.rolbypassrls,
             role_record.rolcreatedb,
             role_record.rolcreaterole,
             role_record.rolinherit,
             role_record.rolreplication,
             exists (
               select 1 from pg_auth_members membership
               where membership.member = role_record.oid
             ) as role_member,
             exists (
               select 1
               from pg_class table_record
               join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
               where table_namespace.nspname = 'public'
                 and table_record.relkind in ('r', 'p', 'S')
                 and pg_get_userbyid(table_record.relowner) = current_user
             ) as table_owner
      from pg_roles role_record
      where role_record.rolname = current_user
    `;
    if (
      !runtimeRole ||
      runtimeRole.rolsuper ||
      runtimeRole.rolbypassrls ||
      runtimeRole.rolcreatedb ||
      runtimeRole.rolcreaterole ||
      runtimeRole.rolinherit ||
      runtimeRole.rolreplication ||
      runtimeRole.role_member ||
      runtimeRole.table_owner
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const schemaPrivilegeRows = await sql<
      { grantable: boolean; label: string }[]
    >`
      select
        case when acl.grantee = 0::oid then 'PUBLIC' else 'CURRENT' end
          || ':' || upper(acl.privilege_type) as label,
        acl.is_grantable as grantable
      from pg_namespace namespace_record
      cross join lateral aclexplode(coalesce(
        namespace_record.nspacl,
        acldefault('n'::"char", namespace_record.nspowner)
      )) acl
      left join pg_roles grantee_role on grantee_role.oid = acl.grantee
      where namespace_record.nspname = 'public'
        and (acl.grantee = 0::oid or grantee_role.rolname = current_user)
    `;
    const expectedSchemaPrivileges = new Set([
      "CURRENT:USAGE",
      ...(schemaPhase === "EXPAND" ? ["PUBLIC:USAGE"] : []),
    ]);
    if (
      schemaPrivilegeRows.length !== expectedSchemaPrivileges.size ||
      schemaPrivilegeRows.some(
        (row) => row.grantable || !expectedSchemaPrivileges.has(row.label),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [schemaAclClosure] = await sql<{ unexpected_count: number }[]>`
      select count(*)::integer as unexpected_count
      from pg_namespace namespace_record
      cross join lateral aclexplode(coalesce(
        namespace_record.nspacl,
        acldefault('n'::"char", namespace_record.nspowner)
      )) acl
      left join pg_roles grantee_role on grantee_role.oid = acl.grantee
      where namespace_record.nspname = 'public'
        and acl.grantee <> namespace_record.nspowner
        and not (
          acl.privilege_type = 'USAGE'
          and not acl.is_grantable
          and (
            (acl.grantee = 0::oid and ${schemaPhase === "EXPAND"})
            or grantee_role.rolname in (
              'werehere_auth_session_definer',
              'werehere_tenant_authority_definer'
            )
            or exists (
              select 1
              from public.runtime_database_capabilities capability
              where capability.role_name = grantee_role.rolname
            )
          )
        )
    `;
    if (!schemaAclClosure || schemaAclClosure.unexpected_count !== 0) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const sequencePrivilegeRows = await sql<
      { grantable: boolean; label: string }[]
    >`
      select sequence_record.relname || ':' || upper(acl.privilege_type) as label,
             acl.is_grantable as grantable
      from pg_class sequence_record
      join pg_namespace sequence_namespace on sequence_namespace.oid = sequence_record.relnamespace
      cross join lateral aclexplode(coalesce(
        sequence_record.relacl,
        acldefault('S'::"char", sequence_record.relowner)
      )) acl
      where sequence_namespace.nspname = 'public'
        and sequence_record.relkind = 'S'
        and acl.grantee <> sequence_record.relowner
    `;
    if (sequencePrivilegeRows.length !== 0) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [sequenceOwnerTopology] = await sql<{ unexpected_count: number }[]>`
      select count(*)::integer as unexpected_count
      from pg_class sequence_record
      join pg_namespace sequence_namespace
        on sequence_namespace.oid = sequence_record.relnamespace
      join pg_class migration_table
        on migration_table.relname = 'schema_migrations'
       and migration_table.relnamespace = sequence_record.relnamespace
      where sequence_namespace.nspname = 'public'
        and sequence_record.relkind = 'S'
        and sequence_record.relowner <> migration_table.relowner
    `;
    if (
      !sequenceOwnerTopology ||
      sequenceOwnerTopology.unexpected_count !== 0
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [reconciliationDiscovery] = await sql<
      {
        executable: boolean;
        search_path_safe: boolean;
        security_definer: boolean;
      }[]
    >`
      select function_record.prosecdef as security_definer,
             function_record.proconfig = array['search_path=pg_catalog']::text[] as search_path_safe,
             has_function_privilege(
               current_user,
               'public.reconciliation_company_ids()',
               'EXECUTE'
             ) as executable
      from pg_proc function_record
      join pg_namespace function_namespace on function_namespace.oid = function_record.pronamespace
      where function_namespace.nspname = 'public'
        and function_record.proname = 'reconciliation_company_ids'
        and function_record.pronargs = 0
    `;
    if (
      !reconciliationDiscovery ||
      !reconciliationDiscovery.security_definer ||
      !reconciliationDiscovery.search_path_safe ||
      reconciliationDiscovery.executable !==
        (options.capability === "RECONCILER")
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [registryPrivilege] = await sql<{ direct_access: boolean }[]>`
      select has_table_privilege(current_user, 'public.reconciliation_company_registry', 'SELECT')
          or has_table_privilege(current_user, 'public.reconciliation_company_registry', 'INSERT')
          or has_table_privilege(current_user, 'public.reconciliation_company_registry', 'UPDATE')
          or has_table_privilege(current_user, 'public.reconciliation_company_registry', 'DELETE')
          as direct_access
    `;
    if (!registryPrivilege || registryPrivilege.direct_access) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const constraintRows = await sql<
      {
        constraint_name: string;
        definition: string;
        table_name: string;
        validated: boolean;
      }[]
    >`
      select constraint_table.relname as table_name,
             constraint_record.conname as constraint_name,
             constraint_record.convalidated as validated,
             pg_get_constraintdef(constraint_record.oid) as definition
      from pg_constraint constraint_record
      join pg_class constraint_table on constraint_table.oid = constraint_record.conrelid
      join pg_namespace constraint_namespace on constraint_namespace.oid = constraint_table.relnamespace
      where constraint_namespace.nspname = 'public'
    `;
    const constraints = constraintRows.map((row) => ({
      name: row.constraint_name,
      table: row.table_name,
      validated: row.validated,
      definition: normalizeDefinition(row.definition),
    }));
    const exactDispatchConstraint = constraints.find(
      (constraint) =>
        constraint.table === "outbox_jobs" &&
        constraint.name === "outbox_jobs_compensation_linkage_check" &&
        constraint.validated,
    );
    if (
      schemaPhase === "CONTRACT" &&
      (!exactDispatchConstraint ||
        exactDispatchConstraint.definition !==
          REQUIRED_ACCOUNT_PROVIDER_EXACT_DISPATCH_CHECK)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      REQUIRED_CONSTRAINTS.some(
        ([table, required]) =>
          !constraints.some(
            (constraint) =>
              constraint.table === table &&
              constraint.definition.includes(required),
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      REQUIRED_FOREIGN_KEY_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      REQUIRED_PRIMARY_KEY_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      REQUIRED_UNIQUE_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      REQUIRED_EXCLUSION_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      REQUIRED_CHECK_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      schemaPhase === "CONTRACT" &&
      REQUIRED_CONTRACT_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      REQUIRED_SECURITY_CHECK_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const indexRows = await sql<{ index_name: string; definition: string }[]>`
      select indexname as index_name, indexdef as definition
      from pg_indexes
      where schemaname = 'public'
    `;
    if (
      REQUIRED_INDEXES.some(
        (required) =>
          !indexRows.some(
            (index) =>
              index.index_name === required.name &&
              normalizeDefinition(index.definition) === required.definition,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const permissionRows = await sql<{ permission_ready: boolean }[]>`
      select count(distinct code) = 4 as permission_ready
      from permissions
      where code in ('HOTEL_MANAGE', 'USER_READ', 'USER_CREATE', 'USER_SUSPEND')
    `;
    if (!permissionRows[0]?.permission_ready)
      return { status: "SCHEMA_NOT_READY" };

    const tablePrivilegeRows = await sql<
      { grantable: boolean; label: string; role_name: string | null }[]
    >`
      select table_record.relname || ':' || upper(acl.privilege_type) as label,
             acl.is_grantable as grantable,
             grantee_role.rolname as role_name
      from pg_class table_record
      join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
      cross join lateral aclexplode(coalesce(
        table_record.relacl,
        acldefault('r'::"char", table_record.relowner)
      )) acl
      left join pg_roles grantee_role on grantee_role.oid = acl.grantee
      where table_namespace.nspname = 'public'
        and table_record.relkind in ('r', 'p')
        and acl.grantee <> table_record.relowner
    `;
    const capabilityRoleRows = await sql<
      { capability: RuntimeCapability; role_name: string }[]
    >`
      select role_name::text, capability
      from public.runtime_database_capabilities
      order by role_name
    `;
    const [migrationOwner] = await sql<{ role_name: string }[]>`
      select pg_get_userbyid(table_record.relowner) as role_name
      from pg_class table_record
      join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
      where table_namespace.nspname = 'public'
        and table_record.relname = 'schema_migrations'
        and table_record.relkind in ('r', 'p')
    `;
    if (!migrationOwner) return { status: "SCHEMA_NOT_READY" };
    const expectedTablePrivileges = new Set<string>();
    const addExpectedTablePrivileges = (
      roleName: string,
      labels: readonly string[],
    ) => {
      for (const label of labels) {
        expectedTablePrivileges.add(`${roleName}:${label}`);
      }
    };
    for (const role of capabilityRoleRows) {
      if (role.role_name === migrationOwner.role_name) continue;
      addExpectedTablePrivileges(
        role.role_name,
        role.capability === "API_RUNTIME"
          ? EXPECTED_API_RUNTIME_TABLE_PRIVILEGES
          : EXPECTED_RECONCILER_TABLE_PRIVILEGES,
      );
    }
    addExpectedTablePrivileges("werehere_auth_session_definer", [
      "auth_identities:SELECT",
      "auth_identities:UPDATE",
      "users:SELECT",
      "users:UPDATE",
      "companies:SELECT",
      "companies:UPDATE",
      "auth_sessions:SELECT",
      "auth_sessions:INSERT",
      "auth_sessions:UPDATE",
      "audit_events:INSERT",
      "runtime_database_capabilities:SELECT",
    ]);
    addExpectedTablePrivileges("werehere_tenant_authority_definer", [
      "auth_sessions:SELECT",
      "users:SELECT",
      "companies:SELECT",
      "reconciliation_company_registry:SELECT",
      "reconciliation_company_registry:INSERT",
      "reconciliation_company_registry:UPDATE",
    ]);
    addExpectedTablePrivileges(migrationOwner.role_name, [
      "runtime_database_capabilities:SELECT",
      "runtime_database_capabilities:INSERT",
      "runtime_database_capabilities:UPDATE",
    ]);
    const actualTablePrivileges = new Set(
      tablePrivilegeRows.map(
        (row) => `${row.role_name ?? "PUBLIC"}:${row.label}`,
      ),
    );
    if (
      actualTablePrivileges.size !== expectedTablePrivileges.size ||
      [...expectedTablePrivileges].some(
        (privilege) => !actualTablePrivileges.has(privilege),
      ) ||
      tablePrivilegeRows.some((row) => row.grantable || !row.role_name)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const triggerRows = await sql<
      {
        trigger_name: string;
        enabled: string;
        table_name: string;
        function_name: string;
        function_owner: string;
        function_source: string;
        function_acl_safe: boolean;
        function_contract_safe: boolean;
        trigger_type: number;
      }[]
    >`
      select trigger_record.tgname as trigger_name,
             trigger_record.tgenabled as enabled,
             trigger_record.tgtype::integer as trigger_type,
             trigger_table.relname as table_name,
             trigger_function.proname as function_name,
             trigger_function.prosrc as function_source,
             trigger_owner.rolname as function_owner,
             (
               select count(*) = 1
                  and bool_and(
                    function_acl.grantee = trigger_function.proowner
                    and function_acl.privilege_type = 'EXECUTE'
                    and not function_acl.is_grantable
                  )
               from aclexplode(
                 coalesce(
                   trigger_function.proacl,
                   acldefault('f', trigger_function.proowner)
                 )
               ) function_acl
             ) as function_acl_safe,
             (
               pg_get_function_result(trigger_function.oid) = 'trigger'
               and trigger_language.lanname = 'plpgsql'
               and trigger_function.provolatile = 'v'
               and trigger_function.proparallel = 'u'
               and not trigger_function.proleakproof
               and not trigger_function.prosecdef
               and trigger_function.proconfig = array['search_path=pg_catalog']::text[]
             ) as function_contract_safe
      from pg_trigger trigger_record
      join pg_class trigger_table on trigger_table.oid = trigger_record.tgrelid
      join pg_namespace trigger_namespace on trigger_namespace.oid = trigger_table.relnamespace
      join pg_proc trigger_function on trigger_function.oid = trigger_record.tgfoid
      join pg_roles trigger_owner on trigger_owner.oid = trigger_function.proowner
      join pg_language trigger_language on trigger_language.oid = trigger_function.prolang
      where trigger_namespace.nspname = 'public'
        and not trigger_record.tgisinternal
    `;
    if (
      REQUIRED_TRIGGERS.some(
        (required) =>
          !triggerRows.some(
            (trigger) =>
              trigger.trigger_name === required.name &&
              trigger.table_name === required.table &&
              trigger.function_name === required.functionName &&
              trigger.enabled === "O",
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    const loginRegistryTrigger = triggerRows.find(
      (trigger) => trigger.trigger_name === "login_id_registry_immutable",
    );
    if (
      !loginRegistryTrigger ||
      loginRegistryTrigger.trigger_type !== 27 ||
      loginRegistryTrigger.function_owner !== migrationOwner.role_name ||
      !loginRegistryTrigger.function_acl_safe ||
      !loginRegistryTrigger.function_contract_safe ||
      (await sourceSha256(loginRegistryTrigger.function_source)) !==
        PREVENT_LOGIN_ID_REGISTRY_MUTATION_PROSRC_SHA256
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const rlsRows = await sql<
      {
        applies_to_current_role: boolean;
        policy_name: string;
        policy_command: string;
        policy_permissive: boolean;
        row_security: boolean;
        row_security_forced: boolean;
        table_name: string;
        using_expression: string | null;
        check_expression: string | null;
      }[]
    >`
      select policy_record.polname as policy_name,
             policy_record.polcmd as policy_command,
             policy_record.polpermissive as policy_permissive,
             case
               when 0::oid = any(policy_record.polroles) then true
               else exists (
                 select 1
                 from unnest(policy_record.polroles) policy_role(role_oid)
                 where pg_has_role(current_user, policy_role.role_oid, 'member')
               )
             end as applies_to_current_role,
             policy_table.relrowsecurity as row_security,
             policy_table.relforcerowsecurity as row_security_forced,
             policy_table.relname as table_name,
             pg_get_expr(policy_record.polqual, policy_record.polrelid) as using_expression,
             pg_get_expr(policy_record.polwithcheck, policy_record.polrelid) as check_expression
      from pg_policy policy_record
      join pg_class policy_table on policy_table.oid = policy_record.polrelid
      join pg_namespace policy_namespace on policy_namespace.oid = policy_table.relnamespace
      where policy_namespace.nspname = 'public'
    `;
    if (
      REQUIRED_RLS_POLICIES.some(
        (required) =>
          !rlsRows.some((policy) => {
            return (
              policy.policy_name === required.policy &&
              policy.table_name === required.table &&
              policy.row_security &&
              policy.row_security_forced &&
              policy.policy_permissive &&
              policy.applies_to_current_role &&
              policy.policy_command === "*" &&
              isExactTenantPolicyExpression(
                policy.using_expression,
                required.table === "companies" ? "id" : "company_id",
                schemaPhase,
              ) &&
              isExactTenantPolicyExpression(
                policy.check_expression,
                required.table === "companies" ? "id" : "company_id",
                schemaPhase,
              )
            );
          }),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    const protectedRlsTables = new Set(
      REQUIRED_RLS_POLICIES.map((required) => required.table),
    );
    const approvedRlsPolicies = new Set(
      REQUIRED_RLS_POLICIES.map(
        (required) => `${required.table}\0${required.policy}`,
      ),
    );
    if (
      rlsRows.some(
        (policy) =>
          policy.applies_to_current_role &&
          protectedRlsTables.has(
            policy.table_name as (typeof REQUIRED_RLS_POLICIES)[number]["table"],
          ) &&
          !approvedRlsPolicies.has(
            `${policy.table_name}\0${policy.policy_name}`,
          ),
      )
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    return { status: "READY" };
  } catch {
    return { status: "UNAVAILABLE" };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}
