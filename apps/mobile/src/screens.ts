import {
  nativeMobileApprovalGates,
  nativeMobileInternalPilotSmokeChecklist,
  nativeMobilePrimaryRouteMappings,
  nativeMobileRoleScopeNotes,
  type NativeMobilePrimaryScreenId,
} from "@gw/shared";

export type MobileScreenWireframe = {
  id: NativeMobilePrimaryScreenId;
  title: string;
  headline: string;
  sections: readonly string[];
  guardrails: readonly string[];
  smokeFocus: readonly string[];
};

const screenSpecificSections: Record<NativeMobilePrimaryScreenId, readonly string[]> = {
  login: ["회사 이메일", "비밀번호", "secure storage bridge 안내", "운영 SSO 승인 분리 안내"],
  dashboard: ["오늘 할 일 요약", "승인 대기 카드", "공지/문서 읽기 진입", "권한별 첫 액션"],
  attendance: ["출근/퇴근 CTA", "최근 기록", "정정 요청 진입", "오프라인 honesty 안내"],
  leave: ["잔여 요약", "신청 카드", "승인 대기 요약", "정책 source 메모"],
  approvals: ["내 문서", "승인 대기", "큰 승인/반려 CTA", "모바일 상세 drill-down"],
  collaboration: ["공지 목록", "게시판/문서 묶음 진입", "읽기 중심 placeholder", "파일 업로드 승인 게이트"],
  me: ["내 세션 요약", "내 역할/권한", "보안 설정 안내", "로그아웃/세션 clear"],
};

const commonGuardrails = [
  "운영 origin 하드코딩 금지",
  "Web cookie 복제를 모바일 기본값처럼 사용하지 않기",
  "기본 탭에 /admin/* 와 스토어 제출 CTA 를 섞지 않기",
] as const;

export const mobileScreenWireframes: readonly MobileScreenWireframe[] = nativeMobilePrimaryRouteMappings.map((item) => {
  const access = item.access as { notes: string; actionGate?: { notes: string } };
  const smokeChecklistItem = nativeMobileInternalPilotSmokeChecklist.find((check) => check.id === item.id);

  return {
    id: item.id,
    title: item.label,
    headline: item.summary,
    sections: screenSpecificSections[item.id],
    smokeFocus: smokeChecklistItem?.verify ?? [],
    guardrails: [
      ...commonGuardrails,
      access.notes,
      ...(access.actionGate ? [access.actionGate.notes] : []),
      item.id === "collaboration"
        ? "파일 업로드·다운로드와 실저장소 연결은 후속 승인 게이트 후 확장"
        : item.id === "login"
          ? "로그인 성공 후 세션 저장은 secure storage bridge 를 통과해야 함"
          : "상태 변경은 온라인/API 연결이 확인된 경우에만 성공처럼 보이게 함",
    ],
  };
});

export const mobileApprovalGateChecklist = {
  beforeStoreBuild: [...nativeMobileApprovalGates],
  roleScopeNotes: nativeMobileRoleScopeNotes,
} as const;
