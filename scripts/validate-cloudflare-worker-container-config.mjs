import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function emptyOrAbsent(value) {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

export function validateWorkerContainerConfiguration(
  applications,
  application,
  workerSettings,
  expectedApplicationName,
) {
  if (
    !Array.isArray(applications) ||
    typeof expectedApplicationName !== "string" ||
    !/^[a-z0-9][a-z0-9-]{2,62}$/u.test(expectedApplicationName) ||
    !isPlainObject(application) ||
    !isPlainObject(workerSettings) ||
    workerSettings.success !== true ||
    !isPlainObject(workerSettings.result) ||
    !Array.isArray(workerSettings.result.bindings)
  ) {
    throw new Error("Container configuration envelope was invalid");
  }

  const matches = applications.filter(
    (candidate) =>
      isPlainObject(candidate) && candidate.name === expectedApplicationName,
  );
  if (matches.length !== 1) {
    throw new Error("Container application was unavailable or ambiguous");
  }
  const [summary] = matches;
  if (
    typeof summary.id !== "string" ||
    !/^[0-9a-f-]{32,36}$/iu.test(summary.id) ||
    typeof summary.image !== "string" ||
    summary.image.length < 1 ||
    !Number.isSafeInteger(summary.version) ||
    summary.version < 1 ||
    application.id !== summary.id ||
    application.name !== expectedApplicationName ||
    application.version !== summary.version ||
    application.max_instances !== 1 ||
    !isPlainObject(application.configuration) ||
    application.configuration.image !== summary.image ||
    application.configuration.instance_type !== "standard-1" ||
    !isPlainObject(application.configuration.wrangler_ssh) ||
    application.configuration.wrangler_ssh.enabled !== false ||
    !emptyOrAbsent(application.configuration.authorized_keys) ||
    !emptyOrAbsent(application.configuration.trusted_user_ca_keys) ||
    !emptyOrAbsent(application.configuration.ssh_public_key_ids) ||
    !isPlainObject(application.durable_objects) ||
    typeof application.durable_objects.namespace_id !== "string" ||
    !/^(?:[0-9a-f]{32}|[0-9a-f-]{36})$/iu.test(
      application.durable_objects.namespace_id,
    )
  ) {
    throw new Error(
      "Container application security or cost identity was invalid",
    );
  }

  const bindings = workerSettings.result.bindings.filter(
    (binding) =>
      isPlainObject(binding) && binding.name === "FILE_PROCESSOR_CONTAINER",
  );
  if (
    bindings.length !== 1 ||
    bindings[0].type !== "durable_object_namespace" ||
    bindings[0].class_name !== "FileProcessorContainer"
  ) {
    throw new Error("Container Durable Object binding identity was invalid");
  }
}

async function main() {
  const [listPath, infoPath, settingsPath, expectedApplicationName] =
    process.argv.slice(2);
  if (!listPath || !infoPath || !settingsPath || !expectedApplicationName) {
    throw new Error(
      "Usage: validate-cloudflare-worker-container-config.mjs <list.json> <info.json> <settings.json> <application-name>",
    );
  }
  const [applications, application, workerSettings] = await Promise.all(
    [listPath, infoPath, settingsPath].map(async (path) =>
      JSON.parse(await readFile(resolve(path), "utf8")),
    ),
  );
  validateWorkerContainerConfiguration(
    applications,
    application,
    workerSettings,
    expectedApplicationName,
  );
  process.stdout.write("WORKER_CONTAINER_CONFIGURATION_VALID\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write("Worker Container configuration validation failed.\n");
    process.exitCode = 1;
  });
}
