import { timingSafeEqual } from "node:crypto";
import type { EvidenceMime } from "./image-processor";

const MIME_TYPES = new Set<EvidenceMime>([
  "image/heic",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function authorized(request: Request, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const presented = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    expected.byteLength === presented.byteLength &&
    timingSafeEqual(expected, presented)
  );
}

export function createProcessorApp(input: {
  optimize: (
    body: Uint8Array,
    mime: EvidenceMime,
  ) => Promise<{
    body: Uint8Array;
    exifLocationRemoved: true;
    maxDimension: number;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  }>;
  ready?: () => Promise<boolean>;
  scan: (body: Uint8Array) => Promise<{ verdict: "CLEAN" | "INFECTED" }>;
  sharedSecret: string;
}) {
  if (Buffer.byteLength(input.sharedSecret) < 32) {
    throw new Error("processor shared secret must contain at least 32 bytes");
  }
  return {
    async fetch(request: Request) {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health/live") {
        return Response.json({ status: "live" });
      }
      if (request.method === "GET" && url.pathname === "/health/ready") {
        const ready = await input.ready?.().catch(() => false);
        return Response.json(
          { status: ready ? "ready" : "unavailable" },
          { status: ready ? 200 : 503 },
        );
      }
      if (request.method !== "POST" || url.pathname !== "/v1/process") {
        return new Response(null, { status: 404 });
      }
      if (!authorized(request, input.sharedSecret)) {
        return new Response(null, { status: 401 });
      }
      const declaredMime = request.headers.get("content-type") as EvidenceMime;
      if (!MIME_TYPES.has(declaredMime)) {
        return Response.json({ code: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
      }
      const declaredLength = Number(request.headers.get("content-length"));
      if (
        !Number.isSafeInteger(declaredLength) ||
        declaredLength < 1 ||
        declaredLength > 20 * 1024 * 1024
      ) {
        return Response.json({ code: "INVALID_SIZE" }, { status: 413 });
      }
      const body = new Uint8Array(await request.arrayBuffer());
      if (body.byteLength !== declaredLength) {
        return Response.json({ code: "INVALID_SIZE" }, { status: 400 });
      }
      try {
        const scan = await input.scan(body);
        if (scan.verdict === "INFECTED") {
          return Response.json({ verdict: "INFECTED" }, { status: 422 });
        }
        const output = await input.optimize(body, declaredMime);
        return new Response(Uint8Array.from(output.body).buffer, {
          headers: {
            "Cache-Control": "no-store",
            "Content-Length": String(output.body.byteLength),
            "Content-Type": output.mimeType,
            "X-Exif-Location-Removed": "true",
            "X-Max-Dimension": String(output.maxDimension),
            "X-Scan-Verdict": "CLEAN",
          },
          status: 200,
        });
      } catch {
        return Response.json({ code: "PROCESSOR_FAILURE" }, { status: 503 });
      }
    },
  };
}
