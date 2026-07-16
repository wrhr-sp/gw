import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionButtonGroup,
  Button,
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
