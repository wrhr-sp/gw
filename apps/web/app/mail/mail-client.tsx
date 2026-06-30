"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  appRoutes,
  mailAttachmentListResponseSchema,
  mailAttachmentUploadResponseSchema,
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
  group: "standalone" | "mailbox";
  box?: MailBox;
};

const defaultMailFolders: readonly MailFolderConfig[] = [
  { id: "favorites", label: "즐겨찾기", group: "standalone" },
  { id: "inbox", label: "받은 메일함", group: "mailbox", box: "inbox" },
  { id: "sent", label: "보낸메일함", group: "mailbox", box: "sent" },
  { id: "drafts", label: "임시보관함", group: "mailbox", box: "drafts" },
  { id: "scheduled", label: "예약메일함", group: "mailbox" },
  { id: "spam", label: "스팸메일함", group: "mailbox" },
  { id: "trash", label: "휴지통", group: "mailbox" },
  { id: "external", label: "외부메일함", group: "standalone" },
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
  const [subject, setSubject] = useState("근태 정정 확인 요청");
  const [body, setBody] = useState("확인 필요한 내용을 입력하세요.");
  const [importance, setImportance] = useState<"normal" | "important">("normal");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
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
  const standaloneBeforeMailbox = visibleFolders.filter((folder) => folder.group === "standalone" && folder.id !== "external");
  const mailboxFolders = visibleFolders.filter((folder) => folder.group === "mailbox");
  const externalFolders = visibleFolders.filter((folder) => folder.id === "external");
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
      setStatus("메일 작성 화면입니다.");
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

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("메일을 저장하고 발송 처리 중입니다.");
    try {
      const response = await fetch(appRoutes.mail.send, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ recipientUserIds, subject, body, importance }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "메일 발송에 실패했습니다.");
        return;
      }
      const parsed = mailMessageSendResponseSchema.parse(payload);
      const sentMessages = [parsed.data.message];
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
        <span>{nested ? `ㄴ${folder.label}` : folder.label}</span>
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
          <button
            type="button"
            className="mail-folder-settings-button"
            aria-expanded={isFolderEditorOpen}
            aria-label="메일 목록 편집"
            onClick={() => setIsFolderEditorOpen((value) => !value)}
          >
            설정
          </button>
        </div>
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
          {externalFolders.map((folder) => renderFolderButton(folder))}
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
          {view !== "compose" ? (
            <button className="board-write-button mail-write-button" type="button" onClick={() => setView("compose")}>메일쓰기</button>
          ) : null}
        </div>
        <p className="feature-workspace__panel-status" role="status">{status}</p>

        {view === "compose" ? (
          <form className="feature-workspace__form" onSubmit={sendMessage}>
            <fieldset className="feature-workspace__field-group">
              <legend>받는 사람</legend>
              {recipientOptions.map((option) => (
                <label key={option.id}>
                  <input
                    checked={recipientUserIds.includes(option.id)}
                    onChange={() => toggleRecipient(option.id)}
                    type="checkbox"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <label>
              <span>중요도</span>
              <select aria-label="중요도" value={importance} onChange={(event) => setImportance(event.target.value as "normal" | "important")}>
                <option value="normal">일반</option>
                <option value="important">중요</option>
              </select>
            </label>
            <label>
              <span>제목</span>
              <input aria-label="제목" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label>
              <span>본문</span>
              <textarea aria-label="본문" rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <label>
              <span>첨부파일</span>
              <input aria-label="첨부파일" type="file" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} />
            </label>
            {attachmentFile ? <p>선택한 첨부: {attachmentFile.name}</p> : null}
            <div className="feature-workspace__actions">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" disabled={isSubmitting} type="submit">
                보내기
              </button>
            </div>
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
