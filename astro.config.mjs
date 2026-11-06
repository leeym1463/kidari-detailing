import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// sitemap.xml, robots.txt, canonical URL, JSON-LD의 url 값이 모두 이 값을 기준으로 생성됩니다.
const SITE_URL = 'https://kidari-detailing.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  // 'file' 로 두면 /cases/<슬러그>.html 로 만들어져서
  // Cloudflare Pages 가 슬래시 없는 주소를 그대로 200 으로 응답합니다.
  // 기본값 'directory' 는 폴더/index.html 을 만들어 308 리다이렉트가 생기고,
  // 그러면 canonical·sitemap 주소(슬래시 없음)와 어긋납니다.
  build: { format: 'file' },
  // 관리자 화면과 404 페이지는 색인 대상이 아니므로 사이트맵에서 제외합니다.
  integrations: [
    sitemap({ filter: (page) => !page.includes('/admin') && !page.includes('/404') }),
  ],
});
