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
    summary: "사용자의 로그인 상태와 호텔관리 업무범위를 확인하고 필요한 경우 계정을 중지합니다.",
    title: "사용자 상세",
    version: "1.0",
  },
} as const satisfies Record<string, FeatureGuideContent>;

export type AccountFeatureGuideKey = keyof typeof accountFeatureGuides;

export const accountFeatureGuideRoutes = {
  "/admin/users": "account-administration.list",
  "/admin/users/new": "account-administration.create",
  "/admin/users/[userId]": "account-administration.detail",
} as const satisfies Record<string, AccountFeatureGuideKey>;
