"use client";

import {
  changeHotelFacilityReferenceStatusRequestSchema,
  createHotelCommonAreaRequestSchema,
  createHotelFacilityRequestSchema,
  createHotelFacilityTypeRequestSchema,
  deleteHotelFacilityReferenceRequestSchema,
  hotelErrorResponseSchema,
  hotelFacilityMutationResponseSchema,
  hotelFacilityWorkspaceResponseSchema,
  hotelRoutes,
  updateHotelFacilityReferenceRequestSchema,
  updateHotelFacilityRequestSchema,
  type HotelCommonArea,
  type HotelFacility,
  type HotelFacilityReferenceStatus,
  type HotelFacilityType,
} from "@werehere/contracts";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  StatusBadge,
} from "@werehere/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type {
  FacilityInitialData,
  FacilityInitialFailure,
} from "../../lib/server-facilities";

type Tab = "FACILITY" | "COMMON_AREA" | "FACILITY_TYPE";
const facilityTabs: Tab[] = ["FACILITY", "COMMON_AREA", "FACILITY_TYPE"];
type Reference = HotelCommonArea | HotelFacilityType;
type DialogState =
  | { kind: "facility"; resource?: HotelFacility }
  | {
      kind: "reference";
      entity: "COMMON_AREA" | "FACILITY_TYPE";
      resource?: Reference;
    }
  | {
      kind: "lifecycle";
      entity: Tab;
      resource: HotelFacility | Reference;
      action: "STATUS" | "DELETE";
    }
  | null;
type RequestFailure = {
  code: string;
  message: string;
  fieldErrors: Array<{ field: string; message: string }>;
};
function isFacility(
  resource: HotelFacility | Reference,
): resource is HotelFacility {
  return "location" in resource;
}
const inputClass =
  "mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const textareaClass =
  "mt-1 min-h-24 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const statusPresentation: Record<
  HotelFacilityReferenceStatus,
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  ACTIVE: { label: "활성", tone: "success" },
  INACTIVE: { label: "사용중지", tone: "warning" },
  DELETED: { label: "삭제", tone: "neutral" },
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
function asFailure(error: unknown): RequestFailure {
  const value = error as Partial<RequestFailure>;
  return {
    code: typeof value.code === "string" ? value.code : "UNKNOWN",
    message:
      typeof value.message === "string"
        ? value.message
        : "요청을 처리하지 못했습니다.",
    fieldErrors: Array.isArray(value.fieldErrors) ? value.fieldErrors : [],
  };
}
function fieldMessage(failure: RequestFailure | null, field: string) {
  return failure?.fieldErrors.find((item) => item.field === field)?.message;
}
type OperationIdentity = { key: string; signature: string };
function useOperationIdentity() {
  const identity = useRef<OperationIdentity | null>(null);
  return {
    clear() {
      identity.current = null;
    },
    headers(url: string, method: string, body: string) {
      const signature = `${method}\n${url}\n${body}`;
      if (identity.current?.signature !== signature) {
        identity.current = { key: crypto.randomUUID(), signature };
      }
      return {
        "content-type": "application/json",
        "idempotency-key": identity.current.key,
      };
    },
  };
}
function facilityDetailRoute(hotelId: string, entity: Tab, resourceId: string) {
  return entity === "FACILITY"
    ? hotelRoutes.facility(hotelId, resourceId)
    : referenceRoute(hotelId, entity, resourceId);
}
async function readCanonicalResource(
  hotelId: string,
  entity: Tab,
  resourceId: string,
) {
  return hotelFacilityMutationResponseSchema.parse(
    await request(facilityDetailRoute(hotelId, entity, resourceId)),
  ).data.resource;
}
function assertMaterialReadback(
  receipt: HotelFacility | Reference,
  canonical: HotelFacility | Reference,
) {
  if (JSON.stringify(receipt) !== JSON.stringify(canonical)) {
    throw {
      code: "READBACK_MISMATCH",
      fieldErrors: [],
      message:
        "저장 결과를 정본에서 확인하지 못했습니다. 입력값을 유지했으니 다시 시도해 주세요.",
    } satisfies RequestFailure;
  }
}
function referenceRoute(
  hotelId: string,
  entity: "COMMON_AREA" | "FACILITY_TYPE",
  id?: string,
) {
  return entity === "COMMON_AREA"
    ? id
      ? hotelRoutes.commonArea(hotelId, id)
      : hotelRoutes.commonAreas(hotelId)
    : id
      ? hotelRoutes.facilityType(hotelId, id)
      : hotelRoutes.facilityTypes(hotelId);
}

