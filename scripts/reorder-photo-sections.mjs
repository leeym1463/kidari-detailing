import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';

// 본문 맨 끝에 덧붙인 사진 섹션을, 마무리 인사말 "앞"으로 옮깁니다.
// 글이 인사로 끝난 뒤 사진이 또 나오는 어색한 배치를 바로잡기 위한 것입니다.
// --apply 를 붙이지 않으면 미리보기만 출력합니다.
const apply = process.argv.includes('--apply');

const SECTION_RE = /\n### (시공 완료 후 사진|시공 완료 후 외관|입고 · 출고 외관)\n[\s\S]*$/;

// 마무리 인사말로 볼 수 있는 표현
const CLOSING_HINTS = [
  '감사드립니다',
  '감사합니다',
  '노력하겠습니다',
  '되겠습니다',
  '보답해드리겠습니다',
  '문의 주세요',
  '문의해 주세요',
];

const dir = 'src/content/cases';
const results = [];

for (const f of readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('template'))) {
  const p = path.join(dir, f);
  const src = readFileSync(p, 'utf-8');
  const m = src.match(SECTION_RE);
  if (!m) continue;

  const section = m[0].replace(/^\n+/, '').replace(/\s*$/, '');
  const head = src.slice(0, m.index).replace(/\s*$/, '');

  // 본문 마지막 문단에서 인사말 부분만 분리합니다.
  // 앞 사진을 설명하는 문장("…후면부 모습입니다")이 섞여 있으면 그 문장은 제자리에 둡니다.
  const paras = head.split(/\n{2,}/);
  const last = paras[paras.length - 1].trim();

  if (last.startsWith('![') || !CLOSING_HINTS.some((h) => last.includes(h))) {
    results.push({ file: f, action: 'skip', reason: '마지막 문단에 인사말이 없음' });
    continue;
  }

  const sentences = last.match(/[^.!?]+[.!?]*/g) || [last];
  const startsSignoff = (s) =>
    /^(저희|앞으로도|항상|끝으로|많은|춘천\s?\S*\s?(전문점|전문|키다리))/.test(s.trim()) ||
    CLOSING_HINTS.some((h) => s.includes(h));

  let cut = sentences.findIndex(startsSignoff);
  if (cut === -1) cut = sentences.length;

  const keep = sentences.slice(0, cut).join('').trim(); // 사진 설명 등 제자리 유지
  const closing = sentences.slice(cut).join('').trim(); // 인사말 → 사진 뒤로

  if (!closing) {
    results.push({ file: f, action: 'skip', reason: '분리할 인사말 없음' });
    continue;
  }

  const bodyParas = paras.slice(0, -1);
  if (keep) bodyParas.push(keep);
  const body = bodyParas.join('\n\n').replace(/\s*$/, '');
  const next = `${body}\n\n${section}\n\n${closing}\n`;

  results.push({ file: f, action: 'move', closing: closing.slice(0, 40), kept: keep.slice(0, 30) });
  if (apply) writeFileSync(p, next, 'utf-8');
}

const moved = results.filter((r) => r.action === 'move');
const skipped = results.filter((r) => r.action === 'skip');

console.log(`${apply ? '적용' : '미리보기'} — 옮길 글 ${moved.length}건 / 건너뜀 ${skipped.length}건\n`);
for (const r of moved) console.log(`  [이동] ${r.file.replace('.md', '')}  (뒤로 보낼 인사말: "${r.closing}…")`);
if (skipped.length) {
  console.log('');
  for (const r of skipped) console.log(`  [유지] ${r.file.replace('.md', '')} — ${r.reason}`);
}
