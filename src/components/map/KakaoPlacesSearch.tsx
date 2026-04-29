'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { loadKakaoMaps } from '@/lib/kakao-loader';
import type { KakaoPlaceItem } from '@/types/kakao-maps';

interface Props {
  origin: { lat: number; lng: number };
  onSelect: (item: KakaoPlaceItem) => void;
}

// 카카오 키워드 검색. origin 기준 1km 이내 우선.
export function KakaoPlacesSearch({ origin, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoPlaceItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'ok' | 'empty' | 'error'>('idle');
  const [, startTransition] = useTransition();
  const ready = useRef(false);

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
        <p className="mt-3 text-center text-xs text-fg-muted">결과 없음. 다른 키워드로 검색.</p>
      )}
      {status === 'error' && (
        <p className="mt-3 text-center text-xs text-red-500">
          검색 실패. 카카오맵 SDK 가 안 떴거나 네트워크 문제.
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
    </div>
  );
}
