# iOS Safari 실기기 테스트 체크리스트 (Phase 0.5)

미리보기 주소 (운영 도메인과 완전히 분리된 테스트 주소입니다)

- 로그인 검증 : https://preview-ios-test.kidari-detailing.pages.dev/admin/test-login
- 사진 업로드 : https://preview-ios-test.kidari-detailing.pages.dev/admin/test-upload

> 운영 사이트 `kidari-detailing.com` 은 여전히 Vercel + `main` 기준이며
> 이 테스트의 영향을 받지 않습니다. (검증 완료)

---

## 0. 먼저 해야 할 것 — Cloudflare 환경변수

현재 미리보기 빌드에는 환경변수가 **들어가 있지 않습니다.**
배포된 번들을 확인한 결과 두 값이 `void 0` 으로 비어 있어,
이 상태로 접속하면 "환경변수가 설정되지 않았습니다" 만 표시됩니다.

Cloudflare Dashboard → Workers & Pages → `kidari-detailing`
→ Settings → Variables and Secrets 에서 **Preview** 환경에 추가:

| 변수명 | 값 |
|---|---|
| `PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_` 로 시작하는 공개 키 |

- 둘 다 **Plaintext** 로 넣습니다 (공개값이며, 실제 보안은 RLS가 담당)
- Secret key / service_role key / DB 비밀번호는 **절대 넣지 않습니다**
- 정적 빌드이므로 변수를 추가한 뒤 **Deployments → Retry deployment** 로
  다시 빌드해야 값이 반영됩니다

---

## 1. 로그인 검증 (`/admin/test-login`)

| | 확인 항목 | 기대 결과 |
|---|---|---|
| ☐ | 페이지가 열린다 | 환경변수 오류 메시지가 안 보임 |
| ☐ | 관리자 이메일 + 비밀번호로 로그인 | 로그인됨 / 관리자 ✅ |
| ☐ | "잘못된 비밀번호 시도" 버튼 | 차단됨 |
| ☐ | "비로그인 차단 테스트" | 6개 전부 차단 |
| ☐ | "관리자 권한 테스트" | `n/n 통과` |

## 2. 사진 업로드 검증 (`/admin/test-upload`) — 핵심

iOS Safari가 WebP 인코딩을 지원하는지가 이번 테스트의 진짜 목적입니다.

| | 확인 항목 | 기대 결과 |
|---|---|---|
| ☐ | **아이폰 카메라로 찍은 세로 사진**을 고른다 | 썸네일이 세로로 바로 보임 (눕지 않음) |
| ☐ | 변환 결과의 형식 표시 | `webp` 또는 `jpeg`(fallback) |
| ☐ | 변환 결과의 크기 | 긴 변이 1600px 이하 |
| ☐ | 용량 | 원본보다 작아짐 |
| ☐ | 업로드 | 사진 목록에 나타남 |
| ☐ | 가로 사진도 한 장 | 같은 결과 |
| ☐ | 사진 하나 삭제 | 목록에서 사라짐 |

사진은 **2~3장이면 충분**합니다. 많이 올릴 필요 없습니다.

## 3. 결과 알려주실 내용

사진 업로드 화면에 표시된 **형식(webp/jpeg)** 과 **크기** 만 알려주시면
나머지는 제가 Supabase에서 직접 확인하고 테스트 데이터도 정리합니다.

캡처 한 장이면 가장 정확합니다.
