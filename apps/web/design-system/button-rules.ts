export type ButtonIntent = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonRules: Record<ButtonIntent, { className: string; label: string }> = {
  primary: { className: "touch-button feature-workspace__action feature-workspace__action--primary", label: "주요" },
  secondary: { className: "touch-button feature-workspace__action", label: "보조" },
  danger: { className: "touch-button feature-workspace__action feature-workspace__action--danger", label: "위험" },
  ghost: { className: "touch-button feature-workspace__action feature-workspace__action--ghost", label: "텍스트" },
} as const;

export const actionButtonGroupRule = {
  className: "ui-action-button-group",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
} as const;

export const mutationButtonRule = {
  requiresRealApi: true,
  requiresReReadAfterMutation: true,
  forbidsMockFallback: true,
} as const;
