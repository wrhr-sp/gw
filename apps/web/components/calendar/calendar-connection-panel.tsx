"use client";

import {
  calendarConnectionDisconnectRequestSchema,
  calendarConnectionCommandResponseSchema,
  calendarConnectionRoutes,
  calendarConnectionStatusResponseSchema,
  calendarCredentialCandidateCommandRequestSchema,
  calendarFailureRetryRequestSchema,
  calendarHotelCreateRequestSchema,
  calendarHotelDisconnectRequestSchema,
  calendarOAuthStartResponseSchema,
  hotelErrorResponseSchema,
} from "@werehere/contracts";
import { FeatureGuide, type FeatureGuideContent } from "@werehere/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Link2Off,
  RefreshCw,
} from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createLogicalIdempotencyKeyStore,
  type LogicalMutationOperation,
} from "../../lib/logical-idempotency";

type StatusData = z.infer<
  typeof calendarConnectionStatusResponseSchema
>["data"];
type ReasonForm = { reason: string };
type CalendarLogicalOperation = LogicalMutationOperation;
const statusLabel: Record<string, string> = {
  NOT_CONNECTED: "연결 안 됨",
  CONNECTED: "연결됨",
  RECONNECT_REQUIRED: "재연결 필요",
  DISCONNECTED: "연결 해제됨",
  ACTIVE: "반영됨",
  PENDING: "반영 중",
  ACTION_REQUIRED: "확인 필요",
  NOT_CREATED: "아직 만들지 않음",
  SYNCED: "최신 상태",
  CANDIDATE: "후보 확인 필요",
  ACCESS_VERIFIED: "접근 확인됨",
  ACCOUNT_CHANGE_REQUIRES_CONFIRMATION: "계정변경 확인 필요",
};
const calendarConnectionGuide = {
  audience: [
    "Google Calendar 연결을 관리할 수 있고 현재 호텔배정이 있는 관리자",
  ],
  cautions: [
    "그룹웨어 PostgreSQL 일정이 정본이며 Google Calendar는 단방향 반영 대상입니다.",
    "계정 재연결과 연결 해제 전에는 영향을 받는 호텔과 변경 사유를 확인합니다.",
  ],
  featureKey: "hotel-calendar.connection",
  permissions: [
    "회사 연결 관리 권한과 대상 호텔의 현재 배정·관리 권한이 필요합니다.",
  ],
  steps: [
    "Google 계정을 연결하거나 재연결합니다.",
    "호텔별 Calendar를 만들고 반영 상태를 확인합니다.",
    "확인 필요 상태는 원인을 확인한 뒤 다시 시도합니다.",
  ],
  summary: "회사 Google 계정과 호텔별 Calendar 연결·반영 상태를 관리합니다.",
  title: "Google Calendar 연결",
  version: "1.0",
} as const satisfies FeatureGuideContent;
class CalendarUiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = hotelErrorResponseSchema.safeParse(payload);
    if (!parsed.success)
      throw new CalendarUiError(
        "Google Calendar 오류 응답을 안전하게 확인하지 못했습니다.",
        "MALFORMED_ERROR_RESPONSE",
        false,
      );
    throw new CalendarUiError(
      parsed.data.error.message,
      parsed.data.error.code,
      parsed.data.error.retryable,
    );
  }
  return payload;
}
async function fetchStatus(signal?: AbortSignal): Promise<StatusData> {
  const parsed = calendarConnectionStatusResponseSchema.safeParse(
    await jsonRequest(
      calendarConnectionRoutes.status,
      signal ? { signal } : undefined,
    ),
  );
  if (!parsed.success)
    throw new Error("연결 상태 응답을 안전하게 확인하지 못했습니다.");
  return parsed.data.data;
}

