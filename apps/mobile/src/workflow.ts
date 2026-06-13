import {
  describeNativeMobileRouteAccess,
  getNativeMobilePrimaryRoute,
  getNativeMobileUiStateGuidance,
  hasNativeMobileApprovalLaneAccess,
  nativeMobileCoreWorkflow,
  type NativeMobilePrimaryScreenId,
  type NativeMobileUiState,
} from "@gw/shared";

import { resolveNativeMobileApiTarget, type NativeMobileRuntimeConfig } from "./base-url";
import {
  createPlaceholderNativeSessionSnapshot,
  describeSessionScopedFeatures,
  type NativeSessionSnapshot,
} from "./session-bridge";

export type NativeMobileScreenStateInput = {
  screenId: NativeMobilePrimaryScreenId;
  isOnline: boolean;
  hasAccess: boolean;
  hasData?: boolean;
  hasError?: boolean;
};

export type NativeMobileScreenStateDescriptor = {
  screenId: NativeMobilePrimaryScreenId;
  state: NativeMobileUiState;
  title: string;
  message: string;
  allowedActions: readonly string[];
  blockedActions: readonly string[];
};

export type NativeMobileWorkflowPreview = {
  runtime: ReturnType<typeof resolveNativeMobileApiTarget>;
  session: NativeSessionSnapshot;
  firstActionScreenId: Exclude<NativeMobilePrimaryScreenId, "login">;
  capabilities: ReturnType<typeof describeSessionScopedFeatures>;
  steps: readonly {
    order: number;
    screenId: NativeMobilePrimaryScreenId;
    label: string;
    goal: string;
    webRoute: string;
    apiRoutes: readonly string[];
    access: ReturnType<typeof describeNativeMobileRouteAccess>;
  }[];
};

export function resolveNativeMobileScreenState(input: NativeMobileScreenStateInput): NativeMobileScreenStateDescriptor {
  const route = getNativeMobilePrimaryRoute(input.screenId);

  if (!route) {
    throw new Error(`알 수 없는 모바일 화면입니다: ${input.screenId}`);
  }

  const state: NativeMobileUiState = !input.hasAccess
    ? "forbidden"
    : input.hasError
      ? "error"
      : !input.isOnline
        ? "offline"
        : input.hasData === false
          ? "empty"
          : "ready";

  const guidance = getNativeMobileUiStateGuidance(state);

  return {
    screenId: input.screenId,
    state,
    title: `${route.label} · ${guidance.title}`,
    message: `${route.summary} / ${guidance.summary}`,
    allowedActions: guidance.allowedActions,
    blockedActions: guidance.blockedActions,
  };
}

function pickFirstActionScreenId(session: NativeSessionSnapshot): Exclude<NativeMobilePrimaryScreenId, "login"> {
  const hasManagerLane = hasNativeMobileApprovalLaneAccess(session.roleCodes);

  return hasManagerLane ? "approvals" : "attendance";
}

export function buildNativeMobileWorkflowPreview(options: {
  runtimeConfig: NativeMobileRuntimeConfig;
  session?: NativeSessionSnapshot;
}) : NativeMobileWorkflowPreview {
  const session = options.session ?? createPlaceholderNativeSessionSnapshot();

  return {
    runtime: resolveNativeMobileApiTarget(options.runtimeConfig),
    session,
    firstActionScreenId: pickFirstActionScreenId(session),
    capabilities: describeSessionScopedFeatures(session.roleCodes),
    steps: nativeMobileCoreWorkflow.map((step) => {
      const route = getNativeMobilePrimaryRoute(step.screenId);

      if (!route) {
        throw new Error(`workflow step route 를 찾을 수 없습니다: ${step.screenId}`);
      }

      return {
        ...step,
        webRoute: route.webRoute,
        apiRoutes: route.apiRoutes,
        access: describeNativeMobileRouteAccess(step.screenId, session.roleCodes),
      };
    }),
  };
}
