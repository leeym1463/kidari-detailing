import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

// case_map.json의 모든 글 HTML을 내려받습니다. 이미 받은 파일은 건너뜁니다.
const mapPath = process.argv[2];
const outDir = process.argv[3];

const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
mkdirSync(outDir, { recursive: true });

for (const [slug, info] of Object.entries(map)) {
  const dest = path.join(outDir, `${slug}.html`);
  if (existsSync(dest)) {
    console.log(`[skip] ${slug}`);
    continue;
  }
  const url = `https://blog.naver.com/PostView.naver?blogId=kidari8983&logNo=${info.logNo}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const html = await res.text();
  writeFileSync(dest, html, 'utf-8');
  console.log(`[ok] ${slug} (${html.length} bytes)`);
  await new Promise((r) => setTimeout(r, 300));
}
