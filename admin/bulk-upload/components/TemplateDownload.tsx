'use client';

import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { GOOGLE_SHEETS_HELP_URL } from '@/services/bulk-upload/TemplateService';

export function TemplateDownload() {
  function download(format: 'xlsx' | 'csv') {
    window.open(`/api/admin/bulk-upload/template?format=${format}`, '_blank');
  }

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Download Product Template</h2>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => download('xlsx')}>
          <Download className="h-4 w-4" />
          Download Excel Template (.xlsx)
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => download('csv')}>
          <Download className="h-4 w-4" />
          Download CSV Template
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            download('xlsx');
            window.open(GOOGLE_SHEETS_HELP_URL, '_blank', 'noopener,noreferrer');
          }}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Open in Google Sheets
        </Button>
      </div>
      <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
        <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
        Google Sheets: download the Excel template, then use File → Import to upload it. Categories sheet includes live dropdown values.
      </p>
    </div>
  );
}
