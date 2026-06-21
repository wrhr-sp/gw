import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageShell } from "./app/_components/page-shell";

describe("feature page title reset navigation", () => {
  it("lets each feature page title point to its initial route without data reset side effects", () => {
    const html = renderToStaticMarkup(
      <PageShell title="게시판" titleHref="/boards" backHref="/home">
        <section>게시판 내용</section>
      </PageShell>,
    );

    expect(html).toContain('class="page-shell__title-link"');
    expect(html).toContain('href="/boards"');
    expect(html).not.toContain('href="/home">게시판</a>');
  });

  it("keeps the existing backHref fallback for pages that have not opted into a feature initial route", () => {
    const html = renderToStaticMarkup(
      <PageShell title="게시글 상세" backHref="/boards">
        <section>게시글 내용</section>
      </PageShell>,
    );

    expect(html).toContain('href="/boards"');
  });
});
