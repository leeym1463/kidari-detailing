// 시공 전후 비교 슬라이더를 켜줍니다.
//
// 같은 마크업이 두 곳에서 나옵니다.
//   · BeforeAfterSlider.astro  (frontmatter 로 넣는 경우)
//   · 관리자 CMS 가 만든 글의 본문 안 HTML
// 그래서 컴포넌트가 아니라 페이지 단위로 한 번만 켭니다.
//
// 자바스크립트가 실패해도 시공 전/후 사진이 둘 다 보이도록
// 마크업 자체가 두 장의 <img> 로 되어 있습니다(아래 markNoJs 참고).

export function initBeforeAfterSliders(root: ParentNode = document): void {
  for (const slider of root.querySelectorAll<HTMLElement>('.ba-slider')) {
    if (slider.dataset.baInit === '1') continue;
    slider.dataset.baInit = '1';

    const frame = slider.querySelector<HTMLElement>('.ba-frame');
    const beforeWrap = slider.querySelector<HTMLElement>('.ba-before-wrap');
    const handle = slider.querySelector<HTMLElement>('.ba-handle');
    const range = slider.querySelector<HTMLInputElement>('.ba-range');
    if (!frame || !beforeWrap || !handle || !range) continue;

    const update = (value: number) => {
      beforeWrap.style.width = value + '%';
      handle.style.left = value + '%';
      beforeWrap.style.setProperty('--ba-frame-width', frame.getBoundingClientRect().width + 'px');
    };

    update(Number(range.value) || 50);
    range.addEventListener('input', () => update(Number(range.value)));

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => update(Number(range.value))).observe(frame);
    }
  }
}
