import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';

export interface MemberStatusResult {
  isActive: boolean;
  mobile: string;
  memberId: string | null;
  memberCode: string | null;
  fullName: string | null;
  error?: string;
}

interface CacheEntry {
  result: MemberStatusResult;
  expiresAt: number;
}

const CACHE_TTL_MS = 12 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getBaseUrl(): string {
  return (process.env.ACTION_PLUS_API_BASE_URL || '').replace(/\/$/, '');
}

function getGymId(): string {
  return process.env.APG_GYM_ID || '48815df4-6144-40dd-bbd6-91fd8522d1ff';
}

function getApiKey(): string | undefined {
  const key = process.env.MEMBER_STATUS_PUBLIC_API_KEY?.trim();
  return key || undefined;
}

/**
 * Server-only client for Action Plus public member-status API.
 * Fails closed (isActive=false) on network/config errors so checkout never
 * grants a membership discount without a confirmed active member.
 */
export class ActionPlusMembershipClient {
  static clearCache(mobile?: string) {
    if (!mobile) {
      cache.clear();
      return;
    }
    cache.delete(normalizeMobile(mobile));
  }

  static async getMemberStatus(mobileInput: string): Promise<MemberStatusResult> {
    const mobile = normalizeMobile(mobileInput);
    if (!isValidIndianMobile(mobile)) {
      return {
        isActive: false,
        mobile,
        memberId: null,
        memberCode: null,
        fullName: null,
        error: 'Invalid mobile number',
      };
    }

    const cached = cache.get(mobile);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const base = getBaseUrl();
    if (!base) {
      return {
        isActive: false,
        mobile,
        memberId: null,
        memberCode: null,
        fullName: null,
        error: 'Membership service not configured',
      };
    }

    const gymId = getGymId();
    const url = new URL(`${base}/api/public/member-status`);
    url.searchParams.set('mobile', mobile);
    url.searchParams.set('gymId', gymId);

    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = getApiKey();
    if (apiKey) {
      headers['X-APG-Member-Status-Key'] = apiKey;
      url.searchParams.set('apiKey', apiKey);
    }

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });
      if (!res.ok) {
        return {
          isActive: false,
          mobile,
          memberId: null,
          memberCode: null,
          fullName: null,
          error: 'Membership lookup failed',
        };
      }
      const data = (await res.json()) as {
        ok?: boolean;
        isActive?: boolean;
        members?: Array<{
          memberId?: string | number;
          memberCode?: string;
          fullName?: string;
          isActive?: boolean;
        }>;
      };

      const members = Array.isArray(data.members) ? data.members : [];
      const active = members.find((m) => m.isActive) ?? members[0];
      const result: MemberStatusResult = {
        isActive: data.isActive === true || members.some((m) => m.isActive),
        mobile,
        memberId: active?.memberId != null ? String(active.memberId) : null,
        memberCode: active?.memberCode ?? null,
        fullName: active?.fullName ?? null,
      };
      cache.set(mobile, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    } catch {
      return {
        isActive: false,
        mobile,
        memberId: null,
        memberCode: null,
        fullName: null,
        error: 'Membership service unavailable',
      };
    }
  }
}
