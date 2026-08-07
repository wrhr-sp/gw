"use client";

import {
  createRepairCaseRequestSchema,
  createRepairVisitRequestSchema,
  hotelErrorResponseSchema,
  hotelFileRoutes,
  repairCaseResponseSchema,
  repairListResponseSchema,
  repairRoutes,
  type HotelAssignmentView,
  type HotelCommonArea,
  type HotelFacility,
  type RepairCase,
} from "@werehere/contracts";
import { Dialog } from "@werehere/ui";
import { useMutation } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronRight,
  Link2,
  Image as ImageIcon,
  Pencil,
  Plus,
  RotateCcw,
  Wrench,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

type RepairSummary = Omit<RepairCase, "visits">;
type Priority = RepairCase["priority"] & { status: "ACTIVE" | "INACTIVE" | "DELETED" };
type FacilityData = {
  commonAreas: HotelCommonArea[];
  facilities: HotelFacility[];
  roomLocations: { id: string; name: string }[];
};
type TargetOption = { id: string; key: string; label: string; type: "ROOM" | "COMMON_AREA" | "FACILITY" };
type CreateFields = { description: string; priorityId: string; targetKey: string; unavailableReason: string };
type VisitFields = {
  contactName: string;
  contactPhone: string;
  contractorName: string;
  endsAt: string;
  performerType: "INTERNAL" | "EXTERNAL";
  reason: string;
  startsAt: string;
  title: string;
  userId: string;
};

const fieldClass = "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function localDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function requestMutation(path: string, method: "PATCH" | "POST", body: unknown) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    method,
  });
  const value = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = hotelErrorResponseSchema.safeParse(value);
    throw new Error(parsed.success ? parsed.data.error.message : "요청을 처리하지 못했습니다.");
  }
  return value;
}

