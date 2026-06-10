'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  autoFillKakaoPlaceUrlsForRestaurants,
  deleteRestaurant,
  mergeRestaurants,
  type AutoFillPlaceUrlsResult,
} from '@/lib/admin/actions';
import { toggleRestaurantClosed } from '@/lib/restaurants/actions';
import type { AdminRestaurantRow } from './page';

type Row = AdminRestaurantRow;

export default function RestaurantsAdminTable({
  rows,
  offices,
}: {
  rows: Row[];
  offices: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillResult, setAutoFillResult] = useState<AutoFillPlaceUrlsResult | null>(null);
  const [, startTransition] = useTransition();
  // region 필터: 'all' | office.id | 'none' (office_id NULL)
  const [region, setRegion] = useState<string>('all');
  // D77: 병합 picker — source row id 가 열려있는 것 (한 번에 하나만)
  const [mergeOpenId, setMergeOpenId] = useState<string | null>(null);
  const [mergeQuery, setMergeQuery] = useState('');
  // D80: 카카오 URL 누락 식당만 필터 — PR 로 채우기 좋은 후보 발굴용
  const [missingUrlOnly, setMissingUrlOnly] = useState(false);

  const missingUrlCount = rows.filter((r) => !r.kakao_place_url).length;

  const filtered = useMemo(() => {
    let r = rows;
    if (region === 'none') r = r.filter((x) => !x.office_id);
    else if (region !== 'all') r = r.filter((x) => x.office_id === region);
    if (missingUrlOnly) r = r.filter((x) => !x.kakao_place_url);
    return r;
  }, [rows, region, missingUrlOnly]);

  // office 별 카운트 (chip 옆 표시)
  const countByOffice = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.office_id ?? '__none__';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  function runAutoFillUrls() {
    if (missingUrlCount === 0) {
      alert('카카오 url 누락된 식당이 없어요');
      return;
    }
    if (!confirm(`place_url 누락 ${missingUrlCount}개 식당을 카카오 검색해 자동 채울까요?`))
      return;
    setAutoFilling(true);
    setAutoFillResult(null);
    startTransition(async () => {
      const r = await autoFillKakaoPlaceUrlsForRestaurants();
      setAutoFillResult(r);
      setAutoFilling(false);
      if (r.ok) router.refresh();
    });
  }

  function onToggleClosed(row: Row) {
    const next = !row.is_closed;
    setPendingId(row.id);
    startTransition(async () => {
      const r = await toggleRestaurantClosed(row.id, next);
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  function onMerge(source: Row, target: Row) {
    if (
      !confirm(
        `"${source.name}" (commit ${source.commit_count}) → "${target.name}" (commit ${target.commit_count}) 로 병합할까요?\n` +
          `source 의 리뷰/찜이 모두 target 으로 이전되고 source 는 삭제돼요.`,
      )
    )
      return;
    setPendingId(source.id);
    startTransition(async () => {
      const r = await mergeRestaurants(source.id, target.id);
      setPendingId(null);
      setMergeOpenId(null);
      setMergeQuery('');
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  function onDelete(row: Row) {
    if (
      !confirm(
        `"${row.name}" 식당을 삭제할까요? 이 식당의 리뷰 ${row.commit_count}개도 같이 사라집니다.`,
      )
    )
      return;
    setPendingId(row.id);
    startTransition(async () => {
      const r = await deleteRestaurant(row.id);
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
      <section className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
        <div>
          <h2 className="text-sm font-medium text-fg">카카오 place_url 자동 보정</h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            url 누락 {missingUrlCount}개 식당을 이름+좌표로 카카오 재검색해 채움. KAKAO_REST_KEY
            필요.
          </p>
        </div>
        <button
          type="button"
          onClick={runAutoFillUrls}
          disabled={autoFilling || missingUrlCount === 0}
          className="shrink-0 rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
        >
          {autoFilling ? '보정 중…' : '🪄 자동 보정'}
        </button>
      </section>

      {autoFillResult && !autoFillResult.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {autoFillResult.message}
        </p>
      )}
      {autoFillResult?.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <p className="font-medium">결과 ({autoFillResult.results.length}개 처리)</p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
            {autoFillResult.results.map((rr) => (
              <li key={rr.id} className="font-mono text-[11px]">
                {rr.status === 'updated' ? '✓' : rr.status === 'not_found' ? '✗' : '⚠️'}{' '}
                {rr.name}
                {rr.status === 'not_found' && ' (검색 결과 없음)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* region 필터 */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-3 text-[11px]">
        <span className="mr-1 text-fg-muted">지역:</span>
        <button
          type="button"
          onClick={() => setRegion('all')}
          className={`rounded-full px-2 py-0.5 transition ${
            region === 'all'
              ? 'bg-fg text-bg'
              : 'bg-bg text-fg-muted hover:bg-fg/5'
          }`}
        >
          전체 ({rows.length})
        </button>
        {offices.map((o) => {
          const cnt = countByOffice.get(o.id) ?? 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setRegion(o.id)}
              className={`rounded-full px-2 py-0.5 transition ${
                region === o.id
                  ? 'bg-fg text-bg'
                  : 'bg-bg text-fg-muted hover:bg-fg/5'
              }`}
            >
              {o.name} ({cnt})
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setRegion('none')}
          className={`rounded-full px-2 py-0.5 transition ${
            region === 'none'
              ? 'bg-fg text-bg'
              : 'bg-bg text-fg-muted hover:bg-fg/5'
          }`}
        >
          미분류 ({countByOffice.get('__none__') ?? 0})
        </button>
        <span className="mx-1 h-3 w-px bg-border" aria-hidden />
        <button
          type="button"
          onClick={() => setMissingUrlOnly((v) => !v)}
          title="카카오 link 누락된 식당만 — PR 로 채우기 좋은 후보"
          className={`rounded-full px-2 py-0.5 transition ${
            missingUrlOnly
              ? 'bg-rose-600 text-white'
              : 'bg-bg text-fg-muted hover:bg-fg/5'
          }`}
        >
          🗺️ URL 누락 ({missingUrlCount})
        </button>
        <span className="ml-auto text-fg-muted/60">
          {filtered.length}개 표시
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
        <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="px-3 py-2 text-left">이름</th>
            <th className="px-3 py-2 text-left">지역</th>
            <th className="px-3 py-2 text-left">cuisine</th>
            <th className="px-3 py-2 text-left">등록자</th>
            <th className="px-3 py-2 text-right">commit</th>
            <th className="px-3 py-2 text-left">상태</th>
            <th className="px-3 py-2 text-left">액션</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-xs text-fg-muted">
                조건에 맞는 식당 없음
              </td>
            </tr>
          )}
          {filtered.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-fg">
                <Link href={`/restaurants/${r.id}/edit`} className="hover:underline">
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-fg-muted">
                {r.office?.name ?? (
                  <span className="italic text-fg-muted/60">미분류</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-fg-muted">{r.cuisine_types.join(' / ')}</td>
              <td className="px-3 py-2 text-xs text-fg-muted">{r.creator?.name ?? '—'}</td>
              <td className="px-3 py-2 text-right font-mono text-xs">{r.commit_count}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {r.is_closed ? (
                  <span className="inline-block whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                    폐업
                  </span>
                ) : (
                  <span className="inline-block whitespace-nowrap rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                    영업
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleClosed(r)}
                    disabled={pendingId === r.id}
                    className="rounded border border-border px-2 py-1 text-[11px] text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-50"
                  >
                    {r.is_closed ? '해제' : '폐업'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMergeOpenId(mergeOpenId === r.id ? null : r.id);
                      setMergeQuery('');
                    }}
                    disabled={pendingId === r.id}
                    title="이 식당의 리뷰/찜을 다른 식당으로 옮기고 이 식당은 삭제"
                    className="rounded border border-sky-300 px-2 py-1 text-[11px] text-sky-700 transition hover:bg-sky-50 disabled:opacity-50"
                  >
                    🔀 병합
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    disabled={pendingId === r.id}
                    className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
                {mergeOpenId === r.id && (
                  <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2">
                    <p className="mb-1 text-[10px] text-sky-900">
                      📥 병합 대상 (target) 선택 — "{r.name}" 이 target 으로 흡수됨
                    </p>
                    <input
                      type="search"
                      autoFocus
                      placeholder="식당 이름 검색…"
                      value={mergeQuery}
                      onChange={(e) => setMergeQuery(e.target.value)}
                      className="mb-1.5 w-full rounded border border-sky-200 bg-bg px-2 py-1 text-xs outline-none focus:border-sky-500"
                    />
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                      {rows
                        .filter((t) => t.id !== r.id)
                        .filter((t) =>
                          mergeQuery
                            ? t.name.toLowerCase().includes(mergeQuery.toLowerCase())
                            : true,
                        )
                        .slice(0, 10)
                        .map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => onMerge(r, t)}
                              disabled={pendingId === r.id}
                              className="block w-full rounded px-2 py-1 text-left text-[11px] text-fg hover:bg-sky-100 disabled:opacity-50"
                            >
                              <span className="font-medium">{t.name}</span>
                              <span className="ml-2 text-fg-muted">
                                ({t.office?.name ?? '미분류'} · commit {t.commit_count})
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
