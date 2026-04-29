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
  cuisine_type: CuisineType;
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
  created_at: string;
  edited_at: string | null;
}