export function RepairWorkspace({
  assignments,
  facilityData,
  hotelId,
  initialRepairs,
  initialSelected,
  priorities,
}: {
  assignments: HotelAssignmentView[];
  facilityData: FacilityData;
  hotelId: string;
  initialRepairs: RepairSummary[];
  initialSelected: RepairCase | null;
  priorities: Priority[];
}) {
  const [repairs, setRepairs] = useState(initialRepairs);
  const [selected, setSelected] = useState(initialSelected);
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [followUpParent, setFollowUpParent] = useState<RepairCase | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<RepairCase["visits"][number] | null>(null);
  const [completionVisit, setCompletionVisit] = useState<RepairCase["visits"][number] | null>(null);
  const [completionResult, setCompletionResult] = useState("");
  const [completionReason, setCompletionReason] = useState("");
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const visitTriggerRef = useRef<HTMLButtonElement>(null);
  const targets = useMemo<TargetOption[]>(
    () => [
      ...facilityData.roomLocations.map((room) => ({ id: room.id, key: `ROOM:${room.id}`, label: `객실 · ${room.name}`, type: "ROOM" as const })),
      ...facilityData.commonAreas.filter((area) => area.status === "ACTIVE").map((area) => ({ id: area.id, key: `COMMON_AREA:${area.id}`, label: `공용공간 · ${area.name}`, type: "COMMON_AREA" as const })),
      ...facilityData.facilities.filter((facility) => facility.status === "ACTIVE").map((facility) => ({ id: facility.id, key: `FACILITY:${facility.id}`, label: `시설물 · ${facility.name} (${facility.location.name})`, type: "FACILITY" as const })),
    ],
    [facilityData],
  );
  const internalPerformers = useMemo(
    () => assignments.filter((assignment) => ["INTERNAL_STAFF", "HOUSEKEEPING"].includes(assignment.assignee.userType)),
    [assignments],
  );
  const createForm = useForm<CreateFields>({ defaultValues: { description: "", priorityId: priorities[0]?.id ?? "", targetKey: targets[0]?.key ?? "", unavailableReason: "" } });
  const visitForm = useForm<VisitFields>({ defaultValues: { contactName: "", contactPhone: "", contractorName: "", endsAt: "", performerType: "INTERNAL", reason: "", startsAt: "", title: "", userId: internalPerformers[0]?.assignee.userId ?? "" } });
  const performerType = visitForm.watch("performerType");
  const sourceFileVersionIds = selected?.source && typeof selected.source === "object" && "fileVersionIds" in selected.source && Array.isArray(selected.source.fileVersionIds)
    ? selected.source.fileVersionIds.filter((value): value is string => typeof value === "string")
    : [];

  async function selectRepair(id: string) {
    setMessage("");
    const response = await fetch(repairRoutes.detail(hotelId, id), { cache: "no-store" });
    const parsed = repairCaseResponseSchema.safeParse(await response.json().catch(() => undefined));
    if (!response.ok || !parsed.success) {
      setMessage("보수 상세를 불러오지 못했습니다.");
      return null;
    }
    setSelected(parsed.data.data.repair);
    return parsed.data.data.repair;
  }

  async function refresh(repairId = selected?.id) {
    if (repairId) await selectRepair(repairId);
    const response = await fetch(`${repairRoutes.list(hotelId)}?page=1&pageSize=100&status=OPEN`, { cache: "no-store" });
    const parsed = repairListResponseSchema.safeParse(await response.json().catch(() => undefined));
    if (response.ok && parsed.success) setRepairs(parsed.data.data.repairs);
  }

  function openCreate(parent: RepairCase | null) {
    setFollowUpParent(parent);
    const target = parent ? `${parent.target.type}:${parent.target.id}` : targets[0]?.key ?? "";
    createForm.reset({ description: "", priorityId: priorities[0]?.id ?? "", targetKey: target, unavailableReason: "" });
    setCreateOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: async (fields: CreateFields) => {
      const target = targets.find((item) => item.key === fields.targetKey);
      if (!target) throw new Error("보수 대상을 선택해 주세요.");
      const targetValue = target.type === "ROOM"
        ? { type: "ROOM" as const, roomId: target.id }
        : target.type === "COMMON_AREA"
          ? { type: "COMMON_AREA" as const, commonAreaId: target.id }
          : { type: "FACILITY" as const, facilityId: target.id };
      const value = createRepairCaseRequestSchema.parse({
        followUpOfRepairCaseId: followUpParent?.id ?? null,
        followUpParentVersion: followUpParent?.version ?? null,
        priorityId: fields.priorityId,
        repairCaseId: crypto.randomUUID(),
        source: { description: fields.description, fileVersionIds: [], type: "DIRECT", unavailableReason: fields.unavailableReason },
        target: targetValue,
      });
      return requestMutation(repairRoutes.create(hotelId), "POST", value);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "보수를 등록하지 못했습니다."),
    onSuccess: async (value) => {
      const parsed = repairCaseResponseSchema.safeParse(value);
      if (!parsed.success) return setMessage("보수 등록 응답을 안전하게 확인하지 못했습니다.");
      setMessage("보수를 등록했습니다.");
      setCreateOpen(false);
      await refresh(parsed.data.data.repair.id);
    },
  });

  function openVisit(visit: RepairCase["visits"][number] | null) {
    setEditingVisit(visit);
    visitForm.reset({
      contactName: visit?.performer.type === "EXTERNAL" ? visit.performer.contactName ?? "" : "",
      contactPhone: visit?.performer.type === "EXTERNAL" ? visit.performer.contactPhone : "",
      contractorName: visit?.performer.type === "EXTERNAL" ? visit.performer.contractorName : "",
      endsAt: visit ? visit.endsAt.slice(0, 16) : "",
      performerType: visit?.performer.type ?? "INTERNAL",
      reason: "",
      startsAt: visit ? visit.startsAt.slice(0, 16) : "",
      title: visit?.title ?? "",
      userId: visit?.performer.type === "INTERNAL" ? visit.performer.userId : internalPerformers[0]?.assignee.userId ?? "",
    });
    setVisitOpen(true);
  }

  const visitMutation = useMutation({
    mutationFn: async (fields: VisitFields) => {
      if (!selected) throw new Error("보수 건을 먼저 선택해 주세요.");
      const performer = fields.performerType === "INTERNAL"
        ? { type: "INTERNAL" as const, userId: fields.userId }
        : { contactName: fields.contactName.trim() || null, contactPhone: fields.contactPhone, contractorName: fields.contractorName, type: "EXTERNAL" as const };
      const base = { endsAt: localDateTime(fields.endsAt), performer, startsAt: localDateTime(fields.startsAt), title: fields.title };
      if (editingVisit)
        return requestMutation(repairRoutes.visit(hotelId, editingVisit.id), "PATCH", { ...base, reason: fields.reason, version: editingVisit.version });
      const value = createRepairVisitRequestSchema.parse({ ...base, repairCaseId: selected.id });
      return requestMutation(repairRoutes.visits(hotelId), "POST", value);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "방문일정을 저장하지 못했습니다."),
    onSuccess: async () => {
      setMessage(editingVisit ? "방문일정을 수정했습니다." : "방문일정을 등록했습니다.");
      setVisitOpen(false);
      await refresh();
    },
  });

  const commandMutation = useMutation({
    mutationFn: async ({ body, path }: { body: unknown; path: string }) => requestMutation(path, "POST", body),
    onError: (error) => setMessage(error instanceof Error ? error.message : "업무 상태를 변경하지 못했습니다."),
    onSuccess: async () => { setMessage("서버에 변경사항을 저장했습니다."); await refresh(); },
  });

  async function completeVisit() {
    if (!completionVisit) return;
    await commandMutation.mutateAsync({
      body: { fileVersionIds: [], result: completionResult, unavailableReason: completionReason, version: completionVisit.version },
      path: repairRoutes.visitComplete(hotelId, completionVisit.id),
    });
    setCompletionVisit(null);
    setCompletionResult("");
    setCompletionReason("");
  }

  const busy = createMutation.isPending || visitMutation.isPending || commandMutation.isPending;
  return (
    <section aria-labelledby="repair-title" className="space-y-4 pb-20 md:pb-0" data-repair-workspace>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 id="repair-title" className="text-2xl font-bold text-primary">하자·보수</h1><p className="text-sm text-muted">하자 등록부터 방문 작업과 최종완료까지 실제 저장 상태로 관리합니다.</p></div>
        <button ref={createTriggerRef} className={`${actionClass} bg-primary text-white`} disabled={priorities.length === 0 || targets.length === 0} onClick={() => openCreate(null)}><Plus aria-hidden="true" size={16}/>보수 등록</button>
      </header>
      {priorities.length === 0 ? <p role="alert" className="rounded-control border border-amber-300 bg-amber-50 p-3 text-sm">활성 우선순위가 없어 보수를 등록할 수 없습니다. 관리자 설정을 확인해 주세요.</p> : null}
      {message ? <p aria-live="polite" role="status" className="rounded-control border border-border bg-background p-3 text-sm">{message}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_480px]">
        <div className="rounded-panel border border-border bg-surface">
          <div className="hidden grid-cols-[1fr_140px_120px] border-b border-border px-4 py-3 text-xs font-semibold text-muted md:grid"><span>대상·하자</span><span>우선순위</span><span>상태</span></div>
          {repairs.length === 0 ? <p className="p-6 text-sm text-muted">등록된 진행 중 보수가 없습니다.</p> : repairs.map((repair) => <button key={repair.id} aria-current={selected?.id === repair.id ? "true" : undefined} aria-label={`${repair.target.name} 보수 상세 보기`} className="grid min-h-16 w-full gap-2 border-b border-border p-4 text-left last:border-0 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:grid-cols-[1fr_140px_120px]" onClick={() => selectRepair(repair.id)}><span><strong className="block text-sm">{repair.target.name}</strong><small className="text-muted">{repair.source && typeof repair.source === "object" && "description" in repair.source ? String((repair.source as { description: string }).description) : "하자 보수"}</small></span><span className="inline-flex w-fit rounded-badge border border-border px-2 py-1 text-xs font-semibold">{repair.priority.name}</span><span className="text-xs">{repair.status === "OPEN" ? "진행 중" : "완료"}</span></button>)}
        </div>
        <section aria-label="보수 상세" className="rounded-panel border border-border bg-surface p-4">
          {selected ? <>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">선택 보수</p><h2 className="text-lg font-bold">{selected.target.name}</h2></div><span className="rounded-badge bg-amber-100 px-2 py-1 text-xs font-semibold">{selected.priority.name}</span></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted">대상</dt><dd>{selected.target.type}</dd></div><div><dt className="text-xs text-muted">업무상태</dt><dd>{selected.process.state}</dd></div></dl>
            {sourceFileVersionIds.length > 0 ? <div className="mt-5 space-y-2"><h3 className="font-semibold">등록 증빙</h3>{sourceFileVersionIds.map((fileVersionId, index) => <a className="flex min-h-11 items-center gap-2 rounded-control border border-border px-3 text-sm" href={hotelFileRoutes.repairView(hotelId, selected.id, fileVersionId)} key={fileVersionId}><ImageIcon aria-hidden="true" size={16}/>등록 증빙 {index + 1} 보기</a>)}</div> : null}
            <div className="mt-5 space-y-2"><div className="flex items-center justify-between"><h3 className="font-semibold">방문일정</h3><button ref={visitTriggerRef} className={`${actionClass} border border-primary text-primary`} disabled={selected.status === "COMPLETED"} onClick={() => openVisit(null)}><Plus size={16}/>등록</button></div>
              {selected.visits.length === 0 ? <p className="rounded-control bg-background p-3 text-sm text-muted">일정 미정</p> : selected.visits.map((visit) => <article key={visit.id} className="rounded-card border border-border p-3"><div className="flex items-center gap-2"><CalendarClock aria-hidden="true" size={18}/><strong>{visit.title}</strong></div><p className="mt-1 text-xs text-muted">{new Date(visit.startsAt).toLocaleString("ko-KR")} · {visit.status}</p>{visit.fileVersionIds.map((fileVersionId, index) => <a className="mt-2 flex min-h-11 items-center gap-2 rounded-control border border-border px-3 text-sm" href={hotelFileRoutes.repairView(hotelId, selected.id, fileVersionId)} key={fileVersionId}><ImageIcon aria-hidden="true" size={16}/>완료 증빙 {index + 1} 보기</a>)}{visit.status === "SCHEDULED" ? <div className="mt-3 flex flex-wrap gap-2"><button className={`${actionClass} border border-border`} onClick={() => openVisit(visit)}><Pencil size={15}/>수정</button><button className={`${actionClass} border border-border`} onClick={() => commandMutation.mutate({ body: { reason: "현장 일정 취소", version: visit.version }, path: repairRoutes.visitCancel(hotelId, visit.id) })}><XCircle size={15}/>취소</button><button className={`${actionClass} bg-accent text-white`} onClick={() => setCompletionVisit(visit)}><Wrench size={15}/>방문완료</button></div> : visit.status === "CANCELLED" ? <button className={`${actionClass} mt-3 border border-border`} onClick={() => commandMutation.mutate({ body: { reason: "방문일정 복원", version: visit.version }, path: repairRoutes.visitRestore(hotelId, visit.id) })}><RotateCcw size={15}/>복원</button> : null}</article>)}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {selected.process.state === "PENDING_INPUT" ? <button className={`${actionClass} bg-primary text-white`} disabled={busy} onClick={() => commandMutation.mutate({ body: { processVersion: selected.process.version, version: selected.version }, path: repairRoutes.submitReview(hotelId, selected.id) })}>검토 요청</button> : null}
              {selected.process.state === "IN_REVIEW" ? <><button className={`${actionClass} bg-primary text-white`} disabled={busy} onClick={() => commandMutation.mutate({ body: { choiceValue: null, event: "APPROVE", processVersion: selected.process.version, reason: "보수 결과 승인" }, path: repairRoutes.transition(hotelId, selected.id) })}>승인</button><button className={`${actionClass} border border-red-300 text-red-700`} disabled={busy} onClick={() => commandMutation.mutate({ body: { choiceValue: null, event: "REJECT", processVersion: selected.process.version, reason: "보수 결과 보완 필요" }, path: repairRoutes.transition(hotelId, selected.id) })}>반려</button></> : null}
              {selected.process.state === "COMPLETED" && selected.status === "OPEN" ? <button className={`${actionClass} bg-primary text-white sm:col-span-2`} disabled={busy} onClick={() => commandMutation.mutate({ body: { processVersion: selected.process.version, version: selected.version }, path: repairRoutes.complete(hotelId, selected.id) })}>보수 최종완료</button> : null}
              {selected.status === "COMPLETED" ? <button className={`${actionClass} border border-primary text-primary sm:col-span-2`} onClick={() => openCreate(selected)}>후속 보수 등록</button> : null}
            </div>
            <nav aria-label="이전·후속 보수" className="mt-5 space-y-2">{selected.predecessor ? <a className="flex min-h-11 items-center gap-2 rounded-control border border-border px-3" href={`/hotels/${hotelId}/repairs?selected=${selected.predecessor.id}`}><Link2 size={16}/>이전 보수 보기</a> : null}<a className="flex min-h-11 items-center justify-between rounded-control border border-border px-3" href={repairRoutes.followUps(hotelId, selected.id)}><span>후속 보수 {selected.followUpCount}건</span><ChevronRight size={16}/></a></nav>
          </> : <p className="text-sm text-muted">목록에서 보수 건을 선택해 주세요.</p>}
        </section>
      </div>
      <div className="fixed inset-x-4 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 md:hidden"><button className="min-h-[52px] w-full rounded-control bg-primary font-semibold text-white" disabled={priorities.length === 0 || targets.length === 0} onClick={() => openCreate(null)}>보수 등록</button></div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} restoreFocusRef={createTriggerRef} title={followUpParent ? "후속 보수 등록" : "보수 등록"}>
        <form className="space-y-4" onSubmit={createForm.handleSubmit((value) => createMutation.mutate(value))}>
          <div><h2 className="text-xl font-bold">{followUpParent ? "후속 보수 등록" : "보수 등록"}</h2><p className="text-sm text-muted">활성 설정에서 우선순위를 직접 선택하고 현장 내용을 기록합니다.</p></div>
          <label className="block text-sm font-semibold">보수 대상<select className={`${fieldClass} mt-1`} {...createForm.register("targetKey", { required: true })}>{targets.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}</select></label>
          <label className="block text-sm font-semibold">우선순위<select className={`${fieldClass} mt-1`} {...createForm.register("priorityId", { required: true })}>{priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}</select></label>
          <label className="block text-sm font-semibold">하자 내용<textarea className={`${fieldClass} mt-1 min-h-24 py-3`} {...createForm.register("description", { minLength: 1, required: true })}/></label>
          <label className="block text-sm font-semibold">사진 미첨부 사유<textarea aria-describedby="repair-evidence-help" className={`${fieldClass} mt-1 min-h-20 py-3`} {...createForm.register("unavailableReason", { minLength: 2, required: true })}/><span id="repair-evidence-help" className="mt-1 block text-xs font-normal text-muted">사진을 첨부하지 못한 실제 사유를 기록해야 등록할 수 있습니다.</span></label>
          <button className={`${actionClass} w-full bg-primary text-white`} disabled={createMutation.isPending} type="submit">{createMutation.isPending ? "저장 중…" : "서버에 보수 등록"}</button>
        </form>
      </Dialog>

      <Dialog open={visitOpen} onOpenChange={setVisitOpen} restoreFocusRef={visitTriggerRef} title={editingVisit ? "방문일정 수정" : "방문일정 등록"}>
        <form className="space-y-4" onSubmit={visitForm.handleSubmit((value) => visitMutation.mutate(value))}>
          <h2 className="text-xl font-bold">{editingVisit ? "방문일정 수정" : "방문일정 등록"}</h2>
          <label className="block text-sm font-semibold">일정 제목<input className={`${fieldClass} mt-1`} {...visitForm.register("title", { required: true })}/></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">시작일시<input className={`${fieldClass} mt-1`} type="datetime-local" {...visitForm.register("startsAt", { required: true })}/></label><label className="block text-sm font-semibold">종료일시<input className={`${fieldClass} mt-1`} type="datetime-local" {...visitForm.register("endsAt", { required: true })}/></label></div>
          <fieldset className="space-y-2"><legend className="text-sm font-semibold">수행자</legend><div className="flex gap-4"><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" value="INTERNAL" {...visitForm.register("performerType")}/>내부 담당자</label><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" value="EXTERNAL" {...visitForm.register("performerType")}/>외부업체</label></div></fieldset>
          {performerType === "INTERNAL" ? <label className="block text-sm font-semibold">담당자<select className={`${fieldClass} mt-1`} {...visitForm.register("userId", { required: true })}>{internalPerformers.map((assignment) => <option key={assignment.id} value={assignment.assignee.userId}>{assignment.assignee.displayName}</option>)}</select></label> : <div className="grid gap-3"><label className="block text-sm font-semibold">업체명<input className={`${fieldClass} mt-1`} {...visitForm.register("contractorName", { required: true })}/></label><label className="block text-sm font-semibold">담당자명<input className={`${fieldClass} mt-1`} {...visitForm.register("contactName")}/></label><label className="block text-sm font-semibold">연락처<input autoComplete="tel" className={`${fieldClass} mt-1`} {...visitForm.register("contactPhone", { required: true })}/></label></div>}
          {editingVisit ? <label className="block text-sm font-semibold">수정 사유<textarea className={`${fieldClass} mt-1 min-h-20 py-3`} {...visitForm.register("reason", { minLength: 2, required: true })}/></label> : null}
          <button className={`${actionClass} w-full bg-primary text-white`} disabled={visitMutation.isPending || (performerType === "INTERNAL" && internalPerformers.length === 0)} type="submit">{visitMutation.isPending ? "저장 중…" : "방문일정 저장"}</button>
        </form>
      </Dialog>

      <Dialog open={completionVisit !== null} onOpenChange={(open) => { if (!open) setCompletionVisit(null); }} title="방문완료 기록">
        <div className="space-y-4"><h2 className="text-xl font-bold">방문완료 기록</h2><label className="block text-sm font-semibold">작업 결과<textarea className={`${fieldClass} mt-1 min-h-24 py-3`} onChange={(event) => setCompletionResult(event.target.value)} value={completionResult}/></label><label className="block text-sm font-semibold">완료사진 미첨부 사유<textarea className={`${fieldClass} mt-1 min-h-20 py-3`} onChange={(event) => setCompletionReason(event.target.value)} value={completionReason}/></label><button className={`${actionClass} w-full bg-primary text-white`} disabled={commandMutation.isPending || completionResult.trim().length < 1 || completionReason.trim().length < 2} onClick={completeVisit}>방문완료 저장</button></div>
      </Dialog>
    </section>
  );
}