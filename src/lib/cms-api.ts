// 관리자 화면과 데이터 저장소 사이의 유일한 통로.
//
// 화면 코드는 Supabase 를 직접 부르지 않고 이 파일의 함수만 씁니다.
//  · 화면과 저장소를 분리해 두면 Phase 2에서 GitHub 게시를 붙일 때 영향 범위가 작습니다
//  · 개발 중에는 같은 인터페이스의 가짜 구현(cms-mock)으로 교체해 화면을 테스트할 수 있습니다
//
// 보안: 여기서도 공개 설정값만 씁니다. 실제 접근 통제는 Supabase RLS 가 담당하며,
//       이 파일은 권한을 우회하는 어떤 수단도 갖고 있지 않습니다.

import { getSupabase, isConfigured, STORAGE_BUCKET, buildTempPath } from './supabase';
import { processForUpload } from './image';
import type { CaseCategory, CaseRow, PhotoRow } from './cms-types';

export interface SignInResult {
  ok: boolean;
  /** 실패했을 때 Supabase 가 준 원문. 화면에서 friendlyError() 로 바꿔 보여줍니다. */
  error?: string;
}

export interface NewCaseInput {
  slug: string;
  title: string;
  category: CaseCategory;
  case_date: string;
}

export type CasePatch = Partial<
  Pick<
    CaseRow,
    | 'title'
    | 'category'
    | 'case_date'
    | 'vehicle'
    | 'vehicle_color'
    | 'summary'
    | 'before_condition'
    | 'work_performed'
    | 'duration'
    | 'price_note'
    | 'naver_blog_url'
    | 'content_blocks'
    | 'cover_image'
  >
>;

export interface CmsApi {
  /** 'supabase' 또는 'mock'. 화면에 개발용 표시를 띄울 때 씁니다. */
  readonly mode: 'supabase' | 'mock';

  signIn(email: string, password: string, remember: boolean): Promise<SignInResult>;
  signOut(): Promise<void>;
  /** 로그인한 계정의 이메일. 로그인 상태가 아니면 null. */
  currentEmail(): Promise<string | null>;
  /** admins 표에 등록된 계정인지. */
  isAdmin(): Promise<boolean>;

  listCases(): Promise<CaseRow[]>;
  getCase(id: string): Promise<CaseRow | null>;
  createCase(input: NewCaseInput): Promise<CaseRow>;
  updateCase(id: string, patch: CasePatch): Promise<CaseRow>;
  deleteCase(id: string): Promise<void>;

  listPhotos(): Promise<PhotoRow[]>;
  uploadPhoto(file: Blob): Promise<PhotoRow>;
  deletePhoto(photo: PhotoRow): Promise<void>;
  /** storage_path → 미리보기용 임시 주소. 비공개 버킷이라 서명 주소가 필요합니다. */
  signedUrls(paths: string[]): Promise<Map<string, string>>;
  /** 본문에서 실제로 쓰인 사진만 글에 연결하고, 빠진 사진은 연결을 끊습니다. */
  syncCasePhotos(caseId: string, usedPaths: string[]): Promise<void>;
}

const SIGNED_URL_TTL = 60 * 60; // 1시간

// =====================================================================
// Supabase 구현
// =====================================================================

function clientOrThrow() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase 설정값이 없습니다 (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_PUBLISHABLE_KEY)');
  return c;
}

/** Supabase 응답의 error 를 그대로 던져 호출하는 쪽에서 한 번에 처리하게 합니다. */
function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const CASE_COLUMNS =
  'id, slug, title, category, case_date, vehicle, vehicle_color, summary, before_condition, ' +
  'work_performed, duration, price_note, naver_blog_url, content_blocks, cover_image, ' +
  'status, published_at, created_at, updated_at';

const PHOTO_COLUMNS = 'id, storage_path, width, height, bytes, case_id, status, created_at';

