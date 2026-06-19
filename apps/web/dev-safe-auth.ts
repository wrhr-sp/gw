import type { RoleCode } from "@gw/shared";

export const devSafeLoginId = "admin";
export const devSafeLoginPassword = "1234";
export const devSafeLoginEmail = "admin@example.com";

export const devSafeRoleOptions: { value: RoleCode; label: string; description: string; landingRoute: string }[] = [
  {
    value: "COMPANY_ADMIN",
    label: "경영관리자 UAT",
    description: "홈(/home)에서 시작해 경영업무와 계정관리까지 바로 이어 봅니다.",
    landingRoute: "/home",
  },
  {
    value: "HR_ADMIN",
    label: "인사관리자 UAT",
    description: "사용자/권한 검토를 더 빨리 보려는 경우에 사용합니다.",
    landingRoute: "/home",
  },
  {
    value: "MANAGER",
    label: "팀장/결재자 UAT",
    description: "일반 홈에서 승인 대기와 팀 병목을 먼저 확인합니다.",
    landingRoute: "/home",
  },
  {
    value: "EMPLOYEE",
    label: "일반 직원 UAT",
    description: "근태·휴가·전자결재 중심의 일반 직원 홈을 확인합니다.",
    landingRoute: "/home",
  },
  {
    value: "AUDITOR",
    label: "감사 UAT",
    description: "감사 로그와 민감 업무 허브를 읽기 전용으로 확인합니다.",
    landingRoute: "/admin/audit-logs",
  },
];

const landingRouteByRole = new Map(devSafeRoleOptions.map((item) => [item.value, item.landingRoute]));

export function getPostLoginRoute(roleCode: RoleCode) {
  return landingRouteByRole.get(roleCode) ?? "/home";
}
