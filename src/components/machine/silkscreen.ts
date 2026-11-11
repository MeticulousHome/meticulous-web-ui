import * as THREE from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The prints on the machine, laid on its parts as decals. The artwork is SVG
// paths in millimeters, cropped to the ink, and each print is placed by its
// distance from the part's edges. Model space, in mm: +X right, +Y up, +Z out
// of the front.

// The logos are glossy black ink, tone on tone on the black machine, and the
// labels white ink. On the white machine, both are printed gray.
export const INKS = ["brand", "label"] as const;
export type Ink = (typeof INKS)[number];

const SVGS = import.meta.glob<string>("../../assets/machine/silkscreen/*.svg", {
  query: "?url",
  import: "default",
  eager: true,
});

interface Print {
  file: string;
  ink: Ink;
  // The parts it is printed on.
  parts: string[];
  // Its size, cropped to the ink.
  width: number;
  height: number;
  // Its center on the part, the way it faces, and which way is up in it.
  center: THREE.Vector3;
  facing: THREE.Vector3;
  up: THREE.Vector3;
}

const FRONT = new THREE.Vector3(0, 0, 1);
const BACK = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);
const TOP = new THREE.Vector3(0, 1, 0);
// Up in a print on a top face, so it reads from the front.
const REARWARD = new THREE.Vector3(0, 0, -1);

const print = (
  file: string,
  ink: Ink,
  parts: string[],
  [width, height]: [number, number],
  [x, y, z]: [number, number, number],
  facing: THREE.Vector3,
  up = TOP,
): Print => ({
  file,
  ink,
  parts,
  width,
  height,
  center: new THREE.Vector3(x, y, z),
  facing,
  up,
});

// The axis of the funnel and the brew platform under it.
const FUNNEL_AXIS = { x: -45, z: 75 };

// A print on the funnel or the platform, round from the left (-X) toward the
// back by `degrees` (toward the front if negative), as in the top views.
const onFunnel = (
  file: string,
  part: string,
  size: [number, number],
  degrees: number,
  radius: number,
  y: number,
) => {
  const angle = THREE.MathUtils.degToRad(degrees);
  const facing = new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle));
  const { x, z } = FUNNEL_AXIS;
  return print(
    file,
    "label",
    [part],
    size,
    [x + facing.x * radius, y, z + facing.z * radius],
    facing,
  );
};

const PRINTS: Print[] = [
  // Tower front: 13.3 mm in from the right edge, 51 mm up from the bottom.
  print(
    "m-logo",
    "brand",
    ["tower-shell"],
    [24.17, 18.15],
    [120 - 13.3 - 24.17 / 2, 51 + 18.15 / 2, 0],
    FRONT,
  ),
  // The back: 58.83 mm in from its left edge as seen from behind (X 118),
  // 54 mm down from its top.
  print(
    "meticulous-logo",
    "brand",
    ["rear-shell"],
    [119.24, 18.14],
    [118 - 58.83 - 119.24 / 2, 426 - 54 - 18.14 / 2, -50],
    BACK,
  ),
  // Top box: 5.2 mm in from the left edge, 4.4 mm back from the front one.
  print(
    "meticulous-espresso",
    "brand",
    ["upper-shell", "upper-lid"],
    [39.88, 3.16],
    [-85 + 5.2 + 39.88 / 2, 427, 115 - 4.4 - 3.16 / 2],
    TOP,
    REARWARD,
  ),
  // Right side: 3.5 mm under the tare and context buttons' holes (6.62 mm
  // in radius).
  print(
    "tare",
    "label",
    ["tower-shell"],
    [8.08, 4.99],
    [120, 35.5 - 6.62 - 3.5 - 4.99 / 2, -25],
    RIGHT,
  ),
  print(
    "context-button",
    "label",
    ["tower-shell"],
    [2.35, 4.69],
    [120, 330.6 - 6.62 - 3.5 - 4.69 / 2, -25],
    RIGHT,
  ),
  // Tower front, behind the drip tray: 3.5 mm right of the scale socket's
  // hole (3.4 mm in radius), the dash on its center line.
  print(
    "scale-plug",
    "label",
    ["tower-shell"],
    [11.27, 2.47],
    [50 + 3.4 + 3.5 + 11.27 / 2, 9.2, 0],
    FRONT,
  ),
  // Inside the funnel, seen from above: 1.5 mm out from the edge of the bore
  // (28.82 mm in radius), on its left.
  print(
    "max",
    "label",
    ["funnel"],
    [2.19, 13.05],
    [FUNNEL_AXIS.x - (28.82 + 1.5 + 2.19 / 2), 275, FUNNEL_AXIS.z],
    TOP,
    REARWARD,
  ),
  // 4.1 mm up from the funnel's bottom edge (Y 195.9), where it is 51 mm in
  // radius, 30° round toward the back.
  onFunnel(
    "hot-surface",
    "funnel",
    [8.15, 7.17],
    30,
    51,
    195.9 + 4.1 + 7.17 / 2,
  ),
  // The portafilter's mark: 4.1 mm up from the bottom of the platform's band
  // (Y 169.9, 50.5 mm in radius), 45° round toward the front.
  onFunnel(
    "portafilter-indicator",
    "brew-platform-top",
    [1.62, 1.4],
    -45,
    50.5,
    169.9 + 4.1 + 1.4 / 2,
  ),
  // The grate: 67.96 mm in from its left edge, 67.21 mm from its back one
  // (Z 3), which centers it under the funnel.
  print(
    "center-cup",
    "label",
    ["tray-grate"],
    [10.68, 10.66],
    [-118 + 67.96 + 10.68 / 2, 35.62, 3 + 67.21 + 10.66 / 2],
    TOP,
    REARWARD,
  ),
  // Stamped on the scale's cover, under the drip tray: 7.7 mm from its right
  // edge, 6.2 mm from its front one.
  print(
    "scale-module",
    "label",
    ["scale-cover"],
    [54.66, 8.78],
    [65.8 - 7.7 - 54.66 / 2, 22.3, 107.1 - 6.2 - 8.78 / 2],
    TOP,
    REARWARD,
  ),
  // Where the scale goes on the base plate, under it: 47.57 mm in from the
  // left edge, 36.5 mm from the front one.
  print(
    "position-scale",
    "label",
    ["base"],
    [135.82, 68.09],
    [-115 + 47.57 + 135.82 / 2, 0, 145 - 36.5 - 68.09 / 2],
    TOP,
    REARWARD,
  ),
];

