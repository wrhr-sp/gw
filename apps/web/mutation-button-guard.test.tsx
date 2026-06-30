import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "./app/_components/feature-workspace";

const mutationLabels = ["저장", "수정", "삭제", "신청", "승인", "반려", "제출", "임시저장", "정정 요청"];

describe("no-mock mutation button guard", () => {
  it("renders generic FeatureWorkspace mutation-like actions as disabled until a real API flow is wired", () => {
    const config: FeatureWorkspaceConfig = {
      title: "운영 기능 guard",
      tabs: [{ id: "main", label: "기본" }],
      panels: [
        {
          id: "main",
          heading: "상태 변경",
          summary: "실제 API 연결 전 버튼은 성공처럼 동작하면 안 된다.",
          formFields: [{ label: "사유", value: "", type: "textarea" }],
          actions: mutationLabels.map((label) => ({ label, tone: "primary" as const })),
          rows: [
            {
              title: "휴가 신청 1",
              meta: "2026-06-30",
              status: "검토 필요",
              actions: [
                { label: "승인", tone: "primary" },
                { label: "반려", tone: "danger" },
              ],
            },
          ],
          emptyState: {
            title: "목록 없음",
            body: "실제 API 연결 전 empty action도 동작하면 안 된다.",
            actionLabel: "신청",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(<FeatureWorkspace config={config} />);

    for (const label of [...mutationLabels, "승인", "반려"]) {
      expect(html).toContain(`aria-label="${label} — 실제 API 연결 또는 승인 범위 확정이 필요한 기능입니다."`);
    }

    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(mutationLabels.length + 3);
    expect(html).not.toContain("type=\"submit\"");
  });
});
