// 카카오맵 SDK 의 최소 타입 (1차 사용 범위만).
// 정식 타입 패키지가 별도 없어 직접 정의.

declare global {
  interface Window {
    kakao: KakaoNamespace;
  }
}

interface KakaoNamespace {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    LatLngBounds: new () => KakaoLatLngBounds;
    Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap;
    Marker: new (options: KakaoMarkerOptions) => KakaoMarker;
    CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay;
    Polyline: new (options: KakaoPolylineOptions) => KakaoPolyline;
    event: {
      addListener: (target: unknown, type: string, handler: () => void) => void;
      removeListener: (target: unknown, type: string, handler: () => void) => void;
    };
    services: {
      Places: new () => KakaoPlaces;
      Status: { OK: 'OK'; ZERO_RESULT: 'ZERO_RESULT'; ERROR: 'ERROR' };
    };
    ZoomControl: new () => KakaoZoomControl;
    ControlPosition: {
      TOP: number;
      TOPLEFT: number;
      TOPRIGHT: number;
      LEFT: number;
      RIGHT: number;
      BOTTOMLEFT: number;
      BOTTOM: number;
      BOTTOMRIGHT: number;
    };
  };
}

export interface KakaoZoomControl {}

export interface KakaoPlaces {
  keywordSearch(
    keyword: string,
    callback: (data: KakaoPlaceItem[], status: 'OK' | 'ZERO_RESULT' | 'ERROR') => void,
    options?: {
      location?: KakaoLatLng;
      radius?: number;
      page?: number;
      size?: number;
      sort?: 'distance' | 'accuracy';
    },
  ): void;
}

export interface KakaoPlaceItem {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  place_url: string;
  distance?: string;
}

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
  isEmpty(): boolean;
}

export interface KakaoMapOptions {
  center: KakaoLatLng;
  level?: number;
  draggable?: boolean;
}

export interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  getLevel(): number;
  setBounds(bounds: KakaoLatLngBounds): void;
  panTo(latlng: KakaoLatLng): void;
  relayout(): void;
  setDraggable(enabled: boolean): void;
  addControl(control: unknown, position: number): void;
}

export interface KakaoMarkerOptions {
  position: KakaoLatLng;
  map?: KakaoMap;
  image?: unknown;
  clickable?: boolean;
}

export interface KakaoMarker {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
}

export interface KakaoCustomOverlayOptions {
  position: KakaoLatLng;
  content: HTMLElement | string;
  map?: KakaoMap;
  yAnchor?: number;
  xAnchor?: number;
  zIndex?: number;
  clickable?: boolean;
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
}

export interface KakaoPolylineOptions {
  path: KakaoLatLng[];
  strokeWeight?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeStyle?: 'solid' | 'dashed' | 'shortdash' | 'longdash';
  endArrow?: boolean;
}

export interface KakaoPolyline {
  setMap(map: KakaoMap | null): void;
  setPath(path: KakaoLatLng[]): void;
}

export {};
