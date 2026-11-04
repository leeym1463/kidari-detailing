// 게시 전 점검.
//
// Phase 2A 에서는 "검사하고 보여주기"까지만 합니다. 실제 게시(GitHub 반영)는
// Phase 2B 입니다. 그래서 이 파일은 판정만 하고 아무것도 바꾸지 않습니다.
//
// 등급
//   error : 이게 있으면 게시할 수 없습니다
//   warn  : 게시는 되지만 확인하시는 게 좋습니다

import type { Block, CaseRow } from './cms-types';
import {
  bodyTextLength,
  emptyBlocks,
  firstPhotoPath,
  incompleteBeforeAfter,
  photosMissingAlt,
  plainText,
} from './cms-types';
import { validateSlug } from './slug';

export type CheckLevel = 'error' | 'warn';

export interface CheckResult {
  id: string;
  /** 화면에 보이는 항목 이름 */
  label: string;
  ok: boolean;
  level: CheckLevel;
  /** 통과하지 못했을 때 보여줄 안내 */
  hint?: string;
}

export interface CheckInput {
  row: Pick<CaseRow, 'title' | 'summary' | 'vehicle' | 'slug' | 'naver_blog_url' | 'status'>;
  blocks: Block[];
  /** 이미 쓰이고 있는 주소(기존 38건 + CMS 글). 자기 자신은 빼고 넘겨주세요. */
  takenSlugs: Set<string>;
  /** 이미 쓰이고 있는 제목. 자기 자신은 빼고 넘겨주세요. */
  takenTitles: Set<string>;
}

/** 본문이 이 길이보다 짧으면 안내합니다(공백 제외 글자 수). */
export const MIN_BODY_LENGTH = 150;

export function runPublishChecks({
  row,
  blocks,
  takenSlugs,
  takenTitles,
}: CheckInput): CheckResult[] {
  const checks: CheckResult[] = [];
  const add = (id: string, label: string, ok: boolean, level: CheckLevel, hint?: string) =>
    checks.push({ id, label, ok, level, hint });

  // --- 꼭 있어야 하는 것 ---------------------------------------------
  const title = (row.title ?? '').trim();
  add('title', '제목', Boolean(title), 'error', '제목을 입력해주세요.');

  const summary = (row.summary ?? '').trim();
  add(
    'summary',
    '요약',
    Boolean(summary),
    'error',
    '목록과 검색결과에 보이는 문장입니다. 아래에서 채워주세요.'
  );

  add('vehicle', '차량명', Boolean((row.vehicle ?? '').trim()), 'error', '차량명을 입력해주세요.');

  const cover = firstPhotoPath(blocks);
  add(
    'cover',
    '대표 사진',
    Boolean(cover),
    'error',
    '본문에 사진이 한 장도 없습니다. 목록에 보일 대표 사진이 필요합니다.'
  );

  // --- 주소 ----------------------------------------------------------
  const slug = (row.slug ?? '').trim();
  const slugCheck = validateSlug(slug);
  add('slug-format', '주소 형식', slugCheck.ok, 'error', slugCheck.reason);
  add(
    'slug-unique',
    '주소 중복',
    !takenSlugs.has(slug),
    'error',
    '같은 주소를 쓰는 글이 이미 있습니다. 주소를 바꿔주세요.'
  );

  add(
    'title-unique',
    '제목 중복',
    !takenTitles.has(title),
    'warn',
    '같은 제목의 글이 이미 있습니다. 그대로 올려도 되지만 구분이 어려울 수 있습니다.'
  );

  // --- 본문 ----------------------------------------------------------
  const empties = emptyBlocks(blocks);
  add(
    'empty-blocks',
    '빈 블록',
    empties.length === 0,
    'error',
    empties.length > 0 ? `내용이 비어 있는 블록이 ${empties.length}개 있습니다. 채우거나 지워주세요.` : undefined
  );

  const incomplete = incompleteBeforeAfter(blocks);
  add(
    'before-after',
    'Before / After',
    incomplete.length === 0,
    'error',
    incomplete.length > 0
      ? `Before 또는 After 사진이 빠진 블록이 ${incomplete.length}개 있습니다. 둘 다 골라주세요.`
      : undefined
  );

  const length = bodyTextLength(blocks);
  add(
    'body-length',
    '본문 분량',
    length >= MIN_BODY_LENGTH,
    'warn',
    length < MIN_BODY_LENGTH
      ? `본문이 ${length}자입니다. ${MIN_BODY_LENGTH}자 이상이면 검색에 더 잘 걸립니다.`
      : undefined
  );

  // --- 있으면 좋은 것 -------------------------------------------------
  const missingAlt = photosMissingAlt(blocks);
  add(
    'photo-alt',
    '사진 설명',
    missingAlt === 0,
    'warn',
    missingAlt > 0 ? `설명이 없는 사진이 ${missingAlt}장 있습니다. 검색에 도움이 됩니다.` : undefined
  );

  const blogUrl = (row.naver_blog_url ?? '').trim();
  add(
    'blog-url',
    '블로그 원본 주소',
    Boolean(blogUrl),
    'warn',
    '블로그에서 옮겨 적은 글이라면 원본 주소를 남겨두면 나중에 찾기 쉽습니다.'
  );

  return checks;
}

/** 하나라도 error 가 남아 있으면 게시할 수 없습니다. */
export function hasBlockingError(checks: CheckResult[]): boolean {
  return checks.some((c) => c.level === 'error' && !c.ok);
}

export function countByLevel(checks: CheckResult[]): { errors: number; warnings: number } {
  return {
    errors: checks.filter((c) => c.level === 'error' && !c.ok).length,
    warnings: checks.filter((c) => c.level === 'warn' && !c.ok).length,
  };
}

export { plainText };
