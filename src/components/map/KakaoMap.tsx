'use client';

import { useEffect, useRef, useState } from 'react';
import { loadKakaoMaps } from '@/lib/kakao-loader';
import { useMealMode } from '@/lib/meal-mode/MealModeProvider';
import type {
  KakaoCustomOverlay,
  KakaoMap as KakaoMapInst,
  KakaoMarker,
  KakaoPolyline,
} from '@/types/kakao-maps';
import type { RestaurantListItem } from '@/types/db';
import { haversineDistanceMeters, travelInfo } from '@/lib/distance';
import { emojiForCuisine } from '@/lib/cuisine';

export interface MapMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isClosed: boolean;
}

interface Props {
  origin: { lat: number; lng: number };
  restaurants: RestaurantListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  includeClosed: boolean;
}

// CSS 변수 (theme 토큰) 를 런타임에 읽어 카카오 오버레이 색에 주입.
function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function KakaoMap({
  origin,
  restaurants,
  selectedId,
  onSelect,
  onDeselect,
  includeClosed,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // map 인스턴스를 state 로 관리 — 비동기 init 완료 시 dependent effect 들이 자동 재실행.
  const [map, setMap] = useState<KakaoMapInst | null>(null);
  const originMarkerRef = useRef<KakaoMarker | KakaoCustomOverlay | null>(null);
  const pinRefs = useRef<Map<string, KakaoCustomOverlay>>(new Map());
  const polylineRef = useRef<KakaoPolyline | null>(null);
  const walkBadgeRef = useRef<KakaoCustomOverlay | null>(null);
  // D56: 같은 좌표 클러스터 — 어느 그룹의 popover 가 열려있는지
  const [openClusterKey, setOpenClusterKey] = useState<string | null>(null);

  const { mode } = useMealMode();

  // 지도 1회 초기화
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const center = new window.kakao.maps.LatLng(origin.lat, origin.lng);
        const inst = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: 4,
          draggable: true,
        });
        setMap(inst);
        // 줌 컨트롤 (선택) — 실패해도 지도는 동작.
        try {
          const zoom = new window.kakao.maps.ZoomControl();
          inst.addControl(zoom, window.kakao.maps.ControlPosition.RIGHT);
        } catch (e) {
          console.warn('zoom control failed:', e);
        }
      })
      .catch((err) => {
        console.error('Kakao map init failed:', err);
      });
    return () => {
      cancelled = true;
    };
    // origin 첫 로드만 사용 — 변경 시 setCenter 로 별도 처리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 현재 위치 버튼 (모바일 GPS 정확. 데스크탑/사내망에선 wifi 기반이라 부정확)
  function locateMe() {
    if (!navigator.geolocation || !map) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        map.panTo(here);
      },
      (err) => {
        alert(`위치 가져오기 실패: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function recenterToOrigin() {
    if (!map) return;
    map.panTo(new window.kakao.maps.LatLng(origin.lat, origin.lng));
  }

  // 지도 빈 곳 터치/클릭 시 선택 해제 + 열린 클러스터 popover 닫기.
  // 핀(CustomOverlay) 클릭은 element click 으로 별도 처리되므로 여기엔 안 잡힘.
  useEffect(() => {
    if (!map) return;
    const handler = () => {
      if (openClusterKey) setOpenClusterKey(null);
      if (selectedId) onDeselect();
    };
    window.kakao.maps.event.addListener(map, 'click', handler);
    return () => {
      window.kakao.maps.event.removeListener(map, 'click', handler);
    };
  }, [map, selectedId, onDeselect, openClusterKey]);

  // origin 변경 시 회사 마커 재생성 + 중심 이동
  useEffect(() => {
    if (!map) return;
    originMarkerRef.current?.setMap(null);

    const pos = new window.kakao.maps.LatLng(origin.lat, origin.lng);
    const markerColor = readToken('--marker', '#e24b4a');
    const el = document.createElement('div');
    el.style.cssText =
      'display:inline-flex;align-items:center;gap:5px;' +
      'padding:4px 10px 4px 6px;border-radius:9999px;' +
      `background:${markerColor};color:#ffffff;` +
      'font-size:11px;font-weight:700;line-height:1;letter-spacing:-0.2px;' +
      'box-shadow:0 2px 8px rgba(226,75,74,0.45),0 1px 3px rgba(0,0,0,0.15);' +
      'white-space:nowrap;cursor:default;';
    el.innerHTML =
      '<span aria-hidden style="font-size:14px;line-height:1">🏢</span><span>회사</span>';
    el.title = '회사 (내 건물)';
    const overlay = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 5,
    });
    overlay.setMap(map);
    originMarkerRef.current = overlay;
    map.setCenter(pos);
  }, [map, origin.lat, origin.lng]);

  // 식당 핀 갱신 (목록 변동 또는 mode/선택 변동 시 재계산)
  // D56: 같은 좌표 (소수점 5자리 = ~1m) 에 식당이 여러 개면 클러스터 핀 하나 + "+N" 배지.
  //      클러스터 클릭 시 popover 가 떠서 목록에서 골라 선택 가능.
  useEffect(() => {
    if (!map) return;

    // 기존 모두 제거 (단순. 식당 수가 많아지면 diff 로 최적화)
    pinRefs.current.forEach((ov) => ov.setMap(null));
    pinRefs.current.clear();

    const activeColor = readToken('--pin-active', '#1a1a1a');
    const inactiveColor = readToken('--pin-inactive', '#888780');
    const staleColor = readToken('--stale', '#888780');
    const surfaceColor = readToken('--surface', '#fafaf7');
    const fgColor = readToken('--fg', '#1a1a1a');
    const borderColor = readToken('--border', 'rgba(0,0,0,0.08)');

    // 1) 좌표 키로 그룹화 — 모드/폐업 필터 통과한 식당만
    const groups = new Map<string, typeof restaurants>();
    for (const r of restaurants) {
      if (!r.categories.includes(mode)) continue;
      if (r.is_closed && !includeClosed && r.id !== selectedId) continue;
      const key = `${r.latitude.toFixed(5)},${r.longitude.toFixed(5)}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    // 2) 그룹마다 핀 하나 렌더
    for (const [groupKey, items] of groups) {
      // 그룹 내 selected 가 있으면 그게 대표, 없으면 첫 식당
      const selectedInGroup = items.find((i) => i.id === selectedId) ?? null;
      const primary = selectedInGroup ?? items[0]!;
      const isSelected = !!selectedInGroup;
      const isStale = primary.is_closed;
      const groupSize = items.length;
      const isCluster = groupSize > 1;
      const color = isStale ? staleColor : isSelected ? activeColor : inactiveColor;
      const dotSize = isSelected ? 36 : 30;
      const emoji = emojiForCuisine((primary.cuisine_types[0] ?? '한식') as never);

      const el = document.createElement('div');
      el.style.cssText =
        'position:relative;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;';
      el.setAttribute(
        'aria-label',
        isCluster ? `${groupSize}개 식당 (${items.map((i) => i.name).join(', ')})` : `식당 ${primary.name}`,
      );
      el.title = isCluster
        ? `${groupSize}개 식당: ${items.map((i) => i.name).join(' / ')}`
        : primary.name;

      // 라벨 (선택 시 항상 보임 / 그 외엔 hover 시만)
      const label = document.createElement('div');
      label.style.cssText =
        'position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);' +
        `padding:3px 8px;border-radius:9999px;` +
        `background:${surfaceColor};color:${fgColor};` +
        `border:1px solid ${borderColor};` +
        'font-size:11px;font-weight:600;line-height:1;letter-spacing:-0.2px;' +
        'box-shadow:0 1px 4px rgba(0,0,0,0.15);' +
        'white-space:nowrap;pointer-events:none;' +
        `opacity:${isSelected ? '1' : '0'};` +
        'transition:opacity 0.15s ease;';
      label.textContent = isCluster
        ? `${primary.name} 외 ${groupSize - 1}곳`
        : isStale
          ? `${primary.name} (폐업)`
          : primary.name;
      el.appendChild(label);

      // 핀: 흰 배경 동그라미 + 이모지 + 색 테두리
      const dot = document.createElement('div');
      dot.style.cssText =
        `position:relative;display:flex;align-items:center;justify-content:center;` +
        `width:${dotSize}px;height:${dotSize}px;border-radius:9999px;` +
        `background:#ffffff;` +
        `border:2px solid ${color};` +
        `box-shadow:0 2px 6px rgba(0,0,0,0.25)${isSelected ? `,0 0 0 4px ${color}44` : ''};` +
        `font-size:${isSelected ? 18 : 15}px;line-height:1;` +
        `${isStale ? 'opacity:0.55;' : ''}`;
      dot.innerHTML = `<span aria-hidden>${emoji}</span>`;
      if (isStale && !isCluster) {
        const x = document.createElement('span');
        x.textContent = '✕';
        x.style.cssText =
          'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
          'color:#ef4444;font-size:18px;font-weight:900;line-height:1;text-shadow:0 0 2px white;';
        dot.appendChild(x);
      }
      // D56: 클러스터 +N 배지 (우상단)
      if (isCluster) {
        const badge = document.createElement('span');
        badge.textContent = `+${groupSize - 1}`;
        badge.style.cssText =
          'position:absolute;top:-6px;right:-6px;' +
          'min-width:18px;height:18px;padding:0 4px;border-radius:9999px;' +
          `background:${activeColor};color:#ffffff;` +
          'font-size:10px;font-weight:700;line-height:18px;text-align:center;' +
          'box-shadow:0 1px 3px rgba(0,0,0,0.3);';
        dot.appendChild(badge);
      }
      el.appendChild(dot);

      // hover 라벨 토글 (selected 가 아닐 때만)
      if (!isSelected) {
        el.addEventListener('mouseenter', () => {
          label.style.opacity = '1';
        });
        el.addEventListener('mouseleave', () => {
          label.style.opacity = '0';
        });
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCluster) {
          // 같은 키 다시 누르면 닫기, 다른 키 누르면 그쪽 열기
          setOpenClusterKey((k) => (k === groupKey ? null : groupKey));
        } else {
          onSelect(primary.id);
        }
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(primary.latitude, primary.longitude),
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isSelected ? 10 : 3,
        clickable: true,
      });
      overlay.setMap(map);
      pinRefs.current.set(`group_${groupKey}`, overlay);
    }

    // 3) popover (선택된 클러스터가 있으면)
    if (openClusterKey) {
      const items = groups.get(openClusterKey);
      if (items && items.length > 1) {
        const first = items[0]!;
        const pop = document.createElement('div');
        pop.style.cssText =
          'display:flex;flex-direction:column;min-width:200px;max-width:260px;' +
          `background:${surfaceColor};color:${fgColor};` +
          `border:1px solid ${borderColor};border-radius:10px;` +
          'box-shadow:0 6px 18px rgba(0,0,0,0.18);overflow:hidden;';
        pop.addEventListener('click', (e) => e.stopPropagation());

        const header = document.createElement('div');
        header.style.cssText =
          'display:flex;align-items:center;justify-content:space-between;gap:6px;' +
          `padding:6px 10px;border-bottom:1px solid ${borderColor};` +
          'font-size:11px;font-weight:600;line-height:1.2;';
        header.innerHTML = `<span>같은 위치 ${items.length}곳</span>`;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', '닫기');
        closeBtn.style.cssText =
          'border:0;background:transparent;cursor:pointer;font-size:12px;color:inherit;opacity:0.6;padding:0;';
        closeBtn.addEventListener('click', () => setOpenClusterKey(null));
        header.appendChild(closeBtn);
        pop.appendChild(header);

        for (const it of items) {
          const itemEmoji = emojiForCuisine((it.cuisine_types[0] ?? '한식') as never);
          const row = document.createElement('button');
          row.type = 'button';
          row.style.cssText =
            'display:flex;align-items:center;gap:8px;width:100%;' +
            'padding:7px 10px;border:0;background:transparent;cursor:pointer;' +
            `border-top:1px solid ${borderColor};` +
            'text-align:left;font-size:12px;line-height:1.3;color:inherit;';
          row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(0,0,0,0.04)';
          });
          row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
          });
          row.innerHTML =
            `<span aria-hidden style="font-size:14px">${itemEmoji}</span>` +
            `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${it.is_closed ? 'text-decoration:line-through;opacity:0.6;' : ''}">${it.name}</span>` +
            `<span style="font-size:10px;opacity:0.6">commit ${it.commit_count}</span>`;
          row.addEventListener('click', () => {
            onSelect(it.id);
            setOpenClusterKey(null);
          });
          pop.appendChild(row);
        }

        const popOverlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(first.latitude, first.longitude),
          content: pop,
          yAnchor: 1.25, // 핀 위에 띄움
          xAnchor: 0.5,
          zIndex: 20,
          clickable: true,
        });
        popOverlay.setMap(map);
        pinRefs.current.set(`__popover__${openClusterKey}`, popOverlay);
      } else {
        // 그룹이 사라졌거나 1개로 줄어든 경우 자동 닫기
        setOpenClusterKey(null);
      }
    }

    return () => {
      pinRefs.current.forEach((ov) => ov.setMap(null));
      pinRefs.current.clear();
    };
  }, [map, restaurants, selectedId, mode, includeClosed, onSelect, openClusterKey]);

  // 선택된 식당이 있으면 경로 라인. 없으면 지움.
  useEffect(() => {
    if (!map) return;

    polylineRef.current?.setMap(null);
    polylineRef.current = null;
    walkBadgeRef.current?.setMap(null);
    walkBadgeRef.current = null;

    if (!selectedId) return;
    const target = restaurants.find((r) => r.id === selectedId);
    if (!target) return;

    const routeColor = readToken('--route', '#1a1a1a');
    const path = [
      new window.kakao.maps.LatLng(origin.lat, origin.lng),
      new window.kakao.maps.LatLng(target.latitude, target.longitude),
    ];
    const line = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 3,
      strokeColor: routeColor,
      strokeOpacity: 0.85,
      strokeStyle: 'shortdash',
    });
    line.setMap(map);
    polylineRef.current = line;

    // 경로 중간 뱃지 — 도보 N분
    const meters = haversineDistanceMeters(origin, {
      lat: target.latitude,
      lng: target.longitude,
    });
    const travel = travelInfo(meters);
    const midLat = (origin.lat + target.latitude) / 2;
    const midLng = (origin.lng + target.longitude) / 2;
    const badge = document.createElement('div');
    const surfaceColor = readToken('--surface', '#fafaf7');
    const fgColor = readToken('--fg', '#1a1a1a');
    const borderColor = readToken('--border', 'rgba(0,0,0,0.08)');
    badge.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;' +
      'padding:3px 9px;border-radius:9999px;' +
      `background:${surfaceColor};color:${fgColor};` +
      `border:1px solid ${borderColor};` +
      'font-size:11px;font-weight:600;line-height:1;' +
      'box-shadow:0 1px 3px rgba(0,0,0,0.12);white-space:nowrap;';
    badge.innerHTML = `<span aria-hidden>${travel.icon}</span>${travel.label} ${travel.minutes}분 · ${Math.round(meters)}m`;

    const badgeOverlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(midLat, midLng),
      content: badge,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 8,
    });
    badgeOverlay.setMap(map);
    walkBadgeRef.current = badgeOverlay;

    map.panTo(path[1]!);
    return () => {
      line.setMap(null);
      badgeOverlay.setMap(null);
    };
  }, [map, selectedId, restaurants, origin.lat, origin.lng, mode]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="kakao-map-tiles h-full w-full bg-surface" />
      {/* 우측 하단 floating 버튼 묶음 */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={recenterToOrigin}
          disabled={!map}
          title="내 건물로 돌아가기"
          aria-label="내 건물로 돌아가기"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg text-base shadow-md transition hover:bg-fg/5 disabled:opacity-50"
        >
          <span aria-hidden>🏢</span>
        </button>
        <button
          type="button"
          onClick={locateMe}
          disabled={!map}
          title="현재 GPS 위치 (모바일 권장)"
          aria-label="현재 위치"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg text-base shadow-md transition hover:bg-fg/5 disabled:opacity-50"
        >
          <span aria-hidden>📍</span>
        </button>
      </div>
    </div>
  );
}
