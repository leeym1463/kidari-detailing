import { readFileSync, writeFileSync } from 'fs';

const htmlPath = process.argv[2];
const outPath = process.argv[3];

const html = readFileSync(htmlPath, 'utf-8');

const mainStart = html.indexOf('se-main-container');
const main = mainStart >= 0 ? html.slice(mainStart) : html;

const items = [];
// 본문 텍스트 단락과 이미지를 등장 순서대로 수집합니다.
const re = /<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>|<img[^>]*class="[^"]*se-image-resource[^"]*"[^>]*>/g;

let m;
while ((m = re.exec(main)) !== null) {
  if (m[1] !== undefined) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    if (text) items.push({ type: 'text', text });
  } else {
    const tag = m[0];
    // data-lazy-src가 원본 해상도(w966), src는 흐린 플레이스홀더입니다.
    const lazy = tag.match(/data-lazy-src="([^"]+)"/);
    const src = tag.match(/src="([^"]+)"/);
    const url = (lazy && lazy[1]) || (src && src[1]);
    if (url) items.push({ type: 'image', src: url.replace('type=w80_blur', 'type=w966') });
  }
}

writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf-8');
console.log('extracted items:', items.length, '| images:', items.filter((i) => i.type === 'image').length);
