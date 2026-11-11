// Packs the machine's exterior for the Machine tab from the CAD export
// (simplified.{json,cadpack}, plus the drip tray from
// assembly.{json,cadpack}): no CAD edge lines, positions quantized to int16
// (1/64 mm), uint16 indices, gzipped. Usage:
//   node scripts/pack-machine-model.mjs <CAD export> src/assets/machine/model
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { join } from "node:path";
import { MeshoptSimplifier } from "meshoptimizer";
import { format, resolveConfig } from "prettier";

const [modelDir, outDir] = process.argv.slice(2);
const readModel = (name) => {
  const manifest = JSON.parse(
    readFileSync(join(modelDir, `${name}.json`), "utf8"),
  );
  const raw = gunzipSync(readFileSync(join(modelDir, `${name}.cadpack`)));
  const buffer = raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength,
  );
  return { manifest, buffer };
};
const { manifest, buffer } = readModel("simplified");

// The parts seen from outside; nothing else in the export is packed.
const EXTERIOR = new Set([
  "base",
  "foot-front-left",
  "foot-rear-left",
  "foot-front-right",
  "foot-rear-right",
  "tare-button",
  "tower-shell",
  "tower-top",
  "upper-shell",
  "upper-lid",
  "upper-floor",
  "rear-shell",
  "plunger-tube",
  "brew-platform-top",
  "funnel",
  "brew-platform-bottom",
  "context-button",
  "upper-plug",
  "scale-base",
  "scale-cover",
  "scale-foot-front-left",
  "scale-foot-rear-left",
  "scale-foot-front-right",
  "scale-foot-rear-right",
  "encoder",
  "display-lens",
  "scale-socket",
  "heel-shell",
  "tray-shell",
  "tray-grate",
  "shower-screen",
  "rear-surround",
  "rear-fascia",
  "power-socket",
  "usb-port",
  "power-button",
  "expansion-port-faces",
]);
const SCALE = 64;

// Behind the panel, the display lens is wider than the panel's hole. It
// shows through pixel cracks in the panel's tessellation around the hole as
// black specks, so pull it in to the hole.
const LENS_RADIUS = 26.5;
const pullInLens = (positions) => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - cx,
      dy = positions[i + 1] - cy;
    const r = Math.hypot(dx, dy);
    if (r <= LENS_RADIUS) continue;
    positions[i] = cx + (dx * LENS_RADIUS) / r;
    positions[i + 1] = cy + (dy * LENS_RADIUS) / r;
  }
};

// The plastic tray under the grate is only in the assembly, at 48k
// triangles: mostly fillets and the embossed care label, which the grate
// hides. Simplified to this many triangles, off by at most this much.
const DRIP_TRAY = {
  name: / Drip Tray$/,
  id: "drip-tray",
  triangles: 2000,
  errorMm: 0.5,
};
// The care label stands 0.2 mm off the island over the scale, which
// slopes down to the front. Pressed flat, it simplifies away instead of
// leaving slivers that glint through the grate.
const CARE_LABEL = {
  halfWidth: 48,
  z: [43.5, 71.5],
  // The island's height at z = 0, and its fall per mm toward the front.
  y: 27.852,
  slope: 0.0145,
  height: 0.2,
};
const flattenLabel = (positions) => {
  const { halfWidth, z, y, slope, height } = CARE_LABEL;
  for (let i = 0; i < positions.length; i += 3) {
    const surface = y - slope * positions[i + 2];
    const above = positions[i + 1] - surface;
    if (
      Math.abs(positions[i]) <= halfWidth &&
      positions[i + 2] >= z[0] &&
      positions[i + 2] <= z[1] &&
      above > -0.1 &&
      above < height + 0.1
    )
      positions[i + 1] = surface;
  }
};
const simplify = async (positions, indices, { triangles, errorMm }) => {
  // The CAD export splits vertices per face; weld them so the simplifier
  // sees one surface.
  const welded = [];
  const byPoint = new Map();
  const weld = new Uint32Array(positions.length / 3);
  for (let i = 0; i < weld.length; i++) {
    const point = positions.subarray(i * 3, i * 3 + 3);
    const key = Array.from(point, (v) => Math.round(v * 100)).join();
    if (!byPoint.has(key)) {
      byPoint.set(key, welded.length / 3);
      welded.push(...point);
    }
    weld[i] = byPoint.get(key);
  }
  const weldedPositions = new Float32Array(welded);
  // Drop the triangles that welding collapsed (the label's sides).
  const surface = [];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => weld[indices[i + j]]);
    if (a !== b && b !== c && c !== a) surface.push(a, b, c);
  }
  await MeshoptSimplifier.ready;
  const [simplified] = MeshoptSimplifier.simplify(
    Uint32Array.from(surface),
    weldedPositions,
    3,
    triangles * 3,
    errorMm,
    ["ErrorAbsolute"],
  );
  // Renumbers the indices in place to the vertices still in use.
  const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
  const kept = new Float32Array(count * 3);
  remap.forEach((to, from) => {
    if (to !== 0xffffffff)
      kept.set(weldedPositions.subarray(from * 3, from * 3 + 3), to * 3);
  });
  return [kept, simplified];
};

