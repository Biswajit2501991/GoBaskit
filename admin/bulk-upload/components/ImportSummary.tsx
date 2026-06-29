'use client';

import type { ImportResult } from '@/types/BulkUpload';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download } from 'lucide-react';

interface Props {
  result: ImportResult;
  onUndo?: () => void;
  canUndo?: boolean;
}

export function ImportSummary({ result, onUndo, canUndo }: Props) {
  function downloadErrorReport() {
    const lines = [
      'GoBaskit Bulk Import Error Report',
      `Imported: ${result.imported}`,
      `Updated: ${result.updated}`,
      `Skipped: ${result.skipped}`,
      `Failed: ${result.failed}`,
      '',
      'Errors:',
      ...result.errors.map((e, i) => `${i + 1}. ${e}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-error-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-5 w-5 text-blinkit-green" />
        <h3 className="font-semibold text-green-900">Upload Complete</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
        <div><span className="font-bold text-green-800">{result.imported}</span> Imported</div>
        <div><span className="font-bold text-blue-800">{result.updated}</span> Updated</div>
        <div><span className="font-bold text-amber-800">{result.skipped}</span> Skipped</div>
        <div><span className="font-bold text-red-800">{result.failed}</span> Failed</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.errors.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={downloadErrorReport}>
            <Download className="h-4 w-4" />
            Download Error Report
          </Button>
        )}
        {canUndo && onUndo && (
          <Button type="button" variant="secondary" size="sm" onClick={onUndo}>
            Undo Last Import
          </Button>
        )}
      </div>
    </div>
  );
}
