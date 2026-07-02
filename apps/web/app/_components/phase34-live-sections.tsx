"use client";

import React, { useEffect, useMemo, useState } from "react";
import { appRoutes } from "@gw/shared";

import { Pill } from "./page-shell";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error: { code: string; message: string; details?: Record<string, unknown> | null } | null;
};

type EmployeeDirectoryPayload = {
  items: Array<{
    id: string;
    departmentId: string;
    fullName: string;
    employmentStatus: string;
  }>;
  summaries: Array<{
    employeeId: string;
    departmentName: string;
    roleSummary: string;
    statusLabel: string;
    statusTone: "positive" | "caution" | "muted";
    primaryNote: string;
  }>;
  filters: {
    departmentId?: string;
    employmentStatus?: string;
    roleCode?: string;
  };
  filterOptions: {
    departments: Array<{ id: string; name: string }>;
    employmentStatuses: string[];
    roleCodes: string[];
  };
  notices: string[];
  placeholder: true;
};

type OrgSectionPayload = {
  items: Array<Record<string, unknown>>;
  summary?: { title: string; description: string; count: number };
  notices?: string[];
  placeholder?: true;
};

type BranchPayload = {
  items: Array<{
    id: string;
    companyId: string;
    code: string;
    name: string;
    branchType: string;
    status: "active" | "inactive";
  }>;
  scope: "hq_admin" | "branch_manager" | "employee";
  summary: { title: string; description: string; count: number };
  notices: string[];
  placeholder: true;
};

type NotificationPayload = {
  items: Array<{
    id: string;
    title: string;
    body: string;
    notificationType: string;
    status: "unread" | "read";
    readAt: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
  notices: string[];
};

type WorkItemListPayload = {
  items: Array<{
    id: string;
    branchId: string | null;
    branchLabel: string | null;
    category: string;
    title: string;
    descriptionPreview: string;
    status: string;
    priority: string;
    dueAt: string | null;
    reviewRequired: boolean;
    tags: string[];
    auditSummary: string;
    access: {
      viewerScope: string;
      capabilities?: string[];
      allowedCapabilities?: string[];
      maskedFields: string[];
    };
  }>;
};

export function getWorkItemAccessCapabilities(access: WorkItemListPayload["items"][number]["access"]) {
  return access.allowedCapabilities ?? access.capabilities ?? [];
}

type WorkItemDetailPayload = {
  item: WorkItemListPayload["items"][number];
  auditLogs: Array<{
    id: string;
    action: string;
    actorRoleCode: string;
    summary: string;
    happenedAt: string;
  }>;
};

type WorkItemDeadlinePayload = {
  items: Array<{
    id: string;
    workItemId: string;
    title: string;
    dueAt: string;
    status: string;
    ownerScope: string;
    escalationNote: string;
  }>;
};

type WorkItemDocumentPayload = {
  items: Array<{
    id: string;
    title: string;
    documentType: string;
    status: string;
    visibility: string;
    accessNote: string;
    updatedAt: string;
  }>;
};

type AdminAuditPayload = {
  items: Array<{
    id: string;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
    metadata: {
      category: string;
      reason: string | null;
      source: string;
      maskedFields: string[];
      storageStatus: string | null;
      storageRef?: {
        fileId: string;
        spaceId: string;
        versionId: string;
      } | null;
    };
  }>;
  filters: {
    actorUserId?: string;
    actionPrefix?: string;
    targetType?: string;
    category?: string;
    createdFrom?: string;
    createdTo?: string;
  };
  filterOptions: {
    actorUserIds: string[];
    actions: string[];
    targetTypes: string[];
    categories: string[];
  };
  detailPreview: {
    actorLabel: string;
    targetLabel: string;
    reasonRequired: true;
  };
  operationalTrail: {
    currentState: string;
    sourceLabel: string;
    auditTrailHint: string;
    placeholderNote: string;
    blockedReasons: Array<{
      category: string;
      source: string;
      title: string;
      description: string;
    }>;
  };
  placeholder: true;
};

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? `요청 실패 (${response.status})`);
  }

  return payload;
}

