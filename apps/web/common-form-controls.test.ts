import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");
const formControls = readFileSync(new URL("./app/_components/form-controls.tsx", import.meta.url), "utf8");

describe("common form controls", () => {
  it("exposes shared form components for feature forms", () => {
    expect(formControls).toContain("export function FormField");
    expect(formControls).toContain("export function TextInput");
    expect(formControls).toContain("export function SelectInput");
    expect(formControls).toContain("export function FormSubmitButton");
  });

  it("routes work-feature native controls through common form tokens", () => {
    expect(css).toContain("--form-control-border: var(--field-border)");
    expect(css).toContain("--form-control-focus-outline");
    expect(css).toContain("--form-action-bg: var(--primary)");
    expect(css).toContain(":where(.page-shell, .feature-workspace, .surface-card, .board-workspace, .mail-compose-dialog, .mail-address-dialog, .messenger-page, .operations-page, .admin-users-page) input:not([type=\"checkbox\"])");
    expect(css).toContain(":where(.page-shell, .feature-workspace, .surface-card, .board-workspace, .mail-compose-dialog, .mail-address-dialog, .messenger-page, .operations-page, .admin-users-page) select");
    expect(css).toContain(":where(.page-shell, .feature-workspace, .surface-card, .board-workspace, .mail-compose-dialog, .mail-address-dialog, .messenger-page, .operations-page, .admin-users-page) textarea");
  });
});
