'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAFF_ROLE_LABELS, assignableStaffRoles } from '@/types/staff';
import type { StaffRole } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import StaffBulkImport from '@/components/Admin/StaffBulkImport';
import ListPagination from './ListPagination';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';

interface StaffRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: StaffRole;
  permissions: string[];
  active: boolean;
  lastLogin: string | null;
  assignedCity: string | null;
  assignedAreas: string[];
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: number | null;
}

const emptyForm = {
  name: '',
  mobile: '',
  email: '',
  role: 'READ_ONLY' as StaffRole,
  password: '',
  active: true,
  assignedCity: '',
  assignedAreas: '',
  latitude: '',
  longitude: '',
  deliveryRadius: '',
};

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function staffPayloadError(form: typeof emptyForm, editingId: string | null): string | null {
  if (!form.name.trim()) return 'Name is required';
  if (form.mobile.length < 10) return 'Enter a valid 10-digit mobile number';
  if (!editingId && form.password.length < 6) return 'Password must be at least 6 characters';
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email or leave the email field blank';
  }
  if (form.latitude.trim() && parseOptionalNumber(form.latitude) === null) return 'Latitude must be a valid number';
  if (form.longitude.trim() && parseOptionalNumber(form.longitude) === null) return 'Longitude must be a valid number';
  if (form.deliveryRadius.trim() && parseOptionalNumber(form.deliveryRadius) === null) {
    return 'Radius must be a valid number';
  }
  return null;
}

export default function StaffManager({
  canManage,
  actorRole,
}: {
  canManage: boolean;
  actorRole: StaffRole;
}) {
  const router = useRouter();
  const [items, setItems] = useState<StaffRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const roleOptions = assignableStaffRoles(actorRole);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(ADMIN_LIST_PAGE_SIZE),
    });
    if (search.trim()) params.set('search', search.trim());

    const res = await fetch(`/api/admin/staff?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    if (!canManage) return;
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setSaving(false);
  }

  function openEdit(row: StaffRow) {
    if (!canManage) return;
    if (row.role === 'ALL_SUPER_ADMIN' && actorRole !== 'ALL_SUPER_ADMIN') return;
    setEditingId(row.id);
    setForm({
      name: row.name,
      mobile: row.mobile,
      email: row.email || '',
      role: row.role,
      password: '',
      active: row.active,
      assignedCity: row.assignedCity || '',
      assignedAreas: (row.assignedAreas ?? []).join(', '),
      latitude: row.latitude != null ? String(row.latitude) : '',
      longitude: row.longitude != null ? String(row.longitude) : '',
      deliveryRadius: row.deliveryRadius != null ? String(row.deliveryRadius) : '',
    });
    setShowForm(true);
    setError('');
    setSaving(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError('');
    const validationError = staffPayloadError(form, editingId);
    if (validationError) {
      setError(validationError);
      return;
    }

    const email = form.email.trim();
    const payload = {
      name: form.name.trim(),
      mobile: form.mobile,
      role: form.role,
      active: form.active,
      assignedCity: form.assignedCity.trim() || undefined,
      assignedAreas: form.assignedAreas
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      latitude: parseOptionalNumber(form.latitude),
      longitude: parseOptionalNumber(form.longitude),
      deliveryRadius: parseOptionalNumber(form.deliveryRadius),
      ...(email ? { email } : {}),
      ...(form.password ? { password: form.password } : {}),
    };
    const url = editingId ? `/api/admin/staff/${editingId}` : '/api/admin/staff';
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed');
        return;
      }
      setShowForm(false);
      load();
      router.refresh();
    } catch {
      setError('Network or server error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    if (!confirm('Deactivate this staff member?')) return;
    const res = await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === 'string' ? data.error : 'Could not deactivate staff');
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-gray-500">
            {canManage
              ? 'Add, edit, and manage staff access'
              : 'View staff access (only All Super Admin can add staff or change passwords)'}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <StaffBulkImport onComplete={load} />
            <Button onClick={openCreate} className="gap-1">
              <Plus className="w-4 h-4" /> Add Staff
            </Button>
          </div>
        )}
      </div>

      <Input
        placeholder="Search by name, mobile, email..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="mb-4 max-w-md"
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/30 p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[min(90vh,calc(100vh-2rem))] flex flex-col my-auto"
          >
            <div className="flex justify-between items-center p-6 pb-4 shrink-0 border-b border-gray-100">
              <h2 className="font-bold">{editingId ? 'Edit Staff' : 'Add Staff'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1" />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(-10) })}
                  required
                  className="mt-1"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {canManage && (
                <div>
                  <Label>{editingId ? 'New Password (optional)' : 'Password'}</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="mt-1"
                    required={!editingId}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active
              </label>
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery Zone</p>
                <div>
                  <Label>Assigned City</Label>
                  <Input
                    value={form.assignedCity}
                    onChange={(e) => setForm({ ...form, assignedCity: e.target.value })}
                    placeholder="e.g. Craigieburn"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Assigned Areas (comma-separated)</Label>
                  <Input
                    value={form.assignedAreas}
                    onChange={(e) => setForm({ ...form, assignedAreas: e.target.value })}
                    placeholder="Area 1, Area 2"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Latitude</Label>
                    <Input
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      placeholder="-37.59"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      placeholder="144.94"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Radius (KM)</Label>
                    <Input
                      value={form.deliveryRadius}
                      onChange={(e) => setForm({ ...form, deliveryRadius: e.target.value })}
                      placeholder="10"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 pt-4 shrink-0 border-t border-gray-100 space-y-3">
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Role</th>
              <th className="p-3">Zone</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No staff found</td></tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3">{row.mobile}</td>
                  <td className="p-3">{STAFF_ROLE_LABELS[row.role] ?? row.role.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {row.assignedCity || '—'}
                    {row.deliveryRadius ? ` · ${row.deliveryRadius}km` : ''}
                  </td>
                  <td className="p-3">
                    <span className={row.active ? 'text-green-600' : 'text-red-500'}>
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 flex gap-1">
                    {canManage && (
                      <>
                        <button type="button" onClick={() => openEdit(row)} className="p-1.5 hover:bg-gray-100 rounded" aria-label="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {row.role !== 'ALL_SUPER_ADMIN' && (
                          <button type="button" onClick={() => handleDelete(row.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded" aria-label="Deactivate">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} total={total} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
