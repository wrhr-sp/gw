"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  documentFileListResponseSchema,
  documentFileMetadataCreateResponseSchema,
  documentSpaceListResponseSchema,
  errorResponseSchema,
  type DocumentFile,
  type DocumentFileMetadataCreateRequest,
  type DocumentSpace,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type MutationState = "idle" | "submitting" | "success" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type DocumentsData = { spaces: DocumentSpace[]; files: DocumentFile[] };

const storageStatusLabels: Record<DocumentFile["storageStatus"], string> = {
  pending: "업로드 대기",
  ready: "최신",
  deleted: "삭제",
  failed: "실패",
};

const visibilityLabels: Record<DocumentSpace["visibility"], string> = {
  company: "전사",
  department: "부서",
  private: "제한",
};

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
  if (value >= 1024) return `${Math.round(value / 1024)}KB`;
  return `${value}B`;
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(route: string, parse: (payload: unknown) => T) {
  const response = await fetch(route, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parse(await response.json());
}

async function fetchDocumentsData(spaceId?: string): Promise<DocumentsData> {
  const spaces = await fetchJson(appRoutes.documents.spaces, (payload) => {
    const parsed = documentSpaceListResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("문서함 목록 응답 형식이 계약과 맞지 않습니다.");
    return parsed.data.data.items;
  });
  const targetSpaceId = spaceId || spaces[0]?.id;
  const fileRoute = targetSpaceId ? `${appRoutes.documents.files}?spaceId=${encodeURIComponent(targetSpaceId)}` : appRoutes.documents.files;
  const files = await fetchJson(fileRoute, (payload) => {
    const parsed = documentFileListResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("문서 파일 목록 응답 형식이 계약과 맞지 않습니다.");
    return parsed.data.data.items;
  });
  return { spaces, files };
}

async function createFileMetadata(request: DocumentFileMetadataCreateRequest) {
  const response = await fetch(appRoutes.documents.fileMetadata, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = documentFileMetadataCreateResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("문서 메타데이터 생성 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.file;
}

function DocumentFileRow({ file }: { file: DocumentFile }) {
  return (
    <article className="feature-workspace__row">
      <div>
        <strong>{file.fileName}</strong>
        <span>{`${file.contentType} · ${formatBytes(file.fileSize)} · ${file.versionLabel}`}</span>
        <p>{`공개 범위 ${file.isPublicWithinCompany ? "전사 열람" : "권한 제한"} · ${file.updatedAt.slice(0, 10)}`}</p>
        <div className="feature-workspace__row-actions" aria-label={`${file.id} 문서 파일 처리`}>
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">미리보기</button>
          <a className="feature-workspace__row-action feature-workspace__row-action--secondary" href={appRoutes.documents.downloadInit(file.id)}>다운로드 요청</a>
        </div>
      </div>
      <em>{storageStatusLabels[file.storageStatus]}</em>
    </article>
  );
}

export default function DocumentsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [spaces, setSpaces] = useState<DocumentSpace[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [fileName, setFileName] = useState("운영 매뉴얼.pdf");
  const [contentType, setContentType] = useState("application/pdf");
  const [fileSize, setFileSize] = useState("1024");
  const [description, setDescription] = useState("팀 공용 업무 처리 절차 문서입니다.");
  const [toast, setToast] = useState<ToastState>(null);

  const publicFileCount = useMemo(() => files.filter((file) => file.isPublicWithinCompany).length, [files]);
  const pendingFileCount = useMemo(() => files.filter((file) => file.storageStatus === "pending").length, [files]);

  async function reloadDocuments(nextSpaceId?: string) {
    setLoadState("loading");
    setToast(null);
    try {
      const data = await fetchDocumentsData(nextSpaceId || spaceId);
      setSpaces(data.spaces);
      setFiles(data.files);
      setSpaceId((current) => nextSpaceId || current || data.spaces[0]?.id || "");
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "문서 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadDocuments(); }, []);

  async function handleUploadPrepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedSize = Number(fileSize);
    if (!spaceId || !fileName.trim() || !contentType.trim() || !Number.isFinite(parsedSize) || parsedSize <= 0) {
      setToast({ tone: "warning", title: "업로드 준비 실패", body: "문서함, 파일명, 형식, 크기를 확인해 주세요." });
      return;
    }
    setMutationState("submitting");
    setToast(null);
    try {
      const file = await createFileMetadata({
        spaceId,
        fileName: fileName.trim(),
        contentType: contentType.trim(),
        fileSize: parsedSize,
        versionLabel: description.trim() || "v1",
        isPublicWithinCompany: true,
      });
      await reloadDocuments(spaceId);
      setToast({ tone: "accent", title: "업로드 준비 완료", body: `${file.fileName} · ${storageStatusLabels[file.storageStatus]}` });
      setMutationState("success");
    } catch (error) {
      setToast({ tone: "warning", title: "업로드 준비 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
      setMutationState("error");
    }
  }

  return (
    <PageShell title="문서함" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="문서함 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadDocuments()} type="button">문서함</button></h1>
            <FeaturePageOverflowMenu label="문서함" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="문서함 상태 요약">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>문서함 목록</span><strong>{spaces.length}개</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>파일 올리기</span><strong>업로드</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>문서 상세</span><strong>{files.length}개</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>공유 상태</span><strong>{publicFileCount}개</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="documents-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="documents-panel-heading">문서함 목록</h2>
              <p>문서 공간과 파일을 실제 문서 API 기준으로 조회합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">document.read 권한과 문서 공간 접근 범위를 함께 확인합니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>{toast.tone === "accent" ? "완료" : "확인"}</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>전사 문서</span><strong>{publicFileCount}개</strong><p>전사 열람 가능한 파일</p></article>
            <article className="feature-workspace__status"><span>내 문서</span><strong>{files.length}개</strong><p>현재 문서함 조회 결과</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>승인 필요</span><strong>{pendingFileCount}개</strong><p>업로드 대기 또는 검토 대상</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="문서함 목록">
            {loadState === "loading" && spaces.length === 0 ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>문서함 조회</span></div><em>대기</em></article> : null}
            {spaces.length === 0 && loadState !== "loading" ? <article className="feature-workspace__row"><div><strong>인사·근태 문서함</strong><span>공개 링크를 만들지 않고 문서 공간 담당자에게 권한 요청 흐름을 안내합니다.</span><div className="feature-workspace__row-actions" aria-label="비어 있는 문서함 처리"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">문서 열기</button><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">권한 확인</button></div></div><em>권한 요청</em></article> : null}
            {spaces.map((space) => (
              <article className="feature-workspace__row" key={space.id}>
                <div>
                  <strong>{space.name}</strong>
                  <span>{`${visibilityLabels[space.visibility]} · ${space.slug}`}</span>
                  <p>{space.isPublicWithinCompany ? "모든 직원 열람 가능" : "문서 공간 권한 필요"}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${space.id} 문서함 처리`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => void reloadDocuments(space.id)} type="button">문서 열기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">권한 확인</button>
                  </div>
                </div>
                <em>{space.status === "active" ? "열람 가능" : "보관"}</em>
              </article>
            ))}
          </div>

          <form className="feature-workspace__form" onSubmit={handleUploadPrepare}>
            <label><span>문서함</span><select aria-label="문서함 선택" onChange={(event) => setSpaceId(event.target.value)} value={spaceId}>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
            <label><span>파일명</span><input aria-label="파일명" onChange={(event) => setFileName(event.target.value)} value={fileName} /></label>
            <label><span>분류</span><input aria-label="파일 형식" onChange={(event) => setContentType(event.target.value)} value={contentType} /></label>
            <label><span>설명</span><textarea aria-label="문서 설명" onChange={(event) => setDescription(event.target.value)} rows={4} value={description} /></label>
            <label><span>파일 크기</span><input aria-label="파일 크기" min="1" onChange={(event) => setFileSize(event.target.value)} type="number" value={fileSize} /></label>
            <div className="feature-workspace__actions">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" disabled={mutationState === "submitting" || spaces.length === 0} type="submit">업로드 준비</button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled type="button">문서 선택</button>
            </div>
          </form>

          <div className="feature-workspace__rows" aria-label="문서 상세 목록">
            {files.length === 0 ? <article className="feature-workspace__row"><div><strong>문서 상세 없음</strong><span>선택한 문서함에 파일이 없거나 조회 권한이 없습니다.</span></div><em>비어 있음</em></article> : files.map((file) => <DocumentFileRow file={file} key={file.id} />)}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
