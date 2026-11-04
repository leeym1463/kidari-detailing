import { defineCollection, z } from 'astro:content';

const cases = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    category: z.enum(['광택·유리막코팅', '외형복원·판금도색', '스팀세차', '에바크리닝', '실내크리닝']),
    date: z.date(),
    vehicle: z.string(), // 차종 (예: 현대 아반떼 CN7)
    // 아래 네 항목은 기존 38건에는 모두 들어 있지만, 관리자 CMS로 쓴 글에는
    // 없을 수 있어 선택 항목으로 둡니다. 값이 없으면 공개 페이지에서 해당
    // 영역을 통째로 감춥니다 (빈 제목만 남는 것을 막기 위해서입니다).
    // summary 는 목록·검색결과에 쓰이므로 CMS 게시 단계에서 따로 필수 검사합니다.
    summary: z.string().optional(), // 목록/메타 설명에 쓰이는 1~2문장 요약
    beforeCondition: z.string().optional(), // 입고 시 차량 상태
    workPerformed: z.array(z.string()).default([]), // 진행한 작업 목록
    duration: z.string().optional(), // 소요 시간 (예: 당일 4시간)
    priceNote: z.string().optional(), // 실제 청구 가격 안내(선택)
    // 같은 부위를 찍은 시공 전/후 사진 쌍(선택). 드래그 비교 슬라이더로 표시됩니다.
    beforeAfter: z
      .array(
        z.object({
          before: z.string(),
          after: z.string(),
          caption: z.string().optional(),
        })
      )
      .optional(),
    // 초안 상태 글은 목록/상세/사이트맵에서 제외됩니다.
    draft: z.boolean().default(false),
  }),
});

export const collections = { cases };
