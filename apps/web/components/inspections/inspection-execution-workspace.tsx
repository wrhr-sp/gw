"use client";

import {
  createManualInspectionRequestSchema,
  hotelErrorResponseSchema,
  inspectionExecutionListResponseSchema,
  inspectionExecutionResponseSchema,
  inspectionExecutionSchema,
  inspectionRoutes,
  saveInspectionItemResultRequestSchema,
} from "@werehere/contracts";
import { Button, PageHeader, StatusBadge } from "@werehere/ui";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type Inspection = z.infer<typeof inspectionExecutionSchema>;
type InspectionSummary = z.infer<
  typeof inspectionExecutionListResponseSchema
>["data"]["inspections"][number];
type Item = Inspection["items"][number];
type ResultValue = "ABNORMAL" | "CAUTION" | "NORMAL";
type Severity = "CRITICAL" | "MAJOR" | "MINOR" | "OBSERVATION";
type Draft = {
  description: string;
  result: ResultValue | null;
  severity: Severity | null;
};
type DraftForm = { drafts: Record<string, Draft> };
type ManualForm = { roomId: string; selectedItemIds: string[] };
type SaveResultRequest = z.infer<typeof saveInspectionItemResultRequestSchema>;

type RoomOption = {
  floorLabel: string;
  id: string;
  roomNumber: string;
  status: string;
};

type ChecklistOption = { id: string; name: string };

const resultLabels: Record<ResultValue, string> = {
  ABNORMAL: "이상",
  CAUTION: "주의",
  NORMAL: "정상",
};
const resultTones = {
  ABNORMAL: "danger",
  CAUTION: "warning",
  NORMAL: "success",
} as const;
const severityLabels: Record<Severity, string> = {
  CRITICAL: "긴급",
  MAJOR: "중대",
  MINOR: "경미",
  OBSERVATION: "관찰",
};

function draftFromItem(item: Item): Draft {
  return {
    description: item.result?.description ?? "",
    result: item.result?.result ?? null,
    severity: item.result?.severity ?? null,
  };
}

function savedResultMatches(
  item: Item | undefined,
  expected: SaveResultRequest,
) {
  const result = item?.result;
  return Boolean(
    result &&
    result.version === expected.version + 1 &&
    result.result === expected.result &&
    result.description === expected.description &&
    result.severity === expected.severity &&
    result.fileVersionIds.length === expected.fileVersionIds.length &&
    result.fileVersionIds.every(
      (fileVersionId, index) =>
        fileVersionId === expected.fileVersionIds[index],
    ),
  );
}

function draftsFromInspection(inspection: Inspection | null) {
  return Object.fromEntries(
    (inspection?.items ?? []).map((item) => [item.id, draftFromItem(item)]),
  );
}

function roomLabel(inspection: Inspection | InspectionSummary) {
  const rooms = inspection.rooms.map((room) => `${room.roomNumber}호`);
  return rooms.length > 0 ? rooms.join(", ") : "호텔 공용 점검";
}

function progress(inspection: Inspection) {
  const answered = inspection.items.filter(
    (item) => item.result !== null,
  ).length;
  return { answered, total: inspection.items.length };
}

async function errorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = hotelErrorResponseSchema.safeParse(body);
  return parsed.success
    ? parsed.data.error.message
    : "요청을 처리하지 못했습니다. 입력값을 유지했으니 다시 시도해 주세요.";
}

