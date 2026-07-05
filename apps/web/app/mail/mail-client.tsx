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
  mailIntegrationSettingsResponseSchema,
  mailDeliveryHistoryResponseSchema,
  mailTemplateListResponseSchema,
  mailTemplateRenderResponseSchema,
  mailTemplateTestSendResponseSchema,
  mailProviderSettingsResponseSchema,
  mailMessageDraftSaveResponseSchema,
  mailMessageListResponseSchema,
  mailMessageBulkActionResponseSchema,
  mailMessageMoveResponseSchema,
  mailMessageFavoriteResponseSchema,
  mailMessageReadResponseSchema,
  mailMessageSendResponseSchema,
  mailRecipientListResponseSchema,
  type DocumentFile,
  type MailAccount,
  type MailAccountAlias,
  type MailAttachment,
  type MailBox,
  type MailDeliveryBatch,
  type MailMessage,
  type MailProviderSettings,
  type MailRecipient,
  type MailTemplate,
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
  favorites: "즐겨찾기",
  inbox: "받은메일함",
  sent: "보낸메일함",
  drafts: "임시보관함",
  scheduled: "예약메일함",
  spam: "스팸메일함",
  trash: "휴지통",
};

type MailFolderId = "favorites" | "inbox" | "sent" | "drafts" | "scheduled" | "spam" | "trash" | "external";
type MailView = MailFolderId | "compose" | "security" | "settings" | "deliveryHistory";
type MailComposeMode = "new" | "reply" | "replyAll" | "forward";
type MailRecipientTarget = "to" | "cc";
type MailExternalRecipient = {
  id: string;
  email: string;
};

type MailFolderConfig = {
  id: MailFolderId;
  label: string;
  group: "standalone" | "mailbox" | "external" | "trash";
  box?: MailBox;
};

const defaultMailFolders: readonly MailFolderConfig[] = [
  { id: "favorites", label: "즐겨찾기", group: "standalone", box: "favorites" },
  { id: "inbox", label: "받은메일함", group: "mailbox", box: "inbox" },
  { id: "sent", label: "보낸메일함", group: "mailbox", box: "sent" },
  { id: "drafts", label: "임시보관함", group: "mailbox", box: "drafts" },
  { id: "scheduled", label: "예약메일함", group: "mailbox", box: "scheduled" },
  { id: "spam", label: "스팸메일함", group: "mailbox", box: "spam" },
  { id: "external", label: "외부메일함", group: "external" },
  { id: "trash", label: "휴지통", group: "trash", box: "trash" },
];

const defaultVisibleFolderIds = defaultMailFolders.map((folder) => folder.id);

function isMailBox(value: MailView): value is MailBox {
  return value === "favorites" || value === "inbox" || value === "sent" || value === "drafts" || value === "scheduled" || value === "spam" || value === "trash";
}

function formatMeta(message: MailMessage, box: MailBox) {
  const when = message.sentAt ?? message.updatedAt;
  const date = new Date(when);
  const label = Number.isNaN(date.getTime()) ? when : date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (box === "sent") return `${message.recipientName ?? "수신자 미지정"} · ${label}`;
  return `${message.senderName} · ${label}`;
}

function getFolderBadge(folder: MailFolderConfig, counts: { inbox: number; unread: number; sent: number; drafts: number; favorites: number; scheduled: number; spam: number; trash: number }) {
  if (folder.id === "favorites") return String(counts.favorites);
  if (folder.id === "inbox") return String(counts.inbox);
  if (folder.id === "sent") return String(counts.sent);
  if (folder.id === "drafts") return String(counts.drafts);
  if (folder.id === "scheduled") return String(counts.scheduled);
  if (folder.id === "spam") return String(counts.spam);
  if (folder.id === "trash") return String(counts.trash);
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

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function ensureReplySubject(subject: string) {
  return subject.trim().toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
}

function ensureForwardSubject(subject: string) {
  return subject.trim().toLowerCase().startsWith("fw:") ? subject : `Fw: ${subject}`;
}

function quotedMailBody(message: MailMessage) {
  const summary = stripHtml(message.body);
  return `<p></p><blockquote><p><strong>원문</strong> · ${message.senderName}</p><p>${summary || "본문 없음"}</p></blockquote>`;
}

const composeModeLabel: Record<MailComposeMode, string> = {
  new: "메일 작성",
  reply: "답장 작성",
  replyAll: "전체답장 작성",
  forward: "전달 작성",
};

function parseIdList(value: string) {
  return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)));
}

function parseTemplateVariables(value: string) {
  return Object.fromEntries(value.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    if (index < 0) return [line, ""];
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }).filter(([key]) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)));
}

function formatGrantCount(userIds?: string[], departmentIds?: string[]) {
  const users = userIds?.length ?? 0;
  const departments = departmentIds?.length ?? 0;
  if (!users && !departments) return "권한 지정 없음";
  return `사용자 ${users}명 · 부서 ${departments}개`;
}

function providerCheckStatusLabel(status: MailProviderSettings["dnsSpfStatus"]) {
  if (status === "verified") return "확인됨";
  if (status === "pending") return "확인 대기";
  if (status === "failed") return "확인 실패";
  return "미확인";
}

function providerSecretStatusLabel(status: MailProviderSettings["secretStatus"]) {
  if (status === "connected") return "secret 연결됨";
  if (status === "pending") return "secret 연결 대기";
  return "secret 미연결";
}

const mailRecipientSectionLabels = {
  internal: "전사 내 계정 메일",
  history: "발송/수신 이력이 있는 메일",
} as const;

function getRecipientSearchPrompt(query: string) {
  return query.trim() ? "검색 결과가 없습니다." : "이름, 이메일, 부서명을 입력하세요.";
}

function normalizeEmailInput(value: string) {
  return value.trim().replace(/^mailto:/i, "").toLowerCase();
}

