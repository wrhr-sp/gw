import { createPostgresAuthRepository } from "@werehere/db";
import { AuthServiceError, createAuthService, type AuthService } from "./service";
import { importTransactionEncryptionKey } from "./crypto";
import { createZitadelProvider } from "./zitadel";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";

export type AuthBindings = DatabaseBindings & {
  AUTH_SUCCESS_REDIRECT?: string;
  AUTH_TRANSACTION_ENCRYPTION_KEY?: string;

  ZITADEL_CLIENT_ID?: string;
  ZITADEL_ISSUER?: string;
  ZITADEL_REDIRECT_URI?: string;
};

export async function createAuthServiceFromBindings(bindings: AuthBindings | undefined): Promise<AuthService> {
  const issuer = bindings?.ZITADEL_ISSUER?.trim();
  const clientId = bindings?.ZITADEL_CLIENT_ID?.trim();
  const redirectUri = bindings?.ZITADEL_REDIRECT_URI?.trim();
  const encryptionKeyValue = bindings?.AUTH_TRANSACTION_ENCRYPTION_KEY?.trim();
  if (!issuer || !clientId || !redirectUri || !encryptionKeyValue) {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  const parsedRedirect = new URL(redirectUri);
  const localHttp = parsedRedirect.protocol === "http:"
    && (parsedRedirect.hostname === "127.0.0.1" || parsedRedirect.hostname === "localhost");
  if (parsedRedirect.protocol !== "https:" && !localHttp) {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  const successRedirect = bindings?.AUTH_SUCCESS_REDIRECT?.trim() || "/hotel-operations";
  if (!successRedirect.startsWith("/")
    || successRedirect.startsWith("//")
    || successRedirect.includes("\\")) {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  const databaseUrl = resolveDatabaseUrl(bindings);
  if (!databaseUrl) throw new AuthServiceError("DB_NOT_CONFIGURED", 503, false);

  let encryptionKey: CryptoKey;
  try {
    encryptionKey = await importTransactionEncryptionKey(encryptionKeyValue);
  } catch {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }

  return createAuthService({
    encryptionKey,
    provider: createZitadelProvider({ clientId, issuer }),
    redirectUri: parsedRedirect.toString(),
    repository: createPostgresAuthRepository(databaseUrl),
    successRedirect,
  });
}
