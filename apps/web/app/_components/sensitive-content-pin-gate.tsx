"use client";

import React, { useId, useMemo, useState, type ReactNode } from "react";

function sanitizePinValue(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function validateSensitivePagePin(pin: string, expectedPin = "2468") {
  const normalizedPin = sanitizePinValue(pin);

  if (normalizedPin.length !== 4) {
    return "2차 비밀번호 4자리를 입력해 주세요.";
  }

  if (normalizedPin !== expectedPin) {
    return "미리보기용 2차 비밀번호와 일치하지 않습니다.";
  }

  return null;
}

export function resolveSensitiveContentUnlock(pin: string, expectedPin = "2468") {
  const error = validateSensitivePagePin(pin, expectedPin);

  if (error) {
    return {
      error,
      isUnlocked: false,
      shouldRenderChildren: false,
    } as const;
  }

  return {
    error: null,
    isUnlocked: true,
    shouldRenderChildren: true,
  } as const;
}

function PinField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
}) {
  const inputId = useId();
  const describedBy = useMemo(() => {
    if (error) {
      return `${inputId}-error`;
    }

    return hint ? `${inputId}-hint` : undefined;
  }, [error, hint, inputId]);

  return (
    <div className="pin-field">
      <label className="pin-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className={error ? "pin-field__surface pin-field__surface--error" : "pin-field__surface"}>
        <input
          id={inputId}
          className="pin-field__input"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(sanitizePinValue(event.target.value))}
        />
        <span className="pin-field__slots" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => {
            const filled = index < value.length;
            return (
              <span key={`${label}-${index}`} className={filled ? "pin-field__slot pin-field__slot--filled" : "pin-field__slot"}>
                {filled ? "●" : ""}
              </span>
            );
          })}
        </span>
      </div>
      {hint ? (
        <small id={`${inputId}-hint`} className="pin-field__hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className="pin-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SensitiveContentPinGate({
  title,
  description,
  previewPin = "2468",
  children,
}: {
  title: string;
  description: string;
  previewPin?: string;
  children: ReactNode;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  function handleUnlock() {
    const result = resolveSensitiveContentUnlock(pin, previewPin);
    if (result.error) {
      setError(result.error);
      setIsUnlocked(false);
      return;
    }

    setError(null);
    setIsUnlocked(true);
  }

  return (
    <div className="topbar-settings-gate">
      <section className="topbar-modal-card topbar-modal-card--wide topbar-settings-gate__card">
        <div className="pill-row">
          <span className={isUnlocked ? "pill" : "pill pill--warning"}>{isUnlocked ? "민감 정보 확인 완료" : "민감 정보"}</span>
          <span className="pill">2차 비밀번호</span>
        </div>
        <strong>{title}</strong>
        <p className="topbar-modal-note">
          {isUnlocked ? "2차 비밀번호 확인이 끝나서 아래 콘텐츠를 계속 볼 수 있습니다." : description}
        </p>
        {isUnlocked ? null : (
          <>
            <PinField
              label="2차 비밀번호"
              value={pin}
              error={error}
              hint={`미리보기에서는 ${previewPin} 입력 시 콘텐츠 영역이 열립니다.`}
              onChange={(value) => {
                setPin(value);
                setError(null);
              }}
            />
            <div className="action-row">
              <button type="button" className="touch-button" onClick={handleUnlock}>
                콘텐츠 열기
              </button>
            </div>
          </>
        )}
      </section>
      {isUnlocked ? <div style={{ marginTop: 16 }}>{children}</div> : null}
    </div>
  );
}