function useApiQuery<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    if (!url) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchJson<T>(url)
      .then((payload) => {
        if (active) {
          setData(payload.data);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return { data, error, loading };
}

function QueryState({ loading, error, emptyMessage }: { loading: boolean; error: string | null; emptyMessage?: string }) {
  if (loading) {
    return <p className="card-note">same-origin API 응답을 불러오는 중입니다.</p>;
  }

  if (error) {
    return <p className="card-note">{error}</p>;
  }

  if (emptyMessage) {
    return <p className="card-note">{emptyMessage}</p>;
  }

  return null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toneForStatus(value: "positive" | "caution" | "muted") {
  if (value === "positive") {
    return "accent" as const;
  }
  if (value === "caution") {
    return "warning" as const;
  }
  return undefined;
}

export function EmployeeDirectoryLiveSection() {
  const employees = useApiQuery<EmployeeDirectoryPayload>(appRoutes.org.employees);

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">실제 직원 조회 응답</Pill>
          <QueryState loading={employees.loading} error={employees.error} emptyMessage={!employees.data ? "직원 조회 응답이 없습니다." : undefined} />
          {employees.data ? (
            <>
              <h3>{employees.data.items.length}명</h3>
              <p>직원 요약 카드와 필터 후보가 same-origin 응답으로 연결됩니다.</p>
              <p className="card-note">현재 필터: {employees.data.filters.departmentId ?? "전체 부서"} · {employees.data.filters.employmentStatus ?? "전체 상태"} · {employees.data.filters.roleCode ?? "전체 역할"}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>필터/경계</Pill>
          {employees.data ? (
            <>
              <h3>{employees.data.filterOptions.departments.length}개 부서 옵션</h3>
              <p>{employees.data.filterOptions.roleCodes.join(", ")}</p>
              <p className="card-note">비관리자에게는 고위험 관리자 역할 filter 가 그대로 노출되지 않도록 API 테스트가 붙어 있습니다.</p>
            </>
          ) : (
            <QueryState loading={employees.loading} error={employees.error} emptyMessage="필터 후보는 로그인 후 불러옵니다." />
          )}
        </article>
      </div>

      {employees.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {employees.data.summaries.slice(0, 4).map((summary) => {
            const employee = employees.data?.items.find((item) => item.id === summary.employeeId);
            return (
              <article key={summary.employeeId} className="route-card">
                <div className="pill-row">
                  <Pill tone={toneForStatus(summary.statusTone)}>{summary.statusLabel}</Pill>
                  <Pill>{summary.departmentName}</Pill>
                </div>
                <h3>{employee?.fullName ?? summary.employeeId}</h3>
                <p>{summary.roleSummary}</p>
                <p className="card-note">{summary.primaryNote}</p>
              </article>
            );
          })}
        </div>
      ) : null}

      {employees.data ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>운영 경계 메모</Pill>
          <ul className="summary-list">
            {employees.data.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
            <li>잘못된 employmentStatus / roleCode query 는 500 대신 400 VALIDATION_ERROR 로 차단됩니다.</li>
          </ul>
        </article>
      ) : null}
    </>
  );
}

export function OrgDirectoryLiveSection() {
  const departments = useApiQuery<OrgSectionPayload>(appRoutes.org.departments);
  const roles = useApiQuery<OrgSectionPayload>(appRoutes.org.roles);
  const permissions = useApiQuery<OrgSectionPayload>(appRoutes.org.permissions);
  const branches = useApiQuery<BranchPayload>(appRoutes.org.branches);

  const loading = departments.loading || roles.loading || permissions.loading || branches.loading;
  const error = departments.error ?? roles.error ?? permissions.error ?? branches.error;

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">조직/역할 실응답</Pill>
          <QueryState loading={loading} error={error} emptyMessage={!departments.data ? "조직 응답이 없습니다." : undefined} />
          {departments.data && roles.data ? (
            <>
              <h3>{departments.data.summary?.count ?? departments.data.items.length}개 부서 · {roles.data.summary?.count ?? roles.data.items.length}개 역할</h3>
              <p>{departments.data.summary?.description ?? "조직 구조와 역할 체계를 읽기 전용으로 불러옵니다."}</p>
              <p className="card-note">권한 카탈로그 {permissions.data?.items.length ?? 0}개가 /admin/policies 와 분리된 일반 조회 경로로 연결됩니다.</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>회사·지점 scope</Pill>
          {branches.data ? (
            <>
              <h3>{branches.data.scope}</h3>
              <p>{branches.data.summary.description}</p>
              <p className="card-note">보이는 지점 수: {branches.data.items.length} · 일반 조회는 같은 회사/허용 지점 범위로만 제한됩니다.</p>
            </>
          ) : (
            <QueryState loading={loading} error={error} emptyMessage="지점 scope 는 로그인 후 확인합니다." />
          )}
        </article>
      </div>

      {branches.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {branches.data.items.map((branch) => (
            <article key={branch.id} className="route-card">
              <div className="pill-row">
                <Pill tone={branch.status === "active" ? "accent" : "warning"}>{branch.status}</Pill>
                <Pill>{branch.branchType}</Pill>
              </div>
              <h3>{branch.name}</h3>
              <p>{branch.code}</p>
            </article>
          ))}
        </div>
      ) : null}

      {departments.data?.notices?.length ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>읽기 전용 안내</Pill>
          <ul className="summary-list">
            {departments.data.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
            {roles.data?.notices?.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </>
  );
}

export function BranchOperationsLiveSection() {
  const items = useApiQuery<WorkItemListPayload>(`${appRoutes.workItems.list}?module=branch`);
  const deadlines = useApiQuery<WorkItemDeadlinePayload>(appRoutes.workItems.deadlines);
  const selectedItemId = items.data?.items[0]?.id ?? null;
  const detail = useApiQuery<WorkItemDetailPayload>(selectedItemId ? appRoutes.workItems.detail(selectedItemId) : null);
  const documents = useApiQuery<WorkItemDocumentPayload>(selectedItemId ? appRoutes.workItems.documents(selectedItemId) : null);

  const selectedDeadlines = useMemo(
    () => deadlines.data?.items.filter((deadline) => deadline.workItemId === selectedItemId).slice(0, 3) ?? [],
    [deadlines.data, selectedItemId],
  );

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">branch scope 업무 목록</Pill>
          <QueryState loading={items.loading} error={items.error} emptyMessage={!items.data ? "지점 업무 카드가 없습니다." : undefined} />
          {items.data ? (
            <>
              <h3>{items.data.items.length}건</h3>
              <p>독립 /branches CRUD 대신 branch module 업무 카드와 마감 응답을 먼저 연결합니다.</p>
              <p className="card-note">첫 카드: {items.data.items[0]?.title ?? "-"}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>선택 카드 상세</Pill>
          <QueryState loading={detail.loading} error={detail.error} emptyMessage={!detail.data ? "선택할 상세 카드가 없습니다." : undefined} />
          {detail.data ? (
            <>
              <h3>{detail.data.item.status} · {detail.data.item.priority}</h3>
              <p>{detail.data.item.branchLabel ?? "회사 공통"} · viewerScope {detail.data.item.access.viewerScope}</p>
              <p className="card-note">허용 capability: {getWorkItemAccessCapabilities(detail.data.item.access).join(", ") || "없음"}</p>
            </>
          ) : null}
        </article>
      </div>

      {detail.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          <article className="route-card">
            <Pill>{detail.data.item.category}</Pill>
            <h3>{detail.data.item.title}</h3>
            <p>{detail.data.item.descriptionPreview}</p>
            <p className="card-note">감사 요약: {detail.data.item.auditSummary}</p>
          </article>
          <article className="route-card">
            <Pill tone="warning">review</Pill>
            <h3>{detail.data.auditLogs.length}개 감사 흔적</h3>
            <p>{detail.data.auditLogs[0]?.summary ?? "감사 로그 없음"}</p>
            <p className="card-note">최근 시각: {formatDateTime(detail.data.auditLogs[0]?.happenedAt)}</p>
          </article>
          <article className="route-card">
            <Pill>deadline</Pill>
            <h3>{selectedDeadlines.length}개 마감</h3>
            <p>{selectedDeadlines[0]?.title ?? "연결된 마감 없음"}</p>
            <p className="card-note">{selectedDeadlines[0] ? `${selectedDeadlines[0].status} · ${formatDateTime(selectedDeadlines[0].dueAt)}` : "같은 회사/지점 범위 안에서만 노출"}</p>
          </article>
          <article className="route-card">
            <Pill>document</Pill>
            <h3>{documents.data?.items.length ?? 0}개 문서</h3>
            <p>{documents.data?.items[0]?.title ?? "문서 없음"}</p>
            <p className="card-note">민감 원문 대신 metadata-only visibility 를 유지합니다.</p>
          </article>
        </div>
      ) : null}
    </>
  );
}

export function NotificationsLiveSection() {
  const notifications = useApiQuery<NotificationPayload>(appRoutes.notifications);

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">알림 inbox 실응답</Pill>
          <QueryState loading={notifications.loading} error={notifications.error} emptyMessage={!notifications.data ? "알림 응답이 없습니다." : undefined} />
          {notifications.data ? (
            <>
              <h3>미읽음 {notifications.data.unreadCount}건</h3>
              <p>{notifications.data.notices[0]}</p>
              <p className="card-note">same-origin 알림 API 응답 기준</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>발송 가드레일</Pill>
          {notifications.data ? (
            <>
              <h3>외부 발송 없음</h3>
              <p>{notifications.data.notices[1] ?? "외부 푸시/메일/메신저 전송은 별도 승인 후 진행합니다."}</p>
              <p className="card-note">읽음/미읽음 상태와 업무 이동 CTA 만 API로 조회합니다.</p>
            </>
          ) : (
            <QueryState loading={notifications.loading} error={notifications.error} emptyMessage="알림 가드레일은 로그인 후 표시됩니다." />
          )}
        </article>
      </div>

      {notifications.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {notifications.data.items.slice(0, 4).map((item) => (
            <article key={item.id} className="route-card">
              <div className="pill-row">
                <Pill tone={item.status === "unread" ? "warning" : "accent"}>{item.status}</Pill>
                <Pill>{item.notificationType}</Pill>
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <p className="card-note">생성: {formatDateTime(item.createdAt)}</p>
            </article>
          ))}
        </div>
      ) : null}

      {notifications.data ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>막힘/승인 게이트</Pill>
          <ul className="summary-list">
            {notifications.data.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </>
  );
}

export function AuditLogsLiveSection() {
  const auditLogs = useApiQuery<AdminAuditPayload>(appRoutes.admin.auditLogs);

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">감사 로그 실응답</Pill>
          <QueryState loading={auditLogs.loading} error={auditLogs.error} emptyMessage={!auditLogs.data ? "감사 로그 응답이 없습니다." : undefined} />
          {auditLogs.data ? (
            <>
              <h3>{auditLogs.data.items.length}건</h3>
              <p>{auditLogs.data.detailPreview.actorLabel} · {auditLogs.data.detailPreview.targetLabel}</p>
              <p className="card-note">reason required: {auditLogs.data.detailPreview.reasonRequired ? "yes" : "no"}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>조회 필터</Pill>
          {auditLogs.data ? (
            <>
              <h3>{auditLogs.data.filterOptions.categories.join(", ")}</h3>
              <p>{auditLogs.data.filterOptions.targetTypes.join(", ")}</p>
              <p className="card-note">감사 권한이 없는 역할은 /api/admin/audit-logs 에서 403 으로 차단됩니다.</p>
            </>
          ) : (
            <QueryState loading={auditLogs.loading} error={auditLogs.error} emptyMessage="필터 옵션은 로그인 후 표시됩니다." />
          )}
        </article>
      </div>

      {auditLogs.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {auditLogs.data.items.slice(0, 4).map((item) => (
            <article key={item.id} className="route-card">
              <div className="pill-row">
                <Pill>{item.metadata.category}</Pill>
                <Pill>{item.targetType}</Pill>
              </div>
              <h3>{item.action}</h3>
              <p>{item.metadata.source}</p>
              <p className="card-note">{formatDateTime(item.createdAt)} · masked {item.metadata.maskedFields.length}개</p>
              {item.metadata.storageRef ? (
                <p className="card-note">storageRef {item.metadata.storageRef.fileId} · {item.metadata.storageRef.spaceId} · {item.metadata.storageStatus ?? "status n/a"}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {auditLogs.data ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>운영 경계</Pill>
          <ul className="summary-list">
            <li>{auditLogs.data.operationalTrail.auditTrailHint}</li>
            <li>{auditLogs.data.operationalTrail.placeholderNote}</li>
            {auditLogs.data.operationalTrail.blockedReasons.map((reason) => (
              <li key={`${reason.category}-${reason.source}`}>{reason.title} — {reason.description}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </>
  );
}
