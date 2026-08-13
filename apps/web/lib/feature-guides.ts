import type { FeatureGuideContent } from "@werehere/ui";

export const accountFeatureGuides = {
  "account-administration.list": {
    audience: ["사용자 계정을 조회할 수 있는 관리자"],
    cautions: [
      "검색 결과에는 현재 회사와 권한범위에서 조회할 수 있는 사용자만 표시됩니다.",
      "사용자 생성 버튼은 별도 생성 권한이 있을 때만 표시됩니다.",
    ],
    featureKey: "account-administration.list",
    permissions: [
      "사용자 조회 권한이 필요합니다.",
      "새 계정을 만들려면 사용자 생성 권한이 추가로 필요합니다.",
    ],
    steps: [
      "이름이나 로그인 아이디를 검색하거나 상태·사용자유형을 선택합니다.",
      "조회 버튼을 눌러 조건에 맞는 사용자를 확인합니다.",
      "사용자 이름을 선택해 계정 상세와 연결 호텔을 확인합니다.",
    ],
    summary: "회사 사용자와 로그인 상태, 사용자유형, 연결 호텔을 조회합니다.",
    title: "사용자 계정",
    version: "1.0",
  },
  "account-administration.create": {
    audience: ["사용자 계정을 생성할 수 있는 관리자"],
    cautions: [
      "로그인 아이디는 영문 소문자와 숫자 3~30자로 입력하며 다른 사용자와 중복될 수 없습니다.",
      "하우스키핑 사용자는 업무할 호텔을 여러 곳 선택할 수 있습니다.",
      "임시 비밀번호는 안전한 방법으로 본인에게 전달하고 생성 사유에는 비밀번호나 개인정보를 입력하지 않습니다.",
      "생성된 사용자는 처음 로그인할 때 새 비밀번호를 설정해야 합니다.",
    ],
    featureKey: "account-administration.create",
    permissions: [
      "사용자 생성 권한이 필요합니다.",
      "현재 권한범위에서 배정 가능한 활성 호텔만 선택할 수 있습니다.",
    ],
    steps: [
      "표시이름, 로그인 아이디, 이메일과 사용자유형을 입력합니다.",
      "연결 호텔과 배정 시작일을 선택합니다.",
      "임시 비밀번호와 생성 사유를 입력한 뒤 사용자 생성을 누릅니다.",
      "생성 후 이동한 상세 화면에서 계정과 호텔 연결을 확인합니다.",
    ],
    summary: "사람 계정과 호텔관리 업무범위를 한 번에 생성합니다.",
    title: "사용자 생성",
    version: "1.0",
  },
  "account-administration.detail": {
    audience: ["사용자 계정 상세를 조회할 수 있는 관리자"],
    cautions: [
      "계정을 중지하면 기존 로그인 세션이 종료되고 다시 로그인할 수 없습니다.",
      "중지 작업은 확인 후 즉시 적용되므로 대상 사용자와 사유를 다시 확인합니다.",
      "중지 사유에는 비밀번호나 불필요한 개인정보를 입력하지 않습니다.",
    ],
    featureKey: "account-administration.detail",
    permissions: [
      "사용자 조회 권한이 필요합니다.",
      "계정 중지는 사용자 중지 권한이 있을 때만 사용할 수 있습니다.",
    ],
    steps: [
      "로그인 아이디, 사용자유형, 상태와 연결 호텔을 확인합니다.",
      "계정을 중지해야 하면 중지 사유를 입력합니다.",
      "계정 중지를 누르고 확인창에서 대상과 영향을 확인한 뒤 승인합니다.",
    ],
    summary:
      "사용자의 로그인 상태와 호텔관리 업무범위를 확인하고 필요한 경우 계정을 중지합니다.",
    title: "사용자 상세",
    version: "1.0",
  },
} as const satisfies Record<string, FeatureGuideContent>;

export type AccountFeatureGuideKey = keyof typeof accountFeatureGuides;

