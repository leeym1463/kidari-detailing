-- =====================================================================
-- cases 에 네이버 블로그 원본 URL 컬럼 추가 (Phase 1)
--
-- 배경
--   작성 화면의 선택 입력 항목으로 "네이버 블로그 URL" 이 필요합니다.
--   사장님이 블로그 글을 옮겨 적을 때 원본 주소를 남겨두면
--   나중에 사진·문장을 다시 확인할 수 있습니다.
--
-- 안전성
--   · 기존 migration 파일을 수정하지 않고 새 파일로 추가합니다
--   · add column if not exists 이므로 여러 번 실행해도 안전합니다
--   · 기존 데이터·권한·RLS 정책에 영향이 없습니다
--   · 새 컬럼은 nullable 이라 기존 행에 기본값을 쓰지 않습니다
-- =====================================================================

alter table public.cases
  add column if not exists naver_blog_url text;

comment on column public.cases.naver_blog_url is
  '옮겨 적은 네이버 블로그 원본 글 주소(선택). 사진·문장 재확인용입니다.';


-- ---------------------------------------------------------------------
-- 확인용 조회 — naver_blog_url 행이 보이면 정상입니다.
-- ---------------------------------------------------------------------
select
  column_name as 컬럼,
  data_type   as 타입,
  is_nullable as "NULL허용"
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'cases'
  and column_name in ('naver_blog_url', 'vehicle_color', 'content_blocks')
order by column_name;
