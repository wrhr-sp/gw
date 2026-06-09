import { Hono } from "hono";
import { appRoutes, healthResponseSchema } from "@gw/shared";

export const app = new Hono();

app.get(appRoutes.health, (context) => {
  const payload = healthResponseSchema.parse({
    ok: true,
    data: {
      service: "gw-api",
      status: "ok",
      version: "0.1.0",
    },
    error: null,
  });

  return context.json(payload, 200);
});
