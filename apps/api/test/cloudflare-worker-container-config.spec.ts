import { describe, expect, it } from "vitest";
// @ts-expect-error repository JavaScript validator intentionally has no declaration file.
import { validateWorkerContainerConfiguration } from "../../../scripts/validate-cloudflare-worker-container-config.mjs";

const appName = "werehere-hotel-file-processor-preview";
const id = "12345678-1234-4234-8234-123456789abc";
const namespaceId = "a".repeat(32);
const image = `registry.cloudflare.com/example/file-processor@sha256:${"a".repeat(64)}`;

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
      durable_objects: { namespace_id: namespaceId },
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
            namespace_id: namespaceId,
            type: "durable_object_namespace",
          },
        ],
      },
      success: true,
    },
  };
}

function validate(value: ReturnType<typeof fixture>, expectedImage = image) {
  return validateWorkerContainerConfiguration(
    value.applications,
    value.application,
    value.workerSettings,
    appName,
    expectedImage,
  );
}

describe("Cloudflare Worker Container configuration validator", () => {
  it("accepts one exact digest-pinned bounded private Container application", () => {
    expect(() => validate(fixture())).not.toThrow();
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
      "deployed image",
      (value: ReturnType<typeof fixture>) => {
        value.application.configuration.image = `registry.cloudflare.com/example/other@sha256:${"b".repeat(64)}`;
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
    [
      "Durable Object namespace binding",
      (value: ReturnType<typeof fixture>) => {
        value.workerSettings.result.bindings[0]!.namespace_id = "b".repeat(32);
      },
    ],
  ] as const) {
    it(`fails closed for a mismatched ${name}`, () => {
      const value = fixture();
      mutate(value);
      expect(() => validate(value)).toThrow();
    });
  }

  it("fails closed when the expected release digest differs", () => {
    const otherImage = `registry.cloudflare.com/example/file-processor@sha256:${"b".repeat(64)}`;
    expect(() => validate(fixture(), otherImage)).toThrow();
  });

  it("fails closed for a duplicate application identity", () => {
    const value = fixture();
    value.applications.push({ ...value.applications[0]! });
    expect(() => validate(value)).toThrow();
  });
});
