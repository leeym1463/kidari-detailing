-- =====================================================================
-- 최소 권한 상태 자동 판정 (SELECT 전용 — 아무것도 변경하지 않습니다)
--
-- 0004_tighten_grants.sql 적용 후 상태를 직접 눈으로 비교하지 않고
-- 통과/실패로 바로 보여줍니다. 결과 4행 모두 ✅ 면 정상입니다.
-- =====================================================================

with g as (
  select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('cases', 'photos', 'admins')
    and grantee in ('anon', 'authenticated')
),
expected as (
  select 'DELETE' p union all select 'INSERT'
  union all select 'SELECT' union all select 'UPDATE'
)
select * from (

  -- 1) cases : authenticated 에 정확히 4개만
  select
    1 as 순서,
    'cases / authenticated' as 대상,
    coalesce(string_agg(privilege_type, ', ' order by privilege_type), '(없음)') as 현재권한,
    case when array(select privilege_type from g
                    where table_name='cases' and grantee='authenticated'
                    order by privilege_type)
            = array(select p from expected order by p)
         then '✅ 통과 (4개만)'
         else '❌ 실패 — 기대: DELETE, INSERT, SELECT, UPDATE' end as 판정
  from g where table_name='cases' and grantee='authenticated'

  union all

  -- 2) photos : authenticated 에 정확히 4개만
  select
    2,
    'photos / authenticated',
    coalesce(string_agg(privilege_type, ', ' order by privilege_type), '(없음)'),
    case when array(select privilege_type from g
                    where table_name='photos' and grantee='authenticated'
                    order by privilege_type)
            = array(select p from expected order by p)
         then '✅ 통과 (4개만)'
         else '❌ 실패 — 기대: DELETE, INSERT, SELECT, UPDATE' end
  from g where table_name='photos' and grantee='authenticated'

  union all

  -- 3) anon : 어떤 표에도 권한이 없어야 함
  select
    3,
    'anon (전체)',
    coalesce(string_agg(distinct table_name || ':' || privilege_type, ', '), '(없음)'),
    case when count(*) = 0 then '✅ 통과 (권한 없음)'
         else '❌ 실패 — anon 에 권한이 남아 있음' end
  from g where grantee='anon'

  union all

  -- 4) admins : anon·authenticated 양쪽 모두 권한이 없어야 함
  select
    4,
    'admins (명단 보호)',
    coalesce(string_agg(grantee || ':' || privilege_type, ', '), '(없음)'),
    case when count(*) = 0 then '✅ 통과 (권한 없음)'
         else '❌ 실패 — admins 가 노출됨' end
  from g where table_name='admins'

) r order by 순서;
