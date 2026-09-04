import { defineCollection, z } from 'astro:content';

const cases = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    category: z.enum(['광택·유리막코팅', '외형복원·판금도색', '스팀세차', '에바크리닝', '실내크리닝']),
    date: z.date(),
    vehicle: z.string(), // 차종 (예: 현대 아반떼 CN7)
    summary: z.string(), // 목록/메타 설명에 쓰이는 1~2문장 요약
    beforeCondition: z.string(), // 입고 시 차량 상태
    workPerformed: z.array(z.string()), // 진행한 작업 목록
    duration: z.string(), // 소요 시간 (예: 당일 4시간)
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
