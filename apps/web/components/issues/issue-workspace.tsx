"use client";

import {
  createOperationalIssueRequestSchema,
  hotelErrorResponseSchema,
  operationalIssueActionRequestSchema,
  operationalIssueAddEntryRequestSchema,
  operationalIssueAssigneeRequestSchema,
  operationalIssueInternalResponseSchema,
  operationalIssueListResponseSchema,
  operationalIssueOwnerResponseSchema,
  operationalIssueRoutes,
  type HotelAssignmentView,
  type OperationalIssue,
  type OperationalIssueCapability,
  type OperationalIssuePublic,
} from "@werehere/contracts";
import { Dialog, FeatureGuide } from "@werehere/ui";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  MessageCircle,
  Plus,
  RotateCcw,
  UserRoundCheck,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { hotelFeatureGuides } from "../../lib/feature-guides";

type IssueDetail = OperationalIssue | OperationalIssuePublic;
type CreateFields = {
  description: string;
  severity: "EMERGENCY" | "MAJOR" | "MINOR" | "OBSERVATION";
  title: string;
};
type TextFields = { body: string };
const fieldClass =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50";
const severityLabel = {
  EMERGENCY: "긴급",
  MAJOR: "중대",
  MINOR: "경미",
  OBSERVATION: "관찰",
} as const;
const statusLabel = {
  ACTION_COMPLETED: "조치완료",
  ASSIGNED: "담당지정",
  CANCELLED: "취소",
  CLOSED: "종료",
  IN_PROGRESS: "처리중",
  ON_HOLD: "보류",
  RECEIVED: "접수",
} as const;

function isInternal(issue: IssueDetail): issue is OperationalIssue {
  return "internalNotes" in issue && "workLogs" in issue;
}

function parseIssue(value: unknown) {
  const internal = operationalIssueInternalResponseSchema.safeParse(value);
  if (internal.success) return internal.data.data.issue;
  const owner = operationalIssueOwnerResponseSchema.safeParse(value);
  return owner.success ? owner.data.data.issue : null;
}

async function mutate(path: string, body: unknown) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    method: "POST",
  });
  const value = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = hotelErrorResponseSchema.safeParse(value);
    throw new Error(
      parsed.success
        ? parsed.data.error.message
        : "요청을 처리하지 못했습니다.",
    );
  }
  return value;
}

