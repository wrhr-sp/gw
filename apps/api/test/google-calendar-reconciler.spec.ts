import { describe, expect, it, vi } from "vitest";
import type { CalendarProjectionRepository } from "@werehere/db";
import type { createCalendarCrypto } from "../src/calendar-projections/crypto";
import type { GoogleCalendarAdapter } from "../src/calendar-projections/google";
import { GoogleCalendarProviderError } from "../src/calendar-projections/google";
import {
  reconcileGoogleCalendarCompanies,
  reconcileGoogleCalendarCompanyStages,
  reconcileGoogleCalendarsFromBindings,
} from "../src/calendar-projections/factory";
import {
  nextCalendarRetryAt,
  reconcileGoogleCalendarCandidate,
  reconcileGoogleCalendarCompany,
} from "../src/calendar-projections/reconciler";

describe("Google Calendar projection retry policy", () => {
  it("uses bounded exponential backoff and caps Retry-After at 24 hours", () => {
    const now = new Date("2026-08-08T00:00:00.000Z");
    expect(
      nextCalendarRetryAt({
        attempt: 1,
        now,
        jitter: 0,
        retryAfterSeconds: null,
      }).toISOString(),
    ).toBe("2026-08-08T00:00:30.000Z");
    expect(
      nextCalendarRetryAt({
        attempt: 8,
        now,
        jitter: 0,
        retryAfterSeconds: null,
      }).toISOString(),
    ).toBe("2026-08-08T01:04:00.000Z");
    expect(
      nextCalendarRetryAt({
        attempt: 1,
        now,
        jitter: 0,
        retryAfterSeconds: 172800,
      }).toISOString(),
    ).toBe("2026-08-09T00:00:00.000Z");
  });

  it("fails closed when only part of the Calendar Worker binding set exists", async () => {
    await expect(
      reconcileGoogleCalendarsFromBindings({
        GOOGLE_CALENDAR_OAUTH_CLIENT_ID: "partial",
      }),
    ).rejects.toThrow("CALENDAR_CONNECTION_NOT_CONFIGURED");
  });
});

const companyId = "10000000-0000-4000-8000-000000000001";
const baseJob = {
  id: "11000000-0000-4000-8000-000000000001",
  companyId,
  hotelId: "12000000-0000-4000-8000-000000000001",
  aggregateType: "HOTEL_CALENDAR",
  hotelLinkId: "13000000-0000-4000-8000-000000000001",
  eventLinkId: null,
  attemptNumber: 2,
  attemptedSourceVersion: null,
  attemptedConnectionVersion: 1,
  attemptedHotelLinkGeneration: 1,
  attemptedHotelLinkVersion: 1,
  attemptedEventLinkVersion: null,
  attemptedCredentialId: "15000000-0000-4000-8000-000000000001",
  attemptedCredentialVersion: 1,
  createDispatchState: "CREATE_DISPATCHED_OUTCOME_UNKNOWN",
  connectionId: "14000000-0000-4000-8000-000000000001",
  connectionStatus: "CONNECTED",
  connectionVersion: 1,
  credentialId: "15000000-0000-4000-8000-000000000001",
  credentialVersion: 1,
  credentialCiphertext: "YQ==",
  credentialIv: "YWFhYWFhYWFhYWFh",
  credentialKeyVersion: 1,
  hotelLinkStatus: "PENDING_CREATE",
  hotelLinkGeneration: 1,
  lookupCiphertext: "Yg==",
  lookupIv: "YmJiYmJiYmJiYmJi",
  lookupKeyVersion: 1,
  calendarCiphertext: null,
  calendarIv: null,
  calendarKeyVersion: null,
  stableEventId: null,
  markerKeyVersion: null,
  desiredSourceVersion: null,
  appliedSourceVersion: null,
  appliedExists: null,
  visit: null,
};
function cryptoMock() {
  return {
    decrypt: vi.fn(async (_value: unknown, aad: string) =>
      aad.startsWith("credential|") ? "refresh" : "lookup",
    ),
    encrypt: vi.fn(async () => ({
      ciphertext: new Uint8Array([1]),
      iv: new Uint8Array(12),
      keyVersion: 1,
    })),
    fingerprint: vi.fn(async () => new Uint8Array(32)),
  } as unknown as ReturnType<typeof createCalendarCrypto>;
}
function repositoryMock(job: unknown) {
  const finalize = vi.fn(async (input: { result: string }) => ({
    status:
      input.result === "PREFLIGHT"
        ? "READY"
        : input.result === "RETRYABLE"
          ? "RETRY"
          : input.result,
    payload: null,
  }));
  const markCreateDispatched = vi.fn(async () => ({
    status: "DISPATCH_RECORDED",
    payload: null,
  }));
  const repairAfterStale = vi.fn(async () => ({
    status: "REPAIR_ENQUEUED",
    payload: null,
  }));
  const resetEventExistence = vi.fn(async () => ({
    status: "EXISTENCE_RESET",
    payload: { attemptedEventLinkVersion: 2 },
  }));
  const withProviderMutationFence = vi.fn(
    async (
      _companyId: string,
      _connectionId: string,
      run: () => Promise<unknown>,
    ) => run(),
  );
  return {
    repository: {
      claim: vi.fn(async () => ({ status: "OK", payload: { jobs: [job] } })),
      markCreateDispatched,
      repairAfterStale,
      resetEventExistence,
      withProviderMutationFence,
      finalize,
    } as unknown as CalendarProjectionRepository,
    finalize,
    markCreateDispatched,
    repairAfterStale,
    resetEventExistence,
    withProviderMutationFence,
  };
}

