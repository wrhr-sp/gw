import { beforeEach, describe, expect, it, vi } from "vitest";

const { sql } = vi.hoisted(() => {
  const query = vi.fn();
  return {
    sql: Object.assign(query, {
      end: vi.fn(),
      unsafe: vi.fn(),
    }),
  };
});

vi.mock("postgres", () => ({
  default: vi.fn(() => sql),
}));

import { probeDatabaseReadiness } from "../src/client";

describe("database readiness diagnostic observer", () => {
  beforeEach(() => {
    sql.mockReset();
    sql.mockResolvedValue([]);
    sql.unsafe.mockReset();
    sql.unsafe.mockResolvedValue(undefined);
    sql.end.mockReset();
    sql.end.mockResolvedValue(undefined);
  });

  it("reports one opaque source checkpoint without changing the readiness payload", async () => {
    const observer = vi.fn();

    const result = await probeDatabaseReadiness(
      "postgresql://runtime:unused@127.0.0.1:5432/test",
      { capability: "API_RUNTIME", onSchemaNotReady: observer },
    );

    expect(result).toEqual({ status: "SCHEMA_NOT_READY" });
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0]?.[0]).toMatch(/^CLIENT_(?:\d+|UNKNOWN)$/u);
    expect(observer.mock.calls[0]?.[0]).not.toMatch(/[\\/\s:]/u);
  });

  it("keeps SCHEMA_NOT_READY when a synchronous observer throws", async () => {
    const result = await probeDatabaseReadiness(
      "postgresql://runtime:unused@127.0.0.1:5432/test",
      {
        capability: "API_RUNTIME",
        onSchemaNotReady: () => {
          throw new Error("observer failure");
        },
      },
    );

    expect(result).toEqual({ status: "SCHEMA_NOT_READY" });
  });

  it("handles an asynchronous observer rejection", async () => {
    const result = await probeDatabaseReadiness(
      "postgresql://runtime:unused@127.0.0.1:5432/test",
      {
        capability: "API_RUNTIME",
        onSchemaNotReady: async () => {
          throw new Error("async observer failure");
        },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result).toEqual({ status: "SCHEMA_NOT_READY" });
  });

  it("uses the opaque UNKNOWN fallback when a source frame is unavailable", async () => {
    const errorApi = Error as unknown as {
      prepareStackTrace?: () => string;
    };
    const originalPrepareStackTrace = errorApi.prepareStackTrace;
    const observer = vi.fn();
    errorApi.prepareStackTrace = () => "";
    try {
      const result = await probeDatabaseReadiness(
        "postgresql://runtime:unused@127.0.0.1:5432/test",
        { capability: "API_RUNTIME", onSchemaNotReady: observer },
      );

      expect(result).toEqual({ status: "SCHEMA_NOT_READY" });
      expect(observer).toHaveBeenCalledWith("CLIENT_UNKNOWN");
    } finally {
      if (originalPrepareStackTrace) {
        errorApi.prepareStackTrace = originalPrepareStackTrace;
      } else {
        delete errorApi.prepareStackTrace;
      }
    }
  });
});
