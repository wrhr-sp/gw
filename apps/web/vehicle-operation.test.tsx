import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import VehicleOperationPage from "./app/vehicle-operation/page";
import { mobileMenuSections } from "./app/mobile-pwa-config";

describe("vehicle operation page", () => {
  it("renders the vehicle operation log entry with real API form actions", () => {
    const html = renderToStaticMarkup(<VehicleOperationPage />);

    expect(html).toContain("차량운행일지");
    expect(html).toContain("운행일지 저장");
    expect(html).toContain("주행거리(km)");
    expect(html).toContain("실제 API 저장·조회 기준");
    expect(html).not.toContain("준비중");
  });

  it("enables vehicle operation log in the mobile menu", () => {
    const vehicleMenuItem = mobileMenuSections.flatMap((section) => section.items).find((item) => item.label === "차량운행일지");

    expect(vehicleMenuItem).toMatchObject({ href: "/vehicle-operation" });
    expect(vehicleMenuItem?.disabled).toBeUndefined();
  });
});