const chunks = [];
let offset = 0;
const push = (typed) => {
  chunks.push(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
  const at = offset;
  offset += typed.byteLength;
  return at;
};

const meshes = [];
const addMesh = (id, positions, indices) => {
  const vertexCount = positions.length / 3;
  if (vertexCount > 65535)
    throw new Error(`${id}: too many vertices for uint16`);
  const quantized = new Int16Array(positions.length);
  for (let i = 0; i < positions.length; i++) {
    const value = Math.round(positions[i] * SCALE);
    if (Math.abs(value) > 32767) throw new Error(`${id}: out of int16 range`);
    quantized[i] = value;
  }
  meshes.push({
    id,
    vertices: vertexCount,
    indices: indices.length,
    position: push(quantized),
    index: push(Uint16Array.from(indices)),
  });
};
for (const mesh of manifest.meshes) {
  if (!EXTERIOR.has(mesh.id)) continue;
  const positions = new Float32Array(
    buffer,
    mesh.position.offset,
    mesh.position.length,
  );
  if (mesh.id === "display-lens") pullInLens(positions);
  const indices = new Uint32Array(buffer, mesh.index.offset, mesh.index.length);
  addMesh(mesh.id, positions, indices);
}
{
  const assembly = readModel("assembly");
  const part = assembly.manifest.meshes.find((m) =>
    DRIP_TRAY.name.test(m.name),
  );
  if (!part) throw new Error(`${DRIP_TRAY.id}: not in the assembly`);
  const positions = new Float32Array(
    assembly.buffer,
    part.position.offset,
    part.position.length,
  );
  flattenLabel(positions);
  const indices = new Uint32Array(
    assembly.buffer,
    part.index.offset,
    part.index.length,
  );
  addMesh(DRIP_TRAY.id, ...(await simplify(positions, indices, DRIP_TRAY)));
}

mkdirSync(outDir, { recursive: true });
const packed = gzipSync(Buffer.concat(chunks), { level: 9 });
writeFileSync(join(outDir, "machine.bin.gz"), packed);
// Formatted as the repo's Prettier check expects.
const manifestFile = join(outDir, "machine.json");
writeFileSync(
  manifestFile,
  await format(JSON.stringify({ units: "mm", scale: 1 / SCALE, meshes }), {
    ...(await resolveConfig(manifestFile)),
    filepath: manifestFile,
  }),
);
const triangles = meshes.reduce((sum, m) => sum + m.indices / 3, 0);
console.log(
  `${meshes.length} meshes, ${triangles} triangles, ${offset} bytes raw, ${packed.length} gzipped`,
);
