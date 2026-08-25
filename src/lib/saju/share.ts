// 사주 결과를 URL 코드로 인코딩/디코딩 — 공유 카드(A안)용.
// 로그인/DB 없이 결과를 링크에 담는다. 생년월일은 절대 안 담고, 계산된 결과값만.
// 인덱스+seed 만 담아 base64url → 짧고 self-contained. 디코드하면 buildSajuView 가능.
import type { SajuResult, Season, Axis } from './calc';
import type { Element, Strength } from './menus';

const ELS: Element[] = ['木', '火', '土', '金', '水'];
const STR: Strength[] = ['weak', 'mid', 'strong'];
const SEA: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const AX: Axis[] = ['self', 'express', 'wealth', 'order', 'insight'];
const YT: ('yang' | 'yin' | 'balanced')[] = ['yang', 'yin', 'balanced'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const GAN_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);

// ASCII JSON 만 담으므로 base64url 로 충분 (한글은 인덱스로 치환됨)
function b64urlEncode(s: string): string {
  const b64 = typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  return typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
}

interface Payload {
  g: number; // dayGan index
  e: number; // dayElement index
  s: number; // strength index
  c: number[]; // counts [木火土金水]
  lk: number; // lackElement index
  ln: 0 | 1; // lackIsNone
  se: number; // season index
  a: number; // dominantAxis index
  aa: number[]; // dominantAxes indices
  tz: number; // timeZhi index (-1 = 생시 없음)
  yt: number; // yinYangTilt index
  sd: number; // seed
}

export function encodeSaju(r: SajuResult): string {
  const p: Payload = {
    g: GAN.indexOf(r.dayGan),
    e: ELS.indexOf(r.dayElement),
    s: STR.indexOf(r.strength),
    c: ELS.map((el) => r.counts[el]),
    lk: ELS.indexOf(r.lackElement),
    ln: r.lackIsNone ? 1 : 0,
    se: SEA.indexOf(r.season),
    a: AX.indexOf(r.dominantAxis),
    aa: r.dominantAxes.map((ax) => AX.indexOf(ax)),
    tz: r.timeZhi ? ZHI.indexOf(r.timeZhi) : -1,
    yt: YT.indexOf(r.yinYangTilt),
    sd: r.seed,
  };
  return b64urlEncode(JSON.stringify(p));
}

// 디코드 실패(잘못된 코드) 시 null. palja/pillars 는 카드에서 안 쓰므로 비움.
export function decodeSaju(code: string): SajuResult | null {
  try {
    const p = JSON.parse(b64urlDecode(code)) as Payload;
    const g = GAN[p.g];
    const el = ELS[p.e];
    if (!g || !el || !STR[p.s] || !SEA[p.se] || !AX[p.a]) return null;
    const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 } as Record<Element, number>;
    ELS.forEach((e, i) => (counts[e] = p.c[i] ?? 0));
    const timeZhi = p.tz >= 0 ? (ZHI[p.tz] ?? '') : '';
    return {
      palja: '',
      pillars: [],
      dayGan: g,
      dayGanKo: GAN_KO[p.g] ?? g,
      dayElement: el,
      dayYinYang: YANG_GAN.has(g) ? 'yang' : 'yin',
      strength: STR[p.s]!,
      counts,
      lackElement: ELS[p.lk] ?? '木',
      lackIsNone: p.ln === 1,
      season: SEA[p.se]!,
      dominantAxis: AX[p.a]!,
      dominantAxes: (p.aa ?? []).map((i) => AX[i]).filter(Boolean) as Axis[],
      hasBirthTime: p.tz >= 0,
      timeZhi,
      timeZhiKo: p.tz >= 0 ? (ZHI_KO[p.tz] ?? '') : '',
      yinYangTilt: YT[p.yt] ?? 'balanced',
      seed: p.sd ?? 0,
    };
  } catch {
    return null;
  }
}
