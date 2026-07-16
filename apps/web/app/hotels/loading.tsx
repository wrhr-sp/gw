export default function HotelsLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="py-4">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-5 w-24 rounded bg-border" />
        <div className="mt-3 h-9 w-52 rounded bg-border" />
        <div className="mt-8 h-24 rounded-panel border border-border bg-surface" />
        <div className="mt-4 h-72 rounded-panel border border-border bg-surface" />
        <span className="sr-only">호텔 정보를 불러오는 중입니다.</span>
      </div>
    </div>
  );
}
