// 공개 주소(slug)를 만듭니다.
//
// 규칙: 차량명 + 핵심 작업 + 작업일
//   BMW 740i  / 광택·유리막코팅 / 2026-11-04  →  bmw-740i-coating-2026-11-04
//   그랜저 IG / 스팀세차        / 2026-11-04  →  geuraenjeo-ig-steam-wash-2026-11-04
//
// 한글 차량명은 로마자로 바꿔 적습니다. 주소에 한글을 그대로 넣으면
// 브라우저가 %EC%9E%90... 처럼 바꿔 보여주어 알아보기 어렵습니다.

import type { CaseCategory } from './cms-types';

// 한글 음절 → 로마자. 국립국어원 표기법을 단순화해 음절 단위로만 옮깁니다
// (주소용이라 자음동화 같은 세부 규칙까지는 따지지 않습니다).
const CHO = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's',
  'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];
const JUNG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa',
  'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
];
const JONG = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k',
  'm', 'p', 'l', 't', 'p', 'l', 'm', 'p', 'p', 't',
  't', 'ng', 't', 't', 'k', 't', 'p', 't',
];

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 한글이 섞인 문자열을 로마자로 바꿉니다. 한글이 아닌 글자는 그대로 둡니다. */
export function romanizeKorean(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code < HANGUL_START || code > HANGUL_END) {
      out += ch;
      continue;
    }
    const index = code - HANGUL_START;
    out += CHO[Math.floor(index / 588)];
    out += JUNG[Math.floor((index % 588) / 28)];
    out += JONG[index % 28];
  }
  return out;
}

/** 주소에 쓸 수 있는 형태로 다듬습니다. */
export function slugify(input: string): string {
  return romanizeKorean(String(input ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 카테고리를 주소에 쓸 짧은 말로. 기존 38건의 접두어와 같은 표기입니다. */
export const CATEGORY_SLUG: Record<CaseCategory, string> = {
  '광택·유리막코팅': 'coating',
  '외형복원·판금도색': 'restoration',
  '스팀세차': 'steam-wash',
  '에바크리닝': 'eva-cleaning',
  '실내크리닝': 'interior-cleaning',
};

const MAX_LENGTH = 80;

export interface SlugInput {
  vehicle?: string | null;
  category: CaseCategory;
  caseDate: string; // YYYY-MM-DD
}

/**
 * 차량명 + 핵심 작업 + 작업일로 주소를 만듭니다.
 * 차량명이 비었거나 로마자로 옮길 글자가 없으면 그 부분만 빠집니다.
 */
export function buildSlug({ vehicle, category, caseDate }: SlugInput): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(caseDate) ? caseDate : '';
  const parts = [slugify(vehicle ?? ''), CATEGORY_SLUG[category] ?? 'case', date].filter(Boolean);
  const slug = parts.join('-').slice(0, MAX_LENGTH).replace(/-+$/, '');
  return slug || `case-${Date.now().toString(36)}`;
}

/** 같은 주소가 이미 있으면 뒤에 -2, -3 을 붙입니다. */
export function makeUnique(slug: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(slug)) return slug;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${slug}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

/** 사장님이 직접 고친 주소가 쓸 수 있는 형태인지 검사합니다. */
export function validateSlug(slug: string): { ok: boolean; reason?: string } {
  const value = String(slug ?? '').trim();
  if (!value) return { ok: false, reason: '주소를 입력해주세요.' };
  if (value.length < 4) return { ok: false, reason: '주소가 너무 짧습니다. 4글자 이상으로 해주세요.' };
  if (value.length > MAX_LENGTH) return { ok: false, reason: `주소는 ${MAX_LENGTH}글자를 넘을 수 없습니다.` };
  if (!/^[a-z0-9-]+$/.test(value)) {
    return { ok: false, reason: '영문 소문자·숫자·붙임표(-)만 쓸 수 있습니다.' };
  }
  if (/^-|-$/.test(value)) return { ok: false, reason: '주소는 붙임표(-)로 시작하거나 끝날 수 없습니다.' };
  return { ok: true };
}
