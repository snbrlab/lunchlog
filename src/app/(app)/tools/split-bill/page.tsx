'use client';

// 카드사 이벤트(2만원당 N원 할인 등) 분할결제 계산기. 로그인/식당 데이터와 무관한 독립 유틸.
// 두 모드:
//   1) 메뉴별로 나누기 — 메뉴마다 "누가 먹었는지"(비용 분담) 와 "누구 카드로 결제했는지"
//      (할인 발생 단위) 를 따로 입력받는다. 2만원당 7천원은 "카드 1건당" 조건이라,
//      같은 카드로 묶어 결제한 사람들끼리 그 카드 할인을 소비 비율대로 나눠 갖고,
//      최종적으로 각자 "낸 돈(결제자면)" vs "먹은 만큼 내야 할 돈"을 비교해서
//      누가 누구한테 얼마 보내야 하는지(+면 받을 돈, -면 보낼 돈) 계산한다.
//      예: 나 1만원 + 친구 15000원을 친구 카드로 같이 결제 → 25000원 카드에서
//      7천원 할인, 나는 내 몫(1만원의 discount-adjusted 분)만큼만 친구에게 보내면 됨.
//   2) 그냥 N빵 — 총액을 인원수로 균등 분배

import { useMemo, useState } from 'react';

type Mode = 'even' | 'itemized';
type DiscountMode = 'repeat' | 'once';

interface Item {
  id: string;
  name: string;
  price: string; // input 그대로 들고있다가 계산 시 parse
  eatenBy: Set<string>; // 비용을 나눠 낼 사람들 (먹은 사람)
  paidBy: string; // 이 메뉴가 실제로 청구된 카드 주인. '' 면 미지정
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

  // N빵 모드 — 인원수(최종 나눠내는 기준)와 결제카드 수(할인 발생 단위)를 분리.
  // 예: 4명인데 카드는 3개만 써서 나눠 결제했으면, 할인은 카드 3개 기준으로 계산되고
  // 최종 금액은 4명이 나눠냄.
  const [evenTotal, setEvenTotal] = useState('');
  const [evenPeople, setEvenPeople] = useState('3');
  const [evenCards, setEvenCards] = useState('3');

