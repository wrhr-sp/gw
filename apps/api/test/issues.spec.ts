import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import {
  createOperationalIssueService,
  OperationalIssueServiceError,
} from "../src/issues/service";

const hotelId = "50000000-0000-4000-8000-000000000001";
const issueId = "d9400000-0000-4000-8000-000000000001";
const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "운영 담당",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  sessionToken: "opaque-operational-issue-token",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
};
const publicIssue = {
  assignee: null,
  createdAt: "2026-08-12T12:00:00.000Z",
  description: "로비에 반복적인 소음 신고가 접수됐습니다.",
  hotelId,
  id: issueId,
  isOverdue: false,
  publicComments: [],
  resumeDueAt: null,
  severity: "MAJOR" as const,
  status: "RECEIVED" as const,
  title: "로비 소음 신고",
  updatedAt: "2026-08-12T12:00:00.000Z",
  version: 1,
};
const internalIssue = {
  ...publicIssue,
  internalNotes: [],
  statusHistory: [],
  workLogs: [],
};

function repository(payload: unknown = internalIssue) {
  return {
    capabilities: vi.fn().mockResolvedValue({
      payload: {
        hotels: [
          {
            actorUserId: principal.userId,
            canComment: true,
            canCreate: true,
            canManage: true,
            canRead: true,
            canWork: true,
            hotelId,
            hotelName: "서울호텔",
          },
        ],
      },
      status: "OK",
    }),
    close: vi.fn(),
    command: vi.fn().mockResolvedValue({ payload, status: "CREATED" }),
    read: vi.fn().mockResolvedValue({ payload, status: "OK" }),
  };
}

function authService(authenticated = true) {
  return {
    close: vi.fn(),
    resolvePrincipal: vi.fn(async () => (authenticated ? principal : null)),
  } as never;
}

