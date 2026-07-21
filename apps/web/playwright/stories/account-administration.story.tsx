import { PageHeader } from "@werehere/ui";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useState } from "react";
import { AccountCreateForm } from "../../components/accounts/account-create-form";
import { AccountDetailView } from "../../components/accounts/account-detail-view";
import { HotelShell } from "../../components/hotels/hotel-shell";

const router: AppRouterInstance = {
  back() {},
  forward() {},
  prefetch: async () => undefined,
  push() {},
  refresh() {},
  replace() {},
};

const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "호텔 관리자",
  identityId: "20000000-0000-4000-8000-000000000001",
  sessionId: "30000000-0000-4000-8000-000000000001",
  userId: "40000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
};

export function AccountCreateStory() {
  const [pushedPath, setPushedPath] = useState("");
  const storyRouter: AppRouterInstance = {
    ...router,
    push(path) { setPushedPath(path); },
  };
  return (
    <>
      <AppRouterContext.Provider value={storyRouter}>
        <HotelShell accountPermissions={["USER_READ", "USER_CREATE", "USER_SUSPEND"]} currentPath="/admin/users" principal={principal}>
          <div className="mx-auto flex w-full max-w-hotel-detail flex-col gap-6">
            <PageHeader eyebrow="사용자 계정" title="사용자 생성" description="사람 계정과 호텔관리 업무범위를 한 번에 생성합니다." />
            <AccountCreateForm defaultDate="2026-07-19" hotels={[
              { id: "50000000-0000-4000-8000-000000000001", name: "위아히어 강남호텔" },
              { id: "50000000-0000-4000-8000-000000000002", name: "위아히어 부산호텔" },
            ]} />
          </div>
        </HotelShell>
      </AppRouterContext.Provider>
      <output className="sr-only" data-testid="router-push-path">{pushedPath}</output>
    </>
  );
}

export function AccountDetailStory() {
  return (
    <AppRouterContext.Provider value={router}>
      <HotelShell accountPermissions={["USER_READ", "USER_SUSPEND"]} currentPath="/admin/users" principal={principal}>
        <AccountDetailView
          account={{
            id: "21000000-0000-4000-8000-000000000001",
            displayName: "김하우스",
            loginName: "housekeeper01",
            email: "housekeeper-01@example.invalid",
            userType: "HOUSEKEEPING",
            status: "ACTIVE",
            hotelId: "50000000-0000-4000-8000-000000000001",
            hotelName: "위아히어 강남호텔",
            hotelCode: "GANGNAM-01",
            hotels: [
              { id: "50000000-0000-4000-8000-000000000001", name: "위아히어 강남호텔", code: "GANGNAM-01" },
              { id: "50000000-0000-4000-8000-000000000002", name: "위아히어 부산호텔", code: "BUSAN-01" },
            ],
            version: 2,
            createdAt: "2026-07-19T00:00:00.000Z",
            updatedAt: "2026-07-19T01:00:00.000Z",
          }}
          canSuspend
        />
      </HotelShell>
    </AppRouterContext.Provider>
  );
}
