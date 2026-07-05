'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';

interface PreviewRow {
  rowNumber: number;
  name: string;
  mobile: string;
  email: string | null;
  role: string;
  valid: boolean;
  errors: string[];
}

interface ImportReport {
  total: number;
  created: number;
  failed: number;
  errors: Array<{ rowNumber: number; mobile?: string; errors: string[] }>;
}

export default function StaffBulkImport({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; summary: { total: number; valid: number; invalid: number } } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFile(null);
    setPreview(null);
    setReport(null);
    setError('');
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setReport(null);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/staff/bulk-import/preview', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Preview failed');
      setLoading(false);
      return;
    }
    setPreview(data);
    setLoading(false);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/staff/bulk-import/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Import failed');
      setLoading(false);
      return;
    }
    setReport(data);
    setLoading(false);
    onComplete?.();
  };

  const downloadTemplate = useCallback((format: 'xlsx' | 'csv') => {
    window.open(`/api/admin/staff/bulk-import/template?format=${format}`, '_blank');
  }, []);

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); reset(); }} className="gap-1">
        <Upload className="w-4 h-4" /> Bulk Import
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Bulk Staff Import</h2>
              <button type="button" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate('xlsx')} className="gap-1">
                <Download className="w-4 h-4" /> Excel Template
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate('csv')} className="gap-1">
                <Download className="w-4 h-4" /> CSV Template
              </Button>
            </div>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setReport(null); }}
              className="block w-full text-sm"
            />

            <div className="flex gap-2">
              <Button type="button" onClick={handlePreview} disabled={!file || loading}>
                Preview & Validate
              </Button>
              {preview && preview.summary.valid > 0 && (
                <Button type="button" onClick={handleImport} disabled={loading}>
                  Import {preview.summary.valid} Valid Rows
                </Button>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {preview && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {preview.summary.valid} valid · {preview.summary.invalid} invalid · {preview.summary.total} total
                </p>
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Row</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Mobile</th>
                        <th className="p-2 text-left">Role</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber} className="border-t">
                          <td className="p-2">{row.rowNumber}</td>
                          <td className="p-2">{row.name}</td>
                          <td className="p-2">{row.mobile}</td>
                          <td className="p-2">{row.role}</td>
                          <td className="p-2">
                            {row.valid ? (
                              <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> OK</span>
                            ) : (
                              <span className="text-red-500 flex items-center gap-1" title={row.errors.join(', ')}>
                                <AlertCircle className="w-3 h-3" /> {row.errors[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {report && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                <p className="font-semibold text-green-800">Import complete</p>
                <p className="text-green-700 mt-1">
                  Created {report.created} of {report.total} rows
                  {report.failed > 0 && ` · ${report.failed} skipped/failed`}
                </p>
                {report.errors.length > 0 && (
                  <ul className="mt-2 text-red-600 list-disc pl-4">
                    {report.errors.slice(0, 5).map((e) => (
                      <li key={e.rowNumber}>Row {e.rowNumber}: {e.errors.join(', ')}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
