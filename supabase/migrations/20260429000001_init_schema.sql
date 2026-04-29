-- Phase 1: 초기 스키마
-- SPEC.md 섹션 2 기반. + admin 역할 (관리자가 폐업/오등록 자유 정리)

create extension if not exists "pgcrypto";

-- 2.1 offices: 지역 단위 사무실
create table offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  default_lat double precision not null,
  default_lng double precision not null,
  created_at timestamptz default now()
);

-- 2.2 office_buildings: 사무실 산하 건물 (실제 좌표)
create table office_buildings (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices(id) on delete cascade,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  display_order int default 0,
  created_at timestamptz default now()
);

create index idx_office_buildings_office on office_buildings(office_id);

-- 2.3 users: auth.users 확장 프로필
-- role 컬럼은 SPEC에 없던 필드. 사용자 결정으로 추가 (관리자 권한)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  department text,
  office_id uuid references offices(id),
  building_id uuid references office_buildings(id),
  avatar_color text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz default now()
);

create index idx_users_role on users(role) where role = 'admin';

-- 2.4 restaurants
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  categories text[] not null,
  cuisine_type text not null,
  menu_tags text[] not null default '{}',
  price_level int not null check (price_level between 1 and 3),
  latitude double precision not null,
  longitude double precision not null,
  address text not null,
  note text,
  office_id uuid references offices(id),
  is_closed boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  commit_count int not null default 0,
  last_commit_at timestamptz
);

create index idx_restaurants_office on restaurants(office_id);
create index idx_restaurants_categories on restaurants using gin(categories);
create index idx_restaurants_cuisine on restaurants(cuisine_type);

-- 2.5 reviews: 한 줄 리뷰 = commit
create table reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  author_id uuid not null references users(id),
  message text not null check (char_length(message) <= 200),
  meal_time text not null check (meal_time in ('lunch','dinner')),
  hash text not null,
  created_at timestamptz default now(),
  edited_at timestamptz
);

create index idx_reviews_restaurant_time on reviews(restaurant_id, created_at desc);
create index idx_reviews_author on reviews(author_id);
