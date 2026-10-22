import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 공개 설정값만 사용합니다. secret / service_role 키는 이 파일에 절대 들어오지 않습니다.
// 실제 권한 통제는 Supabase의 RLS가 담당합니다.
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** 브라우저에서만 호출하세요. 설정값이 없으면 null을 돌려줍니다. */
export function getSupabase(): SupabaseClient | null {
  if (!isConfigured) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'kidari-admin-auth',
      },
    });
  }
  return client;
}

export const STORAGE_BUCKET = 'case-photos';

/** temp/2026/10/<uuid>.webp 형태의 업로드 경로를 만듭니다. */
export function buildTempPath(ext: string): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `temp/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
}
