import app from "./app";
import type { AccountBindings } from "./accounts/factory";

type AppExecutionContext = NonNullable<Parameters<typeof app.fetch>[2]>;

const worker = {
  fetch(request: Request, env: AccountBindings, context: AppExecutionContext) {
    return app.fetch(request, env, context);
  },
};

export default worker;
