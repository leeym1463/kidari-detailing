// 본문 블록 → 게시용 마크다운.
//
// ⚠ 이 파일은 src/lib/blocks-render.ts 의 마크다운 생성 부분과 **같은 결과**를 내야 합니다.
//   · 브라우저(미리보기)는 src/lib/blocks-render.ts 를 씁니다
//   · Edge Function(게시)은 Deno 라 그 파일을 불러올 수 없어 여기에 같은 규칙을 둡니다
//   둘이 어긋나면 "미리보기와 실제 글이 다른" 문제가 생기므로,
//   scripts/check-render-parity.mjs 가 두 구현의 출력이 같은지 검사합니다.
//   한쪽을 고치면 반드시 다른 쪽도 고치세요.

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'imageGroup'
  | 'beforeAfter'
  | 'divider';

export interface Block {
  type: BlockType;
  text?: string;
  align?: 'left' | 'center';
  path?: string;
  alt?: string;
  caption?: string;
  items?: { path: string; alt?: string }[];
  before?: string;
  after?: string;
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 시공 전후 비교 슬라이더 마크업.
 * 공개 사이트의 BeforeAfterSlider.astro 와 같은 구조여야 합니다.
 */
export function sliderHtml(beforeSrc: string, afterSrc: string, caption?: string): string {
  const cap = caption?.trim()
    ? `\n  <figcaption>${escapeHtml(caption.trim())}</figcaption>`
    : '';
  return `<figure class="ba-slider">
  <div class="ba-frame">
    <img class="ba-img ba-after" src="${escapeHtml(afterSrc)}" alt="시공 후" loading="lazy" />
    <div class="ba-before-wrap">
      <img class="ba-img ba-before" src="${escapeHtml(beforeSrc)}" alt="시공 전" loading="lazy" />
    </div>
    <span class="ba-tag ba-tag-before">BEFORE</span>
    <span class="ba-tag ba-tag-after">AFTER</span>
    <div class="ba-handle" aria-hidden="true"><span class="ba-handle-grip">↔</span></div>
    <input class="ba-range" type="range" min="0" max="100" value="50" aria-label="시공 전/후 비교 슬라이더" />
  </div>${cap}
</figure>`;
}

export type ResolveName = (storagePath: string) => string | undefined;

/** 본문 블록을 기존 38건과 같은 형식의 마크다운으로 바꿉니다. */
export function blocksToMarkdown(blocks: Block[], slug: string, resolveName: ResolveName): string {
  const out: string[] = [];
  const src = (path: string) => `/images/cases/${slug}/${resolveName(path) ?? path}`;

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        if (block.text?.trim()) out.push(`### ${block.text.trim()}`);
        break;
      case 'paragraph':
        if (block.text?.trim()) out.push(block.text.trim());
        break;
      case 'image':
        if (block.path) out.push(`![${block.alt ?? block.caption ?? ''}](${src(block.path)})`);
        break;
      case 'imageGroup':
        for (const i of block.items ?? []) {
          if (i.path) out.push(`![${i.alt ?? ''}](${src(i.path)})`);
        }
        break;
      case 'beforeAfter':
        // 관리자가 넣은 그 자리에 슬라이더가 그대로 들어갑니다(위로 끌어올리지 않습니다).
        // 마크다운 안의 HTML 은 앞뒤로 빈 줄이 있어야 그대로 출력됩니다.
        if (block.before && block.after) {
          out.push(sliderHtml(src(block.before), src(block.after), block.caption));
        }
        break;
      case 'divider':
        out.push('---');
        break;
    }
  }

  return out.join('\n\n');
}

// ---------------------------------------------------------------------
// frontmatter
// ---------------------------------------------------------------------

export interface CaseRecord {
  slug: string;
  title: string;
  category: string;
  case_date: string;
  vehicle: string | null;
  summary: string | null;
  before_condition: string | null;
  work_performed: string[] | null;
  duration: string | null;
  price_note: string | null;
  content_blocks: Block[] | null;
}

function yaml(value: string): string {
  // 큰따옴표로 감싸므로 역슬래시와 큰따옴표만 막으면 됩니다.
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** 기존 38건과 같은 순서·형식의 frontmatter 를 만듭니다. */
export function buildFrontmatter(c: CaseRecord): string {
  const lines = [
    '---',
    `title: "${yaml(c.title)}"`,
    `category: "${c.category}"`,
    `date: ${c.case_date}`,
  ];

  if (c.vehicle?.trim()) lines.push(`vehicle: "${yaml(c.vehicle.trim())}"`);
  if (c.summary?.trim()) lines.push(`summary: "${yaml(c.summary.trim())}"`);
  if (c.before_condition?.trim()) {
    lines.push(`beforeCondition: "${yaml(c.before_condition.trim())}"`);
  }

  const work = (c.work_performed ?? []).filter((w) => w?.trim());
  if (work.length > 0) {
    lines.push('workPerformed:');
    for (const w of work) lines.push(`  - "${yaml(w.trim())}"`);
  }

  if (c.duration?.trim()) lines.push(`duration: "${yaml(c.duration.trim())}"`);
  if (c.price_note?.trim()) lines.push(`priceNote: "${yaml(c.price_note.trim())}"`);

  lines.push('draft: false', '---');
  return lines.join('\n');
}

/** 저장소에 들어갈 파일 전체 내용. */
export function buildMarkdownFile(c: CaseRecord, resolveName: ResolveName): string {
  const body = blocksToMarkdown(c.content_blocks ?? [], c.slug, resolveName);
  return `${buildFrontmatter(c)}\n\n${body}\n`;
}
