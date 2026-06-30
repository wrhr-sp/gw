import React from "react";

import { PageShell } from "../_components/page-shell";
import { MailClient } from "./mail-client";

export default function MailPage() {
  return (
    <PageShell title="메일" titlePlacement="content" titleHref={null}>
      <MailClient />
    </PageShell>
  );
}
