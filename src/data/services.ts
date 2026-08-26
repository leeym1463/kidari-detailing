// 홈 화면 서비스 요약 카드 및 LocalBusiness의 서비스 카탈로그(JSON-LD)에 사용되는 요약 정보.
// 광택·유리막코팅 가격은 사장님이 확인해 주신 실제 가격대입니다. 외형복원·스팀세차는 아직
// 일반적인 시장 가격대를 참고한 예시(placeholder)이니 실제 가격으로 교체해 주세요.

export interface ServiceSummary {
  slug: string;
  href: string;
  name: string;
  oneLiner: string;
  lowPrice: number;
  highPrice: number;
}

export const services: ServiceSummary[] = [
  {
    slug: 'gwangtaek',
    href: '/gwangtaek',
    name: '광택',
    oneLiner: '도장면의 흠집과 광택 저하를 FM광택 정석 시공으로 복원하는 키다리광택의 주력 서비스',
    lowPrice: 300000,
    highPrice: 600000,
  },
  {
    slug: 'coating',
    href: '/coating',
    name: '유리막코팅',
    oneLiner: '광택 후 도장면을 보호막으로 코팅해 광택과 발수 효과를 오래 유지',
    lowPrice: 300000,
    highPrice: 1500000,
  },
  {
    slug: 'restoration',
    href: '/restoration',
    name: '외형복원·판금도색',
    oneLiner: '스크래치·도장 손상을 복원하는 판금·도색 서비스',
    lowPrice: 30000,
    highPrice: 400000,
  },
  {
    slug: 'steam-wash',
    href: '/steam-wash',
    name: '스팀세차',
    oneLiner: '고온 스팀으로 실내외 오염을 세척하는 친환경 세차 서비스',
    lowPrice: 70000,
    highPrice: 270000,
  },
];
