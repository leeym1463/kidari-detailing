// 미리보기와 실제 게시물이 어긋나지 않는지 검사합니다.
//
// 마크다운을 만드는 코드가 두 곳에 있습니다.
//   · src/lib/blocks-render.ts            브라우저(미리보기)
//   · supabase/functions/_shared/render.ts  Edge Function(게시)
// Edge Function 은 Deno 라 브라우저 쪽 파일을 그대로 불러올 수 없어
// 같은 규칙을 두 번 적었습니다. 한쪽만 고치면 미리보기와 실제 글이 달라집니다.
//
// 이 스크립트는 같은 블록을 두 구현에 넣어 결과가 똑같은지 확인합니다.
//   node scripts/check-render-parity.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

async function loadTs(file) {
  // bundle: true 로 묶어야 상대 경로 import(./admin-ui 등)가 함께 들어갑니다.
  const out = await esbuild.build({
    entryPoints: [file],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    loader: { '.ts': 'ts' },
    // Edge Function 쪽은 jsr: 같은 Deno 전용 모듈을 쓸 수 있어 건드리지 않습니다.
    external: ['jsr:*', 'npm:*', 'https://*'],
  });
  const tmp = path.join(os.tmpdir(), `parity-${path.basename(file)}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, out.outputFiles[0].text);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const BLOCKS = [
  { type: 'paragraph', text: '보닛과 루프에 **스월마크**가 많았습니다. [블로그](https://blog.naver.com/x) 참고.', align: 'left' },
  { type: 'heading', text: '시공 전 상태' },
  { type: 'image', path: 'temp/a.webp', alt: '보닛 근접' },
  { type: 'image', path: 'temp/b.jpg', caption: '설명만 있는 사진' },
  { type: 'imageGroup', items: [{ path: 'temp/c.webp', alt: '좌측' }, { path: 'temp/d.jpg' }] },
  { type: 'beforeAfter', before: 'temp/e.webp', after: 'temp/f.jpg', caption: '운전석 도어' },
  { type: 'beforeAfter', before: 'temp/g.webp', after: 'temp/h.jpg' },
  { type: 'divider' },
  { type: 'paragraph', text: '마무리 문단입니다.\n줄바꿈도 있습니다.' },
  // 비어 있는 블록은 양쪽 모두 건너뛰어야 합니다.
  { type: 'paragraph', text: '   ' },
  { type: 'image', path: '' },
];

const SLUG = 'grandeur-ig-coating-2026-11-04';
const NAMES = {
  'temp/a.webp': 'img-01.webp',
  'temp/b.jpg': 'img-02.jpg',
  'temp/c.webp': 'img-03.webp',
  'temp/d.jpg': 'img-04.jpg',
  'temp/e.webp': 'img-05.webp',
  'temp/f.jpg': 'img-06.jpg',
  'temp/g.webp': 'img-07.webp',
  'temp/h.jpg': 'img-08.jpg',
};
const resolve = (p) => NAMES[p];

const browser = await loadTs('src/lib/blocks-render.ts');
const edge = await loadTs('supabase/functions/_shared/render.ts');

let failed = 0;
const check = (name, a, b) => {
  if (a === b) {
    console.log(`  일치 ✅  ${name}`);
    return;
  }
  failed += 1;
  console.log(`  불일치 ❌ ${name}`);
  const al = String(a).split('\n');
  const bl = String(b).split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i += 1) {
    if (al[i] !== bl[i]) {
      console.log(`      ${i + 1}행`);
      console.log(`        브라우저: ${JSON.stringify(al[i])}`);
      console.log(`        게시기능: ${JSON.stringify(bl[i])}`);
      break;
    }
  }
};

console.log('미리보기 ↔ 게시 마크다운 일치 검사\n');

check('마크다운 본문', browser.blocksToMarkdown(BLOCKS, SLUG, resolve), edge.blocksToMarkdown(BLOCKS, SLUG, resolve));
check(
  '슬라이더 마크업(캡션 있음)',
  browser.sliderHtml('/a.jpg', '/b.jpg', '운전석 도어'),
  edge.sliderHtml('/a.jpg', '/b.jpg', '운전석 도어')
);
check('슬라이더 마크업(캡션 없음)', browser.sliderHtml('/a.jpg', '/b.jpg'), edge.sliderHtml('/a.jpg', '/b.jpg'));
check(
  'HTML 이스케이프',
  browser.sliderHtml('/a.jpg', '/b.jpg', '따옴표 " 와 <태그>'),
  edge.sliderHtml('/a.jpg', '/b.jpg', '따옴표 " 와 <태그>')
);

const RECORD = {
  slug: SLUG,
  title: '큰따옴표 \" 가 있는 제목',
  category: '광택·유리막코팅',
  case_date: '2026-11-04',
  vehicle: '그랜저 IG',
  summary: '요약입니다.',
  before_condition: null,
  work_performed: ['1단계 광택', '유리막코팅'],
  duration: null,
  price_note: '55만원',
  content_blocks: BLOCKS,
};
check('파일 전체(frontmatter 포함)', browser.buildMarkdownFile(RECORD, resolve), edge.buildMarkdownFile(RECORD, resolve));

console.log('');
if (failed > 0) {
  console.error(`${failed}건 불일치. 두 파일을 같게 맞춰주세요.`);
  process.exit(1);
}
console.log('두 구현의 결과가 같습니다.');
