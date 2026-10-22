// 사진함.
//
// /admin/photos 화면과, 글 작성 화면의 "사진 고르기" 창이 같은 코드를 씁니다.
// 비공개 버킷이라 썸네일은 서명 주소(signed URL)로 불러옵니다.

import type { CmsApi } from './cms-api';
import type { CaseRow, PhotoRow } from './cms-types';
import {
  daysUntilCleanup,
  escapeHtml,
  formatDate,
  friendlyError,
  PHOTO_KEEP_DAYS,
  toast,
} from './admin-ui';
import { formatBytes, processForUpload } from './image';

export interface GalleryOptions {
  /** 사진 카드가 그려질 자리 */
  grid: HTMLElement;
  /** 사진이 하나도 없을 때 보여줄 안내 */
  empty?: HTMLElement | null;
  api: CmsApi;
  /** true 면 카드를 눌러 고를 수 있습니다(글 작성 화면). */
  selectable?: boolean;
  /** 고르기 모드에서 여러 장을 고를 수 있는지. */
  multiple?: boolean;
  /** 삭제 버튼을 보일지. 고르기 창에서는 숨깁니다. */
  deletable?: boolean;
  /** 고른 사진이 바뀔 때마다 호출됩니다. */
  onSelectionChange?: (picked: PhotoRow[]) => void;
}

export class PhotoGallery {
  private opts: GalleryOptions;
  private photos: PhotoRow[] = [];
  private urls = new Map<string, string>();
  private caseTitles = new Map<string, string>();
  private picked: string[] = []; // storage_path, 고른 순서를 유지합니다

  constructor(opts: GalleryOptions) {
    this.opts = opts;
    this.opts.grid.addEventListener('click', (e) => this.onClick(e));
  }

  /** 서버에서 다시 읽어 화면을 새로 그립니다. */
  async refresh(): Promise<void> {
    const { api } = this.opts;
    const [photos, cases] = await Promise.all([api.listPhotos(), api.listCases()]);
    this.photos = photos;

    this.caseTitles.clear();
    for (const c of cases as CaseRow[]) this.caseTitles.set(c.id, c.title || '제목 없음');

    const paths = photos.map((p) => p.storage_path);
    try {
      this.urls = await api.signedUrls(paths);
    } catch {
      // 썸네일을 못 받아도 목록 자체는 보여줍니다.
      this.urls = new Map();
    }

    // 사라진 사진은 선택에서 빼줍니다.
    const alive = new Set(paths);
    this.picked = this.picked.filter((p) => alive.has(p));

    this.render();
  }

  get items(): PhotoRow[] {
    return this.photos;
  }

  /** 고른 사진들을 고른 순서대로. */
  get selected(): PhotoRow[] {
    return this.picked
      .map((path) => this.photos.find((p) => p.storage_path === path))
      .filter((p): p is PhotoRow => Boolean(p));
  }

  clearSelection(): void {
    this.picked = [];
    this.render();
    this.opts.onSelectionChange?.([]);
  }

  thumbUrl(path: string): string | undefined {
    return this.urls.get(path);
  }

  // -----------------------------------------------------------------
  // 그리기
  // -----------------------------------------------------------------

