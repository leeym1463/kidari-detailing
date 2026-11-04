// 본문 블록을 보여줄 형태로 바꿉니다.
//
// 두 곳에서 같은 규칙을 씁니다.
//   · 미리보기 화면  → blocksToHtml()  (공개 페이지와 같은 .prose 마크업·클래스)
//   · 게시(Phase 2)  → blocksToMarkdown() (기존 38건과 같은 마크다운 형식)
//
// 한 파일에 모아 두어 "미리보기에서 보이던 것과 실제 게시물이 다른" 일이 생기지 않게 합니다.

import type { Block } from './cms-types';
import { escapeHtml } from './admin-ui';

/** 본문 텍스트에서 허용하는 꾸밈: **굵게** 와 [글자](주소) 뿐입니다. */
export function inlineToHtml(raw: string): string {
  // 1) 먼저 전부 이스케이프해서 사용자가 넣은 태그가 살아나지 않게 합니다.
  let out = escapeHtml(raw ?? '');

  // 2) 링크 — http/https 만 허용합니다.
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text: string, url: string) => {
    return `<a href="${url}" rel="noopener nofollow" target="_blank">${text}</a>`;
  });

  // 3) 굵게
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // 4) 줄바꿈
  return out.replace(/\n/g, '<br />');
}

export type ResolveUrl = (storagePath: string) => string | undefined;

/**
 * 시공 전후 비교 슬라이더 마크업.
 *
 * 공개 사이트의 BeforeAfterSlider.astro 와 같은 구조여야 합니다.
 * 스타일은 src/styles/before-after.css, 동작은 src/scripts/before-after.ts 가 맡습니다.
 *
 * 자바스크립트가 돌지 않아도 시공 전/후 사진이 둘 다 화면에 남습니다
 * (슬라이더가 안 켜지면 before 쪽이 절반 너비로 겹쳐 보일 뿐 사진은 사라지지 않습니다).
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

function imgTag(path: string, resolve: ResolveUrl, alt = ''): string {
  const url = resolve(path);
  if (!url) {
    return `<span class="cms-missing-photo">사진을 불러오지 못했습니다</span>`;
  }
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`;
}

/** 공개 페이지의 .prose 안에 그대로 넣을 수 있는 HTML 을 만듭니다. */
export function blocksToHtml(blocks: Block[], resolve: ResolveUrl): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return '<p class="cms-empty-note">아직 본문 내용이 없습니다.</p>';
  }

  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        if (block.text?.trim()) parts.push(`<h3>${escapeHtml(block.text)}</h3>`);
        break;

      case 'paragraph': {
        if (!block.text?.trim()) break;
        const style = block.align === 'center' ? ' style="text-align:center;"' : '';
        parts.push(`<p${style}>${inlineToHtml(block.text)}</p>`);
        break;
      }

      case 'image': {
        if (!block.path) break;
        const img = imgTag(block.path, resolve, block.alt ?? block.caption ?? '');
        parts.push(
          block.caption
            ? `<figure>${img}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`
            : `<p>${img}</p>`
        );
        break;
      }

      case 'imageGroup': {
        const items = (block.items ?? []).filter((i) => i.path);
        if (items.length === 0) break;
        parts.push(
          items.map((i) => `<p>${imgTag(i.path, resolve, i.alt ?? '')}</p>`).join('\n')
        );
        break;
      }

      case 'beforeAfter': {
        if (!block.before || !block.after) break;
        // 실제 게시물과 똑같은 슬라이더 마크업을 씁니다.
        const beforeUrl = resolve(block.before);
        const afterUrl = resolve(block.after);
        parts.push(
          beforeUrl && afterUrl
            ? sliderHtml(beforeUrl, afterUrl, block.caption)
            : '<span class="cms-missing-photo">시공 전후 사진을 불러오지 못했습니다</span>'
        );
        break;
      }

      case 'divider':
        parts.push('<hr />');
        break;
    }
  }

  return parts.join('\n') || '<p class="cms-empty-note">아직 본문 내용이 없습니다.</p>';
}

/**
 * 게시용 마크다운. Phase 2 의 publish-case 가 쓸 형식이며,
 * 기존 38건과 같은 모양이 되도록 맞춥니다.
 *
 * @param resolveName storage_path → 저장소에 들어갈 파일 이름(img-01.jpg 등)
 */
export function blocksToMarkdown(blocks: Block[], slug: string, resolveName: ResolveUrl): string {
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
