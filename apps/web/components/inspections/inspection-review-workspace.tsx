"use client";

import {
  hotelErrorResponseSchema,
  hotelFileRoutes,
  inspectionReviewListResponseSchema,
  inspectionReviewResponseSchema,
  inspectionRoutes,
  transitionProcessExecutionRequestSchema,
  type InspectionReview,
  type InspectionReviewSummary,
} from "@werehere/contracts";
import { Button, Dialog, FeatureGuide, PageHeader, StatusBadge } from "@werehere/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { hotelFeatureGuides } from "../../lib/feature-guides";

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Props = {
  hotelId: string;
  initialPagination: Pagination;
  initialReviews: InspectionReviewSummary[];
  initialSelectedReview: InspectionReview | null;
};
type Action = InspectionReview["review"]["actions"][number];
type ReasonForm = { reason: string };

const resultLabel = {
  ABNORMAL: "이상",
  CAUTION: "주의",
  NORMAL: "정상",
} as const;
const resultTone = {
  ABNORMAL: "danger",
  CAUTION: "warning",
  NORMAL: "success",
} as const;
const historyEventLabel = {
  APPROVE: "승인",
  CANCEL: "취소",
  REJECT: "반려",
  SELECT: "선택 처리",
  SUBMIT: "점검 제출",
  UNFINISHED_CLOSE: "미완료 종료",
} as const;

const severityLabel = {
  CRITICAL: "긴급",
  MAJOR: "중대",
  MINOR: "경미",
  OBSERVATION: "관찰",
} as const;

function dateTime(value: string | null) {
  if (!value) return "기한 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

class ReviewRequestError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "ReviewRequestError";
  }
}

async function responseError(response: Response) {
  const parsed = hotelErrorResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  return parsed.success
    ? new ReviewRequestError(
        parsed.data.error.code,
        parsed.data.error.retryable,
        parsed.data.error.message,
      )
    : new ReviewRequestError(
        "INVALID_ERROR_RESPONSE",
        true,
        "요청 결과를 안전하게 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.",
      );
}

async function fetchReviewPage(hotelId: string, page: number) {
  const response = await fetch(
    `${inspectionRoutes.reviews(hotelId)}?page=${page}&pageSize=20`,
    { cache: "no-store" },
  );
  if (!response.ok) throw await responseError(response);
  const parsed = inspectionReviewListResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  if (!parsed.success)
    throw new Error("검토 대기 목록 응답이 올바르지 않습니다.");
  return parsed.data.data;
}

async function fetchReviewInventory(hotelId: string) {
  const first = await fetchReviewPage(hotelId, 1);
  if (first.pagination.totalPages > 500)
    throw new ReviewRequestError(
      "REVIEW_INVENTORY_LIMIT_EXCEEDED",
      true,
      "최신 검토 목록이 너무 많아 안전하게 확인하지 못했습니다. 다시 시도해 주세요.",
    );
  const pages = [first];
  for (let page = 2; page <= first.pagination.totalPages; page += 1)
    pages.push(await fetchReviewPage(hotelId, page));
  return pages;
}

async function fetchCanonicalReview(hotelId: string, inspectionId: string) {
  const response = await fetch(inspectionRoutes.review(hotelId, inspectionId), { cache: "no-store" });
  if (!response.ok) {
    const failure = await responseError(response);
    if (failure.code === "RESOURCE_NOT_FOUND") return null;
    throw failure;
  }
  const parsed = inspectionReviewResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new Error("검토 상세 응답이 올바르지 않습니다.");
  return parsed.data.data.review;
}

