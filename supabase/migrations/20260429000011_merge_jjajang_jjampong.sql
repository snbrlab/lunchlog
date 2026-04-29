-- 짜장면/짬뽕 통합. 기존 값들 변환.
update restaurants set cuisine_type = '짜장면/짬뽕'
 where cuisine_type in ('짜장면', '짬뽕');
