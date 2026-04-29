-- 테스트 데이터 정리. 식당 + 리뷰 (reviews 는 FK cascade 라 식당 지우면 자동) 다 삭제.
-- ⚠️ 한 번만 돌려야 함. 다시 돌리면 새로 등록한 식당도 다 날아감.

delete from restaurants;
