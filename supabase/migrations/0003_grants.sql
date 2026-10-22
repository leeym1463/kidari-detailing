-- =====================================================================
-- 테이블 접근 권한 정리 (0001, 0002 실행 후)
--
-- 배경
--   anon 검증에서 "permission denied for table cases" 가 나왔습니다.
--   이는 RLS 이전 단계인 테이블 GRANT가 없다는 뜻입니다.
--   같은 이유로 authenticated(로그인 사용자)에게도 권한이 없으면
--   관리자조차 읽기/쓰기를 못 하게 되므로, 여기서 명시적으로 정리합니다.
--
-- 보안 설계
--   · authenticated 에게 권한을 주더라도, RLS 정책이 is_admin() 을 요구하므로
--     관리자가 아닌 로그인 사용자는 여전히 아무것도 할 수 없습니다 (이중 방어)
--   · anon 은 권한과 정책 양쪽에서 모두 차단합니다
--   · admins 표는 어느 역할에도 권한을 주지 않습니다 (명단 노출 방지)
--
-- 안전성: 데이터를 변경하지 않으며 여러 번 실행해도 안전합니다.
-- =====================================================================


-- 1. 스키마 사용 권한
grant usage on schema public to authenticated;


-- 2. 관리자가 다룰 표 — authenticated 에만 부여 (실제 통제는 RLS)
grant select, insert, update, delete on public.cases  to authenticated;
grant select, insert, update, delete on public.photos to authenticated;


-- 3. anon 은 어떤 경우에도 접근 불가 (권한 레벨에서 차단)
revoke all on public.cases  from anon;
revoke all on public.photos from anon;
revoke all on public.admins from anon;


-- 4. admins 표는 authenticated 에게도 직접 권한을 주지 않습니다.
--    관리자 판별은 security definer 함수가 대신합니다.
revoke all on public.admins from authenticated;


-- ---------------------------------------------------------------------
-- 확인용 조회 — 아래 결과가 기대와 맞는지 보세요.
--   cases  / photos : authenticated 에 SELECT,INSERT,UPDATE,DELETE 존재
--   admins          : 아무 행도 나오지 않아야 정상
--   anon            : 아무 행도 나오지 않아야 정상
-- ---------------------------------------------------------------------
select
  table_name   as 테이블,
  grantee      as 역할,
  string_agg(privilege_type, ', ' order by privilege_type) as 권한
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('cases', 'photos', 'admins')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;
