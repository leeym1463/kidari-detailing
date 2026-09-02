import sharp from 'sharp';

const SRC = 'public/images/logo-kidari.png';
const BG = '#000000';

async function run() {
  // 1) Extract the region containing the cyan brace mark + the "K" of KIDARI.
  const region = { left: 0, top: 0, width: 300, height: 330 };
  const { data, info } = await sharp(SRC)
    .extract(region)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // 2) Keep the cyan brace and the white "K" as-is; just clear stray low-alpha noise.
  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    if (a < 40) {
      data[i + 3] = 0;
    } else {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const isCyan = b > 150 && g > 150 && r < 100;
      if (isCyan) {
        data[i] = 0x00;
        data[i + 1] = 0xc5;
        data[i + 2] = 0xe5;
      } else {
        data[i] = 0xff;
        data[i + 1] = 0xff;
        data[i + 2] = 0xff;
      }
      data[i + 3] = 255;
    }
  }

  const masked = sharp(data, { raw: { width, height, channels } }).png();

  // 3) Trim to the tight bounding box of the mark.
  const trimmedBuffer = await masked.trim({ threshold: 10 }).toBuffer();
  const trimmedMeta = await sharp(trimmedBuffer).metadata();

  async function buildIcon(size, { rounded = true } = {}) {
    const markSize = Math.round(size * 0.66);
    const markBuffer = await sharp(trimmedBuffer)
      .resize({
        width: markSize,
        height: markSize,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    const offset = Math.round((size - markSize) / 2);

    let canvas = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BG,
      },
    }).composite([{ input: markBuffer, left: offset, top: offset }]);

    if (rounded) {
      const radius = Math.round(size * 0.22);
      const roundedMask = Buffer.from(
        `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
      );
      canvas = canvas.png().toBuffer().then((buf) =>
        sharp(buf).composite([{ input: roundedMask, blend: 'dest-in' }]).png()
      );
      return canvas;
    }

    return canvas.png();
  }

  const icon512 = await (await buildIcon(512, { rounded: false })).toBuffer();
  await sharp(icon512).toFile('public/images/logo-icon-512.png');

  const icon192 = await (await buildIcon(192, { rounded: false })).toBuffer();
  await sharp(icon192).toFile('public/favicon-192.png');

  const icon32 = await (await buildIcon(32, { rounded: false })).toBuffer();
  await sharp(icon32).toFile('public/favicon-32.png');

  // Apple touch icon: no transparency, iOS applies its own corner rounding.
  const apple = await (await buildIcon(180, { rounded: false })).toBuffer();
  await sharp(apple).toFile('public/apple-touch-icon.png');

  console.log('trimmed mark size:', trimmedMeta.width, trimmedMeta.height);
  console.log('favicon assets generated.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
