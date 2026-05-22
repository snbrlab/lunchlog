// DB 타입 정의 (수동). 추후 Supabase CLI 의 `supabase gen types typescript` 결과로 교체 가능.

import type { CuisineType } from '@/lib/cuisine';

export type MealMode = 'lunch' | 'dinner';
// CuisineType 은 lib/cuisine.ts 의 CUISINE_GROUPS 가 source of truth.
export type { CuisineType };
export type UserRole = 'member' | 'admin';

export interface Office {
  id: string;
  name: string;
  slug: string;
  default_lat: number;
  default_lng: number;
  created_at: string;
}

export interface OfficeBuilding {
  id: string;
  office_id: string;
  name: string;
  latitude: number;
  longitude: number;
  display_order: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  department: string | null;
  office_id: string | null;
  building_id: string | null;
  avatar_color: string;
  avatar_emoji: string | null;
  role: UserRole;
  password_set: boolean;
  created_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  categories: MealMode[];
  cuisine_types: CuisineType[];
  menu_tags: string[];
  price_level: 1 | 2 | 3;
  latitude: number;
  longitude: number;
  address: string;
  note: string | null;
  office_id: string | null;
  is_closed: boolean;
  created_by: string | null;
  created_at: string;
  commit_count: number;
  last_commit_at: string | null;
  recommended_min_size: number | null;
  recommended_max_size: number | null;
  has_alcohol: boolean;
  kakao_place_url: string | null;
  // join 으로 들어올 수 있는 등록자 정보 (옵션)
  creator?: {
    name: string;
    avatar_emoji: string | null;
    avatar_color: string;
  } | null;
}

// D55: /map 사이드바 + 지도 마커가 실제로 쓰는 컬럼만.
// 전체 Restaurant 의 strict subset → 캐시 페이로드 슬림화.
// 디테일 패널 (address/note/recommended_*/kakao_place_url/creator 등) 은
// 패널 오픈 시점에 fetchRestaurantDetail(id) 로 단건 조회.
export type RestaurantListItem = Pick<
  Restaurant,
  | 'id'
  | 'name'
  | 'categories'
  | 'cuisine_types'
  | 'menu_tags'
  | 'price_level'
  | 'latitude'
  | 'longitude'
  | 'is_closed'
  | 'commit_count'
  | 'last_commit_at'
  | 'has_alcohol'
>;

export type ReportCategory = 'bug' | 'feature' | 'restaurant' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved';

export interface Report {
  id: string;
  author_id: string;
  category: ReportCategory;
  message: string;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Review {
  id: string;
  restaurant_id: string;
  author_id: string;
  message: string;
  meal_time: MealMode;
  party_size: number | null;
  hash: string;
  reverted: boolean;
  parent_review_id: string | null;
  created_at: string;
  edited_at: string | null;
}

// D41 인앱 노티 (+ D69 report_comment, + D70 badge_earned)
export type NotificationType =
  | 'report_update'
  | 'review_reply'
  | 'signup_request_new'
  | 'report_new'
  | 'report_comment'
  | 'badge_earned';

export interface ReportUpdatePayload {
  report_id: string;
  category: ReportCategory;
  status: ReportStatus;
  admin_note: string | null;
}

export interface ReviewReplyPayload {
  reply_review_id: string;
  reply_hash: string;
  reply_author_id: string;
  reply_author_name: string;
  parent_hash: string;
  restaurant_id: string;
  restaurant_name: string;
  message: string;
}

// admin 전용
export interface SignupRequestNewPayload {
  request_id: string;
  email: string;
  name: string;
}

// admin 전용
export interface ReportNewPayload {
  report_id: string;
  author_id: string;
  author_name: string;
  category: ReportCategory;
  message: string;
}

// D69: 제보 댓글 — admin → user 또는 user → admin
export interface ReportCommentPayload {
  report_id: string;
  category: ReportCategory;
  from: 'admin' | 'user';
  preview: string;
}

// D70: 뱃지 획득 — code 만 들고 UI 가 lib/badges.ts 에서 lookup
export interface BadgeEarnedPayload {
  code: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  payload:
    | ReportUpdatePayload
    | ReviewReplyPayload
    | SignupRequestNewPayload
    | ReportNewPayload
    | ReportCommentPayload
    | BadgeEarnedPayload;
  read_at: string | null;
  created_at: string;
}
