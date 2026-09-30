'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RestaurantPicker } from '@/app/(app)/issues/RestaurantPicker';
import { KakaoPlacesSearch } from '@/components/map/KakaoPlacesSearch';
import {
  linkCardEventMerchant,
  setCardEventMerchantCoords,
  setCardEventMerchantExcluded,
  unlinkCardEventMerchant,
} from '@/lib/card-event/actions';
import type { AdminCardEventRow } from './page';
import type { KakaoPlaceItem } from '@/types/kakao-maps';

// 좌표 없는 항목 검색창 origin 용 — 구별 대략 중심 (정확도보다 '가까운 순' 정렬 편의용).
const DISTRICT_ORIGIN: Record<string, { lat: number; lng: number }> = {
  gangbuk: { lat: 37.6396, lng: 127.0128 },
  jungnang: { lat: 37.5972, lng: 127.085 },
  jung: { lat: 37.5657, lng: 126.9974 },
  seongbuk: { lat: 37.5894, lng: 127.0021 },
  seocho: { lat: 37.4979, lng: 127.0276 },
  dongjak: { lat: 37.513, lng: 126.9428 },
  dongdaemun: { lat: 37.5894, lng: 127.0517 },
  gwangjin: { lat: 37.5407, lng: 127.0693 },
  gwanak: { lat: 37.4784, lng: 126.9516 },
  gangseo: { lat: 37.5601, lng: 126.8259 },
};

const CONFIDENCE_LABEL: Record<string, { label: string; cls: string }> = {
  auto: { label: '자동매칭', cls: 'bg-emerald-100 text-emerald-800' },
  suggested: { label: '후보', cls: 'bg-amber-100 text-amber-800' },
  none: { label: '매칭없음', cls: 'bg-fg/10 text-fg-muted' },
};

type Tab = 'match' | 'nocoord';

