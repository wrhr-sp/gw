import { describe, expect, it } from "vitest";
// @ts-expect-error repository JavaScript validator intentionally has no declaration file.
import { validateWorkerContainerConfiguration } from "../../../scripts/validate-cloudflare-worker-container-config.mjs";

const appName = "werehere-hotel-file-processor-preview";
const id = "12345678-1234-4234-8234-123456789abc";
const image = "registry.cloudflare.com/example@sha256:abc";

function fixture() {
  return {
    applications: [
      {
        id,
        image,
        name: appName,
        state: "ready",
        version: 3,
      },
    ],
    application: {
      configuration: {
        authorized_keys: [],
        image,
        instance_type: "standard-1",
        ssh_public_key_ids: [],
        trusted_user_ca_keys: [],
        wrangler_ssh: { enabled: false },
      },
      durable_objects: { namespace_id: "a".repeat(32) },
      id,
      max_instances: 1,
      name: appName,
      version: 3,
    },
    workerSettings: {
      result: {
        bindings: [
          {
            class_name: "FileProcessorContainer",
            name: "FILE_PROCESSOR_CONTAINER",
            type: "durable_object_namespace",
          },
        ],
      },
      success: true,
    },
  };
}

describe("Cloudflare Worker Container configuration validator", () => {
  it("accepts one exact bounded private Container application", () => {
    const value = fixture();
    expect(() =>
      validateWorkerContainerConfiguration(
        value.applications,
        value.application,
        value.workerSettings,
        appName,
      ),
    ).not.toThrow();
  });

  for (const [name, mutate] of [
    [
      "maximum instances",
      (value: ReturnType<typeof fixture>) => {
        value.application.max_instances = 2;
      },
    ],
    [
      "instance type",
      (value: ReturnType<typeof fixture>) => {
        value.application.configuration.instance_type = "standard-2";
      },
    ],
    [
      "SSH",
      (value: ReturnType<typeof fixture>) => {
        value.application.configuration.wrangler_ssh.enabled = true;
      },
    ],
    [
      "image",
      (value: ReturnType<typeof fixture>) => {
        value.application.configuration.image = "registry.invalid/other";
      },
    ],
    [
      "Durable Object namespace",
      (value: ReturnType<typeof fixture>) => {
        value.application.durable_objects.namespace_id = "invalid";
      },
    ],
    [
      "Durable Object binding",
      (value: ReturnType<typeof fixture>) => {
        value.workerSettings.result.bindings[0]!.class_name = "OtherContainer";
      },
    ],
  ] as const) {
    it(`fails closed for a mismatched ${name}`, () => {
      const value = fixture();
      mutate(value);
      expect(() =>
        validateWorkerContainerConfiguration(
          value.applications,
          value.application,
          value.workerSettings,
          appName,
        ),
      ).toThrow();
    });
  }

  it("fails closed for a duplicate application identity", () => {
    const value = fixture();
    value.applications.push({ ...value.applications[0]! });
    expect(() =>
      validateWorkerContainerConfiguration(
        value.applications,
        value.application,
        value.workerSettings,
        appName,
      ),
    ).toThrow();
  });
});