// Clear ink around each print, in the texture and on the part, so the
// texture's mipmaps don't bleed into its neighbors.
const MARGIN_MM = 0.5;
const PX_PER_MM = 16;
const MAX_CELL_PX = 1024;
const ATLAS_WIDTH = 2048;

interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Silkscreen {
  texture: THREE.CanvasTexture;
  cells: Cell[];
}

const loadImage = async (url: string) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
};

// All the prints, white on clear, in one texture.
export const loadSilkscreen = async (
  signal: AbortSignal,
): Promise<Silkscreen> => {
  const images = await Promise.all(
    PRINTS.map(({ file }) =>
      loadImage(SVGS[`../../assets/machine/silkscreen/${file}.svg`]),
    ),
  );
  signal.throwIfAborted();
  const scales = PRINTS.map(({ width, height }) =>
    Math.min(
      PX_PER_MM,
      MAX_CELL_PX / (Math.max(width, height) + 2 * MARGIN_MM),
    ),
  );
  // Packed in rows, tallest first.
  const cells: Cell[] = PRINTS.map(({ width, height }, i) => ({
    x: 0,
    y: 0,
    width: Math.ceil((width + 2 * MARGIN_MM) * scales[i]),
    height: Math.ceil((height + 2 * MARGIN_MM) * scales[i]),
  }));
  let x = 0;
  let y = 0;
  let row = 0;
  for (const cell of [...cells].sort((a, b) => b.height - a.height)) {
    if (x + cell.width > ATLAS_WIDTH) {
      y += row;
      x = row = 0;
    }
    Object.assign(cell, { x, y });
    x += cell.width;
    row = Math.max(row, cell.height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_WIDTH;
  canvas.height = y + row;
  const context = canvas.getContext("2d")!;
  cells.forEach((cell, i) => {
    const margin = MARGIN_MM * scales[i];
    context.drawImage(
      images[i],
      cell.x + margin,
      cell.y + margin,
      PRINTS[i].width * scales[i],
      PRINTS[i].height * scales[i],
    );
  });
  // The artwork is black: whiten it, keeping its edges. The inks' colors
  // tint it.
  context.globalCompositeOperation = "source-in";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, cells };
};

// How far a print reaches in front of the surface and behind it: down the
// slope of the funnel's cone under "max", but not into the grate's grooves.
const REACH_MM = { front: 0.5, back: 1.5 };
// Faces turned further than this from a print (the walls of holes, bends)
// are left bare. The cosine of the angle.
const MIN_FACING = 0.5;
// Where the rays that find a print's surface start, out from the print.
const RAY_START_MM = 30;

// The triangles of a geometry that face `direction` (either way, as the CAD
// export winds faces both ways) and come within `radius` of `center`.
const facingFaces = (
  geometry: THREE.BufferGeometry,
  direction: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
) => {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const corners = [0, 1, 2].map(() => new THREE.Vector3());
  const centroid = new THREE.Vector3();
  const face = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const positions: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
    vertices.forEach((v, k) => corners[k].fromBufferAttribute(position, v));
    face
      .subVectors(corners[1], corners[0])
      .cross(edge.subVectors(corners[2], corners[0]))
      .normalize();
    if (Math.abs(face.dot(direction)) < MIN_FACING) continue;
    centroid.copy(corners[0]).add(corners[1]).add(corners[2]).divideScalar(3);
    const reach = Math.max(...corners.map((c) => c.distanceTo(centroid)));
    if (centroid.distanceTo(center) > radius + reach) continue;
    for (const v of vertices) {
      positions.push(position.getX(v), position.getY(v), position.getZ(v));
      normals.push(normal.getX(v), normal.getY(v), normal.getZ(v));
    }
  }
  const faces = new THREE.BufferGeometry();
  faces.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  faces.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return faces;
};

