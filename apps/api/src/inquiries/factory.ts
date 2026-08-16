import {
  createPostgresInquiryRepository,
  reconcileExpiredInquiries,
} from "@werehere/db";
import {
  resolveDatabaseUrl,
  type DatabaseBindings,
  type ReconcilerDatabaseBindings,
} from "../database";
import {
  createInquiryService,
  InquiryServiceError,
  type InquiryService,
} from "./service";
export function createInquiryServiceFromBindings(
  bindings: DatabaseBindings | undefined,
): InquiryService {
  const url = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!url) throw new InquiryServiceError("DB_NOT_CONFIGURED", 503);
  return createInquiryService(createPostgresInquiryRepository(url));
}
export async function reconcileExpiredInquiriesFromBindings(
  bindings: ReconcilerDatabaseBindings | undefined,
) {
  const url = resolveDatabaseUrl(bindings, "RECONCILER");
  if (!url) throw new Error("INQUIRY_RECONCILER_NOT_CONFIGURED");
  return reconcileExpiredInquiries(url, 100);
}
