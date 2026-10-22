-- =====================================================================
-- iOS Safari 테스트 결과 확인 (SELECT 전용 — 아무것도 변경하지 않습니다)
--
-- 아이폰에서 올린 사진이 실제로 어떤 형식·크기로 저장됐는지 확인합니다.
--   · 확장자 .webp  → iOS Safari가 WebP 인코딩을 지원함
--   · 확장자 .jpg   → 지원하지 않아 JPEG fallback이 동작함 (설계대로)
-- 둘 중 무엇이든 "정상"이며, 어느 쪽인지 알아야 Phase 1 설계가 확정됩니다.
-- =====================================================================

select
  storage_path                                      as 저장경로,
  case
    when storage_path ilike '%.webp' then 'WebP'
    when storage_path ilike '%.jpg'  then 'JPEG (fallback)'
    else '기타'
  end                                               as 형식,
  width || ' × ' || height                          as 크기,
  greatest(width, height)                           as 긴변,
  greatest(width, height) <= 1600                   as "긴변_1600이하",
  round(bytes / 1024.0)                             as "용량_KB",
  status                                            as 상태,
  case_id                                           as 연결된글,
  created_at                                        as 올린시각
from public.photos
order by created_at desc
limit 20;
