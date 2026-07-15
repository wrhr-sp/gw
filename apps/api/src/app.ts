import { Hono } from "hono";

export const app = new Hono();

app.get("/api/health", (context) => context.json({
  ok: true,
  data: {
    service: "werehere-hotel-api",
    status: "UP",
  },
  error: null,
}));

app.notFound((context) => context.json({
  ok: false,
  data: null,
  error: {
    code: "RESOURCE_NOT_FOUND",
    message: "요청한 경로를 찾을 수 없습니다.",
    fieldErrors: [],
    retryable: false,
    retryAfterSeconds: null,
    traceId: crypto.randomUUID(),
  },
}, 404));

export default app;
