import type { APIRoute } from 'astro';

// AI 크롤러(GPTBot, ClaudeBot, PerplexityBot 등)를 포함한 모든 크롤러를 허용합니다.
// site 값(astro.config.mjs의 SITE_URL)을 기준으로 sitemap 경로가 자동 생성됩니다.
export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL('sitemap-index.xml', site).toString();

  const body = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: CCBot
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
