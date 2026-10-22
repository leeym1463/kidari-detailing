// 네이버 블로그 글쓰기와 비슷한 블록 편집기.
//
// 설계 원칙
//   · 라이브러리를 쓰지 않습니다. 모든 블록은 진짜 <textarea> / <input> / <button> 입니다
//     → 웨일 Aside 같은 브라우저 AI 가 그대로 읽고 입력할 수 있습니다
//   · contenteditable / canvas / iframe 을 쓰지 않습니다
//   · 아이콘만 있는 버튼을 만들지 않습니다. 모든 버튼에 한글 이름과 aria-label 이 있습니다

import type { Block, BlockType, ImageGroupBlock, TextAlign } from './cms-types';
import { BLOCK_LABELS } from './cms-types';
import { escapeHtml } from './admin-ui';

export interface EditorHooks {
  /** storage_path → 썸네일 주소. 아직 못 받았으면 undefined. */
  thumbUrl(path: string): string | undefined;
  /** 사진함을 열어 사진을 고르게 합니다. 취소하면 빈 배열. */
  pickPhotos(opts: { multiple: boolean; title: string }): Promise<string[]>;
  /** 내용이 바뀔 때마다 호출됩니다(자동저장 신호). */
  onChange(): void;
}

/** 추가 버튼에 띄울 블록 종류와 순서. */
const ADDABLE: BlockType[] = ['paragraph', 'heading', 'image', 'imageGroup', 'beforeAfter', 'divider'];

export class BlockEditor {
  private root: HTMLElement;
  private hooks: EditorHooks;
  private blocks: Block[] = [];

