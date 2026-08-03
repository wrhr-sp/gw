import http from "node:http";
import { createProcessorApp } from "./app";
import { pingClamAv, scanWithClamAv } from "./clamav";
import { optimizeEvidenceImage } from "./image-processor";

const port = Number(process.env.PORT ?? "8080");
const clamPort = Number(process.env.CLAMAV_PORT ?? "3310");
const clamHost = process.env.CLAMAV_HOST?.trim() ?? "127.0.0.1";
const sharedSecret = process.env.FILE_PROCESSOR_SHARED_SECRET?.trim();
if (!sharedSecret) throw new Error("FILE_PROCESSOR_SHARED_SECRET is required");
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT is invalid");
}

const app = createProcessorApp({
  optimize: optimizeEvidenceImage,
  ready: () =>
    pingClamAv({ host: clamHost, port: clamPort, timeoutMs: 2_000 }),
  scan: (body) =>
    scanWithClamAv(body, {
      host: clamHost,
      port: clamPort,
      timeoutMs: 30_000,
    }),
  sharedSecret,
});

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of incoming) {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.byteLength;
      if (size > 20 * 1024 * 1024) {
        outgoing.writeHead(413).end();
        return;
      }
      chunks.push(bytes);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (value) headers.set(name, value.join(", "));
    }
    const method = incoming.method ?? "GET";
    const init: RequestInit = { headers, method };
    if (method !== "GET" && method !== "HEAD") {
      init.body = Uint8Array.from(Buffer.concat(chunks)).buffer;
    }
    const request = new Request(
      `http://processor.local${incoming.url ?? "/"}`,
      init,
    );
    const response = await app.fetch(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(503, { "Cache-Control": "no-store" }).end();
  }
});

server.listen(port, "0.0.0.0");
