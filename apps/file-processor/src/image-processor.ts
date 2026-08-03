import sharp from "sharp";

export type EvidenceMime =
  | "image/heic"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export class ImageProcessorError extends Error {
  readonly code = "IMAGE_INTEGRITY_FAILURE";
}

const EXPECTED_FORMAT: Record<EvidenceMime, string> = {
  "image/heic": "heif",
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function optimizeEvidenceImage(
  body: Uint8Array,
  declaredMime: EvidenceMime,
) {
  if (body.byteLength < 1 || body.byteLength > 20 * 1024 * 1024) {
    throw new ImageProcessorError("invalid source size");
  }
  try {
    const source = sharp(body, { failOn: "error", limitInputPixels: 80_000_000 });
    const metadata = await source.metadata();
    if (
      metadata.format !== EXPECTED_FORMAT[declaredMime] ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new ImageProcessorError("declared MIME does not match source");
    }

    let pipeline = source
      .rotate()
      .resize({
        fit: "inside",
        height: 2_048,
        kernel: sharp.kernel.lanczos3,
        width: 2_048,
        withoutEnlargement: true,
      });
    let mimeType: "image/jpeg" | "image/png" | "image/webp";
    if (declaredMime === "image/png") {
      pipeline = pipeline.png({ compressionLevel: 9 });
      mimeType = "image/png";
    } else if (declaredMime === "image/webp") {
      pipeline = pipeline.webp({ quality: 82 });
      mimeType = "image/webp";
    } else {
      pipeline = pipeline.jpeg({ mozjpeg: true, quality: 85 });
      mimeType = "image/jpeg";
    }

    const optimized = await pipeline.toBuffer({ resolveWithObject: true });
    const maxDimension = Math.max(optimized.info.width, optimized.info.height);
    if (maxDimension > 2_048 || optimized.data.byteLength < 1) {
      throw new ImageProcessorError("invalid optimized output");
    }
    return {
      body: new Uint8Array(optimized.data),
      exifLocationRemoved: true as const,
      maxDimension,
      mimeType,
    };
  } catch (error) {
    if (error instanceof ImageProcessorError) throw error;
    throw new ImageProcessorError("image decoding or optimization failed");
  }
}