describe("Google Calendar projection convergence", () => {
  it("rejects an unexpected finalize status on the disconnected early-superseded path", async () => {
    const job = { ...baseJob, connectionStatus: "DISCONNECTED" };
    const { repository, finalize } = repositoryMock(job);
    finalize.mockResolvedValue({ status: "FORBIDDEN", payload: null });
    await expect(
      reconcileGoogleCalendarCompany({
        repository,
        crypto: cryptoMock(),
        google: {} as GoogleCalendarAdapter,
        companyId,
      }),
    ).rejects.toThrow("Calendar projection finalize failure");
  });

  it("rejects an unexpected finalize status on the invalid-event-material early-superseded path", async () => {
    const job = {
      ...baseJob,
      aggregateType: "VISIT_EVENT",
      hotelLinkStatus: "ACTIVE",
      eventLinkId: "16000000-0000-4000-8000-000000000001",
      markerKeyVersion: 1,
      attemptedEventLinkVersion: 1,
      attemptedSourceVersion: 1,
      desiredSourceVersion: 1,
      visit: null,
    };
    const { repository, finalize } = repositoryMock(job);
    finalize.mockResolvedValue({ status: "VALIDATION_ERROR", payload: null });
    await expect(
      reconcileGoogleCalendarCompany({
        repository,
        crypto: cryptoMock(),
        google: {} as GoogleCalendarAdapter,
        companyId,
      }),
    ).rejects.toThrow("Calendar projection finalize failure");
  });

  it("does not start a projection claim after the scheduled deadline", async () => {
    const controller = new AbortController();
    controller.abort();
    const claim = vi.fn();
    await expect(
      reconcileGoogleCalendarCompany({
        repository: { claim } as unknown as CalendarProjectionRepository,
        crypto: cryptoMock(),
        google: {} as GoogleCalendarAdapter,
        companyId: baseJob.companyId,
        signal: controller.signal,
      }),
    ).rejects.toThrow("CALENDAR_SCHEDULED_DEADLINE_EXCEEDED");
    expect(claim).not.toHaveBeenCalled();
  });

  it("does not process a claim that returns after the scheduled deadline", async () => {
    const controller = new AbortController();
    const claim = vi.fn(async () => {
      controller.abort();
      return { status: "OK", payload: { jobs: [] } };
    });
    await expect(
      reconcileGoogleCalendarCompany({
        repository: { claim } as unknown as CalendarProjectionRepository,
        crypto: cryptoMock(),
        google: {} as GoogleCalendarAdapter,
        companyId: baseJob.companyId,
        signal: controller.signal,
      }),
    ).rejects.toThrow("CALENDAR_SCHEDULED_DEADLINE_EXCEEDED");
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("enqueues durable repair when Calendar creation loses its finalize fence", async () => {
    const job = {
      ...baseJob,
      createDispatchState: "CREATE_NOT_ATTEMPTED",
    };
    const { repository, finalize, repairAfterStale } = repositoryMock(job);
    finalize.mockImplementation(async (input: { result: string }) => ({
      status: input.result === "PREFLIGHT" ? "READY" : "STALE_VERSION",
      payload: null,
    }));
    const createCalendar = vi.fn(async () => ({ id: "provider-calendar" }));
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      findCalendar: vi.fn(async () => null),
      createCalendar,
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
      jitter: () => 0,
    });
    expect(createCalendar).toHaveBeenCalledOnce();
    expect(repairAfterStale).toHaveBeenCalledWith({
      companyId,
      jobId: job.id,
    });
  });

  it("uses Calendar list read-back only after a prior create attempt", async () => {
    const { repository, finalize } = repositoryMock(baseJob);
    const createCalendar = vi.fn();
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      findCalendar: vi.fn(async () => ({ id: "provider-calendar" })),
      createCalendar,
    } as unknown as GoogleCalendarAdapter;
    await expect(
      reconcileGoogleCalendarCompany({
        repository,
        crypto: cryptoMock(),
        google,
        companyId,
        jitter: () => 0,
      }),
    ).resolves.toEqual({ claimed: 1 });
    expect(createCalendar).not.toHaveBeenCalled();
    expect(google.findCalendar).toHaveBeenCalledWith(
      "memory",
      "werehere-link:v1:lookup",
    );
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "SUCCEEDED",
        operation: "CALENDAR_READ_BACK",
      }),
    );
  });
  it("does not reinsert an event after an uncertain create response", async () => {
    const eventJob = {
      ...baseJob,
      aggregateType: "VISIT_EVENT",
      markerKeyVersion: 1,
      eventLinkId: "16000000-0000-4000-8000-000000000001",
      hotelLinkStatus: "ACTIVE",
      calendarCiphertext: "Yw==",
      calendarIv: "Y2NjY2NjY2NjY2Nj",
      calendarKeyVersion: 1,
      stableEventId: "ca12345",
      desiredSourceVersion: 2,
      attemptedSourceVersion: 2,
      attemptedEventLinkVersion: 1,
      appliedExists: false,
      visit: {
        id: "17000000-0000-4000-8000-000000000001",
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        status: "SCHEDULED",
        version: 2,
      },
    };
    const { repository, finalize } = repositoryMock(eventJob);
    const createEvent = vi.fn();
    const crypto = cryptoMock();
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      getEvent: vi.fn(async () => {
        throw GoogleCalendarProviderError.forStatus(404);
      }),
      createEvent,
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto,
      google,
      companyId,
      jitter: () => 0,
      now: () => new Date("2026-08-08T00:00:00.000Z"),
    });
    expect(createEvent).not.toHaveBeenCalled();
    expect(crypto.fingerprint).toHaveBeenCalledWith(
      expect.any(String),
      "event-link",
      1,
    );
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "RETRYABLE",
        operation: "EVENT_READ_BACK",
        safeErrorCode: "PROVIDER_CREATE_READBACK_PENDING",
      }),
    );
  });
  it("rejects an uncertain create read-back whose provider payload is stale", async () => {
    const eventJob = {
      ...baseJob,
      aggregateType: "VISIT_EVENT",
      markerKeyVersion: 1,
      eventLinkId: "16000000-0000-4000-8000-000000000001",
      hotelLinkStatus: "ACTIVE",
      calendarCiphertext: "Yw==",
      calendarIv: "Y2NjY2NjY2NjY2Nj",
      calendarKeyVersion: 1,
      stableEventId: "ca12345",
      desiredSourceVersion: 3,
      attemptedSourceVersion: 2,
      attemptedEventLinkVersion: 1,
      appliedExists: false,
      visit: {
        id: "17000000-0000-4000-8000-000000000001",
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        status: "SCHEDULED",
        version: 2,
      },
    };
    const { repository, finalize } = repositoryMock(eventJob);
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      getEvent: vi.fn(async () => ({
        id: "ca12345",
        etag: '"etag"',
        status: "confirmed",
        summary: "stale provider payload",
        start: {
          dateTime: "2026-08-08T10:00:00+09:00",
          timeZone: "Asia/Seoul",
        },
        end: { dateTime: "2026-08-08T11:00:00+09:00", timeZone: "Asia/Seoul" },
        extendedProperties: { private: { werehereLink: "lookup" } },
      })),
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
    });
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedSourceVersion: null,
        operation: "EVENT_READ_BACK",
        result: "ACTION_REQUIRED",
        safeErrorCode: "PROVIDER_EVENT_MISMATCH",
      }),
    );
  });
  it("durably marks create dispatch before the first provider create", async () => {
    const job = {
      ...baseJob,
      attemptNumber: 1,
      createDispatchState: "CREATE_NOT_ATTEMPTED",
    };
    const { repository, markCreateDispatched } = repositoryMock(job);
    const order: string[] = [];
    markCreateDispatched.mockImplementation(async () => {
      order.push("dispatch");
      return { status: "DISPATCH_RECORDED", payload: null };
    });
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      findCalendar: vi.fn(async () => null),
      createCalendar: vi.fn(async () => {
        order.push("provider");
        return { id: "provider-calendar" };
      }),
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
      jitter: () => 0,
    });
    expect(order).toEqual(["dispatch", "provider"]);
  });
  it("does not call the provider when durable dispatch loses its claim", async () => {
    const job = {
      ...baseJob,
      attemptNumber: 1,
      createDispatchState: "CREATE_NOT_ATTEMPTED",
    };
    const { repository, markCreateDispatched, finalize } = repositoryMock(job);
    markCreateDispatched.mockResolvedValue({
      status: "STALE_CLAIM",
      payload: null,
    });
    const createCalendar = vi.fn();
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      findCalendar: vi.fn(async () => null),
      createCalendar,
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
      jitter: () => 0,
    });
    expect(createCalendar).not.toHaveBeenCalled();
    expect(finalize).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ result: "PREFLIGHT" }),
    );
  });
  it("fails safely on an unexpected preflight status", async () => {
    const job = {
      ...baseJob,
      attemptNumber: 1,
      createDispatchState: "CREATE_NOT_ATTEMPTED",
    };
    const { repository, finalize } = repositoryMock(job);
    finalize.mockResolvedValue({ status: "FORBIDDEN", payload: null });
    const google = {
      refresh: vi.fn(async () => ({ accessToken: "memory", expiresIn: 3600, scopes: [] })),
      findCalendar: vi.fn(async () => null),
      createCalendar: vi.fn(),
    } as unknown as GoogleCalendarAdapter;
    await expect(
      reconcileGoogleCalendarCompany({ repository, crypto: cryptoMock(), google, companyId }),
    ).rejects.toThrow("Calendar projection finalize failure");
    expect(google.createCalendar).not.toHaveBeenCalled();
  });
  it("fails safely on an unexpected dispatch status", async () => {
    const job = {
      ...baseJob,
      attemptNumber: 1,
      createDispatchState: "CREATE_NOT_ATTEMPTED",
    };
    const { repository, markCreateDispatched } = repositoryMock(job);
    markCreateDispatched.mockResolvedValue({ status: "FORBIDDEN", payload: null });
    const google = {
      refresh: vi.fn(async () => ({ accessToken: "memory", expiresIn: 3600, scopes: [] })),
      findCalendar: vi.fn(async () => null),
      createCalendar: vi.fn(),
    } as unknown as GoogleCalendarAdapter;
    await expect(
      reconcileGoogleCalendarCompany({ repository, crypto: cryptoMock(), google, companyId }),
    ).rejects.toThrow("Calendar projection finalize failure");
    expect(google.createCalendar).not.toHaveBeenCalled();
  });
  it("fails safely when a provider mutation receives an unexpected finalize status", async () => {
    const job = {
      ...baseJob,
      attemptNumber: 1,
      createDispatchState: "CREATE_NOT_ATTEMPTED",
    };
    const { repository, finalize } = repositoryMock(job);
    finalize.mockImplementation(async (input: { result: string }) => ({
      status: input.result === "PREFLIGHT" ? "READY" : "FORBIDDEN",
      payload: null,
    }));
    const google = {
      refresh: vi.fn(async () => ({ accessToken: "memory", expiresIn: 3600, scopes: [] })),
      findCalendar: vi.fn(async () => null),
      createCalendar: vi.fn(async () => ({ id: "provider-calendar" })),
    } as unknown as GoogleCalendarAdapter;
    await expect(
      reconcileGoogleCalendarCompany({ repository, crypto: cryptoMock(), google, companyId }),
    ).rejects.toThrow("Calendar projection finalize failure");
    expect(google.createCalendar).toHaveBeenCalledOnce();
  });
  it("creates on a later attempt when no provider create was ever dispatched", async () => {
    const job = {
      ...baseJob,
      attemptNumber: 2,
      createDispatchState: "CREATE_NOT_ATTEMPTED",
    };
    const { repository, markCreateDispatched } = repositoryMock(job);
    const createCalendar = vi.fn(async () => ({ id: "provider-calendar" }));
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      findCalendar: vi.fn(async () => null),
      createCalendar,
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
      jitter: () => 0,
    });
    expect(markCreateDispatched).toHaveBeenCalledOnce();
    expect(createCalendar).toHaveBeenCalledOnce();
  });
  it("durably recreates a confirmed event only after provider 404", async () => {
    const eventJob = {
      ...baseJob,
      aggregateType: "VISIT_EVENT",
      markerKeyVersion: 1,
      eventLinkId: "16000000-0000-4000-8000-000000000001",
      attemptedEventLinkVersion: 1,
      attemptedSourceVersion: 2,
      hotelLinkStatus: "ACTIVE",
      calendarCiphertext: "Yw==",
      calendarIv: "Y2NjY2NjY2NjY2Nj",
      calendarKeyVersion: 1,
      stableEventId: "ca12345",
      desiredSourceVersion: 2,
      appliedSourceVersion: 1,
      appliedExists: true,
      createDispatchState: "CREATE_CONFIRMED",
      visit: {
        id: "17000000-0000-4000-8000-000000000001",
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        status: "SCHEDULED",
        version: 2,
      },
    };
    const {
      repository,
      markCreateDispatched,
      resetEventExistence,
      withProviderMutationFence,
    } = repositoryMock(eventJob);
    const createEvent = vi.fn();
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      getEvent: vi.fn(async () => ({
        id: "ca12345",
        etag: '"etag-current"',
        status: "confirmed",
        extendedProperties: {
          private: { werehereLink: Buffer.alloc(32).toString("base64url") },
        },
      })),
      updateEvent: vi.fn(async () => {
        throw GoogleCalendarProviderError.forStatus(404);
      }),
      getCalendar: vi.fn(async () => ({
        id: "lookup",
        description: "werehere-link:v1:lookup",
      })),
      createEvent,
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
      jitter: () => 0,
    });
    expect(markCreateDispatched).toHaveBeenCalledOnce();
    expect(resetEventExistence).toHaveBeenCalledOnce();
    expect(withProviderMutationFence).toHaveBeenCalledOnce();
    expect(google.getCalendar).toHaveBeenCalledOnce();
    expect(createEvent).toHaveBeenCalledOnce();
    const invocationOrder = [
      vi.mocked(google.updateEvent).mock.invocationCallOrder[0],
      vi.mocked(google.getCalendar).mock.invocationCallOrder[0],
      resetEventExistence.mock.invocationCallOrder[0],
      markCreateDispatched.mock.invocationCallOrder[0],
      createEvent.mock.invocationCallOrder[0],
    ];
    expect(invocationOrder).toEqual([...invocationOrder].sort((a, b) => a! - b!));
  });
  it("enqueues durable repair when a late provider update loses its finalize fence", async () => {
    const eventJob = {
      ...baseJob,
      aggregateType: "VISIT_EVENT",
      markerKeyVersion: 1,
      eventLinkId: "16000000-0000-4000-8000-000000000001",
      attemptedEventLinkVersion: 1,
      attemptedSourceVersion: 2,
      hotelLinkStatus: "ACTIVE",
      calendarCiphertext: "Yw==",
      calendarIv: "Y2NjY2NjY2NjY2Nj",
      calendarKeyVersion: 1,
      stableEventId: "ca12345",
      desiredSourceVersion: 2,
      appliedSourceVersion: 1,
      appliedExists: true,
      createDispatchState: "CREATE_CONFIRMED",
      visit: {
        id: "17000000-0000-4000-8000-000000000001",
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        status: "SCHEDULED",
        version: 2,
      },
    };
    const { repository, finalize, repairAfterStale } = repositoryMock(eventJob);
    finalize.mockImplementation(async (input: { result: string }) => ({
      status: input.result === "PREFLIGHT" ? "READY" : "STALE_VERSION",
      payload: null,
    }));
    const updateEvent = vi.fn(async () => ({ id: "ca12345" }));
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      getEvent: vi.fn(async () => ({
        id: "ca12345",
        etag: '"etag-current"',
        status: "confirmed",
        extendedProperties: {
          private: { werehereLink: Buffer.alloc(32).toString("base64url") },
        },
      })),
      updateEvent,
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
      jitter: () => 0,
    });
    expect(updateEvent).toHaveBeenCalledWith(
      "memory",
      "lookup",
      expect.objectContaining({ etag: '"etag-current"' }),
    );
    expect(
      finalize.mock.calls.filter(([input]) => input.result === "PREFLIGHT"),
    ).toHaveLength(2);
    expect(repairAfterStale).toHaveBeenCalledWith({
      companyId,
      jobId: eventJob.id,
    });
  });
  it("updates a cancelled visit on the stable provider event and repairs a stale finalize", async () => {
    const eventJob = {
      ...baseJob,
      aggregateType: "VISIT_EVENT",
      markerKeyVersion: 1,
      eventLinkId: "16000000-0000-4000-8000-000000000002",
      attemptedEventLinkVersion: 1,
      attemptedSourceVersion: 3,
      hotelLinkStatus: "ACTIVE",
      calendarCiphertext: "Yw==",
      calendarIv: "Y2NjY2NjY2NjY2Nj",
      calendarKeyVersion: 1,
      stableEventId: "ca12346",
      desiredSourceVersion: 3,
      appliedSourceVersion: 2,
      appliedExists: true,
      createDispatchState: "CREATE_CONFIRMED",
      visit: {
        id: "17000000-0000-4000-8000-000000000002",
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        status: "CANCELLED",
        version: 3,
      },
    };
    const { repository, finalize, repairAfterStale } = repositoryMock(eventJob);
    finalize.mockImplementation(async (input: { result: string }) => ({
      status: input.result === "PREFLIGHT" ? "READY" : "STALE_VERSION",
      payload: null,
    }));
    const deleteEvent = vi.fn(async () => undefined);
    const updateEvent = vi.fn(async () => undefined);
    const google = {
      refresh: vi.fn(async () => ({
        accessToken: "memory",
        expiresIn: 3600,
        scopes: [],
      })),
      getEvent: vi.fn(async () => ({
        id: "ca12346",
        etag: '"etag-delete"',
        status: "confirmed",
        extendedProperties: {
          private: { werehereLink: Buffer.alloc(32).toString("base64url") },
        },
      })),
      updateEvent,
      deleteEvent,
    } as unknown as GoogleCalendarAdapter;
    await reconcileGoogleCalendarCompany({
      repository,
      crypto: cryptoMock(),
      google,
      companyId,
      jitter: () => 0,
    });
    expect(updateEvent).toHaveBeenCalledWith(
      "memory",
      "lookup",
      expect.objectContaining({
        id: "ca12346",
        cancelled: true,
        etag: '"etag-delete"',
      }),
    );
    expect(deleteEvent).not.toHaveBeenCalled();
    expect(
      finalize.mock.calls.filter(([input]) => input.result === "PREFLIGHT"),
    ).toHaveLength(2);
    expect(repairAfterStale).toHaveBeenCalledWith({
      companyId,
      jobId: eventJob.id,
    });
  });
});

