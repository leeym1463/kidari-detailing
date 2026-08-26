import { business } from '../data/business';
import type { FaqItem } from '../data/faq';

const SITE_URL = business.url.replace(/\/$/, '');

function abs(path: string) {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function postalAddress() {
  return {
    '@type': 'PostalAddress',
    streetAddress: business.address.streetAddress,
    addressLocality: business.address.addressLocality,
    addressRegion: business.address.addressRegion,
    ...(business.address.postalCode ? { postalCode: business.address.postalCode } : {}),
    addressCountry: business.address.addressCountry,
  };
}

function openingHoursSpecification() {
  return business.openingHours.map((slot) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: slot.days,
    opens: slot.opens,
    closes: slot.closes,
  }));
}

// 홈 페이지용 LocalBusiness 스키마 (AutoBodyShop + AutoWash: 판금도색과 세차/디테일링을 함께 표기)
export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['AutoBodyShop', 'AutoWash'],
    '@id': `${SITE_URL}/#business`,
    name: business.name,
    alternateName: business.alternateName,
    description: business.description,
    url: SITE_URL,
    telephone: business.telephoneDisplay,
    priceRange: business.priceRange,
    address: postalAddress(),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: business.geo.latitude,
      longitude: business.geo.longitude,
    },
    openingHoursSpecification: openingHoursSpecification(),
    areaServed: business.areaServed,
    sameAs: business.sameAs,
  };
}

interface ServiceSchemaInput {
  name: string;
  description: string;
  path: string;
  serviceType: string;
  lowPrice: number;
  highPrice: number;
}

export function serviceSchema({ name, description, path, serviceType, lowPrice, highPrice }: ServiceSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${abs(path)}#service`,
    serviceType,
    name,
    description,
    url: abs(path),
    provider: {
      '@type': ['AutoBodyShop', 'AutoWash'],
      '@id': `${SITE_URL}/#business`,
      name: business.name,
      telephone: business.telephoneDisplay,
      address: postalAddress(),
    },
    areaServed: business.areaServed,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'KRW',
      lowPrice,
      highPrice,
    },
  };
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

interface BlogPostingSchemaInput {
  title: string;
  description: string;
  path: string;
  datePublished: Date;
}

// 시공사례(/cases/[slug]) 상세 페이지용 BlogPosting 스키마
export function blogPostingSchema({ title, description, path, datePublished }: BlogPostingSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url: abs(path),
    datePublished: datePublished.toISOString(),
    author: {
      '@type': 'Organization',
      name: business.name,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: business.name,
      url: SITE_URL,
    },
  };
}

export function itemListSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: abs(item.path),
    })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}
