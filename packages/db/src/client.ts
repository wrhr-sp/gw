import postgres from "postgres";

export type DatabaseReadiness =
  | { status: "READY" }
  | { status: "NOT_CONFIGURED" }
  | { status: "SCHEMA_NOT_READY" }
  | { status: "UNAVAILABLE" };

const HOTEL_ROOM_LIFECYCLE_COMMAND_V1_PROSRC_SHA256 =
  "21f348f7571c10c82d93696d6cbef2d897b8a2f8fb8f794c60ae05d32246a87e";
const HOTEL_ROOM_WRITE_COMMAND_V1_PROSRC_SHA256 =
  "e89b59f47f3b7901ee89f66d33ca0545e5df96719508c0eb26d216abc9bacd50";
const HOTEL_INSPECTION_COMMAND_CONTRACTS = [
  {
    capability: "API_RUNTIME",
    digest: "c56d9ae6458a49f078fc457d5914c06739d2d086fea69aea8033bd5c51db498d",
    name: "hotel_process_command_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature:
      "public.hotel_process_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
  },
  {
    capability: "API_RUNTIME",
    digest: "0e7199d0a022a093797d6aa567d2b84293cc59b155e281fb6d00cc28a38826f4",
    name: "hotel_process_default_read_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature: "public.hotel_process_default_read_v1(uuid,uuid,text)",
  },
  {
    capability: "API_RUNTIME",
    digest: "3ed0a486551ee5875a8766c0d7ba4428c9be0abe14f18ffcb5913dca4abae7c2",
    name: "hotel_process_reviewer_candidates_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature: "public.hotel_process_reviewer_candidates_v1(uuid,uuid,text)",
  },
  {
    capability: "API_RUNTIME",
    digest: "860058d8d96c8512490c1d1e065aa30ced3ae74586f91156d14084ac0c59c3a4",
    name: "hotel_inspection_routines_read_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature: "public.hotel_inspection_routines_read_v1(uuid,uuid,uuid,text)",
  },
  {
    capability: "API_RUNTIME",
    digest: "a220c9d3366847cec3a2e3697a088384aa1d3edb793cf4fca803f375797de07e",
    name: "hotel_inspection_routine_command_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature:
      "public.hotel_inspection_routine_command_v1(uuid,uuid,uuid,integer,jsonb,text,text,text,text,text,uuid,uuid,uuid)",
  },
  {
    capability: "API_RUNTIME",
    digest: "26cc365923f9e287f8faa5f52a46043185661d160265731ddc748244afbf3457",
    name: "hotel_inspection_executions_read_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature:
      "public.hotel_inspection_executions_read_v1(uuid,uuid,uuid,jsonb,text)",
  },
  {
    capability: "API_RUNTIME",
    digest: "4706062d37cfab01607fba9b2dbdfabdf6506eb5ba54ce610d43a31f737f0f70",
    name: "hotel_inspection_command_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature:
      "public.hotel_inspection_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
  },
  {
    capability: "API_RUNTIME",
    digest: "d041635b8383bd77f4c95b94d72827f210165c6e4d14d32130a88f7c1d017499",
    name: "hotel_file_command_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature:
      "public.hotel_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
  },
  {
    capability: "RECONCILER",
    digest: "daf7eb22db1065b5528af244eb68914bd06ae38e2d6102341e508b75d6702d15",
    name: "hotel_file_scan_command_v1",
    result: "TABLE(command_status text, result_snapshot jsonb)",
    signature:
      "public.hotel_file_scan_command_v1(uuid,text,text,bigint,jsonb,uuid)",
  },
  {
    capability: "RECONCILER",
    digest: "2510f44ea768a3b8882fd373983cee2f612e44d673dc31b91d39e7115e6c27a8",
    name: "hotel_inspection_claim_materialization_v1",
    result:
      "TABLE(result_status text, claim_generation bigint, from_date date, through_date date)",
    signature:
      "public.hotel_inspection_claim_materialization_v1(uuid,bytea,integer)",
  },
  {
    capability: "RECONCILER",
    digest: "937af566b927a8820c421dc2a5e678bc318ac9c1c6400648a9a7b621a7f6d193",
    name: "hotel_inspection_complete_materialization_v1",
    result: "TABLE(result_status text, created_count integer)",
    signature:
      "public.hotel_inspection_complete_materialization_v1(uuid,bigint,bytea,uuid)",
  },
] as const;
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
const AUTH_REVOKE_HOTEL_OWNER_SESSIONS_V1_PROSRC_SHA256 =
  "5580111208ab4d261cc45ad6a21597b03c1e33cf6acf8e3875369acaa02d79b2";
const PREVENT_LOGIN_ID_REGISTRY_MUTATION_PROSRC_SHA256 =
  "be07b10542ba804bb4d3d0a5afa3e4604e9e4e5c32e745a6ad74aea45b214bbd";
const REJECT_HOTEL_RELATIONSHIP_DELETE_PROSRC_SHA256 =
  "63543136e8b51cb928e4f0991885dcff14c82179fbff724aecb886c743c771e7";
const ENFORCE_HOTEL_ROOM_TYPE_SCOPE_PROSRC_SHA256 =
  "286caaed14c7f9b8cb4e9f7c923ce9cf3c35c1601afdfff4491bfbf7504f6301";
const REJECT_HOTEL_ROOM_TYPE_SCOPE_CHANGE_PROSRC_SHA256 =
  "ba32fe70a4efb34567b00e952d101cccea173ad71a663763f8da6ba8d24f100a";
const REJECT_HOTEL_ROOM_DELETE_PROSRC_SHA256 =
  "b74c7a7235f0854bc8793be2e0d56b2e6156813b45b0ca2e5f81331c303e6a1b";
const REJECT_HOTEL_ROOM_HISTORY_CHANGE_PROSRC_SHA256 =
  "d009a84452fcd3b15d40a4297249ac6bffb48a12aeed053481e5c5dfeb189949";
const REJECT_DELETED_HOTEL_ROOM_CHANGE_PROSRC_SHA256 =
  "d8f18be4464a2bbfd81baa9aa10a031358ce4f045d647264649dcf3ada12a0a7";
const ENFORCE_NEW_HOTEL_ROOM_HISTORY_INSERT_PROSRC_SHA256 =
  "ce02e9fb2a6342d573b8bb6b0762f3a159ccffcb55d33e1a37921fd5efbe3513";
const RUNTIME_IS_SCHEMA_OWNER_EXPAND_PROSRC_SHA256 =
  "1b51d38556502816e9d57b8f254a7b9c892dc873ea0ac4cbbc946ad1d2add221";
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
  "hotel_room_types",
  "hotel_rooms",
  "hotel_room_status_history",

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
  ["hotel_room_types", "scope"],
  ["hotel_room_types", "is_active"],
  ["hotel_rooms", "room_number"],
  ["hotel_rooms", "room_type_id"],
  ["hotel_rooms", "status"],
  ["hotel_rooms", "version"],

  ["hotel_room_status_history", "previous_status"],
  ["hotel_room_status_history", "next_status"],
] as const;

const LOGIN_ID_HISTORY_REQUIRED_COLUMNS = [
  { name: "operation_key", type: "text", notNull: true, default: null },
  { name: "operation_type", type: "text", notNull: true, default: null },
  { name: "subject_fingerprint", type: "text", notNull: true, default: null },
  { name: "request_fingerprint", type: "text", notNull: true, default: null },
  { name: "status", type: "text", notNull: true, default: null },
  {
    name: "created_at",
    type: "timestamp with time zone",
    notNull: true,
    default: "statement_timestamp()",
  },
  {
    name: "updated_at",
    type: "timestamp with time zone",
    notNull: true,
    default: "statement_timestamp()",
  },
] as const;

const LOGIN_ID_HISTORY_REQUIRED_CONSTRAINTS = [
  {
    name: "preview_bootstrap_operations_pkey",
    definition: "primary key (operation_key)",
  },
  {
    name: "preview_bootstrap_operations_operation_key_check",
    definition: "check ((btrim(operation_key) <> ''::text))",
  },
  {
    name: "preview_bootstrap_operations_operation_type_check",
    definition: "check ((operation_type = 'PASSWORD_RESET_EMAIL'::text))",
  },
  {
    name: "preview_bootstrap_operations_subject_fingerprint_check",
    definition: "check ((subject_fingerprint ~ '^[0-9a-f]{64}$'::text))",
  },
  {
    name: "preview_bootstrap_operations_request_fingerprint_check",
    definition: "check ((request_fingerprint ~ '^[0-9a-f]{64}$'::text))",
  },
  {
    name: "preview_bootstrap_operations_status_check",
    definition:
      "check ((status = any (array['REQUESTING'::text, 'REQUESTED'::text, 'INDETERMINATE'::text])))",
  },
] as const;

