'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAFF_ROLES } from '@/types/staff';
import type { StaffRole } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import StaffBulkImport from '@/components/Admin/StaffBulkImport';

interface StaffRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: StaffRole;
  permissions: string[];
  active: boolean;
  lastLogin: string | null;
}

const emptyForm = {
  name: '',
  mobile: '',
  email: '',
  role: 'READ_ONLY' as StaffRole,
  password: '',
  active: true,
};

export default function StaffManager() {
  const router = useRouter();
  const [items, setItems] = useState<StaffRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/admin/staff${q}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  }

  function openEdit(row: StaffRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      mobile: row.mobile,
      email: row.email || '',
      role: row.role,
      password: '',
      active: row.active,
    });
    setShowForm(true);
    setError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      email: form.email || undefined,
      password: form.password || undefined,
    };
    const url = editingId ? `/api/admin/staff/${editingId}` : '/api/admin/staff';
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
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this staff member?')) return;
    const res = await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
      router.refresh();
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-gray-500">Add, edit, and manage staff access</p>
        </div>
        <div className="flex gap-2">
          <StaffBulkImport onComplete={load} />
          <Button onClick={openCreate} className="gap-1">
            <Plus className="w-4 h-4" /> Add Staff
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search by name, mobile, email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-xl p-6 w-full max-w-md space-y-3 shadow-xl">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">{editingId ? 'Edit Staff' : 'Add Staff'}</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
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
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Role</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <Button type="submit" className="w-full">Save</Button>
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
              <th className="p-3">Status</th>
              <th className="p-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No staff found</td></tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3">{row.mobile}</td>
                  <td className="p-3">{row.role.replace(/_/g, ' ')}</td>
                  <td className="p-3">
                    <span className={row.active ? 'text-green-600' : 'text-red-500'}>
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 flex gap-1">
                    <button type="button" onClick={() => openEdit(row)} className="p-1.5 hover:bg-gray-100 rounded">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(row.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
