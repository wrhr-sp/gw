export const adminHubCards = [
  {
    href: "/admin/users",
    title: "사용자 / 권한",
    description: "사용자-직원 연결, 역할 후보, 고위험 권한 노출 정책을 점검하는 운영 영역",
  },
  {
    href: "/admin/policies",
    title: "운영 정책",
    description: "근태·휴가·문서·게시판 운영 정책 placeholder 와 diff 기준을 모아두는 영역",
  },
  {
    href: "/admin/audit-logs",
    title: "감사 로그",
    description: "actor/action/target/time 기준으로 운영 이력 후보를 추적하는 조회 영역",
  },
] as const;

export const adminUserHighlights = [
  "실운영 권한 변경 없이 diff/감사 후보만 점검",
  "invite.manage / audit.read / board.manage / document.space.manage 같은 고위험 권한 노출 위치 고정",
  "일반 사용자 업무 화면과 관리자 변경 화면을 분리 유지",
] as const;

export const adminUserReviewFields = [
  "사용자-직원 연결 상태",
  "현재 역할 / 후보 역할 before-after",
  "고위험 권한 노출 위치",
  "변경 사유 placeholder",
  "감사 이벤트 preview",
] as const;

export const adminPolicySections = [
  {
    title: "문서 / 첨부 정책",
    items: [
      "visibility / allowlist / retention 후보",
      "storageKey 원문 노출 금지",
      "signed URL 전문 저장 금지",
    ],
  },
  {
    title: "게시판 / 공지 정책",
    items: [
      "게시판 visibility / moderation 후보",
      "읽음 확인 운영 기준 placeholder",
      "일반 작성 흐름과 운영 변경 UI 분리",
    ],
  },
  {
    title: "근태 / 휴가 / 결재 정책",
    items: [
      "운영 변경 사유 입력 placeholder",
      "저장 전 before/after diff 요약",
      "실데이터 반영 전 dev-safe candidate 응답 유지",
    ],
  },
] as const;

export const adminAuditLogPreviewFilters = ["actor", "action", "target", "time", "category"] as const;

export const adminPolicyReviewChecklist = [
  "before/after diff 요약 유지",
  "변경 사유 placeholder 유지",
  "capability 확인 후 candidate 응답만 반환",
  "maskedFields 와 audit.candidate 유지",
] as const;

export const adminAuditNotes = [
  "raw storageKey, bucket, public URL, secret 은 감사 응답에 넣지 않습니다.",
  "문서/첨부 관련 감사는 fileId / spaceId / versionId / storageStatus 정도만 남깁니다.",
  "외부 전송/장기 보관/실운영 변경은 이번 1차 범위에서 제외합니다.",
] as const;

export const adminAuditDetailFields = [
  "actor 표시 이름",
  "target 표시 이름",
  "변경 사유",
  "before / after 요약",
  "maskedFields",
] as const;
