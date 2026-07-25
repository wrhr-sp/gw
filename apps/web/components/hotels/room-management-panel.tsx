"use client";

import {
  changeHotelRoomStatusRequestSchema,
  createHotelRoomRequestSchema,
  createHotelRoomTypeRequestSchema,
  hotelErrorResponseSchema,
  hotelRoomInternalListResponseSchema,
  hotelRoomInternalDetailResponseSchema,
  hotelRoomMutationResponseSchema,
  hotelRoomOwnerDetailResponseSchema,
  hotelRoomOwnerListResponseSchema,
  hotelRoomTypeListResponseSchema,
  hotelRoomTypeMutationResponseSchema,
  hotelRoutes,
  updateHotelRoomRequestSchema,
  updateHotelRoomTypeRequestSchema,
  type HotelRoomInternal,
  type HotelRoomOwner,
  type HotelRoomStatus,
  type HotelRoomType,
} from "@werehere/contracts";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  StatusBadge,
} from "@werehere/ui";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useForm } from "react-hook-form";
import type {
  RoomInitialData,
  RoomInitialFailure,
} from "../../lib/server-rooms";

type Room = HotelRoomInternal | HotelRoomOwner;
type DialogState =
  | { kind: "room"; room?: Room }
  | { kind: "status"; room: Room }
  | { kind: "type"; roomType?: HotelRoomType }
  | null;
type RequestFailure = {
  code: string;
  message: string;
  fieldErrors: Array<{ field: string; message: string }>;
};
const inputClass =
  "mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const textareaClass =
  "mt-1 min-h-24 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const statusPresentation: Record<
  HotelRoomStatus,
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  ACTIVE: { label: "운영중", tone: "success" },
  TEMP_SUSPENDED: { label: "일시중지", tone: "warning" },
  OUT_OF_SERVICE: { label: "운영제외", tone: "neutral" },
};

async function request(url: string, init?: RequestInit): Promise<unknown> {
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
    throw parsed.success
      ? parsed.data.error
      : ({
          code: "UNKNOWN",
          fieldErrors: [],
          message: "요청을 처리하지 못했습니다.",
        } satisfies RequestFailure);
  }
  return value;
}

function failureMessage(error: unknown) {
  const failure = error as Partial<RequestFailure>;
  if (failure.code === "VERSION_CONFLICT")
    return "다른 사용자가 먼저 변경했습니다. 최신 객실 정보를 다시 불러온 뒤 시도해 주세요.";
  if (failure.code === "IDEMPOTENCY_CONFLICT")
    return "같은 요청 키의 내용이 달라 처리하지 않았습니다. 다시 시도해 주세요.";
  return typeof failure.message === "string"
    ? failure.message
    : "요청을 처리하지 못했습니다.";
}

async function fetchLatestRoom(hotelId: string, roomId: string): Promise<Room> {
  const value = await request(hotelRoutes.room(hotelId, roomId));
  const internal = hotelRoomInternalDetailResponseSchema.safeParse(value);
  if (internal.success) return internal.data.data.room;
  return hotelRoomOwnerDetailResponseSchema.parse(value).data.room;
}

function requestFailure(error: unknown): RequestFailure {
  const candidate = error as Partial<RequestFailure>;
  return {
    code: typeof candidate.code === "string" ? candidate.code : "UNKNOWN",
    fieldErrors: Array.isArray(candidate.fieldErrors)
      ? candidate.fieldErrors
      : [],
    message: failureMessage(error),
  };
}

function fieldError(failure: RequestFailure | null, field: string) {
  return failure?.fieldErrors.find((item) => item.field === field);
}

function fieldErrorAttributes(
  failure: RequestFailure | null,
  field: string,
  errorId: string,
) {
  const invalid = Boolean(fieldError(failure, field));
  const describedBy = failure?.fieldErrors
    .map((error, index) => ({ error, index }))
    .filter(({ error }) => error.field === field)
    .map(({ index }) => `${errorId}-${field}-${index}`)
    .join(" ");
  return {
    "aria-describedby": describedBy || undefined,
    "aria-invalid": invalid,
  } as const;
}

