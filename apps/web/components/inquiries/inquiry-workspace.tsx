"use client";
import {
  createHotelInquiryRequestSchema,
  hotelErrorResponseSchema,
  hotelFileRoutes,
  hotelFileUploadInitResponseSchema,
  hotelFileUploadStatusResponseSchema,
  hotelInquiryInternalResponseSchema,
  hotelInquiryOwnerResponseSchema,
  hotelInquiryRoutes,
  type HotelAssignmentView,
  type HotelInquiry,
  type HotelInquiryNotification,
  type HotelInquiryPublic,
} from "@werehere/contracts";
import { FeatureGuide } from "@werehere/ui";
import { useMutation } from "@tanstack/react-query";
import {
  MessageCircleQuestion,
  Plus,
  Send,
  UserRoundCheck,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { hotelFeatureGuides } from "../../lib/feature-guides";
import { InquirySettingsPanel } from "./inquiry-settings-panel";
type Detail = HotelInquiry | HotelInquiryPublic;
type Capability = {
  hotelId: string;
  hotelName: string;
  ownerView: boolean;
  canRead: boolean;
  canCreate: boolean;
  canReply: boolean;
  canAssign: boolean;
  canManageSettings: boolean;
};
type CreateFields = {
  categoryCode:
    | "CONTRACT_POLICY"
    | "SALES_SETTLEMENT"
    | "ROOM_FACILITY"
    | "INSPECTION_ISSUE"
    | "ACCOUNT_PERMISSION"
    | "OTHER";
  title: string;
  body: string;
};
type MessageFields = { body: string; visibility: "PUBLIC" | "INTERNAL" };
type PendingMutation = {
  body: unknown;
  idempotencyKey: string;
  path: string;
  signature: string;
};
type UploadProgress = {
  completeKey?: string;
  etag?: string;
  initKey: string;
  readyFileVersionId?: string;
};
function uploadSignature(inquiryId: string, file: File) {
  return [
    inquiryId,
    file.name,
    file.type,
    file.size,
    file.lastModified,
  ].join("\u0000");
}
const field =
    "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
  button =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
const labels = {
  RECEIVED: "접수",
  ASSIGNED: "담당지정",
  ANSWERING: "답변중",
  ANSWERED: "답변완료",
  SUPPLEMENT_REQUESTED: "보완요청",
  CLOSED: "종료",
} as const;
const categories = {
  CONTRACT_POLICY: "계약·운영정책",
  SALES_SETTLEMENT: "매출·정산",
  ROOM_FACILITY: "객실·시설",
  INSPECTION_ISSUE: "객실점검·운영이슈",
  ACCOUNT_PERMISSION: "계정·권한",
  OTHER: "기타",
} as const;
const notificationLabels: Record<string, string> = {
  HOTEL_INQUIRY_CREATE: "새 문의가 접수되었습니다.",
  HOTEL_INQUIRY_ASSIGN: "문의 담당자가 지정되었습니다.",
  HOTEL_INQUIRY_ADD_PUBLIC_MESSAGE: "문의에 공개답변이 등록되었습니다.",
  HOTEL_INQUIRY_MARK_ANSWERED: "문의 답변이 완료되었습니다.",
  HOTEL_INQUIRY_REQUEST_SUPPLEMENT: "문의에 보완요청이 등록되었습니다.",
  HOTEL_INQUIRY_AUTO_CLOSE: "문의가 자동으로 종료되었습니다.",
  HOTEL_INQUIRY_REOPEN: "종료된 문의가 재개되었습니다.",
};
function isInternal(x: Detail): x is HotelInquiry {
  return "statusHistory" in x;
}
function toPublic(x: Detail): HotelInquiryPublic {
  return {
    id: x.id,
    hotelId: x.hotelId,
    categoryCode: x.categoryCode,
    categoryName: x.categoryName,
    title: x.title,
    status: x.status,
    version: x.version,
    assignee: x.assignee ? { displayName: x.assignee.displayName } : null,
    messages: x.messages
      .filter((m) => m.visibility === "PUBLIC")
      .map((m) => ({
        id: m.id,
        body: m.body,
        actor: { displayName: m.actor.displayName },
        createdAt: m.createdAt,
        visibility: "PUBLIC" as const,
        attachments: m.attachments,
      })),
    answeredAt: x.answeredAt,
    closedAt: x.closedAt,
    reopenUntil: x.reopenUntil,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
  };
}
function parse(value: unknown) {
  const a = hotelInquiryInternalResponseSchema.safeParse(value);
  if (a.success) return a.data.data.inquiry;
  const b = hotelInquiryOwnerResponseSchema.safeParse(value);
  return b.success ? b.data.data.inquiry : null;
}
export async function idempotentFetch(
  path: string,
  body: unknown,
  idempotencyKey = crypto.randomUUID(),
) {
  const serializedBody = JSON.stringify(body),
    execute = () =>
      fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: serializedBody,
      });
  try {
    const response = await execute();
    return response.status >= 500 ? execute() : response;
  } catch {
    return execute();
  }
}
async function mutation(
  path: string,
  body: unknown,
  idempotencyKey?: string,
) {
  const r = await idempotentFetch(path, body, idempotencyKey),
    json = await r.json().catch(() => undefined);
  if (!r.ok) {
    const e = hotelErrorResponseSchema.safeParse(json);
    throw new Error(
      e.success ? e.data.error.message : "요청을 처리하지 못했습니다.",
    );
  }
  const result = parse(json);
  if (!result) throw new Error("응답을 안전하게 확인하지 못했습니다.");
  return result;
}
async function uploadAttachments(
  hotelId: string,
  inquiryId: string,
  files: File[],
  progressByFile: Map<string, UploadProgress>,
) {
  const ids: string[] = [];
  for (const file of files) {
    if (
      !["image/jpeg", "image/png", "image/webp", "image/heic"].includes(
        file.type,
      ) ||
      file.size < 1 ||
      file.size > 20 * 1024 * 1024
    )
      throw new Error("첨부는 20MB 이하 JPG, PNG, WebP, HEIC만 가능합니다.");
    const signature = uploadSignature(inquiryId, file),
      progress = progressByFile.get(signature) ?? {
        initKey: crypto.randomUUID(),
      };
    progressByFile.set(signature, progress);
    if (progress.readyFileVersionId) {
      ids.push(progress.readyFileVersionId);
      continue;
    }
    const initResponse = await idempotentFetch(
        hotelFileRoutes.uploadInit(hotelId),
        {
          parent: { type: "OWNER_INQUIRY_ATTACHMENT", inquiryId },
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
        progress.initKey,
      ),
      initJson = await initResponse.json().catch(() => undefined),
      init = hotelFileUploadInitResponseSchema.safeParse(initJson);
    if (!initResponse.ok || !init.success)
      throw new Error("첨부 업로드를 시작하지 못했습니다.");
    let etag = progress.etag;
    if (!etag) {
      const bodyResponse = await fetch(init.data.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "If-None-Match": "*" },
        body: file,
      });
      etag = bodyResponse.headers.get("etag") ?? undefined;
      if (!bodyResponse.ok || !etag)
        throw new Error("첨부 원본을 저장하지 못했습니다.");
      progress.etag = etag;
    }
    progress.completeKey ??= crypto.randomUUID();
    let completeResponse: Response | undefined;
    try {
      completeResponse = await idempotentFetch(
        hotelFileRoutes.uploadComplete(init.data.data.upload.id),
        { etag },
        progress.completeKey,
      );
    } catch {
      // Commit 후 응답이 연속 유실된 경우 status polling으로 정본을 확인한다.
    }
    if (completeResponse && !completeResponse.ok && completeResponse.status < 500)
      throw new Error("첨부 검역을 시작하지 못했습니다.");
    let ready: string | undefined;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await fetch(
         `${hotelFileRoutes.uploadStatus(init.data.data.upload.id)}?hotelId=${encodeURIComponent(hotelId)}`,
         { cache: "no-store" },
       ),
        statusJson = await statusResponse.json().catch(() => undefined),
        status = hotelFileUploadStatusResponseSchema.safeParse(statusJson);
      if (!statusResponse.ok || !status.success)
        throw new Error("첨부 검역 상태를 확인하지 못했습니다.");
      if (
        status.data.data.upload.status === "READY_UNLINKED" ||
        status.data.data.upload.status === "LINKED"
      ) {
        ready = status.data.data.upload.fileVersionId;
        progress.readyFileVersionId = ready;
        break;
      }
      if (
        ["EXPIRED", "REJECTED", "SCAN_FAILED"].includes(
          status.data.data.upload.status,
        )
      )
        throw new Error("첨부 검역에 실패했습니다.");
    }
    if (!ready)
      throw new Error(
        "첨부 검역이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
      );
    ids.push(ready);
  }
  return ids;
}
export function InquiryWorkspace({
  hotelId,
  initialInquiries,
  initialNotifications = [],
  initialSelected,
  capability,
  assignments,
  contact,
  settings,
}: {
  hotelId: string;
  initialInquiries: HotelInquiryPublic[];
  initialNotifications?: HotelInquiryNotification[];
  initialSelected: Detail | null;
  capability: Capability | null;
  assignments: HotelAssignmentView[];
  contact: {
    phone: string;
    email: string;
    operatingHours: string;
    version: number;
  } | null;
  settings:
    | React.ComponentProps<typeof InquirySettingsPanel>["initialSettings"]
    | null;
}) {
  const [list, setList] = useState(initialInquiries),
    [selected, setSelected] = useState(initialSelected),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [files, setFiles] = useState<File[]>([]),
    [uploading, setUploading] = useState(false),
    pendingCreateRef = useRef<PendingMutation | null>(null),
    pendingMessageRef = useRef<PendingMutation | null>(null),
    pendingActionsRef = useRef(new Map<string, PendingMutation>()),
    uploadProgressRef = useRef(new Map<string, UploadProgress>()),
    errorRef = useRef<HTMLParagraphElement>(null),
    createForm = useForm<CreateFields>({
      defaultValues: { categoryCode: "OTHER", title: "", body: "" },
    }),
    messageForm = useForm<MessageFields>({
      defaultValues: { body: "", visibility: "PUBLIC" },
    });
  const run = useMutation({
    mutationFn: ({
      path,
      body,
      idempotencyKey,
    }: {
      path: string;
      body: unknown;
      idempotencyKey?: string;
    }) => mutation(path, body, idempotencyKey),
    onSuccess: (value) => {
      setSelected(value);
      setList((current) =>
        [toPublic(value), ...current.filter((x) => x.id !== value.id)].slice(
          0,
          100,
        ),
      );
      setError("");
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : "요청을 처리하지 못했습니다.");
      queueMicrotask(() => errorRef.current?.focus());
    },
  });
  async function select(id: string) {
    const r = await fetch(hotelInquiryRoutes.detail(hotelId, id), {
        cache: "no-store",
      }),
      json = await r.json().catch(() => undefined),
      value = parse(json);
    if (r.ok && value) {
      setSelected(value);
      setError("");
    } else {
      setError("문의 상세를 불러오지 못했습니다.");
      queueMicrotask(() => errorRef.current?.focus());
    }
  }
  const create = createForm.handleSubmit((v) => {
    const signature = JSON.stringify(v);
    let pending = pendingCreateRef.current;
    if (!pending || pending.signature !== signature) {
      const parsed = createHotelInquiryRequestSchema.safeParse({
        ...v,
        inquiryId: crypto.randomUUID(),
      });
      if (!parsed.success) {
        setError("제목과 문의내용을 확인해 주세요.");
        return;
      }
      pending = {
        body: parsed.data,
        idempotencyKey: crypto.randomUUID(),
        path: hotelInquiryRoutes.create(hotelId),
        signature,
      };
      pendingCreateRef.current = pending;
    }
    run.mutate(
      {
        path: pending.path,
        body: pending.body,
        idempotencyKey: pending.idempotencyKey,
      },
      {
        onSuccess: () => {
          pendingCreateRef.current = null;
          createForm.reset();
          setCreating(false);
        },
      },
    );
  }, (errors) => {
    setError("제목과 문의내용을 확인해 주세요.");
    if (errors.title) createForm.setFocus("title");
    else if (errors.body) createForm.setFocus("body");
    else createForm.setFocus("categoryCode");
  });
  const send = messageForm.handleSubmit(async (v) => {
    if (!selected) return;
    setUploading(true);
    setError("");
    try {
      const signature = JSON.stringify({
        inquiryId: selected.id,
        version: selected.version,
        message: v,
        files: files.map((file) => [
          file.name,
          file.type,
          file.size,
          file.lastModified,
        ]),
      });
      let pending = pendingMessageRef.current;
      if (!pending || pending.signature !== signature) {
        const attachmentFileVersionIds = await uploadAttachments(
          hotelId,
          selected.id,
          files,
          uploadProgressRef.current,
        );
        pending = {
          path: hotelInquiryRoutes.messages(hotelId, selected.id),
          body: {
            ...v,
            version: selected.version,
            attachmentFileVersionIds,
          },
          idempotencyKey: crypto.randomUUID(),
          signature,
        };
        pendingMessageRef.current = pending;
      }
      run.mutate(
        {
          path: pending.path,
          body: pending.body,
          idempotencyKey: pending.idempotencyKey,
        },
        {
          onSuccess: () => {
            pendingMessageRef.current = null;
            uploadProgressRef.current.clear();
            messageForm.reset();
            setFiles([]);
          },
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "첨부를 처리하지 못했습니다.");
      queueMicrotask(() => errorRef.current?.focus());
    } finally {
      setUploading(false);
    }
  });
  const transition = (
    action:
      | "START_ANSWER"
      | "MARK_ANSWERED"
      | "REQUEST_SUPPLEMENT"
      | "CLOSE"
      | "REOPEN",
    reason: string,
  ) => {
    if (!selected || run.isPending) return;
    const key = `transition:${selected.id}:${action}`,
      body = { action, reason, version: selected.version },
      signature = JSON.stringify(body);
    let pending = pendingActionsRef.current.get(key);
    if (!pending || pending.signature !== signature) {
      pending = {
        path: hotelInquiryRoutes.transitions(hotelId, selected.id),
        body,
        idempotencyKey: crypto.randomUUID(),
        signature,
      };
      pendingActionsRef.current.set(key, pending);
    }
    run.mutate(
      {
        path: pending.path,
        body: pending.body,
        idempotencyKey: pending.idempotencyKey,
      },
      { onSuccess: () => pendingActionsRef.current.delete(key) },
    );
  };
  return (
    <section
      className="space-y-4"
      aria-labelledby="inquiry-title"
      data-inquiry-workspace
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="inquiry-title" className="text-xl font-semibold">
            호텔 소유주 문의
          </h1>
          <p className="mt-1 text-sm text-muted">
            문의 접수부터 담당 답변, 보완요청과 종료까지 한 화면에서 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <FeatureGuide
            content={hotelFeatureGuides["hotel-owner-inquiry.lifecycle"]}
          />
          {capability?.canCreate && (
            <button
              aria-controls="owner-inquiry-create-form"
              aria-expanded={creating}
              className={`${button} bg-primary text-white`}
              onClick={() => setCreating((v) => !v)}
            >
              <Plus size={18} />새 문의
            </button>
          )}
        </div>
      </header>
      {capability?.canManageSettings && settings ? (
        <InquirySettingsPanel
          hotelId={hotelId}
          capability={capability}
          initialSettings={settings}
        />
      ) : null}
      {contact ? (
        <div
          className="rounded-panel border border-border bg-surface p-4"
          role="region"
          aria-label="호텔 문의처"
        >
          <strong>문의처</strong>
          <p className="mt-1 text-sm">
            {contact.phone} · {contact.email}
          </p>
          <p className="text-sm text-muted">{contact.operatingHours}</p>
        </div>
      ) : (
        <div
          className="rounded-panel border border-warning/40 bg-warning/5 p-4 text-sm"
          role="status"
        >
          문의처가 아직 설정되지 않았습니다. 사내 설정 담당자가 문의처를
          등록하면 소유주에게 표시됩니다.
        </div>
      )}
      {initialNotifications.length > 0 && (
       <section
         className="rounded-panel border border-border bg-surface p-4"
         aria-labelledby="inquiry-notifications-title"
       >
         <h2 id="inquiry-notifications-title" className="font-semibold">
           문의 알림
         </h2>
         <ul className="mt-2 space-y-2">
           {initialNotifications.map((notification) => (
             <li key={notification.id}>
               <button
                 type="button"
                 className="min-h-11 w-full rounded-control border border-border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                 onClick={() => select(notification.inquiryId)}
               >
                 <span className="font-medium">{notification.title}</span>
                 <span className="block text-xs text-muted">
                   {notificationLabels[notification.eventCode] ?? "문의가 변경되었습니다."}
                 </span>
               </button>
             </li>
           ))}
         </ul>
       </section>
      )}
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {creating && (
        <form
          id="owner-inquiry-create-form"
          noValidate
          onSubmit={create}
          className="grid gap-3 rounded-panel border border-border bg-surface p-4"
        >
          <label className="text-sm font-medium">
            문의유형
            <select className={field} {...createForm.register("categoryCode")}>
              {Object.entries(categories).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            제목
            <input
              id="inquiry-create-title"
              className={field}
              maxLength={160}
              required
              aria-required="true"
              aria-invalid={Boolean(createForm.formState.errors.title)}
              aria-describedby={createForm.formState.errors.title ? "inquiry-create-title-error" : undefined}
              {...createForm.register("title", {
                required: "제목을 입력해 주세요.",
                validate: (value) => value.trim().length >= 2 || "제목은 2자 이상 입력해 주세요.",
              })}
            />
            {createForm.formState.errors.title && (
              <span id="inquiry-create-title-error" className="mt-1 block text-xs text-danger">
                {createForm.formState.errors.title.message}
              </span>
            )}
          </label>
          <label className="text-sm font-medium">
            문의내용
            <textarea
              id="inquiry-create-body"
              className={`${field} min-h-28 py-3`}
              maxLength={4000}
              required
              aria-required="true"
              aria-invalid={Boolean(createForm.formState.errors.body)}
              aria-describedby={createForm.formState.errors.body ? "inquiry-create-body-error" : undefined}
              {...createForm.register("body", {
                required: "문의내용을 입력해 주세요.",
                validate: (value) => value.trim().length >= 2 || "문의내용은 2자 이상 입력해 주세요.",
              })}
            />
            {createForm.formState.errors.body && (
              <span id="inquiry-create-body-error" className="mt-1 block text-xs text-danger">
                {createForm.formState.errors.body.message}
              </span>
            )}
          </label>
          <button
            disabled={run.isPending}
            className={`${button} justify-self-start bg-primary text-white`}
          >
            <Send size={18} />
            문의 접수
          </button>
        </form>
      )}
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <nav aria-label="문의 목록" className="space-y-2">
          {list.length === 0 ? (
            <p className="rounded-panel border border-dashed border-border p-6 text-sm text-muted">
              등록된 문의가 없습니다.
            </p>
          ) : (
            list.map((item) => (
              <button
                key={item.id}
                onClick={() => select(item.id)}
                aria-current={selected?.id === item.id ? "page" : undefined}
                className="w-full rounded-panel border border-border bg-surface p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-xs font-semibold text-primary">
                  {categories[item.categoryCode]} · {labels[item.status]}
                </span>
                <strong className="mt-1 block line-clamp-2">
                  {item.title}
                </strong>
                <span className="mt-2 block text-xs text-muted">
                  {new Date(item.updatedAt).toLocaleString("ko-KR")}
                </span>
              </button>
            ))
          )}
        </nav>
        <article className="min-w-0 rounded-panel border border-border bg-surface p-4 sm:p-6">
          {!selected ? (
            <p className="text-sm text-muted">
              문의 목록에서 항목을 선택해 주세요.
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-semibold text-primary">
                  {categories[selected.categoryCode]} ·{" "}
                  {labels[selected.status]}
                </span>
                <h2 className="mt-1 text-lg font-semibold">{selected.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  담당 {selected.assignee?.displayName ?? "기본 운영문의함"}
                </p>
              </div>
              <ol className="space-y-3" aria-label="문의 대화">
                {selected.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-control border p-3 ${m.visibility === "INTERNAL" ? "border-warning/40 bg-warning/5" : "border-border"}`}
                  >
                    <div className="flex justify-between gap-2 text-xs text-muted">
                      <span>
                        {m.actor.displayName}
                        {m.visibility === "INTERNAL" ? " · 내부메모" : ""}
                      </span>
                      <time>
                        {new Date(m.createdAt).toLocaleString("ko-KR")}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                    {m.attachments.length > 0 && (
                      <ul
                        className="mt-2 flex flex-wrap gap-2"
                        aria-label="첨부파일"
                      >
                        {m.attachments.map((file) => (
                          <li key={file.fileVersionId}>
                            <a
                              className="inline-flex min-h-11 items-center rounded-control border border-border px-3 text-sm font-medium text-primary"
                              href={hotelFileRoutes.inquiryView(
                                hotelId,
                                selected.id,
                                file.fileVersionId,
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {file.displayName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {selected.status !== "CLOSED" && (
                <form
                  onSubmit={send}
                  className="grid gap-2 border-t border-border pt-4"
                >
                  <label className="text-sm font-medium">
                    메시지
                    <textarea
                      className={`${field} min-h-24 py-3`}
                      {...messageForm.register("body")}
                    />
                  </label>
                  {capability?.canReply && (
                    <label className="text-sm">
                      <span className="sr-only">공개범위</span>
                      <select
                        className={field}
                        {...messageForm.register("visibility")}
                      >
                        <option value="PUBLIC">소유주 공개답변</option>
                        <option value="INTERNAL">내부메모</option>
                      </select>
                    </label>
                  )}
                  <label className="text-sm font-medium">
                    첨부 이미지
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      className={`${field} py-2`}
                      onChange={(event) =>
                        setFiles(
                          Array.from(event.target.files ?? []).slice(0, 10),
                        )
                      }
                    />
                    <span className="mt-1 block text-xs text-muted">
                      최대 10개, 파일당 20MB · 검역 완료 후 메시지가 저장됩니다.
                    </span>
                  </label>
                  <button
                    disabled={run.isPending || uploading}
                    className={`${button} justify-self-start bg-primary text-white`}
                  >
                    <Send size={18} />
                    메시지 저장
                  </button>
                </form>
              )}
              {capability?.canAssign && selected.status === "RECEIVED" && (
                <div className="grid gap-2 border-t border-border pt-4">
                  <label className="text-sm font-medium">
                    담당자
                    <select
                      id="inquiry-assignee"
                      className={field}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        담당자를 선택해 주세요
                      </option>
                      {assignments.map((a) => (
                        <option key={a.userId} value={a.userId}>
                          {a.assignee.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={run.isPending}
                    className={`${button} justify-self-start border border-border`}
                    onClick={() => {
                      const el =
                        document.querySelector<HTMLSelectElement>(
                          "#inquiry-assignee",
                        );
                      if (el?.value && !run.isPending) {
                        const key = `assign:${selected.id}`,
                          body = {
                            version: selected.version,
                            assigneeUserId: el.value,
                            reason: "문의 담당자 지정",
                          },
                          signature = JSON.stringify(body);
                        let pending = pendingActionsRef.current.get(key);
                        if (!pending || pending.signature !== signature) {
                          pending = {
                            path: hotelInquiryRoutes.assign(hotelId, selected.id),
                            body,
                            idempotencyKey: crypto.randomUUID(),
                            signature,
                          };
                          pendingActionsRef.current.set(key, pending);
                        }
                        run.mutate(
                          {
                            path: pending.path,
                            body: pending.body,
                            idempotencyKey: pending.idempotencyKey,
                          },
                          { onSuccess: () => pendingActionsRef.current.delete(key) },
                        );
                      }
                    }}
                  >
                    <UserRoundCheck size={18} />
                    담당 지정
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {capability?.canReply && selected.status === "ASSIGNED" && (
                  <button
                    className={`${button} border border-border`}
                    disabled={run.isPending}
                    onClick={() => transition("START_ANSWER", "답변 준비 시작")}
                  >
                    답변 시작
                  </button>
                )}
                {capability?.canReply && selected.status === "ANSWERING" && (
                  <button
                    className={`${button} bg-primary text-white`}
                    disabled={run.isPending}
                    onClick={() =>
                      transition("MARK_ANSWERED", "공개 답변 완료")
                    }
                  >
                    답변완료
                  </button>
                )}
                {capability?.ownerView && selected.status === "ANSWERED" && (
                  <>
                    <button
                      className={`${button} border border-border`}
                      disabled={run.isPending}
                      onClick={() =>
                        transition("REQUEST_SUPPLEMENT", "추가 답변 요청")
                      }
                    >
                      보완요청
                    </button>
                    <button
                      className={`${button} bg-primary text-white`}
                      disabled={run.isPending}
                      onClick={() => transition("CLOSE", "답변 확인 후 종료")}
                    >
                      문의 종료
                    </button>
                  </>
                )}
                {capability?.ownerView &&
                  selected.status === "CLOSED" &&
                  selected.reopenUntil &&
                  new Date(selected.reopenUntil) > new Date() && (
                    <button
                      className={`${button} border border-border`}
                      disabled={run.isPending}
                      onClick={() => transition("REOPEN", "종료 문의 재개")}
                    >
                      문의 재개
                    </button>
                  )}
              </div>
              {isInternal(selected) && (
                <details className="border-t border-border pt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    상태 변경이력
                  </summary>
                  <ol className="mt-3 space-y-2 text-sm">
                    {selected.statusHistory.map((h) => (
                      <li key={h.id}>
                        {labels[h.toStatus]} · {h.reason} ·{" "}
                        {h.actor.displayName}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          )}
        </article>
      </div>
      <p className="sr-only">
        <MessageCircleQuestion />
        문의 화면은 모바일에서 목록과 행동 버튼을 카드 순서로 제공합니다.
      </p>
    </section>
  );
}
