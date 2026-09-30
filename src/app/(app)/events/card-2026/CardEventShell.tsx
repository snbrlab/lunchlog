'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { CardEventMap } from '@/components/map/CardEventMap';
import { CARD_EVENT_DISTRICTS } from '@/lib/card-event/districts';
import { deleteCardEventUsage, logCardEventUsage } from '@/lib/card-event/usage-actions';
import type { CardEventMerchantRow, CardEventUsageRow } from './page';

const MONTHLY_LIMIT = 3;

export function CardEventShell({
  merchants,
  monthlyUsage,
}: {
  merchants: CardEventMerchantRow[];
  monthlyUsage: CardEventUsageRow[];
}) {
  const router = useRouter();
  const [district, setDistrict] = useState(CARD_EVENT_DISTRICTS[0]!.code);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [, startTransition] = useTransition();

  function refreshAfter(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

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

  const usageByMerchantId = useMemo(() => {
    const m = new Map<string, CardEventUsageRow>();
    for (const u of monthlyUsage) m.set(u.merchant_id, u);
    return m;
  }, [monthlyUsage]);

  function onSelectDistrict(code: string) {
    setDistrict(code);
    setSelectedId(null);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold tracking-tight text-fg">
            🎟️ 페이북 이벤트 지도
          </h1>
          <div className="relative">
            <button
              type="button"
              onClick={() => setUsageOpen((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                monthlyUsage.length >= MONTHLY_LIMIT
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              }`}
            >
              이번 달 {monthlyUsage.length}/{MONTHLY_LIMIT}회
            </button>
            {usageOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-lg border border-border bg-surface p-2 text-xs shadow-lg">
                {monthlyUsage.length === 0 ? (
                  <p className="px-2 py-3 text-center text-fg-muted">
                    이번 달 사용 기록이 없어요
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {monthlyUsage.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-fg/5"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-fg">{u.merchant?.name ?? '?'}</span>
                          <span className="ml-1.5 text-fg-muted">{u.used_at}</span>
                          {u.amount != null && (
                            <span className="ml-1.5 text-fg-muted">
                              · {u.amount.toLocaleString()}원
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => refreshAfter(() => deleteCardEventUsage(u.id))}
                          aria-label="기록 삭제"
                          className="shrink-0 text-fg-muted hover:text-rose-600"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mb-2 rounded-md border border-border bg-bg px-3 py-2 text-[11px] leading-relaxed text-fg-muted">
          <p>
            💳 BC카드 페이북 · 로컬브랜드 상권 가맹점 2만원 이상 결제 시{' '}
            <span className="font-medium text-fg">7,000원 청구할인</span> (월 3회, 계정당) ·
            26.9.1~12.20 (예산 소진 시 조기종료) ·{' '}
            <a
              href="https://web.paybooc.co.kr/web/evnt/evnt-dts?pybcUnifEvntNo=2026080030"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-fg"
            >
              이벤트 상세 보기 ↗
            </a>{' '}
            ·{' '}
            <a
              href="https://cdn.paybooc.co.kr/static/html/benefit/event/popup/2026080030_pop.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-fg"
            >
              가맹점 목록 원문 ↗
            </a>
          </p>
          <p className="mt-1">
            ⚠️ 결제 전에 <span className="font-medium text-fg">페이북 앱 → 마이태그</span>에서
            해당 지역 &quot;로컬브랜드 상권(OO길)&quot;을 먼저 태그(신청)해야 적용돼요.{' '}
            <span className="font-medium text-fg">지역마다 태그가 따로</span>라 다른 구로 가면
            거기 것도 새로 태그해야 해요. 태그해둔 BC 개인 신용·체크카드로 결제하면 자동
            청구할인!
          </p>
        </div>
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
                    {m.matched_restaurant_id ? '🖤' : '🤍'}
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

          <DetailPanel
            merchant={selected}
            usage={selected ? (usageByMerchantId.get(selected.id) ?? null) : null}
            monthlyCount={monthlyUsage.length}
            onClose={() => setSelectedId(null)}
            onLogUsage={(merchantId, usedAt, amount) =>
              refreshAfter(() => logCardEventUsage(merchantId, usedAt, amount))
            }
            onDeleteUsage={(usageId) => refreshAfter(() => deleteCardEventUsage(usageId))}
          />
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  merchant,
  usage,
  monthlyCount,
  onClose,
  onLogUsage,
  onDeleteUsage,
}: {
  merchant: CardEventMerchantRow | null;
  usage: CardEventUsageRow | null;
  monthlyCount: number;
  onClose: () => void;
  onLogUsage: (merchantId: string, usedAt: string, amount: number | null) => void;
  onDeleteUsage: (usageId: string) => void;
}) {
  const [logging, setLogging] = useState(false);
  const [usedAt, setUsedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountInput, setAmountInput] = useState('');

  if (!merchant) {
    return (
      <div className="shrink-0 border-t border-border bg-surface px-4 py-6 text-center text-xs text-fg-muted">
        지도 핀이나 왼쪽 목록에서 가맹점을 골라보세요
      </div>
    );
  }

  function submitUsage() {
    const amount = amountInput.trim() ? Number(amountInput) : null;
    if (amount != null && !Number.isFinite(amount)) {
      alert('금액을 숫자로 입력해주세요');
      return;
    }
    onLogUsage(merchant!.id, usedAt, amount);
    setLogging(false);
    setAmountInput('');
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{merchant.name}</p>
          <p className="text-xs text-fg-muted">
            {merchant.category} · {merchant.address}
          </p>
          {merchant.latitude != null && merchant.longitude != null && (
            <a
              href={`https://map.kakao.com/link/map/${encodeURIComponent(merchant.name)},${merchant.latitude},${merchant.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
            >
              <span aria-hidden>🗺️</span>
              카카오맵에서 보기 ↗
            </a>
          )}
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {merchant.matched ? (
          <>
            <Link
              href={`/map?focus=${merchant.matched.id}`}
              className="inline-block rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90"
            >
              📝 리뷰 쓰러 가기 →
            </Link>
            {merchant.matched.is_closed && (
              <span className="text-xs text-fg-muted">(폐업 표시됨)</span>
            )}
          </>
        ) : (
          <Link
            href={`/restaurants/new?q=${encodeURIComponent(merchant.name)}`}
            className="inline-block rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90"
          >
            + 식당으로 등록하기 →
          </Link>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {usage ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-700">
              ✅ {usage.used_at}에 여기서 썼어요{usage.amount != null ? ` · ${usage.amount.toLocaleString()}원` : ''}
            </span>
            <button
              type="button"
              onClick={() => onDeleteUsage(usage.id)}
              className="text-fg-muted underline decoration-dotted hover:text-rose-600"
            >
              기록 삭제
            </button>
          </div>
        ) : logging ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              value={usedAt}
              onChange={(e) => setUsedAt(e.target.value)}
              className="rounded-md border border-border bg-bg px-2 py-1.5 outline-none focus:border-fg"
            />
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="금액(선택)"
              className="w-24 rounded-md border border-border bg-bg px-2 py-1.5 outline-none focus:border-fg"
            />
            <button
              type="button"
              onClick={submitUsage}
              className="rounded-md bg-fg px-2.5 py-1.5 font-semibold text-bg hover:opacity-90"
            >
              기록
            </button>
            <button
              type="button"
              onClick={() => setLogging(false)}
              className="text-fg-muted hover:text-fg"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-fg-muted transition hover:border-fg/40 hover:text-fg"
          >
            ✅ 여기서 썼어요 {monthlyCount >= MONTHLY_LIMIT ? '(이번 달 한도 넘음)' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
