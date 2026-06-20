export function buildSectionPage(title: string, description: string) {
  return function SectionPage() {
    return (
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>
        <h1>{title}</h1>
        <p style={{ lineHeight: 1.7 }}>{description}</p>
        <p style={{ color: "#4b5563" }}>
          이 페이지는 App Router 경로와 정보구조를 먼저 고정하기 위한 skeleton입니다.
          실제 데이터 연결은 Workers API와 shared 계약 확정 후 다음 단계에서 진행합니다.
        </p>
      </main>
    );
  };
}
