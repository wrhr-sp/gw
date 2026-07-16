import { PageHeader } from "@werehere/ui";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { HotelCreateForm } from "../../components/hotels/hotel-create-form";
import { HotelShell } from "../../components/hotels/hotel-shell";

const router: AppRouterInstance = {
  back() {},
  forward() {},
  prefetch: async () => undefined,
  push() {},
  refresh() {},
  replace() {},
};

export function HotelCreateStory() {
  return (
    <AppRouterContext.Provider value={router}>
      <HotelShell
        currentPath="/hotels"
        principal={{
          companyId: "10000000-0000-4000-8000-000000000001",
          displayName: "호텔 관리자",
          identityId: "20000000-0000-4000-8000-000000000001",
          sessionId: "30000000-0000-4000-8000-000000000001",
          userId: "40000000-0000-4000-8000-000000000001",
          userType: "INTERNAL_STAFF",
        }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <PageHeader
            description="호텔 식별정보와 위탁계약 기본정보를 입력합니다. 등록 후 상세정보를 다시 조회합니다."
            eyebrow="지점관리"
            title="호텔 등록"
          />
          <HotelCreateForm />
        </div>
      </HotelShell>
    </AppRouterContext.Provider>
  );
}
