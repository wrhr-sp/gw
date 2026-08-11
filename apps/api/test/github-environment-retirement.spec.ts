import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

type RetirementModule = {
  retiredPreviewGoogleSecrets: readonly string[];
  retiredPreviewGoogleVariables: readonly string[];
  retirePreviewGoogleEnvironment(input: {
    token: string;
    repository: string;
    environment: string;
    fetcher: typeof fetch;
  }): Promise<{ secretCount: number; variableCount: number }>;
};

const scriptPath = fileURLToPath(
  new URL(
    "../../../scripts/retire-preview-google-github-environment.mjs",
    import.meta.url,
  ),
);
let subject: RetirementModule;

beforeAll(async () => {
  subject = (await import(pathToFileURL(scriptPath).href)) as RetirementModule;
});

describe("Preview GitHub Google environment retirement", () => {
  it("deletes every approved name and confirms each one absent without reading bodies", async () => {
    const requests: Array<[string, RequestInit | undefined]> = [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push([String(input), init]);
        return new Response(null, {
          status: init?.method === "DELETE" ? 204 : 404,
        });
      },
    );

    await expect(
      subject.retirePreviewGoogleEnvironment({
        token: "ephemeral-admin-token",
        repository: "wrhr-sp/gw",
        environment: "preview",
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toEqual({ secretCount: 3, variableCount: 4 });

    const expectedNames = [
      ...subject.retiredPreviewGoogleSecrets,
      ...subject.retiredPreviewGoogleVariables,
    ];
    expect(requests).toHaveLength(expectedNames.length * 2);
    for (const [index, name] of expectedNames.entries()) {
      const deletion = requests[index * 2];
      const readBack = requests[index * 2 + 1];
      expect(deletion?.[0]).toContain(encodeURIComponent(name));
      expect(deletion?.[1]?.method).toBe("DELETE");
      expect(readBack?.[0]).toBe(deletion?.[0]);
      expect(readBack?.[1]?.method).toBe("GET");
      expect(deletion?.[1]?.headers).toMatchObject({
        authorization: "Bearer ephemeral-admin-token",
      });
    }

    const source = readFileSync(scriptPath, "utf8");
    expect(source).not.toMatch(
      /response\.(?:json|text|arrayBuffer|blob)\s*\(/u,
    );
  });

  it("fails closed when a retired name remains after deletion", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Response(null, {
          status: init?.method === "DELETE" ? 204 : 200,
        }),
    );
    await expect(
      subject.retirePreviewGoogleEnvironment({
        token: "ephemeral-admin-token",
        repository: "wrhr-sp/gw",
        environment: "preview",
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toThrow("GITHUB_ENVIRONMENT_RETIRED_KEY_REMAINS");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects redirects and hides transport details", async () => {
    await expect(
      subject.retirePreviewGoogleEnvironment({
        token: "ephemeral-admin-token",
        repository: "wrhr-sp/gw",
        environment: "preview",
        fetcher: (async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://untrusted.invalid" },
          })) as typeof fetch,
      }),
    ).rejects.toThrow("GITHUB_ENVIRONMENT_CLEANUP_REDIRECT_REJECTED");

    await expect(
      subject.retirePreviewGoogleEnvironment({
        token: "ephemeral-admin-token",
        repository: "wrhr-sp/gw",
        environment: "preview",
        fetcher: (async () => {
          throw new Error("network and token detail must not escape");
        }) as typeof fetch,
      }),
    ).rejects.toThrow("GITHUB_ENVIRONMENT_CLEANUP_OUTCOME_UNKNOWN");
  });

  it("validates repository and environment before any API request", async () => {
    const fetcher = vi.fn();
    await expect(
      subject.retirePreviewGoogleEnvironment({
        token: "ephemeral-admin-token",
        repository: "invalid",
        environment: "preview",
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toThrow("GITHUB_REPOSITORY_INVALID");
    await expect(
      subject.retirePreviewGoogleEnvironment({
        token: "ephemeral-admin-token",
        repository: "wrhr-sp/gw",
        environment: "../production",
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toThrow("GITHUB_ENVIRONMENT_INVALID");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails safely before token use when invoked without configuration", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      env: {
        HOME: process.env.HOME ?? "",
        PATH: process.env.PATH ?? "",
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("GH_TOKEN_NOT_CONFIGURED\n");
    expect(result.stderr).not.toMatch(/node_modules|ERR_MODULE|Bearer/u);
  });
});
