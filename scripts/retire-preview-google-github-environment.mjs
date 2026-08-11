import { pathToFileURL } from "node:url";

export const retiredPreviewGoogleSecrets = Object.freeze([
  "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET",
  "CALENDAR_CREDENTIAL_AES_KEYRING_JSON",
  "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
]);

export const retiredPreviewGoogleVariables = Object.freeze([
  "GOOGLE_CALENDAR_OAUTH_CLIENT_ID",
  "GOOGLE_CALENDAR_OAUTH_REDIRECT_URI",
  "CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION",
  "CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION",
]);

function required(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`);
  return value;
}

function validateRepository(value) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value))
    throw new Error("GITHUB_REPOSITORY_INVALID");
  return value;
}

function validateEnvironment(value) {
  if (!/^[A-Za-z0-9_. -]{1,100}$/u.test(value))
    throw new Error("GITHUB_ENVIRONMENT_INVALID");
  return value;
}

async function statusOnlyRequest(fetcher, url, init, allowedStatuses) {
  let response;
  try {
    response = await fetcher(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("GITHUB_ENVIRONMENT_CLEANUP_OUTCOME_UNKNOWN");
  }
  if (response.status >= 300 && response.status < 400)
    throw new Error("GITHUB_ENVIRONMENT_CLEANUP_REDIRECT_REJECTED");
  if (!allowedStatuses.includes(response.status))
    throw new Error(`GITHUB_ENVIRONMENT_CLEANUP_HTTP_${response.status}`);
  return response.status;
}

function resourceUrl(repository, environment, kind, name) {
  const [owner, repo] = repository.split("/");
  return (
    "https://api.github.com/repos/" +
    `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/environments/` +
    `${encodeURIComponent(environment)}/${kind}/${encodeURIComponent(name)}`
  );
}

export async function retirePreviewGoogleEnvironment(input) {
  const repository = validateRepository(input.repository);
  const environment = validateEnvironment(input.environment);
  const fetcher = input.fetcher ?? fetch;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${input.token}`,
    "x-github-api-version": "2022-11-28",
  };
  const resources = [
    ...retiredPreviewGoogleSecrets.map((name) => ({ kind: "secrets", name })),
    ...retiredPreviewGoogleVariables.map((name) => ({
      kind: "variables",
      name,
    })),
  ];

  for (const resource of resources) {
    const url = resourceUrl(
      repository,
      environment,
      resource.kind,
      resource.name,
    );
    await statusOnlyRequest(
      fetcher,
      url,
      { method: "DELETE", headers },
      [204, 404],
    );
    const readBackStatus = await statusOnlyRequest(
      fetcher,
      url,
      { method: "GET", headers },
      [200, 404],
    );
    if (readBackStatus !== 404)
      throw new Error("GITHUB_ENVIRONMENT_RETIRED_KEY_REMAINS");
  }

  return {
    secretCount: retiredPreviewGoogleSecrets.length,
    variableCount: retiredPreviewGoogleVariables.length,
  };
}

async function main() {
  const result = await retirePreviewGoogleEnvironment({
    token: required("GH_TOKEN"),
    repository: validateRepository(required("GITHUB_REPOSITORY")),
    environment: validateEnvironment(
      process.env.GITHUB_ENVIRONMENT?.trim() || "preview",
    ),
  });
  process.stdout.write(
    `PREVIEW_GITHUB_GOOGLE_ENVIRONMENT_RETIRED secrets=${result.secretCount} variables=${result.variableCount}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const code =
      error instanceof Error && /^[A-Z0-9_]{2,100}$/u.test(error.message)
        ? error.message
        : "GITHUB_ENVIRONMENT_CLEANUP_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
