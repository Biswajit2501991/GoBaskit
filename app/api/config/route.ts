import { NextResponse } from 'next/server';
import { SettingsService } from '@/services/SettingsService';

// Public store config for the client (serviceable PINs, delivery slabs, min order).
// Served from the SettingsService in-memory cache, so it does not add DB load per request.
export async function GET() {
  const config = await SettingsService.getStoreConfig();
  return NextResponse.json(config);
}
