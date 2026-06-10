import { forwardMeRequest } from "../../../same-origin-api-bridge";

export function GET(request: Request) {
  return forwardMeRequest(request);
}
