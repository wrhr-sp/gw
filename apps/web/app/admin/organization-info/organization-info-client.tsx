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

import { ActionButtonGroup, DataTable, EmptyState, StandardButton } from "../../_components/ui-standard";

type OrganizationInfoKind = EmployeeOrganizationMasterKind | "departmentDuties";
type TopTab = "organization" | "code";

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

export function OrganizationInfoClient() {
  const [topTab, setTopTab] = useState<TopTab>("organization");
  const [masters, setMasters] = useState<MastersState>({ branches: [], departments: [], jobGrades: [], jobPositions: [], jobTitles: [], groups: [] });
  const [policies, setPolicies] = useState<OrganizationCodePolicy[]>([]);
  const [activeTab, setActiveTab] = useState<OrganizationInfoKind>("branches");
  const [selectedMaster, setSelectedMaster] = useState<EmployeeOrganizationMaster | null>(null);
  const [selectedDuty, setSelectedDuty] = useState<DepartmentDuty | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [duties, setDuties] = useState<DepartmentDuty[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [codeDraft, setCodeDraft] = useState<CodeDraft>(emptyCodeDraft);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const activePolicyKind = infoTabs.find((tab) => tab.kind === activeTab)?.policyKind ?? "branches";
  const activePolicy = useMemo(() => policies.find((policy) => policy.kind === activePolicyKind) ?? null, [activePolicyKind, policies]);
  const selectedDepartment = useMemo(() => masters.departments.find((department) => department.id === selectedDepartmentId) ?? null, [masters.departments, selectedDepartmentId]);
  const activeItems = activeTab === "departmentDuties" ? [] : masters[activeTab];

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
    setSaveState("idle");
    setMessage(null);
  }

  function selectTab(kind: OrganizationInfoKind) {
    setActiveTab(kind);
    startCreate();
  }

  function selectMaster(item: EmployeeOrganizationMaster) {
    setSelectedMaster(item);
    setSelectedDuty(null);
    setDraft({ ...toDraft(item), parentId: item.parentId ?? undefined, branchId: item.branchId ?? undefined });
    setMessage(null);
  }

  function selectDuty(item: DepartmentDuty) {
    setSelectedDuty(item);
    setSelectedMaster(null);
    setDraft(toDraft(item));
    setMessage(null);
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

  async function toggleActive() {
    const nextActive = !(activeTab === "departmentDuties" ? selectedDuty?.isActive : selectedMaster?.isActive);
    const reason = nextActive ? "조직정보 재사용" : "조직정보 삭제 처리";
    setSaveState("saving");
    try {
      if (activeTab === "departmentDuties") {
        if (!selectedDuty || !selectedDepartmentId) return;
        const response = await fetch(appRoutes.admin.departmentDutyStatus(selectedDepartmentId, selectedDuty.id), {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: nextActive, reason }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(parseError(response.status, payload));
        await loadDuties(selectedDepartmentId);
      } else {
        if (!selectedMaster) return;
        const response = await fetch(appRoutes.admin.organizationInfoItemStatus(activeTab, selectedMaster.id), {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: nextActive, reason }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(parseError(response.status, payload));
        await loadMasters();
      }
      setSaveState("saved");
      setMessage(nextActive ? "다시 사용 처리했습니다." : "삭제 대신 사용중지 처리했습니다.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "사용상태를 변경하지 못했습니다.");
    }
  }

  const codeInputDisabled = Boolean(activePolicy?.autoGenerateEnabled && !activePolicy.manualEditAllowed && !selectedMaster && !selectedDuty);

  return (
    <div className="feature-workspace feature-workspace--hr" data-admin-organization-info="true">
      <aside className="feature-workspace__nav" aria-label="조직정보 사이드 메뉴">
        <div className="feature-workspace__nav-header">
          <h1>조직정보</h1>
          <p className="card-note">코드정보 정책에 따라 신규 조직정보 코드는 자동 생성됩니다.</p>
        </div>
        <div className="feature-workspace__tab-list" role="tablist" aria-label="조직정보 상위 구분">
          <button aria-selected={topTab === "organization"} className="feature-workspace__tab" onClick={() => setTopTab("organization")} role="tab" type="button">조직정보</button>
          <button aria-selected={topTab === "code"} className="feature-workspace__tab" onClick={() => setTopTab("code")} role="tab" type="button">코드정보</button>
        </div>
        <div className="feature-workspace__tab-list" role="tablist" aria-label={topTab === "organization" ? "조직정보 목록 종류" : "코드정보 정책 종류"}>
          {infoTabs.map((tab) => (
            <button key={tab.kind} aria-selected={activeTab === tab.kind} className="feature-workspace__tab" onClick={() => selectTab(tab.kind)} role="tab" type="button">
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="feature-workspace__panel" aria-label="조직정보 본문">
        <div className="feature-workspace__panel-header">
          <div>
            <h2>{topTab === "organization" ? `${infoTabs.find((tab) => tab.kind === activeTab)?.label} 조직정보` : `${infoTabs.find((tab) => tab.kind === activeTab)?.label} 코드정보`}</h2>
            {activeTab === "groups" ? <p className="card-note">사용자그룹은 그룹웨어 내 직원들을 특정 기준으로 묶어 시스템 권한·알림·결재·조회 범위를 적용하기 위한 그룹입니다.</p> : null}
          </div>
          {topTab === "organization" ? (
            <ActionButtonGroup label="조직정보 작업">
              <button className="feature-workspace__plain-action" onClick={startCreate} type="button">+ 등록</button>
            </ActionButtonGroup>
          ) : null}
        </div>

        {message ? <p className="feature-workspace__save-message" role={saveState === "error" || loadState === "error" ? "alert" : "status"}>{message}</p> : null}

        {topTab === "code" ? (
          <aside className="employee-detail-panel" aria-label="코드정보 정책 설정 패널">
            <div className="employee-detail-panel__header">
              <div>
                <strong>{infoTabs.find((tab) => tab.kind === activeTab)?.label} 코드정보</strong>
                <span>조직정보 등록 시 적용될 자동 코드 생성 정책입니다.</span>
              </div>
            </div>
            <div className="employee-detail-panel__body">
              <form className="feature-workspace__form" onSubmit={(event) => { event.preventDefault(); void saveCodePolicy(); }}>
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
                <ActionButtonGroup label="코드정보 정책 저장 작업"><StandardButton disabled={saveState === "saving"} intent="primary" type="submit">저장</StandardButton></ActionButtonGroup>
              </form>
            </div>
          </aside>
        ) : (
          <>
            {activeTab === "departmentDuties" ? (
              <label className="feature-workspace__form">
                <span>부서 선택</span>
                <select aria-label="담당업무 부서 선택" data-hr-input-size="medium" onChange={(event) => { setSelectedDepartmentId(event.target.value); setSelectedDuty(null); setDraft(emptyDraft); }} value={selectedDepartmentId}>
                  <option value="">부서 선택</option>
                  {masters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            ) : null}

            <DataTable label={activeTab === "departmentDuties" ? `${selectedDepartment?.name ?? "부서"} 담당 목록` : `${masterKindLabels[activeTab]} 목록`}>
              <div className="employee-management-table-wrap">
                <table className="employee-management-table">
                  <thead><tr><th scope="col">코드</th><th scope="col">이름</th><th scope="col">사용</th><th scope="col">연결 사원</th><th scope="col">정렬</th></tr></thead>
                  <tbody>
                    {(activeTab === "departmentDuties" ? duties : activeItems).map((item) => (
                      <tr key={item.id} data-selected={(activeTab === "departmentDuties" ? selectedDuty?.id : selectedMaster?.id) === item.id ? "true" : undefined}>
                        <td><button className="page-shell__title-link page-shell__title-button" onClick={() => activeTab === "departmentDuties" ? selectDuty(item as DepartmentDuty) : selectMaster(item as EmployeeOrganizationMaster)} type="button">{item.code}</button></td>
                        <td>{item.name}</td><td>{item.isActive ? "사용" : "중지"}</td><td>{item.linkedEmployeeCount}명</td><td>{item.sortOrder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataTable>

            {(activeTab === "departmentDuties" ? duties : activeItems).length === 0 && loadState !== "loading" ? <EmptyState title="등록된 조직정보가 없습니다" /> : null}

            <aside className="employee-detail-panel" aria-label="조직정보 등록/수정 패널">
              <div className="employee-detail-panel__header"><div><strong>{activeTab === "departmentDuties" ? "담당" : masterKindLabels[activeTab]} {activeTab === "departmentDuties" ? (selectedDuty ? "수정" : "등록") : (selectedMaster ? "수정" : "등록")}</strong><span>신규 등록 시 코드정보 정책에 따라 코드가 자동 생성됩니다.</span></div></div>
              <div className="employee-detail-panel__body">
                <form className="feature-workspace__form" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
                  <label><span>코드</span><input data-hr-input-size="medium" disabled={codeInputDisabled} aria-label={codeInputDisabled ? "코드정보 정책으로 자동 생성" : "코드 입력"} value={draft.code ?? ""} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></label>
                  <label><span>이름</span><input data-hr-input-size="medium" required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                  <label><span>설명</span><input data-hr-input-size="full" value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
                  <label><span>정렬순서</span><input data-hr-input-size="short" inputMode="numeric" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} /></label>
                  {activeTab === "departments" ? <><label><span>상위부서</span><select data-hr-input-size="medium" value={draft.parentId ?? ""} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value || undefined }))}><option value="">없음</option>{masters.departments.filter((department) => department.id !== selectedMaster?.id).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label><span>연결 지사</span><select data-hr-input-size="medium" value={draft.branchId ?? ""} onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value || undefined }))}><option value="">없음</option>{masters.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></> : null}
                  <label><span>사용여부</span><select data-hr-input-size="short" value={draft.isActive ? "true" : "false"} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.value === "true" }))}><option value="true">사용</option><option value="false">중지</option></select></label>
                  <label><span>변경 사유</span><input data-hr-input-size="full" required value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} /></label>
                  <ActionButtonGroup label="조직정보 저장 작업"><StandardButton disabled={saveState === "saving"} intent="primary" type="submit">{saveState === "saving" ? "저장 중" : "저장"}</StandardButton><StandardButton disabled={saveState === "saving" || (activeTab === "departmentDuties" ? !selectedDuty : !selectedMaster)} intent="danger" onClick={() => void toggleActive()} type="button">삭제/사용중지</StandardButton></ActionButtonGroup>
                </form>
              </div>
            </aside>
          </>
        )}
      </section>
    </div>
  );
}
