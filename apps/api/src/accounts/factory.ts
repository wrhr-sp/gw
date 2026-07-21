import {
  createPostgresAccountReconciliationRepository,
  createPostgresAccountRepository,
} from "@werehere/db";
import {
  resolveDatabaseUrl,
  type ApiDatabaseBindings,
  type ReconcilerDatabaseBindings,
} from "../database";
import { AccountServiceError, createAccountService, type AccountService } from "./service";
import { reconcileAccountProviderJobs } from "./reconciler";
import { createZitadelUserProvider } from "./zitadel-user-provider";

type IdentityProviderBindings = {
  ZITADEL_ISSUER?: string;
  ZITADEL_ORGANIZATION_ID?: string;
  ZITADEL_SERVICE_USER_TOKEN?: string;
  ZITADEL_USER_PROVISIONER_TOKEN?: string;
};

export type AccountBindings = ApiDatabaseBindings & IdentityProviderBindings;
export type AccountReconcilerBindings = ReconcilerDatabaseBindings & IdentityProviderBindings;

export function createAccountServiceFromBindings(bindings: AccountBindings | undefined): AccountService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl) throw new AccountServiceError("DB_NOT_CONFIGURED", 503, false);
  const issuer = bindings?.ZITADEL_ISSUER?.trim();
  const organizationId = bindings?.ZITADEL_ORGANIZATION_ID?.trim();
  const token = bindings?.ZITADEL_USER_PROVISIONER_TOKEN?.trim();
  const verificationToken = bindings?.ZITADEL_SERVICE_USER_TOKEN?.trim();
  if (!issuer || !organizationId || !token || !verificationToken) {
    throw new AccountServiceError("EXTERNAL_AUTH_NOT_CONFIGURED", 503, false);
  }
  return createAccountService({
    provider: createZitadelUserProvider({ issuer, organizationId, token, verificationToken }),
    repository: createPostgresAccountRepository(databaseUrl),
  });
}

export async function reconcileAccountProviderJobsFromBindings(
  bindings: AccountReconcilerBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  if (!databaseUrl) throw new AccountServiceError("DB_NOT_CONFIGURED", 503, false);
  const issuer = bindings?.ZITADEL_ISSUER?.trim();
  const organizationId = bindings?.ZITADEL_ORGANIZATION_ID?.trim();
  const token = bindings?.ZITADEL_USER_PROVISIONER_TOKEN?.trim();
  const verificationToken = bindings?.ZITADEL_SERVICE_USER_TOKEN?.trim();
  if (!issuer || !organizationId || !token || !verificationToken) {
    throw new AccountServiceError("EXTERNAL_AUTH_NOT_CONFIGURED", 503, false);
  }
  const repository = createPostgresAccountReconciliationRepository(databaseUrl);
  const accountRepository = createPostgresAccountRepository(databaseUrl);
  try {
    return await reconcileAccountProviderJobs({
      repository,
      accountRepository,
      provider: createZitadelUserProvider({ issuer, organizationId, token, verificationToken }),
      batchSize: 25,
    });
  } finally {
    await Promise.all([repository.close(), accountRepository.close?.()]);
  }
}
