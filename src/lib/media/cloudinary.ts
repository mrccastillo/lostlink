import "server-only";
import { v2 as cloudinary } from "cloudinary";
import type { CloudinaryConfig } from "./config";
import type { PreparedMedia } from "./prepare";

export type MediaLocation = {
  publicId: string;
  resourceType: "image" | "video";
  format: string;
};

export type MediaStorage = {
  upload: (publicId: string, media: PreparedMedia) => Promise<void>;
  remove: (location: MediaLocation) => Promise<void>;
  download: (location: MediaLocation) => string;
};

export function createCloudinaryStorage(config: CloudinaryConfig): MediaStorage {
  // Pass credentials per call rather than mutating process-wide SDK config.
  const credentials = {
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  };
  return {
    upload: (publicId, media) => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        ...credentials,
        public_id: publicId,
        resource_type: media.resourceType,
        type: "authenticated",
        overwrite: false,
        allowed_formats: [media.format],
        ...(media.resourceType === "image"
          ? { transformation: [{ flags: "strip_profile" }] }
          : {}),
      }, (error, result) => {
        if (error || !result) return reject(new Error("MEDIA_PROVIDER_UPLOAD_FAILED"));
        if (result.public_id !== publicId || result.resource_type !== media.resourceType ||
            result.format !== media.format || !(result.width > 0) || !(result.height > 0))
          return reject(new Error("MEDIA_PROVIDER_RESPONSE_INVALID"));
        resolve();
      });
      stream.on("error", () => reject(new Error("MEDIA_PROVIDER_UPLOAD_FAILED")));
      stream.end(media.bytes);
    }),
    async remove(location) {
      const result = await cloudinary.uploader.destroy(location.publicId, {
        ...credentials,
        resource_type: location.resourceType,
        type: "authenticated",
        invalidate: true,
      });
      if (!["ok", "not found"].includes(result.result))
        throw new Error("MEDIA_PROVIDER_DELETE_FAILED");
    },
    download: (location) => cloudinary.utils.private_download_url(
      location.publicId,
      location.format,
      {
        ...credentials,
        resource_type: location.resourceType,
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        attachment: true,
      },
    ),
  };
}