const supabaseApi: CmsApi = {
  mode: 'supabase',

  async signIn(email, password, remember) {
    const c = clientOrThrow();
    // "로그인 상태 유지"를 끄면 탭을 닫을 때 세션이 사라지도록 저장 위치를 옮깁니다.
    // (supabase-js 는 localStorage 를 쓰므로, 끈 경우에만 표시를 남겨 둡니다)
    try {
      localStorage.setItem('kidari-admin-remember', remember ? '1' : '0');
    } catch {
      /* 저장할 수 없는 환경이면 무시합니다 */
    }
    const { error } = await c.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async signOut() {
    const c = getSupabase();
    if (c) await c.auth.signOut();
  },

  async currentEmail() {
    const c = getSupabase();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session?.user?.email ?? null;
  },

  async isAdmin() {
    const c = getSupabase();
    if (!c) return false;
    const { data, error } = await c.rpc('is_admin');
    if (error) return false;
    return data === true;
  },

  async listCases() {
    const c = clientOrThrow();
    return unwrap(
      await c.from('cases').select(CASE_COLUMNS).order('updated_at', { ascending: false })
    ) as CaseRow[];
  },

  async getCase(id) {
    const c = clientOrThrow();
    const res = await c.from('cases').select(CASE_COLUMNS).eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return (res.data as CaseRow) ?? null;
  },

  async createCase(input) {
    const c = clientOrThrow();
    return unwrap(
      await c
        .from('cases')
        .insert({ ...input, status: 'draft', work_performed: [], content_blocks: [] })
        .select(CASE_COLUMNS)
        .single()
    ) as CaseRow;
  },

  async updateCase(id, patch) {
    const c = clientOrThrow();
    return unwrap(
      await c.from('cases').update(patch).eq('id', id).select(CASE_COLUMNS).single()
    ) as CaseRow;
  },

  async deleteCase(id) {
    const c = clientOrThrow();
    const res = await c.from('cases').delete().eq('id', id);
    if (res.error) throw new Error(res.error.message);
  },

  async listPhotos() {
    const c = clientOrThrow();
    return unwrap(
      await c.from('photos').select(PHOTO_COLUMNS).order('created_at', { ascending: false })
    ) as PhotoRow[];
  },

  async uploadPhoto(file) {
    const c = clientOrThrow();
    const img = await processForUpload(file);
    const path = buildTempPath(img.ext);

    const up = await c.storage.from(STORAGE_BUCKET).upload(path, img.blob, {
      contentType: img.blob.type,
      upsert: false,
    });
    if (up.error) throw new Error(up.error.message);

    try {
      return unwrap(
        await c
          .from('photos')
          .insert({
            storage_path: path,
            width: img.width,
            height: img.height,
            bytes: img.bytes,
            status: 'temp',
          })
          .select(PHOTO_COLUMNS)
          .single()
      ) as PhotoRow;
    } catch (e) {
      // 대장(photos)에 기록하지 못하면 올라간 파일이 미아가 되므로 되돌립니다.
      await c.storage.from(STORAGE_BUCKET).remove([path]);
      throw e;
    }
  },

  async deletePhoto(photo) {
    const c = clientOrThrow();
    // 파일을 먼저 지우고, 성공하면 대장에서도 지웁니다.
    const rm = await c.storage.from(STORAGE_BUCKET).remove([photo.storage_path]);
    if (rm.error) throw new Error(rm.error.message);
    const del = await c.from('photos').delete().eq('id', photo.id);
    if (del.error) throw new Error(del.error.message);
  },

  async signedUrls(paths) {
    const map = new Map<string, string>();
    if (paths.length === 0) return map;
    const c = clientOrThrow();
    const { data, error } = await c.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
    }
    return map;
  },

  async syncCasePhotos(caseId, usedPaths) {
    const c = clientOrThrow();

    // 1) 본문에서 쓰이는 사진을 이 글에 연결
    if (usedPaths.length > 0) {
      const link = await c.from('photos').update({ case_id: caseId }).in('storage_path', usedPaths);
      if (link.error) throw new Error(link.error.message);
    }

    // 2) 이 글에 연결돼 있었지만 본문에서 빠진 사진은 연결을 끊어
    //    다시 "미사용" 상태(= 7일 후 정리 대상)로 돌려놓습니다.
    let unlink = c.from('photos').update({ case_id: null }).eq('case_id', caseId);
    if (usedPaths.length > 0) {
      unlink = unlink.not('storage_path', 'in', `(${usedPaths.map((p) => `"${p}"`).join(',')})`);
    }
    const res = await unlink;
    if (res.error) throw new Error(res.error.message);
  },
};

// =====================================================================
// 구현 선택
// =====================================================================

let cached: CmsApi | null = null;

/**
 * 화면이 쓸 구현을 돌려줍니다.
 *
 * 개발 서버(npm run dev)에서 주소에 ?mock=1 을 붙이면 가짜 구현으로 바뀝니다.
 * 운영 빌드에서는 import.meta.env.DEV 가 false 라 이 분기 자체가 사라지고,
 * 가짜 구현 코드는 번들에 포함되지 않습니다.
 */
export async function getApi(): Promise<CmsApi> {
  if (cached) return cached;

  if (import.meta.env.DEV) {
    // 한 번 ?mock=1 로 들어오면 화면을 옮겨 다녀도 유지됩니다(?mock=0 으로 해제).
    let wantMock = false;
    if (typeof location !== 'undefined') {
      const flag = new URLSearchParams(location.search).get('mock');
      try {
        if (flag === '1') sessionStorage.setItem('kidari-mock', '1');
        if (flag === '0') sessionStorage.removeItem('kidari-mock');
        wantMock = sessionStorage.getItem('kidari-mock') === '1';
      } catch {
        wantMock = flag === '1';
      }
    }
    if (wantMock) {
      const { mockApi } = await import('./cms-mock');
      cached = mockApi;
      return cached;
    }
  }

  cached = supabaseApi;
  return cached;
}

export { isConfigured };
