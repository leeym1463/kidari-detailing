// 개발 전용 가짜 저장소. 운영 빌드에는 포함되지 않습니다.
//
// 왜 필요한가
//   관리자 화면은 로그인한 뒤에야 대부분의 기능이 보입니다. 실제 관리자
//   비밀번호 없이도 화면 전체(사진함 → 글 작성 → 임시저장 → 미리보기)를
//   자동으로 눌러보며 검증하려면 같은 인터페이스의 가짜 구현이 필요합니다.
//
// 어떻게 켜는가
//   개발 서버에서만, 주소에 ?mock=1 을 붙였을 때만 활성화됩니다.
//   cms-api.ts 의 getApi() 가 import.meta.env.DEV 안에서만 이 파일을
//   동적으로 불러오므로, 운영 빌드에서는 분기 자체가 제거됩니다.
//
// 비밀번호
//   mock 로그인은 비밀번호 "mock" 만 통과시킵니다. 다른 값을 넣으면
//   실제 Supabase 와 같은 오류 문구를 돌려주어 오류 처리도 검증할 수 있습니다.

import { processForUpload } from './image';
import type { Block, CaseRow, PhotoRow } from './cms-types';
import type { CasePatch, CmsApi, NewCaseInput } from './cms-api';

const KEY_CASES = 'kidari-mock-cases';
const KEY_PHOTOS = 'kidari-mock-photos';
const KEY_BLOBS = 'kidari-mock-blobs';
const KEY_SESSION = 'kidari-mock-session';
const MOCK_PASSWORD = 'mock';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error('가짜 저장소 용량이 찼습니다 (개발용)');
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

/** 네트워크처럼 아주 짧은 지연을 주어 로딩 표시도 눈에 보이게 합니다. */
function tick<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 40));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다'));
    reader.readAsDataURL(blob);
  });
}

export const mockApi: CmsApi = {
  mode: 'mock',

  async signIn(email, password) {
    await tick(null);
    if (password !== MOCK_PASSWORD) {
      return { ok: false, error: 'Invalid login credentials' };
    }
    write(KEY_SESSION, email || 'mock@kidari.test');
    return { ok: true };
  },

  async signOut() {
    localStorage.removeItem(KEY_SESSION);
    await tick(null);
  },

  async currentEmail() {
    return tick(read<string | null>(KEY_SESSION, null));
  },

  async isAdmin() {
    return tick(read<string | null>(KEY_SESSION, null) !== null);
  },

  async listCases() {
    const rows = read<CaseRow[]>(KEY_CASES, []);
    rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return tick(rows);
  },

  async getCase(id) {
    const rows = read<CaseRow[]>(KEY_CASES, []);
    return tick(rows.find((r) => r.id === id) ?? null);
  },

  async createCase(input: NewCaseInput) {
    const rows = read<CaseRow[]>(KEY_CASES, []);
    if (rows.some((r) => r.slug === input.slug)) {
      throw new Error('duplicate key value violates unique constraint');
    }
    const row: CaseRow = {
      id: crypto.randomUUID(),
      slug: input.slug,
      title: input.title,
      category: input.category,
      case_date: input.case_date,
      vehicle: null,
      vehicle_color: null,
      summary: null,
      before_condition: null,
      work_performed: [],
      duration: null,
      price_note: null,
      naver_blog_url: null,
      content_blocks: [],
      cover_image: null,
      status: 'draft',
      published_at: null,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    rows.push(row);
    write(KEY_CASES, rows);
    return tick(row);
  },

  async updateCase(id, patch: CasePatch) {
    const rows = read<CaseRow[]>(KEY_CASES, []);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('글을 찾을 수 없습니다');
    // 실제 DB 의 updated_at 트리거와 같은 동작
    rows[idx] = { ...rows[idx], ...patch, updated_at: nowISO() } as CaseRow;
    write(KEY_CASES, rows);
    return tick(rows[idx]);
  },

  async deleteCase(id) {
    write(
      KEY_CASES,
      read<CaseRow[]>(KEY_CASES, []).filter((r) => r.id !== id)
    );
    // 연결돼 있던 사진은 미사용으로 되돌립니다 (on delete set null 과 동일)
    const photos = read<PhotoRow[]>(KEY_PHOTOS, []).map((p) =>
      p.case_id === id ? { ...p, case_id: null } : p
    );
    write(KEY_PHOTOS, photos);
    await tick(null);
  },

  async listPhotos() {
    const rows = read<PhotoRow[]>(KEY_PHOTOS, []);
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return tick(rows);
  },

  async uploadPhoto(file) {
    const img = await processForUpload(file);
    const path = `temp/mock/${crypto.randomUUID()}.${img.ext}`;

    const blobs = read<Record<string, string>>(KEY_BLOBS, {});
    blobs[path] = await blobToDataUrl(img.blob);
    write(KEY_BLOBS, blobs);

    const row: PhotoRow = {
      id: crypto.randomUUID(),
      storage_path: path,
      width: img.width,
      height: img.height,
      bytes: img.bytes,
      case_id: null,
      status: 'temp',
      created_at: nowISO(),
    };
    const rows = read<PhotoRow[]>(KEY_PHOTOS, []);
    rows.push(row);
    write(KEY_PHOTOS, rows);
    return tick(row);
  },

  async deletePhoto(photo) {
    write(
      KEY_PHOTOS,
      read<PhotoRow[]>(KEY_PHOTOS, []).filter((p) => p.id !== photo.id)
    );
    const blobs = read<Record<string, string>>(KEY_BLOBS, {});
    delete blobs[photo.storage_path];
    write(KEY_BLOBS, blobs);
    await tick(null);
  },

  async signedUrls(paths) {
    const blobs = read<Record<string, string>>(KEY_BLOBS, {});
    const map = new Map<string, string>();
    for (const p of paths) if (blobs[p]) map.set(p, blobs[p]);
    return tick(map);
  },

  async syncCasePhotos(caseId, usedPaths) {
    const used = new Set(usedPaths);
    const rows = read<PhotoRow[]>(KEY_PHOTOS, []).map((p) => {
      if (used.has(p.storage_path)) return { ...p, case_id: caseId };
      if (p.case_id === caseId) return { ...p, case_id: null };
      return p;
    });
    write(KEY_PHOTOS, rows);
    await tick(null);
  },
};

/** 개발 중 데이터를 비우고 싶을 때 콘솔에서 호출합니다. */
export function resetMock(): void {
  for (const k of [KEY_CASES, KEY_PHOTOS, KEY_BLOBS, KEY_SESSION]) localStorage.removeItem(k);
}

// 자동 테스트에서 쓰기 위해 전역에 노출합니다 (개발 전용 파일이라 안전합니다).
declare global {
  interface Window {
    __kidariMock?: { reset: () => void; seedBlocks: (blocks: Block[]) => void };
  }
}
if (typeof window !== 'undefined') {
  window.__kidariMock = {
    reset: resetMock,
    seedBlocks: (blocks: Block[]) => {
      const rows = read<CaseRow[]>(KEY_CASES, []);
      if (rows[0]) {
        rows[0].content_blocks = blocks;
        write(KEY_CASES, rows);
      }
    },
  };
}
