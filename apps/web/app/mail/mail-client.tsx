"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { boardTinymceInit } from "../_components/board-rich-editor-config";
import { FeatureFileAttachmentBox, type FeatureFileAttachmentItem } from "../_components/feature-file-attachment-box";
import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import {
  appRoutes,
  documentFileDownloadInitResponseSchema,
  documentFileListResponseSchema,
  mailAttachmentListResponseSchema,
  mailAttachmentDeleteResponseSchema,
  mailAttachmentUploadResponseSchema,
  mailMessageDraftSaveResponseSchema,
  mailMessageListResponseSchema,
  mailMessageReadResponseSchema,
  mailMessageSendResponseSchema,
  mailRecipientListResponseSchema,
  type DocumentFile,
  type MailAttachment,
  type MailBox,
  type MailMessage,
  type MailRecipient,
} from "@gw/shared";

type MailPendingAttachment = {
  id: string;
  fileName: string;
  sizeLabel: string;
  status: FeatureFileAttachmentItem["status"];
  sourceLabel: string;
  file?: File;
  documentFile?: DocumentFile;
  uploadedAttachmentId?: string;
};

const boxLabels: Record<MailBox, string> = {
  inbox: "받은메일함",
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
  { id: "inbox", label: "받은메일함", group: "mailbox", box: "inbox" },
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

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${size}B`;
}

function getRecipientLabel(recipient: MailRecipient) {
  const meta = [recipient.departmentName, recipient.positionName].filter(Boolean).join(" · ");
  return meta ? `${recipient.displayName} <${recipient.email}> · ${meta}` : `${recipient.displayName} <${recipient.email}>`;
}

const mailRecipientSectionLabels = {
  internal: "전사 내 계정 메일",
  history: "발송/수신 이력이 있는 메일",
} as const;

function getRecipientSearchPrompt(query: string) {
  return query.trim() ? "검색 결과가 없습니다." : "이름, 이메일, 부서명을 입력하세요.";
}

export function MailClient() {
  const [view, setView] = useState<MailView>("inbox");
  const [items, setItems] = useState<MailMessage[]>([]);
  const [attachmentsByMessageId, setAttachmentsByMessageId] = useState<Record<string, MailAttachment[]>>({});
  const [counts, setCounts] = useState({ inbox: 0, unread: 0, sent: 0, drafts: 0 });
  const [status, setStatus] = useState("메일함을 불러오는 중입니다.");
  const [recipients, setRecipients] = useState<MailRecipient[]>([]);
  const [addressBookRecipients, setAddressBookRecipients] = useState<MailRecipient[]>([]);
  const [addressBookQuery, setAddressBookQuery] = useState("");
  const [recipientLookup, setRecipientLookup] = useState<Record<string, MailRecipient>>({});
  const [recipientQuery, setRecipientQuery] = useState("");
  const [ccQuery, setCcQuery] = useState("");
  const [activeRecipientPopup, setActiveRecipientPopup] = useState<"to" | "cc" | null>(null);
  const [manualRecipientPopupTarget, setManualRecipientPopupTarget] = useState<"to" | "cc" | null>(null);
  const recipientPopupRef = useRef<HTMLDivElement | null>(null);
  const ccPopupRef = useRef<HTMLDivElement | null>(null);
  const [recipientUserIds, setRecipientUserIds] = useState<string[]>([]);
  const [ccUserIds, setCcUserIds] = useState<string[]>([]);
  const [addressBookRecipientUserIds, setAddressBookRecipientUserIds] = useState<string[]>([]);
  const [addressBookCcUserIds, setAddressBookCcUserIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("<p></p>");
  const [importance, setImportance] = useState<"normal" | "important">("normal");
  const [pendingAttachments, setPendingAttachments] = useState<MailPendingAttachment[]>([]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
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
  const selectedRecipients = recipientUserIds.map((userId) => recipientLookup[userId]).filter((recipient): recipient is MailRecipient => Boolean(recipient));
  const selectedCcRecipients = ccUserIds.map((userId) => recipientLookup[userId]).filter((recipient): recipient is MailRecipient => Boolean(recipient));
  const addressBookSelectedRecipients = addressBookRecipientUserIds.map((userId) => recipientLookup[userId]).filter((recipient): recipient is MailRecipient => Boolean(recipient));
  const addressBookSelectedCcRecipients = addressBookCcUserIds.map((userId) => recipientLookup[userId]).filter((recipient): recipient is MailRecipient => Boolean(recipient));
  const visibleRecipientSuggestions = recipientQuery.trim() ? recipients.filter((recipient) => !recipientUserIds.includes(recipient.userId)).slice(0, 8) : [];
  const visibleCcSuggestions = ccQuery.trim() ? recipients.filter((recipient) => !ccUserIds.includes(recipient.userId)).slice(0, 8) : [];
  const recipientSuggestionsBySource = {
    internal: visibleRecipientSuggestions.filter((recipient) => recipient.sourceKind === "internal"),
    history: visibleRecipientSuggestions.filter((recipient) => recipient.sourceKind === "history"),
  };
  const ccSuggestionsBySource = {
    internal: visibleCcSuggestions.filter((recipient) => recipient.sourceKind === "internal"),
    history: visibleCcSuggestions.filter((recipient) => recipient.sourceKind === "history"),
  };
  const addressBookSuggestionsBySource = {
    internal: addressBookRecipients.filter((recipient) => recipient.sourceKind === "internal"),
    history: addressBookRecipients.filter((recipient) => recipient.sourceKind === "history"),
  };
  const isRecipientPopupOpen = activeRecipientPopup === "to" && (recipientQuery.trim().length > 0 || visibleRecipientSuggestions.length > 0 || manualRecipientPopupTarget === "to");
  const isCcPopupOpen = activeRecipientPopup === "cc" && (ccQuery.trim().length > 0 || visibleCcSuggestions.length > 0 || manualRecipientPopupTarget === "cc");
  const attachmentItems: FeatureFileAttachmentItem[] = pendingAttachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    status: attachment.status,
    sizeLabel: attachment.sizeLabel,
    sourceLabel: attachment.sourceLabel,
    canDownload: Boolean(attachment.uploadedAttachmentId || attachment.documentFile),
  }));

  async function loadRecipients(query = "") {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setRecipients([]);
      return;
    }
    const response = await fetch(`${appRoutes.mail.recipients}?q=${encodeURIComponent(trimmedQuery)}`, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "수신자 목록을 불러오지 못했습니다.");
      return;
    }
    const parsed = mailRecipientListResponseSchema.parse(payload);
    setRecipients(parsed.data.items);
    setRecipientLookup((current) => ({
      ...current,
      ...Object.fromEntries(parsed.data.items.map((recipient) => [recipient.userId, recipient])),
    }));
  }

  async function loadAddressBookRecipients(query = "") {
    const trimmedQuery = query.trim();
    const path = trimmedQuery ? `${appRoutes.mail.recipients}?q=${encodeURIComponent(trimmedQuery)}` : appRoutes.mail.recipients;
    const response = await fetch(path, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "주소록을 불러오지 못했습니다.");
      return;
    }
    const parsed = mailRecipientListResponseSchema.parse(payload);
    setAddressBookRecipients(parsed.data.items);
    setRecipientLookup((current) => ({
      ...current,
      ...Object.fromEntries(parsed.data.items.map((recipient) => [recipient.userId, recipient])),
    }));
  }

  async function loadDocumentFiles() {
    const response = await fetch(appRoutes.documents.files, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "문서함을 불러오지 못했습니다.");
      return;
    }
    const parsed = documentFileListResponseSchema.parse(payload);
    setDocumentFiles(parsed.data.items);
  }

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
    void loadDocumentFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "compose") {
      void loadRecipients(recipientQuery || ccQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientQuery, ccQuery, view]);

  useEffect(() => {
    function handleRecipientPopupPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (recipientPopupRef.current?.contains(target) || ccPopupRef.current?.contains(target)) {
        return;
      }
      setActiveRecipientPopup(null);
      setManualRecipientPopupTarget(null);
    }

    document.addEventListener("pointerdown", handleRecipientPopupPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleRecipientPopupPointerDown, true);
  }, []);

  useEffect(() => {
    function handleRecipientPopupKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRecipientPopup();
      }
    }

    document.addEventListener("keydown", handleRecipientPopupKeyDown);
    return () => document.removeEventListener("keydown", handleRecipientPopupKeyDown);
  }, []);

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

  function closeRecipientPopup() {
    setActiveRecipientPopup(null);
    setManualRecipientPopupTarget(null);
  }

  function openAddressBook(target: "to" | "cc") {
    setAddressBookRecipientUserIds(recipientUserIds);
    setAddressBookCcUserIds(ccUserIds);
    setAddressBookQuery("");
    setActiveRecipientPopup(target);
    setManualRecipientPopupTarget(target);
    void loadAddressBookRecipients("");
  }

  function applyAddressBookSelection() {
    setRecipientUserIds(addressBookRecipientUserIds);
    setCcUserIds(addressBookCcUserIds);
    closeRecipientPopup();
  }

  function addAddressBookRecipient(recipient: MailRecipient, target: "to" | "cc") {
    setRecipientLookup((current) => ({ ...current, [recipient.userId]: recipient }));
    const setter = target === "to" ? setAddressBookRecipientUserIds : setAddressBookCcUserIds;
    setter((current) => current.includes(recipient.userId) ? current : [...current, recipient.userId]);
  }

  function removeAddressBookRecipient(recipientId: string, target: "to" | "cc") {
    const setter = target === "to" ? setAddressBookRecipientUserIds : setAddressBookCcUserIds;
    setter((current) => current.filter((id) => id !== recipientId));
  }

  function addRecipient(recipient: MailRecipient, target: "to" | "cc") {
    setRecipientLookup((current) => ({ ...current, [recipient.userId]: recipient }));
    const setter = target === "to" ? setRecipientUserIds : setCcUserIds;
    setter((current) => current.includes(recipient.userId) ? current : [...current, recipient.userId]);
    if (target === "to") setRecipientQuery("");
    else setCcQuery("");
    closeRecipientPopup();
  }

  function removeRecipient(recipientId: string, target: "to" | "cc") {
    const setter = target === "to" ? setRecipientUserIds : setCcUserIds;
    setter((current) => current.filter((id) => id !== recipientId));
  }

  function handlePcFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length) {
      setPendingAttachments((current) => [
        ...current,
        ...files.map((file, index) => ({
          id: `pc-${file.name}-${file.size}-${Date.now()}-${index}`,
          fileName: file.name,
          sizeLabel: formatFileSize(file.size),
          status: "대기" as const,
          sourceLabel: "내 PC 파일첨부",
          file,
        })),
      ]);
    }
    event.currentTarget.value = "";
  }

  function addDocumentAttachment(documentFile: DocumentFile) {
    setPendingAttachments((current) => current.some((attachment) => attachment.id === `document-${documentFile.id}`) ? current : [
      ...current,
      {
        id: `document-${documentFile.id}`,
        fileName: documentFile.fileName,
        sizeLabel: formatFileSize(documentFile.fileSize),
        status: documentFile.storageStatus === "ready" ? "업로드 완료" : "대기",
        sourceLabel: "문서함에서 선택",
        documentFile,
      },
    ]);
    setIsDocumentPickerOpen(false);
  }

  function removeAttachment(attachmentId: string) {
    setPendingAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }

  async function removeAllAttachments() {
    try {
      const uploadedAttachments = pendingAttachments.filter((attachment) => attachment.uploadedAttachmentId);
      if (uploadedAttachments.length) {
        const responses = await Promise.all(uploadedAttachments.map(async (attachment) => {
          if (!attachment.uploadedAttachmentId) return null;
          const response = await fetch(appRoutes.mail.attachment(attachment.uploadedAttachmentId), { method: "DELETE", credentials: "same-origin" });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error?.message ?? "첨부 전체삭제에 실패했습니다.");
          }
          return mailAttachmentDeleteResponseSchema.parse(payload);
        }));
        void responses;
      }
      setPendingAttachments([]);
      setStatus("첨부파일을 전체삭제했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "첨부 전체삭제에 실패했습니다.");
    }
  }

  async function downloadAttachment(attachment: FeatureFileAttachmentItem) {
    const pending = pendingAttachments.find((item) => item.id === attachment.id);
    if (pending?.uploadedAttachmentId) {
      window.location.href = appRoutes.mail.downloadAttachment(pending.uploadedAttachmentId);
      return;
    }
    if (pending?.documentFile) {
      const response = await fetch(appRoutes.documents.downloadInit(pending.documentFile.id), { method: "POST", credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "문서 다운로드 준비에 실패했습니다.");
        return;
      }
      documentFileDownloadInitResponseSchema.parse(payload);
      setStatus(`${pending.documentFile.fileName} 다운로드가 준비됐습니다.`);
    }
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
      const pcAttachments = pendingAttachments.filter((attachment) => attachment.file);
      if (pcAttachments.length) {
        for (const message of sentMessages) {
          for (const attachment of pcAttachments) {
            if (!attachment.file) continue;
            setPendingAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, status: "업로드 중" } : item));
            const formData = new FormData();
            formData.append("file", attachment.file);
            const attachmentResponse = await fetch(appRoutes.mail.attachments(message.id), {
              method: "POST",
              credentials: "same-origin",
              body: formData,
            });
            const attachmentPayload = await attachmentResponse.json();
            if (!attachmentResponse.ok) {
              setPendingAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, status: "실패" } : item));
              setStatus(attachmentPayload?.error?.message ?? "메일은 발송됐지만 일부 첨부 업로드에 실패했습니다.");
              return;
            }
            const uploaded = mailAttachmentUploadResponseSchema.parse(attachmentPayload);
            setPendingAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, status: "업로드 완료", uploadedAttachmentId: uploaded.data.attachment.id } : item));
          }
        }
      }
      setPendingAttachments([]);
      setStatus(`메일 ${sentMessages.length}건이 보낸메일함에 반영됐습니다.`);
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
          <button type="button" className="mail-compose-toolbar-button" onClick={resetFolderSettings}>기본값</button>
          <button type="button" className="touch-button feature-workspace__action feature-workspace__action--primary" onClick={() => setIsFolderEditorOpen(false)}>적용</button>
        </div>
      </section>
    );
  }

  function renderRecipientSuggestionSections(input: {
    target: "to" | "cc";
    query: string;
    groups: { internal: MailRecipient[]; history: MailRecipient[] };
  }) {
    const orderedGroups: Array<keyof typeof mailRecipientSectionLabels> = ["internal", "history"];
    const hasResults = orderedGroups.some((sourceKind) => input.groups[sourceKind].length > 0);

    if (!hasResults) {
      return <span>{getRecipientSearchPrompt(input.query)}</span>;
    }

    return orderedGroups.map((sourceKind) => {
      const groupItems = input.groups[sourceKind];
      if (!groupItems.length) return null;
      return (
        <section className="mail-recipient-suggestion-section" key={sourceKind} aria-label={mailRecipientSectionLabels[sourceKind]}>
          <strong>{mailRecipientSectionLabels[sourceKind]}</strong>
          {groupItems.map((recipient) => (
            <button key={`${sourceKind}-${recipient.userId}`} type="button" role="option" onClick={() => addRecipient(recipient, input.target)}>{getRecipientLabel(recipient)}</button>
          ))}
        </section>
      );
    });
  }

  function renderAddressBookPopover(input: {
    target: "to" | "cc";
    groups: { internal: MailRecipient[]; history: MailRecipient[] };
  }) {
    const orderedGroups: Array<keyof typeof mailRecipientSectionLabels> = ["internal", "history"];
    const hasResults = orderedGroups.some((sourceKind) => input.groups[sourceKind].length > 0);
    return (
      <section className="mail-address-book-popover" role="dialog" aria-label="주소록 선택 팝업">
        <div className="mail-address-book-popover__header">
          <strong>주소록</strong>
          <span>{input.target === "to" ? "기본 추가 대상: 받는사람" : "기본 추가 대상: 참조"}</span>
          <button type="button" aria-label="주소록 닫기" onClick={closeRecipientPopup}>×</button>
        </div>
        <div className="mail-address-book-popover__tabs" aria-label="주소록 구분">
          <span aria-current="page">전사 주소록</span>
          <span>최근/이력</span>
          <span aria-disabled="true">개인 주소록 준비중</span>
        </div>
        <div className="mail-address-book-popover__body">
          <nav className="mail-address-book-popover__groups" aria-label="주소록 그룹">
            <strong>전체 주소록</strong>
            <span>전사 계정</span>
            <span>발송/수신 이력</span>
          </nav>
          <section className="mail-address-book-popover__list" aria-label="주소 목록">
            <input className="field" aria-label="주소록 검색" placeholder="이름, 이메일, 부서 검색" value={addressBookQuery} onChange={(event) => { setAddressBookQuery(event.target.value); void loadAddressBookRecipients(event.target.value); }} />
            <div className="mail-address-book-table" role="listbox" aria-label="주소록 검색 결과">
              {hasResults ? orderedGroups.map((sourceKind) => {
                const groupItems = input.groups[sourceKind];
                if (!groupItems.length) return null;
                return (
                  <section className="mail-address-book-table__section" key={sourceKind} aria-label={mailRecipientSectionLabels[sourceKind]}>
                    <strong>{mailRecipientSectionLabels[sourceKind]}</strong>
                    {groupItems.map((recipient) => (
                      <div className="mail-address-book-table__row" key={`${sourceKind}-${recipient.userId}`} role="option" aria-selected={addressBookRecipientUserIds.includes(recipient.userId) || addressBookCcUserIds.includes(recipient.userId)}>
                        <span>{recipient.displayName}</span>
                        <span>{recipient.positionName ?? "-"}</span>
                        <span>{recipient.departmentName ?? "-"}</span>
                        <span>{recipient.email}</span>
                        <button type="button" onClick={() => addAddressBookRecipient(recipient, "to")}>받는사람</button>
                        <button type="button" onClick={() => addAddressBookRecipient(recipient, "cc")}>참조</button>
                      </div>
                    ))}
                  </section>
                );
              }) : <span className="mail-address-book-table__empty">{addressBookQuery.trim() ? "검색 결과가 없습니다." : "주소록에 표시할 주소가 없습니다."}</span>}
            </div>
          </section>
          <aside className="mail-address-book-popover__selected" aria-label="선택한 주소">
            <section>
              <strong>받는사람</strong>
              {addressBookSelectedRecipients.length ? addressBookSelectedRecipients.map((recipient) => (
                <button key={recipient.userId} type="button" onClick={() => removeAddressBookRecipient(recipient.userId, "to")}>{recipient.displayName} &lt;{recipient.email}&gt; ×</button>
              )) : <span>선택된 주소가 없습니다.</span>}
            </section>
            <section>
              <strong>참조</strong>
              {addressBookSelectedCcRecipients.length ? addressBookSelectedCcRecipients.map((recipient) => (
                <button key={recipient.userId} type="button" onClick={() => removeAddressBookRecipient(recipient.userId, "cc")}>{recipient.displayName} &lt;{recipient.email}&gt; ×</button>
              )) : <span>선택된 주소가 없습니다.</span>}
            </section>
          </aside>
        </div>
        <div className="mail-address-book-popover__footer">
          <button type="button" className="mail-compose-toolbar-button" onClick={closeRecipientPopup}>취소</button>
          <button type="button" className="mail-compose-toolbar-button mail-compose-toolbar-button--primary" onClick={applyAddressBookSelection}>확인</button>
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
              <button className="mail-compose-toolbar-button mail-compose-toolbar-button--primary" disabled={isSubmitting} type="submit">
                {isSubmitting ? "처리 중" : "보내기"}
              </button>
              <button className="mail-compose-toolbar-button" disabled type="button" title="예약 발송 API는 일정 엔진 확정 뒤 연결합니다.">예약발송</button>
              <button className="mail-compose-toolbar-button" disabled={isSubmitting} type="button" onClick={() => void saveDraft()}>임시저장</button>
              <button className="mail-compose-toolbar-button" type="button" onClick={() => setIsPreviewOpen((value) => !value)}>미리보기</button>
              <button className="mail-compose-toolbar-button" type="button" onClick={applyTemplate}>템플릿</button>
              <button className="mail-compose-toolbar-button" type="button" onClick={writeToMyself}>내게쓰기</button>
            </div>

            <div className="mail-compose-row mail-compose-row--recipients">
              <strong>받는사람</strong>
              <div className="mail-recipient-combobox" aria-label="받는사람 입력" ref={recipientPopupRef}>
                <div className="mail-recipient-input-line">
                  <input className="field" aria-label="받는사람 이메일 또는 이름" placeholder="이름, 이메일, 부서 검색" value={recipientQuery} onChange={(event) => { setRecipientQuery(event.target.value); setActiveRecipientPopup("to"); setManualRecipientPopupTarget(null); }} />
                  <button className="mail-address-book-button" type="button" onClick={() => openAddressBook("to")}>주소록</button>
                </div>
                {selectedRecipients.length ? (
                  <div className="mail-recipient-chip-list" aria-label="선택된 받는사람">
                    {selectedRecipients.map((recipient) => (
                      <button key={recipient.userId} type="button" onClick={() => removeRecipient(recipient.userId, "to")}>{recipient.displayName} &lt;{recipient.email}&gt; ×</button>
                    ))}
                  </div>
                ) : null}
                {isRecipientPopupOpen ? manualRecipientPopupTarget === "to" ? (
                  renderAddressBookPopover({ target: "to", groups: addressBookSuggestionsBySource })
                ) : (
                  <div className="mail-recipient-suggestions" role="listbox" aria-label="받는사람 검색 결과">
                    {renderRecipientSuggestionSections({ target: "to", query: recipientQuery, groups: recipientSuggestionsBySource })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mail-compose-row mail-compose-row--recipients">
              <strong>참조</strong>
              <div className="mail-recipient-combobox" aria-label="참조 입력" ref={ccPopupRef}>
                <div className="mail-recipient-input-line">
                  <input className="field" aria-label="참조 이메일 또는 이름" placeholder="이름, 이메일, 부서 검색" value={ccQuery} onChange={(event) => { setCcQuery(event.target.value); setActiveRecipientPopup("cc"); setManualRecipientPopupTarget(null); }} />
                  <button className="mail-address-book-button" type="button" onClick={() => openAddressBook("cc")}>주소록</button>
                </div>
                {selectedCcRecipients.length ? (
                  <div className="mail-recipient-chip-list" aria-label="선택된 참조">
                    {selectedCcRecipients.map((recipient) => (
                      <button key={recipient.userId} type="button" onClick={() => removeRecipient(recipient.userId, "cc")}>{recipient.displayName} &lt;{recipient.email}&gt; ×</button>
                    ))}
                  </div>
                ) : null}
                {isCcPopupOpen ? manualRecipientPopupTarget === "cc" ? (
                  renderAddressBookPopover({ target: "cc", groups: addressBookSuggestionsBySource })
                ) : (
                  <div className="mail-recipient-suggestions" role="listbox" aria-label="참조 검색 결과">
                    {renderRecipientSuggestionSections({ target: "cc", query: ccQuery, groups: ccSuggestionsBySource })}
                  </div>
                ) : null}
              </div>
            </div>

            <label className="mail-compose-row mail-compose-row--subject">
              <strong>제목</strong>
              <span className="mail-compose-important">중요 <input checked={importance === "important"} onChange={(event) => setImportance(event.target.checked ? "important" : "normal")} type="checkbox" /></span>
              <input className="field" aria-label="제목" placeholder="제목을 입력하세요" required value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>

            <section className="mail-compose-attachments" aria-label="파일첨부">
              <div className="mail-compose-attachments__header">
                <strong>파일첨부</strong>
                <div className="mail-compose-attachment-actions">
                  <label className="mail-compose-attachment-button">
                    <input className="mail-compose-file-input" aria-label="내 PC 파일첨부" type="file" multiple onChange={handlePcFileChange} />
                    내 PC 파일첨부
                  </label>
                  <button className="mail-compose-attachment-button" type="button" onClick={() => setIsDocumentPickerOpen(true)}>문서함에서 선택</button>
                </div>
              </div>
              <FeatureFileAttachmentBox items={attachmentItems} onRemove={removeAttachment} onRemoveAll={() => void removeAllAttachments()} onDownload={(attachment) => void downloadAttachment(attachment)} />
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

            {isDocumentPickerOpen ? (
              <section className="mail-document-picker" aria-label="문서함에서 선택 팝업">
                <div className="mail-document-picker__header">
                  <strong>문서함에서 선택</strong>
                  <button type="button" aria-label="문서함 선택 닫기" onClick={() => setIsDocumentPickerOpen(false)}>×</button>
                </div>
                <div className="mail-document-picker__list" aria-label="문서함 선택 목록">
                  {documentFiles.map((file) => (
                    <button key={file.id} type="button" onClick={() => addDocumentAttachment(file)}>
                      <span><strong>{file.fileName}</strong><small>{file.versionLabel} · {formatFileSize(file.fileSize)} · {file.storageStatus}</small></span>
                      <span>{file.storageStatus === "ready" ? "선택" : "대기"}</span>
                    </button>
                  ))}
                  {documentFiles.length === 0 ? <span>선택할 문서가 없습니다.</span> : null}
                </div>
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
                  <button className="mail-compose-toolbar-button" onClick={() => void markRead(message.id)} type="button">읽음</button>
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
