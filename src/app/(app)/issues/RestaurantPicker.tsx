'use client';

// 식당 검색 드롭다운 — 이슈 대상(식당) 지정 / 답변에 식당 추천 첨부 공용.
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type R = { id: string; name: string };

export function RestaurantPicker({
  value,
  onChange,
  placeholder = '식당 검색…',
}: {
  value: R | null;
  onChange: (r: R | null) => void;
  placeholder?: string;
}) {
  const [all, setAll] = useState<R[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('restaurants').select('id, name').order('name').limit(2000);
      if (!cancelled) setAll((data ?? []) as R[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q ? all.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8) : [];

  if (value) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
        👉 {value.name}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="식당 선택 해제"
          className="ml-0.5 text-emerald-600 hover:text-emerald-900"
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <div ref={boxRef} className="relative inline-block w-full max-w-xs">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-fg"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {matches.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setQuery('');
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-fg/5"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
