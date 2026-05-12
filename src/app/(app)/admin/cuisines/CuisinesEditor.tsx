'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  createCuisineItem,
  deleteCuisineItem,
  updateCuisineItem,
} from '@/lib/admin/cuisine-actions';
import {
  CUISINE_GROUP_META,
  groupCuisineItems,
  type CuisineItem,
} from '@/lib/cuisine';

interface Props {
  items: CuisineItem[];
}

export default function CuisinesEditor({ items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 추가 폼 입력 (그룹별 분리 상태)
  const [draftByGroup, setDraftByGroup] = useState<
    Record<string, { value: string; label: string; emoji: string }>
  >({});

  const groups = useMemo(() => groupCuisineItems(items), [items]);
  // 빈 그룹도 보여주기 — admin 이 새로 항목 추가할 수 있도록
  const allGroups = useMemo(() => {
    const present = new Set(groups.map((g) => g.label));
    const missing = CUISINE_GROUP_META.filter((m) => !present.has(m.label)).map((m) => ({
      label: m.label,
      emoji: m.emoji,
      items: [] as CuisineItem[],
    }));
    return [...groups, ...missing];
  }, [groups]);

  function setDraft(groupLabel: string, patch: Partial<{ value: string; label: string; emoji: string }>) {
    setDraftByGroup((prev) => ({
      ...prev,
      [groupLabel]: {
        value: prev[groupLabel]?.value ?? '',
        label: prev[groupLabel]?.label ?? '',
        emoji: prev[groupLabel]?.emoji ?? '',
        ...patch,
      },
    }));
  }

  function onAdd(groupLabel: string) {
    const d = draftByGroup[groupLabel];
    if (!d || !d.value.trim()) {
      alert('value 를 입력해주세요');
      return;
    }
    startTransition(async () => {
      const r = await createCuisineItem({
        group_label: groupLabel,
        value: d.value,
        label: d.label || null,
        emoji: d.emoji || null,
      });
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setDraftByGroup((prev) => ({
        ...prev,
        [groupLabel]: { value: '', label: '', emoji: '' },
      }));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {allGroups.map((group) => (
        <section
          key={group.label}
          className="rounded-lg border border-border bg-surface p-4"
        >
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            <span aria-hidden>{group.emoji}</span>
            <span>{group.label}</span>
            <span className="text-xs font-normal text-fg-muted">
              · {group.items.length}개 항목
            </span>
          </h2>

          {/* 항목 목록 */}
          <ul className="mb-3 space-y-2">
            {group.items.length === 0 && (
              <li className="text-xs text-fg-muted/70">아직 항목 없음 — 아래에서 추가하세요.</li>
            )}
            {group.items.map((item) => (
              <ItemRow
                key={item.value}
                item={item}
                pending={pending}
                onUpdated={() => router.refresh()}
              />
            ))}
          </ul>

          {/* 새 항목 추가 */}
          <div className="grid grid-cols-1 gap-2 rounded-md border border-dashed border-border bg-bg p-3 sm:grid-cols-[1fr_1fr_60px_auto]">
            <input
              type="text"
              placeholder="value (DB 저장값, 예: 마라샹궈)"
              value={draftByGroup[group.label]?.value ?? ''}
              onChange={(e) => setDraft(group.label, { value: e.target.value })}
              disabled={pending}
              maxLength={30}
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-fg/60"
            />
            <input
              type="text"
              placeholder="label (옵션, 표시명. 비우면 value 그대로)"
              value={draftByGroup[group.label]?.label ?? ''}
              onChange={(e) => setDraft(group.label, { label: e.target.value })}
              disabled={pending}
              maxLength={30}
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-fg/60"
            />
            <input
              type="text"
              placeholder="🍙"
              value={draftByGroup[group.label]?.emoji ?? ''}
              onChange={(e) => setDraft(group.label, { emoji: e.target.value })}
              disabled={pending}
              maxLength={8}
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-center text-sm outline-none focus:border-fg/60"
              title="emoji override (옵션) — 비우면 그룹 emoji 사용"
            />
            <button
              type="button"
              onClick={() => onAdd(group.label)}
              disabled={pending}
              className="rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-40"
            >
              + 추가
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  pending,
  onUpdated,
}: {
  item: CuisineItem;
  pending: boolean;
  onUpdated: () => void;
}) {
  const [label, setLabel] = useState(item.label ?? '');
  const [emoji, setEmoji] = useState(item.emoji ?? '');
  const [savePending, startSave] = useTransition();
  const dirty = (item.label ?? '') !== label || (item.emoji ?? '') !== emoji;

  function onSave() {
    startSave(async () => {
      const r = await updateCuisineItem(item.value, {
        label: label || null,
        emoji: emoji || null,
      });
      if (!r.ok) {
        alert(r.message);
        return;
      }
      onUpdated();
    });
  }

  function onDelete() {
    if (!confirm(`"${item.value}" 항목을 삭제할까요? 사용 중인 식당이 있으면 막힙니다.`)) return;
    startSave(async () => {
      const r = await deleteCuisineItem(item.value);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      onUpdated();
    });
  }

  const disabled = pending || savePending;

  return (
    <li className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[120px_1fr_60px_auto]">
      <span className="font-mono text-xs text-fg-muted" title="value (immutable)">
        {item.value}
      </span>
      <input
        type="text"
        placeholder="label (옵션)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={disabled}
        maxLength={30}
        className="rounded-md border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-fg/60"
      />
      <input
        type="text"
        placeholder={item.emoji ?? '🍱'}
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        disabled={disabled}
        maxLength={8}
        className="rounded-md border border-border bg-bg px-2 py-1 text-center text-sm outline-none focus:border-fg/60"
      />
      <div className="flex items-center gap-1">
        {dirty && (
          <button
            type="button"
            onClick={onSave}
            disabled={disabled}
            className="rounded border border-fg px-2 py-0.5 text-[10px] font-semibold text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
          >
            저장
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="rounded border border-border px-2 py-0.5 text-[10px] text-fg-muted hover:border-red-500 hover:text-red-500 disabled:opacity-40"
        >
          삭제
        </button>
      </div>
    </li>
  );
}
