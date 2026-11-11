import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadMachineModel } from "./machineModel";
import { INKS, type Ink, layPrints, loadSilkscreen } from "./silkscreen";

// The machine in 3D, framed and lit like the product render it was matched
// to ("the render" below). It is laid over machine-*.png, stills of its own
// front view (scripts/render-machine-stills.mjs), and takes their place
// without a jump once it has drawn. The render's camera, measured from it,
// sits 2290 mm in front of the front face at 297 mm high, and the stills'
// full height spans 491 mm at that face.
const CAMERA = new THREE.Vector3(0, 297, 2290);
// The point the machine turns about: the middle of its footprint, on the
// line to the center of the stills.
const TARGET = new THREE.Vector3(0, 202.7, 30);
const RENDER_SPAN_MM = 491;
// The canvas is this much taller than the render's box, so the top and the
// tray stay in view when tilted.
const OVERSCAN = 1.3;
const FOV = THREE.MathUtils.radToDeg(
  2 * Math.atan((RENDER_SPAN_MM * OVERSCAN) / 2 / CAMERA.z),
);
// Where the key light comes from, relative to the machine, seen from the front.
const KEY_LIGHT = new THREE.Vector3(-300, 900, 300);
// The render's front light, read off its shading: close in front, up and
// to the left, aimed high. The top box's satin front catches it brightest
// at the top, the panel darkens downward (distance, and the edge of the
// cone), and it casts soft shadows to the right of and below the top box,
// the funnel and the knob. Relative to TARGET, as is the point it aims at.
const FRONT_LIGHT = {
  position: new THREE.Vector3(-170, 360, 880),
  aim: new THREE.Vector3(0, 200, -30),
  // Candela at full strength; the scene is in millimeters.
  intensity: 2.5e6,
  angle: THREE.MathUtils.degToRad(28),
};
const FLOOR_Y = -5.5;
const RESET_MS = 700;
const HINT = "Drag to turn the machine. Double-click to face it again.";
// Two taps this close in time (ms) and place (CSS px) make a double tap.
const DOUBLE_TAP = { ms: 350, px: 30 };
// How far the machine tilts: the camera's angle down from straight above.
const TILT = {
  min: THREE.MathUtils.degToRad(62),
  max: THREE.MathUtils.degToRad(92),
};

export type MachineColor = "black" | "white";

interface Coat {
  color: number;
  roughness: number;
}

type Coated = "body" | "satin" | "topbox" | "knob" | "plastic";

interface Look extends Record<Coated | Ink, Coat> {
  // Share of FRONT_LIGHT's intensity, and the environment's strength as
  // fill under it.
  front: number;
  fill: number;
  exposure: number;
}

// Per machine color: the powder coat on the body, the funnel and its
// platform with more sheen, the top box's front smoother still (the front
// light fades down it), the knob, the molded drip tray under the grate, the
// silkscreen's inks, and the light balance that brings each to the render's
// tones. The black reads by its sheen and takes the front light at full; on
// the white its falloff would show, and the render's white is lit nearly
// evenly, so it gets more fill instead.
const LOOKS: Record<MachineColor, Look> = {
  black: {
    front: 1,
    fill: 0.7,
    exposure: 1,
    body: { color: 0x282828, roughness: 0.52 },
    satin: { color: 0x202020, roughness: 0.34 },
    topbox: { color: 0x202020, roughness: 0.3 },
    knob: { color: 0x262626, roughness: 0.4 },
    plastic: { color: 0x1a1a1a, roughness: 0.4 },
    brand: { color: 0x0a0a0a, roughness: 0.12 },
    label: { color: 0xdedede, roughness: 0.5 },
  },
  white: {
    front: 0.36,
    fill: 1.1,
    exposure: 0.46,
    body: { color: 0xe6e6e4, roughness: 0.62 },
    satin: { color: 0xe8e8e6, roughness: 0.45 },
    topbox: { color: 0xe8e8e6, roughness: 0.4 },
    knob: { color: 0xececea, roughness: 0.5 },
    plastic: { color: 0xdcdcda, roughness: 0.4 },
    brand: { color: 0x8c8c8c, roughness: 0.4 },
    label: { color: 0x8c8c8c, roughness: 0.4 },
  },
};
// The tube's reflections, scaled against the exposure so it shines the
// same on either color.
const TUBE_SHINE = 1;

