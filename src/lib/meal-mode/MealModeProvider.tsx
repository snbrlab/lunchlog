'use client';

// 점심/저녁 모드 컨텍스트.
// - 초기값은 layout.tsx 의 부트 스크립트가 이미 html[data-mode] 에 박아둔 값.
// - toggle 시 html[data-mode] 갱신 + localStorage 동기화.
// - 토글 동안 0.4s transition 클래스 임시 부여, 끝나면 제거 (다른 동작 영향 최소화).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { MealMode } from '@/types/db';

interface MealModeContextValue {
  mode: MealMode;
  setMode: (mode: MealMode) => void;
  toggle: () => void;
}

const MealModeContext = createContext<MealModeContextValue | null>(null);
const STORAGE_KEY = 'lastMealMode';

function readDomMode(): MealMode {
  const attr = document.documentElement.dataset.mode;
  return attr === 'dinner' ? 'dinner' : 'lunch';
}

export function MealModeProvider({ children }: { children: React.ReactNode }) {
  // SSR/CSR 일관 위해 항상 'lunch' 로 hydrate. dom 의 실제 값은 useEffect 에서 sync.
  const [mode, setModeState] = useState<MealMode>('lunch');

  useEffect(() => {
    setModeState(readDomMode());
  }, []);

  const setMode = useCallback((next: MealMode) => {
    setModeState((prev) => {
      if (prev === next) return prev;
      const root = document.documentElement;
      root.classList.add('meal-mode-transition');
      root.dataset.mode = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // private mode 등에서 storage 실패 무시
      }
      // 0.4s 트랜지션 끝난 후 클래스 제거
      window.setTimeout(() => {
        root.classList.remove('meal-mode-transition');
      }, 450);
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'lunch' ? 'dinner' : 'lunch');
  }, [mode, setMode]);

  const value = useMemo(() => ({ mode, setMode, toggle }), [mode, setMode, toggle]);

  return <MealModeContext.Provider value={value}>{children}</MealModeContext.Provider>;
}

export function useMealMode(): MealModeContextValue {
  const ctx = useContext(MealModeContext);
  if (!ctx) throw new Error('useMealMode must be used within MealModeProvider');
  return ctx;
}
