'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { UploadDialog } from '@/admin/bulk-upload/components/UploadDialog';
import { UploadHistory } from '@/admin/bulk-upload/components/UploadHistory';
import { useBulkUpload } from '@/admin/bulk-upload/hooks/useBulkUpload';

export default function BulkUploadPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { state, loadHistory, undoImport, setFile, setAutoCreateCategories, setDuplicateStrategy, uploadImageZip, validate, loadPreviewPage, updatePreviewRow, runImport, hasUnsavedData } = useBulkUpload();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Bulk Product Upload</h1>
          <p className="text-sm text-gray-500">
            Import hundreds or thousands of products with validation, preview, and instant store sync.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="start-upload-btn">
          <Upload className="h-4 w-4" />
          Start Upload
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h2 className="font-semibold mb-2">Quick Start</h2>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Download the product template (Excel, CSV, or Google Sheets)</li>
          <li>Fill in product details — categories sheet includes live values</li>
          <li>Upload file, review validation preview, then confirm import</li>
          <li>Products appear on the website immediately — no manual sync needed</li>
        </ol>
      </div>

      <UploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        state={state}
        setFile={setFile}
        setAutoCreateCategories={setAutoCreateCategories}
        setDuplicateStrategy={setDuplicateStrategy}
        uploadImageZip={uploadImageZip}
        validate={validate}
        loadPreviewPage={loadPreviewPage}
        updatePreviewRow={updatePreviewRow}
        runImport={runImport}
        undoImport={undoImport}
        hasUnsavedData={hasUnsavedData}
        onImportComplete={loadHistory}
      />

      <UploadHistory
        history={state.history}
        onRefresh={loadHistory}
        onUndo={async (batchId) => {
          await undoImport(batchId);
        }}
      />
    </div>
  );
}
