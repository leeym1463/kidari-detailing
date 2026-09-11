import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import path from 'path';

// 확인을 마친 외관 사진(입고/출고)을 각 시공사례에 추가합니다.
// before/after 파일은 스크랩 디렉터리에 미리 받아둔 것을 사용합니다.
const extRoot = process.argv[2];
const altRoot = process.argv[3];

// slug -> { before?: 소스경로, after: 소스경로 }
const plan = {
  'coating-07-2025-05-14': { after: `${extRoot}/coating-07-2025-05-14/after.jpg` },
  'coating-08-2025-02-17-g80': {
    before: `${extRoot}/coating-08-2025-02-17-g80/before.jpg`,
    after: `${extRoot}/coating-08-2025-02-17-g80/after.jpg`,
  },
  'coating-10-2023-11-10-glc': { after: `${extRoot}/coating-10-2023-11-10-glc/after.jpg` },
  'gwangtaek-01-2026-08-22': { after: `${extRoot}/gwangtaek-01-2026-08-22/after.jpg` },
  'gwangtaek-02-2026-08-21': { after: `${extRoot}/gwangtaek-02-2026-08-21/after.jpg` },
  'gwangtaek-03-2026-08-10': {
    before: `${extRoot}/gwangtaek-03-2026-08-10/before.jpg`,
    after: `${extRoot}/gwangtaek-03-2026-08-10/after.jpg`,
  },
  'gwangtaek-05-2026-06-26-sonata': { after: `${extRoot}/gwangtaek-05-2026-06-26-sonata/after.jpg` },
  'gwangtaek-06-2025-12-10-grandeur': {
    before: `${extRoot}/gwangtaek-06-2025-12-10-grandeur/before.jpg`,
    after: `${extRoot}/gwangtaek-06-2025-12-10-grandeur/after.jpg`,
  },
  'gwangtaek-09-2024-09-24-ev9': { after: `${extRoot}/gwangtaek-09-2024-09-24-ev9/after.jpg` },
  'gwangtaek-10-2026-09-02-bmw7series': { after: `${extRoot}/gwangtaek-10-2026-09-02-bmw7series/after.jpg` },
  'restoration-01-2026-05-28': { after: `${extRoot}/restoration-01-2026-05-28/after.jpg` },
  'restoration-02-2021-12-21': { after: `${extRoot}/restoration-02-2021-12-21/after.jpg` },
  'restoration-03-2021-03-21': { after: `${extRoot}/restoration-03-2021-03-21/after.jpg` },
  'restoration-04-2020-12-05': { after: `${extRoot}/restoration-04-2020-12-05/after.jpg` },
  'restoration-05-2020-09-13': { after: `${extRoot}/restoration-05-2020-09-13/after.jpg` },
  'restoration-06-2020-03-16': { after: `${altRoot}/restoration-06/x01.jpg` },
  'restoration-07-2020-01-10-gla': { after: `${extRoot}/restoration-07-2020-01-10-gla/after.jpg` },
  'restoration-08-2019-12-05': { after: `${extRoot}/restoration-08-2019-12-05/after.jpg` },
  'restoration-09-2019-11-30': { after: `${extRoot}/restoration-09-2019-11-30/after.jpg` },
  'restoration-10-2019-10-26': { after: `${extRoot}/restoration-10-2019-10-26/after.jpg` },
  'steam-09-2025-03-12': { after: `${extRoot}/steam-09-2025-03-12/after.jpg` },
};

// 사진마다 실제 확인한 내용을 반영한 설명. {v}는 차종으로 치환됩니다.
const captions = {
  default: { before: '입고 당시 {v} 외관', after: '시공을 마친 {v} 외관' },
  'gwangtaek-01-2026-08-22': { after: '광택 시공을 마친 {v} 측면 도장면' },
  'gwangtaek-09-2024-09-24-ev9': { after: '광택 시공 후 {v} 루프에 비친 반사' },
  'gwangtaek-10-2026-09-02-bmw7series': { after: '광택·유리막코팅을 마친 {v} 보닛의 반사' },
  'restoration-02-2021-12-21': { after: '복원 작업을 마친 도장면에 비친 조명 반사' },
  'restoration-08-2019-12-05': { after: '복원을 마친 {v} 측면 도장면' },
};

for (const [slug, files] of Object.entries(plan)) {
  const mdPath = `src/content/cases/${slug}.md`;
  let md = readFileSync(mdPath, 'utf-8');
  const vehicle = (md.match(/^vehicle:\s*"(.*)"/m) || [])[1] || '차량';

  if (md.includes('### 입고 · 출고 외관') || md.includes('### 시공 완료 후 외관')) {
    console.log(`[skip] ${slug} — 이미 외관 섹션 있음`);
    continue;
  }

  const caseDir = `public/images/cases/${slug}`;
  const nums = readdirSync(caseDir)
    .map((f) => Number((f.match(/img-(\d+)\.jpg/) || [])[1]))
    .filter((n) => !Number.isNaN(n));
  let next = Math.max(0, ...nums) + 1;

  const cap = { ...captions.default, ...(captions[slug] || {}) };
  const lines = [];
  lines.push('', files.before ? '### 입고 · 출고 외관' : '### 시공 완료 후 외관', '');

  if (files.before) {
    const name = `img-${String(next++).padStart(2, '0')}.jpg`;
    copyFileSync(files.before, path.join(caseDir, name));
    lines.push(`![${cap.before.replace('{v}', vehicle)}](/images/cases/${slug}/${name})`, '');
  }

  const afterName = `img-${String(next++).padStart(2, '0')}.jpg`;
  copyFileSync(files.after, path.join(caseDir, afterName));
  lines.push(`![${cap.after.replace('{v}', vehicle)}](/images/cases/${slug}/${afterName})`, '');

  writeFileSync(mdPath, md.replace(/\s*$/, '\n') + lines.join('\n').replace(/\n+$/, '\n'), 'utf-8');
  console.log(`[ok] ${slug} (${vehicle}) — ${files.before ? '입고+출고 2장' : '출고 1장'} 추가`);
}