function ErrorBox({
  alertRef,
  failure,
  id,
}: {
  alertRef?: React.RefObject<HTMLDivElement | null>;
  failure: RequestFailure | null;
  id: string;
}) {
  return failure ? (
    <div
      className="mt-3 rounded-control bg-red-50 p-3 text-sm text-red-700"
      id={id}
      ref={alertRef}
      role="alert"
      tabIndex={-1}
    >
      <p>{failure.message}</p>
      {failure.fieldErrors.map((item, index) => (
        <p className="mt-1" key={`${item.field}-${index}`}>
          {item.message}
        </p>
      ))}
    </div>
  ) : null;
}

function ReferenceEditor({
  entity,
  hotelId,
  onDone,
  resource,
}: {
  entity: "COMMON_AREA" | "FACILITY_TYPE";
  hotelId: string;
  onDone: () => void;
  resource?: Reference | undefined;
}) {
  const client = useQueryClient();
  const [currentResource, setCurrentResource] = useState(resource);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const operation = useOperationIdentity();
  const form = useForm<{ name: string }>({
    defaultValues: { name: resource?.name ?? "" },
  });
  const mutation = useMutation({
    mutationFn: async (value: { name: string }) => {
      const schema = currentResource
        ? updateHotelFacilityReferenceRequestSchema
        : entity === "COMMON_AREA"
          ? createHotelCommonAreaRequestSchema
          : createHotelFacilityTypeRequestSchema;
      const parsed = schema.safeParse(
        currentResource
          ? { ...value, version: currentResource.version }
          : value,
      );
      if (!parsed.success)
        throw {
          code: "VALIDATION_ERROR",
          message: "입력값을 확인해 주세요.",
          fieldErrors: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? "name"),
            message: issue.message,
          })),
        };
      const url = referenceRoute(hotelId, entity, currentResource?.id);
      const method = currentResource ? "PATCH" : "POST";
      const body = JSON.stringify(parsed.data);
      const receipt = hotelFacilityMutationResponseSchema.parse(
        await request(url, {
          method,
          headers: operation.headers(url, method, body),
          body,
        }),
      ).data.resource;
      const canonical = await readCanonicalResource(
        hotelId,
        entity,
        receipt.id,
      );
      assertMaterialReadback(receipt, canonical);
      await client.refetchQueries(
        { queryKey: ["hotel-facilities", hotelId] },
        { throwOnError: true },
      );
      operation.clear();
      return canonical;
    },
    onSuccess: () => onDone(),
    onError: async (error) => {
      const next = asFailure(error);
      if (next.code === "VERSION_CONFLICT" && currentResource) {
        try {
          const latest = await readCanonicalResource(
            hotelId,
            entity,
            currentResource.id,
          );
          if (!isFacility(latest)) setCurrentResource(latest);
          next.message = `${next.message} 최신 버전을 반영했으니 입력값을 확인하고 다시 저장해 주세요.`;
        } catch {
          next.message = `${next.message} 최신 정보 재조회에도 실패했습니다.`;
        }
      }
      setFailure(next);
      const nameError =
        fieldMessage(next, "name") ??
        fieldMessage(
          next,
          entity === "COMMON_AREA" ? "commonAreaName" : "facilityTypeName",
        );
      if (nameError) {
        form.setError("name", { message: nameError, type: "server" });
        queueMicrotask(() => form.setFocus("name"));
      } else {
        queueMicrotask(() => alertRef.current?.focus());
      }
    },
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        setFailure(null);
        mutation.mutate(value);
      })}
    >
      <h3 className="text-lg font-semibold text-text">
        {entity === "COMMON_AREA" ? "공용공간" : "시설물유형"}{" "}
        {resource ? "수정" : "등록"}
      </h3>
      <ErrorBox
        alertRef={alertRef}
        failure={failure}
        id="facility-reference-errors"
      />
      <label className="mt-4 block text-sm font-semibold text-text">
        이름
        <input
          aria-describedby={failure ? "facility-reference-errors" : undefined}
          aria-invalid={Boolean(form.formState.errors.name)}
          autoFocus
          className={inputClass}
          maxLength={100}
          required
          {...form.register("name")}
        />
      </label>
      <Button
        className="mt-5 min-h-11 w-full md:w-auto"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? "저장 중" : "저장"}
      </Button>
    </form>
  );
}

