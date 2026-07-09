'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateTime } from '@/utils/formatter';
import { formatE164Display } from '@/utils/phone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';
import ListPagination from './ListPagination';
import { subscribeToAdminEvents } from '@/lib/realtime/adminEventsClient';

interface VerificationRow {
  id: string;
  mobile: string;
  verificationCode: string;
  status: string;
  customerName?: string | null;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
  verifiedBy?: { id: string; name: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-700',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function WhatsAppVerificationManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<VerificationRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(ADMIN_LIST_PAGE_SIZE),
    });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);

    try {
      // List already returns pendingCount — skip duplicate pending-count fetch.
      const listRes = await fetch(`/api/admin/whatsapp-verifications?${params}`);
      if (listRes.ok) {
        const data = await listRes.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        if (typeof data.pendingCount === 'number') setPendingCount(data.pendingCount);
      }
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!initialLoadDone.current || !search) {
      void load();
      return;
    }
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    const unsubscribe = subscribeToAdminEvents((event) => {
      if (event.type === 'whatsapp_verification_updated') {
        void load();
      }
    });
    return unsubscribe;
  }, [load]);

  async function verifyRow(id: string, mobile: string) {
    if (!canManage) return;
    const confirmed = window.confirm(`Mark ${formatE164Display(mobile)} as verified?`);
    if (!confirmed) return;

    setActingId(id);
    try {
      const res = await fetch(`/api/admin/whatsapp-verifications/${id}/verify`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : 'Verification failed');
        return;
      }
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function rejectRow(id: string) {
    if (!canManage) return;
    const confirmed = window.confirm('Reject this verification request?');
    if (!confirmed) return;

    setActingId(id);
    try {
      const res = await fetch(`/api/admin/whatsapp-verifications/${id}/reject`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : 'Rejection failed');
        return;
      }
      await load();
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="p-6 w-full">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Approve customer WhatsApp verifications after they send the code message.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 text-sm font-semibold px-3 py-1">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search mobile, code, customer..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="EXPIRED">Expired</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">No verification requests found.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono font-semibold">{row.verificationCode}</td>
                  <td className="px-4 py-3">{row.customerName || '—'}</td>
                  <td className="px-4 py-3">{formatE164Display(row.mobile)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLES[row.status] ?? 'bg-gray-100'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    {row.status === 'PENDING' && canManage ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={actingId === row.id}
                          onClick={() => verifyRow(row.id, row.mobile)}
                        >
                          Verify
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actingId === row.id}
                          onClick={() => rejectRow(row.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {row.verifiedBy ? `By ${row.verifiedBy.name}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ListPagination page={page} total={total} onPageChange={setPage} className="mt-6" />
    </div>
  );
}