export function reviewMatchesSummary(
  review: InspectionReview,
  summary: InspectionReviewSummary,
) {
  return (
    summary.id === review.inspection.id &&
    summary.hotelId === review.inspection.hotelId &&
    summary.source === review.inspection.source &&
    summary.businessDate === review.inspection.businessDate &&
    summary.dueAt === review.inspection.dueAt &&
    summary.targetSummary ===
      (review.inspection.rooms.length > 0
        ? review.inspection.rooms.map((room) => `${room.roomNumber}호`).join(", ").slice(0, 300)
        : "대상 미확인") &&
    summary.itemCount === review.inspection.items.length &&
    summary.abnormalCount === review.inspection.items.filter((item) => item.result?.result === "ABNORMAL").length &&
    summary.cautionCount === review.inspection.items.filter((item) => item.result?.result === "CAUTION").length &&
    summary.process.executionId === review.review.executionId &&
    summary.process.version === review.review.version &&
    summary.process.currentStageName === review.review.currentStage.name &&
    summary.process.reviewer.id === review.review.reviewer.id &&
    summary.process.reviewer.displayName === review.review.reviewer.displayName &&
    summary.process.delegate?.id === review.review.delegate?.id &&
    summary.process.delegate?.displayName === review.review.delegate?.displayName &&
    summary.process.dueAt === review.review.dueAt &&
    summary.process.overdue === review.review.overdue
  );
}

