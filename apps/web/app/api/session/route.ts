import { appRoutes } from "@gw/shared";

import { forwardTrustedSameOriginApiRequest } from "../../../same-origin-api-bridge";

export async function GET(request: Request) {
  return forwardTrustedSameOriginApiRequest(request, appRoutes.me);
}
