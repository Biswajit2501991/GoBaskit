'use client';

import { create } from 'zustand';

/** In-memory UI state — adminSessionActive is rehydrated from /api/auth/staff-status. */
interface StaffPortalState {
  staffEligible: boolean;
  /** True when gobaskit_admin_token (or refreshable session) is still valid. */
  adminSessionActive: boolean;
  checkedMobile: string;
  customerMobile: string;
  staffName: string;
  showAccountModal: boolean;
  showAdminLoginModal: boolean;
  setStaffEligible: (mobile: string, name?: string) => void;
  setCustomerMobile: (mobile: string) => void;
  setAdminSessionActive: (active: boolean, meta?: { mobile?: string; name?: string }) => void;
  clearAccount: () => void;
  clearStaffEligible: () => void;
  openAccountModal: () => void;
  closeAccountModal: () => void;
  openAdminLoginModal: () => void;
  closeAdminLoginModal: () => void;
}

export const useStaffPortalStore = create<StaffPortalState>((set) => ({
  staffEligible: false,
  adminSessionActive: false,
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
  setAdminSessionActive: (active, meta) =>
    set((state) => {
      if (!active) {
        return { adminSessionActive: false };
      }
      const mobile = meta?.mobile?.trim() || state.checkedMobile || state.customerMobile;
      const name = meta?.name?.trim() || state.staffName;
      return {
        adminSessionActive: true,
        // Keep Super Admin entry visible even after refresh.
        staffEligible: true,
        checkedMobile: mobile || state.checkedMobile,
        customerMobile: mobile || state.customerMobile,
        staffName: name || state.staffName,
      };
    }),
  clearAccount: () =>
    set({
      staffEligible: false,
      adminSessionActive: false,
      checkedMobile: '',
      customerMobile: '',
      staffName: '',
      showAdminLoginModal: false,
      showAccountModal: false,
    }),
  clearStaffEligible: () =>
    set({ staffEligible: false, checkedMobile: '', staffName: '', adminSessionActive: false }),
  openAccountModal: () => set({ showAccountModal: true }),
  closeAccountModal: () => set({ showAccountModal: false }),
  openAdminLoginModal: () => set({ showAdminLoginModal: true }),
  closeAdminLoginModal: () => set({ showAdminLoginModal: false }),
}));
