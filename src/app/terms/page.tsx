import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관 — lunchlog',
  robots: { index: false, follow: false },
};

const EFFECTIVE_DATE = '2026-07-08';
const CONTACT = 'heejin.suh@lge.com';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[14px] leading-relaxed text-neutral-800">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p className="mt-2 text-neutral-500">시행일: {EFFECTIVE_DATE}</p>

      <Section n="1" title="목적">
        <p>
          본 약관은 lunchlog(이하 &ldquo;서비스&rdquo;)의 이용 조건 및 절차, 이용자와 서비스의
          권리·의무를 규정합니다. 서비스는 사내 구성원의 점심·회식 맛집 리뷰 공유를 위한 비공식
          사이드 프로젝트로 운영됩니다.
        </p>
      </Section>

      <Section n="2" title="이용 자격">
        <p>
          서비스는 허용된 회사 이메일 도메인을 보유한 임직원만 가입·이용할 수 있습니다. 가입 시
          이용약관과 개인정보 처리방침에 동의해야 합니다.
        </p>
      </Section>

      <Section n="3" title="서비스 내용">
        <p>
          서비스는 맛집 정보 등록, 한줄평(리뷰) 작성, 지도 기반 탐색, 리뷰 공유 등의 기능을
          제공합니다. 서비스의 구체적 내용은 운영 상황에 따라 변경될 수 있습니다.
        </p>
      </Section>

      <Section n="4" title="이용자의 의무">
        <ul className="list-disc space-y-1 pl-5">
          <li>타인을 비방·모욕하거나 명예를 훼손하는 내용을 작성하지 않습니다.</li>
          <li>허위 정보, 광고성·불법 콘텐츠, 타인의 개인정보를 무단으로 게시하지 않습니다.</li>
          <li>서비스의 정상적 운영을 방해하는 행위를 하지 않습니다.</li>
          <li>본인의 계정 정보를 안전하게 관리할 책임이 있습니다.</li>
        </ul>
      </Section>

      <Section n="5" title="게시물의 권리와 관리">
        <p>
          이용자가 작성한 리뷰 등 게시물의 권리는 작성자에게 있습니다. 이용자는 서비스가 해당
          게시물을 서비스 화면 및 공유 기능을 통해 표시·이용하는 것에 동의합니다. 운영자는 제4조를
          위반한 게시물을 사전 통지 없이 숨기거나 삭제할 수 있습니다.
        </p>
      </Section>

      <Section n="6" title="서비스의 변경 및 중단">
        <p>
          서비스는 비공식 사이드 프로젝트로서 운영자의 사정에 따라 내용이 변경되거나 중단될 수
          있습니다. 이 경우 가능한 범위에서 사전에 공지합니다.
        </p>
      </Section>

      <Section n="7" title="면책">
        <p>
          서비스는 무상으로 제공되며, 게시된 맛집 정보·리뷰의 정확성이나 특정 목적 적합성을 보증하지
          않습니다. 운영자는 천재지변, 인프라 장애 등 불가항력이나 이용자의 귀책으로 인한 손해,
          데이터 유실에 대해 책임을 지지 않습니다. 게시물의 내용에 대한 책임은 작성자에게 있습니다.
        </p>
      </Section>

      <Section n="8" title="계정 해지 및 데이터 삭제">
        <p>
          이용자는 언제든지 이용을 중단하고 계정 삭제를 요청할 수 있습니다. 삭제 처리에 관한 사항은{' '}
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>
          을 따릅니다.
        </p>
      </Section>

      <Section n="9" title="문의 및 준거법">
        <p>
          문의: <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>
          <br />
          본 약관과 관련한 분쟁은 대한민국 법령에 따릅니다.
        </p>
      </Section>

      <p className="mt-8 text-neutral-500">본 약관은 {EFFECTIVE_DATE}부터 적용됩니다.</p>

      <div className="mt-10 border-t border-neutral-200 pt-6 text-[13px]">
        <Link href="/privacy" className="underline">
          개인정보 처리방침 보기 →
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
