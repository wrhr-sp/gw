import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionButtonGroup,
  Button,
  FeatureGuide,
  PageHeader,
  StatusBadge,
  SummaryCard,
} from "../src/index";

describe("approved hotel page primitives", () => {
  it("renders a single page heading with description and actions", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        eyebrow="호텔 운영"
        title="호텔 관리"
        description="호텔 기본정보와 운영상태를 관리합니다."
        actions={<Button>호텔 등록</Button>}
      />,
    );
    expect(html).toContain("<h1");
    expect(html).toContain("호텔 관리");
    expect(html).toContain("호텔 기본정보와 운영상태를 관리합니다.");
    expect(html).toContain("호텔 등록");
  });

  it("renders a titled 44px feature-guide control beside a page heading", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="사용자 계정"
        titleAccessory={
          <FeatureGuide
            content={{
              audience: ["계정 조회 권한이 있는 관리자"],
              cautions: ["권한이 없는 작업은 실행할 수 없습니다."],
              featureKey: "account-administration.list",
              permissions: ["사용자 조회 권한"],
              steps: ["검색 조건을 선택합니다.", "사용자를 선택합니다."],
              summary: "회사 사용자 계정을 조회합니다.",
              title: "사용자 계정",
              version: "1.0",
            }}
          />
        }
      />,
    );
    expect(html).toContain('aria-label="사용자 계정 도움말"');
    expect(html).toContain("min-h-11");
    expect(html).toContain("min-w-11");
  });

  it("does not rely on color alone for status meaning", () => {
    const html = renderToStaticMarkup(<StatusBadge tone="danger">긴급</StatusBadge>);
    expect(html).toContain("긴급");
    expect(html).toContain("data-tone=\"danger\"");
    expect(html).toContain("aria-label=\"상태: 긴급\"");
  });

  it("uses an article with label and value for summaries", () => {
    const html = renderToStaticMarkup(<SummaryCard label="운영 호텔" value="9 / 12" hint="정상 운영 9개" />);
    expect(html).toContain("<article");
    expect(html).toContain("운영 호텔");
    expect(html).toContain("9 / 12");
    expect(html).toContain("정상 운영 9개");
  });

  it("labels grouped mutation actions", () => {
    const html = renderToStaticMarkup(
      <ActionButtonGroup label="호텔 저장 작업">
        <Button variant="secondary">취소</Button>
        <Button>저장</Button>
      </ActionButtonGroup>,
    );
    expect(html).toContain("aria-label=\"호텔 저장 작업\"");
    expect(html).toContain("취소");
    expect(html).toContain("저장");
  });
});
