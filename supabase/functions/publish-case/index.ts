// =====================================================================
// publish-case — 관리자가 "게시"를 누르면 호출되는 함수
//
// 하는 일
//   1. 호출자가 로그인한 관리자인지 확인
//   2. 글 내용을 서버에서 다시 검증 (화면 검사를 믿지 않습니다)
//   3. 사진을 Storage 에서 내려받아 img-01.jpg 식으로 이름을 붙임
//   4. 마크다운 + 사진을 GitHub "게시용 임시 브랜치" 에 한 번의 커밋으로 올림
//   5. 상태를 verifying 으로 적고 끝 — main 반영은 하지 않습니다
//
// main 반영은 GitHub Actions(.github/workflows/publish-verify.yml)가
// npm run build 로 검증에 성공했을 때만 합니다.
// 실패하면 main 과 공개 사이트는 그대로이고, 글과 사진도 Supabase 에 남습니다.
//
// 필요한 Secret (Supabase Dashboard → Edge Functions → Secrets)
//   GITHUB_TOKEN   fine-grained PAT. 이 저장소만, Contents: Read and write
//   GITHUB_REPO    leeym1463/kidari-detailing
//   GITHUB_BRANCH  main   (생략 가능)
//
//   ※ 토큰은 코드·저장소·로그·응답 어디에도 남기지 않습니다.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildMarkdownFile, type Block, type CaseRecord } from '../_shared/render.ts';

const GITHUB_API = 'https://api.github.com';
const BUCKET = 'case-photos';
const CASES_DIR = 'src/content/cases';
const IMAGES_DIR = 'public/images/cases';

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

