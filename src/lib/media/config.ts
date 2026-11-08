export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function readCloudinaryConfig(
  env: Record<string, string | undefined>,
): CloudinaryConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !/^[a-z0-9_-]+$/i.test(cloudName) || !apiKey || !apiSecret)
    return null;
  return { cloudName, apiKey, apiSecret };
}
