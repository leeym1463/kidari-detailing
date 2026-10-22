-- =====================================================================
-- 관리자 1명 등록 (0001_init.sql 실행 후 한 번만)
--
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 아래 이메일을 Authentication → Users 에서 만드신 관리자 계정 주소로
-- 바꾼 뒤 실행하세요. 비밀번호는 입력하지 않습니다.
-- =====================================================================

insert into public.admins (user_id)
select id
from auth.users
where email = '여기에_관리자_이메일_입력'
on conflict (user_id) do nothing;


-- 등록 결과 확인 (1행이 나와야 정상)
select a.user_id, u.email, a.created_at
from public.admins a
join auth.users u on u.id = a.user_id;