type Finish =
  | "body"
  | "satin"
  | "topbox"
  | "knob"
  | "plastic"
  | "tube"
  | "steel"
  | "glass"
  | "rubber"
  | "port";

// Parts that are not powder coated.
const FINISHES: Record<string, Finish> = {
  "plunger-tube": "tube",
  plunger: "tube",
  "shower-screen": "steel",
  "display-lens": "glass",
  encoder: "knob",
  "drip-tray": "plastic",
  funnel: "satin",
  "brew-platform-top": "satin",
  "brew-platform-bottom": "satin",
  "upper-shell": "topbox",
  "upper-lid": "topbox",
  "foot-front-left": "rubber",
  "foot-front-right": "rubber",
  "foot-rear-left": "rubber",
  "foot-rear-right": "rubber",
  "scale-foot-front-left": "rubber",
  "scale-foot-front-right": "rubber",
  "scale-foot-rear-left": "rubber",
  "scale-foot-rear-right": "rubber",
  "power-socket": "port",
  "usb-port": "port",
  "expansion-port-faces": "port",
  "power-button": "port",
};

// The fine grain of the powder coat: value noise in model space (mm) that
// bumps the normal and varies the roughness, faded out where a grain cell
// gets smaller than a pixel so it doesn't shimmer.
const GRAIN_CELL_MM = 1.1;
const GRAIN_DEPTH_MM = 0.035;

