'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<unknown[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<string>('');

  async function handlePreview() {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/admin/bulk-upload', { method: 'POST', body: formData });
    const data = await res.json();
    setPreview(data.preview);
    setErrors(data.errors || []);
    setResult(`Ready to import ${data.success} products`);
  }

  async function handleImport() {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confirm', 'true');

    const res = await fetch('/api/admin/bulk-upload', { method: 'POST', body: formData });
    const data = await res.json();
    setResult(`Imported ${data.imported} products`);
    setErrors(data.errors || []);
    setPreview(null);
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Bulk Product Upload</h1>
      <p className="text-sm text-gray-500 mb-6">Upload Excel (.xlsx) or CSV with columns: Product Name, Category, Price, Unit, Stock, Image URL, Description</p>

      <div className="bg-white rounded-xl border border-gray-200 border-dashed p-8 text-center mb-4">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-4"
        />
        <div className="flex gap-3 justify-center">
          <Button onClick={handlePreview} disabled={!file}>Preview Import</Button>
          {preview && <Button onClick={handleImport}>Confirm Import</Button>}
        </div>
      </div>

      {result && <p className="text-blinkit-green font-semibold mb-4">{result}</p>}

      {errors.length > 0 && (
        <div className="bg-red-50 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-700 text-sm mb-2">Errors / Skipped</p>
          {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
        </div>
      )}

      {preview && (
        <div className="bg-white rounded-xl border p-4">
          <p className="font-semibold mb-2">Preview ({preview.length} products)</p>
          <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(preview, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
