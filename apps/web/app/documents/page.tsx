import React from "react";
import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../_components/phase-16-pilot";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { DocumentsLiveSection } from "../_components/real-usage-panels";

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
  "storage key / bucket / public URL / signed URL 전문은 API 응답과 UI에 노출하지 않음",
  "존재하지 않거나 접근 불가한 spaceId 는 metadata 생성 403",
  "실제 외부 공유 대신 fileName/contentType/fileSize/versionLabel 과 storageStatus 상태만 먼저 고정",
  "R2 버킷/서명 URL/OCR 연결과 production bucket 운영은 후속 승인 범위로 분리",
] as const;

const lifecycleCards = [
  {
    title: "upload-init",
    summary: "파일 메타데이터와 업로드 준비 액션을 먼저 만들고 storageStatus 를 pending 으로 시작합니다.",
  },
  {
    title: "upload-complete",
    summary: "업로드 완료 후 checksum 과 함께 storageStatus 를 ready 로 바꿉니다.",
  },
  {
    title: "download-init",
    summary: "공개 다운로드가 아니라 내부 다운로드 준비 액션과 권한 경계를 확인합니다.",
  },
  {
    title: "delete / archive",
    summary: "storageStatus=deleted 와 document status=archived 의미를 분리해서 읽습니다.",
  },
] as const;

const boundaryNotes = [
  "storageStatus(pending/ready/deleted)는 내부 저장 lifecycle 설명이며 public share 완료 뜻이 아닙니다.",
  "objectKeyPreview 는 내부 경로 힌트일 뿐 외부 반출 링크가 아닙니다.",
  "backup/export/migration/secret 입력과 production 실데이터 반영은 이번 단계 승인 범위가 아닙니다.",
] as const;

const collaborationBoundaryNotes = [
  "전사 문서함은 일반 협업 자료 entry 이고, 인사 전용 문서함은 private HR scope 로 분리합니다.",
  "metadata 생성과 읽음 확인은 가능하지만 접근 가능한 파일에만 허용되고 raw storage internals 는 숨깁니다.",
  "게시판·전자결재에서 문서를 참조하더라도 문서 권한은 `/documents` 기준 403 경계를 먼저 따릅니다.",
  "`storageStatus` 와 문서 `status` 는 같은 뜻으로 섞지 않고 각각 저장 lifecycle 과 문서 상태로 분리합니다.",
] as const;

export default function DocumentsPage() {
  return (
    <PageShell
      eyebrow="Phase 41 내부 문서 협업 도입"
      title="문서함"
      description="문서 공간 목록, 문서 상세, 첨부 metadata, upload/download 준비, 읽음 확인, 분류 문장, private space 차단을 내부 협업 보관/열람 언어로 다시 정리하고 실제 same-origin API 응답으로 바로 확인할 수 있게 연결했습니다."
      actions={<Pill tone="accent">no storage key leakage</Pill>}
    >
      <SurfaceSection title="실사용 확인 패널" description="문서 공간과 파일 metadata 를 실제 API 응답으로 먼저 확인합니다.">
        <DocumentsLiveSection />
      </SurfaceSection>

      <SurfaceSection title="파일 lifecycle" description="외부 공유 완료가 아니라 upload/download 준비와 상태 전이를 먼저 읽는 순서입니다.">
        <div className="grid-auto-compact">
          {lifecycleCards.map((item) => (
            <article key={item.title} className="info-card">
              <Pill tone="warning">{item.title}</Pill>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

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

      <SurfaceSection title="협업 문맥 / 권한 경계" description="문서함을 게시판·결재와 같은 협업 묶음으로 읽되, 민감 문서 권한은 더 좁게 유지합니다.">
        <ul className="summary-list">
          {collaborationBoundaryNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="내부 운영 경계" description="지금 직접 읽을 수 있는 것과 아직 승인 게이트인 것을 분리합니다." muted>
        <ul className="summary-list">
          {boundaryNotes.map((item) => (
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

      <Phase16PilotPanel
        description="문서함은 문서 공간/첨부 metadata 흐름과 R2 binding-aware 경계를 보여 주는 화면이며, 실제 운영 업로드/다운로드 완료처럼 보이지 않게 설명을 고정합니다."
        confirmItems={[
          "전사 문서함과 인사 전용 문서함이 다른 권한 경계로 보인다.",
          "storage key/bucket/public URL 비노출 원칙이 UI 문구에 반영돼 있다.",
          "문서 공간, 파일 목록, metadata 생성, 읽음 확인 API 로 same-origin 스모크를 이어 갈 수 있다.",
        ]}
        blockedItems={[
          "실제 운영 파일 업로드 확대와 공개 다운로드 링크 오픈은 이번 단계 성공 기준이 아니다.",
          "OCR/전자서명/외부 문서보관 연동은 후속 승인 범위로 남긴다.",
        ]}
        nextRoutes={[
          { href: appRoutes.documents.spaces, label: appRoutes.documents.spaces, description: "접근 가능한 문서 공간 목록 확인" },
          { href: appRoutes.documents.files, label: appRoutes.documents.files, description: "파일 metadata 목록 확인" },
          { href: appRoutes.documents.fileMetadata, label: appRoutes.documents.fileMetadata, description: "metadata 생성/권한 차단 확인" },
          { href: "/admin/policies", label: "/admin/policies", description: "문서 정책 candidate 와 일반 화면 설명 비교" },
        ]}
        approvalGates={[
          "production data/실저장 반영",
          "public URL 또는 외부 공유 링크 정책 확정",
          "bucket 운영 전환과 유료 리소스 승인",
          "secret 입력/교체",
        ]}
        evidenceNote="live fetch 가 제한되면 문서 route 는 pnpm check/build:cf 와 /api/documents/* 응답 스키마 검증을 대체 근거로 남깁니다."
      />
    </PageShell>
  );
}
