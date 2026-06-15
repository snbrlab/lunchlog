'use client';

// D81: 친구 초대 버튼 — /me 페이지에서 초대 텍스트 + 가입 링크 공유.

import { ShareButton } from './ShareButton';

interface Props {
  inviterName: string;
}

export function InviteFriendButton({ inviterName }: Props) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/signup` : '';
  return (
    <ShareButton
      title="🍱 런치로그 초대"
      text={`${inviterName} 가 런치로그에 초대했어요! 🍱\n사내 점심·회식 식당 한 줄 리뷰 공유 앱. 회사 메일로 바로 가입 →`}
      url={url}
      className="self-start rounded-md border border-border bg-bg px-2.5 py-1.5 text-[11px] font-medium text-fg transition hover:border-emerald-400 hover:text-emerald-700"
      copiedMessage="초대 링크 복사됐어요"
    >
      💌 친구 초대
    </ShareButton>
  );
}
