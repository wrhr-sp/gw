import React from "react";

import { PageShell } from "../../_components/page-shell";
import { ManagementSupportHrClient } from "../_components/management-support-hr-client";

export default function Page() {
  return (
    <PageShell title="인사관리" titlePlacement="content" titleHref={null}>
      <ManagementSupportHrClient />
    </PageShell>
  );
}
