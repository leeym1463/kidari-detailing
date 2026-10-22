import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// sitemap.xml, robots.txt, canonical URL, JSON-LD의 url 값이 모두 이 값을 기준으로 생성됩니다.
const SITE_URL = 'https://kidari-detailing.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  // 관리자 화면은 색인 대상이 아니므로 사이트맵에서 제외합니다.
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
});