export function CardEventAdminList({ rows }: { rows: AdminCardEventRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('match');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const matchRows = useMemo(
    () => rows.filter((r) => !r.excluded && r.match_confidence !== 'none'),
    [rows],
  );
  const noCoordRows = useMemo(
    () => rows.filter((r) => !r.excluded && r.geocode_status === 'failed'),
    [rows],
  );

  function run(id: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setPendingId(id);
    startTransition(async () => {
      const r = await action();
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-3 text-[11px]">
        <button
          type="button"
          onClick={() => setTab('match')}
          className={`rounded-full px-2.5 py-1 transition ${
            tab === 'match' ? 'bg-fg text-bg' : 'bg-bg text-fg-muted hover:bg-fg/5'
          }`}
        >
          매칭 후보 <span className="ml-1 opacity-70">({matchRows.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('nocoord')}
          className={`rounded-full px-2.5 py-1 transition ${
            tab === 'nocoord' ? 'bg-fg text-bg' : 'bg-bg text-fg-muted hover:bg-fg/5'
          }`}
        >
          좌표 없음 <span className="ml-1 opacity-70">({noCoordRows.length})</span>
        </button>
      </div>

      {tab === 'match' ? (
        matchRows.length === 0 ? (
          <EmptyState text="검수할 매칭 후보가 없어요" />
        ) : (
          <ul className="space-y-2">
            {matchRows.map((r) => (
              <MatchRow
                key={r.id}
                row={r}
                pending={pendingId === r.id}
                onLink={(restaurantId) =>
                  run(r.id, () => linkCardEventMerchant(r.id, restaurantId))
                }
                onUnlink={() => run(r.id, () => unlinkCardEventMerchant(r.id))}
                onExclude={() => run(r.id, () => setCardEventMerchantExcluded(r.id, true))}
              />
            ))}
          </ul>
        )
      ) : noCoordRows.length === 0 ? (
        <EmptyState text="좌표 없는 항목이 없어요" />
      ) : (
        <ul className="space-y-2">
          {noCoordRows.map((r) => (
            <NoCoordRow
              key={r.id}
              row={r}
              pending={pendingId === r.id}
              onSetCoords={(lat, lng) =>
                run(r.id, () => setCardEventMerchantCoords(r.id, lat, lng))
              }
              onExclude={() => run(r.id, () => setCardEventMerchantExcluded(r.id, true))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center text-sm text-fg-muted">
      {text}
    </p>
  );
}

function MatchRow({
  row,
  pending,
  onLink,
  onUnlink,
  onExclude,
}: {
  row: AdminCardEventRow;
  pending: boolean;
  onLink: (restaurantId: string) => void;
  onUnlink: () => void;
  onExclude: () => void;
}) {
  const [relinking, setRelinking] = useState(false);
  const confidence = CONFIDENCE_LABEL[row.match_confidence]!;

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${confidence.cls}`}>
          {confidence.label}
        </span>
        <span className="text-fg-muted">{row.district_label}</span>
        <span className="text-fg-muted">· {row.category}</span>
      </header>

      <p className="text-sm font-medium text-fg">{row.name}</p>
      <p className="text-xs text-fg-muted">{row.address}</p>

      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-fg-muted">런치로그:</span>
        {row.matched ? (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-800">
            👉 {row.matched.name}
          </span>
        ) : (
          <span className="text-fg-muted">없음</span>
        )}
        <button
          type="button"
          onClick={() => setRelinking((v) => !v)}
          className="text-fg-muted underline decoration-dotted hover:text-fg"
        >
          다른 식당 연결
        </button>
      </div>

      {relinking && (
        <div className="mt-2">
          <RestaurantPicker
            value={null}
            onChange={(r) => {
              if (!r) return;
              setRelinking(false);
              onLink(r.id);
            }}
            placeholder="연결할 식당 검색…"
          />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {row.matched && (
          <button
            type="button"
            onClick={() => onLink(row.matched!.id)}
            disabled={pending}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
          >
            {pending ? '처리 중…' : '✅ 이 매칭 확정'}
          </button>
        )}
        <button
          type="button"
          onClick={onUnlink}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-40"
        >
          매칭 없음으로 확정
        </button>
        <button
          type="button"
          onClick={onExclude}
          disabled={pending}
          className="ml-auto rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"
        >
          🚫 식당 아님 (제외)
        </button>
      </div>
    </li>
  );
}

function NoCoordRow({
  row,
  pending,
  onSetCoords,
  onExclude,
}: {
  row: AdminCardEventRow;
  pending: boolean;
  onSetCoords: (lat: number, lng: number) => void;
  onExclude: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const origin = DISTRICT_ORIGIN[row.district] ?? { lat: 37.5665, lng: 126.978 };

  function onPick(item: KakaoPlaceItem) {
    setSearching(false);
    onSetCoords(Number(item.y), Number(item.x));
  }

  function onManualSubmit() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert('좌표를 숫자로 입력해주세요');
      return;
    }
    onSetCoords(lat, lng);
  }

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-800">
          좌표없음
        </span>
        <span className="text-fg-muted">{row.district_label}</span>
        <span className="text-fg-muted">· {row.category}</span>
      </header>

      <p className="text-sm font-medium text-fg">{row.name}</p>
      <p className="text-xs text-fg-muted">{row.address}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSearching((v) => !v)}
          disabled={pending}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
        >
          {searching ? '검색창 닫기' : '🔍 카카오맵에서 검색'}
        </button>
        <button
          type="button"
          onClick={onExclude}
          disabled={pending}
          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"
        >
          🚫 식당 아님 (제외)
        </button>
      </div>

      {searching && (
        <div className="mt-2">
          <KakaoPlacesSearch origin={origin} onSelect={onPick} />
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-fg-muted hover:text-fg">
          좌표 직접 입력
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            placeholder="위도 (lat)"
            className="w-32 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-fg"
          />
          <input
            type="text"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            placeholder="경도 (lng)"
            className="w-32 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-fg"
          />
          <button
            type="button"
            onClick={onManualSubmit}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </details>
    </li>
  );
}
