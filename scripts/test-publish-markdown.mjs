// 게시 기능이 만들 마크다운이 실제로 빌드되는지 확인합니다.
//
// GitHub 없이, Edge Function 과 똑같은 코드로 파일을 만들어
// 운영과 같은 npm run build 를 돌려봅니다.
// 끝나면 만든 파일을 모두 지웁니다.
//
//   node scripts/test-publish-markdown.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const SLUG = 'zz-publish-selftest';
const CASE_FILE = `src/content/cases/${SLUG}.md`;
const IMAGE_DIR = `public/images/cases/${SLUG}`;
const SOURCE_IMAGES = 'public/images/cases/gwangtaek-10-2026-09-02-bmw7series';

function cleanup() {
  fs.rmSync(CASE_FILE, { force: true });
  fs.rmSync(IMAGE_DIR, { recursive: true, force: true });
  fs.rmSync(`dist/cases/${SLUG}`, { recursive: true, force: true });
}

async function loadEdgeRender() {
  const out = await esbuild.build({
    entryPoints: ['supabase/functions/_shared/render.ts'],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    loader: { '.ts': 'ts' },
    external: ['jsr:*', 'npm:*', 'https://*'],
  });
  const tmp = path.join(os.tmpdir(), `publish-render-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, out.outputFiles[0].text);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const CASE_RECORD = {
  slug: SLUG,
  title: '게시 자체점검용 글 "따옴표" 포함',
  category: '광택·유리막코팅',
  case_date: '2026-11-04',
  vehicle: '그랜저 IG',
  summary: '게시 기능이 만드는 마크다운이 실제로 빌드되는지 확인하는 글입니다.',
  before_condition: null, // 작성 화면에서 더는 받지 않는 항목
  work_performed: null,
  duration: null,
  price_note: null,
  content_blocks: [
    { type: 'paragraph', text: '첫 문단입니다. **굵게** 와 [링크](https://blog.naver.com/kidari8983) 를 넣었습니다.' },
    { type: 'image', path: 'p1', alt: '보닛 근접' },
    { type: 'heading', text: '시공 전후 비교' },
    { type: 'beforeAfter', before: 'p2', after: 'p3', caption: '운전석 도어' },
    { type: 'imageGroup', items: [{ path: 'p4', alt: '좌측면' }, { path: 'p5', alt: '우측면' }] },
    { type: 'divider' },
    { type: 'paragraph', text: '마무리 문단입니다.' },
  ],
};

const NAMES = { p1: 'img-01.jpg', p2: 'img-02.jpg', p3: 'img-03.jpg', p4: 'img-04.jpg', p5: 'img-05.jpg' };

function run() {
  return execFileSync('npx', ['astro', 'build'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '통과 ✅' : '실패 ❌'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
};

console.log('게시용 마크다운 빌드 자체점검\n');
cleanup();

try {
  const render = await loadEdgeRender();
  const markdown = render.buildMarkdownFile(CASE_RECORD, (p) => NAMES[p]);

  // 1) 만들어진 내용 확인
  check('frontmatter 시작', markdown.startsWith('---\n'));
  check('제목의 따옴표가 escape 됨', markdown.includes('\\"따옴표\\"'));
  check('빈 항목은 frontmatter 에서 빠짐', !markdown.includes('beforeCondition:') && !markdown.includes('duration:'));
  check('draft: false 포함', markdown.includes('draft: false'));
  check('슬라이더가 본문 안에 들어감', markdown.includes('<figure class="ba-slider">'));
  check(
    '슬라이더 위치가 소제목 뒤',
    markdown.indexOf('### 시공 전후 비교') < markdown.indexOf('ba-slider')
  );
  check('사진 경로가 slug 폴더', (markdown.match(new RegExp(`/images/cases/${SLUG}/img-`, 'g')) ?? []).length === 5);

  // 2) 실제로 파일을 쓰고 빌드
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const sources = fs.readdirSync(SOURCE_IMAGES).filter((f) => /\.jpe?g$/i.test(f)).sort();
  Object.values(NAMES).forEach((name, i) => {
    fs.copyFileSync(path.join(SOURCE_IMAGES, sources[i % sources.length]), path.join(IMAGE_DIR, name));
  });
  fs.writeFileSync(CASE_FILE, markdown);

  const log = run();
  check('빌드 성공', /Complete!/.test(log), (log.match(/(\d+) page\(s\) built/) ?? [])[0] ?? '');

  // 3) 만들어진 공개 페이지 확인
  const pagePath = `dist/cases/${SLUG}/index.html`;
  const exists = fs.existsSync(pagePath);
  check('공개 페이지 생성', exists, pagePath);

  if (exists) {
    const html = fs.readFileSync(pagePath, 'utf8');
    check('제목이 들어감', html.includes('게시 자체점검용 글'));
    check('요약이 들어감', html.includes('실제로 빌드되는지'));
    check('슬라이더 마크업 렌더링', html.includes('class="ba-slider"') && html.includes('ba-range'));
    check('슬라이더 CSS 포함', html.includes('.ba-frame'));
    check('사진 5장 모두 참조', (html.match(new RegExp(`/images/cases/${SLUG}/img-`, 'g')) ?? []).length >= 5);
    check('입고상태 꼭지 숨김', !html.includes('시공 전 상태</h2>'));
    check('목록에도 올라감', fs.readFileSync('dist/cases/index.html', 'utf8').includes(SLUG));
  }
} catch (e) {
  check('예외 없이 완료', false, String(e.message ?? e).slice(0, 300));
} finally {
  cleanup();
  console.log('\n임시 파일 정리 완료');
}

console.log('');
if (failed > 0) {
  console.error(`${failed}건 실패`);
  process.exit(1);
}
console.log('모두 통과 — 게시 기능이 만드는 글은 그대로 빌드됩니다.');
