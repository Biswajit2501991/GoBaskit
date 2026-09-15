'use client';

import { ACCESS_CATALOG, type AccessNode } from '@/lib/staffAccess';

function toggleId(selected: Set<string>, id: string, on: boolean) {
  const next = new Set(selected);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export default function StaffAccessTree({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const selected = new Set(selectedIds);
  const pages = ACCESS_CATALOG.filter((node) => node.kind === 'page');

  function setSelected(next: Set<string>) {
    onChange([...next]);
  }

  function togglePage(page: AccessNode, on: boolean) {
    const children = ACCESS_CATALOG.filter((node) => node.parentId === page.id);
    let next = toggleId(selected, page.id, on);
    if (!on) {
      for (const child of children) next.delete(child.id);
    }
    setSelected(next);
  }

  function toggleChild(child: AccessNode, on: boolean) {
    let next = toggleId(selected, child.id, on);
    if (on && child.parentId) next.add(child.parentId);
    setSelected(next);
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto rounded-lg border border-gray-200 p-3">
      {pages.map((page) => {
        const children = ACCESS_CATALOG.filter((node) => node.parentId === page.id);
        const pageOn = selected.has(page.id);
        return (
          <div key={page.id}>
            <label className="flex items-start gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                className="mt-0.5 accent-blinkit-green"
                checked={pageOn}
                onChange={(e) => togglePage(page, e.target.checked)}
              />
              <span>
                {page.label}
                <span className="ml-1 font-normal text-xs text-gray-400">{page.group}</span>
              </span>
            </label>
            {children.length > 0 && (
              <div className="mt-1 ml-6 space-y-1">
                {children.map((child) => (
                  <label key={child.id} className="flex items-start gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-blinkit-green"
                      checked={selected.has(child.id)}
                      onChange={(e) => toggleChild(child, e.target.checked)}
                    />
                    <span>
                      {child.label}
                      {child.kind === 'action' ? ' (action)' : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
