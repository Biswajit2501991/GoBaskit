import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/staff-auth';
import { SettingsService } from '@/services/SettingsService';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';

const settingsSchema = z.object({
  serviceablePins: z.array(z.string().regex(/^\d{6}$/, 'PIN must be 6 digits')).optional(),
  deliverySlabs: z
    .array(
      z.object({
        min: z.number().min(0),
        max: z.number().min(0),
        charge: z.number().min(0),
      })
    )
    .optional(),
  minOrderValue: z.number().min(0).optional(),
  storeTiming: z.string().min(3).max(64).optional(),
  storeStatus: z.enum(['OPEN', 'CLOSED', 'HOLIDAY']).optional(),
  holidayMode: z.boolean().optional(),
  paymentMethods: z.array(z.string().min(1)).optional(),
  whatsappTemplates: z.record(z.string(), z.string().max(500)).optional(),
  homepageConfig: z
    .object({
      showHeroBanner: z.boolean().optional(),
      showCategories: z.boolean().optional(),
      showBestSellers: z.boolean().optional(),
      showOffers: z.boolean().optional(),
      announcementBarText: z.string().max(200).optional(),
      deliveryTimeText: z.string().max(120).optional(),
      themeColor: z.string().max(20).optional(),
    })
    .optional(),
});

export async function GET() {
  const auth = await requireStaffPermission('settings:view');
  if (auth.error) return auth.error;
  const config = await SettingsService.getStoreConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaffPermission('settings:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await SettingsService.updateStoreConfig(parsed.data);
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'settings_updated',
    entity: 'settings',
    meta: { changedKeys: Object.keys(parsed.data) },
  });
  return NextResponse.json(updated);
}
