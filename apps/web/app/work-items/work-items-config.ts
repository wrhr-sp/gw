export type WorkItemModuleKey = "hub" | "hr" | "tax" | "labor" | "legal" | "branch";

export type WorkItemModuleDetailSection = {
  title: string;
  items: string[];
};

export type WorkItemModuleCard = {
  slug: Exclude<WorkItemModuleKey, "hub">;
  href: string;
  title: string;
  summary: string;
  roleScope: string;
  accessNote: string;
  apiRoutes: string[];
  milestones: string[];
  detailSections?: WorkItemModuleDetailSection[];
};

export const workItemModuleCards: WorkItemModuleCard[] = [
  {
    slug: "hr",
    href: "/work-items/hr",
    title: "인사 업무",
    summary: "직원 lifecycle, 1:1/인사면담/평가/고충/교육 흐름을 공통 work item skeleton 위에 얹어 설명합니다.",
    roleScope: "본사 HR / 지점 관리자 / 일반 직원(자기 건) / 감사",
    accessNote: "실민감 인사 원문과 외부 캘린더 연동은 닫고, 일정·참석자·안건·후속조치 metadata 만 먼저 노출합니다.",
    apiRoutes: ["/api/work-items?module=hr", "/api/work-items/:id", "/api/work-items/:id/documents", "/api/work-items/:id/attachments"],
    milestones: ["직원 lifecycle 단계", "1:1·인사면담·평가·고충·교육 카테고리", "본사 HR / 지점 관리자 / 일반 직원 visibility 분리"],
    detailSections: [
      {
        title: "이번 단계 meeting 유형",
        items: ["온보딩", "정기 1:1", "인사 면담", "평가 피드백", "고충 대응", "교육/코칭", "오프보딩"],
      },
      {
        title: "누가 어디까지 보는가",
        items: [
          "본사 HR은 여러 지점 HR 흐름과 제한 메모 존재 여부를 본다.",
          "지점 관리자는 자기 지점 일정/후속조치 요약만 보고 HR 비공개 원문은 보지 않는다.",
          "일반 직원은 자기 일정과 자기 follow-up 만 본다.",
        ],
      },
      {
        title: "계속 닫아 두는 것",
        items: ["실제 평가 원문 저장", "실제 고충/징계 원문 저장", "외부 캘린더·메일·메신저 자동 연동"],
      },
    ],
  },
  {
    slug: "tax",
    href: "/work-items/tax",
    title: "세무 업무",
    summary: "지점별 증빙 회수와 월말 마감 상태를 회사/지점 혼합 scope 로 묶습니다.",
    roleScope: "본사 관리자 / 지점 관리자 / 감사",
    accessNote: "실제 신고 제출 자동화는 열지 않고 회수율·마감 상태만 보여 줍니다.",
    apiRoutes: ["/api/work-items?module=tax", "/api/work-item-deadlines", "/api/work-items/:id/reviews"],
    milestones: ["증빙 회수", "월말 마감", "검토 메모"],
  },
  {
    slug: "labor",
    href: "/work-items/labor",
    title: "노무 업무",
    summary: "근태 예외 후속조치와 점검 메모를 지점 관리자와 본사 운영이 같은 구조로 확인합니다.",
    roleScope: "지점 관리자 / 본사 관리자 / 인사 / 감사",
    accessNote: "실제 시정 조치 저장 없이 업무 카드와 검토 흐름 자리만 잡습니다.",
    apiRoutes: ["/api/work-items?module=labor", "/api/work-item-deadlines"],
    milestones: ["근태 예외", "후속조치 체크", "지점/본사 경계"],
  },
  {
    slug: "legal",
    href: "/work-items/legal",
    title: "법무 업무",
    summary: "계약 검토 요청, 검토 의견, 승인 대기 상태를 공통 review skeleton 으로 모읍니다.",
    roleScope: "본사 관리자 / 감사",
    accessNote: "외부 법무 연동 없이 내부 승인 게이트와 blocked 사유만 남깁니다.",
    apiRoutes: ["/api/work-items?module=legal", "/api/work-items/:id/reviews"],
    milestones: ["계약 검토 요청", "승인 게이트", "blocked 기록"],
  },
  {
    slug: "branch",
    href: "/work-items/branch",
    title: "지점 업무",
    summary: "지점 일일 보고와 마감 후속조치를 branch scope 기반 공통 카드로 보여 줍니다.",
    roleScope: "지점 관리자 / 본사 관리자 / 일반 사용자(읽기 일부)",
    accessNote: "하단 탭을 늘리지 않고 홈/메뉴/PC sidebar에서 지점 업무 자리를 확보합니다.",
    apiRoutes: ["/api/work-items?module=branch", "/api/work-item-deadlines"],
    milestones: ["일일 마감", "후속 메모", "지점 읽기 경로"],
  },
];

export const workItemHubHighlights = [
  "공통 work item 목록, 상세, 문서, 첨부, 검토, 마감 API 골격을 먼저 맞춥니다.",
  "회사/지점/역할/capability 기반 설명을 한 화면에서 읽게 하고 실제 저장·외부 전송은 열지 않습니다.",
  "모바일 하단 탭은 유지하고 홈/메뉴/PC sidebar 안에 새 허브를 추가합니다.",
] as const;

export const workItemGuardrails = [
  "민감 원문 첨부는 metadata-only 로 남기고 실제 파일 내용 노출은 하지 않습니다.",
  "세무 신고, 외부 법무, 외부 저장소 발송 같은 운영 자동화는 이번 단계 범위가 아닙니다.",
  "검토/마감 상태는 placeholder 이며 실제 승인 완료처럼 과장하지 않습니다.",
] as const;

export function getWorkItemModuleCard(slug: Exclude<WorkItemModuleKey, "hub">) {
  return workItemModuleCards.find((card) => card.slug === slug) ?? null;
}
