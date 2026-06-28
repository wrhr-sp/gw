"use client";

import React, { useEffect, useMemo, useState } from "react";

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
const messengerEmojiOptions = ["😀", "👍", "🙏", "🎉", "👌", "😊", "✅", "🙌"] as const;

export default function MessengerPage() {
  const [activeThreadId, setActiveThreadId] = useState(messengerThreads[0].id);
  const [threadSearch, setThreadSearch] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(["emp-kim", "emp-lee"]);
  const [isRecipientPanelOpen, setIsRecipientPanelOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>(() => organizationGroups.map((group) => group.department));
  const [messageDraft, setMessageDraft] = useState("메신저 1차 UI 확인 메시지입니다.");
  const [previewMessage, setPreviewMessage] = useState("회의자료 확인했습니다.");

  const activeThread = messengerThreads.find((thread) => thread.id === activeThreadId) ?? messengerThreads[0];
  const selectedContacts = allContacts.filter((contact) => selectedContactIds.includes(contact.id));

  const filteredThreads = useMemo(() => {
    const keyword = threadSearch.trim().toLowerCase();
    if (!keyword) {
      return messengerThreads;
    }

    return messengerThreads.filter((thread) =>
      [thread.title, thread.subtitle, thread.lastMessage, thread.kind].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [threadSearch]);

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
    setPreviewMessage(messageDraft.trim() || "빈 메시지는 전송하지 않고 preview 안내만 유지합니다.");
  }

  function handleTitleClick() {
    setActiveThreadId(messengerThreads[0].id);
    setThreadSearch("");
    setRecipientSearch("");
    setIsRecipientPanelOpen(false);
    setIsAttachmentMenuOpen(false);
    setIsEmojiMenuOpen(false);
  }

  function toggleAttachmentMenu() {
    setIsAttachmentMenuOpen((current) => !current);
    setIsEmojiMenuOpen(false);
  }

  function toggleEmojiMenu() {
    setIsEmojiMenuOpen((current) => !current);
    setIsAttachmentMenuOpen(false);
  }

  function appendEmoji(emoji: string) {
    setMessageDraft((current) => `${current}${emoji}`);
    setIsEmojiMenuOpen(false);
  }

  useEffect(() => {
    if (!isRecipientPanelOpen && !isAttachmentMenuOpen && !isEmojiMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRecipientPanelOpen(false);
        setIsAttachmentMenuOpen(false);
        setIsEmojiMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecipientPanelOpen, isAttachmentMenuOpen, isEmojiMenuOpen]);

  return (
    <PageShell
      backHref="/menu"
      backLabel="전체 메뉴로"
      title="메신저"
      onTitleClick={handleTitleClick}
      titlePlacement="content"
    >
      <section className="surface-card messenger-surface">
        <div className="surface-card__header">
          <h2>
            <button className="page-shell__title-link page-shell__title-button messenger-surface__title-button" type="button" onClick={handleTitleClick}>
              메신저
            </button>
          </h2>
        </div>
        <div
          className="messenger-shell"
          aria-label="메신저 preview"
          onClick={() => {
            setIsAttachmentMenuOpen(false);
            setIsEmojiMenuOpen(false);
          }}
        >
          <aside className="messenger-sidebar" aria-label="대화목록">
            <div className="messenger-sidebar__header">
              <h2>대화목록</h2>
              <button
                className="touch-button--secondary messenger-new-button"
                type="button"
                onClick={() => setIsRecipientPanelOpen(true)}
              >
                새 메시지
              </button>
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
                  aria-current={thread.id === activeThread.id ? "page" : undefined}
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
            <header className="messenger-conversation__header">
              <div>
                <Pill>{activeThread.kind}</Pill>
                <h2>채팅방</h2>
                <p>{activeThread.title} · {activeThread.subtitle}</p>
              </div>
              <Pill tone="warning">preview</Pill>
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
                    <button type="button" role="menuitem">내 PC 파일첨부</button>
                    <button type="button" role="menuitem">문서함에서 선택</button>
                  </div>
                </div>
                <input className="field messenger-composer-input" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="메시지를 입력하세요" />
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
                    {messengerEmojiOptions.map((emoji) => (
                      <button key={emoji} type="button" role="menuitem" aria-label={`${emoji} 이모티콘 입력`} onClick={() => appendEmoji(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button className="messenger-send-button" type="button" onClick={handleSendPreview} aria-label="메시지 보내기">
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                  <path d="M3.7 20.1 21 12 3.7 3.9 3 10.2l10.2 1.8L3 13.8l.7 6.3Z" />
                </svg>
              </button>
            </div>
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
      </section>
    </PageShell>
  );
}
