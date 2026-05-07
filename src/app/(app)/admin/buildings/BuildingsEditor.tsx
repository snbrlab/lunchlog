'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  autoFillAllBuildingCoords,
  createBuilding,
  createOffice,
  updateBuildingCoord,
  type AutoFillResult,
} from '@/lib/admin/actions';
import type { Office, OfficeBuilding } from '@/types/db';

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
    <div className="space-y-6">
      {/* 새 사무실 추가 */}
      <NewOfficeForm />

      {/* 새 건물 추가 */}
      <NewBuildingForm offices={offices} />

      <section className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div>
          <h2 className="text-sm font-medium text-fg">전체 자동 보정</h2>
          <p className="mt-1 text-xs text-fg-muted">
            각 건물 이름으로 <span className="font-mono">{`"LG사이언스파크 {이름}"`}</span> 키워드
            검색 → 첫 결과 좌표 사용. KAKAO_REST_KEY 필요.
          </p>
        </div>
        <button
          type="button"
          onClick={runAutoFill}
          disabled={pending}
          className="shrink-0 rounded-md bg-fg px-4 py-2 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '보정 중…' : '🪄 자동 보정'}
        </button>
      </section>

      {autoFillResult && !autoFillResult.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {autoFillResult.message}
        </p>
      )}
      {autoFillResult?.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <p className="font-medium">자동 보정 결과</p>
          <ul className="mt-1.5 space-y-0.5">
            {autoFillResult.results.map((r) => (
              <li key={r.name} className="font-mono text-[11px]">
                {r.status === 'updated' ? '✓' : r.status === 'not_found' ? '✗' : '⚠️'} {r.name}{' '}
                {r.lat && r.lng ? `→ ${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}` : ''}
                {r.status === 'not_found' && ' (검색 결과 없음)'}
                {r.status === 'failed' && ' (실패)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-fg">수동 편집</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">위도 (lat)</th>
                <th className="px-3 py-2 text-left">경도 (lng)</th>
                <th className="px-3 py-2 text-left">저장</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <BuildingRow key={b.id} building={b} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BuildingRow({ building }: { building: OfficeBuilding }) {
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

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium text-fg">{building.name}</td>
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
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded bg-fg px-2 py-1 text-[11px] font-semibold text-bg transition hover:opacity-90 disabled:opacity-30"
        >
          {pending ? '…' : '저장'}
        </button>
        {status === 'ok' && <span className="ml-2 text-[11px] text-emerald-600">✓</span>}
        {status === 'err' && <span className="ml-2 text-[11px] text-red-500">{errMsg}</span>}
      </td>
    </tr>
  );
}

function NewOfficeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      const r = await createOffice(name, latNum, lngNum);
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
        <span className="text-sm font-medium text-fg">+ 새 사무실 추가</span>
        <span className="text-xs text-fg-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-5 py-4">
          <p className="text-[11px] text-fg-muted">
            사무실 이름과 default 좌표 (사무실 중심) 입력. 좌표는 카카오맵에서 검색해서 옮겨도 되고, 대략값 박고 자동 보정으로 정정해도 됨.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="사무실 이름 (예: 서울역)"
            disabled={pending}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="lat (위도) — 예: 37.55"
              disabled={pending}
              className="flex-1 rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-fg"
            />
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="lng (경도) — 예: 126.97"
              disabled={pending}
              className="flex-1 rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-fg"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={pending || !name.trim() || !lat || !lng}
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
        <div className="space-y-2 border-t border-border px-5 py-4">
          <p className="text-[11px] text-fg-muted">
            기존 사무실에 건물 추가. 좌표 대략값 박고 자동 보정으로 정정 가능.
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="건물 이름 (예: LG트윈타워, W1, ISC 등)"
            disabled={pending}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="lat — 예: 37.55"
              disabled={pending}
              className="flex-1 rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-fg"
            />
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="lng — 예: 126.97"
              disabled={pending}
              className="flex-1 rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-fg"
            />
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