const HOTEL_RELATIONSHIP_REQUIRED_COLUMNS = [
  ["hotel_staff_assignments", "version"],
  ["hotel_staff_assignments", "terminated_at"],
  ["hotel_staff_assignments", "termination_reason"],
  ["hotel_staff_assignments", "terminated_by"],
  ["housekeeping_hotel_links", "version"],
  ["housekeeping_hotel_links", "terminated_at"],
  ["housekeeping_hotel_links", "termination_reason"],
  ["housekeeping_hotel_links", "terminated_by"],
  ["hotel_owner_assignments", "version"],
  ["hotel_owner_assignments", "terminated_at"],
  ["hotel_owner_assignments", "termination_reason"],
  ["hotel_owner_assignments", "terminated_by"],
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
    table: "hotel_staff_assignments",
    name: "hotel_staff_assignments_terminated_by_fkey",
    definition:
      "foreign key (company_id, terminated_by) references users(company_id, id)",
  },
  {
    table: "housekeeping_hotel_links",
    name: "housekeeping_hotel_links_terminated_by_fkey",
    definition:
      "foreign key (company_id, terminated_by) references users(company_id, id)",
  },
  {
    table: "hotel_owner_assignments",
    name: "hotel_owner_assignments_terminated_by_fkey",
    definition:
      "foreign key (company_id, terminated_by) references users(company_id, id)",
  },
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
  {
    table: "hotel_room_types",
    name: "hotel_room_types_company_id_fkey",
    definition: "foreign key (company_id) references companies(id)",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_company_id_branch_id_fkey",
    definition:
      "foreign key (company_id, branch_id) references branches(company_id, id)",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_company_id_created_by_fkey",
    definition:
      "foreign key (company_id, created_by) references users(company_id, id)",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_company_id_updated_by_fkey",
    definition:
      "foreign key (company_id, updated_by) references users(company_id, id)",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_company_id_fkey",
    definition: "foreign key (company_id) references companies(id)",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_company_id_branch_id_fkey",
    definition:
      "foreign key (company_id, branch_id) references branches(company_id, id)",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_company_id_room_type_id_fkey",
    definition:
      "foreign key (company_id, room_type_id) references hotel_room_types(company_id, id)",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_company_id_created_by_fkey",
    definition:
      "foreign key (company_id, created_by) references users(company_id, id)",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_company_id_updated_by_fkey",
    definition:
      "foreign key (company_id, updated_by) references users(company_id, id)",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_company_id_fkey",
    definition: "foreign key (company_id) references companies(id)",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_company_id_branch_id_fkey",
    definition:
      "foreign key (company_id, branch_id) references branches(company_id, id)",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_room_hotel_fkey",
    definition:
      "foreign key (company_id, branch_id, room_id) references hotel_rooms(company_id, branch_id, id)",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_company_id_changed_by_fkey",
    definition:
      "foreign key (company_id, changed_by) references users(company_id, id)",
  },
] as const;

const REQUIRED_PRIMARY_KEY_CONSTRAINTS = [
  {
    table: "login_id_registry",
    name: "login_id_registry_pkey",
    definition: "primary key (login_id)",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_pkey",
    definition: "primary key (id)",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_pkey",
    definition: "primary key (id)",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_pkey",
    definition: "primary key (id)",
  },
] as const;

const REQUIRED_EXCLUSION_CONSTRAINTS = [
  {
    table: "hotel_staff_assignments",
    name: "hotel_staff_assignments_support_hotel_period_excl",
    definition:
      "exclude using gist (company_id with =, branch_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&) where (((assignment_type = 'SUPPORT'::text) and (terminated_at is null)))",
  },
  {
    table: "hotel_staff_assignments",
    name: "hotel_staff_assignments_primary_period_excl",
    definition:
      "exclude using gist (company_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&) where (((assignment_type = 'PRIMARY'::text) and (terminated_at is null)))",
  },
  {
    table: "housekeeping_hotel_links",
    name: "housekeeping_hotel_links_period_excl",
    definition:
      "exclude using gist (company_id with =, branch_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&) where ((terminated_at is null))",
  },
  {
    table: "hotel_owner_assignments",
    name: "hotel_owner_assignments_user_period_excl",
    definition:
      "exclude using gist (company_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&) where ((terminated_at is null))",
  },
  {
    table: "hotel_owner_assignments",
    name: "hotel_owner_assignments_hotel_period_excl",
    definition:
      "exclude using gist (company_id with =, branch_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&) where ((terminated_at is null))",
  },
] as const;

const LEGACY_LOGIN_ID_TARGET_UNIQUE_CONSTRAINT = {
  definition: "unique (company_id, target_user_id)",
  name: "login_id_registry_company_id_target_user_id_key",
  table: "login_id_registry",
} as const;

