import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CalendarConnectionPanel,
} from "../components/calendar/calendar-connection-panel";
import { createLogicalIdempotencyKeyStore } from "../lib/logical-idempotency";

describe("Google Calendar 관리자 연결 UI", () => {
  it("renders the safe loading shell without provider identifiers", () => {
    const html = renderToStaticMarkup(<CalendarConnectionPanel />);
    expect(html).toContain("Google Calendar 연결");
    expect(html).toContain('data-feature-key="hotel-calendar.connection"');
    expect(html).toContain("PostgreSQL이 정본");
    expect(html).toContain("연결 상태를 확인하고 있습니다");
    expect(html).not.toContain("provider-calendar");
    expect(html).not.toContain("refresh_token");
  });
  it("renders canonical initial status without a loading-only handoff", () => {
    const html = renderToStaticMarkup(
      <CalendarConnectionPanel
        initialData={{
          connectionId: null,
          connectionStatus: "NOT_CONNECTED",
          credentialStatus: null,
          version: null,
          candidateId: null,
          candidateRowVersion: null,
          hotels: [
            {
              hotelId: "50000000-0000-4000-8000-000000000001",
              hotelName: "서울호텔",
              hotelLinkId: null,
              generation: 0,
              linkStatus: "NOT_CREATED",
              version: 0,
              projectionStatus: "NOT_CONNECTED",
              lastFailureCode: null,
            },
          ],
          failures: [],
        }}
      />,
    );
    expect(html).toContain("Google 계정 연결");
    expect(html).toContain("서울호텔");
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("min-h-10");
    expect(html).not.toContain("연결 상태를 확인하고 있습니다");
    expect(html).not.toContain("calendarId");
  });
  it("parses strict command receipts and gates candidate promotion on verified access", () => {
    const source = readFileSync(
      new URL(
        "../components/calendar/calendar-connection-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("calendarConnectionCommandResponseSchema.parse");
    expect(source).toContain("hotelErrorResponseSchema.safeParse");
    expect(source).toContain("오류 코드: {error.code}");
    expect(source).toContain('fetch("/api/auth/logout"');
    expect(source).toContain('window.location.assign("/api/auth/login")');
    expect(source).toContain("다시 로그인");
    expect(source).toContain("queryClient.cancelQueries");
    expect(source).toContain("queryClient.fetchQuery");
    expect(source).toContain('trigger("reason", { shouldFocus: true })');
    expect(source).toContain("maxLength={500}");
    expect(source).toContain('data.credentialStatus === "ACCESS_VERIFIED" &&');
    expect(source).toContain("data.candidateRowVersion");
    expect(source).toContain('"Idempotency-Key"');
    expect(source).toContain("idempotencyKeys.acquire");
    expect(source).toContain("idempotencyKeys.complete");
    expect(source).not.toContain("const idempotencyKey = crypto.randomUUID()");
    expect(source).not.toContain(
      'data.credentialStatus === "CANDIDATE" && data.version',
    );
  });
  it("keeps one key for an uncertain logical operation and rotates only after completion or a changed body", () => {
    let sequence = 0;
    const keys = createLogicalIdempotencyKeyStore(() => `key-${++sequence}`);
    const operation = {
      path: "/api/admin/calendar-connections/connection/commands",
      body: { expectedVersion: 2, reason: "연결 해제" },
    };
    const first = keys.acquire(operation);
    expect(keys.acquire({ ...operation, body: { ...operation.body } })).toBe(
      first,
    );
    keys.settle(operation, false);
    expect(keys.acquire(operation)).toBe(first);
    expect(
      keys.acquire({
        ...operation,
        body: { ...operation.body, expectedVersion: 3 },
      }),
    ).not.toBe(first);
    keys.settle(operation, true);
    expect(keys.acquire(operation)).not.toBe(first);
  });
});
