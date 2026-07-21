import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { BulkPriceAdjustService, normalizePercent } from '@/services/BulkPriceAdjustService';

const bodySchema = z.object({
  action: z.enum(['preview', 'apply', 'undo', 'status']),
  percent: z.number().optional(),
  categoryId: z.string().min(1).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('products:edit', { live: true });
  if (auth.error) return auth.error;

  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { action, categoryId } = parsed.data;

  try {
    if (action === 'status') {
      const status = await BulkPriceAdjustService.getUndoStatus();
      return NextResponse.json(status);
    }

    if (action === 'undo') {
      const result = await BulkPriceAdjustService.undo();
      await AuditService.log({
        staffId: auth.staff?.id,
        action: 'bulk_price_undo',
        entity: 'products',
        meta: result,
      });
      return NextResponse.json(result);
    }

    const percent = normalizePercent(parsed.data.percent);
    if (percent == null) {
      return NextResponse.json(
        { error: 'Percent must be a non-zero number between -90 and 500' },
        { status: 400 },
      );
    }

    if (action === 'preview') {
      const preview = await BulkPriceAdjustService.preview({
        percent,
        categoryId: categoryId ?? null,
      });
      return NextResponse.json(preview);
    }

    const result = await BulkPriceAdjustService.apply({
      percent,
      categoryId: categoryId ?? null,
    });
    await AuditService.log({
      staffId: auth.staff?.id,
      action: 'bulk_price_apply',
      entity: 'products',
      meta: {
        percent: result.percent,
        categoryId: result.categoryId,
        updatedProducts: result.updatedProducts,
        updatedVariants: result.updatedVariants,
        skipped: result.skipped,
        undoId: result.undo.id,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bulk price adjust failed';
    const status = /invalid category|nothing to undo|undo window|no prices|percent/i.test(message)
      ? 400
      : 500;
    if (status === 500) console.error('[admin/products/bulk-price]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
