'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ProductImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ProductImageUpload({ value, onChange, label = 'Product Image' }: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    setUploadError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'product');

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
  }, [onChange]);

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

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-3">
      <Label>{label}</Label>

      {value && (
        <div className="relative inline-block">
          <div className="w-32 h-32 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            <img src={value} alt="Product preview" className="w-full h-full object-contain" />
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
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
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blinkit-green bg-blinkit-green-light' : 'border-gray-200 hover:border-blinkit-green hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
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
          placeholder="https://... or /uploads/products/..."
          className="mt-1"
        />
      </div>
    </div>
  );
}
