/** Survives same-window WhatsApp navigation so reset/create-password can resume. */

export const ACCOUNT_AUTH_FLOW_KEY = 'gobaskit_account_auth_flow';
const FLOW_TTL_MS = 15 * 60 * 1000;

export type AccountAuthFlowPhase = 'waiting' | 'create-password';

export type AccountAuthFlow = {
  mobile10: string;
  mobileE164: string;
  verificationId: string | null;
  verificationCode: string | null;
  whatsappUrl: string | null;
  phase: AccountAuthFlowPhase;
  resetting: boolean;
  hasExistingPassword: boolean;
  savedAt: number;
};

export function nextAccountPhaseAfterProof(opts: {
  resetting: boolean;
  hasExistingPassword: boolean;
}): 'create-password' | 'password' {
  if (opts.resetting) return 'create-password';
  return opts.hasExistingPassword ? 'password' : 'create-password';
}

function isFlow(value: unknown): value is AccountAuthFlow {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mobile10 === 'string' &&
    typeof v.mobileE164 === 'string' &&
    (v.verificationId === null || typeof v.verificationId === 'string') &&
    (v.verificationCode === null || typeof v.verificationCode === 'string') &&
    (v.whatsappUrl === null || typeof v.whatsappUrl === 'string') &&
    (v.phase === 'waiting' || v.phase === 'create-password') &&
    typeof v.resetting === 'boolean' &&
    typeof v.hasExistingPassword === 'boolean' &&
    typeof v.savedAt === 'number'
  );
}

export function saveAccountAuthFlow(flow: Omit<AccountAuthFlow, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  if (!flow.mobile10 || !flow.mobileE164) return;
  try {
    const payload: AccountAuthFlow = { ...flow, savedAt: Date.now() };
    sessionStorage.setItem(ACCOUNT_AUTH_FLOW_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function loadAccountAuthFlow(): AccountAuthFlow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACCOUNT_AUTH_FLOW_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isFlow(parsed)) {
      sessionStorage.removeItem(ACCOUNT_AUTH_FLOW_KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > FLOW_TTL_MS) {
      sessionStorage.removeItem(ACCOUNT_AUTH_FLOW_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAccountAuthFlow(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ACCOUNT_AUTH_FLOW_KEY);
  } catch {
    /* ignore */
  }
}
