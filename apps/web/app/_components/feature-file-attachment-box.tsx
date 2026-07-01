"use client";

import React from "react";

export type FeatureFileAttachmentStatus = "대기" | "업로드 중" | "업로드 완료" | "실패" | "취소됨";

export type FeatureFileAttachmentItem = {
  id: string;
  fileName: string;
  status: FeatureFileAttachmentStatus;
  sizeLabel: string;
  downloadLabel?: string;
  canDownload?: boolean;
  sourceLabel?: string;
};

type FeatureFileAttachmentBoxProps = {
  items: FeatureFileAttachmentItem[];
  emptyLabel?: string;
  onRemove: (attachmentId: string) => void;
  onRemoveAll?: () => void;
  onDownload?: (attachment: FeatureFileAttachmentItem) => void;
};

export function FeatureFileAttachmentBox({
  items,
  emptyLabel = "첨부된 파일이 없습니다.",
  onRemove,
  onRemoveAll,
  onDownload,
}: FeatureFileAttachmentBoxProps) {
  return (
    <div className="feature-file-box" aria-label="첨부파일 목록">
      <div className="feature-file-box__header">
        <button className="feature-file-box__remove-all" type="button" disabled={!items.length || !onRemoveAll} onClick={onRemoveAll} aria-label="첨부파일 전체삭제">X</button>
        <span>파일명</span>
        <span>업로드 상태</span>
        <span>용량</span>
        <span>다운로드</span>
      </div>
      {items.length ? (
        <div className="feature-file-box__rows">
          {items.map((attachment) => (
            <div className="feature-file-box__row" key={attachment.id}>
              <button
                className="feature-file-box__remove"
                type="button"
                aria-label={`${attachment.fileName} 첨부 취소`}
                onClick={() => onRemove(attachment.id)}
              >
                ×
              </button>
              <span className="feature-file-box__name">
                <strong>{attachment.fileName}</strong>
                {attachment.sourceLabel ? <small>{attachment.sourceLabel}</small> : null}
              </span>
              <span className="feature-file-box__status">{attachment.status}</span>
              <span className="feature-file-box__size">{attachment.sizeLabel}</span>
              <button
                className="feature-file-box__download"
                type="button"
                disabled={!attachment.canDownload || !onDownload}
                onClick={() => onDownload?.(attachment)}
              >
                {attachment.downloadLabel ?? "다운로드"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="feature-file-box__empty">{emptyLabel}</div>
      )}
    </div>
  );
}
