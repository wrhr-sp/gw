"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { appRoutes, messengerThreadLeaveResponseSchema } from "@gw/shared";

import { FeatureFileAttachmentBox, type FeatureFileAttachmentItem } from "../_components/feature-file-attachment-box";
import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type MessengerContact = {
  id: string;
  name: string;
  department: string;
  position: string;
  status: "온라인" | "회의 중" | "자리 비움";
};

type MessengerThread = {
  id: string;
  title: string;
  subtitle: string;
  lastMessage: string;
  time: string;
  unread: number;
  kind: "1:1" | "그룹";
};

type MessengerAttachment = {
  id: string;
  name: string;
  sizeLabel: string;
  source: "pc" | "document";
};

type MessengerDocumentCategory = "전체" | "최근문서" | "공지/규정" | "인사/근태" | "업무자료" | "양식";

type MessengerDocumentAttachment = MessengerAttachment & {
  category: Exclude<MessengerDocumentCategory, "전체" | "최근문서">;
  owner: string;
  updatedAt: string;
  isRecent?: boolean;
};

type MessengerEmojiCategory = "자주사용" | "표정" | "반응" | "업무" | "상태" | "기념";

type MessengerEmojiGroup = {
  category: MessengerEmojiCategory;
  emojis: readonly string[];
};

const messengerThreads: readonly MessengerThread[] = [
  {
    id: "thread-hr-kim",
    title: "김민수 과장",
    subtitle: "경영지원팀 · 1:1",
    lastMessage: "오늘 회의자료 확인했습니다.",
    time: "오전 10:24",
    unread: 2,
    kind: "1:1",
  },
  {
    id: "thread-dev-room",
    title: "개발팀 업무방",
    subtitle: "개발팀 · 그룹",
    lastMessage: "메신저 1차 UI preview 범위만 먼저 확인합니다.",
    time: "어제",
    unread: 0,
    kind: "그룹",
  },
  {
    id: "thread-admin-notice",
    title: "관리 공지 확인방",
    subtitle: "총괄관리 · 그룹",
    lastMessage: "실시간 채팅 서버는 후속 승인 범위로 남깁니다.",
    time: "월요일",
    unread: 5,
    kind: "그룹",
  },
] as const;

const organizationGroups: readonly { department: string; contacts: readonly MessengerContact[] }[] = [
  {
    department: "경영지원팀",
    contacts: [
      { id: "emp-kim", name: "김민수", department: "경영지원팀", position: "과장", status: "온라인" },
      { id: "emp-lee", name: "이서연", department: "경영지원팀", position: "대리", status: "자리 비움" },
    ],
  },
  {
    department: "개발팀",
    contacts: [
      { id: "emp-park", name: "박지훈", department: "개발팀", position: "책임", status: "회의 중" },
      { id: "emp-choi", name: "최유진", department: "개발팀", position: "선임", status: "온라인" },
    ],
  },
  {
    department: "인사팀",
    contacts: [
      { id: "emp-jung", name: "정하늘", department: "인사팀", position: "팀장", status: "온라인" },
    ],
  },
] as const;

