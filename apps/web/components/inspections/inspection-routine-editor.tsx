"use client";

import {
  createInspectionRoutineRequestSchema,
  inspectionRoutineListResponseSchema,
  inspectionRoutineResponseSchema,
  inspectionRoutes,
  type HotelRoomType,
  type InspectionRoutine,
} from "@werehere/contracts";
import { Button, StatusBadge } from "@werehere/ui";
import React, { useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

const DAYS = [
  ["MONDAY", "월요일"],
  ["TUESDAY", "화요일"],
  ["WEDNESDAY", "수요일"],
  ["THURSDAY", "목요일"],
  ["FRIDAY", "금요일"],
  ["SATURDAY", "토요일"],
  ["SUNDAY", "일요일"],
] as const;

const RECURRENCES = [
  ["DAILY", "매일"],
  ["WEEKLY", "매주"],
  ["MONTHLY", "매월"],
  ["INTERVAL_DAYS", "N일마다"],
  ["INTERVAL_WEEKS", "N주마다"],
  ["INTERVAL_MONTHS", "N개월마다"],
] as const;

type TargetType = "FLOOR" | "HOTEL" | "ROOM_TYPE" | "ROOMS";
type FormRound = {
  floorLabels: string[];
  order: number;
  roomIds: string[];
  roomTypeIds: string[];
  targetType: TargetType;
};
type FormValue = {
  dayOfMonth: number;
  dayOfWeek: (typeof DAYS)[number][0];
  endDate: string;
  interval: number;
  localDueTime: string;
  mode: "FIXED" | "ROTATING";
  name: string;
  processDefinitionId: string;
  recurrenceType: (typeof RECURRENCES)[number][0];
  rounds: FormRound[];
  startDate: string;
  status: "ACTIVE" | "INACTIVE";
  version: number;
};

export type RoomOption = {
  floorLabel: string;
  id: string;
  roomNumber: string;
  roomTypeId: string;
  status: string;
};

type DefinitionOption = { id: string; name: string };

const emptyRound = (order = 1): FormRound => ({
  floorLabels: [],
  order,
  roomIds: [],
  roomTypeIds: [],
  targetType: "HOTEL",
});

const emptyForm = (): FormValue => ({
  dayOfMonth: 1,
  dayOfWeek: "MONDAY",
  endDate: "",
  interval: 1,
  localDueTime: "15:00",
  mode: "FIXED",
  name: "",
  processDefinitionId: "",
  recurrenceType: "MONTHLY",
  rounds: [emptyRound()],
  startDate: "",
  status: "ACTIVE",
  version: 0,
});

function routineForm(routine: InspectionRoutine): FormValue {
  const recurrence = routine.revision.recurrence;
  return {
    dayOfMonth: recurrence.type === "MONTHLY" ? recurrence.dayOfMonth : 1,
    dayOfWeek: recurrence.type === "WEEKLY" ? recurrence.dayOfWeek : "MONDAY",
    endDate: routine.revision.endDate ?? "",
    interval: "interval" in recurrence ? recurrence.interval : 1,
    localDueTime: routine.revision.localDueTime,
    mode: routine.revision.mode,
    name: routine.name,
    processDefinitionId: routine.revision.processDefinitionId,
    recurrenceType: recurrence.type,
    rounds: routine.revision.rounds.map((round) => ({
      floorLabels:
        round.target.type === "FLOOR" ? round.target.floorLabels : [],
      order: round.order,
      roomIds: round.target.type === "ROOMS" ? round.target.roomIds : [],
      roomTypeIds:
        round.target.type === "ROOM_TYPE" ? round.target.roomTypeIds : [],
      targetType: round.target.type,
    })),
    startDate: routine.revision.startDate,
    status: routine.status,
    version: routine.version,
  };
}

function target(round: FormRound) {
  switch (round.targetType) {
    case "FLOOR":
      return { type: "FLOOR" as const, floorLabels: round.floorLabels };
    case "ROOM_TYPE":
      return { type: "ROOM_TYPE" as const, roomTypeIds: round.roomTypeIds };
    case "ROOMS":
      return { type: "ROOMS" as const, roomIds: round.roomIds };
    default:
      return { type: "HOTEL" as const };
  }
}

function recurrence(value: FormValue) {
  switch (value.recurrenceType) {
    case "WEEKLY":
      return { type: "WEEKLY" as const, dayOfWeek: value.dayOfWeek };
    case "MONTHLY":
      return { type: "MONTHLY" as const, dayOfMonth: Number(value.dayOfMonth) };
    case "INTERVAL_DAYS":
      return {
        type: "INTERVAL_DAYS" as const,
        interval: Number(value.interval),
      };
    case "INTERVAL_WEEKS":
      return {
        type: "INTERVAL_WEEKS" as const,
        interval: Number(value.interval),
      };
    case "INTERVAL_MONTHS":
      return {
        type: "INTERVAL_MONTHS" as const,
        interval: Number(value.interval),
      };
    default:
      return { type: "DAILY" as const };
  }
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="rounded-control border border-border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            className="flex min-h-11 items-center gap-2 rounded-control px-2 text-sm hover:bg-canvas"
            key={option.id}
          >
            <input
              checked={selected.includes(option.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
              type="checkbox"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function InspectionRoutineEditor({
  checklistRevisionId,
  definitions,
  hotelId,
  initialRoutines,
  rooms,
  roomTypes,
}: {
  checklistRevisionId: string | null;
  definitions: DefinitionOption[];
  hotelId: string;
  initialRoutines: InspectionRoutine[];
  rooms: RoomOption[];
  roomTypes: HotelRoomType[];
}) {
  const [routines, setRoutines] = useState(initialRoutines);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const { control, handleSubmit, register, reset, setValue, watch } =
    useForm<FormValue>({ defaultValues: emptyForm() });
  const rounds = useFieldArray({ control, name: "rounds" });
  const mode = watch("mode");
  const recurrenceType = watch("recurrenceType");
  const watchedRounds = watch("rounds");
  const floorOptions = useMemo(
    () =>
      [
        ...new Set(
          rooms
            .filter((room) => room.status === "ACTIVE")
            .map((room) => room.floorLabel),
        ),
      ]
        .sort((left, right) => left.localeCompare(right, "ko"))
        .map((floor) => ({ id: floor, label: floor })),
    [rooms],
  );
  const roomOptions = rooms
    .filter((room) => room.status === "ACTIVE")
    .map((room) => ({
      id: room.id,
      label: `${room.roomNumber} · ${room.floorLabel}`,
    }));
  const roomTypeOptions = roomTypes
    .filter((roomType) => roomType.isActive)
    .map((roomType) => ({ id: roomType.id, label: roomType.name }));

  function selectRoutine(routine: InspectionRoutine | null) {
    setSelectedId(routine?.id ?? null);
    reset(routine ? routineForm(routine) : emptyForm());
    setMessage(null);
    idempotencyKey.current = crypto.randomUUID();
  }

  const submit = handleSubmit(async (value) => {
    if (!checklistRevisionId) {
      setMessage("체크리스트를 먼저 저장해 주세요.");
      return;
    }
    const request = createInspectionRoutineRequestSchema.safeParse({
      name: value.name,
      status: value.status,
      version: value.version,
      mode: value.mode,
      recurrence: recurrence(value),
      startDate: value.startDate,
      endDate: value.endDate || null,
      localDueTime: value.localDueTime,
      processDefinitionId: value.processDefinitionId || null,
      rounds: value.rounds.map((round, index) => ({
        order: index + 1,
        target: target(round),
      })),
    });
    if (!request.success) {
      setMessage(request.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const path = selectedId
        ? inspectionRoutes.routine(hotelId, selectedId)
        : inspectionRoutes.routines(hotelId);
      const response = await fetch(path, {
        method: selectedId ? "PUT" : "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey.current,
        },
        body: JSON.stringify(request.data),
      });
      const mutation = inspectionRoutineResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!response.ok || !mutation.success)
        throw new Error("정기점검 루틴을 저장하지 못했습니다.");
      const readResponse = await fetch(inspectionRoutes.routines(hotelId), {
        cache: "no-store",
      });
      const read = inspectionRoutineListResponseSchema.safeParse(
        await readResponse.json().catch(() => undefined),
      );
      const readRoutines = read.success ? read.data.data.routines : null;
      const canonical = readRoutines?.find(
        (item) => item.id === mutation.data.data.routine.id,
      );
      if (
        !readResponse.ok ||
        !readRoutines ||
        !canonical ||
        canonical.version !== mutation.data.data.routine.version
      )
        throw new Error("저장된 루틴을 다시 확인하지 못했습니다.");
      setRoutines(readRoutines);
      setSelectedId(canonical.id);
      reset(routineForm(canonical));
      idempotencyKey.current = crypto.randomUUID();
      setMessage("정기점검 루틴을 저장하고 다시 확인했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "정기점검 루틴을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <section
      aria-labelledby="inspection-routine-editor-title"
      className="rounded-panel border border-border bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="text-lg font-semibold"
            id="inspection-routine-editor-title"
          >
            정기점검 루틴
          </h2>
          <p className="mt-1 text-sm text-muted">
            체크리스트 revision {checklistRevisionId ?? "미설정"}을 고정해 점검
            일정을 만듭니다.
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => selectRoutine(null)}
          type="button"
        >
          새 루틴
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {routines.map((routine) => (
          <button
            aria-pressed={selectedId === routine.id}
            className="min-h-11 rounded-control border border-border p-3 text-left hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            key={routine.id}
            onClick={() => selectRoutine(routine)}
            type="button"
          >
            <span className="flex items-center justify-between gap-2">
              <strong>{routine.name}</strong>
              <StatusBadge
                tone={routine.status === "ACTIVE" ? "success" : "neutral"}
              >
                {routine.status === "ACTIVE" ? "사용중" : "사용중지"}
              </StatusBadge>
            </span>
            <span className="mt-2 block text-xs text-muted">
              v{routine.version} · 다음 기준일 {routine.nextDueDate ?? "없음"}
            </span>
          </button>
        ))}
        {routines.length === 0 ? (
          <p className="text-sm text-muted">등록된 정기점검 루틴이 없습니다.</p>
        ) : null}
      </div>

      <form className="mt-6 space-y-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium">
            루틴 이름
            <input
              className="min-h-11 rounded-control border border-border px-3"
              {...register("name")}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            상태
            <select
              className="min-h-11 rounded-control border border-border px-3"
              {...register("status")}
            >
              <option value="ACTIVE">사용중</option>
              <option value="INACTIVE">사용중지</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            회차 방식
            <select
              className="min-h-11 rounded-control border border-border px-3"
              {...register("mode", {
                onChange: (event) => {
                  if (
                    event.target.value === "FIXED" &&
                    rounds.fields.length > 1
                  )
                    rounds.replace([watchedRounds[0] ?? emptyRound()]);
                },
              })}
            >
              <option value="FIXED">고정형</option>
              <option value="ROTATING">순환형</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            검토 프로세스
            <select
              className="min-h-11 rounded-control border border-border px-3"
              {...register("processDefinitionId")}
            >
              <option value="">호텔 기본 프로세스</option>
              {definitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="rounded-control border border-border p-4">
          <legend className="px-1 text-sm font-semibold">
            실행 주기와 기한
          </legend>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-sm font-medium">
              주기
              <select
                className="min-h-11 rounded-control border border-border px-3"
                {...register("recurrenceType")}
              >
                {RECURRENCES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {recurrenceType === "WEEKLY" ? (
              <label className="grid gap-1 text-sm font-medium">
                요일
                <select
                  className="min-h-11 rounded-control border border-border px-3"
                  {...register("dayOfWeek")}
                >
                  {DAYS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {recurrenceType === "MONTHLY" ? (
              <label className="grid gap-1 text-sm font-medium">
                매월 실행일
                <input
                  className="min-h-11 rounded-control border border-border px-3"
                  max={31}
                  min={1}
                  type="number"
                  {...register("dayOfMonth", { valueAsNumber: true })}
                />
              </label>
            ) : null}
            {recurrenceType.startsWith("INTERVAL_") ? (
              <label className="grid gap-1 text-sm font-medium">
                반복 간격
                <input
                  className="min-h-11 rounded-control border border-border px-3"
                  min={1}
                  type="number"
                  {...register("interval", { valueAsNumber: true })}
                />
              </label>
            ) : null}
            <label className="grid gap-1 text-sm font-medium">
              시작일
              <input
                className="min-h-11 rounded-control border border-border px-3"
                type="date"
                {...register("startDate")}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              종료일(선택)
              <input
                className="min-h-11 rounded-control border border-border px-3"
                type="date"
                {...register("endDate")}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              호텔 현지 완료시각
              <input
                className="min-h-11 rounded-control border border-border px-3"
                type="time"
                {...register("localDueTime")}
              />
            </label>
          </div>
          {recurrenceType === "MONTHLY" ? (
            <p className="mt-3 text-xs text-muted">
              해당 날짜가 없는 달은 마지막 날로 당기지 않고 건너뜁니다.
            </p>
          ) : null}
        </fieldset>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">점검 대상 회차</h3>
            {mode === "ROTATING" ? (
              <Button
                className="min-h-11"
                onClick={() =>
                  rounds.append(emptyRound(rounds.fields.length + 1))
                }
                type="button"
                variant="secondary"
              >
                회차 추가
              </Button>
            ) : null}
          </div>
          {rounds.fields.map((field, index) => {
            const round = watchedRounds[index] ?? emptyRound(index + 1);
            return (
              <fieldset
                className="rounded-control border border-border p-4"
                key={field.id}
              >
                <legend className="px-1 text-sm font-semibold">
                  {index + 1}회차
                </legend>
                <div className="flex flex-col gap-3">
                  <label className="grid gap-1 text-sm font-medium sm:max-w-xs">
                    대상 유형
                    <select
                      className="min-h-11 rounded-control border border-border px-3"
                      {...register(`rounds.${index}.targetType`)}
                    >
                      <option value="HOTEL">호텔 전체</option>
                      <option value="FLOOR">층</option>
                      <option value="ROOM_TYPE">객실유형</option>
                      <option value="ROOMS">개별 객실</option>
                    </select>
                  </label>
                  {round.targetType === "FLOOR" ? (
                    <CheckboxGroup
                      label="층 선택"
                      options={floorOptions}
                      selected={round.floorLabels}
                      onChange={(next) =>
                        setValue(`rounds.${index}.floorLabels`, next, {
                          shouldDirty: true,
                        })
                      }
                    />
                  ) : null}
                  {round.targetType === "ROOM_TYPE" ? (
                    <CheckboxGroup
                      label="객실유형 선택"
                      options={roomTypeOptions}
                      selected={round.roomTypeIds}
                      onChange={(next) =>
                        setValue(`rounds.${index}.roomTypeIds`, next, {
                          shouldDirty: true,
                        })
                      }
                    />
                  ) : null}
                  {round.targetType === "ROOMS" ? (
                    <CheckboxGroup
                      label="객실 선택"
                      options={roomOptions}
                      selected={round.roomIds}
                      onChange={(next) =>
                        setValue(`rounds.${index}.roomIds`, next, {
                          shouldDirty: true,
                        })
                      }
                    />
                  ) : null}
                  {mode === "ROTATING" && rounds.fields.length > 2 ? (
                    <Button
                      className="min-h-11 self-start"
                      onClick={() => rounds.remove(index)}
                      type="button"
                      variant="ghost"
                    >
                      회차 삭제
                    </Button>
                  ) : null}
                </div>
              </fieldset>
            );
          })}
        </div>

        <input
          type="hidden"
          {...register("version", { valueAsNumber: true })}
        />
        {message ? (
          <p aria-live="polite" className="text-sm text-muted">
            {message}
          </p>
        ) : null}
        <Button
          className="min-h-11"
          disabled={saving || !checklistRevisionId}
          type="submit"
        >
          {saving ? "저장 중…" : selectedId ? "루틴 수정 저장" : "루틴 생성"}
        </Button>
      </form>
    </section>
  );
}
