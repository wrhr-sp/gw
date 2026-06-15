import { forwardAdminUsersRequest } from "../../../../same-origin-api-bridge";

export async function GET(request: Request) {
  return forwardAdminUsersRequest(request);
}
