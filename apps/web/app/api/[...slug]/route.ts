import { forwardSameOriginApiRequest } from "../../../same-origin-api-bridge";

function resolvePathname(request: Request) {
  return new URL(request.url).pathname;
}

export async function GET(request: Request) {
  return forwardSameOriginApiRequest(request, resolvePathname(request));
}

export async function POST(request: Request) {
  return forwardSameOriginApiRequest(request, resolvePathname(request));
}

export async function PUT(request: Request) {
  return forwardSameOriginApiRequest(request, resolvePathname(request));
}

export async function PATCH(request: Request) {
  return forwardSameOriginApiRequest(request, resolvePathname(request));
}

export async function DELETE(request: Request) {
  return forwardSameOriginApiRequest(request, resolvePathname(request));
}
