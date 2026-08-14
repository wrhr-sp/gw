import net from "node:net";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { pingClamAv, scanWithClamAv } from "../src/clamav";
import { optimizeEvidenceImage } from "../src/image-processor";

const servers: net.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function clamServer(response: string) {
  const received: Buffer[] = [];
  const server = net.createServer((socket) => {
    socket.on("data", (chunk) => received.push(Buffer.from(chunk)));
    socket.on("end", () => socket.end(`${response}\0`));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("invalid address");
  return { port: address.port, received };
}

describe("file processor", () => {
  it("uses exact ClamAV INSTREAM framing and accepts only an exact clean verdict", async () => {
    const clam = await clamServer("stream: OK");
    const body = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

    await expect(
      scanWithClamAv(body, {
        host: "127.0.0.1",
        port: clam.port,
        timeoutMs: 2_000,
      }),
    ).resolves.toEqual({ verdict: "CLEAN" });

    const payload = Buffer.concat(clam.received);
    expect(payload.subarray(0, 10).toString()).toBe("zINSTREAM\0");
    expect(payload.readUInt32BE(10)).toBe(body.byteLength);
    expect(payload.subarray(14, 14 + body.byteLength)).toEqual(body);
    expect(payload.subarray(-4)).toEqual(Buffer.alloc(4));
  });

  it("reports readiness only for an exact ClamAV PONG", async () => {
    const ready = await clamServer("PONG");
    await expect(
      pingClamAv({ host: "127.0.0.1", port: ready.port, timeoutMs: 2_000 }),
    ).resolves.toBe(true);

    const malformed = await clamServer("UNKNOWN");
    await expect(
      pingClamAv({ host: "127.0.0.1", port: malformed.port, timeoutMs: 2_000 }),
    ).resolves.toBe(false);
  });

  it("classifies FOUND as infected and fails closed on malformed scanner output", async () => {
    const infected = await clamServer("stream: Eicar-Test-Signature FOUND");
    await expect(
      scanWithClamAv(Buffer.from("eicar"), {
        host: "127.0.0.1",
        port: infected.port,
        timeoutMs: 2_000,
      }),
    ).resolves.toEqual({ verdict: "INFECTED" });

    const malformed = await clamServer("UNKNOWN");
    await expect(
      scanWithClamAv(Buffer.from("unknown"), {
        host: "127.0.0.1",
        port: malformed.port,
        timeoutMs: 2_000,
      }),
    ).rejects.toMatchObject({ code: "SCAN_ENGINE_FAILURE" });
  });

  it("limits the long edge to 2048 pixels and strips all source metadata", async () => {
    const source = await sharp({
      create: {
        background: { alpha: 1, b: 30, g: 20, r: 10 },
        channels: 4,
        height: 1_500,
        width: 3_000,
      },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();

    const output = await optimizeEvidenceImage(source, "image/jpeg");
    const metadata = await sharp(output.body).metadata();

    expect(metadata.width).toBe(2_048);
    expect(metadata.height).toBe(1_024);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(output).toMatchObject({
      exifLocationRemoved: true,
      maxDimension: 2_048,
      mimeType: "image/jpeg",
    });
  });

  it("rejects unsupported or spoofed image bytes without producing output", async () => {
    await expect(
      optimizeEvidenceImage(Buffer.from("not-an-image"), "image/jpeg"),
    ).rejects.toMatchObject({ code: "IMAGE_INTEGRITY_FAILURE" });
  });
});
