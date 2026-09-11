import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';

// 시공사례 md의 title을 네이버 블로그 글 목록과 매칭해 logNo를 찾습니다.
// 사용법: node scripts/map-cases-to-posts.mjs <목록json 디렉터리> <출력 json>
const listDir = process.argv[2];
const outPath = process.argv[3];

const BS = String.fromCharCode(92);
const Q = String.fromCharCode(39);

function norm(s) {
  return s
    .replace(/[\s!?~^,.()（）[\]{}·・:;'"“”‘’\-+/]/g, '')
    .replace(/시공기|시공후기|후기/g, '')
    .toLowerCase();
}

// 1) 블로그 글 목록 수집
const posts = [];
for (const f of readdirSync(listDir).filter((f) => /^list_\d+\.json$/.test(f))) {
  let raw = readFileSync(path.join(listDir, f), 'utf-8').split(BS + Q).join(Q);
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    continue;
  }
  for (const it of j.postList || []) {
    posts.push({
      logNo: String(it.logNo),
      date: it.addDate,
      title: decodeURIComponent((it.title || '').replace(/\+/g, ' ')),
    });
  }
}

// 2) 사례 md 읽기
const caseDir = 'src/content/cases';
const cases = readdirSync(caseDir)
  .filter((f) => f.endsWith('.md') && !f.startsWith('template'))
  .map((f) => {
    const s = readFileSync(path.join(caseDir, f), 'utf-8');
    const title = (s.match(/^title:\s*"(.*)"/m) || [])[1] || '';
    const date = (s.match(/^date:\s*(.*)$/m) || [])[1] || '';
    return { slug: f.replace('.md', ''), title, date: date.trim() };
  });

// 3) 매칭: 정규화 후 포함관계 + 날짜 근접도
const result = {};
const unmatched = [];
for (const c of cases) {
  const nc = norm(c.title);
  let best = null;
  let bestScore = 0;
  for (const p of posts) {
    const np = norm(p.title);
    let score = 0;
    if (np === nc) score = 100;
    else if (np.includes(nc) || nc.includes(np)) score = 80;
    else {
      // 공통 문자 비율
      const common = [...new Set(nc)].filter((ch) => np.includes(ch)).length;
      score = (common / Math.max(nc.length, 1)) * 50;
    }
    // 날짜 일치 보너스
    const pd = (p.date || '').replace(/[.\s]/g, '-').replace(/-+$/, '');
    const cd = c.date.replace(/-0/g, '-');
    if (pd && cd && pd === cd) score += 25;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (best && bestScore >= 70) {
    result[c.slug] = { logNo: best.logNo, blogTitle: best.title, blogDate: best.date, score: bestScore };
  } else {
    unmatched.push({ slug: c.slug, title: c.title, best: best && best.title, score: Math.round(bestScore) });
  }
}

writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`블로그 글 수집: ${posts.length}건`);
console.log(`매칭 성공: ${Object.keys(result).length}건 / ${cases.length}건`);
if (unmatched.length) {
  console.log('--- 미매칭 ---');
  for (const u of unmatched) console.log(`  ${u.slug} | "${u.title}" | 후보: "${u.best}" (${u.score})`);
}
