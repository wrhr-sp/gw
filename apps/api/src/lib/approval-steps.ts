import type { ApprovalStep } from "@gw/shared";

function byStepOrder(a: ApprovalStep, b: ApprovalStep) {
  if (a.stepOrder !== b.stepOrder) {
    return a.stepOrder - b.stepOrder;
  }
  return a.id.localeCompare(b.id);
}

export function sortApprovalSteps(steps: ApprovalStep[]) {
  return steps.slice().sort(byStepOrder);
}

export function findCurrentPendingApprovalStep(steps: ApprovalStep[]) {
  return sortApprovalSteps(steps).find((step) => step.decisionStatus === "pending") ?? null;
}

export function isCurrentPendingApprovalStepForEmployee(steps: ApprovalStep[], employeeId: string) {
  const currentStep = findCurrentPendingApprovalStep(steps);
  return currentStep?.approverEmployeeId === employeeId;
}

export function hasPendingApprovalSteps(steps: ApprovalStep[]) {
  return steps.some((step) => step.decisionStatus === "pending");
}