  constructor(root: HTMLElement, hooks: EditorHooks) {
    this.root = root;
    this.hooks = hooks;
    this.root.addEventListener('click', (e) => void this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
  }

  setBlocks(blocks: Block[]): void {
    this.blocks = Array.isArray(blocks) ? structuredClone(blocks) : [];
    this.render();
  }

  getBlocks(): Block[] {
    return structuredClone(this.blocks);
  }

  /** 서명 주소를 새로 받아온 뒤 썸네일만 다시 그립니다. */
  refreshThumbs(): void {
    for (const img of this.root.querySelectorAll<HTMLElement>('[data-thumb-for]')) {
      const path = img.dataset.thumbFor!;
      const url = this.hooks.thumbUrl(path);
      img.innerHTML = url
        ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />`
        : '사진 없음';
    }
  }

  // -----------------------------------------------------------------
  // 그리기
  // -----------------------------------------------------------------

  private render(): void {
    const body = this.blocks.map((b, i) => this.renderBlock(b, i)).join('');
    this.root.innerHTML = `
      <div class="ad-blocks">${body || this.renderEmpty()}</div>
      <div class="ad-add-row" role="group" aria-label="본문에 블록 추가">
        ${ADDABLE.map(
          (t) =>
            `<button type="button" data-add="${t}" aria-label="${BLOCK_LABELS[t]} 추가">+ ${BLOCK_LABELS[t]}</button>`
        ).join('')}
      </div>`;
  }

  private renderEmpty(): string {
    return `<p class="ad-empty" style="padding:22px 10px;">
      아직 내용이 없습니다. 아래 버튼으로 본문 텍스트나 사진을 추가해보세요.
    </p>`;
  }

  private frame(path: string | undefined, label: string): string {
    const url = path ? this.hooks.thumbUrl(path) : undefined;
    const inner = url
      ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />`
      : path
        ? '사진 없음'
        : '비어 있음';
    return `<span class="frame" data-thumb-for="${escapeHtml(path ?? '')}" aria-label="${label}">${inner}</span>`;
  }

  private renderBlock(block: Block, index: number): string {
    const last = index === this.blocks.length - 1;
    const kind = BLOCK_LABELS[block.type];

    const tools = `
      <span class="ad-block-tools">
        <button type="button" data-act="up" data-i="${index}" aria-label="${kind} 위로 이동" ${index === 0 ? 'disabled' : ''}>↑ 위로</button>
        <button type="button" data-act="down" data-i="${index}" aria-label="${kind} 아래로 이동" ${last ? 'disabled' : ''}>↓ 아래로</button>
        <button type="button" class="danger" data-act="remove" data-i="${index}" aria-label="${kind} 삭제">삭제</button>
      </span>`;

    const head = `<div class="ad-block-head"><span class="ad-block-kind">${kind}</span>${tools}</div>`;

    let body = '';

    switch (block.type) {
      case 'paragraph': {
        const align: TextAlign = block.align ?? 'left';
        body = `
          <div class="ad-text-tools" role="group" aria-label="글자 꾸미기">
            <button type="button" data-act="bold" data-i="${index}" aria-label="선택한 글자 굵게"><b>굵게</b></button>
            <button type="button" data-act="link" data-i="${index}" aria-label="선택한 글자에 링크 넣기">링크</button>
            <button type="button" data-act="align" data-align="left" data-i="${index}" aria-pressed="${align === 'left'}" aria-label="왼쪽 정렬">왼쪽</button>
            <button type="button" data-act="align" data-align="center" data-i="${index}" aria-pressed="${align === 'center'}" aria-label="가운데 정렬">가운데</button>
          </div>
          <label class="ad-label" for="blk-${index}">본문 텍스트</label>
          <textarea id="blk-${index}" data-field="text" data-i="${index}" aria-label="본문 텍스트"
            placeholder="시공 내용을 적어주세요.">${escapeHtml(block.text ?? '')}</textarea>`;
        break;
      }

      case 'heading':
        body = `
          <label class="ad-label" for="blk-${index}">소제목</label>
          <input id="blk-${index}" type="text" data-field="text" data-i="${index}"
            aria-label="소제목" placeholder="예) 시공 전 상태"
            value="${escapeHtml(block.text ?? '')}" />`;
        break;

      case 'image':
        body = `
          <div class="ad-slot-row">
            <div class="ad-slot">
              <span class="slot-name">사진</span>
              ${this.frame(block.path, '선택한 사진')}
              <button type="button" class="ad-btn ad-btn-sm" data-act="pick-one" data-i="${index}" aria-label="사진 추가">
                ${block.path ? '사진 바꾸기' : '사진 고르기'}
              </button>
            </div>
          </div>
          <label class="ad-label" for="cap-${index}" style="margin-top:10px;">사진 설명 (선택)</label>
          <input id="cap-${index}" type="text" data-field="caption" data-i="${index}"
            aria-label="사진 설명" placeholder="예) 보닛 스월마크"
            value="${escapeHtml(block.caption ?? '')}" />`;
        break;

      case 'imageGroup': {
        const items = block.items ?? [];
        const slots =
          items.length > 0
            ? items
                .map(
                  (it, n) => `<div class="ad-slot">
                    <span class="slot-name">${n + 1}번째</span>
                    ${this.frame(it.path, `${n + 1}번째 사진`)}
                    <button type="button" class="ad-btn ad-btn-sm ad-btn-danger" data-act="group-remove" data-i="${index}" data-n="${n}" aria-label="${n + 1}번째 사진 빼기">빼기</button>
                  </div>`
                )
                .join('')
            : '<div class="ad-slot"><span class="slot-name">사진 없음</span>' +
              this.frame(undefined, '비어 있음') +
              '</div>';
        body = `
          <div class="ad-slot-row">${slots}</div>
          <div class="ad-btn-row" style="margin-top:10px;">
            <button type="button" class="ad-btn ad-btn-sm" data-act="pick-many" data-i="${index}" aria-label="사진 추가">사진 더 고르기</button>
          </div>`;
        break;
      }

      case 'beforeAfter':
        body = `
          <div class="ad-slot-row">
            <div class="ad-slot">
              <span class="slot-name">Before 사진</span>
              ${this.frame(block.before, 'Before 사진')}
              <button type="button" class="ad-btn ad-btn-sm" data-act="pick-before" data-i="${index}" aria-label="Before 사진 고르기">
                ${block.before ? '바꾸기' : '고르기'}
              </button>
            </div>
            <div class="ad-slot">
              <span class="slot-name">After 사진</span>
              ${this.frame(block.after, 'After 사진')}
              <button type="button" class="ad-btn ad-btn-sm" data-act="pick-after" data-i="${index}" aria-label="After 사진 고르기">
                ${block.after ? '바꾸기' : '고르기'}
              </button>
            </div>
          </div>
          <label class="ad-label" for="cap-${index}" style="margin-top:10px;">비교 설명 (선택)</label>
          <input id="cap-${index}" type="text" data-field="caption" data-i="${index}"
            aria-label="Before After 설명" placeholder="예) 운전석 도어"
            value="${escapeHtml(block.caption ?? '')}" />`;
        break;

      case 'divider':
        body = '<div class="ad-block-divider" role="presentation"></div>';
        break;
    }

    return `<section class="ad-block" data-i="${index}" aria-label="${kind} 블록">${head}${body}</section>`;
  }

  // -----------------------------------------------------------------
  // 입력 반영
  // -----------------------------------------------------------------

  private onInput(event: Event): void {
    const node = event.target as HTMLInputElement | HTMLTextAreaElement;
    const field = node.dataset?.field;
    if (!field) return;
    const index = Number(node.dataset.i);
    const block = this.blocks[index];
    if (!block) return;

    if (field === 'text' && (block.type === 'paragraph' || block.type === 'heading')) {
      block.text = node.value;
    } else if (field === 'caption' && (block.type === 'image' || block.type === 'beforeAfter')) {
      block.caption = node.value;
    }
    this.hooks.onChange();
  }

  // -----------------------------------------------------------------
  // 버튼 처리
  // -----------------------------------------------------------------

  private async onClick(event: Event): Promise<void> {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !this.root.contains(button)) return;

    const addType = button.dataset.add as BlockType | undefined;
    if (addType) {
      this.add(addType);
      return;
    }

    const act = button.dataset.act;
    if (!act) return;
    const index = Number(button.dataset.i);
    const block = this.blocks[index];
    if (!block) return;

    switch (act) {
      case 'up':
        this.move(index, -1);
        break;
      case 'down':
        this.move(index, 1);
        break;
      case 'remove':
        if (confirm(`${BLOCK_LABELS[block.type]} 블록을 삭제할까요?`)) {
          this.blocks.splice(index, 1);
          this.commit();
        }
        break;
      case 'bold':
        this.wrapSelection(index, '**', '**');
        break;
      case 'link':
        this.insertLink(index);
        break;
      case 'align': {
        if (block.type !== 'paragraph') break;
        block.align = (button.dataset.align as TextAlign) ?? 'left';
        this.commit();
        break;
      }
      case 'pick-one': {
        if (block.type !== 'image') break;
        const [path] = await this.hooks.pickPhotos({ multiple: false, title: '사진 고르기' });
        if (path) {
          block.path = path;
          this.commit();
        }
        break;
      }
      case 'pick-many': {
        if (block.type !== 'imageGroup') break;
        const paths = await this.hooks.pickPhotos({ multiple: true, title: '사진 여러 장 고르기' });
        if (paths.length > 0) {
          const group = block as ImageGroupBlock;
          const have = new Set(group.items.map((i) => i.path));
          for (const p of paths) if (!have.has(p)) group.items.push({ path: p });
          this.commit();
        }
        break;
      }
      case 'group-remove': {
        if (block.type !== 'imageGroup') break;
        block.items.splice(Number(button.dataset.n), 1);
        this.commit();
        break;
      }
      case 'pick-before':
      case 'pick-after': {
        if (block.type !== 'beforeAfter') break;
        const which = act === 'pick-before' ? 'Before' : 'After';
        const [path] = await this.hooks.pickPhotos({
          multiple: false,
          title: `${which} 사진 고르기`,
        });
        if (path) {
          if (act === 'pick-before') block.before = path;
          else block.after = path;
          this.commit();
        }
        break;
      }
    }
  }

  // -----------------------------------------------------------------
  // 조작
  // -----------------------------------------------------------------

  private add(type: BlockType): void {
    const created: Block =
      type === 'paragraph'
        ? { type: 'paragraph', text: '', align: 'left' }
        : type === 'heading'
          ? { type: 'heading', text: '' }
          : type === 'image'
            ? { type: 'image', path: '' }
            : type === 'imageGroup'
              ? { type: 'imageGroup', items: [] }
              : type === 'beforeAfter'
                ? { type: 'beforeAfter', before: '', after: '' }
                : { type: 'divider' };

    this.blocks.push(created);
    this.commit();

    // 방금 만든 블록으로 바로 입력할 수 있게 초점을 옮깁니다.
    const field = this.root.querySelector<HTMLElement>(`#blk-${this.blocks.length - 1}`);
    field?.focus();
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private move(index: number, delta: number): void {
    const to = index + delta;
    if (to < 0 || to >= this.blocks.length) return;
    const [moved] = this.blocks.splice(index, 1);
    this.blocks.splice(to, 0, moved);
    this.commit();
  }

  /** 선택한 글자를 기호로 감쌉니다(굵게). 선택이 없으면 커서 자리에 넣습니다. */
  private wrapSelection(index: number, open: string, close: string): void {
    const area = this.root.querySelector<HTMLTextAreaElement>(`#blk-${index}`);
    const block = this.blocks[index];
    if (!area || !block || block.type !== 'paragraph') return;

    const start = area.selectionStart ?? 0;
    const end = area.selectionEnd ?? 0;
    const value = area.value;
    const picked = value.slice(start, end) || '굵게 쓸 내용';

    area.value = value.slice(0, start) + open + picked + close + value.slice(end);
    block.text = area.value;
    area.focus();
    area.setSelectionRange(start + open.length, start + open.length + picked.length);
    this.hooks.onChange();
  }

  private insertLink(index: number): void {
    const area = this.root.querySelector<HTMLTextAreaElement>(`#blk-${index}`);
    const block = this.blocks[index];
    if (!area || !block || block.type !== 'paragraph') return;

    const url = prompt('연결할 주소를 넣어주세요.\n예) https://blog.naver.com/...');
    if (!url) return;
    const trimmed = url.trim();
    // 주소 형태가 아니면 넣지 않습니다.
    if (!/^https?:\/\//i.test(trimmed)) {
      alert('http:// 또는 https:// 로 시작하는 주소만 넣을 수 있습니다.');
      return;
    }

    const start = area.selectionStart ?? 0;
    const end = area.selectionEnd ?? 0;
    const value = area.value;
    const picked = value.slice(start, end) || '링크';

    area.value = value.slice(0, start) + `[${picked}](${trimmed})` + value.slice(end);
    block.text = area.value;
    area.focus();
    this.hooks.onChange();
  }

  private commit(): void {
    this.render();
    this.hooks.onChange();
  }
}