/** 본문에서 쓰인 사진 경로를 나온 순서대로 (중복 제거) */
function usedPhotoPaths(blocks: Block[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (p?: string) => {
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  };
  for (const b of blocks) {
    if (b.type === 'image') push(b.path);
    if (b.type === 'imageGroup') for (const i of b.items ?? []) push(i.path);
    if (b.type === 'beforeAfter') {
      push(b.before);
      push(b.after);
    }
  }
  return out;
}

/** 화면 검사와 같은 규칙을 서버에서 다시 확인합니다. */
function validate(c: CaseRecord, blocks: Block[]): string[] {
  const problems: string[] = [];

  if (!c.title?.trim()) problems.push('제목이 비어 있습니다.');
  if (!c.summary?.trim()) problems.push('요약이 비어 있습니다.');
  if (!c.vehicle?.trim()) problems.push('차량명이 비어 있습니다.');
  if (!/^[a-z0-9-]{4,80}$/.test(c.slug ?? '')) problems.push('공개 주소 형식이 올바르지 않습니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.case_date ?? '')) problems.push('작업일이 올바르지 않습니다.');
  if (blocks.length === 0) problems.push('본문이 비어 있습니다.');
  if (usedPhotoPaths(blocks).length === 0) problems.push('본문에 사진이 한 장도 없습니다.');

  blocks.forEach((b, i) => {
    const n = i + 1;
    if (b.type === 'paragraph' && !b.text?.trim()) problems.push(`${n}번째 블록(본문 텍스트)이 비어 있습니다.`);
    if (b.type === 'heading' && !b.text?.trim()) problems.push(`${n}번째 블록(소제목)이 비어 있습니다.`);
    if (b.type === 'image' && !b.path) problems.push(`${n}번째 블록(사진)에 사진이 없습니다.`);
    if (b.type === 'imageGroup' && (b.items ?? []).filter((x) => x.path).length === 0) {
      problems.push(`${n}번째 블록(여러 사진)에 사진이 없습니다.`);
    }
    if (b.type === 'beforeAfter' && (!b.before || !b.after)) {
      problems.push(`${n}번째 블록(Before/After)에 사진이 한쪽만 들어 있습니다.`);
    }
  });

  return problems;
}

function base64FromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST 만 받습니다' }, 405);

  let caseId = '';
  let admin: ReturnType<typeof createClient> | null = null;

  try {
    // --- 1. 관리자 확인 -------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    admin = supabase;

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return json({ error: '로그인이 필요합니다.' }, 401);

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) return json({ error: '관리자 권한이 없습니다.' }, 403);

    // --- 2. 글 읽기 ------------------------------------------------------
    ({ caseId } = await req.json());
    if (!caseId) return json({ error: '어떤 글인지 지정되지 않았습니다.' }, 400);

    const { data: c, error: caseErr } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (caseErr || !c) return json({ error: '글을 찾을 수 없습니다.' }, 404);

    const record = c as unknown as CaseRecord & { id: string; status: string };
    const blocks = (record.content_blocks ?? []) as Block[];

    // --- 3. 서버에서 다시 검증 -------------------------------------------
    const problems = validate(record, blocks);
    if (problems.length > 0) {
      await supabase
        .from('cases')
        .update({ publish_state: 'failed', publish_error: problems.join('\n') })
        .eq('id', caseId);
      return json({ error: '게시할 수 없는 내용이 있습니다.', problems }, 422);
    }

    await supabase
      .from('cases')
      .update({
        publish_state: 'checking',
        publish_error: null,
        publish_started_at: new Date().toISOString(),
      })
      .eq('id', caseId);

    // --- 4. 사진 내려받기 ------------------------------------------------
    const slug = record.slug;
    const order = usedPhotoPaths(blocks);
    const nameOf = new Map<string, string>();
    const files: { path: string; base64: string }[] = [];

    for (let i = 0; i < order.length; i += 1) {
      const storagePath = order[i];
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(storagePath);
      if (error || !blob) {
        throw new Error(`사진을 불러오지 못했습니다 (${i + 1}번째). 사진함에서 지워졌을 수 있습니다.`);
      }
      const ext = (storagePath.split('.').pop() ?? 'jpg').toLowerCase();
      const name = `img-${String(i + 1).padStart(2, '0')}.${ext}`;
      nameOf.set(storagePath, name);
      files.push({
        path: `${IMAGES_DIR}/${slug}/${name}`,
        base64: base64FromBuffer(await blob.arrayBuffer()),
      });
    }

    // --- 5. 마크다운 만들기 ----------------------------------------------
    const markdown = buildMarkdownFile(record, (p) => nameOf.get(p));
    files.push({
      path: `${CASES_DIR}/${slug}.md`,
      base64: base64FromBuffer(new TextEncoder().encode(markdown).buffer as ArrayBuffer),
    });

    // --- 6. GitHub ------------------------------------------------------
    const token = Deno.env.get('GITHUB_TOKEN');
    const repo = Deno.env.get('GITHUB_REPO');
    const baseBranch = Deno.env.get('GITHUB_BRANCH') ?? 'main';
    if (!token || !repo) throw new Error('GitHub 설정이 없습니다. Secret 을 확인해주세요.');

    const gh = async (path: string, init?: RequestInit) => {
      const res = await fetch(`${GITHUB_API}/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'kidari-cms',
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        // 토큰이 메시지에 섞여 나가지 않도록 상태코드와 경로만 남깁니다.
        throw new Error(`GitHub ${init?.method ?? 'GET'} ${path} 실패 (${res.status}): ${text.slice(0, 300)}`);
      }
      return res.json();
    };

    const ref = await gh(`repos/${repo}/git/ref/heads/${baseBranch}`);
    const baseSha = ref.object.sha as string;

    // 같은 주소를 쓰는 글이 이미 저장소에 있는지 (자기 자신이 올린 것은 제외)
    const alreadyPublished = record.status === 'published';
    if (!alreadyPublished) {
      const check = await fetch(
        `${GITHUB_API}/repos/${repo}/contents/${CASES_DIR}/${slug}.md?ref=${baseBranch}`,
        { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'kidari-cms' } }
      );
      if (check.ok) {
        throw new Error(`같은 공개 주소(${slug})를 쓰는 글이 이미 있습니다. 주소를 바꿔주세요.`);
      }
    }

    // 다시 게시하는 경우, 더는 쓰지 않는 사진 파일을 지웁니다.
    const tree: Record<string, unknown>[] = [];
    if (alreadyPublished) {
      const baseTree = await gh(`repos/${repo}/git/trees/${baseSha}?recursive=1`);
      const keep = new Set(files.map((f) => f.path));
      for (const node of baseTree.tree ?? []) {
        if (
          node.type === 'blob' &&
          String(node.path).startsWith(`${IMAGES_DIR}/${slug}/`) &&
          !keep.has(node.path)
        ) {
          tree.push({ path: node.path, mode: '100644', type: 'blob', sha: null });
        }
      }
    }

    for (const f of files) {
      const blob = await gh(`repos/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: f.base64, encoding: 'base64' }),
      });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const treeRes = await gh(`repos/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseSha, tree }),
    });

    const commit = await gh(`repos/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: `${alreadyPublished ? '시공사례 수정' : '시공사례 게시'}: ${record.title}`,
        tree: treeRes.sha,
        parents: [baseSha],
      }),
    });

    // 게시용 임시 브랜치. Actions 가 검증 후 main 에 반영하고 지웁니다.
    const branch = `publish/${slug}-${Date.now()}`;
    await gh(`repos/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });

    // --- 7. 상태 기록 -----------------------------------------------------
    await supabase
      .from('cases')
      .update({
        publish_state: 'verifying',
        publish_branch: branch,
        publish_commit: commit.sha,
        publish_error: null,
      })
      .eq('id', caseId);

    return json({
      ok: true,
      state: 'verifying',
      branch,
      commit: commit.sha,
      files: files.length,
      slug,
    });
  } catch (e) {
    const message = (e as Error).message ?? '알 수 없는 오류';
    if (admin && caseId) {
      await admin
        .from('cases')
        .update({ publish_state: 'failed', publish_error: message })
        .eq('id', caseId);
    }
    return json({ error: message }, 500);
  }
});
