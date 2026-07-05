'use client';

import { create } from 'zustand';

/** In-memory only — cleared on page refresh (per spec). */
interface StaffPortalState {
  staffEligible: boolean;
  checkedMobile: string;
  showAccountModal: boolean;
  showAdminLoginModal: boolean;
  setStaffEligible: (mobile: string) => void;
  clearStaffEligible: () => void;
  openAccountModal: () => void;
  closeAccountModal: () => void;
  openAdminLoginModal: () => void;
  closeAdminLoginModal: () => void;
}

export const useStaffPortalStore = create<StaffPortalState>((set) => ({
  staffEligible: false,
  checkedMobile: '',
  showAccountModal: false,
  showAdminLoginModal: false,
  setStaffEligible: (mobile) => set({ staffEligible: true, checkedMobile: mobile, showAccountModal: false }),
  clearStaffEligible: () => set({ staffEligible: false, checkedMobile: '' }),
  openAccountModal: () => set({ showAccountModal: true }),
  closeAccountModal: () => set({ showAccountModal: false }),
  openAdminLoginModal: () => set({ showAdminLoginModal: true }),
  closeAdminLoginModal: () => set({ showAdminLoginModal: false }),
}));
