'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  autoFillKakaoPlaceUrlsForRestaurants,
  deleteRestaurant,
  type AutoFillPlaceUrlsResult,
} from '@/lib/admin/actions';
import { toggleRestaurantClosed } from '@/lib/restaurants/actions';

interface Row {
  id: string;
  name: string;
  cuisine_type: string;
  is_closed: boolean;
  commit_count: number;
  created_at: string;
  kakao_place_url: string | null;
  creator: { name: string } | null;
}

export default function RestaurantsAdminTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillResult, setAutoFillResult] = useState<AutoFillPlaceUrlsResult | null>(null);
  const [, startTransition] = useTransition();

  const missingUrlCount = rows.filter((r) => !r.kakao_place_url).length;

  function runAutoFillUrls() {
    if (missingUrlCount === 0) {
      alert('카카오 url 누락된 식당이 없어');
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

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
        <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="px-3 py-2 text-left">이름</th>
            <th className="px-3 py-2 text-left">cuisine</th>
            <th className="px-3 py-2 text-left">등록자</th>
            <th className="px-3 py-2 text-right">commit</th>
            <th className="px-3 py-2 text-left">상태</th>
            <th className="px-3 py-2 text-left">액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-xs text-fg-muted">
                등록된 식당 없음
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-fg">
                <Link href={`/restaurants/${r.id}/edit`} className="hover:underline">
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-fg-muted">{r.cuisine_type}</td>
              <td className="px-3 py-2 text-xs text-fg-muted">{r.creator?.name ?? '—'}</td>
              <td className="px-3 py-2 text-right font-mono text-xs">{r.commit_count}</td>
              <td className="px-3 py-2">
                {r.is_closed ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                    폐업
                  </span>
                ) : (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                    영업
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1.5">
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
                    onClick={() => onDelete(r)}
                    disabled={pendingId === r.id}
                    className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
