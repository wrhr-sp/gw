import React from "react";

import { PageShell } from "../../_components/page-shell";
import { OrganizationInfoClient } from "./organization-info-client";

export default function OrganizationInfoPage() {
  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      title="조직정보"
    >
      <OrganizationInfoClient />
    </PageShell>
  );
}
