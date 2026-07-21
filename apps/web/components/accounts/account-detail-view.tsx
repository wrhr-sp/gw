"use client";

import { accountDetailResponseSchema, deactivateAccountRequestSchema, hotelErrorResponseSchema, type Account } from "@werehere/contracts";
import { Button, PageHeader, StatusBadge } from "@werehere/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const typeLabel = { INTERNAL_STAFF: "사내 임직원", HOUSEKEEPING: "하우스키핑", HOTEL_OWNER: "호텔 소유주" } as const;
const statusLabel = { PENDING_SETUP: "최초 설정 대기", ACTIVE: "활성", INACTIVE: "중지", LOCKED: "잠김" } as const;

export function AccountDetailView({ account, canSuspend }: { account: Account; canSuspend: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<{ body: string; key: string } | null>(null);

  const closeDialog = () => {
    dialogRef.current?.close();
    document.getElementById("account-suspend-button")?.focus();
  };
  const requestConfirmation = () => {
    const parsed = deactivateAccountRequestSchema.safeParse({ version: account.version, reason });
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message ?? "중지 사유를 확인해 주세요.");
      queueMicrotask(() => reasonRef.current?.focus());
      return;
    }
    setReasonError(null);
    setFormError(null);
    dialogRef.current?.showModal();
    queueMicrotask(() => dialogRef.current?.querySelector<HTMLButtonElement>("[data-cancel-suspension]")?.focus());
  };

  const deactivate = async () => {
    const parsed = deactivateAccountRequestSchema.safeParse({ version: account.version, reason });
    if (!parsed.success) {
      dialogRef.current?.close();
      setReasonError(parsed.error.issues[0]?.message ?? "중지 사유를 확인해 주세요.");
      queueMicrotask(() => reasonRef.current?.focus());
      return;
    }
    setReasonError(null); setFormError(null); setPending(true);
    const requestBody = JSON.stringify(parsed.data);
    if (!idempotencyKeyRef.current || idempotencyKeyRef.current.body !== requestBody) {
      idempotencyKeyRef.current = { body: requestBody, key: crypto.randomUUID() };
    }
    try {
      const response = await fetch(`/api/admin/users/${account.id}/deactivate`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKeyRef.current.key },
        body: requestBody,
      });
      const responseBody: unknown = await response.json();
      if (!response.ok) {
        const failure = hotelErrorResponseSchema.safeParse(responseBody);
        setFormError(failure.success ? failure.data.error.message : "계정을 중지하지 못했습니다.");
        dialogRef.current?.close();
        queueMicrotask(() => formErrorRef.current?.focus());
        return;
      }
      if (!accountDetailResponseSchema.safeParse(responseBody).success) {
        setFormError("중지 결과를 확인할 수 없습니다.");
        dialogRef.current?.close();
        queueMicrotask(() => formErrorRef.current?.focus());
        return;
      }
      idempotencyKeyRef.current = null;
      dialogRef.current?.close();
      router.refresh();
    } catch {
      setFormError("서버에 연결할 수 없습니다.");
      dialogRef.current?.close();
      queueMicrotask(() => formErrorRef.current?.focus());
    } finally { setPending(false); }
  };

  return <div className="mx-auto flex w-full max-w-hotel-detail flex-col gap-6">
    <PageHeader eyebrow="사용자 계정" title={account.displayName} description="로그인 identity와 호텔관리 업무계정의 현재 상태입니다." />
    <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
      <div className="flex items-center justify-between"><h2 className="font-semibold">계정정보</h2><StatusBadge>{statusLabel[account.status]}</StatusBadge></div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted">로그인 아이디</dt><dd className="mt-1 text-sm font-semibold">{account.loginName}</dd></div>
        <div><dt className="text-xs text-muted">이메일</dt><dd className="mt-1 text-sm">{account.email}</dd></div>
        <div><dt className="text-xs text-muted">사용자유형</dt><dd className="mt-1 text-sm">{typeLabel[account.userType]}</dd></div>
        <div><dt className="text-xs text-muted">연결 호텔</dt><dd className="mt-1 text-sm">{account.hotels?.length ? <ul className="space-y-1">{account.hotels.map((hotel) => <li className="break-words" key={hotel.id}>{hotel.name} ({hotel.code})</li>)}</ul> : account.hotelName ? `${account.hotelName}${account.hotelCode ? ` (${account.hotelCode})` : ""}` : account.hotelId ? "연결된 호텔 정보 확인 필요" : "없음"}</dd></div>
        <div><dt className="text-xs text-muted">데이터 버전</dt><dd className="mt-1 text-sm">{account.version}</dd></div>
      </dl>
    </section>
    {canSuspend && account.status !== "INACTIVE" ? (
      <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
        <h2 className="font-semibold">계정 중지</h2>
        {formError ? <div className="mt-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" ref={formErrorRef} role="alert" tabIndex={-1}>{formError}</div> : null}
        <label className="mt-4 block text-sm font-semibold" htmlFor="deactivate-reason">중지 사유
          <input
            aria-describedby={reasonError ? "deactivate-reason-error" : undefined}
            aria-invalid={Boolean(reasonError)}
            aria-required="true"
            className="mt-1 h-11 w-full rounded-control border border-border px-3"
            id="deactivate-reason"
            ref={reasonRef}
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(null);
              setFormError(null);
              if (dialogRef.current?.open) dialogRef.current.close();
              idempotencyKeyRef.current = null;
            }}
          />
        </label>
        {reasonError ? <p className="mt-2 text-sm text-danger" id="deactivate-reason-error" role="alert">{reasonError}</p> : null}
        <Button className="mt-4 min-h-11" disabled={pending} id="account-suspend-button" onClick={requestConfirmation} variant="secondary">
          계정 중지
        </Button>
        <dialog aria-labelledby="account-suspend-title" aria-modal="true" className="m-auto w-[min(92vw,32rem)] rounded-panel border border-danger/30 bg-surface p-0 text-text shadow-panel backdrop:bg-slate-950/35" onCancel={(event) => { event.preventDefault(); closeDialog(); }} ref={dialogRef} role="alertdialog">
          <div className="p-5">
            <p className="text-sm font-semibold text-danger" id="account-suspend-title">이 계정을 중지하시겠습니까?</p>
            <p className="mt-1 text-sm text-muted">기존 로그인 세션이 종료되고 다시 로그인할 수 없습니다.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="min-h-11" data-cancel-suspension disabled={pending} onClick={closeDialog} variant="secondary">취소</Button>
              <Button className="min-h-11" disabled={pending} onClick={deactivate} variant="secondary">{pending ? "중지 처리 중…" : "중지 확인"}</Button>
            </div>
          </div>
        </dialog>
      </section>
    ) : null}
  </div>;
}
