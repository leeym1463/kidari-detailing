import fs from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import type { CaseCategory } from '../data/categories';

export type CaseEntry = CollectionEntry<'cases'>;

// 카드 목록의 대표 사진. public/images/cases/<slug>/ 안의 첫 번째 이미지를 그대로 씁니다
// (마이그레이션 스크립트가 img-01, img-02... 순서로 저장해두었으므로 첫 장이 대표 이미지가 됩니다).
export function getHeroImagePath(slug: string): string | null {
  const dir = path.join(process.cwd(), 'public', 'images', 'cases', slug);
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort();
    return files.length > 0 ? `/images/cases/${slug}/${files[0]}` : null;
  } catch {
    return null;
  }
}

export async function getPublishedCases(): Promise<CaseEntry[]> {
  const entries = await getCollection('cases', ({ data }) => !data.draft);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedCasesByCategory(category: CaseCategory): Promise<CaseEntry[]> {
  const all = await getPublishedCases();
  return all.filter((entry) => entry.data.category === category);
}
