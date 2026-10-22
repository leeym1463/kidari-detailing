# 호스팅 이전(Vercel → Cloudflare Pages) 전 처리할 항목

DNS를 실제로 옮기기 **전에** 반드시 해결해야 하는 것들을 기록합니다.
작성 시점: Phase 0.5 (2026-10)

---

## 1. `/cases` 등 경로의 trailing slash 불일치 ⚠️ **이전 전 필수**

### 증상

| 주소 | Vercel (현재 운영) | Cloudflare Pages |
|---|---|---|
| `/cases` | **200 직접 응답** | **308 → `/cases/`** |

리다이렉트를 따라가면 내용은 동일함을 확인했습니다
(`/cases`, `/faq`, `/gwangtaek` 본문 해시 일치).

### 왜 문제인가

- `astro.config.mjs` 가 `trailingSlash: 'never'`
- canonical 태그도 슬래시 없는 형태 (`https://kidari-detailing.com/cases`)
- 그런데 Cloudflare는 `/cases/` 로 보냄
  → **canonical이 가리키는 주소와 실제 제공 주소가 어긋남**
- 모든 내부 링크에 308 홉이 한 번씩 추가됨

원인은 Astro 기본 빌드 형식이 `dist/cases/index.html` 이고,
Cloudflare Pages가 이 구조를 `/cases/` 로 제공하기 때문입니다.

### 해결 방법 (후보)

`astro.config.mjs` 에 한 줄 추가:

```js
build: { format: 'file' }   // dist/cases.html 로 생성 → /cases 로 바로 응답
```

### 적용 전 확인할 것

사이트 전체 빌드 산출물 구조가 바뀌므로 **반드시 회귀 테스트 후 결정**합니다.

- [ ] 45개 공개 페이지 전부 정상 생성되는지
- [ ] sitemap URL 형식이 canonical과 일치하는지
- [ ] 이미지·CSS 등 상대 경로 깨짐 없는지
- [ ] `/cases/<slug>` 상세 페이지 정상 동작
- [ ] Vercel에서도 동일하게 동작하는지 (이전 전까지는 Vercel이 운영)

> Phase 0.5에서는 **기록만** 하고 적용하지 않았습니다.
> iOS 테스트와 분리해 별도 작업으로 진행합니다.

---

## 2. Cloudflare Pages 환경변수

빌드 시점에 필요하므로 **Production / Preview 양쪽 모두** 등록해야 합니다.

| 변수명 | 비고 |
|---|---|
| `PUBLIC_SUPABASE_URL` | 공개값 |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개값 (RLS 전제) |
| `NODE_VERSION` | `22` |

secret / service_role 키는 **절대 여기에 넣지 않습니다.**
서버측 비밀값은 Supabase Edge Function Secret에만 둡니다.

---

## 3. 이전 당일 체크리스트

- [ ] 1번 trailing slash 해결 및 회귀 테스트 완료
- [ ] pages.dev 와 운영 사이트 전 페이지 내용 일치 확인
- [ ] 가비아에서 네임서버 변경 (친구분 계정 필요, 일회성)
- [ ] 이전 후 canonical·sitemap·robots 재확인
- [ ] Google Search Console / Bing / Naver 에서 색인 이상 없는지 모니터링
- [ ] Vercel 프로젝트 정리 (약관상 상업적 이용 불가 플랜이므로 이전 후 정리)
