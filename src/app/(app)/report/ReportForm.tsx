'use client';

import { useState, useTransition } from 'react';
import { createReport, type CreateReportResult } from './actions';
import type { ReportCategory } from '@/types/db';

const CATEGORIES: { value: ReportCategory; label: string; desc: string }[] = [
  { value: 'bug', label: '🐞 버그', desc: '동작이 이상하거나 에러' },
  { value: 'feature', label: '💡 기능 제안', desc: '있으면 좋겠어요' },
  { value: 'restaurant', label: '🍽️ 식당 오류', desc: '잘못된 정보/폐업/중복' },
  { value: 'other', label: '💬 기타', desc: '인사/문의/잡담' },
];

export default function ReportForm() {
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<ReportCategory>('bug');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError('내용을 입력해줘');
      return;
    }
    const fd = new FormData();
    fd.set('category', category);
    fd.set('message', trimmed);
    startTransition(async () => {
      const r: CreateReportResult = await createReport(fd);
      if (r && !r.ok) setError(r.message);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border bg-surface p-5"
    >
      <div>
        <span className="mb-1.5 block text-xs font-medium text-fg-muted">카테고리</span>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                c.value === category
                  ? 'border-fg bg-fg/5 text-fg'
                  : 'border-border bg-bg text-fg-muted hover:border-fg/40'
              }`}
            >
              <p className="font-medium">{c.label}</p>
              <p className="mt-0.5 text-[10px] opacity-70">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-fg-muted">
          내용 <span className="font-normal opacity-70">({message.length}/1000)</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={1000}
          required
          placeholder="상세히 적어주실수록 좋아요. 예: '신세계포차 좌표가 틀려요. 실제로는 ...'"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-fg"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={pending || !message.trim()}
        className="w-full rounded-md bg-fg px-4 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
      >
        {pending ? '보내는 중…' : '제보 보내기'}
      </button>
    </form>
  );
}
