// 서비스 카테고리 공통 정의.
// ServiceCategory: 별도 서비스 페이지가 있는 4개 카테고리. FAQ와 서비스 페이지 내
// "관련 시공사례" 조회는 이 4개를 그대로 씁니다 (광택/유리막코팅 페이지는 각각 독립적인
// 콘텐츠·FAQ를 가지므로 서비스 페이지 단위로는 분리 유지).
//
// CaseCategory: 시공사례(cases) 전용 카테고리. 네이버 블로그 원본 카테고리 구조를 따라
// 광택과 유리막코팅은 '광택·유리막코팅' 하나로 묶고, 서비스 페이지가 아직 없는
// '에바크리닝' · '실내크리닝'을 추가로 둡니다.

export type ServiceCategory = '광택' | '유리막코팅' | '외형복원·판금도색' | '스팀세차';

export const serviceCategoryOrder: ServiceCategory[] = [
  '광택',
  '유리막코팅',
  '외형복원·판금도색',
  '스팀세차',
];

export const serviceCategoryHref: Record<ServiceCategory, string> = {
  '광택': '/gwangtaek',
  '유리막코팅': '/coating',
  '외형복원·판금도색': '/restoration',
  '스팀세차': '/steam-wash',
};

export type CaseCategory = '광택·유리막코팅' | '외형복원·판금도색' | '스팀세차' | '에바크리닝' | '실내크리닝';

export const caseCategoryOrder: CaseCategory[] = [
  '광택·유리막코팅',
  '외형복원·판금도색',
  '스팀세차',
  '에바크리닝',
  '실내크리닝',
];

interface CaseCategoryLink {
  label: string;
  href: string;
}

// 카테고리별로 연결할 서비스 페이지. 서비스 페이지가 없는 카테고리(에바크리닝·실내크리닝)는
// 비워둡니다 — 나중에 전용 페이지를 만들면 여기 추가하세요.
export const caseCategoryLinks: Partial<Record<CaseCategory, CaseCategoryLink[]>> = {
  '광택·유리막코팅': [
    { label: '광택 서비스 페이지', href: '/gwangtaek' },
    { label: '유리막코팅 서비스 페이지', href: '/coating' },
  ],
  '외형복원·판금도색': [{ label: '외형복원·판금도색 서비스 페이지', href: '/restoration' }],
  '스팀세차': [{ label: '스팀세차 서비스 페이지', href: '/steam-wash' }],
};

// /cases 페이지 안의 카테고리 앵커(#id)용 슬러그.
export const caseCategorySlug: Record<CaseCategory, string> = {
  '광택·유리막코팅': 'gwangtaek-coating',
  '외형복원·판금도색': 'restoration',
  '스팀세차': 'steam-wash',
  '에바크리닝': 'eva-cleaning',
  '실내크리닝': 'interior-cleaning',
};
