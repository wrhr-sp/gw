import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const spaceCards = [
  {
    id: "document_space_public",
    title: "전사 문서함",
    description: "회사 공용 문서 목록과 첨부 metadata 조회 시작점입니다.",
    guardrail: "document.space.read + document.file.read",
  },
  {
    id: "document_space_hr_private",
    title: "인사 전용 문서함",
    description: "민감한 문서는 placeholder 단계에서도 일반 구성원 목록에 노출하지 않습니다.",
    guardrail: "server-side access check + 403 for inaccessible space",
  },
] as const;

const metadataChecklist = [
  "storage key 는 API 응답과 UI에 노출하지 않음",
  "존재하지 않거나 접근 불가한 spaceId 는 metadata 생성 403",
  "실제 업로드/다운로드 대신 fileName/contentType/fileSize/versionLabel 만 고정",
  "R2 버킷/서명 URL/OCR 연결은 후속 승인 범위로 분리",
] as const;

export default function DocumentsPage() {
  return (
    <PageShell
      eyebrow="모바일 문서함 접근성 점검"
      title="문서함 1차 skeleton"
      description="문서함 목록/접근 경계/첨부 metadata 흐름을 모바일에서도 읽기 쉽게 카드형으로 정리한 placeholder 입니다."
      actions={<Pill tone="accent">no storage key leakage</Pill>}
    >
      <SurfaceSection title="문서 공간 카드" description="작은 화면에서도 문서 공간 제목과 가드레일을 먼저 보여 줍니다.">
        <div className="grid-auto">
          {spaceCards.map((space) => (
            <article key={space.id} className="route-card">
              <Pill>{space.guardrail}</Pill>
              <h3>{space.title}</h3>
              <p>{space.description}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="첨부 metadata placeholder" description="다운로드/preview 완성형 없이도 무엇을 노출하지 말아야 하는지 먼저 고정합니다.">
        <ul className="summary-list">
          {metadataChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="연결할 API" description="same-origin /api 경로와 읽음 확인 흐름을 유지합니다." muted>
        <ul className="summary-list">
          <li><a href={appRoutes.documents.spaces}>{appRoutes.documents.spaces}</a> — 문서함 목록/생성</li>
          <li><a href={appRoutes.documents.files}>{appRoutes.documents.files}</a> — 접근 가능한 파일 목록</li>
          <li><a href={appRoutes.documents.fileMetadata}>{appRoutes.documents.fileMetadata}</a> — metadata 생성</li>
          <li><a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a> — 문서 읽음 확인</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
