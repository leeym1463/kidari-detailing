// 업체 기본 정보 — 실제 정보로 교체해 주세요.
// 이 파일의 값은 Header/Footer 표기, 각 페이지의 Schema.org 구조화 데이터(JSON-LD)에
// 그대로 사용됩니다. 아래 TODO 항목만 실제 값으로 채우면 사이트 전체에 자동 반영됩니다.

export const business = {
  name: '키다리광택',
  alternateName: 'Kidari Gwangtaek',
  description:
    '강원도 춘천에서 광택을 전문으로 하는 자동차 디테일링샵. 유리막코팅·외형복원(판금도색)·스팀세차 서비스를 함께 제공합니다.',

  // astro.config.mjs의 SITE_URL과 동일한 값
  url: 'https://www.kidari-gwangtaek.com',

  telephoneDisplay: '010-2666-5742',
  telephoneHref: 'tel:010-2666-5742',

  // TODO: 실제 카카오톡 채널/오픈채팅 링크가 있다면 입력 (없으면 빈 문자열로 유지)
  kakaoChannelUrl: '',

  naverBlogUrl: 'https://blog.naver.com/kidari8983',
  instagramUrl: 'https://www.instagram.com/kidari8983/',

  address: {
    streetAddress: '퇴계로 35',
    addressLocality: '춘천시',
    addressRegion: '강원특별자치도',
    // TODO: 우편번호를 알면 입력 (모르면 빈 문자열 유지)
    postalCode: '',
    addressCountry: 'KR',
  },

  fullAddressText: '강원특별자치도 춘천시 퇴계로 35',

  // TODO: 정확한 위도/경도를 알면 채워주세요. 모르면 이 두 줄을 지우고
  // business.ts를 사용하는 곳에서 geo 참조를 제거해도 됩니다.
  geo: {
    latitude: 37.8813,
    longitude: 127.7298,
  },

  // 영업시간 09:00~19:00 확인됨. 요일 구성은 통상적인 월~토 운영으로 가정했으니
  // 실제 휴무 요일이 다르다면 days 배열을 수정해 주세요.
  openingHours: [
    {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '19:00',
    },
  ],
  // TODO: 정기 휴무일이 일요일이 맞는지 확인 필요
  closedNote: '일요일 · 공휴일 휴무 (변동 가능, 방문 전 전화 확인 권장)',

  // 가격대 표기: schema.org priceRange 값. 특별한 이유가 없다면 유지해도 무방합니다.
  priceRange: '₩₩',

  areaServed: ['춘천시', '강원특별자치도'],

  sameAs: ['https://blog.naver.com/kidari8983', 'https://www.instagram.com/kidari8983/'] as string[],
};
