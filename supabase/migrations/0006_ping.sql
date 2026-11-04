-- =====================================================================
-- 일시중지 방지용 ping 함수 (Phase 2 준비)
--
-- 배경
--   Supabase 무료 플랜은 1주일 동안 아무 접속이 없으면 프로젝트를
--   자동으로 일시중지합니다. 2026-11-04 에 실제로 멈춰서 관리자 로그인이
--   되지 않았습니다. 사장님 글쓰기 빈도가 월 2~3건이라 또 생길 수 있습니다.
--
--   그래서 GitHub Actions 가 이틀에 한 번 이 함수를 불러
--   "접속이 있었다"는 기록을 남깁니다.
--
-- 이 함수가 하는 일
--   현재 시각 하나를 돌려줍니다. 그게 전부입니다.
--
-- 보안
--   · security definer 가 아닙니다. 부르는 사람의 권한 그대로 실행됩니다
--   · 어떤 표도 읽지 않습니다. 돌려주는 값은 서버 시각뿐입니다
--   · 따라서 anon 에게 실행 권한을 줘도 노출되는 정보가 없습니다
--   · 기존 표·권한·RLS 정책을 건드리지 않습니다
--
-- 안전성
--   · drop / delete / truncate 구문이 없습니다
--   · create or replace 라 여러 번 실행해도 안전합니다
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 함수 만들기
--
--    stable: 같은 트랜잭션 안에서 값이 변하지 않는다는 표시입니다.
--    실제로 데이터베이스에 질의가 들어가므로 "활동"으로 기록됩니다.
-- ---------------------------------------------------------------------

create or replace function public.ping()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

comment on function public.ping() is
  '일시중지 방지용. 현재 시각만 돌려줍니다. 어떤 데이터도 읽지 않습니다.';


-- ---------------------------------------------------------------------
-- 2. 실행 권한
--
--    GitHub Actions 는 공개 키(sb_publishable_...)로 부르므로
--    anon 역할에 실행 권한이 필요합니다.
--    표 접근 권한은 그대로 막혀 있습니다 — 이 함수는 표를 쓰지 않습니다.
-- ---------------------------------------------------------------------

grant execute on function public.ping() to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. 확인
--
--    기대 결과
--      ping 함수   | 보안방식 = invoker | 실행권한 = anon, authenticated
--      현재시각    | 지금 시각 한 줄
-- ---------------------------------------------------------------------

select
  p.proname                                        as 함수,
  case when p.prosecdef then 'definer' else 'invoker' end as 보안방식,
  pg_get_function_result(p.oid)                    as 반환형
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ping';

select
  grantee  as 역할,
  privilege_type as 권한
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name   = 'ping'
  and grantee in ('anon', 'authenticated')
order by grantee;

select public.ping() as 현재시각;
