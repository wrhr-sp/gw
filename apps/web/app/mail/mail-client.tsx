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
  inbox: "받은 메일",
  sent: "보낸 메일",
  drafts: "임시보관",
};

function formatMeta(message: MailMessage, box: MailBox) {
  const when = message.sentAt ?? message.updatedAt;
  const date = new Date(when);
  const label = Number.isNaN(date.getTime()) ? when : date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (box === "sent") return `${message.recipientName ?? "수신자 미지정"} · ${label}`;
  return `${message.senderName} · ${label}`;
}

export function MailClient() {
  const [box, setBox] = useState<MailBox>("inbox");
  const [items, setItems] = useState<MailMessage[]>([]);
  const [attachmentsByMessageId, setAttachmentsByMessageId] = useState<Record<string, MailAttachment[]>>({});
  const [counts, setCounts] = useState({ inbox: 0, unread: 0, sent: 0, drafts: 0 });
  const [status, setStatus] = useState("메일함을 불러오는 중입니다.");
  const [recipientUserId, setRecipientUserId] = useState("user_hr_admin");
  const [subject, setSubject] = useState("근태 정정 확인 요청");
  const [body, setBody] = useState("확인 필요한 내용을 입력하세요.");
  const [importance, setImportance] = useState<"normal" | "important">("normal");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tabs = useMemo(
    () => [
      { id: "inbox" as const, label: "받은 메일", badge: String(counts.inbox) },
      { id: "compose" as const, label: "메일 작성", badge: "작성" },
      { id: "sent" as const, label: "보낸 메일", badge: String(counts.sent) },
      { id: "security" as const, label: "보안 확인", badge: counts.unread > 0 ? "점검" : "정상" },
    ],
    [counts.inbox, counts.sent, counts.unread],
  );

  async function loadAttachments(messages: MailMessage[]) {
    const entries = await Promise.all(messages.map(async (message) => {
      const response = await fetch(appRoutes.mail.attachments(message.id), { credentials: "same-origin" });
      if (!response.ok) return [message.id, []] as const;
      const parsed = mailAttachmentListResponseSchema.parse(await response.json());
      return [message.id, parsed.data.items] as const;
    }));
    setAttachmentsByMessageId(Object.fromEntries(entries));
  }

  async function loadMessages(nextBox: MailBox = box) {
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
    if (box === "inbox" || box === "sent") {
      void loadMessages(box);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("메일을 저장하고 발송 처리 중입니다.");
    try {
      const response = await fetch(appRoutes.mail.send, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ recipientUserId, subject, body, importance }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "메일 발송에 실패했습니다.");
        return;
      }
      const parsed = mailMessageSendResponseSchema.parse(payload);
      if (attachmentFile) {
        const formData = new FormData();
        formData.append("file", attachmentFile);
        const attachmentResponse = await fetch(appRoutes.mail.attachments(parsed.data.message.id), {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        });
        const attachmentPayload = await attachmentResponse.json();
        if (!attachmentResponse.ok) {
          setStatus(attachmentPayload?.error?.message ?? "메일은 발송됐지만 첨부 업로드에 실패했습니다.");
          return;
        }
        mailAttachmentUploadResponseSchema.parse(attachmentPayload);
      }
      setAttachmentFile(null);
      setStatus("메일과 첨부가 DB/R2에 저장되고 보낸 메일함에 반영됐습니다.");
      setBox("sent");
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

  return (
    <div className="feature-workspace">
      <aside className="feature-workspace__nav" aria-label="메일 메뉴">
        <div className="feature-workspace__nav-header">
          <h1>
            <button className="page-shell__title-link page-shell__title-button" onClick={() => setBox("inbox")} type="button">
              메일
            </button>
          </h1>
          <p>받은 메일, 작성, 발송 내역을 실제 DB 저장·조회 기준으로 처리합니다.</p>
        </div>
        <div className="feature-workspace__tab-list" role="tablist" aria-label="메일 화면 선택">
          {tabs.map((tab) => (
            <button
              aria-selected={(tab.id === "compose" && box === "drafts") || tab.id === box || (tab.id === "security" && false)}
              className="feature-workspace__tab"
              key={tab.id}
              onClick={() => setBox(tab.id === "compose" ? "drafts" : tab.id === "security" ? "inbox" : tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              <strong>{tab.badge}</strong>
            </button>
          ))}
        </div>
        <div className="feature-workspace__utility" aria-label="요약 정보">
          <div><span>읽지 않음</span><strong>{counts.unread}건</strong></div>
          <div><span>받은 메일</span><strong>{counts.inbox}건</strong></div>
          <div><span>보낸 메일</span><strong>{counts.sent}건</strong></div>
        </div>
      </aside>

      <section className="feature-workspace__panel" aria-labelledby="mail-panel-heading">
        <div className="feature-workspace__panel-header">
          <div>
            <h2 id="mail-panel-heading">{box === "drafts" ? "메일 작성" : boxLabels[box]}</h2>
            <p>{status}</p>
          </div>
        </div>

        {box === "drafts" ? (
          <form className="feature-workspace__form" onSubmit={sendMessage}>
            <label>
              <span>받는 사람</span>
              <select aria-label="받는 사람" value={recipientUserId} onChange={(event) => setRecipientUserId(event.target.value)}>
                {recipientOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
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
        ) : (
          <div className="feature-workspace__rows">
            {items.length === 0 ? (
              <article className="feature-workspace__row"><div><strong>표시할 메일이 없습니다.</strong><span>DB 조회 결과</span></div><em>비어 있음</em></article>
            ) : items.map((message) => (
              <article className="feature-workspace__row" key={message.id}>
                <div>
                  <strong>{message.subject}</strong>
                  <span>{formatMeta(message, box)}</span>
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
                {box === "inbox" && !message.readAt ? (
                  <button className="touch-button feature-workspace__action feature-workspace__action--secondary" onClick={() => void markRead(message.id)} type="button">읽음</button>
                ) : <em>{message.importance === "important" ? "중요" : message.readAt ? "읽음" : "발송"}</em>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
