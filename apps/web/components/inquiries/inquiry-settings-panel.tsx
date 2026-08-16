"use client";
import {
  hotelErrorResponseSchema,
  hotelInquiryContactSchema,
  hotelInquiryRoutes,
  hotelInquirySettingsResponseSchema,
  type HotelInquiryCapability,
} from "@werehere/contracts";
import { Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import type { z } from "zod";

type Settings = z.infer<typeof hotelInquirySettingsResponseSchema>["data"];
type PendingSettingsMutation = {
  body: unknown;
  idempotencyKey: string;
  path: string;
  signature: string;
};
const field =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

export async function idempotentSettingsPut(
  path: string,
  body: unknown,
  idempotencyKey = crypto.randomUUID(),
) {
  const serializedBody = JSON.stringify(body),
    execute = () =>
      fetch(path, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: serializedBody,
      });
  let response: Response;
  try {
    response = await execute();
    if (response.status >= 500) response = await execute();
  } catch {
    response = await execute();
  }
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = hotelErrorResponseSchema.safeParse(payload);
    throw new Error(
      error.success ? error.data.error.message : "설정을 저장하지 못했습니다.",
    );
  }
  return payload;
}

export function InquirySettingsPanel({
  hotelId,
  capability,
  initialSettings,
}: {
  hotelId: string;
  capability: HotelInquiryCapability;
  initialSettings: Settings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingContactRef = useRef<PendingSettingsMutation | null>(null);
  const pendingRoutesRef = useRef(new Map<string, PendingSettingsMutation>());
  const [contact, setContact] = useState(
    initialSettings.contact ?? {
      phone: "",
      email: "",
      operatingHours: "",
      version: 0,
    },
  );
  if (!capability.canManageSettings) return null;
  async function saveContact() {
    setBusy(true);
    setError("");
    try {
      const signature = JSON.stringify(contact);
      let pending = pendingContactRef.current;
      if (!pending || pending.signature !== signature) {
        pending = {
          body: contact,
          idempotencyKey: crypto.randomUUID(),
          path: hotelInquiryRoutes.settingsContact(hotelId),
          signature,
        };
        pendingContactRef.current = pending;
      }
      const payload = await idempotentSettingsPut(
        pending.path,
        pending.body,
        pending.idempotencyKey,
      );
      const parsed = hotelInquiryContactSchema.safeParse(
        (payload as { data?: { contact?: unknown } })?.data?.contact,
      );
      if (!parsed.success)
        throw new Error("문의처 응답을 확인하지 못했습니다.");
      pendingContactRef.current = null;
      setContact(parsed.data);
      setSettings((current) => ({ ...current, contact: parsed.data }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "설정을 저장하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveRoute(
    categoryCode: Settings["routes"][number]["categoryCode"],
    groupId: string | null,
    version: number,
  ) {
    setBusy(true);
    setError("");
    try {
      const body = { version, groupId, active: true },
        signature = JSON.stringify(body);
      let pending = pendingRoutesRef.current.get(categoryCode);
      if (!pending || pending.signature !== signature) {
        pending = {
          body,
          idempotencyKey: crypto.randomUUID(),
          path: hotelInquiryRoutes.settingsRoute(hotelId, categoryCode),
          signature,
        };
        pendingRoutesRef.current.set(categoryCode, pending);
      }
      const payload = await idempotentSettingsPut(
        pending.path,
        pending.body,
        pending.idempotencyKey,
      );
      const parsed = hotelInquirySettingsResponseSchema.safeParse(payload);
      if (!parsed.success)
        throw new Error("라우팅 응답을 확인하지 못했습니다.");
      pendingRoutesRef.current.delete(categoryCode);
      setSettings(parsed.data.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "설정을 저장하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-panel border border-border bg-surface p-4">
      <button
        aria-controls="owner-inquiry-settings-fields"
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border px-4 text-sm font-semibold"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Settings2 aria-hidden="true" size={18} /> 문의처·담당그룹 설정
      </button>
      {open ? (
        <div
          id="owner-inquiry-settings-fields"
          className="mt-4 space-y-5"
        >
          {error ? (
            <p
              className="rounded-control bg-danger/5 p-3 text-sm text-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">
              전화번호
              <input
                className={field}
                value={contact.phone}
                onChange={(event) =>
                  setContact((value) => ({
                    ...value,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium">
              이메일
              <input
                className={field}
                type="email"
                value={contact.email}
                onChange={(event) =>
                  setContact((value) => ({
                    ...value,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium">
              운영시간
              <input
                className={field}
                value={contact.operatingHours}
                onChange={(event) =>
                  setContact((value) => ({
                    ...value,
                    operatingHours: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <button
            className={button}
            disabled={busy}
            onClick={saveContact}
            type="button"
          >
            문의처 저장
          </button>
          <div className="space-y-2">
            <h3 className="font-semibold">문의유형별 담당그룹</h3>
            {settings.routes.map((route) => (
              <label
                className="grid gap-2 text-sm sm:grid-cols-[minmax(10rem,1fr)_minmax(14rem,2fr)] sm:items-center"
                key={route.categoryCode}
              >
                <span>{route.categoryName}</span>
                <select
                  className={field}
                  disabled={busy}
                  value={route.groupId ?? ""}
                  onChange={(event) =>
                    saveRoute(
                      route.categoryCode,
                      event.target.value || null,
                      route.version,
                    )
                  }
                >
                  <option value="">기본 운영문의함</option>
                  {settings.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
