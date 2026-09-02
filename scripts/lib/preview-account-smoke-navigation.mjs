import { errors as playwrightErrors } from "@playwright/test";

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
    if (attempt === 3) {
      throw new Error(
        outcome === "failure"
          ? "Hosted checklist UI server render failed"
          : "Hosted checklist UI heading was unavailable",
      );
    }
    await page.waitForTimeout(attempt * 2_000);
    assertBoundary();
  }
}
