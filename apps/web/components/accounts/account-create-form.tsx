"use client";

import {
  accountDetailResponseSchema,
  createAccountRequestSchema,
  hotelErrorResponseSchema,
  type Account,
  type CreateAccountRequest,
} from "@werehere/contracts";
import { Button } from "@werehere/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

const inputClassName = "mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
type AccountFieldName = keyof CreateAccountRequest & string;

export function accountReadBackMatches(created: Account, readBack: Account) {
  const material = (account: Account) => ({
    id: account.id,
    displayName: account.displayName,
    loginName: account.loginName,
    email: account.email,
    userType: account.userType,
    hotelIds: account.hotels?.map((hotel) => hotel.id).sort()
      ?? (account.hotelId ? [account.hotelId] : []),
    status: account.status,
    version: account.version,
  });
  return JSON.stringify(material(created)) === JSON.stringify(material(readBack));
}

export function AccountCreateForm({
  hotels,
  defaultDate = new Date().toISOString().slice(0, 10),
}: {
  hotels: Array<{ id: string; name: string }>;
  defaultDate?: string;
}) {
  const router = useRouter();
  const retry = useRef<{ body: string; key: string } | null>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const firstHotelRef = useRef<HTMLInputElement>(null);
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { clearErrors, register, handleSubmit, setError, setFocus, setValue, watch, formState: { errors, isDirty, isSubmitting } } = useForm<CreateAccountRequest>({
    defaultValues: { userType: "INTERNAL_STAFF", hotelIds: [], assignmentStartDate: defaultDate },
  });
  const userType = watch("userType");
  const clearStaleErrors = (...names: AccountFieldName[]) => {
    clearErrors(names);
    setFormError(null);
  };
  const userTypeRegistration = register("userType", {
    onChange: () => clearStaleErrors("userType"),
  });

  const showFormError = (message: string) => {
    setFormError(message);
    queueMicrotask(() => formErrorRef.current?.focus());
  };
  const closeCancelDialog = () => {
    cancelDialogRef.current?.close();
    document.getElementById("account-cancel-button")?.focus();
  };
  const requestCancel = () => {
    if (!isDirty) {
      router.push("/admin/users");
      return;
    }
    cancelDialogRef.current?.showModal();
    queueMicrotask(() => cancelDialogRef.current?.querySelector<HTMLButtonElement>("[data-continue-writing]")?.focus());
  };

  const submit = handleSubmit(async (raw) => {
    setFormError(null);
    const parsed = createAccountRequestSchema.safeParse(raw);
    if (!parsed.success) {
      let first: AccountFieldName | null = null;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          first ??= key as AccountFieldName;
          setError(key as AccountFieldName, { message: issue.message });
        }
      }
      if (first) queueMicrotask(() => first === "hotelIds" ? firstHotelRef.current?.focus() : setFocus(first));
      return;
    }
    const body = JSON.stringify(parsed.data);
    if (!retry.current || retry.current.body !== body) retry.current = { body, key: crypto.randomUUID() };
    let response: Response;
    let value: unknown;
    try {
      response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": retry.current.key },
        body,
      });
      value = await response.json();
    } catch {
      showFormError("서버에 연결할 수 없습니다. 입력값을 유지했으니 다시 시도해 주세요.");
      return;
    }
    if (!response.ok) {
      const failure = hotelErrorResponseSchema.safeParse(value);
      const message = failure.success ? failure.data.error.message : "사용자 계정을 생성하지 못했습니다.";
      setFormError(message);
      let serverErrorField: AccountFieldName | null = null;
      if (failure.success) for (const field of failure.data.error.fieldErrors) {
        if (field.field in parsed.data) {
          serverErrorField ??= field.field as AccountFieldName;
          setError(field.field as AccountFieldName, { message: field.message });
        }
      }
      if (serverErrorField) {
        queueMicrotask(() => serverErrorField === "hotelIds" ? firstHotelRef.current?.focus() : setFocus(serverErrorField));
      } else {
        queueMicrotask(() => formErrorRef.current?.focus());
      }
      return;
    }
    const created = accountDetailResponseSchema.safeParse(value);
    if (!created.success) { showFormError("저장 결과를 확인할 수 없습니다."); return; }
    try {
      const readBack = await fetch(`/api/admin/users/${created.data.data.account.id}`, { cache: "no-store" });
      const readBackBody: unknown = await readBack.json();
      const verified = accountDetailResponseSchema.safeParse(readBackBody);
      if (!readBack.ok || !verified.success) { showFormError("계정은 생성됐지만 재조회에 실패했습니다."); return; }
      if (!accountReadBackMatches(created.data.data.account, verified.data.data.account)) {
        showFormError("계정은 생성됐지만 재조회 결과가 일치하지 않습니다.");
        return;
      }
    } catch { showFormError("계정은 생성됐지만 재조회에 실패했습니다."); return; }
    retry.current = null;
    router.push(`/admin/users/${created.data.data.account.id}`);
    router.refresh();
  });

  const field = (name: AccountFieldName, label: string, type = "text") => {
    const registration = register(name, { onChange: () => clearStaleErrors(name) });
    return <label className="block text-sm font-semibold" htmlFor={`account-${name}`}>
      {label}<input aria-describedby={errors[name] ? `account-${name}-error` : undefined} aria-invalid={Boolean(errors[name])} aria-required="true" className={inputClassName} id={`account-${name}`} required type={type} {...registration} />
      {errors[name]?.message ? <span className="mt-1 block text-xs text-danger" id={`account-${name}-error`}>{errors[name]?.message}</span> : null}
    </label>;
  };

  return <form className="flex flex-col gap-6 pb-20 lg:pb-0" data-endpoint="/api/admin/users" noValidate onSubmit={submit}>
    {formError ? <div className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" ref={formErrorRef} role="alert" tabIndex={-1}>{formError}</div> : null}
    <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
      <h2 className="text-base font-semibold">기본정보</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{field("displayName", "표시이름")}{field("loginName", "로그인 아이디")}{field("email", "이메일", "email")}
        <label className="block text-sm font-semibold" htmlFor="account-userType">사용자유형<select aria-describedby={errors.userType ? "account-userType-error" : undefined} aria-invalid={Boolean(errors.userType)} aria-required="true" className={inputClassName} id="account-userType" required {...userTypeRegistration} onChange={(event) => {
          void userTypeRegistration.onChange(event);
          clearStaleErrors("userType", "hotelId", "hotelIds");
          if (event.target.value === "HOUSEKEEPING") setValue("hotelId", undefined);
          else setValue("hotelIds", []);
        }}><option value="INTERNAL_STAFF">사내 임직원</option><option value="HOUSEKEEPING">하우스키핑</option><option value="HOTEL_OWNER">호텔 소유주</option></select>{errors.userType?.message ? <span className="mt-1 block text-xs text-danger" id="account-userType-error">{errors.userType.message}</span> : null}</label>
      </div>
    </section>
    <section className="rounded-panel border border-border bg-surface p-5 md:p-6"><h2 className="text-base font-semibold">호텔배정·초기 로그인</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
      {userType === "HOUSEKEEPING" ? <fieldset aria-describedby="account-hotelIds-error" aria-invalid={Boolean(errors.hotelIds)} className="sm:col-span-2">
        <legend className="text-sm font-semibold">담당 호텔 <span className="text-muted">(1곳 이상)</span></legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{hotels.map((hotel, index) => {
          const registration = register("hotelIds", { onChange: () => clearStaleErrors("hotelIds") });
          return <label className="flex min-h-11 items-center gap-3 rounded-control border border-border px-3 py-2 text-sm" key={hotel.id}><input type="checkbox" value={hotel.id} {...registration} ref={(node) => { registration.ref(node); if (index === 0) firstHotelRef.current = node; }} />{hotel.name}</label>;
        })}</div>
        <span className={`mt-1 block text-xs ${errors.hotelIds ? "text-danger" : "sr-only"}`} id="account-hotelIds-error">{errors.hotelIds?.message ?? "담당 호텔을 1곳 이상 선택해야 합니다."}</span>
      </fieldset> : <label className="block text-sm font-semibold" htmlFor="account-hotelId">호텔<select aria-describedby={errors.hotelId ? "account-hotelId-error" : undefined} aria-invalid={Boolean(errors.hotelId)} aria-required="true" className={inputClassName} id="account-hotelId" required {...register("hotelId", { onChange: () => clearStaleErrors("hotelId") })}><option value="">호텔 선택</option>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select>{errors.hotelId?.message ? <span className="mt-1 block text-xs text-danger" id="account-hotelId-error">{errors.hotelId.message}</span> : null}</label>}
      {field("assignmentStartDate", "배정 시작일", "date")}
      <label className="block text-sm font-semibold" htmlFor="account-initialPassword">임시 비밀번호
        <input aria-describedby={errors.initialPassword ? "account-initialPassword-policy account-initialPassword-error" : "account-initialPassword-policy"} aria-invalid={Boolean(errors.initialPassword)} aria-required="true" className={inputClassName} id="account-initialPassword" maxLength={400} minLength={8} required type="password" {...register("initialPassword", { onChange: () => clearStaleErrors("initialPassword") })} />
        <span className="mt-1 block text-xs text-muted" id="account-initialPassword-policy">8자 이상 200자 이하이며 영문 소문자, 숫자, 기호를 각각 포함해야 합니다.</span>
        {errors.initialPassword?.message ? <span className="mt-1 block text-xs text-danger" id="account-initialPassword-error">{errors.initialPassword.message}</span> : null}
      </label>
      {field("reason", "생성 사유")}
    </div></section>
    <dialog aria-labelledby="account-cancel-title" aria-modal="true" className="m-auto w-[min(92vw,32rem)] rounded-panel border border-warning/40 bg-surface p-0 text-text shadow-panel backdrop:bg-slate-950/35" onCancel={(event) => { event.preventDefault(); closeCancelDialog(); }} ref={cancelDialogRef} role="alertdialog">
      <div className="p-5"><p className="font-semibold" id="account-cancel-title">작성 중인 내용을 폐기하시겠습니까?</p>
        <p className="mt-1 text-sm text-muted">입력한 계정 정보는 저장되지 않습니다.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Button className="min-h-11" data-continue-writing onClick={closeCancelDialog} type="button" variant="secondary">계속 작성</Button><Button className="min-h-11" onClick={() => router.push("/admin/users")} type="button" variant="secondary">내용 폐기</Button></div>
      </div>
    </dialog>
    <div className="flex justify-end gap-2"><Button className="min-h-11" id="account-cancel-button" onClick={requestCancel} type="button" variant="secondary">취소</Button><Button className="min-h-11" disabled={isSubmitting} type="submit">{isSubmitting ? "생성 중…" : "사용자 생성"}</Button></div>
  </form>;
}
