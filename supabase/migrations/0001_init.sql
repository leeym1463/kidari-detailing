-- =====================================================================
-- 키다리광택 CMS — 초기 스키마 + RLS (Phase 0.5 검증용)
--
-- 실행 위치: Supabase Dashboard → SQL Editor → 새 쿼리에 붙여넣고 Run
--
-- 안전성 메모
--  · DROP / TRUNCATE / DELETE 구문이 하나도 없습니다 (비파괴적)
--  · 모두 IF NOT EXISTS 기반이라 여러 번 실행해도 안전합니다
--  · 기존 데이터에 영향을 주지 않습니다
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------

-- 관리자 명단. auth.users에 있는 계정 중 여기 등록된 사람만 권한을 가집니다.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is '관리자 허용 목록. 이 표에 있는 uid만 CMS 데이터를 다룰 수 있습니다.';


-- 시공사례. 공개 사이트의 원본은 GitHub 저장소이고, 이 표는 구조화 기록(향후 ERP 연동용)입니다.
create table if not exists public.cases (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  category         text not null
                     check (category in (
                       '광택·유리막코팅',
                       '외형복원·판금도색',
                       '스팀세차',
                       '에바크리닝',
                       '실내크리닝'
                     )),
  case_date        date not null default current_date,
  vehicle          text,
  vehicle_color    text,
  summary          text,
  before_condition text,
  work_performed   text[] not null default '{}',
  duration         text,
  price_note       text,
  content_blocks   jsonb  not null default '[]'::jsonb,
  cover_image      text,
  status           text   not null default 'draft'
                     check (status in ('draft', 'published')),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.cases.content_blocks is
  '본문 블록 배열. 예: [{"type":"paragraph","text":"..."},{"type":"image","path":"..."}]';
comment on column public.cases.cover_image is
  '대표사진 경로. 비어 있으면 본문 첫 번째 이미지 블록을 사용합니다.';


-- 업로드된 사진. 7일 자동정리 판정을 안전하게 하기 위한 대장 역할입니다.
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  width        int,
  height       int,
  bytes        bigint,
  case_id      uuid references public.cases (id) on delete set null,
  status       text not null default 'temp'
                 check (status in ('temp', 'published')),
  created_at   timestamptz not null default now()
);

comment on column public.photos.case_id is
  '글에 연결되면 채워집니다. 비어 있는 temp 사진만 자동정리 대상이 됩니다.';

-- 자동정리 대상 조회를 빠르게 하기 위한 부분 인덱스
create index if not exists photos_cleanup_idx
  on public.photos (status, created_at)
  where case_id is null;


-- ---------------------------------------------------------------------
-- 2. updated_at 자동 갱신
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cases_touch_updated_at on public.cases;
create trigger cases_touch_updated_at
  before update on public.cases
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- 3. 관리자 판별 함수
--
--  security definer 로 선언해 admins 표의 RLS를 우회합니다.
--  (그렇지 않으면 정책이 자기 자신을 참조하는 순환이 생깁니다)
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------------------
-- 4. RLS — 기본 거부 후 관리자만 허용
-- ---------------------------------------------------------------------

alter table public.admins enable row level security;
alter table public.cases  enable row level security;
alter table public.photos enable row level security;

-- admins 표에는 정책을 만들지 않습니다.
-- → API를 통한 조회·수정이 전부 차단됩니다 (관리자 명단 노출 방지).
--   판별은 위의 security definer 함수가 대신합니다.

-- cases : 관리자만 전권
drop policy if exists cases_admin_all on public.cases;
create policy cases_admin_all
  on public.cases
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- photos : 관리자만 전권
drop policy if exists photos_admin_all on public.photos;
create policy photos_admin_all
  on public.photos
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 공개(anon) 읽기 정책은 의도적으로 만들지 않습니다.
-- 공개 사이트는 GitHub의 마크다운을 읽으므로 DB를 열 필요가 없습니다.


-- ---------------------------------------------------------------------
-- 5. Storage 버킷 + 정책
--
--  비공개 버킷입니다. 공개 사이트가 이 버킷을 쓰지 않으므로
--  방문자 트래픽이 Supabase 전송량을 소모하지 않습니다.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('case-photos', 'case-photos', false)
on conflict (id) do nothing;

drop policy if exists case_photos_admin_select on storage.objects;
create policy case_photos_admin_select
  on storage.objects for select to authenticated
  using (bucket_id = 'case-photos' and public.is_admin());

drop policy if exists case_photos_admin_insert on storage.objects;
create policy case_photos_admin_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'case-photos' and public.is_admin());

drop policy if exists case_photos_admin_update on storage.objects;
create policy case_photos_admin_update
  on storage.objects for update to authenticated
  using (bucket_id = 'case-photos' and public.is_admin())
  with check (bucket_id = 'case-photos' and public.is_admin());

drop policy if exists case_photos_admin_delete on storage.objects;
create policy case_photos_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'case-photos' and public.is_admin());
