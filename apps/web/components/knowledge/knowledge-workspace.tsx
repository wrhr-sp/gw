"use client";

import {
  createKnowledgeEntryRequestSchema,
  hotelFileRoutes,
  hotelFileUploadInitRequestSchema,
  hotelFileUploadInitResponseSchema,
  hotelFileUploadStatusResponseSchema,
  hotelErrorResponseSchema,
  knowledgeEntryResponseSchema,
  knowledgeAttachmentLinkRequestSchema,
  knowledgeFeedbackRequestSchema,
  knowledgeListResponseSchema,
  knowledgeReviewerCandidatesResponseSchema,
  knowledgeRoutes,
  knowledgeTransitionRequestSchema,
  updateKnowledgeEntryRequestSchema,
  type HotelFileUploadInitResponse,
  type KnowledgeCapabilities,
  type KnowledgeEntry,
  type KnowledgeRiskClassification,
  type KnowledgeReviewerCandidate,
  type KnowledgeSummary,
  type KnowledgeType,
} from "@werehere/contracts";
import { Dialog, FeatureGuide } from "@werehere/ui";
import { useMutation } from "@tanstack/react-query";
import {
  Archive,
  BookOpenText,
  CheckCircle2,
  CircleAlert,
  Download,
  Pencil,
  Paperclip,
  Plus,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  Upload,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { hotelFeatureGuides } from "../../lib/feature-guides";

type KnowledgeUploadOperation = {
  etag?: string;
  initialized?: HotelFileUploadInitResponse["data"];
  signature: string;
};

type KnowledgeMutationOperation = {
  body: unknown;
  idempotencyKey: string;
};

const mutationStoragePrefix = "werehere:knowledge-mutation:";

function storedMutation(operationId: string): KnowledgeMutationOperation | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(`${mutationStoragePrefix}${operationId}`) ?? "null",
    ) as Partial<KnowledgeMutationOperation> | null;
    return value && typeof value.idempotencyKey === "string" && "body" in value
      ? { body: value.body, idempotencyKey: value.idempotencyKey }
      : null;
  } catch {
    return null;
  }
}

function preserveMutation(operationId: string, body: unknown) {
  const existing = storedMutation(operationId);
  if (existing) return existing;
  const operation = { body, idempotencyKey: crypto.randomUUID() };
  if (typeof window !== "undefined")
    window.sessionStorage.setItem(
      `${mutationStoragePrefix}${operationId}`,
      JSON.stringify(operation),
    );
  return operation;
}

function clearMutation(operationId: string) {
  if (typeof window !== "undefined")
    window.sessionStorage.removeItem(`${mutationStoragePrefix}${operationId}`);
}

class KnowledgeRequestError extends Error {
  constructor(message: string, readonly terminal: boolean) {
    super(message);
  }
}

type KnowledgeFields = {
  caseSummary: string;
  checks: string;
  designatedReviewerUserId: string;
  escalationCriteria: string;
  hotelId: string;
  knowledgeType: KnowledgeType;
  riskClassification: KnowledgeRiskClassification;
  outcomeAndLesson: string;
  prohibitedOrCautionResponse: string;
  reason: string;
  recommendedResponse: string;
  relatedManualRefs: string;
  requiredPermissionOrApproval: string;
  reviewDueDate: string;
  scopeType: "COMPANY" | "HOTEL";
  situation: string;
  summary: string;
  symptomsAndContext: string;
  tags: string;
  title: string;
};

const fieldClass =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const textareaClass = `${fieldClass} min-h-24 py-3`;
const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50";
const statusLabel = {
  ARCHIVED: "보관됨",
  DRAFT: "초안",
  NEEDS_REVIEW: "재검토 필요",
  PUBLISHED: "게시됨",
  REVIEW_REQUESTED: "검토 요청됨",
} as const;
const typeLabel = {
  COMPLAINT_RESPONSE: "컴플레인 대응",
  CONTRACTOR: "외부업체",
  DEFECT_REPAIR: "고장·보수",
  FACILITY_MAINTENANCE: "시설 관리",
  HOUSEKEEPING: "하우스키핑",
  OTHER: "기타",
  ROOM_OPERATION: "객실 운영",
  SAFETY_CAUTION: "안전·주의",
} as const;
const riskLabel = {
  LEGAL: "법률",
  PRIVACY: "개인정보",
  REFUND_COMPENSATION: "환불·보상",
  SAFETY: "안전",
  STANDARD: "일반",
} as const;

