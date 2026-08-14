import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: render-reconciler-preview-config <input> <output>");
}

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const reconcilerHyperdriveId = required("RECONCILER_HYPERDRIVE_ID");
const previewR2BucketName = required("PREVIEW_R2_BUCKET_NAME");
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(previewR2BucketName)) {
  throw new Error("PREVIEW_R2_BUCKET_NAME was invalid");
}
const issuer = new URL(required("ZITADEL_ISSUER"));
if (issuer.protocol !== "https:")
  throw new Error("ZITADEL_ISSUER must use HTTPS");

const source = await readFile(resolve(inputPath), "utf8");
const config = JSON.parse(source.replace(/,\s*([}\]])/gu, "$1"));
config.hyperdrive = [
  { binding: "RECONCILER_HYPERDRIVE", id: reconcilerHyperdriveId },
];
config.r2_buckets = [
  { binding: "HOTEL_FILES", bucket_name: previewR2BucketName },
];
config.containers = [
  {
    class_name: "FileProcessorContainer",
    image: "../file-processor/Dockerfile",
    image_build_context: "../..",
    instance_type: "standard-1",
    max_instances: 1,
    name: "werehere-hotel-file-processor-preview",
    ssh: { enabled: false },
  },
];
config.durable_objects = {
  bindings: [
    {
      class_name: "FileProcessorContainer",
      name: "FILE_PROCESSOR_CONTAINER",
    },
  ],
};
config.migrations = [
  {
    new_sqlite_classes: ["FileProcessorContainer"],
    tag: "preview-file-processor-v1",
  },
];
config.vars = {
  ...config.vars,
  ZITADEL_ISSUER: issuer.toString().replace(/\/$/u, ""),
  ZITADEL_ORGANIZATION_ID: required("ZITADEL_ORGANIZATION_ID"),
};

await writeFile(resolve(outputPath), `${JSON.stringify(config, null, 2)}\n`);
console.log("RECONCILER_PREVIEW_CONFIG_RENDERED");
