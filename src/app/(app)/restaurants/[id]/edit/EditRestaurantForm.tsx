'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CUISINE_GROUPS, cuisineLabelFor } from '@/lib/cuisine';
import { updateRestaurant } from '@/lib/restaurants/actions';
import { KakaoPlacesSearch } from '@/components/map/KakaoPlacesSearch';
import type { CuisineType, MealMode, Restaurant } from '@/types/db';
import type { KakaoPlaceItem } from '@/types/kakao-maps';

interface Props {
  restaurant: Restaurant;
}

export default function EditRestaurantForm({ restaurant }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(restaurant.name);
  const [categories, setCategories] = useState<MealMode[]>(restaurant.categories);
  const [cuisines, setCuisines] = useState<CuisineType[]>(restaurant.cuisine_types ?? []);
  const [menuTagInput, setMenuTagInput] = useState('');
  const [menuTags, setMenuTags] = useState<string[]>(restaurant.menu_tags);
  const [priceLevel, setPriceLevel] = useState<1 | 2 | 3>(restaurant.price_level);
  const [note, setNote] = useState(restaurant.note ?? '');
  const [recMin, setRecMin] = useState(
    restaurant.recommended_min_size != null ? String(restaurant.recommended_min_size) : '',
  );
  const [recMax, setRecMax] = useState(
    restaurant.recommended_max_size != null ? String(restaurant.recommended_max_size) : '',
  );
  const [hasAlcohol, setHasAlcohol] = useState(restaurant.has_alcohol);

  const [latitude, setLatitude] = useState<number>(restaurant.latitude);
  const [longitude, setLongitude] = useState<number>(restaurant.longitude);
  const [address, setAddress] = useState(restaurant.address);
  const [kakaoPlaceUrl, setKakaoPlaceUrl] = useState<string | null>(
    restaurant.kakao_place_url,
  );
  const [searchOpen, setSearchOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  function onPlaceSelect(item: KakaoPlaceItem) {
    setName(item.place_name);
    setLatitude(parseFloat(item.y));
    setLongitude(parseFloat(item.x));
    setAddress(item.road_address_name || item.address_name);
    setKakaoPlaceUrl(item.place_url || null);
    setSearchOpen(false);
  }

  function toggleCategory(c: MealMode) {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function addMenuTag(raw: string) {
    const t = raw.trim().replace(/,$/, '');
    if (!t || menuTags.includes(t) || menuTags.length >= 10) return;
    setMenuTags([...menuTags, t]);
    setMenuTagInput('');
  }
  function removeMenuTag(t: string) {
    setMenuTags(menuTags.filter((x) => x !== t));
  }
  function onTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addMenuTag(menuTagInput);
    } else if (e.key === 'Backspace' && menuTagInput === '' && menuTags.length > 0) {
      removeMenuTag(menuTags[menuTags.length - 1]!);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const recMinNum = recMin.trim() ? Number(recMin) : null;
    const recMaxNum = recMax.trim() ? Number(recMax) : null;

    startTransition(async () => {
      const r = await updateRestaurant({
        id: restaurant.id,
        name,
        categories,
        cuisineTypes: cuisines,
        menuTags,
        priceLevel,
        note: note.trim() || null,
        recommendedMinSize: recMinNum,
        recommendedMaxSize: recMaxNum,
        hasAlcohol,
        latitude,
        longitude,
        address,
        kakaoPlaceUrl,
      });
      // 성공 시 redirect 됨. 여기 도달하면 실패.
      if (r && !r.ok) setError(r.message);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 위치/이름 — 카카오 재검색으로 변경 가능 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-fg">위치 / 이름</h2>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="rounded border border-border px-2 py-1 text-[11px] text-fg-muted hover:border-fg/40 hover:text-fg"
          >
            {searchOpen ? '닫기' : '🔍 카카오에서 다시 찾기'}
          </button>
        </div>
        {searchOpen && (
          <KakaoPlacesSearch
            origin={{ lat: latitude, lng: longitude }}
            onSelect={onPlaceSelect}
          />
        )}
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-fg-muted">
          <p className="break-all">
            <span className="font-medium text-fg">{name}</span>
          </p>
          <p className="mt-0.5 font-mono text-[10px]">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
          <p className="mt-0.5">{address}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-fg">식당 정보</h2>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-fg">이름 (직접 수정도 가능)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg"
          />
        </label>

        {/* 점심/저녁 카테고리 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">언제 갈 수 있는 곳?</span>
          <div className="flex gap-2">
            {(['lunch', 'dinner'] as const).map((c) => {
              const active = categories.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition ${
                    active
                      ? 'border-fg bg-fg text-bg'
                      : 'border-border bg-surface text-fg-muted hover:border-fg/40'
                  }`}
                >
                  {c === 'lunch' ? '☀ 점심' : '☾ 저녁'}
                </button>
              );
            })}
          </div>
        </div>

        {/* cuisine — 복수 선택 가능 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">
            음식 종류 (1개 이상)
          </span>
          <div className="space-y-2 rounded-md border border-border bg-surface p-3">
            {CUISINE_GROUPS.map((group) => (
              <div key={group.label} className="flex items-start gap-2">
                <span className="w-16 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                  {group.label}
                </span>
                <div className="flex flex-1 flex-wrap gap-1">
                  {group.items.map((item) => {
                    const active = cuisines.includes(item.value);
                    return (
                      <button
                        type="button"
                        key={item.value}
                        onClick={() =>
                          setCuisines((prev) =>
                            prev.includes(item.value)
                              ? prev.filter((x) => x !== item.value)
                              : [...prev, item.value],
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-xs transition ${
                          active ? 'bg-fg text-bg' : 'bg-bg text-fg-muted hover:bg-fg/5'
                        }`}
                      >
                        {cuisineLabelFor(item)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* menu tags */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">
            추천 메뉴 / 태그 (Enter 로 추가)
          </span>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5">
            {menuTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-fg/10 px-2 py-0.5 text-xs text-fg"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeMenuTag(t)}
                  aria-label={`${t} 제거`}
                  className="text-fg-muted hover:text-fg"
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              type="text"
              value={menuTagInput}
              onChange={(e) => setMenuTagInput(e.target.value)}
              onKeyDown={onTagKey}
              placeholder={menuTags.length === 0 ? '곰탕, 회식, 혼밥OK 등' : ''}
              className="flex-1 min-w-[6rem] bg-transparent px-1 py-0.5 text-sm outline-none"
              maxLength={30}
            />
          </div>
        </div>

        {/* 술 가능 */}
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasAlcohol}
              onChange={(e) => setHasAlcohol(e.target.checked)}
              className="h-4 w-4"
            />
            <span aria-hidden>🍺</span>
            <span className="text-fg">술 가능</span>
          </label>
        </div>

        {/* 추천 인원 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">
            추천 인원 (선택, 둘 다 비우거나 둘 다 입력)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={recMin}
              onChange={(e) => setRecMin(e.target.value)}
              placeholder="min"
              className="h-9 w-20 rounded-md border border-border bg-surface px-2 text-sm text-fg outline-none focus:border-fg"
            />
            <span className="text-fg-muted">~</span>
            <input
              type="number"
              min={1}
              max={99}
              value={recMax}
              onChange={(e) => setRecMax(e.target.value)}
              placeholder="max"
              className="h-9 w-20 rounded-md border border-border bg-surface px-2 text-sm text-fg outline-none focus:border-fg"
            />
            <span className="text-xs text-fg-muted">인</span>
          </div>
        </div>

        {/* 가격대 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">
            가격대 <span className="font-normal text-fg-muted/70">(1인 기준)</span>
          </span>
          <div className="flex gap-2">
            {(
              [
                { p: 1, label: '1만원 이하' },
                { p: 2, label: '1~2만원' },
                { p: 3, label: '2만원 이상' },
              ] as const
            ).map(({ p, label }) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriceLevel(p)}
                title={label}
                className={`flex flex-col items-center rounded-md border px-3 py-1.5 transition ${
                  p === priceLevel
                    ? 'border-fg bg-fg text-bg'
                    : 'border-border bg-surface text-fg-muted hover:border-fg/40'
                }`}
              >
                <span className="font-mono text-sm">{'₩'.repeat(p)}</span>
                <span className="mt-0.5 text-[10px] opacity-80">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 비고 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">비고</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-fg"
          />
        </div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-sm text-fg-muted hover:text-fg"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending || categories.length === 0 || cuisines.length === 0}
          className="flex-1 rounded-md bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-40"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}
