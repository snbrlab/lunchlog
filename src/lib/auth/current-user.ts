// D55: getUser() + users 프로필 fetch 를 React cache() 로 한 요청 내에서 dedupe.
// Header 와 페이지 (예: /map, /me) 가 같은 요청에서 둘 다 호출해도 실제 DB 왕복은 한 번.
//
// Next.js App Router 의 RSC 렌더 트리는 cache() 의 메모이즈를 자연스럽게 활용 가능.

import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface CurrentUserProfile {
  user: User;
  profile: {
    name: string;
    avatar_color: string;
    avatar_emoji: string | null;
    role: 'member' | 'admin';
    department: string | null;
    office_id: string | null;
    building_id: string | null;
    password_set: boolean;
  } | null;
}

export const getCurrentUserOrNull = cache(async (): Promise<CurrentUserProfile | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select(
      'name, avatar_color, avatar_emoji, role, department, office_id, building_id, password_set',
    )
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile: profile as CurrentUserProfile['profile'] };
});
