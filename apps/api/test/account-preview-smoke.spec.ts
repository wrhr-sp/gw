import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { chromium, errors as playwrightErrors } from "@playwright/test";
import { describe, expect, it } from "vitest";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as cleanupHelpers from "../../../scripts/lib/preview-account-smoke-cleanup.mjs";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as navigationSmokeHelpers from "../../../scripts/lib/preview-account-smoke-navigation.mjs";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as relationshipSmokeHelpers from "../../../scripts/lib/preview-relationship-smoke-contract.mjs";

const {
  assertCreateResponseMatchesAttempt,
  assertHousekeepingAssignmentRows,
  discoverCleanupAttempt,
  ensureDatabaseInactive,
  finalizePreviewSmoke,
  orchestratePreviewAccountCleanup,
  waitForProviderInactive,
  waitForProviderSessionGone,
  waitForZeroActiveSessions,
} = cleanupHelpers;
const { runHostedMutation, runHostedMutationWithReload } =
  relationshipSmokeHelpers;
const { navigateInspectionSettings, preflightInspectionSettings } =
  navigationSmokeHelpers;

const smokeUrl = new URL(
  "../../../scripts/smoke-account-preview.mjs",
  import.meta.url,
);
const cleanupHelperUrl = new URL(
  "../../../scripts/lib/preview-account-smoke-cleanup.mjs",
  import.meta.url,
);
const navigationHelperUrl = new URL(
  "../../../scripts/lib/preview-account-smoke-navigation.mjs",
  import.meta.url,
);
const inspectionSettingsPageUrl = new URL(
  "../../../apps/web/app/hotels/[hotelId]/inspections/settings/page.tsx",
  import.meta.url,
);
const serverInspectionsUrl = new URL(
  "../../../apps/web/lib/server-inspections.ts",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");
const helperSource = readFileSync(cleanupHelperUrl, "utf8");
const navigationSource = readFileSync(navigationHelperUrl, "utf8");
const inspectionSettingsPageSource = readFileSync(
  inspectionSettingsPageUrl,
  "utf8",
);
const serverInspectionsSource = readFileSync(serverInspectionsUrl, "utf8");

describe("hosted Preview account-management smoke", () => {
  it("is valid executable JavaScript", () => {
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("preflights inspection settings with the browser cookie request context", async () => {
    const baseUrl = "https://preview.example.test";
    const hotelId = "hotel/value";
    const paths = [
      "/api/hotels/hotel%2Fvalue/inspection-checklist/v2",
      "/api/admin/process-definitions?hotelId=hotel%2Fvalue",
      "/api/hotels/hotel%2Fvalue/process-defaults/room-inspection",
      "/api/hotels/hotel%2Fvalue/process-reviewer-candidates",
      "/api/hotels/hotel%2Fvalue/inspection-routines/v2",
    ];
    const calls: Array<{ timeout: number; url: string }> = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    await preflightInspectionSettings({
      baseUrl,
      hotelId,
      request: {
        get: async (url: string, options: { timeout: number }) => {
          calls.push({ timeout: options.timeout, url });
          activeRequests += 1;
          maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
          await Promise.resolve();
          activeRequests -= 1;
          return { ok: () => true };
        },
      },
      timeoutMs: 1234,
    });
    expect(maxActiveRequests).toBe(1);
    expect(calls).toEqual(
      paths.map((path) => ({ timeout: 1234, url: `${baseUrl}${path}` })),
    );

    const stages = [
      "CHECKLIST",
      "DEFINITIONS",
      "DEFAULT",
      "CANDIDATES",
      "ROUTINES",
    ] as const;
    for (const [failedIndex, failedStage] of stages.entries()) {
      let requestCount = 0;
      await expect(
        preflightInspectionSettings({
          baseUrl,
          hotelId,
          request: {
            get: async () => {
              const requestIndex = requestCount;
              requestCount += 1;
              return { ok: () => requestIndex !== failedIndex };
            },
          },
          timeoutMs: 1234,
        }),
      ).rejects.toMatchObject({
        message: "Hosted checklist UI configuration preflight failed",
        previewFailureCode: `INSPECTION_CHECKLIST_V2_UI_PREFLIGHT_${failedStage}`,
      });
      expect(requestCount).toBe(failedIndex + 1);
    }

    const transportFailure = new Error("bounded transport failure");
    await expect(
      preflightInspectionSettings({
        baseUrl,
        hotelId,
        request: { get: async () => Promise.reject(transportFailure) },
        timeoutMs: 1234,
      }),
    ).rejects.toBe(transportFailure);
  });

  it("retries only transient inspection SSR failures and preserves navigation boundaries", async () => {
    const baseUrl = "https://preview.example.test";
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const createPage = ({
      afterBackoffUrls,
      afterWaitUrls,
      diagnosticSectionExists,
      diagnostics,
      gotoErrors,
      jsonValueErrors,
      outcomes,
      unavailableState = "NO_HEADING",
      urls,
      waitErrors,
    }: {
      afterBackoffUrls?: string[];
      afterWaitUrls?: string[];
      diagnosticSectionExists?: boolean;
      diagnostics?: Partial<{ code: string; stage: string; status: string }>;
      gotoErrors?: Array<Error | null>;
      jsonValueErrors?: Array<Error | null>;
      outcomes: Array<string | null>;
      unavailableState?:
        | "AUTH_HEADING"
        | "NO_HEADING"
        | "PASSWORD_HEADING"
        | "UNEXPECTED_ALERT"
        | "UNEXPECTED_HEADING";
      urls?: string[];
      waitErrors?: Array<Error | null>;
    }) => {
      let attempt = 0;
      let currentUrl = `${baseUrl}/hotels/${hotelId}/inspections/settings`;
      const observedHeadingTimeouts: number[] = [];
      const sectionExists = diagnosticSectionExists ?? diagnostics !== undefined;
      return {
        calls: () => attempt,
        evaluate: async () => unavailableState,
        headingTimeouts: () => observedHeadingTimeouts,
        goto: async () => {
          attempt += 1;
          currentUrl = urls?.[attempt - 1] ?? currentUrl;
          const gotoError = gotoErrors?.[attempt - 1];
          if (gotoError) throw gotoError;
        },
        locator: () => ({
          first: () => ({
            count: async () => (sectionExists ? 1 : 0),
            getAttribute: async (name: string) => {
              if (!sectionExists)
                throw new playwrightErrors.TimeoutError("locator timeout");
              return name === "data-error-stage"
                ? (diagnostics?.stage ?? null)
                : name === "data-error-status"
                  ? (diagnostics?.status ?? null)
                  : name === "data-error-code"
                    ? (diagnostics?.code ?? null)
                    : null;
            },
          }),
        }),
        url: () => currentUrl,
        waitForFunction: async (
          _predicate: () => unknown,
          _argument: unknown,
          options: { timeout: number },
        ) => {
          observedHeadingTimeouts.push(options.timeout);
          currentUrl = afterWaitUrls?.[attempt - 1] ?? currentUrl;
          const waitError = waitErrors?.[attempt - 1];
          if (waitError) throw waitError;
          return {
            jsonValue: async () => {
              const jsonValueError = jsonValueErrors?.[attempt - 1];
              if (jsonValueError) throw jsonValueError;
              return outcomes[attempt - 1] ?? null;
            },
          };
        },
        waitForTimeout: async () => {
          currentUrl = afterBackoffUrls?.[attempt - 1] ?? currentUrl;
        },
      };
    };

    const defaultBudget = createPage({ outcomes: ["ready"] });
    await navigateInspectionSettings({
      baseUrl,
      hotelId,
      navigationTimeoutMs: 1,
      page: defaultBudget,
    });
    expect(defaultBudget.headingTimeouts()).toEqual([90_000]);

    const transient = createPage({
      diagnostics: {
        code: "INTERNAL_ERROR",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "503",
      },
      outcomes: ["failure", "ready"],
    });
    await navigateInspectionSettings({
      baseUrl,
      headingTimeoutMs: 1,
      hotelId,
      navigationTimeoutMs: 1,
      page: transient,
    });
    expect(transient.calls()).toBe(2);

    for (const boundaryUrl of [
      `${baseUrl}/login`,
      `${baseUrl}/account/initial-password`,
      "https://provider.example.test/login",
    ]) {
      const boundary = createPage({ outcomes: ["ready"], urls: [boundaryUrl] });
      await expect(
        navigateInspectionSettings({
          baseUrl,
          headingTimeoutMs: 1,
          hotelId,
          navigationTimeoutMs: 1,
          page: boundary,
        }),
      ).rejects.toThrow("Hosted checklist UI navigation boundary failed");
      expect(boundary.calls()).toBe(1);
    }

    for (const boundaryUrl of [
      `${baseUrl}/login`,
      "https://attacker.example.test/hijacked",
    ]) {
      const boundaryDuringWait = createPage({
        afterWaitUrls: [boundaryUrl],
        outcomes: ["ready"],
      });
      await expect(
        navigateInspectionSettings({
          baseUrl,
          headingTimeoutMs: 1,
          hotelId,
          navigationTimeoutMs: 1,
          page: boundaryDuringWait,
        }),
      ).rejects.toThrow("Hosted checklist UI navigation boundary failed");
      expect(boundaryDuringWait.calls()).toBe(1);
    }

    const boundaryDuringBackoff = createPage({
      afterBackoffUrls: [`${baseUrl}/login`],
      diagnostics: {
        code: "INTERNAL_ERROR",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "503",
      },
      outcomes: ["failure"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: boundaryDuringBackoff,
      }),
    ).rejects.toThrow("Hosted checklist UI navigation boundary failed");
    expect(boundaryDuringBackoff.calls()).toBe(1);

    const redirectTimeout = createPage({
      gotoErrors: [new Error("navigation timeout")],
      outcomes: [],
      urls: [`${baseUrl}/login`],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: redirectTimeout,
      }),
    ).rejects.toThrow("navigation timeout");
    expect(redirectTimeout.calls()).toBe(1);

    const headingTimeout = createPage({
      outcomes: [null, "ready"],
      waitErrors: [new playwrightErrors.TimeoutError("heading timeout")],
    });
    await navigateInspectionSettings({
      baseUrl,
      headingTimeoutMs: 1,
      hotelId,
      navigationTimeoutMs: 1,
      page: headingTimeout,
    });
    expect(headingTimeout.calls()).toBe(2);

    const protocolFailure = createPage({
      outcomes: [],
      waitErrors: [new Error("protocol failure")],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: protocolFailure,
      }),
    ).rejects.toThrow("protocol failure");
    expect(protocolFailure.calls()).toBe(1);

    const jsonValueFailure = createPage({
      jsonValueErrors: [new Error("json value failure")],
      outcomes: ["ready"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: jsonValueFailure,
      }),
    ).rejects.toThrow("json value failure");
    expect(jsonValueFailure.calls()).toBe(1);

    const terminal = createPage({
      outcomes: ["failure", "failure", "failure"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: terminal,
      }),
    ).rejects.toMatchObject({
      previewFailureCode: "INSPECTION_CHECKLIST_V2_UI_SERVER_UNCLASSIFIED",
    });
    expect(terminal.calls()).toBe(1);

    const malformedDiagnosticSection = createPage({
      diagnosticSectionExists: true,
      diagnostics: { stage: "ROOMS" },
      outcomes: ["failure", "ready"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: malformedDiagnosticSection,
      }),
    ).rejects.toMatchObject({
      previewFailureCode: "INSPECTION_CHECKLIST_V2_UI_SERVER_UNCLASSIFIED",
    });
    expect(malformedDiagnosticSection.calls()).toBe(1);

    for (const unavailableState of [
      "AUTH_HEADING",
      "NO_HEADING",
      "PASSWORD_HEADING",
      "UNEXPECTED_ALERT",
      "UNEXPECTED_HEADING",
    ] as const) {
      const unavailableHeading = createPage({
        outcomes: [null, null, null],
        unavailableState,
        waitErrors: [
          new playwrightErrors.TimeoutError("heading timeout"),
          new playwrightErrors.TimeoutError("heading timeout"),
          new playwrightErrors.TimeoutError("heading timeout"),
        ],
      });
      await expect(
        navigateInspectionSettings({
          baseUrl,
          headingTimeoutMs: 1,
          hotelId,
          navigationTimeoutMs: 1,
          page: unavailableHeading,
        }),
      ).rejects.toMatchObject({
        previewFailureCode: `INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE_${unavailableState}`,
      });
      expect(unavailableHeading.calls()).toBe(3);
    }

    const hotelErrorBoundary = createPage({
      outcomes: ["hotel-error", "ready"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: hotelErrorBoundary,
      }),
    ).rejects.toMatchObject({
      previewFailureCode: "INSPECTION_CHECKLIST_V2_UI_HOTEL_ERROR_BOUNDARY",
    });
    expect(hotelErrorBoundary.calls()).toBe(1);

    const classified = createPage({
      diagnostics: {
        code: "FORBIDDEN",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "403",
      },
      outcomes: ["failure", "ready"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: classified,
      }),
    ).rejects.toMatchObject({
      previewFailureCode:
        "INSPECTION_CHECKLIST_V2_UI_SERVER_CONFIGURATION_DEFINITIONS_403_FORBIDDEN",
    });
    expect(classified.calls()).toBe(1);

    const persistentServerFailure = createPage({
      diagnostics: {
        code: "INTERNAL_ERROR",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "503",
      },
      outcomes: ["failure", "failure", "failure"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: persistentServerFailure,
      }),
    ).rejects.toMatchObject({
      previewFailureCode:
        "INSPECTION_CHECKLIST_V2_UI_SERVER_CONFIGURATION_DEFINITIONS_503_INTERNAL_ERROR",
    });
    expect(persistentServerFailure.calls()).toBe(3);

    const unknownCode = createPage({
      diagnostics: {
        code: "NOT_A_REAL_API_CODE",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "503",
      },
      outcomes: ["failure", "ready"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: unknownCode,
      }),
    ).rejects.toMatchObject({
      previewFailureCode: "INSPECTION_CHECKLIST_V2_UI_SERVER_UNCLASSIFIED",
    });
    expect(unknownCode.calls()).toBe(1);

    for (const diagnostics of [
      {
        code: "FORBIDDEN",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "503",
      },
      {
        code: "AUTHENTICATION_REQUIRED",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "500",
      },
      {
        code: "INTERNAL_ERROR",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "409",
      },
      {
        code: "INTERNAL_ERROR",
        stage: "CONFIGURATION_DEFINITIONS",
        status: "502",
      },
    ]) {
      const mismatchedPair = createPage({
        diagnostics,
        outcomes: ["failure", "ready"],
      });
      await expect(
        navigateInspectionSettings({
          baseUrl,
          headingTimeoutMs: 1,
          hotelId,
          navigationTimeoutMs: 1,
          page: mismatchedPair,
        }),
      ).rejects.toMatchObject({
        previewFailureCode: "INSPECTION_CHECKLIST_V2_UI_SERVER_UNCLASSIFIED",
      });
      expect(mismatchedPair.calls()).toBe(1);
    }

    const malformedRoomResponse = createPage({
      diagnostics: {
        code: "INTERNAL_ERROR",
        stage: "ROOMS",
        status: "502",
      },
      outcomes: ["failure", "ready"],
    });
    await navigateInspectionSettings({
      baseUrl,
      headingTimeoutMs: 1,
      hotelId,
      navigationTimeoutMs: 1,
      page: malformedRoomResponse,
    });
    expect(malformedRoomResponse.calls()).toBe(2);

    const inconsistentRoomPagination = createPage({
      diagnostics: {
        code: "INTERNAL_ERROR",
        stage: "ROOMS",
        status: "409",
      },
      outcomes: ["failure", "ready"],
    });
    await expect(
      navigateInspectionSettings({
        baseUrl,
        headingTimeoutMs: 1,
        hotelId,
        navigationTimeoutMs: 1,
        page: inconsistentRoomPagination,
      }),
    ).rejects.toMatchObject({
      previewFailureCode:
        "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_409_INTERNAL_ERROR",
    });
    expect(inconsistentRoomPagination.calls()).toBe(1);
  });

  it("classifies the real hotel error-boundary DOM on the first navigation", async () => {
    const baseUrl = "https://preview.example.test";
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const targetUrl = `${baseUrl}/hotels/${hotelId}/inspections/settings`;
    const browser = await chromium.launch({ headless: true });
    let navigations = 0;
    try {
      const page = await browser.newPage();
      await page.route(targetUrl, async (route) => {
        navigations += 1;
        await route.fulfill({
          body: `<!doctype html><html lang="ko"><body><section role="alert"><h1>호텔 화면을 불러오지 못했습니다</h1></section></body></html>`,
          contentType: "text/html; charset=utf-8",
          status: 200,
        });
      });
      await expect(
        navigateInspectionSettings({
          baseUrl,
          headingTimeoutMs: 2_000,
          hotelId,
          navigationTimeoutMs: 5_000,
          page,
        }),
      ).rejects.toMatchObject({
        previewFailureCode: "INSPECTION_CHECKLIST_V2_UI_HOTEL_ERROR_BOUNDARY",
      });
      expect(navigations).toBe(1);
    } finally {
      await browser.close();
    }
  });

  it("accepts the real inspection settings heading on the first navigation", async () => {
    const baseUrl = "https://preview.example.test";
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const targetUrl = `${baseUrl}/hotels/${hotelId}/inspections/settings`;
    const browser = await chromium.launch({ headless: true });
    let navigations = 0;
    try {
      const page = await browser.newPage();
      await page.route(targetUrl, async (route) => {
        navigations += 1;
        await route.fulfill({
          body: `<!doctype html><html lang="ko"><body><main><h1>점검 설정</h1></main></body></html>`,
          contentType: "text/html; charset=utf-8",
          status: 200,
        });
      });
      await expect(
        navigateInspectionSettings({
          baseUrl,
          headingTimeoutMs: 2_000,
          hotelId,
          navigationTimeoutMs: 5_000,
          page,
        }),
      ).resolves.toBeUndefined();
      expect(navigations).toBe(1);
    } finally {
      await browser.close();
    }
  });

  it("classifies unavailable heading DOM without exposing its text", async () => {
    const baseUrl = "https://preview.example.test";
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const targetUrl = `${baseUrl}/hotels/${hotelId}/inspections/settings`;
    const cases = [
      ["AUTH_HEADING", "<main><h1>로그인</h1></main>"],
      ["NO_HEADING", "<main></main>"],
      ["PASSWORD_HEADING", "<main><h1>새 비밀번호 설정</h1></main>"],
      ["UNEXPECTED_ALERT", '<main><section role="alert"><p>오류</p></section></main>'],
      ["UNEXPECTED_HEADING", "<main><h1>다른 화면</h1></main>"],
    ] as const;
    const browser = await chromium.launch({ headless: true });
    try {
      for (const [state, body] of cases) {
        const page = await browser.newPage();
        let navigations = 0;
        await page.route(targetUrl, async (route) => {
          navigations += 1;
          await route.fulfill({
            body: `<!doctype html><html lang="ko"><body>${body}</body></html>`,
            contentType: "text/html; charset=utf-8",
            status: 200,
          });
        });
        const smokePage = {
          evaluate: page.evaluate.bind(page),
          goto: page.goto.bind(page),
          locator: page.locator.bind(page),
          url: page.url.bind(page),
          waitForFunction: page.waitForFunction.bind(page),
          waitForTimeout: async () => undefined,
        };
        await expect(
          navigateInspectionSettings({
            baseUrl,
            headingTimeoutMs: 50,
            hotelId,
            navigationTimeoutMs: 5_000,
            page: smokePage,
          }),
        ).rejects.toMatchObject({
          previewFailureCode: `INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE_${state}`,
        });
        expect(navigations).toBe(3);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  it("establishes canonical staff scope before the hosted checklist journey", () => {
    expect(source).toContain(
      "async function ensureHostedChecklistScope(hotelId, token, principal)",
    );
    expect(source).toContain('relationshipType: "STAFF"');
    expect(source).toContain('assignmentType: "PRIMARY"');
    expect(source).toContain("assignments = await api(path, { token });");
    expect(source).toContain("savedFacilityItem?.name !== itemName");
    expect(source).toContain("await desktopFacilityInput.inputValue()");
    expect(source).toContain('journeyFailureCode = "PROCESS_WORKS_UI_READ"');
    expect(source).toContain("PREVIEW_PROCESS_WORKS_UI_SMOKE_OK");
    expect(source).toContain('getByRole("region", { name: "업무 처리 흐름" })');
    expect(source).toContain('getByLabel("상태 이름")');
    expect(source).toContain("Hosted process UI canonical read-back failed");
    expect(source).toContain('const stageName = `Preview 확인 ${runSuffix}`;');
    expect(source).toContain("await stateNames.nth(stateCount - 2).fill(stageName);");
    expect(source).not.toContain("processFlow.getByText(stageName");
    expect(source).toContain(
      'const processMutationMethod = currentDefinition ? "PUT" : "POST";',
    );
    expect(source).toContain(
      "response.request().method() === processMutationMethod",
    );
    expect(source).toContain(
      "response.url() === `${baseUrl}${processMutationPath}`",
    );
    expect(source).toContain("const hostedUiTimeoutMs = 120_000;");
    expect(source).toContain("preflightInspectionSettings,");
    expect(source.indexOf("await preflightInspectionSettings({")).toBeLessThan(
      source.indexOf("await navigateInspectionSettings({"),
    );
    expect(navigationSource).toContain(
      "export async function preflightInspectionSettings({",
    );
    expect(navigationSource).toContain(
      "export async function navigateInspectionSettings({",
    );
    expect(navigationSource).toContain(
      "for (let attempt = 1; attempt <= 3; attempt += 1)",
    );
    expect(navigationSource).toContain("점검 설정을 불러오지 못했습니다");
    expect(navigationSource).toContain('getAttribute("data-error-stage")');
    expect(inspectionSettingsPageSource).toContain("data-error-stage={stage}");
    expect(inspectionSettingsPageSource).toContain(
      "stage={`CONFIGURATION_${configuration.stage}`}",
    );
    expect(serverInspectionsSource).toContain('stage: "DEFINITIONS"');
    expect(helperSource).toContain("INSPECTION_CHECKLIST_V2_UI_SERVER_");
    expect(source).toContain("{ waitUntil: \"domcontentloaded\", timeout: hostedUiTimeoutMs }");
    expect(source).toContain("{ timeout: hostedUiTimeoutMs }");
    expect(source).toContain("expectedStatuses: [200, 404]");
    expect(source).toContain(
      "const canonicalDefinitions =\n      (await api(definitionsPath, { token }))?.data?.definitions ?? [];",
    );
    expect(source.indexOf('journeyFailureCode = "INSPECTION_CHECKLIST_SCOPE"')).toBeLessThan(
      source.indexOf('journeyFailureCode = "INSPECTION_CHECKLIST_V2"'),
    );
  });

  it("does not expose runtime secret inputs through the real process stdout or stderr", () => {
    const sentinels = [
      "provisioner-secret-sentinel",
      "verification-secret-sentinel",
      "bootstrap-subject-sentinel",
    ];
    const result = spawnSync(process.execPath, [smokePath], {
      encoding: "utf8",
      env: {
        ...process.env,
        WEB_PREVIEW_URL: "invalid-preview-url",
        ZITADEL_PREVIEW_SUBJECT: sentinels[2],
        ZITADEL_ISSUER: "https://identity.example.test",
        ZITADEL_ORGANIZATION_ID: "organization-id",
        ZITADEL_USER_PROVISIONER_TOKEN: sentinels[0],
        ZITADEL_SERVICE_USER_TOKEN: sentinels[1],
        API_RUNTIME_DATABASE_URL_FILE: "/nonexistent/runtime-url",
        RECONCILER_DATABASE_URL_FILE: "/nonexistent/reconciler-url",
        GITHUB_RUN_ID: "1",
        GITHUB_RUN_ATTEMPT: "1",
      },
    });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    for (const sentinel of sentinels) expect(output).not.toContain(sentinel);
  });

  it("sanitizes runtime journey failures and success output in real subprocesses", () => {
    const sentinel = "provider-runtime-secret-sentinel";
    const importTarget = JSON.stringify(cleanupHelperUrl.href);
    const failed = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error(${JSON.stringify(sentinel)}), journeyFailureCode: ${JSON.stringify(sentinel)}, writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(failed.status).not.toBe(0);
    const failedOutput = `${failed.stdout}${failed.stderr}`;
    expect(failedOutput).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_UNCLASSIFIED",
    );
    expect(failedOutput).not.toContain(sentinel);
    expect(failedOutput).not.toContain("UNEXPECTED_SUCCESS");

    const allowedFailure = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: "ADMIN_SESSION_RUNTIME_DENIED", writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(allowedFailure.status).not.toBe(0);
    expect(`${allowedFailure.stdout}${allowedFailure.stderr}`).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_ADMIN_SESSION_RUNTIME_DENIED",
    );

    const accountCreateFailure = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: "ACCOUNT_CREATE_VALIDATION_ERROR", writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(accountCreateFailure.status).not.toBe(0);
    expect(
      `${accountCreateFailure.stdout}${accountCreateFailure.stderr}`,
    ).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_ACCOUNT_CREATE_VALIDATION_ERROR",
    );

    for (const code of [
      "ACCOUNT_CREATE_ATTEMPT_READBACK",
      "ACCOUNT_CREATE_IDENTITY_MATCH",
      "ACCOUNT_CREATE_RESPONSE_SCHEMA",
      "INSPECTION_CHECKLIST_SCOPE",
      "INSPECTION_CHECKLIST_V2",
      "INSPECTION_CHECKLIST_V2_CANONICAL_COMPARE",
      "INSPECTION_CHECKLIST_V2_CANONICAL_READ",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ_AUTHENTICATION_REQUIRED",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ_DB_NOT_CONFIGURED",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ_FORBIDDEN",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ_INTERNAL_ERROR",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ_OTHER",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ_RESOURCE_NOT_FOUND",
      "INSPECTION_CHECKLIST_V2_INITIAL_READ_SCHEMA_NOT_READY",
      "INSPECTION_CHECKLIST_V2_LEGACY_READ",
      "INSPECTION_CHECKLIST_V2_SAVE",
      "INSPECTION_CHECKLIST_V2_UI",
      "INSPECTION_CHECKLIST_V2_UI_COMMITTED_RESPONSE_LOSS",
      "INSPECTION_CHECKLIST_V2_UI_DESKTOP_READBACK",
      "INSPECTION_CHECKLIST_V2_UI_DESKTOP_RELOAD",
      "INSPECTION_CHECKLIST_V2_UI_DESKTOP_VALUE",
      "INSPECTION_CHECKLIST_V2_UI_DESKTOP_AXE",
      "INSPECTION_CHECKLIST_V2_UI_NAVIGATE",
      "INSPECTION_CHECKLIST_V2_UI_REPLAY",
      "PROCESS_WORKS_UI_ACCESSIBILITY",
      "PROCESS_WORKS_UI_ADD",
      "PROCESS_WORKS_UI_CANONICAL",
      "PROCESS_WORKS_UI_OPEN",
      "PROCESS_WORKS_UI_READ",
      "PROCESS_WORKS_UI_READ_AUTHENTICATION_REQUIRED",
      "PROCESS_WORKS_UI_READ_DB_NOT_CONFIGURED",
      "PROCESS_WORKS_UI_READ_FORBIDDEN",
      "PROCESS_WORKS_UI_READ_INTERNAL_ERROR",
      "PROCESS_WORKS_UI_READ_OTHER",
      "PROCESS_WORKS_UI_READ_RESOURCE_NOT_FOUND",
      "PROCESS_WORKS_UI_READ_SCHEMA_NOT_READY",
      "PROCESS_WORKS_UI_READ_VALIDATION_ERROR",
      "PROCESS_WORKS_UI_SAVE",
      "PROCESS_WORKS_UI_SAVE_AUTHENTICATION_REQUIRED",
      "PROCESS_WORKS_UI_SAVE_DB_NOT_CONFIGURED",
      "PROCESS_WORKS_UI_SAVE_FORBIDDEN",
      "PROCESS_WORKS_UI_SAVE_IDEMPOTENCY_CONFLICT",
      "PROCESS_WORKS_UI_SAVE_INTERNAL_ERROR",
      "PROCESS_WORKS_UI_SAVE_OTHER",
      "PROCESS_WORKS_UI_SAVE_RESOURCE_NOT_FOUND",
      "PROCESS_WORKS_UI_SAVE_SCHEMA_NOT_READY",
      "PROCESS_WORKS_UI_SAVE_VALIDATION_ERROR",
      "PROCESS_WORKS_UI_SAVE_VERSION_CONFLICT",
    ]) {
      const readbackFailure = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: ${JSON.stringify(code)}, writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
        ],
        { encoding: "utf8" },
      );
      expect(readbackFailure.status).not.toBe(0);
      expect(`${readbackFailure.stdout}${readbackFailure.stderr}`).toContain(
        `PREVIEW_ACCOUNT_JOURNEY_FAILED_${code}`,
      );
    }

    const sagaFailure = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_PROVIDER_CONFIRMED", writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(sagaFailure.status).not.toBe(0);
    expect(`${sagaFailure.stdout}${sagaFailure.stderr}`).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_PROVIDER_CONFIRMED",
    );

    const succeeded = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: ${JSON.stringify(sentinel)}, cleanupFailed: false, close: async () => undefined, journeyError: undefined, writeSuccess: () => console.log("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK") });`,
      ],
      { encoding: "utf8" },
    );
    expect(succeeded.status).toBe(0);
    const succeededOutput = `${succeeded.stdout}${succeeded.stderr}`;
    expect(succeededOutput).toContain("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK");
    expect(succeededOutput).not.toContain(sentinel);
  }, 30_000);

  it("preserves safe relationship journey failure codes after cleanup", async () => {
    for (const failureCode of [
      "RELATIONSHIP_UI_RENDER",
      "RELATIONSHIP_UI_RENDER_NAVIGATE",
      "RELATIONSHIP_UI_RENDER_HEADING",
      "RELATIONSHIP_UI_RENDER_ASSIGNMENT",
      "RELATIONSHIP_UI_RENDER_NORMAL_END_GUARD",
      "RELATIONSHIP_UI_END",
      "RELATIONSHIP_UI_END_DIALOG",
      "RELATIONSHIP_UI_END_MUTATION_RELOAD",
      "RELATIONSHIP_UI_END_MUTATION",
      "RELATIONSHIP_UI_END_RELOAD",
      "RELATIONSHIP_UI_ASSIGN",
      "RELATIONSHIP_UI_ASSIGN_MUTATION",
      "RELATIONSHIP_UI_ASSIGN_RELOAD",
      "RELATIONSHIP_UI_READINESS",
      "HOUSEKEEPING_ASSIGNMENTS_AFTER_RELATIONSHIP_UI",
    ]) {
      await expect(
        finalizePreviewSmoke({
          cleanupReference: "safe-ref",
          cleanupFailed: false,
          close: async () => undefined,
          journeyError: new Error("private runtime detail"),
          journeyFailureCode: failureCode,
          writeSuccess: () => undefined,
        }),
      ).rejects.toThrow(`PREVIEW_ACCOUNT_JOURNEY_FAILED_${failureCode}`);
    }
  });

  it("preserves only validated inspection loader diagnostics after cleanup", async () => {
    for (const safeCode of [
      "INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE_AUTH_HEADING",
      "INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE_NO_HEADING",
      "INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE_PASSWORD_HEADING",
      "INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE_UNEXPECTED_ALERT",
      "INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE_UNEXPECTED_HEADING",
      "INSPECTION_CHECKLIST_V2_UI_HOTEL_ERROR_BOUNDARY",
      "INSPECTION_CHECKLIST_V2_UI_PREFLIGHT",
      "INSPECTION_CHECKLIST_V2_UI_PREFLIGHT_CANDIDATES",
      "INSPECTION_CHECKLIST_V2_UI_PREFLIGHT_CHECKLIST",
      "INSPECTION_CHECKLIST_V2_UI_PREFLIGHT_DEFAULT",
      "INSPECTION_CHECKLIST_V2_UI_PREFLIGHT_DEFINITIONS",
      "INSPECTION_CHECKLIST_V2_UI_PREFLIGHT_ROUTINES",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_UNCLASSIFIED",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_CONFIGURATION_DEFINITIONS_403_FORBIDDEN",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_409_INTERNAL_ERROR",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_502_INTERNAL_ERROR",
    ]) {
      await expect(
        finalizePreviewSmoke({
          cleanupReference: "safe-ref",
          cleanupFailed: false,
          close: async () => undefined,
          journeyError: new Error("private runtime detail"),
          journeyFailureCode: safeCode,
          writeSuccess: () => undefined,
        }),
      ).rejects.toThrow(`PREVIEW_ACCOUNT_JOURNEY_FAILED_${safeCode}`);
    }

    for (const unsafeCode of [
      "INSPECTION_CHECKLIST_V2_UI_PREFLIGHT_SECRETS",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_SECRETS_403_FORBIDDEN",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_200_OK",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_503_BAD-CODE",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_503_NOT_A_REAL_API_CODE",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_503_FORBIDDEN",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_ROOMS_500_AUTHENTICATION_REQUIRED",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_CONFIGURATION_DEFINITIONS_409_INTERNAL_ERROR",
      "INSPECTION_CHECKLIST_V2_UI_SERVER_CONFIGURATION_DEFINITIONS_502_INTERNAL_ERROR",
    ]) {
      await expect(
        finalizePreviewSmoke({
          cleanupReference: "safe-ref",
          cleanupFailed: false,
          close: async () => undefined,
          journeyError: new Error("private runtime detail"),
          journeyFailureCode: unsafeCode,
          writeSuccess: () => undefined,
        }),
      ).rejects.toThrow("PREVIEW_ACCOUNT_JOURNEY_FAILED_UNCLASSIFIED");
    }
  });

  it("sets checklist canonical comparison stage before receipt parsing", () => {
    const compareStagePosition = source.indexOf(
      'journeyFailureCode = "INSPECTION_CHECKLIST_V2_CANONICAL_COMPARE"',
    );
    const receiptItemParsingPosition = source.indexOf(
      "const ids = receipt?.items?.map((item) => item.itemId) ?? [];",
    );
    expect(compareStagePosition).toBeGreaterThan(-1);
    expect(receiptItemParsingPosition).toBeGreaterThan(compareStagePosition);
  });

  it("verifies canonical housekeeping multi-hotel material fields", () => {
    const attemptPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_CREATE_ATTEMPT_READBACK"',
    );
    const identityPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_CREATE_IDENTITY_MATCH"',
    );
    const attemptRequiredPosition = source.indexOf(
      "Created Preview account durable attempt was not observable",
    );
    const schemaPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_CREATE_RESPONSE_SCHEMA"',
    );
    expect(attemptPosition).toBeGreaterThan(-1);
    expect(attemptRequiredPosition).toBeGreaterThan(attemptPosition);
    expect(identityPosition).toBeGreaterThan(attemptRequiredPosition);
    expect(schemaPosition).toBeGreaterThan(identityPosition);
    expect(source).toContain('.replace(/[^A-Za-z0-9]/gu, "")');
    expect(source).toContain("const loginName = `p${runSuffix}`.slice(0, 30)");
    expect(source).toContain("!hotelIds.includes(account.hotelId)");
    expect(source).toContain("!hotelIds.includes(detailAccount.hotelId)");
    expect(source).toContain("status, must_change_password");
    expect(source).toContain("activatedState.must_change_password !== false");
    expect(source).not.toContain("activatedAccount.mustChangePassword");
    expect(source).toContain("async function verifyHostedCustomLogin");
    expect(source).toMatch(
      /context\.request\.get\(\s*`\$\{baseUrl\}\/api\/auth\/session`/u,
    );
    expect(source).toContain("const denialHasNoPrincipal");
    expect(source).toContain('path === "/api/admin/users"');
    expect(source).toContain('journeyFailureCode === "ACCOUNT_CREATE"');
    expect(source).toContain("accountCreateCodes.has(code)");
    expect(source).toContain(
      'journeyFailureCode === "ACCOUNT_CREATE_INTERNAL_ERROR"',
    );
    expect(source).toContain(
      "accountCreateSagaStatuses.has(attempt.attemptStatus)",
    );
    expect(source).toContain("result?.identity_id");
    expect(source).toContain("uuidPattern.test(result.company_id");
    expect(source).toContain(
      'typeof result.must_change_password !== "boolean"',
    );
    expect(source).toContain(
      "const legacyAlias = `${loginName.slice(0, -1)}-${loginName.slice(-1)}`",
    );
    expect(source).toContain(
      "Rejected legacy login alias issued a hotel session",
    );
    expect(source).not.toContain("const loginName = `preview-smoke-");
    expect(source).toContain('userType: "HOUSEKEEPING"');
    expect(source).toContain("hotelIds.length !== 2");
    expect(source).toContain("new Set(hotelIds).size !== 2");
    expect(source).toContain("account.displayName !== displayName");
    expect(source).toContain("account.email !== email");
    expect(source).toContain('account.userType !== "HOUSEKEEPING"');
    expect(source).toContain(
      "JSON.stringify(createdHotelIds) !== JSON.stringify(hotelIds)",
    );
    expect(source).toContain(
      "JSON.stringify(detailHotelIds) !== JSON.stringify(hotelIds)",
    );
    expect(source).toContain("from public.housekeeping_hotel_links");
    expect(() =>
      assertHousekeepingAssignmentRows(
        [
          {
            branch_id: "hotel-a",
            reason: "expected reason",
            start_date: "2026-07-21",
          },
          {
            branch_id: "hotel-b",
            reason: "wrong reason",
            start_date: "2026-07-21",
          },
        ],
        {
          expectedHotelIds: ["hotel-a", "hotel-b"],
          expectedReason: "expected reason",
          expectedStartDate: "2026-07-21",
        },
      ),
    ).toThrow("Preview housekeeping assignment persistence mismatch");
    expect(source).toContain(
      "public.api_current_company_id() as context_company_id",
    );
    expect(source).toContain("row?.context_company_id !== companyId");
  });

  it("does not register a reload waiter for a rejected hosted mutation", async () => {
    const events: string[] = [];
    await expect(
      runHostedMutationWithReload({
        acceptedStatuses: [200],
        beforeReload: async () => {
          events.push("before-reload");
        },
        click: async () => {
          events.push("click");
        },
        label: "hosted end",
        onFailure: (failure: { kind: string; status?: number }) => {
          events.push(`failure-${failure.kind}-${failure.status ?? "none"}`);
          throw new Error("sync diagnostic hook failed");
        },
        waitForReload: async () => {
          events.push("reload");
        },
        waitForResponse: async () => {
          events.push("response");
          return { status: () => 409 };
        },
      }),
    ).rejects.toThrow("hosted end failed (409)");
    expect(events).toEqual(["response", "click", "failure-status-409"]);
  });

  it("settles the response waiter after click rejection before browser-style cleanup", async () => {
    const events: string[] = [];
    try {
      await expect(
        runHostedMutation({
          acceptedStatuses: [200],
          click: async () => {
            events.push("click-rejected");
            throw new Error("click failed");
          },
          label: "hosted readiness",
          onFailure: (failure: { kind: string; status?: number }) => {
            events.push(`failure-${failure.kind}`);
            throw new Error("sync diagnostic hook failed");
          },
          waitForResponse: () =>
            new Promise((_, reject) => {
              setTimeout(() => {
                events.push("response-rejected");
                reject(new Error("response waiter closed"));
              }, 0);
            }),
        }),
      ).rejects.toThrow("click failed");
    } finally {
      events.push("close");
    }
    expect(events).toEqual([
      "click-rejected",
      "response-rejected",
      "failure-click",
      "close",
    ]);
  });

  it("settles response timeout before browser-style cleanup", async () => {
    const events: string[] = [];
    try {
      await expect(
        runHostedMutation({
          acceptedStatuses: [200],
          click: async () => {
            events.push("click");
          },
          label: "hosted readiness",
          onFailure: (failure: { kind: string; status?: number }) => {
            events.push(`failure-${failure.kind}`);
            throw new Error("sync diagnostic hook failed");
          },
          waitForResponse: async () => {
            events.push("response-timeout");
            throw new Error("response timeout");
          },
        }),
      ).rejects.toThrow("response timeout");
    } finally {
      events.push("close");
    }
    expect(events).toEqual([
      "response-timeout",
      "click",
      "failure-response",
      "close",
    ]);
  });

  it("settles reload failure before browser-style cleanup", async () => {
    const events: string[] = [];
    try {
      await expect(
        runHostedMutationWithReload({
          acceptedStatuses: [200],
          beforeReload: async () => {
            events.push("before-reload");
          },
          click: async () => {
            events.push("click");
          },
          label: "hosted assignment",
          waitForReload: async () => {
            events.push("reload");
            throw new Error("reload failed");
          },
          waitForResponse: async () => {
            events.push("response");
            return { status: () => 200 };
          },
        }),
      ).rejects.toThrow("reload failed");
    } finally {
      events.push("close");
    }
    expect(events).toEqual([
      "response",
      "click",
      "before-reload",
      "reload",
      "close",
    ]);
  });

  it("exercises hosted relationship termination, privacy-minimal reassignment, and fail-closed readiness", () => {
    const relationshipPosition = source.indexOf(
      'journeyFailureCode = "RELATIONSHIP_MANAGEMENT_UI"',
    );
    const reassignmentReadbackPosition = source.indexOf(
      'journeyFailureCode = "HOUSEKEEPING_ASSIGNMENTS_AFTER_RELATIONSHIP_UI"',
    );
    const deactivationPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_DEACTIVATE"',
    );
    expect(source).toContain(
      "async function verifyHostedRelationshipManagement",
    );
    for (const failureCode of [
      "RELATIONSHIP_UI_RENDER_NAVIGATE",
      "RELATIONSHIP_UI_RENDER_HEADING",
      "RELATIONSHIP_UI_RENDER_ASSIGNMENT",
      "RELATIONSHIP_UI_RENDER_NORMAL_END_GUARD",
      "RELATIONSHIP_UI_END_DIALOG",
      "RELATIONSHIP_UI_END_MUTATION",
      "RELATIONSHIP_UI_END_RELOAD",
      "RELATIONSHIP_UI_ASSIGN",
      "RELATIONSHIP_UI_ASSIGN_MUTATION",
      "RELATIONSHIP_UI_ASSIGN_RELOAD",
      "RELATIONSHIP_UI_READINESS",
      "HOUSEKEEPING_ASSIGNMENTS_AFTER_RELATIONSHIP_UI",
    ]) {
      expect(source).toContain(`journeyFailureCode = "${failureCode}"`);
      expect(helperSource).toContain(`"${failureCode}"`);
    }
    expect(source).toContain("await context.addInitScript");
    expect(source).toContain("const waitForRelationshipReload = async () =>");
    expect(
      source.match(/waitForReload: waitForRelationshipReload/g),
    ).toHaveLength(2);
    expect(source).not.toContain("page.waitForNavigation");
    expect(source).toContain("await context.addCookies");
    expect(source).toMatch(
      /relationshipHeading\.waitFor[\s\S]*?targetAssignment\.waitFor\(\{ state: "visible", timeout: hostedUiTimeoutMs \}\)[\s\S]*?targetAssignment\.count\(\)/u,
    );
    expect(source).toContain('{ name: "정상 종료" }');
    expect(source).toContain('label: "Hosted relationship emergency end"');
    expect(source).toContain(
      "Hosted relationship candidate UI exposed private identity data",
    );
    expect(source).toContain('label: "Hosted relationship assignment"');
    expect(source).toContain(
      "const assignmentStartDate = new Date().toISOString().slice(0, 10)",
    );
    expect(source).toMatch(
      /getByLabel\("관계유형"\)\.selectOption\("HOUSEKEEPING"\)[\s\S]*?getByLabel\("시작일", \{ exact: true \}\)\s*\.fill\(assignmentStartDate\)[\s\S]*?getByLabel\("후보 이름 검색"\)/u,
    );
    expect(source).toContain(
      'label: "Hosted activation readiness did not fail closed"',
    );
    expect(source).toMatch(
      /acceptedStatuses: \[409\][\s\S]*?label: "Hosted activation readiness did not fail closed"/u,
    );
    expect(relationshipPosition).toBeGreaterThan(-1);
    expect(reassignmentReadbackPosition).toBeGreaterThan(relationshipPosition);
    expect(deactivationPosition).toBeGreaterThan(reassignmentReadbackPosition);
  });

  it("discovers an ambiguous create from its durable attempt before the user row exists", async () => {
    const attempt = {
      attemptStatus: "DISPATCHED",
      id: "account-id",
      providerSubject: null,
      requestEmail: "preview@example.invalid",
      requestLoginName: "preview-login",
      userStatus: null,
      userVersion: null,
    };
    const reads = [undefined, attempt];
    const waits: number[] = [];
    const discovered = await discoverCleanupAttempt({
      attempts: 3,
      expectedEmail: "preview@example.invalid",
      expectedLoginName: "preview-login",
      read: async () => reads.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(discovered).toEqual({
      ...attempt,
      providerSubject: "account-id",
    });
    expect(waits).toEqual([1]);
  });

  it("rejects an API create response ID that differs from the durable attempt", () => {
    expect(() =>
      assertCreateResponseMatchesAttempt(
        { id: "existing-account-id" },
        { id: "durable-preview-account-id" },
      ),
    ).toThrow("Created Preview account did not match its durable attempt");
  });

  it("cleans only the durable target after a wrong create response ID", async () => {
    const calls: string[] = [];
    const attempt = {
      attemptStatus: "COMPLETED",
      id: "durable-preview-account-id",
      providerSubject: "durable-preview-account-id",
      userStatus: "ACTIVE",
    };
    const result = await orchestratePreviewAccountCleanup({
      cleanupDatabase: async (targetId: string) => {
        calls.push(`database:${targetId}`);
      },
      cleanupProvider: async (subject: string) => {
        calls.push(`provider:${subject}`);
      },
      discoverAttempt: async () => attempt,
      refreshAttempt: async () => attempt,
      requireAttempt: true,
      responseAccountId: "existing-account-id",
    });

    expect(result).toEqual({
      databaseCleanupComplete: true,
      responseIdMatched: false,
      targetId: "durable-preview-account-id",
    });
    expect(calls).toEqual([
      "database:durable-preview-account-id",
      "provider:durable-preview-account-id",
    ]);
    expect(calls.join("|")).not.toContain("existing-account-id");
  });

  it("cleans a canonical user that appears during provider cleanup", async () => {
    const calls: string[] = [];
    const initialAttempt = {
      attemptStatus: "DISPATCHED",
      id: "durable-preview-account-id",
      providerSubject: "durable-preview-account-id",
      userStatus: null,
    };
    const finalAttempt = {
      ...initialAttempt,
      attemptStatus: "COMPLETED",
      userStatus: "PENDING_SETUP",
    };
    await orchestratePreviewAccountCleanup({
      cleanupDatabase: async (targetId: string) => {
        calls.push(`database:${targetId}`);
      },
      cleanupProvider: async (subject: string) => {
        calls.push(`provider:${subject}`);
      },
      discoverAttempt: async () => initialAttempt,
      refreshAttempt: async () => finalAttempt,
      requireAttempt: true,
      responseAccountId: undefined,
    });

    expect(calls).toEqual([
      "provider:durable-preview-account-id",
      "database:durable-preview-account-id",
    ]);
  });

  it("fails closed when a started create has no observable durable attempt", async () => {
    await expect(
      orchestratePreviewAccountCleanup({
        cleanupDatabase: async () => undefined,
        cleanupProvider: async () => undefined,
        discoverAttempt: async () => undefined,
        refreshAttempt: async () => undefined,
        requireAttempt: true,
        responseAccountId: undefined,
      }),
    ).rejects.toThrow("Preview account cleanup attempt was not observable");
  });

  it("re-reads the current PostgreSQL version until deactivation is durable", async () => {
    const states = [
      { id: "account-id", status: "ACTIVE", version: 4 },
      { id: "account-id", status: "ACTIVE", version: 5 },
      { id: "account-id", status: "INACTIVE", version: 6 },
    ];
    const versions: number[] = [];
    const result = await ensureDatabaseInactive({
      attempts: 3,
      deactivate: async (state: { version: number }) => {
        versions.push(state.version);
        if (state.version === 4) throw new Error("VERSION_CONFLICT");
      },
      read: async () => states.shift(),
      wait: async () => undefined,
      waitMilliseconds: 0,
    });

    expect(result).toEqual({
      id: "account-id",
      status: "INACTIVE",
      version: 6,
    });
    expect(versions).toEqual([4, 5]);
  });

  it("fails closed when database deactivation never reaches INACTIVE", async () => {
    await expect(
      ensureDatabaseInactive({
        attempts: 2,
        deactivate: async () => {
          throw new Error("provider enqueue failed");
        },
        read: async () => ({
          id: "account-id",
          status: "ACTIVE",
          version: 4,
        }),
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account cleanup deactivation failed");
  });

  it("fails closed when database cleanup state cannot be read", async () => {
    await expect(
      ensureDatabaseInactive({
        attempts: 2,
        deactivate: async () => undefined,
        read: async () => {
          throw new Error("database unavailable");
        },
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account cleanup deactivation failed");
  });

  it("polls eventual provider deactivation instead of requiring an immediate state", async () => {
    const states = [
      "USER_STATE_ACTIVE",
      "USER_STATE_ACTIVE",
      "USER_STATE_INACTIVE",
    ];
    const result = await waitForProviderInactive({
      attempts: 3,
      expectedOrganizationId: "organization-id",
      expectedSubject: "provider-subject",
      read: async () => ({
        user: {
          details: { resourceOwner: "organization-id" },
          state: states.shift(),
          userId: "provider-subject",
        },
      }),
      wait: async () => undefined,
      waitMilliseconds: 0,
    });

    expect(result.user.state).toBe("USER_STATE_INACTIVE");
  });

  it("deactivates a provider user that appears after an initial 404", async () => {
    const states = [
      { absent: true },
      {
        user: {
          details: { resourceOwner: "organization-id" },
          state: "USER_STATE_ACTIVE",
          userId: "provider-subject",
        },
      },
      {
        user: {
          details: { resourceOwner: "organization-id" },
          state: "USER_STATE_INACTIVE",
          userId: "provider-subject",
        },
      },
    ];
    let deactivateCalls = 0;
    const waits: number[] = [];
    const result = await waitForProviderInactive({
      allowAbsent: true,
      attempts: 3,
      deactivate: async () => {
        deactivateCalls += 1;
      },
      expectedOrganizationId: "organization-id",
      expectedSubject: "provider-subject",
      read: async () => states.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(result.user.state).toBe("USER_STATE_INACTIVE");
    expect(deactivateCalls).toBe(1);
    expect(waits).toEqual([1, 1]);
  });

  it("accepts provider absence only after exhausting the grace window", async () => {
    const waits: number[] = [];
    const result = await waitForProviderInactive({
      allowAbsent: true,
      attempts: 3,
      expectedOrganizationId: "organization-id",
      expectedSubject: "provider-subject",
      read: async () => ({ absent: true }),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(result).toEqual({ absent: true });
    expect(waits).toEqual([1, 1]);
  });

  it("waits for a deleted provider verification session to disappear", async () => {
    const statuses = [200, 200, 404];
    const waits: number[] = [];
    const result = await waitForProviderSessionGone({
      attempts: 3,
      read: async () => statuses.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(result).toBe(404);
    expect(waits).toEqual([1, 1]);
  });

  it("fails closed when a deleted provider session remains readable", async () => {
    await expect(
      waitForProviderSessionGone({
        attempts: 2,
        read: async () => 200,
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview provider session remained active");
  });

  it("does not write a success marker when database close fails", async () => {
    const output: string[] = [];
    await expect(
      finalizePreviewSmoke({
        cleanupFailed: false,
        close: async () => {
          throw new Error("close failed");
        },
        journeyError: undefined,
        writeSuccess: () => output.push("OK"),
      }),
    ).rejects.toThrow("PREVIEW_ACCOUNT_CLEANUP_FAILED");
    expect(output).toEqual([]);
  });

  it("does not write a success marker when cleanup is indeterminate", async () => {
    const output: string[] = [];
    await expect(
      finalizePreviewSmoke({
        cleanupFailed: true,
        close: async () => undefined,
        journeyError: new Error("provider response lost"),
        writeSuccess: () => output.push("OK"),
      }),
    ).rejects.toThrow("PREVIEW_ACCOUNT_CLEANUP_FAILED");
    expect(output).toEqual([]);
    expect(source).not.toContain("providerVerificationSession");
    expect(source).not.toContain('journeyFailureCode = "PROVIDER_SESSION_');
    expect(source).toContain("let cleanupFailed = false");
  });

  it("independently waits for active PostgreSQL sessions to reach zero", async () => {
    const counts = [1, 0];
    const waits: number[] = [];
    await waitForZeroActiveSessions({
      attempts: 2,
      read: async () => counts.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(waits).toEqual([1]);
  });

  it("fails closed when active PostgreSQL sessions never reach zero", async () => {
    await expect(
      waitForZeroActiveSessions({
        attempts: 2,
        read: async () => 1,
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account retained active sessions");
  });

  it("fails closed when active session read-back is unavailable", async () => {
    await expect(
      waitForZeroActiveSessions({
        attempts: 2,
        read: async () => {
          throw new Error("database unavailable");
        },
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview active session read-back failed");
  });

  it("fails closed when an absence is followed by cleanup lookup failures", async () => {
    let readCount = 0;
    await expect(
      discoverCleanupAttempt({
        attempts: 2,
        expectedEmail: "preview@example.invalid",
        expectedLoginName: "preview-login",
        read: async () => {
          readCount += 1;
          if (readCount === 1) return undefined;
          throw new Error("transport failed");
        },
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account cleanup attempt lookup failed");
  });

  it("fails closed when provider state never becomes inactive", async () => {
    await expect(
      waitForProviderInactive({
        attempts: 2,
        expectedOrganizationId: "organization-id",
        expectedSubject: "provider-subject",
        read: async () => ({
          user: {
            details: { resourceOwner: "organization-id" },
            state: "USER_STATE_ACTIVE",
            userId: "provider-subject",
          },
        }),
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview provider state remained active");
  });

  it("rejects a provider read-back for a different organization", async () => {
    await expect(
      waitForProviderInactive({
        attempts: 3,
        expectedOrganizationId: "organization-id",
        expectedSubject: "provider-subject",
        read: async () => ({
          user: {
            details: { resourceOwner: "different-organization" },
            state: "USER_STATE_INACTIVE",
            userId: "provider-subject",
          },
        }),
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview provider identity boundary mismatch");
  });

  it("classifies account deactivation failures with a safe stable suffix", () => {
    expect(source).toContain(
      'journeyFailureCode === "ACCOUNT_DEACTIVATE"',
    );
    for (const code of [
      "ACCOUNT_NOT_FOUND",
      "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN",
      "ACCOUNT_VERSION_CONFLICT",
      "AUTHENTICATION_REQUIRED",
      "DB_NOT_CONFIGURED",
      "EXTERNAL_AUTH_UNAVAILABLE",
      "FORBIDDEN",
      "IDEMPOTENCY_CONFLICT",
      "INTERNAL_ERROR",
      "LAST_ADMIN_DEACTIVATION_FORBIDDEN",
      "SCHEMA_NOT_READY",
      "VALIDATION_ERROR",
    ]) {
      expect(source).toContain(`"${code}"`);
    }
    expect(source).toContain("`ACCOUNT_DEACTIVATE_${safeCode}`");
  });

  it("allows only the final non-sensitive success marker in output code", () => {
    expect(source).toContain('redirect: "manual"');
    expect(source.match(/console\./gu)).toEqual(["console."]);
    expect(source).toContain("writeSuccess: () =>");
    expect(source).toContain(
      "PREVIEW_PROCESS_WORKS_UI_SMOKE_OK\\nPREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK",
    );
    expect(source).toContain("await finalizePreviewSmoke({");
    expect(`${source}\n${helperSource}`).not.toMatch(
      /process\.(?:stdout|stderr)\.write|console\.(?:error|warn|info|debug)|\b(?:logger|log)\.(?:error|warn|info|debug)\s*\(/u,
    );
  });
});
