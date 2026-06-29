'use client';

import { useCallback, useRef, useState } from 'react';
import type { DuplicateStrategy } from '@/types/BulkUpload';
import type { BulkUploadState } from '../hooks/useBulkUpload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileArchive } from 'lucide-react';
import { TemplateDownload } from './TemplateDownload';
import { ValidationSummaryCard } from './ValidationSummary';
import { ImportPreview } from './ImportPreview';
import { DuplicateResolver } from './DuplicateResolver';
import { ImportProgress } from './ImportProgress';
import { ImportSummary } from './ImportSummary';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: BulkUploadState;
  setFile: (file: File | null) => void;
  setAutoCreateCategories: (value: boolean) => void;
  setDuplicateStrategy: (value: DuplicateStrategy) => void;
  uploadImageZip: (file: File) => Promise<number>;
  validate: () => Promise<void>;
  loadPreviewPage: (sessionId: string, page: number) => Promise<void>;
  updatePreviewRow: (rowNumber: number, updates: Partial<import('@/types/BulkUpload').ProductTemplateRow>) => Promise<void>;
  runImport: () => Promise<void>;
  undoImport: (batchId: string) => Promise<number>;
  hasUnsavedData: boolean;
  onImportComplete?: () => void;
}

export function UploadDialog({
  open,
  onOpenChange,
  state,
  setFile,
  setAutoCreateCategories,
  setDuplicateStrategy,
  uploadImageZip,
  validate,
  loadPreviewPage,
  updatePreviewRow,
  runImport,
  undoImport,
  hasUnsavedData,
  onImportComplete,
}: UploadDialogProps) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const totalPages = state.summary ? Math.ceil(state.summary.total / 50) : 1;

  const handleCloseRequest = useCallback(() => {
    if (hasUnsavedData && !state.importResult) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [hasUnsavedData, state.importResult, onOpenChange]);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(ext || '')) return;
      setFile(file);
    },
    [setFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0] || null);
    },
    [handleFile]
  );

  const handlePreviewPage = async (page: number) => {
    setPreviewPage(page);
    if (state.sessionId) await loadPreviewPage(state.sessionId, page);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCloseRequest(); else onOpenChange(true); }}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          showClose={false}
          onEscapeKeyDown={(e) => { e.preventDefault(); handleCloseRequest(); }}
          onPointerDownOutside={(e) => { e.preventDefault(); handleCloseRequest(); }}
        >
          <button
            type="button"
            onClick={handleCloseRequest}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-500 opacity-70 transition-all hover:opacity-100 hover:bg-gray-100 hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-blinkit-green"
            aria-label="Close upload dialog"
          >
            <span className="text-lg leading-none">×</span>
          </button>

          <DialogHeader>
            <DialogTitle>Bulk Product Upload</DialogTitle>
            <DialogDescription>
              Import products from Excel, CSV, or Google Sheets export. Nothing is saved until you confirm.
            </DialogDescription>
          </DialogHeader>

          <TemplateDownload />

          <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={state.autoCreateCategories}
              onChange={(e) => setAutoCreateCategories(e.target.checked)}
              className="accent-blinkit-green"
            />
            Auto Create Missing Categories
          </label>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors mb-4 ${
              dragOver ? 'border-blinkit-green bg-green-50' : 'border-gray-200 bg-gray-50/50'
            }`}
          >
            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium mb-1">Drag & drop your file here</p>
            <p className="text-xs text-gray-500 mb-4">Supports .xlsx, .xls, .csv — up to 10,000+ products</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Browse Files
              </Button>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await uploadImageZip(f);
                }}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => zipInputRef.current?.click()}>
                <FileArchive className="h-4 w-4" />
                Upload Image ZIP
              </Button>
            </div>
            {state.file && <p className="text-xs text-blinkit-green mt-3 font-medium">{state.file.name}</p>}
            {Object.keys(state.imageMap).length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{Object.keys(state.imageMap).length} images mapped from ZIP</p>
            )}
          </div>

          {state.error && (
            <div className="rounded-xl bg-red-50 text-red-700 text-sm p-3 mb-4" role="alert">{state.error}</div>
          )}

          {!state.sessionId && !state.isImporting && (
            <Button type="button" onClick={validate} disabled={!state.file || state.isValidating} className="w-full sm:w-auto" data-testid="preview-import-btn">
              {state.isValidating ? 'Validating...' : 'Preview Import'}
            </Button>
          )}

          {state.summary && !state.importResult && !state.isImporting && (
            <>
              <ValidationSummaryCard summary={state.summary} />
              <DuplicateResolver
                value={state.duplicateStrategy}
                onChange={setDuplicateStrategy}
                duplicateCount={state.summary.duplicate}
              />
              <ImportPreview
                rows={state.previewRows}
                page={previewPage}
                totalPages={totalPages}
                onPageChange={handlePreviewPage}
                onRowUpdate={updatePreviewRow}
              />
              <DialogFooter className="mt-4">
                <Button type="button" onClick={runImport}>Confirm Import</Button>
              </DialogFooter>
            </>
          )}

          {state.isImporting && state.progress && (
            <ImportProgress {...state.progress} />
          )}

          {state.importResult && (
            <ImportSummary
              result={state.importResult}
              canUndo={Boolean(state.batchId)}
              onUndo={
                state.batchId
                  ? async () => {
                      await undoImport(state.batchId!);
                      onImportComplete?.();
                    }
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="max-w-md" showClose={false}>
          <DialogHeader>
            <DialogTitle>Are you sure you want to close?</DialogTitle>
            <DialogDescription>Unsaved uploaded data will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { setShowCloseConfirm(false); onOpenChange(false); }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
