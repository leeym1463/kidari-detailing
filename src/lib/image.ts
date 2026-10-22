// 업로드 전 브라우저에서 사진을 웹용으로 변환합니다.
//  · 긴 변 1600px
//  · WebP 우선, 미지원 브라우저는 JPEG로 자동 대체
//  · 캔버스 재인코딩 과정에서 EXIF/GPS가 제거됩니다
//  · 촬영 방향(EXIF orientation)은 디코딩 단계에서 반영됩니다

export const LONG_EDGE = 1600;
export const WEBP_QUALITY = 0.82;
export const JPEG_QUALITY = 0.85;

export interface ProcessedImage {
  blob: Blob;
  ext: 'webp' | 'jpg';
  format: 'webp' | 'jpeg-fallback';
  width: number;
  height: number;
  originalBytes: number;
  bytes: number;
  ms: number;
}

export async function processForUpload(file: Blob): Promise<ProcessedImage> {
  const t0 = performance.now();

  // imageOrientation: 'from-image' → 세로로 찍은 사진이 눕지 않습니다.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 사용할 수 없습니다');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  let blob = await toBlob('image/webp', WEBP_QUALITY);
  let format: ProcessedImage['format'] = 'webp';
  let ext: ProcessedImage['ext'] = 'webp';

  // 일부 브라우저(구형 iOS Safari 등)는 WebP 인코딩을 지원하지 않고
  // 요청한 타입 대신 PNG를 돌려줍니다. 그 경우 JPEG로 대체합니다.
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob('image/jpeg', JPEG_QUALITY);
    format = 'jpeg-fallback';
    ext = 'jpg';
  }
  if (!blob) throw new Error('이미지 변환에 실패했습니다');

  return {
    blob,
    ext,
    format,
    width,
    height,
    originalBytes: file.size,
    bytes: blob.size,
    ms: Math.round(performance.now() - t0),
  };
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  return Math.round(n / 1024) + ' KB';
}
