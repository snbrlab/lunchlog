'use client';

import { useState, useTransition } from 'react';
import { computeSaju, type SajuInput } from '@/lib/saju/calc';
import { buildSajuView, type SajuView } from '@/lib/saju/result';
import { ELEMENT_META, type Element } from '@/lib/saju/menus';
import { recommendRestaurant, type SajuRestaurant } from './actions';

// 사주 냄비 재료 — 오행별 재료 이모지 + 한글 이름
const INGREDIENT: Record<Element, string> = {
  木: '🥬',
  火: '🌶️',
  土: '🍖',
  金: '🧂',
  水: '🐟',
};
const ELEMENT_KO: Record<Element, string> = {
  木: '나무',
  火: '불',
  土: '흙',
  金: '쇠',
  水: '물',
};

// 십이지시 — value = 각 시지의 대표 시각(0~23). 사주는 2시간 단위 시지로 묶임.
const SIJI = [
  { value: '', label: '태어난 시간을 몰라요' },
  { value: '0', label: '자시 · 23:30~01:30' },
  { value: '2', label: '축시 · 01:30~03:30' },
  { value: '4', label: '인시 · 03:30~05:30' },
  { value: '6', label: '묘시 · 05:30~07:30' },
  { value: '8', label: '진시 · 07:30~09:30' },
  { value: '10', label: '사시 · 09:30~11:30' },
  { value: '12', label: '오시 · 11:30~13:30' },
  { value: '14', label: '미시 · 13:30~15:30' },
  { value: '16', label: '신시 · 15:30~17:30' },
  { value: '18', label: '유시 · 17:30~19:30' },
  { value: '20', label: '술시 · 19:30~21:30' },
  { value: '22', label: '해시 · 21:30~23:30' },
];