function isValidEmailInput(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export function MailClient() {
  const [view, setView] = useState<MailView>("inbox");
  const [items, setItems] = useState<MailMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedBulkMessageIds, setSelectedBulkMessageIds] = useState<string[]>([]);
  const [composeMode, setComposeMode] = useState<MailComposeMode>("new");
  const [composeSourceMessageId, setComposeSourceMessageId] = useState<string | null>(null);
  const [composeDraftMessageId, setComposeDraftMessageId] = useState<string | null>(null);
  const [attachmentsByMessageId, setAttachmentsByMessageId] = useState<Record<string, MailAttachment[]>>({});
  const [counts, setCounts] = useState({ inbox: 0, unread: 0, sent: 0, drafts: 0, favorites: 0, scheduled: 0, spam: 0, trash: 0 });
  const [status, setStatus] = useState("메일함을 불러오는 중입니다.");
  const [mailSearchQuery, setMailSearchQuery] = useState("");
  const [mailReadFilter, setMailReadFilter] = useState<"all" | "read" | "unread">("all");
  const [mailImportanceFilter, setMailImportanceFilter] = useState<"all" | "important">("all");
  const [mailHasAttachmentFilter, setMailHasAttachmentFilter] = useState(false);
  const [mailDateFrom, setMailDateFrom] = useState("");
  const [mailDateTo, setMailDateTo] = useState("");
  const [recipients, setRecipients] = useState<MailRecipient[]>([]);
  const [addressBookRecipients, setAddressBookRecipients] = useState<MailRecipient[]>([]);
  const [addressBookQuery, setAddressBookQuery] = useState("");
  const [addressBookSourceFilter, setAddressBookSourceFilter] = useState<"all" | "internal" | "history" | "personal">("all");
  const [recipientLookup, setRecipientLookup] = useState<Record<string, MailRecipient>>({});
  const [recipientQuery, setRecipientQuery] = useState("");
  const [ccQuery, setCcQuery] = useState("");
  const [activeRecipientPopup, setActiveRecipientPopup] = useState<"to" | "cc" | null>(null);
  const [manualRecipientPopupTarget, setManualRecipientPopupTarget] = useState<"to" | "cc" | null>(null);
  const [activeRecentRecipientPopup, setActiveRecentRecipientPopup] = useState<"to" | "cc" | null>(null);
  const recipientPopupRef = useRef<HTMLDivElement | null>(null);
  const ccPopupRef = useRef<HTMLDivElement | null>(null);
  const [recipientUserIds, setRecipientUserIds] = useState<string[]>([]);
  const [ccUserIds, setCcUserIds] = useState<string[]>([]);
  const [externalRecipientEmails, setExternalRecipientEmails] = useState<MailExternalRecipient[]>([]);
  const [externalCcEmails, setExternalCcEmails] = useState<MailExternalRecipient[]>([]);
  const [addressBookRecipientUserIds, setAddressBookRecipientUserIds] = useState<string[]>([]);
  const [addressBookCcUserIds, setAddressBookCcUserIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("<p></p>");
  const [importance, setImportance] = useState<"normal" | "important">("normal");
  const [scheduledAtInput, setScheduledAtInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<MailPendingAttachment[]>([]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAttachmentDragOver, setIsAttachmentDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false);
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);
  const [mailAliases, setMailAliases] = useState<MailAccountAlias[]>([]);
  const [providerSettings, setProviderSettings] = useState<MailProviderSettings | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<MailDeliveryBatch[]>([]);
  const [deliveryHistoryCounts, setDeliveryHistoryCounts] = useState({ total: 0, sent: 0, failed: 0, blocked: 0, queued: 0 });
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateVariablesText, setTemplateVariablesText] = useState("user_name=홍길동\ncompany_name=We’reHere");
  const [selectedSenderValue, setSelectedSenderValue] = useState("");
  const [accountForm, setAccountForm] = useState({ accountType: "personal" as "personal" | "virtual", email: "", displayName: "", replyToEmail: "", providerKind: "unconfigured" as "unconfigured" | "smtp" | "api", providerName: "unconfigured", isDefault: false, allowedSenderUserIdsText: "", allowedSenderDepartmentIdsText: "" });
  const [aliasForm, setAliasForm] = useState({ mailAccountId: "", aliasEmail: "", displayName: "", isDefault: false, allowedSenderUserIdsText: "", allowedSenderDepartmentIdsText: "" });
  const [providerForm, setProviderForm] = useState({ providerKind: "unconfigured" as "unconfigured" | "smtp" | "api", providerName: "unconfigured", fromEmail: "", smtpHost: "", smtpPort: "587", smtpSecure: true, apiEndpoint: "", dnsSpfStatus: "not_checked" as MailProviderSettings["dnsSpfStatus"], dnsDkimStatus: "not_checked" as MailProviderSettings["dnsDkimStatus"], dnsDmarcStatus: "not_checked" as MailProviderSettings["dnsDmarcStatus"], secretStatus: "not_connected" as MailProviderSettings["secretStatus"], notes: "" });
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
  const visibleMessageIds = items.map((message) => message.id);
  const selectedBulkCount = selectedBulkMessageIds.length;
  const isAllVisibleMessagesSelected = visibleMessageIds.length > 0 && visibleMessageIds.every((messageId) => selectedBulkMessageIds.includes(messageId));
  const selectedMessage = items.find((message) => message.id === selectedMessageId) ?? items[0] ?? null;
  const selectedMessageIndex = selectedMessage ? items.findIndex((message) => message.id === selectedMessage.id) : -1;
  const previousMessage = selectedMessageIndex > 0 ? items[selectedMessageIndex - 1] : null;
  const nextMessage = selectedMessageIndex >= 0 && selectedMessageIndex < items.length - 1 ? items[selectedMessageIndex + 1] : null;
  const selectedMessageAttachments = selectedMessage ? attachmentsByMessageId[selectedMessage.id] ?? [] : [];
  const composeRecipientCount = recipientUserIds.length + externalRecipientEmails.length;
  const composeCcCount = ccUserIds.length + externalCcEmails.length;
  const composeAttachmentCount = pendingAttachments.length;
  const composeBodyTextLength = stripHtml(body).length;
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
  const addressBookFilteredRecipients = addressBookSourceFilter === "all"
    ? addressBookRecipients
    : addressBookSourceFilter === "personal"
      ? []
      : addressBookRecipients.filter((recipient) => recipient.sourceKind === addressBookSourceFilter);
  const addressBookSuggestionsBySource = {
    internal: addressBookFilteredRecipients.filter((recipient) => recipient.sourceKind === "internal"),
    history: addressBookFilteredRecipients.filter((recipient) => recipient.sourceKind === "history"),
  };
  const recentRecipients = addressBookRecipients.filter((recipient) => recipient.sourceKind === "history").slice(0, 8);
  const visibleRecentRecipientSuggestions = recentRecipients.length ? recentRecipients : addressBookRecipients.slice(0, 8);
  const isRecentRecipientPopupOpen = activeRecentRecipientPopup === "to";
  const isRecentCcPopupOpen = activeRecentRecipientPopup === "cc";
  const isRecipientPopupOpen = activeRecipientPopup === "to" && (recipientQuery.trim().length > 0 || visibleRecipientSuggestions.length > 0 || manualRecipientPopupTarget === "to");
  const isCcPopupOpen = activeRecipientPopup === "cc" && (ccQuery.trim().length > 0 || visibleCcSuggestions.length > 0 || manualRecipientPopupTarget === "cc");
  const attachmentItems: FeatureFileAttachmentItem[] = pendingAttachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    status: attachment.status,
    sizeLabel: attachment.sizeLabel,
    sourceLabel: attachment.sourceLabel,
    canDownload: Boolean(attachment.file || attachment.uploadedAttachmentId || attachment.documentFile),
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

  async function loadMailSettings() {
    const response = await fetch(appRoutes.mail.accounts, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "메일 통합설정을 불러오지 못했습니다.");
      return;
    }
    const parsed = mailIntegrationSettingsResponseSchema.parse(payload);
    setMailAccounts(parsed.data.accounts);
    setMailAliases(parsed.data.aliases);
    setAliasForm((current) => current.mailAccountId || !parsed.data.accounts[0] ? current : { ...current, mailAccountId: parsed.data.accounts[0].id });
    setSelectedSenderValue((current) => {
      if (current) return current;
      const defaultAlias = parsed.data.aliases.find((alias) => alias.isActive && alias.isDefault);
      if (defaultAlias) return `alias:${defaultAlias.id}`;
      const defaultAccount = parsed.data.accounts.find((account) => account.isActive && account.isDefault) ?? parsed.data.accounts.find((account) => account.isActive);
      return defaultAccount ? `account:${defaultAccount.id}` : "";
    });
    const providerResponse = await fetch(appRoutes.mail.providerSettings, { credentials: "same-origin" });
    const providerPayload = await providerResponse.json();
    if (providerResponse.ok) {
      const providerParsed = mailProviderSettingsResponseSchema.parse(providerPayload);
      const settings = providerParsed.data.settings;
      setProviderSettings(settings);
      setProviderForm({
        providerKind: settings.providerKind,
        providerName: settings.providerName,
        fromEmail: settings.fromEmail ?? "",
        smtpHost: settings.smtpHost ?? "",
        smtpPort: settings.smtpPort ? String(settings.smtpPort) : "587",
        smtpSecure: settings.smtpSecure,
        apiEndpoint: settings.apiEndpoint ?? "",
        dnsSpfStatus: settings.dnsSpfStatus,
        dnsDkimStatus: settings.dnsDkimStatus,
        dnsDmarcStatus: settings.dnsDmarcStatus,
        secretStatus: settings.secretStatus,
        notes: settings.notes ?? "",
      });
    }
    setStatus(`메일 통합설정 ${parsed.data.accounts.length}개 계정, ${parsed.data.aliases.length}개 별칭을 불러왔습니다.`);
  }

  async function loadDeliveryHistory() {
    setStatus("메일 발송 이력을 불러오는 중입니다.");
    const response = await fetch(appRoutes.mail.deliveryHistory, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setDeliveryHistory([]);
      setStatus(payload?.error?.message ?? "메일 발송 이력을 불러오지 못했습니다.");
      return;
    }
    const parsed = mailDeliveryHistoryResponseSchema.parse(payload);
    setDeliveryHistory(parsed.data.items);
    setDeliveryHistoryCounts(parsed.data.counts);
    setStatus(`메일 발송 이력 ${parsed.data.items.length}건을 불러왔습니다.`);
  }

  async function loadMailTemplates() {
    const response = await fetch(appRoutes.mail.templates, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setMailTemplates([]);
      setStatus(payload?.error?.message ?? "메일 템플릿을 불러오지 못했습니다.");
      return;
    }
    const parsed = mailTemplateListResponseSchema.parse(payload);
    setMailTemplates(parsed.data.items);
    setSelectedTemplateId((current) => {
      if (current) return current;
      return parsed.data.items.find((template: MailTemplate) => template.isActive)?.id ?? "";
    });
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
    const params = new URLSearchParams({ box: nextBox });
    const trimmedSearch = mailSearchQuery.trim();
    if (trimmedSearch) params.set("q", trimmedSearch);
    if (mailReadFilter !== "all") params.set("readState", mailReadFilter);
    if (mailImportanceFilter === "important") params.set("importance", "important");
    if (mailHasAttachmentFilter) params.set("hasAttachments", "true");
    if (mailDateFrom) params.set("dateFrom", mailDateFrom);
    if (mailDateTo) params.set("dateTo", mailDateTo);
    const response = await fetch(`${appRoutes.mail.messages}?${params.toString()}`, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setItems([]);
      setAttachmentsByMessageId({});
      setStatus(payload?.error?.message ?? "메일함을 불러오지 못했습니다.");
      return;
    }
    const parsed = mailMessageListResponseSchema.parse(payload);
    setItems(parsed.data.items);
    setSelectedBulkMessageIds((current) => current.filter((messageId) => parsed.data.items.some((message) => message.id === messageId)));
    setSelectedMessageId((current) => parsed.data.items.some((message) => message.id === current) ? current : parsed.data.items[0]?.id ?? null);
    setCounts(parsed.data.counts);
    await loadAttachments(parsed.data.items);
    setStatus(`${boxLabels[nextBox]} ${parsed.data.items.length}건을 불러왔습니다.`);
  }

  useEffect(() => {
    void loadDocumentFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "settings" || view === "compose") {
      void loadMailSettings();
    }
    if (view === "compose") {
      void loadMailTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (view === "compose") {
      void loadRecipients(recipientQuery || ccQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientQuery, ccQuery, view]);

  useEffect(() => {
    if (view === "deliveryHistory") {
      void loadDeliveryHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    function handleRecipientPopupPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (recipientPopupRef.current?.contains(target) || ccPopupRef.current?.contains(target)) {
        return;
      }
      setActiveRecipientPopup(null);
      setManualRecipientPopupTarget(null);
      setActiveRecentRecipientPopup(null);
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
      setStatus("");
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
  }, [view, mailSearchQuery, mailReadFilter, mailImportanceFilter, mailHasAttachmentFilter, mailDateFrom, mailDateTo]);

  function closeRecipientPopup() {
    setActiveRecipientPopup(null);
    setManualRecipientPopupTarget(null);
    setActiveRecentRecipientPopup(null);
  }

  function toggleBulkMessage(messageId: string) {
    setSelectedBulkMessageIds((current) => current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]);
  }

  function toggleAllVisibleMessages() {
    setSelectedBulkMessageIds(isAllVisibleMessagesSelected ? [] : visibleMessageIds);
  }

  async function runBulkAction(action: "markRead" | "markUnread" | "favorite" | "unfavorite" | "spam" | "trash" | "inbox" | "delete") {
    if (!currentBox || selectedBulkMessageIds.length === 0) return;
    const response = await fetch(appRoutes.mail.bulkAction, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ messageIds: selectedBulkMessageIds, action }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "선택한 메일을 처리하지 못했습니다.");
      return;
    }
    const parsed = mailMessageBulkActionResponseSchema.parse(payload);
    setStatus(`선택 메일 ${parsed.data.successCount}/${parsed.data.requestedCount}건을 처리했습니다.`);
    setSelectedBulkMessageIds([]);
    await loadMessages(currentBox);
  }

  function openNewCompose() {
    setComposeMode("new");
    setComposeSourceMessageId(null);
    setComposeDraftMessageId(null);
    setRecipientUserIds([]);
    setCcUserIds([]);
    setExternalRecipientEmails([]);
    setExternalCcEmails([]);
    setRecipientQuery("");
    setCcQuery("");
    setSubject("");
    setBody("<p></p>");
    setPendingAttachments([]);
    setView("compose");
  }

  function openComposeFromMessage(mode: Exclude<MailComposeMode, "new">, message: MailMessage) {
    setComposeMode(mode);
    setComposeSourceMessageId(message.id);
    setComposeDraftMessageId(null);
    setPendingAttachments([]);
    setCcUserIds([]);
    setExternalRecipientEmails([]);
    setExternalCcEmails([]);
    setCcQuery("");
    setRecipientQuery("");
    setRecipientUserIds(mode === "forward" || !message.senderUserId ? [] : [message.senderUserId]);
    setRecipientLookup((current) => ({
      ...current,
      ...(message.senderUserId ? { [message.senderUserId]: { userId: message.senderUserId, employeeId: null, displayName: message.senderName, email: message.senderName, departmentName: null, positionName: null, sourceKind: "history" as const } } : {}),
    }));
    setSubject(mode === "forward" ? ensureForwardSubject(message.subject) : ensureReplySubject(message.subject));
    setBody(quotedMailBody(message));
    setView("compose");
    setStatus(`${composeModeLabel[mode]} 화면을 열었습니다. Enter 입력은 줄바꿈/선택에만 쓰고 발송은 보내기 버튼으로 실행합니다.`);
  }

  function handleComposeKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".tox") || target.tagName === "TEXTAREA") {
      return;
    }
    if (target.tagName === "INPUT" || target.tagName === "BUTTON") {
      event.preventDefault();
    }
  }

  function openAddressBook(target: "to" | "cc") {
    setAddressBookRecipientUserIds(recipientUserIds);
    setAddressBookCcUserIds(ccUserIds);
    setAddressBookQuery("");
    setAddressBookSourceFilter("all");
    setActiveRecentRecipientPopup(null);
    setActiveRecipientPopup(target);
    setManualRecipientPopupTarget(target);
    void loadAddressBookRecipients("");
  }

  function openRecentRecipients(target: "to" | "cc") {
    setActiveRecipientPopup(null);
    setManualRecipientPopupTarget(null);
    setActiveRecentRecipientPopup((current) => current === target ? null : target);
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

  function addAddressBookGroup(recipientsToAdd: MailRecipient[], target: "to" | "cc") {
    setRecipientLookup((current) => ({ ...current, ...Object.fromEntries(recipientsToAdd.map((recipient) => [recipient.userId, recipient])) }));
    const setter = target === "to" ? setAddressBookRecipientUserIds : setAddressBookCcUserIds;
    setter((current) => Array.from(new Set([...current, ...recipientsToAdd.map((recipient) => recipient.userId)])));
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

  function removeRecipient(recipientId: string, target: MailRecipientTarget) {
    const setter = target === "to" ? setRecipientUserIds : setCcUserIds;
    setter((current) => current.filter((id) => id !== recipientId));
  }

  function addExternalEmailRecipient(rawEmail: string, target: MailRecipientTarget) {
    const email = normalizeEmailInput(rawEmail);
    if (!email) return false;
    if (!isValidEmailInput(email)) {
      setStatus("올바른 이메일 주소를 입력해주세요.");
      return false;
    }
    const selectedInternalEmails = [...selectedRecipients, ...selectedCcRecipients].map((recipient) => recipient.email.toLowerCase());
    const selectedExternalEmails = [...externalRecipientEmails, ...externalCcEmails].map((recipient) => recipient.email);
    if (selectedInternalEmails.includes(email) || selectedExternalEmails.includes(email)) {
      setStatus("이미 추가된 이메일입니다.");
      return false;
    }
    const setter = target === "to" ? setExternalRecipientEmails : setExternalCcEmails;
    setter((current) => [...current, { id: `${target}-${email}`, email }]);
    if (target === "to") setRecipientQuery("");
    else setCcQuery("");
    closeRecipientPopup();
    setStatus(`${email} 주소를 ${target === "to" ? "받는사람" : "참조"}에 추가했습니다. 외부 이메일 실제 발송은 다음 SMTP/API 연동 단계에서 연결합니다.`);
    return true;
  }

  function removeExternalEmailRecipient(email: string, target: MailRecipientTarget) {
    const setter = target === "to" ? setExternalRecipientEmails : setExternalCcEmails;
    setter((current) => current.filter((recipient) => recipient.email !== email));
  }

  function handleRecipientInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>, target: MailRecipientTarget) {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const query = target === "to" ? recipientQuery : ccQuery;
    const exactRecipient = findExactRecipientByQuery(query);
    if (exactRecipient) {
      addRecipient(exactRecipient, target);
      return;
    }
    addExternalEmailRecipient(query, target);
  }

  async function ensureComposeDraftMessage() {
    if (composeDraftMessageId) return composeDraftMessageId;
    const response = await fetch(appRoutes.mail.saveDraft, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ subject: subject || "(제목 없음)", body: body || "<p></p>", importance }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "첨부 업로드용 임시 메일을 만들지 못했습니다.");
    }
    const parsed = mailMessageDraftSaveResponseSchema.parse(payload);
    setComposeDraftMessageId(parsed.data.message.id);
    return parsed.data.message.id;
  }

  async function addPcFiles(files: File[], sourceLabel = "내 PC 파일첨부") {
    if (!files.length) return;
    const pendingItems = files.map((file, index) => ({
      id: `pc-${file.name}-${file.size}-${Date.now()}-${index}`,
      fileName: file.name,
      sizeLabel: formatFileSize(file.size),
      status: "업로드 중" as const,
      sourceLabel,
      file,
    }));
    setPendingAttachments((current) => [...current, ...pendingItems]);
    try {
      const draftMessageId = await ensureComposeDraftMessage();
      for (const pending of pendingItems) {
        const formData = new FormData();
        formData.append("file", pending.file);
        const response = await fetch(appRoutes.mail.attachments(draftMessageId), {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
          setPendingAttachments((current) => current.map((item) => item.id === pending.id ? { ...item, status: "실패" } : item));
          setStatus(payload?.error?.message ?? `${pending.fileName} 업로드에 실패했습니다.`);
          continue;
        }
        const uploaded = mailAttachmentUploadResponseSchema.parse(payload);
        setPendingAttachments((current) => current.map((item) => item.id === pending.id ? { ...item, status: "업로드 완료", uploadedAttachmentId: uploaded.data.attachment.id } : item));
      }
    } catch (error) {
      setPendingAttachments((current) => current.map((item) => pendingItems.some((pending) => pending.id === item.id) ? { ...item, status: "실패" } : item));
      setStatus(error instanceof Error ? error.message : "첨부 업로드에 실패했습니다.");
    }
  }

  function handlePcFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    void addPcFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  }

  function handleAttachmentDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setIsAttachmentDragOver(true);
    }
  }

  function handleAttachmentDragLeave(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsAttachmentDragOver(false);
    }
  }

  function handleAttachmentDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsAttachmentDragOver(false);
    void addPcFiles(Array.from(event.dataTransfer.files ?? []), "드래그앤드롭 파일첨부");
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
    if (pending?.file) {
      const objectUrl = URL.createObjectURL(pending.file);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = pending.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setStatus(`${pending.fileName} 다운로드를 시작했습니다.`);
      return;
    }
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
      const parsed = documentFileDownloadInitResponseSchema.parse(payload);
      if (parsed.data.action.downloadUrl) {
        window.location.href = parsed.data.action.downloadUrl;
        return;
      }
      setStatus(`${pending.documentFile.fileName} 다운로드 주소를 받지 못했습니다.`);
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

  async function applyTemplate() {
    if (!selectedTemplateId) {
      setStatus("적용할 메일 템플릿을 선택하세요.");
      return;
    }
    const response = await fetch(appRoutes.mail.renderTemplate(selectedTemplateId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ variables: parseTemplateVariables(templateVariablesText) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "템플릿 변수 검증에 실패했습니다.");
      return;
    }
    const parsed = mailTemplateRenderResponseSchema.parse(payload);
    setSubject(parsed.data.rendered.subject);
    setBody(parsed.data.rendered.body);
    setStatus("메일 템플릿 미리보기 결과를 본문에 적용했습니다.");
  }

  async function sendTemplateTestToMyself() {
    if (!selectedTemplateId) {
      setStatus("테스트 발송할 메일 템플릿을 선택하세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(appRoutes.mail.testSendTemplate(selectedTemplateId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          variables: parseTemplateVariables(templateVariablesText),
          senderMailAccountId: selectedSenderOption?.accountId || undefined,
          senderMailAliasId: selectedSenderOption?.aliasId || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "템플릿 테스트 메일을 보내지 못했습니다.");
        return;
      }
      const parsed = mailTemplateTestSendResponseSchema.parse(payload);
      setSubject(parsed.data.rendered.subject);
      setBody(parsed.data.rendered.body);
      await loadMessages("inbox");
      setView("inbox");
      setStatus(`내게 테스트 메일을 보냈습니다: ${parsed.data.message.subject}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function writeToMyself() {
    setRecipientUserIds(["user_company_admin"]);
    setCcUserIds([]);
    setExternalRecipientEmails([]);
    setExternalCcEmails([]);
    setStatus("내게쓰기 수신자를 총괄관리계정으로 지정했습니다.");
  }

  function findExactRecipientByQuery(query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;
    return [...recipients, ...addressBookRecipients].find((recipient) => (
      recipient.email.toLowerCase() === normalized
      || recipient.displayName.toLowerCase() === normalized
      || getRecipientLabel(recipient).toLowerCase() === normalized
    )) ?? null;
  }

  const senderAccountOptions = mailAccounts
    .filter((account) => account.isActive)
    .map((account) => ({
      value: `account:${account.id}`,
      label: `${account.displayName} <${account.email}>${account.accountType === "virtual" ? " · 가상메일" : " · 내 메일"}`,
      accountId: account.id,
      aliasId: "",
    }));
  const senderAliasOptions = mailAliases
    .filter((alias) => alias.isActive)
    .map((alias) => {
      const parent = mailAccounts.find((account) => account.id === alias.mailAccountId);
      return {
        value: `alias:${alias.id}`,
        label: `${alias.displayName} <${alias.aliasEmail}> · 별칭${parent ? ` (${parent.displayName})` : ""}`,
        accountId: alias.mailAccountId,
        aliasId: alias.id,
      };
    });
  const senderOptions = [...senderAccountOptions, ...senderAliasOptions];
  const selectedSenderOption = senderOptions.find((option) => option.value === selectedSenderValue);

  function buildRecipientUserIdsForSubmit() {
    const exactToRecipient = findExactRecipientByQuery(recipientQuery);
    const exactCcRecipient = findExactRecipientByQuery(ccQuery);
    const unresolvedInputs = [
      recipientQuery.trim() && !exactToRecipient ? recipientQuery.trim() : "",
      ccQuery.trim() && !exactCcRecipient ? ccQuery.trim() : "",
    ].filter(Boolean);

    if (unresolvedInputs.length) {
      setStatus("입력 중인 주소는 Enter로 먼저 등록하거나 검색 결과에서 선택해주세요.");
      return null;
    }

    if (externalRecipientEmails.length || externalCcEmails.length) {
      return Array.from(new Set([
        ...recipientUserIds,
        ...ccUserIds,
        ...(exactToRecipient ? [exactToRecipient.userId] : []),
        ...(exactCcRecipient ? [exactCcRecipient.userId] : []),
      ]));
    }

    return Array.from(new Set([
      ...recipientUserIds,
      ...ccUserIds,
      ...(exactToRecipient ? [exactToRecipient.userId] : []),
      ...(exactCcRecipient ? [exactCcRecipient.userId] : []),
    ]));
  }

  async function saveDraft() {
    setIsSubmitting(true);
    setStatus("임시보관함에 저장 중입니다.");
    try {
      const recipientIds = buildRecipientUserIdsForSubmit();
      if (!recipientIds) return;
      const response = await fetch(appRoutes.mail.saveDraft, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          recipientUserIds: recipientIds,
          senderMailAccountId: selectedSenderOption?.accountId || undefined,
          senderMailAliasId: selectedSenderOption?.aliasId || undefined,
          draftMessageId: composeDraftMessageId ?? undefined,
          subject,
          body,
          importance,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "임시저장에 실패했습니다.");
        return;
      }
      const parsed = mailMessageDraftSaveResponseSchema.parse(payload);
      setComposeDraftMessageId(parsed.data.message.id);
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
      const recipientIds = buildRecipientUserIdsForSubmit();
      if (!recipientIds || (recipientIds.length === 0 && externalRecipientEmails.length === 0 && externalCcEmails.length === 0)) {
        if (recipientIds) setStatus("받는사람을 검색 결과 또는 최근 주소에서 선택하거나 이메일 주소를 Enter로 등록해주세요.");
        return;
      }
      if (pendingAttachments.some((attachment) => attachment.status === "업로드 중")) {
        setStatus("첨부파일 업로드가 끝난 뒤 보낼 수 있습니다.");
        return;
      }
      if (pendingAttachments.some((attachment) => attachment.status === "실패")) {
        setStatus("실패한 첨부파일을 삭제하거나 다시 첨부해주세요.");
        return;
      }
      const response = await fetch(appRoutes.mail.send, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          recipientUserIds: recipientIds,
          externalToEmails: externalRecipientEmails.map((recipient) => recipient.email),
          externalCcEmails: externalCcEmails.map((recipient) => recipient.email),
          senderMailAccountId: selectedSenderOption?.accountId || undefined,
          senderMailAliasId: selectedSenderOption?.aliasId || undefined,
          sourceDraftMessageId: composeDraftMessageId ?? undefined,
          subject,
          body,
          importance,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "메일 발송에 실패했습니다.");
        return;
      }
      const parsed = mailMessageSendResponseSchema.parse(payload);
      const sentMessages = parsed.data.messages ?? [parsed.data.message];
      setPendingAttachments([]);
      setComposeDraftMessageId(null);
      setStatus(`메일 ${sentMessages.length}건이 보낸메일함에 반영됐습니다.`);
      setView("sent");
      await loadMessages("sent");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function scheduleMessage() {
    setIsSubmitting(true);
    setStatus("메일을 예약메일함에 저장 중입니다.");
    try {
      const recipientIds = buildRecipientUserIdsForSubmit();
      if (!recipientIds || (recipientIds.length === 0 && externalRecipientEmails.length === 0 && externalCcEmails.length === 0)) {
        if (recipientIds) setStatus("받는사람을 검색 결과 또는 최근 주소에서 선택하거나 이메일 주소를 Enter로 등록해주세요.");
        return;
      }
      if (!scheduledAtInput) {
        setStatus("예약 시간을 선택해주세요.");
        return;
      }
      const scheduledAt = new Date(scheduledAtInput);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        setStatus("예약 시간은 현재보다 이후여야 합니다.");
        return;
      }
      const response = await fetch(appRoutes.mail.schedule, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          recipientUserIds: recipientIds,
          externalToEmails: externalRecipientEmails.map((recipient) => recipient.email),
          externalCcEmails: externalCcEmails.map((recipient) => recipient.email),
          senderMailAccountId: selectedSenderOption?.accountId || undefined,
          senderMailAliasId: selectedSenderOption?.aliasId || undefined,
          sourceDraftMessageId: composeDraftMessageId ?? undefined,
          subject,
          body,
          importance,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "메일 예약에 실패했습니다.");
        return;
      }
      const parsed = mailMessageSendResponseSchema.parse(payload);
      const scheduledMessages = parsed.data.messages ?? [parsed.data.message];
      setPendingAttachments([]);
      setComposeDraftMessageId(null);
      setScheduledAtInput("");
      setStatus(`메일 ${scheduledMessages.length}건을 예약메일함에 저장했습니다.`);
      setView("scheduled");
      await loadMessages("scheduled");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function setReadState(messageId: string, isRead: boolean) {
    const response = await fetch(isRead ? appRoutes.mail.markRead(messageId) : appRoutes.mail.markUnread(messageId), { method: "POST", credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? (isRead ? "읽음 처리에 실패했습니다." : "안읽음 처리에 실패했습니다."));
      return;
    }
    mailMessageReadResponseSchema.parse(payload);
    setStatus(isRead ? "메일을 읽음 처리했습니다." : "메일을 안읽음 처리했습니다.");
    if (currentBox) await loadMessages(currentBox);
  }

  async function markRead(messageId: string) {
    await setReadState(messageId, true);
  }

  async function markUnread(messageId: string) {
    await setReadState(messageId, false);
  }

  async function moveMessage(messageId: string, target: "spam" | "trash" | "inbox" | "archive" | "cancel" | "delete") {
    const response = await fetch(appRoutes.mail.moveMessage(messageId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ target }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "메일함 이동에 실패했습니다.");
      return;
    }
    const parsed = mailMessageMoveResponseSchema.parse(payload);
    const nextBox = target === "spam" ? "spam" : target === "trash" ? "trash" : target === "delete" || target === "cancel" ? "scheduled" : "inbox";
    setSelectedMessageId(null);
    await loadMessages(nextBox);
    setView(nextBox);
    setStatus(target === "delete" ? "휴지통 메일을 완전 삭제했습니다." : `${boxLabels[nextBox]}으로 이동했습니다: ${parsed.data.message?.subject ?? "메일"}`);
  }

  async function toggleFavorite(message: MailMessage) {
    const nextFavorite = message.importance !== "important";
    const response = await fetch(appRoutes.mail.favoriteMessage(message.id), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ isFavorite: nextFavorite }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "즐겨찾기 변경에 실패했습니다.");
      return;
    }
    const parsed = mailMessageFavoriteResponseSchema.parse(payload);
    await loadMessages(currentBox ?? "inbox");
    setSelectedMessageId(parsed.data.message.id);
    setStatus(parsed.data.isFavorite ? "즐겨찾기에 추가했습니다." : "즐겨찾기에서 해제했습니다.");
  }

  async function createMailAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("메일 계정을 등록하는 중입니다.");
    const response = await fetch(appRoutes.mail.accounts, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        accountType: accountForm.accountType,
        email: accountForm.email,
        displayName: accountForm.displayName,
        replyToEmail: accountForm.replyToEmail || undefined,
        providerKind: accountForm.providerKind,
        providerName: accountForm.providerName || accountForm.providerKind,
        isDefault: accountForm.isDefault,
        allowedSenderUserIds: parseIdList(accountForm.allowedSenderUserIdsText),
        allowedSenderDepartmentIds: parseIdList(accountForm.allowedSenderDepartmentIdsText),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "메일 계정을 등록하지 못했습니다.");
      return;
    }
    setAccountForm({ accountType: "personal", email: "", displayName: "", replyToEmail: "", providerKind: "unconfigured", providerName: "unconfigured", isDefault: false, allowedSenderUserIdsText: "", allowedSenderDepartmentIdsText: "" });
    await loadMailSettings();
  }

  async function createMailAlias(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("별칭계정을 등록하는 중입니다.");
    const response = await fetch(appRoutes.mail.aliases, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(aliasForm),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "별칭계정을 등록하지 못했습니다.");
      return;
    }
    setAliasForm((current) => ({ mailAccountId: current.mailAccountId, aliasEmail: "", displayName: "", isDefault: false, allowedSenderUserIdsText: "", allowedSenderDepartmentIdsText: "" }));
    await loadMailSettings();
  }

  async function deleteMailAccount(accountId: string) {
    const response = await fetch(appRoutes.mail.account(accountId), { method: "DELETE", credentials: "same-origin" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "메일 계정을 삭제하지 못했습니다.");
      return;
    }
    await loadMailSettings();
  }

  async function deleteMailAlias(aliasId: string) {
    const response = await fetch(appRoutes.mail.alias(aliasId), { method: "DELETE", credentials: "same-origin" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "별칭계정을 삭제하지 못했습니다.");
      return;
    }
    await loadMailSettings();
  }

  async function saveProviderSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("메일 provider 설정 상태를 저장하는 중입니다.");
    const response = await fetch(appRoutes.mail.providerSettings, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        providerKind: providerForm.providerKind,
        providerName: providerForm.providerName || providerForm.providerKind,
        fromEmail: providerForm.fromEmail || null,
        smtpHost: providerForm.providerKind === "smtp" ? providerForm.smtpHost || null : null,
        smtpPort: providerForm.providerKind === "smtp" && providerForm.smtpPort ? Number(providerForm.smtpPort) : null,
        smtpSecure: providerForm.smtpSecure,
        apiEndpoint: providerForm.providerKind === "api" ? providerForm.apiEndpoint || null : null,
        dnsSpfStatus: providerForm.dnsSpfStatus,
        dnsDkimStatus: providerForm.dnsDkimStatus,
        dnsDmarcStatus: providerForm.dnsDmarcStatus,
        secretStatus: providerForm.secretStatus,
        notes: providerForm.notes || null,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(payload?.error?.message ?? "메일 provider 설정을 저장하지 못했습니다.");
      return;
    }
    const parsed = mailProviderSettingsResponseSchema.parse(payload);
    setProviderSettings(parsed.data.settings);
    setStatus(parsed.data.settings.readiness.canSendExternally ? "메일 provider 설정 준비 상태가 완료로 저장됐습니다." : "메일 provider 준비 상태를 저장했습니다. 실제 secret/DNS/발송은 별도 승인 후 연결합니다.");
  }

  function renderFolderButton(folder: MailFolderConfig, nested = false, hideNestedMarker = false) {
    const selected = view === folder.id;
    const badge = getFolderBadge(folder, counts);
    const className = nested
      ? `mail-folder-list__item mail-folder-list__item--child${hideNestedMarker ? " mail-folder-list__item--child-flat" : ""}`
      : "mail-folder-list__item";
    return (
      <button
        aria-selected={selected}
        className={className}
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

  function renderRecentRecipientPopover(target: "to" | "cc") {
    return (
      <div className="mail-recipient-suggestions mail-recipient-suggestions--recent" role="listbox" aria-label={`${target === "to" ? "받는사람" : "참조"} 최근 사용 주소`}>
        <section className="mail-recipient-suggestion-section" aria-label="최근 사용한 주소">
          <strong>최근 사용한 주소</strong>
          {visibleRecentRecipientSuggestions.length ? visibleRecentRecipientSuggestions.map((recipient) => (
            <button key={`recent-${target}-${recipient.userId}`} type="button" role="option" onClick={() => addRecipient(recipient, target)}>{getRecipientLabel(recipient)}</button>
          )) : <span>최근 사용한 주소가 없습니다.</span>}
        </section>
      </div>
    );
  }

  function renderAddressBookPopover(input: {
    target: "to" | "cc";
    groups: { internal: MailRecipient[]; history: MailRecipient[] };
  }) {
    const orderedGroups: Array<keyof typeof mailRecipientSectionLabels> = ["internal", "history"];
    const hasResults = orderedGroups.some((sourceKind) => input.groups[sourceKind].length > 0);
    return (
      <>
        <button className="mail-address-book-backdrop" type="button" aria-label="주소록 바깥 영역 닫기" onClick={closeRecipientPopup} />
        <section className="mail-address-book-popover" role="dialog" aria-modal="true" aria-label="주소록 선택 팝업">
        <div className="mail-address-book-popover__header">
          <strong>주소록</strong>
          <span>{input.target === "to" ? "기본 추가 대상: 받는사람" : "기본 추가 대상: 참조"}</span>
          <button type="button" aria-label="주소록 닫기" onClick={closeRecipientPopup}>×</button>
        </div>
        <div className="mail-address-book-popover__body">
          <nav className="mail-address-book-popover__groups" aria-label="주소록 그룹">
            <strong>주소록 그룹</strong>
            <button aria-pressed={addressBookSourceFilter === "all"} type="button" onClick={() => setAddressBookSourceFilter("all")}>전체 주소록</button>
            <button aria-pressed={addressBookSourceFilter === "internal"} type="button" onClick={() => setAddressBookSourceFilter("internal")}>전사 계정</button>
            <button aria-pressed={addressBookSourceFilter === "history"} type="button" onClick={() => setAddressBookSourceFilter("history")}>발송/수신 이력</button>
            <button aria-pressed={addressBookSourceFilter === "personal"} type="button" onClick={() => setAddressBookSourceFilter("personal")}>개인 주소록</button>
          </nav>
          <section className="mail-address-book-popover__list" aria-label="주소 목록">
            <input className="field" aria-label="주소록 검색" value={addressBookQuery} onChange={(event) => { setAddressBookQuery(event.target.value); void loadAddressBookRecipients(event.target.value); }} />
            <div className="mail-address-book-table" role="listbox" aria-label="주소록 검색 결과">
              {hasResults ? orderedGroups.map((sourceKind) => {
                const groupItems = input.groups[sourceKind];
                if (!groupItems.length) return null;
                return (
                  <section className="mail-address-book-table__section" key={sourceKind} aria-label={mailRecipientSectionLabels[sourceKind]}>
                    <div className="mail-address-book-table__section-header">
                      <strong>{mailRecipientSectionLabels[sourceKind]}</strong>
                      <span>{groupItems.length}명</span>
                      <button type="button" onClick={() => addAddressBookGroup(groupItems, "to")}>그룹 받는사람 추가</button>
                      <button type="button" onClick={() => addAddressBookGroup(groupItems, "cc")}>그룹 참조 추가</button>
                    </div>
                    {groupItems.map((recipient) => (
                      <div className="mail-address-book-table__row" key={`${sourceKind}-${recipient.userId}`} role="option" aria-selected={addressBookRecipientUserIds.includes(recipient.userId) || addressBookCcUserIds.includes(recipient.userId)}>
                        <span>{recipient.displayName}</span>
                        <span>{recipient.positionName ?? "-"}</span>
                        <span>{recipient.departmentName ?? "-"}</span>
                        <span>{recipient.email}</span>
                        <button type="button" aria-pressed={addressBookRecipientUserIds.includes(recipient.userId)} onClick={() => addAddressBookRecipient(recipient, "to")}>받는사람</button>
                        <button type="button" aria-pressed={addressBookCcUserIds.includes(recipient.userId)} onClick={() => addAddressBookRecipient(recipient, "cc")}>참조</button>
                      </div>
                    ))}
                  </section>
                );
              }) : <span className="mail-address-book-table__empty">{addressBookQuery.trim() ? "검색 결과가 없습니다." : "주소록에 표시할 주소가 없습니다."}</span>}
            </div>
          </section>
          <aside className="mail-address-book-popover__selected" aria-label="선택한 주소">
            <div className="mail-address-book-selected-summary">
              <strong>선택 요약</strong>
              <span>받는사람 {addressBookSelectedRecipients.length}명 · 참조 {addressBookSelectedCcRecipients.length}명</span>
              <button type="button" onClick={() => { setAddressBookRecipientUserIds([]); setAddressBookCcUserIds([]); }}>선택 비우기</button>
            </div>
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
      </>
    );
  }

  function renderDeliveryHistory() {
    return (
      <section className="mail-delivery-history" aria-label="메일 발송 이력">
        <div className="mail-settings-guide">
          <strong>메일 발송 이력</strong>
          <span>발송 요청 단위와 수신자별 상태를 분리해 저장합니다. 예약·재시도·큐·SMTP/API 실제 발송은 이 구조 위에서 확장합니다.</span>
          <span>전체 {deliveryHistoryCounts.total}건 · 성공 {deliveryHistoryCounts.sent}건 · 실패 {deliveryHistoryCounts.failed}건 · 차단 {deliveryHistoryCounts.blocked}건 · 대기 {deliveryHistoryCounts.queued}건</span>
        </div>
        <div className="feature-workspace__rows" data-mail-delivery-history="batch-recipient-status">
          {deliveryHistory.length ? deliveryHistory.map((batch) => (
            <article className="feature-workspace__row" key={batch.id}>
              <div>
                <strong>{batch.subject}</strong>
                <span>{batch.senderDisplayName ?? batch.senderName} · {batch.emailType} · {batch.deliveryMode} · 수신자 {batch.recipientCount}명</span>
                <span>상태: {batch.status} · 성공 {batch.successCount} · 실패 {batch.failedCount} · 차단 {batch.blockedCount}</span>
                <span>수신자별 상태: {batch.recipients.map((recipient) => `${recipient.recipientEmail} ${recipient.status}`).join(" / ") || "기록 없음"}</span>
              </div>
              <em>{batch.providerKind === "unconfigured" ? "provider 미연결" : batch.providerName}</em>
            </article>
          )) : (
            <article className="feature-workspace__row"><div><strong>발송 이력이 없습니다.</strong><span>메일 발송 후 batch와 수신자별 상태가 여기에 표시됩니다.</span></div><em>비어 있음</em></article>
          )}
        </div>
      </section>
    );
  }

  function renderMailIntegrationSettings() {
    return (
      <div className="mail-integration-settings" aria-label="메일 통합설정">
        <section className="mail-settings-guide" aria-label="가상메일과 별칭계정 기준">
          <strong>메일 통합설정 1차</strong>
          <span>가상메일은 세금계산서 수취 전용메일처럼 실제 사람이 아니라 업무 목적 주소입니다. 별칭계정은 이미 등록된 내 메일/가상메일에 붙는 다른 이름 주소입니다.</span>
          <span>SMTP/API provider는 미연결 상태로 저장하고, secret과 DNS 인증은 다음 단계에서 별도 연결합니다.</span>
        </section>

        <form className="mail-settings-card mail-settings-card--provider" onSubmit={saveProviderSettings} aria-label="SMTP API provider 준비 상태">
          <strong>SMTP/API provider 준비 상태</strong>
          <span>비밀번호/API key 값은 저장하지 않고, 발신 provider 종류와 DNS·secret 연결 상태만 기록합니다.</span>
          <div className="mail-settings-grid mail-settings-grid--provider">
            <label>Provider 방식
              <select className="field" value={providerForm.providerKind} onChange={(event) => setProviderForm((current) => ({ ...current, providerKind: event.target.value as "unconfigured" | "smtp" | "api", providerName: event.target.value }))}>
                <option value="unconfigured">미연결</option>
                <option value="smtp">SMTP</option>
                <option value="api">API</option>
              </select>
            </label>
            <label>Provider 이름
              <input className="field" value={providerForm.providerName} onChange={(event) => setProviderForm((current) => ({ ...current, providerName: event.target.value }))} />
            </label>
            <label>기본 발신 주소
              <input className="field" type="email" value={providerForm.fromEmail} onChange={(event) => setProviderForm((current) => ({ ...current, fromEmail: event.target.value }))} />
            </label>
            <label>SMTP host
              <input className="field" value={providerForm.smtpHost} onChange={(event) => setProviderForm((current) => ({ ...current, smtpHost: event.target.value }))} />
            </label>
            <label>SMTP port
              <input className="field" inputMode="numeric" value={providerForm.smtpPort} onChange={(event) => setProviderForm((current) => ({ ...current, smtpPort: event.target.value }))} />
            </label>
            <label>API endpoint
              <input className="field" value={providerForm.apiEndpoint} onChange={(event) => setProviderForm((current) => ({ ...current, apiEndpoint: event.target.value }))} />
            </label>
            <label>SPF 상태
              <select className="field" value={providerForm.dnsSpfStatus} onChange={(event) => setProviderForm((current) => ({ ...current, dnsSpfStatus: event.target.value as MailProviderSettings["dnsSpfStatus"] }))}>
                <option value="not_checked">미확인</option><option value="pending">확인 대기</option><option value="verified">확인됨</option><option value="failed">확인 실패</option>
              </select>
            </label>
            <label>DKIM 상태
              <select className="field" value={providerForm.dnsDkimStatus} onChange={(event) => setProviderForm((current) => ({ ...current, dnsDkimStatus: event.target.value as MailProviderSettings["dnsDkimStatus"] }))}>
                <option value="not_checked">미확인</option><option value="pending">확인 대기</option><option value="verified">확인됨</option><option value="failed">확인 실패</option>
              </select>
            </label>
            <label>DMARC 상태
              <select className="field" value={providerForm.dnsDmarcStatus} onChange={(event) => setProviderForm((current) => ({ ...current, dnsDmarcStatus: event.target.value as MailProviderSettings["dnsDmarcStatus"] }))}>
                <option value="not_checked">미확인</option><option value="pending">확인 대기</option><option value="verified">확인됨</option><option value="failed">확인 실패</option>
              </select>
            </label>
            <label>Secret 연결 상태
              <select className="field" value={providerForm.secretStatus} onChange={(event) => setProviderForm((current) => ({ ...current, secretStatus: event.target.value as MailProviderSettings["secretStatus"] }))}>
                <option value="not_connected">미연결</option><option value="pending">연결 대기</option><option value="connected">연결됨</option>
              </select>
            </label>
            <label className="mail-settings-checkbox"><input type="checkbox" checked={providerForm.smtpSecure} onChange={(event) => setProviderForm((current) => ({ ...current, smtpSecure: event.target.checked }))} /> SMTP 보안 연결 사용</label>
            <label>운영 메모
              <textarea className="field" value={providerForm.notes} onChange={(event) => setProviderForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <div className="mail-settings-row mail-settings-row--readiness">
            <div><strong>외부 발송 준비도</strong><span>Provider {providerSettings?.readiness.hasProvider ? "확인" : "미확인"} · 발신주소 {providerSettings?.readiness.hasSender ? "확인" : "미확인"} · 서버/API {providerSettings?.readiness.hasHostOrEndpoint ? "확인" : "미확인"} · {providerSecretStatusLabel(providerSettings?.secretStatus ?? "not_connected")} · DNS SPF {providerCheckStatusLabel(providerSettings?.dnsSpfStatus ?? "not_checked")} / DKIM {providerCheckStatusLabel(providerSettings?.dnsDkimStatus ?? "not_checked")} / DMARC {providerCheckStatusLabel(providerSettings?.dnsDmarcStatus ?? "not_checked")}</span></div>
            <em>{providerSettings?.readiness.canSendExternally ? "발송 준비 완료" : "실제 발송 미연결"}</em>
          </div>
          <div className="mail-settings-actions"><button className="mail-compose-toolbar-button mail-compose-toolbar-button--primary" type="submit">Provider 상태 저장</button></div>
        </form>

        <div className="mail-settings-grid">
          <form className="mail-settings-card" onSubmit={createMailAccount} aria-label="내 메일 또는 가상메일 등록">
            <strong>내 메일 · 가상메일 등록</strong>
            <label>구분
              <select className="field" value={accountForm.accountType} onChange={(event) => setAccountForm((current) => ({ ...current, accountType: event.target.value as "personal" | "virtual" }))}>
                <option value="personal">내 메일</option>
                <option value="virtual">가상메일</option>
              </select>
            </label>
            <label>메일 주소
              <input className="field" type="email" required value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label>표시 이름
              <input className="field" required value={accountForm.displayName} onChange={(event) => setAccountForm((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label>회신 주소
              <input className="field" type="email" value={accountForm.replyToEmail} onChange={(event) => setAccountForm((current) => ({ ...current, replyToEmail: event.target.value }))} />
            </label>
            <label>Provider
              <select className="field" value={accountForm.providerKind} onChange={(event) => setAccountForm((current) => ({ ...current, providerKind: event.target.value as "unconfigured" | "smtp" | "api", providerName: event.target.value }))}>
                <option value="unconfigured">미연결</option>
                <option value="smtp">SMTP</option>
                <option value="api">API</option>
              </select>
            </label>
            <label className="mail-settings-checkbox"><input type="checkbox" checked={accountForm.isDefault} onChange={(event) => setAccountForm((current) => ({ ...current, isDefault: event.target.checked }))} /> 기본 발신으로 사용</label>
            <label>발신 허용 사용자 ID
              <input className="field" value={accountForm.allowedSenderUserIdsText} onChange={(event) => setAccountForm((current) => ({ ...current, allowedSenderUserIdsText: event.target.value }))} />
            </label>
            <label>발신 허용 부서 ID
              <input className="field" value={accountForm.allowedSenderDepartmentIdsText} onChange={(event) => setAccountForm((current) => ({ ...current, allowedSenderDepartmentIdsText: event.target.value }))} />
            </label>
            <div className="mail-settings-actions"><button className="mail-compose-toolbar-button mail-compose-toolbar-button--primary" type="submit">등록</button></div>
          </form>

          <form className="mail-settings-card" onSubmit={createMailAlias} aria-label="별칭계정 등록">
            <strong>별칭계정 등록</strong>
            <label>연결할 계정
              <select className="field" required value={aliasForm.mailAccountId} onChange={(event) => setAliasForm((current) => ({ ...current, mailAccountId: event.target.value }))}>
                <option value="">계정 선택</option>
                {mailAccounts.map((account) => <option key={account.id} value={account.id}>{account.displayName} &lt;{account.email}&gt;</option>)}
              </select>
            </label>
            <label>별칭 이메일
              <input className="field" type="email" required value={aliasForm.aliasEmail} onChange={(event) => setAliasForm((current) => ({ ...current, aliasEmail: event.target.value }))} />
            </label>
            <label>표시 이름
              <input className="field" required value={aliasForm.displayName} onChange={(event) => setAliasForm((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label className="mail-settings-checkbox"><input type="checkbox" checked={aliasForm.isDefault} onChange={(event) => setAliasForm((current) => ({ ...current, isDefault: event.target.checked }))} /> 이 계정의 기본 별칭</label>
            <label>별칭 발신 허용 사용자 ID
              <input className="field" value={aliasForm.allowedSenderUserIdsText} onChange={(event) => setAliasForm((current) => ({ ...current, allowedSenderUserIdsText: event.target.value }))} />
            </label>
            <label>별칭 발신 허용 부서 ID
              <input className="field" value={aliasForm.allowedSenderDepartmentIdsText} onChange={(event) => setAliasForm((current) => ({ ...current, allowedSenderDepartmentIdsText: event.target.value }))} />
            </label>
            <div className="mail-settings-actions"><button className="mail-compose-toolbar-button mail-compose-toolbar-button--primary" type="submit">별칭 등록</button></div>
          </form>
        </div>

        <section className="mail-settings-card mail-settings-card--list" aria-label="등록된 메일 계정">
          <strong>등록된 메일 계정</strong>
          {mailAccounts.length ? mailAccounts.map((account) => (
            <article className="mail-settings-row" key={account.id}>
              <div><strong>{account.displayName}</strong><span>{account.email} · {account.accountType === "virtual" ? "가상메일" : "내 메일"} · {account.providerKind === "unconfigured" ? "발송연동 미연결" : account.providerKind.toUpperCase()} · {formatGrantCount(account.allowedSenderUserIds, account.allowedSenderDepartmentIds)}</span></div>
              <em>{account.isDefault ? "기본" : account.isActive ? "활성" : "비활성"}</em>
              <button className="mail-compose-toolbar-button" type="button" onClick={() => void deleteMailAccount(account.id)}>삭제</button>
            </article>
          )) : <span>등록된 메일 계정이 없습니다.</span>}
        </section>

        <section className="mail-settings-card mail-settings-card--list" aria-label="등록된 별칭계정">
          <strong>등록된 별칭계정</strong>
          {mailAliases.length ? mailAliases.map((alias) => {
            const account = mailAccounts.find((item) => item.id === alias.mailAccountId);
            return (
              <article className="mail-settings-row" key={alias.id}>
                <div><strong>{alias.displayName}</strong><span>{alias.aliasEmail} → {account?.email ?? "연결 계정"} · {formatGrantCount(alias.allowedSenderUserIds, alias.allowedSenderDepartmentIds)}</span></div>
                <em>{alias.isDefault ? "기본" : alias.isActive ? "활성" : "비활성"}</em>
                <button className="mail-compose-toolbar-button" type="button" onClick={() => void deleteMailAlias(alias.id)}>삭제</button>
              </article>
            );
          }) : <span>등록된 별칭계정이 없습니다.</span>}
        </section>
      </div>
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
          <button className="board-write-button mail-write-button" type="button" onClick={openNewCompose}>메일쓰기</button>
        ) : null}
        <button className="mail-settings-nav-button" aria-pressed={view === "settings"} type="button" onClick={() => setView("settings")}>통합설정</button>
        <button className="mail-settings-nav-button" aria-pressed={view === "deliveryHistory"} type="button" onClick={() => setView("deliveryHistory")}>발송 이력</button>
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
          {externalFolders.map((folder) => renderFolderButton(folder, true, true))}
          {trashFolders.map((folder) => renderFolderButton(folder, true, true))}
        </div>
        {renderFolderEditor()}
      </aside>

      <section className="feature-workspace__panel" aria-labelledby="mail-panel-heading">
        <div className="feature-workspace__panel-header">
          <div>
            <h2 id="mail-panel-heading">{view === "settings" ? "메일 통합설정" : view === "deliveryHistory" ? "메일 발송 이력" : view === "compose" ? composeModeLabel[composeMode] : currentBox ? boxLabels[currentBox] : currentFolder?.label ?? "메일"}</h2>
          </div>
        </div>
        <p className="feature-workspace__panel-status" role="status">{status}</p>

        {view === "settings" ? (
          renderMailIntegrationSettings()
        ) : view === "deliveryHistory" ? (
          renderDeliveryHistory()
        ) : view === "compose" ? (
          <form className="mail-compose-form" onSubmit={sendMessage} onKeyDown={handleComposeKeyDown} data-compose-mode={composeMode} data-source-message-id={composeSourceMessageId ?? undefined}>
            <div className="mail-compose-toolbar" aria-label="메일 작성 작업">
              <button className="mail-compose-toolbar-button mail-compose-toolbar-button--primary mail-compose-send-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? "처리 중" : "보내기"}
              </button>
              <button className="mail-compose-toolbar-button" disabled type="button" title="예약 발송 API는 일정 엔진 확정 뒤 연결합니다.">예약발송</button>
              <button className="mail-compose-toolbar-button" disabled={isSubmitting} type="button" onClick={() => void saveDraft()}>임시저장</button>
              <button className="mail-compose-toolbar-button" type="button" onClick={() => setIsPreviewOpen((value) => !value)}>미리보기</button>
              <button className="mail-compose-toolbar-button" type="button" onClick={() => void applyTemplate()}>템플릿 적용</button>
              <button className="mail-compose-toolbar-button" disabled={isSubmitting} type="button" onClick={() => void sendTemplateTestToMyself()}>내게 테스트 발송</button>
              <button className="mail-compose-toolbar-button" type="button" onClick={writeToMyself}>내게쓰기</button>
            </div>
            <section className="mail-compose-readiness" aria-label="메일 작성 상태 요약">
              <span>받는사람 {composeRecipientCount}명</span>
              <span>참조 {composeCcCount}명</span>
              <span>첨부 {composeAttachmentCount}개</span>
              <span>본문 {composeBodyTextLength}자</span>
              <strong>{composeRecipientCount > 0 && subject.trim() && composeBodyTextLength > 0 ? "전송 준비됨" : "필수 입력 확인"}</strong>
            </section>

            <div className="mail-compose-row mail-compose-row--sender">
              <strong>보낸사람</strong>
              <select className="field" aria-label="보낸사람 계정" value={selectedSenderValue} onChange={(event) => setSelectedSenderValue(event.target.value)}>
                <option value="">기본 사용자 계정</option>
                {senderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <span className="mail-sender-status">{selectedSenderOption ? "SMTP/API 연결 전까지 발신주소 선택값만 저장됩니다." : "통합설정에 등록한 내 메일·가상메일·별칭을 선택할 수 있습니다."}</span>
            </div>

            <div className="mail-compose-row mail-compose-row--template" data-mail-template-variable-render="required-variables">
              <strong>템플릿</strong>
              <select className="field" aria-label="메일 템플릿 선택" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                <option value="">템플릿 선택</option>
                {mailTemplates.filter((template) => template.isActive).map((template) => <option key={template.id} value={template.id}>{template.templateName} · {template.templateCode}</option>)}
              </select>
              <textarea className="field" aria-label="템플릿 변수 입력" value={templateVariablesText} onChange={(event) => setTemplateVariablesText(event.target.value)} />
              <span className="mail-sender-status">key=value 줄 단위로 입력합니다. 누락 변수는 발송 전 미리보기 API에서 차단합니다.</span>
            </div>

            <div className="mail-compose-row mail-compose-row--recipients">
              <strong>받는사람</strong>
              <div className="mail-recipient-combobox" aria-label="받는사람 입력" ref={recipientPopupRef}>
                <div className="mail-recipient-input-line">
                  <div className="mail-recipient-input-shell">
                    <input className="field" aria-label="받는사람 이메일 또는 이름" value={recipientQuery} onKeyDown={(event) => handleRecipientInputKeyDown(event, "to")} onChange={(event) => { setRecipientQuery(event.target.value); setActiveRecipientPopup("to"); setManualRecipientPopupTarget(null); setActiveRecentRecipientPopup(null); }} />
                    <button className="mail-recipient-recent-button" aria-expanded={isRecentRecipientPopupOpen} aria-label="받는사람 최근 사용 주소" type="button" onClick={() => openRecentRecipients("to")}>∨</button>
                  </div>
                  <button className="mail-address-book-button" type="button" onClick={() => openAddressBook("to")}>주소록</button>
                </div>
                {selectedRecipients.length || externalRecipientEmails.length ? (
                  <div className="mail-recipient-chip-list" aria-label="선택된 받는사람">
                    {selectedRecipients.map((recipient) => (
                      <button key={recipient.userId} type="button" onClick={() => removeRecipient(recipient.userId, "to")}>{recipient.displayName} &lt;{recipient.email}&gt; ×</button>
                    ))}
                    {externalRecipientEmails.map((recipient) => (
                      <button key={recipient.id} type="button" onClick={() => removeExternalEmailRecipient(recipient.email, "to")}>{recipient.email} ×</button>
                    ))}
                  </div>
                ) : null}
                {isRecentRecipientPopupOpen ? renderRecentRecipientPopover("to") : null}
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
                  <div className="mail-recipient-input-shell">
                    <input className="field" aria-label="참조 이메일 또는 이름" value={ccQuery} onKeyDown={(event) => handleRecipientInputKeyDown(event, "cc")} onChange={(event) => { setCcQuery(event.target.value); setActiveRecipientPopup("cc"); setManualRecipientPopupTarget(null); setActiveRecentRecipientPopup(null); }} />
                    <button className="mail-recipient-recent-button" aria-expanded={isRecentCcPopupOpen} aria-label="참조 최근 사용 주소" type="button" onClick={() => openRecentRecipients("cc")}>∨</button>
                  </div>
                  <button className="mail-address-book-button" type="button" onClick={() => openAddressBook("cc")}>주소록</button>
                </div>
                {selectedCcRecipients.length || externalCcEmails.length ? (
                  <div className="mail-recipient-chip-list" aria-label="선택된 참조">
                    {selectedCcRecipients.map((recipient) => (
                      <button key={recipient.userId} type="button" onClick={() => removeRecipient(recipient.userId, "cc")}>{recipient.displayName} &lt;{recipient.email}&gt; ×</button>
                    ))}
                    {externalCcEmails.map((recipient) => (
                      <button key={recipient.id} type="button" onClick={() => removeExternalEmailRecipient(recipient.email, "cc")}>{recipient.email} ×</button>
                    ))}
                  </div>
                ) : null}
                {isRecentCcPopupOpen ? renderRecentRecipientPopover("cc") : null}
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
              <input className="field" aria-label="제목" required value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>

            <label className="mail-compose-row mail-compose-row--schedule" data-mail-scheduled-send="internal-ready">
              <strong>예약시간</strong>
              <input className="field" aria-label="예약 발송 시간" type="datetime-local" value={scheduledAtInput} onChange={(event) => setScheduledAtInput(event.target.value)} />
              <span className="mail-sender-status">예약메일함에 저장되며 실제 자동 발송 worker는 SMTP/API 연결 뒤 붙입니다.</span>
            </label>

            <section
              className={`mail-compose-attachments${isAttachmentDragOver ? " mail-compose-attachments--drag-over" : ""}`}
              aria-label="파일첨부"
              onDragOver={handleAttachmentDragOver}
              onDragLeave={handleAttachmentDragLeave}
              onDrop={handleAttachmentDrop}
            >
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
              <span className="mail-compose-attachments__drop-hint">파일을 이 박스에 끌어다 놓아 첨부할 수 있습니다.</span>
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
              <section className="mail-compose-review" aria-label="메일 미리보기">
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
          <div className="mail-detail-layout">
            <section className="mail-search-filter-bar" aria-label="메일 검색 및 필터">
              <label>메일 검색
                <input className="field" aria-label="메일 검색" value={mailSearchQuery} onChange={(event) => setMailSearchQuery(event.target.value)} />
                <span>제목, 본문, 보낸사람, 받는사람</span>
              </label>
              <label>읽음 상태
                <select className="field" aria-label="읽음 상태 필터" value={mailReadFilter} onChange={(event) => setMailReadFilter(event.target.value as "all" | "read" | "unread")}>
                  <option value="all">전체</option>
                  <option value="unread">읽지 않음</option>
                  <option value="read">읽음</option>
                </select>
              </label>
              <label>중요
                <select className="field" aria-label="중요 필터" value={mailImportanceFilter} onChange={(event) => setMailImportanceFilter(event.target.value as "all" | "important")}>
                  <option value="all">전체</option>
                  <option value="important">중요만</option>
                </select>
              </label>
              <label>시작일
                <input className="field" aria-label="메일 검색 시작일" type="date" value={mailDateFrom} onChange={(event) => setMailDateFrom(event.target.value)} />
              </label>
              <label>종료일
                <input className="field" aria-label="메일 검색 종료일" type="date" value={mailDateTo} onChange={(event) => setMailDateTo(event.target.value)} />
              </label>
              <label className="mail-search-filter-bar__checkbox">
                <input checked={mailHasAttachmentFilter} type="checkbox" onChange={(event) => setMailHasAttachmentFilter(event.target.checked)} />
                <span>첨부 있음</span>
              </label>
              <button className="mail-compose-toolbar-button" type="button" onClick={() => { setMailSearchQuery(""); setMailReadFilter("all"); setMailImportanceFilter("all"); setMailHasAttachmentFilter(false); setMailDateFrom(""); setMailDateTo(""); }}>검색 초기화</button>
            </section>
            <section className="mail-bulk-action-bar" aria-label="메일 다중 선택 작업">
              <label className="mail-bulk-action-bar__select-all">
                <input checked={isAllVisibleMessagesSelected} disabled={items.length === 0} type="checkbox" onChange={toggleAllVisibleMessages} />
                <span>전체 선택</span>
              </label>
              <span>선택 {selectedBulkCount}건</span>
              <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("markRead")}>읽음 처리</button>
              <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("markUnread")}>안읽음 처리</button>
              <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("favorite")}>즐겨찾기 추가</button>
              <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("unfavorite")}>즐겨찾기 해제</button>
              {currentBox === "inbox" ? <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("spam")}>스팸 이동</button> : null}
              {currentBox !== "trash" ? <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("trash")}>휴지통 이동</button> : null}
              {currentBox === "spam" || currentBox === "trash" ? <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("inbox")}>받은메일함 복구</button> : null}
              {currentBox === "trash" ? <button className="mail-compose-toolbar-button" disabled={!selectedBulkCount} type="button" onClick={() => void runBulkAction("delete")}>완전삭제</button> : null}
            </section>
            <div className="feature-workspace__rows mail-detail-layout__list" aria-label={`${boxLabels[currentBox]} 목록`}>
              {items.length === 0 ? (
                <article className="feature-workspace__row"><div><strong>표시할 메일이 없습니다.</strong><span>DB 조회 결과</span></div><em>비어 있음</em></article>
              ) : items.map((message) => (
                <article className="feature-workspace__row mail-message-row" key={message.id}>
                  <input
                    aria-label={`${message.subject} 선택`}
                    checked={selectedBulkMessageIds.includes(message.id)}
                    className="mail-message-row__checkbox"
                    type="checkbox"
                    onChange={() => toggleBulkMessage(message.id)}
                  />
                  <button
                    aria-pressed={selectedMessage?.id === message.id}
                    className="mail-message-select-button"
                    type="button"
                    onClick={() => setSelectedMessageId(message.id)}
                  >
                    <strong>{message.subject}</strong>
                    <span>{formatMeta(message, currentBox)}</span>
                  </button>
                  {currentBox === "inbox" ? (
                    message.readAt ? <button className="mail-compose-toolbar-button" onClick={() => void markUnread(message.id)} type="button">안읽음</button> : <button className="mail-compose-toolbar-button" onClick={() => void markRead(message.id)} type="button">읽음</button>
                  ) : <em>{message.importance === "important" ? "중요" : message.readAt ? "읽음" : "발송"}</em>}
                </article>
              ))}
            </div>

            <section className="mail-detail-panel" aria-label="메일 상세">
              {selectedMessage ? (
                <>
                  <div className="mail-detail-panel__header">
                    <div>
                      <strong>{selectedMessage.subject}</strong>
                      <span>{formatMeta(selectedMessage, currentBox)}</span>
                    </div>
                    <div className="mail-detail-panel__actions" aria-label="메일 상세 작업">
                      <button className="mail-compose-toolbar-button" type="button" disabled={!previousMessage} onClick={() => previousMessage ? setSelectedMessageId(previousMessage.id) : undefined}>이전 메일</button>
                      <button className="mail-compose-toolbar-button" type="button" disabled={!nextMessage} onClick={() => nextMessage ? setSelectedMessageId(nextMessage.id) : undefined}>다음 메일</button>
                      {currentBox === "inbox" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => openComposeFromMessage("reply", selectedMessage)}>답장</button> : null}
                      {currentBox === "inbox" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => openComposeFromMessage("replyAll", selectedMessage)}>전체답장</button> : null}
                      {currentBox === "inbox" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => selectedMessage.readAt ? void markUnread(selectedMessage.id) : void markRead(selectedMessage.id)}>{selectedMessage.readAt ? "안읽음 처리" : "읽음 처리"}</button> : null}
                      <button className="mail-compose-toolbar-button" type="button" onClick={() => openComposeFromMessage("forward", selectedMessage)}>전달</button>
                      <button className="mail-compose-toolbar-button" type="button" onClick={() => toggleFavorite(selectedMessage)}>{selectedMessage.importance === "important" ? "즐겨찾기 해제" : "즐겨찾기 추가"}</button>
                      {currentBox === "scheduled" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => moveMessage(selectedMessage.id, "cancel")}>예약취소</button> : null}
                      {currentBox === "inbox" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => moveMessage(selectedMessage.id, "spam")}>스팸으로 이동</button> : null}
                      {currentBox !== "trash" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => moveMessage(selectedMessage.id, "trash")}>휴지통으로 이동</button> : null}
                      {currentBox === "spam" || currentBox === "trash" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => moveMessage(selectedMessage.id, "inbox")}>받은메일함으로 복구</button> : null}
                      {currentBox === "trash" ? <button className="mail-compose-toolbar-button" type="button" onClick={() => moveMessage(selectedMessage.id, "delete")}>완전삭제</button> : null}
                    </div>
                  </div>
                  <div className="mail-detail-panel__body" dangerouslySetInnerHTML={{ __html: selectedMessage.body }} />
                  {selectedMessageAttachments.length ? (
                    <ul className="feature-workspace__notes" aria-label="메일 첨부파일">
                      {selectedMessageAttachments.map((attachment) => (
                        <li key={attachment.id}>
                          <a href={appRoutes.mail.downloadAttachment(attachment.id)}>{attachment.fileName}</a>
                          <span> · {Math.ceil(attachment.fileSize / 1024)}KB</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <article className="feature-workspace__row"><div><strong>선택한 메일이 없습니다.</strong><span>목록에서 메일을 선택하세요.</span></div><em>대기</em></article>
              )}
            </section>
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