export function IssueWorkspace({
  assignments,
  capability = null,
  hotelId,
  initialIssues,
  initialSelected,
}: {
  assignments: HotelAssignmentView[];
  capability?: OperationalIssueCapability | null;
  hotelId: string;
  initialIssues: OperationalIssuePublic[];
  initialSelected: IssueDetail | null;
}) {
  const [issues, setIssues] = useState(initialIssues);
  const [selected, setSelected] = useState(initialSelected);
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<
    "ADD_INTERNAL_NOTE" | "ADD_PUBLIC_COMMENT" | "ADD_WORK_LOG" | null
  >(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [holdDue, setHoldDue] = useState("");
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const entryTriggerRef = useRef<HTMLButtonElement>(null);
  const createForm = useForm<CreateFields>({
    defaultValues: { description: "", severity: "MINOR", title: "" },
  });
  const entryForm = useForm<TextFields>({ defaultValues: { body: "" } });

  async function refresh(issueId = selected?.id) {
    const listResponse = await fetch(
      `${operationalIssueRoutes.list(hotelId)}?page=1&pageSize=100`,
      { cache: "no-store" },
    );
    const list = operationalIssueListResponseSchema.safeParse(
      await listResponse.json().catch(() => undefined),
    );
    if (listResponse.ok && list.success) setIssues(list.data.data.issues);
    if (!issueId) return;
    const detailResponse = await fetch(
      operationalIssueRoutes.detail(hotelId, issueId),
      { cache: "no-store" },
    );
    const detail = parseIssue(
      await detailResponse.json().catch(() => undefined),
    );
    if (detailResponse.ok && detail) setSelected(detail);
  }

  async function selectIssue(issueId: string) {
    setMessage("");
    const response = await fetch(
      operationalIssueRoutes.detail(hotelId, issueId),
      { cache: "no-store" },
    );
    const issue = parseIssue(await response.json().catch(() => undefined));
    if (!response.ok || !issue) {
      setMessage("운영이슈 상세를 불러오지 못했습니다.");
      return;
    }
    setSelected(issue);
  }

  const createMutation = useMutation({
    mutationFn: async (fields: CreateFields) =>
      mutate(
        operationalIssueRoutes.create(hotelId),
        createOperationalIssueRequestSchema.parse({
          ...fields,
          issueId: crypto.randomUUID(),
          roomId: null,
        }),
      ),
    onError: (error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "운영이슈를 등록하지 못했습니다.",
      ),
    onSuccess: async (value) => {
      const issue = parseIssue(value);
      if (!issue)
        return setMessage("등록 응답을 안전하게 확인하지 못했습니다.");
      setCreateOpen(false);
      setMessage("운영이슈를 등록했습니다.");
      await refresh(issue.id);
    },
  });

  const commandMutation = useMutation({
    mutationFn: async ({ body, path }: { body: unknown; path: string }) =>
      mutate(path, body),
    onError: (error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "업무 상태를 변경하지 못했습니다.",
      ),
    onSuccess: async (value) => {
      const issue = parseIssue(value);
      if (issue) setSelected(issue);
      setMessage("서버에 변경사항을 저장했습니다.");
      await refresh(issue?.id);
    },
  });

  async function assign(userId: string) {
    if (!selected) return;
    await commandMutation.mutateAsync({
      body: operationalIssueAssigneeRequestSchema.parse({
        assigneeUserId: userId,
        reason: "운영이슈 현장 담당 지정",
        version: selected.version,
      }),
      path: operationalIssueRoutes.assign(hotelId, selected.id),
    });
  }

  async function transition(
    action:
      | "CANCEL"
      | "CLOSE"
      | "COMPLETE_ACTION"
      | "REOPEN"
      | "RESUME"
      | "START",
    reason: string,
  ) {
    if (!selected) return;
    await commandMutation.mutateAsync({
      body: operationalIssueActionRequestSchema.parse({
        action,
        reason,
        resumeDueAt: null,
        version: selected.version,
      }),
      path: operationalIssueRoutes.transitions(hotelId, selected.id),
    });
  }

  async function hold() {
    if (!selected) return;
    await commandMutation.mutateAsync({
      body: operationalIssueActionRequestSchema.parse({
        action: "HOLD",
        reason: holdReason,
        resumeDueAt: holdDue ? new Date(holdDue).toISOString() : null,
        version: selected.version,
      }),
      path: operationalIssueRoutes.transitions(hotelId, selected.id),
    });
    setHoldOpen(false);
    setHoldReason("");
    setHoldDue("");
  }

  async function addEntry(fields: TextFields) {
    if (!selected || !entryKind) return;
    const value = operationalIssueAddEntryRequestSchema.parse({
      body: fields.body,
      version: selected.version,
    });
    const path =
      entryKind === "ADD_WORK_LOG"
        ? operationalIssueRoutes.workLogs(hotelId, selected.id)
        : entryKind === "ADD_PUBLIC_COMMENT"
          ? operationalIssueRoutes.publicComments(hotelId, selected.id)
          : operationalIssueRoutes.internalNotes(hotelId, selected.id);
    await commandMutation.mutateAsync({ body: value, path });
    setEntryKind(null);
    entryForm.reset();
  }

  const busy = createMutation.isPending || commandMutation.isPending;
  return (
    <section
      aria-labelledby="issue-title"
      className="space-y-4 pb-20 md:pb-0"
      data-issue-workspace
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 id="issue-title" className="text-2xl font-bold text-primary">
              운영이슈
            </h1>
            <FeatureGuide
              content={hotelFeatureGuides["hotel-operational-issue.lifecycle"]}
            />
          </div>
          <p className="text-sm text-muted">
            접수부터 담당 지정, 현장 처리, 조치완료와 종료까지 실제 저장 상태로
            관리합니다.
          </p>
        </div>
        {capability?.canCreate ? (
          <button
            className={`${actionClass} bg-primary text-white`}
            onClick={() => {
              createForm.reset({
                description: "",
                severity: "MINOR",
                title: "",
              });
              setCreateOpen(true);
            }}
            ref={createTriggerRef}
          >
            <Plus aria-hidden="true" size={16} /> 이슈 등록
          </button>
        ) : null}
      </header>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-control border border-border bg-background p-3 text-sm"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section
          aria-label="운영이슈 목록"
          className="overflow-hidden rounded-panel border border-border bg-surface"
        >
          <div className="border-b border-border px-4 py-3">
            <strong>전체 이슈</strong>
            <span className="ml-2 text-xs text-muted">{issues.length}건</span>
          </div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto p-2">
            {issues.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">
                등록된 운영이슈가 없습니다.
              </p>
            ) : (
              issues.map((issue) => (
                <button
                  aria-pressed={selected?.id === issue.id}
                  className={`w-full rounded-control border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected?.id === issue.id ? "border-primary bg-primary/5" : "border-transparent bg-background hover:border-border"}`}
                  key={issue.id}
                  onClick={() => selectIssue(issue.id)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="line-clamp-1 text-sm">
                      {issue.title}
                    </strong>
                    <span className="rounded-full bg-background px-2 py-1 text-xs">
                      {severityLabel[issue.severity]}
                    </span>
                  </span>
                  <span className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{statusLabel[issue.status]}</span>
                    <span>{issue.assignee?.displayName ?? "담당 미정"}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section
          aria-label="운영이슈 상세"
          className="min-w-0 rounded-panel border border-border bg-surface p-4 md:p-6"
        >
          {!selected ? (
            <div className="grid min-h-64 place-items-center text-sm text-muted">
              목록에서 운영이슈를 선택해 주세요.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">
                      {severityLabel[selected.severity]}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                      {statusLabel[selected.status]}
                    </span>
                    {selected.isOverdue ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                        재개예정 초과
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-xl font-bold">{selected.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                    {selected.description}
                  </p>
                </div>
                <span className="text-xs text-muted">v{selected.version}</span>
              </div>

              <div className="grid gap-3 rounded-control bg-background p-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-muted">담당자</span>
                  <p className="font-medium">
                    {selected.assignee?.displayName ?? "담당 미정"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted">재개예정</span>
                  <p className="font-medium">
                    {selected.resumeDueAt
                      ? new Date(selected.resumeDueAt).toLocaleString("ko-KR")
                      : "설정 없음"}
                  </p>
                </div>
              </div>

              {isInternal(selected) ? (
                <div aria-label="현장 행동" className="flex flex-wrap gap-2">
                  {capability?.canManage && selected.status === "RECEIVED" ? (
                    <select
                      aria-label="담당자 지정"
                      className={`${fieldClass} max-w-60`}
                      defaultValue=""
                      disabled={busy}
                      onChange={(event) =>
                        event.target.value && assign(event.target.value)
                      }
                    >
                      <option value="">담당자 지정</option>
                      {assignments.map((assignment) => (
                        <option
                          key={assignment.id}
                          value={assignment.assignee.userId}
                        >
                          {assignment.assignee.displayName}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {capability?.canWork &&
                  selected.assignee?.userId === capability.actorUserId &&
                  selected.status === "ASSIGNED" ? (
                    <button
                      className={`${actionClass} bg-primary text-white`}
                      disabled={busy}
                      onClick={() => transition("START", "현장 처리 시작")}
                    >
                      <CirclePlay aria-hidden="true" size={16} /> 처리 시작
                    </button>
                  ) : null}
                  {capability?.canManage &&
                  ["ASSIGNED", "IN_PROGRESS"].includes(selected.status) ? (
                    <button
                      className={`${actionClass} border border-border`}
                      disabled={busy}
                      onClick={() => setHoldOpen(true)}
                    >
                      <CirclePause aria-hidden="true" size={16} /> 보류
                    </button>
                  ) : null}
                  {capability?.canManage && selected.status === "ON_HOLD" ? (
                    <button
                      className={`${actionClass} bg-primary text-white`}
                      disabled={busy}
                      onClick={() => transition("RESUME", "현장 업무 재개")}
                    >
                      <RotateCcw aria-hidden="true" size={16} /> 재개
                    </button>
                  ) : null}
                  {capability?.canWork &&
                  selected.assignee?.userId === capability.actorUserId &&
                  selected.status === "IN_PROGRESS" ? (
                    <button
                      className={`${actionClass} bg-emerald-700 text-white`}
                      disabled={busy}
                      onClick={() =>
                        transition("COMPLETE_ACTION", "현장 조치 완료")
                      }
                    >
                      <CheckCircle2 aria-hidden="true" size={16} /> 조치 완료
                    </button>
                  ) : null}
                  {capability?.canManage &&
                  selected.status === "ACTION_COMPLETED" ? (
                    <button
                      className={`${actionClass} bg-primary text-white`}
                      disabled={busy}
                      onClick={() =>
                        transition("CLOSE", "조치결과 확인 후 종료")
                      }
                    >
                      <CheckCircle2 aria-hidden="true" size={16} /> 이슈 종료
                    </button>
                  ) : null}
                  {capability?.canManage &&
                  ["CLOSED", "CANCELLED"].includes(selected.status) ? (
                    <button
                      className={`${actionClass} border border-border`}
                      disabled={busy}
                      onClick={() => transition("REOPEN", "현장 상황 재발견")}
                    >
                      <RotateCcw aria-hidden="true" size={16} /> 이슈 재개
                    </button>
                  ) : null}
                  {capability?.canManage &&
                  !["CLOSED", "CANCELLED"].includes(selected.status) ? (
                    <button
                      className={`${actionClass} border border-red-300 text-red-700`}
                      disabled={busy}
                      onClick={() =>
                        transition("CANCEL", "중복 또는 오접수 취소")
                      }
                    >
                      <AlertTriangle aria-hidden="true" size={16} /> 취소
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {capability?.canComment ? (
                  <button
                    className={`${actionClass} border border-border`}
                    disabled={
                      busy || ["CLOSED", "CANCELLED"].includes(selected.status)
                    }
                    onClick={() => {
                      entryForm.reset();
                      setEntryKind("ADD_PUBLIC_COMMENT");
                    }}
                    ref={entryTriggerRef}
                  >
                    <MessageCircle aria-hidden="true" size={16} /> 공개댓글
                  </button>
                ) : null}
                {isInternal(selected) &&
                capability?.canWork &&
                selected.assignee?.userId === capability.actorUserId ? (
                  <button
                    className={`${actionClass} border border-border`}
                    disabled={busy || selected.status !== "IN_PROGRESS"}
                    onClick={() => {
                      entryForm.reset();
                      setEntryKind("ADD_WORK_LOG");
                    }}
                  >
                    <UserRoundCheck aria-hidden="true" size={16} /> 작업기록
                  </button>
                ) : null}
                {isInternal(selected) && capability?.canManage ? (
                  <button
                    className={`${actionClass} border border-border`}
                    disabled={
                      busy || ["CLOSED", "CANCELLED"].includes(selected.status)
                    }
                    onClick={() => {
                      entryForm.reset();
                      setEntryKind("ADD_INTERNAL_NOTE");
                    }}
                  >
                    내부메모
                  </button>
                ) : null}
              </div>

              <section aria-label="공개댓글" className="space-y-2">
                <h3 className="font-semibold">공개댓글</h3>
                {selected.publicComments.length === 0 ? (
                  <p className="text-sm text-muted">
                    등록된 공개댓글이 없습니다.
                  </p>
                ) : (
                  selected.publicComments.map((entry) => (
                    <article
                      className="rounded-control bg-background p-3"
                      key={entry.id}
                    >
                      <p className="text-sm">{entry.body}</p>
                      <p className="mt-1 text-xs text-muted">
                        {entry.actor.displayName}
                      </p>
                    </article>
                  ))
                )}
              </section>

              {isInternal(selected) ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <section aria-label="작업기록" className="space-y-2">
                    <h3 className="font-semibold">작업기록</h3>
                    {selected.workLogs.length === 0 ? (
                      <p className="text-sm text-muted">
                        등록된 작업기록이 없습니다.
                      </p>
                    ) : (
                      selected.workLogs.map((entry) => (
                        <article
                          className="rounded-control bg-background p-3"
                          key={entry.id}
                        >
                          <p className="text-sm">{entry.body}</p>
                          <p className="mt-1 text-xs text-muted">
                            {entry.actor.displayName}
                          </p>
                        </article>
                      ))
                    )}
                  </section>
                  <section aria-label="내부메모" className="space-y-2">
                    <h3 className="font-semibold">내부메모</h3>
                    {selected.internalNotes.length === 0 ? (
                      <p className="text-sm text-muted">
                        등록된 내부메모가 없습니다.
                      </p>
                    ) : (
                      selected.internalNotes.map((entry) => (
                        <article
                          className="rounded-control bg-amber-50 p-3"
                          key={entry.id}
                        >
                          <p className="text-sm">{entry.body}</p>
                          <p className="mt-1 text-xs text-muted">
                            {entry.actor.displayName}
                          </p>
                        </article>
                      ))
                    )}
                  </section>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <Dialog
        onOpenChange={setCreateOpen}
        open={createOpen}
        restoreFocusRef={createTriggerRef}
        title="운영이슈 등록"
      >
        <form
          className="space-y-4"
          onSubmit={createForm.handleSubmit((fields) =>
            createMutation.mutate(fields),
          )}
        >
          <label className="block text-sm font-medium">
            제목
            <input
              className={`${fieldClass} mt-1`}
              {...createForm.register("title")}
            />
          </label>
          <label className="block text-sm font-medium">
            등급
            <select
              className={`${fieldClass} mt-1`}
              {...createForm.register("severity")}
            >
              <option value="OBSERVATION">관찰</option>
              <option value="MINOR">경미</option>
              <option value="MAJOR">중대</option>
              <option value="EMERGENCY">긴급</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            현장 내용
            <textarea
              className={`${fieldClass} mt-1 min-h-28 py-3`}
              {...createForm.register("description")}
            />
          </label>
          <button
            className={`${actionClass} w-full bg-primary text-white`}
            disabled={busy}
            type="submit"
          >
            등록
          </button>
        </form>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setEntryKind(null)}
        open={entryKind !== null}
        restoreFocusRef={entryTriggerRef}
        title={
          entryKind === "ADD_PUBLIC_COMMENT"
            ? "공개댓글 등록"
            : entryKind === "ADD_WORK_LOG"
              ? "작업기록 등록"
              : "내부메모 등록"
        }
      >
        <form className="space-y-4" onSubmit={entryForm.handleSubmit(addEntry)}>
          <label className="block text-sm font-medium">
            내용
            <textarea
              className={`${fieldClass} mt-1 min-h-28 py-3`}
              {...entryForm.register("body")}
            />
          </label>
          <button
            className={`${actionClass} w-full bg-primary text-white`}
            disabled={busy}
            type="submit"
          >
            저장
          </button>
        </form>
      </Dialog>

      <Dialog onOpenChange={setHoldOpen} open={holdOpen} title="운영이슈 보류">
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            보류 사유
            <textarea
              className={`${fieldClass} mt-1 min-h-24 py-3`}
              onChange={(event) => setHoldReason(event.target.value)}
              value={holdReason}
            />
          </label>
          <label className="block text-sm font-medium">
            재개예정일
            <input
              className={`${fieldClass} mt-1`}
              onChange={(event) => setHoldDue(event.target.value)}
              type="datetime-local"
              value={holdDue}
            />
          </label>
          <button
            className={`${actionClass} w-full bg-primary text-white`}
            disabled={busy || holdReason.trim().length < 2}
            onClick={hold}
            type="button"
          >
            보류 저장
          </button>
        </div>
      </Dialog>
    </section>
  );
}
