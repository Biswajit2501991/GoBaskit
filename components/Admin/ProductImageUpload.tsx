'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { resolvePublicImageUrl } from '@/utils/image';

interface ProductImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  disabled?: boolean;
  searchName?: string;
  searchCategory?: string;
  uploadType?: 'product' | 'category';
  showWebSuggestions?: boolean;
}

export default function ProductImageUpload({
  value,
  onChange,
  label = 'Product Image',
  disabled = false,
  searchName = '',
  searchCategory = '',
  uploadType = 'product',
  showWebSuggestions = uploadType === 'product',
}: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; url: string; label: string }>>([]);
  const [webLoading, setWebLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (disabled) return;
    setUploadError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType);

      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
        return;
      }

      onChange(data.url);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onChange, disabled, uploadType]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) uploadFile(file);
    else setUploadError('Please drop an image file');
  }

  async function loadWebSuggestions() {
    if (!searchName.trim()) {
      setUploadError('Enter product name first to get web suggestions.');
      return;
    }

    setUploadError('');
    setWebLoading(true);
    try {
      const params = new URLSearchParams({
        name: searchName,
        category: searchCategory,
      });
      const res = await fetch(`/api/admin/upload/suggest?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error || 'Failed to fetch web suggestions');
        return;
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      setUploadError('Failed to fetch web suggestions');
    } finally {
      setWebLoading(false);
    }
  }

  async function importFromWeb(url: string, id: string) {
    if (disabled) return;
    setUploading(true);
    setImportingId(id);
    setUploadError('');
    try {
      const res = await fetch('/api/admin/upload/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: uploadType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error || 'Failed to import image');
        return;
      }
      onChange(data.url);
    } catch {
      setUploadError('Failed to import image');
    } finally {
      setUploading(false);
      setImportingId(null);
    }
  }

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-3">
      <Label>{label}</Label>

      {value && (
        <div className="relative inline-block">
          <div className="w-32 h-32 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            <img src={resolvePublicImageUrl(value)} alt="Image preview" className="w-full h-full object-contain" />
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragOver ? 'border-blinkit-green bg-blinkit-green-light' : 'border-gray-200 hover:border-blinkit-green hover:bg-gray-50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-blinkit-green" />
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Upload className="w-8 h-8 text-blinkit-green" />
            <p className="text-sm font-medium text-gray-700">
              {value ? 'Click or drag to replace image' : 'Click or drag image to upload'}
            </p>
            <p className="text-xs">JPG, PNG, WebP, GIF · max 5MB</p>
          </div>
        )}
      </div>

      {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}

      <div>
        <Label className="text-gray-400 normal-case tracking-normal">Or paste image URL</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`https://... or /uploads/${uploadType === 'category' ? 'categories' : 'products'}/...`}
          className="mt-1"
          disabled={disabled}
        />
      </div>

      {showWebSuggestions && (
        <div className="pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              Find image online by product name (India-focused suggestions).
            </p>
            <button
              type="button"
              onClick={loadWebSuggestions}
              disabled={disabled || webLoading}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
            >
              {webLoading ? 'Loading...' : 'Get from Web'}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => importFromWeb(s.url, s.id)}
                  disabled={disabled || uploading}
                  className="border rounded-lg overflow-hidden hover:border-blinkit-green transition-colors text-left"
                >
                  <div className="aspect-square bg-gray-50">
                    <img src={s.url} alt={s.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="px-2 py-1 text-[11px] text-gray-600">
                    {importingId === s.id ? 'Saving...' : 'Use this image'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
