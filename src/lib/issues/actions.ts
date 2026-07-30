'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { invalidateReviewsLogCache } from '@/lib/cache/reviews-log';
import { invalidateIssuesCache } from '@/lib/cache/issues';
import { isAllowedKakaoUrl } from '@/lib/kakao-url';
import { fetchIssues, type IssueListItem } from '@/lib/issues/queries';

// 탭/지역 필터 변경 시 목록 재조회 (인증 사용자만)
export async function listIssues(
  status: 'open' | 'closed' | 'all',
  office: string,
): Promise<IssueListItem[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return fetchIssues(supabase, { status, office });
}

export type OpenIssueResult = { ok: true; id: string } | { ok: false; message: string };
export type AnswerIssueResult = { ok: true } | { ok: false; message: string };
export type CloseIssueResult = { ok: true } | { ok: false; message: string };

const BODY_MAX = 500;
const ANSWER_MAX = 2000;

// 리뷰 mention 트리거와 동일 정규식: @[Name with spaces] 또는 @simpleName(영문/숫자/_/한글)
const MENTION_RE = /@(?:\[([^\]]+)\]|([\w가-힣]+))/g;

// body 의 @멘션 → 해당 user 에게 issue_mention 노티. notifications 는 insert 정책이 없어(트리거 전용)
// service-role 로 넣는다. 본인/작성자 중복은 호출측에서 excludeId 로 skip.
async function notifyIssueMentions(opts: {
  body: string;
  issueId: string;
  issueNumber: number;
  actorId: string;
  actorName: string;
  excludeIds: string[]; // 본인 + (이슈 작성자 등 이미 다른 노티 받는 사람)
}): Promise<void> {
  const names = new Set<string>();
  for (const m of opts.body.matchAll(MENTION_RE)) {
    const name = (m[1] ?? m[2] ?? '').trim();
    if (name) names.add(name.toLowerCase());
  }
  if (names.size === 0) return;

  const sa = getSupabaseAdminClient();
  const { data: users } = await sa.from('users').select('id, name');
  const exclude = new Set(opts.excludeIds);
  const targets = ((users ?? []) as { id: string; name: string }[]).filter(
    (u) => names.has(u.name.toLowerCase()) && !exclude.has(u.id),
  );
  if (targets.length === 0) return;

  await sa.from('notifications').insert(
    targets.map((u) => ({
      user_id: u.id,
      type: 'issue_mention',
      payload: {
        issue_id: opts.issueId,
        issue_number: opts.issueNumber,
        author_name: opts.actorName,
        preview: opts.body.slice(0, 100),
      },
    })),
  );
}

// 이슈 열기 — 대상: 등록 식당(restaurantId) / 미등록 식당(externalName+externalUrl) / 지역(officeId).
export async function openIssue(input: {
  body: string;
  restaurantId?: string | null;
  externalName?: string | null;
  externalUrl?: string | null;
  officeId?: string | null;
}): Promise<OpenIssueResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, message: '무엇이 궁금한지 적어주세요' };
  if (body.length > BODY_MAX) return { ok: false, message: `${BODY_MAX}자 이내로 적어주세요` };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  // 대상 결정 + office_id 도출 (지역필터는 항상 office_id 기준)
  let restaurantId: string | null = null;
  let officeId: string | null = input.officeId ?? null;
  let externalName: string | null = null;
  let externalUrl: string | null = null;

  if (input.restaurantId) {
    const { data: r } = await supabase
      .from('restaurants')
      .select('id, office_id')
      .eq('id', input.restaurantId)
      .maybeSingle();
    if (!r) return { ok: false, message: '식당을 찾을 수 없어요' };
    restaurantId = r.id;
    officeId = r.office_id; // 식당 이슈의 지역 = 식당의 office
  } else if (input.externalName?.trim()) {
    // 미등록 식당 — 이름 + 카카오맵 링크
    externalName = input.externalName.trim().slice(0, 100);
    const url = input.externalUrl?.trim() ?? '';
    if (!url || !isAllowedKakaoUrl(url)) {
      return { ok: false, message: '카카오맵 링크를 정확히 넣어주세요' };
    }
    externalUrl = url;
  }

  if (!officeId) {
    // 지역 미지정(지역이슈 or 미등록식당이슈)이면 작성자 근무지로 기본
    const { data: me } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', user.id)
      .maybeSingle();
    officeId = me?.office_id ?? null;
  }

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('issues')
    .insert({
      author_id: user.id,
      office_id: officeId,
      restaurant_id: restaurantId,
      external_name: externalName,
      external_url: externalUrl,
      body,
    })
    .select('id, issue_number')
    .single();

  if (error) return { ok: false, message: error.message };

  await notifyIssueMentions({
    body,
    issueId: data.id,
    issueNumber: data.issue_number,
    actorId: user.id,
    actorName: profile?.name ?? '익명',
    excludeIds: [user.id],
  });

  invalidateReviewsLogCache(); // /log 피드에 'issue 열림' 반영
  invalidateIssuesCache(); // /issues 기본 목록 새로고침
  return { ok: true, id: data.id };
}

