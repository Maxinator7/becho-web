import React, { useRef, useState } from 'react';
import { ImagePlus, Video, X, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { MediaLimits, compressImage, formatMB, uploadMedia, videoDuration } from '../utils/media';

export interface MediaItem {
  key: string;
  kind: 'IMAGE' | 'VIDEO';
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  uploadId?: string;
  error?: string;
}

interface Props {
  items: MediaItem[];
  onChange: (update: (prev: MediaItem[]) => MediaItem[]) => void;
  limits: MediaLimits;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/**
 * Pick or drop photos/videos; each file is checked against the limits, photos are
 * resized, and uploads start immediately so publishing is instant.
 */
export const MediaUploader: React.FC<Props> = ({ items, onChange, limits }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (key: string, patch: Partial<MediaItem>) =>
    onChange((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  const startUpload = async (item: MediaItem, file: File) => {
    try {
      if (item.kind === 'VIDEO') {
        const seconds = await videoDuration(file);
        if (seconds !== undefined && seconds > limits.maxVideoSeconds + 0.5) {
          throw new Error(`Video is ${Math.round(seconds)}s; the limit is ${limits.maxVideoSeconds}s`);
        }
        const res = await uploadMedia(file, file.type, (p) => update(item.key, { progress: p }), seconds === undefined ? undefined : Math.floor(seconds));
        update(item.key, { status: 'done', uploadId: res.uploadId });
      } else {
        const blob = await compressImage(file);
        if (blob.size > limits.maxImageBytes) throw new Error(`Photo is larger than ${formatMB(limits.maxImageBytes)}`);
        const type = blob === file ? file.type : 'image/jpeg';
        const res = await uploadMedia(blob, type, (p) => update(item.key, { progress: p }));
        update(item.key, { status: 'done', uploadId: res.uploadId });
      }
    } catch (err) {
      update(item.key, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
    }
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const problems: string[] = [];
    let images = items.filter((m) => m.kind === 'IMAGE' && m.status !== 'error').length;
    let videos = items.filter((m) => m.kind === 'VIDEO' && m.status !== 'error').length;
    const added: { item: MediaItem; file: File }[] = [];

    for (const file of Array.from(fileList)) {
      const isImage = IMAGE_TYPES.includes(file.type);
      const isVideo = VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        problems.push(`${file.name}: only JPG, PNG, WebP photos and MP4, WebM, MOV videos are supported`);
        continue;
      }
      if (isImage && images >= limits.maxImagesPerListing) {
        problems.push(`You can add up to ${limits.maxImagesPerListing} photos`);
        continue;
      }
      if (isVideo && videos >= limits.maxVideosPerListing) {
        problems.push(`You can add up to ${limits.maxVideosPerListing} video${limits.maxVideosPerListing > 1 ? 's' : ''}`);
        continue;
      }
      if (isVideo && file.size > limits.maxVideoBytes) {
        problems.push(`${file.name}: videos must be under ${formatMB(limits.maxVideoBytes)}`);
        continue;
      }
      // Photos larger than the limit are usually fine after resizing, so they're checked after compression.
      if (isImage) images++;
      else videos++;
      added.push({
        file,
        item: {
          key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: isImage ? 'IMAGE' : 'VIDEO',
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          progress: 0,
        },
      });
    }

    setNotice(problems.length ? Array.from(new Set(problems)).join('. ') : null);
    if (!added.length) return;
    onChange((prev) => [...prev, ...added.map((a) => a.item)]);
    added.forEach(({ item, file }) => void startUpload(item, file));
  };

  const remove = (key: string) =>
    onChange((prev) => {
      const gone = prev.find((m) => m.key === key);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((m) => m.key !== key);
    });

  const moveFirst = (key: string) =>
    onChange((prev) => {
      const idx = prev.findIndex((m) => m.key === key);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return next;
    });

  const photoCount = items.filter((m) => m.kind === 'IMAGE').length;
  const videoCount = items.filter((m) => m.kind === 'VIDEO').length;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        style={{ border: `2px dashed ${dragging ? 'var(--accent-primary)' : 'var(--input-border)'}`, background: dragging ? 'var(--surface-3)' : 'var(--surface-1)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>
          <ImagePlus size={26} /> <Video size={26} />
        </div>
        <div style={{ fontWeight: 600 }}>Add photos and a video</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Click or drag files here · up to {limits.maxImagesPerListing} photos and {limits.maxVideosPerListing} video
          ({formatMB(limits.maxVideoBytes)}, {limits.maxVideoSeconds}s max)
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(',')}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </div>

      {notice && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: 'var(--danger)', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} /> {notice}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.6rem', marginTop: '0.85rem' }}>
            {items.map((m, i) => (
              <div key={m.key} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', background: 'var(--surface-3)', border: m.status === 'error' ? '2px solid var(--danger)' : '1px solid var(--border-color)' }}>
                {m.kind === 'VIDEO' ? (
                  <video src={m.previewUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={m.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}

                {i === 0 && m.kind === 'IMAGE' && (
                  <span style={{ position: 'absolute', left: '6px', top: '6px', padding: '1px 7px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#fff', fontSize: '0.68rem', fontWeight: 700 }}>Cover</span>
                )}
                {m.kind === 'VIDEO' && (
                  <span style={{ position: 'absolute', left: '6px', top: '6px', padding: '1px 7px', borderRadius: '6px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}><Video size={11} /> Video</span>
                )}

                <button type="button" onClick={() => remove(m.key)} aria-label="Remove" title="Remove"
                  style={{ position: 'absolute', right: '5px', top: '5px', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={14} />
                </button>
                {i > 0 && m.kind === 'IMAGE' && m.status === 'done' && (
                  <button type="button" onClick={() => moveFirst(m.key)} title="Make cover photo"
                    style={{ position: 'absolute', left: '5px', bottom: '5px', padding: '2px 7px', borderRadius: '6px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <ArrowLeft size={11} /> Cover
                  </button>
                )}

                {m.status === 'uploading' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '0.35rem', fontSize: '0.75rem' }}>
                    <Loader2 size={20} style={{ animation: 'becho-spin 1s linear infinite' }} />
                    {Math.round(m.progress * 100)}%
                    <div style={{ position: 'absolute', left: 0, bottom: 0, height: '4px', width: `${m.progress * 100}%`, background: 'var(--accent-primary)' }} />
                  </div>
                )}
                {m.status === 'error' && (
                  <div title={m.error} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '4px 6px', background: 'var(--danger)', color: '#fff', fontSize: '0.68rem', lineHeight: 1.3 }}>
                    {m.error}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
            {photoCount}/{limits.maxImagesPerListing} photos · {videoCount}/{limits.maxVideosPerListing} video · the first photo is the cover
          </div>
        </>
      )}
    </div>
  );
};
