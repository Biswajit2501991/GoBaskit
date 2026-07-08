'use client';

import { create } from 'zustand';

/** In-memory only — cleared on page refresh (per spec). */
interface StaffPortalState {
  staffEligible: boolean;
  checkedMobile: string;
  customerMobile: string;
  staffName: string;
  showAccountModal: boolean;
  showAdminLoginModal: boolean;
  setStaffEligible: (mobile: string, name?: string) => void;
  setCustomerMobile: (mobile: string) => void;
  clearAccount: () => void;
  clearStaffEligible: () => void;
  openAccountModal: () => void;
  closeAccountModal: () => void;
  openAdminLoginModal: () => void;
  closeAdminLoginModal: () => void;
}

export const useStaffPortalStore = create<StaffPortalState>((set) => ({
  staffEligible: false,
  checkedMobile: '',
  customerMobile: '',
  staffName: '',
  showAccountModal: false,
  showAdminLoginModal: false,
  // A staff member is ALSO a customer: they keep a customer identity (so they
  // can browse, order, and view My Account with their own number) while
  // staffEligible unlocks the "Login as Admin" entry for admin work.
  setStaffEligible: (mobile, name) =>
    set({
      staffEligible: true,
      checkedMobile: mobile,
      customerMobile: mobile,
      staffName: name?.trim() || '',
      showAccountModal: false,
    }),
  setCustomerMobile: (mobile) =>
    set({
      customerMobile: mobile,
      checkedMobile: mobile,
      showAccountModal: false,
    }),
  clearAccount: () =>
    set({
      staffEligible: false,
      checkedMobile: '',
      customerMobile: '',
      staffName: '',
      showAdminLoginModal: false,
      showAccountModal: false,
    }),
  clearStaffEligible: () => set({ staffEligible: false, checkedMobile: '', staffName: '' }),
  openAccountModal: () => set({ showAccountModal: true }),
  closeAccountModal: () => set({ showAccountModal: false }),
  openAdminLoginModal: () => set({ showAdminLoginModal: true }),
  closeAdminLoginModal: () => set({ showAdminLoginModal: false }),
}));
