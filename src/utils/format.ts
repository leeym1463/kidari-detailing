export function formatManwon(krw: number): string {
  return `${Math.round(krw / 10000)}만원`;
}

export function formatPriceRange(low: number, high: number): string {
  return `${formatManwon(low)} ~ ${formatManwon(high)}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}
