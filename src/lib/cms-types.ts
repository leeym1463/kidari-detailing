// 관리자 CMS 가 다루는 데이터 모양.
// Supabase 의 cases / photos 표(0001_init.sql, 0005_naver_blog_url.sql)와 1:1로 맞춥니다.

/** 시공사례 카테고리. 공개 사이트(src/data/categories.ts)와 같은 값이어야 합니다. */
export const CASE_CATEGORIES = [
  '광택·유리막코팅',
  '외형복원·판금도색',
  '스팀세차',
  '에바크리닝',
  '실내크리닝',
] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export type CaseStatus = 'draft' | 'published';
export type PhotoStatus = 'temp' | 'published';

export interface CaseRow {
  id: string;
  slug: string;
  title: string;
  category: CaseCategory;
  case_date: string; // YYYY-MM-DD
  vehicle: string | null;
  vehicle_color: string | null;
  summary: string | null;
  before_condition: string | null;
  work_performed: string[];
  duration: string | null;
  price_note: string | null;
  naver_blog_url: string | null;
  content_blocks: Block[];
  cover_image: string | null;
  status: CaseStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoRow {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  case_id: string | null;
  status: PhotoStatus;
  created_at: string;
}

// ---------------------------------------------------------------------
// 본문 블록
//
// Phase 0.5 에서 정한 6종을 그대로 유지합니다.
// 사진은 Storage 경로(storage_path)로 참조합니다. 게시 시점에
// publish-case 함수가 이 경로를 저장소의 img-NN.<확장자> 로 바꿔 넣습니다.
// ---------------------------------------------------------------------

export type BlockType = 'paragraph' | 'heading' | 'image' | 'imageGroup' | 'beforeAfter' | 'divider';

export type TextAlign = 'left' | 'center';

export interface ParagraphBlock {
  type: 'paragraph';
  /** 굵게는 **…**, 링크는 [글자](주소) 로 저장합니다 (마크다운과 동일). */
  text: string;
  align?: TextAlign;
}

export interface HeadingBlock {
  type: 'heading';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  path: string; // storage_path
  alt?: string;
  caption?: string;
}

export interface ImageGroupBlock {
  type: 'imageGroup';
  items: { path: string; alt?: string }[];
}

export interface BeforeAfterBlock {
  type: 'beforeAfter';
  before: string; // storage_path
  after: string; // storage_path
  caption?: string;
}

export interface DividerBlock {
  type: 'divider';
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ImageBlock
  | ImageGroupBlock
  | BeforeAfterBlock
  | DividerBlock;

/** 블록 종류별 한글 이름. 화면 표시와 aria-label 에 함께 씁니다. */
export const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: '본문 텍스트',
  heading: '소제목',
  image: '사진 1장',
  imageGroup: '여러 사진',
  beforeAfter: 'Before / After',
  divider: '구분선',
};

/** 블록 하나가 참조하는 사진 경로를 모두 돌려줍니다. */
export function blockPhotoPaths(block: Block): string[] {
  switch (block.type) {
    case 'image':
      return block.path ? [block.path] : [];
    case 'imageGroup':
      return block.items.map((i) => i.path).filter(Boolean);
    case 'beforeAfter':
      return [block.before, block.after].filter(Boolean);
    default:
      return [];
  }
}

/** 본문 전체에서 쓰인 사진 경로(중복 제거). */
export function usedPhotoPaths(blocks: Block[]): string[] {
  const set = new Set<string>();
  for (const b of blocks) for (const p of blockPhotoPaths(b)) set.add(p);
  return [...set];
}

/** 대표사진 자동 선택 — 본문의 첫 번째 사진을 씁니다. */
export function firstPhotoPath(blocks: Block[]): string | null {
  for (const b of blocks) {
    const paths = blockPhotoPaths(b);
    if (paths.length > 0) return paths[0];
  }
  return null;
}

// ---------------------------------------------------------------------
// 본문에서 값 뽑아내기 — 게시 전 검사와 Phase 2B 게시에서 함께 씁니다.
// ---------------------------------------------------------------------

/** 꾸밈 기호(**굵게**, [글자](주소))를 걷어낸 맨 글자. */
export function plainText(markdownish: string): string {
  return String(markdownish ?? '')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .trim();
}

/** 본문 텍스트를 모두 이어붙인 글자 수. "너무 짧은 글" 판정에 씁니다. */
export function bodyTextLength(blocks: Block[]): number {
  return blocks
    .filter((b): b is ParagraphBlock | HeadingBlock => b.type === 'paragraph' || b.type === 'heading')
    .map((b) => plainText(b.text))
    .join('')
    .replace(/\s+/g, '').length;
}

/** 요약 초안으로 쓸 첫 번째 본문 문단. 없으면 빈 문자열. */
export function firstParagraphText(blocks: Block[]): string {
  for (const b of blocks) {
    if (b.type !== 'paragraph') continue;
    const text = plainText(b.text);
    if (text) return text;
  }
  return '';
}

/** 요약 초안 — 첫 문단을 한두 문장으로 줄입니다. */
export function suggestSummary(blocks: Block[], limit = 120): string {
  const text = firstParagraphText(blocks).replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.length <= limit) return text;
  // 문장 끝에서 자르면 자연스럽습니다.
  const cut = text.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다. '), cut.lastIndexOf('요. '));
  return (stop > limit * 0.5 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…').trim();
}

/** 내용이 비어 있는 블록. 게시 전 검사에서 걸러냅니다. */
export function emptyBlocks(blocks: Block[]): { index: number; type: BlockType }[] {
  const out: { index: number; type: BlockType }[] = [];
  blocks.forEach((b, index) => {
    const empty =
      (b.type === 'paragraph' && !plainText(b.text)) ||
      (b.type === 'heading' && !plainText(b.text)) ||
      (b.type === 'image' && !b.path) ||
      (b.type === 'imageGroup' && (b.items ?? []).filter((i) => i.path).length === 0);
    if (empty) out.push({ index, type: b.type });
  });
  return out;
}

/** Before / After 가 한쪽만 채워진 블록. */
export function incompleteBeforeAfter(blocks: Block[]): number[] {
  const out: number[] = [];
  blocks.forEach((b, index) => {
    if (b.type !== 'beforeAfter') return;
    if (!b.before || !b.after) out.push(index);
  });
  return out;
}

/** 설명(alt)이 비어 있는 사진 수. 검색·접근성에 쓰입니다. */
export function photosMissingAlt(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type === 'image' && b.path && !(b.alt ?? b.caption ?? '').trim()) n += 1;
    if (b.type === 'imageGroup') {
      for (const item of b.items ?? []) {
        if (item.path && !(item.alt ?? '').trim()) n += 1;
      }
    }
  }
  return n;
}

/**
 * Before / After 블록을 공개 페이지 frontmatter 형식으로 뽑습니다.
 * 공개 사이트의 드래그 비교 슬라이더(BeforeAfterSlider)가 이 구조를 씁니다.
 * Phase 2B 게시에서 사진 경로를 저장소 파일명으로 바꿔 넣게 됩니다.
 */
export function extractBeforeAfterPairs(
  blocks: Block[]
): { before: string; after: string; caption?: string }[] {
  return blocks
    .filter((b): b is BeforeAfterBlock => b.type === 'beforeAfter' && Boolean(b.before && b.after))
    .map((b) => ({
      before: b.before,
      after: b.after,
      ...(b.caption?.trim() ? { caption: b.caption.trim() } : {}),
    }));
}
