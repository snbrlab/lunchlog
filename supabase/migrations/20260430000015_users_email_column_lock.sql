-- D50: users.email 을 다른 사용자에게 노출 안 되도록 column-level GRANT 제한
-- 기존: authenticated 가 users 전체 컬럼 SELECT 가능 → 이메일 노출
-- 변경: email 제외 컬럼만 SELECT 허용. 본인 email 은 auth.getUser() 로,
--       admin 의 다른 사용자 email 조회는 service-role 통해 (admin client)

revoke select on users from authenticated;

grant select (
  id, name, avatar_color, avatar_emoji, role, department,
  office_id, building_id, password_set, created_at
) on users to authenticated;

-- service_role 은 모든 컬럼 select 가능 (Supabase 기본). admin 페이지에서 service-role 클라로 이메일 조회.