const REQUIRED_UNIQUE_CONSTRAINTS = [
  {
    definition: "unique (provider, provider_subject)",
    name: "auth_identities_provider_provider_subject_key",
    table: "auth_identities",
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
  {
    definition: "unique (company_id, id)",
    name: "hotel_room_types_company_id_id_key",
    table: "hotel_room_types",
  },
  {
    definition:
      "unique nulls not distinct (company_id, branch_id, normalized_name)",
    name: "hotel_room_types_company_id_branch_id_normalized_name_key",
    table: "hotel_room_types",
  },
  {
    definition: "unique (company_id, id)",
    name: "hotel_rooms_company_id_id_key",
    table: "hotel_rooms",
  },
  {
    definition: "unique (company_id, branch_id, id)",
    name: "hotel_rooms_company_branch_id_key",
    table: "hotel_rooms",
  },
] as const;

const REQUIRED_ACCOUNT_PROVIDER_EXACT_DISPATCH_CHECK =
  "check (((job_type <> 'ACCOUNT_PROVIDER_COMPENSATE'::text) or (status = any (array['SUCCEEDED'::text, 'CANCELLED'::text, 'DEAD_LETTER'::text])) or coalesce(((jsonb_typeof((payload -> 'provisioningAttemptId'::text)) = 'string'::text) and ((payload ->> 'provisioningAttemptId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) and (jsonb_typeof((payload -> 'originalErrorCode'::text)) = 'string'::text) and ((payload ->> 'originalErrorCode'::text) = any (array['ACCOUNT_DUPLICATE'::text, 'FORBIDDEN'::text, 'INTERNAL_ERROR'::text])) and (jsonb_typeof((payload -> 'userId'::text)) = 'string'::text) and ((payload ->> 'userId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) and (jsonb_typeof((payload -> 'providerSubject'::text)) = 'string'::text) and ((length((payload ->> 'providerSubject'::text)) >= 1) and (length((payload ->> 'providerSubject'::text)) <= 200)) and ((payload ->> 'action'::text) = 'COMPENSATE'::text)), false)))";

const REQUIRED_CHECK_CONSTRAINTS = [
  {
    table: "hotel_staff_assignments",
    name: "hotel_staff_assignments_termination_shape",
    definition:
      "check ((((terminated_at is null) and (termination_reason is null) and (terminated_by is null)) or ((terminated_at is not null) and (termination_reason is not null) and (btrim(termination_reason) <> ''::text) and (terminated_by is not null) and (end_date is not null))))",
  },
  {
    table: "housekeeping_hotel_links",
    name: "housekeeping_hotel_links_termination_shape",
    definition:
      "check ((((terminated_at is null) and (termination_reason is null) and (terminated_by is null)) or ((terminated_at is not null) and (termination_reason is not null) and (btrim(termination_reason) <> ''::text) and (terminated_by is not null) and (end_date is not null))))",
  },
  {
    table: "hotel_owner_assignments",
    name: "hotel_owner_assignments_termination_shape",
    definition:
      "check ((((terminated_at is null) and (termination_reason is null) and (terminated_by is null)) or ((terminated_at is not null) and (termination_reason is not null) and (btrim(termination_reason) <> ''::text) and (terminated_by is not null) and (end_date is not null))))",
  },
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
      "check (((branch_code = upper(btrim(branch_code))) and (branch_code ~ '^[A-Z0-9][A-Z0-9_-]*$'::text)))",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_scope_shape",
    definition:
      "check ((((scope = 'COMPANY'::text) and (branch_id is null)) or ((scope = 'HOTEL'::text) and (branch_id is not null))))",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_scope_check",
    definition: "check ((scope = any (array['COMPANY'::text, 'HOTEL'::text])))",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_name_check",
    definition:
      "check (((btrim(name) <> ''::text) and (char_length(name) <= 100)))",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_display_order_check",
    definition: "check (((display_order >= 0) and (display_order <= 100000)))",
  },
  {
    table: "hotel_room_types",
    name: "hotel_room_types_version_check",
    definition: "check ((version > 0))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_room_number_check",
    definition:
      "check (((btrim(room_number) <> ''::text) and (char_length(room_number) <= 40)))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_room_number_canonical_check",
    definition:
      "check (((room_number = upper(btrim(room_number))) and (room_number ~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$'::text)))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_floor_label_check",
    definition:
      "check (((btrim(floor_label) <> ''::text) and (char_length(floor_label) <= 40)))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_floor_sort_key_check",
    definition:
      "check (((floor_sort_key >= '-1000'::integer) and (floor_sort_key <= 1000)))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_status_check",
    definition:
      "check ((status = any (array['ACTIVE'::text, 'INACTIVE'::text, 'DELETED'::text])))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_internal_note_check",
    definition:
      "check (((internal_note is null) or (char_length(internal_note) <= 1000)))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_owner_visible_note_check",
    definition:
      "check (((owner_visible_note is null) or (char_length(owner_visible_note) <= 1000)))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_version_check",
    definition: "check ((version > 0))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_previous_status_check",
    definition:
      "check ((previous_status = any (array['ACTIVE'::text, 'INACTIVE'::text, 'DELETED'::text, 'TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text])))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_next_status_check",
    definition:
      "check ((next_status = any (array['ACTIVE'::text, 'INACTIVE'::text, 'DELETED'::text, 'TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text])))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_reason_check",
    definition:
      "check (((btrim(reason) <> ''::text) and (char_length(reason) <= 500)))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_transition",
    definition: "check ((previous_status <> next_status))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_source_shape",
    definition:
      "check ((((change_source = 'LEGACY_USER'::text) and (changed_by is not null) and (previous_status = any (array['ACTIVE'::text, 'TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text])) and (next_status = any (array['ACTIVE'::text, 'TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text]))) or ((change_source = 'SYSTEM_LIFECYCLE_MIGRATION'::text) and (changed_by is null) and (previous_status = any (array['TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text])) and (next_status = 'INACTIVE'::text)) or ((change_source = 'USER'::text) and (changed_by is not null) and (((previous_status = 'ACTIVE'::text) and (next_status = 'INACTIVE'::text)) or ((previous_status = 'INACTIVE'::text) and (next_status = any (array['ACTIVE'::text, 'DELETED'::text])))) and (planned_resume_date is null))))",
  },

  {
    table: "idempotency_records",
    name: "idempotency_records_completed_result_check",
    definition:
      "check (((status <> 'COMPLETED'::text) or ((completed_at is not null) and (resource_type is not null) and (resource_id is not null) and (audit_event_id is not null) and (result_snapshot is not null))))",
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
    definition: "check ((scope = any (array['IP'::text, 'ACCOUNT'::text])))",
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

const ROOM_LIFECYCLE_CHECK_CONSTRAINT_NAMES = new Set([
  "hotel_rooms_status_check",
  "hotel_rooms_room_number_canonical_check",
  "hotel_room_status_history_previous_status_check",
  "hotel_room_status_history_next_status_check",
  "hotel_room_status_history_source_shape",
]);

const ROOM_EXPAND_CHECK_CONSTRAINTS = [
  {
    table: "hotel_rooms",
    name: "hotel_rooms_status_check",
    definition:
      "check ((status = any (array['ACTIVE'::text, 'TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text])))",
  },
  {
    table: "hotel_rooms",
    name: "hotel_rooms_resume_shape",
    definition:
      "check (((status <> 'ACTIVE'::text) or (planned_resume_date is null)))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_previous_status_check",
    definition:
      "check ((previous_status = any (array['ACTIVE'::text, 'TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text])))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_next_status_check",
    definition:
      "check ((next_status = any (array['ACTIVE'::text, 'TEMP_SUSPENDED'::text, 'OUT_OF_SERVICE'::text])))",
  },
  {
    table: "hotel_room_status_history",
    name: "hotel_room_status_history_resume_shape",
    definition:
      "check (((next_status <> 'ACTIVE'::text) or (planned_resume_date is null)))",
  },
] as const;

const ROOM_EXPAND_UNIQUE_CONSTRAINT = {
  definition: "unique (company_id, branch_id, room_number)",
  name: "hotel_rooms_company_id_branch_id_room_number_key",
  table: "hotel_rooms",
} as const;

const ROOM_CONTRACT_INDEX_NAMES = new Set(["hotel_rooms_live_room_number_key"]);
const ROOM_CONTRACT_TRIGGER_NAMES = new Set([
  "hotel_rooms_deleted_immutable",
  "hotel_room_status_history_insert_guard",
]);

const REQUIRED_INDEXES = [
  {
    name: "branches_active_hotel_name_unique_idx",
    definition:
      "create unique index branches_active_hotel_name_unique_idx on public.branches using btree (company_id, lower(btrim(name))) where ((branch_type = 'HOTEL'::text) and (status = 'ACTIVE'::text))",
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
      "create unique index hotel_staff_assignments_active_primary_user_unique_idx on public.hotel_staff_assignments using btree (company_id, user_id) where ((end_date is null) and (assignment_type = 'PRIMARY'::text))",
  },
  {
    name: "hotel_staff_assignments_active_lookup_idx",
    definition:
      "create index hotel_staff_assignments_active_lookup_idx on public.hotel_staff_assignments using btree (company_id, user_id, assignment_type, start_date desc) include (branch_id) where (end_date is null)",
  },
  {
    name: "account_provisioning_attempts_active_user_unique_idx",
    definition:
      "create unique index account_provisioning_attempts_active_user_unique_idx on public.account_provisioning_attempts using btree (company_id, target_user_id) where (status = any (array['RESERVED_NOT_DISPATCHED'::text, 'DISPATCHED'::text, 'PROVIDER_CONFIRMED'::text, 'RECOVERY_REQUIRED'::text, 'COMPENSATION_REQUIRED'::text]))",
  },
  {
    name: "account_provisioning_recovery_idx",
    definition:
      "create index account_provisioning_recovery_idx on public.account_provisioning_attempts using btree (company_id, status, lease_expires_at, updated_at) where (status = any (array['RESERVED_NOT_DISPATCHED'::text, 'DISPATCHED'::text, 'PROVIDER_CONFIRMED'::text, 'RECOVERY_REQUIRED'::text, 'COMPENSATION_REQUIRED'::text, 'OPERATOR_REQUIRED'::text]))",
  },
  {
    name: "initial_password_change_attempts_active_user_unique_idx",
    definition:
      "create unique index initial_password_change_attempts_active_user_unique_idx on public.initial_password_change_attempts using btree (company_id, user_id) where (status = any (array['RESERVED_NOT_DISPATCHED'::text, 'DISPATCHED'::text, 'PROVIDER_UPDATED'::text, 'RECOVERY_REQUIRED'::text]))",
  },
  {
    name: "account_provider_outbox_ready_idx",
    definition:
      "create index account_provider_outbox_ready_idx on public.outbox_jobs using btree (company_id, status, available_at, created_at) where ((job_type = any (array['ACCOUNT_PROVIDER_DEACTIVATE'::text, 'ACCOUNT_PROVIDER_COMPENSATE'::text])) and (status = any (array['PENDING'::text, 'FAILED'::text, 'PROCESSING'::text])))",
  },
  {
    name: "hotel_room_types_scope_list_idx",
    definition:
      "create index hotel_room_types_scope_list_idx on public.hotel_room_types using btree (company_id, branch_id, is_active, display_order, normalized_name)",
  },
  {
    name: "hotel_rooms_hotel_list_idx",
    definition:
      "create index hotel_rooms_hotel_list_idx on public.hotel_rooms using btree (company_id, branch_id, floor_sort_key, room_number, id)",
  },
  {
    name: "hotel_rooms_hotel_status_idx",
    definition:
      "create index hotel_rooms_hotel_status_idx on public.hotel_rooms using btree (company_id, branch_id, status, floor_sort_key, room_number)",
  },
  {
    name: "hotel_rooms_live_room_number_key",
    definition:
      "create unique index hotel_rooms_live_room_number_key on public.hotel_rooms using btree (company_id, branch_id, room_number) where (status <> 'DELETED'::text)",
  },
  {
    name: "hotel_room_status_history_room_idx",
    definition:
      "create index hotel_room_status_history_room_idx on public.hotel_room_status_history using btree (company_id, branch_id, room_id, changed_at desc)",
  },
] as const;

const LOGIN_ID_TARGET_HISTORY_INDEX = {
  name: "login_id_registry_company_target_history_idx",
  definition:
    "create index login_id_registry_company_target_history_idx on public.login_id_registry using btree (company_id, target_user_id, claimed_at desc, login_id)",
} as const;

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
  "hotel_room_status_history:INSERT",
  "hotel_room_status_history:SELECT",
  "hotel_room_types:INSERT",
  "hotel_room_types:SELECT",
  "hotel_rooms:INSERT",
  "hotel_rooms:SELECT",
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
  "hotel_file_finalizer_capabilities:SELECT",
  "hotel_file_links:SELECT",
  "hotel_file_uploads:SELECT",
  "hotel_file_versions:SELECT",
  "hotel_inspections:SELECT",
  "hotel_process_defaults:SELECT",
  "inspection_checklist_item_exclusions:SELECT",
  "inspection_checklist_items:SELECT",
  "inspection_checklist_revisions:SELECT",
  "inspection_item_result_history:SELECT",
  "inspection_item_results:SELECT",
  "inspection_item_snapshots:SELECT",
  "inspection_routine_revisions:SELECT",
  "inspection_routine_rounds:SELECT",
  "inspection_routines:SELECT",
  "process_definition_revisions:SELECT",
  "process_definitions:SELECT",
  "process_execution_history:SELECT",
  "process_executions:SELECT",
  "process_stage_snapshots:SELECT",
  "process_transition_snapshots:SELECT",
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
  "hotel_file_finalizer_capabilities:SELECT",
] as const;

const HOTEL_INSPECTION_CONTRACT_TABLES = new Set([
  "hotel_file_finalizer_capabilities",
  "hotel_file_links",
  "hotel_file_uploads",
  "hotel_file_versions",
  "hotel_inspections",
  "hotel_process_defaults",
  "inspection_checklist_item_exclusions",
  "inspection_checklist_items",
  "inspection_checklist_revisions",
  "inspection_item_result_history",
  "inspection_item_results",
  "inspection_item_snapshots",
  "inspection_routine_revisions",
  "inspection_routine_rounds",
  "inspection_routines",
  "process_definition_revisions",
  "process_definitions",
  "process_execution_history",
  "process_executions",
  "process_stage_snapshots",
  "process_transition_snapshots",
]);

const EXPECTED_API_RUNTIME_EXPAND_COLUMN_PRIVILEGES = [
  "branches:updated_at:UPDATE",
  "hotel_profiles:updated_at:UPDATE",
  "hotel_profiles:version:UPDATE",
  "hotel_room_types:display_order:UPDATE",
  "hotel_room_types:is_active:UPDATE",
  "hotel_room_types:name:UPDATE",
  "hotel_room_types:updated_at:UPDATE",
  "hotel_room_types:updated_by:UPDATE",
  "hotel_room_types:version:UPDATE",
  "hotel_rooms:floor_label:UPDATE",
  "hotel_rooms:floor_sort_key:UPDATE",
  "hotel_rooms:internal_note:UPDATE",
  "hotel_rooms:owner_visible_note:UPDATE",
  "hotel_rooms:planned_resume_date:UPDATE",
  "hotel_rooms:room_number:UPDATE",
  "hotel_rooms:room_type_id:UPDATE",
  "hotel_rooms:status:UPDATE",
  "hotel_rooms:updated_at:UPDATE",
  "hotel_rooms:updated_by:UPDATE",
  "hotel_rooms:version:UPDATE",
  "hotel_owner_assignments:end_date:UPDATE",
  "hotel_owner_assignments:terminated_at:UPDATE",
  "hotel_owner_assignments:terminated_by:UPDATE",
  "hotel_owner_assignments:termination_reason:UPDATE",
  "hotel_owner_assignments:updated_at:UPDATE",
  "hotel_owner_assignments:version:UPDATE",
  "hotel_staff_assignments:end_date:UPDATE",
  "hotel_staff_assignments:terminated_at:UPDATE",
  "hotel_staff_assignments:terminated_by:UPDATE",
  "hotel_staff_assignments:termination_reason:UPDATE",
  "hotel_staff_assignments:updated_at:UPDATE",
  "hotel_staff_assignments:version:UPDATE",
  "housekeeping_hotel_links:end_date:UPDATE",
  "housekeeping_hotel_links:terminated_at:UPDATE",
  "housekeeping_hotel_links:terminated_by:UPDATE",
  "housekeeping_hotel_links:termination_reason:UPDATE",
  "housekeeping_hotel_links:updated_at:UPDATE",
  "housekeeping_hotel_links:version:UPDATE",
] as const;

const EXPECTED_API_RUNTIME_IDENTITY_LOCK_COLUMN_PRIVILEGES = [
  "auth_identities:updated_at:UPDATE",
  ...EXPECTED_API_RUNTIME_EXPAND_COLUMN_PRIVILEGES,
] as const;

const EXPECTED_API_RUNTIME_CONTRACT_COLUMN_PRIVILEGES = [
  ...EXPECTED_API_RUNTIME_IDENTITY_LOCK_COLUMN_PRIVILEGES.filter(
    (label) => !label.startsWith("hotel_rooms:"),
  ),
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
  {
    name: "hotel_staff_assignments_no_delete",
    table: "hotel_staff_assignments",
    functionName: "reject_hotel_relationship_delete",
  },
  {
    name: "housekeeping_hotel_links_no_delete",
    table: "housekeeping_hotel_links",
    functionName: "reject_hotel_relationship_delete",
  },
  {
    name: "hotel_owner_assignments_no_delete",
    table: "hotel_owner_assignments",
    functionName: "reject_hotel_relationship_delete",
  },
  {
    name: "hotel_room_types_scope_immutable",
    table: "hotel_room_types",
    functionName: "reject_hotel_room_type_scope_change",
  },
  {
    name: "hotel_rooms_room_type_scope_guard",
    table: "hotel_rooms",
    functionName: "enforce_hotel_room_type_scope",
  },
  {
    name: "hotel_room_types_no_delete",
    table: "hotel_room_types",
    functionName: "reject_hotel_room_delete",
  },
  {
    name: "hotel_rooms_no_delete",
    table: "hotel_rooms",
    functionName: "reject_hotel_room_delete",
  },
  {
    name: "hotel_rooms_deleted_immutable",
    table: "hotel_rooms",
    functionName: "reject_deleted_hotel_room_change",
  },
  {
    name: "hotel_room_status_history_insert_guard",
    table: "hotel_room_status_history",
    functionName: "enforce_new_hotel_room_history_insert",
  },
  {
    name: "hotel_room_status_history_no_update",
    table: "hotel_room_status_history",
    functionName: "reject_hotel_room_history_change",
  },
  {
    name: "hotel_room_status_history_no_delete",
    table: "hotel_room_status_history",
    functionName: "reject_hotel_room_history_change",
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
  { policy: "hotel_room_types_company_isolation", table: "hotel_room_types" },
  { policy: "hotel_rooms_company_isolation", table: "hotel_rooms" },
  {
    policy: "hotel_room_status_history_company_isolation",
    table: "hotel_room_status_history",
  },
] as const;

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
    .replace(
      /__sql_literal_(\d+)__/gu,
      (_placeholder, index: string) => sqlLiterals[Number(index)] ?? "",
    );
}

function normalizeDefinition(value: string) {
  return normalizePolicyDefinition(value);
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
  const legacyBranch =
    schemaPhase === "EXPAND"
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
  ]
    .filter((fragment): fragment is string => fragment !== null)
    .join(" ");
  return normalized === expected;
}

