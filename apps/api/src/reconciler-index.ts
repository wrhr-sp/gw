import { withPostgresScheduledReconcilerInvocation } from "@werehere/db";
import {
  reconcileAccountProviderJobsFromBindings,
  type AccountReconcilerBindings,
} from "./accounts/factory";
import {
  reconcileHotelFileEvidenceFromBindings,
  recoverExpiredHotelFileAccessGrantsFromBindings,
  type FileReconcilerBindings,
} from "./files/factory";

import {
  reconcileInspectionMaterializationsFromBindings,
  type InspectionMaterializerBindings,
} from "./inspections/materializer-factory";
import { resolveDatabaseUrl } from "./database";

type ScheduledExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

async function settleScheduled(tasks: Promise<unknown>[]) {
  const settled = await Promise.allSettled(tasks);
  const failures = settled.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length) {
    const messages = failures.map((failure) =>
      failure.reason instanceof Error
        ? failure.reason.message
        : "scheduled reconciler failed",
    );
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `SCHEDULED_RECONCILIATION_FAILED: ${messages.join("; ")}`,
    );
  }
  return settled.map((result) =>
    result.status === "fulfilled" ? result.value : undefined,
  );
}

async function runScheduled(
  env: AccountReconcilerBindings &
    FileReconcilerBindings &
    InspectionMaterializerBindings,
) {
  const databaseUrl = resolveDatabaseUrl(env, "RECONCILER");
  if (!databaseUrl)
    throw new Error("SCHEDULED_RECONCILER_DATABASE_NOT_CONFIGURED");
  return withPostgresScheduledReconcilerInvocation(databaseUrl, () =>
    settleScheduled([
      reconcileAccountProviderJobsFromBindings(env),
      reconcileHotelFileEvidenceFromBindings(env),
      recoverExpiredHotelFileAccessGrantsFromBindings(env),
      reconcileInspectionMaterializationsFromBindings(env),
    ]),
  );
}

const worker = {
  scheduled(
    _controller: unknown,
    env: AccountReconcilerBindings &
      FileReconcilerBindings &
      InspectionMaterializerBindings,
    context: ScheduledExecutionContext,
  ) {
    context.waitUntil(runScheduled(env));
  },
};

export default worker;