type FacilityForm = {
  name: string;
  facilityTypeId: string;
  locationType: "ROOM" | "COMMON_AREA";
  roomId: string;
  commonAreaId: string;
};
function FacilityEditor({
  commonAreas,
  facilityTypes,
  hotelId,
  onDone,
  resource,
  roomLocations,
}: {
  commonAreas: HotelCommonArea[];
  facilityTypes: HotelFacilityType[];
  hotelId: string;
  onDone: () => void;
  resource?: HotelFacility | undefined;
  roomLocations: Array<{ id: string; name: string }>;
}) {
  const client = useQueryClient();
  const [currentResource, setCurrentResource] = useState(resource);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const operation = useOperationIdentity();
  const form = useForm<FacilityForm>({
    defaultValues: {
      name: resource?.name ?? "",
      facilityTypeId:
        resource?.facilityType.id ??
        facilityTypes.find((item) => item.status === "ACTIVE")?.id ??
        "",
      locationType: resource?.location.type ?? "ROOM",
      roomId:
        resource?.location.type === "ROOM"
          ? resource.location.roomId
          : (roomLocations[0]?.id ?? ""),
      commonAreaId:
        resource?.location.type === "COMMON_AREA"
          ? resource.location.commonAreaId
          : (commonAreas.find((item) => item.status === "ACTIVE")?.id ?? ""),
    },
  });
  const locationType = form.watch("locationType");
  const mutation = useMutation({
    mutationFn: async (value: FacilityForm) => {
      const bodyValue = {
        name: value.name,
        facilityTypeId: value.facilityTypeId,
        location:
          value.locationType === "ROOM"
            ? { type: "ROOM" as const, roomId: value.roomId }
            : {
                type: "COMMON_AREA" as const,
                commonAreaId: value.commonAreaId,
              },
        ...(currentResource ? { version: currentResource.version } : {}),
      };
      const parsed = (
        currentResource
          ? updateHotelFacilityRequestSchema
          : createHotelFacilityRequestSchema
      ).safeParse(bodyValue);
      if (!parsed.success)
        throw {
          code: "VALIDATION_ERROR",
          message: "입력값을 확인해 주세요.",
          fieldErrors: parsed.error.issues.map((issue) => ({
            field: issue.path.map(String).join("."),
            message: issue.message,
          })),
        };
      const url = currentResource
        ? hotelRoutes.facility(hotelId, currentResource.id)
        : hotelRoutes.facilities(hotelId);
      const method = currentResource ? "PATCH" : "POST";
      const body = JSON.stringify(parsed.data);
      const receipt = hotelFacilityMutationResponseSchema.parse(
        await request(url, {
          method,
          headers: operation.headers(url, method, body),
          body,
        }),
      ).data.resource;
      const canonical = await readCanonicalResource(
        hotelId,
        "FACILITY",
        receipt.id,
      );
      assertMaterialReadback(receipt, canonical);
      await client.refetchQueries(
        { queryKey: ["hotel-facilities", hotelId] },
        { throwOnError: true },
      );
      operation.clear();
      return canonical;
    },
    onSuccess: () => onDone(),
    onError: async (error) => {
      const next = asFailure(error);
      if (next.code === "VERSION_CONFLICT" && currentResource) {
        try {
          const latest = await readCanonicalResource(
            hotelId,
            "FACILITY",
            currentResource.id,
          );
          if (isFacility(latest)) setCurrentResource(latest);
          next.message = `${next.message} 최신 버전을 반영했으니 입력값을 확인하고 다시 저장해 주세요.`;
        } catch {
          next.message = `${next.message} 최신 정보 재조회에도 실패했습니다.`;
        }
      }
      setFailure(next);
      const serverField = next.fieldErrors[0]?.field;
      const field =
        serverField === "facilityName" || serverField === "name"
          ? "name"
          : serverField === "facilityTypeId"
            ? "facilityTypeId"
            : serverField?.includes("roomId")
              ? "roomId"
              : serverField?.includes("commonAreaId")
                ? "commonAreaId"
                : null;
      if (field) {
        form.setError(field, {
          message: next.fieldErrors[0]?.message ?? next.message,
          type: "server",
        });
        queueMicrotask(() => form.setFocus(field));
      } else {
        queueMicrotask(() => alertRef.current?.focus());
      }
    },
  });
  const facilityTypeOptions = [
    ...facilityTypes,
    ...(currentResource &&
    !facilityTypes.some((item) => item.id === currentResource.facilityType.id)
      ? [currentResource.facilityType]
      : []),
  ];
  const currentRoomLocation: Extract<
    HotelFacility["location"],
    { type: "ROOM" }
  > | null =
    currentResource?.location.type === "ROOM" ? currentResource.location : null;
  const currentCommonAreaLocation: Extract<
    HotelFacility["location"],
    { type: "COMMON_AREA" }
  > | null =
    currentResource?.location.type === "COMMON_AREA"
      ? currentResource.location
      : null;
  const roomOptions = [
    ...roomLocations,
    ...(currentRoomLocation &&
    !roomLocations.some((item) => item.id === currentRoomLocation.roomId)
      ? [
          {
            id: currentRoomLocation.roomId,
            name: `${currentRoomLocation.name} (현재 위치 · 사용 불가)`,
          },
        ]
      : []),
  ];
  const commonAreaOptions = [
    ...commonAreas.map(({ id, name, status }) => ({ id, name, status })),
    ...(currentCommonAreaLocation &&
    !commonAreas.some(
      (item) => item.id === currentCommonAreaLocation.commonAreaId,
    )
      ? [
          {
            id: currentCommonAreaLocation.commonAreaId,
            name: `${currentCommonAreaLocation.name} (현재 위치 · 사용 불가)`,
            status: "DELETED" as const,
          },
        ]
      : []),
  ];
  const noTypes = !facilityTypes.some((item) => item.status === "ACTIVE");
  const noLocations =
    locationType === "ROOM"
      ? roomLocations.length === 0
      : !commonAreas.some((item) => item.status === "ACTIVE");
  const selectedReferenceUnavailable =
    !facilityTypes.some(
      (item) =>
        item.id === form.watch("facilityTypeId") && item.status === "ACTIVE",
    ) ||
    (locationType === "ROOM"
      ? !roomLocations.some((item) => item.id === form.watch("roomId"))
      : !commonAreas.some(
          (item) =>
            item.id === form.watch("commonAreaId") && item.status === "ACTIVE",
        ));
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        setFailure(null);
        mutation.mutate(value);
      })}
    >
      <h3 className="text-lg font-semibold text-text">
        시설물 {resource ? "수정" : "등록"}
      </h3>
      <ErrorBox
        alertRef={alertRef}
        failure={failure}
        id="facility-editor-errors"
      />
      {noTypes ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          활성 시설물유형을 먼저 등록해 주세요.
        </p>
      ) : selectedReferenceUnavailable ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          저장하려면 활성 시설물유형과 활성 설치위치를 선택해 주세요.
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-text sm:col-span-2">
          시설물명
          <input
            aria-describedby={failure ? "facility-editor-errors" : undefined}
            aria-invalid={Boolean(form.formState.errors.name)}
            autoFocus
            className={inputClass}
            maxLength={100}
            required
            {...form.register("name")}
          />
        </label>
        <label className="text-sm font-semibold text-text">
          시설물유형
          <select className={inputClass} {...form.register("facilityTypeId")}>
            {facilityTypeOptions
              .filter(
                (item) =>
                  item.status === "ACTIVE" ||
                  item.id === currentResource?.facilityType.id,
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-text">
          설치위치 종류
          <select className={inputClass} {...form.register("locationType")}>
            <option value="ROOM">객실</option>
            <option value="COMMON_AREA">공용공간</option>
          </select>
        </label>
        {locationType === "ROOM" ? (
          <label className="text-sm font-semibold text-text sm:col-span-2">
            객실
            <select className={inputClass} {...form.register("roomId")}>
              {roomOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-sm font-semibold text-text sm:col-span-2">
            공용공간
            <select className={inputClass} {...form.register("commonAreaId")}>
              {commonAreaOptions
                .filter(
                  (item) =>
                    item.status === "ACTIVE" ||
                    item.id ===
                      (currentResource?.location.type === "COMMON_AREA"
                        ? currentResource.location.commonAreaId
                        : ""),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <Button
        className="mt-5 min-h-11 w-full md:w-auto"
        disabled={
          mutation.isPending ||
          noTypes ||
          noLocations ||
          selectedReferenceUnavailable
        }
        type="submit"
      >
        {mutation.isPending ? "저장 중" : "저장"}
      </Button>
    </form>
  );
}

function LifecycleEditor({
  action,
  entity,
  hotelId,
  onDone,
  resource,
}: {
  action: "STATUS" | "DELETE";
  entity: Tab;
  hotelId: string;
  onDone: () => void;
  resource: HotelFacility | Reference;
}) {
  const client = useQueryClient();
  const [currentResource, setCurrentResource] = useState(resource);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const operation = useOperationIdentity();
  const form = useForm<{ reason: string; status: "ACTIVE" | "INACTIVE" }>({
    defaultValues: {
      reason: "",
      status: resource.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    },
  });
  const mutation = useMutation({
    mutationFn: async (value: {
      reason: string;
      status: "ACTIVE" | "INACTIVE";
    }) => {
      const bodyValue =
        action === "DELETE"
          ? { reason: value.reason, version: currentResource.version }
          : { ...value, version: currentResource.version };
      const parsed = (
        action === "DELETE"
          ? deleteHotelFacilityReferenceRequestSchema
          : changeHotelFacilityReferenceStatusRequestSchema
      ).safeParse(bodyValue);
      if (!parsed.success)
        throw {
          code: "VALIDATION_ERROR",
          message: "입력값을 확인해 주세요.",
          fieldErrors: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? "reason"),
            message: issue.message,
          })),
        };
      const detail = facilityDetailRoute(hotelId, entity, currentResource.id);
      const url = `${detail}/${action === "DELETE" ? "delete" : "status"}`;
      const body = JSON.stringify(parsed.data);
      const receipt = hotelFacilityMutationResponseSchema.parse(
        await request(url, {
          method: "POST",
          headers: operation.headers(url, "POST", body),
          body,
        }),
      ).data.resource;
      const canonical = await readCanonicalResource(
        hotelId,
        entity,
        currentResource.id,
      );
      assertMaterialReadback(receipt, canonical);
      await client.refetchQueries(
        { queryKey: ["hotel-facilities", hotelId] },
        { throwOnError: true },
      );
      operation.clear();
      return canonical;
    },
    onSuccess: () => onDone(),
    onError: async (error) => {
      const next = asFailure(error);
      if (next.code === "VERSION_CONFLICT") {
        try {
          const latest = await readCanonicalResource(
            hotelId,
            entity,
            currentResource.id,
          );
          setCurrentResource(latest);
          if (latest.status !== "DELETED") {
            form.setValue(
              "status",
              latest.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
            );
          }
          next.message = `${next.message} 최신 상태를 반영했으니 다시 확인해 주세요.`;
        } catch {
          next.message = `${next.message} 최신 정보 재조회에도 실패했습니다.`;
        }
      }
      setFailure(next);
      const reasonError = fieldMessage(next, "reason");
      if (reasonError) {
        form.setError("reason", { message: reasonError, type: "server" });
        queueMicrotask(() => form.setFocus("reason"));
      } else {
        queueMicrotask(() => alertRef.current?.focus());
      }
    },
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        setFailure(null);
        mutation.mutate(value);
      })}
    >
      <h3 className="text-lg font-semibold text-text">
        {currentResource.name} {action === "DELETE" ? "삭제" : "상태변경"}
      </h3>
      <ErrorBox
        alertRef={alertRef}
        failure={failure}
        id="facility-lifecycle-errors"
      />
      {action === "STATUS" ? (
        <div className="mt-4 text-sm font-semibold text-text">
          변경할 상태
          <p className="mt-1 flex min-h-11 items-center rounded-control border border-border bg-canvas px-3 font-normal">
            {form.watch("status") === "ACTIVE" ? "활성" : "사용중지"}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          삭제하면 복구하거나 같은 이름을 재사용할 수 없습니다.
        </p>
      )}
      <label className="mt-4 block text-sm font-semibold text-text">
        변경 사유
        <textarea
          aria-describedby={failure ? "facility-lifecycle-errors" : undefined}
          aria-invalid={Boolean(form.formState.errors.reason)}
          className={textareaClass}
          maxLength={500}
          minLength={2}
          required
          {...form.register("reason")}
        />
      </label>
      <Button
        className="mt-5 min-h-11 w-full md:w-auto"
        disabled={mutation.isPending}
        type="submit"
        variant={action === "DELETE" ? "danger" : "primary"}
      >
        {mutation.isPending
          ? "처리 중"
          : action === "DELETE"
            ? "삭제"
            : "상태 저장"}
      </Button>
    </form>
  );
}