const allContacts = organizationGroups.flatMap((group) => group.contacts);
const messengerDocumentCategories: readonly MessengerDocumentCategory[] = ["전체", "최근문서", "공지/규정", "인사/근태", "업무자료", "양식"] as const;
const messengerDocumentOptions: readonly MessengerDocumentAttachment[] = [
  { id: "doc-company-notice", name: "전사 공지문.docx", sizeLabel: "320KB", source: "document", category: "공지/규정", owner: "총괄관리", updatedAt: "오늘", isRecent: true },
  { id: "doc-privacy-policy", name: "개인정보 처리지침.pdf", sizeLabel: "760KB", source: "document", category: "공지/규정", owner: "경영지원팀", updatedAt: "어제" },
  { id: "doc-work-rule", name: "복무 규정.pdf", sizeLabel: "1.4MB", source: "document", category: "공지/규정", owner: "인사팀", updatedAt: "06.25" },
  { id: "doc-attendance-report", name: "근태현황.xlsx", sizeLabel: "840KB", source: "document", category: "인사/근태", owner: "인사팀", updatedAt: "오늘", isRecent: true },
  { id: "doc-leave-form", name: "휴가 신청 양식.docx", sizeLabel: "220KB", source: "document", category: "인사/근태", owner: "공용양식", updatedAt: "06.24" },
  { id: "doc-employee-list", name: "직원 명단.xlsx", sizeLabel: "1.1MB", source: "document", category: "인사/근태", owner: "인사팀", updatedAt: "06.21" },
  { id: "doc-meeting-material", name: "회의자료.pdf", sizeLabel: "1.2MB", source: "document", category: "업무자료", owner: "개발팀", updatedAt: "오늘", isRecent: true },
  { id: "doc-weekly-report", name: "주간업무보고.docx", sizeLabel: "540KB", source: "document", category: "업무자료", owner: "경영지원팀", updatedAt: "06.26" },
  { id: "doc-project-checklist", name: "프로젝트 체크리스트.xlsx", sizeLabel: "680KB", source: "document", category: "업무자료", owner: "개발팀", updatedAt: "06.22" },
  { id: "doc-draft-template", name: "기안서 양식.docx", sizeLabel: "260KB", source: "document", category: "양식", owner: "공용양식", updatedAt: "06.20" },
  { id: "doc-expense-template", name: "지출결의서 양식.xlsx", sizeLabel: "310KB", source: "document", category: "양식", owner: "공용양식", updatedAt: "06.19" },
  { id: "doc-trip-template", name: "출장신청서.pdf", sizeLabel: "410KB", source: "document", category: "양식", owner: "공용양식", updatedAt: "06.18" },
] as const;
const messengerEmojiGroups: readonly MessengerEmojiGroup[] = [
  { category: "자주사용", emojis: ["😀", "👍", "🙏", "🎉", "✅", "🙌", "📌", "💬"] },
  { category: "표정", emojis: ["😀", "😄", "😊", "🙂", "😅", "😂", "😮", "😢", "😡", "🤔", "😴", "😎"] },
  { category: "반응", emojis: ["👍", "👎", "👏", "🙌", "🙏", "👌", "💪", "🤝", "🙆", "🙅", "🙇", "👀"] },
  { category: "업무", emojis: ["✅", "📌", "📎", "📝", "📄", "📁", "📅", "⏰", "💬", "📣", "🔍", "💡"] },
  { category: "상태", emojis: ["🔴", "🟡", "🟢", "🔵", "⚠️", "🔒", "🔔", "🚫", "⏳", "☑️", "❗", "❓"] },
  { category: "기념", emojis: ["🎉", "🎊", "🎁", "🥳", "⭐", "❤️", "✨", "🏆", "☕", "🍀", "🌟", "💐"] },
] as const;

function formatMessengerFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }

  if (size >= 1024) {
    return `${Math.ceil(size / 1024)}KB`;
  }

  return `${size}B`;
}

