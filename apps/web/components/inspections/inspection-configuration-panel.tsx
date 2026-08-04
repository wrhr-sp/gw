"use client";

import {
  createInspectionChecklistRevisionV2RequestSchema,
  inspectionChecklistV2ResponseSchema,
  inspectionChecklistV2RevisionSchema,
  inspectionRoutes,
  processDefaultResponseSchema,
  processDefinitionSchema,
  processRoutes,
  type HotelFacilityType,
  type HotelRoomType,
  type InspectionRoutine,
  type ProcessReviewerCandidate,
} from "@werehere/contracts";
import { Button, PageHeader, StatusBadge } from "@werehere/ui";
import React, { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { ProcessDefinitionEditor } from "./process-definition-editor";
import {
  InspectionRoutineEditor,
  type RoomOption,
} from "./inspection-routine-editor";

type Checklist = z.infer<typeof inspectionChecklistV2RevisionSchema>;
type Definition = z.infer<typeof processDefinitionSchema>;
type FormValue = z.input<
  typeof createInspectionChecklistRevisionV2RequestSchema
>;

const emptyItem = (
  targetType: "ROOM" | "FACILITY",
): FormValue["items"][number] => {
  const common = {
    itemId: null,
    source: "HOTEL_COMMON" as const,
    name: "",
    description: null,
    isRequired: true,
    displayOrder: 10,
    defaultSeverity: "OBSERVATION" as const,
  };
  if (targetType === "ROOM")
    return {
      ...common,
      targetType: "ROOM",
      roomTypeId: null,
      excludedRoomTypeIds: [],
    };
  return {
    ...common,
    targetType: "FACILITY",
    facilityTypeId: null,
    excludedFacilityTypeIds: [],
  };
};

function checklistMaterial(items: FormValue["items"]) {
  return JSON.stringify(
    items
      .map((item) => ({
        targetType: item.targetType,
        source: item.source,
        typeId:
          item.targetType === "ROOM" ? item.roomTypeId : item.facilityTypeId,
        excludedTypeIds: [
          ...(item.targetType === "ROOM"
            ? item.excludedRoomTypeIds
            : item.excludedFacilityTypeIds),
        ].sort(),
        name: item.name,
        description: item.description,
        isRequired: item.isRequired,
        displayOrder: item.displayOrder,
        defaultSeverity: item.defaultSeverity,
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
  );
}

export function InspectionConfigurationPanel({
  hotelId,
  facilityTypes,
  initialChecklist,
  initialRoutines = [],
  processDefinitions: initialDefinitions,
  reviewerCandidates = [],
  rooms = [],
  roomTypes,
}: {
  hotelId: string;
  facilityTypes: HotelFacilityType[];
  initialChecklist: Checklist | null;
  initialRoutines?: InspectionRoutine[];
  processDefinitions: Definition[];
  reviewerCandidates?: ProcessReviewerCandidate[];
  rooms?: RoomOption[];
  roomTypes: HotelRoomType[];
}) {
  const [definitions, setDefinitions] = useState(initialDefinitions);
  const [saved, setSaved] = useState(initialChecklist);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDefaultId, setSelectedDefaultId] = useState("");
  const [defaultVersion, setDefaultVersion] = useState(0);
  const [savingDefault, setSavingDefault] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const defaultIdempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await fetch(processRoutes.hotelDefault(hotelId), {
        cache: "no-store",
      });
      const parsed = processDefaultResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!active || !response.ok || !parsed.success) return;
      setSelectedDefaultId(parsed.data.data.default?.definition.id ?? "");
      setDefaultVersion(parsed.data.data.default?.version ?? 0);
    })();
    return () => {
      active = false;
    };
  }, [hotelId]);

  async function saveDefaultProcess() {
    if (!selectedDefaultId) {
      setMessage("기본 프로세스를 선택해 주세요.");
      return;
    }
    setSavingDefault(true);
    setMessage(null);
    try {
      const response = await fetch(processRoutes.hotelDefault(hotelId), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "idempotency-key": defaultIdempotencyKey.current,
        },
        body: JSON.stringify({
          processDefinitionId: selectedDefaultId,
          version: defaultVersion,
        }),
      });
      const mutation = processDefaultResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!response.ok || !mutation.success || !mutation.data.data.default)
        throw new Error("기본 프로세스를 저장하지 못했습니다.");
      const readResponse = await fetch(processRoutes.hotelDefault(hotelId), {
        cache: "no-store",
      });
      const read = processDefaultResponseSchema.safeParse(
        await readResponse.json().catch(() => undefined),
      );
      if (
        !readResponse.ok ||
        !read.success ||
        !read.data.data.default ||
        read.data.data.default.definition.id !== selectedDefaultId ||
        read.data.data.default.version !== mutation.data.data.default.version
      )
        throw new Error("기본 프로세스 저장 결과를 다시 확인하지 못했습니다.");
      setDefaultVersion(read.data.data.default.version);
      defaultIdempotencyKey.current = crypto.randomUUID();
      setMessage("기본 프로세스를 저장하고 다시 확인했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "기본 프로세스를 저장하지 못했습니다.",
      );
    } finally {
      setSavingDefault(false);
    }
  }

  const { control, handleSubmit, register, reset, setValue, watch } =
    useForm<FormValue>({
      defaultValues: {
        version: initialChecklist?.version ?? 0,
        reason: initialChecklist?.reason ?? "점검 기준 설정",
        items: initialChecklist?.items ?? [],
      },
    });
  const { append, fields, remove } = useFieldArray({
    control,
    name: "items",
    keyName: "formKey",
  });
  const watchedItems = watch("items");

  const submit = handleSubmit(async (value) => {
    setMessage(null);
    const parsed =
      createInspectionChecklistRevisionV2RequestSchema.safeParse(value);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(inspectionRoutes.checklistV2(hotelId), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey.current,
        },
        body: JSON.stringify(parsed.data),
      });
      const mutation = inspectionChecklistV2ResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!response.ok || !mutation.success || !mutation.data.data.checklist)
        throw new Error("체크리스트를 저장하지 못했습니다.");
      const readResponse = await fetch(inspectionRoutes.checklistV2(hotelId), {
        cache: "no-store",
      });
      const read = inspectionChecklistV2ResponseSchema.safeParse(
        await readResponse.json().catch(() => undefined),
      );
      if (
        !readResponse.ok ||
        !read.success ||
        !read.data.data.checklist ||
        read.data.data.checklist.id !== mutation.data.data.checklist.id ||
        read.data.data.checklist.version !==
          mutation.data.data.checklist.version ||
        mutation.data.data.checklist.reason !== parsed.data.reason ||
        read.data.data.checklist.reason !== parsed.data.reason ||
        checklistMaterial(mutation.data.data.checklist.items) !==
          checklistMaterial(parsed.data.items) ||
        checklistMaterial(read.data.data.checklist.items) !==
          checklistMaterial(parsed.data.items)
      )
        throw new Error("저장 결과를 다시 확인하지 못했습니다.");
      const checklist = read.data.data.checklist;
      setSaved(checklist);
      reset({
        version: checklist.version,
        reason: checklist.reason,
        items: checklist.items,
      });
      idempotencyKey.current = crypto.randomUUID();
      setMessage("체크리스트를 저장하고 다시 확인했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "체크리스트를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <StatusBadge tone={saved ? "success" : "neutral"}>
            {saved ? `버전 ${saved.version}` : "미설정"}
          </StatusBadge>
        }
        description="호텔별 객실·시설물 점검항목과 적용 유형을 설정합니다."
        eyebrow="호텔 점검"
        title="점검 설정"
      />
      <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
        <h2 className="text-lg font-semibold">검토 프로세스</h2>
        <p className="mt-1 text-sm text-muted">
          이 호텔에서 사용할 수 있는 회사·호텔 프로세스입니다.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {definitions.map((definition) => (
            <li
              className="rounded-control border border-border p-3"
              key={definition.id}
            >
              <span className="font-semibold">{definition.name}</span>
              <span className="ml-2 text-xs text-muted">
                v{definition.version}
              </span>
            </li>
          ))}
          {definitions.length === 0 ? (
            <li className="text-sm text-muted">등록된 프로세스가 없습니다.</li>
          ) : null}
        </ul>
        <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="text-sm font-semibold" htmlFor="default-process">
            호텔 기본 프로세스
            <select
              className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
              id="default-process"
              onChange={(event) => setSelectedDefaultId(event.target.value)}
              value={selectedDefaultId}
            >
              <option value="">선택</option>
              {definitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name} · v{definition.version}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="min-h-11"
            disabled={!selectedDefaultId || savingDefault}
            onClick={() => void saveDefaultProcess()}
            type="button"
          >
            {savingDefault ? "저장 중…" : "기본 프로세스 저장"}
          </Button>
        </div>
        <ProcessDefinitionEditor
          definitions={definitions}
          hotelId={hotelId}
          onDefinitionsChange={setDefinitions}
          reviewerCandidates={reviewerCandidates}
        />
      </section>
      <form className="space-y-4" onSubmit={submit}>
        <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">객실 체크리스트</h2>
              <p className="mt-1 text-sm text-muted">
                호텔 공통항목과 객실유형별 추가·제외항목을 관리합니다.
              </p>
            </div>
            <Button
              className="min-h-11"
              onClick={() => append(emptyItem("ROOM"))}
              type="button"
              variant="secondary"
            >
              객실 점검항목 추가
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div>
              <h2 className="text-lg font-semibold">시설물 체크리스트</h2>
              <p className="mt-1 text-sm text-muted">
                호텔 시설물 공통항목과 시설물유형별 추가·제외항목을 관리합니다.
              </p>
            </div>
            <Button
              className="min-h-11"
              onClick={() => append(emptyItem("FACILITY"))}
              type="button"
              variant="secondary"
            >
              시설물유형 추가
            </Button>
          </div>
          <label
            className="mt-5 block text-sm font-semibold"
            htmlFor="checklist-reason"
          >
            변경사유
          </label>
          <input
            className="mt-2 min-h-11 w-full rounded-control border border-border px-3"
            id="checklist-reason"
            {...register("reason")}
          />
          <div className="mt-5 space-y-4">
            {fields.map((field, index) => {
              const source = watchedItems[index]?.source;
              return (
                <fieldset
                  className="rounded-panel border border-border p-4"
                  key={field.formKey}
                >
                  <legend className="px-1 text-sm font-semibold">
                    {watchedItems[index]?.targetType === "FACILITY"
                      ? "시설물"
                      : "객실"} 점검항목 {index + 1}
                  </legend>
                  <input
                    type="hidden"
                    {...register(`items.${index}.targetType`)}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold">
                      항목 이름 {index + 1}
                      <input
                        aria-label={`항목 이름 ${index + 1}`}
                        className="mt-1 min-h-11 w-full rounded-control border border-border px-3"
                        {...register(`items.${index}.name`)}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      적용 방식 {index + 1}
                      <select
                        aria-label={`적용 방식 ${index + 1}`}
                        className="mt-1 min-h-11 w-full rounded-control border border-border px-3"
                        {...register(`items.${index}.source`, {
                          onChange: (event) => {
                            if (event.target.value === "HOTEL_COMMON") {
                              if (watchedItems[index]?.targetType === "ROOM")
                                setValue(`items.${index}.roomTypeId`, null);
                              else
                                setValue(`items.${index}.facilityTypeId`, null);
                            }
                          },
                        })}
                      >
                        <option value="HOTEL_COMMON">호텔 공통</option>
                        <option value="TARGET_TYPE_ADDED">유형별 추가</option>
                      </select>
                    </label>
                    {source === "TARGET_TYPE_ADDED" &&
                    watchedItems[index]?.targetType === "ROOM" ? (
                      <label className="text-sm font-semibold">
                        적용 객실유형 {index + 1}
                        <select
                          aria-label={`적용 객실유형 ${index + 1}`}
                          className="mt-1 min-h-11 w-full rounded-control border border-border px-3"
                          {...register(`items.${index}.roomTypeId`, {
                            setValueAs: (value) => value || null,
                          })}
                        >
                          <option value="">선택</option>
                          {roomTypes
                            .filter((type) => type.isActive)
                            .map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                    {source === "TARGET_TYPE_ADDED" &&
                    watchedItems[index]?.targetType === "FACILITY" ? (
                      <label className="text-sm font-semibold">
                        적용 시설물유형 {index + 1}
                        <select
                          aria-label={`적용 시설물유형 ${index + 1}`}
                          className="mt-1 min-h-11 w-full rounded-control border border-border px-3"
                          {...register(`items.${index}.facilityTypeId`, {
                            setValueAs: (value) => value || null,
                          })}
                        >
                          <option value="">선택</option>
                          {facilityTypes
                            .filter((type) => type.status === "ACTIVE")
                            .map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                    {source === "HOTEL_COMMON" &&
                    watchedItems[index]?.targetType === "ROOM" ? (
                      <fieldset className="md:col-span-2">
                        <legend className="text-sm font-semibold">
                          제외 객실유형 {index + 1}
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {roomTypes
                            .filter((type) => type.isActive)
                            .map((type) => (
                              <label
                                className="flex min-h-11 items-center gap-2 text-sm"
                                key={type.id}
                              >
                                <input
                                  type="checkbox"
                                  value={type.id}
                                  {...register(
                                    `items.${index}.excludedRoomTypeIds`,
                                  )}
                                />
                                {type.name}
                              </label>
                            ))}
                        </div>
                      </fieldset>
                    ) : null}
                    {source === "HOTEL_COMMON" &&
                    watchedItems[index]?.targetType === "FACILITY" ? (
                      <fieldset className="md:col-span-2">
                        <legend className="text-sm font-semibold">
                          제외 시설물유형 {index + 1}
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {facilityTypes
                            .filter((type) => type.status === "ACTIVE")
                            .map((type) => (
                              <label
                                className="flex min-h-11 items-center gap-2 text-sm"
                                key={type.id}
                              >
                                <input
                                  type="checkbox"
                                  value={type.id}
                                  {...register(
                                    `items.${index}.excludedFacilityTypeIds`,
                                  )}
                                />
                                {type.name}
                              </label>
                            ))}
                        </div>
                      </fieldset>
                    ) : null}
                    <label className="text-sm font-semibold">
                      기본 심각도 {index + 1}
                      <select
                        className="mt-1 min-h-11 w-full rounded-control border border-border px-3"
                        {...register(`items.${index}.defaultSeverity`)}
                      >
                        <option value="OBSERVATION">관찰</option>
                        <option value="MINOR">경미</option>
                        <option value="MAJOR">중대</option>
                        <option value="CRITICAL">긴급</option>
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        {...register(`items.${index}.isRequired`)}
                      />
                      필수항목
                    </label>
                  </div>
                  <Button
                    className="mt-3 min-h-11"
                    onClick={() => remove(index)}
                    type="button"
                    variant="ghost"
                  >
                    항목 삭제
                  </Button>
                </fieldset>
              );
            })}
          </div>
        </section>
        <p aria-live="polite" className="min-h-5 text-sm" role="status">
          {message ?? ""}
        </p>
        <div className="sticky bottom-4 flex justify-end">
          <Button
            className="min-h-11"
            disabled={saving || fields.length === 0}
            type="submit"
          >
            {saving ? "저장 중…" : "체크리스트 저장"}
          </Button>
        </div>
      </form>
      <InspectionRoutineEditor
        checklistRevisionId={saved?.id ?? null}
        definitions={definitions}
        hotelId={hotelId}
        initialRoutines={initialRoutines}
        rooms={rooms}
        roomTypes={roomTypes}
      />
    </div>
  );
}