describe("Google Calendar candidate verification", () => {
  it("moves a provider-accessible candidate to ACCESS_VERIFIED without auto-promoting it", async () => {
    const candidateFinalize = vi.fn(async () => ({
      status: "ACCESS_VERIFIED",
      payload: null,
    }));
    const repository = {
      candidateClaim: vi.fn(async () => ({
        status: "CLAIMED",
        payload: {
          candidate: {
            candidateId: "18000000-0000-4000-8000-000000000001",
            candidateRowVersion: 2,
            connectionId: "14000000-0000-4000-8000-000000000001",
            connectionVersion: 1,
            credentialVersion: 2,
            credentialFingerprint: Buffer.alloc(32).toString("base64"),
            credentialFingerprintKeyVersion: 1,
            activeCredentialFingerprint: Buffer.alloc(32).toString("base64"),
            activeCredentialFingerprintKeyVersion: 1,
            credentialCiphertext: "YQ==",
            credentialIv: "YWFhYWFhYWFhYWFh",
            credentialKeyVersion: 1,
            links: [],
          },
        },
      })),
      candidateFinalize,
    } as unknown as CalendarProjectionRepository;
    await expect(
      reconcileGoogleCalendarCandidate({
        repository,
        crypto: cryptoMock(),
        google: {
          refresh: vi.fn(async () => ({
            accessToken: "memory",
            expiresIn: 3600,
            scopes: [],
          })),
          principalId: vi.fn(async () => "stable-google-principal"),
        } as unknown as GoogleCalendarAdapter,
        companyId,
        jitter: () => 0,
      }),
    ).resolves.toEqual({ claimed: 1 });
    expect(candidateFinalize).toHaveBeenCalledWith(
      expect.objectContaining({ result: "ACCESS_VERIFIED" }),
    );
  });

  it("keeps a same-principal inaccessible Calendar in ACTION_REQUIRED without account-change confirmation", async () => {
    const candidateFinalize = vi.fn(async () => ({
      status: "ACTION_REQUIRED",
      payload: null,
    }));
    const findCalendar = vi.fn(async () => null);
    const createCalendar = vi.fn();
    const repository = {
      candidateClaim: vi.fn(async () => ({
        status: "CLAIMED",
        payload: {
          candidate: {
            candidateId: "18000000-0000-4000-8000-000000000001",
            candidateRowVersion: 2,
            connectionId: "14000000-0000-4000-8000-000000000001",
            connectionVersion: 1,
            credentialVersion: 2,
            credentialFingerprint: Buffer.alloc(32).toString("base64"),
            credentialFingerprintKeyVersion: 1,
            activeCredentialFingerprint: Buffer.alloc(32).toString("base64"),
            activeCredentialFingerprintKeyVersion: 1,
            credentialCiphertext: "YQ==",
            credentialIv: "YWFhYWFhYWFhYWFh",
            credentialKeyVersion: 1,
            links: [
              {
                hotelId: "50000000-0000-4000-8000-000000000001",
                hotelLinkId: "15000000-0000-4000-8000-000000000001",
                generation: 1,
                lookupCiphertext: "YQ==",
                lookupIv: "YWFhYWFhYWFhYWFh",
                lookupKeyVersion: 1,
                calendarCiphertext: "YQ==",
                calendarIv: "YWFhYWFhYWFhYWFh",
                calendarKeyVersion: 1,
              },
            ],
          },
        },
      })),
      candidateFinalize,
    } as unknown as CalendarProjectionRepository;
    await reconcileGoogleCalendarCandidate({
      repository,
      crypto: cryptoMock(),
      google: {
        refresh: vi.fn(async () => ({
          accessToken: "memory",
          expiresIn: 3600,
          scopes: [],
        })),
        findCalendar,
        createCalendar,
      } as unknown as GoogleCalendarAdapter,
      companyId,
      jitter: () => 0,
    });
    expect(candidateFinalize).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "ACTION_REQUIRED",
        safeErrorCode: "PROVIDER_CALENDAR_ACCESS_MISMATCH",
      }),
    );
    expect(candidateFinalize).not.toHaveBeenCalledWith(
      expect.objectContaining({
        result: "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION",
      }),
    );
    expect(createCalendar).not.toHaveBeenCalled();
  });
});

describe("Google Calendar company failure isolation", () => {
  it("runs projection work before reporting an isolated candidate failure", async () => {
    const candidate = vi.fn(async () => {
      throw new Error("candidate-invalid");
    });
    const projection = vi.fn(async () => ({ claimed: 2 }));

    await expect(
      reconcileGoogleCalendarCompanyStages({ candidate, projection }),
    ).rejects.toThrow("candidate-invalid");
    expect(candidate).toHaveBeenCalledTimes(1);
    expect(projection).toHaveBeenCalledTimes(1);
  });

  it("continues with later companies and rejects after collecting safe failures", async () => {
    const companyIds = [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
    ];
    const reconcile = vi.fn(async (id: string) => {
      if (id === companyIds[0]) throw new Error("isolated");
      return { claimed: 2 };
    });
    await expect(
      reconcileGoogleCalendarCompanies({ companyIds, reconcile }),
    ).rejects.toThrow("CALENDAR_COMPANY_RECONCILIATION_FAILED");
    expect(reconcile).toHaveBeenCalledTimes(2);
  });
});
