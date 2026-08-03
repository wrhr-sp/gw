import {
  reconcileAccountProviderJobsFromBindings,
  type AccountReconcilerBindings,
} from "./accounts/factory";
import {
  reconcileHotelFileEvidenceFromBindings,
  recoverExpiredHotelFileAccessGrantsFromBindings,
  type FileReconcilerBindings,
} from "./files/factory";

type ScheduledExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const worker = {
  scheduled(
    _controller: unknown,
    env: AccountReconcilerBindings & FileReconcilerBindings,
    context: ScheduledExecutionContext,
  ) {
    context.waitUntil(
      Promise.all([
        reconcileAccountProviderJobsFromBindings(env),
        reconcileHotelFileEvidenceFromBindings(env),
        recoverExpiredHotelFileAccessGrantsFromBindings(env),
      ]),
    );
  },
};

export default worker;
