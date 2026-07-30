'use client';

// 식당 지정 공용 — 등록 식당 검색 + 없으면 카카오맵 링크로. 이슈 대상 / 답변 추천 첨부 둘 다 사용.
import { useState } from 'react';
import { RestaurantPicker } from './RestaurantPicker';

export type PlaceValue =
  | { kind: 'registered'; id: string; name: string }
  | { kind: 'external'; name: string; url: string }
  | null;

export function PlacePicker({
  value,
  onChange,
  searchPlaceholder = '식당 검색…',
}: {
  value: PlaceValue;
  onChange: (v: PlaceValue) => void;
  searchPlaceholder?: string;
}) {
  const [external, setExternal] = useState(false);
  const [extName, setExtName] = useState('');
  const [extUrl, setExtUrl] = useState('');

  // 등록 식당 선택 상태를 RestaurantPicker 형태로 변환
  const registered =
    value?.kind === 'registered' ? { id: value.id, name: value.name } : null;

  function emitExternal(name: string, url: string) {
    if (name.trim() && url.trim()) onChange({ kind: 'external', name: name.trim(), url: url.trim() });
    else onChange(null);
  }

  if (!external) {
    return (
      <div className="space-y-2">
        <RestaurantPicker
          value={registered}
          onChange={(r) => onChange(r ? { kind: 'registered', id: r.id, name: r.name } : null)}
          placeholder={searchPlaceholder}
        />
        <button
          type="button"
          onClick={() => {
            setExternal(true);
            onChange(null);
          }}
          className="block text-[11px] text-fg-muted underline-offset-2 hover:underline"
        >
          검색에 없어요? 카카오맵 링크로 추가 →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-2.5">
      <input
        type="text"
        value={extName}
        onChange={(e) => {
          setExtName(e.target.value);
          emitExternal(e.target.value, extUrl);
        }}
        maxLength={100}
        placeholder="식당 이름"
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-fg"
      />
      <input
        type="url"
        value={extUrl}
        onChange={(e) => {
          setExtUrl(e.target.value);
          emitExternal(extName, e.target.value);
        }}
        placeholder="카카오맵 링크 (place.map.kakao.com/…)"
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-fg"
      />
      <button
        type="button"
        onClick={() => {
          setExternal(false);
          onChange(null);
        }}
        className="text-[11px] text-fg-muted underline-offset-2 hover:underline"
      >
        ← 등록된 식당에서 찾기
      </button>
    </div>
  );
}
