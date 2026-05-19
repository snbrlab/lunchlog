'use client';

import { useState, useTransition } from 'react';
import {
  sendBroadcastDigest,
  getBroadcastPreviewHtml,
  type PickableCommit,
} from '@/lib/admin/broadcast-actions';
import type { BroadcastStats } from '@/lib/email/broadcast';

const MAX_PICKS = 5;

export default function BroadcastPanel({
  stats,
  recipientCount,
  configured,
  recentCommits,
}: {
  stats: BroadcastStats;
  recipientCount: number;
  configured: boolean;
  recentCommits: PickableCommit[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  // D66: admin 이 고른 흥미로운 commit (선택 순서 유지)
  const [picked, setPicked] = useState<string[]>([]);

  function togglePick(id: string) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PICKS) return prev; // 상한
      return [...prev, id];
    });
  }

  function loadPreview() {
    setMsg(null);
    startTransition(async () => {
      const r = await getBroadcastPreviewHtml(picked);
      if (!r.ok) {
        setMsg(`❌ ${r.message}`);
        return;
      }
      setPreviewHtml(r.html);
    });
  }

  function testSend() {
    setMsg(null);
    startTransition(async () => {
      const r = await sendBroadcastDigest(true, picked);
      if (!r.ok) {
        setMsg(`❌ ${r.message}`);
        return;
      }
      setMsg(
        r.sent > 0
          ? '✅ 테스트 메일 보냈어요. 본인 메일함을 확인하세요.'
          : `❌ 발송 실패: ${r.failures[0] ?? '알 수 없음'}`,
      );
    });
  }

  function fullSend() {
    if (confirmText.trim() !== `전체 ${recipientCount}`) {
      setMsg(`❌ 확인 문구가 일치하지 않아요. "전체 ${recipientCount}" 를 입력하세요.`);
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const r = await sendBroadcastDigest(false, picked);
      if (!r.ok) {
        setMsg(`❌ ${r.message}`);
        return;
      }
      setConfirmText('');
      setMsg(
        `✅ 발송 완료 — 성공 ${r.sent} / 실패 ${r.failed}` +
          (r.failures.length ? `\n실패 일부: ${r.failures.join(' | ')}` : ''),
      );
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
        {[
          { label: '사용자', value: stats.userCount },
          { label: '등록 식당', value: stats.restaurantCount },
          { label: 'commit', value: stats.commitCount },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-3 py-4">
            <div className="text-2xl font-bold text-fg">{s.value}</div>
            <div className="mt-1 text-[11px] text-fg-muted">{s.label}</div>
          </div>
        ))}
      </section>

      {!configured && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ BREVO_API_KEY / BREVO_SENDER_EMAIL 환경변수가 없어요. 설정 전엔 발송이 실패합니다.
        </p>
      )}

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-fg">
          ⭐ 흥미로운 commit 골라 첨부{' '}
          <span className="text-[11px] font-normal text-fg-muted">
            ({picked.length}/{MAX_PICKS})
          </span>
        </h2>
        <p className="mt-1 text-[11px] text-fg-muted">
          최근 commit 중 메일에 같이 보여줄 것 선택 (최대 {MAX_PICKS}개). 선택 순서대로 표시돼요.
        </p>
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-bg p-2">
          {recentCommits.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-fg-muted">
              최근 commit 이 없어요
            </p>
          )}
          {recentCommits.map((c) => {
            const order = picked.indexOf(c.id);
            const checked = order >= 0;
            const disabled = !checked && picked.length >= MAX_PICKS;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => togglePick(c.id)}
                disabled={disabled}
                className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
                  checked
                    ? 'bg-amber-100/70'
                    : disabled
                      ? 'opacity-40'
                      : 'hover:bg-fg/5'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                    checked ? 'bg-amber-500 text-white' : 'border border-border'
                  }`}
                >
                  {checked ? order + 1 : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-fg">
                    {c.restaurantName ?? '(삭제된 식당)'}
                  </span>
                  <span className="ml-1 text-fg-muted">· {c.authorName}</span>
                  <span className="mt-0.5 block truncate text-fg-muted">
                    “{c.message}”
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-fg">0) 미리보기</h2>
        <p className="mt-1 text-[11px] text-fg-muted">
          발송 안 하고 본인 데이터로 렌더한 실제 메일 화면.
        </p>
        <button
          type="button"
          onClick={loadPreview}
          disabled={pending}
          className="mt-3 rounded border border-border px-3 py-1.5 text-xs text-fg transition hover:border-fg/40 disabled:opacity-50"
        >
          {pending ? '렌더링 중…' : previewHtml ? '미리보기 새로고침' : '미리보기 불러오기'}
        </button>
        {previewHtml && (
          <iframe
            title="메일 미리보기"
            srcDoc={previewHtml}
            className="mt-3 h-[640px] w-full rounded-md border border-border bg-white"
          />
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-fg">1) 나에게 테스트</h2>
        <p className="mt-1 text-[11px] text-fg-muted">
          본인 계정에게만 1통. 레이아웃·개인화 확인용.
        </p>
        <button
          type="button"
          onClick={testSend}
          disabled={pending}
          className="mt-3 rounded border border-border px-3 py-1.5 text-xs text-fg transition hover:border-fg/40 disabled:opacity-50"
        >
          {pending ? '발송 중…' : '테스트 메일 보내기'}
        </button>
      </section>

      <section className="rounded-lg border border-red-300 bg-red-50/40 p-4">
        <h2 className="text-sm font-medium text-red-700">2) 전체 발송 (되돌릴 수 없음)</h2>
        <p className="mt-1 text-[11px] text-fg-muted">
          가입자 <strong>{recipientCount}명</strong> 전원에게 발송. 확인을 위해{' '}
          <code className="rounded bg-fg/10 px-1">전체 {recipientCount}</code> 를 입력하세요.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={`전체 ${recipientCount}`}
          disabled={pending}
          className="mt-2 w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
        />
        <button
          type="button"
          onClick={fullSend}
          disabled={pending || confirmText.trim() !== `전체 ${recipientCount}`}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
        >
          {pending ? '발송 중…' : `${recipientCount}명에게 전체 발송`}
        </button>
      </section>

      {msg && (
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface px-3 py-2 text-xs text-fg">
          {msg}
        </pre>
      )}
    </div>
  );
}