  // 메뉴별 모드
  const [people, setPeople] = useState<string[]>(['나', '동료1', '동료2']);
  const [newPersonName, setNewPersonName] = useState('');
  const [items, setItems] = useState<Item[]>([
    { id: newId(), name: '', price: '', eatenBy: new Set(), paidBy: '' },
  ]);

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
  const evenCardsNum = Math.max(1, Number(evenCards) || 1);
  // 카드 수만큼 총액을 균등 분할했다고 가정하고, 카드마다 할인을 독립적으로 체크 후 합산.
  const evenPerCard = evenTotalNum / evenCardsNum;
  const evenDiscountPerCard = calcDiscount(evenPerCard);
  const evenDiscount = evenDiscountPerCard * evenCardsNum;
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
      const next = new Set(it.eatenBy);
      next.delete(name);
      return {
        ...it,
        eatenBy: next,
        paidBy: it.paidBy === name ? '' : it.paidBy,
      };
    }));
  }

  function addItem() {
    setItems([...items, { id: newId(), name: '', price: '', eatenBy: new Set(), paidBy: '' }]);
  }
  function removeItem(id: string) {
    setItems(items.filter((it) => it.id !== id));
  }
  function updateItem(id: string, patch: Partial<Pick<Item, 'name' | 'price'>>) {
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function toggleItemEater(id: string, person: string) {
    setItems(
      items.map((it) => {
        if (it.id !== id) return it;
        const next = new Set(it.eatenBy);
        if (next.has(person)) next.delete(person);
        else next.add(person);
        return { ...it, eatenBy: next };
      }),
    );
  }
  function setItemPayer(id: string, person: string) {
    setItems(
      items.map((it) =>
        it.id === id ? { ...it, paidBy: it.paidBy === person ? '' : person } : it,
      ),
    );
  }

  const itemized = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

    const rawByEater = new Map<string, number>();
    for (const p of people) rawByEater.set(p, 0);
    let unassignedEater = 0;
    let unassignedPayer = 0;
    for (const it of items) {
      const price = Number(it.price) || 0;
      if (price <= 0) continue;
      if (it.eatenBy.size === 0) unassignedEater += price;
      if (!it.paidBy) unassignedPayer += price;
    }

    // 결제자(카드)별로 항목을 묶어서, 그 카드의 총액 기준 할인을 계산.
    const groupRawByPayer = new Map<string, number>();
    for (const it of items) {
      const price = Number(it.price) || 0;
      if (price <= 0 || !it.paidBy) continue;
      groupRawByPayer.set(it.paidBy, (groupRawByPayer.get(it.paidBy) ?? 0) + price);
    }
    const groupDiscountByPayer = new Map<string, number>();
    for (const [payer, raw] of groupRawByPayer) {
      groupDiscountByPayer.set(payer, calcDiscount(raw));
    }

    // 각자 "먹은 만큼" 내야 할 돈(owed) — 자기가 낀 카드 그룹의 할인을 소비 비율대로 반영.
    const owedByPerson = new Map<string, number>();
    for (const p of people) owedByPerson.set(p, 0);
    for (const it of items) {
      const price = Number(it.price) || 0;
      if (price <= 0 || it.eatenBy.size === 0) continue;
      const eaterShareRaw = price / it.eatenBy.size;
      const groupRaw = it.paidBy ? (groupRawByPayer.get(it.paidBy) ?? 0) : 0;
      const groupDiscount = it.paidBy ? (groupDiscountByPayer.get(it.paidBy) ?? 0) : 0;
      const discountRate = groupRaw > 0 ? groupDiscount / groupRaw : 0;
      const eaterOwed = eaterShareRaw - eaterShareRaw * discountRate;
      for (const p of it.eatenBy) {
        owedByPerson.set(p, (owedByPerson.get(p) ?? 0) + eaterOwed);
      }
    }

    // 결제자가 실제로 카드에서 청구받은(낸) 돈.
    const paidByPerson = new Map<string, number>();
    for (const [payer, raw] of groupRawByPayer) {
      paidByPerson.set(payer, raw - (groupDiscountByPayer.get(payer) ?? 0));
    }

    const totalDiscount = Array.from(groupDiscountByPayer.values()).reduce((a, b) => a + b, 0);

    const rows = people.map((p) => {
      const owed = owedByPerson.get(p) ?? 0;
      const paid = paidByPerson.get(p) ?? 0;
      return { person: p, owed, paid, balance: paid - owed };
    });

    return { subtotal, discount: totalDiscount, rows, unassignedEater, unassignedPayer };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, people, unit, discountPerUnit, discountMode, overrideDiscount, manualDiscount]);

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
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-fg-muted">인원수 (나눠낼 사람)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={evenPeople}
                  onChange={(e) => setEvenPeople(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-fg-muted">결제 카드 수</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={evenCards}
                  onChange={(e) => setEvenCards(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-fg"
                />
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-fg-muted">
              인원수랑 카드 수가 달라도 돼요 — 예: 4명인데 카드는 3개만 나눠 긁었으면 할인은
              카드 3개 기준으로, 최종 금액은 4명이 나눠내요.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 text-sm">
            <Row label="원가" value={formatWon(evenTotalNum)} />
            <Row
              label={`할인액 (카드 ${evenCardsNum}개 × ${formatWon(evenDiscountPerCard)})`}
              value={`- ${formatWon(evenDiscount)}`}
              muted
            />
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
          <p className="rounded-lg border border-dashed border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-fg-muted">
            메뉴마다 <span className="font-medium text-fg">먹은 사람</span>(비용 분담)이랑{' '}
            <span className="font-medium text-fg">결제한 카드</span>(할인 발생 단위)를 따로
            체크해주세요. 같은 카드로 묶어 낸 사람들끼리는 그 카드 할인을 먹은 만큼 나눠
            가져요.
          </p>

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
            <h2 className="mb-1 text-sm font-medium text-fg">메뉴</h2>
            <p className="mb-2 text-[10px] text-fg-muted">
              한 메뉴를 여럿이 나눠 먹었으면 &quot;먹은 사람&quot;에 여러 명 체크. 각자 같은 메뉴를
              따로 시켰으면 메뉴를 사람 수만큼 각각 추가해주세요 (1인분씩, 먹은 사람 1명씩).
            </p>
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-fg-muted">먹은 사람</span>
                    {people.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleItemEater(it.id, p)}
                        className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                          it.eatenBy.has(p)
                            ? 'bg-fg text-bg'
                            : 'bg-bg text-fg-muted hover:bg-fg/5'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-fg-muted">결제 카드</span>
                    {people.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setItemPayer(it.id, p)}
                        className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                          it.paidBy === p
                            ? 'bg-sky-600 text-white'
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
            <Row label="총 할인액" value={`- ${formatWon(itemized.discount)}`} muted />
            {itemized.unassignedEater > 0.5 && (
              <p className="mt-1 text-[11px] text-amber-700">
                ⚠️ 먹은 사람이 지정 안 된 금액 {formatWon(itemized.unassignedEater)}이 있어요.
              </p>
            )}
            {itemized.unassignedPayer > 0.5 && (
              <p className="mt-1 text-[11px] text-amber-700">
                ⚠️ 결제 카드가 지정 안 된 금액 {formatWon(itemized.unassignedPayer)}이 있어요 —
                이 항목은 할인 계산에서 빠져요.
              </p>
            )}
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {itemized.rows.map((r) => (
                <div key={r.person} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{r.person}</span>
                  <span className="text-right">
                    <span
                      className={`font-semibold ${
                        r.balance > 0.5
                          ? 'text-emerald-700'
                          : r.balance < -0.5
                            ? 'text-rose-600'
                            : 'text-fg'
                      }`}
                    >
                      {r.balance > 0.5
                        ? `+${formatWon(r.balance)} 받아야 함`
                        : r.balance < -0.5
                          ? `-${formatWon(-r.balance)} 보내야 함`
                          : '정산 완료'}
                    </span>
                    <span className="ml-1.5 text-[11px] text-fg-muted">
                      (먹은 값 {formatWon(r.owed)}
                      {r.paid > 0.5 ? ` · 결제함 ${formatWon(r.paid)}` : ''})
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
