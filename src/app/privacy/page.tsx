import Link from 'next/link';
import type { Metadata } from 'next';
import { CONTACT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = {
  title: '개인정보 처리방침 — lunchlog',
  robots: { index: false, follow: false },
};

// 시행일 — 내용이 바뀌면 갱신.
const EFFECTIVE_DATE = '2026-07-08';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[14px] leading-relaxed text-neutral-800">
      <h1 className="text-2xl font-bold">개인정보 처리방침</h1>
      <p className="mt-2 text-neutral-500">시행일: {EFFECTIVE_DATE}</p>

      <p className="mt-6">
        lunchlog(이하 &ldquo;서비스&rdquo;)는 사내 구성원의 점심·회식 맛집 리뷰 공유를 위한 비공식
        사이드 프로젝트입니다. 서비스는 「개인정보 보호법」을 준수하며, 아래와 같이 개인정보를
        처리합니다.
      </p>

      <Section n="1" title="수집하는 개인정보 항목">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>필수</b>: 회사 이메일, 닉네임, 비밀번호(암호화하여 저장)
          </li>
          <li>
            <b>서비스 이용 중 생성</b>: 소속 오피스·건물, 작성한 리뷰(한줄평)·반응·수정 제안(PR),
            방문 시간대·인원
          </li>
          <li>
            <b>선택</b>: 부서, 사용자가 직접 지정한 근무 좌표(공유 오피스 등)
          </li>
        </ul>
      </Section>

      <Section n="2" title="개인정보의 수집·이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>사내 점심/회식 맛집 리뷰 서비스 제공(지도 표시, 거리 계산, 리뷰 기록)</li>
          <li>회원 식별 및 중복 가입 방지, 닉네임 표시</li>
          <li>서비스 운영·개선 및 문의 응대</li>
        </ul>
      </Section>

      <Section n="3" title="보유 및 이용 기간">
        <p>
          회원 탈퇴 시 또는 서비스 종료 시까지 보유하며, 그 이후에는 지체 없이 파기합니다. 탈퇴 시
          계정과 프로필 정보는 삭제되며, 작성한 리뷰는 작성자 정보가 익명화된 상태로 서비스 기록
          유지를 위해 보존될 수 있습니다.
        </p>
      </Section>

      <Section n="4" title="개인정보의 제3자 제공">
        <p>서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.</p>
      </Section>

      <Section n="5" title="개인정보 처리의 위탁">
        <p>서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁합니다.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>Supabase</b> — 데이터베이스 및 인증 인프라 운영
          </li>
          <li>
            <b>Brevo</b> — 가입 인증 메일 발송
          </li>
        </ul>
      </Section>

      <Section n="6" title="공개 공유 링크에 관한 안내">
        <p>
          이용자가 자신의 리뷰를 외부에 공유하는 링크(예: 카카오톡 공유)에는{' '}
          <b>작성자 닉네임이 포함되지 않으며</b>, 식당명·한줄평 내용·지역·시간대만 표시됩니다.
        </p>
      </Section>

      <Section n="7" title="정보주체의 권리와 행사 방법">
        <p>
          이용자는 언제든지 본인 개인정보의 열람·정정·삭제·처리정지를 요청할 수 있습니다. 앱 내
          프로필에서 정보를 수정할 수 있으며, 계정·데이터 삭제 등은 로그인 후{' '}
          <Link href="/report" className="underline">
            관리자에게 문의
          </Link>
          하거나 아래 문의처로 요청할 수 있습니다. 이용자는 동의를 거부할 권리가 있으나, 필수 항목
          동의를 거부하는 경우 회원가입이 제한됩니다.
        </p>
      </Section>

      <Section n="8" title="개인정보의 안전성 확보 조치">
        <p>
          비밀번호는 복호화 불가능한 형태로 저장하며, 데이터 접근은 인증·권한(RLS) 기반으로
          제한합니다. 회사 이메일 등 식별정보는 일반 이용자에게 노출되지 않도록 접근을 통제합니다.
        </p>
      </Section>

      <Section n="9" title="문의처">
        <p>
          개인정보 관련 문의는 로그인 후{' '}
          <Link href="/report" className="underline">
            관리자에게 문의
          </Link>
          를 이용해 주세요.
          {CONTACT_EMAIL && (
            <>
              {' '}
              그 외 문의:{' '}
              <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </>
          )}
        </p>
      </Section>

      <p className="mt-8 text-neutral-500">
        본 방침은 {EFFECTIVE_DATE}부터 적용됩니다. 내용 변경 시 서비스 내 공지합니다.
      </p>

      <div className="mt-10 border-t border-neutral-200 pt-6 text-[13px]">
        <Link href="/terms" className="underline">
          이용약관 보기 →
        </Link>
      </div>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold">
        {n}. {title}
      </h2>
      <div className="mt-2 text-neutral-700">{children}</div>
    </section>
  );
}
