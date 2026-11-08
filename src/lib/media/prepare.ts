import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES, MediaError } from "./policy";

const formats = {
  "image/jpeg": { resourceType: "image", format: "jpg" },
  "image/png": { resourceType: "image", format: "png" },
  "image/webp": { resourceType: "image", format: "webp" },
  "video/mp4": { resourceType: "video", format: "mp4" },
  "video/webm": { resourceType: "video", format: "webm" },
} as const;

export type PreparedMedia = {
  bytes: Buffer;
  resourceType: "image" | "video";
  format: string;
};

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (!Object.hasOwn(formats, file.type))
    throw new MediaError("Choose a JPEG, PNG, WebP, MP4, or WebM file.");
  const format = formats[file.type as keyof typeof formats];
  const maxBytes = format.resourceType === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
  if (!file.size || file.size > maxBytes)
    throw new MediaError("Images must be at most 5 MB and videos at most 20 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes).catch(() => undefined);
  if (!detected || detected.mime !== file.type)
    throw new MediaError("The file content does not match its declared type.");
  if (format.resourceType === "video") return { bytes, ...format };
  try {
    // Decode and re-encode; sharp strips EXIF/GPS and other metadata by default.
    const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) > 1)
      throw new MediaError("Choose a still image rather than an animation.");
    const cleaned = await image.rotate().toFormat(
      format.format === "jpg" ? "jpeg" : format.format,
    ).toBuffer();
    if (cleaned.length > IMAGE_MAX_BYTES)
      throw new MediaError("The processed image exceeds 5 MB. Choose a smaller image.");
    return { ...format, bytes: cleaned };
  } catch (error) {
    if (error instanceof MediaError) throw error;
    throw new MediaError("This image could not be read. Choose another file.");
  }
}
