-- =====================================================================
-- 게시 진행 상태 기록용 컬럼 (Phase 2B)
--
-- 배경
--   게시는 여러 단계를 거칩니다.
--     검사 → GitHub 임시 브랜치 커밋 → 빌드 확인 → main 반영 → 배포 → 공개 확인
--   어디까지 갔는지, 실패했다면 왜 실패했는지를 화면에 보여주려면
--   그 상태를 어딘가에 적어둬야 합니다.
--
-- 안전성
--   · add column if not exists 이므로 여러 번 실행해도 안전합니다
--   · 기존 데이터·권한·RLS 정책을 건드리지 않습니다
--   · 모두 nullable 이라 기존 행에 기본값을 쓰지 않습니다
--   · drop / delete / truncate 구문이 없습니다
-- =====================================================================

alter table public.cases
  add column if not exists publish_state      text,
  add column if not exists publish_branch     text,
  add column if not exists publish_commit     text,
  add column if not exists publish_error      text,
  add column if not exists published_url      text,
  add column if not exists publish_started_at timestamptz;

-- 허용하는 상태값. 글쓰기 흐름과 1:1로 맞춥니다.
--   ready     게시 준비  (점검 통과)
--   checking  검사 중    (Edge Function 이 내용을 확인하고 커밋하는 중)
--   verifying 빌드 확인 중 (GitHub Actions 가 npm run build 로 검증 중)
--   deploying 배포 중    (main 반영 완료, 사이트가 다시 만들어지는 중)
--   published 게시 완료  (공개 주소에서 실제로 글이 열리는 것까지 확인)
--   failed    게시 실패
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cases_publish_state_check'
  ) then
    alter table public.cases
      add constraint cases_publish_state_check
      check (publish_state is null or publish_state in
        ('ready', 'checking', 'verifying', 'deploying', 'published', 'failed'));
  end if;
end $$;

comment on column public.cases.publish_state  is '게시 진행 단계. null 이면 아직 게시를 시도하지 않은 글입니다.';
comment on column public.cases.publish_branch is 'GitHub 에 만든 게시용 임시 브랜치 이름.';
comment on column public.cases.publish_commit is '임시 브랜치에 올린 커밋 SHA. main 반영 여부를 이걸로 확인합니다.';
comment on column public.cases.published_url  is '실제로 열리는 것까지 확인한 공개 주소.';


-- ---------------------------------------------------------------------
-- 확인용 조회 — 새 컬럼 6개가 보이면 정상입니다.
-- ---------------------------------------------------------------------
select column_name as 컬럼, data_type as 타입, is_nullable as "NULL허용"
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'cases'
  and column_name in ('publish_state','publish_branch','publish_commit',
                      'publish_error','published_url','publish_started_at')
order by column_name;
