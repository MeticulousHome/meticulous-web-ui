import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import manifest from "../../assets/machine/model/machine.json";
import modelUrl from "../../assets/machine/model/machine.bin.gz?url";

// The machine's exterior, from its CAD model, in millimeters: +Y up, +Z out
// of the front. Positions are int16 in 1/64 mm and indices uint16, per part,
// in one gzipped buffer (scripts/pack-machine-model.mjs).

export interface MachinePart {
  id: string;
  geometry: THREE.BufferGeometry;
}

// Faces meeting at more than this are drawn with a hard edge.
const CREASE_ANGLE = THREE.MathUtils.degToRad(35);

// The plunger the tube ends in isn't in the model: a simplified one, turned
// about the funnel's axis from this profile (radius and height, mm). It sits
// just under the funnel, seen down its bore; its top rounds down into a
// bore, and out of the bore the tube flares, in one piece, from the tube's
// own radius. It ends in a slight taper up inside the tube's wall, so a
// crack in the seam shows more steel.
const PLUNGER_AXIS = { x: -45, z: 75 };
const TUBE_RADIUS = 12;
const PLUNGER_PROFILE: [number, number][] = [
  [0, 259],
  [25.5, 259],
  [26, 259.5],
  [26, 274.5],
  [25.5, 275],
  [22, 275],
  [21, 274.6],
  [20.5, 274],
  [20.2, 273.3],
  [20.2, 267],
  [19, 267],
  [18.2, 268],
  [16.6, 269],
  [15.2, 270],
  [14.4, 271],
  [13.8, 272],
  [13.2, 273.5],
  [12.6, 275],
  [12.2, 276.5],
  [TUBE_RADIUS, 278],
  [TUBE_RADIUS, 281],
  [TUBE_RADIUS - 0.1, 283],
];
// As many sides as the tube, so the two meet corner to corner.
const PLUNGER_SEGMENTS = 42;

const turnPlunger = () => {
  const lathe = new THREE.LatheGeometry(
    PLUNGER_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    PLUNGER_SEGMENTS,
  );
  lathe.deleteAttribute("uv");
  lathe.translate(PLUNGER_AXIS.x, 0, PLUNGER_AXIS.z);
  const geometry = toCreasedNormals(lathe, CREASE_ANGLE);
  lathe.dispose();
  return geometry;
};

// The tube's faces in the export are uneven, so its normals stray a few
// degrees from round, and the polished steel shows it, most where it meets
// the plunger. On its outside they point straight out from the axis, as the
// plunger's do (keeping the side each face is wound to).
const ROUND_WITHIN = Math.cos(THREE.MathUtils.degToRad(10));

const roundTube = (geometry: THREE.BufferGeometry) => {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) - PLUNGER_AXIS.x;
    const z = position.getZ(i) - PLUNGER_AXIS.z;
    const r = Math.hypot(x, z);
    if (r < TUBE_RADIUS - 0.1) continue;
    const out = (normal.getX(i) * x + normal.getZ(i) * z) / r;
    if (Math.abs(out) < ROUND_WITHIN) continue;
    normal.setXYZ(i, (Math.sign(out) * x) / r, 0, (Math.sign(out) * z) / r);
  }
};

const isGzip = (bytes: Uint8Array) => bytes[0] === 0x1f && bytes[1] === 0x8b;

const fetchBuffer = async (signal: AbortSignal) => {
  const response = await fetch(modelUrl, { signal });
  if (!response.ok) throw new Error(`Machine model: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // A server may already have decoded it (Content-Encoding: gzip).
  if (!isGzip(bytes)) return bytes.buffer;
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
};

export const loadMachineModel = async (
  signal: AbortSignal,
): Promise<MachinePart[]> => {
  const buffer = await fetchBuffer(signal);
  signal.throwIfAborted();
  const parts = manifest.meshes.map((mesh) => {
    const quantized = new Int16Array(buffer, mesh.position, mesh.vertices * 3);
    const positions = Float32Array.from(quantized, (v) => v * manifest.scale);
    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    indexed.setIndex(
      new THREE.BufferAttribute(
        new Uint16Array(buffer, mesh.index, mesh.indices),
        1,
      ),
    );
    const geometry = toCreasedNormals(indexed, CREASE_ANGLE);
    indexed.dispose();
    if (mesh.id === "plunger-tube") roundTube(geometry);
    return { id: mesh.id, geometry };
  });
  return [...parts, { id: "plunger", geometry: turnPlunger() }];
};
