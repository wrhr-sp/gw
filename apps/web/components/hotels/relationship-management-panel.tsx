"use client";

import {
  activateHotelRequestSchema,
  hotelActivationMutationResponseSchema,
  createHotelAssignmentRequestSchema,
  endHotelAssignmentRequestSchema,
  hotelAssignmentListResponseSchema,
  hotelAssignmentMutationResponseSchema,
  hotelEligibleCandidatesResponseSchema,
  hotelErrorResponseSchema,
  hotelOwnerRelationshipsResponseSchema,
  hotelRoutes,
  ownerTransferRequestSchema,
  type HotelAssignmentView,
  type HotelErrorCode,
  type HotelRelationshipPerson,
} from "@werehere/contracts";
import { Button, FeatureGuide, StatusBadge } from "@werehere/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

const inputClassName =
  "mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const textAreaClassName =
  "mt-1 min-h-24 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const readinessLabels: Record<string, string> = {
  OWNER: "호텔 소유주",
  STAFF: "사내 임직원 배정",
  INSPECTION_MANAGER: "점검 담당자",
  ROOM: "객실",
  CHECKLIST: "체크리스트",
  SCHEDULE: "점검 일정",
  CONTACT: "문의처와 문의 라우팅",
};

type RelationshipKind = "STAFF" | "HOUSEKEEPING" | "OWNER";
type CandidateSets = Partial<
  Record<RelationshipKind, HotelRelationshipPerson[]>
>;
export type RelationshipInitialData = {
  assignments: HotelAssignmentView[];
  owners: HotelAssignmentView[];
  candidates?: CandidateSets;
};
type AssignmentForm = {
  relationshipType: "STAFF" | "HOUSEKEEPING";
  assignmentType: "PRIMARY" | "SUPPORT";
  startDate: string;
  userId: string;
  reason: string;
};

type RelationshipPanelProps = {
  hotelId: string;
  hotelName?: string | undefined;
  hotelVersion: number;
  initialData?: RelationshipInitialData | undefined;
};

type RequestFailure = {
  code: HotelErrorCode | "UNKNOWN";
  fieldErrors: Array<{ field: string; message: string }>;
  message: string;
};
type FailureContext = "assignment" | "owner" | "end" | "activation";

function normalizeFailure(error: unknown): RequestFailure {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "fieldErrors" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string" &&
    Array.isArray(error.fieldErrors)
  ) {
    return error as RequestFailure;
  }
  return {
    code: "UNKNOWN",
    fieldErrors: [],
    message:
      "서버 응답을 확인할 수 없습니다. 입력값을 유지했으니 다시 시도해 주세요.",
  };
}

function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

function reloadHotelDetail(delay = 2_000) {
  window.setTimeout(() => window.location.reload(), delay);
}

export function relationshipFailureMessage(failure: RequestFailure) {
  switch (failure.code) {
    case "VERSION_CONFLICT":
      return "다른 사용자가 호텔 정보를 먼저 변경했습니다. 최신 정보를 불러왔으니 다시 확인해 주세요.";
    case "HOTEL_RELATIONSHIP_CONFLICT":
      return "선택한 사용자의 관계 기간이 다른 배정과 겹칩니다. 최신 후보와 기간을 다시 확인해 주세요.";
    case "REAUTHENTICATION_REQUIRED":
      return "소유주 교체는 최근 5분 이내 로그인 확인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.";
    case "DEPENDENT_WORK_REASSIGNMENT_REQUIRED":
      return "진행 중인 업무를 먼저 재배정해야 정상 종료할 수 있습니다. 현재는 긴급 종료만 지원합니다.";
    default:
      return failure.message;
  }
}

async function apiRequest(url: string, init?: RequestInit) {
  let response: Response;
  let value: unknown;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
    value = await response.json();
  } catch {
    throw {
      code: "UNKNOWN",
      fieldErrors: [],
      message:
        "서버에 연결할 수 없습니다. 입력값을 유지했으니 다시 시도해 주세요.",
    } satisfies RequestFailure;
  }
  if (!response.ok) {
    const parsed = hotelErrorResponseSchema.safeParse(value);
    const failure: RequestFailure = parsed.success
      ? parsed.data.error
      : {
          code: "UNKNOWN",
          fieldErrors: [],
          message: "요청을 처리하지 못했습니다.",
        };
    throw failure;
  }
  return value;
}

