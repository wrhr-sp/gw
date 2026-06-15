import { forwardAuthLoginRequest } from "../../../../same-origin-api-bridge";

export async function POST(request: Request) {
  return forwardAuthLoginRequest(request);
}
