import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';

// 시공사례의 date와 블로그 글의 작성일을 1:1로 맞춰 logNo를 찾습니다.
// 제목이 비슷한 글이 많아 제목 기반 매칭은 오매칭이 발생하므로 날짜를 기준으로 합니다.
const listDir = process.argv[2];
const outPath = process.argv[3];

const BS = String.fromCharCode(92);
const Q = String.fromCharCode(39);

const byDate = new Map();
for (const f of readdirSync(listDir).filter((f) => /^list_\d+\.json$/.test(f))) {
  let raw = readFileSync(path.join(listDir, f), 'utf-8').split(BS + Q).join(Q);
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    continue;
  }
  for (const it of j.postList || []) {
    const d = (it.addDate || '').replace(/\s/g, '').replace(/\.$/, ''); // 2026.9.2
    const title = decodeURIComponent((it.title || '').replace(/\+/g, ' ')).replace(/&quot;/g, '"');
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({ logNo: String(it.logNo), title, date: d });
  }
}

const caseDir = 'src/content/cases';
const result = {};
const problems = [];

for (const f of readdirSync(caseDir).filter((f) => f.endsWith('.md') && !f.startsWith('template'))) {
  const slug = f.replace('.md', '');
  const s = readFileSync(path.join(caseDir, f), 'utf-8');
  const title = (s.match(/^title:\s*"(.*)"/m) || [])[1] || '';
  const cd = (s.match(/^date:\s*(.*)$/m) || [])[1].trim();
  const [y, m, d] = cd.split('-').map(Number);
  const key = `${y}.${m}.${d}`;

  const candidates = byDate.get(key) || [];
  if (candidates.length === 1) {
    result[slug] = { logNo: candidates[0].logNo, blogTitle: candidates[0].title, blogDate: key, how: 'date' };
  } else if (candidates.length > 1) {
    problems.push({ slug, title, key, candidates: candidates.map((c) => `${c.logNo}:${c.title}`) });
  } else {
    problems.push({ slug, title, key, candidates: [] });
  }
}

writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`날짜 매칭 성공: ${Object.keys(result).length}건`);
for (const p of problems) {
  console.log(`[확인필요] ${p.slug} (${p.key}) "${p.title}"`);
  for (const c of p.candidates) console.log(`    - ${c}`);
}
