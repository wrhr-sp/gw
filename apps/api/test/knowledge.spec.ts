import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import type { HotelFileService } from "../src/files/r2";
import {
  createKnowledgeService,
  KnowledgeServiceError,
  type KnowledgeService,
} from "../src/knowledge/service";

const principal = {
  companyId: "11111111-1111-4111-8111-111111111111",
  displayName: "관리자",
  identityId: "77777777-7777-4777-8777-777777777777",
  sessionId: "22222222-2222-4222-8222-222222222222",
  sessionToken: "S".repeat(43),
  userId: "33333333-3333-4333-8333-333333333333",
  userType: "INTERNAL_STAFF" as const,
};
const hotelId = "55555555-5555-4555-8555-555555555555";
const knowledgeId = "66666666-6666-4666-8666-666666666666";
const content = {
  scopeType: "HOTEL" as const,
  hotelId,
  title: "에어컨 냉방 저하 확인 순서",
  summary: "전문업체 호출 전에 확인할 항목입니다.",
  knowledgeType: "FACILITY_MAINTENANCE" as const,
  riskClassification: "STANDARD" as const,
  situation: "객실 냉방이 약한 상황",
  symptomsAndContext: "송풍은 되지만 온도가 내려가지 않습니다.",
  checks: ["운전 모드를 확인합니다."],
  recommendedResponse: ["전원을 끄고 필터 상태를 확인합니다."],
  prohibitedOrCautionResponse: ["전기 덮개를 임의로 열지 않습니다."],
  escalationCriteria: "과열이면 즉시 관리자에게 보고합니다.",
  requiredPermissionOrApproval: "판매중지는 관리자 승인이 필요합니다.",
  caseSummary: "필터 막힘 사례",
  outcomeAndLesson: "정기 점검이 필요합니다.",
  tags: ["에어컨"],
  relatedManualRefs: ["시설 안전 매뉴얼"],
  relatedIssueIds: [],
  relatedRepairIds: [],
  designatedReviewerUserId: null,
  reviewDueAt: "2027-02-21T00:00:00.000Z",
};
const entry = {
  id: knowledgeId,
  ...content,
  status: "DRAFT" as const,
  author: { displayName: "관리자" },
  reviewer: null,
  designatedReviewer: null,
  reviewRequestedVersion: null,
  publishedAt: null,
  reviewedAt: null,
  version: 1,
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
  isStale: false,
  helpfulCount: 0,
  notHelpfulCount: 0,
  history: [],
  links: [],
  attachments: [],
  actions: {
    canEdit: true,
    canRequestReview: true,
    canPublish: false,
    canMarkNeedsReview: false,
    canArchive: false,
    canAttach: true,
  },
};
const summary = {
  id: entry.id,
  scopeType: entry.scopeType,
  hotelId: entry.hotelId,
  hotelName: "서울호텔",
  title: entry.title,
  summary: entry.summary,
  knowledgeType: entry.knowledgeType,
  riskClassification: entry.riskClassification,
  tags: entry.tags,
  status: entry.status,
  version: entry.version,
  updatedAt: entry.updatedAt,
  isStale: entry.isStale,
};

function repository(overrides: Record<string, unknown> = {}) {
  return {
    attachments: vi.fn(async () => ({ status: "UPDATED", payload: entry })),
    capabilities: vi.fn(async () => ({
      status: "OK",
      payload: {
        canRead: true,
        canCreate: true,
        canReview: true,
        canPublish: true,
        canArchive: true,
        company: {
          canRead: true,
          canCreate: true,
          canReview: true,
          canPublish: true,
          canHighRiskPublish: true,
          canArchive: true,
        },
        hotels: [
          {
            hotelId,
            hotelName: "서울호텔",
            permissions: {
              canRead: true,
              canCreate: true,
              canReview: true,
              canPublish: true,
              canHighRiskPublish: true,
              canArchive: true,
            },
          },
        ],
      },
    })),
    close: vi.fn(),
    command: vi.fn(async () => ({ status: "CREATED", payload: entry })),
    feedback: vi.fn(async () => ({
      status: "RECORDED",
      payload: { helpfulCount: 1, notHelpfulCount: 0 },
    })),
    read: vi.fn(async () => ({
      status: "OK",
      payload: { entries: [summary], page: 1, pageSize: 20, totalCount: 1 },
    })),
    reviewerCandidates: vi.fn(async () => ({
      status: "OK",
      payload: {
        candidates: [{ userId: "77777777-7777-4777-8777-777777777777", displayName: "지정 검토자" }],
      },
    })),
    ...overrides,
  };
}

