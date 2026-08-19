// 최다 십성축 → 성격 한 줄 (재미 요소, 메뉴 결정엔 안 씀).
import type { Axis, Season } from './calc';

export const AXIS_PERSONA: Record<Axis, { label: string; line: string }> = {
  self: { label: '자기주도형', line: '내 기준으로 정하고 밀고 나가는 사람' },
  express: { label: '표현형', line: '느낌과 생각을 밖으로 잘 꺼내는 사람' },
  wealth: { label: '관계형', line: '사람과 상황을 자연스럽게 연결하는 사람' },
  order: { label: '책임형', line: '맡은 건 끝까지 챙기고 정리하는 사람' },
  insight: { label: '통찰형', line: '드러나지 않은 걸 먼저 알아채는 사람' },
};

export const SEASON_LABEL: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

// 계절 → 온도 한 줄 (여름생이면 시원하게 등)
export const SEASON_TEMP: Record<Season, string> = {
  spring: '산뜻하게 즐기기 좋은 기운',
  summer: '시원한 쪽으로 당기는 기운',
  autumn: '깊고 진한 맛이 어울리는 기운',
  winter: '뜨끈한 걸로 몸을 데우는 기운',
};
