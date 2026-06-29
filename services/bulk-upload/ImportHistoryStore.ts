import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  ImportBatchRecord,
  ImportSessionMeta,
  ValidatedRow,
  ValidationSummary,
} from '@/types/BulkUpload';

const DATA_DIR = path.join(process.cwd(), 'data', 'import-sessions');
const HISTORY_KEY = 'bulk_import_history';
const UNDO_WINDOW_MS = 10 * 60 * 1000;

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function saveSession(
  rows: ValidatedRow[],
  meta: Omit<ImportSessionMeta, 'id' | 'createdAt'>
): Promise<string> {
  await ensureDir();
  const id = randomUUID();
  const session = {
    id,
    createdAt: new Date().toISOString(),
    ...meta,
    rows,
  };
  await writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(session));
  return id;
}

function sessionPath(sessionId: string) {
  return path.join(DATA_DIR, sessionId.endsWith('.json') ? sessionId : `${sessionId}.json`);
}

export async function loadSession(sessionId: string) {
  await ensureDir();
  const raw = await readFile(sessionPath(sessionId), 'utf-8');
  return JSON.parse(raw) as {
    id: string;
    createdAt: string;
    filename: string;
    adminEmail: string;
    rowCount: number;
    summary: ValidationSummary;
    rows: ValidatedRow[];
    importProgress?: {
      productIds: string[];
      createdCategoryIds: string[];
      imported: number;
      updated: number;
      skipped: number;
      failed: number;
      errors: string[];
    };
  };
}

export async function updateSessionImportProgress(
  sessionId: string,
  delta: {
    productIds: string[];
    createdCategoryIds: string[];
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
  }
) {
  const session = await loadSession(sessionId);
  const prev = session.importProgress ?? {
    productIds: [],
    createdCategoryIds: [],
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };
  session.importProgress = {
    productIds: [...prev.productIds, ...delta.productIds],
    createdCategoryIds: [...new Set([...prev.createdCategoryIds, ...delta.createdCategoryIds])],
    imported: prev.imported + delta.imported,
    updated: prev.updated + delta.updated,
    skipped: prev.skipped + delta.skipped,
    failed: prev.failed + delta.failed,
    errors: [...prev.errors, ...delta.errors],
  };
  await writeFile(sessionPath(sessionId), JSON.stringify(session));
  return session.importProgress;
}

export async function saveSessionRows(
  sessionId: string,
  rows: ValidatedRow[],
  summary: ValidationSummary
) {
  const session = await loadSession(sessionId);
  session.rows = rows;
  session.summary = summary;
  session.rowCount = rows.length;
  await writeFile(sessionPath(sessionId), JSON.stringify(session));
}

export async function deleteSession(sessionId: string) {
  try {
    await unlink(sessionPath(sessionId));
  } catch {
    /* ignore */
  }
}

export async function getSessionPage(sessionId: string, page: number, pageSize: number) {
  const session = await loadSession(sessionId);
  const start = (page - 1) * pageSize;
  const rows = session.rows.slice(start, start + pageSize);
  return { ...session, rows, page, pageSize, totalPages: Math.ceil(session.rows.length / pageSize) };
}

export async function cleanupExpiredSessions() {
  await ensureDir();
  const files = await readdir(DATA_DIR);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await readFile(path.join(DATA_DIR, file), 'utf-8');
      const session = JSON.parse(raw) as { createdAt: string };
      if (new Date(session.createdAt).getTime() < cutoff) {
        await unlink(path.join(DATA_DIR, file));
      }
    } catch {
      /* ignore */
    }
  }
}

export async function loadHistoryFromSettings(prisma: { setting: { findUnique: Function; upsert: Function } }) {
  const row = await prisma.setting.findUnique({ where: { key: HISTORY_KEY } });
  if (!row) return [] as ImportBatchRecord[];
  try {
    return JSON.parse(row.value) as ImportBatchRecord[];
  } catch {
    return [];
  }
}

export async function saveHistoryBatch(
  prisma: { setting: { findUnique: Function; upsert: Function } },
  batch: ImportBatchRecord
) {
  const history = await loadHistoryFromSettings(prisma);
  history.unshift(batch);
  const trimmed = history.slice(0, 50);
  await prisma.setting.upsert({
    where: { key: HISTORY_KEY },
    create: { key: HISTORY_KEY, value: JSON.stringify(trimmed) },
    update: { value: JSON.stringify(trimmed) },
  });
}

export function createBatchRecord(
  adminEmail: string,
  filename: string,
  productIds: string[],
  createdCategoryIds: string[],
  stats: { imported: number; updated: number; skipped: number; failed: number; errors: string[] }
): ImportBatchRecord {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    adminEmail,
    filename,
    imported: stats.imported,
    updated: stats.updated,
    skipped: stats.skipped,
    failed: stats.failed,
    productIds,
    createdCategoryIds,
    expiresAt: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
    errors: stats.errors,
  };
}

export function canUndoBatch(batch: ImportBatchRecord): boolean {
  return new Date(batch.expiresAt).getTime() > Date.now();
}

export { UNDO_WINDOW_MS };
