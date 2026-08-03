import net from "node:net";

export type ClamAvOptions = {
  host: string;
  port: number;
  timeoutMs: number;
};

export class ClamAvError extends Error {
  readonly code = "SCAN_ENGINE_FAILURE";
}

export async function pingClamAv(options: ClamAvOptions): Promise<boolean> {
  validateOptions(options);
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: options.host, port: options.port });
    let response = "";
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(ready);
    };
    const timer = setTimeout(() => finish(false), options.timeoutMs);
    socket.once("error", () => finish(false));
    socket.on("data", (chunk: Buffer) => {
      response += chunk.toString("utf8");
      if (response.includes("\0") || response.includes("\n")) {
        finish(response.split(/[\0\n]/u, 1)[0] === "PONG");
      }
    });
    socket.once("end", () =>
      finish(response.split(/[\0\n]/u, 1)[0] === "PONG"),
    );
    socket.once("connect", () => socket.end("zPING\0"));
  });
}

function validateOptions(options: ClamAvOptions) {
  if (
    !options.host.trim() ||
    !Number.isSafeInteger(options.port) ||
    options.port < 1 ||
    options.port > 65_535 ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1_000 ||
    options.timeoutMs > 60_000
  ) {
    throw new ClamAvError("invalid ClamAV configuration");
  }
}

export async function scanWithClamAv(
  body: Uint8Array,
  options: ClamAvOptions,
): Promise<{ verdict: "CLEAN" | "INFECTED" }> {
  validateOptions(options);
  if (body.byteLength < 1 || body.byteLength > 20 * 1024 * 1024) {
    throw new ClamAvError("invalid scan body size");
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: options.host, port: options.port });
    const response: Buffer[] = [];
    let responseSize = 0;
    let settled = false;
    const finish = (
      result?: { verdict: "CLEAN" | "INFECTED" },
      error?: Error,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new ClamAvError("missing ClamAV result"));
    };
    const parse = () => {
      const raw = Buffer.concat(response).toString("utf8");
      const verdict = raw.split(/[\0\n]/u, 1)[0];
      if (verdict === "stream: OK") finish({ verdict: "CLEAN" });
      else if (/^stream: .+ FOUND$/u.test(verdict ?? ""))
        finish({ verdict: "INFECTED" });
      else finish(undefined, new ClamAvError("malformed ClamAV result"));
    };
    const timer = setTimeout(
      () => finish(undefined, new ClamAvError("ClamAV timeout")),
      options.timeoutMs,
    );

    socket.once("error", () =>
      finish(undefined, new ClamAvError("ClamAV connection failure")),
    );
    socket.on("data", (chunk: Buffer) => {
      responseSize += chunk.byteLength;
      if (responseSize > 4_096) {
        finish(undefined, new ClamAvError("oversized ClamAV result"));
        return;
      }
      response.push(Buffer.from(chunk));
      if (chunk.includes(0) || chunk.includes(10)) parse();
    });
    socket.once("end", () => {
      if (!settled) parse();
    });
    socket.once("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < body.byteLength; offset += 64 * 1024) {
        const chunk = Buffer.from(
          body.buffer,
          body.byteOffset + offset,
          Math.min(64 * 1024, body.byteLength - offset),
        );
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.byteLength, 0);
        socket.write(length);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  });
}
