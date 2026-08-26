import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// TODO: 실제 배포 도메인으로 교체하세요. (예: https://kidari-gwangtaek.com)
// sitemap.xml, robots.txt, canonical URL, JSON-LD의 url 값이 모두 이 값을 기준으로 생성됩니다.
const SITE_URL = 'https://www.kidari-gwangtaek.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  integrations: [sitemap()],
});
