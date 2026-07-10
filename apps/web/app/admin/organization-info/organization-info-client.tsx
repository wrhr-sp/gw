"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  appRoutes,
  departmentDutiesResponseSchema,
  departmentDutyMutationResponseSchema,
  employeeOrganizationMasterMutationResponseSchema,
  employeeOrganizationMastersResponseSchema,
  errorResponseSchema,
  organizationCodePoliciesResponseSchema,
  organizationCodePolicyMutationResponseSchema,
  type DepartmentDuty,
  type EmployeeOrganizationMaster,
  type EmployeeOrganizationMasterKind,
  type EmployeeOrganizationMasterMutationRequest,
  type OrganizationCodePolicy,
  type OrganizationCodePolicyKind,
  type OrganizationCodePolicyUpdateRequest,
} from "@gw/shared";

import { ActionButtonGroup, ConfirmDialog, DataTable, EmptyState, StandardButton } from "../../_components/ui-standard";

type OrganizationInfoKind = EmployeeOrganizationMasterKind | "departmentDuties";
type TopTab = "organization" | "code";
type PanelMode = "organization" | "code" | null;

type MastersState = Record<EmployeeOrganizationMasterKind, EmployeeOrganizationMaster[]>;

type Draft = EmployeeOrganizationMasterMutationRequest;

type CodeDraft = OrganizationCodePolicyUpdateRequest;
const infoTabs: Array<{ kind: OrganizationInfoKind; policyKind: OrganizationCodePolicyKind; label: string }> = [
  { kind: "branches", policyKind: "branches", label: "지사" },
  { kind: "departments", policyKind: "departments", label: "부서" },
  { kind: "jobGrades", policyKind: "jobGrades", label: "직급" },
  { kind: "jobPositions", policyKind: "jobPositions", label: "직위" },
  { kind: "jobTitles", policyKind: "jobTitles", label: "직책" },
  { kind: "departmentDuties", policyKind: "departmentDuties", label: "담당" },
  { kind: "groups", policyKind: "groups", label: "사용자그룹" },
];

const masterKindLabels: Record<EmployeeOrganizationMasterKind, string> = {
  branches: "지사",
  departments: "부서",
  jobGrades: "직급",
  jobPositions: "직위",
  jobTitles: "직책",
  groups: "사용자그룹",
};

const emptyDraft: Draft = {
  code: "",
  name: "",
  description: "",
  sortOrder: 0,
  isActive: true,
  reason: "조직정보 변경",
};

const emptyCodeDraft: CodeDraft = {
  prefix: "ORG",
  numberDigits: 3,
  nextSequence: 1,
  formatPattern: "{PREFIX}-{SEQ}",
  autoGenerateEnabled: true,
  manualEditAllowed: false,
  reuseRetiredCodeAllowed: false,
  isActive: true,
  reason: "조직정보 코드정보 정책 변경",
};

function parseError(status: number, payload: unknown) {
  const parsed = errorResponseSchema.safeParse(payload);
  return parsed.success ? `${parsed.data.error.code}: ${parsed.data.error.message}` : `요청을 처리하지 못했습니다. (${status})`;
}

function toDraft(item: EmployeeOrganizationMaster | DepartmentDuty | null): Draft {
  if (!item) return emptyDraft;
  return {
    code: item.code,
    name: item.name,
    description: item.description ?? "",
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    reason: "조직정보 변경",
  };
}

function toCodeDraft(policy: OrganizationCodePolicy | null): CodeDraft {
  if (!policy) return emptyCodeDraft;
  return {
    prefix: policy.prefix,
    numberDigits: policy.numberDigits,
    nextSequence: policy.nextSequence,
    formatPattern: policy.formatPattern,
    autoGenerateEnabled: policy.autoGenerateEnabled,
    manualEditAllowed: policy.manualEditAllowed,
    reuseRetiredCodeAllowed: policy.reuseRetiredCodeAllowed,
    isActive: policy.isActive,
    reason: "조직정보 코드정보 정책 변경",
  };
}

