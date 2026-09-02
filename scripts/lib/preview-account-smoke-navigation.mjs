import { errors as playwrightErrors } from "@playwright/test";

const inspectionFailureStages = new Set([
  "CONFIGURATION_CHECKLIST",
  "CONFIGURATION_DEFINITIONS",
  "CONFIGURATION_DEFAULT",
  "CONFIGURATION_CANDIDATES",
  "CONFIGURATION_ROUTINES",
  "CONFIGURATION_RESPONSE_SCHEMA",
  "ROOMS",
  "FACILITIES",
]);
const inspectionFailureStatuses = new Map([
  ["AUTHENTICATION_REQUIRED", new Set(["401"])],
  ["AUTH_RATE_LIMITED", new Set(["429"])],
  ["DB_NOT_CONFIGURED", new Set(["503"])],
  ["FORBIDDEN", new Set(["403"])],
  ["INTERNAL_ERROR", new Set(["409", "500", "502", "503"])],
  ["INVALID_ERROR_RESPONSE", new Set(["502", "503"])],
  ["INVALID_RESPONSE", new Set(["502"])],
  ["PROCESS_DEFAULT_REQUIRED", new Set(["422"])],
  ["RESOURCE_NOT_FOUND", new Set(["404"])],
  ["SCHEMA_NOT_READY", new Set(["503"])],
  ["VALIDATION_ERROR", new Set(["400", "422"])],
]);

function matchesInspectionFailurePair(stage, status, code) {
  if (!inspectionFailureStatuses.get(code)?.has(status)) return false;
  if (code === "INTERNAL_ERROR" && (status === "409" || status === "502"))
    return stage === "ROOMS" || stage === "FACILITIES";
  return true;
}

function previewNavigationFailure(previewFailureCode, message) {
  const error = new Error(message);
  error.previewFailureCode = previewFailureCode;
  return error;
}

async function classifiedServerFailure(page) {
  const failure = page.locator('section[role="alert"]').first();
  if ((await failure.count()) !== 1) {
    return {
      error: previewNavigationFailure(
        "INSPECTION_CHECKLIST_V2_UI_SERVER_UNCLASSIFIED",
        "Hosted checklist UI server render failed",
      ),
      retryable: false,
    };
  }
  const [stage, status, code] = await Promise.all([
    failure.getAttribute("data-error-stage"),
    failure.getAttribute("data-error-status"),
    failure.getAttribute("data-error-code"),
  ]);
  if (
    stage &&
    inspectionFailureStages.has(stage) &&
    status &&
    code &&
    matchesInspectionFailurePair(stage, status, code)
  ) {
    const error = previewNavigationFailure(
      `INSPECTION_CHECKLIST_V2_UI_SERVER_${stage}_${status}_${code}`,
      "Hosted checklist UI server render failed",
    );
    return { error, retryable: status.startsWith("5") };
  }
  return {
    error: previewNavigationFailure(
      "INSPECTION_CHECKLIST_V2_UI_SERVER_UNCLASSIFIED",
      "Hosted checklist UI server render failed",
    ),
    retryable: false,
  };
}

export async function navigateInspectionSettings({
  baseUrl,
  headingTimeoutMs = 30_000,
  hotelId,
  navigationTimeoutMs,
  page,
}) {
  const targetUrl = `${baseUrl}/hotels/${encodeURIComponent(hotelId)}/inspections/settings`;
  const expectedUrl = new URL(targetUrl);
  const assertBoundary = () => {
    const current = new URL(page.url());
    if (
      current.origin !== expectedUrl.origin ||
      current.pathname !== expectedUrl.pathname ||
      current.search !== expectedUrl.search ||
      current.hash !== expectedUrl.hash
    ) {
      throw new Error("Hosted checklist UI navigation boundary failed");
    }
  };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: navigationTimeoutMs,
    });
    assertBoundary();
    let headingHandle;
    try {
      headingHandle = await page.waitForFunction(
        () => {
          const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
            .map((heading) => heading.textContent?.trim())
            .filter(Boolean);
          if (headings.includes("점검 설정")) return "ready";
          if (headings.includes("점검 설정을 불러오지 못했습니다"))
            return "failure";
          if (headings.includes("호텔 화면을 불러오지 못했습니다"))
            return "hotel-error";
          return null;
        },
        undefined,
        { timeout: headingTimeoutMs },
      );
    } catch (error) {
      assertBoundary();
      if (!(error instanceof playwrightErrors.TimeoutError)) throw error;
    }
    const outcome = headingHandle ? await headingHandle.jsonValue() : null;
    assertBoundary();
    if (outcome === "ready") return;
    if (outcome === "hotel-error") {
      throw previewNavigationFailure(
        "INSPECTION_CHECKLIST_V2_UI_HOTEL_ERROR_BOUNDARY",
        "Hosted hotel route error boundary rendered",
      );
    }
    if (outcome === "failure") {
      const classified = await classifiedServerFailure(page);
      if (!classified.retryable || attempt === 3) throw classified.error;
    } else if (attempt === 3) {
      throw previewNavigationFailure(
        "INSPECTION_CHECKLIST_V2_UI_HEADING_UNAVAILABLE",
        "Hosted checklist UI heading was unavailable",
      );
    }
    await page.waitForTimeout(attempt * 2_000);
    assertBoundary();
  }
}
