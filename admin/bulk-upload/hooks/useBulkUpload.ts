'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  DuplicateStrategy,
  ImportBatchRecord,
  ImportResult,
  ProductTemplateRow,
  ValidationSummary,
  ValidatedRow,
} from '@/types/BulkUpload';

const CHUNK_SIZE = 50;

export interface BulkUploadState {
  file: File | null;
  sessionId: string | null;
  summary: ValidationSummary | null;
  previewRows: ValidatedRow[];
  imageMap: Record<string, string>;
  autoCreateCategories: boolean;
  duplicateStrategy: DuplicateStrategy;
  progress: {
    processed: number;
    total: number;
    percent: number;
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    speed: number;
    etaSeconds: number;
  } | null;
  importResult: ImportResult | null;
  batchId: string | null;
  history: ImportBatchRecord[];
  isValidating: boolean;
  isImporting: boolean;
  error: string | null;
}

const initialState: BulkUploadState = {
  file: null,
  sessionId: null,
  summary: null,
  previewRows: [],
  imageMap: {},
  autoCreateCategories: true,
  duplicateStrategy: 'skip',
  progress: null,
  importResult: null,
  batchId: null,
  history: [],
  isValidating: false,
  isImporting: false,
  error: null,
};

export function useBulkUpload() {
  const [state, setState] = useState<BulkUploadState>(initialState);
  const startTimeRef = useRef<number>(0);

  const setFile = useCallback((file: File | null) => {
    setState((s) => ({ ...s, file, sessionId: null, summary: null, previewRows: [], importResult: null, error: null }));
  }, []);

  const setAutoCreateCategories = useCallback((value: boolean) => {
    setState((s) => ({ ...s, autoCreateCategories: value }));
  }, []);

  const setDuplicateStrategy = useCallback((value: DuplicateStrategy) => {
    setState((s) => ({ ...s, duplicateStrategy: value }));
  }, []);

  const uploadImageZip = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/bulk-upload/images', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'ZIP upload failed');
    setState((s) => ({ ...s, imageMap: { ...s.imageMap, ...data.imageMap } }));
    return data.count as number;
  }, []);

  const validate = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, isValidating: true, error: null }));
    try {
      const formData = new FormData();
      formData.append('file', state.file);
      formData.append('autoCreateCategories', String(state.autoCreateCategories));
      const res = await fetch('/api/admin/bulk-upload/validate', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');
      setState((s) => ({
        ...s,
        sessionId: data.sessionId,
        summary: data.summary,
        previewRows: data.rows,
        isValidating: false,
      }));
    } catch (e) {
      setState((s) => ({ ...s, isValidating: false, error: e instanceof Error ? e.message : 'Validation failed' }));
    }
  }, [state.file, state.autoCreateCategories]);

  const loadPreviewPage = useCallback(async (sessionId: string, page: number) => {
    const res = await fetch(`/api/admin/bulk-upload/session?sessionId=${sessionId}&page=${page}&pageSize=50`);
    const data = await res.json();
    if (res.ok) setState((s) => ({ ...s, previewRows: data.rows }));
  }, []);

  const updatePreviewRow = useCallback(
    async (rowNumber: number, updates: Partial<ProductTemplateRow>) => {
      if (!state.sessionId) return;
      const res = await fetch('/api/admin/bulk-upload/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          rowNumber,
          updates,
          autoCreateCategories: state.autoCreateCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update row');
      setState((s) => ({
        ...s,
        summary: data.summary,
        previewRows: s.previewRows.map((r) => (r.row.rowNumber === rowNumber ? data.row : r)),
      }));
    },
    [state.sessionId, state.autoCreateCategories]
  );

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/admin/bulk-upload/history');
    const data = await res.json();
    if (res.ok) setState((s) => ({ ...s, history: data.history }));
  }, []);

  const runImport = useCallback(async () => {
    if (!state.sessionId || !state.summary) return;
    setState((s) => ({ ...s, isImporting: true, error: null, progress: null }));
    startTimeRef.current = Date.now();

    const total = state.summary.total;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const allErrors: string[] = [];
    let batchId: string | undefined;

    try {
      for (let start = 0; start < total; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, total);
        const res = await fetch('/api/admin/bulk-upload/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.sessionId,
            start,
            end,
            duplicateStrategy: state.duplicateStrategy,
            autoCreateCategories: state.autoCreateCategories,
            imageMap: state.imageMap,
          }),
        });
        const chunk = await res.json();
        if (!res.ok) throw new Error(chunk.error || 'Import failed');

        imported += chunk.imported;
        updated += chunk.updated;
        skipped += chunk.skipped;
        failed += chunk.failed;
        allErrors.push(...(chunk.errors || []));
        if (chunk.batchId) batchId = chunk.batchId;

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const processed = end;
        const speed = processed / Math.max(elapsed, 0.1);
        const remaining = total - processed;
        const etaSeconds = remaining / Math.max(speed, 0.1);

        setState((s) => ({
          ...s,
          progress: {
            processed,
            total,
            percent: Math.round((processed / total) * 100),
            imported,
            updated,
            skipped,
            failed,
            speed: Math.round(speed),
            etaSeconds: Math.round(etaSeconds),
          },
        }));
      }

      setState((s) => ({
        ...s,
        isImporting: false,
        importResult: { imported, updated, skipped, failed, errors: allErrors, batchId },
        batchId: batchId ?? null,
      }));
      await loadHistory();
    } catch (e) {
      setState((s) => ({
        ...s,
        isImporting: false,
        error: e instanceof Error ? e.message : 'Import failed',
      }));
    }
  }, [state.sessionId, state.summary, state.duplicateStrategy, state.autoCreateCategories, state.imageMap, loadHistory]);

  const undoImport = useCallback(async (batchId: string) => {
    const res = await fetch('/api/admin/bulk-upload/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Undo failed');
    await loadHistory();
    return data.undone as number;
  }, [loadHistory]);

  const reset = useCallback(() => setState(initialState), []);

  const hasUnsavedData = Boolean(state.file || state.sessionId);

  return {
    state,
    setFile,
    setAutoCreateCategories,
    setDuplicateStrategy,
    uploadImageZip,
    validate,
    loadPreviewPage,
    updatePreviewRow,
    runImport,
    loadHistory,
    undoImport,
    reset,
    hasUnsavedData,
  };
}
