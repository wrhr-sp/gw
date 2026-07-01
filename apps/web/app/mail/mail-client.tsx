"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { boardTinymceInit } from "../_components/board-rich-editor-config";
import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import {
  appRoutes,
  mailAttachmentListResponseSchema,
  mailAttachmentUploadResponseSchema,
  mailMessageDraftSaveResponseSchema,
  mailMessageListResponseSchema,
  mailMessageReadResponseSchema,
  mailMessageSendResponseSchema,
  type MailAttachment,
  type MailBox,
  type MailMessage,
} from "@gw/shared";

const recipientOptions = [
  { id: "user_hr_admin", label: "인사 담당자" },
  { id: "user_manager", label: "운영 매니저" },
  { id: "user_employee", label: "일반 구성원" },
  { id: "user_company_admin", label: "총괄관리계정" },
];

const boxLabels: Record<MailBox, string> = {
  inbox: "받은 메일함",
  sent: "보낸메일함",
  drafts: "임시보관함",
};

type MailFolderId = "favorites" | "inbox" | "sent" | "drafts" | "scheduled" | "spam" | "trash" | "external";
type MailView = MailFolderId | "compose" | "security";

type MailFolderConfig = {
  id: MailFolderId;
  label: string;
  group: "standalone" | "mailbox" | "external" | "trash";
  box?: MailBox;
};

const defaultMailFolders: readonly MailFolderConfig[] = [
  { id: "favorites", label: "즐겨찾기", group: "standalone" },
  { id: "inbox", label: "받은 메일함", group: "mailbox", box: "inbox" },
  { id: "sent", label: "보낸메일함", group: "mailbox", box: "sent" },
  { id: "drafts", label: "임시보관함", group: "mailbox", box: "drafts" },
  { id: "scheduled", label: "예약메일함", group: "mailbox" },
  { id: "spam", label: "스팸메일함", group: "mailbox" },
  { id: "external", label: "외부메일함", group: "external" },
  { id: "trash", label: "휴지통", group: "trash" },
];

const defaultVisibleFolderIds = defaultMailFolders.map((folder) => folder.id);

function isMailBox(value: MailView): value is MailBox {
  return value === "inbox" || value === "sent" || value === "drafts";
}

function formatMeta(message: MailMessage, box: MailBox) {
  const when = message.sentAt ?? message.updatedAt;
  const date = new Date(when);
  const label = Number.isNaN(date.getTime()) ? when : date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (box === "sent") return `${message.recipientName ?? "수신자 미지정"} · ${label}`;
  return `${message.senderName} · ${label}`;
}

function getFolderBadge(folder: MailFolderConfig, counts: { inbox: number; unread: number; sent: number; drafts: number }) {
  if (folder.id === "inbox") return String(counts.inbox);
  if (folder.id === "sent") return String(counts.sent);
  if (folder.id === "drafts") return String(counts.drafts);
  if (folder.id === "favorites") return "★";
  return "";
}