function ActionButtons({
  entity,
  open,
  resource,
}: {
  entity: Tab;
  open: (dialog: NonNullable<DialogState>, trigger: HTMLButtonElement) => void;
  resource: HotelFacility | Reference;
}) {
  return resource.status === "DELETED" ? (
    <span className="text-sm text-muted">수정 불가</span>
  ) : (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        className="min-h-11"
        onClick={(event) =>
          open(
            entity === "FACILITY"
              ? { kind: "facility", resource: resource as HotelFacility }
              : {
                  kind: "reference",
                  entity: entity as "COMMON_AREA" | "FACILITY_TYPE",
                  resource,
                },
            event.currentTarget,
          )
        }
        type="button"
        variant="secondary"
      >
        수정
      </Button>
      <Button
        className="min-h-11"
        onClick={(event) =>
          open(
            { kind: "lifecycle", entity, resource, action: "STATUS" },
            event.currentTarget,
          )
        }
        type="button"
        variant="secondary"
      >
        상태변경
      </Button>
      {resource.status === "INACTIVE" ? (
        <Button
          className="min-h-11"
          onClick={(event) =>
            open(
              { kind: "lifecycle", entity, resource, action: "DELETE" },
              event.currentTarget,
            )
          }
          type="button"
          variant="danger"
        >
          삭제
        </Button>
      ) : null}
    </div>
  );
}

