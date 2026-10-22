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
        // 게시될 마크다운도 사진 두 장이므로 미리보기도 같은 형태로 보여줍니다.
        parts.push(`<div class="cms-ba">
  <figure><figcaption>시공 전</figcaption>${imgTag(block.before, resolve, '시공 전')}</figure>
  <figure><figcaption>시공 후</figcaption>${imgTag(block.after, resolve, '시공 후')}</figure>
</div>${block.caption ? `<p class="cms-ba-caption">${escapeHtml(block.caption)}</p>` : ''}`);
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
        if (block.before) out.push(`![${block.caption ?? '시공 전'}](${src(block.before)})`);
        if (block.after) out.push(`![${block.caption ?? '시공 후'}](${src(block.after)})`);
        break;
      case 'divider':
        out.push('---');
        break;
    }
  }

  return out.join('\n\n');
}
