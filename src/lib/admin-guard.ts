// 관리자 화면의 공통 시작 절차.
//
// 모든 /admin 페이지는 정적 HTML 로 만들어지고, 로그인 확인은 브라우저에서
// 합니다. 화면을 숨기는 것은 편의일 뿐이고 실제 데이터 보호는 Supabase RLS 가
// 담당합니다 — 로그인하지 않은 사람은 화면을 열더라도 아무 데이터도 읽지 못합니다.

import { getApi, isConfigured, type CmsApi } from './cms-api';
import { friendlyError, maybe, notice, show, toast } from './admin-ui';

export interface AdminSession {
  api: CmsApi;
  email: string;
}

export interface BootOptions {
  /** true 면 비로그인 상태에서 null 을 돌려줍니다(로그인 화면을 직접 그릴 때). */
  allowAnonymous?: boolean;
}

/**
 * 인증을 확인하고 화면을 열어줍니다.
 *
 *  · 설정값이 없으면 안내만 띄우고 멈춥니다
 *  · 로그인되어 있지 않으면 /admin 으로 보냅니다 (allowAnonymous 면 null 반환)
 *  · 로그인했지만 관리자가 아니면 로그아웃시킵니다
 */
export async function bootAdmin(opts: BootOptions = {}): Promise<AdminSession | null> {
  const boot = maybe('ad-boot');
  const app = maybe('ad-app');

  if (!isConfigured) {
    notice(
      maybe('ad-boot-message'),
      '관리자 화면 설정값이 아직 등록되지 않았습니다. 잠시 후 다시 시도해주세요.',
      'warn'
    );
    show(maybe('ad-boot-spinner'), false);
    return null;
  }

  const api = await getApi();

  let email: string | null = null;
  try {
    email = await api.currentEmail();
  } catch (e) {
    notice(maybe('ad-boot-message'), friendlyError(e), 'error');
    show(maybe('ad-boot-spinner'), false);
    return null;
  }

  if (!email) {
    if (opts.allowAnonymous) {
      show(boot, false);
      return null;
    }
    // 로그인 화면으로. 돌아올 주소를 남겨 두면 로그인 후 이어서 작업할 수 있습니다.
    const back = location.pathname + location.search;
    location.replace('/admin?next=' + encodeURIComponent(back));
    return null;
  }

  const admin = await api.isAdmin();
  if (!admin) {
    await api.signOut();
    location.replace('/admin?denied=1');
    return null;
  }

  // 헤더의 계정 표시와 로그아웃 버튼 연결
  const emailNode = maybe('ad-account-email');
  if (emailNode) emailNode.textContent = email;

  const logout = maybe<HTMLButtonElement>('ad-logout');
  if (logout) {
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        await api.signOut();
        location.href = '/admin';
      } catch (e) {
        logout.disabled = false;
        toast(friendlyError(e), 'error');
      }
    });
  }

  // 개발용 가짜 저장소로 돌아가고 있으면 눈에 보이게 표시합니다.
  if (api.mode === 'mock') {
    notice(maybe('ad-mode-banner'), '개발용 가짜 저장소로 동작 중입니다 (?mock=1)', 'info');
  }

  show(boot, false);
  show(app, true);
  return { api, email };
}
