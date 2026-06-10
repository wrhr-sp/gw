import Link from "next/link";
import { appRoutes } from "@gw/shared";

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
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/dashboard">← 대시보드로</Link>
      <h1>문서함 1차 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        이 화면은 실제 파일 저장소가 아니라, 문서함 목록/접근 경계/첨부 metadata 흐름을 먼저 정리하기 위한 placeholder 입니다.
      </p>

      <section style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {spaceCards.map((space) => (
          <article key={space.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>{space.title}</h2>
            <p style={{ lineHeight: 1.7 }}>{space.description}</p>
            <p style={{ marginBottom: 0, color: "#4b5563" }}>가드레일: {space.guardrail}</p>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>첨부 metadata placeholder</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {metadataChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>연결할 API</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li><a href={appRoutes.documents.spaces}>{appRoutes.documents.spaces}</a> — 문서함 목록/생성</li>
          <li><a href={appRoutes.documents.files}>{appRoutes.documents.files}</a> — 접근 가능한 파일 목록</li>
          <li><a href={appRoutes.documents.fileMetadata}>{appRoutes.documents.fileMetadata}</a> — metadata 생성</li>
          <li><a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a> — 문서 읽음 확인</li>
        </ul>
      </section>
    </main>
  );
}