function moveFolder(folderIds: MailFolderId[], folderId: MailFolderId, direction: "up" | "down") {
  const index = folderIds.indexOf(folderId);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= folderIds.length) {
    return folderIds;
  }
  const next = [...folderIds];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export function MailClient() {
  const [view, setView] = useState<MailView>("inbox");
  const [items, setItems] = useState<MailMessage[]>([]);
  const [attachmentsByMessageId, setAttachmentsByMessageId] = useState<Record<string, MailAttachment[]>>({});
  const [counts, setCounts] = useState({ inbox: 0, unread: 0, sent: 0, drafts: 0 });
  const [status, setStatus] = useState("메일함을 불러오는 중입니다.");
  const [recipientUserIds, setRecipientUserIds] = useState<string[]>(["user_hr_admin"]);
  const [ccUserIds, setCcUserIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("<p></p>");
  const [importance, setImportance] = useState<"normal" | "important">("normal");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false);
  const [folderOrder, setFolderOrder] = useState<MailFolderId[]>([...defaultVisibleFolderIds]);
  const [visibleFolderIds, setVisibleFolderIds] = useState<MailFolderId[]>([...defaultVisibleFolderIds]);

  const orderedFolders = useMemo(
    () => folderOrder
      .map((folderId) => defaultMailFolders.find((folder) => folder.id === folderId))
      .filter((folder): folder is MailFolderConfig => Boolean(folder)),
    [folderOrder],
  );
  const visibleFolders = orderedFolders.filter((folder) => visibleFolderIds.includes(folder.id));
  const standaloneBeforeMailbox = visibleFolders.filter((folder) => folder.group === "standalone");
  const mailboxFolders = visibleFolders.filter((folder) => folder.group === "mailbox");
  const externalFolders = visibleFolders.filter((folder) => folder.group === "external");
  const trashFolders = visibleFolders.filter((folder) => folder.group === "trash");
  const currentFolder = defaultMailFolders.find((folder) => folder.id === view);
  const currentBox = isMailBox(view) ? view : null;

  async function loadAttachments(messages: MailMessage[]) {
    const entries = await Promise.all(messages.map(async (message) => {
      const response = await fetch(appRoutes.mail.attachments(message.id), { credentials: "same-origin" });
      if (!response.ok) return [message.id, []] as const;
      const parsed = mailAttachmentListResponseSchema.parse(await response.json());
      return [message.id, parsed.data.items] as const;
    }));
    setAttachmentsByMessageId(Object.fromEntries(entries));
  }

  async function loadMessages(nextBox: MailBox) {
    setStatus("메일함을 불러오는 중입니다.");
    const response = await fetch(`${appRoutes.mail.messages}?box=${nextBox}`, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setItems([]);
      setAttachmentsByMessageId({});
      setStatus(payload?.error?.message ?? "메일함을 불러오지 못했습니다.");
      return;
    }
    const parsed = mailMessageListResponseSchema.parse(payload);
    setItems(parsed.data.items);
    setCounts(parsed.data.counts);
    await loadAttachments(parsed.data.items);
    setStatus(`${boxLabels[nextBox]} ${parsed.data.items.length}건을 불러왔습니다.`);
  }

  useEffect(() => {
    if (isMailBox(view)) {
      void loadMessages(view);
      return;
    }
    if (view === "compose") {
      setStatus("수신자, 제목, 본문을 입력한 뒤 실제 메일 API로 저장·발송합니다.");
      return;
    }
    if (view === "security") {
      setStatus(counts.unread > 0 ? "읽지 않은 메일을 먼저 확인하세요." : "보안 확인 상태가 정상입니다.");
      return;
    }
    setItems([]);
    setAttachmentsByMessageId({});
    setStatus(`${currentFolder?.label ?? "메일함"}은 목록 위치만 준비되어 있습니다. 실제 연동은 별도 설정 후 연결합니다.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function toggleRecipient(recipientId: string) {
    setRecipientUserIds((current) => {
      if (current.includes(recipientId)) {
        const next = current.filter((id) => id !== recipientId);
        return next.length ? next : current;
      }
      return [...current, recipientId];
    });
  }

  function toggleCcRecipient(recipientId: string) {
    setCcUserIds((current) => {
      if (current.includes(recipientId)) {
        return current.filter((id) => id !== recipientId);
      }
      return [...current, recipientId];
    });
  }

  function toggleFolderVisibility(folderId: MailFolderId) {
    setVisibleFolderIds((current) => {
      if (current.includes(folderId)) {
        const next = current.filter((id) => id !== folderId);
        return next.length ? next : current;
      }
      return [...current, folderId];
    });
  }

  function resetFolderSettings() {
    setFolderOrder([...defaultVisibleFolderIds]);
    setVisibleFolderIds([...defaultVisibleFolderIds]);
    setStatus("메일 목록 기본값을 다시 적용했습니다.");
  }

  function applyTemplate() {
    setSubject((current) => current || "업무 공유드립니다");
    setBody("<p>안녕하세요.</p><p>아래 내용 확인 부탁드립니다.</p><p>감사합니다.</p>");
    setStatus("업무용 기본 템플릿을 본문에 적용했습니다.");
  }

  function writeToMyself() {
    setRecipientUserIds(["user_company_admin"]);
    setCcUserIds([]);
    setStatus("내게쓰기 수신자를 총괄관리계정으로 지정했습니다.");
  }

  async function saveDraft() {
    setIsSubmitting(true);
    setStatus("임시보관함에 저장 중입니다.");
    try {
      const response = await fetch(appRoutes.mail.saveDraft, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ recipientUserIds: Array.from(new Set([...recipientUserIds, ...ccUserIds])), subject, body, importance }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "임시저장에 실패했습니다.");
        return;
      }
      const parsed = mailMessageDraftSaveResponseSchema.parse(payload);
      setStatus(`임시보관함에 저장했습니다. (${parsed.data.message.subject})`);
      setView("drafts");
      await loadMessages("drafts");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("메일을 저장하고 발송 처리 중입니다.");
    try {
      const response = await fetch(appRoutes.mail.send, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ recipientUserIds: Array.from(new Set([...recipientUserIds, ...ccUserIds])), subject, body, importance }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "메일 발송에 실패했습니다.");
        return;
      }
      const parsed = mailMessageSendResponseSchema.parse(payload);
      const sentMessages = parsed.data.messages ?? [parsed.data.message];
      if (attachmentFile) {
        for (const message of sentMessages) {
          const formData = new FormData();
          formData.append("file", attachmentFile);
          const attachmentResponse = await fetch(appRoutes.mail.attachments(message.id), {
            method: "POST",
            credentials: "same-origin",
            body: formData,
          });
          const attachmentPayload = await attachmentResponse.json();
          if (!attachmentResponse.ok) {
            setStatus(attachmentPayload?.error?.message ?? "메일은 발송됐지만 일부 첨부 업로드에 실패했습니다.");
            return;
          }
          mailAttachmentUploadResponseSchema.parse(attachmentPayload);
        }
      }
      setAttachmentFile(null);
      setStatus(`메일 ${sentMessages.length}건과 첨부가 DB/R2에 저장되고 보낸 메일함에 반영됐습니다.`);
      setView("sent");
      await loadMessages("sent");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function markRead(messageId: string) {
    const response = await fetch(appRoutes.mail.markRead(messageId), { method: "POST", credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "읽음 처리에 실패했습니다.");
      return;
    }
    mailMessageReadResponseSchema.parse(payload);
    setStatus("메일을 읽음 처리했습니다.");
    await loadMessages("inbox");
  }

  function renderFolderButton(folder: MailFolderConfig, nested = false) {
    const selected = view === folder.id;
    const badge = getFolderBadge(folder, counts);
    return (
      <button
        aria-selected={selected}
        className={nested ? "mail-folder-list__item mail-folder-list__item--child" : "mail-folder-list__item"}
        key={folder.id}
        onClick={() => setView(folder.id)}
        role="treeitem"
        type="button"
      >
        <span>{folder.label}</span>
        {badge ? <strong>{badge}</strong> : null}
      </button>
    );
  }

  function renderFolderEditor() {
    if (!isFolderEditorOpen) return null;

    return (
      <section className="mail-folder-editor" aria-label="메일 목록 편집">
        <div className="mail-folder-editor__header">
          <strong>메일 목록 편집</strong>
          <button className="mail-folder-editor__close" type="button" aria-label="메일 목록 편집 닫기" onClick={() => setIsFolderEditorOpen(false)}>×</button>
        </div>
        <div className="mail-folder-editor__list">
          {orderedFolders.map((folder, index) => (
            <div className="mail-folder-editor__row" key={folder.id}>
              <label>
                <input
                  checked={visibleFolderIds.includes(folder.id)}
                  onChange={() => toggleFolderVisibility(folder.id)}
                  type="checkbox"
                />
                <span>{folder.label}</span>
              </label>
              <div className="mail-folder-editor__row-actions">
                <button type="button" disabled={index === 0} onClick={() => setFolderOrder((current) => moveFolder(current, folder.id, "up"))}>위</button>
                <button type="button" disabled={index === orderedFolders.length - 1} onClick={() => setFolderOrder((current) => moveFolder(current, folder.id, "down"))}>아래</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mail-folder-editor__actions">
          <button type="button" className="touch-button feature-workspace__action feature-workspace__action--secondary" onClick={resetFolderSettings}>기본값</button>
          <button type="button" className="touch-button feature-workspace__action feature-workspace__action--primary" onClick={() => setIsFolderEditorOpen(false)}>적용</button>
        </div>
      </section>
    );
  }

  return (
    <div className="feature-workspace mail-workspace">
      <aside className="feature-workspace__nav" aria-label="메일 메뉴">
        <div className="feature-workspace__nav-header mail-workspace__title-row">
          <h1>
            <button className="page-shell__title-link page-shell__title-button" onClick={() => setView("inbox")} type="button">
              메일
            </button>
          </h1>
          <FeaturePageOverflowMenu label="메일" />
        </div>
        {view !== "compose" ? (
          <button className="board-write-button mail-write-button" type="button" onClick={() => setView("compose")}>메일쓰기</button>
        ) : null}
        <div className="mail-folder-list" role="tree" aria-label="메일함 목록">
          {standaloneBeforeMailbox.map((folder) => renderFolderButton(folder))}
          {mailboxFolders.length ? (
            <section className="mail-folder-list__group" aria-label="메일함">
              <strong className="mail-folder-list__group-title">메일함</strong>
              <div className="mail-folder-list__children">
                {mailboxFolders.map((folder) => renderFolderButton(folder, true))}
              </div>
            </section>
          ) : null}
          {externalFolders.length ? (
            <section className="mail-folder-list__group" aria-label="외부메일함">
              <strong className="mail-folder-list__group-title">외부메일함</strong>
              <div className="mail-folder-list__children">
                {externalFolders.map((folder) => renderFolderButton(folder, true))}
              </div>
            </section>
          ) : null}
          {trashFolders.length ? (
            <section className="mail-folder-list__group" aria-label="휴지통">
              <strong className="mail-folder-list__group-title">휴지통</strong>
              <div className="mail-folder-list__children">
                {trashFolders.map((folder) => renderFolderButton(folder, true))}
              </div>
            </section>
          ) : null}
        </div>
        {renderFolderEditor()}
        <div className="feature-workspace__utility" aria-label="요약 정보">
          <div><span>읽지 않음</span><strong>{counts.unread}건</strong></div>
          <div><span>받은 메일</span><strong>{counts.inbox}건</strong></div>
          <div><span>보낸 메일</span><strong>{counts.sent}건</strong></div>
        </div>
      </aside>

      <section className="feature-workspace__panel" aria-labelledby="mail-panel-heading">
        <div className="feature-workspace__panel-header">
          <div>
            <h2 id="mail-panel-heading">{view === "compose" ? "메일 작성" : currentBox ? boxLabels[currentBox] : currentFolder?.label ?? "메일"}</h2>
          </div>
        </div>
        <p className="feature-workspace__panel-status" role="status">{status}</p>

        {view === "compose" ? (
          <form className="mail-compose-form" onSubmit={sendMessage}>
            <div className="mail-compose-toolbar" aria-label="메일 작성 작업">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" disabled={isSubmitting} type="submit">
                {isSubmitting ? "처리 중" : "보내기"}
              </button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled type="button" title="예약 발송 API는 일정 엔진 확정 뒤 연결합니다.">예약발송</button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled={isSubmitting} type="button" onClick={() => void saveDraft()}>임시저장</button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" type="button" onClick={() => setIsPreviewOpen((value) => !value)}>미리보기</button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" type="button" onClick={applyTemplate}>템플릿</button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" type="button" onClick={writeToMyself}>내게쓰기</button>
            </div>

            <div className="mail-compose-row mail-compose-row--recipients">
              <strong>받는 사람</strong>
              <div className="mail-compose-recipient-grid" role="group" aria-label="받는 사람 선택">
                {recipientOptions.map((option) => (
                  <label key={option.id}>
                    <input checked={recipientUserIds.includes(option.id)} onChange={() => toggleRecipient(option.id)} type="checkbox" />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled type="button" title="조직 주소록 검색 API 확정 후 연결합니다.">주소록</button>
            </div>

            <div className="mail-compose-row mail-compose-row--recipients">
              <strong>참조</strong>
              <div className="mail-compose-recipient-grid" role="group" aria-label="참조 선택">
                {recipientOptions.map((option) => (
                  <label key={option.id}>
                    <input checked={ccUserIds.includes(option.id)} onChange={() => toggleCcRecipient(option.id)} type="checkbox" />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <span className="mail-compose-row__hint">참조 선택자는 현재 내부 메일 수신자에 포함되어 저장·발송됩니다.</span>
            </div>

            <label className="mail-compose-row mail-compose-row--subject">
              <strong>제목</strong>
              <input className="field" aria-label="제목" placeholder="제목을 입력하세요" required value={subject} onChange={(event) => setSubject(event.target.value)} />
              <span className="mail-compose-important"><input checked={importance === "important"} onChange={(event) => setImportance(event.target.checked ? "important" : "normal")} type="checkbox" /> 중요</span>
            </label>

            <section className="mail-compose-attachments" aria-label="파일첨부">
              <div className="mail-compose-attachments__header">
                <strong>파일첨부</strong>
                <div className="mail-compose-attachment-actions">
                  <label className="touch-button feature-workspace__action feature-workspace__action--secondary">
                    <input className="mail-compose-file-input" aria-label="내 PC 파일첨부" type="file" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} />
                    내 PC
                  </label>
                  <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled type="button" title="개인 자료실 API 확정 후 연결합니다.">개인 자료실</button>
                </div>
                <span>일반 {attachmentFile ? `${Math.ceil(attachmentFile.size / 1024)}KB` : "0KB"}/10MB · 대용량 0KB/2GB</span>
              </div>
              <div className="mail-compose-dropzone">
                {attachmentFile ? <strong>선택한 첨부: {attachmentFile.name}</strong> : <strong>파일을 이곳에 끌어오거나 내 PC에서 선택하세요</strong>}
                <span>실제 첨부 업로드는 보내기 후 메일 첨부 API와 R2 저장소로 연결됩니다.</span>
              </div>
            </section>

            <div className="board-tinymce-field mail-compose-editor">
              <strong>본문</strong>
              <Editor
                apiKey="no-api-key"
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                licenseKey="gpl"
                value={body}
                onEditorChange={(value) => setBody(value)}
                init={boardTinymceInit}
              />
            </div>

            {isPreviewOpen ? (
              <section className="mail-compose-preview" aria-label="메일 미리보기">
                <strong>{subject || "(제목 없음)"}</strong>
                <div dangerouslySetInnerHTML={{ __html: body }} />
              </section>
            ) : null}
          </form>
        ) : currentBox ? (
          <div className="feature-workspace__rows">
            {items.length === 0 ? (
              <article className="feature-workspace__row"><div><strong>표시할 메일이 없습니다.</strong><span>DB 조회 결과</span></div><em>비어 있음</em></article>
            ) : items.map((message) => (
              <article className="feature-workspace__row" key={message.id}>
                <div>
                  <strong>{message.subject}</strong>
                  <span>{formatMeta(message, currentBox)}</span>
                  <p>{message.body}</p>
                  {attachmentsByMessageId[message.id]?.length ? (
                    <ul className="feature-workspace__notes">
                      {attachmentsByMessageId[message.id].map((attachment) => (
                        <li key={attachment.id}>
                          <a href={appRoutes.mail.downloadAttachment(attachment.id)}>{attachment.fileName}</a>
                          <span> · {Math.ceil(attachment.fileSize / 1024)}KB</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {currentBox === "inbox" && !message.readAt ? (
                  <button className="touch-button feature-workspace__action feature-workspace__action--secondary" onClick={() => void markRead(message.id)} type="button">읽음</button>
                ) : <em>{message.importance === "important" ? "중요" : message.readAt ? "읽음" : "발송"}</em>}
              </article>
            ))}
          </div>
        ) : (
          <div className="feature-workspace__rows">
            <article className="feature-workspace__row">
              <div>
                <strong>{currentFolder?.label ?? "메일함"}</strong>
                <span>목록 편집에서 표시 여부와 순서를 조정할 수 있습니다.</span>
              </div>
              <em>연결 대기</em>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
