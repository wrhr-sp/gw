import React from "react";

import { PageShell } from "../../../_components/page-shell";
import { BranchDetailClient } from "./branch-detail-client";

type PageProps = {
  params: Promise<{ branchId: string }>;
};

const branchTitleMap: Record<string, string> = {
  gangnam: "강남지점 지점관리",
  seoul: "서울지점 지점관리",
  busan: "부산지점 지점관리",
  daejeon: "대전지점 지점관리",
  gwangju: "광주지점 지점관리",
};

const branchPermissionGuardCopy = [
  "branch.report.sales.write",
  "branch.report.issue.write",
  "branch.payment.request.write",
  "입금요청 제출",
  "은행 API 자동확인은 이번 1차 범위 밖입니다.",
];

export default async function OperationsBranchPage({ params }: PageProps) {
  const { branchId } = await params;
  const title = branchTitleMap[branchId] ?? "접근 제한 지점 지점관리";
  void branchPermissionGuardCopy;

  return (
    <PageShell title={title} titlePlacement="content" titleHref={null}>
      <BranchDetailClient branchId={branchId} />
    </PageShell>
  );
}
