"use client";

import FullCalendar, { type CalendarRef, type EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import koLocale from "@fullcalendar/react/locales/ko";
import {
  calendarCapabilitiesResponseSchema,
  calendarEventsResponseSchema,
  calendarRoutes,
  calendarVisitOptionsResponseSchema,
  createRepairVisitRequestSchema,
  repairVisitResponseSchema,
  type CalendarEvent,
  type CalendarEventsResponse,
} from "@werehere/contracts";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Temporal } from "temporal-polyfill";

type CalendarData = CalendarEventsResponse["data"];
type CalendarScope = { mode: "ALL"; hotelId: null } | { mode: "HOTEL"; hotelId: string };
type VisitFormValues = { hotelId: string; repairCaseId: string; title: string; startsAt: string; endsAt: string; performerId: string };
const VIEW_KEY = "werehere:hotel-calendar:view-v1";
const VISIT_OPERATION_KEY = "werehere:hotel-calendar:visit-operation-v1";
const TWO_HOURS = 2 * 60 * 60 * 1000;
export function seoulLocalDateTimeToInstant(value: string) {
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime("Asia/Seoul")
    .toInstant()
    .toString();
}
export function sameInstant(left: string, right: string) {
  return Temporal.Instant.compare(Temporal.Instant.from(left), Temporal.Instant.from(right)) === 0;
}
type VisitOperation = { fingerprint: string; key: string };
type VisitOperationStore = Record<string, { key: string }>;
function visitOperationStore(): VisitOperationStore {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(VISIT_OPERATION_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([fingerprint, value]) =>
      /^[a-f0-9]{64}$/u.test(fingerprint)
      && value !== null
      && typeof value === "object"
      && typeof (value as { key?: unknown }).key === "string"
      && /^[0-9a-f-]{36}$/iu.test((value as { key: string }).key),
    )) as VisitOperationStore;
  } catch { return {}; }
}
function storedVisitOperation(fingerprint: string): VisitOperation | null {
  const stored = visitOperationStore()[fingerprint];
  return stored ? { fingerprint, key: stored.key } : null;
}
function preserveVisitOperation(operation: VisitOperation) {
  try {
    const operations = visitOperationStore();
    operations[operation.fingerprint] = { key: operation.key };
    window.sessionStorage.setItem(VISIT_OPERATION_KEY, JSON.stringify(operations));
    return true;
  } catch { return false; }
}
function clearVisitOperation(fingerprint: string) {
  try {
    const operations = visitOperationStore();
    delete operations[fingerprint];
    window.sessionStorage.setItem(VISIT_OPERATION_KEY, JSON.stringify(operations));
  } catch { /* A stale key is safer than losing an uncertain operation. */ }
}
async function visitOperationFingerprint(path: string, body: unknown) {
  const bytes = new TextEncoder().encode(`POST\n${path}\n${JSON.stringify(body)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00+09:00`));
}
function timeLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
async function fetchAll(scope: CalendarScope, from: string, to: string) {
  const base = scope.mode === "ALL" ? calendarRoutes.all : calendarRoutes.hotel(scope.hotelId);
  const events: CalendarEvent[] = [];
  let cursor: string | null = null;
  let first: CalendarData | null = null;
  for (let page = 0; page < 25; page += 1) {
    const query = new URLSearchParams({ from, to, pageSize: "200" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`${base}?${query}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) throw new Error("업무 달력을 불러오지 못했습니다.");
    const parsed = calendarEventsResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("업무 달력 응답을 안전하게 확인하지 못했습니다.");
    first ??= parsed.data.data;
    events.push(...parsed.data.data.events);
    cursor = parsed.data.data.pagination.nextCursor;
    if (!cursor) return { ...first, events, pagination: { nextCursor: null } };
  }
  throw new Error("일정이 너무 많습니다. 호텔 또는 기간을 좁혀 주세요.");
}

export function CalendarWorkspace(props: { initialData: CalendarData; initialScope: CalendarScope }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
  }));
  return <QueryClientProvider client={queryClient}><CalendarWorkspaceContent {...props} /></QueryClientProvider>;
}

function CalendarWorkspaceContent({ initialData, initialScope }: { initialData: CalendarData; initialScope: CalendarScope }) {
  const [range, setRange] = useState(initialData.range);
  const [selectedDate, setSelectedDate] = useState(initialData.events[0] ? localDate(initialData.events[0].startsAt) : initialData.range.from);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek">("timeGridWeek");
  const [createOpen, setCreateOpen] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<CalendarRef>(null);
  const calendarSurfaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = calendarSurfaceRef.current;
    if (!root) return;
    const ensureAccessibleHeaders = () => {
      for (const header of root.querySelectorAll<HTMLElement>("[role='columnheader'],[role='rowheader']")) {
        if (header.querySelector("[data-calendar-a11y-header]")) continue;
        const text = header.getAttribute("aria-label") === "Timed" ? "시간" : header.getAttribute("aria-label");
        if (!text) continue;
        const label = document.createElement("span");
        label.className = "sr-only";
        label.dataset.calendarA11yHeader = "true";
        label.textContent = text;
        header.append(label);
      }
    };
    ensureAccessibleHeaders();
    const observer = new MutationObserver(ensureAccessibleHeaders);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null") as { view?: unknown; lastUsedAt?: unknown } | null;
      if (parsed && typeof parsed.lastUsedAt === "number" && Date.now() - parsed.lastUsedAt <= TWO_HOURS && (parsed.view === "dayGridMonth" || parsed.view === "timeGridWeek")) {
        setView(parsed.view);
        calendarRef.current?.getApi().changeView(parsed.view);
      } else localStorage.removeItem(VIEW_KEY);
    } catch { localStorage.removeItem(VIEW_KEY); }
  }, []);
  function changeView(next: "dayGridMonth" | "timeGridWeek") {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
    localStorage.setItem(VIEW_KEY, JSON.stringify({ view: next, lastUsedAt: Date.now() }));
  }
  const query = useQuery({
    queryKey: ["hotel-calendar", initialScope.mode, initialScope.hotelId, range.from, range.to],
    queryFn: () => fetchAll(initialScope, range.from, range.to),
    initialData: range.from === initialData.range.from && range.to === initialData.range.to ? initialData : undefined,
    staleTime: 30_000,
  });
  const data = query.data ?? initialData;
  const selected = data.events.find((event) => event.id === selectedEventId) ?? null;
  const dayEvents = useMemo(() => data.events.filter((event) => localDate(event.startsAt) === selectedDate), [data.events, selectedDate]);
  const fullCalendarEvents: EventInput[] = data.events.map((event) => ({
    id: `${event.type}:${event.id}`,
    title: event.type === "INSPECTION" ? "점검 마감" : event.title,
    start: event.startsAt,
    ...(event.endsAt ? { end: event.endsAt } : {}),
    classNames: [`calendar-event--${event.type.toLowerCase()}`, `calendar-event--${event.status.toLowerCase()}`],
    extendedProps: { sourceId: event.id },
  }));
  return (
    <section aria-labelledby="calendar-title" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold text-primary">호텔 운영</p><h1 id="calendar-title" className="text-2xl font-bold text-foreground">업무 달력</h1><p className="mt-1 text-sm text-muted">점검 마감과 보수 방문일정을 한 화면에서 확인합니다.</p></div>
        <button ref={createTriggerRef} className="inline-flex min-h-11 items-center gap-2 rounded-button bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!data.capabilities.canCreateVisit && initialScope.mode === "HOTEL"} onClick={() => setCreateOpen(true)} type="button"><Plus size={18}/>방문일정 등록</button>
      </header>
      <div aria-live="polite" className="sr-only">{query.isFetching ? "달력 일정을 불러오는 중입니다." : query.error ? "달력 일정을 불러오지 못했습니다." : `${data.events.length}개의 일정을 표시합니다.`}</div>
      {query.error ? <div className="rounded-panel border border-danger/30 bg-danger/5 p-4 text-sm text-danger" role="alert">{query.error instanceof Error ? query.error.message : "업무 달력을 불러오지 못했습니다."}</div> : null}
      <div className="hidden gap-4 md:grid md:grid-cols-[minmax(0,1fr)_480px]">
        <div ref={calendarSurfaceRef} className="calendar-surface rounded-panel border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-end gap-2" role="group" aria-label="달력 보기">
            <button aria-pressed={view === "dayGridMonth"} className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold aria-pressed:bg-primary aria-pressed:text-white" onClick={() => changeView("dayGridMonth")} type="button">월간</button>
            <button aria-pressed={view === "timeGridWeek"} className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold aria-pressed:bg-primary aria-pressed:text-white" onClick={() => changeView("timeGridWeek")} type="button">주간</button>
          </div>
          <FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialDate={selectedDate} initialView="timeGridWeek" locale={koLocale} timeZone="Asia/Seoul" firstDay={0} height="auto" nowIndicator dayMaxEvents={4} allDaySlot={false} slotMinTime="06:00:00" slotMaxTime="24:00:00" events={fullCalendarEvents} headerToolbar={{ left: "prev,next today", center: "title", right: "" }} datesSet={(info) => { const from = localDate(info.startStr); const to = localDate(info.endStr); if (from !== range.from || to !== range.to) setRange({ from, to, timeZone: "Asia/Seoul" }); }} dateClick={(info) => setSelectedDate(info.dateStr.slice(0, 10))} eventClick={(info) => { setSelectedEventId(String(info.event.extendedProps.sourceId)); setSelectedDate(localDate(info.event.start?.toISOString() ?? info.event.startStr)); }}/>
        </div>
        <EventDetail event={selected} selectedDate={selectedDate} events={dayEvents}/>
      </div>
      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between rounded-panel border border-border bg-surface p-2">
          <button aria-label="이전 날짜" className="grid min-h-11 min-w-11 place-items-center rounded-button" onClick={() => setSelectedDate(new Date(`${selectedDate}T00:00:00Z`).toISOString().slice(0,10).replace(selectedDate, new Date(Date.parse(`${selectedDate}T00:00:00Z`) - 86400000).toISOString().slice(0,10)))} type="button"><ChevronLeft/></button>
          <strong>{dateLabel(selectedDate)}</strong>
          <button aria-label="다음 날짜" className="grid min-h-11 min-w-11 place-items-center rounded-button" onClick={() => setSelectedDate(new Date(Date.parse(`${selectedDate}T00:00:00Z`) + 86400000).toISOString().slice(0,10))} type="button"><ChevronRight/></button>
        </div>
        {dayEvents.length === 0 ? <div className="rounded-panel border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">선택한 날짜에 업무가 없습니다.</div> : dayEvents.map((event) => <button key={`${event.type}:${event.id}`} className="w-full rounded-panel border border-border bg-surface p-4 text-left shadow-sm" onClick={() => setSelectedEventId(event.id)} type="button"><span className="text-xs font-semibold text-primary">{event.type === "INSPECTION" ? "점검 마감" : "보수 방문"}</span><strong className="mt-1 block">{event.title}</strong><span className="mt-2 block text-sm text-muted">{timeLabel(event.startsAt)} · {event.hotelName}</span><span className="mt-1 block text-sm">{event.targetSummary}</span></button>)}
        {selected ? <EventDetail event={selected} selectedDate={selectedDate} events={dayEvents}/> : null}
      </div>
      {createOpen ? <CreateVisitPanel
        data={data}
        scope={initialScope}
        onClose={() => {
          setCreateOpen(false);
          requestAnimationFrame(() => createTriggerRef.current?.focus());
        }}
        onCreated={async () => {
          const refreshed = await query.refetch();
          if (refreshed.error) throw new Error("저장된 방문일정을 화면에서 다시 확인하지 못했습니다.");
          setCreateOpen(false);
          requestAnimationFrame(() => createTriggerRef.current?.focus());
        }}
      /> : null}
    </section>
  );
}

function EventDetail({ event, selectedDate, events }: { event: CalendarEvent | null; selectedDate: string; events: CalendarEvent[] }) {
  return (
    <div aria-label="일정 상세" className="rounded-panel border border-border bg-surface p-5 shadow-sm" role="region">
      <div className="flex items-center gap-2">
        <CalendarDays className="text-accent" />
        <h2 className="text-lg font-bold">{event ? "일정 상세" : dateLabel(selectedDate)}</h2>
      </div>
      {event ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold text-primary">{event.type === "INSPECTION" ? "점검 마감" : "보수 방문일정"}</p>
          <h3 className="text-xl font-bold">{event.title}</h3>
          <dl className="grid grid-cols-[100px_1fr] gap-y-3 text-sm">
            <dt className="text-muted">호텔</dt><dd>{event.hotelName}</dd>
            <dt className="text-muted">시작</dt><dd>{dateLabel(localDate(event.startsAt))} {timeLabel(event.startsAt)}</dd>
            <dt className="text-muted">대상</dt><dd>{event.targetSummary}</dd>
            <dt className="text-muted">상태</dt><dd>{event.status}</dd>
          </dl>
          <Link className="inline-flex min-h-11 items-center rounded-button border border-border px-4 text-sm font-semibold" href={event.detailHref}>
            {event.type === "INSPECTION" ? "점검 화면 열기" : "보수 화면에서 변경"}
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{events.length ? "왼쪽 달력에서 일정을 선택해 주세요." : "선택한 날짜에 업무가 없습니다."}</p>
      )}
    </div>
  );
}

function CreateVisitPanel({ scope, data, onClose, onCreated }: { scope: CalendarScope; data: CalendarData; onClose(): void; onCreated(): Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<VisitFormValues>({
    defaultValues: { hotelId: scope.mode === "HOTEL" ? scope.hotelId : "" },
  });
  const hotelId = watch("hotelId");
  const dialogRef = useRef<HTMLElement>(null);
  const operationRef = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    return () => document.removeEventListener("keydown", handleDialogKey);
  }, [isSubmitting, onClose]);
  const capabilities = useQuery({ queryKey: ["calendar-capabilities"], queryFn: async () => { const response = await fetch(calendarRoutes.capabilities); const parsed = calendarCapabilitiesResponseSchema.safeParse(await response.json().catch(() => undefined)); if (!response.ok || !parsed.success) throw new Error("호텔 권한을 확인하지 못했습니다."); return parsed.data.data; } });
  const availableHotels = capabilities.data?.hotels.filter((hotel) => hotel.canCreateVisit) ?? (data.capabilities.canCreateVisit && scope.mode === "HOTEL" ? data.hotels.map((hotel) => ({ ...hotel, canCreateVisit: true })) : []);
  const options = useQuery({ queryKey: ["calendar-visit-options", hotelId], enabled: Boolean(hotelId), queryFn: async () => { const response = await fetch(calendarRoutes.hotelVisitOptions(hotelId)); const payload = await response.json().catch(() => undefined); const parsed = calendarVisitOptionsResponseSchema.safeParse(payload); if (!response.ok || !parsed.success) throw new Error("방문일정 선택정보를 불러오지 못했습니다."); return parsed.data.data; } });
  async function submit(values: VisitFormValues) {
    setError(null);
    try {
      if (!hotelId) throw new Error("호텔을 선택해 주세요.");
      const body = createRepairVisitRequestSchema.parse({ repairCaseId: values.repairCaseId, title: values.title, startsAt: seoulLocalDateTimeToInstant(values.startsAt), endsAt: seoulLocalDateTimeToInstant(values.endsAt), performer: { type: "INTERNAL", userId: values.performerId } });
      const operationPath = `/api/hotels/${hotelId}/repair-visits`;
      const fingerprint = await visitOperationFingerprint(operationPath, body);
      const preserved = operationRef.current?.fingerprint === fingerprint
        ? operationRef.current
        : storedVisitOperation(fingerprint);
      if (!preserved) {
        operationRef.current = { fingerprint, key: crypto.randomUUID() };
        if (!preserveVisitOperation(operationRef.current))
          throw new Error("중복 저장 방지 정보를 안전하게 보존하지 못했습니다.");
      } else operationRef.current = preserved;
      const response = await fetch(operationPath, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": operationRef.current.key }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => undefined);
      const receipt = repairVisitResponseSchema.safeParse(payload);
      if (!response.ok || !receipt.success) throw new Error("방문일정을 저장하지 못했습니다.");
      const from = localDate(body.startsAt);
      const endDate = localDate(body.endsAt);
      const to = new Date(Date.parse(`${endDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      const readBack = await fetchAll({ mode: "HOTEL", hotelId }, from, to);
      const created = readBack.events.find((event) => event.type === "REPAIR_VISIT" && event.id === receipt.data.data.visit.id);
      if (!created || created.title !== body.title || !sameInstant(created.startsAt, body.startsAt) || !created.endsAt || !sameInstant(created.endsAt, body.endsAt))
        throw new Error("저장된 방문일정을 달력에서 다시 확인하지 못했습니다.");
      await onCreated();
      clearVisitOperation(fingerprint);
      operationRef.current = null;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "방문일정을 저장하지 못했습니다."); }
  }
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !isSubmitting) onClose(); }}><section ref={dialogRef} aria-labelledby="create-visit-title" className="h-full w-full max-w-[560px] overflow-y-auto bg-surface p-6 shadow-xl" role="dialog" aria-modal="true"><div className="flex items-center justify-between"><h2 id="create-visit-title" className="text-xl font-bold">보수 방문일정 등록</h2><button autoFocus aria-label="닫기" className="grid min-h-11 min-w-11 place-items-center rounded-button" disabled={isSubmitting} onClick={() => { if (!isSubmitting) onClose(); }} type="button"><X/></button></div><form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)}><label className="block text-sm font-semibold">호텔<select className="mt-2 min-h-11 w-full rounded-button border border-border bg-surface px-3" {...register("hotelId", { required: true })} disabled={scope.mode === "HOTEL"}><option value="" disabled>호텔 선택</option>{availableHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label><label className="block text-sm font-semibold">보수 건<select {...register("repairCaseId", { required: true })} className="mt-2 min-h-11 w-full rounded-button border border-border bg-surface px-3" required defaultValue=""><option value="" disabled>선택</option>{options.data?.repairs.map((repair) => <option key={repair.id} value={repair.id}>{repair.targetName} · {repair.priorityName}</option>)}</select></label><label className="block text-sm font-semibold">일정명<input {...register("title", { required: true, minLength: 1, maxLength: 150 })} className="mt-2 min-h-11 w-full rounded-button border border-border px-3" minLength={1} maxLength={150} required/></label><label className="block text-sm font-semibold">시작시각<input {...register("startsAt", { required: true })} type="datetime-local" className="mt-2 min-h-11 w-full rounded-button border border-border px-3" required/></label><label className="block text-sm font-semibold">종료시각<input {...register("endsAt", { required: true })} type="datetime-local" className="mt-2 min-h-11 w-full rounded-button border border-border px-3" required/></label><label className="block text-sm font-semibold">내부 수행자<select {...register("performerId", { required: true })} className="mt-2 min-h-11 w-full rounded-button border border-border bg-surface px-3" required defaultValue=""><option value="" disabled>선택</option>{options.data?.internalPerformers.map((person) => <option key={person.userId} value={person.userId}>{person.displayName}</option>)}</select></label>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}<button className="min-h-[52px] w-full rounded-button bg-primary px-4 font-semibold text-white disabled:opacity-50" disabled={isSubmitting || !hotelId} type="submit">{isSubmitting ? "저장 중…" : "방문일정 저장"}</button></form></section></div>;
}