function RelationshipManagementContent({
  hotelId,
  hotelName = "이 호텔",
  hotelVersion,
  initialData,
}: RelationshipPanelProps) {
  const queryClient = useQueryClient();

  const assignmentDialog = useRef<HTMLDialogElement>(null);
  const ownerDialog = useRef<HTMLDialogElement>(null);
  const endDialog = useRef<HTMLDialogElement>(null);
  const assignmentFailureRef = useRef<HTMLDivElement>(null);
  const assignmentValidationRef = useRef<HTMLDivElement>(null);
  const ownerFailureRef = useRef<HTMLDivElement>(null);
  const endFailureRef = useRef<HTMLDivElement>(null);
  const endTriggerRef = useRef<HTMLButtonElement>(null);
  const endCompletedRef = useRef(false);

  const [selectedEnd, setSelectedEnd] = useState<HotelAssignmentView | null>(
    null,
  );
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerSelected, setOwnerSelected] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [ownerPage, setOwnerPage] = useState(1);
  const debouncedCandidateSearch = useDebouncedValue(candidateSearch);
  const debouncedOwnerSearch = useDebouncedValue(ownerSearch);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [failureContext, setFailureContext] = useState<FailureContext | null>(
    null,
  );
  const [profileVersionStale, setProfileVersionStale] = useState(false);
  const [readinessChecked, setReadinessChecked] = useState(false);
  const [missingReadiness, setMissingReadiness] = useState<string[]>([]);
  const idempotency = useRef(new Map<string, { body: string; key: string }>());
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  );
  const assignmentForm = useForm<AssignmentForm>({
    defaultValues: {
      relationshipType: "STAFF",
      assignmentType: "PRIMARY",
      startDate: today,
      userId: "",
      reason: "",
    },
  });
  const relationshipType = assignmentForm.watch("relationshipType");
  const assignmentType = assignmentForm.watch("assignmentType");
  const startDate = assignmentForm.watch("startDate");

  useEffect(() => {
    if (!failure || !failureContext) return;
    const target =
      failureContext === "assignment"
        ? assignmentFailureRef.current
        : failureContext === "owner"
          ? ownerFailureRef.current
          : failureContext === "end"
            ? endFailureRef.current
            : null;
    if (target) requestAnimationFrame(() => target.focus());
  }, [failure, failureContext]);

  const assignments = useQuery({
    queryKey: ["hotel-relationships", hotelId, "assignments"],
    initialData: initialData?.assignments,
    queryFn: async () => {
      const value = await apiRequest(hotelRoutes.assignments(hotelId));
      return hotelAssignmentListResponseSchema.parse(value).data.assignments;
    },
  });
  const owners = useQuery({
    queryKey: ["hotel-relationships", hotelId, "owner"],
    initialData: initialData?.owners,
    queryFn: async () => {
      const value = await apiRequest(hotelRoutes.owner(hotelId));
      return hotelOwnerRelationshipsResponseSchema.parse(value).data.owners;
    },
  });
  const candidateParams = new URLSearchParams({
    relationshipType,
    startDate,
    page: String(candidatePage),
    pageSize: "100",
  });
  if (relationshipType === "STAFF")
    candidateParams.set("assignmentType", assignmentType);
  if (debouncedCandidateSearch.trim())
    candidateParams.set("q", debouncedCandidateSearch.trim());
  const candidates = useQuery({
    enabled: assignmentDialogOpen,
    queryKey: [
      "hotel-relationships",
      hotelId,
      "candidates",
      candidateParams.toString(),
    ],
    initialData:
      candidatePage === 1 && initialData?.candidates?.[relationshipType]
        ? {
            candidates: initialData.candidates[relationshipType] ?? [],
            pagination: {
              page: 1,
              pageSize: 100,
              total: initialData.candidates[relationshipType]?.length ?? 0,
              totalPages: 1,
            },
          }
        : undefined,
    queryFn: async () => {
      const value = await apiRequest(
        `${hotelRoutes.eligibleCandidates(hotelId)}?${candidateParams}`,
      );
      return hotelEligibleCandidatesResponseSchema.parse(value).data;
    },
  });
  const ownerParams = new URLSearchParams({
    relationshipType: "OWNER",
    page: String(ownerPage),
    pageSize: "100",
  });
  if (debouncedOwnerSearch.trim())
    ownerParams.set("q", debouncedOwnerSearch.trim());
  const ownerCandidates = useQuery({
    enabled: ownerDialogOpen,
    queryKey: [
      "hotel-relationships",
      hotelId,
      "owner-candidates",
      ownerParams.toString(),
    ],
    initialData:
      ownerPage === 1 && initialData?.candidates?.OWNER
        ? {
            candidates: initialData.candidates.OWNER,
            pagination: {
              page: 1,
              pageSize: 100,
              total: initialData.candidates.OWNER.length,
              totalPages: 1,
            },
          }
        : undefined,
    queryFn: async () => {
      const value = await apiRequest(
        `${hotelRoutes.eligibleCandidates(hotelId)}?${ownerParams}`,
      );
      return hotelEligibleCandidatesResponseSchema.parse(value).data;
    },
  });

  const refreshRelationships = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["hotel-relationships", hotelId, "assignments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["hotel-relationships", hotelId, "owner"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["hotel-relationships", hotelId, "candidates"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["hotel-relationships", hotelId, "owner-candidates"],
      }),
    ]);
  };
  const mutate = useMutation({
    mutationFn: async ({
      endpoint,
      body,
    }: {
      endpoint: string;
      body: unknown;
      context: Exclude<FailureContext, "activation">;
    }) => {
      const serialized = JSON.stringify(body);
      const existing = idempotency.current.get(endpoint);
      const retry =
        existing?.body === serialized
          ? existing
          : { body: serialized, key: crypto.randomUUID() };
      idempotency.current.set(endpoint, retry);
      const value = await apiRequest(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": retry.key,
        },
        body: serialized,
      });
      return hotelAssignmentMutationResponseSchema.parse(value).data.assignment;
    },
    onError: async (rawError, variables) => {
      const error = normalizeFailure(rawError);
      setNotice(null);
      setFailure(error);
      setFailureContext(variables.context);
      if (error.code === "VERSION_CONFLICT") setProfileVersionStale(true);
      if (
        error.code === "VERSION_CONFLICT" ||
        error.code === "HOTEL_RELATIONSHIP_CONFLICT"
      ) {
        await refreshRelationships();
        reloadHotelDetail();
      }
    },
  });

  const submitAssignment = assignmentForm.handleSubmit(async (raw) => {
    setFailure(null);
    setFailureContext("assignment");
    const body = createHotelAssignmentRequestSchema.safeParse({
      ...raw,
      assignmentType:
        raw.relationshipType === "STAFF" ? raw.assignmentType : undefined,
      hotelVersion,
    });
    if (!body.success) {
      let firstInvalidField: keyof AssignmentForm | null = null;
      for (const issue of body.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in raw) {
          firstInvalidField ??= field as keyof AssignmentForm;
          assignmentForm.setError(field as keyof AssignmentForm, {
            message: issue.message,
          });
        }
      }
      requestAnimationFrame(() => {
        if (firstInvalidField) assignmentForm.setFocus(firstInvalidField);
        else assignmentValidationRef.current?.focus();
      });
      return;
    }
    try {
      await mutate.mutateAsync({
        endpoint: hotelRoutes.assignments(hotelId),
        body: body.data,
        context: "assignment",
      });
      idempotency.current.delete(hotelRoutes.assignments(hotelId));
      await refreshRelationships();
      reloadHotelDetail();
      assignmentDialog.current?.close();
      assignmentForm.reset({
        relationshipType: "STAFF",
        assignmentType: "PRIMARY",
        startDate: today,
        userId: "",
        reason: "",
      });
      setNotice("호텔 배정을 저장하고 재조회했습니다.");
      requestAnimationFrame(() =>
        document.getElementById("assignment-add-trigger")?.focus(),
      );
    } catch {
      // useMutation onError owns the accessible failure state.
    }
  });

  const submitOwner = async (form: FormData) => {
    setFailure(null);
    setFailureContext("owner");
    const body = ownerTransferRequestSchema.safeParse({
      newOwnerUserId: form.get("newOwnerUserId"),
      reason: form.get("reason"),
      version: hotelVersion,
    });
    if (!body.success) {
      setFailure({
        code: "VALIDATION_ERROR",
        fieldErrors: [],
        message: body.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
      });
      return;
    }
    try {
      await mutate.mutateAsync({
        endpoint: hotelRoutes.ownerTransfer(hotelId),
        body: body.data,
        context: "owner",
      });
      idempotency.current.delete(hotelRoutes.ownerTransfer(hotelId));
      await refreshRelationships();
      reloadHotelDetail();
      ownerDialog.current?.close();
      setNotice(
        "소유주를 교체하고 재조회했습니다. 본인 소유권을 넘겼다면 현재 세션이 종료될 수 있습니다.",
      );
      requestAnimationFrame(() =>
        document.getElementById("owner-transfer-trigger")?.focus(),
      );
    } catch {
      // useMutation onError owns the accessible failure state.
    }
  };

  const submitEmergencyEnd = async (form: FormData) => {
    if (!selectedEnd) return;
    setFailure(null);
    setFailureContext("end");
    const body = endHotelAssignmentRequestSchema.safeParse({
      version: selectedEnd.version,
      reason: form.get("reason"),
      emergency: true,
    });
    if (!body.success) {
      setFailure({
        code: "VALIDATION_ERROR",
        fieldErrors: [],
        message: body.error.issues[0]?.message ?? "종료 사유를 확인해 주세요.",
      });
      return;
    }
    const endpoint = hotelRoutes.endAssignment(hotelId, selectedEnd.id);
    try {
      await mutate.mutateAsync({ endpoint, body: body.data, context: "end" });
      idempotency.current.delete(endpoint);
      await refreshRelationships();
      reloadHotelDetail();
      endCompletedRef.current = true;
      endDialog.current?.close();
      setNotice(
        `${selectedEnd.assignee.displayName} 관계를 긴급 종료하고 재조회했습니다.`,
      );
      setSelectedEnd(null);
    } catch {
      // useMutation onError owns the accessible failure state.
    }
  };

  const activate = async () => {
    setFailure(null);
    setFailureContext("activation");
    setNotice(null);
    const body = activateHotelRequestSchema.parse({ version: hotelVersion });
    const endpoint = hotelRoutes.activate(hotelId);
    const serialized = JSON.stringify(body);
    const existing = idempotency.current.get(endpoint);
    const retry =
      existing?.body === serialized
        ? existing
        : { body: serialized, key: crypto.randomUUID() };
    idempotency.current.set(endpoint, retry);
    try {
      const value = await apiRequest(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": retry.key,
        },
        body: serialized,
      });
      hotelActivationMutationResponseSchema.parse(value);
      setNotice("호텔 운영활성화 요청을 완료했습니다.");
      reloadHotelDetail();
      setReadinessChecked(true);
      setMissingReadiness([]);
      idempotency.current.delete(endpoint);
    } catch (error) {
      const value = normalizeFailure(error);
      setFailure(value);
      setFailureContext("activation");
      if (value.code === "HOTEL_ACTIVATION_READINESS_REQUIRED") {
        setReadinessChecked(true);
        setMissingReadiness(value.fieldErrors.map((item) => item.field));
      } else if (value.code === "VERSION_CONFLICT") {
        setProfileVersionStale(true);
        reloadHotelDetail();
      }
    }
  };

  const activeAssignments =
    assignments.data?.filter((item) => !item.terminatedAt) ?? [];
  const currentOwners = owners.data?.filter((item) => !item.terminatedAt) ?? [];

  return (
    <section aria-labelledby="hotel-relationships-title" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold text-text"
            id="hotel-relationships-title"
            tabIndex={-1}
          >
            관계 및 운영 준비
          </h2>
          <p className="mt-1 text-sm text-muted">
            배정·소유주 관계를 권한 범위에서 관리하고 활성화 준비상태를
            확인합니다.
          </p>
        </div>
        <FeatureGuide
          content={{
            featureKey: "hotel-relationship-management",
            title: "호텔 관계관리",
            summary:
              "표시이름으로 후보를 찾아 기간 배정과 소유주 교체를 안전하게 처리합니다.",
            audience: ["사내 호텔 관리자", "소유주 관계 관리자"],
            steps: [
              "현재 관계를 확인합니다.",
              "후보와 기간, 사유를 입력합니다.",
              "저장 후 재조회 결과를 확인합니다.",
            ],
            permissions: [
              "배정은 호텔 배정관리 권한이 필요합니다.",
              "소유주 교체는 소유주 관리 권한과 최근 5분 로그인이 필요합니다.",
            ],
            cautions: [
              "정상 종료는 진행 업무 재배정 기능이 준비될 때까지 안전 차단됩니다.",
              "긴급 종료와 소유주 교체는 감사기록에 남습니다.",
            ],
            version: "2026-07-24",
          }}
        />
      </div>

      <div aria-atomic="true" aria-live="polite">
        {notice ? (
          <p className="rounded-control border border-success/30 bg-success/5 px-4 py-3 text-sm text-text">
            {notice}
          </p>
        ) : null}
        {failure ? (
          <div
            className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            role="alert"
            tabIndex={-1}
          >
            <p className="font-semibold">요청을 완료하지 못했습니다</p>
            <p className="mt-1">{relationshipFailureMessage(failure)}</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text">
                임직원·하우스키핑 배정
              </h3>
              <p className="mt-1 text-xs text-muted">
                현재 활성 관계 {activeAssignments.length}건
              </p>
            </div>
            {!assignments.error ? (
              <Button
                className="min-h-11"
                disabled={profileVersionStale}
                id="assignment-add-trigger"
                onClick={() => {
                  setFailure(null);
                  setFailureContext(null);
                  setAssignmentDialogOpen(true);
                  setCandidatePage(1);
                  assignmentDialog.current?.showModal();
                }}
                type="button"
              >
                배정 추가
              </Button>
            ) : null}
          </div>
          {assignments.isPending ? (
            <p
              className="mt-5 rounded-control bg-background px-4 py-5 text-sm text-muted"
              role="status"
            >
              배정 관계를 불러오는 중입니다…
            </p>
          ) : assignments.error ? (
            <div
              className="mt-5 rounded-control border border-danger/30 px-4 py-5 text-sm text-danger"
              role="alert"
            >
              <p>
                배정 관계를 표시할 수 없습니다. 권한을 확인하거나 다시 시도해
                주세요.
              </p>
              <Button
                className="mt-3 min-h-11"
                onClick={() => void assignments.refetch()}
                type="button"
                variant="secondary"
              >
                다시 시도
              </Button>
            </div>
          ) : activeAssignments.length === 0 ? (
            <p className="mt-5 rounded-control bg-background px-4 py-5 text-sm text-muted">
              활성 배정이 없습니다.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {activeAssignments.map((item) => (
                <li
                  className="rounded-control border border-border p-4"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">
                        {item.assignee.displayName}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {item.relationshipType === "HOUSEKEEPING"
                          ? "하우스키핑"
                          : item.assignmentType === "PRIMARY"
                            ? "주배정"
                            : "지원배정"}{" "}
                        · {item.startDate}~{item.endDate ?? "종료일 없음"}
                      </p>
                    </div>
                    <Button
                      className="min-h-11"
                      disabled={profileVersionStale}
                      onClick={(event) => {
                        endTriggerRef.current = event.currentTarget;
                        setSelectedEnd(item);
                        setFailure(null);
                        setFailureContext(null);
                        endDialog.current?.showModal();
                        requestAnimationFrame(() =>
                          document
                            .getElementById("emergency-end-cancel")
                            ?.focus(),
                        );
                      }}
                      type="button"
                      variant="secondary"
                    >
                      긴급 종료
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text">호텔 소유주</h3>
              <p className="mt-1 text-xs text-muted">
                소유주 교체는 최근 로그인 확인이 필요합니다.
              </p>
            </div>
            {!owners.error ? (
              <Button
                className="min-h-11"
                disabled={profileVersionStale}
                id="owner-transfer-trigger"
                onClick={() => {
                  setFailure(null);
                  setFailureContext(null);
                  setOwnerDialogOpen(true);
                  setOwnerSelected("");
                  setOwnerPage(1);
                  ownerDialog.current?.showModal();
                }}
                type="button"
                variant="secondary"
              >
                소유주 교체
              </Button>
            ) : null}
          </div>
          {owners.isPending ? (
            <p
              className="mt-5 rounded-control bg-background px-4 py-5 text-sm text-muted"
              role="status"
            >
              소유주 관계를 불러오는 중입니다…
            </p>
          ) : owners.error ? (
            <div
              className="mt-5 rounded-control border border-danger/30 px-4 py-5 text-sm text-danger"
              role="alert"
            >
              <p>
                소유주 관계를 표시할 수 없습니다. 권한을 확인하거나 다시 시도해
                주세요.
              </p>
              <Button
                className="mt-3 min-h-11"
                onClick={() => void owners.refetch()}
                type="button"
                variant="secondary"
              >
                다시 시도
              </Button>
            </div>
          ) : currentOwners.length === 0 ? (
            <p className="mt-5 rounded-control bg-background px-4 py-5 text-sm text-muted">
              활성 소유주가 없습니다.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {currentOwners.map((item) => (
                <li
                  className="rounded-control border border-border p-4"
                  key={item.id}
                >
                  <p className="font-semibold text-text">
                    {item.assignee.displayName}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    소유 시작일 {item.startDate}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-text">운영활성화 준비</h3>
              <StatusBadge
                tone={
                  !readinessChecked
                    ? "neutral"
                    : missingReadiness.length === 0
                      ? "success"
                      : "warning"
                }
              >
                {!readinessChecked
                  ? "확인 필요"
                  : missingReadiness.length === 0
                    ? "준비 완료"
                    : `${missingReadiness.length}개 미완료`}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted">
              필수 데이터가 모두 저장·재조회되기 전에는 활성화되지 않습니다.
            </p>
          </div>
          <Button
            className="min-h-11"
            disabled={mutate.isPending || profileVersionStale}
            onClick={() => void activate()}
            type="button"
          >
            준비상태 확인
          </Button>
        </div>
        {readinessChecked && missingReadiness.length > 0 ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {missingReadiness.map((item) => (
              <li
                className="rounded-control border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-text"
                key={item}
              >
                {readinessLabels[item] ?? item} 미완료
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <dialog
        aria-labelledby="assignment-dialog-title"
        aria-modal="true"
        className="m-auto w-[min(92vw,42rem)] rounded-panel border border-border bg-surface p-0 text-text shadow-panel backdrop:bg-slate-950/40"
        onClose={() => {
          setAssignmentDialogOpen(false);
          document.getElementById("assignment-add-trigger")?.focus();
        }}
        ref={assignmentDialog}
      >
        <form className="p-5 md:p-6" noValidate onSubmit={submitAssignment}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                className="text-lg font-semibold"
                id="assignment-dialog-title"
              >
                배정 추가
              </h3>
              <p className="mt-1 text-sm text-muted">
                사용자 UUID 대신 권한 범위의 표시이름 후보를 선택합니다.
              </p>
            </div>
            <Button
              className="min-h-11"
              aria-label="배정 추가 닫기"
              onClick={() => {
                assignmentDialog.current?.close();
                document.getElementById("assignment-add-trigger")?.focus();
              }}
              type="button"
              variant="secondary"
            >
              닫기
            </Button>
          </div>
          {failureContext === "assignment" && failure ? (
            <div
              className="mt-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              ref={assignmentFailureRef}
              role="alert"
              tabIndex={-1}
            >
              <p className="font-semibold">배정을 저장하지 못했습니다</p>
              <p className="mt-1">{relationshipFailureMessage(failure)}</p>
            </div>
          ) : null}
          {Object.keys(assignmentForm.formState.errors).length > 0 ? (
            <div
              className="mt-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              ref={assignmentValidationRef}
              role="alert"
              tabIndex={-1}
            >
              <p className="font-semibold">입력값을 확인해 주세요</p>
              <ul className="mt-1 list-disc pl-5">
                {assignmentForm.formState.errors.startDate ? (
                  <li>
                    <a className="underline" href="#assignment-start">
                      시작일을 입력해 주세요.
                    </a>
                  </li>
                ) : null}
                {assignmentForm.formState.errors.userId ? (
                  <li>
                    <a className="underline" href="#assignment-candidate">
                      {assignmentForm.formState.errors.userId.message}
                    </a>
                  </li>
                ) : null}
                {assignmentForm.formState.errors.reason ? (
                  <li>
                    <a className="underline" href="#assignment-reason">
                      {assignmentForm.formState.errors.reason.message}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label
              className="text-sm font-semibold"
              htmlFor="relationship-type"
            >
              관계유형
              <select
                className={inputClassName}
                id="relationship-type"
                {...assignmentForm.register("relationshipType", {
                  onChange: () => {
                    assignmentForm.setValue("userId", "");
                    setCandidatePage(1);
                  },
                })}
              >
                <option value="STAFF">사내 임직원</option>
                <option value="HOUSEKEEPING">하우스키핑</option>
              </select>
            </label>
            {relationshipType === "STAFF" ? (
              <label
                className="text-sm font-semibold"
                htmlFor="assignment-type"
              >
                배정유형
                <select
                  className={inputClassName}
                  id="assignment-type"
                  {...assignmentForm.register("assignmentType", {
                    onChange: () => {
                      assignmentForm.setValue("userId", "");
                      setCandidatePage(1);
                    },
                  })}
                >
                  <option value="PRIMARY">주배정</option>
                  <option value="SUPPORT">지원배정</option>
                </select>
              </label>
            ) : null}
            <label className="text-sm font-semibold" htmlFor="assignment-start">
              시작일
              <input
                aria-invalid={Boolean(
                  assignmentForm.formState.errors.startDate,
                )}
                className={inputClassName}
                id="assignment-start"
                type="date"
                {...assignmentForm.register("startDate", {
                  required: "시작일을 입력해 주세요.",
                  onChange: () => {
                    assignmentForm.setValue("userId", "");
                    setCandidatePage(1);
                  },
                })}
              />
            </label>
            <label className="text-sm font-semibold" htmlFor="candidate-search">
              후보 이름 검색
              <input
                className={inputClassName}
                id="candidate-search"
                onChange={(event) => {
                  setCandidateSearch(event.target.value);
                  setCandidatePage(1);
                  assignmentForm.setValue("userId", "");
                }}
                type="search"
                value={candidateSearch}
              />
            </label>
            <label
              className="text-sm font-semibold sm:col-span-2"
              htmlFor="assignment-candidate"
            >
              배정 후보
              <select
                aria-invalid={Boolean(assignmentForm.formState.errors.userId)}
                className={inputClassName}
                disabled={
                  candidates.isPending ||
                  candidates.isError ||
                  candidates.isFetching ||
                  candidateSearch !== debouncedCandidateSearch
                }
                id="assignment-candidate"
                {...assignmentForm.register("userId", {
                  required: "배정 후보를 선택해 주세요.",
                })}
              >
                <option value="">표시이름으로 선택</option>
                {candidates.data?.candidates.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.displayName}
                  </option>
                ))}
              </select>
              {candidates.isPending ? (
                <span className="mt-1 block text-xs text-muted" role="status">
                  배정 후보를 불러오는 중입니다…
                </span>
              ) : candidates.isError ? (
                <span className="mt-1 block text-xs text-danger" role="alert">
                  후보를 불러오지 못했습니다. 검색어나 권한을 확인해 주세요.
                </span>
              ) : candidates.data?.candidates.length === 0 ? (
                <span className="mt-1 block text-xs text-muted">
                  조건에 맞는 후보가 없습니다.
                </span>
              ) : null}
              {assignmentForm.formState.errors.userId ? (
                <span className="mt-1 block text-xs text-danger">
                  {assignmentForm.formState.errors.userId.message}
                </span>
              ) : null}
            </label>
            {candidates.data && candidates.data.pagination.totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                <span className="text-xs text-muted" role="status">
                  후보 {candidates.data.pagination.page} /{" "}
                  {candidates.data.pagination.totalPages} 페이지
                </span>
                <div className="flex gap-2">
                  <Button
                    className="min-h-11"
                    disabled={
                      candidates.isFetching ||
                      candidates.data.pagination.page <= 1
                    }
                    onClick={() => {
                      assignmentForm.setValue("userId", "");
                      setCandidatePage((page) => Math.max(1, page - 1));
                    }}
                    type="button"
                    variant="secondary"
                  >
                    이전 후보
                  </Button>
                  <Button
                    className="min-h-11"
                    disabled={
                      candidates.isFetching ||
                      candidates.data.pagination.page >=
                        candidates.data.pagination.totalPages
                    }
                    onClick={() => {
                      assignmentForm.setValue("userId", "");
                      setCandidatePage((page) => page + 1);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    다음 후보
                  </Button>
                </div>
              </div>
            ) : null}
            <label
              className="text-sm font-semibold sm:col-span-2"
              htmlFor="assignment-reason"
            >
              배정 사유
              <textarea
                aria-invalid={Boolean(assignmentForm.formState.errors.reason)}
                className={textAreaClassName}
                id="assignment-reason"
                {...assignmentForm.register("reason", {
                  required: "배정 사유를 입력해 주세요.",
                })}
              />
              {assignmentForm.formState.errors.reason ? (
                <span className="mt-1 block text-xs text-danger">
                  {assignmentForm.formState.errors.reason.message}
                </span>
              ) : null}
            </label>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              className="min-h-11"
              onClick={() => {
                assignmentDialog.current?.close();
                document.getElementById("assignment-add-trigger")?.focus();
              }}
              type="button"
              variant="secondary"
            >
              취소
            </Button>
            <Button
              className="min-h-11"
              disabled={
                mutate.isPending ||
                profileVersionStale ||
                candidates.isFetching ||
                candidateSearch !== debouncedCandidateSearch
              }
              type="submit"
            >
              {mutate.isPending ? "저장 중…" : "배정 저장"}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog
        aria-labelledby="owner-dialog-title"
        aria-modal="true"
        className="m-auto w-[min(92vw,38rem)] rounded-panel border border-warning/40 bg-surface p-0 text-text shadow-panel backdrop:bg-slate-950/40"
        onClose={() => {
          setOwnerDialogOpen(false);
          document.getElementById("owner-transfer-trigger")?.focus();
        }}
        ref={ownerDialog}
      >
        <form
          className="p-5 md:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submitOwner(new FormData(event.currentTarget));
          }}
        >
          <h3 className="text-lg font-semibold" id="owner-dialog-title">
            소유주 즉시 교체
          </h3>
          <p className="mt-1 text-sm text-muted">
            최근 5분 이내 로그인 확인이 필요하며, 본인 소유권을 넘기면 현재
            세션이 회수될 수 있습니다.
          </p>
          {failureContext === "owner" && failure ? (
            <div
              className="mt-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              ref={ownerFailureRef}
              role="alert"
              tabIndex={-1}
            >
              <p className="font-semibold">소유주를 교체하지 못했습니다</p>
              <p className="mt-1">{relationshipFailureMessage(failure)}</p>
            </div>
          ) : null}
          <label
            className="mt-5 block text-sm font-semibold"
            htmlFor="owner-search"
          >
            후보 이름 검색
            <input
              className={inputClassName}
              id="owner-search"
              onChange={(event) => {
                setOwnerSearch(event.target.value);
                setOwnerPage(1);
                setOwnerSelected("");
              }}
              type="search"
              value={ownerSearch}
            />
          </label>
          <label
            className="mt-4 block text-sm font-semibold"
            htmlFor="owner-candidate"
          >
            새 소유주
            <select
              className={inputClassName}
              disabled={
                ownerCandidates.isPending ||
                ownerCandidates.isError ||
                ownerCandidates.isFetching ||
                ownerSearch !== debouncedOwnerSearch
              }
              id="owner-candidate"
              name="newOwnerUserId"
              onChange={(event) => setOwnerSelected(event.target.value)}
              required
              value={ownerSelected}
            >
              <option value="">표시이름으로 선택</option>
              {ownerCandidates.data?.candidates.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.displayName}
                </option>
              ))}
            </select>
            {ownerCandidates.isPending ? (
              <span className="mt-1 block text-xs text-muted" role="status">
                소유주 후보를 불러오는 중입니다…
              </span>
            ) : ownerCandidates.isError ? (
              <span className="mt-1 block text-xs text-danger" role="alert">
                후보를 불러오지 못했습니다. 검색어나 권한을 확인해 주세요.
              </span>
            ) : ownerCandidates.data?.candidates.length === 0 ? (
              <span className="mt-1 block text-xs text-muted">
                조건에 맞는 후보가 없습니다.
              </span>
            ) : null}
          </label>
          {ownerCandidates.data &&
          ownerCandidates.data.pagination.totalPages > 1 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted" role="status">
                후보 {ownerCandidates.data.pagination.page} /{" "}
                {ownerCandidates.data.pagination.totalPages} 페이지
              </span>
              <div className="flex gap-2">
                <Button
                  className="min-h-11"
                  disabled={
                    ownerCandidates.isFetching ||
                    ownerCandidates.data.pagination.page <= 1
                  }
                  onClick={() => {
                    setOwnerSelected("");
                    setOwnerPage((page) => Math.max(1, page - 1));
                  }}
                  type="button"
                  variant="secondary"
                >
                  이전 후보
                </Button>
                <Button
                  className="min-h-11"
                  disabled={
                    ownerCandidates.isFetching ||
                    ownerCandidates.data.pagination.page >=
                      ownerCandidates.data.pagination.totalPages
                  }
                  onClick={() => {
                    setOwnerSelected("");
                    setOwnerPage((page) => page + 1);
                  }}
                  type="button"
                  variant="secondary"
                >
                  다음 후보
                </Button>
              </div>
            </div>
          ) : null}
          <label
            className="mt-4 block text-sm font-semibold"
            htmlFor="owner-reason"
          >
            교체 사유
            <textarea
              className={textAreaClassName}
              id="owner-reason"
              name="reason"
              required
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              className="min-h-11"
              onClick={() => {
                ownerDialog.current?.close();
                document.getElementById("owner-transfer-trigger")?.focus();
              }}
              type="button"
              variant="secondary"
            >
              취소
            </Button>
            <Button
              className="min-h-11"
              disabled={
                mutate.isPending ||
                profileVersionStale ||
                ownerCandidates.isFetching ||
                ownerSearch !== debouncedOwnerSearch
              }
              type="submit"
            >
              즉시 교체
            </Button>
          </div>
        </form>
      </dialog>

      <dialog
        aria-labelledby="end-dialog-title"
        aria-modal="true"
        className="m-auto w-[min(92vw,36rem)] rounded-panel border border-danger/30 bg-surface p-0 text-text shadow-panel backdrop:bg-slate-950/40"
        onClose={() => {
          setSelectedEnd(null);
          if (endCompletedRef.current) {
            endCompletedRef.current = false;
            document.getElementById("hotel-relationships-title")?.focus();
          } else {
            endTriggerRef.current?.focus();
          }
          endTriggerRef.current = null;
        }}
        ref={endDialog}
        role="alertdialog"
      >
        <form
          className="p-5 md:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEmergencyEnd(new FormData(event.currentTarget));
          }}
        >
          <h3
            className="text-lg font-semibold text-danger"
            id="end-dialog-title"
          >
            관계를 긴급 종료하시겠습니까?
          </h3>
          <p className="mt-2 text-sm text-muted">
            {hotelName}의 {selectedEnd?.assignee.displayName}{" "}
            {selectedEnd?.relationshipType === "HOUSEKEEPING"
              ? "하우스키핑"
              : "임직원 배정"}{" "}
            관계를 즉시 종료합니다. 해당 사용자의 호텔 접근과 활성 세션이 회수될
            수 있으며, 진행 중인 업무는 자동 재배정되지 않습니다. 정상 종료는
            재배정 기능이 준비될 때까지 안전 차단됩니다.
          </p>
          {failureContext === "end" && failure ? (
            <div
              className="mt-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              ref={endFailureRef}
              role="alert"
              tabIndex={-1}
            >
              <p className="font-semibold">관계를 종료하지 못했습니다</p>
              <p className="mt-1">{relationshipFailureMessage(failure)}</p>
            </div>
          ) : null}
          <label
            className="mt-4 block text-sm font-semibold"
            htmlFor="end-reason"
          >
            긴급 종료 사유
            <textarea
              className={textAreaClassName}
              id="end-reason"
              name="reason"
              required
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              className="min-h-11"
              id="emergency-end-cancel"
              onClick={() => {
                endDialog.current?.close();
              }}
              type="button"
              variant="secondary"
            >
              취소
            </Button>
            <Button
              className="min-h-11"
              disabled={mutate.isPending || profileVersionStale}
              type="submit"
              variant="secondary"
            >
              긴급 종료 확인
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

export function RelationshipManagementPanel(props: RelationshipPanelProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: props.initialData ? Number.POSITIVE_INFINITY : 15_000,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <RelationshipManagementContent {...props} />
    </QueryClientProvider>
  );
}