export function knowledgeCreateScopes(capabilities: KnowledgeCapabilities) {
  const hotels = capabilities.hotels.filter(
    (hotel) => hotel.permissions.canCreate,
  );
  return {
    canCreateAny: capabilities.company.canCreate || hotels.length > 0,
    canCreateCompany: capabilities.company.canCreate,
    hotels,
  };
}

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function commaValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaults(entry?: KnowledgeEntry | null): KnowledgeFields {
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return {
    caseSummary: entry?.caseSummary ?? "",
    checks: entry?.checks.join("\n") ?? "",
    designatedReviewerUserId: entry?.designatedReviewerUserId ?? "",
    escalationCriteria: entry?.escalationCriteria ?? "",
    hotelId: entry?.hotelId ?? "",
    knowledgeType: entry?.knowledgeType ?? "OTHER",
    riskClassification: entry?.riskClassification ?? "STANDARD",
    outcomeAndLesson: entry?.outcomeAndLesson ?? "",
    prohibitedOrCautionResponse:
      entry?.prohibitedOrCautionResponse.join("\n") ?? "",
    reason: "현장 운영 지식을 최신 기준으로 저장합니다.",
    recommendedResponse: entry?.recommendedResponse.join("\n") ?? "",
    relatedManualRefs: entry?.relatedManualRefs.join(", ") ?? "",
    requiredPermissionOrApproval:
      entry?.requiredPermissionOrApproval ?? "관리자 승인 기준을 확인합니다.",
    reviewDueDate:
      entry?.reviewDueAt.slice(0, 10) ?? sixMonths.toISOString().slice(0, 10),
    scopeType: entry?.scopeType ?? "COMPANY",
    situation: entry?.situation ?? "",
    summary: entry?.summary ?? "",
    symptomsAndContext: entry?.symptomsAndContext ?? "",
    tags: entry?.tags.join(", ") ?? "",
    title: entry?.title ?? "",
  };
}

function parsedEntry(value: unknown) {
  const parsed = knowledgeEntryResponseSchema.safeParse(value);
  return parsed.success ? parsed.data.data.entry : null;
}

async function request(
  path: string,
  method: "PATCH" | "POST" | "PUT",
  body: unknown,
  idempotencyKey: string,
) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method,
  });
  const value = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = hotelErrorResponseSchema.safeParse(value);
    throw new KnowledgeRequestError(
      error.success ? error.data.error.message : "요청을 처리하지 못했습니다.",
      response.status < 500,
    );
  }
  return value;
}

function DetailSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function KnowledgeWorkspace({
  capabilities,
  initialEntries,
  initialReviewerCandidates,
  initialSelected,
  initialTotalCount,
}: {
  capabilities: KnowledgeCapabilities;
  initialEntries: KnowledgeSummary[];
  initialReviewerCandidates: KnowledgeReviewerCandidate[];
  initialSelected: KnowledgeEntry | null;
  initialTotalCount: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState(initialSelected);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [reviewerCandidates, setReviewerCandidates] = useState(
    initialReviewerCandidates,
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [reportComment, setReportComment] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPending, setAttachmentPending] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentOperationRef = useRef<KnowledgeUploadOperation | null>(null);
  const editorTriggerRef = useRef<HTMLButtonElement>(null);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const form = useForm<KnowledgeFields>({ defaultValues: defaults() });
  const scopeType = form.watch("scopeType");
  const hotelId = form.watch("hotelId");
  const riskClassification = form.watch("riskClassification");
  const {
    canCreateAny,
    canCreateCompany,
    hotels: creatableHotels,
  } = knowledgeCreateScopes(capabilities);

  useEffect(() => {
    if (!editorOpen || (scopeType === "HOTEL" && !hotelId)) return;
    const parameters = new URLSearchParams({ scopeType });
    if (scopeType === "HOTEL") parameters.set("hotelId", hotelId);
    void (async () => {
      const response = await fetch(
        `${knowledgeRoutes.reviewerCandidates}?${parameters.toString()}`,
        { cache: "no-store" },
      );
      const parsed = knowledgeReviewerCandidatesResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!response.ok || !parsed.success) {
        setReviewerCandidates([]);
        form.setValue("designatedReviewerUserId", "");
        setMessage("지정 검토자 후보를 불러오지 못했습니다.");
        return;
      }
      const candidates = parsed.data.data.candidates;
      setReviewerCandidates(candidates);
      const current = form.getValues("designatedReviewerUserId");
      if (current && !candidates.some((candidate) => candidate.userId === current))
        form.setValue("designatedReviewerUserId", "");
    })();
  }, [editorOpen, form, hotelId, scopeType]);

  async function refresh(knowledgeId = selected?.id, searchValue = search) {
    const query = new URLSearchParams({ page: "1", pageSize: "100" });
    if (searchValue.trim()) query.set("search", searchValue.trim());
    const listResponse = await fetch(`${knowledgeRoutes.list}?${query}`, {
      cache: "no-store",
    });
    const list = knowledgeListResponseSchema.safeParse(
      await listResponse.json().catch(() => undefined),
    );
    if (listResponse.ok && list.success) {
      setEntries(list.data.data.entries);
      setTotalCount(list.data.data.totalCount);
    }
    if (!knowledgeId) return;
    const detailResponse = await fetch(knowledgeRoutes.detail(knowledgeId), {
      cache: "no-store",
    });
    const detail = parsedEntry(
      await detailResponse.json().catch(() => undefined),
    );
    if (detailResponse.ok && detail) setSelected(detail);
  }

  async function selectEntry(id: string) {
    setMessage("");
    const response = await fetch(knowledgeRoutes.detail(id), {
      cache: "no-store",
    });
    const entry = parsedEntry(await response.json().catch(() => undefined));
    if (!response.ok || !entry) {
      setMessage("지식 상세를 불러오지 못했습니다.");
      return;
    }
    setSelected(entry);
  }

  const command = useMutation({
    mutationFn: async ({
      body,
      idempotencyKey,
      method,
      path,
    }: {
      body: unknown;
      idempotencyKey: string;
      method: "PATCH" | "POST" | "PUT";
      operationId: string;
      path: string;
    }) => request(path, method, body, idempotencyKey),
    onError: (error, variables) => {
      if (error instanceof KnowledgeRequestError && error.terminal)
        clearMutation(variables.operationId);
      setMessage(
        error instanceof Error
          ? error.message
          : "지식 변경사항을 저장하지 못했습니다.",
      );
    },
    onSuccess: async (value, variables) => {
      const entry = parsedEntry(value);
      if (!entry) throw new Error("변경 결과를 안전하게 확인하지 못했습니다.");
      setSelected(entry);
      clearMutation(variables.operationId);
      setEditorOpen(false);
      setReportOpen(false);
      setMessage("서버에 변경사항을 저장했습니다.");
      await refresh(entry.id);
    },
  });

  async function mutateKnowledge(
    operationId: string,
    path: string,
    method: "PATCH" | "POST" | "PUT",
    body: unknown,
  ) {
    const operation = preserveMutation(operationId, body);
    return command.mutateAsync({
      body: operation.body,
      idempotencyKey: operation.idempotencyKey,
      method,
      operationId,
      path,
    });
  }

  function openCreate() {
    setEditing(null);
    form.reset({
      ...defaults(),
      hotelId: canCreateCompany ? "" : (creatableHotels[0]?.hotelId ?? ""),
      scopeType: canCreateCompany ? "COMPANY" : "HOTEL",
    });
    setEditorOpen(true);
  }

  function openEdit() {
    if (!selected) return;
    setEditing(selected);
    form.reset(defaults(selected));
    setEditorOpen(true);
  }

  async function save(fields: KnowledgeFields) {
    const base = {
      caseSummary: fields.caseSummary,
      checks: lines(fields.checks),
      designatedReviewerUserId:
        fields.riskClassification === "STANDARD"
          ? null
          : fields.designatedReviewerUserId,
      escalationCriteria: fields.escalationCriteria,
      hotelId: fields.scopeType === "HOTEL" ? fields.hotelId : null,
      knowledgeType: fields.knowledgeType,
      riskClassification: fields.riskClassification,
      outcomeAndLesson: fields.outcomeAndLesson,
      prohibitedOrCautionResponse: lines(fields.prohibitedOrCautionResponse),
      recommendedResponse: lines(fields.recommendedResponse),
      relatedIssueIds: editing?.relatedIssueIds ?? [],
      relatedManualRefs: commaValues(fields.relatedManualRefs),
      relatedRepairIds: editing?.relatedRepairIds ?? [],
      requiredPermissionOrApproval: fields.requiredPermissionOrApproval,
      reviewDueAt: new Date(
        `${fields.reviewDueDate}T00:00:00+09:00`,
      ).toISOString(),
      scopeType: fields.scopeType,
      situation: fields.situation,
      summary: fields.summary,
      symptomsAndContext: fields.symptomsAndContext,
      tags: commaValues(fields.tags),
      title: fields.title,
    };
    if (editing) {
      const value = updateKnowledgeEntryRequestSchema.parse({
        ...base,
        reason: fields.reason,
        version: editing.version,
      });
      await mutateKnowledge(
        `UPDATE:${editing.id}`,
        knowledgeRoutes.update(editing.id),
        "PATCH",
        value,
      );
      return;
    }
    const value = createKnowledgeEntryRequestSchema.parse({
      ...base,
      id: crypto.randomUUID(),
    });
    await mutateKnowledge("CREATE", knowledgeRoutes.create, "POST", value);
  }

  async function transition(
    action:
      | "ARCHIVE"
      | "MARK_NEEDS_REVIEW"
      | "PUBLISH"
      | "REPUBLISH"
      | "REQUEST_REVIEW",
  ) {
    if (!selected) return;
    const reason =
      action === "REQUEST_REVIEW"
        ? "현장 운영 지식 검토를 요청합니다."
        : action === "ARCHIVE"
          ? "현재 운영 기준에서 제외하여 보관합니다."
          : "검토자가 현재 운영 기준과 개인정보 포함 여부를 확인했습니다.";
    await mutateKnowledge(
      `TRANSITION:${selected.id}:${action}`,
      knowledgeRoutes.transitions(selected.id),
      "POST",
      knowledgeTransitionRequestSchema.parse({
        action,
        reason,
        version: selected.version,
      }),
    );
  }

  async function feedback(kind: "HELPFUL" | "NOT_HELPFUL") {
    if (!selected) return;
    await mutateKnowledge(
      `FEEDBACK:${selected.id}:${kind}`,
      knowledgeRoutes.feedback(selected.id),
      "POST",
      knowledgeFeedbackRequestSchema.parse({
        comment: null,
        kind,
        version: selected.version,
      }),
    );
  }

  async function report() {
    if (!selected) return;
    await mutateKnowledge(
      `FEEDBACK:${selected.id}:REPORT_ERROR`,
      knowledgeRoutes.feedback(selected.id),
      "POST",
      knowledgeFeedbackRequestSchema.parse({
        comment: reportComment,
        kind: "REPORT_ERROR",
        version: selected.version,
      }),
    );
  }

  async function uploadAttachment() {
    if (!selected || !attachmentFile) return;
    if (!selected.actions.canAttach) {
      setMessage("현재 권한과 자료 상태에서는 첨부를 추가할 수 없습니다.");
      return;
    }
    if (selected.attachments.length >= 10) {
      setMessage("첨부는 지식 하나당 최대 10개까지 연결할 수 있습니다.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "image/heic"].includes(
        attachmentFile.type,
      ) ||
      attachmentFile.size < 1 ||
      attachmentFile.size > 20 * 1024 * 1024
    ) {
      setMessage("첨부는 20MB 이하 JPG, PNG, WebP, HEIC 사진만 가능합니다.");
      return;
    }
    setAttachmentPending(true);
    setMessage("private 저장소에 업로드하고 악성파일 검역을 확인하고 있습니다.");
    try {
      const initBody = hotelFileUploadInitRequestSchema.parse({
        fileName: attachmentFile.name,
        mimeType: attachmentFile.type,
        parent: { type: "KNOWLEDGE_ATTACHMENT", knowledgeId: selected.id },
        sizeBytes: attachmentFile.size,
      });
      const signature = [
        selected.id,
        attachmentFile.name,
        attachmentFile.type,
        attachmentFile.size,
        attachmentFile.lastModified,
      ].join(":");
      let operation = attachmentOperationRef.current;
      if (!operation || operation.signature !== signature) {
        operation = { signature };
        attachmentOperationRef.current = operation;
      }
      const initOperationId = `UPLOAD_INIT:${signature}`;
      const initOperation = preserveMutation(initOperationId, initBody);
      let initialized = operation.initialized;
      if (!initialized) {
        const initResponse = await fetch(knowledgeRoutes.uploadInit(selected.id), {
          body: JSON.stringify(initOperation.body),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": initOperation.idempotencyKey,
          },
          method: "POST",
        });
        const parsedInit = hotelFileUploadInitResponseSchema.safeParse(
          await initResponse.json().catch(() => undefined),
        );
        if (!initResponse.ok || !parsedInit.success)
          throw new Error("첨부 업로드를 시작하지 못했습니다. 같은 파일로 다시 시도해 주세요.");
        initialized = parsedInit.data.data;
        operation.initialized = initialized;
      }
      let etag = operation.etag;
      if (!etag) {
        const bodyResponse = await fetch(initialized.uploadUrl, {
          body: attachmentFile,
          headers: initialized.requiredHeaders,
          method: "PUT",
        });
        etag = bodyResponse.headers.get("etag") ?? undefined;
        if (!bodyResponse.ok || !etag)
          throw new Error("첨부 원본을 private 저장소에 저장하지 못했습니다.");
        operation.etag = etag;
      }
      const completeOperationId = `UPLOAD_COMPLETE:${signature}`;
      const completeOperation = preserveMutation(completeOperationId, { etag });
      const completeResponse = await fetch(
        hotelFileRoutes.uploadComplete(initialized.upload.id),
        {
          body: JSON.stringify(completeOperation.body),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": completeOperation.idempotencyKey,
          },
          method: "POST",
        },
      );
      if (!completeResponse.ok && completeResponse.status < 500)
        throw new Error("첨부 검역을 시작하지 못했습니다.");
      let fileVersionId: string | undefined;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusResponse = await fetch(
          knowledgeRoutes.uploadStatus(
            selected.id,
            initialized.upload.id,
          ),
          { cache: "no-store" },
        );
        const status = hotelFileUploadStatusResponseSchema.safeParse(
          await statusResponse.json().catch(() => undefined),
        );
        if (!statusResponse.ok || !status.success)
          throw new Error("첨부 검역 상태를 확인하지 못했습니다.");
        if (
          status.data.data.upload.status === "READY_UNLINKED" ||
          status.data.data.upload.status === "LINKED"
        ) {
          fileVersionId = status.data.data.upload.fileVersionId;
          break;
        }
        if (["EXPIRED", "REJECTED", "SCAN_FAILED"].includes(status.data.data.upload.status))
          throw new Error("첨부 검역에 실패했습니다.");
      }
      if (!fileVersionId)
        throw new Error("첨부 검역이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.");
      const linkOperationId = `ATTACHMENT_LINK:${selected.id}:${signature}`;
      const linkOperation = preserveMutation(
        linkOperationId,
        knowledgeAttachmentLinkRequestSchema.parse({
          fileVersionIds: [
            ...selected.attachments.map((attachment) => attachment.fileVersionId),
            fileVersionId,
          ],
          reason: "검역 완료된 현장 사진을 지식에 연결합니다.",
          version: selected.version,
        }),
      );
      const linked = await request(
        knowledgeRoutes.attachments(selected.id),
        "PUT",
        linkOperation.body,
        linkOperation.idempotencyKey,
      );
      const entry = parsedEntry(linked);
      if (!entry) throw new Error("첨부 연결 결과를 안전하게 확인하지 못했습니다.");
      clearMutation(initOperationId);
      clearMutation(completeOperationId);
      clearMutation(linkOperationId);
      setSelected(entry);
      attachmentOperationRef.current = null;
      setAttachmentFile(null);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      setMessage("검역이 완료된 private 첨부를 지식에 연결했습니다.");
      try {
        await refresh(entry.id);
      } catch {
        setMessage(
          "private 첨부 연결은 완료됐습니다. 최신 목록은 다음 조회에서 다시 확인해 주세요.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "첨부를 저장하지 못했습니다.",
      );
    } finally {
      setAttachmentPending(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-app-bg px-4 py-5 text-foreground sm:px-6 lg:px-8"
      data-knowledge-workspace
    >
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpenText
                aria-hidden="true"
                className="size-6 text-primary"
              />
              <h1 className="text-2xl font-bold tracking-tight">
                운영 지식뱅크
              </h1>
              <FeatureGuide
                content={hotelFeatureGuides["hotel-knowledge.bank"]}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              회사 공통 지식과 배정된 호텔의 현장 대응 기준을 검색합니다.
            </p>
          </div>
          {canCreateAny ? (
            <button
              className={`${actionClass} bg-primary text-white`}
              onClick={openCreate}
              ref={editorTriggerRef}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" /> 지식 작성
            </button>
          ) : null}
        </header>

        <form
          className="mt-5 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void refresh(undefined, search);
          }}
          role="search"
        >
          <label className="sr-only" htmlFor="knowledge-search">
            증상·상황 검색
          </label>
          <input
            className={fieldClass}
            id="knowledge-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="증상·상황 검색"
            value={search}
          />
          <button
            className={`${actionClass} bg-foreground text-background`}
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" /> 검색
          </button>
        </form>

        {message ? (
          <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <aside
            aria-label={`지식 목록 ${totalCount}건`}
            className="overflow-hidden rounded-card border border-border bg-surface"
          >
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">
              검색 결과 {totalCount}건
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-2">
              {entries.length ? (
                entries.map((entry) => (
                  <button
                    aria-current={
                      selected?.id === entry.id ? "true" : undefined
                    }
                    className={`mb-2 w-full rounded-control border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      selected?.id === entry.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface hover:bg-muted/40"
                    }`}
                    key={entry.id}
                    onClick={() => void selectEntry(entry.id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-semibold">
                        {entry.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-background px-2 py-1 text-xs">
                        {statusLabel[entry.status]}
                      </span>
                    </span>
                    <span className="mt-2 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                      {entry.summary}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {entry.scopeType === "COMPANY"
                        ? "회사 공통"
                        : "호텔 전용"}{" "}
                      · {typeLabel[entry.knowledgeType]} · {riskLabel[entry.riskClassification]}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  현재 권한으로 조회 가능한 지식이 없습니다.
                </p>
              )}
            </div>
          </aside>

          <article className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-6">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        {statusLabel[selected.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {selected.scopeType === "COMPANY"
                          ? "회사 공통"
                          : "호텔 전용"}
                      </span>
                      <span className="rounded-full bg-background px-2 py-1 text-xs font-semibold">
                        {riskLabel[selected.riskClassification]}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold">{selected.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selected.summary}
                    </p>
                    {selected.riskClassification !== "STANDARD" ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        지정 검토자: {selected.designatedReviewer?.displayName ?? "미지정"}
                        {selected.reviewRequestedVersion
                          ? ` · 검토 version ${selected.reviewRequestedVersion}`
                          : " · 검토요청 전"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.actions.canEdit ? (
                      <button
                        className={`${actionClass} border border-border bg-surface`}
                        onClick={openEdit}
                        type="button"
                      >
                        <Pencil aria-hidden="true" className="size-4" /> 수정
                      </button>
                    ) : null}
                    {selected.actions.canRequestReview ? (
                      <button
                        className={`${actionClass} bg-primary text-white`}
                        disabled={command.isPending}
                        onClick={() => void transition("REQUEST_REVIEW")}
                        type="button"
                      >
                        <Send aria-hidden="true" className="size-4" /> 검토 요청
                      </button>
                    ) : null}
                    {selected.actions.canPublish &&
                    selected.status === "REVIEW_REQUESTED" ? (
                      <button
                        className={`${actionClass} bg-primary text-white`}
                        disabled={command.isPending}
                        onClick={() => void transition("PUBLISH")}
                        type="button"
                      >
                        <CheckCircle2 aria-hidden="true" className="size-4" />{" "}
                        게시하기
                      </button>
                    ) : null}
                    {selected.actions.canPublish &&
                    selected.status === "NEEDS_REVIEW" ? (
                      <button
                        className={`${actionClass} bg-primary text-white`}
                        disabled={command.isPending}
                        onClick={() => void transition("REPUBLISH")}
                        type="button"
                      >
                        <CheckCircle2 aria-hidden="true" className="size-4" />{" "}
                        재게시
                      </button>
                    ) : null}
                    {selected.actions.canMarkNeedsReview ? (
                      <button
                        className={`${actionClass} border border-warning text-warning-foreground`}
                        disabled={command.isPending}
                        onClick={() => void transition("MARK_NEEDS_REVIEW")}
                        type="button"
                      >
                        <CircleAlert aria-hidden="true" className="size-4" />{" "}
                        재검토 필요
                      </button>
                    ) : null}
                    {selected.actions.canArchive &&
                    ["PUBLISHED", "NEEDS_REVIEW"].includes(selected.status) ? (
                      <button
                        className={`${actionClass} border border-border bg-surface`}
                        disabled={command.isPending}
                        onClick={() => void transition("ARCHIVE")}
                        type="button"
                      >
                        <Archive aria-hidden="true" className="size-4" />{" "}
                        보관하기
                      </button>
                    ) : null}
                  </div>
                </div>

                {selected.isStale ? (
                  <div
                    className="mt-4 rounded-control border border-warning bg-warning/10 p-4 text-sm font-semibold"
                    role="alert"
                  >
                    재검토 필요 — 현재 권장정보로 사용하지 마세요. 관리자 확인
                    후 대응하세요.
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3">
                  <DetailSection title="먼저 확인할 사항">
                    <p>{selected.symptomsAndContext}</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      {selected.checks.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </DetailSection>
                  <DetailSection title="가능한 대응">
                    <ol className="list-decimal space-y-1 pl-5">
                      {selected.recommendedResponse.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </DetailSection>
                  <DetailSection title="하지 말아야 할 대응">
                    <ul className="list-disc space-y-1 pl-5">
                      {selected.prohibitedOrCautionResponse.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </DetailSection>
                  <DetailSection title="에스컬레이션">
                    <p>{selected.escalationCriteria}</p>
                    <p className="mt-2 font-medium text-foreground">
                      권한·승인: {selected.requiredPermissionOrApproval}
                    </p>
                  </DetailSection>
                  <DetailSection title="상황과 사례">
                    <p>{selected.situation}</p>
                    {selected.caseSummary ? (
                      <p className="mt-2">사례: {selected.caseSummary}</p>
                    ) : null}
                    {selected.outcomeAndLesson ? (
                      <p className="mt-2">
                        결과·교훈: {selected.outcomeAndLesson}
                      </p>
                    ) : null}
                  </DetailSection>
                </div>

                <section
                  aria-labelledby="knowledge-attachments-title"
                  className="mt-4 rounded-card border border-border bg-surface p-4"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip aria-hidden="true" className="size-4 text-primary" />
                    <h3
                      className="text-sm font-semibold"
                      id="knowledge-attachments-title"
                    >
                      private 현장 사진 {selected.attachments.length}개
                    </h3>
                  </div>
                  {selected.attachments.length ? (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selected.attachments.map((attachment) => (
                        <li key={attachment.fileVersionId}>
                          <a
                            className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border px-3 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            href={attachment.viewHref}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span className="min-w-0 truncate">
                              {attachment.displayName}
                            </span>
                            <Download aria-hidden="true" className="size-4 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      연결된 private 사진이 없습니다.
                    </p>
                  )}
                  {selected.actions.canAttach ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <label
                        className="grid gap-2 text-sm font-medium"
                        htmlFor="knowledge-attachment-file"
                      >
                        현장 사진 선택
                        <input
                          accept="image/jpeg,image/png,image/webp,image/heic"
                          className={fieldClass}
                          disabled={attachmentPending}
                          id="knowledge-attachment-file"
                          onChange={(event) =>
                            setAttachmentFile(event.target.files?.[0] ?? null)
                          }
                          ref={attachmentInputRef}
                          type="file"
                        />
                      </label>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        20MB 이하 JPG, PNG, WebP, HEIC만 가능합니다. private 저장 후
                        악성파일 검역을 통과해야 연결됩니다.
                      </p>
                      <button
                        className={`${actionClass} mt-3 w-full bg-primary text-white sm:w-auto`}
                        disabled={!attachmentFile || attachmentPending}
                        onClick={() => void uploadAttachment()}
                        type="button"
                      >
                        <Upload aria-hidden="true" className="size-4" />
                        {attachmentPending ? "검역 확인 중…" : "사진 업로드·검역"}
                      </button>
                    </div>
                  ) : null}
                </section>

                {selected.links.length ? (
                  <section className="mt-4">
                    <h3 className="text-sm font-semibold">
                      권한이 확인된 관련 업무
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.links.map((link) => (
                        <a
                          className="rounded-control border border-border px-3 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          href={link.href}
                          key={`${link.kind}-${link.id}`}
                        >
                          {link.title}
                        </a>
                      ))}
                    </div>
                  </section>
                ) : null}

                {["PUBLISHED", "NEEDS_REVIEW"].includes(selected.status) ? (
                  <section className="mt-5 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold">
                      이 지식이 도움이 되었나요?
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        className={`${actionClass} border border-border bg-surface`}
                        disabled={command.isPending}
                        onClick={() => void feedback("HELPFUL")}
                        type="button"
                      >
                        <ThumbsUp aria-hidden="true" className="size-4" />{" "}
                        도움됨 {selected.helpfulCount}
                      </button>
                      <button
                        className={`${actionClass} border border-border bg-surface`}
                        disabled={command.isPending}
                        onClick={() => void feedback("NOT_HELPFUL")}
                        type="button"
                      >
                        <ThumbsDown aria-hidden="true" className="size-4" />{" "}
                        도움 안 됨 {selected.notHelpfulCount}
                      </button>
                      <button
                        className={`${actionClass} border border-border bg-surface`}
                        onClick={() => setReportOpen(true)}
                        ref={reportTriggerRef}
                        type="button"
                      >
                        오류·수정 신고
                      </button>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
                목록에서 확인할 지식을 선택하세요.
              </div>
            )}
          </article>
        </div>
      </div>

      <Dialog
        onOpenChange={setEditorOpen}
        open={editorOpen}
        restoreFocusRef={editorTriggerRef}
        title={editing ? "지식 수정" : "지식 작성"}
      >
        <form className="grid gap-4" onSubmit={form.handleSubmit(save)}>
          <p className="text-sm text-muted-foreground">
            고객 개인정보나 credential을 입력하지 마세요. 게시 전 검토자가 다시
            확인합니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              공개 범위
              <select
                className={fieldClass}
                disabled={Boolean(editing)}
                {...form.register("scopeType")}
              >
                {canCreateCompany || editing?.scopeType === "COMPANY" ? (
                  <option value="COMPANY">회사 공통</option>
                ) : null}
                {creatableHotels.length > 0 || editing?.scopeType === "HOTEL" ? (
                  <option value="HOTEL">호텔 전용</option>
                ) : null}
              </select>
            </label>
            {scopeType === "HOTEL" ? (
              <label className="grid gap-1 text-sm font-medium">
                호텔
                <select
                  className={fieldClass}
                  {...form.register("hotelId", { required: true })}
                >
                  <option value="">호텔 선택</option>
                  {capabilities.hotels
                    .filter(
                      (hotel) =>
                        hotel.permissions.canCreate || hotel.hotelId === editing?.hotelId,
                    )
                    .map((hotel) => (
                    <option key={hotel.hotelId} value={hotel.hotelId}>
                      {hotel.hotelName}
                    </option>
                    ))}
                </select>
              </label>
            ) : null}
          </div>
          <label className="grid gap-1 text-sm font-medium">
            유형
            <select className={fieldClass} {...form.register("knowledgeType")}>
              {Object.entries(typeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            검토 위험분류
            <select className={fieldClass} {...form.register("riskClassification")}>
              {Object.entries(riskLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-muted-foreground">
              일반 외 분류는 지정 검토자 권한이 있어야 게시할 수 있습니다.
            </span>
          </label>
          {riskClassification !== "STANDARD" ? (
            <label className="grid gap-1 text-sm font-medium">
              지정 검토자
              <select
                className={fieldClass}
                required
                {...form.register("designatedReviewerUserId", { required: true })}
              >
                <option value="">검토자 선택</option>
                {reviewerCandidates.map((candidate) => (
                  <option key={candidate.userId} value={candidate.userId}>
                    {candidate.displayName}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-muted-foreground">
                검토 요청 시 현재 지식 version과 함께 동결되며, 지정된 본인만 게시할 수 있습니다.
              </span>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-medium">
            제목
            <input
              className={fieldClass}
              maxLength={160}
              required
              {...form.register("title")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            요약
            <textarea
              className={textareaClass}
              maxLength={500}
              required
              {...form.register("summary")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            적용 상황
            <textarea
              className={textareaClass}
              maxLength={4000}
              required
              {...form.register("situation")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            증상·맥락
            <textarea
              className={textareaClass}
              maxLength={4000}
              required
              {...form.register("symptomsAndContext")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            먼저 확인할 사항{" "}
            <span className="font-normal text-muted-foreground">
              한 줄에 하나
            </span>
            <textarea
              className={textareaClass}
              required
              {...form.register("checks")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            가능한 대응{" "}
            <span className="font-normal text-muted-foreground">
              한 줄에 하나
            </span>
            <textarea
              className={textareaClass}
              required
              {...form.register("recommendedResponse")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            하지 말아야 할 대응{" "}
            <span className="font-normal text-muted-foreground">
              한 줄에 하나
            </span>
            <textarea
              className={textareaClass}
              required
              {...form.register("prohibitedOrCautionResponse")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            에스컬레이션 기준
            <textarea
              className={textareaClass}
              required
              {...form.register("escalationCriteria")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            필요 권한·승인
            <textarea
              className={textareaClass}
              required
              {...form.register("requiredPermissionOrApproval")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            사례 요약
            <textarea
              className={textareaClass}
              {...form.register("caseSummary")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            결과·교훈
            <textarea
              className={textareaClass}
              {...form.register("outcomeAndLesson")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            태그{" "}
            <span className="font-normal text-muted-foreground">
              쉼표로 구분
            </span>
            <input className={fieldClass} {...form.register("tags")} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            관련 매뉴얼{" "}
            <span className="font-normal text-muted-foreground">
              쉼표로 구분
            </span>
            <input
              className={fieldClass}
              {...form.register("relatedManualRefs")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            재검토 예정일
            <input
              className={fieldClass}
              required
              type="date"
              {...form.register("reviewDueDate")}
            />
          </label>
          {editing ? (
            <label className="grid gap-1 text-sm font-medium">
              변경 사유
              <textarea
                className={textareaClass}
                required
                {...form.register("reason")}
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              className={`${actionClass} border border-border bg-surface`}
              onClick={() => setEditorOpen(false)}
              type="button"
            >
              취소
            </button>
            <button
              className={`${actionClass} bg-primary text-white`}
              disabled={command.isPending}
              type="submit"
            >
              {command.isPending ? "저장 중…" : "서버에 저장"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        onOpenChange={setReportOpen}
        open={reportOpen}
        restoreFocusRef={reportTriggerRef}
        title="오류·수정 신고"
      >
        <p className="mb-3 text-sm text-muted-foreground">
          잘못되었거나 오래된 부분만 적어 주세요. 고객 개인정보는 입력하지
          마세요.
        </p>
        <label className="grid gap-1 text-sm font-medium">
          신고 내용
          <textarea
            className={textareaClass}
            maxLength={1000}
            onChange={(event) => setReportComment(event.target.value)}
            value={reportComment}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className={`${actionClass} border border-border bg-surface`}
            onClick={() => setReportOpen(false)}
            type="button"
          >
            취소
          </button>
          <button
            className={`${actionClass} bg-primary text-white`}
            disabled={command.isPending || reportComment.trim().length < 2}
            onClick={() => void report()}
            type="button"
          >
            신고 저장
          </button>
        </div>
      </Dialog>
    </main>
  );
}
