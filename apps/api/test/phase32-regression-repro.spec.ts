import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import {
  appRoutes,
  authLoginResponseSchema,
  boardCommentCreateResponseSchema,
  boardCommentListResponseSchema,
  boardPostCreateResponseSchema,
  boardPostListResponseSchema,
} from "@gw/shared";

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

describe("phase32 regression repro", () => {
  it("repeated post create in the same board should append instead of overwriting via stable id", async () => {
    const cookie = await loginAndGetCookie();

    const first = await app.request(appRoutes.boards.posts("board_general"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title: "첫 글", bodyPreview: "A", isNotice: false }),
    });
    const firstPayload = boardPostCreateResponseSchema.parse(await first.json());

    const second = await app.request(appRoutes.boards.posts("board_general"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title: "둘째 글", bodyPreview: "B", isNotice: false }),
    });
    const secondPayload = boardPostCreateResponseSchema.parse(await second.json());

    const list = await app.request(appRoutes.boards.posts("board_general"), {
      headers: { cookie },
    });
    const listPayload = boardPostListResponseSchema.parse(await list.json());

    expect(firstPayload.data.post.id).not.toBe(secondPayload.data.post.id);
    expect(listPayload.data.items.filter((item) => item.title === "첫 글" || item.title === "둘째 글")).toHaveLength(2);
  });

  it("repeated comment create on the same post should append instead of overwriting via stable id", async () => {
    const cookie = await loginAndGetCookie();

    const postResponse = await app.request(appRoutes.boards.posts("board_general"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title: "댓글 재현용 글", bodyPreview: "body", isNotice: false }),
    });
    const postPayload = boardPostCreateResponseSchema.parse(await postResponse.json());
    const postId = postPayload.data.post.id;

    const first = await app.request(appRoutes.boards.comments(postId), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ body: "첫 댓글" }),
    });
    const firstPayload = boardCommentCreateResponseSchema.parse(await first.json());

    const second = await app.request(appRoutes.boards.comments(postId), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ body: "둘째 댓글" }),
    });
    const secondPayload = boardCommentCreateResponseSchema.parse(await second.json());

    const list = await app.request(appRoutes.boards.comments(postId), {
      headers: { cookie },
    });
    const listPayload = boardCommentListResponseSchema.parse(await list.json());

    expect(firstPayload.data.comment.id).not.toBe(secondPayload.data.comment.id);
    expect(listPayload.data.items.filter((item) => item.body === "첫 댓글" || item.body === "둘째 댓글")).toHaveLength(2);
  });
});
