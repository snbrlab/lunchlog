'use client';

import { useMemo, useState, useTransition } from 'react';
import { REACTION_EMOJIS } from '@/lib/reviews/reactions-meta';
import { toggleReaction } from '@/lib/reviews/reactions';

// review 에 달린 reaction 한 row (DB select 결과 그대로).
export interface ReactionRow {
  emoji: string;
  user_id: string;
  // 호버 popover 에서 누가 눌렀는지 보이려면 이름이 필요. join 으로 받음.
  user?: { name: string } | null;
}

interface Props {
  reviewId: string;
  reactions: ReactionRow[];
  currentUserId: string;
  // 토글 후 부모에 알려서 refetch 트리거.
  onChanged: () => void;
}

export default function ReactionBar({ reviewId, reactions, currentUserId, onChanged }: Props) {
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  // 어떤 emoji 의 popover 가 열려있는지 (누른 사람 목록)
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  // emoji 별로 그룹화 — count, 내가 눌렀는지, 누른 사람 이름들
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean; names: string[] }>();
    // 방어적: reactions 가 array 가 아닐 경우 (마이그레이션 안 됐거나 stale cache) 빈 배열로
    const rows = Array.isArray(reactions) ? reactions : [];
    for (const r of rows) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false, names: [] };
      cur.count++;
      if (r.user_id === currentUserId) cur.mine = true;
      const name = r.user?.name;
      if (name) cur.names.push(name);
      map.set(r.emoji, cur);
    }
    // REACTION_EMOJIS 순서대로 정렬 (안정적 표시)
    return REACTION_EMOJIS.map((e) => ({
      emoji: e,
      info: map.get(e),
    })).filter((g) => g.info !== undefined) as Array<{
      emoji: string;
      info: { count: number; mine: boolean; names: string[] };
    }>;
  }, [reactions, currentUserId]);

  function onToggle(emoji: string) {
    startTransition(async () => {
      const r = await toggleReaction(reviewId, emoji);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setPickerOpen(false);
      setOpenPopover(null);
      onChanged();
    });
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {grouped.map(({ emoji, info }) => (
        <div key={emoji} className="relative">
          <button
            type="button"
            onClick={() => onToggle(emoji)}
            onMouseEnter={() => setOpenPopover(emoji)}
            onMouseLeave={() => setOpenPopover(null)}
            disabled={pending}
            title={info.mine ? '클릭하면 취소' : '클릭하면 추가'}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 ${
              info.mine
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : 'border-border bg-surface text-fg-muted hover:border-fg/40 hover:text-fg'
            }`}
          >
            <span aria-hidden>{emoji}</span>
            <span className="font-mono text-[10px]">{info.count}</span>
          </button>
          {/* 호버 시 누른 사람 목록 popover */}
          {openPopover === emoji && info.names.length > 0 && (
            <div className="absolute bottom-full left-0 z-20 mb-1 whitespace-nowrap rounded-md border border-border bg-bg px-2 py-1 text-[10px] text-fg shadow-md">
              {info.names.slice(0, 6).join(', ')}
              {info.names.length > 6 && ` 외 ${info.names.length - 6}명`}
            </div>
          )}
        </div>
      ))}

      {/* + 반응 버튼 + picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          disabled={pending}
          aria-label="반응 추가"
          className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-fg-muted hover:border-fg/40 hover:text-fg disabled:opacity-50"
        >
          😊+
        </button>
        {pickerOpen && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setPickerOpen(false)}
              aria-label="picker 닫기"
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-md border border-border bg-bg p-1 shadow-md">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onToggle(e)}
                  disabled={pending}
                  className="rounded p-1 text-base hover:bg-fg/10 disabled:opacity-50"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
