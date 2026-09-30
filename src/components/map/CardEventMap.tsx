'use client';

// 카드사 이벤트 지도 — src/components/map/KakaoMap.tsx 와 달리 클러스터링/경로선 없이
// 가맹점 핀만 가볍게 찍는다 (한 구에 최대 300여개, 클러스터링 없이도 충분히 동작).
// 매칭된(런치로그에 이미 있는) 곳은 초록, 신규는 빨강으로 구분.

import { useEffect, useRef, useState } from 'react';
import { loadKakaoMaps } from '@/lib/kakao-loader';
import type { KakaoCustomOverlay, KakaoMap as KakaoMapInst } from '@/types/kakao-maps';

export interface CardEventMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  matched: boolean;
}

interface Props {
  markers: CardEventMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

export function CardEventMap({ markers, selectedId, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<KakaoMapInst | null>(null);
  const pinRefs = useRef<Map<string, KakaoCustomOverlay>>(new Map());
  // 마커 "목록 자체"가 바뀔 때만(구 전환) bounds 를 다시 맞춤 — selectedId 만 바뀌는
  // 클릭/선택 시에는 확대/축소 상태를 건드리지 않음 (전에는 클릭할 때마다 줌이 도로 빠졌음).
  const lastBoundsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const center = new window.kakao.maps.LatLng(37.5665, 126.978);
        const inst = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: 6,
          draggable: true,
        });
        setMap(inst);
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
  }, []);

  // 컨테이너 리사이즈 시 타일 재배치 (상세패널 열림/닫힘으로 영역이 바뀜)
  useEffect(() => {
    if (!map || !containerRef.current) return;
    const ro = new ResizeObserver(() => map.relayout());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [map]);

  // 빈 곳 클릭 시 선택 해제
  useEffect(() => {
    if (!map) return;
    const handler = () => {
      if (selectedId) onDeselect();
    };
    window.kakao.maps.event.addListener(map, 'click', handler);
    return () => {
      window.kakao.maps.event.removeListener(map, 'click', handler);
    };
  }, [map, selectedId, onDeselect]);

  // 마커 목록(구 전환)이 바뀔 때마다 핀 다시 그리고 bounds 맞춤
  useEffect(() => {
    if (!map) return;
    pinRefs.current.forEach((ov) => ov.setMap(null));
    pinRefs.current.clear();
    if (markers.length === 0) return;

    const bounds = new window.kakao.maps.LatLngBounds();

    for (const m of markers) {
      const isSelected = m.id === selectedId;
      const color = m.matched ? '#1a7f37' : '#e24b4a';
      const dotSize = isSelected ? 30 : 20;

      const el = document.createElement('div');
      el.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;';
      el.title = m.name;
      el.setAttribute('aria-label', `${m.name}${m.matched ? ' (런치로그에 있음)' : ' (신규)'}`);

      const dot = document.createElement('div');
      dot.style.cssText =
        `width:${dotSize}px;height:${dotSize}px;border-radius:9999px;background:#ffffff;` +
        `border:2.5px solid ${color};` +
        `box-shadow:0 2px 6px rgba(0,0,0,0.25)${isSelected ? `,0 0 0 4px ${color}44` : ''};` +
        'display:flex;align-items:center;justify-content:center;' +
        `font-size:${isSelected ? 14 : 11}px;line-height:1;`;
      dot.textContent = m.matched ? '🖤' : '🤍';
      el.appendChild(dot);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(m.id);
      });

      const pos = new window.kakao.maps.LatLng(m.lat, m.lng);
      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isSelected ? 10 : 3,
        clickable: true,
      });
      overlay.setMap(map);
      pinRefs.current.set(m.id, overlay);
      bounds.extend(pos);
    }

    const boundsKey = markers
      .map((m) => m.id)
      .sort()
      .join(',');
    if (!bounds.isEmpty() && lastBoundsKeyRef.current !== boundsKey) {
      map.setBounds(bounds);
      lastBoundsKeyRef.current = boundsKey;
    }

    const pins = pinRefs.current;
    return () => {
      pins.forEach((ov) => ov.setMap(null));
      pins.clear();
    };
  }, [map, markers, selectedId, onSelect]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="kakao-map-tiles h-full w-full bg-surface" />
    </div>
  );
}
