// =====================================================================
// publish-case — 게시 버튼이 호출하는 Edge Function (Phase 0.5 검토용 초안)
//
// 아직 배포하지 않습니다. Phase 3에서 실제 연결합니다.
//
// 하는 일
//   1. 호출자가 로그인한 관리자인지 확인 (JWT → admins 표 확인)
//   2. cases/photos에서 게시할 내용을 읽음
//   3. 블록 → 마크다운으로 변환
//   4. 마크다운 + 사진들을 GitHub에 "단일 커밋"으로 기록
//   5. 성공 시에만 status를 published로 변경 (실패하면 draft 유지)
//
// 필요한 Secret (Supabase Dashboard → Edge Functions → Secrets 에서 등록)
//   GITHUB_TOKEN  : fine-grained PAT. 이 저장소 / Contents: Read and write 만.
//   GITHUB_REPO   : leeym1463/kidari-detailing
//   GITHUB_BRANCH : main
//
//   ※ 토큰을 코드나 저장소에 넣지 않습니다. 사장님이 대시보드에서 직접 등록합니다.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GITHUB_API = 'https://api.github.com';

interface Block {
  type: 'paragraph' | 'heading' | 'image' | 'imageGroup' | 'beforeAfter' | 'divider';
  text?: string;
  align?: string;
  path?: string;
  alt?: string;
  caption?: string;
  items?: { path: string; alt?: string }[];
  before?: string;
  after?: string;
}

/** 블록 배열을 기존 38건과 같은 형식의 마크다운 본문으로 바꿉니다. */
function blocksToMarkdown(blocks: Block[], slug: string, pathMap: Map<string, string>): string {
  const out: string[] = [];
  const imgPath = (storagePath: string) => pathMap.get(storagePath) ?? storagePath;

  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        out.push(`### ${b.text ?? ''}`);
        break;
      case 'paragraph':
        out.push(b.text ?? '');
        break;
      case 'image':
        out.push(`![${b.alt ?? ''}](/images/cases/${slug}/${imgPath(b.path!)})`);
        break;
      case 'imageGroup':
        for (const it of b.items ?? []) {
          out.push(`![${it.alt ?? ''}](/images/cases/${slug}/${imgPath(it.path)})`);
        }
        break;
      case 'beforeAfter':
        // 공개 페이지의 기존 전후 비교 슬라이더(frontmatter beforeAfter)와 연결됩니다.
        out.push(`![${b.caption ?? '시공 전'}](/images/cases/${slug}/${imgPath(b.before!)})`);
        out.push(`![${b.caption ?? '시공 후'}](/images/cases/${slug}/${imgPath(b.after!)})`);
        break;
      case 'divider':
        out.push('---');
        break;
    }
  }
  return out.join('\n\n');
}

function yamlEscape(s: string): string {
  return (s ?? '').replace(/"/g, '\\"');
}

function buildFrontmatter(c: Record<string, unknown>): string {
  const work = (c.work_performed as string[] | null) ?? [];
  const lines = [
    '---',
    `title: "${yamlEscape(c.title as string)}"`,
    `category: "${c.category}"`,
    `date: ${c.case_date}`,
    `vehicle: "${yamlEscape((c.vehicle as string) ?? '')}"`,
    `summary: "${yamlEscape((c.summary as string) ?? '')}"`,
    `beforeCondition: "${yamlEscape((c.before_condition as string) ?? '')}"`,
    'workPerformed:',
    ...work.map((w) => `  - "${yamlEscape(w)}"`),
    `duration: "${yamlEscape((c.duration as string) ?? '게시글에 별도로 명시되지 않음')}"`,
  ];
  if (c.price_note) lines.push(`priceNote: "${yamlEscape(c.price_note as string)}"`);
  lines.push('draft: false', '---');
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    // --- 1. 관리자 확인 -------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return json({ error: '로그인이 필요합니다' }, 401);

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) return json({ error: '관리자 권한이 없습니다' }, 403);

    // --- 2. 게시할 글 읽기 ----------------------------------------------
    const { caseId } = await req.json();
    const { data: c, error: caseErr } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (caseErr || !c) return json({ error: '글을 찾을 수 없습니다' }, 404);

    const { data: photos } = await supabase
      .from('photos')
      .select('id, storage_path')
      .eq('case_id', caseId);

    // --- 3. 사진 내려받기 + 저장소 경로 부여 -----------------------------
    const files: { path: string; base64: string }[] = [];
    const pathMap = new Map<string, string>(); // storage_path -> img-NN.webp
    let n = 1;

    for (const p of photos ?? []) {
      const { data: blob, error } = await supabase.storage.from('case-photos').download(p.storage_path);
      if (error || !blob) return json({ error: `사진 다운로드 실패: ${p.storage_path}` }, 500);

      const ext = p.storage_path.split('.').pop() ?? 'webp';
      const name = `img-${String(n).padStart(2, '0')}.${ext}`;
      pathMap.set(p.storage_path, name);
      files.push({
        path: `public/images/cases/${c.slug}/${name}`,
        base64: base64FromBuffer(await blob.arrayBuffer()),
      });
      n += 1;
    }

    // --- 4. 마크다운 생성 -----------------------------------------------
    const markdown =
      buildFrontmatter(c) + '\n\n' + blocksToMarkdown((c.content_blocks ?? []) as Block[], c.slug, pathMap) + '\n';
    files.push({
      path: `src/content/cases/${c.slug}.md`,
      base64: base64FromBuffer(new TextEncoder().encode(markdown).buffer as ArrayBuffer),
    });

    // --- 5. GitHub에 단일 커밋 ------------------------------------------
    const token = Deno.env.get('GITHUB_TOKEN')!;
    const repo = Deno.env.get('GITHUB_REPO')!;
    const branch = Deno.env.get('GITHUB_BRANCH') ?? 'main';
    const gh = (path: string, init?: RequestInit) =>
      fetch(`${GITHUB_API}/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      }).then(async (r) => {
        if (!r.ok) throw new Error(`GitHub ${path} 실패: ${r.status} ${await r.text()}`);
        return r.json();
      });

    const ref = await gh(`repos/${repo}/git/ref/heads/${branch}`);
    const baseSha = ref.object.sha;

    const tree = [];
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
        message: `시공사례 게시: ${c.title}`,
        tree: treeRes.sha,
        parents: [baseSha],
      }),
    });

    await gh(`repos/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });

    // --- 6. 커밋 성공 후에만 상태 변경 ----------------------------------
    //      (여기까지 못 오면 글은 draft로 남아 다시 게시할 수 있습니다)
    await supabase
      .from('cases')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', caseId);

    await supabase.from('photos').update({ status: 'published' }).eq('case_id', caseId);

    return json({ ok: true, commit: commit.sha, files: files.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
