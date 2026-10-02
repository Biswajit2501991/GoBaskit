import {
  ACCOUNT_AUTH_FLOW_KEY,
  clearAccountAuthFlow,
  loadAccountAuthFlow,
  nextAccountPhaseAfterProof,
  saveAccountAuthFlow,
} from '@/utils/accountAuthFlow';

describe('accountAuthFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.useRealTimers();
  });

  it('sends forgot-password proof to create-password, not Welcome back', () => {
    expect(
      nextAccountPhaseAfterProof({ resetting: true, hasExistingPassword: true }),
    ).toBe('create-password');
    expect(
      nextAccountPhaseAfterProof({ resetting: false, hasExistingPassword: true }),
    ).toBe('password');
    expect(
      nextAccountPhaseAfterProof({ resetting: false, hasExistingPassword: false }),
    ).toBe('create-password');
  });

  it('persists and restores an in-progress reset across a WhatsApp round trip', () => {
    saveAccountAuthFlow({
      mobile10: '9876543210',
      mobileE164: '+919876543210',
      verificationId: 'ver-1',
      verificationCode: 'GB-123456',
      whatsappUrl: 'https://api.whatsapp.com/send?phone=1&text=hi',
      phase: 'waiting',
      resetting: true,
      hasExistingPassword: true,
    });

    const loaded = loadAccountAuthFlow();
    expect(loaded?.mobile10).toBe('9876543210');
    expect(loaded?.verificationId).toBe('ver-1');
    expect(loaded?.resetting).toBe(true);
    expect(loaded?.phase).toBe('waiting');
  });

  it('drops expired or invalid snapshots so a stale reset cannot reopen', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-02T09:00:00.000Z'));
    saveAccountAuthFlow({
      mobile10: '9876543210',
      mobileE164: '+919876543210',
      verificationId: 'ver-1',
      verificationCode: 'GB-123456',
      whatsappUrl: null,
      phase: 'create-password',
      resetting: true,
      hasExistingPassword: true,
    });

    jest.setSystemTime(new Date('2026-10-02T09:16:00.000Z'));
    expect(loadAccountAuthFlow()).toBeNull();
    expect(sessionStorage.getItem(ACCOUNT_AUTH_FLOW_KEY)).toBeNull();

    sessionStorage.setItem(ACCOUNT_AUTH_FLOW_KEY, '{not-json');
    expect(loadAccountAuthFlow()).toBeNull();

    clearAccountAuthFlow();
    expect(loadAccountAuthFlow()).toBeNull();
  });
});