// 답변 — 선택적으로 식당 추천 첨부: 등록(restaurantId) 또는 미등록(externalName+externalUrl)
export async function answerIssue(input: {
  issueId: string;
  body: string;
  restaurantId?: string | null;
  externalName?: string | null;
  externalUrl?: string | null;
}): Promise<AnswerIssueResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, message: '답변을 입력해주세요' };
  if (body.length > ANSWER_MAX) return { ok: false, message: `${ANSWER_MAX}자 이내로 적어주세요` };

  // 미등록 식당 첨부 시 카카오 링크 검증
  let externalName: string | null = null;
  let externalUrl: string | null = null;
  if (!input.restaurantId && input.externalName?.trim()) {
    externalName = input.externalName.trim().slice(0, 100);
    const url = input.externalUrl?.trim() ?? '';
    if (!url || !isAllowedKakaoUrl(url)) {
      return { ok: false, message: '카카오맵 링크를 정확히 넣어주세요' };
    }
    externalUrl = url;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  const { data: issue } = await supabase
    .from('issues')
    .select('id, author_id, issue_number')
    .eq('id', input.issueId)
    .maybeSingle();
  if (!issue) return { ok: false, message: '이슈를 찾을 수 없어요' };

  const { error } = await supabase.from('issue_comments').insert({
    issue_id: input.issueId,
    author_id: user.id,
    body,
    restaurant_id: input.restaurantId ?? null,
    external_name: externalName,
    external_url: externalUrl,
  });
  if (error) return { ok: false, message: error.message };
  // issue_answer 노티는 trg_issue_answer 트리거가 처리 (이슈 작성자에게)

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  // 멘션 노티 — 답변 작성자 + 이슈 작성자는 제외 (작성자는 issue_answer 로 이미 받음)
  await notifyIssueMentions({
    body,
    issueId: issue.id,
    issueNumber: issue.issue_number,
    actorId: user.id,
    actorName: profile?.name ?? '익명',
    excludeIds: [user.id, issue.author_id],
  });

  invalidateIssuesCache(); // 목록의 💬 답변수 갱신
  return { ok: true };
}

// 이슈 닫기 — 작성자/admin (RLS 로 강제). 선택적으로 "이 식당으로 해결".
export async function closeIssue(input: {
  issueId: string;
  resolvedRestaurantId?: string | null;
}): Promise<CloseIssueResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  const { error, count } = await supabase
    .from('issues')
    .update(
      {
        status: 'closed',
        closed_at: new Date().toISOString(),
        resolved_restaurant_id: input.resolvedRestaurantId ?? null,
      },
      { count: 'exact' },
    )
    .eq('id', input.issueId)
    .eq('status', 'open'); // 이미 닫힌 것 재처리 방지
  if (error) return { ok: false, message: error.message };
  if (!count) return { ok: false, message: '닫을 권한이 없거나 이미 닫힌 이슈예요' };

  invalidateReviewsLogCache();
  invalidateIssuesCache();
  return { ok: true };
}
