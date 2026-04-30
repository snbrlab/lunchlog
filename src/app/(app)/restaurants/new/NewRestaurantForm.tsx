'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { KakaoPlacesSearch } from '@/components/map/KakaoPlacesSearch';
import { useMealMode } from '@/lib/meal-mode/MealModeProvider';
import { CUISINE_GROUPS, cuisineLabelFor } from '@/lib/cuisine';
import { createRestaurant, type CreateRestaurantResult } from './actions';
import type { CuisineType, MealMode } from '@/types/db';
import type { KakaoPlaceItem } from '@/types/kakao-maps';

interface Props {
  origin: { lat: number; lng: number };
}

export default function NewRestaurantForm({ origin }: Props) {
  const router = useRouter();
  const { mode } = useMealMode();
  const [pending, startTransition] = useTransition();

  // 검색 결과로 prefill 되는 항목
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [kakaoPlaceUrl, setKakaoPlaceUrl] = useState<string | null>(null);

  // 사용자 입력
  const [categories, setCategories] = useState<MealMode[]>([mode]);
  const [cuisines, setCuisines] = useState<CuisineType[]>([]);
  const [menuTagInput, setMenuTagInput] = useState('');
  const [menuTags, setMenuTags] = useState<string[]>([]);
  const [priceLevel, setPriceLevel] = useState<1 | 2 | 3>(2);
  const [note, setNote] = useState('');
  const [recMin, setRecMin] = useState('');
  const [recMax, setRecMax] = useState('');
  const [hasAlcohol, setHasAlcohol] = useState(false);

  // 첫 리뷰
  const [firstReview, setFirstReview] = useState('');
  const [firstReviewMode, setFirstReviewMode] = useState<MealMode>(mode);
  const [firstReviewParty, setFirstReviewParty] = useState('');

  // 50m 중복 모달
  const [duplicate, setDuplicate] = useState<{ id: string; name: string; meters: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  function onPlaceSelect(item: KakaoPlaceItem) {
    setName(item.place_name);
    setLatitude(parseFloat(item.y));
    setLongitude(parseFloat(item.x));
    setAddress(item.road_address_name || item.address_name);
    setKakaoPlaceUrl(item.place_url || null);
  }

  function toggleCategory(c: MealMode) {
    setCategories((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      // 첫 리뷰 모드가 더 이상 식당 카테고리에 없으면 남은 쪽으로 보정
      if (next.length > 0 && !next.includes(firstReviewMode)) {
        setFirstReviewMode(next[0]!);
      }
      return next;
    });
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

  function submit(force: boolean) {
    setError(null);
    if (latitude == null || longitude == null) {
      setError('카카오 검색에서 식당을 먼저 선택해주세요');
      return;
    }
    const recMinNum = recMin.trim() ? Number(recMin) : null;
    const recMaxNum = recMax.trim() ? Number(recMax) : null;
    const partyNum = firstReviewParty.trim() ? Number(firstReviewParty) : null;

    startTransition(async () => {
      const r: CreateRestaurantResult = await createRestaurant({
        name,
        categories,
        cuisineTypes: cuisines,
        menuTags,
        priceLevel,
        latitude,
        longitude,
        address,
        note: note.trim() || null,
        recommendedMinSize: recMinNum,
        recommendedMaxSize: recMaxNum,
        hasAlcohol,
        kakaoPlaceUrl,
        firstReviewMessage: firstReview,
        firstReviewMealTime: firstReviewMode,
        firstReviewPartySize: partyNum,
        forceCreate: force,
      });
      if (r.ok) {
        router.push('/map');
        router.refresh();
        return;
      }
      if (r.reason === 'duplicate') {
        setDuplicate(r.candidate);
        return;
      }
      setError(r.message);
    });
  }

  function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit(false);
  }

  return (
    <form onSubmit={onFormSubmit} className="space-y-6">
      {/* 카카오 검색 */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-fg">1. 카카오에서 식당 찾기</h2>
        <KakaoPlacesSearch origin={origin} onSelect={onPlaceSelect} />
        {latitude != null && longitude != null && (
          <p className="mt-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-fg-muted">
            ✓ 선택됨: <span className="font-medium text-fg">{name}</span>
            <br />
            <span className="font-mono text-[10px]">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </span>{' '}
            · {address}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-fg">2. 식당 정보</h2>

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
            음식 종류 (1개 이상 선택) — 한일퓨전 등 여러 그룹 걸치는 곳은 다중 선택
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
            추천 메뉴 / 태그 (선택, Enter 로 추가)
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
            <span className="text-fg">술 가능 (회식/한잔 가능한 곳)</span>
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

        {/* 비고 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">비고 (선택)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex) 점심 웨이팅 길어요"
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-fg"
          />
        </div>
      </section>

      {/* 첫 리뷰 */}
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-fg">3. 첫 한 줄 리뷰 (필수)</h2>
        <input
          type="text"
          value={firstReview}
          onChange={(e) => setFirstReview(e.target.value)}
          placeholder="이 식당의 첫 commit 메시지"
          maxLength={200}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg"
        />
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFirstReviewMode((m) => (m === 'lunch' ? 'dinner' : 'lunch'))}
            disabled={categories.length < 2}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg text-base hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bg"
            title={
              categories.length < 2
                ? '식당 카테고리에 점심+저녁 모두 선택해야 토글 가능'
                : firstReviewMode === 'lunch'
                  ? '점심'
                  : '저녁'
            }
          >
            {firstReviewMode === 'lunch' ? '☀' : '☾'}
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={firstReviewParty}
            onChange={(e) => setFirstReviewParty(e.target.value)}
            placeholder="👥 N"
            className="h-8 w-20 rounded-md border border-border bg-bg px-2 text-sm outline-none focus:border-fg"
          />
        </div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-sm text-fg-muted hover:text-fg"
          disabled={pending}
        >
          취소
        </button>
        <button
          type="submit"
          disabled={
            pending ||
            latitude == null ||
            categories.length === 0 ||
            cuisines.length === 0 ||
            !firstReview.trim()
          }
          className="flex-1 rounded-md bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-40"
        >
          {pending ? '등록 중…' : '등록 + 첫 commit'}
        </button>
      </div>

      {duplicate && (
        <DuplicateModal
          duplicate={duplicate}
          pending={pending}
          onSame={() => {
            // 같은 곳이면 그쪽으로 이동
            router.push('/map');
            router.refresh();
          }}
          onDifferent={() => {
            setDuplicate(null);
            submit(true);
          }}
        />
      )}
    </form>
  );
}

function DuplicateModal({
  duplicate,
  pending,
  onSame,
  onDifferent,
}: {
  duplicate: { id: string; name: string; meters: number };
  pending: boolean;
  onSame: () => void;
  onDifferent: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-fg">혹시 같은 식당 아닐까요?</h3>
        <p className="mt-2 text-xs text-fg-muted">
          좌표 {duplicate.meters}m 이내 같은 음식 종류로{' '}
          <span className="font-medium text-fg">"{duplicate.name}"</span> 이 이미 등록돼 있어요.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onSame}
            disabled={pending}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-xs text-fg hover:bg-fg/5"
          >
            같은 곳이에요 (목록으로)
          </button>
          <button
            type="button"
            onClick={onDifferent}
            disabled={pending}
            className="flex-1 rounded-md bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-40"
          >
            다른 곳이에요 (그냥 등록)
          </button>
        </div>
      </div>
    </div>
  );
}
