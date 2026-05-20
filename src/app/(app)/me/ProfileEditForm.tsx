'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { EmojiPicker } from '@/components/EmojiPicker';
import { KakaoPlacesSearch } from '@/components/map/KakaoPlacesSearch';
import { updateProfile, type UpdateProfileResult } from './actions';
import type { Office, OfficeBuilding } from '@/types/db';

interface Props {
  initialName: string;
  initialDepartment: string;
  initialOfficeId: string;
  initialBuildingId: string;
  initialEmoji: string;
  avatarColor: string;
  offices: Office[];
  buildings: OfficeBuilding[];
  initialCustomLat: number | null;
  initialCustomLng: number | null;
  initialCustomLabel?: string | null; // 현재 미저장 — 표시용만
}

export default function ProfileEditForm({
  initialName,
  initialDepartment,
  initialOfficeId,
  initialBuildingId,
  initialEmoji,
  avatarColor,
  offices,
  buildings,
  initialCustomLat,
  initialCustomLng,
  initialCustomLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [department, setDepartment] = useState(initialDepartment);
  const [officeId, setOfficeId] = useState(initialOfficeId);
  const [buildingId, setBuildingId] = useState(initialBuildingId);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [result, setResult] = useState<UpdateProfileResult | null>(null);
  // D68: 사용자 지정 좌표 (공유 오피스 등 임시 근무지)
  const [useCustomOrigin, setUseCustomOrigin] = useState(
    initialCustomLat != null && initialCustomLng != null,
  );
  const [customLat, setCustomLat] = useState<number | null>(initialCustomLat);
  const [customLng, setCustomLng] = useState<number | null>(initialCustomLng);
  const [customLabel, setCustomLabel] = useState<string | null>(initialCustomLabel ?? null);

  // 선택한 사무실 산하 건물만 노출
  const buildingsForOffice = useMemo(
    () => buildings.filter((b) => b.office_id === officeId),
    [buildings, officeId],
  );

  function onOfficeChange(next: string) {
    setOfficeId(next);
    // 사무실이 바뀌면 건물도 그 사무실의 첫 건물로 초기화
    const firstBuilding = buildings.find((b) => b.office_id === next);
    setBuildingId(firstBuilding?.id ?? '');
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await updateProfile({
        name,
        department: department.trim() || null,
        officeId,
        buildingId,
        avatarEmoji: emoji,
        customLat: useCustomOrigin ? customLat : null,
        customLng: useCustomOrigin ? customLng : null,
      });
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border bg-surface p-5"
    >
      {/* 이모지 */}
      <div className="text-sm">
        <span className="mb-1.5 block font-medium text-fg">프로필 이모지</span>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={pending}
          className="flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm transition hover:border-fg/40"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: avatarColor }}
            aria-hidden
          >
            {emoji}
          </span>
          <span className="text-fg-muted">{pickerOpen ? '닫기' : '바꾸기'}</span>
        </button>
        {pickerOpen && (
          <div className="mt-2">
            <EmojiPicker
              value={emoji}
              onChange={(next) => {
                setEmoji(next);
                setPickerOpen(false);
              }}
              avatarColor={avatarColor}
            />
          </div>
        )}
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-fg">표시 이름</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={40}
          disabled={pending}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg disabled:opacity-50"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-fg">
          부서 <span className="font-normal text-fg-muted">(선택)</span>
        </span>
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          maxLength={60}
          disabled={pending}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg disabled:opacity-50"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-fg">근무지 (사무실)</span>
        <select
          value={officeId}
          onChange={(e) => onOfficeChange(e.target.value)}
          required
          disabled={pending}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg disabled:opacity-50"
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-fg">건물</span>
        <select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          required
          disabled={pending || buildingsForOffice.length === 0}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg disabled:opacity-50"
        >
          <option value="">선택해주세요</option>
          {buildingsForOffice.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      {/* D68: 공유 오피스 등 임시 근무지 — 직접 좌표 지정 */}
      <div className="rounded-md border border-dashed border-border bg-bg/40 p-3 text-sm">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={useCustomOrigin}
            onChange={(e) => setUseCustomOrigin(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4"
          />
          <span className="flex-1">
            <span className="block font-medium text-fg">
              건물 말고 다른 위치에서 근무 중이에요
            </span>
            <span className="mt-0.5 block text-[11px] text-fg-muted">
              공유 오피스 등 등록된 건물에 없는 곳에서 일할 때 — 이 위치 기준으로 거리·도보 시간이 계산돼요
            </span>
          </span>
        </label>

        {useCustomOrigin && (
          <div className="mt-3 space-y-2">
            {customLat != null && customLng != null ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
                <span aria-hidden>📍</span>
                <span className="flex-1 text-amber-900">
                  {customLabel ?? `${customLat.toFixed(5)}, ${customLng.toFixed(5)}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomLat(null);
                    setCustomLng(null);
                    setCustomLabel(null);
                  }}
                  disabled={pending}
                  className="rounded px-1 text-amber-900/70 hover:bg-amber-200/60"
                  aria-label="좌표 지우기"
                >
                  ✕
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-fg-muted">
                아래에서 장소를 검색하면 좌표가 설정돼요.
              </p>
            )}
            <KakaoPlacesSearch
              // 검색 bias 는 서울 시청 (공유 오피스가 보통 도심)
              origin={{ lat: 37.5666, lng: 126.9784 }}
              onSelect={(item) => {
                setCustomLat(parseFloat(item.y));
                setCustomLng(parseFloat(item.x));
                setCustomLabel(item.place_name);
              }}
            />
          </div>
        )}
      </div>

      {result?.ok && <p className="text-sm text-emerald-600">저장 완료!</p>}
      {result && !result.ok && <p className="text-sm text-red-500">{result.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? '저장 중…' : '프로필 저장'}
      </button>
    </form>
  );
}