// The prints of each ink on the machine's parts (meshes named by part, in
// model space), one geometry per ink, mapped into the silkscreen's texture.
export const layPrints = (
  machine: THREE.Object3D,
  { texture, cells }: Silkscreen,
) => {
  const { width, height } = texture.image as HTMLCanvasElement;
  const raycaster = new THREE.Raycaster();
  const decals: Record<Ink, THREE.BufferGeometry[]> = { brand: [], label: [] };
  PRINTS.forEach((print, i) => {
    const parts = print.parts.map(
      (name) => machine.getObjectByName(name) as THREE.Mesh,
    );
    const right = print.up.clone().cross(print.facing).normalize();
    const up = print.facing.clone().cross(right);
    const orientation = new THREE.Euler().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, print.facing),
    );
    // The surface under the print: it is placed on the part's outline,
    // and rays across the print find where the mesh actually is. The nearest
    // hit counts, as the center of the grate's mark falls on a groove.
    let surface = -Infinity;
    for (const u of [-0.5, 0, 0.5]) {
      for (const v of [-0.5, 0, 0.5]) {
        raycaster.set(
          print.center
            .clone()
            .addScaledVector(right, u * print.width)
            .addScaledVector(up, v * print.height)
            .addScaledVector(print.facing, RAY_START_MM),
          print.facing.clone().negate(),
        );
        const [hit] = raycaster.intersectObjects(parts, false);
        if (hit) surface = Math.max(surface, hit.point.dot(print.facing));
      }
    }
    if (surface === -Infinity) {
      throw new Error(`Silkscreen: no surface under ${print.file}`);
    }
    const { front, back } = REACH_MM;
    const position = print.center
      .clone()
      .addScaledVector(
        print.facing,
        surface - print.center.dot(print.facing) - (back - front) / 2,
      );
    const size = new THREE.Vector3(
      print.width + 2 * MARGIN_MM,
      print.height + 2 * MARGIN_MM,
      front + back,
    );
    const cell = cells[i];
    for (const part of parts) {
      const faces = facingFaces(
        part.geometry,
        print.facing,
        position,
        size.length() / 2,
      );
      const decal = new DecalGeometry(
        new THREE.Mesh(faces),
        position,
        orientation,
        size,
      );
      faces.dispose();
      // A part the print misses (the top box's shell around its lid).
      if (!decal.getAttribute("position").count) {
        decal.dispose();
        continue;
      }
      // From the print's square to its cell (the canvas is flipped in Y).
      const uv = decal.getAttribute("uv");
      for (let v = 0; v < uv.count; v++) {
        uv.setXY(
          v,
          (cell.x + uv.getX(v) * cell.width) / width,
          1 - (cell.y + (1 - uv.getY(v)) * cell.height) / height,
        );
      }
      decals[print.ink].push(decal);
    }
  });
  return Object.fromEntries(
    INKS.map((ink) => {
      const merged = mergeGeometries(decals[ink])!;
      decals[ink].forEach((decal) => decal.dispose());
      return [ink, merged];
    }),
  ) as Record<Ink, THREE.BufferGeometry>;
};
