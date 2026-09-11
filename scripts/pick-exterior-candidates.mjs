import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// 각 사례의 원본 글에서 외관 사진 후보(첫 가로형 = 입고, 마지막 가로형 = 출고)를 내려받습니다.
// 이미 사례 폴더에 있는 사진과 동일하면 중복으로 표시합니다.
const dimsDir = process.argv[2];
const outRoot = process.argv[3];

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

const report = {};

for (const f of readdirSync(dimsDir).filter((f) => f.endsWith('.json'))) {
  const slug = f.replace('.json', '');
  const items = JSON.parse(readFileSync(path.join(dimsDir, f), 'utf-8'));
  const imgs = items.filter((i) => i.type === 'image');
  const land = imgs.filter((i) => i.landscape);
  if (land.length === 0) {
    report[slug] = { skipped: '가로형 이미지 없음', total: imgs.length };
    continue;
  }

  // 기존 사례 이미지 해시
  const caseDir = `public/images/cases/${slug}`;
  const existing = new Set();
  if (existsSync(caseDir)) {
    for (const g of readdirSync(caseDir)) {
      existing.add(md5(readFileSync(path.join(caseDir, g))));
    }
  }

  const picks = [
    { role: 'before', item: land[0] },
    { role: 'after', item: land[land.length - 1] },
  ];

  const outDir = path.join(outRoot, slug);
  mkdirSync(outDir, { recursive: true });

  const rows = [];
  for (const p of picks) {
    const res = await fetch(p.item.src, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://blog.naver.com/' },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = md5(buf);
    const file = path.join(outDir, `${p.role}.jpg`);
    writeFileSync(file, buf);
    rows.push({
      role: p.role,
      index: p.item.index,
      size: `${p.item.width}x${p.item.height}`,
      bytes: buf.length,
      duplicate: existing.has(hash),
    });
    await new Promise((r) => setTimeout(r, 150));
  }
  report[slug] = { total: imgs.length, landscape: land.length, picks: rows };
}

writeFileSync(path.join(outRoot, '_report.json'), JSON.stringify(report, null, 2), 'utf-8');

for (const [slug, r] of Object.entries(report)) {
  if (r.skipped) {
    console.log(`${slug.padEnd(38)} SKIP (${r.skipped})`);
    continue;
  }
  const b = r.picks.find((p) => p.role === 'before');
  const a = r.picks.find((p) => p.role === 'after');
  console.log(
    `${slug.padEnd(38)} before=IMG[${b.index}]${b.duplicate ? '(중복)' : ''}  after=IMG[${a.index}]${a.duplicate ? '(중복)' : ''}`
  );
}