function ReviewWorkspace({
  hotelId,
  initialPagination,
  initialReviews,
  initialSelectedReview,
}: Props) {
  const [pagination, setPagination] = useState(initialPagination);
  const [reviews, setReviews] = useState(initialReviews);
  const [selected, setSelected] = useState(initialSelectedReview);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const dialogErrorRef = useRef<HTMLDivElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const navigationGenerationRef = useRef(0);
  const transitionOperationRef = useRef<{
    fingerprint: string;
    idempotencyKey: string;
  } | null>(null);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    trigger,
  } = useForm<ReasonForm>({
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (selectedAction && dialogError)
      queueMicrotask(() => dialogErrorRef.current?.focus());
  }, [dialogError, selectedAction]);

  const detailMutation = useMutation({
    mutationFn: async ({ inspectionId }: { inspectionId: string; generation: number }) => {
      const response = await fetch(
        inspectionRoutes.review(hotelId, inspectionId),
        { cache: "no-store" },
      );
      if (!response.ok) throw await responseError(response);
      const parsed = inspectionReviewResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!parsed.success)
        throw new Error("검토 상세 응답이 올바르지 않습니다.");
      return parsed.data.data.review;
    },
    onError: (error, input) => {
      if (input.generation === navigationGenerationRef.current)
        setMessage((error as Error).message);
    },
    onSuccess: (review, input) => {
      if (input.generation !== navigationGenerationRef.current) return;
      setSelected(review);
      setMessage(null);
    },
  });

  const pageMutation = useMutation({
    mutationFn: async ({ page }: { page: number; generation: number }) => {
      const list = await fetchReviewPage(hotelId, page);
      const first = list.reviews[0];
      if (!first) return { ...list, selectedReview: null };
      const response = await fetch(inspectionRoutes.review(hotelId, first.id), {
        cache: "no-store",
      });
      if (!response.ok) throw await responseError(response);
      const detail = inspectionReviewResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!detail.success)
        throw new Error("검토 상세 응답이 올바르지 않습니다.");
      return { ...list, selectedReview: detail.data.data.review };
    },
    onError: (error, input) => {
      if (input.generation === navigationGenerationRef.current)
        setMessage((error as Error).message);
    },
    onSuccess: (result, input) => {
      if (input.generation !== navigationGenerationRef.current) return;
      setPagination(result.pagination);
      setReviews(result.reviews);
      setSelected(result.selectedReview);
      setMessage(`${result.pagination.page}페이지 검토 목록을 불러왔습니다.`);
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: Action; reason: string }) => {
      if (!selected) throw new Error("처리할 검토 건을 선택해 주세요.");
      const request = transitionProcessExecutionRequestSchema.safeParse({
        event: action.event,
        choiceValue: action.choiceValue,
        reason: reason.trim() || null,
        version: selected.review.version,
      });
      if (!request.success) throw new Error("처리 사유를 확인해 주세요.");
      const fingerprint = JSON.stringify({
        inspectionId: selected.inspection.id,
        request: request.data,
      });
      if (transitionOperationRef.current?.fingerprint !== fingerprint) {
        transitionOperationRef.current = {
          fingerprint,
          idempotencyKey: crypto.randomUUID(),
        };
      }
      const idempotencyKey = transitionOperationRef.current.idempotencyKey;
      const response = await fetch(
        inspectionRoutes.transition(hotelId, selected.inspection.id),
        {
          body: JSON.stringify(request.data),
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          method: "POST",
        },
      );
      if (!response.ok) throw await responseError(response);
      const transitioned = inspectionReviewResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!transitioned.success)
        throw new Error("처리 결과를 안전하게 확인하지 못했습니다.");

      const pages = await fetchReviewInventory(hotelId);
      const transitionedReview = transitioned.data.data.review;
      const assignedPage = pages.find((page) =>
        page.reviews.some((entry) => entry.id === transitionedReview.inspection.id),
      );
      const returnedSummary = assignedPage?.reviews.find(
        (entry) => entry.id === transitionedReview.inspection.id,
      );
      if (returnedSummary && !reviewMatchesSummary(transitionedReview, returnedSummary))
        throw new ReviewRequestError(
          "STALE_READ_AFTER_WRITE",
          true,
          "처리 결과와 최신 목록이 일치하지 않습니다. 같은 요청으로 다시 확인해 주세요.",
        );
      const fallbackReview = returnedSummary
        ? null
        : await fetchCanonicalReview(hotelId, transitionedReview.inspection.id);
      if (
        fallbackReview?.inspection.status === "IN_REVIEW"
      )
        throw new ReviewRequestError(
          "REVIEW_INVENTORY_REORDERED",
          true,
          "목록이 갱신되는 중입니다. 같은 요청으로 다시 확인해 주세요.",
        );
      const remainsAssigned = Boolean(returnedSummary);
      const list =
        assignedPage ??
        pages[Math.min(Math.max(pagination.page, 1), pages.length) - 1] ??
        (await fetchReviewPage(hotelId, 1));
      return {
        list,
        review: fallbackReview ?? transitionedReview,
        remainsAssigned,
      };
    },
    onError: async (error) => {
      const failure = error as Error;
      if (failure instanceof ReviewRequestError && failure.code === "VERSION_CONFLICT") {
        transitionOperationRef.current = null;
        try {
          const pages = await fetchReviewInventory(hotelId);
          const currentPage = selected
            ? pages.find((page) =>
                page.reviews.some((entry) => entry.id === selected.inspection.id),
              )
            : undefined;
          const currentSummary = currentPage?.reviews.find(
            (entry) => entry.id === selected?.inspection.id,
          );
          const list =
            currentPage ??
            pages[Math.min(Math.max(pagination.page, 1), pages.length) - 1] ??
            (await fetchReviewPage(hotelId, 1));
          let currentReview: InspectionReview | null = null;
          if (currentSummary) {
            const response = await fetch(
              inspectionRoutes.review(hotelId, currentSummary.id),
              { cache: "no-store" },
            );
            if (!response.ok) throw await responseError(response);
            const parsed = inspectionReviewResponseSchema.safeParse(
              await response.json().catch(() => undefined),
            );
            if (!parsed.success)
              throw new Error("최신 검토 상세 응답이 올바르지 않습니다.");
            currentReview = parsed.data.data.review;
          } else if (selected) {
            const fallback = await fetchCanonicalReview(
              hotelId,
              selected.inspection.id,
            );
            if (fallback)
              throw new ReviewRequestError(
                "REVIEW_INVENTORY_REORDERED",
                true,
                "최신 목록이 갱신되는 중입니다. 다시 확인해 주세요.",
              );
          }
          navigationGenerationRef.current += 1;
          setPagination(list.pagination);
          setReviews(list.reviews);
          setSelected(currentReview);
          if (currentReview && selectedAction) {
            const currentAction = currentReview.review.actions.find(
              (action) =>
                action.event === selectedAction.event &&
                action.choiceValue === selectedAction.choiceValue,
            );
            setSelectedAction(currentAction ?? null);
            if (!currentAction) queueMicrotask(() => listHeadingRef.current?.focus());
          } else {
            setSelectedAction(null);
            queueMicrotask(() => listHeadingRef.current?.focus());
          }
          const latestMessage = currentReview
            ? "다른 사용자의 처리를 반영했습니다. 최신 상태를 확인한 뒤 다시 처리해 주세요."
            : "다른 사용자의 처리를 반영했습니다. 이 검토 건은 더 이상 현재 목록에 없습니다.";
          setMessage(latestMessage);
          setDialogError(currentReview ? latestMessage : null);
        } catch {
          setSelectedAction(null);
          setDialogError(null);
          setMessage(
            "최신 검토 상태를 불러오지 못했습니다. 목록을 다시 불러온 뒤 처리해 주세요.",
          );
          queueMicrotask(() => listHeadingRef.current?.focus());
        }
        return;
      }
      if (failure instanceof ReviewRequestError && !failure.retryable) {
        transitionOperationRef.current = null;
        setSelectedAction(null);
      }
      setMessage(failure.message);
      if (selectedAction) setDialogError(failure.message);
    },
    onSuccess: ({ list, review, remainsAssigned }) => {
      navigationGenerationRef.current += 1;
      setPagination(list.pagination);
      setReviews(list.reviews);
      setSelected(remainsAssigned ? review : null);
      transitionOperationRef.current = null;
      setSelectedAction(null);
      setDialogError(null);
      reset();
      setMessage(
        remainsAssigned
          ? "검토 처리를 저장하고 최신 상태를 다시 확인했습니다."
          : "검토 처리를 저장했습니다. 다음 담당자에게 전달되었습니다.",
      );
    },
  });

  const evidenceByItem = useMemo(() => {
    const grouped = new Map<string, InspectionReview["evidence"]>();
    for (const evidence of selected?.evidence ?? []) {
      const current = grouped.get(evidence.itemSnapshotId) ?? [];
      grouped.set(evidence.itemSnapshotId, [...current, evidence]);
    }
    return grouped;
  }, [selected]);

  return (
    <div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 pb-24 lg:pb-8"
      data-testid="inspection-review-workspace"
    >
      <PageHeader
        description="현재 나에게 배정되었거나 유효하게 위임된 점검만 검토합니다."
        eyebrow="호텔 점검"
        title="점검 검토"
        titleAccessory={
          <FeatureGuide content={hotelFeatureGuides["hotel-inspection.review"]} />
        }
      />

      <section
        aria-label="검토 대기 현황"
        className="rounded-panel border border-border bg-surface px-4 py-3 md:p-4"
      >
        <div className="flex items-center justify-between md:block">
          <p className="text-xs text-muted">검토 대기</p>
          <p className="text-xl font-bold md:mt-1 md:text-2xl">
            {pagination.total}
          </p>
        </div>
      </section>

      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <section
          aria-label="검토 대기 목록"
          className="rounded-panel border border-border bg-surface p-2 md:p-3"
        >
          <h2
            className="px-2 py-1 font-semibold md:py-2"
            ref={listHeadingRef}
            tabIndex={-1}
          >
            검토 대기
          </h2>
          {reviews.length === 0 ? (
            <div className="rounded-control border border-dashed border-border p-5 text-sm text-muted">
              현재 배정된 검토가 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {reviews.map((review) => (
                <li key={review.id}>
                  <button
                    aria-current={
                      selected?.inspection.id === review.id ? "true" : undefined
                    }
                    className="min-h-11 w-full rounded-control border border-border p-2 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-[current=true]:border-primary aria-[current=true]:bg-primary/10 md:p-3"
                    disabled={detailMutation.isPending}
                    onClick={() => {
                      const generation = ++navigationGenerationRef.current;
                      detailMutation.mutate({ inspectionId: review.id, generation });
                    }}
                    type="button"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">
                        {review.targetSummary}
                      </span>
                      {review.process.overdue ? (
                        <StatusBadge tone="danger">지연</StatusBadge>
                      ) : null}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-text md:block">
                      <span className="text-sm">
                        {review.process.currentStageName}
                      </span>
                      <span className="text-xs md:mt-2 md:block">
                        {review.abnormalCount > 0
                          ? `이상 ${review.abnormalCount}건`
                          : `항목 ${review.itemCount}개`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pagination.totalPages > 1 ? (
            <nav
              aria-label="검토 대기 페이지"
              className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3"
            >
              <Button
                className="min-h-11"
                disabled={pagination.page <= 1 || pageMutation.isPending}
                onClick={() => {
                  const generation = ++navigationGenerationRef.current;
                  pageMutation.mutate({ page: pagination.page - 1, generation });
                }}
                type="button"
                variant="secondary"
              >
                이전
              </Button>
              <span className="text-sm text-muted">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                className="min-h-11"
                disabled={
                  pagination.page >= pagination.totalPages ||
                  pageMutation.isPending
                }
                onClick={() => {
                  const generation = ++navigationGenerationRef.current;
                  pageMutation.mutate({ page: pagination.page + 1, generation });
                }}
                type="button"
                variant="secondary"
              >
                다음
              </Button>
            </nav>
          ) : null}
        </section>

        <section
          aria-busy={detailMutation.isPending}
          aria-label="검토 상세"
          className="min-w-0 rounded-panel border border-border bg-surface p-4 md:p-5"
        >
          {!selected ? (
            <div className="grid min-h-[360px] place-items-center text-center text-sm text-muted">
              검토할 업무를 선택해 주세요.
            </div>
          ) : (
            <div className="space-y-5">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="text-xs font-semibold text-primary">
                    읽기 전용 점검 결과
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    {selected.inspection.rooms.length > 0
                      ? selected.inspection.rooms
                          .map((room) => `${room.roomNumber}호`)
                          .join(", ")
                      : "호텔 공용 점검"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    업무일 {selected.inspection.businessDate}
                  </p>
                </div>
                <StatusBadge tone={selected.review.overdue ? "danger" : "info"}>
                  {selected.review.overdue ? "지연" : "검토 중"}
                </StatusBadge>
              </header>

              <section
                aria-labelledby="review-process-heading"
                className="rounded-control bg-background p-3 md:p-4"
              >
                <h3 className="font-semibold" id="review-process-heading">
                  검토 단계
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:gap-3">
                  <div>
                    <dt className="text-muted">현재 단계</dt>
                    <dd className="font-medium">
                      {selected.review.currentStage.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">주 검토자</dt>
                    <dd className="font-medium">
                      {selected.review.reviewer.displayName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">유효 대리인</dt>
                    <dd className="font-medium">
                      {selected.review.delegate?.displayName ?? "없음"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">처리 기한</dt>
                    <dd className="font-medium">
                      {dateTime(selected.review.dueAt)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section
                aria-labelledby="review-provenance-heading"
                className="rounded-control border border-border p-4"
              >
                <h3 className="font-semibold" id="review-provenance-heading">
                  수행 기록
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:gap-3">
                  <div>
                    <dt className="text-muted">제출자·시각</dt>
                    <dd>
                      {selected.provenance.submittedBy.displayName} ·{" "}
                      {dateTime(selected.provenance.submittedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">최근 결과 수정자·시각</dt>
                    <dd>
                      {selected.provenance.lastResultChangedBy.displayName} ·{" "}
                      {dateTime(selected.provenance.lastResultChangedAt)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="review-results-heading">
                <h3 className="font-semibold" id="review-results-heading">
                  점검 결과
                </h3>
                <div className="mt-3 space-y-3">
                  {selected.inspection.items.map((item) => {
                    const result = item.result;
                    const evidence = evidenceByItem.get(item.id) ?? [];
                    return (
                      <article
                        className="rounded-control border border-border p-4"
                        key={item.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold">{item.name}</h4>
                            {item.description ? (
                              <p className="mt-1 text-xs text-muted">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          {result ? (
                            <StatusBadge tone={resultTone[result.result]}>
                              {resultLabel[result.result]}
                            </StatusBadge>
                          ) : null}
                        </div>
                        {result ? (
                          <div className="mt-3 space-y-2 text-sm">
                            <p>{result.description || "설명 없음"}</p>
                            <p className="text-muted">
                              심각도{" "}
                              {result.severity
                                ? severityLabel[result.severity]
                                : "해당 없음"}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted">
                            저장된 결과가 없습니다.
                          </p>
                        )}
                        {evidence.length > 0 ? (
                          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {evidence.map((file) => (
                              <li
                                className="overflow-hidden rounded-control border border-border"
                                key={file.id}
                              >
                                {/* Private session-bound stream must be fetched by the browser;
                                    Next Image optimization would create a separate unauthenticated server fetch. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  alt={`${item.name} 증빙 · ${file.displayName}`}
                                  className="aspect-[4/3] w-full bg-background object-cover"
                                  loading="lazy"
                                  src={hotelFileRoutes.view(
                                    hotelId,
                                    selected.inspection.id,
                                    file.id,
                                  )}
                                />
                                <div className="p-3">
                                  <p className="truncate text-sm font-medium">
                                    {file.displayName}
                                  </p>
                                  <a
                                    className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                                    href={hotelFileRoutes.view(
                                      hotelId,
                                      selected.inspection.id,
                                      file.id,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    사진 보기
                                  </a>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section
                aria-labelledby="review-actions-heading"
                className="rounded-control border border-primary/30 bg-primary/5 p-4"
              >
                <h3 className="font-semibold" id="review-actions-heading">
                  검토 처리
                </h3>
                <p className="mt-1 text-xs text-muted">
                  생성 당시 프로세스 revision에서 허용된 처리만 표시합니다.
                </p>
                <label
                  className="mt-4 block text-sm font-medium"
                  htmlFor="review-reason"
                >
                  처리 사유
                </label>
                <textarea
                  aria-describedby="review-reason-guidance review-reason-error"
                  aria-invalid={errors.reason ? "true" : "false"}
                  className="mt-1 min-h-24 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  id="review-reason"
                  maxLength={500}
                  minLength={2}
                  placeholder="판단 근거나 인계 내용을 입력해 주세요."
                  required
                  {...register("reason", {
                    maxLength: {
                      message: "처리 사유는 500자 이하여야 합니다.",
                      value: 500,
                    },
                    minLength: {
                      message: "처리 사유를 2자 이상 입력해 주세요.",
                      value: 2,
                    },
                    required: "처리 사유를 입력해 주세요.",
                    validate: (value) =>
                      value.trim().length >= 2 ||
                      "처리 사유를 2자 이상 입력해 주세요.",
                  })}
                />
                <p className="mt-1 text-xs text-muted" id="review-reason-guidance">
                  필수 · 2자 이상 500자 이하
                </p>
                <p
                  className="mt-1 min-h-5 text-sm text-danger"
                  id="review-reason-error"
                  role={errors.reason ? "alert" : undefined}
                >
                  {errors.reason?.message ?? ""}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {selected.review.actions.map((action) => (
                    <Button
                      className="min-h-11"
                      disabled={transitionMutation.isPending}
                      key={`${action.event}:${action.choiceValue ?? ""}`}
                      onClick={async (event) => {
                        const triggerButton = event.currentTarget;
                        if (!(await trigger("reason", { shouldFocus: true }))) return;
                        actionButtonRef.current = triggerButton;
                        setDialogError(null);
                        setSelectedAction(action);
                      }}
                      type="button"
                      variant={
                        action.event === "REJECT" ? "secondary" : "primary"
                      }
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </section>

              <section aria-labelledby="review-history-heading">
                <h3 className="font-semibold" id="review-history-heading">
                  검토 이력
                </h3>
                {selected.review.history.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    아직 검토 이력이 없습니다.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-2">
                    {selected.review.history.map((entry) => (
                      <li
                        className="rounded-control border border-border p-3 text-sm"
                        key={entry.id}
                      >
                        <p className="font-medium">
                          {entry.actor.displayName} ·{" "}
                          {entry.event
                            ? historyEventLabel[entry.event]
                            : "상태 변경"}
                        </p>
                        <p className="mt-1 text-muted">
                          {entry.previousStageName ?? "입력"} →{" "}
                          {entry.nextStageName ?? "완료"} ·{" "}
                          {dateTime(entry.occurredAt)}
                        </p>
                        {entry.reason ? (
                          <p className="mt-1">{entry.reason}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </section>
      </div>

      {selected && selected.review.actions.length > 0 ? (
        <aside
          aria-label="빠른 검토 처리"
          className="fixed inset-x-0 z-30 mx-4 flex gap-2 rounded-panel border border-primary/30 bg-surface p-2 shadow-panel lg:hidden"
          style={{
            bottom:
              "calc(5rem + var(--inspection-safe-area-inset-bottom, env(safe-area-inset-bottom)))",
          }}
        >
          {selected.review.actions.map((action) => (
            <Button
              className="min-h-11 flex-1"
              disabled={transitionMutation.isPending}
              key={`quick:${action.event}:${action.choiceValue ?? ""}`}
              onClick={async (event) => {
                const triggerButton = event.currentTarget;
                if (!(await trigger("reason", { shouldFocus: true }))) return;
                actionButtonRef.current = triggerButton;
                setDialogError(null);
                setSelectedAction(action);
              }}
              type="button"
              variant={action.event === "REJECT" ? "secondary" : "primary"}
            >
              빠른 처리: {action.label}
            </Button>
          ))}
        </aside>
      ) : null}

      <Dialog
        fallbackFocusRef={listHeadingRef}
        onOpenChange={(open) => {
          if (!open) setSelectedAction(null);
        }}
        open={selectedAction !== null}
        restoreFocusRef={actionButtonRef}
        title="검토 처리 확인"
      >
        <h2 className="pr-10 text-lg font-semibold">{selectedAction?.label}</h2>
        <p className="mt-2 text-sm text-muted">
          현재 version과 담당자 권한을 서버에서 다시 확인한 뒤 처리합니다.
        </p>
        {dialogError ? (
          <div
            className="mt-4 rounded-control border border-danger/40 bg-danger/5 p-3 text-sm text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            ref={dialogErrorRef}
            role="alert"
            tabIndex={-1}
          >
            {dialogError}
          </div>
        ) : null}
        <div className="mt-5 flex gap-2">
          <Button
            className="min-h-11 flex-1"
            onClick={() => setSelectedAction(null)}
            type="button"
            variant="secondary"
          >
            취소
          </Button>
          <Button
            className="min-h-11 flex-1"
            disabled={!selectedAction || transitionMutation.isPending}
            onClick={handleSubmit(({ reason }) => {
              if (selectedAction)
                transitionMutation.mutate({ action: selectedAction, reason });
            })}
            type="button"
          >
            {transitionMutation.isPending ? "처리 중" : "처리 확정"}
          </Button>
        </div>
      </Dialog>

      <p
        aria-live="polite"
        className="rounded-control border border-border bg-surface px-4 py-3 text-sm"
        role="status"
      >
        {message ??
          (detailMutation.isPending
            ? "검토 상세를 불러오는 중입니다."
            : "최신 검토 상태입니다.")}
      </p>
    </div>
  );
}

export function InspectionReviewWorkspace(props: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ReviewWorkspace {...props} />
    </QueryClientProvider>
  );
}
