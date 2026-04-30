-- D39 후속: cuisine_type 컬럼은 rollback 안전망으로 유지 중인데
-- NOT NULL 제약 때문에 새 INSERT 가 막힘.
-- 코드는 이제 cuisine_types 만 쓰므로 NOT NULL 만 풀어 둔다.

alter table restaurants alter column cuisine_type drop not null;