export default function MessengerPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [leftThreadIds, setLeftThreadIds] = useState<string[]>([]);
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(["emp-kim", "emp-lee"]);
  const [isRecipientPanelOpen, setIsRecipientPanelOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false);
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
  const [activeDocumentCategory, setActiveDocumentCategory] = useState<MessengerDocumentCategory>("전체");
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<MessengerEmojiCategory>("자주사용");
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>(() => organizationGroups.map((group) => group.department));
  const [pendingAttachments, setPendingAttachments] = useState<MessengerAttachment[]>([]);
  const [messageDraft, setMessageDraft] = useState("메신저 1차 UI 확인 메시지입니다.");
  const [previewMessage, setPreviewMessage] = useState("회의자료 확인했습니다.");

  const activeThread = messengerThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const selectedContacts = allContacts.filter((contact) => selectedContactIds.includes(contact.id));

  const filteredThreads = useMemo(() => {
    const keyword = threadSearch.trim().toLowerCase();
    const availableThreads = messengerThreads.filter((thread) => !leftThreadIds.includes(thread.id));
    if (!keyword) {
      return availableThreads;
    }

    return availableThreads.filter((thread) =>
      [thread.title, thread.subtitle, thread.lastMessage, thread.kind].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [leftThreadIds, threadSearch]);

  const filteredOrganizationGroups = useMemo(() => {
    const keyword = recipientSearch.trim().toLowerCase();
    if (!keyword) {
      return organizationGroups;
    }

    return organizationGroups
      .map((group) => ({
        ...group,
        contacts: group.contacts.filter((contact) =>
          [contact.name, contact.department, contact.position, contact.status].some((value) => value.toLowerCase().includes(keyword)),
        ),
      }))
      .filter((group) => group.contacts.length > 0);
  }, [recipientSearch]);

  const filteredDocumentOptions = useMemo(() => {
    if (activeDocumentCategory === "전체") {
      return messengerDocumentOptions;
    }

    if (activeDocumentCategory === "최근문서") {
      return messengerDocumentOptions.filter((documentAttachment) => documentAttachment.isRecent);
    }

    return messengerDocumentOptions.filter((documentAttachment) => documentAttachment.category === activeDocumentCategory);
  }, [activeDocumentCategory]);

  const activeEmojiOptions = useMemo(
    () => messengerEmojiGroups.find((group) => group.category === activeEmojiCategory)?.emojis ?? messengerEmojiGroups[0].emojis,
    [activeEmojiCategory],
  );
  const attachmentItems: FeatureFileAttachmentItem[] = pendingAttachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.name,
    status: "대기",
    sizeLabel: attachment.sizeLabel,
    sourceLabel: attachment.source === "pc" ? "내 PC 파일첨부" : "문서함에서 선택",
    canDownload: attachment.source === "document",
  }));

  function toggleContact(contactId: string) {
    setSelectedContactIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId],
    );
  }

  function toggleDepartment(department: string) {
    setExpandedDepartments((current) =>
      current.includes(department) ? current.filter((item) => item !== department) : [...current, department],
    );
  }

  function handleStartConversation() {
    const names = selectedContacts.map((contact) => `${contact.name} ${contact.position}`).join(", ");
    setPreviewMessage(names ? `${names}에게 보낼 새 대화 preview가 준비됐습니다.` : "대상자를 선택하면 대화 시작 preview가 표시됩니다.");
    setIsRecipientPanelOpen(false);
  }

  function handleSendPreview() {
    const attachmentNames = pendingAttachments.map((attachment) => attachment.name).join(", ");
    const messageText = messageDraft.trim();
    if (!messageText && !attachmentNames) {
      return;
    }
    setPreviewMessage(attachmentNames ? `${messageText || "첨부 메시지"}\n첨부: ${attachmentNames}` : messageText);
    setMessageDraft("");
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    handleSendPreview();
  }

  async function handleLeaveActiveThread() {
    if (!activeThread) {
      return;
    }

    try {
      const response = await fetch(appRoutes.messenger.leaveThread(activeThread.id), {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) {
        setPreviewMessage(payload?.error?.message ?? "채팅방 나가기를 처리하지 못했습니다.");
        setIsConversationMenuOpen(false);
        return;
      }
      const parsed = messengerThreadLeaveResponseSchema.parse(payload);
      setLeftThreadIds((current) => current.includes(parsed.data.threadId) ? current : [...current, parsed.data.threadId]);
      setActiveThreadId(null);
      setPendingAttachments([]);
      setMessageDraft("");
      setPreviewMessage("회의자료 확인했습니다.");
      setIsAttachmentMenuOpen(false);
      setIsEmojiMenuOpen(false);
      setIsDocumentPickerOpen(false);
      setIsConversationMenuOpen(false);
    } catch {
      setPreviewMessage("채팅방 나가기 요청 중 오류가 발생했습니다.");
      setIsConversationMenuOpen(false);
    }
  }

  function handleTitleClick() {
    setActiveThreadId(null);
    setThreadSearch("");
    setRecipientSearch("");
    setPendingAttachments([]);
    setMessageDraft("메신저 1차 UI 확인 메시지입니다.");
    setPreviewMessage("회의자료 확인했습니다.");
    setIsRecipientPanelOpen(false);
    setIsAttachmentMenuOpen(false);
    setIsEmojiMenuOpen(false);
    setIsDocumentPickerOpen(false);
    setIsConversationMenuOpen(false);
  }

  function closeActiveThread() {
    setActiveThreadId(null);
    setPendingAttachments([]);
    setMessageDraft("메신저 1차 UI 확인 메시지입니다.");
    setPreviewMessage("회의자료 확인했습니다.");
    setIsAttachmentMenuOpen(false);
    setIsEmojiMenuOpen(false);
    setIsDocumentPickerOpen(false);
    setIsConversationMenuOpen(false);
  }

  function toggleAttachmentMenu() {
    setIsAttachmentMenuOpen((current) => !current);
    setIsEmojiMenuOpen(false);
    setIsDocumentPickerOpen(false);
  }

  function toggleEmojiMenu() {
    setIsEmojiMenuOpen((current) => !current);
    setIsAttachmentMenuOpen(false);
    setIsDocumentPickerOpen(false);
  }

  function appendEmoji(emoji: string) {
    setMessageDraft((current) => `${current}${emoji}`);
  }

  function openPcFilePicker() {
    setIsAttachmentMenuOpen(false);
    fileInputRef.current?.click();
  }

  function openDocumentPicker() {
    setIsAttachmentMenuOpen(false);
    setIsDocumentPickerOpen(true);
  }

  function handlePcFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length > 0) {
      setPendingAttachments((current) => [
        ...current,
        ...files.map((file, index) => ({
          id: `pc-${file.name}-${file.size}-${Date.now()}-${index}`,
          name: file.name,
          sizeLabel: formatMessengerFileSize(file.size),
          source: "pc" as const,
        })),
      ]);
    }
    event.currentTarget.value = "";
  }

  function addDocumentAttachment(documentAttachment: MessengerAttachment) {
    setPendingAttachments((current) =>
      current.some((attachment) => attachment.id === documentAttachment.id) ? current : [...current, documentAttachment],
    );
    setIsDocumentPickerOpen(false);
  }

  function removeAttachment(attachmentId: string) {
    setPendingAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }

  useEffect(() => {
    if (!isRecipientPanelOpen && !isAttachmentMenuOpen && !isEmojiMenuOpen && !isDocumentPickerOpen && !isConversationMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRecipientPanelOpen(false);
        setIsAttachmentMenuOpen(false);
        setIsEmojiMenuOpen(false);
        setIsDocumentPickerOpen(false);
        setIsConversationMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecipientPanelOpen, isAttachmentMenuOpen, isEmojiMenuOpen, isDocumentPickerOpen, isConversationMenuOpen]);

  return (
    <PageShell
      backHref="/menu"
      backLabel="전체 메뉴로"
      title="메신저"
      onTitleClick={handleTitleClick}
      titlePlacement="content"
    >
      <section className="surface-card messenger-surface">
        <div
          className="messenger-shell"
          aria-label="메신저 preview"
          onClick={() => {
            setIsAttachmentMenuOpen(false);
            setIsEmojiMenuOpen(false);
            setIsDocumentPickerOpen(false);
            setIsConversationMenuOpen(false);
          }}
        >
          <aside className="messenger-sidebar" aria-label="대화목록">
            <div className="messenger-sidebar__header">
              <h1>
                <button className="page-shell__title-link page-shell__title-button messenger-surface__title-button" type="button" onClick={handleTitleClick}>
                  메신저
                </button>
              </h1>
              <div className="messenger-sidebar__header-actions">
                <FeaturePageOverflowMenu label="메신저" />
                <button
                  className="touch-button--secondary messenger-new-button"
                  type="button"
                  onClick={() => setIsRecipientPanelOpen(true)}
                >
                  새 메시지
                </button>
              </div>
            </div>
            <label className="messenger-search">
              <span>채팅 검색</span>
              <input className="field" value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="이름, 부서, 메시지 검색" />
            </label>
            <div className="messenger-thread-list">
              {filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  className="messenger-thread"
                  aria-current={thread.id === activeThreadId ? "page" : undefined}
                  onClick={() => setActiveThreadId(thread.id)}
                  type="button"
                >
                  <span className="messenger-thread__avatar" aria-hidden="true">{thread.title.slice(0, 1)}</span>
                  <span className="messenger-thread__body">
                    <span className="messenger-thread__title-row">
                      <strong>{thread.title}</strong>
                      <small>{thread.time}</small>
                    </span>
                    <span className="messenger-thread__subtitle">{thread.subtitle}</span>
                    <span className="messenger-thread__message">{thread.lastMessage}</span>
                  </span>
                  {thread.unread ? <span className="messenger-unread-badge">{thread.unread}</span> : null}
                </button>
              ))}
            </div>
          </aside>

          <section className="messenger-conversation" aria-label="채팅방">
            {activeThread ? (
              <>
                <header className="messenger-conversation__header">
                  <div>
                    <Pill>{activeThread.kind}</Pill>
                    <h2>채팅방</h2>
                    <p>{activeThread.title} · {activeThread.subtitle}</p>
                  </div>
                  <div className="messenger-conversation-actions" onClick={(event) => event.stopPropagation()}>
                    <div className="messenger-conversation-menu-wrap">
                      <button
                        className="messenger-dialog-close messenger-conversation-menu-button"
                        type="button"
                        aria-label="채팅방 메뉴 열기"
                        aria-expanded={isConversationMenuOpen}
                        onClick={() => setIsConversationMenuOpen((current) => !current)}
                      >
                        ☰
                      </button>
                      <div className="messenger-popover-menu messenger-conversation-menu" hidden={!isConversationMenuOpen} role="menu" aria-label="채팅방 메뉴">
                        <button type="button" role="menuitem" onClick={() => setPreviewMessage("채팅방 설정은 준비 중입니다.")}>설정</button>
                        <button type="button" role="menuitem" className="messenger-conversation-menu__leave" onClick={() => void handleLeaveActiveThread()}>나가기</button>
                      </div>
                    </div>
                    <button className="messenger-dialog-close messenger-conversation-close" type="button" aria-label="채팅방 닫기" onClick={closeActiveThread}>
                      ×
                    </button>
                  </div>
                </header>
                <div className="messenger-message-list" aria-label="메시지 목록 preview">
                  <article className="messenger-message messenger-message--other">
                    <strong>김민수 과장</strong>
                    <p>오늘 회의자료 확인 부탁드립니다.</p>
                    <small>오전 10:21</small>
                  </article>
                  <article className="messenger-message messenger-message--mine">
                    <strong>나</strong>
                    <p>{previewMessage}</p>
                    <small>오전 10:24 · 화면 preview</small>
                  </article>
                </div>
                <div className="messenger-composer" aria-label="메시지 입력 preview">
              <input
                ref={fileInputRef}
                className="messenger-file-input"
                type="file"
                multiple
                aria-label="내 PC 파일첨부"
                onChange={handlePcFileChange}
              />
              {pendingAttachments.length ? (
                <div className="messenger-attachment-preview" aria-label="첨부 대기 목록">
                  <strong>첨부됨</strong>
                  <FeatureFileAttachmentBox items={attachmentItems} onRemove={removeAttachment} onDownload={() => setPreviewMessage("문서함 파일 다운로드 준비가 완료됐습니다.")} />
                </div>
              ) : null}
              <div className="messenger-composer-input-box" aria-label="메시지 입력 도구 묶음">
                <div className="messenger-attachment-wrap">
                  <button
                    className="messenger-composer-icon-button"
                    type="button"
                    aria-label="첨부 메뉴 열기"
                    aria-expanded={isAttachmentMenuOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleAttachmentMenu();
                    }}
                  >
                    +
                  </button>
                  <div className="messenger-popover-menu messenger-attachment-menu" hidden={!isAttachmentMenuOpen} role="menu" aria-label="첨부 메뉴 preview" onClick={(event) => event.stopPropagation()}>
                    <button type="button" role="menuitem" onClick={openPcFilePicker}>내 PC 파일첨부</button>
                    <button type="button" role="menuitem" onClick={openDocumentPicker}>문서함에서 선택</button>
                  </div>
                </div>
                <textarea
                  className="field messenger-composer-input"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="메시지를 입력하세요"
                  rows={1}
                />
                <div className="messenger-emoji-wrap">
                  <button
                    className="messenger-composer-icon-button"
                    type="button"
                    aria-label="이모티콘 선택"
                    aria-expanded={isEmojiMenuOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleEmojiMenu();
                    }}
                  >
                    ☺
                  </button>
                  <div className="messenger-popover-menu messenger-emoji-menu" hidden={!isEmojiMenuOpen} role="menu" aria-label="이모티콘 선택 메뉴" onClick={(event) => event.stopPropagation()}>
                    <div className="messenger-emoji-tabs" aria-label="이모티콘 분류">
                      {messengerEmojiGroups.map((group) => (
                        <button
                          key={group.category}
                          type="button"
                          aria-pressed={activeEmojiCategory === group.category}
                          onClick={() => setActiveEmojiCategory(group.category)}
                        >
                          {group.category}
                        </button>
                      ))}
                    </div>
                    <div className="messenger-emoji-grid" aria-label={`${activeEmojiCategory} 이모티콘 목록`}>
                      {activeEmojiOptions.map((emoji) => (
                        <button key={`${activeEmojiCategory}-${emoji}`} type="button" role="menuitem" aria-label={`${emoji} 이모티콘 입력`} onClick={() => appendEmoji(emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button className="messenger-send-button" type="button" onClick={handleSendPreview} aria-label="메시지 보내기">
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                  <path d="M3.7 20.1 21 12 3.7 3.9 3 10.2l10.2 1.8L3 13.8l.7 6.3Z" />
                </svg>
              </button>
                </div>
              </>
            ) : (
              <div className="messenger-empty-state" aria-label="채팅방 선택 안내">
                <strong>채팅방을 선택하세요</strong>
                <p>왼쪽 대화목록에서 대화를 선택하면 내용이 표시됩니다.</p>
              </div>
            )}
          </section>
        </div>

        <div
          className="messenger-recipient-backdrop"
          hidden={!isRecipientPanelOpen}
          onClick={() => setIsRecipientPanelOpen(false)}
          role="presentation"
        >
          <aside className="messenger-recipient-panel" aria-label="새 메시지 대상 선택 팝업" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="messenger-recipient-panel__header">
              <div>
                <Pill tone="accent">새 메시지</Pill>
                <h2>새 메시지</h2>
              </div>
              <button className="messenger-dialog-close" type="button" aria-label="새 메시지 팝업 닫기" onClick={() => setIsRecipientPanelOpen(false)}>
                ×
              </button>
            </div>
            <label className="messenger-search">
              <input className="field" aria-label="새 메시지 받을 사람 검색" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="이름, 부서, 직급 검색" />
            </label>
            <div className="messenger-recipient-tabs" aria-label="대상 선택 방식">
              <button type="button" aria-current="page">최근</button>
              <button type="button" aria-current="page">조직도</button>
              <button type="button">검색결과</button>
            </div>
            <div className="messenger-org-tree" aria-label="조직도 선택 목록">
              {filteredOrganizationGroups.map((group) => (
                <section key={group.department} className="messenger-org-group">
                  <button
                    className="messenger-org-group__toggle"
                    type="button"
                    aria-expanded={expandedDepartments.includes(group.department)}
                    onClick={() => toggleDepartment(group.department)}
                  >
                    <span>{expandedDepartments.includes(group.department) ? "▾" : "▸"} {group.department}</span>
                    <small>{group.contacts.length}명</small>
                  </button>
                  <div className="messenger-org-group__contacts" hidden={!expandedDepartments.includes(group.department)}>
                    {group.contacts.map((contact) => (
                      <label key={contact.id} className="messenger-contact-row">
                        <input checked={selectedContactIds.includes(contact.id)} onChange={() => toggleContact(contact.id)} type="checkbox" />
                        <span>
                          <strong>{contact.name} {contact.position}</strong>
                          <small>{contact.department} · {contact.status}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="messenger-selected-box" aria-label="선택한 사람">
              <strong>선택한 사람</strong>
              <div className="messenger-selected-chips">
                {selectedContacts.length ? selectedContacts.map((contact) => (
                  <button key={contact.id} type="button" onClick={() => toggleContact(contact.id)}>
                    {contact.name} {contact.position} ×
                  </button>
                )) : <span>아직 선택한 사람이 없습니다.</span>}
              </div>
            </div>
            <div className="messenger-recipient-actions">
              <button className="touch-button--secondary" type="button" onClick={() => setSelectedContactIds([])}>취소</button>
              <button className="touch-button" type="button" onClick={handleStartConversation}>대화 시작</button>
            </div>
          </aside>
        </div>

        <div
          className="messenger-document-backdrop"
          hidden={!isDocumentPickerOpen}
          onClick={() => setIsDocumentPickerOpen(false)}
          role="presentation"
        >
          <aside className="messenger-document-panel" aria-label="문서함에서 선택 팝업" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="messenger-recipient-panel__header">
              <div>
                <Pill tone="accent">문서함</Pill>
                <h2>문서함에서 선택</h2>
              </div>
              <button className="messenger-dialog-close" type="button" aria-label="문서함 선택 팝업 닫기" onClick={() => setIsDocumentPickerOpen(false)}>
                ×
              </button>
            </div>
            <div className="messenger-document-tabs" aria-label="문서함 분류">
              {messengerDocumentCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeDocumentCategory === category}
                  onClick={() => setActiveDocumentCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="messenger-document-list" aria-label={`${activeDocumentCategory} 문서함 선택 목록`}>
              {filteredDocumentOptions.map((documentAttachment) => (
                <button key={documentAttachment.id} type="button" onClick={() => addDocumentAttachment(documentAttachment)}>
                  <span>
                    <strong>{documentAttachment.name}</strong>
                    <small>{documentAttachment.category} · {documentAttachment.sizeLabel} · {documentAttachment.owner}</small>
                  </span>
                  <span aria-hidden="true">{documentAttachment.updatedAt}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </PageShell>
  );
}