async function fetchDetail(hotelId: string, inspectionId: string) {
  const response = await fetch(inspectionRoutes.detail(hotelId, inspectionId), {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const parsed = inspectionExecutionResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  if (!parsed.success)
    throw new Error("점검 상세 재조회 응답이 올바르지 않습니다.");
  return parsed.data.data.inspection;
}

async function fetchAllPendingInspections(hotelId: string) {
  const inspections: InspectionSummary[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetch(
      `${inspectionRoutes.list(hotelId)}?page=${page}&pageSize=100&status=PENDING_INPUT`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(await errorMessage(response));
    const parsed = inspectionExecutionListResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    if (!parsed.success)
      throw new Error("점검 목록 재조회 응답이 올바르지 않습니다.");
    inspections.push(...parsed.data.data.inspections);
    totalPages = parsed.data.data.pagination.totalPages;
    page += 1;
    if (page > 100 && page <= totalPages)
      throw new Error("점검 목록이 너무 많아 저장 결과를 확인하지 못했습니다.");
  } while (page <= totalPages);
  return inspections;
}

export function InspectionExecutionWorkspace({
  checklistItems,
  hotelId,
  initialInspections,
  initialSelectedInspection,
  rooms,
}: {
  checklistItems: ChecklistOption[];
  hotelId: string;
  initialInspections: InspectionSummary[];
  initialSelectedInspection: Inspection | null;
  rooms: RoomOption[];
}) {
  const [inspections, setInspections] = useState(initialInspections);
  const [selected, setSelected] = useState(initialSelectedInspection);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const saveOperations = useRef<
    Record<string, { body: string; key: string } | undefined>
  >({});
  const manualOperation = useRef<{ body: string; key: string } | null>(null);
  const { getValues, register, reset, setValue, watch } = useForm<DraftForm>({
    defaultValues: { drafts: draftsFromInspection(initialSelectedInspection) },
  });
  const manualForm = useForm<ManualForm>({
    defaultValues: { roomId: "", selectedItemIds: [] },
  });
  useEffect(() => {
    if (dirtyIds.size === 0) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirtyIds.size]);
  const drafts = watch("drafts") ?? {};
  const activeItem = selected?.items[activeIndex] ?? null;
  const activeDraft = activeItem ? drafts?.[activeItem.id] : null;
  const currentProgress = selected
    ? progress(selected)
    : { answered: 0, total: 0 };
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE");
  const manualSelectedItems = manualForm.watch("selectedItemIds") ?? [];

  const counts = useMemo(
    () => ({
      manual: inspections.filter((item) => item.source === "MANUAL").length,
      routine: inspections.filter((item) => item.source === "ROUTINE").length,
      total: inspections.length,
    }),
    [inspections],
  );

  function replaceDraft(itemId: string, next: Draft) {
    setValue("drafts", { ...getValues("drafts"), [itemId]: next });
    setDirtyIds((current) => new Set(current).add(itemId));
    setMessage(null);
  }

  function applyCanonical(inspection: Inspection, preserveDirty = false) {
    setSelected(inspection);
    if (!preserveDirty) {
      reset({ drafts: draftsFromInspection(inspection) });
      setDirtyIds(new Set());
    }
    setActiveIndex((current) =>
      Math.min(current, Math.max(inspection.items.length - 1, 0)),
    );
  }

  async function selectInspection(inspectionId: string) {
    if (saving) return;
    if (
      dirtyIds.size > 0 &&
      !window.confirm(
        "저장하지 않은 입력이 있습니다. 다른 점검으로 이동할까요?",
      )
    )
      return;
    setMessage("점검 상세를 불러오는 중입니다.");
    try {
      const inspection = await fetchDetail(hotelId, inspectionId);
      applyCanonical(inspection);
      setActiveIndex(0);
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "점검 상세를 불러오지 못했습니다.",
      );
    }
  }

  async function readBack(inspectionId: string) {
    const [inspection, nextList] = await Promise.all([
      fetchDetail(hotelId, inspectionId),
      fetchAllPendingInspections(hotelId),
    ]);
    if (!nextList.some((item) => item.id === inspectionId))
      throw new Error("저장한 점검이 목록에서 확인되지 않습니다.");
    setInspections(nextList);
    return inspection;
  }

  async function saveOne(itemId: string, canonical: Inspection) {
    const item = canonical.items.find((candidate) => candidate.id === itemId);
    const draft = getValues("drafts")[itemId];
    if (!item || !draft) throw new Error("저장할 점검항목을 찾을 수 없습니다.");
    const request = {
      changeReason: item.result ? "점검 수행 화면에서 결과 수정" : null,
      description: draft.result === "NORMAL" ? null : draft.description.trim(),
      fileVersionIds: [],
      itemSnapshotId: item.id,
      result: draft.result,
      severity: draft.result === "ABNORMAL" ? draft.severity : null,
      version: item.result?.version ?? 0,
    };
    const parsedRequest =
      saveInspectionItemResultRequestSchema.safeParse(request);
    if (!parsedRequest.success)
      throw new Error(
        parsedRequest.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
      );
    const body = JSON.stringify(parsedRequest.data);
    const previous = saveOperations.current[itemId];
    const operation =
      previous?.body === body ? previous : { body, key: crypto.randomUUID() };
    saveOperations.current[itemId] = operation;
    const response = await fetch(
      inspectionRoutes.result(hotelId, canonical.id, itemId),
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "idempotency-key": operation.key,
        },
        body,
      },
    );
    if (!response.ok) {
      const failure = await errorMessage(response);
      if (response.status === 409) {
        const latest = await fetchDetail(hotelId, canonical.id).catch(
          () => null,
        );
        if (latest) applyCanonical(latest, true);
        delete saveOperations.current[itemId];
      }
      throw new Error(failure);
    }
    const mutation = inspectionExecutionResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    if (!mutation.success)
      throw new Error("저장 응답이 올바르지 않아 완료로 처리하지 않았습니다.");
    const mutationItem = mutation.data.data.inspection.items.find(
      (candidate) => candidate.id === itemId,
    );
    if (!savedResultMatches(mutationItem, parsedRequest.data))
      throw new Error(
        "저장 응답이 요청값과 달라 충돌로 처리했습니다. 입력값은 유지됩니다.",
      );
    const read = await readBack(canonical.id);
    const saved = read.items.find((candidate) => candidate.id === itemId);
    if (!saved || !savedResultMatches(saved, parsedRequest.data))
      throw new Error(
        "저장 후 재조회 값이 요청값과 달라 충돌로 처리했습니다. 입력값은 유지됩니다.",
      );
    delete saveOperations.current[itemId];
    setDirtyIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
    setValue("drafts", {
      ...getValues("drafts"),
      [itemId]: draftFromItem(saved),
    });
    setSelected(read);
    return read;
  }

  async function saveCurrentAndNext() {
    if (!selected || !activeItem || saving) return;
    setSaving(true);
    setMessage("현재 항목을 서버에 저장하는 중입니다.");
    try {
      const canonical = await saveOne(activeItem.id, selected);
      const nextIndex = canonical.items.findIndex(
        (item, index) => index > activeIndex && item.result === null,
      );
      setActiveIndex(
        nextIndex >= 0
          ? nextIndex
          : Math.min(activeIndex + 1, canonical.items.length - 1),
      );
      setMessage("서버 저장과 재조회를 완료했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "저장하지 못했습니다. 입력값은 유지됩니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAllChanges() {
    if (!selected || dirtyIds.size === 0 || saving) return;
    setSaving(true);
    setMessage(`${dirtyIds.size}개 변경항목을 차례로 저장합니다.`);
    let canonical = selected;
    let completed = 0;
    try {
      for (const itemId of Array.from(dirtyIds)) {
        canonical = await saveOne(itemId, canonical);
        completed += 1;
        setMessage(`${completed}/${dirtyIds.size}개 항목을 저장했습니다.`);
      }
      applyCanonical(canonical);
      setMessage(
        `${completed}개 변경항목의 서버 저장과 재조회를 완료했습니다.`,
      );
    } catch (error) {
      setMessage(
        `${completed}개 저장 완료 · ${
          error instanceof Error ? error.message : "나머지 항목 저장 실패"
        }`,
      );
    } finally {
      setSaving(false);
    }
  }

  const createManual = manualForm.handleSubmit(async (value) => {
    if (saving) return;
    const request = createManualInspectionRequestSchema.safeParse({
      processDefinitionId: null,
      targets: [
        { roomId: value.roomId, selectedItemIds: value.selectedItemIds },
      ],
    });
    if (!request.success) {
      setMessage(
        request.error.issues[0]?.message ?? "수시점검 대상을 확인해 주세요.",
      );
      return;
    }
    setSaving(true);
    setMessage("수시점검을 생성하고 서버에서 다시 확인하는 중입니다.");
    const body = JSON.stringify(request.data);
    const previous = manualOperation.current;
    const operation =
      previous?.body === body ? previous : { body, key: crypto.randomUUID() };
    manualOperation.current = operation;
    try {
      const response = await fetch(inspectionRoutes.createManual(hotelId), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": operation.key,
        },
        body,
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const parsed = inspectionExecutionResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!parsed.success)
        throw new Error("수시점검 생성 응답이 올바르지 않습니다.");
      const inspection = await readBack(parsed.data.data.inspection.id);
      manualOperation.current = null;
      applyCanonical(inspection);
      setActiveIndex(0);
      manualForm.reset();
      setManualOpen(false);
      setMessage("수시점검 생성과 서버 재조회를 완료했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "수시점검을 생성하지 못했습니다. 선택값은 유지됩니다.",
      );
    } finally {
      setSaving(false);
    }
  });

  const descriptionField = activeItem
    ? register(`drafts.${activeItem.id}.description`)
    : null;
  const severityField = activeItem
    ? register(`drafts.${activeItem.id}.severity`)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 pb-24 lg:pb-8">
      <PageHeader
        actions={
          <Button
            className="min-h-11"
            onClick={() =>
              setManualOpen((current) => {
                if (current) manualOperation.current = null;
                return !current;
              })
            }
            type="button"
          >
            {manualOpen ? "수시점검 닫기" : "수시점검 시작"}
          </Button>
        }
        description="정기점검 도래 건을 이어서 수행하거나 필요한 객실의 수시점검을 시작합니다."
        eyebrow="호텔 점검"
        title="오늘 점검"
      />

      <section
        aria-label="점검 현황"
        className="grid grid-cols-3 gap-2 rounded-panel border border-border bg-surface p-4"
      >
        <div>
          <p className="text-xs text-muted">전체</p>
          <p className="mt-1 text-xl font-bold">{counts.total}</p>
        </div>
        <div>
          <p className="text-xs text-muted">정기</p>
          <p className="mt-1 text-xl font-bold">{counts.routine}</p>
        </div>
        <div>
          <p className="text-xs text-muted">수시</p>
          <p className="mt-1 text-xl font-bold">{counts.manual}</p>
        </div>
      </section>

      {manualOpen ? (
        <form
          className="rounded-panel border border-primary/30 bg-surface p-4 md:p-5"
          onSubmit={createManual}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">수시점검 시작</h2>
              <p className="mt-1 text-sm text-muted">
                객실과 실제 점검항목을 선택합니다.
              </p>
            </div>
            <StatusBadge tone="info">신규 점검</StatusBadge>
          </div>
          <label
            className="mt-4 block text-sm font-medium"
            htmlFor="manual-room"
          >
            객실
          </label>
          <select
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-background px-3 text-sm md:max-w-sm"
            id="manual-room"
            {...manualForm.register("roomId")}
          >
            <option value="">객실 선택</option>
            {activeRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.floorLabel} · {room.roomNumber}호
              </option>
            ))}
          </select>
          <fieldset className="mt-4 rounded-control border border-border p-3">
            <legend className="px-1 text-sm font-medium">점검항목</legend>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {checklistItems.map((item) => (
                <label
                  className="flex min-h-11 items-center gap-2 rounded-control px-2 hover:bg-canvas"
                  key={item.id}
                >
                  <input
                    checked={manualSelectedItems.includes(item.id)}
                    onChange={(event) =>
                      manualForm.setValue(
                        "selectedItemIds",
                        event.target.checked
                          ? [...manualSelectedItems, item.id]
                          : manualSelectedItems.filter((id) => id !== item.id),
                      )
                    }
                    type="checkbox"
                  />
                  <span className="text-sm">{item.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button className="mt-4 min-h-11" disabled={saving} type="submit">
            점검 생성
          </Button>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(260px,0.8fr)_minmax(360px,1.2fr)]">
        <section
          className="hidden rounded-panel border border-border bg-surface lg:block"
          aria-labelledby="inspection-list-title"
        >
          <div className="border-b border-border p-4">
            <h2 className="font-semibold" id="inspection-list-title">
              수행할 점검
            </h2>
            <p className="mt-1 text-xs text-muted">
              작성 전·작성 중 점검 {inspections.length}건
            </p>
          </div>
          {inspections.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              현재 수행할 점검이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {inspections.map((inspection) => (
                <li key={inspection.id}>
                  <button
                    aria-current={
                      selected?.id === inspection.id ? "true" : undefined
                    }
                    className="min-h-16 w-full px-4 py-3 text-left hover:bg-canvas aria-[current=true]:bg-primary/5"
                    onClick={() => void selectInspection(inspection.id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-sm">
                        {roomLabel(inspection)}
                      </strong>
                      <StatusBadge
                        tone={
                          inspection.source === "ROUTINE" ? "info" : "neutral"
                        }
                      >
                        {inspection.source === "ROUTINE" ? "정기" : "수시"}
                      </StatusBadge>
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      업무일 {inspection.businessDate}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="hidden rounded-panel border border-border bg-surface lg:block"
          aria-labelledby="item-list-title"
        >
          <div className="border-b border-border p-4">
            <h2 className="font-semibold" id="item-list-title">
              점검항목
            </h2>
            <p className="mt-1 text-xs text-muted">
              {currentProgress.answered}/{currentProgress.total} 항목 서버
              저장됨
            </p>
            <progress
              className="mt-3 h-2 w-full accent-primary"
              max={Math.max(currentProgress.total, 1)}
              value={currentProgress.answered}
            >
              {currentProgress.answered}/{currentProgress.total}
            </progress>
          </div>
          {!selected ? (
            <p className="p-5 text-sm text-muted">
              왼쪽에서 점검을 선택해 주세요.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {selected.items.map((item, index) => {
                const draft = drafts?.[item.id];
                const dirty = dirtyIds.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      aria-current={activeIndex === index ? "step" : undefined}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-canvas aria-[current=step]:bg-primary/5"
                      onClick={() => setActiveIndex(index)}
                      type="button"
                    >
                      <span>
                        <span className="mr-2 text-xs text-muted">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </span>
                      {dirty ? (
                        <StatusBadge tone="warning">미저장</StatusBadge>
                      ) : draft?.result ? (
                        <StatusBadge tone={resultTones[draft.result]}>
                          {resultLabels[draft.result]}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">미입력</StatusBadge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section
          className="rounded-panel border border-border bg-surface p-4 md:p-5"
          aria-labelledby="active-item-title"
        >
          {!selected || !activeItem || !activeDraft ? (
            <div className="py-10 text-center text-sm text-muted">
              수행할 점검항목을 선택해 주세요.
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-control border border-border bg-canvas p-3 lg:hidden">
                {inspections.length > 1 ? (
                  <>
                    <label
                      className="block text-sm font-semibold"
                      htmlFor="mobile-inspection"
                    >
                      수행할 점검
                    </label>
                    <select
                      className="mt-2 min-h-11 w-full rounded-control border border-border bg-background px-3 text-sm"
                      disabled={saving}
                      id="mobile-inspection"
                      onChange={(event) =>
                        void selectInspection(event.target.value)
                      }
                      value={selected.id}
                    >
                      {inspections.map((inspection) => (
                        <option key={inspection.id} value={inspection.id}>
                          {roomLabel(inspection)} ·{" "}
                          {inspection.source === "ROUTINE" ? "정기" : "수시"} ·{" "}
                          {inspection.businessDate}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <div
                  className={`${inspections.length > 1 ? "mt-4" : ""} flex items-center justify-between gap-3 text-xs`}
                >
                  <span className="font-semibold">서버 저장 진행률</span>
                  <span>
                    {currentProgress.answered}/{currentProgress.total}
                  </span>
                </div>
                <progress
                  className="mt-2 h-2 w-full accent-primary"
                  max={Math.max(currentProgress.total, 1)}
                  value={currentProgress.answered}
                >
                  {currentProgress.answered}/{currentProgress.total}
                </progress>
                <label
                  className="mt-3 block text-sm font-semibold"
                  htmlFor="mobile-inspection-item"
                >
                  점검항목 이동
                </label>
                <select
                  className="mt-2 min-h-11 w-full rounded-control border border-border bg-background px-3 text-sm"
                  id="mobile-inspection-item"
                  onChange={(event) =>
                    setActiveIndex(Number(event.target.value))
                  }
                  value={activeIndex}
                >
                  {selected.items.map((item, index) => (
                    <option key={item.id} value={index}>
                      {index + 1}. {item.name}
                      {item.result
                        ? ` · ${resultLabels[item.result.result]}`
                        : " · 미입력"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-primary">
                    {activeIndex + 1} / {selected.items.length}
                  </p>
                  <h2
                    className="mt-1 text-lg font-semibold"
                    id="active-item-title"
                  >
                    {activeItem.name}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {activeItem.description ??
                      "항목 상태를 현장에서 확인해 주세요."}
                  </p>
                </div>
                <StatusBadge
                  tone={selected.source === "ROUTINE" ? "info" : "neutral"}
                >
                  {roomLabel(selected)} ·{" "}
                  {selected.source === "ROUTINE" ? "정기" : "수시"}
                </StatusBadge>
              </div>

              <fieldset className="mt-5">
                <legend className="text-sm font-semibold">점검 결과</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["NORMAL", "CAUTION", "ABNORMAL"] as const).map(
                    (result) => (
                      <button
                        aria-pressed={activeDraft.result === result}
                        className="min-h-[52px] rounded-control border border-border px-2 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white"
                        key={result}
                        onClick={() =>
                          replaceDraft(activeItem.id, {
                            description:
                              result === "NORMAL"
                                ? ""
                                : activeDraft.description,
                            result,
                            severity:
                              result === "ABNORMAL"
                                ? (activeDraft.severity ??
                                  activeItem.defaultSeverity)
                                : null,
                          })
                        }
                        type="button"
                      >
                        {resultLabels[result]}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>

              {activeDraft.result === "CAUTION" ||
              activeDraft.result === "ABNORMAL" ? (
                <div className="mt-5">
                  <label
                    className="text-sm font-semibold"
                    htmlFor={`description-${activeItem.id}`}
                  >
                    설명
                  </label>
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-control border border-border bg-background px-3 py-2 text-sm"
                    id={`description-${activeItem.id}`}
                    maxLength={2000}
                    {...descriptionField}
                    onChange={(event) => {
                      descriptionField?.onChange(event);
                      setDirtyIds((current) =>
                        new Set(current).add(activeItem.id),
                      );
                      setMessage(null);
                    }}
                    placeholder={
                      activeDraft.result === "ABNORMAL"
                        ? "확인한 이상 상태를 구체적으로 입력해 주세요."
                        : "주의가 필요한 이유를 입력해 주세요."
                    }
                  />
                </div>
              ) : null}

              {activeDraft.result === "ABNORMAL" ? (
                <div className="mt-4">
                  <label
                    className="text-sm font-semibold"
                    htmlFor={`severity-${activeItem.id}`}
                  >
                    심각도
                  </label>
                  <select
                    className="mt-2 min-h-11 w-full rounded-control border border-border bg-background px-3 text-sm"
                    id={`severity-${activeItem.id}`}
                    {...severityField}
                    onChange={(event) => {
                      severityField?.onChange(event);
                      setDirtyIds((current) =>
                        new Set(current).add(activeItem.id),
                      );
                      setMessage(null);
                    }}
                  >
                    {(Object.keys(severityLabels) as Severity[]).map(
                      (severity) => (
                        <option key={severity} value={severity}>
                          {severityLabels[severity]}
                        </option>
                      ),
                    )}
                  </select>
                  <p className="mt-2 text-xs text-muted">
                    사진 증빙은 후속 기능에서 연결하며, 최종 제출 전에는 반드시
                    필요합니다.
                  </p>
                </div>
              ) : null}

              <div className="mt-6 flex gap-2">
                <Button
                  className="min-h-11 flex-1"
                  disabled={activeIndex === 0 || saving}
                  onClick={() =>
                    setActiveIndex((index) => Math.max(index - 1, 0))
                  }
                  type="button"
                  variant="secondary"
                >
                  이전
                </Button>
                <Button
                  className="min-h-11 flex-[2]"
                  disabled={!dirtyIds.has(activeItem.id) || saving}
                  onClick={() => void saveCurrentAndNext()}
                  type="button"
                >
                  {saving ? "저장 중" : "저장하고 다음"}
                </Button>
                <Button
                  className="min-h-11 flex-1"
                  disabled={activeIndex >= selected.items.length - 1 || saving}
                  onClick={() =>
                    setActiveIndex((index) =>
                      Math.min(index + 1, selected.items.length - 1),
                    )
                  }
                  type="button"
                  variant="secondary"
                >
                  다음
                </Button>
              </div>

              <Button
                className="mt-3 hidden min-h-11 w-full lg:inline-flex"
                disabled={dirtyIds.size === 0 || saving}
                onClick={() => void saveAllChanges()}
                type="button"
                variant="secondary"
              >
                변경사항 저장 ({dirtyIds.size})
              </Button>
            </>
          )}
        </section>
      </div>

      <p
        aria-live="polite"
        className="rounded-control border border-border bg-surface px-4 py-3 text-sm"
        role="status"
      >
        {message ??
          (dirtyIds.size > 0
            ? `${dirtyIds.size}개 항목이 아직 서버에 저장되지 않았습니다.`
            : "모든 화면 입력 상태를 확인했습니다.")}
      </p>
    </main>
  );
}
