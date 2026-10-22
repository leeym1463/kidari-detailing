-- =====================================================================
-- 최소 권한 상태 자동 판정 (SELECT 전용 — 아무것도 변경하지 않습니다)
--
-- 0004_tighten_grants.sql 적용 후 상태를 눈으로 비교하지 않고
-- 통과/실패로 바로 보여줍니다. 결과 4행 모두 ✅ 면 정상입니다.
--
-- 이 파일이 하지 않는 것
--   · 데이터 변경 — SELECT 문 하나뿐입니다
--   · 권한 변경 — GRANT / REVOKE 가 없습니다
--   · RLS 변경 — CREATE / DROP POLICY 가 없습니다
--
-- 타입 주의
--   information_schema 의 컬럼은 일반 text 가 아니라 도메인 타입입니다
--   (table_name·grantee → sql_identifier, privilege_type → character_data).
--   그래서 배열 비교 시 "operator does not exist:
--   information_schema.character_data[] = text[]" 오류가 납니다.
--   아래 g CTE 에서 세 컬럼을 모두 ::text 로 캐스팅해 충돌을 없앱니다.
-- =====================================================================

with g as (
  -- 여기서 한 번만 text 로 정규화하면 이후 비교는 모두 text 끼리입니다.
  select
    table_name::text     as tbl,
    grantee::text        as role,
    privilege_type::text as priv
  from information_schema.role_table_grants
  where table_schema::text = 'public'
    and table_name::text in ('cases', 'photos', 'admins')
    and grantee::text    in ('anon', 'authenticated')
),
agg as (
  select
    tbl,
    role,
    array_agg(priv order by priv)        as privs,       -- text[]
    string_agg(priv, ', ' order by priv) as privs_text
  from g
  group by tbl, role
),
expected as (
  -- 기대 권한 집합. 이쪽도 명시적으로 text[] 입니다.
  select array['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[] as privs
)
select * from (

  -- 1) cases : authenticated 에 CRUD 4개만 (TRUNCATE 등은 빠져 있어야 함)
  select
    1                                                           as 순서,
    'cases / authenticated'                                     as 대상,
    coalesce(
      (select privs_text from agg where tbl = 'cases' and role = 'authenticated'),
      '(없음)'
    )                                                           as 현재권한,
    case
      when (select privs from agg where tbl = 'cases' and role = 'authenticated')
           = (select privs from expected)
      then '✅ 통과 (4개만)'
      else '❌ 실패 — 기대: DELETE, INSERT, SELECT, UPDATE'
    end                                                         as 판정

  union all

  -- 2) photos : authenticated 에 CRUD 4개만
  select
    2,
    'photos / authenticated',
    coalesce(
      (select privs_text from agg where tbl = 'photos' and role = 'authenticated'),
      '(없음)'
    ),
    case
      when (select privs from agg where tbl = 'photos' and role = 'authenticated')
           = (select privs from expected)
      then '✅ 통과 (4개만)'
      else '❌ 실패 — 기대: DELETE, INSERT, SELECT, UPDATE'
    end

  union all

  -- 3) anon : 세 표 어디에도 권한이 없어야 함
  select
    3,
    'anon (전체)',
    coalesce(
      (select string_agg(x, ', ')
         from (select distinct tbl || ':' || priv as x
                 from g where role = 'anon' order by 1) s),
      '(없음)'
    ),
    case
      when not exists (select 1 from g where role = 'anon')
      then '✅ 통과 (권한 없음)'
      else '❌ 실패 — anon 에 권한이 남아 있음'
    end

  union all

  -- 4) admins : anon·authenticated 양쪽 모두 권한이 없어야 함
  --    관리자 판별은 security definer 함수 is_admin() 이 대신합니다.
  select
    4,
    'admins (명단 보호)',
    coalesce(
      (select string_agg(x, ', ')
         from (select distinct role || ':' || priv as x
                 from g where tbl = 'admins' order by 1) s),
      '(없음)'
    ),
    case
      when not exists (select 1 from g where tbl = 'admins')
      then '✅ 통과 (권한 없음)'
      else '❌ 실패 — admins 가 노출됨'
    end

) r
order by 순서;
