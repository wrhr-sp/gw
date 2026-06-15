import { forwardAuthLogoutRequest } from "../../../../same-origin-api-bridge";

export async function POST(request: Request) {
  return forwardAuthLogoutRequest(request);
}
