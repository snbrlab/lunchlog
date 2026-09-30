'use client';

// 카드사 이벤트(2만원당 N원 할인 등) 분할결제 계산기. 로그인/식당 데이터와 무관한 독립 유틸.
// 두 모드:
//   1) 메뉴별로 나누기 — 누가 뭘 시켰는지 입력해서 각자 원가를 구하고, 정산방식에 따라
//      ① 한 카드로 전체 결제: 총액 기준 할인을 원가 비율대로 안분
//      ② 각자 카드로 결제: 2만원당 7천원은 "카드 1건당" 조건이라, 각자 원가 기준으로
//         개별 할인 적용 (합쳐서 비율로 나누는 것과 결과가 다름 — 카드를 나눠 긁을수록
//         할인 횟수가 줄 수 있음)
//   2) 그냥 N빵 — 총액을 인원수로 균등 분배

import { useMemo, useState } from 'react';

type Mode = 'even' | 'itemized';
type DiscountMode = 'repeat' | 'once';
type SettleMode = 'pooled' | 'perPerson';

interface Item {
  id: string;
  name: string;
  price: string; // input 그대로 들고있다가 계산 시 parse
  people: Set<string>;
}

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString()}원`;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function SplitBillPage() {
  const [mode, setMode] = useState<Mode>('itemized');

  // 할인 설정 (공용)
  const [unit, setUnit] = useState('20000');
  const [discountPerUnit, setDiscountPerUnit] = useState('7000');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('repeat');
  const [overrideDiscount, setOverrideDiscount] = useState(false);
  const [manualDiscount, setManualDiscount] = useState('');

  // N빵 모드
  const [evenTotal, setEvenTotal] = useState('');
  const [evenPeople, setEvenPeople] = useState('3');

  // 메뉴별 모드
  const [people, setPeople] = useState<string[]>(['나', '동료1', '동료2']);
  const [newPersonName, setNewPersonName] = useState('');
  const [items, setItems] = useState<Item[]>([
    { id: newId(), name: '', price: '', people: new Set() },
  ]);
  // 정산방식: 한 카드로 전체 결제(풀 할인 비율 분배) vs 각자 카드로 결제(개별 할인)
  const [settleMode, setSettleMode] = useState<SettleMode>('perPerson');

  function calcDiscount(subtotal: number): number {
    const u = Number(unit) || 0;
    const d = Number(discountPerUnit) || 0;
    if (overrideDiscount) return Number(manualDiscount) || 0;
    if (u <= 0 || subtotal < u) return 0;
    if (discountMode === 'once') return d;
    return Math.floor(subtotal / u) * d;
  }

  // ---------- N빵 모드 계산 ----------
  const evenTotalNum = Number(evenTotal) || 0;
  const evenPeopleNum = Math.max(1, Number(evenPeople) || 1);
  const evenDiscount = calcDiscount(evenTotalNum);
  const evenFinal = Math.max(0, evenTotalNum - evenDiscount);
  const evenPerPerson = evenFinal / evenPeopleNum;

  // ---------- 메뉴별 모드 계산 ----------
  function addPerson() {
    const n = newPersonName.trim();
    if (!n || people.includes(n)) return;
    setPeople([...people, n]);
    setNewPersonName('');
  }
  function removePerson(name: string) {
    setPeople(people.filter((p) => p !== name));
    setItems(items.map((it) => {
      if (!it.people.has(name)) return it;
      const next = new Set(it.people);
      next.delete(name);
      return { ...it, people: next };
    }));
  }

  function addItem() {
    setItems([...items, { id: newId(), name: '', price: '', people: new Set() }]);
  }
  function removeItem(id: string) {
    setItems(items.filter((it) => it.id !== id));
  }
  function updateItem(id: string, patch: Partial<Pick<Item, 'name' | 'price'>>) {
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function toggleItemPerson(id: string, person: string) {
    setItems(
      items.map((it) => {
        if (it.id !== id) return it;
        const next = new Set(it.people);
        if (next.has(person)) next.delete(person);
        else next.add(person);
        return { ...it, people: next };
      }),
    );
  }

  const itemized = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

    const rawByPerson = new Map<string, number>();
    for (const p of people) rawByPerson.set(p, 0);
    for (const it of items) {
      const price = Number(it.price) || 0;
      if (price <= 0 || it.people.size === 0) continue;
      const share = price / it.people.size;
      for (const p of it.people) {
        rawByPerson.set(p, (rawByPerson.get(p) ?? 0) + share);
      }
    }

    const unassigned = subtotal - Array.from(rawByPerson.values()).reduce((a, b) => a + b, 0);

    let rows: { person: string; raw: number; discount: number; final: number }[];
    let discount: number;

    if (settleMode === 'perPerson') {
      // 각자 카드로 결제 — 사람마다 자기 원가 기준으로 독립적으로 할인 체크.
      rows = people.map((p) => {
        const raw = rawByPerson.get(p) ?? 0;
        const personDiscount = calcDiscount(raw);
        return { person: p, raw, discount: personDiscount, final: raw - personDiscount };
      });
      discount = rows.reduce((sum, r) => sum + r.discount, 0);
    } else {
      // 한 카드로 전체 결제 — 총액 기준 할인 한 번 계산해서 원가 비율대로 안분.
      discount = calcDiscount(subtotal);
      rows = people.map((p) => {
        const raw = rawByPerson.get(p) ?? 0;
        const ratio = subtotal > 0 ? raw / subtotal : 0;
        const personDiscount = discount * ratio;
        return { person: p, raw, discount: personDiscount, final: raw - personDiscount };
      });
    }

    return { subtotal, discount, rows, unassigned };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    items,
    people,
    unit,
    discountPerUnit,
    discountMode,
    overrideDiscount,
    manualDiscount,
    settleMode,
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-fg">🧮 분할결제 계산기</h1>
      <p className="mb-6 text-xs text-fg-muted">
        카드사 할인(예: 2만원당 7천원) 받고 여럿이 나눠낼 때, 누가 얼마 보내야 하는지 계산해요.
      </p>

      {/* 할인 설정 */}
      <section className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-fg">할인 설정</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-fg-muted">결제</span>
          <input
            type="text"
            inputMode="numeric"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-24 rounded-md border border-border bg-bg px-2 py-1.5 text-right outline-none focus:border-fg"
          />
          <span className="text-fg-muted">원당</span>
          <input
            type="text"
            inputMode="numeric"
            value={discountPerUnit}
            onChange={(e) => setDiscountPerUnit(e.target.value)}
            className="w-24 rounded-md border border-border bg-bg px-2 py-1.5 text-right outline-none focus:border-fg"
          />
          <span className="text-fg-muted">원 할인</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-fg-muted">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={discountMode === 'repeat'}
              onChange={() => setDiscountMode('repeat')}
            />
            구간마다 반복 적용 (예: 6만원 → 3번 할인)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={discountMode === 'once'}
              onChange={() => setDiscountMode('once')}
            />
            기준 넘으면 한 번만
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-fg-muted">
            <input
              type="checkbox"
              checked={overrideDiscount}
              onChange={(e) => setOverrideDiscount(e.target.checked)}
            />
            영수증 할인액이 달라요 — 직접 입력
          </label>
          {overrideDiscount && (
            <input
              type="text"
              inputMode="numeric"
              value={manualDiscount}
              onChange={(e) => setManualDiscount(e.target.value)}
              placeholder="실제 할인액"
              className="w-28 rounded-md border border-border bg-bg px-2 py-1.5 text-right outline-none focus:border-fg"
            />
          )}
        </div>
      </section>

      {/* 모드 탭 */}
      <div className="mb-4 flex gap-1.5 rounded-lg border border-border bg-surface p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('itemized')}
          className={`flex-1 rounded-md py-2 font-medium transition ${
            mode === 'itemized' ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-fg/5'
          }`}
        >
          메뉴별로 나누기
        </button>
        <button
          type="button"
          onClick={() => setMode('even')}
          className={`flex-1 rounded-md py-2 font-medium transition ${
            mode === 'even' ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-fg/5'
          }`}
        >
          그냥 N빵
        </button>
      </div>

      {mode === 'even' ? (
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <label className="mb-1 block text-xs text-fg-muted">총 결제금액 (할인 전)</label>
            <input
              type="text"
              inputMode="numeric"
              value={evenTotal}
              onChange={(e) => setEvenTotal(e.target.value)}
              placeholder="예: 60000"
              className="mb-3 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
            />
            <label className="mb-1 block text-xs text-fg-muted">인원수</label>
            <input
              type="text"
              inputMode="numeric"
              value={evenPeople}
              onChange={(e) => setEvenPeople(e.target.value)}
              className="w-24 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
            />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 text-sm">
            <Row label="원가" value={formatWon(evenTotalNum)} />
            <Row label="할인액" value={`- ${formatWon(evenDiscount)}`} muted />
            <Row label="할인후 총액" value={formatWon(evenFinal)} />
            <div className="mt-3 border-t border-border pt-3">
              <Row
                label={`1인당 (${evenPeopleNum}명)`}
                value={formatWon(evenPerPerson)}
                strong
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {/* 정산방식 */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-medium text-fg">정산 방식</h2>
            <div className="flex flex-col gap-2 text-xs text-fg-muted">
              <label className="flex items-start gap-1.5">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={settleMode === 'perPerson'}
                  onChange={() => setSettleMode('perPerson')}
                />
                <span>
                  <span className="font-medium text-fg">각자 카드로 결제</span> — 사람마다 자기
                  원가 기준으로 개별 할인 (카드를 나눠 긁으면 할인 횟수가 줄 수 있어요)
                </span>
              </label>
              <label className="flex items-start gap-1.5">
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={settleMode === 'pooled'}
                  onChange={() => setSettleMode('pooled')}
                />
                <span>
                  <span className="font-medium text-fg">한 카드로 전체 결제</span> — 총액 기준
                  할인을 원가 비율대로 나눠 가짐
                </span>
              </label>
            </div>
          </div>

          {/* 참여자 */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-medium text-fg">참여자</h2>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {people.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-1 text-xs"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removePerson(p)}
                    aria-label={`${p} 제거`}
                    className="text-fg-muted hover:text-rose-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPerson();
                  }
                }}
                placeholder="이름 추가"
                className="flex-1 rounded-md border border-border bg-bg px-3 py-1.5 text-xs outline-none focus:border-fg"
              />
              <button
                type="button"
                onClick={addPerson}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:border-fg/40 hover:text-fg"
              >
                추가
              </button>
            </div>
          </div>

          {/* 메뉴 항목 */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-medium text-fg">메뉴</h2>
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="rounded-md border border-border p-2.5">
                  <div className="mb-2 flex gap-2">
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      placeholder="메뉴 이름"
                      className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-fg"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={it.price}
                      onChange={(e) => updateItem(it.id, { price: e.target.value })}
                      placeholder="가격"
                      className="w-24 rounded-md border border-border bg-bg px-2.5 py-1.5 text-right text-xs outline-none focus:border-fg"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      aria-label="항목 삭제"
                      className="shrink-0 rounded-md px-2 text-fg-muted hover:bg-fg/5 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {people.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleItemPerson(it.id, p)}
                        className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                          it.people.has(p)
                            ? 'bg-fg text-bg'
                            : 'bg-bg text-fg-muted hover:bg-fg/5'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 w-full rounded-md border border-dashed border-border py-1.5 text-xs text-fg-muted hover:border-fg/40 hover:text-fg"
            >
              + 메뉴 추가
            </button>
          </div>

          {/* 결과 */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <Row label="원가 합계" value={formatWon(itemized.subtotal)} />
            <Row label="할인액" value={`- ${formatWon(itemized.discount)}`} muted />
            {itemized.unassigned > 0.5 && (
              <p className="mt-1 text-[11px] text-amber-700">
                ⚠️ 담당자가 지정 안 된 금액 {formatWon(itemized.unassigned)}이 있어요 — 메뉴마다
                먹은 사람을 체크해주세요.
              </p>
            )}
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              {itemized.rows.map((r) => (
                <div key={r.person} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{r.person}</span>
                  <span className="text-right">
                    <span className="font-semibold text-fg">{formatWon(r.final)}</span>
                    <span className="ml-1.5 text-[11px] text-fg-muted">
                      (원가 {formatWon(r.raw)} - 할인 {formatWon(r.discount)})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-fg-muted">{label}</span>
      <span
        className={
          strong ? 'text-base font-bold text-fg' : muted ? 'text-fg-muted' : 'text-fg'
        }
      >
        {value}
      </span>
    </div>
  );
}
