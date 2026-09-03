import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));
vi.mock("../lib/inspection-settings-page-data", () => ({
  loadInspectionSettingsPageData: mocks.load,
}));
vi.mock("../components/inspections/inspection-configuration-panel", () => ({
  InspectionConfigurationPanel: () => null,
}));

import InspectionSettingsPage from "../app/hotels/[hotelId]/inspections/settings/page";

vi.stubGlobal("React", React);

const hotelId = "50000000-0000-4000-8000-000000000001";

type ConfigurationStage =
  | "CANDIDATES"
  | "CHECKLIST"
  | "DEFAULT"
  | "DEFINITIONS"
  | "ROUTINES";

function resourceNotFound(stage: ConfigurationStage, status = 404) {
  return {
    configuration: {
      code: "RESOURCE_NOT_FOUND",
      error: "리소스를 찾을 수 없습니다.",
      message: "리소스를 찾을 수 없습니다.",
      ok: false,
      retryable: false,
      stage,
      status,
    },
  };
}

describe("inspection settings not-found scope", () => {
  beforeEach(() => {
    mocks.load.mockReset();
    mocks.notFound.mockReset();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it.each(["CANDIDATES", "DEFAULT", "DEFINITIONS", "ROUTINES"] as const)(
    "preserves a %s resource 404 as a structured failure",
    async (stage) => {
      mocks.load.mockResolvedValueOnce(resourceNotFound(stage));

      const rendered = await InspectionSettingsPage({
        params: Promise.resolve({ hotelId }),
      });
      const html = renderToStaticMarkup(rendered);

      expect(mocks.notFound).not.toHaveBeenCalled();
      expect(html).toContain("점검 설정을 불러오지 못했습니다");
      expect(html).toContain(`data-error-stage="CONFIGURATION_${stage}"`);
      expect(html).toContain('data-error-status="404"');
      expect(html).toContain('data-error-code="RESOURCE_NOT_FOUND"');
    },
  );

  it("preserves a mismatched checklist resource error as a structured failure", async () => {
    mocks.load.mockResolvedValueOnce(resourceNotFound("CHECKLIST", 500));

    const rendered = await InspectionSettingsPage({
      params: Promise.resolve({ hotelId }),
    });
    const html = renderToStaticMarkup(rendered);

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(html).toContain('data-error-stage="CONFIGURATION_CHECKLIST"');
    expect(html).toContain('data-error-status="500"');
    expect(html).toContain('data-error-code="RESOURCE_NOT_FOUND"');
  });

  it("keeps a checklist resource 404 on the hotel not-found path", async () => {
    mocks.load.mockResolvedValueOnce(resourceNotFound("CHECKLIST"));

    await expect(
      InspectionSettingsPage({ params: Promise.resolve({ hotelId }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
