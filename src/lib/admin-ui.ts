// 관리자 화면에서 공통으로 쓰는 작은 도구들.
// 라이브러리를 쓰지 않고 바닐라로 유지합니다 — 브라우저 AI(웨일 Aside)가
// 실제 input / textarea / button 을 그대로 조작할 수 있어야 하기 때문입니다.

import type { CaseCategory } from './cms-types';

// ---------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------

/** id 로 요소를 찾습니다. 없으면 바로 오류를 냅니다(조용한 실패 방지). */
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`화면 요소를 찾을 수 없습니다: #${id}`);
  return node as T;
}

/** id 로 요소를 찾되, 없으면 null 을 돌려줍니다. */
export function maybe<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function show(node: HTMLElement | null, visible = true): void {
  if (node) node.classList.toggle('ad-hide', !visible);
}

/** HTML 로 넣을 문자열을 안전하게 바꿉니다. */
export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------
// 알림
// ---------------------------------------------------------------------

/** 화면 아래에 잠깐 뜨는 알림. */
export function toast(message: string, kind: 'info' | 'ok' | 'error' = 'info'): void {
  let host = document.getElementById('ad-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'ad-toast-host';
    host.className = 'ad-toast-host';
    // 스크린리더와 Aside 가 변화를 인지할 수 있도록 알림 영역으로 선언합니다.
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const item = document.createElement('div');
  item.className = 'ad-toast' + (kind === 'info' ? '' : ' ad-toast-' + kind);
  item.textContent = message;
  host.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

/** 화면 안에 고정으로 남는 안내문. message 가 비어 있으면 숨깁니다. */
export function notice(
  node: HTMLElement | null,
  message: string,
  kind: 'error' | 'ok' | 'info' | 'warn' = 'error'
): void {
  if (!node) return;
  node.textContent = message;
  node.className = 'ad-notice ad-notice-' + kind;
  node.classList.toggle('ad-hide', !message);
}

// ---------------------------------------------------------------------
// 오류 문구 — 개발용 영어 메시지를 사장님이 읽을 수 있는 말로 바꿉니다.
// ---------------------------------------------------------------------

export function friendlyError(raw: unknown): string {
  const msg = (raw instanceof Error ? raw.message : String(raw ?? '')).toLowerCase();

  if (!msg) return '알 수 없는 문제가 생겼습니다. 잠시 후 다시 시도해주세요.';

  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return '이메일 또는 비밀번호를 확인해주세요.';
  }
  if (msg.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않은 계정입니다.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return '시도가 너무 많았습니다. 잠시 후 다시 시도해주세요.';
  }
  if (msg.includes('missing email') || msg.includes('validation')) {
    return '입력하신 내용을 다시 확인해주세요.';
  }
  // 마이그레이션을 아직 적용하지 않았을 때. 사장님이 직접 SQL 을 실행하시므로
  // 무엇을 해야 하는지 그대로 알려드립니다.
  if (msg.includes('does not exist') && msg.includes('column')) {
    return '데이터베이스 준비가 끝나지 않았습니다. Supabase에서 최신 마이그레이션(0005)을 실행해주세요.';
  }
  if (msg.includes('permission denied') || msg.includes('row-level security')) {
    return '권한이 없습니다. 다시 로그인한 뒤 시도해주세요.';
  }
  if (msg.includes('jwt') || msg.includes('session')) {
    return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  }
  if (msg.includes('duplicate key') || msg.includes('already exists')) {
    return '같은 내용이 이미 저장되어 있습니다.';
  }
  if (msg.includes('payload too large') || msg.includes('entity too large')) {
    return '파일이 너무 큽니다. 사진을 줄여서 다시 올려주세요.';
  }
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('timeout')
  ) {
    return '인터넷 연결을 확인해주세요.';
  }
  return '문제가 생겨 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

// ---------------------------------------------------------------------
// 날짜 · 용량 표시
// ---------------------------------------------------------------------

/** 2026-10-22 → 2026.10.22 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

/** 오늘 날짜를 input[type=date] 에 넣을 수 있는 형식으로. */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "3일 전" 처럼 사람이 읽기 쉬운 상대 시간. */
export function relativeDays(value: string | null | undefined): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

/**
 * 사진함 자동정리까지 남은 일수. 업로드 후 7일이 기준입니다.
 * (실제 삭제는 Phase 4에서 활성화되고, 지금은 표시만 합니다)
 */
export const PHOTO_KEEP_DAYS = 7;

export function daysUntilCleanup(createdAt: string | null | undefined): number {
  if (!createdAt) return PHOTO_KEEP_DAYS;
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return PHOTO_KEEP_DAYS;
  const elapsed = (Date.now() - then) / 86_400_000;
  return Math.max(0, Math.ceil(PHOTO_KEEP_DAYS - elapsed));
}

// ---------------------------------------------------------------------
// slug 만들기
//
// 한글 제목은 URL 로 쓰기 어려워 카테고리 + 작업일 + 임의 4자리로 만듭니다.
// 기존 38건(coating-07-2025-05-14 형태)과 모양이 달라 겹치지 않습니다.
// ---------------------------------------------------------------------

const SLUG_PREFIX: Record<CaseCategory, string> = {
  '광택·유리막코팅': 'coating',
  '외형복원·판금도색': 'restoration',
  '스팀세차': 'steam-wash',
  '에바크리닝': 'eva-cleaning',
  '실내크리닝': 'interior-cleaning',
};

export function buildSlug(category: CaseCategory, caseDate: string): string {
  const prefix = SLUG_PREFIX[category] ?? 'case';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(caseDate) ? caseDate : todayISO();
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${date}-${rand}`;
}

// ---------------------------------------------------------------------
// 입력 변경을 묶어서 처리 (자동저장용)
// ---------------------------------------------------------------------

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: unknown[] = [];
  const wrapped = ((...args: never[]) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...(lastArgs as never[]));
    }, ms);
  }) as T & { flush: () => void };
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn(...(lastArgs as never[]));
    }
  };
  return wrapped;
}
