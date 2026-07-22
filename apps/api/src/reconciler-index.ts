import {
  reconcileAccountProviderJobsFromBindings,
  type AccountReconcilerBindings,
} from "./accounts/factory";

type ScheduledExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const worker = {
  scheduled(
    _controller: unknown,
    env: AccountReconcilerBindings,
    context: ScheduledExecutionContext,
  ) {
    context.waitUntil(reconcileAccountProviderJobsFromBindings(env));
  },
};

export default worker;
