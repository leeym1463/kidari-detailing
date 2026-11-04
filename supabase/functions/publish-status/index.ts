// =====================================================================
// publish-status — 게시가 어디까지 갔는지 알려주는 함수
//
// 게시는 여러 곳을 거칩니다.
//   Edge Function → GitHub 임시 브랜치 → Actions 빌드 검증 → main → 사이트 재배포
//
// 화면에서 몇 초마다 이 함수를 불러 진행 상황을 확인합니다.
//
//   verifying  빌드 확인 중   임시 브랜치가 아직 살아 있음
//   deploying  배포 중        커밋이 main 에 들어갔고, 사이트가 다시 만들어지는 중
//   published  게시 완료      공개 주소에서 글이 실제로 열리는 것까지 확인
//   failed     게시 실패      임시 브랜치가 사라졌는데 main 에도 없음 = 빌드 실패
//
// "게시 완료"는 커밋 성공이 아니라 공개 주소 확인까지 끝난 뒤에만 표시합니다.
//
// 필요한 Secret
//   GITHUB_TOKEN     publish-case 와 같은 토큰 (Contents: Read 면 충분)
//   GITHUB_REPO      leeym1463/kidari-detailing
//   GITHUB_BRANCH    main (생략 가능)
//   PUBLIC_SITE_URL  https://kidari-detailing.pages.dev (생략 시 이 값)
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GITHUB_API = 'https://api.github.com';
const DEFAULT_SITE = 'https://kidari-detailing.pages.dev';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST 만 받습니다' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return json({ error: '로그인이 필요합니다.' }, 401);
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) return json({ error: '관리자 권한이 없습니다.' }, 403);

    const { caseId } = await req.json();
    const { data: c, error } = await supabase
      .from('cases')
      .select('id, slug, title, status, publish_state, publish_branch, publish_commit')
      .eq('id', caseId)
      .single();
    if (error || !c) return json({ error: '글을 찾을 수 없습니다.' }, 404);

    // 아직 게시를 시작하지 않았거나 이미 끝난 글
    if (!c.publish_commit || c.publish_state === 'published' || c.publish_state === 'failed') {
      return json({ state: c.publish_state ?? null, slug: c.slug });
    }

    const token = Deno.env.get('GITHUB_TOKEN');
    const repo = Deno.env.get('GITHUB_REPO');
    const baseBranch = Deno.env.get('GITHUB_BRANCH') ?? 'main';
    const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? DEFAULT_SITE).replace(/\/+$/, '');
    if (!token || !repo) throw new Error('GitHub 설정이 없습니다. Secret 을 확인해주세요.');

    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kidari-cms',
    };

    // 1) 커밋이 main 에 들어갔는지
    //    compare 의 status 가 behind / identical 이면 main 안에 포함된 것입니다.
    const cmp = await fetch(
      `${GITHUB_API}/repos/${repo}/compare/${baseBranch}...${c.publish_commit}`,
      { headers: ghHeaders }
    );
    const merged = cmp.ok && ['behind', 'identical'].includes((await cmp.json()).status);

    // 2) 임시 브랜치가 아직 살아 있는지
    const branchRes = c.publish_branch
      ? await fetch(`${GITHUB_API}/repos/${repo}/git/ref/heads/${c.publish_branch}`, {
          headers: ghHeaders,
        })
      : null;
    const branchAlive = Boolean(branchRes?.ok);

    // 3) 공개 주소가 실제로 열리는지
    let pageLive = false;
    const publicUrl = `${siteUrl}/cases/${c.slug}`;
    if (merged) {
      try {
        const page = await fetch(publicUrl, {
          headers: { 'User-Agent': 'kidari-cms' },
          redirect: 'follow',
        });
        if (page.ok) {
          const html = await page.text();
          // 제목이 보이면 그 글이 맞습니다.
          pageLive = html.includes(c.title) || html.includes(`/cases/${c.slug}`);
        }
      } catch {
        pageLive = false;
      }
    }

    let state: string;
    if (pageLive) state = 'published';
    else if (merged) state = 'deploying';
    else if (branchAlive) state = 'verifying';
    else state = 'failed';

    const patch: Record<string, unknown> = { publish_state: state };
    if (state === 'published') {
      patch.status = 'published';
      patch.published_at = new Date().toISOString();
      patch.published_url = publicUrl;
      patch.publish_error = null;
    }
    if (state === 'failed') {
      patch.publish_error =
        '빌드 검증에 실패해 공개 사이트에 반영하지 않았습니다. 글과 사진은 그대로 남아 있습니다.';
    }
    await supabase.from('cases').update(patch).eq('id', caseId);

    return json({ state, merged, branchAlive, pageLive, url: publicUrl, slug: c.slug });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
