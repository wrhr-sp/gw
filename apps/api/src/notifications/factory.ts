import { createPostgresNotificationRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import {
  createNotificationService,
  NotificationServiceError,
  type NotificationService,
} from "./service";

export function createNotificationServiceFromBindings(
  bindings: DatabaseBindings | undefined,
): NotificationService {
  const url = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!url) throw new NotificationServiceError("DB_NOT_CONFIGURED", 503);
  return createNotificationService(createPostgresNotificationRepository(url));
}
