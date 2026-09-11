import { readFileSync } from 'fs';

// 사용법: node scripts/show-post-tail.mjs <추출된 json 경로> [보여줄 줄 수]
const jsonPath = process.argv[2];
const tailCount = Number(process.argv[3] || 14);

const items = JSON.parse(readFileSync(jsonPath, 'utf-8'));
const total = items.filter((i) => i.type === 'image').length;

let idx = 0;
const lines = [];
for (const it of items) {
  if (it.type === 'image') {
    lines.push(`IMG[${idx}]`);
    idx++;
  } else if (it.text.trim() !== '​' && it.text.trim() !== '') {
    lines.push('TXT: ' + it.text);
  }
}

console.log(`총 이미지: ${total}장`);
console.log(lines.slice(-tailCount).join('\n'));
