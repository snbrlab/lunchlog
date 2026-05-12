'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') throw new Error('관리자만 가능해요');
  return { supabase, userId: user.id };
}

export type CreateAnnouncementResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export async function createAnnouncement(body: string): Promise<CreateAnnouncementResult> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 200) {
    return { ok: false, message: '공지 내용 1~200자' };
  }

  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { data, error } = await admin.supabase
    .from('announcements')
    .insert({ body: trimmed, active: true, created_by: admin.userId })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: data.id };
}

export type ToggleAnnouncementResult = { ok: true } | { ok: false; message: string };

export async function setAnnouncementActive(
  id: string,
  active: boolean,
): Promise<ToggleAnnouncementResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const { error } = await admin.supabase
    .from('announcements')
    .update({ active })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<ToggleAnnouncementResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const { error } = await admin.supabase.from('announcements').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
