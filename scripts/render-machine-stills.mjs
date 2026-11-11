// Renders the Machine tab's stills (machine-{black,white}.png) from the 3D
// machine itself, at the front view it opens on, so the 3D takes their place
// without a jump. Run it again whenever the model or its look changes. It
// drives the dev server in Chromium on the GPU, with a made-up machine that
// only reports its color. Usage, with the dev server running and Playwright
// installed (npm i --no-save playwright && npx playwright install chromium):
//   node scripts/render-machine-stills.mjs http://localhost:5173 src/assets/machine
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { chromium } from "playwright";

const [devUrl, outDir] = process.argv.slice(2);
// The 3D's box at its largest (540 CSS px tall) on a 2x screen, and wide
// enough for the shadow on the floor, which reaches past the machine.
const WIDTH = 800;
const HEIGHT = 1080;
const MACHINE = "http://still.invalid";
const STILL = "img[alt$='espresso machine']";

// PNG's row filters: each byte predicted from the ones left of, above, and
// above-left of it.
const FILTERS = [
  () => 0,
  (a) => a,
  (a, b) => b,
  (a, b) => (a + b) >> 1,
  (a, b, c) => {
    const pa = Math.abs(b - c);
    const pb = Math.abs(a - c);
    const pc = Math.abs(a + b - 2 * c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  },
];

// RGBA to PNG, each row with the filter that leaves the smallest residuals,
// deflated at the highest level. The renderer's dithering is too noisy for
// the browser's quick PNG encoder: its files come out nearly twice as big.
const encodePng = (width, height, rgba) => {
  const stride = width * 4;
  const filtered = Buffer.alloc((stride + 1) * height);
  const zero = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    const up = y ? rgba.subarray((y - 1) * stride, y * stride) : zero;
    let best = { cost: Infinity, type: 0, bytes: zero };
    FILTERS.forEach((predict, type) => {
      const bytes = new Uint8Array(stride);
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const left = i >= 4 ? row[i - 4] : 0;
        const upLeft = i >= 4 ? up[i - 4] : 0;
        const value = (row[i] - predict(left, up[i], upLeft)) & 255;
        bytes[i] = value;
        cost += value < 128 ? value : 256 - value;
      }
      if (cost < best.cost) best = { cost, type, bytes };
    });
    filtered[y * (stride + 1)] = best.type;
    filtered.set(best.bytes, y * (stride + 1) + 1);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits per channel, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const browser = await chromium.launch({
  args: ["--enable-gpu", "--ignore-gpu-blocklist"],
});
try {
  for (const color of ["black", "white"]) {
    // lg's layout, where the box is 540 px tall.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    // Keeps the 3D's last frame readable after it is shown.
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attributes) {
        if (type.startsWith("webgl"))
          attributes = { ...attributes, preserveDrawingBuffer: true };
        return getContext.call(this, type, attributes);
      };
    });
    await page.route(`${MACHINE}/**`, (route) =>
      new URL(route.request().url()).pathname === "/api/v1/machine"
        ? route.fulfill({ json: { name: "Meticulous", color } })
        : route.abort(),
    );
    await page.goto(`${devUrl}/?machine=${MACHINE}`);
    // The still goes once the 3D has drawn.
    await page.waitForFunction(
      (still) =>
        getComputedStyle(document.querySelector(still)).opacity === "0",
      STILL,
      { timeout: 60_000 },
    );
    const { base64, renderer } = await page.evaluate(
      ([still, width, height]) => {
        const canvas = document
          .querySelector(still)
          .parentElement.querySelector("canvas");
        const gl = canvas.getContext("webgl2");
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        // The canvas is taller than the box and as wide as the column, both
        // centered on it.
        const crop = document.createElement("canvas");
        crop.width = width;
        crop.height = height;
        const context = crop.getContext("2d");
        context.drawImage(
          canvas,
          (canvas.width - width) / 2,
          (canvas.height - height) / 2,
          width,
          height,
          0,
          0,
          width,
          height,
        );
        const { data } = context.getImageData(0, 0, width, height);
        let binary = "";
        for (let i = 0; i < data.length; i += 0x8000)
          binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
        return {
          base64: btoa(binary),
          renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        };
      },
      [STILL, WIDTH, HEIGHT],
    );
    const rgba = new Uint8Array(Buffer.from(base64, "base64"));
    const alpha = (x, y) => rgba[(y * WIDTH + x) * 4 + 3];
    const edges = [];
    for (let x = 0; x < WIDTH; x++)
      edges.push(alpha(x, 0), alpha(x, HEIGHT - 1));
    for (let y = 0; y < HEIGHT; y++)
      edges.push(alpha(0, y), alpha(WIDTH - 1, y));
    if (edges.some(Boolean))
      throw new Error(`The ${color} machine or its shadow reaches the edge`);
    const file = join(outDir, `machine-${color}.png`);
    writeFileSync(file, encodePng(WIDTH, HEIGHT, rgba));
    console.log(`${file}, on ${renderer}`);
    await context.close();
  }
} finally {
  await browser.close();
}
