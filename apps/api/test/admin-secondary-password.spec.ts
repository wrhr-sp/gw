import { beforeEach, describe, expect, it } from "vitest";
import {
  adminSecondaryPasswordMutationResponseSchema,
  adminSecondaryPasswordResetRequestResponseSchema,
  adminSecondaryPasswordStatusResponseSchema,
  appRoutes,
  createInviteResponseSchema,
  errorResponseSchema,
} from "@gw/shared";
import { app, resetApiPreviewState } from "../src/app";
import { resetAdminSecondaryPasswordPreviewState } from "../src/lib/admin-secondary-password";

async function loginAndGetCookie(role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({
      loginId: "admin",
      password: "1234",
      rememberSession: false,
    }),
  });

  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("expected set-cookie header");
  }
  return cookie;
}

describe("admin secondary password api", () => {
  beforeEach(async () => {
    await resetApiPreviewState();
    resetAdminSecondaryPasswordPreviewState();
  });

  it("returns enrollmentRequired before any secondary password is registered", async () => {
    const cookie = await loginAndGetCookie();
    const response = await app.request(appRoutes.admin.secondaryPassword.status, {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    const payload = adminSecondaryPasswordStatusResponseSchema.parse(await response.json());
    expect(payload.data.required).toBe(true);
    expect(payload.data.enrollmentRequired).toBe(true);
    expect(payload.data.hasSecondaryPassword).toBe(false);
    expect(payload.data.credentialStatus).toBe("reset_required");
  });

  it("enrolls a password, blocks protected admin changes on a fresh session, then allows verify + high-risk route", async () => {
    const firstCookie = await loginAndGetCookie();

    const enrollResponse = await app.request(appRoutes.admin.secondaryPassword.enroll, {
      method: "POST",
      headers: { cookie: firstCookie, "content-type": "application/json" },
      body: JSON.stringify({
        primaryPassword: "1234",
        nextPin: "2468",
        confirmPin: "2468",
      }),
    });

    expect(enrollResponse.status).toBe(200);
    const enrollPayload = adminSecondaryPasswordMutationResponseSchema.parse(await enrollResponse.json());
    expect(enrollPayload.data.status.hasSecondaryPassword).toBe(true);
    expect(enrollPayload.data.status.verification.verified).toBe(true);

    const secondCookie = await loginAndGetCookie();
    const blockedInviteResponse = await app.request(appRoutes.admin.invites, {
      method: "POST",
      headers: { cookie: secondCookie, "content-type": "application/json" },
      body: JSON.stringify({
        companyId: "company_demo",
        email: "new-admin@example.com",
        roleCode: "HR_ADMIN",
        departmentId: "department_hr",
      }),
    });

    expect(blockedInviteResponse.status).toBe(403);
    const blockedPayload = errorResponseSchema.parse(await blockedInviteResponse.json());
    expect(blockedPayload.error.details?.recommendedVerifyScope).toBe("admin_high_risk");

    const verifyResponse = await app.request(appRoutes.admin.secondaryPassword.verify, {
      method: "POST",
      headers: { cookie: secondCookie, "content-type": "application/json" },
      body: JSON.stringify({
        pin: "2468",
        scope: "admin_high_risk",
      }),
    });

    expect(verifyResponse.status).toBe(200);
    adminSecondaryPasswordMutationResponseSchema.parse(await verifyResponse.json());

    const inviteResponse = await app.request(appRoutes.admin.invites, {
      method: "POST",
      headers: { cookie: secondCookie, "content-type": "application/json" },
      body: JSON.stringify({
        companyId: "company_demo",
        email: "new-admin@example.com",
        roleCode: "HR_ADMIN",
        departmentId: "department_hr",
      }),
    });

    expect(inviteResponse.status).toBe(201);
    const invitePayload = createInviteResponseSchema.parse(await inviteResponse.json());
    expect(invitePayload.data.audit.action).toBe("admin.invite.create");
  });

  it("locks verification after five failed attempts", async () => {
    const cookie = await loginAndGetCookie();
    await app.request(appRoutes.admin.secondaryPassword.enroll, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        primaryPassword: "1234",
        nextPin: "1357",
        confirmPin: "1357",
      }),
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await app.request(appRoutes.admin.secondaryPassword.verify, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          pin: "9999",
          scope: "admin_settings",
        }),
      });

      expect(response.status).toBe(403);
      const payload = errorResponseSchema.parse(await response.json());
      if (attempt === 5) {
        const status = payload.error.details?.verificationStatus as { lock?: { locked?: boolean } } | undefined;
        expect(status?.lock?.locked).toBe(true);
      }
    }

    const statusResponse = await app.request(appRoutes.admin.secondaryPassword.status, {
      headers: { cookie },
    });
    const statusPayload = adminSecondaryPasswordStatusResponseSchema.parse(await statusResponse.json());
    expect(statusPayload.data.lock.locked).toBe(true);
    expect(statusPayload.data.lock.failedAttemptCount).toBe(5);
  });

  it("changes the password and supports admin reset-request/admin reset flow", async () => {
    const companyAdminCookie = await loginAndGetCookie("COMPANY_ADMIN");
    await app.request(appRoutes.admin.secondaryPassword.enroll, {
      method: "POST",
      headers: { cookie: companyAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        primaryPassword: "1234",
        nextPin: "1234",
        confirmPin: "1234",
      }),
    });

    const changeResponse = await app.request(appRoutes.admin.secondaryPassword.change, {
      method: "POST",
      headers: { cookie: companyAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        currentPin: "1234",
        nextPin: "5678",
        confirmPin: "5678",
      }),
    });

    expect(changeResponse.status).toBe(200);
    adminSecondaryPasswordMutationResponseSchema.parse(await changeResponse.json());

    const oldPinResponse = await app.request(appRoutes.admin.secondaryPassword.verify, {
      method: "POST",
      headers: { cookie: companyAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        pin: "1234",
        scope: "admin_settings",
      }),
    });
    expect(oldPinResponse.status).toBe(403);

    const resetRequestResponse = await app.request(appRoutes.admin.secondaryPassword.resetRequest, {
      method: "POST",
      headers: { cookie: companyAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({ reason: "분실 접수 테스트" }),
    });
    expect(resetRequestResponse.status).toBe(200);
    const resetRequestPayload = adminSecondaryPasswordResetRequestResponseSchema.parse(await resetRequestResponse.json());
    expect(resetRequestPayload.data.requestRecorded).toBe(true);
    expect(resetRequestPayload.data.reviewRequired).toBe(true);

    const hrAdminCookie = await loginAndGetCookie("HR_ADMIN");
    await app.request(appRoutes.admin.secondaryPassword.enroll, {
      method: "POST",
      headers: { cookie: hrAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        primaryPassword: "1234",
        nextPin: "2468",
        confirmPin: "2468",
      }),
    });

    const reverifyResponse = await app.request(appRoutes.admin.secondaryPassword.verify, {
      method: "POST",
      headers: { cookie: companyAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({
        pin: "5678",
        scope: "admin_high_risk",
      }),
    });
    expect(reverifyResponse.status).toBe(200);

    const adminResetResponse = await app.request(appRoutes.admin.secondaryPassword.reset("user_hr_admin"), {
      method: "POST",
      headers: { cookie: companyAdminCookie, "content-type": "application/json" },
      body: JSON.stringify({ reason: "운영 승인 후 초기화" }),
    });
    expect(adminResetResponse.status).toBe(200);
    adminSecondaryPasswordMutationResponseSchema.parse(await adminResetResponse.json());

    const hrStatusResponse = await app.request(appRoutes.admin.secondaryPassword.status, {
      headers: { cookie: hrAdminCookie },
    });
    const hrStatusPayload = adminSecondaryPasswordStatusResponseSchema.parse(await hrStatusResponse.json());
    expect(hrStatusPayload.data.enrollmentRequired).toBe(true);
    expect(hrStatusPayload.data.credentialStatus).toBe("reset_required");
  });
});
