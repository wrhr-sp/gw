"use client";

import {
  createProcessDefinitionRequestSchema,
  processDefinitionListResponseSchema,
  processDefinitionResponseSchema,
  processRoutes,
  type ProcessReviewerCandidate,
} from "@werehere/contracts";
import { Button } from "@werehere/ui";
import React, { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

type Definition = z.infer<
  typeof processDefinitionResponseSchema
>["data"]["definition"];
type StageForm = {
  key: string;
  name: string;
  reviewerUserId: string;
  delegateUserId: string;
  delegateStartsAt: string;
  delegateEndsAt: string;
  dueAmount: string;
  dueUnit: "HOURS" | "DAYS";
  isFinal: boolean;
};
type TransitionForm = {
  fromStageKey: string;
  event: "APPROVE" | "REJECT" | "SELECT";
  choiceValue: string;
  toStageKey: string;
};
type ProcessForm = {
  name: string;
  version: number;
  startStageKey: string;
  stages: StageForm[];
  transitions: TransitionForm[];
};

const localDateTime = (value: string | null | undefined) =>
  value ? value.slice(0, 16) : "";

function newProcess(reviewerUserId = ""): ProcessForm {
  return {
    name: "객실점검 검토",
    version: 0,
    startStageKey: "REVIEW",
    stages: [
      {
        key: "REVIEW",
        name: "검토",
        reviewerUserId,
        delegateUserId: "",
        delegateStartsAt: "",
        delegateEndsAt: "",
        dueAmount: "4",
        dueUnit: "HOURS",
        isFinal: false,
      },
      {
        key: "COMPLETED",
        name: "완료",
        reviewerUserId,
        delegateUserId: "",
        delegateStartsAt: "",
        delegateEndsAt: "",
        dueAmount: "",
        dueUnit: "HOURS",
        isFinal: true,
      },
    ],
    transitions: [
      {
        fromStageKey: "REVIEW",
        event: "APPROVE",
        choiceValue: "",
        toStageKey: "COMPLETED",
      },
    ],
  };
}

function definitionForm(definition: Definition): ProcessForm {
  return {
    name: definition.name,
    version: definition.version,
    startStageKey: definition.startStageKey,
    stages: definition.stages.map((stage) => ({
      key: stage.key,
      name: stage.name,
      reviewerUserId: stage.reviewerUserId,
      delegateUserId: stage.delegate?.userId ?? "",
      delegateStartsAt: localDateTime(stage.delegate?.startsAt),
      delegateEndsAt: localDateTime(stage.delegate?.endsAt),
      dueAmount: stage.due ? String(stage.due.amount) : "",
      dueUnit: stage.due?.unit ?? "HOURS",
      isFinal: stage.isFinal,
    })),
    transitions: definition.transitions.map((transition) => ({
      fromStageKey: transition.fromStageKey,
      event: transition.event,
      choiceValue: transition.choiceValue ?? "",
      toStageKey: transition.toStageKey,
    })),
  };
}

export function ProcessDefinitionEditor({
  definitions,
  hotelId,
  onDefinitionsChange,
  reviewerCandidates,
}: {
  definitions: Definition[];
  hotelId: string;
  onDefinitionsChange: (definitions: Definition[]) => void;
  reviewerCandidates: ProcessReviewerCandidate[];
}) {
  const firstReviewerId = reviewerCandidates[0]?.id ?? "";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const { control, handleSubmit, register, reset, watch } =
    useForm<ProcessForm>({
      defaultValues: newProcess(firstReviewerId),
    });
  const stages = useFieldArray({ control, name: "stages", keyName: "formKey" });
  const transitions = useFieldArray({
    control,
    name: "transitions",
    keyName: "formKey",
  });
  const watchedStages = watch("stages");

  function edit(definition: Definition) {
    if (definition.scope !== "HOTEL" || definition.hotelId !== hotelId) {
      setMessage("회사 공통 프로세스는 이 호텔 화면에서 수정할 수 없습니다.");
      return;
    }
    setEditingId(definition.id);
    reset(definitionForm(definition));
    setMessage(`${definition.name} v${definition.version}을 수정합니다.`);
  }

  function createNew() {
    setEditingId(null);
    reset(newProcess(firstReviewerId));
    setMessage("새 호텔 프로세스를 입력해 주세요.");
  }

  const submit = handleSubmit(async (form) => {
    setMessage(null);
    const payload = {
      name: form.name,
      applicationType: "ROOM_INSPECTION" as const,
      scope: "HOTEL" as const,
      hotelId,
      version: form.version,
      startStageKey: form.startStageKey,
      stages: form.stages.map((stage) => ({
        key: stage.key,
        name: stage.name,
        reviewerUserId: stage.reviewerUserId,
        delegate: stage.delegateUserId
          ? {
              userId: stage.delegateUserId,
              startsAt: new Date(stage.delegateStartsAt).toISOString(),
              endsAt: stage.delegateEndsAt
                ? new Date(stage.delegateEndsAt).toISOString()
                : null,
            }
          : null,
        due: stage.dueAmount
          ? { amount: Number(stage.dueAmount), unit: stage.dueUnit }
          : null,
        isFinal: stage.isFinal,
      })),
      transitions: form.transitions.map((transition) => ({
        fromStageKey: transition.fromStageKey,
        event: transition.event,
        choiceValue:
          transition.event === "SELECT" ? transition.choiceValue : null,
        toStageKey: transition.toStageKey,
      })),
    };
    const parsed = createProcessDefinitionRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues[0]?.message ?? "프로세스 입력값을 확인해 주세요.",
      );
      return;
    }
    setSaving(true);
    try {
      const path = editingId
        ? processRoutes.definition(editingId)
        : processRoutes.definitions;
      const response = await fetch(path, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey.current,
        },
        body: JSON.stringify(parsed.data),
      });
      const mutation = processDefinitionResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!response.ok || !mutation.success)
        throw new Error("프로세스 정의를 저장하지 못했습니다.");
      const readResponse = await fetch(
        `${processRoutes.definitions}?hotelId=${encodeURIComponent(hotelId)}`,
        { cache: "no-store" },
      );
      const read = processDefinitionListResponseSchema.safeParse(
        await readResponse.json().catch(() => undefined),
      );
      const canonicalDefinitions = read.data?.data.definitions;
      if (!readResponse.ok || !read.success || !canonicalDefinitions)
        throw new Error("프로세스 저장 결과를 다시 확인하지 못했습니다.");
      const canonical = canonicalDefinitions.find(
        (definition) => definition.id === mutation.data.data.definition.id,
      );
      if (
        !canonical ||
        canonical.version !== mutation.data.data.definition.version
      )
        throw new Error("프로세스 저장 결과를 다시 확인하지 못했습니다.");
      onDefinitionsChange(canonicalDefinitions);
      setEditingId(canonical.id);
      reset(definitionForm(canonical));
      idempotencyKey.current = crypto.randomUUID();
      setMessage(
        `프로세스 v${canonical.version}을 저장하고 다시 확인했습니다.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "프로세스 정의를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <section
      aria-labelledby="process-editor-title"
      className="mt-6 border-t border-border pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold" id="process-editor-title">
            호텔 프로세스 정의
          </h3>
          <p className="mt-1 text-sm text-muted">
            검토단계·담당자·기한·이동경로를 순서대로 설정합니다.
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={createNew}
          type="button"
          variant="secondary"
        >
          새 프로세스
        </Button>
      </div>

      {reviewerCandidates.length === 0 ? (
        <p
          className="mt-4 rounded-control border border-warning/40 bg-warning/10 p-3 text-sm"
          role="alert"
        >
          이 호텔에 배정된 활성 사내 임직원이 없어 프로세스를 저장할 수
          없습니다.
        </p>
      ) : null}

      <div
        aria-label="호텔 프로세스 수정 선택"
        className="mt-4 flex flex-wrap gap-2"
        role="group"
      >
        {definitions
          .filter(
            (definition) =>
              definition.scope === "HOTEL" && definition.hotelId === hotelId,
          )
          .map((definition) => (
            <Button
              className="min-h-11"
              key={definition.id}
              onClick={() => edit(definition)}
              type="button"
              variant="secondary"
            >
              {definition.name} v{definition.version} 수정
            </Button>
          ))}
      </div>

      <form className="mt-5 space-y-6" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">
            프로세스 이름
            <input
              className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
              {...register("name")}
            />
          </label>
          <label className="text-sm font-semibold">
            시작단계
            <select
              className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
              {...register("startStageKey")}
            >
              {watchedStages.map((stage, index) => (
                <option key={`${stage.key}-${index}`} value={stage.key}>
                  {stage.name || stage.key || `단계 ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="font-semibold">검토단계</legend>
          {stages.fields.map((field, index) => (
            <article
              className="rounded-control border border-border p-4"
              key={field.formKey}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-semibold">
                  단계 키
                  <input
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    {...register(`stages.${index}.key`)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  단계 이름
                  <input
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    {...register(`stages.${index}.name`)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  주 검토자
                  <select
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    {...register(`stages.${index}.reviewerUserId`)}
                  >
                    <option value="">선택</option>
                    {reviewerCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  대리인 선택
                  <select
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    {...register(`stages.${index}.delegateUserId`)}
                  >
                    <option value="">사용 안 함</option>
                    {reviewerCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  대리 시작
                  <input
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    type="datetime-local"
                    {...register(`stages.${index}.delegateStartsAt`)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  대리 종료
                  <input
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    type="datetime-local"
                    {...register(`stages.${index}.delegateEndsAt`)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  처리기한
                  <input
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    min="1"
                    max="365"
                    type="number"
                    {...register(`stages.${index}.dueAmount`)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  기한 단위
                  <select
                    className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                    {...register(`stages.${index}.dueUnit`)}
                  >
                    <option value="HOURS">시간</option>
                    <option value="DAYS">일</option>
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    {...register(`stages.${index}.isFinal`)}
                  />
                  최종단계
                </label>
              </div>
              <Button
                className="mt-3 min-h-11"
                disabled={stages.fields.length <= 1}
                onClick={() => stages.remove(index)}
                type="button"
                variant="secondary"
              >
                단계 삭제
              </Button>
            </article>
          ))}
          <Button
            className="min-h-11"
            onClick={() => {
              const sequence = stages.fields.length + 1;
              stages.append({
                ...newProcess(firstReviewerId).stages[0]!,
                key: `REVIEW_${sequence}`,
                name: `검토 ${sequence}`,
              });
            }}
            type="button"
            variant="secondary"
          >
            단계 추가
          </Button>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-semibold">단계 이동</legend>
          {transitions.fields.map((field, index) => (
            <article
              className="grid gap-3 rounded-control border border-border p-4 sm:grid-cols-2 lg:grid-cols-5"
              key={field.formKey}
            >
              <label className="text-sm font-semibold">
                출발단계
                <select
                  className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                  {...register(`transitions.${index}.fromStageKey`)}
                >
                  {watchedStages.map((stage, stageIndex) => (
                    <option
                      key={`${stage.key}-${stageIndex}`}
                      value={stage.key}
                    >
                      {stage.name || stage.key}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                처리
                <select
                  className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                  {...register(`transitions.${index}.event`)}
                >
                  <option value="APPROVE">승인</option>
                  <option value="REJECT">반려</option>
                  <option value="SELECT">선택</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                선택값
                <input
                  className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                  {...register(`transitions.${index}.choiceValue`)}
                />
              </label>
              <label className="text-sm font-semibold">
                도착단계
                <select
                  className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
                  {...register(`transitions.${index}.toStageKey`)}
                >
                  {watchedStages.map((stage, stageIndex) => (
                    <option
                      key={`${stage.key}-${stageIndex}`}
                      value={stage.key}
                    >
                      {stage.name || stage.key}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                className="min-h-11 self-end"
                onClick={() => transitions.remove(index)}
                type="button"
                variant="secondary"
              >
                이동 삭제
              </Button>
            </article>
          ))}
          <Button
            className="min-h-11"
            onClick={() =>
              transitions.append({
                fromStageKey: watchedStages[0]?.key ?? "",
                event: "APPROVE",
                choiceValue: "",
                toStageKey:
                  watchedStages[1]?.key ?? watchedStages[0]?.key ?? "",
              })
            }
            type="button"
            variant="secondary"
          >
            이동 추가
          </Button>
        </fieldset>

        <div
          aria-atomic="true"
          aria-live="polite"
          className="min-h-6 text-sm"
          role="status"
        >
          {message}
        </div>
        <Button
          className="min-h-11 w-full sm:w-auto"
          disabled={saving || reviewerCandidates.length === 0}
          type="submit"
        >
          {saving
            ? "저장 중…"
            : editingId
              ? "프로세스 수정 저장"
              : "프로세스 생성"}
        </Button>
      </form>
    </section>
  );
}
