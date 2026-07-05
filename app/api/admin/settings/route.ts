import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth';
import { SettingsService } from '@/services/SettingsService';

async function requireAdmin() {
  return getAdminSession();
}

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
});

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const config = await SettingsService.getStoreConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await SettingsService.updateStoreConfig(parsed.data);
  return NextResponse.json(updated);
}
