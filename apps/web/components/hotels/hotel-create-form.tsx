"use client";

import {
  createHotelRequestSchema,
  hotelDetailResponseSchema,
  hotelErrorResponseSchema,
  type CreateHotelRequest,
} from "@werehere/contracts";
import { Button } from "@werehere/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

const inputClassName = "mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-10";

type RetryIdentity = { body: string; key: string };

export function HotelCreateForm() {
  const router = useRouter();
  const discardDialog = useRef<HTMLDialogElement | null>(null);
  const errorSummary = useRef<HTMLDivElement | null>(null);
  const retryIdentity = useRef<RetryIdentity | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, setFocus, formState: { errors, isDirty, isSubmitting } } = useForm<CreateHotelRequest>({
    defaultValues: { detailAddress: "" },
  });

  const reportFormError = (message: string) => {
    setFormError(message);
    queueMicrotask(() => errorSummary.current?.focus());
  };

  const onSubmit = handleSubmit(async (rawValues) => {
    setFormError(null);
    const parsed = createHotelRequestSchema.safeParse(rawValues);
    if (!parsed.success) {
      let firstField: keyof CreateHotelRequest | null = null;
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          const typedField = field as keyof CreateHotelRequest;
          firstField ??= typedField;
          setError(typedField, { message: issue.message });
        }
      }
      setFormError("입력 내용을 확인해 주세요. 첫 번째 오류 항목으로 이동합니다.");
      if (firstField) queueMicrotask(() => setFocus(firstField));
      return;
    }

    const body = JSON.stringify(parsed.data);
    if (!retryIdentity.current || retryIdentity.current.body !== body) {
      retryIdentity.current = { body, key: crypto.randomUUID() };
    }

    let response: Response;
    try {
      response = await fetch("/api/hotels", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": retryIdentity.current.key,
        },
        body,
      });
    } catch {
      reportFormError("서버에 연결할 수 없습니다. 입력값을 유지했으니 다시 시도해 주세요.");
      return;
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      reportFormError("서버 응답이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (!response.ok) {
      const failure = hotelErrorResponseSchema.safeParse(responseBody);
      if (failure.success) {
        let firstField: keyof CreateHotelRequest | null = null;
        for (const fieldError of failure.data.error.fieldErrors) {
          if (fieldError.field in parsed.data) {
            const typedField = fieldError.field as keyof CreateHotelRequest;
            firstField ??= typedField;
            setError(typedField, { message: fieldError.message });
          }
        }
        setFormError(failure.data.error.message);
        if (firstField) queueMicrotask(() => setFocus(firstField));
        else queueMicrotask(() => errorSummary.current?.focus());
      } else {
        reportFormError("호텔을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      return;
    }

    const created = hotelDetailResponseSchema.safeParse(responseBody);
    if (!created.success) {
      reportFormError("저장 결과를 확인할 수 없습니다. 호텔 목록에서 저장 여부를 확인해 주세요.");
      return;
    }

    try {
      const readBackResponse = await fetch(`/api/hotels/${created.data.data.hotel.id}`, { cache: "no-store" });
      const readBackBody: unknown = await readBackResponse.json();
      const readBack = hotelDetailResponseSchema.safeParse(readBackBody);
      if (!readBackResponse.ok || !readBack.success || readBack.data.data.hotel.id !== created.data.data.hotel.id) {
        reportFormError("호텔은 저장됐지만 상세정보 재조회에 실패했습니다. 호텔 목록에서 확인해 주세요.");
        return;
      }
    } catch {
      reportFormError("호텔은 저장됐지만 상세정보 재조회에 실패했습니다. 호텔 목록에서 확인해 주세요.");
      return;
    }

    retryIdentity.current = null;
    router.push(`/hotels/${created.data.data.hotel.id}`);
    router.refresh();
  });

  const cancel = () => {
    if (!isDirty) {
      router.push("/hotels");
      return;
    }
    discardDialog.current?.showModal();
  };

  const field = (name: keyof CreateHotelRequest, label: string, type = "text", placeholder?: string) => (
    <label className="block text-sm font-semibold text-text" htmlFor={`hotel-${name}`}>
      {label}
      <input
        aria-describedby={errors[name] ? `hotel-${name}-error` : undefined}
        aria-invalid={Boolean(errors[name])}
        aria-required={name !== "detailAddress"}
        className={inputClassName}
        id={`hotel-${name}`}
        placeholder={placeholder}
        type={type}
        {...register(name)}
      />
      {errors[name]?.message ? <span className="mt-1 block text-xs font-medium text-danger" id={`hotel-${name}-error`}>{errors[name]?.message}</span> : null}
    </label>
  );

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={onSubmit}>
      {formError ? (
        <div
          className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger outline-none focus:ring-2 focus:ring-danger/30"
          ref={errorSummary}
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </div>
      ) : null}
      <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
        <h2 className="text-base font-semibold text-text">호텔 식별정보</h2>
        <p className="mt-1 text-sm text-muted">호텔코드는 등록 후 변경하지 않는 내부 식별값입니다.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {field("branchCode", "호텔코드", "text", "예: HOTEL-GN")}
          {field("name", "호텔명", "text", "예: 위아히어 강남호텔")}
        </div>
      </section>
      <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
        <h2 className="text-base font-semibold text-text">주소·연락처</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("roadAddress", "도로명주소", "text", "도로명과 건물번호를 입력하세요")}</div>
          <div className="sm:col-span-2">{field("detailAddress", "상세주소 (선택)", "text", "층, 호수 등")}</div>
          {field("representativePhone", "대표연락처", "tel", "예: 02-1234-5678")}
        </div>
      </section>
      <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
        <h2 className="text-base font-semibold text-text">위탁계약기간</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {field("contractStartDate", "계약 시작일", "date")}
          {field("contractEndDate", "계약 종료일", "date")}
        </div>
      </section>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button className="min-h-mobile-action sm:min-h-10" onClick={cancel} type="button" variant="secondary">취소</Button>
        <Button className="min-h-mobile-action sm:min-h-10" disabled={isSubmitting} type="submit">{isSubmitting ? "저장 확인 중…" : "호텔 등록"}</Button>
      </div>
      <dialog
        aria-labelledby="discard-hotel-title"
        className="w-[min(28rem,calc(100%-2rem))] rounded-panel border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-slate-950/40"
        ref={discardDialog}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold" id="discard-hotel-title">작성 중인 내용을 취소할까요?</h2>
          <p className="mt-2 text-sm text-muted">입력한 호텔 정보는 저장되지 않습니다.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" onClick={() => discardDialog.current?.close()} type="button" variant="secondary">계속 작성</Button>
            <Button className="min-h-11" onClick={() => router.push("/hotels")} type="button">작성 내용 폐기</Button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
