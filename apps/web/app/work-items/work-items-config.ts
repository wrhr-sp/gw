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
    summary: "지점별 증빙 제출, 세목별 마감, HQ 전달 패키지 준비를 공통 work item skeleton 으로 묶습니다.",
    roleScope: "본사 세무 담당 / 지점 관리자 / 감사",
    accessNote: "실제 홈택스 신고·회계프로그램 연동·실세무 원문 업로드는 닫고, 제출 상태·반려 사유·전달 패키지 준비 metadata 만 먼저 보여 줍니다.",
    apiRoutes: ["/api/work-items?module=tax", "/api/work-items/:id", "/api/work-item-deadlines", "/api/work-items/:id/reviews"],
    milestones: ["증빙 수집", "부가세/원천세/지방세/법인세 마감 skeleton", "HQ 검토·반려·전달 패키지 준비", "본사 세무 담당 / 지점 관리자 visibility 분리"],
    detailSections: [
      {
        title: "이번 단계 tax 유형",
        items: ["증빙 수집", "부가세 마감", "원천세 신고 준비", "지방세 보고", "법인세 준비", "누락 영수증 보완", "세무 조정 검토", "세무사 전달 패키지 준비"],
      },
      {
        title: "누가 어디까지 보는가",
        items: [
          "본사 세무 담당은 여러 지점 제출 상태와 패키지 준비 상태를 company scope 로 본다.",
          "지점 관리자는 자기 지점 제출 대상, 반려 사유, 다음 제출 마감만 본다.",
          "감사는 원문 대신 상태 변경, 반려 이력, 접근 흔적 중심으로 read-only 추적한다.",
        ],
      },
      {
        title: "계속 닫아 두는 것",
        items: ["홈택스 직접 신고/전송", "회계프로그램·세무사 외부 계정 연동", "실세무 원문 대량 업로드", "제출 완료를 운영 사실처럼 기록하는 자동화"],
      },
    ],
  },
  {
    slug: "labor",
    href: "/work-items/labor",
    title: "노무 업무",
    summary: "근로계약·연차/수당·고충·징계·사고·퇴사 이슈를 공통 work item 위의 labor skeleton 으로 묶고 restricted 경계를 더 좁게 나눕니다.",
    roleScope: "본사 HR/노무 · 지점 관리자 · 일반 직원(자기 건 일부) · 감사",
    accessNote: "실제 계약서/징계/사고 원문 저장과 외부 노무·급여 연동은 닫고, category·intake·evidence·follow-up metadata 만 먼저 노출합니다.",
    apiRoutes: ["/api/work-items?module=labor", "/api/work-items/:id", "/api/work-item-deadlines"],
    milestones: ["노무 category 확장", "intake/confidentiality metadata", "restricted labor capability 분리"],
    detailSections: [
      {
        title: "이번 단계 labor 유형",
        items: ["근로계약", "근무조건 변경", "연차/잔여 정정", "수당 검토", "초과근무 검토", "고충", "징계 검토", "사고 접수", "퇴사/종료"],
      },
      {
        title: "누가 어디까지 보는가",
        items: [
          "본사 HR/노무는 회사 단위 labor metadata 를 보고 restricted 건은 별도 capability 가 있어야 본다.",
          "지점 관리자는 자기 지점 일정/자료 요청/후속조치 요약만 보고 제한 메모 원문은 보지 않는다.",
          "일반 직원은 자기 제출 요청과 자기 이슈 상태 일부만 보는 전제다.",
          "감사는 민감 원문 대신 열람 흔적과 상태 변경 중심으로 본다.",
        ],
      },
      {
        title: "계속 닫아 두는 것",
        items: ["실제 계약서/변경합의서 원문 저장", "실제 징계 확정/통지", "실제 사고 신고 제출", "외부 노무사·법무·급여 연동"],
      },
    ],
  },
  {
    slug: "legal",
    href: "/work-items/legal",
    title: "법무 업무",
    summary: "계약 검토 요청, 계약 갱신 예정, 분쟁/클레임/보험 후속을 공통 work item skeleton 안에서 metadata 중심으로 묶습니다.",
    roleScope: "본사 법무/운영 담당 / 지점 관리자 / 감사",
    accessNote: "실계약서 원문, 분쟁 자료 원문, 외부 변호사/보험사 연동은 닫고 계약 분류·갱신일·답변 준비·승인 게이트 metadata 만 먼저 노출합니다.",
    apiRoutes: ["/api/work-items?module=legal", "/api/work-items/:id", "/api/work-items/:id/reviews", "/api/work-item-deadlines"],
    milestones: ["계약 검토 요청", "계약 분류와 갱신 예정", "분쟁/클레임/보험 후속", "본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 분리"],
    detailSections: [
      {
        title: "이번 단계 legal 유형",
        items: [
          "계약 검토 요청",
          "계약 갱신 예정",
          "위탁운영 계약",
          "임대차 계약",
          "용역 계약",
          "협력사 계약",
          "개인정보처리위탁 계약",
          "분쟁/클레임 접수",
          "보험/사고 후속",
        ],
      },
      {
        title: "누가 어디까지 보는가",
        items: [
          "본사 법무/운영 담당은 여러 지점 계약 요청, 갱신 예정, 분쟁 후속 상태를 company scope 로 본다.",
          "지점 관리자는 자기 지점 계약 요청, 보완 요청, 만료 임박 안내만 본다.",
          "감사는 원문 대신 상태 변경, 접근 흔적, 승인 게이트 대기 사유를 read-only 로 본다.",
        ],
      },
      {
        title: "계속 닫아 두는 것",
        items: ["실계약서 원문 저장/비교/버전관리 확대", "외부 변호사·보험사·기관 계정 직접 연동", "실분쟁 자료 업로드 확대와 실제 제출 자동화"],
      },
    ],
  },
  {
    slug: "branch",
    href: "/work-items/branch",
    title: "지점 업무",
    summary: "지점 일일 보고와 마감 후속조치를 branch scope 기반 공통 카드로 보여 줍니다.",
    roleScope: "지점 관리자 / 본사 관리자 / 감사",
    accessNote: "일반 직원 홈과 직접 섞지 않고, branch scope 운영 레인에서만 지점 업무 자리를 유지합니다.",
    apiRoutes: ["/api/work-items?module=branch", "/api/work-item-deadlines"],
    milestones: ["일일 마감", "후속 메모", "지점 읽기 경로"],
  },
];