  private render(): void {
    const { grid, empty, selectable, deletable } = this.opts;

    if (this.photos.length === 0) {
      grid.innerHTML = '';
      empty?.classList.remove('ad-hide');
      return;
    }
    empty?.classList.add('ad-hide');

    grid.innerHTML = this.photos
      .map((p) => {
        const url = this.urls.get(p.storage_path);
        const pickIndex = this.picked.indexOf(p.storage_path);
        const isPicked = pickIndex >= 0;

        const used = Boolean(p.case_id);
        const usedTitle = p.case_id ? (this.caseTitles.get(p.case_id) ?? '작성 중인 글') : '';
        const badge = used
          ? `<span class="ad-badge ad-badge-used">사용 중</span>`
          : `<span class="ad-badge ad-badge-free">미사용</span>`;

        const left = daysUntilCleanup(p.created_at);
        const cleanupNote = used
          ? `${escapeHtml(usedTitle)} 에 사용 중`
          : `${left}일 후 자동 정리`;

        const size = p.width && p.height ? `${p.width}×${p.height}` : '';
        const bytes = p.bytes ? formatBytes(p.bytes) : '';

        const label = selectable
          ? isPicked
            ? '선택 해제'
            : '이 사진 선택'
          : '사진 크게 보기';

        const thumb = url
          ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />`
          : '';

        return `<figure class="ad-photo-card${isPicked ? ' is-picked' : ''}" data-path="${escapeHtml(p.storage_path)}">
  <button type="button" class="ad-photo-thumb" data-act="pick" aria-label="${label}" aria-pressed="${selectable ? String(isPicked) : 'false'}">
    ${thumb}
  </button>
  <figcaption class="ad-photo-body">
    <span>${badge}${isPicked ? ` <span class="ad-badge ad-badge-used">${pickIndex + 1}번째</span>` : ''}</span>
    <span class="ad-photo-meta">
      ${formatDate(p.created_at)}${size ? ' · ' + size : ''}${bytes ? ' · ' + bytes : ''}<br />
      ${cleanupNote}
    </span>
    ${
      deletable
        ? `<span class="ad-photo-actions">
             <button type="button" class="ad-btn ad-btn-sm ad-btn-danger" data-act="delete" aria-label="이 사진 삭제">삭제</button>
           </span>`
        : ''
    }
  </figcaption>
</figure>`;
      })
      .join('');
  }

  // -----------------------------------------------------------------
  // 조작
  // -----------------------------------------------------------------

  private async onClick(event: Event): Promise<void> {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button[data-act]');
    if (!button) return;
    const card = button.closest<HTMLElement>('.ad-photo-card');
    const path = card?.dataset.path;
    if (!path) return;
    const photo = this.photos.find((p) => p.storage_path === path);
    if (!photo) return;

    if (button.dataset.act === 'delete') {
      await this.remove(photo);
      return;
    }

    // 고르기 모드가 아니면 원본을 새 탭에서 봅니다.
    if (!this.opts.selectable) {
      const url = this.urls.get(path);
      if (url) window.open(url, '_blank', 'noopener');
      return;
    }

    const at = this.picked.indexOf(path);
    if (at >= 0) {
      this.picked.splice(at, 1);
    } else if (this.opts.multiple) {
      this.picked.push(path);
    } else {
      this.picked = [path];
    }
    this.render();
    this.opts.onSelectionChange?.(this.selected);
  }

  private async remove(photo: PhotoRow): Promise<void> {
    const usedTitle = photo.case_id ? (this.caseTitles.get(photo.case_id) ?? '작성 중인 글') : '';
    const message = photo.case_id
      ? `이 사진은 "${usedTitle}" 에서 사용 중입니다.\n삭제하면 글에서도 사라질 수 있습니다.\n\n그래도 삭제할까요?`
      : '이 사진을 삭제할까요?\n삭제한 사진은 되돌릴 수 없습니다.';

    if (!confirm(message)) return;

    try {
      await this.opts.api.deletePhoto(photo);
      toast('사진을 삭제했습니다.', 'ok');
      await this.refresh();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  }
}

// =====================================================================
// 업로드
// =====================================================================

export interface UploaderOptions {
  api: CmsApi;
  /** 사진을 고르는 <input type="file"> */
  input: HTMLInputElement;
  /** 진행 상황을 적을 <ul> */
  progress?: HTMLElement | null;
  /** 드래그&드롭을 받을 영역(선택) */
  dropZone?: HTMLElement | null;
  /** 업로드가 모두 끝나면 호출됩니다. */
  onDone?: () => void | Promise<void>;
}

/** 파일 선택 / 드래그&드롭 → 변환 → 업로드까지 연결합니다. */
export function createUploader(opts: UploaderOptions): void {
  const { api, input, progress, dropZone } = opts;

  async function handle(files: FileList | File[]): Promise<void> {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      toast('사진 파일만 올릴 수 있습니다.', 'error');
      return;
    }

    if (progress) progress.innerHTML = '';
    input.disabled = true;

    let ok = 0;
    for (const file of list) {
      const row = document.createElement('li');
      row.innerHTML =
        `<span class="name">${escapeHtml(file.name)}</span><span class="state">변환 중…</span>`;
      progress?.appendChild(row);
      const state = row.querySelector('.state')!;

      try {
        state.textContent = '올리는 중…';
        const saved = await api.uploadPhoto(file);
        const shrunk =
          file.size > 0 && saved.bytes ? `${(file.size / saved.bytes).toFixed(1)}배 작게` : '';
        state.className = 'state state-ok';
        state.textContent = `완료 ${saved.width}×${saved.height}${shrunk ? ' · ' + shrunk : ''}`;
        ok += 1;
      } catch (e) {
        state.className = 'state state-ng';
        state.textContent = friendlyError(e);
      }
    }

    input.disabled = false;
    input.value = '';
    if (ok > 0) toast(`사진 ${ok}장을 올렸습니다.`, 'ok');
    await opts.onDone?.();
  }

  input.addEventListener('change', () => {
    if (input.files && input.files.length > 0) void handle(input.files);
  });

  if (dropZone) {
    const stop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    dropZone.addEventListener('dragover', (e) => {
      stop(e);
      dropZone.classList.add('is-over');
    });
    dropZone.addEventListener('dragleave', (e) => {
      stop(e);
      dropZone.classList.remove('is-over');
    });
    dropZone.addEventListener('drop', (e) => {
      stop(e);
      dropZone.classList.remove('is-over');
      if (e.dataTransfer?.files?.length) void handle(e.dataTransfer.files);
    });
  }
}

export { PHOTO_KEEP_DAYS, processForUpload };
