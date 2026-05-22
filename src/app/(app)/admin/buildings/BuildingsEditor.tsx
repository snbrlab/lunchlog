'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  autoFillAllBuildingCoords,
  createBuilding,
  createOffice,
  deleteBuilding,
  updateBuildingCoord,
  type AutoFillResult,
} from '@/lib/admin/actions';
import { KakaoPlacesSearch } from '@/components/map/KakaoPlacesSearch';
import type { Office, OfficeBuilding } from '@/types/db';
import type { KakaoPlaceItem } from '@/types/kakao-maps';

function kakaoMapLink(name: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
}

// 카카오 검색의 origin (거리 정렬용 기본값) — 서울 시청
const SEARCH_ORIGIN = { lat: 37.5666, lng: 126.9784 };

interface Props {
  offices: Office[];
  buildings: OfficeBuilding[];
}

export default function BuildingsEditor({ offices, buildings }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoFillResult, setAutoFillResult] = useState<AutoFillResult | null>(null);

  function runAutoFill() {
    if (
      !confirm(
        '카카오 검색으로 모든 건물 좌표를 자동 보정합니다. 기존 좌표는 덮어씌워져요. 진행할까요?',
      )
    )
      return;
    setAutoFillResult(null);
    startTransition(async () => {
      const r = await autoFillAllBuildingCoords();
      setAutoFillResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* 메인: 건물 목록 (office 별) */}
      <ManualEditByOffice offices={offices} buildings={buildings} />

      {/* 자주 안 쓰는 작업 — 접어둠 */}
      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-fg marker:hidden">
          ➕ 새 사무실 추가
        </summary>
        <div className="border-t border-border px-4 py-4">
          <NewOfficeForm />
        </div>
      </details>

      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-fg marker:hidden">
          ➕ 새 건물 추가
        </summary>
        <div className="border-t border-border px-4 py-4">
          <NewBuildingForm offices={offices} />
        </div>
      </details>

      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-fg marker:hidden">
          🪄 전체 자동 좌표 보정
        </summary>
        <div className="space-y-3 border-t border-border px-4 py-4">
          <p className="text-xs text-fg-muted">
            각 건물 이름으로 <span className="font-mono">{`"LG사이언스파크 {이름}"`}</span> 키워드
            검색 → 첫 결과 좌표 사용. KAKAO_REST_KEY 필요. 기존 좌표 덮어쓰임.
          </p>
          <button
            type="button"
            onClick={runAutoFill}
            disabled={pending}
            className="rounded-md bg-fg px-4 py-2 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? '보정 중…' : '실행'}
          </button>
          {autoFillResult && !autoFillResult.ok && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {autoFillResult.message}
            </p>
          )}
          {autoFillResult?.ok && (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              {autoFillResult.results.map((r) => (
                <li key={r.name} className="font-mono">
                  {r.status === 'updated' ? '✓' : r.status === 'not_found' ? '✗' : '⚠️'} {r.name}
                  {r.status === 'not_found' && ' (없음)'}
                  {r.status === 'failed' && ' (실패)'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}

function ManualEditByOffice({
  offices,
  buildings,
}: {
  offices: Office[];
  buildings: OfficeBuilding[];
}) {
  // 지역 필터 (admin/restaurants 와 같은 패턴)
  const [region, setRegion] = useState<string>('all');

  const countByOffice = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of buildings) m.set(b.office_id, (m.get(b.office_id) ?? 0) + 1);
    return m;
  }, [buildings]);

  const officeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of offices) m.set(o.id, o.name);
    return m;
  }, [offices]);

  const filtered = useMemo(() => {
    if (region === 'all') return buildings;
    return buildings.filter((b) => b.office_id === region);
  }, [buildings, region]);

  if (buildings.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-xs text-fg-muted">
        등록된 건물 없음
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 지역 필터 chip */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-3 text-[11px]">
        <span className="mr-1 text-fg-muted">지역:</span>
        <button
          type="button"
          onClick={() => setRegion('all')}
          className={`rounded-full px-2 py-0.5 transition ${
            region === 'all'
              ? 'bg-fg text-bg'
              : 'bg-bg text-fg-muted hover:bg-fg/5'
          }`}
        >
          전체 ({buildings.length})
        </button>
        {offices.map((o) => {
          const cnt = countByOffice.get(o.id) ?? 0;
          if (cnt === 0) return null;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setRegion(o.id)}
              className={`rounded-full px-2 py-0.5 transition ${
                region === o.id
                  ? 'bg-fg text-bg'
                  : 'bg-bg text-fg-muted hover:bg-fg/5'
              }`}
            >
              {o.name} ({cnt})
            </button>
          );
        })}
        <span className="ml-auto text-fg-muted/60">{filtered.length}개 표시</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">지역</th>
              <th className="px-3 py-2 text-left">위도 (lat)</th>
              <th className="px-3 py-2 text-left">경도 (lng)</th>
              <th className="px-3 py-2 text-left">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-fg-muted">
                  조건에 맞는 건물 없음
                </td>
              </tr>
            )}
            {filtered.map((b) => (
              <BuildingRow
                key={b.id}
                building={b}
                officeName={officeNameById.get(b.office_id) ?? '—'}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BuildingRow({
  building,
  officeName,
}: {
  building: OfficeBuilding;
  officeName: string;
}) {
  const router = useRouter();
  const [lat, setLat] = useState(String(building.latitude));
  const [lng, setLng] = useState(String(building.longitude));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const dirty =
    lat !== String(building.latitude) || lng !== String(building.longitude);

  function save() {
    setStatus('idle');
    setErrMsg(null);
    const latNum = Number(lat);
    const lngNum = Number(lng);
    startTransition(async () => {
      const r = await updateBuildingCoord(building.id, latNum, lngNum);
      if (r.ok) setStatus('ok');
      else {
        setStatus('err');
        setErrMsg(r.message);
      }
    });
  }

  function onDelete() {
    if (
      !confirm(
        `"${building.name}" 건물을 삭제할까요?\n\n` +
          '· 이 건물을 근무지로 설정한 사용자는 건물 정보만 비워집니다 (계정 유지)\n' +
          '· 식당 office 매핑이 자동으로 재계산됩니다',
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteBuilding(building.id);
      if (!r.ok) {
        setStatus('err');
        setErrMsg(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium text-fg">
        <a
          href={kakaoMapLink(building.name, building.latitude, building.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
          title="카카오맵에서 위치 보기"
        >
          {building.name}
          <span aria-hidden className="text-[10px] text-fg-muted">↗</span>
        </a>
      </td>
      <td className="px-3 py-2 text-xs text-fg-muted">{officeName}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="w-32 rounded border border-border bg-bg px-2 py-1 font-mono text-xs outline-none focus:border-fg"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="w-32 rounded border border-border bg-bg px-2 py-1 font-mono text-xs outline-none focus:border-fg"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="rounded bg-fg px-2 py-1 text-[11px] font-semibold text-bg transition hover:opacity-90 disabled:opacity-30"
          >
            {pending ? '…' : '저장'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600 transition hover:border-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            삭제
          </button>
          {status === 'ok' && <span className="text-[11px] text-emerald-600">✓</span>}
          {status === 'err' && <span className="text-[11px] text-red-500">{errMsg}</span>}
        </div>
      </td>
    </tr>
  );
}

function NewOfficeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createOffice(name);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setName('');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <span className="text-sm font-medium text-fg">+ 새 사무실 추가</span>
        <span className="text-xs text-fg-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-5 py-4">
          <p className="text-[11px] text-fg-muted">
            사무실 이름만 입력. 실제 좌표는 아래 "건물 추가" 에서 검색으로 채움.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="사무실 이름 (예: 서울역)"
            disabled={pending}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={pending || !name.trim()}
            className="rounded bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '사무실 추가'}
          </button>
        </div>
      )}
    </section>
  );
}

function NewBuildingForm({ offices }: { offices: Office[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [officeId, setOfficeId] = useState('');
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setLat('');
    setLng('');
    setError(null);
  }

  function submit() {
    setError(null);
    const latNum = Number(lat);
    const lngNum = Number(lng);
    startTransition(async () => {
      const r = await createBuilding(officeId, name, latNum, lngNum);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <span className="text-sm font-medium text-fg">+ 새 건물 추가</span>
        <span className="text-xs text-fg-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          <p className="text-[11px] text-fg-muted">
            카카오 검색으로 건물 좌표 자동 채우기 (예: "LG트윈타워", "LG디지털파크"). 검색 결과 클릭 시 이름·좌표 prefill — 이름은 수정 가능.
          </p>
          <select
            value={officeId}
            onChange={(e) => setOfficeId(e.target.value)}
            disabled={pending}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
          >
            <option value="">사무실 선택</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <KakaoPlacesSearch
            origin={SEARCH_ORIGIN}
            onSelect={(item: KakaoPlaceItem) => {
              setName(item.place_name);
              setLat(item.y);
              setLng(item.x);
              setError(null);
            }}
          />
          <div className="border-t border-border pt-3">
            <span className="mb-1.5 block text-[11px] font-medium text-fg-muted">
              직접 입력 (또는 검색 결과 수정)
            </span>
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="건물 이름 (예: LG트윈타워)"
                disabled={pending}
                className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="lat (위도)"
                  disabled={pending}
                  className="flex-1 rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-fg"
                />
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="lng (경도)"
                  disabled={pending}
                  className="flex-1 rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-fg"
                />
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={pending || !officeId || !name.trim() || !lat || !lng}
            className="rounded bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '건물 추가'}
          </button>
        </div>
      )}
    </section>
  );
}
