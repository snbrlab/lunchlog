'use client';

import { useMemo, useState, useTransition } from 'react';
import { completeOnboarding, type CompleteOnboardingResult } from './actions';
import { EmojiPicker } from '@/components/EmojiPicker';
import type { Office, OfficeBuilding } from '@/types/db';

interface Props {
  defaultName: string;
  defaultDepartment: string;
  defaultEmoji: string;
  avatarColor: string;
  offices: Office[];
  buildings: OfficeBuilding[];
}

export default function OnboardingForm({
  defaultName,
  defaultDepartment,
  defaultEmoji,
  avatarColor,
  offices,
  buildings,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string>(offices[0]?.id ?? '');
  const [emoji, setEmoji] = useState<string>(defaultEmoji);
  const [pickerOpen, setPickerOpen] = useState(false);

  const buildingsForOffice = useMemo(
    () => buildings.filter((b) => b.office_id === officeId),
    [buildings, officeId],
  );

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r: CompleteOnboardingResult = await completeOnboarding(formData);
      // 성공 시 actions.ts 에서 redirect 되므로 여기 도달 X.
      // 실패 케이스만 처리.
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {/* 프로필 이모지 */}
      <div className="text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">프로필 이모지</span>
        <input type="hidden" name="avatar_emoji" value={emoji} />
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-3 rounded-md border border-neutral-300 px-3 py-2 text-sm transition hover:border-neutral-900"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: avatarColor }}
            aria-hidden
          >
            {emoji}
          </span>
          <span className="text-neutral-600">{pickerOpen ? '닫기' : '바꾸기'}</span>
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
        <span className="mb-1.5 block font-medium text-neutral-700">표시 이름</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName}
          maxLength={40}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">
          부서 <span className="font-normal text-neutral-400">(선택)</span>
        </span>
        <input
          type="text"
          name="department"
          defaultValue={defaultDepartment}
          maxLength={60}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">사무실</span>
        <select
          name="office_id"
          required
          value={officeId}
          onChange={(e) => setOfficeId(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">건물</span>
        <select
          name="building_id"
          required
          disabled={buildingsForOffice.length === 0}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
        >
          <option value="">선택해줘</option>
          {buildingsForOffice.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? '저장 중…' : '시작하기'}
      </button>
    </form>
  );
}
