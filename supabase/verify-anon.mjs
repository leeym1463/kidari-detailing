// 비로그인(anon) 권한 차단 검증.
// 마이그레이션(0001, 0002) 적용 후 실행하세요:  node supabase/verify-anon.mjs
//
// 기대 결과: 모든 항목이 "차단". 하나라도 "통과"면 RLS에 구멍이 있는 것입니다.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const anon = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const checks = [
  ['cases 읽기', () => anon.from('cases').select('id').limit(1)],
  ['cases 쓰기', () => anon.from('cases').insert({ slug: 'anon-' + Date.now(), title: 'x', category: '스팀세차' })],
  ['cases 삭제', () => anon.from('cases').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
  ['photos 읽기', () => anon.from('photos').select('id').limit(1)],
  ['photos 쓰기', () => anon.from('photos').insert({ storage_path: 'temp/anon-' + Date.now() + '.webp' })],
  ['admins 조회', () => anon.from('admins').select('user_id')],
  ['Storage 업로드', () =>
    anon.storage.from('case-photos').upload('temp/anon-' + Date.now() + '.webp', new Blob([new Uint8Array([1, 2, 3])]))],
  ['Storage 목록', () => anon.storage.from('case-photos').list('temp')],
  ['Storage 삭제', () => anon.storage.from('case-photos').remove(['temp/whatever.webp'])],
];

let leaks = 0;
console.log('\n비로그인 권한 차단 검증\n');
for (const [name, fn] of checks) {
  const r = await fn();
  const blocked = !!r.error || (Array.isArray(r.data) && r.data.length === 0);
  if (!blocked) leaks += 1;
  console.log(
    `  ${blocked ? '차단 ✅' : '통과 ⚠️'}  ${name.padEnd(16)} ${r.error ? '— ' + r.error.message.slice(0, 70) : ''}`
  );
}
console.log(leaks === 0 ? '\n결과: 모두 차단됨 ✅\n' : `\n결과: ${leaks}건이 차단되지 않음 — RLS 점검 필요 ⚠️\n`);
process.exit(leaks === 0 ? 0 : 1);
