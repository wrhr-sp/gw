import {
  createAccessTokenInterceptor,
  createServiceAccountInterceptor,
} from "@zitadel/node/dist/api/interceptors.js";
import { createSessionClient, createUserClient } from "@zitadel/node/dist/api/clients.js";
import { ServiceAccount } from "@zitadel/node/dist/credentials/service-account.js";
import type { SessionServiceClient } from "@zitadel/node/dist/api/generated/zitadel/session/v2beta/session_service.js";
import type { UserServiceClient } from "@zitadel/node/dist/api/generated/zitadel/user/v2beta/user_service.js";
import {
  assertGroupwareZitadelUserType,
  groupwareZitadelMetadataKeys,
  type GroupwareZitadelRegistrationStatus,
  type GroupwareZitadelUserType,
} from "./zitadel-auth-policy";

export { groupwareZitadelUserTypeOptions, groupwareZitadelUserTypes } from "./zitadel-auth-policy";

export type ZitadelStepUpEnv = {
  ZITADEL_API_ENDPOINT?: string;
  ZITADEL_SERVICE_ACCOUNT_JSON?: string;
  ZITADEL_ACCESS_TOKEN?: string;
  ZITADEL_ORG_ID?: string;
};

export type ZitadelRegistrationInput = {
  loginName: string;
  email: string;
  displayName: string;
  initialPassword: string;
  userType: GroupwareZitadelUserType;
  orgId?: string;
};

export type ZitadelRegistrationResult = {
  userId: string;
  registrationStatus: GroupwareZitadelRegistrationStatus;
  userType: GroupwareZitadelUserType;
};

export type ZitadelApprovalResult = {
  userId: string;
  registrationStatus: GroupwareZitadelRegistrationStatus;
};

export type ZitadelStepUpInput = {
  sessionId: string;
  sessionToken: string;
  totpCode: string;
};

export type ZitadelPasswordLoginInput = {
  loginName: string;
  password: string;
};

export type ZitadelPasswordLoginResult = {
  sessionId: string;
  sessionToken: string;
};

export type ZitadelStepUpResult = {
  verified: boolean;
  sessionToken?: string;
  method: "totp";
};

type ZitadelClients = {
  user: UserServiceClient;
  session: SessionServiceClient;
};

function requireValue(value: string | undefined, name: keyof ZitadelStepUpEnv) {
  if (!value?.trim()) {
    throw new Error(`${name} is required for ZITADEL integration`);
  }
  return value.trim();
}

function splitDisplayName(displayName: string) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { givenName: "사용자", familyName: "그룹웨어", displayName: "사용자" };
  }

  const [familyName = normalized, ...rest] = normalized.split(" ");
  return {
    familyName,
    givenName: rest.join(" ") || normalized,
    displayName: normalized,
  };
}

function encodeMetadataValue(value: string) {
  return new TextEncoder().encode(value);
}

function metadataEntry(key: string, value: string) {
  return {
    key,
    value: encodeMetadataValue(value),
  };
}

export function createZitadelClients(env: ZitadelStepUpEnv): ZitadelClients {
  const apiEndpoint = requireValue(env.ZITADEL_API_ENDPOINT, "ZITADEL_API_ENDPOINT");
  const serviceAccountJson = env.ZITADEL_SERVICE_ACCOUNT_JSON?.trim();
  const accessToken = env.ZITADEL_ACCESS_TOKEN?.trim();

  const interceptor = serviceAccountJson
    ? createServiceAccountInterceptor(apiEndpoint, ServiceAccount.fromJsonString(serviceAccountJson), { apiAccess: true })
    : createAccessTokenInterceptor(requireValue(accessToken, "ZITADEL_ACCESS_TOKEN"));

  return {
    user: createUserClient(apiEndpoint, interceptor),
    session: createSessionClient(apiEndpoint, interceptor),
  };
}

export async function requestRegistration(
  env: ZitadelStepUpEnv,
  input: ZitadelRegistrationInput,
): Promise<ZitadelRegistrationResult> {
  const userType = assertGroupwareZitadelUserType(input.userType);
  const orgId = input.orgId ?? requireValue(env.ZITADEL_ORG_ID, "ZITADEL_ORG_ID");
  const { user } = createZitadelClients(env);
  const profile = splitDisplayName(input.displayName);

  const response = await user.addHumanUser({
    username: input.loginName.trim(),
    organization: { orgId },
    profile,
    email: {
      email: input.email.trim(),
      isVerified: false,
    },
    metadata: [
      metadataEntry(groupwareZitadelMetadataKeys.userType, userType),
      metadataEntry(groupwareZitadelMetadataKeys.registrationStatus, "PENDING"),
    ] as unknown as Parameters<UserServiceClient["addHumanUser"]>[0]["metadata"],
    password: {
      password: input.initialPassword,
      changeRequired: true,
    },
  });

  await user.deactivateUser({ userId: response.userId });

  return {
    userId: response.userId,
    registrationStatus: "PENDING",
    userType,
  };
}

export async function createApprovedHumanUser(
  env: ZitadelStepUpEnv,
  input: ZitadelRegistrationInput,
): Promise<ZitadelRegistrationResult> {
  const userType = assertGroupwareZitadelUserType(input.userType);
  const orgId = input.orgId ?? requireValue(env.ZITADEL_ORG_ID, "ZITADEL_ORG_ID");
  const { user } = createZitadelClients(env);
  const profile = splitDisplayName(input.displayName);

  const response = await user.addHumanUser({
    username: input.loginName.trim(),
    organization: { orgId },
    profile,
    email: {
      email: input.email.trim(),
      isVerified: false,
    },
    metadata: [
      metadataEntry(groupwareZitadelMetadataKeys.userType, userType),
      metadataEntry(groupwareZitadelMetadataKeys.registrationStatus, "APPROVED"),
    ] as unknown as Parameters<UserServiceClient["addHumanUser"]>[0]["metadata"],
    password: {
      password: input.initialPassword,
      changeRequired: true,
    },
  });

  return {
    userId: response.userId,
    registrationStatus: "APPROVED",
    userType,
  };
}

export async function approveRegistration(env: ZitadelStepUpEnv, userId: string): Promise<ZitadelApprovalResult> {
  const { user } = createZitadelClients(env);
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("userId is required for ZITADEL registration approval");
  }

  await user.reactivateUser({ userId: normalizedUserId });

  return {
    userId: normalizedUserId,
    registrationStatus: "APPROVED",
  };
}

export async function verifyZitadelPasswordLogin(
  env: ZitadelStepUpEnv,
  input: ZitadelPasswordLoginInput,
): Promise<ZitadelPasswordLoginResult> {
  const { session } = createZitadelClients(env);
  const result = await session.createSession({
    checks: {
      user: {
        loginName: input.loginName.trim(),
      },
      password: {
        password: input.password,
      },
    },
    metadata: {},
  });

  return {
    sessionId: result.sessionId,
    sessionToken: result.sessionToken,
  };
}

export async function verifyStepUpAuth(env: ZitadelStepUpEnv, input: ZitadelStepUpInput): Promise<ZitadelStepUpResult> {
  const { session } = createZitadelClients(env);
  const result = await session.setSession({
    sessionId: input.sessionId,
    sessionToken: input.sessionToken,
    checks: {
      totp: {
        code: input.totpCode,
      },
    },
    metadata: {},
  });

  return {
    verified: true,
    sessionToken: result.sessionToken,
    method: "totp",
  };
}
