'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { loadKakaoMaps } from '@/lib/kakao-loader';
import { lookupPlaceManually, parseKakaoPlaceFromUrl } from '@/lib/kakao/place-from-url';
import type { KakaoPlaceItem } from '@/types/kakao-maps';

interface Props {
  origin: { lat: number; lng: number };
  onSelect: (item: KakaoPlaceItem) => void;
}

// 카카오 키워드 검색. origin 기준 1km 이내 우선.
// 키워드 검색에 안 잡히는 식당은 카카오맵 url 직접 붙여넣기 fallback (D45).
export function KakaoPlacesSearch({ origin, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoPlaceItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'ok' | 'empty' | 'error'>('idle');
  const [, startTransition] = useTransition();
  const ready = useRef(false);

  // URL 자동 파싱 state — 카카오맵 url 만 넣으면 HTML 파싱으로 자동 채움
  const [autoUrl, setAutoUrl] = useState('');
  const [autoStatus, setAutoStatus] = useState<'idle' | 'fetching'>('idle');
  const [autoError, setAutoError] = useState<string | null>(null);
  const [, startAutoTransition] = useTransition();

  // 직접 입력 fallback state — URL 파싱도 실패할 때
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualKakaoUrl, setManualKakaoUrl] = useState('');
  const [manualStatus, setManualStatus] = useState<'idle' | 'fetching' | 'error'>('idle');
  const [manualError, setManualError] = useState<string | null>(null);
  const [, startManualTransition] = useTransition();

  useEffect(() => {
    loadKakaoMaps()
      .then(() => {
        ready.current = true;
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  function runSearch() {
    const q = query.trim();
    if (!q) return;
    if (!ready.current || !window.kakao?.maps?.services?.Places) {
      setStatus('error');
      return;
    }
    setStatus('searching');
    startTransition(() => {
      const places = new window.kakao.maps.services.Places();
      places.keywordSearch(
        q,
        (data, st) => {
          if (st === 'OK') {
            setResults(data);
            setStatus(data.length === 0 ? 'empty' : 'ok');
          } else if (st === 'ZERO_RESULT') {
            setResults([]);
            setStatus('empty');
          } else {
            setResults([]);
            setStatus('error');
          }
        },
        {
          // location + sort='distance' 만 줘서 origin 기준 가까운 순 노출.
          // radius 는 안 줌 — 회사 근처는 가까이 위에 뜨고, 멀리 있는 식당도 검색 가능.
          location: new window.kakao.maps.LatLng(origin.lat, origin.lng),
          size: 15,
          sort: 'distance',
        },
      );
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  }

  function runAutoFromUrl() {
    if (!autoUrl.trim()) return;
    setAutoStatus('fetching');
    setAutoError(null);
    startAutoTransition(async () => {
      const r = await parseKakaoPlaceFromUrl(autoUrl);
      setAutoStatus('idle');
      if (!r.ok) {
        setAutoError(r.message);
        return;
      }
      setAutoUrl('');
      onSelect({
        ...r.place,
        id: `auto-${Date.now()}`,
        category_name: '',
        category_group_code: '',
        category_group_name: '',
        phone: '',
        distance: '',
      } as KakaoPlaceItem);
    });
  }

  function runManualLookup() {
    if (!manualName.trim() || !manualAddress.trim()) return;
    setManualStatus('fetching');
    setManualError(null);
    startManualTransition(async () => {
      const r = await lookupPlaceManually({
        name: manualName,
        address: manualAddress,
        kakaoUrl: manualKakaoUrl || undefined,
      });
      if (!r.ok) {
        setManualStatus('error');
        setManualError(r.message);
        return;
      }
      setManualStatus('idle');
      setManualName('');
      setManualAddress('');
      setManualKakaoUrl('');
      onSelect({
        ...r.place,
        id: `manual-${Date.now()}`,
        category_name: '',
        category_group_code: '',
        category_group_name: '',
        phone: '',
        distance: '',
      } as KakaoPlaceItem);
    });
  }

  // 부모가 form 일 수 있어서 form 으로 못 감쌈 (nested form 금지). div + Enter 핸들러로 처리.
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="식당 이름 검색 (예: 하동관)"
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg"
        />
        <button
          type="button"
          onClick={runSearch}
          className="rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90"
        >
          검색
        </button>
      </div>

      {status === 'searching' && (
        <p className="mt-3 text-center text-xs text-fg-muted">검색 중…</p>
      )}
      {status === 'empty' && (
        <p className="mt-3 text-center text-xs text-fg-muted">결과가 없어요. 다른 키워드로 검색해주세요.</p>
      )}
      {status === 'error' && (
        <p className="mt-3 text-center text-xs text-red-500">
          검색에 실패했어요. 카카오맵 SDK 가 안 떴거나 네트워크 문제예요.
        </p>
      )}

      {status === 'ok' && (
        <ol className="mt-3 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="block w-full rounded px-3 py-2 text-left text-sm transition hover:bg-fg/5"
              >
                <p className="font-medium text-fg">{r.place_name}</p>
                <p className="text-[11px] text-fg-muted">
                  {r.road_address_name || r.address_name}
                  {r.distance && (
                    <>
                      <span className="mx-1">·</span>약 {r.distance}m
                    </>
                  )}
                </p>
                <p className="text-[10px] text-fg-muted/70">{r.category_name}</p>
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* URL 자동 파싱 — 카카오맵 url 만 넣으면 자동 채움 */}
      <details className="mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer text-[11px] text-fg-muted hover:text-fg">
          🔗 검색 안 나오면 카카오맵 url 로 자동 추가
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-fg-muted/80 leading-relaxed">
            카카오맵 앱/웹에서 식당 페이지 url 을 복사해 붙여넣으세요.<br />
            예: <span className="font-mono">https://place.map.kakao.com/27260928</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={autoUrl}
              onChange={(e) => setAutoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runAutoFromUrl();
                }
              }}
              placeholder="카카오맵 url 또는 place 번호"
              className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-xs text-fg outline-none focus:border-fg"
            />
            <button
              type="button"
              onClick={runAutoFromUrl}
              disabled={autoStatus === 'fetching' || !autoUrl.trim()}
              className="rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-40"
            >
              {autoStatus === 'fetching' ? '파싱 중…' : '자동 추가'}
            </button>
          </div>
          {autoError && <p className="text-xs text-red-500">{autoError}</p>}
          <p className="text-[10px] text-fg-muted/60">
            ※ 자동 파싱이 실패하면 아래 "직접 입력"을 써주세요.
          </p>
        </div>
      </details>

      {/* 직접 입력 — URL 파싱도 안 될 때 최후의 fallback */}
      <details className="mt-2 border-t border-border pt-3">
        <summary className="cursor-pointer text-[11px] text-fg-muted hover:text-fg">
          ✏️ 직접 입력
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-fg-muted/80 leading-relaxed">
            이름 + 도로명 주소를 직접 입력해주세요. 좌표는 주소로 자동 변환돼요.
          </p>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="식당 이름"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs text-fg outline-none focus:border-fg"
          />
          <input
            type="text"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            placeholder="도로명 주소 (예: 서울 강서구 마곡중앙8로 15)"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs text-fg outline-none focus:border-fg"
          />
          <input
            type="text"
            value={manualKakaoUrl}
            onChange={(e) => setManualKakaoUrl(e.target.value)}
            placeholder="(선택) 카카오맵 url"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs text-fg outline-none focus:border-fg"
          />
          <button
            type="button"
            onClick={runManualLookup}
            disabled={
              manualStatus === 'fetching' ||
              !manualName.trim() ||
              !manualAddress.trim()
            }
            className="w-full rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-40"
          >
            {manualStatus === 'fetching' ? '주소로 좌표 가져오는 중…' : '추가'}
          </button>
          {manualError && <p className="text-xs text-red-500">{manualError}</p>}
        </div>
      </details>
    </div>
  );
}
