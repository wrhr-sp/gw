import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProcessDefinitionEditor } from "../components/inspections/process-definition-editor";

const hotelId = "50000000-0000-4000-8000-000000000001";
const reviewerId = "20000000-0000-4000-8000-000000000001";

describe("process definition editor", () => {
  it("renders an action-first accessible hotel process graph editor", () => {
    const markup = renderToStaticMarkup(
      <ProcessDefinitionEditor
        definitions={[]}
        hotelId={hotelId}
        onDefinitionsChange={() => undefined}
        reviewerCandidates={[
          { id: reviewerId, displayName: "객실 점검 검토자" },
        ]}
      />,
    );

    expect(markup).toContain("호텔 프로세스 정의");
    expect(markup).toContain("프로세스 이름");
    expect(markup).toContain("시작단계");
    expect(markup).toContain("주 검토자");
    expect(markup).toContain("객실 점검 검토자");
    expect(markup).toContain("대리인 선택");
    expect(markup).toContain("처리기한");
    expect(markup).toContain("단계 이동");
    expect(markup).toContain("프로세스 생성");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("min-h-11");
    expect(markup).not.toContain("저장하고 다시 확인했습니다");
  });

  it("fails closed when the hotel has no reviewer candidates", () => {
    const markup = renderToStaticMarkup(
      <ProcessDefinitionEditor
        definitions={[]}
        hotelId={hotelId}
        onDefinitionsChange={() => undefined}
        reviewerCandidates={[]}
      />,
    );

    expect(markup).toContain("배정된 활성 사내 임직원이 없어");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("disabled");
  });
});
