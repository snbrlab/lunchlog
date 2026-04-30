import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { suggestNameFromEmail } from '@/lib/auth/email-domain';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import OnboardingForm from './OnboardingForm';
import type { Office, OfficeBuilding } from '@/types/db';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('name, department, office_id, building_id, avatar_color, avatar_emoji')
    .eq('id', user.id)
    .maybeSingle();

  // 이미 온보딩 끝났으면 /map 으로 (proxy 가 처리하긴 하지만 명시적으로)
  if (profile?.office_id && profile?.building_id) redirect('/map');

  const [{ data: offices }, { data: buildings }] = await Promise.all([
    supabase.from('offices').select('*').order('name'),
    supabase.from('office_buildings').select('*').order('display_order'),
  ]);

  const defaultName = profile?.name?.trim() || suggestNameFromEmail(user.email ?? '');
  const defaultEmoji = resolveAvatarEmoji(profile?.avatar_emoji, defaultName + user.id);
  const avatarColor = profile?.avatar_color ?? '#fde68a';

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight">환영합니다 👋</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            거리 계산을 위해 어디서 일하는지 알려주세요.
          </p>
        </div>

        <OnboardingForm
          defaultName={defaultName}
          defaultDepartment={profile?.department ?? ''}
          defaultEmoji={defaultEmoji}
          avatarColor={avatarColor}
          offices={(offices ?? []) as Office[]}
          buildings={(buildings ?? []) as OfficeBuilding[]}
        />
      </div>
    </main>
  );
}
