'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import StaffAccessTree from '@/components/Admin/StaffAccessTree';
import { defaultSectionIdsForRole } from '@/lib/staffAccess';

export type AccessRoleRow = {
  id: string;
  name: string;
  description: string;
  grants: { sections: string[] };
};

export default function AccessRolesManager({
  roles,
  onChange,
}: {
  roles: AccessRoleRow[];
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<string[]>(defaultSectionIdsForRole('READ_ONLY'));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingId(null);
    setName('');
    setDescription('');
    setSections(defaultSectionIdsForRole('READ_ONLY'));
    setError('');
    setShowForm(true);
  }

  function openEdit(row: AccessRoleRow) {
    setEditingId(row.id);
    setName(row.name);
    setDescription(row.description);
    setSections(row.grants.sections);
    setError('');
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(editingId ? `/api/admin/access-roles/${editingId}` : '/api/admin/access-roles', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, grants: { sections } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed');
        return;
      }
      setShowForm(false);
      onChange();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this access template? Staff using it keep their named role until you assign another template.')) return;
    const res = await fetch(`/api/admin/access-roles/${id}`, { method: 'DELETE' });
    if (res.ok) onChange();
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold">Access templates</h2>
          <p className="text-xs text-gray-500">Reusable tick sets you can apply to staff. Existing logins stay on named-role defaults until you assign ticks.</p>
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0">
          New template
        </Button>
      </div>
      {roles.length === 0 ? (
        <p className="text-sm text-gray-500">No templates yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {roles.map((role) => (
            <li key={role.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{role.name}</p>
                {role.description ? <p className="text-xs text-gray-500">{role.description}</p> : null}
                <p className="text-xs text-gray-400">{role.grants.sections.length} ticks</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => openEdit(role)}>
                  Edit
                </Button>
                <Button type="button" variant="outline" onClick={() => handleDelete(role.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="mt-4 border-t pt-4 space-y-3">
          <div>
            <Label>Template name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <StaffAccessTree selectedIds={sections} onChange={setSections} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
