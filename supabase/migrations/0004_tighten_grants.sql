-- =====================================================================
-- 최소 권한 정리 (0003 실행 후)
--
-- 배경
--   Supabase 기본값으로 authenticated 역할에 TRUNCATE / REFERENCES /
--   TRIGGER 권한까지 들어가 있습니다. CMS 운영에 필요 없는 권한입니다.
--   특히 TRUNCATE 는 RLS 정책을 우회하므로 제거합니다.
--   (PostgREST가 TRUNCATE를 노출하지 않아 실제 악용 경로는 없지만,
--    최소 권한 원칙상 남겨둘 이유가 없습니다)
--
-- 이 파일이 하지 않는 것
--   · 데이터 삭제 — DELETE / TRUNCATE 문이 없습니다
--   · 테이블 삭제 — DROP TABLE 이 없습니다
--   · 정책 삭제 — DROP POLICY 가 없습니다. RLS 정책은 그대로 유지됩니다
--   · 관리자 계정 변경 — admins 표를 건드리지 않습니다
--
-- 여러 번 실행해도 안전합니다.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 불필요한 권한만 회수
--
--    REVOKE 는 "권한"만 거둬들일 뿐 데이터·구조에 영향이 없습니다.
-- ---------------------------------------------------------------------

revoke truncate, references, trigger on public.cases  from authenticated;
revoke truncate, references, trigger on public.photos from authenticated;


-- ---------------------------------------------------------------------
-- 2. CMS 운영에 필요한 권한은 명시적으로 재확인
--
--    이미 있으면 그대로이고, 없으면 부여됩니다.
--    실제 접근 통제는 여전히 RLS의 is_admin() 이 담당합니다.
-- ---------------------------------------------------------------------

grant select, insert, update, delete on public.cases  to authenticated;
grant select, insert, update, delete on public.photos to authenticated;


-- ---------------------------------------------------------------------
-- 3. anon · admins 는 계속 차단 상태 유지 (재확인)
-- ---------------------------------------------------------------------

revoke all on public.cases  from anon;
revoke all on public.photos from anon;
revoke all on public.admins from anon;
revoke all on public.admins from authenticated;


-- ---------------------------------------------------------------------
-- 4. 결과 확인
--
--    기대 결과
--      cases  | authenticated | DELETE, INSERT, SELECT, UPDATE   ← 4개만
--      photos | authenticated | DELETE, INSERT, SELECT, UPDATE   ← 4개만
--      (anon, admins 는 아무 행도 나오지 않아야 정상)
-- ---------------------------------------------------------------------

select
  table_name as 테이블,
  grantee    as 역할,
  string_agg(privilege_type, ', ' order by privilege_type) as 권한
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('cases', 'photos', 'admins')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;


-- ---------------------------------------------------------------------
-- 5. RLS 정책이 그대로 살아 있는지 확인
--
--    기대 결과: cases_admin_all, photos_admin_all 두 행이 그대로 존재
-- ---------------------------------------------------------------------

select
  tablename  as 테이블,
  policyname as 정책명,
  cmd        as 대상동작,
  roles      as 적용역할
from pg_policies
where schemaname = 'public'
  and tablename in ('cases', 'photos', 'admins')
order by tablename, policyname;
