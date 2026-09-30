'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CardEventMap } from '@/components/map/CardEventMap';
import { CARD_EVENT_DISTRICTS } from '@/lib/card-event/districts';
import type { CardEventMerchantRow } from './page';

export function CardEventShell({ merchants }: { merchants: CardEventMerchantRow[] }) {
  const [district, setDistrict] = useState(CARD_EVENT_DISTRICTS[0]!.code);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const countByDistrict = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of merchants) m.set(row.district, (m.get(row.district) ?? 0) + 1);
    return m;
  }, [merchants]);

  const inDistrict = useMemo(
    () => merchants.filter((m) => m.district === district),
    [merchants, district],
  );

  const markers = useMemo(
    () =>
      inDistrict
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => ({
          id: m.id,
          name: m.name,
          lat: m.latitude!,
          lng: m.longitude!,
          matched: !!m.matched_restaurant_id,
        })),
    [inDistrict],
  );

  const selected = useMemo(
    () => inDistrict.find((m) => m.id === selectedId) ?? null,
    [inDistrict, selectedId],
  );

  const matchedCount = inDistrict.filter((m) => m.matched_restaurant_id).length;

  function onSelectDistrict(code: string) {
    setDistrict(code);
    setSelectedId(null);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <h1 className="mb-2 text-base font-semibold tracking-tight text-fg">
          🎟️ 서울시 로컬브랜드 가맹점
        </h1>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {CARD_EVENT_DISTRICTS.map((d) => (
            <button
              key={d.code}
              type="button"
              onClick={() => onSelectDistrict(d.code)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                district === d.code
                  ? 'bg-fg text-bg'
                  : 'bg-bg text-fg-muted hover:bg-fg/5'
              }`}
            >
              {d.label}
              <span className="ml-1 opacity-70">({countByDistrict.get(d.code) ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* 목록 — 데스크탑 항상 표시, 모바일은 토글 */}
        <div
          className={`absolute inset-y-0 left-0 z-30 w-72 shrink-0 overflow-y-auto border-r border-border bg-surface transition-transform duration-300 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <p className="border-b border-border px-3 py-2 text-[11px] text-fg-muted">
            {inDistrict.length}곳 · 런치로그 연결 {matchedCount}곳
          </p>
          <ul>
            {inDistrict.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(m.id);
                    setSidebarOpen(false);
                  }}
                  className={`block w-full border-b border-border px-3 py-2 text-left text-xs transition hover:bg-fg/5 ${
                    selectedId === m.id ? 'bg-fg/5' : ''
                  }`}
                >
                  <span className="mr-1.5" aria-hidden>
                    {m.matched_restaurant_id ? '🍚' : '🆕'}
                  </span>
                  <span className="font-medium text-fg">{m.name}</span>
                  {m.latitude == null && (
                    <span className="ml-1.5 rounded bg-fg/10 px-1 text-[9px] text-fg-muted">
                      위치 미확인
                    </span>
                  )}
                  <p className="mt-0.5 truncate text-fg-muted">{m.category}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="목록 닫기"
            className="absolute inset-0 z-20 bg-black/30 lg:hidden"
          />
        )}

        <div className="relative flex flex-1 flex-col">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="가맹점 목록 열기"
              className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg shadow-md lg:hidden"
            >
              <span aria-hidden className="text-base">☰</span>
            </button>
            <CardEventMap
              markers={markers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDeselect={() => setSelectedId(null)}
            />
          </div>

          <DetailPanel merchant={selected} onClose={() => setSelectedId(null)} />
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  merchant,
  onClose,
}: {
  merchant: CardEventMerchantRow | null;
  onClose: () => void;
}) {
  if (!merchant) {
    return (
      <div className="shrink-0 border-t border-border bg-surface px-4 py-6 text-center text-xs text-fg-muted">
        지도 핀이나 왼쪽 목록에서 가맹점을 골라보세요
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{merchant.name}</p>
          <p className="text-xs text-fg-muted">
            {merchant.category} · {merchant.address}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 rounded p-1 text-fg-muted hover:bg-fg/5 hover:text-fg"
        >
          ✕
        </button>
      </div>

      <div className="mt-3">
        {merchant.matched ? (
          <>
            <p className="mb-2 text-xs text-emerald-700">
              ✅ 런치로그에 이미 있어요{merchant.matched.is_closed ? ' (폐업 표시됨)' : ''}
            </p>
            <Link
              href={`/map?focus=${merchant.matched.id}`}
              className="inline-block rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90"
            >
              📝 리뷰 쓰러 가기 →
            </Link>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs text-fg-muted">아직 런치로그에 없어요</p>
            <Link
              href={`/restaurants/new?q=${encodeURIComponent(merchant.name)}`}
              className="inline-block rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90"
            >
              + 식당으로 등록하기 →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
