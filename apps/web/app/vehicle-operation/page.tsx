"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  vehicleListResponseSchema,
  vehicleOperationLogDetailResponseSchema,
  vehicleOperationLogListResponseSchema,
  vehicleOperationLogMutationResponseSchema,
  type Vehicle,
  type VehicleOperationLog,
  type VehicleOperationLogCreateRequest,
  type VehicleOperationPurpose,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type MutationState = "idle" | "submitting" | "success" | "error";

type ToastState = {
  tone: "accent" | "warning";
  title: string;
  body: string;
} | null;

type VehicleOperationData = {
  vehicles: Vehicle[];
  logs: VehicleOperationLog[];
};

const purposeLabels: Record<VehicleOperationPurpose, string> = {
  sales: "영업",
  delivery: "배송",
  commute: "출퇴근",
  site_visit: "현장 방문",
  maintenance: "정비",
  other: "기타",
};

const statusLabels: Record<VehicleOperationLog["status"], string> = {
  draft: "작성중",
  submitted: "제출",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

const statusTones: Record<VehicleOperationLog["status"], "accent" | "warning" | undefined> = {
  draft: "warning",
  submitted: "accent",
  approved: "accent",
  rejected: "warning",
  cancelled: undefined,
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCostTotal(log: VehicleOperationLog) {
  return log.fuelCost + log.tollCost + log.parkingCost + log.otherCost;
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data.error.message;
  }
  return `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(route: string, parse: (payload: unknown) => T) {
  const response = await fetch(route, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parse(await response.json());
}

async function fetchVehicleOperationData(): Promise<VehicleOperationData> {
  const [vehicles, logs] = await Promise.all([
    fetchJson(appRoutes.vehicleOperationLogs.vehicles, (payload) => {
      const parsed = vehicleListResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("차량 목록 응답 형식이 계약과 맞지 않습니다.");
      }
      return parsed.data.data.items;
    }),
    fetchJson(appRoutes.vehicleOperationLogs.logs, (payload) => {
      const parsed = vehicleOperationLogListResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("차량운행일지 목록 응답 형식이 계약과 맞지 않습니다.");
      }
      return parsed.data.data.items;
    }),
  ]);
  return { vehicles, logs };
}

async function submitVehicleOperationLog(request: VehicleOperationLogCreateRequest) {
  const response = await fetch(appRoutes.vehicleOperationLogs.create, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const parsed = vehicleOperationLogMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("차량운행일지 생성 응답 형식이 계약과 맞지 않습니다.");
  }
  const detailResponse = await fetch(appRoutes.vehicleOperationLogs.detail(parsed.data.data.log.id), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!detailResponse.ok) {
    throw new Error(await readErrorMessage(detailResponse));
  }
  const detailParsed = vehicleOperationLogDetailResponseSchema.safeParse(await detailResponse.json());
  if (!detailParsed.success) {
    throw new Error("차량운행일지 상세 응답 형식이 계약과 맞지 않습니다.");
  }
  return detailParsed.data.data.log;
}

async function submitVehicleOperationLogStatus(logId: string) {
  const response = await fetch(appRoutes.vehicleOperationLogs.submit(logId), {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const parsed = vehicleOperationLogMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("차량운행일지 제출 응답 형식이 계약과 맞지 않습니다.");
  }
  return parsed.data.data.log;
}

function VehicleOperationLogRow({ log, onSubmit }: { log: VehicleOperationLog; onSubmit: (logId: string) => void }) {
  return (
    <article className="feature-workspace__row">
      <div>
        <strong>{`${log.operationDate} · ${log.vehicleNumber}`}</strong>
        <span>{`${log.departurePlace} → ${log.arrivalPlace} · ${log.distanceKm}km · ${purposeLabels[log.purpose]}`}</span>
        <p>{`운전자 ${log.driverName} · 비용 ${formatCurrency(formatCostTotal(log))}원${log.memo ? ` · ${log.memo}` : ""}`}</p>
        <div className="feature-workspace__row-actions" aria-label={`${log.id} 차량운행일지 처리`}>
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled={log.status !== "draft"} onClick={() => onSubmit(log.id)} type="button">
            제출
          </button>
        </div>
      </div>
      <Pill tone={statusTones[log.status]}>{statusLabels[log.status]}</Pill>
    </article>
  );
}

export default function VehicleOperationPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<VehicleOperationLog[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [operationDate, setOperationDate] = useState(todayDate());
  const [purpose, setPurpose] = useState<VehicleOperationPurpose>("site_visit");
  const [departurePlace, setDeparturePlace] = useState("");
  const [arrivalPlace, setArrivalPlace] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [fuelCost, setFuelCost] = useState("0");
  const [tollCost, setTollCost] = useState("0");
  const [parkingCost, setParkingCost] = useState("0");
  const [otherCost, setOtherCost] = useState("0");
  const [memo, setMemo] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const draftCount = useMemo(() => logs.filter((log) => log.status === "draft").length, [logs]);
  const submittedCount = useMemo(() => logs.filter((log) => log.status === "submitted").length, [logs]);
  const totalDistance = useMemo(() => logs.reduce((total, log) => total + log.distanceKm, 0), [logs]);
  const totalCost = useMemo(() => logs.reduce((total, log) => total + formatCostTotal(log), 0), [logs]);

  async function reloadData() {
    setLoadState("loading");
    try {
      const data = await fetchVehicleOperationData();
      setVehicles(data.vehicles);
      setLogs(data.logs);
      setVehicleId((current) => current || data.vehicles[0]?.id || "");
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "차량운행일지를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => {
    void reloadData();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedDistance = Number(distanceKm);
    const costs = {
      fuelCost: Number(fuelCost || 0),
      tollCost: Number(tollCost || 0),
      parkingCost: Number(parkingCost || 0),
      otherCost: Number(otherCost || 0),
    };
    if (!vehicleId) {
      setToast({ tone: "warning", title: "저장 실패", body: "차량을 먼저 선택해 주세요." });
      return;
    }
    if (!departurePlace.trim() || !arrivalPlace.trim()) {
      setToast({ tone: "warning", title: "저장 실패", body: "출발지와 도착지를 입력해 주세요." });
      return;
    }
    if (!Number.isFinite(parsedDistance) || parsedDistance <= 0) {
      setToast({ tone: "warning", title: "저장 실패", body: "주행거리를 올바르게 입력해 주세요." });
      return;
    }
    if (Object.values(costs).some((value) => !Number.isFinite(value) || value < 0)) {
      setToast({ tone: "warning", title: "저장 실패", body: "비용은 0 이상의 숫자로 입력해 주세요." });
      return;
    }

    setMutationState("submitting");
    setToast(null);
    try {
      const created = await submitVehicleOperationLog({
        vehicleId,
        operationDate,
        purpose,
        departurePlace: departurePlace.trim(),
        arrivalPlace: arrivalPlace.trim(),
        distanceKm: parsedDistance,
        ...costs,
        memo: memo.trim() || undefined,
      });
      await reloadData();
      setDeparturePlace("");
      setArrivalPlace("");
      setDistanceKm("");
      setFuelCost("0");
      setTollCost("0");
      setParkingCost("0");
      setOtherCost("0");
      setMemo("");
      setMutationState("success");
      setToast({ tone: "accent", title: "차량운행일지 저장 완료", body: `${created.vehicleNumber} 운행일지를 저장하고 다시 조회했습니다.` });
    } catch (error) {
      setMutationState("error");
      setToast({ tone: "warning", title: "차량운행일지 저장 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  async function handleSubmitLog(logId: string) {
    setMutationState("submitting");
    setToast(null);
    try {
      const submitted = await submitVehicleOperationLogStatus(logId);
      await reloadData();
      setMutationState("success");
      setToast({ tone: "accent", title: "차량운행일지 제출 완료", body: `${submitted.vehicleNumber} 운행일지를 제출하고 다시 조회했습니다.` });
    } catch (error) {
      setMutationState("error");
      setToast({ tone: "warning", title: "차량운행일지 제출 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  return (
    <PageShell
      title="차량운행일지"
      titlePlacement="content"
      titleHref={null}
      actions={<FeaturePageOverflowMenu label="차량운행일지" />}
    >
      <section className="feature-workspace" aria-label="차량운행일지 업무">
        <aside className="feature-workspace__nav" aria-label="차량운행일지 메뉴">
          <button className="feature-workspace__nav-item feature-workspace__nav-item--active" type="button">
            운행일지
          </button>
          <button className="feature-workspace__nav-item" type="button" disabled>
            차량관리
          </button>
          <button className="feature-workspace__nav-item" type="button" disabled>
            외부연동
          </button>
        </aside>

        <div className="feature-workspace__panel">
          <header className="feature-workspace__panel-header">
            <div>
              <strong>차량 운행 기록</strong>
              <span>{loadState === "loading" ? "불러오는 중" : "실제 API 저장·조회 기준"}</span>
            </div>
            <Pill tone={loadState === "error" ? "warning" : "accent"}>{loadState === "error" ? "확인 필요" : "DB 연결"}</Pill>
          </header>

          <div className="feature-workspace__status-grid" aria-label="차량운행일지 요약">
            <article className="feature-workspace__status-card"><span>작성중</span><strong>{`${draftCount}건`}</strong></article>
            <article className="feature-workspace__status-card"><span>제출</span><strong>{`${submittedCount}건`}</strong></article>
            <article className="feature-workspace__status-card"><span>총 주행</span><strong>{`${totalDistance.toFixed(1)}km`}</strong></article>
            <article className="feature-workspace__status-card"><span>총 비용</span><strong>{`${formatCurrency(totalCost)}원`}</strong></article>
          </div>

          {toast ? (
            <div className={`feature-workspace__notice feature-workspace__notice--${toast.tone}`} role="status">
              <strong>{toast.title}</strong>
              <span>{toast.body}</span>
            </div>
          ) : null}

          <form className="feature-workspace__form" onSubmit={handleCreate}>
            <label>
              <span>차량</span>
              <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{`${vehicle.vehicleNumber} · ${vehicle.displayName}`}</option>
                ))}
              </select>
            </label>
            <label>
              <span>운행일</span>
              <input type="date" value={operationDate} onChange={(event) => setOperationDate(event.target.value)} />
            </label>
            <label>
              <span>목적</span>
              <select value={purpose} onChange={(event) => setPurpose(event.target.value as VehicleOperationPurpose)}>
                {Object.entries(purposeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>출발지</span>
              <input value={departurePlace} onChange={(event) => setDeparturePlace(event.target.value)} />
            </label>
            <label>
              <span>도착지</span>
              <input value={arrivalPlace} onChange={(event) => setArrivalPlace(event.target.value)} />
            </label>
            <label>
              <span>주행거리(km)</span>
              <input inputMode="decimal" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} />
            </label>
            <label>
              <span>유류비</span>
              <input inputMode="numeric" value={fuelCost} onChange={(event) => setFuelCost(event.target.value)} />
            </label>
            <label>
              <span>통행료</span>
              <input inputMode="numeric" value={tollCost} onChange={(event) => setTollCost(event.target.value)} />
            </label>
            <label>
              <span>주차비</span>
              <input inputMode="numeric" value={parkingCost} onChange={(event) => setParkingCost(event.target.value)} />
            </label>
            <label>
              <span>기타비용</span>
              <input inputMode="numeric" value={otherCost} onChange={(event) => setOtherCost(event.target.value)} />
            </label>
            <label className="feature-workspace__form-field--wide">
              <span>메모</span>
              <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
            <div className="feature-workspace__form-actions">
              <button className="feature-workspace__action feature-workspace__action--primary" disabled={mutationState === "submitting"} type="submit">
                운행일지 저장
              </button>
            </div>
          </form>

          <section className="feature-workspace__list" aria-label="차량운행일지 목록">
            {logs.length > 0 ? logs.map((log) => <VehicleOperationLogRow key={log.id} log={log} onSubmit={handleSubmitLog} />) : <p className="feature-workspace__empty">저장된 차량운행일지가 없습니다.</p>}
          </section>
        </div>
      </section>
    </PageShell>
  );
}