function FacilityManagementContent({
  hotelId,
  initialData,
  initialFailure,
}: {
  hotelId: string;
  initialData?: FacilityInitialData | undefined;
  initialFailure?: FacilityInitialFailure | undefined;
}) {
  const [tab, setTab] = useState<Tab>("FACILITY");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fallbackFocusRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({});
  const workspace = useQuery({
    queryKey: ["hotel-facilities", hotelId, q.trim(), page],
    initialData:
      initialData && q === "" && page === 1 ? initialData : undefined,
    queryFn: async () => {
      const search = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (q.trim()) search.set("q", q.trim());
      return hotelFacilityWorkspaceResponseSchema.parse(
        await request(`${hotelRoutes.facilityWorkspace(hotelId)}?${search}`),
      ).data;
    },
  });
  const data = workspace.data;
  const facilities = data?.facilities ?? [];
  const references =
    tab === "COMMON_AREA"
      ? (data?.commonAreas ?? [])
      : (data?.facilityTypes ?? []);
  const open = (next: NonNullable<DialogState>, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setDialog(next);
  };
  const resources: Array<HotelFacility | Reference> =
    tab === "FACILITY" ? facilities : references;
  const columns = useMemo<ColumnDef<HotelFacility | Reference>[]>(() => {
    const next: ColumnDef<HotelFacility | Reference>[] = [
      {
        accessorKey: "name",
        header: "이름",
        cell: ({ row }) => (
          <span className="font-semibold text-text">{row.original.name}</span>
        ),
      },
    ];
    if (tab === "FACILITY") {
      next.push(
        {
          id: "facilityType",
          header: "유형",
          cell: ({ row }) =>
            isFacility(row.original) ? row.original.facilityType.name : null,
        },
        {
          id: "location",
          header: "설치위치",
          cell: ({ row }) =>
            isFacility(row.original) ? (
              <>
                {row.original.location.type === "ROOM" ? "객실" : "공용공간"}
                {" · "}
                {row.original.location.name}
              </>
            ) : null,
        },
      );
    }
    next.push({
      id: "status",
      header: "상태",
      cell: ({ row }) => (
        <StatusBadge tone={statusPresentation[row.original.status].tone}>
          {statusPresentation[row.original.status].label}
        </StatusBadge>
      ),
    });
    if (data?.capabilities.canManage) {
      next.push({
        id: "actions",
        header: "작업",
        cell: ({ row }) => (
          <ActionButtons entity={tab} open={open} resource={row.original} />
        ),
      });
    }
    return next;
  }, [data?.capabilities.canManage, tab]);
  const table = useReactTable({
    columns,
    data: resources,
    getCoreRowModel: getCoreRowModel(),
  });
  useEffect(() => {
    if (data?.pagination.totalPages && page > data.pagination.totalPages)
      setPage(data.pagination.totalPages);
  }, [data?.pagination, page]);
  return (
    <section
      aria-labelledby="hotel-facilities-title"
      className="rounded-panel border border-border bg-surface p-5 md:p-6"
      id="hotel-facility-management"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            className="text-lg font-semibold text-text"
            id="hotel-facilities-title"
            ref={fallbackFocusRef}
            tabIndex={-1}
          >
            시설물 기준정보
          </h2>
          <p className="mt-1 text-sm text-muted">
            호텔 공용공간과 시설물 설치위치를 관리합니다.
          </p>
        </div>
        {data?.capabilities.canManage ? (
          <Button
            className="min-h-11"
            onClick={(event) =>
              open(
                tab === "FACILITY"
                  ? { kind: "facility" }
                  : { kind: "reference", entity: tab },
                event.currentTarget,
              )
            }
            type="button"
          >
            {tab === "FACILITY"
              ? "시설물 등록"
              : tab === "COMMON_AREA"
                ? "공용공간 등록"
                : "시설물유형 등록"}
          </Button>
        ) : null}
      </div>
      {initialFailure && !data ? (
        <div
          className="mt-5 rounded-control border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-800">
            시설물 기준정보를 불러오지 못했습니다
          </p>
          <p className="mt-1 text-sm text-red-700">{initialFailure.message}</p>
          <Button
            className="mt-3 min-h-11"
            onClick={() => void workspace.refetch()}
            type="button"
            variant="secondary"
          >
            다시 시도
          </Button>
        </div>
      ) : null}
      <div
        aria-label="시설물 기준정보 구분"
        className="mt-5 flex flex-wrap gap-2"
        role="tablist"
      >
        {facilityTabs.map((item, index) => (
          <button
            aria-controls="hotel-facility-tabpanel"
            aria-selected={tab === item}
            className={`min-h-11 rounded-control px-4 text-sm font-semibold ${tab === item ? "bg-primary text-white" : "border border-border text-text"}`}
            id={`hotel-facility-tab-${item.toLowerCase()}`}
            key={item}
            onClick={() => {
              setTab(item);
              setPage(1);
            }}
            onKeyDown={(event) => {
              let nextIndex: number | null = null;
              if (event.key === "ArrowRight")
                nextIndex = (index + 1) % facilityTabs.length;
              if (event.key === "ArrowLeft")
                nextIndex =
                  (index - 1 + facilityTabs.length) % facilityTabs.length;
              if (event.key === "Home") nextIndex = 0;
              if (event.key === "End") nextIndex = facilityTabs.length - 1;
              if (nextIndex === null) return;
              event.preventDefault();
              const next = facilityTabs[nextIndex];
              if (!next) return;
              setTab(next);
              setPage(1);
              tabRefs.current[next]?.focus();
            }}
            ref={(node) => {
              if (node) tabRefs.current[item] = node;
            }}
            role="tab"
            tabIndex={tab === item ? 0 : -1}
            type="button"
          >
            {item === "FACILITY"
              ? "시설물"
              : item === "COMMON_AREA"
                ? "공용공간"
                : "시설물유형"}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`hotel-facility-tab-${tab.toLowerCase()}`}
        id="hotel-facility-tabpanel"
        role="tabpanel"
        tabIndex={0}
      >
        {tab === "FACILITY" ? (
          <FilterBar label="시설물 목록 필터">
            <label className="text-sm font-semibold text-text">
              시설물 검색
              <input
                aria-label="시설물 검색"
                className={`${inputClass} md:max-w-sm`}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                placeholder="시설물명"
                value={q}
              />
            </label>
          </FilterBar>
        ) : null}
        {workspace.isLoading ? (
          <p className="mt-5 text-sm text-muted" role="status">
            시설물 기준정보를 불러오는 중입니다.
          </p>
        ) : workspace.isError ? (
          <p className="mt-5 text-sm text-red-700" role="alert">
            시설물 기준정보를 불러오지 못했습니다.
          </p>
        ) : resources.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              description="등록 권한이 있으면 새 기준정보를 등록할 수 있습니다."
              title="등록된 기준정보가 없습니다"
            />
          </div>
        ) : (
          <>
            <div className="mt-5 hidden md:block">
              <DataTable label={`${tab} 목록`}>
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-canvas text-xs text-muted">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            className={`px-4 py-3 ${header.column.id === "actions" ? "text-right" : ""}`}
                            key={header.id}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr className="border-t border-border" key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            className={`px-4 py-3 text-text ${cell.column.id === "actions" ? "text-right" : ""}`}
                            key={cell.id}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </div>
            <div className="mt-5 grid gap-2 md:hidden">
              {resources.map((resource) => (
                <article
                  className="rounded-mobile border border-border p-4"
                  key={resource.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-text">
                        {resource.name}
                      </h3>
                      {isFacility(resource) ? (
                        <p className="mt-1 text-sm text-muted">
                          {resource.facilityType.name} ·{" "}
                          {resource.location.type === "ROOM"
                            ? "객실"
                            : "공용공간"}{" "}
                          · {resource.location.name}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge
                      tone={statusPresentation[resource.status].tone}
                    >
                      {statusPresentation[resource.status].label}
                    </StatusBadge>
                  </div>
                  {data?.capabilities.canManage ? (
                    <div className="mt-4">
                      <ActionButtons
                        entity={tab}
                        open={open}
                        resource={resource}
                      />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
        {tab === "FACILITY" && data?.pagination ? (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
            <p aria-live="polite">총 {data.pagination.total}개</p>
            <div className="flex gap-2">
              <Button
                className="min-h-11"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
                variant="secondary"
              >
                이전
              </Button>
              <Button
                className="min-h-11"
                disabled={
                  page >= data.pagination.totalPages ||
                  data.pagination.totalPages === 0
                }
                onClick={() => setPage((current) => current + 1)}
                type="button"
                variant="secondary"
              >
                다음
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <Dialog
        closeLabel="시설물 기준정보 대화상자 닫기"
        fallbackFocusRef={fallbackFocusRef}
        onOpenChange={(next) => {
          if (!next) setDialog(null);
        }}
        open={dialog !== null}
        restoreFocusRef={triggerRef}
        title="시설물 기준정보"
      >
        {dialog?.kind === "facility" ? (
          <FacilityEditor
            commonAreas={data?.commonAreas ?? []}
            facilityTypes={data?.facilityTypes ?? []}
            hotelId={hotelId}
            onDone={() => setDialog(null)}
            resource={dialog.resource}
            roomLocations={data?.roomLocations ?? []}
          />
        ) : dialog?.kind === "reference" ? (
          <ReferenceEditor
            entity={dialog.entity}
            hotelId={hotelId}
            onDone={() => setDialog(null)}
            resource={dialog.resource}
          />
        ) : dialog?.kind === "lifecycle" ? (
          <LifecycleEditor
            action={dialog.action}
            entity={dialog.entity}
            hotelId={hotelId}
            onDone={() => setDialog(null)}
            resource={dialog.resource}
          />
        ) : null}
      </Dialog>
    </section>
  );
}

export function FacilityManagementPanel(props: {
  hotelId: string;
  initialData?: FacilityInitialData | undefined;
  initialFailure?: FacilityInitialFailure | undefined;
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
      <FacilityManagementContent {...props} />
    </QueryClientProvider>
  );
}