export function CalendarConnectionPanel({
  initialData,
}: { initialData?: StatusData } = {}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <CalendarConnectionContent initialData={initialData} />
    </QueryClientProvider>
  );
}
function CalendarConnectionContent({
  initialData,
}: {
  initialData: StatusData | undefined;
}) {
  const [announcement, setAnnouncement] = useState("");
  const [idempotencyKeys] = useState(() =>
    createLogicalIdempotencyKeyStore(),
  );
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["calendar-connection-status"],
    queryFn: ({ signal }) => fetchStatus(signal),
    initialData,
  });
  const {
    register,
    getValues,
    clearErrors,
    setFocus,
    trigger,
    formState: { errors },
  } = useForm<ReasonForm>({ defaultValues: { reason: "" } });
  const start = useMutation({
    mutationFn: async (reconnect: boolean) => {
      const expectedConnectionVersion = reconnect ? status.data?.version : null;
      if (reconnect && !expectedConnectionVersion)
        throw new Error("최신 연결 version을 확인하지 못했습니다.");
      const body = {
        returnPath: "/admin/calendar" as const,
        reconnect,
        expectedConnectionVersion,
      };
      const operation = { path: calendarConnectionRoutes.oauthStart, body };
      const idempotencyKey = idempotencyKeys.acquire(operation);
      try {
        const parsed = calendarOAuthStartResponseSchema.safeParse(
          await jsonRequest(calendarConnectionRoutes.oauthStart, {
            method: "POST",
            headers: { "Idempotency-Key": idempotencyKey },
            body: JSON.stringify(body),
          }),
        );
        if (!parsed.success)
          throw new Error("연결 시작 응답을 안전하게 확인하지 못했습니다.");
        idempotencyKeys.complete(operation);
        window.location.assign(parsed.data.data.authorizationUrl);
      } catch (error) {
        idempotencyKeys.settle(
          operation,
          error instanceof CalendarUiError && !error.retryable,
        );
        throw error;
      }
    },
  });
  const command = useMutation({
    mutationFn: async (input: CalendarLogicalOperation) => {
      const idempotencyKey = idempotencyKeys.acquire(input);
      const receipt = calendarConnectionCommandResponseSchema.parse(
        await jsonRequest(input.path, {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(input.body),
        }),
      );
      return { input, receipt };
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["calendar-connection-status"],
      });
      setAnnouncement("변경 내용을 저장하고 최신 상태를 확인하고 있습니다.");
    },
    onSuccess: async ({ input: operation, receipt }) => {
      await queryClient.cancelQueries({
        queryKey: ["calendar-connection-status"],
      });
      const canonical = await queryClient.fetchQuery({
        queryKey: ["calendar-connection-status"],
        queryFn: ({ signal }) => fetchStatus(signal),
        staleTime: 0,
      });
      if (JSON.stringify(receipt.data) !== JSON.stringify(canonical))
        throw new Error("변경 결과와 최신 연결 상태가 일치하지 않습니다.");
      queryClient.setQueryData(["calendar-connection-status"], canonical);
      idempotencyKeys.complete(operation);
      setAnnouncement("변경 후 최신 상태를 확인했습니다.");
    },
    onError: async (error, operation) => {
      setAnnouncement("");
      idempotencyKeys.settle(
        operation,
        error instanceof CalendarUiError && !error.retryable,
      );
      if (
        error instanceof CalendarUiError &&
        error.code === "CALENDAR_CONNECTION_VERSION_CONFLICT"
      ) {
        await queryClient.cancelQueries({
          queryKey: ["calendar-connection-status"],
        });
        try {
          await queryClient.fetchQuery({
            queryKey: ["calendar-connection-status"],
            queryFn: ({ signal }) => fetchStatus(signal),
            staleTime: 0,
          });
          setAnnouncement("최신 연결 상태를 다시 확인했습니다.");
        } catch {
          setAnnouncement("최신 연결 상태를 다시 확인하지 못했습니다.");
        }
      }
    },
  });
  async function reason() {
    if (!(await trigger("reason", { shouldFocus: true }))) {
      setFocus("reason");
      return null;
    }
    const value = getValues("reason").trim();
    clearErrors("reason");
    return value;
  }
  async function connectionAction(
    action: "DISCONNECT" | "PROMOTE_CANDIDATE" | "CONFIRM_ACCOUNT_CHANGE",
    version: number,
    candidateId?: string,
    expectedCandidateRowVersion?: number,
  ) {
    const value = await reason();
    if (!value) return;
    const connectionId = status.data?.connectionId;
    if (!connectionId) throw new Error("최신 연결 ID를 확인하지 못했습니다.");
    if (action === "DISCONNECT") {
      const body = calendarConnectionDisconnectRequestSchema.parse({
        expectedVersion: version,
        reason: value,
      });
      command.mutate({
        path: calendarConnectionRoutes.disconnect(connectionId),
        body,
      });
      return;
    }
    if (!candidateId || !expectedCandidateRowVersion)
      throw new Error("최신 후보 credential version을 확인하지 못했습니다.");
    const body = calendarCredentialCandidateCommandRequestSchema.parse({
      expectedVersion: version,
      expectedCandidateRowVersion,
      reason: value,
    });
    command.mutate({
      path:
        action === "PROMOTE_CANDIDATE"
          ? calendarConnectionRoutes.candidatePromote(connectionId, candidateId)
          : calendarConnectionRoutes.candidateConfirmSwitch(
              connectionId,
              candidateId,
            ),
      body,
    });
  }
  async function hotelAction(
    hotel: StatusData["hotels"][number],
    action: "CREATE" | "DISCONNECT",
  ) {
    const connectionId = status.data?.connectionId;
    const expectedConnectionVersion = status.data?.version;
    if (!connectionId || !expectedConnectionVersion)
      throw new Error("최신 연결 version을 확인하지 못했습니다.");
    if (action === "CREATE") {
      const body = calendarHotelCreateRequestSchema.parse({
        branchId: hotel.hotelId,
        expectedConnectionVersion,
      });
      command.mutate({
        path: calendarConnectionRoutes.hotelCreate(connectionId),
        body,
      });
      return;
    }
    const value = await reason();
    if (!value) return;
    const body = calendarHotelDisconnectRequestSchema.parse({
      expectedConnectionVersion,
      expectedLinkVersion: hotel.version,
      reason: value,
    });
    command.mutate({
      path: calendarConnectionRoutes.hotelDisconnect(
        connectionId,
        hotel.hotelId,
      ),
      body,
    });
  }
  async function failureAction(failure: StatusData["failures"][number]) {
    const value = await reason();
    if (!value) return;
    const body = calendarFailureRetryRequestSchema.parse({
      expectedVersion: failure.version,
      reason: value,
    });
    command.mutate({
      path: calendarConnectionRoutes.failureRetry(
        failure.hotelId,
        failure.failureId,
      ),
      body,
    });
  }
  const data = status.data;
  const error = (status.error ?? start.error ?? command.error) as Error | null;
  return (
    <section
      aria-busy={status.isFetching || start.isPending || command.isPending}
      aria-labelledby="calendar-connection-title"
      className="space-y-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary">관리자 설정</p>
          <div className="flex items-center gap-2">
            <h1
              id="calendar-connection-title"
              className="text-2xl font-bold text-foreground"
            >
              Google Calendar 연결
            </h1>
            <FeatureGuide content={calendarConnectionGuide} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            호텔 업무일정은 PostgreSQL이 정본이며 Google Calendar에는 최소
            일정만 단방향으로 반영합니다.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 text-sm font-semibold"
          disabled={status.isFetching}
          onClick={() => status.refetch()}
          type="button"
        >
          <RefreshCw size={17} />
          새로고침
        </button>
      </header>
      {error ? (
        <div
          className="rounded-panel border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
          role="alert"
        >
          <p>{error.message}</p>
          {error instanceof CalendarUiError ? (
            <p className="mt-1 font-mono text-xs">
              오류 코드: {error.code}
            </p>
          ) : null}
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>
      {status.isLoading ? (
        <div
          aria-live="polite"
          className="rounded-panel border border-border bg-surface p-6 text-sm text-muted"
        >
          연결 상태를 확인하고 있습니다.
        </div>
      ) : null}
      {data ? (
        <>
          <article className="rounded-panel border border-border bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <Cloud size={22} />
                </span>
                <div>
                  <h2 className="font-bold">회사 연동계정</h2>
                  <p className="text-sm text-muted">
                    {statusLabel[data.connectionStatus] ??
                      data.connectionStatus}
                    {data.credentialStatus
                      ? ` · ${statusLabel[data.credentialStatus] ?? data.credentialStatus}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.connectionStatus === "NOT_CONNECTED" ||
                data.connectionStatus === "DISCONNECTED" ? (
                  <button
                    className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white"
                    disabled={start.isPending}
                    onClick={() =>
                      start.mutate(data.connectionStatus === "DISCONNECTED")
                    }
                    type="button"
                  >
                    Google 계정 연결
                  </button>
                ) : (
                  <button
                    className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold"
                    disabled={start.isPending}
                    onClick={() => start.mutate(true)}
                    type="button"
                  >
                    재연결
                  </button>
                )}
                {data.credentialStatus === "ACCESS_VERIFIED" &&
                data.version &&
                data.candidateId &&
                data.candidateRowVersion ? (
                  <button
                    className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white"
                    disabled={command.isPending}
                    onClick={() =>
                      connectionAction(
                        "PROMOTE_CANDIDATE",
                        data.version!,
                        data.candidateId!,
                        data.candidateRowVersion!,
                      )
                    }
                    type="button"
                  >
                    후보 사용
                  </button>
                ) : null}
                {data.credentialStatus ===
                  "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION" &&
                data.version &&
                data.candidateId &&
                data.candidateRowVersion ? (
                  <button
                    className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white"
                    disabled={command.isPending}
                    onClick={() =>
                      connectionAction(
                        "CONFIRM_ACCOUNT_CHANGE",
                        data.version!,
                        data.candidateId!,
                        data.candidateRowVersion!,
                      )
                    }
                    type="button"
                  >
                    계정변경 확인
                  </button>
                ) : null}
                {data.connectionStatus === "CONNECTED" && data.version ? (
                  <button
                    className="min-h-11 rounded-button border border-danger/40 px-4 text-sm font-semibold text-danger"
                    disabled={command.isPending}
                    onClick={() =>
                      connectionAction("DISCONNECT", data.version!)
                    }
                    type="button"
                  >
                    <Link2Off className="mr-1 inline" size={16} />
                    연결 해제
                  </button>
                ) : null}
              </div>
            </div>
          </article>
          <label
            className="block rounded-panel border border-border bg-surface p-4 text-sm font-semibold"
            htmlFor="calendar-change-reason"
          >
            변경 사유
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
            <textarea
              aria-describedby={
                errors.reason ? "calendar-change-reason-error" : undefined
              }
              aria-invalid={Boolean(errors.reason)}
              aria-required="true"
              className="mt-2 min-h-24 w-full rounded-button border border-border bg-background p-3 font-normal outline-none focus:border-primary"
              id="calendar-change-reason"
              {...register("reason", {
                validate: {
                  required: (value) =>
                    value.trim().length > 0 || "변경 사유를 입력해 주세요.",
                  minTrimmedLength: (value) =>
                    value.trim().length >= 2 || "두 글자 이상 입력해 주세요.",
                  maxTrimmedLength: (value) =>
                    value.trim().length <= 500 || "500자 이내로 입력해 주세요.",
                },
              })}
              maxLength={500}
              placeholder="예: 호텔 일정 반영을 시작합니다."
              required
            />
            {errors.reason ? (
              <span
                className="mt-1 block text-xs text-danger"
                id="calendar-change-reason-error"
                role="alert"
              >
                {errors.reason.message}
              </span>
            ) : null}
          </label>
          <div>
            <h2 className="text-lg font-bold">호텔별 Calendar</h2>
            <p className="mt-1 text-sm text-muted">
              연결된 회사 계정 안에 호텔별 전용 Calendar를 만들고 반영상태를
              확인합니다.
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {data.hotels.map((hotel) => (
                <article
                  className="rounded-panel border border-border bg-surface p-4 shadow-sm"
                  key={hotel.hotelId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{hotel.hotelName}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                        {hotel.projectionStatus === "ACTION_REQUIRED" ? (
                          <AlertTriangle className="text-danger" size={16} />
                        ) : (
                          <CheckCircle2 className="text-accent" size={16} />
                        )}{" "}
                        {statusLabel[hotel.linkStatus] ?? hotel.linkStatus} ·{" "}
                        {statusLabel[hotel.projectionStatus] ??
                          hotel.projectionStatus}
                      </p>
                      {hotel.lastFailureCode ? (
                        <p className="mt-2 text-xs text-danger">
                          최근 반영 실패를 확인하고 수동 재시도해 주세요.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {hotel.linkStatus === "NOT_CREATED" ? (
                        <button
                          className="min-h-11 rounded-button bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={
                            data.connectionStatus !== "CONNECTED" ||
                            command.isPending
                          }
                          onClick={() => hotelAction(hotel, "CREATE")}
                          type="button"
                        >
                          Calendar 만들기
                        </button>
                      ) : null}
                      {hotel.linkStatus === "ACTIVE" ? (
                        <button
                          className="min-h-11 rounded-button border border-danger/40 px-3 text-sm font-semibold text-danger"
                          disabled={command.isPending}
                          onClick={() => hotelAction(hotel, "DISCONNECT")}
                          type="button"
                        >
                          해제
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {data.failures.length ? (
              <div className="mt-4 space-y-2" aria-label="반영 실패 목록">
                {data.failures.map((failure) => {
                  const hotel = data.hotels.find(
                    (item) => item.hotelId === failure.hotelId,
                  );
                  return (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-danger/30 bg-danger/5 p-3"
                      key={failure.failureId}
                    >
                      <p className="text-sm text-danger">
                        {hotel?.hotelName ?? "호텔"} · 반영 실패
                      </p>
                      <button
                        className="min-h-11 rounded-button border border-danger/40 px-3 text-sm font-semibold text-danger"
                        disabled={command.isPending}
                        onClick={() => failureAction(failure)}
                        type="button"
                      >
                        이 실패 다시 시도
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
