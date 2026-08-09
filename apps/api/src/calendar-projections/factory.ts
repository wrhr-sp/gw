import { createPostgresCalendarProjectionRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import { createCalendarCrypto, parseCalendarKeyring } from "./crypto";
import { createGoogleCalendarAdapter } from "./google";
import {
  assertCalendarScheduledActive,
  reconcileGoogleCalendarCandidate,
  reconcileGoogleCalendarCompany,
} from "./reconciler";
import {
  CalendarConnectionServiceError,
  createCalendarConnectionService,
  type CalendarConnectionService,
} from "./service";

export type CalendarProjectionBindings = DatabaseBindings & {
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID?: string;
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_CALENDAR_OAUTH_REDIRECT_URI?: string;
  CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION?: string;
  CALENDAR_CREDENTIAL_AES_KEYRING_JSON?: string;
  CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION?: string;
  CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON?: string;
};
function positiveVersion(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_NOT_CONFIGURED",
      503,
      false,
    );
  return parsed;
}
function cryptoFromBindings(bindings: CalendarProjectionBindings | undefined) {
  return createCalendarCrypto({
    aesCurrentVersion: positiveVersion(
      bindings?.CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION,
    ),
    aesKeyring: parseCalendarKeyring(
      bindings?.CALENDAR_CREDENTIAL_AES_KEYRING_JSON ?? "",
    ),
    hmacCurrentVersion: positiveVersion(
      bindings?.CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION,
    ),
    hmacKeyring: parseCalendarKeyring(
      bindings?.CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON ?? "",
    ),
  });
}
export function createCalendarConnectionServiceFromBindings(
  bindings: CalendarProjectionBindings | undefined,
): CalendarConnectionService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  const clientId = bindings?.GOOGLE_CALENDAR_OAUTH_CLIENT_ID?.trim();
  const clientSecret = bindings?.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = bindings?.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI?.trim();
  if (!databaseUrl || !clientId || !clientSecret || !redirectUri)
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_NOT_CONFIGURED",
      503,
      false,
    );
  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_NOT_CONFIGURED",
      503,
      false,
    );
  }
  if (
    redirect.protocol !== "https:" ||
    redirect.username ||
    redirect.password ||
    redirect.hash ||
    redirect.search
  )
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_NOT_CONFIGURED",
      503,
      false,
    );
  try {
    return createCalendarConnectionService({
      repository: createPostgresCalendarProjectionRepository(databaseUrl),
      crypto: cryptoFromBindings(bindings),
      google: createGoogleCalendarAdapter({ clientId, clientSecret }),
      redirectUri: redirect.toString(),
    });
  } catch (error) {
    if (error instanceof CalendarConnectionServiceError) throw error;
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_NOT_CONFIGURED",
      503,
      false,
    );
  }
}

export async function reconcileGoogleCalendarCompanies(input: {
  companyIds: string[];
  reconcile: (companyId: string) => Promise<{ claimed: number }>;
  signal?: AbortSignal | undefined;
}) {
  let claimed = 0;
  const failures: Error[] = [];
  for (const companyId of input.companyIds) {
    assertCalendarScheduledActive(input.signal);
    try {
      claimed += (await input.reconcile(companyId)).claimed;
      assertCalendarScheduledActive(input.signal);
    } catch {
      assertCalendarScheduledActive(input.signal);
      failures.push(new Error("CALENDAR_COMPANY_RECONCILIATION_FAILED"));
    }
  }
  if (failures.length > 0)
    throw new AggregateError(
      failures,
      "CALENDAR_COMPANY_RECONCILIATION_FAILED",
    );
  return { companies: input.companyIds.length, claimed, failedCompanies: 0 };
}

export async function reconcileGoogleCalendarCompanyStages(input: {
  candidate: () => Promise<{ claimed: number }>;
  projection: () => Promise<{ claimed: number }>;
  signal?: AbortSignal | undefined;
}) {
  let candidateClaimed = 0;
  let candidateError: unknown;
  try {
    assertCalendarScheduledActive(input.signal);
    candidateClaimed = (await input.candidate()).claimed;
    assertCalendarScheduledActive(input.signal);
  } catch (error) {
    assertCalendarScheduledActive(input.signal);
    candidateError = error;
  }
  assertCalendarScheduledActive(input.signal);
  const projection = await input.projection();
  assertCalendarScheduledActive(input.signal);
  if (candidateError) throw candidateError;
  return { claimed: candidateClaimed + projection.claimed };
}

export async function reconcileGoogleCalendarsFromBindings(
  bindings: CalendarProjectionBindings | undefined,
  options: { signal?: AbortSignal } = {},
) {
  assertCalendarScheduledActive(options.signal);
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  const clientId = bindings?.GOOGLE_CALENDAR_OAUTH_CLIENT_ID?.trim();
  const clientSecret = bindings?.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET?.trim();
  if (!databaseUrl || !clientId || !clientSecret)
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_NOT_CONFIGURED",
      503,
      false,
    );
  const repository = createPostgresCalendarProjectionRepository(databaseUrl);
  try {
    const crypto = cryptoFromBindings(bindings);
    const google = createGoogleCalendarAdapter({
      clientId,
      clientSecret,
      signal: options.signal,
    });
    const companyIds = await repository.companyIds();
    assertCalendarScheduledActive(options.signal);
    return reconcileGoogleCalendarCompanies({
      companyIds,
      signal: options.signal,
      reconcile: (companyId) =>
        reconcileGoogleCalendarCompanyStages({
          signal: options.signal,
          candidate: () =>
            reconcileGoogleCalendarCandidate({
              repository,
              crypto,
              google,
              companyId,
              signal: options.signal,
            }),
          projection: () =>
            reconcileGoogleCalendarCompany({
              repository,
              crypto,
              google,
              companyId,
              signal: options.signal,
            }),
        }),
    });
  } finally {
    await repository.close();
  }
}
