import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { appRoutes, authLoginResponseSchema } from "@gw/shared";

async function loginAndGetCookie(role = "EMPLOYEE") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({
      loginId: "admin",
      password: "1234",
    }),
  });

  authLoginResponseSchema.parse(await response.json());
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("missing cookie");
  return cookie;
}

describe("phase32 production DB guard", () => {
  it("does not append posts to in-memory fallback storage when PostgreSQL is not configured", async () => {
    const cookie = await loginAndGetCookie();

    const first = await app.request(appRoutes.boards.posts("board_general"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title: "첫 글", bodyPreview: "A", isNotice: false }),
    });
    expect(first.status).toBe(503);
    const firstPayload = (await first.json()) as { error: { code: string } };
    expect(firstPayload.error.code).toBe("DB_NOT_CONFIGURED");

    const list = await app.request(appRoutes.boards.posts("board_general"), {
      headers: { cookie },
    });
    expect(list.status).toBe(503);
    const listPayload = (await list.json()) as { error: { code: string } };
    expect(listPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("does not append comments to in-memory fallback storage when PostgreSQL is not configured", async () => {
    const cookie = await loginAndGetCookie();

    const postResponse = await app.request(appRoutes.boards.posts("board_general"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title: "댓글 재현용 글", bodyPreview: "body", isNotice: false }),
    });
    expect(postResponse.status).toBe(503);
    const postPayload = (await postResponse.json()) as { error: { code: string } };
    expect(postPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });
});
