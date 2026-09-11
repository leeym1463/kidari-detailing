import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

// 사용법: node scripts/fetch-post-images.mjs <추출 json> <저장 디렉터리> <접두어> <인덱스,쉼표구분> [시작번호]
const [jsonPath, outDir, prefix, idxArg, startArg] = process.argv.slice(2);
const indices = idxArg.split(',').map((n) => Number(n.trim()));
const start = Number(startArg || 1);

const items = JSON.parse(readFileSync(jsonPath, 'utf-8'));
const images = items.filter((i) => i.type === 'image').map((i) => i.src);

mkdirSync(outDir, { recursive: true });

for (let i = 0; i < indices.length; i++) {
  const src = images[indices[i]];
  if (!src) {
    console.log(`  [skip] index ${indices[i]} 없음`);
    continue;
  }
  const res = await fetch(src, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://blog.naver.com/' },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const name = `${prefix}${String(start + i).padStart(2, '0')}.jpg`;
  writeFileSync(path.join(outDir, name), buf);
  console.log(`  ${name} <- IMG[${indices[i]}] (${buf.length} bytes)`);
}