function selectedRowKey(kind: OrganizationInfoKind, id: string) {
  return `${kind}:${id}`;
}

export function OrganizationInfoClient() {
  const [topTab, setTopTab] = useState<TopTab>("organization");
  const [masters, setMasters] = useState<MastersState>({ branches: [], departments: [], jobGrades: [], jobPositions: [], jobTitles: [], groups: [] });
  const [policies, setPolicies] = useState<OrganizationCodePolicy[]>([]);
  const [activeTab, setActiveTab] = useState<OrganizationInfoKind>("branches");
  const [organizationExpanded, setOrganizationExpanded] = useState(true);
  const [codeExpanded, setCodeExpanded] = useState(true);
  const [selectedMaster, setSelectedMaster] = useState<EmployeeOrganizationMaster | null>(null);
  const [selectedDuty, setSelectedDuty] = useState<DepartmentDuty | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [duties, setDuties] = useState<DepartmentDuty[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [codeDraft, setCodeDraft] = useState<CodeDraft>(emptyCodeDraft);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const activePolicyKind = infoTabs.find((tab) => tab.kind === activeTab)?.policyKind ?? "branches";
  const activePolicy = useMemo(() => policies.find((policy) => policy.kind === activePolicyKind) ?? null, [activePolicyKind, policies]);
  const selectedDepartment = useMemo(() => masters.departments.find((department) => department.id === selectedDepartmentId) ?? null, [masters.departments, selectedDepartmentId]);
  const activeItems = activeTab === "departmentDuties" ? [] : masters[activeTab];
  const visibleItems = activeTab === "departmentDuties" ? duties : activeItems;
  const selectedVisibleCount = visibleItems.filter((item) => selectedRowKeys.includes(selectedRowKey(activeTab, item.id))).length;
  const allVisibleSelected = visibleItems.length > 0 && selectedVisibleCount === visibleItems.length;

  async function loadMasters() {
    const response = await fetch(appRoutes.admin.organizationInfo, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(response.status, payload));
    const parsed = employeeOrganizationMastersResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("조직정보 응답 형식이 올바르지 않습니다.");
    setMasters({
      branches: parsed.data.data.branches,
      departments: parsed.data.data.departments,
      jobGrades: parsed.data.data.jobGrades,
      jobPositions: parsed.data.data.jobPositions,
      jobTitles: parsed.data.data.jobTitles,
      groups: parsed.data.data.groups,
    });
    setSelectedDepartmentId((current) => current || parsed.data.data.departments[0]?.id || "");
  }

  async function loadPolicies() {
    const response = await fetch(appRoutes.admin.organizationCodePolicies, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(response.status, payload));
    const parsed = organizationCodePoliciesResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("코드정보 정책 응답 형식이 올바르지 않습니다.");
    setPolicies(parsed.data.data.items);
  }

  async function loadDuties(departmentId: string) {
    if (!departmentId) {
      setDuties([]);
      return;
    }
    const response = await fetch(appRoutes.admin.departmentDuties(departmentId), { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(response.status, payload));
    const parsed = departmentDutiesResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("부서별 담당업무 응답 형식이 올바르지 않습니다.");
    setDuties(parsed.data.data.items);
  }

  useEffect(() => {
    setLoadState("loading");
    void Promise.all([loadMasters(), loadPolicies()])
      .then(() => setLoadState("loaded"))
      .catch((error) => {
        setLoadState("error");
        setMessage(error instanceof Error ? error.message : "조직정보를 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    if (activeTab !== "departmentDuties") return;
    void loadDuties(selectedDepartmentId).catch((error) => setMessage(error instanceof Error ? error.message : "부서별 담당업무를 불러오지 못했습니다."));
  }, [activeTab, selectedDepartmentId]);

  useEffect(() => {
    setCodeDraft(toCodeDraft(activePolicy));
  }, [activePolicy]);

  function startCreate() {
    setSelectedMaster(null);
    setSelectedDuty(null);
    setDraft({ ...emptyDraft, code: activePolicy?.autoGenerateEnabled && !activePolicy.manualEditAllowed ? "" : emptyDraft.code });
    setPanelMode("organization");
    setSaveState("idle");
    setMessage(null);
  }

  function openCodePanel() {
    setCodeDraft(toCodeDraft(activePolicy));
    setPanelMode("code");
    setSaveState("idle");
    setMessage(null);
  }

  function closePanel() {
    setPanelMode(null);
  }

  function selectTab(kind: OrganizationInfoKind, nextTopTab: TopTab) {
    setTopTab(nextTopTab);
    setActiveTab(kind);
    setSelectedMaster(null);
    setSelectedDuty(null);
    setSelectedRowKeys([]);
    setPanelMode(null);
    setSaveState("idle");
    setMessage(null);
  }

  function selectMaster(item: EmployeeOrganizationMaster) {
    setTopTab("organization");
    setSelectedMaster(item);
    setSelectedDuty(null);
    setDraft({ ...toDraft(item), parentId: item.parentId ?? undefined, branchId: item.branchId ?? undefined });
    setPanelMode("organization");
    setMessage(null);
  }

  function selectDuty(item: DepartmentDuty) {
    setTopTab("organization");
    setSelectedDuty(item);
    setSelectedMaster(null);
    setDraft(toDraft(item));
    setPanelMode("organization");
    setMessage(null);
  }

  function toggleRowSelection(id: string) {
    const key = selectedRowKey(activeTab, id);
    setSelectedRowKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function toggleVisibleSelection() {
    const visibleKeys = visibleItems.map((item) => selectedRowKey(activeTab, item.id));
    if (allVisibleSelected) {
      setSelectedRowKeys((current) => current.filter((key) => !visibleKeys.includes(key)));
      return;
    }
    setSelectedRowKeys((current) => Array.from(new Set([...current, ...visibleKeys])));
  }

  async function saveDraft() {
    setSaveState("saving");
    setMessage(null);
    try {
      if (activeTab === "departmentDuties") {
        if (!selectedDepartmentId) throw new Error("담당업무를 등록할 부서를 먼저 선택해 주세요.");
        const response = await fetch(selectedDuty ? appRoutes.admin.departmentDuty(selectedDepartmentId, selectedDuty.id) : appRoutes.admin.departmentDuties(selectedDepartmentId), {
          method: selectedDuty ? "PATCH" : "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(parseError(response.status, payload));
        const parsed = departmentDutyMutationResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error("담당업무 저장 응답 형식이 올바르지 않습니다.");
        await Promise.all([loadDuties(selectedDepartmentId), loadPolicies()]);
        setSelectedDuty(parsed.data.data.item);
        setMessage(`${parsed.data.data.item.name} 담당업무를 저장했습니다.`);
      } else {
        const response = await fetch(selectedMaster ? appRoutes.admin.organizationInfoItem(activeTab, selectedMaster.id) : `/api/admin/organization-info/${activeTab}`, {
          method: selectedMaster ? "PATCH" : "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(parseError(response.status, payload));
        const parsed = employeeOrganizationMasterMutationResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error("조직정보 저장 응답 형식이 올바르지 않습니다.");
        await Promise.all([loadMasters(), loadPolicies()]);
        setSelectedMaster(parsed.data.data.item);
        setMessage(`${parsed.data.data.item.name} ${masterKindLabels[activeTab]} 조직정보를 저장했습니다.`);
      }
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "조직정보를 저장하지 못했습니다.");
    }
  }

  async function saveCodePolicy() {
    setSaveState("saving");
    setMessage(null);
    try {
      const response = await fetch(appRoutes.admin.organizationCodePolicy(activePolicyKind), {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(codeDraft),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseError(response.status, payload));
      const parsed = organizationCodePolicyMutationResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("코드정보 정책 저장 응답 형식이 올바르지 않습니다.");
      await loadPolicies();
      setMessage(`${infoTabs.find((tab) => tab.policyKind === activePolicyKind)?.label ?? "조직정보"} 코드정보 정책을 저장했습니다.`);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "코드정보 정책을 저장하지 못했습니다.");
    }
  }

  async function confirmDeleteSelected() {
    const targets = visibleItems.filter((item) => selectedRowKeys.includes(selectedRowKey(activeTab, item.id)));
    if (targets.length === 0) {
      setIsDeleteConfirmOpen(false);
      return;
    }

    setSaveState("saving");
    setMessage(null);
    try {
      for (const target of targets) {
        if (activeTab === "departmentDuties") {
          if (!selectedDepartmentId) throw new Error("담당업무를 삭제 처리할 부서를 먼저 선택해 주세요.");
          const response = await fetch(appRoutes.admin.departmentDutyStatus(selectedDepartmentId, target.id), {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ isActive: false, reason: "조직정보 목록 체크 삭제 처리" }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(parseError(response.status, payload));
        } else {
          const response = await fetch(appRoutes.admin.organizationInfoItemStatus(activeTab, target.id), {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ isActive: false, reason: "조직정보 목록 체크 삭제 처리" }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(parseError(response.status, payload));
        }
      }
      if (activeTab === "departmentDuties") {
        await loadDuties(selectedDepartmentId);
      } else {
        await loadMasters();
      }
      await loadPolicies();
      setSelectedRowKeys([]);
      setPanelMode(null);
      setIsDeleteConfirmOpen(false);
      setSaveState("saved");
      setMessage(`${targets.length}개 항목을 삭제 처리했습니다.`);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "삭제 처리를 저장하지 못했습니다.");
    }
  }

  const codeInputDisabled = Boolean(activePolicy?.autoGenerateEnabled && !activePolicy.manualEditAllowed && !selectedMaster && !selectedDuty);
  const activeLabel = infoTabs.find((tab) => tab.kind === activeTab)?.label ?? "조직정보";

  return (
    <div className="feature-workspace feature-workspace--hr" data-admin-organization-info="true">
      <aside className="feature-workspace__nav" aria-label="조직정보 기능페이지 정보">
        <div className="feature-workspace__nav-header">
          <h1>조직정보</h1>
        </div>
        <div className="feature-workspace__tab-list" role="tree" aria-label="조직정보 기능페이지 목록">
          <button className="feature-workspace__tab" aria-expanded={organizationExpanded} onClick={() => setOrganizationExpanded((current) => !current)} type="button">
            <span>조직정보</span><strong aria-hidden="true">{organizationExpanded ? "⌃" : "⌄"}</strong>
          </button>
          {organizationExpanded ? infoTabs.map((tab) => (
            <button key={`organization-${tab.kind}`} aria-selected={topTab === "organization" && activeTab === tab.kind} className="feature-workspace__tab" onClick={() => selectTab(tab.kind, "organization")} role="treeitem" type="button">
              <span>{tab.label}</span>
            </button>
          )) : null}
          <button className="feature-workspace__tab" aria-expanded={codeExpanded} onClick={() => setCodeExpanded((current) => !current)} type="button">
            <span>코드정보</span><strong aria-hidden="true">{codeExpanded ? "⌃" : "⌄"}</strong>
          </button>
          {codeExpanded ? infoTabs.map((tab) => (
            <button key={`code-${tab.kind}`} aria-selected={topTab === "code" && activeTab === tab.kind} className="feature-workspace__tab" onClick={() => selectTab(tab.kind, "code")} role="treeitem" type="button">
              <span>{tab.label}</span>
            </button>
          )) : null}
        </div>
      </aside>

      <section className="feature-workspace__panel" aria-label="조직정보 본문">
        <div className="feature-workspace__panel-header">
          <div>
            <h2>{topTab === "organization" ? `${activeLabel} 조직정보` : `${activeLabel} 코드정보`}</h2>
            {activeTab === "groups" ? <p className="card-note">사용자그룹은 직원들을 특정 기준으로 묶어 시스템 권한·알림·결재·조회 범위를 적용하는 그룹입니다.</p> : null}
          </div>
          <ActionButtonGroup label={topTab === "organization" ? "조직정보 작업" : "코드정보 작업"}>
            {topTab === "organization" ? (
              <>
                <button className="feature-workspace__plain-action" onClick={startCreate} type="button">+ 추가</button>
                <StandardButton disabled={selectedVisibleCount === 0 || saveState === "saving"} intent="danger" onClick={() => setIsDeleteConfirmOpen(true)} type="button">삭제</StandardButton>
              </>
            ) : (
              <button className="feature-workspace__plain-action" onClick={openCodePanel} type="button">+ 코드정보 설정</button>
            )}
          </ActionButtonGroup>
        </div>

        {message ? <p className="feature-workspace__save-message" role={saveState === "error" || loadState === "error" ? "alert" : "status"}>{message}</p> : null}

        {topTab === "code" ? (
          <DataTable label={`${activeLabel} 코드정보 정책`}>
            <div className="employee-management-table-wrap">
              <table className="employee-management-table">
                <thead><tr><th scope="col">구분</th><th scope="col">다음 코드</th><th scope="col">자동생성</th><th scope="col">수동수정</th><th scope="col">사용</th></tr></thead>
                <tbody>
                  <tr>
                    <td><button className="page-shell__title-link page-shell__title-button" onClick={openCodePanel} type="button">{activeLabel}</button></td>
                    <td>{activePolicy?.nextCode ?? "-"}</td>
                    <td>{activePolicy?.autoGenerateEnabled ? "사용" : "미사용"}</td>
                    <td>{activePolicy?.manualEditAllowed ? "허용" : "제한"}</td>
                    <td>{activePolicy?.isActive ? "사용" : "중지"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataTable>
        ) : (
          <>
            {activeTab === "departmentDuties" ? (
              <label className="feature-workspace__form">
                <span>부서 선택</span>
                <select aria-label="담당업무 부서 선택" data-hr-input-size="medium" onChange={(event) => { setSelectedDepartmentId(event.target.value); setSelectedDuty(null); setDraft(emptyDraft); setSelectedRowKeys([]); setPanelMode(null); }} value={selectedDepartmentId}>
                  <option value="">부서 선택</option>
                  {masters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            ) : null}

            <DataTable label={activeTab === "departmentDuties" ? `${selectedDepartment?.name ?? "부서"} 담당 목록` : `${masterKindLabels[activeTab]} 목록`}>
              <div className="employee-management-table-wrap">
                <table className="employee-management-table">
                  <thead><tr><th scope="col"><input aria-label="조직정보 목록 전체 선택" checked={allVisibleSelected} disabled={visibleItems.length === 0} onChange={toggleVisibleSelection} type="checkbox" /></th><th scope="col">코드</th><th scope="col">이름</th><th scope="col">사용</th><th scope="col">연결 사원</th><th scope="col">정렬</th></tr></thead>
                  <tbody>
                    {visibleItems.map((item) => {
                      const checked = selectedRowKeys.includes(selectedRowKey(activeTab, item.id));
                      return (
                        <tr key={item.id} data-selected={(activeTab === "departmentDuties" ? selectedDuty?.id : selectedMaster?.id) === item.id ? "true" : undefined}>
                          <td><input aria-label={`${item.name} 선택`} checked={checked} onChange={() => toggleRowSelection(item.id)} type="checkbox" /></td>
                          <td><button className="page-shell__title-link page-shell__title-button" onClick={() => activeTab === "departmentDuties" ? selectDuty(item as DepartmentDuty) : selectMaster(item as EmployeeOrganizationMaster)} type="button">{item.code}</button></td>
                          <td>{item.name}</td><td>{item.isActive ? "사용" : "중지"}</td><td>{item.linkedEmployeeCount}명</td><td>{item.sortOrder}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DataTable>

            {visibleItems.length === 0 && loadState !== "loading" ? <EmptyState title="등록된 조직정보가 없습니다" /> : null}
          </>
        )}

        {panelMode === "code" ? (
          <aside className="employee-detail-panel employee-detail-panel--admin-page" aria-label="코드정보 정책 설정 패널">
            <div className="employee-detail-panel__header">
              <div>
                <strong className="employee-detail-panel__title">{activeLabel} 코드정보</strong>
                <span>조직정보 등록 시 적용될 자동 코드 생성 정책입니다.</span>
              </div>
              <button aria-label="코드정보 정책 설정 패널 닫기" className="employee-detail-panel__close" disabled={saveState === "saving"} onClick={closePanel} type="button">×</button>
            </div>
            <div className="employee-detail-panel__body">
              <form id="admin-code-policy-form" className="feature-workspace__form" onSubmit={(event) => { event.preventDefault(); void saveCodePolicy(); }}>
                <label><span>접두어</span><input data-hr-input-size="medium" required value={codeDraft.prefix} onChange={(event) => setCodeDraft((current) => ({ ...current, prefix: event.target.value }))} /></label>
                <label><span>번호 자릿수</span><input data-hr-input-size="short" inputMode="numeric" value={codeDraft.numberDigits} onChange={(event) => setCodeDraft((current) => ({ ...current, numberDigits: Number(event.target.value || 1) }))} /></label>
                <label><span>다음 번호</span><input data-hr-input-size="short" inputMode="numeric" value={codeDraft.nextSequence} onChange={(event) => setCodeDraft((current) => ({ ...current, nextSequence: Number(event.target.value || 1) }))} /></label>
                <label><span>코드 형식</span><input data-hr-input-size="medium" value={codeDraft.formatPattern} onChange={(event) => setCodeDraft((current) => ({ ...current, formatPattern: event.target.value }))} /></label>
                <label><span>미리보기</span><input data-hr-input-size="medium" readOnly value={activePolicy?.nextCode ?? `${codeDraft.prefix}-${String(codeDraft.nextSequence).padStart(codeDraft.numberDigits, "0")}`} /></label>
                <label><span>자동생성</span><select data-hr-input-size="short" value={codeDraft.autoGenerateEnabled ? "true" : "false"} onChange={(event) => setCodeDraft((current) => ({ ...current, autoGenerateEnabled: event.target.value === "true" }))}><option value="true">사용</option><option value="false">미사용</option></select></label>
                <label><span>코드 수동수정</span><select data-hr-input-size="short" value={codeDraft.manualEditAllowed ? "true" : "false"} onChange={(event) => setCodeDraft((current) => ({ ...current, manualEditAllowed: event.target.value === "true" }))}><option value="false">제한</option><option value="true">허용</option></select></label>
                <label><span>폐기 코드 재사용</span><select data-hr-input-size="short" value={codeDraft.reuseRetiredCodeAllowed ? "true" : "false"} onChange={(event) => setCodeDraft((current) => ({ ...current, reuseRetiredCodeAllowed: event.target.value === "true" }))}><option value="false">불가</option><option value="true">허용</option></select></label>
                <label><span>정책 사용</span><select data-hr-input-size="short" value={codeDraft.isActive ? "true" : "false"} onChange={(event) => setCodeDraft((current) => ({ ...current, isActive: event.target.value === "true" }))}><option value="true">사용</option><option value="false">중지</option></select></label>
                <label><span>변경 사유</span><input data-hr-input-size="full" required value={codeDraft.reason} onChange={(event) => setCodeDraft((current) => ({ ...current, reason: event.target.value }))} /></label>
              </form>
            </div>
            <ActionButtonGroup label="코드정보 정책 저장 작업"><StandardButton disabled={saveState === "saving"} form="admin-code-policy-form" intent="primary" type="submit">{saveState === "saving" ? "저장 중" : "저장"}</StandardButton></ActionButtonGroup>
          </aside>
        ) : null}

        {panelMode === "organization" ? (
          <aside className="employee-detail-panel employee-detail-panel--admin-page" aria-label="조직정보 등록/수정 패널">
            <div className="employee-detail-panel__header">
              <div><strong className="employee-detail-panel__title">{activeTab === "departmentDuties" ? "담당" : masterKindLabels[activeTab]} {activeTab === "departmentDuties" ? (selectedDuty ? "수정" : "등록") : (selectedMaster ? "수정" : "등록")}</strong><span>신규 등록 시 코드정보 정책에 따라 코드가 자동 생성됩니다.</span></div>
              <button aria-label="조직정보 등록/수정 패널 닫기" className="employee-detail-panel__close" disabled={saveState === "saving"} onClick={closePanel} type="button">×</button>
            </div>
            <div className="employee-detail-panel__body">
              <form id="admin-organization-info-form" className="feature-workspace__form" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
                <label><span>코드</span><input data-hr-input-size="medium" disabled={codeInputDisabled} aria-label={codeInputDisabled ? "코드정보 정책으로 자동 생성" : "코드 입력"} value={draft.code ?? ""} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></label>
                <label><span>이름</span><input data-hr-input-size="medium" required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                <label><span>설명</span><input data-hr-input-size="full" value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
                <label><span>정렬순서</span><input data-hr-input-size="short" inputMode="numeric" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} /></label>
                {activeTab === "departments" ? <><label><span>상위부서</span><select data-hr-input-size="medium" value={draft.parentId ?? ""} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value || undefined }))}><option value="">없음</option>{masters.departments.filter((department) => department.id !== selectedMaster?.id).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label><span>연결 지사</span><select data-hr-input-size="medium" value={draft.branchId ?? ""} onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value || undefined }))}><option value="">없음</option>{masters.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></> : null}
                <label><span>사용여부</span><select data-hr-input-size="short" value={draft.isActive ? "true" : "false"} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.value === "true" }))}><option value="true">사용</option><option value="false">중지</option></select></label>
                <label><span>변경 사유</span><input data-hr-input-size="full" required value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} /></label>
              </form>
            </div>
            <ActionButtonGroup label="조직정보 저장 작업"><StandardButton disabled={saveState === "saving"} form="admin-organization-info-form" intent="primary" type="submit">{saveState === "saving" ? "저장 중" : "저장"}</StandardButton></ActionButtonGroup>
          </aside>
        ) : null}

        {isDeleteConfirmOpen ? (
          <div className="topbar-modal-backdrop employee-create-close-confirm" role="presentation">
            <ConfirmDialog
              title="선택한 조직정보를 삭제 처리할까요?"
              className="employee-create-close-confirm__dialog"
              actions={(
                <>
                  <StandardButton intent="ghost" onClick={() => setIsDeleteConfirmOpen(false)} type="button">취소</StandardButton>
                  <StandardButton disabled={saveState === "saving"} intent="danger" onClick={() => void confirmDeleteSelected()} type="button">삭제</StandardButton>
                </>
              )}
              closeButton={<button aria-label="조직정보 삭제 확인 팝업 닫기" className="topbar-modal__close" onClick={() => setIsDeleteConfirmOpen(false)} type="button">×</button>}
            >
              <p>선택한 {selectedVisibleCount}개 항목을 사용중지 상태로 변경합니다.</p>
            </ConfirmDialog>
          </div>
        ) : null}
      </section>
    </div>
  );
}