const addGrain = (material: THREE.MeshPhysicalMaterial) => {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vGrainPos;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGrainPos = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
varying vec3 vGrainPos;
float grainHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float grainNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(grainHash(i), grainHash(i + vec3(1, 0, 0)), u.x),
        mix(grainHash(i + vec3(0, 1, 0)), grainHash(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(grainHash(i + vec3(0, 0, 1)), grainHash(i + vec3(1, 0, 1)), u.x),
        mix(grainHash(i + vec3(0, 1, 1)), grainHash(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
vec3 grainPos = vGrainPos / ${GRAIN_CELL_MM.toFixed(3)};
float grainFade = 1.0 - smoothstep(0.35, 0.8, length(fwidth(grainPos)));
float grain = grainNoise(grainPos);
roughnessFactor *= mix(1.0, 0.86 + 0.28 * grain, grainFade);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
{
  // Bump mapping from screen-space derivatives (as three's bumpMap does).
  vec3 sigmaX = dFdx(-vViewPosition);
  vec3 sigmaY = dFdy(-vViewPosition);
  vec3 r1 = cross(sigmaY, normal);
  vec3 r2 = cross(normal, sigmaX);
  float det = dot(sigmaX, r1);
  float height = grain * ${GRAIN_DEPTH_MM.toFixed(3)} * grainFade;
  vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
  normal = normalize(abs(det) * normal - gradient);
}`,
      );
  };
};

// The top box shades the top of the tube, and the reflections (and the
// shadow map, blurred this wide) don't know: they fade out over the last
// millimeters below it, as in the render (model space, mm).
const TUBE_SHADE = { top: 317, fade: 7, floor: 0.1 };

const shadeTubeTop = (material: THREE.MeshPhysicalMaterial) => {
  const { top, fade, floor } = TUBE_SHADE;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vShadeY;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvShadeY = position.y;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vShadeY;")
      .replace(
        "#include <aomap_fragment>",
        /* glsl */ `#include <aomap_fragment>
{
  float shade = mix(1.0, ${floor.toFixed(2)}, smoothstep(${(top - fade).toFixed(1)}, ${top.toFixed(1)}, vShadeY));
  reflectedLight.directSpecular *= shade;
  reflectedLight.indirectSpecular *= shade;
}`,
      );
  };
  return material;
};

// The silkscreen's ink, printed over the coat: it takes the coat's grain, and
// is drawn just in front of it.
const createInk = () => {
  const material = new THREE.MeshPhysicalMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  addGrain(material);
  return material;
};

// Colors and roughness of the coated parts and the inks come from LOOKS
// (paint).
const createMaterials = () => {
  const body = new THREE.MeshPhysicalMaterial({ specularIntensity: 0.4 });
  addGrain(body);
  // More sheen, so the funnel's curves catch highlights.
  const satin = new THREE.MeshPhysicalMaterial({ specularIntensity: 1 });
  addGrain(satin);
  const topbox = new THREE.MeshPhysicalMaterial({ specularIntensity: 0.3 });
  addGrain(topbox);
  const materials = {
    body,
    satin,
    topbox,
    knob: new THREE.MeshPhysicalMaterial({ specularIntensity: 0.5 }),
    plastic: new THREE.MeshPhysicalMaterial(),
    // Polished stainless steel: a little rougher and darker than chrome.
    tube: shadeTubeTop(
      new THREE.MeshPhysicalMaterial({
        color: 0xc9c9c9,
        metalness: 1,
        roughness: 0.22,
      }),
    ),
    steel: new THREE.MeshPhysicalMaterial({
      color: 0xc8c8c8,
      metalness: 1,
      roughness: 0.32,
    }),
    // The round display, black glass. It reflects little, so it stays black
    // from the front (as in the render) with a faint glint at an angle.
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      roughness: 0.05,
      specularIntensity: 0.15,
    }),
    rubber: new THREE.MeshPhysicalMaterial({
      color: 0x0c0c0c,
      roughness: 0.9,
    }),
    port: new THREE.MeshPhysicalMaterial({
      color: 0x101010,
      roughness: 0.7,
    }),
    brand: createInk(),
    label: createInk(),
  } satisfies Record<Finish | Ink, THREE.MeshPhysicalMaterial>;
  for (const material of Object.values(materials)) {
    // The CAD export has faces wound both ways. Drawn double sided, three
    // turns each normal toward the viewer, so either way lights correctly.
    material.side = THREE.DoubleSide;
    // Breaks up banding in the slow gradients on the dark coat.
    material.dithering = true;
  }
  return materials;
};

const paint = (
  {
    materials,
    renderer,
    scene,
    front,
  }: {
    materials: ReturnType<typeof createMaterials>;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    front: THREE.SpotLight;
  },
  color: MachineColor,
) => {
  const look = LOOKS[color];
  const coated = ["body", "satin", "topbox", "knob", "plastic"] as const;
  for (const part of [...coated, ...INKS]) {
    materials[part].color.set(look[part].color);
    materials[part].roughness = look[part].roughness;
  }
  front.intensity = FRONT_LIGHT.intensity * look.front;
  scene.environmentIntensity = look.fill;
  renderer.toneMappingExposure = look.exposure;
  materials.tube.envMapIntensity = TUBE_SHINE / look.exposure;
};

// A product-photo studio, as an environment map: grey surroundings and
// softboxes (emissive planes facing the machine), in meters around it.
interface Softbox {
  position: [number, number, number];
  size: [number, number];
  intensity: number;
}

const STUDIO_SURROUNDINGS = 0.6;
const SOFTBOXES: Softbox[] = [
  // Overhead, a little in front.
  { position: [0, 7, 2], size: [10, 10], intensity: 3 },
  // Behind the camera.
  { position: [0, 1, 8], size: [8, 5], intensity: 1.4 },
  // Either side: highlights down curved parts.
  { position: [-7, 2, 3], size: [4, 8], intensity: 1.6 },
  { position: [7, 2, 3], size: [4, 8], intensity: 1.2 },
  // Behind, either side and low: rims on the edges, and a sheen on the
  // tops seen at a glancing angle.
  { position: [-6, 2, -5], size: [3, 8], intensity: 2.5 },
  { position: [6, 2, -5], size: [3, 8], intensity: 2.5 },
  { position: [0, 1, -8], size: [10, 3], intensity: 2 },
];

// The tube's own studio, dark, with strips placed so the steel shows the
// render's bands. Read off its profile across the tube: a vertical
// cylinder seen from the front reflects, at a point whose normal turns θ
// from the view, the direction 2θ round from the camera. So: the
// highlight from just left of the camera, a lighter band from the left, a
// dark right third (nothing to the right), and bright rims at both edges
// from behind either side.
const TUBE_SURROUNDINGS = 0.02;
const TUBE_SOFTBOXES: Softbox[] = [
  { position: [-0.5, 0, 8], size: [6, 12], intensity: 1.3 },
  { position: [-7.5, 0, 2.7], size: [10, 12], intensity: 0.75 },
  { position: [-4.6, 0, -6.5], size: [6, 12], intensity: 1.2 },
  { position: [6.9, 0, -4], size: [7, 12], intensity: 1.3 },
];

const createStudio = (
  renderer: THREE.WebGLRenderer,
  surroundings: number,
  softboxes: Softbox[],
) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color().setScalar(surroundings);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = softboxes.map((softbox) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setScalar(softbox.intensity),
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(...softbox.position);
    plane.scale.set(...softbox.size, 1);
    plane.lookAt(0, 0, 0);
    scene.add(plane);
    return material;
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  geometry.dispose();
  materials.forEach((material) => material.dispose());
  return texture;
};

// A blurred dark rounded rectangle, centered on a plane `span` mm square
// (sizes in mm).
const createSoftShadow = (
  span: number,
  shape: { width: number; height: number; corner: number },
  blur: number,
  opacity: number,
) => {
  const size = 256;
  const px = size / span;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  // Drawn off the canvas so only its blurred shadow lands on it.
  context.shadowColor = `rgba(0, 0, 0, ${opacity})`;
  context.shadowBlur = blur * px;
  context.shadowOffsetX = size;
  context.beginPath();
  context.roundRect(
    (size - shape.width * px) / 2 - size,
    (size - shape.height * px) / 2,
    shape.width * px,
    shape.height * px,
    shape.corner * px,
  );
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(span, span),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
};

// Contact shadows the shadow map is too soft for: on the floor under the
// footprint, seen when the machine is tilted toward you, and on the panel
// under the knob (it stands only 13 mm off), offset away from the front
// light as in the render.
const createContactShadows = () => {
  const floor = createSoftShadow(
    480,
    { width: 240, height: 240, corner: 19 },
    41,
    0.55,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y + 0.2, 30);
  const knob = createSoftShadow(
    70,
    { width: 34, height: 34, corner: 17 },
    5,
    0.6,
  );
  knob.position.set(92, 326.5, 0.25);
  // The slot between the top box and the funnel, where the tube runs: a
  // recess the fill light would otherwise light as if it were open.
  // Kept inside the top box's width, so it doesn't show past it when the
  // machine is turned.
  const recess = createSoftShadow(
    140,
    { width: 76, height: 36, corner: 3 },
    4,
    0.42,
  );
  recess.position.set(-45, 305, 0.25);
  return [floor, knob, recess];
};

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export interface Machine3DProps {
  color: MachineColor;
  // Called once the first frame with the machine is on screen.
  onReady: () => void;
  onError: (error: unknown) => void;
}

const Machine3D = ({ color, onReady, onError }: Machine3DProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  // Repaints the machine in a color, once the scene is set up.
  const paintRef = useRef<(color: MachineColor) => void>(() => {});
  const colorRef = useRef(color);
  colorRef.current = color;
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const handle = handleRef.current;
    if (!host || !handle) return;
    const abort = new AbortController();
    const disposables: { dispose: () => void }[] = [];

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      callbacks.current.onError(error);
      return;
    }
    disposables.push(renderer);
    // A GPU that can't compile the shaders, or drops the context (phones do,
    // short of memory or in the background), leaves the render in its place.
    renderer.debug.onShaderError = (gl, program) =>
      callbacks.current.onError(
        new Error(`Shader error: ${gl.getProgramInfoLog(program)}`),
      );
    const onContextLost = () =>
      callbacks.current.onError(new Error("WebGL context lost"));
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    // Variance shadow maps blur into the wide, smooth penumbras of the
    // render's soft light.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const environment = createStudio(renderer, STUDIO_SURROUNDINGS, SOFTBOXES);
    const tubeEnvironment = createStudio(
      renderer,
      TUBE_SURROUNDINGS,
      TUBE_SOFTBOXES,
    );
    disposables.push(environment, tubeEnvironment);
    scene.environment = environment;

    const materials = createMaterials();
    // Its own map also lets the tube's envMapIntensity count (it's ignored
    // under scene.environment).
    materials.tube.envMap = tubeEnvironment;
    disposables.push(...Object.values(materials));

    // Light from above: the tops and the tray grate read lighter than the
    // fronts, as in the render.
    const key = new THREE.DirectionalLight(0xffffff, 6);
    key.target.position.copy(TARGET);
    scene.add(key, key.target);

    // Its intensity comes with the color's look (paint).
    const front = new THREE.SpotLight(0xffffff, 0, 0, FRONT_LIGHT.angle, 1, 2);
    front.castShadow = true;
    front.shadow.mapSize.set(1024, 1024);
    // A wide blur and partly lit shadows, as under a large softbox: they
    // fade the further the part stands off the panel.
    front.shadow.radius = 18;
    front.shadow.blurSamples = 20;
    front.shadow.intensity = 0.8;
    // three keeps variance shadow maps in half floats, and a spot light's
    // depth is perspective: with the near plane far from the machine, a
    // half-float step spans millimeters and surfaces shadow themselves in
    // diagonal bands (on GPUs; software renderers keep more precision). The
    // near plane sits just short of the closest part (~800 mm away), and
    // the bias clears a step.
    front.shadow.camera.near = 500;
    front.shadow.camera.far = 1500;
    front.shadow.bias = -0.002;
    scene.add(front, front.target);
    disposables.push(front.shadow);
    const studio = { materials, renderer, scene, front };
    paint(studio, colorRef.current);

    // The studio turns with the camera, as if the machine turned on a
    // turntable under fixed lights: every side gets the front's light.
    const place = (
      object: THREE.Object3D,
      offset: THREE.Vector3,
      azimuth: number,
    ) =>
      object.position
        .copy(offset)
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, azimuth)
        .add(TARGET);
    const turnStudio = (azimuth: number) => {
      // three turns the environment the opposite way to an object.
      scene.environmentRotation.y = -azimuth;
      materials.tube.envMapRotation.y = -azimuth;
      place(key, KEY_LIGHT, azimuth);
      place(front, FRONT_LIGHT.position, azimuth);
      place(front.target, FRONT_LIGHT.aim, azimuth);
    };
    turnStudio(0);

    for (const shadow of createContactShadows()) {
      scene.add(shadow);
      disposables.push(shadow.geometry, shadow.material, shadow.material.map!);
    }

    const camera = new THREE.PerspectiveCamera(FOV, 1, 100, 6000);
    camera.position.copy(CAMERA);

    const controls = new OrbitControls(camera, handle);
    controls.target.copy(TARGET);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    // Vertical swipes still scroll the page on touch screens. The browser
    // passes the first pixels of one on before it takes it over, though,
    // which would tilt the machine: a finger only turns it round.
    handle.style.touchAction = "pan-y";
    const holdTilt = (hold: boolean) => {
      const phi = controls.getPolarAngle();
      controls.minPolarAngle = hold ? phi : TILT.min;
      controls.maxPolarAngle = hold ? phi : TILT.max;
    };
    holdTilt(false);
    controls.update();
    disposables.push(controls);
    const home = new THREE.Spherical().setFromVector3(
      CAMERA.clone().sub(TARGET),
    );

    // Renders on demand: while dragging, while the turn eases out, and
    // during a reset.
    let frame = 0;
    let dragging = false;
    let reset: {
      start: number;
      from: THREE.Spherical;
      dTheta: number;
    } | null = null;
    const render = () => {
      let moving = controls.update();
      if (reset) {
        const t = Math.min(1, (performance.now() - reset.start) / RESET_MS);
        const k = easeInOut(t);
        const spherical = new THREE.Spherical(
          home.radius,
          reset.from.phi + (home.phi - reset.from.phi) * k,
          reset.from.theta + reset.dTheta * k,
        );
        camera.position.setFromSpherical(spherical).add(TARGET);
        camera.lookAt(TARGET);
        if (t === 1) reset = null;
        moving = true;
      }
      turnStudio(
        Math.atan2(camera.position.x - TARGET.x, camera.position.z - TARGET.z),
      );
      renderer.render(scene, camera);
      frame = moving || dragging ? requestAnimationFrame(render) : 0;
      // Once it stops, the machine may have turned out from under the mouse.
      if (!frame && pointer) hover();
    };
    const invalidate = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const faceFront = () => {
      const from = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(TARGET),
      );
      // The short way round.
      const dTheta =
        THREE.MathUtils.euclideanModulo(
          home.theta - from.theta + Math.PI,
          2 * Math.PI,
        ) - Math.PI;
      reset = { start: performance.now(), from, dTheta };
      // Free to tilt back to the front's.
      holdTilt(false);
      invalidate();
    };
    paintRef.current = (color) => {
      paint(studio, color);
      invalidate();
    };

    // Only the machine turns it: a press or a double-click on the page
    // around it is left alone, and the grab cursor and the hint show over it
    // only. The box that holds the machine, once loaded, so the gaps between
    // its parts count too.
    const hitbox = new THREE.Box3();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onMachine = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        ((rect.top - event.clientY) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectsBox(hitbox);
    };
    // The mouse over the handle, checked at most once a frame.
    let pointer: MouseEvent | null = null;
    let hoverFrame = 0;
    const checkHover = () => {
      hoverFrame = 0;
      if (dragging) return;
      const over = pointer !== null && onMachine(pointer);
      handle.style.cursor = over ? "grab" : "";
      handle.title = over ? HINT : "";
    };
    const hover = () => {
      if (!hoverFrame) hoverFrame = requestAnimationFrame(checkHover);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = event;
      hover();
    };
    const onPointerLeave = () => {
      pointer = null;
      hover();
    };
    // Not every phone sends a double-click for a double tap, so a second
    // quick tap on the machine, close to the first, faces it again too.
    let lastTouch: { time: number; x: number; y: number } | null = null;
    let doubleTap: { x: number; y: number } | null = null;
    // Ahead of the controls' own listener (it captures), so they skip a
    // press off the machine. A second finger joins a drag already started.
    const onPointerDown = (event: PointerEvent) => {
      if (!dragging) {
        controls.enabled = onMachine(event);
        holdTilt(event.pointerType === "touch");
      }
      if (event.pointerType !== "touch") return;
      const touch = {
        time: event.timeStamp,
        x: event.clientX,
        y: event.clientY,
      };
      doubleTap =
        controls.enabled &&
        lastTouch !== null &&
        touch.time - lastTouch.time < DOUBLE_TAP.ms &&
        Math.hypot(touch.x - lastTouch.x, touch.y - lastTouch.y) < DOUBLE_TAP.px
          ? touch
          : null;
      lastTouch = doubleTap ? null : touch;
    };
    // Before the controls end the drag: ahead of the listener they add on a
    // press.
    const onPointerUp = (event: PointerEvent) => {
      if (
        doubleTap &&
        Math.hypot(event.clientX - doubleTap.x, event.clientY - doubleTap.y) <
          DOUBLE_TAP.px
      )
        faceFront();
      doubleTap = null;
    };
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerleave", onPointerLeave);
    handle.addEventListener("pointerdown", onPointerDown, { capture: true });
    handle.addEventListener("pointerup", onPointerUp);

    controls.addEventListener("change", invalidate);
    controls.addEventListener("start", () => {
      dragging = true;
      reset = null;
      handle.style.cursor = "grabbing";
      invalidate();
    });
    controls.addEventListener("end", () => {
      dragging = false;
      hover();
      invalidate();
    });
    const onDoubleClick = (event: MouseEvent) => {
      if (onMachine(event)) faceFront();
    };
    handle.addEventListener("dblclick", onDoubleClick);

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = host;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      invalidate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    Promise.all([loadMachineModel(abort.signal), loadSilkscreen(abort.signal)])
      .then(([parts, silkscreen]) => {
        const machine = new THREE.Group();
        for (const part of parts) {
          disposables.push(part.geometry);
          const mesh = new THREE.Mesh(
            part.geometry,
            materials[FINISHES[part.id] ?? "body"],
          );
          mesh.name = part.id;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          machine.add(mesh);
        }
        hitbox.setFromObject(machine);
        const { texture } = silkscreen;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        disposables.push(texture);
        const prints = layPrints(machine, silkscreen);
        for (const ink of INKS) {
          materials[ink].map = texture;
          disposables.push(prints[ink]);
          const mesh = new THREE.Mesh(prints[ink], materials[ink]);
          mesh.receiveShadow = true;
          machine.add(mesh);
        }
        scene.add(machine);
        renderer.compile(scene, camera);
        render();
        requestAnimationFrame(() => {
          setShown(true);
          callbacks.current.onReady();
        });
      })
      .catch((error) => {
        if (!abort.signal.aborted) callbacks.current.onError(error);
      });

    return () => {
      abort.abort();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(hoverFrame);
      observer.disconnect();
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerleave", onPointerLeave);
      handle.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        onContextLost,
      );
      paintRef.current = () => {};
      for (const item of disposables) item.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => paintRef.current(color), [color]);

  return (
    <>
      <div
        ref={hostRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 ${shown ? "opacity-100" : "opacity-0"}`}
        style={{ height: `${OVERSCAN * 100}%` }}
      />
      <div ref={handleRef} className="absolute inset-0 select-none" />
    </>
  );
};

export default Machine3D;
