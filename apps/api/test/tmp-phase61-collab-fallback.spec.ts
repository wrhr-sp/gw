import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { appRoutes, authLoginResponseSchema } from "@gw/shared";

vi.mock("../src/lib/postgres", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/postgres")>("../src/lib/postgres");
  const makeQueryError = (name: string) => Object.assign(new Error(`relation \"${name}\" does not exist`), { code: "42P01" });
  const getText = (strings: TemplateStringsArray | string) => (Array.isArray(strings) ? strings.join(" ") : strings);

  return {
    ...actual,
    createOperationalSql: () => {
      const sql = ((strings: TemplateStringsArray, ..._values: unknown[]) => {
        const text = getText(strings);
        if (text.includes("boards")) throw makeQueryError("boards");
        if (text.includes("posts")) throw makeQueryError("posts");
        if (text.includes("comments")) throw makeQueryError("comments");
        if (text.includes("document_spaces")) throw makeQueryError("document_spaces");
        if (text.includes("documents")) throw makeQueryError("documents");
        if (text.includes("file_objects")) throw makeQueryError("file_objects");
        if (text.includes("read_receipts")) throw makeQueryError("read_receipts");
        if (text.includes("audit_logs")) throw makeQueryError("audit_logs");
        return [];
      }) as unknown as {
        (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
        query: (text: string, values?: unknown[]) => Promise<unknown[]>;
      };
      sql.query = async (text: string) => {
        if (text.includes("boards")) throw makeQueryError("boards");
        if (text.includes("posts")) throw makeQueryError("posts");
        if (text.includes("comments")) throw makeQueryError("comments");
        if (text.includes("document_spaces")) throw makeQueryError("document_spaces");
        if (text.includes("documents")) throw makeQueryError("documents");
        if (text.includes("file_objects")) throw makeQueryError("file_objects");
        if (text.includes("read_receipts")) throw makeQueryError("read_receipts");
        if (text.includes("audit_logs")) throw makeQueryError("audit_logs");
        return [];
      };
      return sql;
    },
  };
});

async function getFreshApp() {
  vi.resetModules();
  const mod = await import("../src/app");
  return mod.app;
}

afterEach(() => {
  vi.resetModules();
});

afterAll(() => {
  vi.doUnmock("../src/lib/postgres");
  vi.resetModules();
});

async function loginAndGetCookie(app: Awaited<ReturnType<typeof getFreshApp>>, role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });
  const payload = authLoginResponseSchema.parse(await response.json());
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("missing cookie");
  return { cookie, session: payload.data.session };
}

describe("phase61 collab fallback repro", () => {
  it("keeps boards/documents routes alive under schema drift", async () => {
    const app = await getFreshApp();
    const { cookie } = await loginAndGetCookie(app, "COMPANY_ADMIN");

    const boardsResponse = await app.request(appRoutes.boards.boards, { headers: { cookie } }, { DATABASE_URL: "postgres://example" });
    expect(boardsResponse.status).toBe(200);

    const documentsResponse = await app.request(appRoutes.documents.files, { headers: { cookie } }, { DATABASE_URL: "postgres://example" });
    expect(documentsResponse.status).toBe(200);
  });

  it("preserves collab audit entries in fallback admin audit logs", async () => {
    const app = await getFreshApp();
    const { cookie } = await loginAndGetCookie(app, "COMPANY_ADMIN");

    const createPostResponse = await app.request(appRoutes.boards.posts("board_general"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: "schema drift notice",
        bodyPreview: "fallback audit should survive",
        isNotice: false,
      }),
    });
    expect(createPostResponse.status).toBe(201);
    const createPostPayload = (await createPostResponse.json()) as {
      data: { post: { id: string } };
    };

    const createCommentResponse = await app.request(appRoutes.boards.comments(createPostPayload.data.post.id), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ body: "fallback comment" }),
    });
    expect(createCommentResponse.status).toBe(201);
    const createCommentPayload = (await createCommentResponse.json()) as {
      data: { comment: { id: string } };
    };

    const createReceiptResponse = await app.request(appRoutes.readReceipts, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        targetType: "post",
        targetId: createPostPayload.data.post.id,
      }),
    });
    expect(createReceiptResponse.status).toBe(201);

    const auditLogsResponse = await app.request(appRoutes.admin.auditLogs, { headers: { cookie } });
    expect(auditLogsResponse.status).toBe(200);
    const auditLogsPayload = (await auditLogsResponse.json()) as {
      data: { items: Array<{ action: string; targetId: string; targetType?: string }> };
    };

    expect(
      auditLogsPayload.data.items.find((item: { action: string; targetId: string; targetType?: string }) => item.action === "board.post.create" && item.targetId === createPostPayload.data.post.id)
        ?.targetType,
    ).toBe("board_policy");
    expect(
      auditLogsPayload.data.items.find((item: { action: string; targetId: string; targetType?: string }) => item.action === "board.comment.create" && item.targetId === createCommentPayload.data.comment.id)
        ?.targetType,
    ).toBe("board_policy");
    expect(
      auditLogsPayload.data.items.find((item: { action: string; targetId: string; targetType?: string }) => item.action === "read_receipt.create" && item.targetId === createPostPayload.data.post.id)
        ?.targetType,
    ).toBe("board_policy");
  });
});