function clearFieldError(
  setFailure: Dispatch<SetStateAction<RequestFailure | null>>,
  field: string,
) {
  setFailure((current) => {
    if (!current?.fieldErrors.some((item) => item.field === field))
      return current;
    const fieldErrors = current.fieldErrors.filter(
      (item) => item.field !== field,
    );
    return fieldErrors.length > 0 ? { ...current, fieldErrors } : null;
  });
}

function latestReadFailure(subject: string): RequestFailure {
  return {
    code: "LATEST_READ_FAILED",
    fieldErrors: [],
    message: `다른 사용자가 먼저 변경했지만 최신 ${subject} 정보를 다시 불러오지 못했습니다. 입력값은 유지했습니다. 최신정보를 다시 불러와 주세요.`,
  };
}

type RoomForm = {
  floorLabel: string;
  floorSortKey: number;
  internalNote: string;
  ownerVisibleNote: string;
  roomNumber: string;
  roomTypeId: string;
};
function RoomEditor({
  hotelId,
  onDone,
  room,
  roomTypes,
}: {
  hotelId: string;
  onDone: () => void;
  room?: Room | undefined;
  roomTypes: HotelRoomType[];
}) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [version, setVersion] = useState(room?.version);
  const [isRefreshingLatest, setIsRefreshingLatest] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const form = useForm<RoomForm>({
    defaultValues: {
      floorLabel: room?.floorLabel ?? "",
      floorSortKey: room?.floorSortKey ?? 1,
      internalNote:
        room && "internalNote" in room ? (room.internalNote ?? "") : "",
      ownerVisibleNote: room?.ownerVisibleNote ?? "",
      roomNumber: room?.roomNumber ?? "",
      roomTypeId: room?.roomType.id ?? "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (value: RoomForm) => {
      const body = {
        ...value,
        floorSortKey: Number(value.floorSortKey),
        internalNote: value.internalNote.trim() || null,
        ownerVisibleNote: value.ownerVisibleNote.trim() || null,
        ...(room ? { version } : {}),
      };
      const schema = room
        ? updateHotelRoomRequestSchema
        : createHotelRoomRequestSchema;
      const parsed = schema.safeParse(body);
      if (!parsed.success)
        throw {
          code: "VALIDATION_ERROR",
          fieldErrors: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ""),
            message: issue.message,
          })),
          message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
        } satisfies RequestFailure;
      const response = await request(
        room ? hotelRoutes.room(hotelId, room.id) : hotelRoutes.rooms(hotelId),
        {
          method: room ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify(parsed.data),
        },
      );
      return hotelRoomMutationResponseSchema.parse(response).data.room;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["hotel-rooms", hotelId] });
      onDone();
    },
    onError: async (error) => {
      const next = requestFailure(error);
      if (next.code === "VERSION_CONFLICT" && room) {
        try {
          const [latest] = await Promise.all([
            fetchLatestRoom(hotelId, room.id),
            client.refetchQueries({ queryKey: ["hotel-room-types", hotelId] }),
          ]);
          setVersion(latest.version);
          next.message =
            "다른 사용자가 먼저 변경했습니다. 최신 객실 정보를 불러왔습니다. 입력값을 확인한 뒤 다시 저장해 주세요.";
        } catch {
          setVersion(undefined);
          setFailure(latestReadFailure("객실"));
          return;
        }
      }
      setFailure(next);
    },
  });
  const refreshLatest = async () => {
    if (!room) return;
    setIsRefreshingLatest(true);
    try {
      const [latest] = await Promise.all([
        fetchLatestRoom(hotelId, room.id),
        client.refetchQueries({ queryKey: ["hotel-room-types", hotelId] }),
      ]);
      setVersion(latest.version);
      setFailure(null);
    } catch {
      setFailure(latestReadFailure("객실"));
    } finally {
      setIsRefreshingLatest(false);
    }
  };
  useEffect(() => {
    if (!failure) return;
    const field = failure.fieldErrors[0]?.field as keyof RoomForm | undefined;
    if (field && Object.hasOwn(form.getValues(), field)) form.setFocus(field);
    else errorRef.current?.focus();
  }, [failure, form]);
  return (
    <form
      className="flex max-h-[calc(88dvh-8rem)] min-h-0 flex-col md:max-h-[calc(88dvh-3rem)]"
      noValidate
      onSubmit={form.handleSubmit((value) => {
        setFailure(null);
        mutation.mutate(value);
      })}
    >
      <h3 className="text-lg font-semibold text-text">
        {room ? `${room.roomNumber} 객실 수정` : "객실 등록"}
      </h3>
      {failure ? (
        <div
          className="mt-3 rounded-control bg-red-50 p-3 text-sm text-red-700"
          id="room-editor-error"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {failure.message}
          {failure.fieldErrors.map((error, index) => (
            <p
              className="mt-1"
              id={`room-editor-error-${error.field}-${index}`}
              key={`${error.field}-${index}`}
            >
              {error.message}
            </p>
          ))}
          {failure.code === "LATEST_READ_FAILED" ? (
            <Button
              className="mt-3"
              disabled={isRefreshingLatest}
              onClick={() => void refreshLatest()}
              type="button"
              variant="secondary"
            >
              최신정보 다시 불러오기
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 grid min-h-0 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
        <label className="text-sm font-semibold text-text">
          객실번호
          <input
            className={inputClass}
            {...fieldErrorAttributes(
              failure,
              "roomNumber",
              "room-editor-error",
            )}
            {...form.register("roomNumber", {
              onChange: () => clearFieldError(setFailure, "roomNumber"),
            })}
          />
        </label>
        <label className="text-sm font-semibold text-text">
          객실유형
          <select
            className={inputClass}
            {...fieldErrorAttributes(
              failure,
              "roomTypeId",
              "room-editor-error",
            )}
            {...form.register("roomTypeId", {
              onChange: () => clearFieldError(setFailure, "roomTypeId"),
            })}
          >
            <option value="">선택</option>
            {roomTypes
              .filter((type) => type.isActive || type.id === room?.roomType.id)
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ·{" "}
                  {type.scope === "COMPANY" ? "회사공통" : "호텔전용"}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-text">
          층 표시
          <input
            className={inputClass}
            {...fieldErrorAttributes(
              failure,
              "floorLabel",
              "room-editor-error",
            )}
            {...form.register("floorLabel", {
              onChange: () => clearFieldError(setFailure, "floorLabel"),
            })}
          />
        </label>
        <label className="text-sm font-semibold text-text">
          층 정렬순서
          <input
            className={inputClass}
            inputMode="numeric"
            type="number"
            {...fieldErrorAttributes(
              failure,
              "floorSortKey",
              "room-editor-error",
            )}
            {...form.register("floorSortKey", {
              onChange: () => clearFieldError(setFailure, "floorSortKey"),
              valueAsNumber: true,
            })}
          />
        </label>
        <label className="text-sm font-semibold text-text sm:col-span-2">
          소유주 공개 메모
          <textarea
            className={textareaClass}
            {...fieldErrorAttributes(
              failure,
              "ownerVisibleNote",
              "room-editor-error",
            )}
            {...form.register("ownerVisibleNote", {
              onChange: () => clearFieldError(setFailure, "ownerVisibleNote"),
            })}
          />
        </label>
        <label className="text-sm font-semibold text-text sm:col-span-2">
          내부 메모
          <textarea
            className={textareaClass}
            {...fieldErrorAttributes(
              failure,
              "internalNote",
              "room-editor-error",
            )}
            {...form.register("internalNote", {
              onChange: () => clearFieldError(setFailure, "internalNote"),
            })}
          />
        </label>
      </div>
      <div className="mt-5 shrink-0 border-t border-border bg-surface pt-3">
        <Button
          className="min-h-11 w-full md:w-auto"
          disabled={
            mutation.isPending || (Boolean(room) && version === undefined)
          }
          type="submit"
        >
          {mutation.isPending ? "저장 중" : "저장"}
        </Button>
      </div>
    </form>
  );
}

type StatusForm = {
  plannedResumeDate: string;
  reason: string;
  status: HotelRoomStatus;
};
function StatusEditor({
  hotelId,
  onDone,
  room,
}: {
  hotelId: string;
  onDone: () => void;
  room: Room;
}) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [version, setVersion] = useState<number | undefined>(room.version);
  const [isRefreshingLatest, setIsRefreshingLatest] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const form = useForm<StatusForm>({
    defaultValues: {
      plannedResumeDate: room.plannedResumeDate ?? "",
      reason: "",
      status: room.status,
    },
  });
  const mutation = useMutation({
    mutationFn: async (value: StatusForm) => {
      const parsed = changeHotelRoomStatusRequestSchema.safeParse({
        ...value,
        plannedResumeDate:
          value.status === "ACTIVE" ? null : value.plannedResumeDate || null,
        version,
      });
      if (!parsed.success)
        throw {
          code: "VALIDATION_ERROR",
          fieldErrors: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ""),
            message: issue.message,
          })),
          message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
        } satisfies RequestFailure;
      return hotelRoomMutationResponseSchema.parse(
        await request(hotelRoutes.roomStatus(hotelId, room.id), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify(parsed.data),
        }),
      ).data.room;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["hotel-rooms", hotelId] });
      onDone();
    },
    onError: async (error) => {
      const next = requestFailure(error);
      if (next.code === "VERSION_CONFLICT") {
        try {
          const latest = await fetchLatestRoom(hotelId, room.id);
          setVersion(latest.version);
          next.message =
            "다른 사용자가 먼저 변경했습니다. 최신 객실 정보를 불러왔습니다. 입력값을 확인한 뒤 다시 저장해 주세요.";
        } catch {
          setVersion(undefined);
          setFailure(latestReadFailure("객실"));
          return;
        }
      }
      setFailure(next);
    },
  });
  const refreshLatest = async () => {
    setIsRefreshingLatest(true);
    try {
      const latest = await fetchLatestRoom(hotelId, room.id);
      setVersion(latest.version);
      setFailure(null);
    } catch {
      setFailure(latestReadFailure("객실"));
    } finally {
      setIsRefreshingLatest(false);
    }
  };
  useEffect(() => {
    if (!failure) return;
    const field = failure.fieldErrors[0]?.field as keyof StatusForm | undefined;
    if (field && Object.hasOwn(form.getValues(), field)) form.setFocus(field);
    else errorRef.current?.focus();
  }, [failure, form]);
  const status = form.watch("status");
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        setFailure(null);
        mutation.mutate(value);
      })}
    >
      <h3 className="text-lg font-semibold text-text">
        {room.roomNumber} 운영상태 변경
      </h3>
      {failure ? (
        <div
          className="mt-3 rounded-control bg-red-50 p-3 text-sm text-red-700"
          id="status-editor-error"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {failure.message}
          {failure.fieldErrors.map((error, index) => (
            <p
              className="mt-1"
              id={`status-editor-error-${error.field}-${index}`}
              key={`${error.field}-${index}`}
            >
              {error.message}
            </p>
          ))}
          {failure.code === "LATEST_READ_FAILED" ? (
            <Button
              className="mt-3"
              disabled={isRefreshingLatest}
              onClick={() => void refreshLatest()}
              type="button"
              variant="secondary"
            >
              최신정보 다시 불러오기
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 grid gap-4">
        <label className="text-sm font-semibold text-text">
          변경할 상태
          <select
            className={inputClass}
            {...fieldErrorAttributes(failure, "status", "status-editor-error")}
            {...form.register("status", {
              onChange: () => clearFieldError(setFailure, "status"),
            })}
          >
            <option value="ACTIVE">운영중</option>
            <option value="TEMP_SUSPENDED">일시중지</option>
            <option value="OUT_OF_SERVICE">운영제외</option>
          </select>
        </label>
        {status !== "ACTIVE" ? (
          <label className="text-sm font-semibold text-text">
            재개 예정일
            <input
              className={inputClass}
              type="date"
              {...fieldErrorAttributes(
                failure,
                "plannedResumeDate",
                "status-editor-error",
              )}
              {...form.register("plannedResumeDate", {
                onChange: () =>
                  clearFieldError(setFailure, "plannedResumeDate"),
              })}
            />
          </label>
        ) : null}
        <label className="text-sm font-semibold text-text">
          변경 사유
          <textarea
            className={textareaClass}
            {...fieldErrorAttributes(failure, "reason", "status-editor-error")}
            {...form.register("reason", {
              onChange: () => clearFieldError(setFailure, "reason"),
            })}
          />
        </label>
      </div>
      <Button
        className="mt-5 min-h-11 w-full md:w-auto"
        disabled={mutation.isPending || version === undefined}
        type="submit"
      >
        상태 저장
      </Button>
    </form>
  );
}

type TypeForm = {
  displayOrder: number;
  isActive: boolean;
  name: string;
  scope: "COMPANY" | "HOTEL";
};
function TypeEditor({
  hotelId,
  onDone,
  roomType,
}: {
  hotelId: string;
  onDone: () => void;
  roomType?: HotelRoomType | undefined;
}) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [version, setVersion] = useState(roomType?.version);
  const [isRefreshingLatest, setIsRefreshingLatest] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const form = useForm<TypeForm>({
    defaultValues: {
      displayOrder: roomType?.displayOrder ?? 10,
      isActive: roomType?.isActive ?? true,
      name: roomType?.name ?? "",
      scope: roomType?.scope ?? "HOTEL",
    },
  });
  const mutation = useMutation({
    mutationFn: async (value: TypeForm) => {
      const candidate = roomType
        ? {
            displayOrder: Number(value.displayOrder),
            isActive: value.isActive,
            name: value.name,
            version,
          }
        : { ...value, displayOrder: Number(value.displayOrder) };
      const parsed = (
        roomType
          ? updateHotelRoomTypeRequestSchema
          : createHotelRoomTypeRequestSchema
      ).safeParse(candidate);
      if (!parsed.success)
        throw {
          code: "VALIDATION_ERROR",
          fieldErrors: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ""),
            message: issue.message,
          })),
          message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
        } satisfies RequestFailure;
      return hotelRoomTypeMutationResponseSchema.parse(
        await request(
          roomType
            ? hotelRoutes.roomType(hotelId, roomType.id)
            : hotelRoutes.roomTypes(hotelId),
          {
            method: roomType ? "PATCH" : "POST",
            headers: {
              "content-type": "application/json",
              "idempotency-key": crypto.randomUUID(),
            },
            body: JSON.stringify(parsed.data),
          },
        ),
      ).data.roomType;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["hotel-room-types", hotelId] }),
        client.invalidateQueries({ queryKey: ["hotel-rooms", hotelId] }),
      ]);
      onDone();
    },
    onError: async (error) => {
      const next = requestFailure(error);
      if (next.code === "VERSION_CONFLICT" && roomType) {
        try {
          const refreshed = hotelRoomTypeListResponseSchema.parse(
            await request(hotelRoutes.roomTypes(hotelId)),
          ).data.roomTypes;
          client.setQueryData(["hotel-room-types", hotelId], refreshed);
          const latest = refreshed.find((item) => item.id === roomType.id);
          if (!latest) throw new Error("latest room type missing");
          setVersion(latest.version);
          next.message =
            "다른 사용자가 먼저 변경했습니다. 최신 객실유형 정보를 불러왔습니다. 입력값을 확인한 뒤 다시 저장해 주세요.";
        } catch {
          setVersion(undefined);
          setFailure(latestReadFailure("객실유형"));
          return;
        }
      }
      setFailure(next);
    },
  });
  const refreshLatest = async () => {
    if (!roomType) return;
    setIsRefreshingLatest(true);
    try {
      const refreshed = hotelRoomTypeListResponseSchema.parse(
        await request(hotelRoutes.roomTypes(hotelId)),
      ).data.roomTypes;
      client.setQueryData(["hotel-room-types", hotelId], refreshed);
      const latest = refreshed.find((item) => item.id === roomType.id);
      if (!latest) throw new Error("latest room type missing");
      setVersion(latest.version);
      setFailure(null);
    } catch {
      setFailure(latestReadFailure("객실유형"));
    } finally {
      setIsRefreshingLatest(false);
    }
  };
  useEffect(() => {
    if (!failure) return;
    const field = failure.fieldErrors[0]?.field as keyof TypeForm | undefined;
    if (field && Object.hasOwn(form.getValues(), field)) form.setFocus(field);
    else errorRef.current?.focus();
  }, [failure, form]);
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        setFailure(null);
        mutation.mutate(value);
      })}
    >
      <h3 className="text-lg font-semibold text-text">
        {roomType ? "객실유형 수정" : "객실유형 등록"}
      </h3>
      {failure ? (
        <div
          className="mt-3 rounded-control bg-red-50 p-3 text-sm text-red-700"
          id="type-editor-error"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {failure.message}
          {failure.fieldErrors.map((error, index) => (
            <p
              className="mt-1"
              id={`type-editor-error-${error.field}-${index}`}
              key={`${error.field}-${index}`}
            >
              {error.message}
            </p>
          ))}
          {failure.code === "LATEST_READ_FAILED" ? (
            <Button
              className="mt-3"
              disabled={isRefreshingLatest}
              onClick={() => void refreshLatest()}
              type="button"
              variant="secondary"
            >
              최신정보 다시 불러오기
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-text sm:col-span-2">
          유형명
          <input
            className={inputClass}
            {...fieldErrorAttributes(failure, "name", "type-editor-error")}
            {...form.register("name", {
              onChange: () => clearFieldError(setFailure, "name"),
            })}
          />
        </label>
        <label className="text-sm font-semibold text-text">
          적용범위
          <select
            className={inputClass}
            disabled={Boolean(roomType)}
            {...fieldErrorAttributes(failure, "scope", "type-editor-error")}
            {...form.register("scope", {
              onChange: () => clearFieldError(setFailure, "scope"),
            })}
          >
            <option value="HOTEL">현재 호텔</option>
            <option value="COMPANY">회사 공통</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-text">
          정렬순서
          <input
            className={inputClass}
            type="number"
            {...fieldErrorAttributes(
              failure,
              "displayOrder",
              "type-editor-error",
            )}
            {...form.register("displayOrder", {
              onChange: () => clearFieldError(setFailure, "displayOrder"),
              valueAsNumber: true,
            })}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-text sm:col-span-2">
          <input
            type="checkbox"
            {...fieldErrorAttributes(failure, "isActive", "type-editor-error")}
            {...form.register("isActive", {
              onChange: () => clearFieldError(setFailure, "isActive"),
            })}
          />{" "}
          사용
        </label>
      </div>
      <Button
        className="mt-5 min-h-11 w-full md:w-auto"
        disabled={
          mutation.isPending || (Boolean(roomType) && version === undefined)
        }
        type="submit"
      >
        유형 저장
      </Button>
    </form>
  );
}

function RoomManagementContent({
  hotelId,
  initialData,
  initialFailure,
}: {
  hotelId: string;
  initialData?: RoomInitialData | undefined;
  initialFailure?: RoomInitialFailure | undefined;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [initialFailureVisible, setInitialFailureVisible] = useState(
    Boolean(initialFailure),
  );
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fallbackFocusRef = useRef<HTMLHeadingElement>(null);
  const isInitialRoomQuery = q.trim() === "" && page === 1;
  const roomsQuery = useQuery({
    queryKey: ["hotel-rooms", hotelId, q.trim(), page],
    initialData:
      initialData && isInitialRoomQuery
        ? {
            capabilities: initialData.capabilities,
            pagination: initialData.pagination,
            rooms: initialData.rooms,
          }
        : undefined,
    queryFn: async () => {
      const search = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (q.trim()) search.set("q", q.trim());
      const value = await request(`${hotelRoutes.rooms(hotelId)}?${search}`);
      const internal = hotelRoomInternalListResponseSchema.safeParse(value);
      const external = hotelRoomOwnerListResponseSchema.safeParse(value);
      if (internal.success) return internal.data.data;
      if (external.success) return external.data.data;
      throw new Error("객실 목록 응답이 올바르지 않습니다.");
    },
  });
  const typesQuery = useQuery({
    queryKey: ["hotel-room-types", hotelId],
    initialData: initialData?.roomTypes,
    queryFn: async () =>
      hotelRoomTypeListResponseSchema.parse(
        await request(hotelRoutes.roomTypes(hotelId)),
      ).data.roomTypes,
  });
  const rooms = roomsQuery.data?.rooms ?? [];
  const pagination = roomsQuery.data?.pagination;
  const capabilities = roomsQuery.data?.capabilities ?? {
    canManage: false,
    canManageTypes: false,
  };
  const open = (next: NonNullable<DialogState>, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setDialog(next);
  };
  const close = () => setDialog(null);
  useEffect(() => {
    if (roomsQuery.isSuccess && typesQuery.isSuccess)
      setInitialFailureVisible(false);
  }, [roomsQuery.isSuccess, typesQuery.isSuccess]);
  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && page > pagination.totalPages)
      setPage(pagination.totalPages);
  }, [page, pagination]);
  return (
    <section
      aria-labelledby="hotel-rooms-title"
      className="rounded-panel border border-border bg-surface p-5 md:p-6"
      id="hotel-room-management"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            className="text-lg font-semibold text-text"
            id="hotel-rooms-title"
            ref={fallbackFocusRef}
            tabIndex={-1}
          >
            객실관리
          </h2>
          <p className="mt-1 text-sm text-muted">
            객실번호·유형·운영상태를 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {capabilities.canManageTypes ? (
            <Button
              className="min-h-11"
              onClick={(event) => open({ kind: "type" }, event.currentTarget)}
              type="button"
              variant="secondary"
            >
              객실유형 관리
            </Button>
          ) : null}
          {capabilities.canManage ? (
            <Button
              className="min-h-11"
              onClick={(event) => open({ kind: "room" }, event.currentTarget)}
              type="button"
            >
              객실 등록
            </Button>
          ) : null}
        </div>
      </div>
      {initialFailureVisible && initialFailure ? (
        <div
          className="mt-5 rounded-control border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-800">
            객실 정보를 불러오지 못했습니다
          </p>
          <p className="mt-1 text-sm text-red-700">{initialFailure.message}</p>
          <Button
            className="mt-3"
            onClick={async () => {
              const [roomsResult, typesResult] = await Promise.all([
                roomsQuery.refetch(),
                typesQuery.refetch(),
              ]);
              if (roomsResult.isSuccess && typesResult.isSuccess)
                setInitialFailureVisible(false);
            }}
            type="button"
            variant="secondary"
          >
            다시 시도
          </Button>
        </div>
      ) : null}
      <FilterBar>
        <label className="text-sm font-semibold text-text">
          객실 검색
          <input
            aria-label="객실 검색"
            className={`${inputClass} md:max-w-sm`}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="객실번호, 층, 객실유형"
            value={q}
          />
        </label>
      </FilterBar>
      {roomsQuery.isLoading ? (
        <p className="mt-5 text-sm text-muted" role="status">
          객실을 불러오는 중입니다.
        </p>
      ) : roomsQuery.isError ? (
        <p className="mt-5 text-sm text-red-700" role="alert">
          객실 목록을 불러오지 못했습니다.
        </p>
      ) : rooms.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description={
              q
                ? "검색어를 바꿔 다시 확인해 주세요."
                : "등록 권한이 있으면 새 객실을 등록할 수 있습니다."
            }
            title={
              q ? "검색 조건에 맞는 객실이 없습니다" : "등록된 객실이 없습니다"
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 hidden md:block">
            <DataTable label="객실 목록">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-canvas text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3">객실번호</th>
                    <th className="px-4 py-3">층</th>
                    <th className="px-4 py-3">객실유형</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">공개 메모</th>
                    {capabilities.canManage ? (
                      <th className="px-4 py-3 text-right">작업</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr className="border-t border-border" key={room.id}>
                      <td className="px-4 py-3 font-semibold text-text">
                        {room.roomNumber}
                      </td>
                      <td className="px-4 py-3 text-text">{room.floorLabel}</td>
                      <td className="px-4 py-3 text-text">
                        {room.roomType.name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          tone={statusPresentation[room.status].tone}
                        >
                          {statusPresentation[room.status].label}
                        </StatusBadge>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-muted">
                        {room.ownerVisibleNote || "없음"}
                      </td>
                      {capabilities.canManage ? (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={(event) =>
                                open(
                                  { kind: "room", room },
                                  event.currentTarget,
                                )
                              }
                              type="button"
                              variant="secondary"
                            >
                              수정
                            </Button>
                            <Button
                              onClick={(event) =>
                                open(
                                  { kind: "status", room },
                                  event.currentTarget,
                                )
                              }
                              type="button"
                              variant="secondary"
                            >
                              상태변경
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
          <div className="mt-5 grid gap-2 md:hidden">
            {rooms.map((room) => (
              <article
                className="rounded-mobile border border-border bg-surface p-4"
                key={room.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text">
                      {room.roomNumber}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {room.floorLabel} · {room.roomType.name}
                    </p>
                  </div>
                  <StatusBadge tone={statusPresentation[room.status].tone}>
                    {statusPresentation[room.status].label}
                  </StatusBadge>
                </div>
                {room.ownerVisibleNote ? (
                  <p className="mt-3 text-sm text-text">
                    {room.ownerVisibleNote}
                  </p>
                ) : null}
                {capabilities.canManage ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      className="min-h-11"
                      onClick={(event) =>
                        open({ kind: "room", room }, event.currentTarget)
                      }
                      type="button"
                      variant="secondary"
                    >
                      수정
                    </Button>
                    <Button
                      className="min-h-11"
                      onClick={(event) =>
                        open({ kind: "status", room }, event.currentTarget)
                      }
                      type="button"
                      variant="secondary"
                    >
                      상태변경
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
      {!roomsQuery.isLoading && !roomsQuery.isError && pagination ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p aria-live="polite">
            현재 {pagination.page} / {Math.max(pagination.totalPages, 1)} 페이지
            · 총 {pagination.total}개
          </p>
          <div className="flex gap-2">
            <Button
              className="min-h-11"
              disabled={page <= 1 || roomsQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
              variant="secondary"
            >
              이전 페이지
            </Button>
            <Button
              className="min-h-11"
              disabled={
                page >= pagination.totalPages ||
                pagination.totalPages === 0 ||
                roomsQuery.isFetching
              }
              onClick={() => setPage((current) => current + 1)}
              type="button"
              variant="secondary"
            >
              다음 페이지
            </Button>
          </div>
        </div>
      ) : null}
      {capabilities.canManageTypes && typesQuery.data?.length ? (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-text">객실유형</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {typesQuery.data.map((type) => (
              <button
                className="min-h-11 rounded-control border border-border px-3 text-sm font-semibold text-text hover:border-primary"
                key={type.id}
                onClick={(event) =>
                  open({ kind: "type", roomType: type }, event.currentTarget)
                }
                type="button"
              >
                {type.name} ·{" "}
                {type.scope === "COMPANY" ? "회사공통" : "호텔전용"} ·{" "}
                {type.isActive ? "사용" : "중지"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <Dialog
        fallbackFocusRef={fallbackFocusRef}
        closeLabel="객실 관리 대화상자 닫기"
        className={
          dialog?.kind === "room"
            ? "bottom-20 max-h-[calc(88dvh-5rem)] overflow-hidden rounded-panel md:max-h-[88dvh]"
            : "bottom-20 max-h-[calc(88dvh-5rem)] rounded-panel md:max-h-[88dvh]"
        }
        onOpenChange={(open) => {
          if (!open) close();
        }}
        open={dialog !== null}
        restoreFocusRef={triggerRef}
        title={
          dialog?.kind === "room"
            ? "객실 정보"
            : dialog?.kind === "status"
              ? "객실 운영상태"
              : "객실유형"
        }
      >
        {dialog?.kind === "room" ? (
          <RoomEditor
            hotelId={hotelId}
            onDone={close}
            room={dialog.room}
            roomTypes={typesQuery.data ?? []}
          />
        ) : dialog?.kind === "status" ? (
          <StatusEditor hotelId={hotelId} onDone={close} room={dialog.room} />
        ) : dialog?.kind === "type" ? (
          <TypeEditor
            hotelId={hotelId}
            onDone={close}
            roomType={dialog.roomType}
          />
        ) : null}
      </Dialog>
    </section>
  );
}

export function RoomManagementPanel(props: {
  hotelId: string;
  initialData?: RoomInitialData | undefined;
  initialFailure?: RoomInitialFailure | undefined;
}) {
  const [client] = useState(
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
    <QueryClientProvider client={client}>
      <RoomManagementContent {...props} />
    </QueryClientProvider>
  );
}
