'use client';

import { useRef, useState } from 'react';
import { ApiError, mediaUrl, uploadSellerProductImage } from '@/lib/api';
import { ImagePlus, Loader2, X } from 'lucide-react';

export function ProductImageUpload({
  value, onChange, token,
}: { value: string; onChange: (url: string) => void; token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image is too large - max 8MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    try {
      const { url } = await uploadSellerProductImage(file, token);
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload image.');
      setPreview('');
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  const displaySrc = preview || (value ? mediaUrl(value) : '');

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {displaySrc ? (
        <div className="relative w-28 h-28 rounded-[10px] overflow-hidden border border-line group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displaySrc} alt="Product" className="w-full h-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={() => { setPreview(''); onChange(''); }}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove photo"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-28 h-28 rounded-[10px] border-2 border-dashed border-line flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-orange hover:text-orange transition-colors"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          <span className="text-[0.68rem] font-semibold">{uploading ? 'Uploading…' : 'Add photo'}</span>
        </button>
      )}
      {displaySrc && !uploading && (
        <button type="button" onClick={() => inputRef.current?.click()} className="block mt-1.5 text-[0.7rem] font-semibold text-navy hover:underline">
          Change photo
        </button>
      )}
      {error && <p className="text-[0.7rem] text-danger mt-1 max-w-[7rem]">{error}</p>}
    </div>
  );
}
