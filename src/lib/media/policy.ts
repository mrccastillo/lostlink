export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const MEDIA_MAX_ATTACHMENTS = 5;
export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";
export const MEDIA_RETENTION_MS = 24 * 60 * 60 * 1000;


export class MediaError extends Error {}