export const workItemHubModuleCards = workItemModuleCards.filter((card) => card.slug !== "legal");
export const managementWorkItemCards = workItemModuleCards.filter((card) => card.slug === "legal");

export const workItemHubHighlights = [
  "공통 work item 목록, 상세, 문서, 첨부, 검토, 마감 API 골격을 먼저 맞춥니다.",
  "회사/지점/역할/capability 기반 설명을 한 화면에서 읽게 하고 실제 저장·외부 전송은 열지 않습니다.",
  "민감 문서/첨부는 metadata preview 와 approval gate 언어로만 연결하고 raw 원문 저장 완료처럼 쓰지 않습니다.",
  "모바일 하단 탭은 유지하고 홈/메뉴/PC sidebar 안에 새 허브를 추가합니다.",
] as const;

export const workItemGuardrails = [
  "민감 원문 첨부는 metadata-only 로 남기고 실제 파일 내용 노출은 하지 않습니다.",
  "세무 신고, 외부 법무, 외부 저장소 발송 같은 운영 자동화는 이번 단계 범위가 아닙니다.",
  "검토/마감 상태는 placeholder 이며 실제 승인 완료처럼 과장하지 않습니다.",
  "payroll / documents / audit preview 와 연결되더라도 실원문 저장 확대, 외부 제출, production migration 은 계속 승인 게이트입니다.",
] as const;

export function getWorkItemModuleCard(slug: Exclude<WorkItemModuleKey, "hub">) {
  return workItemModuleCards.find((card) => card.slug === slug) ?? null;
}
