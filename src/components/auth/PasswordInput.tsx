'use client';

import { useId, useState } from 'react';

// 한글 (자모 + 음절) / 일본어 / 중국어 — 비밀번호 입력 시 IME 켜진 채로 친 경우 감지용.
// 라틴 문자가 아닌 코드포인트 하나라도 있으면 true.
function hasNonLatin(s: string): boolean {
  // ASCII 인쇄 가능 범위 + 일부 기호. 그 외는 비라틴으로 간주.
  return /[^\x20-\x7E]/.test(s);
}

interface Props {
  name: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: 'new-password' | 'current-password';
  placeholder?: string;
}

// IME / Caps Lock 사고 방지용 비밀번호 입력.
// - 👁 토글로 잠깐 보여서 확인 가능
// - 한글 등 non-Latin 문자 들어가면 즉시 경고
// - Caps Lock 켜져있으면 경고
// - autoCapitalize="off" / autoCorrect="off" / spellCheck=false 로 모바일 자동변환 차단
export default function PasswordInput({
  name,
  required,
  autoFocus,
  disabled,
  minLength,
  maxLength,
  autoComplete = 'new-password',
  placeholder,
}: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState('');
  const [capsLock, setCapsLock] = useState(false);

  const nonLatin = hasNonLatin(value);

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // 모바일 키보드 힌트 — 영문/숫자 위주로
          inputMode="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
          onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShown((s) => !s)}
          disabled={disabled}
          aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
          title={shown ? '숨기기' : '보기'}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
        >
          {shown ? '🙈' : '👁'}
        </button>
      </div>

      {nonLatin && (
        <p className="text-xs text-amber-700">
          ⚠️ 한글/특수문자가 섞여있어요. <strong>한/영 키</strong>를 확인해주세요 (영문 추천).
        </p>
      )}
      {capsLock && !nonLatin && (
        <p className="text-xs text-amber-700">⚠️ Caps Lock 이 켜져있어요</p>
      )}
    </div>
  );
}
