import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import {
  createPrivateR2EvidenceStore,
  deriveFileIdempotentUuid,
  derivePrivateQuarantineSuffix,
} from "../src/files/r2";
import { createInquiryService } from "../src/inquiries/service";
const hotelId = "50000000-0000-4000-8000-000000000001",
  inquiryId = "1a500000-0000-4000-8000-000000000001";
const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "호텔 소유주",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  sessionToken: "opaque-inquiry-owner-token",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "HOTEL_OWNER" as const,
};
const publicInquiry = {
  id: inquiryId,
  hotelId,
  categoryCode: "SALES_SETTLEMENT" as const,
  categoryName: "매출·정산",
  title: "정산 문의",
  status: "RECEIVED" as const,
  version: 1,
  assignee: null,
  messages: [
    {
      id: "1a510000-0000-4000-8000-000000000001",
      body: "7월 정산자료 확인을 요청합니다.",
      actor: { displayName: "호텔 소유주" },
      createdAt: "2026-08-15T00:00:00.000Z",
      visibility: "PUBLIC" as const,
      attachments: [],
    },
  ],
  answeredAt: null,
  closedAt: null,
  reopenUntil: null,
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
};
function repo(payload: unknown = publicInquiry) {
  return {
    capabilities: vi
      .fn()
      .mockResolvedValue({
        status: "OK",
        payload: {
          hotels: [
            {
              hotelId,
              hotelName: "서울호텔",
              ownerView: true,
              canRead: true,
              canCreate: true,
              canReply: false,
              canAssign: false,
              canManageSettings: false,
            },
          ],
        },
      }),
    close: vi.fn(),
    command: vi.fn().mockResolvedValue({ status: "CREATED", payload }),
    read: vi.fn().mockResolvedValue({ status: "OK", payload }),
  };
}
function auth(ok = true) {
  return {
    close: vi.fn(),
    resolvePrincipal: vi.fn(async () => (ok ? principal : null)),
  } as never;
}
describe("hotel owner inquiry service and API", () => {
  it("derives stable upload and scan resource IDs from one logical operation", async () => {
    const input = {
        companyId: principal.companyId,
        hotelId,
        idempotencyKey: "owner-inquiry-upload-key",
        operation: "UPLOAD_INIT",
        sessionId: principal.sessionId,
      },
      first = await deriveFileIdempotentUuid(input),
      replay = await deriveFileIdempotentUuid(input),
      different = await deriveFileIdempotentUuid({
        ...input,
        idempotencyKey: "different-upload-key",
      });
    expect(first).toMatch(/^[0-9a-f-]{36}$/u);
    expect(replay).toBe(first);
    expect(different).not.toBe(first);
  });
  it("derives a stable private quarantine suffix for upload-init replay", async () => {
    const input = {
        companyId: principal.companyId,
        hotelId,
        idempotencyKey: "owner-inquiry-upload-key",
        operation: "UPLOAD_INIT",
        sessionId: principal.sessionId,
      },
      first = await derivePrivateQuarantineSuffix(input),
      replay = await derivePrivateQuarantineSuffix(input),
      different = await derivePrivateQuarantineSuffix({
        ...input,
        idempotencyKey: "different-upload-key",
      });
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(replay).toBe(first);
    expect(different).not.toBe(first);
  });
  it("replays the original R2 ETag when the same private object already exists", async () => {
    const uploadId = "1a550000-0000-4000-8000-000000000001";
    const suffix = await derivePrivateQuarantineSuffix({
      companyId: principal.companyId,
      hotelId,
      idempotencyKey: "owner-inquiry-upload-key",
      operation: "UPLOAD_INIT",
      sessionId: principal.sessionId,
    });
    const objectKey = `quarantine/${uploadId}/${suffix}`;
    const put = vi.fn(async () => null),
      head = vi.fn(async () => ({
        etag: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        httpMetadata: { contentType: "image/png" },
        size: 3,
        version: "stored-version",
      }));
    const store = createPrivateR2EvidenceStore({ put, head } as never);
    const replay = await store.putReservedOriginal({
      body: new Uint8Array([1, 2, 3]),
      contentLength: 3,
      mimeType: "image/png",
      objectKey,
      uploadId,
    });
    expect(replay).toEqual({
      etag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      objectKey,
    });
    expect(put).toHaveBeenCalledWith(
      objectKey,
      expect.any(Uint8Array),
      expect.objectContaining({ onlyIf: { etagDoesNotMatch: "*" } }),
    );
    expect(head).toHaveBeenCalledWith(objectKey);
  });
  it("uses canonical command and rejects private fields in an owner projection", async () => {
    const repository = repo(),
      service = createInquiryService(repository);
    await expect(
      service.create(
        principal,
        hotelId,
        {
          inquiryId,
          categoryCode: "SALES_SETTLEMENT",
          title: "정산 문의",
          body: "7월 정산자료 확인을 요청합니다.",
        },
        "inquiry-create-key",
      ),
    ).resolves.toEqual(publicInquiry);
    expect(repository.command).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        companyId: principal.companyId,
        hotelId,
        idempotencyKey: "inquiry-create-key",
        operationPath: `/api/hotels/${hotelId}/inquiries`,
        resourceId: inquiryId,
        sessionToken: principal.sessionToken,
      }),
    );
    const leaked = {
      ...publicInquiry,
      messages: [
        ...publicInquiry.messages,
        {
          id: "1a520000-0000-4000-8000-000000000001",
          body: "내부메모",
          actor: { userId: principal.userId, displayName: "담당자" },
          createdAt: "2026-08-15T00:01:00.000Z",
          visibility: "INTERNAL",
        },
      ],
    };
    await expect(
      createInquiryService(repo(leaked)).get(principal, hotelId, inquiryId),
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR", httpStatus: 500 });
  });
  it("replays the stored route settings snapshot without a latest-state read", async () => {
    const snapshot = {
      contact: {
        phone: "02-1234-5678",
        email: "hotel@example.com",
        operatingHours: "평일 09:00~18:00",
        version: 1,
      },
      routes: [
        {
          categoryCode: "SALES_SETTLEMENT" as const,
          categoryName: "매출·정산",
          groupId: null,
          groupName: null,
          active: true,
          version: 1,
        },
      ],
      groups: [],
    };
    const repository = repo();
    repository.command.mockResolvedValue({ status: "REPLAYED", payload: snapshot });
    await expect(
      createInquiryService(repository).updateRoute(
        principal,
        hotelId,
        "SALES_SETTLEMENT",
        { version: 0, groupId: null, active: true },
        "route-replay-key",
      ),
    ).resolves.toEqual(snapshot);
    expect(repository.read).not.toHaveBeenCalled();
  });

  it("requires authentication and idempotency", async () => {
    const app = createApp({
      authService: auth(false),
      inquiryService: createInquiryService(repo()),
    });
    expect((await app.request(`/api/hotels/${hotelId}/inquiries`)).status).toBe(
      401,
    );
    const app2 = createApp({
      authService: auth(),
      inquiryService: createInquiryService(repo()),
    });
    const response = await app2.request(`/api/hotels/${hotelId}/inquiries`, {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-inquiry-owner-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inquiryId,
        categoryCode: "SALES_SETTLEMENT",
        title: "정산 문의",
        body: "7월 정산자료 확인을 요청합니다.",
      }),
    });
    expect(response.status).toBe(400);
  });
  it("serves capabilities, list, detail, create, message, assign, and transition", async () => {
    const service = {
      capabilities: vi.fn(async () => ({
        hotels: [
          {
            hotelId,
            hotelName: "서울호텔",
            ownerView: true,
            canRead: true,
            canCreate: true,
            canReply: false,
            canAssign: false,
            canManageSettings: false,
          },
        ],
      })),
      contact: vi.fn(async () => ({
        contact: {
          phone: "02-1234-5678",
          email: "hotel@example.com",
          operatingHours: "평일 09:00~18:00",
          version: 1,
        },
      })),
      settings: vi.fn(async () => ({
        contact: {
          phone: "02-1234-5678",
          email: "hotel@example.com",
          operatingHours: "평일 09:00~18:00",
          version: 1,
        },
        routes: [
          {
            categoryCode: "SALES_SETTLEMENT",
            categoryName: "매출·정산",
            groupId: null,
            groupName: null,
            active: false,
            version: 0,
          },
        ],
        groups: [],
      })),
      updateContact: vi.fn(async () => ({
        contact: {
          phone: "02-1234-5678",
          email: "hotel@example.com",
          operatingHours: "평일 09:00~18:00",
          version: 1,
        },
      })),
      updateRoute: vi.fn(async () => ({
        contact: {
          phone: "02-1234-5678",
          email: "hotel@example.com",
          operatingHours: "평일 09:00~18:00",
          version: 1,
        },
        routes: [
          {
            categoryCode: "SALES_SETTLEMENT",
            categoryName: "매출·정산",
            groupId: null,
            groupName: null,
            active: true,
            version: 1,
          },
        ],
        groups: [],
      })),
      close: vi.fn(),
      create: vi.fn(async () => publicInquiry),
      get: vi.fn(async () => publicInquiry),
      list: vi.fn(async () => ({
        inquiries: [publicInquiry],
        notifications: [],
        pagination: { page: 1, pageSize: 20, total: 1 },
      })),
      message: vi.fn(async () => ({ ...publicInquiry, version: 2 })),
      assign: vi.fn(async () => ({
        ...publicInquiry,
        status: "ASSIGNED",
        version: 2,
      })),
      transition: vi.fn(async () => ({
        ...publicInquiry,
        status: "ANSWERING",
        version: 2,
      })),
    };
    const app = createApp({ authService: auth(), inquiryService: service });
    const headers = {
      cookie: "__Host-hotel_session=opaque-inquiry-owner-token",
      "content-type": "application/json",
      "idempotency-key": "inquiry-route-key",
    };
    expect(
      (await app.request("/api/inquiries/capabilities", { headers })).status,
    ).toBe(200);
    expect(
      (await app.request(`/api/hotels/${hotelId}/inquiry-contact`, { headers }))
        .status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/hotels/${hotelId}/inquiry-settings`, {
          headers,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/hotels/${hotelId}/inquiry-settings/contact`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            version: 0,
            phone: "02-1234-5678",
            email: "hotel@example.com",
            operatingHours: "평일 09:00~18:00",
          }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          `/api/hotels/${hotelId}/inquiry-settings/routes/SALES_SETTLEMENT`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({ version: 0, groupId: null, active: true }),
          },
        )
      ).status,
    ).toBe(200);
    expect(
      (await app.request(`/api/hotels/${hotelId}/inquiries`, { headers }))
        .status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/hotels/${hotelId}/inquiries/${inquiryId}`, {
          headers,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/hotels/${hotelId}/inquiries`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            inquiryId,
            categoryCode: "SALES_SETTLEMENT",
            title: "정산 문의",
            body: "7월 정산자료 확인을 요청합니다.",
          }),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await app.request(
          `/api/hotels/${hotelId}/inquiries/${inquiryId}/messages`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              version: 1,
              body: "추가 확인 요청",
              visibility: "PUBLIC",
            }),
          },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          `/api/hotels/${hotelId}/inquiries/${inquiryId}/assign`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              version: 1,
              assigneeUserId: principal.userId,
              reason: "정산 담당 지정",
            }),
          },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              version: 1,
              action: "START_ANSWER",
              reason: "답변 준비 시작",
            }),
          },
        )
      ).status,
    ).toBe(200);
  });
});
