import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0016_hotel_relationship_management.sql",
    import.meta.url,
  ),
  "utf8",
);
const integrityMigration = readFileSync(
  new URL(
    "../migrations/0017_hotel_relationship_integrity_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const hotelRepository = readFileSync(
  new URL("../src/hotels.ts", import.meta.url),
  "utf8",
);
const accountRepository = readFileSync(
  new URL("../src/accounts.ts", import.meta.url),
  "utf8",
);

describe("HOTEL-MVP-010 Phase A database contract", () => {
  it("adds versioned termination and physical-delete rejection", () => {
    expect(migration).toContain("0014_neon_definer_expand_compatibility");
    expect(migration).toContain("terminated_at");
    expect(migration).toContain("terminated_by");
    expect(migration).toContain("version integer not null default 1");
    expect(migration).toContain("reject_hotel_relationship_delete");
    expect(migration).toContain("termination_reason is not null");
    expect(integrityMigration).toContain(
      "0017_hotel_relationship_integrity_hardening",
    );
    expect(
      integrityMigration.match(/termination_reason is not null/gu),
    ).toHaveLength(3);
    expect(migration).toContain("HOTEL_ASSIGNMENT_MANAGE");
    expect(migration).toContain("HOTEL_OWNER_MANAGE");
    expect(migration).toContain("HOTEL_OWNER_TRANSFERRED");
    expect(migration).toContain("set local role werehere_auth_session_definer");
    expect(migration).toContain(
      "create function public.auth_revoke_hotel_owner_sessions_v1",
    );
    expect(migration).not.toContain(
      "create or replace function public.auth_revoke_user_sessions_v1",
    );
  });

  it("enforces deny precedence, scope, reauth, idempotency and safe activation", () => {
    expect(hotelRepository).toContain("DEPENDENT_WORK_REASSIGNMENT_REQUIRED");
    expect(hotelRepository).toContain("HOTEL_ACTIVATION_READINESS_REQUIRED");
    expect(hotelRepository).toContain(
      "auth_time >= now() - interval '5 minutes'",
    );
    expect(hotelRepository).toContain("effect = 'DENY'");
    expect(hotelRepository).toContain("idempotency_records");
    const assignmentCreate = hotelRepository.slice(
      hotelRepository.indexOf("async createAssignment"),
      hotelRepository.indexOf("async endAssignment"),
    );
    expect(
      assignmentCreate.indexOf("select user_type from users"),
    ).toBeLessThan(
      assignmentCreate.indexOf("update hotel_profiles set version"),
    );
    const ownerTransfer = hotelRepository.slice(
      hotelRepository.indexOf("async transferOwner"),
      hotelRepository.indexOf("async activateHotel"),
    );
    expect(ownerTransfer).not.toContain("readCommittedAssignment");
  });

  it("closes USER_CREATE relationship escalation", () => {
    expect(accountRepository).toContain("HOTEL_ASSIGNMENT_MANAGE");
    expect(accountRepository).toContain("HOTEL_OWNER_MANAGE");
    expect(accountRepository).toContain(
      "auth_time >= now() - interval '5 minutes'",
    );
    expect(accountRepository).toContain("grant_record.branch_id = any");
    const completion = accountRepository.slice(
      accountRepository.indexOf("async completeCreate"),
      accountRepository.indexOf("async markCreateFailed"),
    );
    expect(completion).toContain("relationshipCreationPermission");
    expect(completion).toContain(
      'permission(transaction, completionActor, "USER_CREATE")',
    );
    expect(completion).toContain("!input.sessionId");
  });
});