describe("knowledge service", () => {
  it("lists only strict authorized projections", async () => {
    const repo = repository();
    const service = createKnowledgeService(repo);
    await expect(
      service.list(principal, { search: "에어컨", page: "1", pageSize: "20" }),
    ).resolves.toMatchObject({ entries: [{ id: knowledgeId }], totalCount: 1 });
    expect(repo.read).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: principal.companyId,
        knowledgeId: null,
        sessionId: principal.sessionId,
      }),
    );
  });

  it("creates a draft with idempotency and cannot infer publish permission", async () => {
    const repo = repository();
    const service = createKnowledgeService(repo);
    await expect(
      service.create(
        principal,
        { id: knowledgeId, ...content },
        "knowledge-create-key",
      ),
    ).resolves.toMatchObject({ id: knowledgeId, status: "DRAFT" });
    expect(repo.command).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        expectedVersion: 0,
        idempotencyKey: "knowledge-create-key",
        knowledgeId,
      }),
    );
  });

  it("maps hidden entries to 404 and stale writes to 409", async () => {
    const hidden = createKnowledgeService(
      repository({
        command: vi.fn(async () => ({ status: "NOT_FOUND", payload: null })),
      }),
    );
    await expect(
      hidden.transition(
        principal,
        knowledgeId,
        { action: "REQUEST_REVIEW", version: 1, reason: "검토 요청" },
        "transition-key",
      ),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", httpStatus: 404 });

    const stale = createKnowledgeService(
      repository({
        command: vi.fn(async () => ({
          status: "VERSION_CONFLICT",
          payload: null,
        })),
      }),
    );
    await expect(
      stale.update(
        principal,
        knowledgeId,
        { ...content, version: 1, reason: "내용 보완" },
        "update-key",
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT", httpStatus: 409 });
  });

  it("records feedback without accepting free-text for helpful votes", async () => {
    const repo = repository();
    const service = createKnowledgeService(repo);
    await expect(
      service.feedback(
        principal,
        knowledgeId,
        { kind: "HELPFUL", version: 1, comment: null },
        "feedback-key",
      ),
    ).resolves.toEqual({ helpfulCount: 1, notHelpfulCount: 0 });
    expect(repo.feedback).toHaveBeenCalledWith(
      expect.objectContaining({ knowledgeId, kind: "HELPFUL" }),
    );
  });

  it("links only versioned clean attachment identifiers", async () => {
    const repo = repository();
    const service = createKnowledgeService(repo);
    await expect(
      service.attachments(
        principal,
        knowledgeId,
        {
          version: 1,
          fileVersionIds: ["88888888-8888-4888-8888-888888888888"],
          reason: "현장 사진 연결",
        },
        "attachment-link-key",
      ),
    ).resolves.toMatchObject({ id: knowledgeId });
    expect(repo.attachments).toHaveBeenCalledWith(
      expect.objectContaining({ method: "PUT", expectedVersion: 1, knowledgeId }),
    );
  });
});

function auth(active = true): AuthService {
  return {
    beginCustomLogin: vi.fn(),
    beginLogin: vi.fn(),
    completeLogin: vi.fn(),
    finalizeCustomLogin: vi.fn(),
    logout: vi.fn(),
    prepareCustomLogin: vi.fn(),
    resolvePrincipal: vi.fn(async () => (active ? principal : null)),
  } as AuthService;
}

function httpService(
  overrides: Partial<KnowledgeService> = {},
): KnowledgeService {
  const permissions = {
    canArchive: true,
    canCreate: true,
    canHighRiskPublish: true,
    canPublish: true,
    canRead: true,
    canReview: true,
  };
  return {
    attachments: vi.fn(async () => ({ ...entry, version: 2 })),
    capabilities: vi.fn(async () => ({
      canArchive: true,
      canCreate: true,
      canPublish: true,
      canRead: true,
      canReview: true,
      company: permissions,
      hotels: [{ hotelId, hotelName: "서울호텔", permissions }],
    })),
    create: vi.fn(async () => entry),
    feedback: vi.fn(async () => ({ helpfulCount: 1, notHelpfulCount: 0 })),
    get: vi.fn(async () => entry),
    list: vi.fn(async () => ({
      entries: [summary],
      page: 1,
      pageSize: 20,
      totalCount: 1,
    })),
    reviewerCandidates: vi.fn(async () => ({
      candidates: [
        {
          userId: "77777777-7777-4777-8777-777777777777",
          displayName: "지정 검토자",
        },
      ],
    })),
    transition: vi.fn(async () => ({ ...entry, status: "REVIEW_REQUESTED" })),
    update: vi.fn(async () => ({ ...entry, version: 2 })),
    ...overrides,
  } as KnowledgeService;
}

const httpHeaders = {
  cookie: "__Host-hotel_session=opaque-session-token",
  "content-type": "application/json",
  "idempotency-key": "knowledge-http-key",
};

const createPayload = { ...content, id: knowledgeId };

describe("knowledge HTTP API", () => {
  it("requires an active opaque session and no-store responses", async () => {
    const response = await createApp({
      authService: auth(false),
      knowledgeService: httpService(),
    }).request("/api/knowledge");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("serves strict capabilities, list, and exact authorized detail", async () => {
    const application = createApp({
      authService: auth(),
      knowledgeService: httpService(),
    });
    for (const path of [
      "/api/knowledge/capabilities",
      "/api/knowledge/reviewer-candidates?scopeType=COMPANY",
      "/api/knowledge?page=1&pageSize=20",
      `/api/knowledge/${entry.id}`,
    ]) {
      const response = await application.request(path, {
        headers: httpHeaders,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, error: null });
    }
  });

  it("requires idempotency and forwards create only on the exact route", async () => {
    const create = vi.fn(async () => entry);
    const application = createApp({
      authService: auth(),
      knowledgeService: httpService({ create }),
    });
    const missingKey = await application.request("/api/knowledge", {
      body: JSON.stringify(createPayload),
      headers: {
        cookie: httpHeaders.cookie,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(missingKey.status).toBe(400);
    const created = await application.request("/api/knowledge", {
      body: JSON.stringify(createPayload),
      headers: httpHeaders,
      method: "POST",
    });
    expect(created.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
    const suffix = await application.request("/api/knowledge/export", {
      headers: httpHeaders,
    });
    expect(suffix.status).toBe(404);
  });

  it("returns 404 with no data for a hidden knowledge id", async () => {
    const application = createApp({
      authService: auth(),
      knowledgeService: httpService({
        get: vi.fn(async () => {
          throw new KnowledgeServiceError("RESOURCE_NOT_FOUND", 404);
        }),
      }),
    });
    const response = await application.request(`/api/knowledge/${entry.id}`, {
      headers: httpHeaders,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "RESOURCE_NOT_FOUND" },
      ok: false,
    });
  });

  it("allows only exact knowledge attachment methods and matching parents", async () => {
    const knowledgeInit = vi.fn(async () => ({
      upload: { id: "88888888-8888-4888-8888-888888888888", status: "PENDING_UPLOAD" },
      uploadUrl: "/api/files/uploads/88888888-8888-4888-8888-888888888888/body",
      expiresInSeconds: 300,
      requiredHeaders: { "Content-Type": "image/png", "If-None-Match": "*" },
    }));
    const attachments = vi.fn(async () => ({ ...entry, version: 2 }));
    const knowledgeView = vi.fn(async () => ({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      }),
      displayName: "현장사진.png",
      etag: '"0123456789abcdef0123456789abcdef"',
      mimeType: "image/png",
      sizeBytes: 1,
    }));
    const application = createApp({
      authService: auth(),
      hotelFileService: { knowledgeInit, knowledgeView } as unknown as HotelFileService,
      knowledgeService: httpService({ attachments }),
    });
    const initBody = {
      fileName: "현장사진.png",
      mimeType: "image/png",
      parent: { type: "KNOWLEDGE_ATTACHMENT", knowledgeId },
      sizeBytes: 12,
    };
    const initialized = await application.request(
      `/api/knowledge/${knowledgeId}/files/upload-init`,
      { method: "POST", headers: httpHeaders, body: JSON.stringify(initBody) },
    );
    expect(initialized.status).toBe(201);
    expect(knowledgeInit).toHaveBeenCalledTimes(1);
    const mismatch = await application.request(
      `/api/knowledge/${knowledgeId}/files/upload-init`,
      {
        method: "POST",
        headers: httpHeaders,
        body: JSON.stringify({
          ...initBody,
          parent: {
            ...initBody.parent,
            knowledgeId: "99999999-9999-4999-8999-999999999999",
          },
        }),
      },
    );
    expect(mismatch.status).toBe(404);
    const linked = await application.request(
      `/api/knowledge/${knowledgeId}/attachments`,
      {
        method: "PUT",
        headers: httpHeaders,
        body: JSON.stringify({
          version: 1,
          fileVersionIds: ["88888888-8888-4888-8888-888888888888"],
          reason: "현장 사진 연결",
        }),
      },
    );
    expect(linked.status).toBe(200);
    expect(attachments).toHaveBeenCalledTimes(1);
    const viewPath = `/api/knowledge/${knowledgeId}/files/88888888-8888-4888-8888-888888888888/view`;
    const crossSiteView = await application.request(viewPath, {
      headers: { ...httpHeaders, "sec-fetch-site": "cross-site" },
    });
    expect(crossSiteView.status).toBe(403);
    expect(knowledgeView).not.toHaveBeenCalled();
    const sameOriginView = await application.request(viewPath, {
      headers: { ...httpHeaders, "sec-fetch-site": "same-origin" },
    });
    expect(sameOriginView.status).toBe(200);
    expect(knowledgeView).toHaveBeenCalledTimes(1);
    const wrongMethod = await application.request(
      `/api/knowledge/${knowledgeId}/attachments`,
      { method: "POST", headers: httpHeaders },
    );
    expect(wrongMethod.status).toBe(404);
  });
});