export async function probeDatabaseReadiness(
  databaseUrl: string | undefined,
  options: {
    capability: RuntimeCapability;
    // Provisioning uses these as strict rollout gates. General Worker health
    // accepts any exact approved base/room phase combination during rollout.
    requiredRoomSchemaPhase?: "CONTRACT" | "EXPAND";
    requiredLoginIdHistoryPhase?: "CONTRACT" | "EXPAND";
    requiredInspectionProcessPhase?: "CONTRACT" | "EXPAND";
    requiredSchemaPhase?: "CONTRACT" | "EXPAND" | "EXPAND_IDENTITY_LOCK";
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
      {
        contract_marker_count: number;
        expand_marker_count: number;
        hotel_integrity_marker_count: number;
        hotel_relationship_marker_count: number;
        hotel_support_overlap_marker_count: number;
        hotel_room_marker_count: number;
        hotel_room_contract_marker_count: number;
        hotel_room_lifecycle_marker_count: number;
        hotel_inspection_process_marker_count: number;
        hotel_file_finalizer_recovery_marker_count: number;
        hotel_process_default_read_marker_count: number;
        hotel_process_reviewer_candidates_marker_count: number;
        hotel_inspection_routine_marker_count: number;
        hotel_inspection_execution_marker_count: number;
        login_id_history_contract_marker_count: number;
      }[]
    >`
      select count(*) filter (
               where version in (
                 '0001_platform_foundation',
                 '0002_auth_session_runtime',
                 '0003_hotel_basic_information',
                 '0004_custom_login_security',
                 '0005_auth_session_definer',
                 '0006_account_administration',
                 '0007_api_tenant_authority_expand',
                 '0009_global_login_id_expand',
                 '0011_account_provider_exact_dispatch',
                 '0013_neon_definer_creator_membership',
                 '0014_neon_definer_expand_compatibility'
               )
             )::integer as expand_marker_count,
             count(*) filter (
               where version in (
                 '0008_remove_legacy_company_id_fallback',
                 '0010_global_login_id_contract',
                 '0012_account_provider_exact_dispatch_contract',
                 '0015_neon_definer_contract_hardening'
               )
             )::integer as contract_marker_count,
             count(*) filter (
               where version = '0016_hotel_relationship_management'
             )::integer as hotel_relationship_marker_count,
             count(*) filter (
               where version = '0017_hotel_relationship_integrity_hardening'
             )::integer as hotel_integrity_marker_count,
             count(*) filter (
               where version = '0018_hotel_support_assignment_overlap'
             )::integer as hotel_support_overlap_marker_count,
             count(*) filter (
               where version = '0019_hotel_room_management'
             )::integer as hotel_room_marker_count,
             count(*) filter (
               where version = '0022_hotel_room_contract_hardening'
             )::integer as hotel_room_contract_marker_count,
             count(*) filter (
               where version = '0023_login_id_registry_history_contract'
             )::integer as login_id_history_contract_marker_count,
             count(*) filter (
               where version = '0025_hotel_room_reference_lifecycle'
             )::integer as hotel_room_lifecycle_marker_count,
             count(*) filter (
               where version = '0026_hotel_inspection_process_and_files'
             )::integer as hotel_inspection_process_marker_count,
             count(*) filter (
               where version = '0027_hotel_file_finalizer_recovery'
             )::integer as hotel_file_finalizer_recovery_marker_count,
             count(*) filter (
               where version = '0028_hotel_process_default_read_contract'
             )::integer as hotel_process_default_read_marker_count,
             count(*) filter (
               where version = '0029_hotel_process_reviewer_candidates'
             )::integer as hotel_process_reviewer_candidates_marker_count,
             count(*) filter (
               where version = '0030_hotel_inspection_routine_contract'
             )::integer as hotel_inspection_routine_marker_count,
             count(*) filter (
               where version = '0031_hotel_inspection_execution_contract'
             )::integer as hotel_inspection_execution_marker_count
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
        '0013_neon_definer_creator_membership',
        '0014_neon_definer_expand_compatibility',
        '0015_neon_definer_contract_hardening',
        '0016_hotel_relationship_management',
        '0017_hotel_relationship_integrity_hardening',
        '0018_hotel_support_assignment_overlap',
        '0019_hotel_room_management',
        '0022_hotel_room_contract_hardening',
        '0023_login_id_registry_history_contract',
        '0025_hotel_room_reference_lifecycle',
        '0026_hotel_inspection_process_and_files',
        '0027_hotel_file_finalizer_recovery',
        '0028_hotel_process_default_read_contract',
        '0029_hotel_process_reviewer_candidates',
        '0030_hotel_inspection_routine_contract',
        '0031_hotel_inspection_execution_contract'
      )
    `;
    const schemaPhase =
      migrationRows[0]?.expand_marker_count === 11 &&
      migrationRows[0].contract_marker_count === 4
        ? "CONTRACT"
        : migrationRows[0]?.expand_marker_count === 11 &&
            migrationRows[0].contract_marker_count === 0
          ? "EXPAND"
          : null;
    const roomSchemaPhase =
      migrationRows[0]?.hotel_room_marker_count === 1 &&
      migrationRows[0].hotel_room_contract_marker_count === 1 &&
      migrationRows[0].hotel_room_lifecycle_marker_count === 1
        ? "CONTRACT"
        : migrationRows[0]?.hotel_room_marker_count === 1 &&
            migrationRows[0].hotel_room_contract_marker_count >= 0 &&
            migrationRows[0].hotel_room_contract_marker_count <= 1 &&
            migrationRows[0].hotel_room_lifecycle_marker_count === 0
          ? "EXPAND"
          : null;
    const roomPolicyPhase =
      migrationRows[0]?.hotel_room_contract_marker_count === 1
        ? "CONTRACT"
        : migrationRows[0]?.hotel_room_contract_marker_count === 0
          ? "EXPAND"
          : null;
    const loginIdHistoryPhase =
      migrationRows[0]?.login_id_history_contract_marker_count === 1
        ? "CONTRACT"
        : migrationRows[0]?.login_id_history_contract_marker_count === 0
          ? "EXPAND"
          : null;
    const inspectionProcessPhase =
      migrationRows[0]?.hotel_inspection_process_marker_count === 1 &&
      migrationRows[0].hotel_file_finalizer_recovery_marker_count === 1 &&
      migrationRows[0].hotel_process_default_read_marker_count === 1 &&
      migrationRows[0].hotel_process_reviewer_candidates_marker_count === 1 &&
      migrationRows[0].hotel_inspection_routine_marker_count === 1 &&
      migrationRows[0].hotel_inspection_execution_marker_count === 1
        ? "CONTRACT"
        : migrationRows[0]?.hotel_inspection_process_marker_count === 0 &&
            migrationRows[0].hotel_file_finalizer_recovery_marker_count === 0 &&
            migrationRows[0].hotel_process_default_read_marker_count === 0 &&
            migrationRows[0].hotel_process_reviewer_candidates_marker_count ===
              0 &&
            migrationRows[0].hotel_inspection_routine_marker_count === 0
          ? "EXPAND"
          : null;
    if (
      !schemaPhase ||
      !roomSchemaPhase ||
      !roomPolicyPhase ||
      !loginIdHistoryPhase ||
      !inspectionProcessPhase ||
      (inspectionProcessPhase === "CONTRACT" &&
        !columns.has("inspection_routine_revisions.checklist_revision_id")) ||
      (inspectionProcessPhase === "EXPAND" &&
        columns.has("inspection_routine_revisions.checklist_revision_id")) ||
      (roomSchemaPhase === "EXPAND" &&
        !columns.has("hotel_rooms.planned_resume_date")) ||
      (roomSchemaPhase === "CONTRACT" &&
        columns.has("hotel_rooms.planned_resume_date")) ||
      (roomSchemaPhase === "EXPAND" &&
        columns.has("hotel_room_status_history.change_source")) ||
      (roomSchemaPhase === "CONTRACT" &&
        !columns.has("hotel_room_status_history.change_source")) ||
      (roomSchemaPhase === "CONTRACT" && schemaPhase !== "CONTRACT") ||
      (loginIdHistoryPhase === "CONTRACT" && schemaPhase !== "CONTRACT") ||
      (options.requiredInspectionProcessPhase !== undefined &&
        inspectionProcessPhase !== options.requiredInspectionProcessPhase) ||
      (options.requiredRoomSchemaPhase !== undefined &&
        roomSchemaPhase !== options.requiredRoomSchemaPhase) ||
      (options.requiredLoginIdHistoryPhase !== undefined &&
        loginIdHistoryPhase !== options.requiredLoginIdHistoryPhase) ||
      migrationRows[0]?.hotel_relationship_marker_count !== 1 ||
      migrationRows[0].hotel_integrity_marker_count !== 1 ||
      migrationRows[0].hotel_support_overlap_marker_count !== 1
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (roomSchemaPhase === "CONTRACT") {
      const [roomCommand] = await sql<
        {
          executable: boolean;
          execute_acl_safe: boolean;
          grantable_execute_count: number;
          metadata_safe: boolean;
          name_unique: boolean;
          owner_safe: boolean;
          public_execute: boolean;
          return_signature_safe: boolean;
          source: string;
        }[]
      >`
        select has_function_privilege(
                 current_user, procedure_record.oid, 'EXECUTE'
               ) as executable,
               procedure_record.prosrc as source,
               pg_get_function_result(procedure_record.oid) =
                 'TABLE(command_status text, result_snapshot jsonb)'
                 as return_signature_safe,
               procedure_record.prosecdef
                 and procedure_language.lanname = 'plpgsql'
                 and procedure_record.provolatile = 'v'
                 and procedure_record.proparallel = 'u'
                 and not procedure_record.proleakproof
                 and procedure_record.proconfig = array['search_path=pg_catalog']::text[]
                 and pg_get_function_identity_arguments(procedure_record.oid) =
                   'p_company_id uuid, p_branch_id uuid, p_room_id uuid, p_expected_version integer, p_next_status text, p_reason text, p_history_id uuid, p_audit_event_id uuid, p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text, p_operation_path text, p_request_hash text, p_session_token text, p_trace_id uuid'
                 as metadata_safe,
               procedure_record.proowner = migration_table.relowner as owner_safe,
               (
                 select pg_catalog.count(*) = 1
                   from pg_proc named_procedure
                   join pg_namespace named_namespace
                     on named_namespace.oid = named_procedure.pronamespace
                  where named_namespace.nspname = 'public'
                    and named_procedure.proname =
                      'hotel_room_lifecycle_command_v1'
               ) as name_unique,
               (
                 not exists (
                   select 1
                     from aclexplode(coalesce(
                       procedure_record.proacl,
                       acldefault('f', procedure_record.proowner)
                     )) actual_acl
                    where actual_acl.privilege_type = 'EXECUTE'
                      and actual_acl.grantee <> procedure_record.proowner
                      and (
                        actual_acl.is_grantable
                        or not exists (
                          select 1
                            from runtime_database_capabilities capability_record
                            join pg_roles capability_role
                              on capability_role.rolname = capability_record.role_name
                           where capability_record.capability = 'API_RUNTIME'
                             and capability_role.oid = actual_acl.grantee
                             and capability_role.oid <> procedure_record.proowner
                        )
                      )
                 )
                 and not exists (
                   select 1
                     from runtime_database_capabilities capability_record
                     join pg_roles capability_role
                       on capability_role.rolname = capability_record.role_name
                    where capability_record.capability = 'API_RUNTIME'
                      and capability_role.oid <> procedure_record.proowner
                      and not exists (
                        select 1
                          from aclexplode(coalesce(
                            procedure_record.proacl,
                            acldefault('f', procedure_record.proowner)
                          )) actual_acl
                         where actual_acl.privilege_type = 'EXECUTE'
                           and actual_acl.grantee = capability_role.oid
                           and not actual_acl.is_grantable
                      )
                 )
               ) as execute_acl_safe,
               exists (
                 select 1 from aclexplode(coalesce(
                   procedure_record.proacl,
                   acldefault('f', procedure_record.proowner)
                 )) acl
                 where acl.privilege_type = 'EXECUTE' and acl.grantee = 0::oid
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
               ) as grantable_execute_count
          from pg_proc procedure_record
          join pg_namespace procedure_namespace
            on procedure_namespace.oid = procedure_record.pronamespace
          join pg_language procedure_language
            on procedure_language.oid = procedure_record.prolang
          join pg_class migration_table
            on migration_table.relname = 'schema_migrations'
          join pg_namespace migration_namespace
            on migration_namespace.oid = migration_table.relnamespace
         where procedure_namespace.nspname = 'public'
           and migration_namespace.nspname = 'public'
           and procedure_record.oid = pg_catalog.to_regprocedure(
             'public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)'
           )
      `;
      if (
        !roomCommand?.metadata_safe ||
        !roomCommand.owner_safe ||
        !roomCommand.return_signature_safe ||
        !roomCommand.name_unique ||
        !roomCommand.execute_acl_safe ||
        roomCommand.public_execute ||
        roomCommand.grantable_execute_count !== 0 ||
        roomCommand.executable !== (options.capability === "API_RUNTIME") ||
        (await sourceSha256(roomCommand.source)) !==
          HOTEL_ROOM_LIFECYCLE_COMMAND_V1_PROSRC_SHA256
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
      const [roomWriteCommand] = await sql<
        {
          executable: boolean;
          execute_acl_safe: boolean;
          grantable_execute_count: number;
          metadata_safe: boolean;
          name_unique: boolean;
          owner_safe: boolean;
          public_execute: boolean;
          return_signature_safe: boolean;
          source: string;
        }[]
      >`
        select has_function_privilege(
                 current_user, procedure_record.oid, 'EXECUTE'
               ) as executable,
               procedure_record.prosrc as source,
               pg_get_function_result(procedure_record.oid) =
                 'TABLE(command_status text, result_snapshot jsonb)'
                 as return_signature_safe,
               procedure_record.prosecdef
                 and procedure_language.lanname = 'plpgsql'
                 and procedure_record.provolatile = 'v'
                 and procedure_record.proparallel = 'u'
                 and not procedure_record.proleakproof
                 and procedure_record.proconfig = array['search_path=pg_catalog']::text[]
                 and pg_get_function_identity_arguments(procedure_record.oid) =
                   'p_company_id uuid, p_branch_id uuid, p_room_id uuid, p_action text, p_expected_version integer, p_value jsonb, p_audit_event_id uuid, p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text, p_operation_path text, p_request_hash text, p_session_token text, p_trace_id uuid'
                 as metadata_safe,
               procedure_record.proowner = migration_table.relowner as owner_safe,
               (
                 select pg_catalog.count(*) = 1
                   from pg_proc named_procedure
                   join pg_namespace named_namespace
                     on named_namespace.oid = named_procedure.pronamespace
                  where named_namespace.nspname = 'public'
                    and named_procedure.proname =
                      'hotel_room_write_command_v1'
               ) as name_unique,
               (
                 not exists (
                   select 1
                     from aclexplode(coalesce(
                       procedure_record.proacl,
                       acldefault('f', procedure_record.proowner)
                     )) actual_acl
                    where actual_acl.privilege_type = 'EXECUTE'
                      and actual_acl.grantee <> procedure_record.proowner
                      and (
                        actual_acl.is_grantable
                        or not exists (
                          select 1
                            from runtime_database_capabilities capability_record
                            join pg_roles capability_role
                              on capability_role.rolname = capability_record.role_name
                           where capability_record.capability = 'API_RUNTIME'
                             and capability_role.oid = actual_acl.grantee
                             and capability_role.oid <> procedure_record.proowner
                        )
                      )
                 )
                 and not exists (
                   select 1
                     from runtime_database_capabilities capability_record
                     join pg_roles capability_role
                       on capability_role.rolname = capability_record.role_name
                    where capability_record.capability = 'API_RUNTIME'
                      and capability_role.oid <> procedure_record.proowner
                      and not exists (
                        select 1
                          from aclexplode(coalesce(
                            procedure_record.proacl,
                            acldefault('f', procedure_record.proowner)
                          )) actual_acl
                         where actual_acl.privilege_type = 'EXECUTE'
                           and actual_acl.grantee = capability_role.oid
                           and not actual_acl.is_grantable
                      )
                 )
               ) as execute_acl_safe,
               exists (
                 select 1 from aclexplode(coalesce(
                   procedure_record.proacl,
                   acldefault('f', procedure_record.proowner)
                 )) acl
                 where acl.privilege_type = 'EXECUTE' and acl.grantee = 0::oid
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
               ) as grantable_execute_count
          from pg_proc procedure_record
          join pg_namespace procedure_namespace
            on procedure_namespace.oid = procedure_record.pronamespace
          join pg_language procedure_language
            on procedure_language.oid = procedure_record.prolang
          join pg_class migration_table
            on migration_table.relname = 'schema_migrations'
          join pg_namespace migration_namespace
            on migration_namespace.oid = migration_table.relnamespace
         where procedure_namespace.nspname = 'public'
           and migration_namespace.nspname = 'public'
           and procedure_record.oid = pg_catalog.to_regprocedure(
             'public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid)'
           )
      `;
      if (
        !roomWriteCommand?.metadata_safe ||
        !roomWriteCommand.owner_safe ||
        !roomWriteCommand.return_signature_safe ||
        !roomWriteCommand.name_unique ||
        !roomWriteCommand.execute_acl_safe ||
        roomWriteCommand.public_execute ||
        roomWriteCommand.grantable_execute_count !== 0 ||
        roomWriteCommand.executable !==
          (options.capability === "API_RUNTIME") ||
        (await sourceSha256(roomWriteCommand.source)) !==
          HOTEL_ROOM_WRITE_COMMAND_V1_PROSRC_SHA256
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
    } else {
      const [legacyRoomCommand] = await sql<
        { exists: boolean; write_exists: boolean }[]
      >`
        select to_regprocedure(
          'public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)'
        ) is not null as exists,
        to_regprocedure(
          'public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid)'
        ) is not null as write_exists
      `;
      if (
        !legacyRoomCommand ||
        legacyRoomCommand.exists ||
        legacyRoomCommand.write_exists
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
    }
    if (inspectionProcessPhase === "CONTRACT") {
      const [inspectionTables] = await sql<
        {
          direct_mutation_acl_count: number;
          force_rls_count: number;
          owner_safe_count: number;
          rls_count: number;
          table_count: number;
        }[]
      >`
        select count(*)::integer as table_count,
               count(*) filter (where table_record.relrowsecurity)::integer as rls_count,
               count(*) filter (where table_record.relforcerowsecurity)::integer as force_rls_count,
               count(*) filter (
                 where table_record.relowner = migration_table.relowner
               )::integer as owner_safe_count,
               (
                 select count(*)::integer
                   from pg_catalog.pg_class protected_table
                   join pg_catalog.pg_namespace protected_namespace
                     on protected_namespace.oid = protected_table.relnamespace
                   cross join lateral pg_catalog.aclexplode(coalesce(
                     protected_table.relacl,
                     pg_catalog.acldefault('r'::"char", protected_table.relowner)
                   )) acl
                   join pg_catalog.pg_roles grantee_role
                     on grantee_role.oid = acl.grantee
                   join public.runtime_database_capabilities capability
                     on capability.role_name = grantee_role.rolname
                  where protected_namespace.nspname = 'public'
                    and protected_table.relname in (
                      'process_definitions', 'process_definition_revisions',
                      'process_stage_snapshots', 'process_transition_snapshots',
                      'hotel_process_defaults', 'process_executions',
                      'process_execution_history', 'inspection_checklist_revisions',
                      'inspection_checklist_items', 'inspection_checklist_item_exclusions',
                      'inspection_routines', 'inspection_routine_revisions',
                      'inspection_routine_rounds', 'hotel_inspections',
                      'inspection_item_snapshots', 'inspection_item_results',
                      'inspection_item_result_history', 'hotel_file_uploads',
                      'hotel_file_scan_jobs', 'hotel_file_versions', 'hotel_file_links'
                    )
                    and acl.grantee <> protected_table.relowner
                    and acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
               ) as direct_mutation_acl_count
          from pg_catalog.pg_class table_record
          join pg_catalog.pg_namespace table_namespace
            on table_namespace.oid = table_record.relnamespace
          join pg_catalog.pg_class migration_table
            on migration_table.relname = 'schema_migrations'
          join pg_catalog.pg_namespace migration_namespace
            on migration_namespace.oid = migration_table.relnamespace
         where table_namespace.nspname = 'public'
           and migration_namespace.nspname = 'public'
           and table_record.relkind in ('r', 'p')
           and table_record.relname in (
             'process_definitions', 'process_definition_revisions',
             'process_stage_snapshots', 'process_transition_snapshots',
             'hotel_process_defaults', 'process_executions',
             'process_execution_history', 'inspection_checklist_revisions',
             'inspection_checklist_items', 'inspection_checklist_item_exclusions',
             'inspection_routines', 'inspection_routine_revisions',
             'inspection_routine_rounds', 'hotel_inspections',
             'inspection_item_snapshots', 'inspection_item_results',
             'inspection_item_result_history', 'hotel_file_uploads',
             'hotel_file_scan_jobs', 'hotel_file_versions', 'hotel_file_links'
           )
      `;
      if (
        inspectionTables?.table_count !== 21 ||
        inspectionTables.rls_count !== 21 ||
        inspectionTables.force_rls_count !== 21 ||
        inspectionTables.owner_safe_count !== 21 ||
        inspectionTables.direct_mutation_acl_count !== 0
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
      for (const contract of HOTEL_INSPECTION_COMMAND_CONTRACTS) {
        const [command] = await sql<
          {
            executable: boolean;
            execute_acl_safe: boolean;
            metadata_safe: boolean;
            name_unique: boolean;
            owner_safe: boolean;
            public_execute: boolean;
            return_signature: string;
            source: string;
          }[]
        >`
          select has_function_privilege(current_user, procedure_record.oid, 'EXECUTE')
                   as executable,
                 procedure_record.prosecdef
                   and procedure_language.lanname = 'plpgsql'
                   and procedure_record.provolatile = 'v'
                   and procedure_record.proparallel = 'u'
                   and not procedure_record.proleakproof
                   and procedure_record.proconfig = array['search_path=pg_catalog']::text[]
                   as metadata_safe,
                 pg_catalog.pg_get_function_result(procedure_record.oid)
                   as return_signature,
                 procedure_record.prosrc as source,
                 procedure_record.proowner = migration_table.relowner as owner_safe,
                 (
                   select count(*) = 1 from pg_catalog.pg_proc named_procedure
                   join pg_catalog.pg_namespace named_namespace
                     on named_namespace.oid = named_procedure.pronamespace
                   where named_namespace.nspname = 'public'
                     and named_procedure.proname = ${contract.name}
                 ) as name_unique,
                 exists (
                   select 1 from pg_catalog.aclexplode(coalesce(
                     procedure_record.proacl,
                     pg_catalog.acldefault('f'::"char", procedure_record.proowner)
                   )) acl
                   where acl.privilege_type = 'EXECUTE' and acl.grantee = 0::oid
                 ) as public_execute,
                 (
                   not exists (
                     select 1 from pg_catalog.aclexplode(coalesce(
                       procedure_record.proacl,
                       pg_catalog.acldefault('f'::"char", procedure_record.proowner)
                     )) acl
                     left join pg_catalog.pg_roles grantee_role
                       on grantee_role.oid = acl.grantee
                     left join public.runtime_database_capabilities capability
                       on capability.role_name = grantee_role.rolname
                     where acl.privilege_type = 'EXECUTE'
                       and acl.grantee <> procedure_record.proowner
                       and (acl.is_grantable or capability.capability is distinct from ${contract.capability})
                   )
                   and not exists (
                     select 1 from public.runtime_database_capabilities capability
                     join pg_catalog.pg_roles capability_role
                       on capability_role.rolname = capability.role_name
                     where capability.capability = ${contract.capability}
                       and capability_role.oid <> procedure_record.proowner
                       and not exists (
                         select 1 from pg_catalog.aclexplode(coalesce(
                           procedure_record.proacl,
                           pg_catalog.acldefault('f'::"char", procedure_record.proowner)
                         )) acl
                         where acl.privilege_type = 'EXECUTE'
                           and acl.grantee = capability_role.oid
                           and not acl.is_grantable
                       )
                   )
                 ) as execute_acl_safe
            from pg_catalog.pg_proc procedure_record
            join pg_catalog.pg_namespace procedure_namespace
              on procedure_namespace.oid = procedure_record.pronamespace
            join pg_catalog.pg_language procedure_language
              on procedure_language.oid = procedure_record.prolang
            join pg_catalog.pg_class migration_table
              on migration_table.relname = 'schema_migrations'
            join pg_catalog.pg_namespace migration_namespace
              on migration_namespace.oid = migration_table.relnamespace
           where procedure_namespace.nspname = 'public'
             and migration_namespace.nspname = 'public'
             and procedure_record.oid = pg_catalog.to_regprocedure(${contract.signature})
        `;
        if (
          !command?.metadata_safe ||
          !command.owner_safe ||
          !command.name_unique ||
          command.public_execute ||
          !command.execute_acl_safe ||
          command.return_signature !== contract.result ||
          command.executable !== (options.capability === contract.capability) ||
          (await sourceSha256(command.source)) !== contract.digest
        ) {
          return { status: "SCHEMA_NOT_READY" };
        }
      }

      const [finalizerCapability] = await sql<{ exact: boolean }[]>`
        select not exists (
          select 1 from public.hotel_file_finalizer_capabilities finalizer
          left join public.runtime_database_capabilities capability
            on capability.role_name = finalizer.role_name
           and capability.capability = 'RECONCILER'
          where capability.role_name is null
        ) and not exists (
          select 1 from public.runtime_database_capabilities capability
          join pg_catalog.pg_roles capability_role
            on capability_role.rolname = capability.role_name
          where capability.capability = 'RECONCILER'
            and capability_role.oid <> (
              select table_record.relowner
                from pg_catalog.pg_class table_record
                join pg_catalog.pg_namespace table_namespace
                  on table_namespace.oid = table_record.relnamespace
               where table_namespace.nspname = 'public'
                 and table_record.relname = 'schema_migrations'
            )
            and not exists (
              select 1 from public.hotel_file_finalizer_capabilities finalizer
               where finalizer.role_name = capability.role_name
            )
        ) as exact
      `;
      if (!finalizerCapability?.exact) return { status: "SCHEMA_NOT_READY" };
    }
    if (loginIdHistoryPhase === "CONTRACT") {
      const operationColumns = await sql<
        {
          default_expression: string | null;
          name: string;
          not_null: boolean;
          ordinal_position: number;
          type: string;
        }[]
      >`
        select column_record.attnum::integer as ordinal_position,
               column_record.attname as name,
               pg_catalog.format_type(
                 column_record.atttypid,
                 column_record.atttypmod
               ) as type,
               column_record.attnotnull as not_null,
               pg_catalog.pg_get_expr(
                 default_record.adbin,
                 default_record.adrelid
               ) as default_expression
        from pg_catalog.pg_attribute column_record
        join pg_catalog.pg_class table_record
          on table_record.oid = column_record.attrelid
        join pg_catalog.pg_namespace table_namespace
          on table_namespace.oid = table_record.relnamespace
        left join pg_catalog.pg_attrdef default_record
          on default_record.adrelid = column_record.attrelid
         and default_record.adnum = column_record.attnum
        where table_namespace.nspname = 'public'
          and table_record.relname = 'preview_bootstrap_operations'
          and table_record.relkind in ('r', 'p')
          and column_record.attnum > 0
          and not column_record.attisdropped
        order by column_record.attnum
      `;
      if (
        operationColumns.length !== LOGIN_ID_HISTORY_REQUIRED_COLUMNS.length ||
        LOGIN_ID_HISTORY_REQUIRED_COLUMNS.some((required, index) => {
          const actual = operationColumns[index];
          return (
            actual?.ordinal_position !== index + 1 ||
            actual.name !== required.name ||
            actual.type !== required.type ||
            actual.not_null !== required.notNull ||
            actual.default_expression !== required.default
          );
        })
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
    }
    if (
      HOTEL_RELATIONSHIP_REQUIRED_COLUMNS.some(
        ([table, column]) => !columns.has(`${table}.${column}`),
      )
    )
      return { status: "SCHEMA_NOT_READY" };
    const [hotelPermissionCatalog] = await sql<{ count: number }[]>`
      select count(*)::integer as count from permissions
      where code in (
        'HOTEL_ASSIGNMENT_MANAGE', 'HOTEL_OWNER_MANAGE', 'HOTEL_STATUS_MANAGE',
        'HOTEL_PERMISSION_MANAGE', 'HOTEL_ROOM_READ', 'HOTEL_ROOM_MANAGE',
        'HOTEL_ROOM_TYPE_MANAGE', 'PROCESS_DEFINITION_MANAGE',
        'HOTEL_INSPECTION_CONFIG', 'HOTEL_INSPECTION_RUN',
        'HOTEL_INSPECTION_REVIEW', 'HOTEL_FILE_UPLOAD',
        'HOTEL_FILE_READ', 'HOTEL_FILE_DOWNLOAD'
      )
    `;
    if (
      hotelPermissionCatalog?.count !==
      (inspectionProcessPhase === "CONTRACT" ? 14 : 7)
    )
      return { status: "SCHEMA_NOT_READY" };

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
               when procedure_record.proname = 'auth_revoke_hotel_owner_sessions_v1' then
                pg_get_function_result(procedure_record.oid) = 'integer'
                and function_language.lanname = 'plpgsql'
                and procedure_record.provolatile = 'v'
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
          or
          (procedure_record.proname = 'auth_revoke_hotel_owner_sessions_v1'
            and pg_get_function_identity_arguments(procedure_record.oid)
              = 'p_company_id uuid, p_user_id uuid')
        )
    `;
    const expectedAuthSupportDigests = new Map([
      [
        "auth_resolve_login_identity_v1",
        AUTH_RESOLVE_LOGIN_IDENTITY_V1_PROSRC_SHA256,
      ],
      ["auth_resolve_principal_v2", AUTH_RESOLVE_PRINCIPAL_V2_PROSRC_SHA256],
      ["auth_revoke_session_v2", AUTH_REVOKE_SESSION_V2_PROSRC_SHA256],
      [
        "auth_revoke_hotel_owner_sessions_v1",
        AUTH_REVOKE_HOTEL_OWNER_SESSIONS_V1_PROSRC_SHA256,
      ],
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
      const expectedDigest =
        helper.function_name === "runtime_is_schema_owner" &&
        schemaPhase === "EXPAND"
          ? RUNTIME_IS_SCHEMA_OWNER_EXPAND_PROSRC_SHA256
          : TENANT_AUTHORITY_PROSRC_SHA256.get(helper.function_name);
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
    const currentOnlySchemaPrivileges = new Set(["CURRENT:USAGE"]);
    const expandSchemaPrivileges = new Set(["CURRENT:USAGE", "PUBLIC:USAGE"]);
    const actualSchemaPrivileges = new Set(
      schemaPrivilegeRows.map((row) => row.label),
    );
    const matchesSchemaPrivileges = (expected: Set<string>) =>
      schemaPrivilegeRows.length === expected.size &&
      actualSchemaPrivileges.size === expected.size &&
      schemaPrivilegeRows.every(
        (row) => !row.grantable && expected.has(row.label),
      );
    const observedSchemaAclPhase = matchesSchemaPrivileges(
      expandSchemaPrivileges,
    )
      ? "EXPAND"
      : matchesSchemaPrivileges(currentOnlySchemaPrivileges)
        ? "CONTRACT"
        : null;
    if (!observedSchemaAclPhase) {
      return { status: "SCHEMA_NOT_READY" };
    }
    const publicSchemaUsageAllowed = observedSchemaAclPhase === "EXPAND";

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
            (acl.grantee = 0::oid and ${publicSchemaUsageAllowed})
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
    const expandRoomNumberConstraint = constraints.find(
      (constraint) =>
        constraint.table === ROOM_EXPAND_UNIQUE_CONSTRAINT.table &&
        constraint.name === ROOM_EXPAND_UNIQUE_CONSTRAINT.name,
    );
    if (
      (roomSchemaPhase === "EXPAND" &&
        (!expandRoomNumberConstraint ||
          !expandRoomNumberConstraint.validated ||
          expandRoomNumberConstraint.definition !==
            ROOM_EXPAND_UNIQUE_CONSTRAINT.definition)) ||
      (roomSchemaPhase === "CONTRACT" &&
        expandRoomNumberConstraint !== undefined)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    const legacyLoginIdTargetConstraint = constraints.find(
      (constraint) =>
        constraint.table === LEGACY_LOGIN_ID_TARGET_UNIQUE_CONSTRAINT.table &&
        constraint.name === LEGACY_LOGIN_ID_TARGET_UNIQUE_CONSTRAINT.name,
    );
    if (
      (loginIdHistoryPhase === "EXPAND" &&
        (!legacyLoginIdTargetConstraint ||
          !legacyLoginIdTargetConstraint.validated ||
          legacyLoginIdTargetConstraint.definition !==
            LEGACY_LOGIN_ID_TARGET_UNIQUE_CONSTRAINT.definition)) ||
      (loginIdHistoryPhase === "CONTRACT" &&
        legacyLoginIdTargetConstraint !== undefined)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (
      loginIdHistoryPhase === "CONTRACT" &&
      LOGIN_ID_HISTORY_REQUIRED_CONSTRAINTS.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === "preview_bootstrap_operations" &&
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
    const requiredRoomCheckConstraints =
      roomSchemaPhase === "CONTRACT"
        ? REQUIRED_CHECK_CONSTRAINTS.filter((required) =>
            ROOM_LIFECYCLE_CHECK_CONSTRAINT_NAMES.has(required.name),
          )
        : ROOM_EXPAND_CHECK_CONSTRAINTS;
    const requiredCheckConstraints = [
      ...REQUIRED_CHECK_CONSTRAINTS.filter(
        (required) => !ROOM_LIFECYCLE_CHECK_CONSTRAINT_NAMES.has(required.name),
      ),
      ...requiredRoomCheckConstraints,
    ];
    if (
      requiredCheckConstraints.some(
        (required) =>
          !constraints.some(
            (constraint) =>
              constraint.table === required.table &&
              constraint.name === required.name &&
              constraint.validated &&
              constraint.definition === required.definition,
          ),
      ) ||
      (roomSchemaPhase === "EXPAND" &&
        constraints.some(
          (constraint) =>
            constraint.name === "hotel_room_status_history_source_shape",
        )) ||
      (roomSchemaPhase === "CONTRACT" &&
        constraints.some((constraint) =>
          [
            "hotel_rooms_resume_shape",
            "hotel_room_status_history_resume_shape",
          ].includes(constraint.name),
        ))
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
    const requiredIndexes =
      roomSchemaPhase === "CONTRACT"
        ? REQUIRED_INDEXES
        : REQUIRED_INDEXES.filter(
            (required) => !ROOM_CONTRACT_INDEX_NAMES.has(required.name),
          );
    if (
      requiredIndexes.some(
        (required) =>
          !indexRows.some(
            (index) =>
              index.index_name === required.name &&
              normalizeDefinition(index.definition) === required.definition,
          ),
      ) ||
      (roomSchemaPhase === "EXPAND" &&
        indexRows.some((index) =>
          ROOM_CONTRACT_INDEX_NAMES.has(index.index_name),
        ))
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const loginIdTargetHistoryIndex = indexRows.find(
      (index) => index.index_name === LOGIN_ID_TARGET_HISTORY_INDEX.name,
    );
    if (
      (loginIdHistoryPhase === "EXPAND" &&
        loginIdTargetHistoryIndex !== undefined) ||
      (loginIdHistoryPhase === "CONTRACT" &&
        (!loginIdTargetHistoryIndex ||
          normalizeDefinition(loginIdTargetHistoryIndex.definition) !==
            LOGIN_ID_TARGET_HISTORY_INDEX.definition))
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
      const capabilityTablePrivileges =
        role.capability === "API_RUNTIME"
          ? roomSchemaPhase === "CONTRACT"
            ? EXPECTED_API_RUNTIME_TABLE_PRIVILEGES.filter(
                (label) =>
                  label !== "hotel_room_status_history:INSERT" &&
                  label !== "hotel_rooms:INSERT",
              )
            : EXPECTED_API_RUNTIME_TABLE_PRIVILEGES
          : EXPECTED_RECONCILER_TABLE_PRIVILEGES;
      const roleTablePrivileges =
        inspectionProcessPhase === "CONTRACT"
          ? capabilityTablePrivileges
          : capabilityTablePrivileges.filter(
              (label) =>
                !HOTEL_INSPECTION_CONTRACT_TABLES.has(
                  label.split(":", 1)[0] ?? "",
                ),
            );
      addExpectedTablePrivileges(role.role_name, roleTablePrivileges);
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

    const columnPrivilegeRows = await sql<
      { grantable: boolean; label: string; role_name: string | null }[]
    >`
      select table_record.relname || ':' || column_record.attname || ':' ||
               upper(acl.privilege_type) as label,
             acl.is_grantable as grantable,
             grantee_role.rolname as role_name
      from pg_class table_record
      join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
      join pg_attribute column_record on column_record.attrelid = table_record.oid
      cross join lateral aclexplode(column_record.attacl) acl
      left join pg_roles grantee_role on grantee_role.oid = acl.grantee
      where table_namespace.nspname = 'public'
        and table_record.relkind in ('r', 'p')
        and column_record.attnum > 0
        and not column_record.attisdropped
        and acl.grantee <> table_record.relowner
    `;
    const roomPhaseColumnPrivileges = (
      labels: readonly string[],
      columnPhase: "CONTRACT" | "EXPAND" | "EXPAND_IDENTITY_LOCK",
    ) => {
      if (roomSchemaPhase === "CONTRACT") {
        return labels.filter((label) => !label.startsWith("hotel_rooms:"));
      }
      if (columnPhase !== "CONTRACT") return labels;
      const legacyLabels = [...labels];
      for (const label of EXPECTED_API_RUNTIME_EXPAND_COLUMN_PRIVILEGES.filter(
        (candidate) => candidate.startsWith("hotel_rooms:"),
      )) {
        if (!legacyLabels.includes(label)) legacyLabels.push(label);
      }
      return legacyLabels;
    };
    const columnPhaseDefinitions = [
      {
        phase: "EXPAND" as const,
        labels: roomPhaseColumnPrivileges(
          EXPECTED_API_RUNTIME_EXPAND_COLUMN_PRIVILEGES,
          "EXPAND",
        ),
      },
      {
        phase: "EXPAND_IDENTITY_LOCK" as const,
        labels: roomPhaseColumnPrivileges(
          EXPECTED_API_RUNTIME_IDENTITY_LOCK_COLUMN_PRIVILEGES,
          "EXPAND_IDENTITY_LOCK",
        ),
      },
      {
        phase: "CONTRACT" as const,
        labels: roomPhaseColumnPrivileges(
          EXPECTED_API_RUNTIME_CONTRACT_COLUMN_PRIVILEGES,
          "CONTRACT",
        ),
      },
    ];
    const expectedColumnPrivilegeCandidates = columnPhaseDefinitions.map(
      ({ labels, phase }) => {
        const expected = new Set<string>();
        for (const role of capabilityRoleRows) {
          if (
            role.role_name !== migrationOwner.role_name &&
            role.capability === "API_RUNTIME"
          ) {
            for (const label of labels) {
              expected.add(`${role.role_name}:${label}`);
            }
          }
        }
        return { expected, phase };
      },
    );
    const actualColumnPrivileges = new Set(
      columnPrivilegeRows.map(
        (row) => `${row.role_name ?? "PUBLIC"}:${row.label}`,
      ),
    );
    const matchingColumnAclPhases = expectedColumnPrivilegeCandidates.filter(
      ({ expected }) =>
        actualColumnPrivileges.size === expected.size &&
        [...expected].every((privilege) =>
          actualColumnPrivileges.has(privilege),
        ),
    );
    const requiredRolloutPhase = options.requiredSchemaPhase;
    const observedColumnAclPhase =
      matchingColumnAclPhases.length === 1
        ? matchingColumnAclPhases[0]?.phase
        : matchingColumnAclPhases.length === 2 &&
            matchingColumnAclPhases.some(
              ({ phase }) => phase === "EXPAND_IDENTITY_LOCK",
            ) &&
            matchingColumnAclPhases.some(({ phase }) => phase === "CONTRACT")
          ? requiredRolloutPhase === "CONTRACT"
            ? "CONTRACT"
            : requiredRolloutPhase === "EXPAND_IDENTITY_LOCK"
              ? "EXPAND_IDENTITY_LOCK"
              : requiredRolloutPhase === undefined
                ? observedSchemaAclPhase === "CONTRACT"
                  ? "CONTRACT"
                  : "EXPAND_IDENTITY_LOCK"
                : undefined
          : matchingColumnAclPhases.length === columnPhaseDefinitions.length &&
              actualColumnPrivileges.size === 0
            ? observedSchemaAclPhase === "CONTRACT"
              ? "CONTRACT"
              : "EXPAND"
            : undefined;
    const approvedAclTuple = requiredRolloutPhase
      ? observedColumnAclPhase === requiredRolloutPhase &&
        observedSchemaAclPhase ===
          (requiredRolloutPhase === "CONTRACT" ? "CONTRACT" : "EXPAND")
      : (observedSchemaAclPhase === "EXPAND" &&
          (observedColumnAclPhase === "EXPAND" ||
            observedColumnAclPhase === "EXPAND_IDENTITY_LOCK")) ||
        (observedSchemaAclPhase === "CONTRACT" &&
          observedColumnAclPhase === "CONTRACT");
    if (
      !approvedAclTuple ||
      columnPrivilegeRows.some((row) => row.grantable || !row.role_name)
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
        protected_columns: string[];
        trigger_type: number;
      }[]
    >`
      select trigger_record.tgname as trigger_name,
             trigger_record.tgenabled as enabled,
             trigger_record.tgtype::integer as trigger_type,
             array(
               select protected_column.attname
               from unnest(trigger_record.tgattr::smallint[]) with ordinality
                 protected_attribute(attribute_number, attribute_order)
               join pg_attribute protected_column
                 on protected_column.attrelid = trigger_record.tgrelid
                and protected_column.attnum = protected_attribute.attribute_number
               order by protected_attribute.attribute_order
             ) as protected_columns,
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
    const requiredTriggers =
      roomSchemaPhase === "CONTRACT"
        ? REQUIRED_TRIGGERS
        : REQUIRED_TRIGGERS.filter(
            (required) => !ROOM_CONTRACT_TRIGGER_NAMES.has(required.name),
          );
    if (
      requiredTriggers.some(
        (required) =>
          !triggerRows.some(
            (trigger) =>
              trigger.trigger_name === required.name &&
              trigger.table_name === required.table &&
              trigger.function_name === required.functionName &&
              trigger.enabled === "O",
          ),
      ) ||
      (roomSchemaPhase === "EXPAND" &&
        triggerRows.some((trigger) =>
          ROOM_CONTRACT_TRIGGER_NAMES.has(trigger.trigger_name),
        ))
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
    const hotelHistoryTriggers = triggerRows.filter(
      (trigger) => trigger.function_name === "reject_hotel_relationship_delete",
    );
    if (
      hotelHistoryTriggers.length !== 3 ||
      (
        await Promise.all(
          hotelHistoryTriggers.map(
            async (trigger) =>
              trigger.trigger_type === 11 &&
              trigger.function_owner === migrationOwner.role_name &&
              trigger.function_acl_safe &&
              trigger.function_contract_safe &&
              (await sourceSha256(trigger.function_source)) ===
                REJECT_HOTEL_RELATIONSHIP_DELETE_PROSRC_SHA256,
          ),
        )
      ).some((safe) => !safe)
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }
    const roomTriggerContracts = new Map<
      string,
      { digest: string; protectedColumns: string[]; type: number }
    >([
      [
        "hotel_room_types_scope_immutable",
        {
          digest: REJECT_HOTEL_ROOM_TYPE_SCOPE_CHANGE_PROSRC_SHA256,
          protectedColumns: ["company_id", "scope", "branch_id"],
          type: 19,
        },
      ],
      [
        "hotel_rooms_room_type_scope_guard",
        {
          digest: ENFORCE_HOTEL_ROOM_TYPE_SCOPE_PROSRC_SHA256,
          protectedColumns: ["company_id", "branch_id", "room_type_id"],
          type: 23,
        },
      ],
      [
        "hotel_room_types_no_delete",
        {
          digest: REJECT_HOTEL_ROOM_DELETE_PROSRC_SHA256,
          protectedColumns: [],
          type: 11,
        },
      ],
      [
        "hotel_rooms_no_delete",
        {
          digest: REJECT_HOTEL_ROOM_DELETE_PROSRC_SHA256,
          protectedColumns: [],
          type: 11,
        },
      ],
      [
        "hotel_room_status_history_no_update",
        {
          digest: REJECT_HOTEL_ROOM_HISTORY_CHANGE_PROSRC_SHA256,
          protectedColumns: [],
          type: 19,
        },
      ],
      [
        "hotel_room_status_history_no_delete",
        {
          digest: REJECT_HOTEL_ROOM_HISTORY_CHANGE_PROSRC_SHA256,
          protectedColumns: [],
          type: 11,
        },
      ],
    ]);
    if (roomSchemaPhase === "CONTRACT") {
      roomTriggerContracts.set("hotel_rooms_deleted_immutable", {
        digest: REJECT_DELETED_HOTEL_ROOM_CHANGE_PROSRC_SHA256,
        protectedColumns: [],
        type: 19,
      });
      roomTriggerContracts.set("hotel_room_status_history_insert_guard", {
        digest: ENFORCE_NEW_HOTEL_ROOM_HISTORY_INSERT_PROSRC_SHA256,
        protectedColumns: [],
        type: 7,
      });
    }
    for (const [triggerName, expected] of roomTriggerContracts) {
      const trigger = triggerRows.find(
        (candidate) => candidate.trigger_name === triggerName,
      );
      if (
        !trigger ||
        trigger.trigger_type !== expected.type ||
        trigger.protected_columns.length !== expected.protectedColumns.length ||
        trigger.protected_columns.some(
          (column, index) => column !== expected.protectedColumns[index],
        ) ||
        trigger.function_owner !== migrationOwner.role_name ||
        !trigger.function_acl_safe ||
        !trigger.function_contract_safe ||
        (await sourceSha256(trigger.function_source)) !== expected.digest
      ) {
        return { status: "SCHEMA_NOT_READY" };
      }
    }

    const rlsRows = await sql<
      {
        applies_to_current_role: boolean;
        roles_public: boolean;
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
             policy_record.polroles = array[0::oid] as roles_public,
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
            const requiredPolicyPhase =
              required.table === "hotel_room_types" ||
              required.table === "hotel_rooms" ||
              required.table === "hotel_room_status_history"
                ? roomPolicyPhase
                : schemaPhase;
            return (
              policy.policy_name === required.policy &&
              policy.table_name === required.table &&
              policy.row_security &&
              policy.row_security_forced &&
              policy.policy_permissive &&
              policy.roles_public &&
              policy.applies_to_current_role &&
              policy.policy_command === "*" &&
              isExactTenantPolicyExpression(
                policy.using_expression,
                required.table === "companies" ? "id" : "company_id",
                requiredPolicyPhase,
              ) &&
              isExactTenantPolicyExpression(
                policy.check_expression,
                required.table === "companies" ? "id" : "company_id",
                requiredPolicyPhase,
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
