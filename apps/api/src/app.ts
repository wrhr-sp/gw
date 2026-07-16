import { probeDatabaseReadiness, type DatabaseReadiness } from "@werehere/db";
import { Hono } from "hono";

type Bindings = {
  DATABASE_URL?: string;
};

type ReadinessProbe = (databaseUrl: string | undefined) => Promise<DatabaseReadiness>;

type CreateAppOptions = {
  databaseUrl?: string;
  readinessProbe?: ReadinessProbe;
};

function unavailableResponse(
  code: "DB_NOT_CONFIGURED" | "SCHEMA_NOT_READY" | "INTERNAL_ERROR",
  message: string,
  retryable: boolean,
) {
  return {
    ok: false as const,
    data: null,
    error: {
      code,
      message,
      fieldErrors: [],
      retryable,
      retryAfterSeconds: retryable ? 5 : null,
      traceId: crypto.randomUUID(),
    },
  };
}

export function createApp(options: CreateAppOptions = {}) {
  const hotelApp = new Hono<{ Bindings: Bindings }>();
  const readinessProbe = options.readinessProbe ?? probeDatabaseReadiness;

  hotelApp.get("/api/health/live", (context) => context.json({
    ok: true,
    data: {
      service: "werehere-hotel-api",
      status: "UP",
    },
    error: null,
  }));

  hotelApp.get("/api/health/ready", async (context) => {
    const databaseUrl = options.databaseUrl ?? context.env?.DATABASE_URL;
    const readiness = await readinessProbe(databaseUrl);

    if (readiness.status === "READY") {
      return context.json({
        ok: true,
        data: {
          service: "werehere-hotel-api",
          status: "READY",
        },
        error: null,
      });
    }

    if (readiness.status === "NOT_CONFIGURED") {
      return context.json(unavailableResponse(
        "DB_NOT_CONFIGURED",
        "데이터베이스 연결이 설정되지 않았습니다.",
        false,
      ), 503);
    }

    if (readiness.status === "SCHEMA_NOT_READY") {
      return context.json(unavailableResponse(
        "SCHEMA_NOT_READY",
        "데이터베이스 준비가 완료되지 않았습니다.",
        false,
      ), 503);
    }

    return context.json(unavailableResponse(
      "INTERNAL_ERROR",
      "서비스 준비 상태를 확인할 수 없습니다.",
      true,
    ), 500);
  });

  hotelApp.notFound((context) => context.json({
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

  return hotelApp;
}

export const app = createApp();

export default app;
