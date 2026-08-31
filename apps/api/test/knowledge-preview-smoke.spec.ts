import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const smokeUrl = new URL(
  "../../../scripts/smoke-knowledge-preview.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const source = existsSync(smokeUrl) ? readFileSync(smokeUrl, "utf8") : "";
const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);

describe("hosted Preview knowledge smoke", () => {
  it("does not expose protected configuration through real process output", () => {
    const protectedValues = [
      "postgresql://preview-owner-secret.invalid/database",
      "preview-scanner-secret-value-1234567890",
      "preview-zitadel-subject-secret",
    ];
    const result = spawnSync("pnpm", ["exec", "tsx", smokePath], {
      encoding: "utf8",
      env: {
        ...process.env,
        API_RUNTIME_DATABASE_URL_FILE: "/tmp/nonexistent-preview-api-url",
        DATABASE_URL_PREVIEW: protectedValues[0],
        PREVIEW_FILE_SCANNER_AGENT_TOKEN: protectedValues[1],
        WEB_PREVIEW_URL: "http://invalid-preview.example",
        ZITADEL_PREVIEW_SUBJECT: protectedValues[2],
      },
    });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("PREVIEW_KNOWLEDGE_CONFIGURATION_INVALID");
    for (const value of protectedValues) expect(output).not.toContain(value);
  });

  it("uses separate author and reviewer sessions through the hosted API", () => {
    expect(existsSync(smokeUrl)).toBe(true);
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], { stdio: "pipe" }),
    ).not.toThrow();
    expect(() =>
      execFileSync(
        "pnpm",
        [
          "exec",
          "eslint",
          smokePath,
          "--rule",
          "no-unsafe-finally: off",
          "--rule",
          "no-undef: error",
        ],
        { cwd: repositoryRoot, stdio: "pipe" },
      ),
    ).not.toThrow();
    expect(source).toContain("auth_create_session_v2");
    expect(source).toContain("bootstrapCredential");
    expect(source).toContain("authorCredential");
    expect(source).toContain("reviewerCredential");
    expect(source).toContain("isolationCredential");
    expect(source).toContain("PREVIEW_KNOWLEDGE_ACTOR_FIXTURES_INVALID");
    expect(source).toContain("PREVIEW_KNOWLEDGE_GRANT_MATRIX_INVALID");
    expect(source).toContain("public.user_role_memberships");
    expect(source).toContain("public.user_group_memberships");
    expect(source).toContain("AUTHORITY_STILL_PRESENT");
    expect(source).toContain("KNOWLEDGE_SELF_PUBLISH_DENIED");
    expect(source).toContain("KNOWLEDGE_HIGH_RISK_PUBLISH");
    for (const action of [
      "REQUEST_REVIEW",
      "PUBLISH",
      "MARK_NEEDS_REVIEW",
      "REPUBLISH",
      "ARCHIVE",
    ])
      expect(source).toContain(action);
  });

  it("covers company and hotel scopes, PostgreSQL search, immutable history and audit read-back", () => {
    expect(source).toContain('content("COMPANY"');
    expect(source).toContain('content("HOTEL"');
    expect(source).toContain("encodeURIComponent(searchTerm)");
    expect(source).toContain("encodeURIComponent(fullToken)");
    expect(source).toContain("encodeURIComponent(partialQuery)");
    expect(source).toContain("PREVIEW_KNOWLEDGE_ISOLATION_LIST_LEAK");
    expect(source).toContain("PREVIEW_KNOWLEDGE_ISOLATION_DETAIL_LEAK");
    expect(source).toContain('error.code !== "RESOURCE_NOT_FOUND"');
    expect(source).toContain(
      'error.message !== "호텔 요청을 처리할 수 없습니다."',
    );
    expect(source).toContain("assertCanonicalHiddenNotFound(");
    expect(source.match(/assertCanonicalHiddenNotFound\(/gu)).toHaveLength(4);
    expect(source).toContain('["entries", "page", "pageSize", "totalCount"]');
    expect(source).toContain("public.hotel_knowledge_entries");
    expect(source).toContain("public.hotel_knowledge_versions");
    expect(source).toContain("public.audit_events");
    expect(source).toContain("version.attachmentFileVersionIds.length === 0");
    expect(source).toContain(
      "PREVIEW_KNOWLEDGE_COMPANY_LIFECYCLE_READBACK_INVALID",
    );
    expect(source).toContain(
      "async function verifyCompanyLifecycle(companyAttachmentFileVersionId)",
    );
    expect(source).toContain("verifyCompanyLifecycle(companyFileVersionId)");
    expect(source).toContain("COMPANY_MARK_NEEDS_REVIEW");
    expect(source).toContain(
      "PREVIEW_KNOWLEDGE_COMPANY_UPDATE_READBACK_INVALID",
    );
    expect(source).toContain("COMPANY_REREQUEST_REVIEW");
    expect(source).toContain("COMPANY_REPUBLISH");
    expect(source).toContain("PREVIEW_KNOWLEDGE_API_DB_SMOKE_OK");
    expect(source).not.toMatch(
      /delete from public\.hotel_knowledge_(?:entries|versions)/u,
    );
    expect(source).not.toMatch(/delete from public\.audit_events/u);
  });

  it("uses private R2, scanner clean read-back, stable attachment-link replay and dual read gates", () => {
    expect(source).toContain("/files/upload-init");
    expect(source).toContain('"sec-fetch-site": "same-origin"');
    expect(source).toContain("runFileScannerBatch");
    expect(source).toContain("scanWithClamAv");
    expect(source).toContain("READY_UNLINKED");
    expect(source).toContain("attachmentLinkKey");
    expect(source).toContain("attachmentLinkBody");
    expect(source).toContain("PREVIEW_KNOWLEDGE_ATTACHMENT_REPLAY_INVALID");
    expect(source).toContain("simulatePostCommitResponseLoss: true");
    expect(source).toContain(
      "PREVIEW_KNOWLEDGE_INJECTED_POST_COMMIT_RESPONSE_LOSS",
    );
    expect(source).toContain(
      "PREVIEW_KNOWLEDGE_ATTACHMENT_CARDINALITY_INVALID",
    );
    expect(source).toContain("total_attachment_count");
    expect(source).toContain("targetUrl.origin !== new URL(baseUrl).origin");
    expect(source.indexOf("targetUrl.origin")).toBeLessThan(
      source.indexOf("fetch(targetUrl"),
    );
    expect(source).toContain("KNOWLEDGE_READ");
    expect(source).toContain("HOTEL_FILE_READ");
    expect(source).toContain("viewedBody.equals(expectedOptimized.body)");
    expect(source).toContain(
      "companyViewedBody.equals(expectedOptimized.body)",
    );
    expect(source).toContain("PREVIEW_KNOWLEDGE_PRIVATE_METADATA_EXPOSED");
    expect(source).toContain("forbiddenProjectionKeys");
    expect(source).toContain(
      "for (const item of value) assertPrivateProjection(item)",
    );
    expect(source).toContain("encode(version.clean_sha256,'hex')");
    expect(source).toContain("PREVIEW_KNOWLEDGE_PRIVATE_FILE_SMOKE_OK");
  });

  it("checks real PC and 390px knowledge routes with keyboard-visible UI and Axe", () => {
    expect(source).toContain("width: 1440, height: 1000");
    expect(source).toContain("width: 390, height: 844");
    expect(source).toContain("data-knowledge-workspace");
    expect(source).toContain("new AxeBuilder({ page })");
    expect(source).toContain(
      "document.documentElement.scrollWidth > window.innerWidth",
    );
    expect(source).toContain('getByLabel("증상·상황 검색"');
    expect(source).toContain('page.keyboard.press("Tab")');
    expect(source).toContain('element.matches(":focus-visible")');
    expect(source).toContain('page.keyboard.press("Enter")');
    expect(source).toContain("PREVIEW_KNOWLEDGE_UI_SMOKE_OK");
    expect(source).not.toContain("playwright/stories");
  });

  it("is wired before and after contract with command-local secrets and exact markers", () => {
    const command = "pnpm exec tsx scripts/smoke-knowledge-preview.mjs";
    const contract = "Contract Neon Preview tenant authority";
    const step = (name: string) => {
      const start = workflow.indexOf(`      - name: ${name}`);
      const end = workflow.indexOf("\n      - name:", start + 1);
      expect(start).toBeGreaterThan(-1);
      return workflow.slice(start, end < 0 ? workflow.length : end);
    };
    const pre = step(
      "Verify hosted Preview knowledge lifecycle, search, private attachments, and responsive UI before contract",
    );
    const post = step(
      "Verify hosted Preview knowledge lifecycle, search, private attachments, and responsive UI after contract",
    );
    expect(workflow.indexOf(pre)).toBeLessThan(workflow.indexOf(contract));
    expect(workflow.indexOf(post)).toBeGreaterThan(workflow.indexOf(contract));
    for (const [block, phase] of [
      [pre, "PRE_CONTRACT"],
      [post, "POST_CONTRACT"],
    ]) {
      expect(block).toContain(command);
      expect(block).toContain(`KNOWLEDGE_SMOKE_PHASE=${phase}`);
      expect(block).toContain(`PREVIEW_KNOWLEDGE_${phase}_SMOKE_OK`);
      expect(block).toContain("PREVIEW_KNOWLEDGE_API_DB_SMOKE_OK");
      expect(block).toContain("PREVIEW_KNOWLEDGE_ISOLATION_SMOKE_OK");
      expect(block).toContain("PREVIEW_KNOWLEDGE_PRIVATE_FILE_SMOKE_OK");
      expect(block).toContain("PREVIEW_KNOWLEDGE_UI_SMOKE_OK");
      expect(block).toContain(
        "KNOWLEDGE_DATABASE_URL_PREVIEW: ${{ secrets.DATABASE_URL_PREVIEW }}",
      );
      expect(block).toContain(
        'DATABASE_URL_PREVIEW="$KNOWLEDGE_DATABASE_URL_PREVIEW"',
      );
      expect(block).toContain(
        "unset KNOWLEDGE_DATABASE_URL_PREVIEW KNOWLEDGE_FILE_SCANNER_AGENT_TOKEN KNOWLEDGE_ZITADEL_PREVIEW_SUBJECT",
      );
    }
  });
});
