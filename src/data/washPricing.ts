// 스팀세차 실제 요금표. 사장님이 확인해 주신 데이터입니다 — 여기서 한 번만 수정하면
// /steam-wash 페이지와 홈 화면 요금 팝업에 동시에 반영됩니다.

export type WashTierKey = 'basic' | 'detailing' | 'kidari';

export interface WashTier {
  key: WashTierKey;
  name: string;
  duration: string;
  features: string[];
  note?: string;
}

export const washTiers: WashTier[] = [
  {
    key: 'basic',
    name: '베이직',
    duration: '2시간 ~ 2시간 30분',
    features: [
      '실내 스팀청소',
      '유리 세정',
      '틈새 청소',
      '매트 청소',
      '트렁크 케어',
      '외부 세척',
      '에어 드라이',
      '휠·타이어 세척',
      '타이어 드레싱',
    ],
    note: '왁스 추가 가능 (기본 2만원부터)',
  },
  {
    key: 'detailing',
    name: '디테일링',
    duration: '3시간 ~ 3시간 30분',
    features: [
      '실내 스팀청소',
      '유리 세정',
      '틈새 청소',
      '매트 청소',
      '트렁크 케어',
      '외부 세척',
      '에어 드라이',
      '휠·타이어 세척',
      '플라스틱 내외장재 드레싱',
      '타이어 드레싱',
      '외부 카나우바 왁스 시공',
      '살균 소독',
    ],
    note: '기본 왁스 3~4주 지속 포함',
  },
  {
    key: 'kidari',
    name: '키다리스타일',
    duration: '4시간 ~ 5시간',
    features: [
      '실내 스팀청소',
      '유리 세정',
      '틈새 청소',
      '매트 청소',
      '트렁크 케어',
      '외부 세척',
      '에어 드라이',
      '휠·타이어 세척',
      '플라스틱 내외장재 코팅',
      '타이어 드레싱',
      'G왁스 시공',
      '살균 소독',
      '철분·타르 제거',
      '엔진룸 세척',
    ],
  },
];

export interface VehicleSizePrice {
  key: string;
  name: string;
  prices: Record<WashTierKey, number>;
}

export const vehicleSizePrices: VehicleSizePrice[] = [
  { key: 'compact', name: '소형', prices: { basic: 70000, detailing: 110000, kidari: 210000 } },
  { key: 'semi-mid', name: '준중형', prices: { basic: 80000, detailing: 120000, kidari: 220000 } },
  { key: 'mid', name: '중형', prices: { basic: 90000, detailing: 130000, kidari: 230000 } },
  { key: 'large', name: '대형', prices: { basic: 100000, detailing: 140000, kidari: 240000 } },
  { key: 'suv-compact', name: '소형 SUV', prices: { basic: 80000, detailing: 120000, kidari: 220000 } },
  { key: 'suv-mid', name: '중형 SUV', prices: { basic: 90000, detailing: 130000, kidari: 230000 } },
  { key: 'suv-large', name: '대형 SUV', prices: { basic: 100000, detailing: 140000, kidari: 240000 } },
  { key: 'van', name: '승합', prices: { basic: 120000, detailing: 160000, kidari: 270000 } },
];

export interface WaxOption {
  name: string;
  duration: string;
  extra: number; // 추가 금액 (0이면 디테일링 등급 기본 포함)
}

export const waxOptions: WaxOption[] = [
  { name: 'S왁스', duration: '6~8주 지속', extra: 30000 },
  { name: 'G왁스', duration: '10주 지속', extra: 50000 },
  { name: '스페셜왁스 (폴리싱 작업)', duration: '12주 지속', extra: 70000 },
];

export const washPriceRange = {
  low: Math.min(...vehicleSizePrices.map((v) => v.prices.basic)),
  high: Math.max(...vehicleSizePrices.map((v) => v.prices.kidari)),
};

export const evaCleaningPrice = 120000;

export const washPriceNote = '오염도에 따라 추가 요금이 발생할 수 있습니다.';
