"use client";
import {
  confirmDailySalesRequestSchema,
  correctDailySalesRequestSchema,
  createDailySalesDraftRequestSchema,
  dailySalesInternalResponseSchema,
  dailySalesOwnerResponseSchema,
  dailySalesRoutes,
  hotelErrorResponseSchema,
  hotelFileRoutes,
  hotelFileUploadInitResponseSchema,
  hotelFileUploadStatusResponseSchema,
  updateDailySalesDraftRequestSchema,
  type DailySales,
  type DailySalesCapability,
  type DailySalesLineInput,
  type DailySalesPublic,
} from "@werehere/contracts";
import { FeatureGuide } from "@werehere/ui";
import { useMutation } from "@tanstack/react-query";
import {
  FileCheck2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { hotelFeatureGuides } from "../../lib/feature-guides";
type Sale = DailySales | DailySalesPublic;
type References = {
  categories: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
};
type Fields = {
  businessDate: string;
  memo: string;
  reason: string;
  lines: DailySalesLineInput[];
};
const field =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
const money = new Intl.NumberFormat("ko-KR");
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (r: References): DailySalesLineInput => ({
  categoryId: r.categories[0]?.id ?? "",
  paymentMethodId: r.paymentMethods[0]?.id ?? "",
  grossAmount: 0,
  discountAmount: 0,
  refundAmount: 0,
  refundReason: null,
});
function internal(s: Sale): s is DailySales {
  return "internalMemo" in s && "createdBy" in s;
}
function parse(value: unknown) {
  const a = dailySalesInternalResponseSchema.safeParse(value);
  if (a.success) return a.data.data.sales;
  const b = dailySalesOwnerResponseSchema.safeParse(value);
  return b.success ? b.data.data.sales : null;
}
async function jsonRequest(path: string, method: string, body?: unknown) {
  const response = await fetch(
    path,
    body === undefined
      ? { method }
      : {
          method,
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
        },
  );
  const value = await response.json().catch(() => undefined);
  if (!response.ok) {
    const e = hotelErrorResponseSchema.safeParse(value);
    throw new Error(
      e.success ? e.data.error.message : "요청을 처리하지 못했습니다.",
    );
  }
  return value;
}
async function uploadEvidence(
  hotelId: string,
  salesId: string,
  fileValue: File,
) {
  const init = await jsonRequest(hotelFileRoutes.uploadInit(hotelId), "POST", {
    parent: { type: "DAILY_SALES_EVIDENCE", salesId },
    fileName: fileValue.name,
    mimeType: fileValue.type,
    sizeBytes: fileValue.size,
  });
  const parsed = hotelFileUploadInitResponseSchema.parse(init);
  const body = await fetch(parsed.data.uploadUrl, {
    method: "PUT",
    body: fileValue,
    headers: {
      "Content-Type": parsed.data.requiredHeaders["Content-Type"],
      "If-None-Match": "*",
    },
  });
  if (!body.ok) throw new Error("증빙 원본을 업로드하지 못했습니다.");
  const etag = body.headers.get("etag");
  if (!etag) throw new Error("증빙 무결성 정보를 확인하지 못했습니다.");
  await jsonRequest(
    hotelFileRoutes.uploadComplete(parsed.data.upload.id),
    "POST",
    { etag },
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const statusResponse = await fetch(
      hotelFileRoutes.uploadStatus(parsed.data.upload.id),
      { cache: "no-store" },
    );
    const status = hotelFileUploadStatusResponseSchema.safeParse(
      await statusResponse.json().catch(() => undefined),
    );
    if (statusResponse.ok && status.success) {
      const upload = status.data.data.upload;
      if (upload.status === "READY_UNLINKED" || upload.status === "LINKED")
        return upload.fileVersionId;
      if (["EXPIRED", "REJECTED", "SCAN_FAILED"].includes(upload.status))
        throw new Error("증빙 검역을 통과하지 못했습니다.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    "증빙 검역이 아직 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.",
  );
}
export function DailySalesWorkspace({
  hotelId,
  capability,
  references,
  initialSales,
  initialSelected,
}: {
  hotelId: string;
  capability: DailySalesCapability | null;
  references: References;
  initialSales: Sale[];
  initialSelected: Sale | null;
}) {
  const [sales, setSales] = useState(initialSales);
  const [selected, setSelected] = useState(initialSelected);
  const [message, setMessage] = useState("");
  const [fileValue, setFileValue] = useState<File | null>(null);
  const form = useForm<Fields>({
    defaultValues: {
      businessDate: initialSelected?.businessDate ?? today(),
      memo:
        initialSelected && internal(initialSelected)
          ? (initialSelected.internalMemo ?? "")
          : "",
      reason: "",
      lines: initialSelected?.lines ?? [emptyLine(references)],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const watched = form.watch("lines");
  const preview = useMemo(
    () =>
      watched.reduce(
        (a, l) => ({
          gross: a.gross + (Number(l.grossAmount) || 0),
          discount: a.discount + (Number(l.discountAmount) || 0),
          refund: a.refund + (Number(l.refundAmount) || 0),
          net:
            a.net +
            (Number(l.grossAmount) || 0) -
            (Number(l.discountAmount) || 0) -
            (Number(l.refundAmount) || 0),
        }),
        { gross: 0, discount: 0, refund: 0, net: 0 },
      ),
    [watched],
  );
  async function refresh(id?: string) {
    const listResponse = await fetch(
      `${dailySalesRoutes.list(hotelId)}?page=1&pageSize=100`,
      { cache: "no-store" },
    );
    const listValue = (await listResponse.json().catch(() => undefined)) as
      | { data?: { sales?: Sale[] } }
      | undefined;
    if (listResponse.ok && listValue?.data?.sales)
      setSales(listValue.data.sales);
    if (id) {
      const response = await fetch(dailySalesRoutes.detail(hotelId, id), {
        cache: "no-store",
      });
      const next = parse(await response.json().catch(() => undefined));
      if (response.ok && next) {
        setSelected(next);
        form.reset({
          businessDate: next.businessDate,
          memo: internal(next) ? (next.internalMemo ?? "") : "",
          reason: "",
          lines: next.lines,
        });
      }
    }
  }
  function select(s: Sale) {
    setSelected(s);
    setMessage("");
    setFileValue(null);
    form.reset({
      businessDate: s.businessDate,
      memo: internal(s) ? (s.internalMemo ?? "") : "",
      reason: "",
      lines: s.lines,
    });
    replace(s.lines);
  }
  const mutation = useMutation({
    mutationFn: async (action: "SAVE" | "CONFIRM" | "CORRECT") => {
      const value = form.getValues();
      if (action === "SAVE") {
        const body = selected
          ? updateDailySalesDraftRequestSchema.parse({
              version: selected.version,
              memo: value.memo.trim() || null,
              lines: value.lines,
            })
          : createDailySalesDraftRequestSchema.parse({
              salesId: crypto.randomUUID(),
              businessDate: value.businessDate,
              memo: value.memo.trim() || null,
              lines: value.lines,
            });
        return jsonRequest(
          selected
            ? dailySalesRoutes.update(hotelId, selected.id)
            : dailySalesRoutes.create(hotelId),
          selected ? "PATCH" : "POST",
          body,
        );
      }
      if (!selected || !fileValue)
        throw new Error("검역할 마감 증빙을 선택해 주세요.");
      const fileVersionId = await uploadEvidence(
        hotelId,
        selected.id,
        fileValue,
      );
      return action === "CONFIRM"
        ? jsonRequest(
            dailySalesRoutes.confirm(hotelId, selected.id),
            "POST",
            confirmDailySalesRequestSchema.parse({
              version: selected.version,
              evidenceFileVersionIds: [fileVersionId],
            }),
          )
        : jsonRequest(
            dailySalesRoutes.corrections(hotelId, selected.id),
            "POST",
            correctDailySalesRequestSchema.parse({
              version: selected.version,
              reason: value.reason,
              evidenceFileVersionIds: [fileVersionId],
              memo: value.memo.trim() || null,
              lines: value.lines,
            }),
          );
    },
    onError: (e) =>
      setMessage(e instanceof Error ? e.message : "저장하지 못했습니다."),
    onSuccess: async (value) => {
      const saved = parse(value);
      setMessage("서버에 저장하고 최신 값을 다시 확인했습니다.");
      setFileValue(null);
      await refresh(saved?.id);
    },
  });
  const busy = mutation.isPending;
  const selectedDraft = selected?.status === "DRAFT";
  const editable = capability?.canManage && (!selected || selectedDraft);
  const correcting = selected?.status === "LOCKED" && capability?.canCorrect;
  const label = (id: string, kind: "category" | "payment") =>
    (kind === "category"
      ? references.categories
      : references.paymentMethods
    ).find((v) => v.id === id)?.name ?? "알 수 없음";
  return (
    <section
      aria-labelledby="daily-sales-title"
      className="space-y-4 pb-24 md:pb-0"
      data-daily-sales-workspace
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1
              id="daily-sales-title"
              className="text-2xl font-bold text-primary"
            >
              일매출 장부
            </h1>
            <FeatureGuide
              content={hotelFeatureGuides["hotel-daily-sales.ledger"]}
            />
          </div>
          <p className="text-sm text-muted">
            업무일별 매출을 임시저장하고 증빙과 함께 확정합니다.
          </p>
        </div>
        {capability?.canManage ? (
          <button
            className={`${button} bg-primary text-white`}
            onClick={() => {
              setSelected(null);
              setFileValue(null);
              form.reset({
                businessDate: today(),
                memo: "",
                reason: "",
                lines: [emptyLine(references)],
              });
              replace([emptyLine(references)]);
            }}
          >
            <Plus size={17} />새 업무일
          </button>
        ) : null}
      </header>
      {message ? (
        <p
          aria-live="polite"
          className="rounded-control border border-border bg-subtle px-3 py-2 text-sm"
        >
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
        <div
          aria-labelledby="daily-sales-card-list"
          className="rounded-panel border border-border bg-surface p-3"
          role="region"
        >
          <h2 className="mb-3 font-semibold" id="daily-sales-card-list">
            날짜별 매출 카드
          </h2>
          <div className="space-y-2">
            {sales.map((s) => (
              <button
                key={s.id}
                onClick={() => select(s)}
                className={`w-full rounded-control border p-3 text-left ${selected?.id === s.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <span className="flex justify-between gap-2">
                  <strong>{s.businessDate}</strong>
                  <span>{s.status === "DRAFT" ? "임시저장" : "확정"}</span>
                </span>
                <span className="mt-2 block text-lg font-bold">
                  {money.format(s.totals.netAmount)}원
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-panel border border-border bg-surface p-4">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">업무일 매출 항목</caption>
              <thead>
                <tr className="border-b text-left">
                  <th>업무일</th>
                  <th>매출구분</th>
                  <th>결제수단</th>
                  <th>총매출</th>
                  <th>할인</th>
                  <th>환불</th>
                  <th>순매출</th>
                </tr>
              </thead>
              <tbody>
                {(selected?.lines ?? []).map((l, i) => (
                  <tr
                    className="border-b"
                    key={`${l.categoryId}-${l.paymentMethodId}-${i}`}
                  >
                    <td>{selected?.businessDate}</td>
                    <td>{label(l.categoryId, "category")}</td>
                    <td>{label(l.paymentMethodId, "payment")}</td>
                    <td>{money.format(l.grossAmount)}원</td>
                    <td>{money.format(l.discountAmount)}원</td>
                    <td>{money.format(l.refundAmount)}원</td>
                    <td>
                      {money.format(
                        l.grossAmount - l.discountAmount - l.refundAmount,
                      )}
                      원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable || selectedDraft || correcting ? (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <label className="block text-sm font-medium">
                업무일
                <input
                  className={`${field} mt-1`}
                  type="date"
                  disabled={!!selected}
                  {...form.register("businessDate")}
                />
              </label>
              <div className="space-y-3">
                {fields.map((f, i) => (
                  <fieldset
                    className="rounded-control border border-border p-3"
                    key={f.id}
                  >
                    <legend className="px-1 text-sm font-semibold">
                      매출 항목 {i + 1}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-sm">
                        매출구분
                        <select
                          className={`${field} mt-1`}
                          {...form.register(`lines.${i}.categoryId`)}
                        >
                          {references.categories.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        결제수단
                        <select
                          className={`${field} mt-1`}
                          {...form.register(`lines.${i}.paymentMethodId`)}
                        >
                          {references.paymentMethods.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(
                        [
                          "grossAmount",
                          "discountAmount",
                          "refundAmount",
                        ] as const
                      ).map((k) => (
                        <label className="text-sm" key={k}>
                          {k === "grossAmount"
                            ? "총매출"
                            : k === "discountAmount"
                              ? "할인"
                              : "환불"}
                          <span className="mt-1 flex items-center">
                            <input
                              className={field}
                              type="number"
                              min={0}
                              {...form.register(`lines.${i}.${k}`, {
                                valueAsNumber: true,
                              })}
                            />
                            <span className="-ml-7 text-sm">원</span>
                          </span>
                        </label>
                      ))}
                      <label className="text-sm">
                        환불근거
                        <input
                          className={`${field} mt-1`}
                          {...form.register(`lines.${i}.refundReason`, {
                            setValueAs: (v) => String(v).trim() || null,
                          })}
                        />
                      </label>
                    </div>
                    {fields.length > 1 ? (
                      <button
                        className="mt-2 inline-flex items-center gap-1 text-sm text-danger"
                        onClick={() => remove(i)}
                        type="button"
                      >
                        <Trash2 size={15} />
                        항목 삭제
                      </button>
                    ) : null}
                  </fieldset>
                ))}
              </div>
              <button
                className={`${button} border border-border`}
                type="button"
                onClick={() => append(emptyLine(references))}
              >
                <Plus size={16} />
                항목 추가
              </button>
              <label className="block text-sm font-medium">
                내부 메모
                <textarea
                  className={`${field} mt-1 min-h-20 py-2`}
                  {...form.register("memo")}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-control bg-subtle p-3 text-sm">
                <span>총매출 {money.format(preview.gross)}원</span>
                <span>할인 {money.format(preview.discount)}원</span>
                <span>환불 {money.format(preview.refund)}원</span>
                <strong>예상 순매출 {money.format(preview.net)}원</strong>
              </div>
              {selected && selectedDraft && capability?.canConfirm ? (
                <label className="block text-sm font-medium">
                  마감 증빙
                  <input
                    className={`${field} mt-1 py-2`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={(e) => setFileValue(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : null}
              {selected?.status === "LOCKED" && capability?.canCorrect ? (
                <>
                  <label className="block text-sm font-medium">
                    정정 사유
                    <textarea
                      className={`${field} mt-1 min-h-20 py-2`}
                      {...form.register("reason")}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    새 정정 증빙
                    <input
                      className={`${field} mt-1 py-2`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      onChange={(e) =>
                        setFileValue(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </>
              ) : null}
              {selected?.evidence.length ? (
                <section
                  aria-labelledby="daily-sales-evidence-heading"
                  className="space-y-2"
                >
                  <h3
                    className="font-semibold"
                    id="daily-sales-evidence-heading"
                  >
                    <FileCheck2 className="mr-1 inline" size={17} />
                    확정 증빙
                  </h3>
                  {selected.evidence.map((e) => (
                    <a
                      className="flex min-h-11 items-center rounded-control border border-border px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                      href={hotelFileRoutes.dailySalesView(
                        hotelId,
                        selected.id,
                        e.fileVersionId,
                      )}
                      key={e.fileVersionId}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {e.displayName} 보기
                    </a>
                  ))}
                </section>
              ) : null}
              <div className="sticky bottom-3 flex flex-wrap justify-end gap-2 rounded-panel border border-border bg-surface/95 p-3 shadow-panel">
                {editable ? (
                  <button
                    disabled={busy}
                    className={`${button} bg-primary text-white`}
                    type="button"
                    onClick={() => mutation.mutate("SAVE")}
                  >
                    <Save size={17} />
                    임시저장
                  </button>
                ) : null}
                {selectedDraft && capability?.canConfirm ? (
                  <button
                    disabled={busy}
                    className={`${button} bg-primary text-white`}
                    type="button"
                    onClick={() => mutation.mutate("CONFIRM")}
                  >
                    <LockKeyhole size={17} />
                    확정
                  </button>
                ) : null}
                {selected?.status === "LOCKED" && capability?.canCorrect ? (
                  <button
                    disabled={busy}
                    className={`${button} bg-primary text-white`}
                    type="button"
                    onClick={() => mutation.mutate("CORRECT")}
                  >
                    <RotateCcw size={17} />
                    정정 등록
                  </button>
                ) : null}
              </div>
            </form>
          ) : selected ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 rounded-control bg-subtle p-3">
                <span>
                  총매출 {money.format(selected.totals.grossAmount)}원
                </span>
                <span>
                  할인 {money.format(selected.totals.discountAmount)}원
                </span>
                <span>환불 {money.format(selected.totals.refundAmount)}원</span>
                <strong>
                  순매출 {money.format(selected.totals.netAmount)}원
                </strong>
              </div>
              <h3 className="font-semibold">
                <FileCheck2 className="mr-1 inline" size={17} />
                확정 증빙
              </h3>
              {selected.evidence.map((e) => (
                <a
                  className="flex min-h-11 items-center rounded-control border border-border px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href={hotelFileRoutes.dailySalesView(
                    hotelId,
                    selected.id,
                    e.fileVersionId,
                  )}
                  key={e.fileVersionId}
                  rel="noreferrer"
                  target="_blank"
                >
                  {e.displayName} 보기
                </a>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-muted">
              업무일을 선택하거나 새로 등록해 주세요.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