export default function SajuApp() {
  const [view, setView] = useState<SajuView | null>(null);
  const [restaurant, setRestaurant] = useState<SajuRestaurant | null>(null);
  const [seed, setSeed] = useState(0);
  const [pending, start] = useTransition();

  function onResult(v: SajuView, s: number) {
    setView(v);
    setSeed(s);
    setRestaurant(null);
    start(async () => {
      const r = await recommendRestaurant(v.cuisineHints, s);
      setRestaurant(r);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-fg">🔮 운명의 점심</h1>
        <p className="mt-1 text-xs text-fg-muted">사주로 보는 당신의 점심 메뉴</p>
      </header>

      {!view ? (
        <BirthForm onResult={onResult} />
      ) : (
        <>
          <ResultCard view={view} restaurant={restaurant} loading={pending} />
          <button
            type="button"
            onClick={() => setView(null)}
            className="mx-auto text-xs text-fg-muted underline-offset-2 hover:underline"
          >
            ← 다시 보기
          </button>
        </>
      )}
    </div>
  );
}

function BirthForm({ onResult }: { onResult: (v: SajuView, seed: number) => void }) {
  const [digits, setDigits] = useState('');
  const [hour, setHour] = useState('');
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>('solar');
  const [leap, setLeap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (digits.length !== 8) return setError('생년월일 8자리를 입력해주세요 (예: 19940321)');
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    const day = Number(digits.slice(6, 8));
    if (month < 1 || month > 12 || day < 1 || day > 31) return setError('날짜를 다시 확인해주세요');
    const input: SajuInput = {
      year,
      month,
      day,
      hour: hour === '' ? undefined : Number(hour),
      calendar,
      isLeapMonth: calendar === 'lunar' && leap,
    };
    try {
      const r = computeSaju(input);
      onResult(buildSajuView(r), r.seed);
    } catch {
      setError('계산에 실패했어요. 입력값을 확인해주세요');
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex gap-2">
        {(['solar', 'lunar'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCalendar(c)}
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              calendar === c ? 'border-fg bg-fg text-bg' : 'border-border text-fg-muted hover:border-fg/40'
            }`}
          >
            {c === 'solar' ? '양력' : '음력'}
          </button>
        ))}
      </div>
      {calendar === 'lunar' && (
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" checked={leap} onChange={(e) => setLeap(e.target.checked)} className="size-4" />
          윤달에 태어났어요
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fg">생년월일</span>
        <input
          type="text"
          inputMode="numeric"
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="19940321"
          className="rounded-xl border border-border bg-bg px-4 py-3 text-base text-fg outline-none focus:border-fg"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fg">
          태어난 시간 <span className="font-normal text-fg-muted">(선택)</span>
        </span>
        <select
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-base text-fg outline-none focus:border-fg"
        >
          {SIJI.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="rounded-xl bg-fg px-6 py-3.5 text-base font-bold text-bg transition hover:opacity-90"
      >
        내 운명의 점심 보기
      </button>
      <p className="text-center text-[11px] leading-relaxed text-fg-muted">
        입력한 생년월일은 이 브라우저에서만 계산에 써요. 서버로 보내거나 저장하지 않아요.
      </p>
    </form>
  );
}

function ResultCard({
  view,
  restaurant,
  loading,
}: {
  view: SajuView;
  restaurant: SajuRestaurant | null;
  loading: boolean;
}) {
  const el = ELEMENT_META[view.element];
  return (
    <div className="flex flex-col gap-5">
      {/* 운명의 메뉴 */}
      <div
        className="rounded-2xl border border-border p-6 text-center"
        style={{ background: `${el.color}14` }}
      >
        <p className="text-4xl">{view.elementEmoji}</p>
        <p className="mt-3 text-sm text-fg-muted">당신의 운명의 메뉴</p>
        <p className="mt-1 text-3xl font-extrabold text-fg">{view.menu}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <Chip>{view.elementLabel}</Chip>
          <Chip>{view.strengthLabel}</Chip>
          <Chip>{view.seasonLabel} 기운</Chip>
        </div>
      </div>

      {/* 성향 해석 */}
      <Section title="🧬 성향 해석">
        <div className="rounded-xl bg-fg/[0.03] p-3.5">
          <p className="text-[11px] text-fg-muted">
            타고난 바탕 · 일간 {view.dayGanKo}({view.dayGan})
          </p>
          <p className="mt-1 text-base font-bold text-fg">{view.stemPoetic}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{view.strengthLine}</p>
        </div>

        <p className="mt-4 mb-1.5 text-[11px] font-medium text-fg-muted">이런 식성이에요</p>
        <ul className="flex flex-col gap-1.5">
          {view.eaterBody.map((line, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-fg">
              {line}
            </li>
          ))}
        </ul>

        <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-[13px]">
          <Row k="강점" v={view.eaterStrength} />
          <Row k="주의" v={view.eaterCaution} />
          <Row k="식사메이트" v={view.eaterMate} />
        </dl>
      </Section>

      {/* 왜 이 메뉴일까 */}
      <Section title={`왜 ${view.menu}일까`}>
        <ul className="flex flex-col gap-2">
          {view.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-fg">
              <span aria-hidden style={{ color: el.color }}>
                ●
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 오행 분포 = 사주 냄비 (재료가 얼마나 들어갔나) */}
      <Section title="🍲 내 사주 한 냄비">
        <p className="mb-3 text-[11px] text-fg-muted">어떤 재료가 얼마나 들어갔을까?</p>

        {/* 냄비에 담긴 비율 — 한 줄 스택 게이지 */}
        <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-fg/10">
          {view.distribution
            .filter((d) => d.count > 0)
            .map((d) => (
              <div
                key={d.element}
                style={{ width: `${d.percent}%`, background: ELEMENT_META[d.element].color }}
                title={`${ELEMENT_KO[d.element]} ${d.count}개`}
              />
            ))}
        </div>

        {/* 재료별 — 이모지 개수로 */}
        <ul className="flex flex-col gap-2">
          {view.distribution.map((d) => (
            <li key={d.element} className="flex items-center gap-2 text-[13px]">
              <span className="w-20 shrink-0 text-fg-muted">
                {INGREDIENT[d.element]} {ELEMENT_KO[d.element]}·{d.trait}
              </span>
              <span className="min-w-0 flex-1 truncate leading-none">
                {d.count > 0 ? (
                  INGREDIENT[d.element].repeat(d.count)
                ) : (
                  <span className="text-fg-muted/50">안 들어감</span>
                )}
              </span>
              <span className="w-12 shrink-0 text-right text-fg-muted">{d.count}개</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1 text-[11px] font-medium text-fg-muted">가장 진한 맛 (두드러지는 성향)</p>
          <p className="text-[13px] text-fg">
            {view.dominantTraits.map((t) => t.label).join(' · ')}
          </p>
        </div>
      </Section>

      {/* 궁합 메뉴 (상생상극) */}
      <Section title="🍽 궁합 메뉴">
        <p className="mb-2 text-[11px] text-fg-muted">{view.lackLine}</p>
        <div className="flex flex-col gap-2 text-[13px]">
          <p>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">나를 살리는</span>{' '}
            {ELEMENT_META[view.boostElement].emoji} {view.boostMenu}
          </p>
          <p>
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">나를 식히는</span>{' '}
            {ELEMENT_META[view.coolElement].emoji} {view.coolMenu}
          </p>
        </div>
      </Section>

      {/* 우리 식당 */}
      <Section title="👉 오늘 여기 어때요">
        {loading ? (
          <p className="text-xs text-fg-muted">맞는 식당 찾는 중…</p>
        ) : restaurant ? (
          <a href={`/map?focus=${restaurant.id}`} className="block">
            <p className="text-base font-bold text-fg">{restaurant.name}</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              {restaurant.region ? `${restaurant.region} · ` : ''}
              {restaurant.cuisine_types.join(' / ')} · commit {restaurant.commit_count}
            </p>
          </a>
        ) : (
          <p className="text-xs text-fg-muted">아직 이 장르 등록 식당이 없어요. 첫 커밋 남겨보세요!</p>
        )}
      </Section>

      {/* 사주 여덟 글자 */}
      <Section title="🀄 내 사주 여덟 글자">
        <div className="grid grid-cols-4 gap-1.5">
          {view.pillars.map((p) => (
            <div key={p.label} className="text-center">
              <p className="text-[10px] text-fg-muted">{p.label}</p>
              <div className="mt-1 rounded-lg bg-fg/[0.03] py-2">
                <p className="text-xl font-bold text-fg">{p.gan}</p>
                <p className="text-[10px] text-fg-muted">
                  {p.ganKo} · {ELEMENT_META[p.ganElement].emoji}
                </p>
                <p className="mt-1.5 text-xl font-bold text-fg">{p.zhi}</p>
                <p className="text-[10px] text-fg-muted">
                  {p.zhiKo} · {ELEMENT_META[p.zhiElement].emoji}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">
          위 글자는 하늘의 기운(천간), 아래는 땅의 기운(지지)이에요. 세 번째 칸(일) 위가 사주의
          기준이 되는 일간이고, 운명의 메뉴도 여기서 출발해요.
        </p>
      </Section>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-fg-muted">
      {children}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 font-semibold text-fg-muted">{k}</dt>
      <dd className="flex-1 text-fg">{v}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-xs font-bold text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}
