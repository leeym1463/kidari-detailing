import { readFileSync, writeFileSync } from 'fs';

// 본문 이미지의 URL과 원본 크기(data-width/height)를 함께 추출합니다.
// 외관 사진(가로형 전체샷) 후보를 고르는 데 사용합니다.
const htmlPath = process.argv[2];
const outPath = process.argv[3];

const html = readFileSync(htmlPath, 'utf-8');
const mainStart = html.indexOf('se-main-container');
const main = mainStart >= 0 ? html.slice(mainStart) : html;

const items = [];
const re =
  /<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>|<img[^>]*class="[^"]*se-image-resource[^"]*"[^>]*>/g;

let m;
let imgIndex = 0;
while ((m = re.exec(main)) !== null) {
  if (m[1] !== undefined) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (text && text !== '​') items.push({ type: 'text', text });
  } else {
    const tag = m[0];
    const lazy = tag.match(/data-lazy-src="([^"]+)"/);
    const src = tag.match(/src="([^"]+)"/);
    const w = Number((tag.match(/data-width="(\d+)"/) || [])[1] || 0);
    const h = Number((tag.match(/data-height="(\d+)"/) || [])[1] || 0);
    const url = (lazy && lazy[1]) || (src && src[1]);
    if (url) {
      items.push({
        type: 'image',
        index: imgIndex++,
        src: url.replace('type=w80_blur', 'type=w966'),
        width: w,
        height: h,
        landscape: w > 0 && h > 0 && w / h >= 1.2,
      });
    }
  }
}

writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf-8');

const imgs = items.filter((i) => i.type === 'image');
const land = imgs.filter((i) => i.landscape);
console.log(
  `이미지 ${imgs.length}장 | 가로형 ${land.length}장 | 가로형 인덱스: ${land.map((i) => i.index).join(',')}`
);
