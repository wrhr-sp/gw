import { describe, expect, it } from "vitest";
// prettier-ignore
// @ts-expect-error Root validator is executable JavaScript outside the TS workspace.
import { validateWorkerR2Binding } from "../../../scripts/validate-cloudflare-worker-r2-binding.mjs";

const bucketName = "werehere-hotel-files-preview";

function envelope(bindings: unknown[]) {
  return { result: { bindings }, success: true };
}

describe("Cloudflare Worker private R2 binding validation", () => {
  it("accepts one exact private bucket binding", () => {
    expect(
      validateWorkerR2Binding(
        envelope([
          {
            bucket_name: bucketName,
            name: "HOTEL_FILES",
            type: "r2_bucket",
          },
        ]),
        "HOTEL_FILES",
        bucketName,
      ),
    ).toBe(bucketName);
  });

  it.each([
    envelope([]),
    envelope([{ bucket_name: bucketName, name: "OTHER", type: "r2_bucket" }]),
    envelope([
      {
        bucket_name: "another-bucket",
        name: "HOTEL_FILES",
        type: "r2_bucket",
      },
    ]),
    envelope([
      {
        bucket_name: bucketName,
        name: "HOTEL_FILES",
        type: "plain_text",
      },
    ]),
    envelope([
      { bucket_name: bucketName, name: "HOTEL_FILES", type: "r2_bucket" },
      { bucket_name: bucketName, name: "HOTEL_FILES", type: "r2_bucket" },
    ]),
  ])("fails closed for missing, wrong, or ambiguous bindings", (value) => {
    expect(() =>
      validateWorkerR2Binding(value, "HOTEL_FILES", bucketName),
    ).toThrow();
  });
});
