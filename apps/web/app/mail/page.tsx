import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const mailConfig: FeatureWorkspaceConfig = {
  title: "메일",
  eyebrow: "받은 메일, 작성, 첨부 확인, 보안 상태를 한 화면에서 처리합니다.",
  tabs: [
    { id: "inbox", label: "받은 메일", badge: "12" },
    { id: "compose", label: "메일 작성", badge: "작성" },
    { id: "sent", label: "보낸 메일", badge: "7" },
    { id: "security", label: "보안 확인", badge: "점검" },
  ],
  utility: [
    { label: "읽지 않음", value: "4건" },
    { label: "오늘 발송", value: "7건" },
    { label: "첨부 확인", value: "2건" },
  ],
  panels: [
    {
      id: "inbox",
      heading: "받은 메일",
      summary: "업무 메일을 중요도와 처리 상태로 나누어 바로 확인합니다.",
      statusCards: [
        { label: "중요", value: "3건", tone: "warning" },
        { label: "답장 필요", value: "5건" },
        { label: "완료", value: "18건", tone: "accent" },
      ],
      rows: [
        { title: "인사팀 공지 확인 요청", meta: "인사팀 · 오늘 09:20", status: "읽지 않음", body: "확인 후 회신이 필요한 내부 공지입니다." },
        { title: "회의자료 공유", meta: "운영팀 · 오늘 10:10", status: "첨부" },
        { title: "지점 주간보고 취합", meta: "지점관리 · 어제", status: "답장 필요" },
      ],
      actions: [{ label: "선택 읽음 처리", tone: "primary" }, { label: "중요 표시" }],
    },
    {
      id: "compose",
      heading: "메일 작성",
      summary: "수신자, 제목, 본문, 첨부 대기 상태를 한 자리에서 작성합니다.",
      formFields: [
        { label: "받는 사람", value: "인사팀" },
        { label: "제목", value: "근태 정정 확인 요청" },
        { label: "본문", value: "확인 필요한 내용을 입력하세요.", type: "textarea" },
      ],
      actions: [{ label: "임시 저장" }, { label: "보내기", tone: "primary" }],
      notes: ["외부 발송 전에는 회사 보안 정책을 확인합니다.", "첨부 파일은 문서함 권한과 함께 확인합니다."],
    },
    {
      id: "sent",
      heading: "보낸 메일",
      summary: "최근 발송 내역과 수신 확인 상태를 빠르게 확인합니다.",
      rows: [
        { title: "휴가 승인 결과 안내", meta: "수신 3명 · 오늘 11:00", status: "발송 완료" },
        { title: "지점 점검 일정 공유", meta: "수신 8명 · 어제", status: "확인중" },
        { title: "급여자료 보완 요청", meta: "수신 1명 · 이번 주", status: "답장 대기" },
      ],
    },
    {
      id: "security",
      heading: "보안 확인",
      summary: "외부 주소, 대용량 첨부, 민감 문구 포함 여부를 발송 전 확인합니다.",
      statusCards: [
        { label: "외부 수신자", value: "0명", tone: "accent" },
        { label: "대용량 첨부", value: "없음" },
        { label: "검토 필요", value: "1건", tone: "warning" },
      ],
      rows: [
        { title: "민감정보 포함 여부", meta: "자동 점검", status: "확인 필요" },
        { title: "첨부 권한", meta: "문서함 권한 기준", status: "정상" },
      ],
    },
  ],
};

export default function MailPage() {
  return (
    <PageShell title="메일" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={mailConfig} />
    </PageShell>
  );
}
