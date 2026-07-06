import { forwardAdminUsersRequest } from "../../../../same-origin-api-bridge";

export async function GET(request: Request) {
  return forwardAdminUsersRequest(request);
}

export async function POST(request: Request) {
  return forwardAdminUsersRequest(request);
}
