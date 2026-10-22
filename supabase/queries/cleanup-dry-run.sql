-- =====================================================================
-- 임시 사진 7일 자동정리 — 판정 조건 검증용 (드라이런)
--
-- 이 파일에는 삭제 구문이 없습니다. 조회만 합니다.
-- 실제 삭제는 Phase 4에서 2주간 드라이런으로 판정을 확인한 뒤 켭니다.
-- =====================================================================


-- 1) 정리 대상 (글에 연결되지 않은 7일 경과 temp 사진)
select
  id,
  storage_path,
  created_at,
  now() - created_at as 경과시간
from public.photos
where status = 'temp'
  and case_id is null
  and created_at < now() - interval '7 days'
order by created_at;


-- 2) 보호되는 사진 — 아래는 절대 삭제 대상이 아님을 확인
select
  '글에 연결됨(임시저장 포함)' as 보호사유,
  count(*) as 건수
from public.photos
where case_id is not null

union all

select
  '아직 7일 미경과',
  count(*)
from public.photos
where status = 'temp'
  and case_id is null
  and created_at >= now() - interval '7 days'

union all

select
  '게시 완료(GitHub로 이관됨)',
  count(*)
from public.photos
where status = 'published';


-- 3) 전체 현황 요약
select
  status,
  case when case_id is null then '미연결' else '글에 연결됨' end as 연결상태,
  count(*)                        as 건수,
  pg_size_pretty(sum(bytes))      as 용량합계
from public.photos
group by 1, 2
order by 1, 2;