export const hotelFeatureGuides = {
  "hotel-operational-issue.lifecycle": {
    audience: ["운영이슈 권한과 현재 호텔배정 또는 소유주 연결이 있는 사용자"],
    cautions: [
      "긴급 등급은 현장 판단으로 직접 선택하며 시스템이 자동판정하지 않습니다.",
      "공개댓글은 호텔 소유주에게도 표시되므로 내부 협의 내용은 내부메모에 기록합니다.",
      "숫자 SLA 정책이 설정되지 않은 경우 일반 초과 알림을 만들지 않습니다.",
    ],
    featureKey: "hotel-operational-issue.lifecycle",
    permissions: [
      "조회·등록·작업·관리 권한과 현재 호텔배정 또는 소유주 연결을 요청마다 다시 확인합니다.",
    ],
    steps: [
      "등급과 현장 내용을 입력해 운영이슈를 접수합니다.",
      "같은 호텔의 사내 임직원 또는 하우스키핑 담당자를 지정합니다.",
      "담당자는 처리 시작, 작업기록과 조치완료를 저장합니다.",
      "관리자는 필요하면 보류·재개하고 조치결과 확인 후 종료합니다.",
      "소유주와 공유할 내용은 공개댓글로 기록합니다.",
    ],
    summary:
      "호텔 운영이슈를 접수하고 담당 지정, 현장 처리, 조치완료와 종료까지 관리합니다.",
    title: "운영이슈",
    version: "1.0",
  },
  "hotel-calendar.workspace": {
    audience: ["업무 달력 조회권한과 현재 호텔배정 또는 연결이 있는 사용자"],
    cautions: [
      "점검은 실제 마감시각에 표시되며 별도의 종료시각을 만들어 표시하지 않습니다.",
      "하우스키핑 사용자는 권한 있는 점검과 본인에게 배정된 방문일정만 확인할 수 있습니다.",
      "그룹웨어 일정은 PostgreSQL 정본으로 저장되며 저장 직후 자체 달력에서 다시 확인합니다.",
    ],
    featureKey: "hotel-calendar.workspace",
    permissions: ["달력 조회권한과 점검·보수 자료별 조회권한을 요청마다 다시 확인합니다."],
    steps: [
      "월간 또는 주간 보기에서 점검 마감과 보수 방문일정을 확인합니다.",
      "일정을 선택해 호텔, 시간, 대상과 현재 상태를 확인합니다.",
      "방문일정 등록권한이 있으면 진행 중인 보수 건과 수행자를 선택해 일정을 저장합니다.",
      "모바일에서는 선택 날짜의 현장업무 카드를 순서대로 확인합니다.",
    ],
    summary: "권한 있는 호텔의 점검 마감과 보수 방문일정을 월간·주간 또는 날짜별 카드로 확인합니다.",
    title: "업무 달력",
    version: "1.0",
  },
  "hotel-repair.lifecycle": {
    audience: ["보수 조회·등록·방문·완료 권한과 현재 호텔배정이 있는 사내 임직원"],
    cautions: [
      "우선순위는 자동판정하지 않으며 활성 설정 중 하나를 직접 선택합니다.",
      "외부업체 연락처 원문은 별도 권한이 있을 때만 표시됩니다.",
      "최종완료 뒤 기존 보수는 수정하거나 재개하지 않고 새 후속 보수를 등록합니다.",
    ],
    featureKey: "hotel-repair.lifecycle",
    permissions: ["보수 자료 조회권한이 필요하며 등록·일정·완료는 각각의 동적 권한을 다시 확인합니다."],
    steps: ["대상과 하자증빙, 우선순위를 선택해 보수를 등록합니다.","정확한 방문시간과 내부 수행자 또는 외부업체 한 곳을 등록합니다.","작업결과와 완료증빙을 저장하고 프로세스 검토 뒤 최종완료합니다."],
    summary: "호텔 하자를 등록하고 여러 방문 작업과 최종완료, 후속 보수까지 관리합니다.",
    title: "하자·보수",
    version: "1.0",
  },
  "hotel-inspection.review": {
    audience: ["점검 검토 권한과 현재 호텔배정이 있는 사내 임직원"],
    cautions: [
      "현재 나에게 배정됐거나 지금 유효한 대리 업무만 대기 목록에 표시됩니다.",
      "승인·반려 버튼은 점검 생성 당시 프로세스 revision에 저장된 처리만 표시됩니다.",
      "사진은 현재 점검결과에 연결된 검역 완료본만 열리며 외부에 다시 공유하지 않습니다.",
    ],
    featureKey: "hotel-inspection.review",
    permissions: [
      "점검 검토 권한과 현재 호텔배정이 모두 필요합니다.",
      "사진을 보려면 호텔 파일 읽기 권한이 추가로 필요합니다.",
    ],
    steps: [
      "검토 대기 목록에서 객실과 현재 단계를 확인하고 업무를 선택합니다.",
      "수행 기록, 항목별 결과와 검역 완료 사진을 읽기 전용으로 확인합니다.",
      "판단 근거나 인계 내용을 처리 사유에 입력합니다.",
      "허용된 승인 또는 반려를 선택하고 확인창에서 처리 내용을 확정합니다.",
      "처리 후 최신 대기 목록과 안내 메시지로 저장 결과를 확인합니다.",
    ],
    summary:
      "배정된 호텔 점검결과와 사진을 확인하고 생성 당시 프로세스에 따라 승인하거나 반려합니다.",
    title: "점검 검토",
    version: "1.0",
  },
  "hotel-management.detail": {
    audience: [
      "호텔 정보를 조회할 수 있는 사내 임직원, 하우스키핑, 호텔 소유주",
    ],
    cautions: [
      "내부 메모는 권한이 있는 사내 임직원에게만 표시됩니다.",
      "운영상태를 변경할 때는 현장 확인 결과와 변경 사유를 정확히 입력합니다.",
      "운영제외는 객실 삭제가 아니며 상태이력은 계속 보존됩니다.",
    ],
    featureKey: "hotel-management.detail",
    permissions: [
      "객실 목록을 보려면 현재 호텔의 객실 조회 권한이 필요합니다.",
      "객실·객실유형 등록과 수정, 상태변경은 각각의 관리 권한이 있을 때만 표시됩니다.",
    ],
    steps: [
      "호텔 기본정보와 현재 관계를 확인합니다.",
      "객실관리에서 객실번호·층·유형·운영상태를 검색합니다.",
      "권한이 있으면 객실이나 객실유형을 등록·수정하고 운영상태와 사유를 저장합니다.",
      "저장 후 다시 조회된 최신 객실 정보와 상태를 확인합니다.",
    ],
    summary:
      "호텔 기본정보, 관계, 객실과 운영상태를 한 화면에서 확인하고 관리합니다.",
    title: "호텔 상세",
    version: "1.0",
  },
} as const satisfies Record<string, FeatureGuideContent>;

export type HotelFeatureGuideKey = keyof typeof hotelFeatureGuides;

export const hotelFeatureGuideRoutes = {
  "/hotels/calendar": "hotel-calendar.workspace",
  "/hotels/[hotelId]/calendar": "hotel-calendar.workspace",
  "/hotels/[hotelId]": "hotel-management.detail",
  "/hotels/[hotelId]/issues": "hotel-operational-issue.lifecycle",
  "/hotels/[hotelId]/repairs": "hotel-repair.lifecycle",
  "/hotels/[hotelId]/inspections/reviews": "hotel-inspection.review",
} as const satisfies Record<string, HotelFeatureGuideKey>;

export const accountFeatureGuideRoutes = {
  "/admin/users": "account-administration.list",
  "/admin/users/new": "account-administration.create",
  "/admin/users/[userId]": "account-administration.detail",
} as const satisfies Record<string, AccountFeatureGuideKey>;
