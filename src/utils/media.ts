import { fetchApi } from '../api/client';

export interface MediaLimits {
  allowedTypes: string[];
  maxImageBytes: number;
  maxVideoBytes: number;
  maxVideoSeconds: number;
  maxImagesPerListing: number;
  maxVideosPerListing: number;
  uploadsPerDay: number;
  listingsPerDay: number;
}

export const DEFAULT_LIMITS: MediaLimits = {
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
  maxImageBytes: 5 * 1024 * 1024,
  maxVideoBytes: 50 * 1024 * 1024,
  maxVideoSeconds: 60,
  maxImagesPerListing: 10,
  maxVideosPerListing: 1,
  uploadsPerDay: 100,
  listingsPerDay: 5,
};

export async function getMediaLimits(): Promise<MediaLimits> {
  const res = await fetchApi<MediaLimits>('/media/limits');
  return res.success && res.data ? res.data : DEFAULT_LIMITS;
}

export const formatMB = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

const MAX_IMAGE_DIMENSION = 1600;

/**
 * Shrinks a photo to at most 1600px on the long side and re-encodes it as JPEG.
 * Phone photos (4–8 MB) typically come out around 200–500 KB. Small images are left alone.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // undecodable here (e.g. some HEIC): let the server reject the type
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 400 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#fff'; // PNG transparency → white instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  return blob && blob.size < file.size ? blob : file;
}

/**
 * Reads a video's length in seconds. Returns undefined when the browser can't tell
 * (some WebM files, e.g. recorded on Android, report Infinity until fully scanned).
 */
export function videoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(value !== undefined && Number.isFinite(value) ? value : undefined);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) return done(video.duration);
      // Seeking far past the end makes the browser work out the real duration.
      const timeout = setTimeout(() => done(undefined), 3000);
      video.ontimeupdate = () => {
        video.ontimeupdate = null;
        clearTimeout(timeout);
        done(video.duration);
      };
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This video format could not be read. Try an MP4.'));
    };
    video.src = url;
  });
}

interface UploadTicket {
  uploadId: string;
  publicUrl: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
}

/**
 * Uploads straight to storage (Cloudflare R2 in production) with a short-lived signed URL,
 * so files never pass through the API server. Reports progress from 0 to 1.
 */
export async function uploadMedia(
  blob: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
  durationSeconds?: number
): Promise<{ uploadId: string; publicUrl: string }> {
  const ticket = await fetchApi<UploadTicket>('/media/uploads', {
    method: 'POST',
    body: JSON.stringify({ contentType, size: blob.size, durationSeconds }),
  });
  if (!ticket.success || !ticket.data) throw new Error(ticket.error?.message || 'Could not start the upload');
  const { uploadUrl, method, headers, uploadId, publicUrl } = ticket.data;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, uploadUrl);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(blob);
  });
  onProgress(1);
  return { uploadId, publicUrl };
}
