'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LearningNote = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function LearningManager({ canEdit }: { canEdit: boolean }) {
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/learning');
      if (!res.ok) throw new Error('Failed to load notes');
      const data = await res.json();
      const items: LearningNote[] = Array.isArray(data.items) ? data.items : [];
      setNotes(items);
      setSelectedId((prev) => {
        if (prev && items.some((n) => n.id === prev)) return prev;
        return items[0]?.id ?? null;
      });
    } catch {
      setError('Could not load learning notes.');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setTitle('');
    setBody('');
    setError('');
    setShowForm(true);
  }

  function openEdit(note: LearningNote) {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setBody('');
    setError('');
  }

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/admin/learning/${editingId}` : '/api/admin/learning';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      closeForm();
      await load();
      if (data.id) setSelectedId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(note: LearningNote) {
    if (!canEdit) return;
    if (!confirm(`Delete note “${note.title}”?`)) return;
    const res = await fetch(`/api/admin/learning/${note.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Failed to delete note');
      return;
    }
    if (selectedId === note.id) setSelectedId(null);
    await load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blinkit-green" />
            Learning
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Shared how-to notes for the team — add a tip once so everyone can follow it.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Add Note
          </Button>
        )}
      </div>

      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading notes...</p>
      ) : notes.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <p className="text-gray-600 mb-4">No learning notes yet.</p>
          {canEdit && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Add the first note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">
          <aside className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Notes
            </div>
            <ul className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {notes.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(note.id)}
                    className={`w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors ${
                      selected?.id === note.id ? 'bg-blinkit-green-light/60' : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{note.title}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Updated {formatWhen(note.updatedAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected && (
            <article className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 min-h-[320px]">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {selected.updatedBy?.name || selected.author?.name
                      ? `Last updated by ${selected.updatedBy?.name || selected.author?.name} · `
                      : ''}
                    {formatWhen(selected.updatedAt)}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={() => openEdit(selected)}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(selected)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-xl border border-gray-100 p-4">
                  {selected.body}
                </pre>
              </div>
            </article>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{editingId ? 'Edit Note' : 'Add Note'}</h3>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How to set up /category/paan-corner"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Note</Label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  placeholder="Write steps the team should follow..."
                  className="mt-1 flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green resize-y min-h-[220px]"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" onClick={save} disabled={saving || !title.trim() || !body.trim()}>
                  {saving ? 'Saving...' : editingId ? 'Update Note' : 'Save Note'}
                </Button>
                <Button type="button" variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
