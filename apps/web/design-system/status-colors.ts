export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

export const statusColorTokens: Record<StatusTone, { label: string; className: string }> = {
  neutral: { label: "일반", className: "status-badge status-badge--neutral" },
  success: { label: "정상", className: "status-badge status-badge--success" },
  warning: { label: "주의", className: "status-badge status-badge--warning" },
  danger: { label: "위험", className: "status-badge status-badge--danger" },
  info: { label: "정보", className: "status-badge status-badge--info" },
  accent: { label: "강조", className: "status-badge status-badge--accent" },
} as const;

export const accountStatusTone = {
  invited: "info",
  active: "success",
  locked: "warning",
  disabled: "neutral",
  offboarded: "danger",
  suspended: "warning",
} as const;

export const approvalStatusTone = {
  draft: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
} as const;