describe("operational issue service and API", () => {
  it("uses the canonical DB command path and opaque session context", async () => {
    const repo = repository();
    const service = createOperationalIssueService(repo);
    const request = {
      description: publicIssue.description,
      issueId,
      roomId: null,
      severity: "MAJOR" as const,
      title: publicIssue.title,
    };

    await expect(
      service.create(principal, hotelId, request, "issue-create-key"),
    ).resolves.toEqual(internalIssue);
    expect(repo.command).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        companyId: principal.companyId,
        expectedVersion: 0,
        hotelId,
        idempotencyKey: "issue-create-key",
        method: "POST",
        operationPath: `/api/hotels/${hotelId}/issues`,
        resourceId: issueId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        value: request,
      }),
    );
  });

  it("accepts an owner-safe DB detail and rejects leaked private fields", async () => {
    const ownerService = createOperationalIssueService(repository(publicIssue));
    await expect(
      ownerService.get(principal, hotelId, issueId),
    ).resolves.toEqual(publicIssue);

    const leaked = { ...publicIssue, internalNotes: [] };
    const leakedService = createOperationalIssueService(repository(leaked));
    await expect(
      leakedService.get(principal, hotelId, issueId),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      httpStatus: 500,
    });
  });

  it("maps state, assignee, terminal, and version failures to stable errors", async () => {
    for (const [status, code, httpStatus] of [
      ["ISSUE_ASSIGNEE_INVALID", "ISSUE_ASSIGNEE_INVALID", 422],
      ["ISSUE_STATE_INVALID", "ISSUE_STATE_INVALID", 422],
      ["ISSUE_TERMINAL_LOCKED", "ISSUE_TERMINAL_LOCKED", 409],
      ["VERSION_CONFLICT", "VERSION_CONFLICT", 409],
    ] as const) {
      const repo = repository();
      repo.command.mockResolvedValueOnce({ payload: null, status });
      const service = createOperationalIssueService(repo);
      await expect(
        service.transition(
          principal,
          hotelId,
          issueId,
          { action: "START", reason: "현장 확인 시작", version: 1 },
          `key-${status}`,
        ),
      ).rejects.toEqual(expect.objectContaining({ code, httpStatus }));
    }
  });

  it("requires authentication and an idempotency key on create", async () => {
    const unauthenticated = createApp({
      authService: authService(false),
      operationalIssueService: createOperationalIssueService(repository()),
    });
    expect(
      (await unauthenticated.request(`/api/hotels/${hotelId}/issues`)).status,
    ).toBe(401);

    const app = createApp({
      authService: authService(),
      operationalIssueService: createOperationalIssueService(repository()),
    });
    const response = await app.request(`/api/hotels/${hotelId}/issues`, {
      body: JSON.stringify({
        description: publicIssue.description,
        issueId,
        severity: "MAJOR",
        title: publicIssue.title,
      }),
      headers: {
        "content-type": "application/json",
        cookie: "__Host-hotel_session=opaque-operational-issue-token",
      },
      method: "POST",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("serves create, list, detail, assign, transition, and three entry routes", async () => {
    const service = {
      capabilities: vi.fn(async () => ({
        hotels: [
          {
            actorUserId: principal.userId,
            canComment: true,
            canCreate: true,
            canManage: true,
            canRead: true,
            canWork: true,
            hotelId,
            hotelName: "서울호텔",
          },
        ],
      })),
      addEntry: vi.fn(async () => internalIssue),
      assign: vi.fn(async () => ({
        ...internalIssue,
        status: "ASSIGNED",
        version: 2,
      })),
      close: vi.fn(),
      create: vi.fn(async () => internalIssue),
      get: vi.fn(async () => publicIssue),
      list: vi.fn(async () => ({
        issues: [publicIssue],
        pagination: { page: 1, pageSize: 20, total: 1 },
      })),
      transition: vi.fn(async () => ({
        ...internalIssue,
        status: "IN_PROGRESS",
        version: 2,
      })),
    };
    const app = createApp({
      authService: authService(),
      operationalIssueService: service,
    });
    const headers = {
      "content-type": "application/json",
      cookie: "__Host-hotel_session=opaque-operational-issue-token",
      "idempotency-key": "issue-route-key",
    };

    const capabilities = await app.request("/api/issues/capabilities", {
      headers,
    });
    expect(capabilities.status).toBe(200);
    expect(await capabilities.json()).toMatchObject({
      data: { hotels: [{ hotelId, canRead: true, canManage: true }] },
      error: null,
      ok: true,
    });
    const create = await app.request(`/api/hotels/${hotelId}/issues`, {
      body: JSON.stringify({
        description: publicIssue.description,
        issueId,
        severity: "MAJOR",
        title: publicIssue.title,
      }),
      headers,
      method: "POST",
    });
    expect(create.status).toBe(201);
    expect(
      (await app.request(`/api/hotels/${hotelId}/issues`, { headers })).status,
    ).toBe(200);
    const detail = await app.request(
      `/api/hotels/${hotelId}/issues/${issueId}`,
      {
        headers,
      },
    );
    expect(detail.status).toBe(200);
    expect(await detail.json()).not.toHaveProperty("data.issue.internalNotes");

    const mutations = [
      [
        "assign",
        {
          assigneeUserId: principal.userId,
          reason: "현장 담당 지정",
          version: 1,
        },
      ],
      [
        "transitions",
        { action: "START", reason: "현장 확인 시작", version: 1 },
      ],
      ["work-logs", { body: "현장 상태를 확인했습니다.", version: 1 }],
      ["public-comments", { body: "진행상황을 공유합니다.", version: 1 }],
      ["internal-notes", { body: "내부 확인이 필요합니다.", version: 1 }],
    ] as const;
    for (const [suffix, body] of mutations) {
      const response = await app.request(
        `/api/hotels/${hotelId}/issues/${issueId}/${suffix}`,
        { body: JSON.stringify(body), headers, method: "POST" },
      );
      expect(response.status, suffix).toBe(200);
    }
    expect(service.assign).toHaveBeenCalledOnce();
    expect(service.transition).toHaveBeenCalledOnce();
    expect(service.addEntry).toHaveBeenCalledTimes(3);
  });

  it("fails safely when the database is not configured", () => {
    expect(
      () => new OperationalIssueServiceError("DB_NOT_CONFIGURED", 503),
    ).not.toThrow();
  });
});
