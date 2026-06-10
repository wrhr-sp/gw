import { forwardHealthRequest } from "../../../same-origin-api-bridge";

export function GET(request: Request) {
  return forwardHealthRequest(request);
}
