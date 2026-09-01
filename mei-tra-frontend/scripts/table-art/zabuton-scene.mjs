/**
 * The 西陣織 zabuton that the trick is played onto, as a three.js scene.
 *
 * This is authoring input, not shipped code: `scripts/build-table-art.mjs`
 * renders it once through headless Chromium and commits the WebP. Nothing here
 * reaches the browser bundle.
 *
 * The cushion is a static prop, so baking it buys the whole of a real renderer
 * — soft shadows, a lit dome, a metallic border — at zero runtime cost. The
 * previous SVG had to fake all of that by stacking dozens of flat translucent
 * shapes, because react-native-svg draws no gradient, filter or pattern.
 *
 * FRAMING CONTRACT
 * ----------------
 * The cards land on the *top face*, so its projected size is what the layout
 * code has to know. The scene is arranged so that face is centred on the
 * canvas — that keeps every centring rule on web and native untouched — and
 * the renderer measures the face rather than trusting these numbers, writing
 * the measurement into `public/table/manifest.json`. See TARGET_FACE_HEIGHT.
 */

/** Colours carried over from the SVG this replaces, so the table reads the same. */
export const PALETTE = {
  cloth: '#8d251c',
  clothShadow: '#6b1a13',
  motif: '#c9a34e',
  pipingCore: '#c9a34e',
  pipingDark: '#8a6c2e',
  pipingLit: '#e0c784',
};

/**
 * Fraction of the canvas height the top face must span.
 *
 * Everything below it — the thickness and the contact shadow — has to fit in
 * the margin left over, and the face is centred, so the same margin is
 * mirrored above. 0.82 is the largest value that still leaves room for a
 * thickness thick enough to read at 190pt. The renderer solves the camera
 * distance that lands on it, at a fixed elevation, and records what it
 * measured — so the layout constants come from the picture, not a guess.
 */
export const TARGET_FACE_HEIGHT = 0.82;

const SEGMENTS_AROUND = 256;
const SEGMENTS_RADIAL = 72;

/** Squircle exponent. 2 is a circle, ∞ a square; a zabuton sits around 5. */
const FOOTPRINT_EXPONENT = 5.2;
/** Half-thickness at the centre, as a fraction of the half-width. */
const CROWN = 0.17;
/** How far the seam sits below the crown, same units. */
const SEAM_DROP = 0.055;

/**
 * Superellipse radius at angle θ, normalised so the flat sides sit at 1.
 * |x|^n + |y|^n = 1 in polar form.
 */
function footprintRadius(theta) {
  const c = Math.abs(Math.cos(theta));
  const s = Math.abs(Math.sin(theta));
  return (c ** FOOTPRINT_EXPONENT + s ** FOOTPRINT_EXPONENT) ** (-1 / FOOTPRINT_EXPONENT);
}

/**
 * Height of the stuffed face above the seam plane, for normalised radius t.
 *
 * `(1 - t^2)^0.55` domes through the middle and falls away toward the seam,
 * which is how a corner-tufted cushion actually sits. The gaussian is the
 * 綴じ dimple at the centre, and the last term is the shallow radial creasing
 * that fabric takes when it is pulled to a seam — without it the dome reads as
 * moulded plastic.
 */
function faceHeight(t, theta) {
  if (t >= 1) return 0;
  const dome = (1 - t * t) ** 0.55;
  const tuft = 0.24 * Math.exp(-((t / 0.13) ** 2));
  const creases = 0.02 * Math.sin(theta * 8) * t * t * (1 - t);
  return CROWN * (dome - tuft) + creases;
}

function buildFaceGeometry(THREE, sign) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let ri = 0; ri <= SEGMENTS_RADIAL; ri += 1) {
    // Bias samples toward the rim, where the curvature is highest.
    const t = (ri / SEGMENTS_RADIAL) ** 0.85;
    for (let ai = 0; ai <= SEGMENTS_AROUND; ai += 1) {
      const theta = (ai / SEGMENTS_AROUND) * Math.PI * 2;
      const r = footprintRadius(theta) * t;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      const z = sign * faceHeight(t, theta) - (sign > 0 ? 0 : SEAM_DROP);
      positions.push(x, y, z);
      normals.push(0, 0, sign);
      // Planar UVs: the brocade is woven flat and then stuffed, so the motif
      // stretching slightly over the crown is correct rather than a defect.
      uvs.push((x + 1) / 2, (y + 1) / 2);
    }
  }

  const stride = SEGMENTS_AROUND + 1;
  for (let ri = 0; ri < SEGMENTS_RADIAL; ri += 1) {
    for (let ai = 0; ai < SEGMENTS_AROUND; ai += 1) {
      const a = ri * stride + ai;
      const b = a + stride;
      if (sign > 0) {
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      } else {
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The seam ring, in object space. Drives both the piping and the framing measurement. */
export function seamRing(THREE, segments = SEGMENTS_AROUND) {
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    const r = footprintRadius(theta);
    points.push(new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), -SEAM_DROP / 2));
  }
  return points;
}

/**
 * 七宝つなぎ woven in gold thread, as a colour map.
 *
 * Circles of radius R on a lattice of pitch R√2, plus the half-offset lattice,
 * is the classic interlock — adjacent circles cross at each other's midpoints
 * and the overlaps read as petals. The SVG this replaces had to approximate it
 * with tangent circles on a checkerboard because it was drawing every one of
 * them by hand.
 */
function buildClothTexture(THREE, size = 1536) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PALETTE.cloth;
  ctx.fillRect(0, 0, size, size);

  const radius = size / 9;
  const pitch = radius * Math.SQRT2;
  ctx.lineWidth = Math.max(2.5, size / 330);
  ctx.strokeStyle = PALETTE.motif;
  ctx.globalAlpha = 0.42;
  for (const offset of [0, 0.5]) {
    for (let i = -1; i * pitch <= size + pitch; i += 1) {
      for (let j = -1; j * pitch <= size + pitch; j += 1) {
        ctx.beginPath();
        ctx.arc((i + offset) * pitch, (j + offset) * pitch, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // A dot at each lattice node, the way the real weave anchors the interlock.
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = PALETTE.pipingLit;
  for (const offset of [0, 0.5]) {
    for (let i = -1; i * pitch <= size + pitch; i += 1) {
      for (let j = -1; j * pitch <= size + pitch; j += 1) {
        ctx.beginPath();
        ctx.arc((i + offset) * pitch, (j + offset) * pitch, ctx.lineWidth * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

/**
 * Silk weave as a normal map, derived from a height field by finite difference.
 *
 * Two out-of-phase ripples at right angles give warp over weft; the noise term
 * stops the result looking like corduroy under a hard key light.
 */
function buildWeaveNormalMap(THREE, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  const height = (x, y) => {
    const warp = Math.sin((x / size) * Math.PI * 2 * 42);
    const weft = Math.sin((y / size) * Math.PI * 2 * 42 + Math.PI / 2);
    const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return warp * 0.5 + weft * 0.5 + (grain - Math.floor(grain) - 0.5) * 0.18;
  };

  const strength = 0.9;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength;
      const dy = (height(x, y + 1) - height(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * size + x) * 4;
      image.data[index] = ((-dx / length) * 0.5 + 0.5) * 255;
      image.data[index + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
      image.data[index + 2] = (1 / length) * 0.5 * 255 + 127;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = 16;
  return texture;
}

/** 房 — the corner tassels, tucked under the seam so they read as stitched in. */
function buildTassels(THREE, group, material) {
  const strand = new THREE.CylinderGeometry(0.019, 0.009, 0.2, 8);
  for (const [cx, cy] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const corner = footprintRadius(Math.PI / 4) * 0.995;
    for (let i = -1; i <= 1; i += 1) {
      const mesh = new THREE.Mesh(strand, material);
      const spread = i * 0.22;
      mesh.position.set(
        cx * corner * Math.SQRT1_2 + cx * 0.055,
        cy * corner * Math.SQRT1_2 + cy * 0.055,
        -SEAM_DROP,
      );
      mesh.rotation.z = Math.atan2(cy, cx) + spread;
      mesh.rotation.x = Math.PI / 2;
      mesh.scale.setScalar(1);
      group.add(mesh);
    }
  }
}

/**
 * Builds the whole scene. `elevation` is the camera angle above the table in
 * radians; `solveFraming` in the renderer varies it to hit TARGET_FACE_HEIGHT.
 */
export function buildZabuton(THREE, { elevation, distance = 9 }) {
  const scene = new THREE.Scene();
  const cushion = new THREE.Group();

  const map = buildClothTexture(THREE);
  const normalMap = buildWeaveNormalMap(THREE);

  const clothMaterial = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
    roughness: 0.86,
    metalness: 0.02,
  });
  const underside = new THREE.MeshStandardMaterial({
    color: PALETTE.clothShadow,
    roughness: 0.94,
    metalness: 0,
  });

  const top = new THREE.Mesh(buildFaceGeometry(THREE, 1), clothMaterial);
  const bottom = new THREE.Mesh(buildFaceGeometry(THREE, -1), underside);
  top.castShadow = true;
  bottom.castShadow = true;
  cushion.add(top, bottom);

  // 縁 — the piping. Two tubes: a dark core that reads as the shadowed
  // underside of the cord, and the lit gold band sitting just above it.
  const curve = new THREE.CatmullRomCurve3(seamRing(THREE), true);
  const gold = new THREE.MeshStandardMaterial({
    color: PALETTE.pipingCore,
    roughness: 0.34,
    metalness: 0.72,
  });
  const goldDark = new THREE.MeshStandardMaterial({
    color: PALETTE.pipingDark,
    roughness: 0.5,
    metalness: 0.6,
  });
  const piping = new THREE.Mesh(new THREE.TubeGeometry(curve, 512, 0.028, 16, true), gold);
  const pipingShadow = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 512, 0.034, 16, true),
    goldDark,
  );
  pipingShadow.position.z = -0.012;
  piping.castShadow = true;
  cushion.add(pipingShadow, piping);

  buildTassels(THREE, cushion, gold);

  // 綴じ — the knot that holds the stuffing at the centre.
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), gold);
  knot.position.z = faceHeight(0, 0) - 0.012;
  knot.scale.set(1, 1, 0.6);
  cushion.add(knot);

  // Shadow catcher: transparent except where the cushion darkens it, so the
  // felt table shows through the WebP's alpha instead of a baked-in ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.ShadowMaterial({ opacity: 0.42 }),
  );
  ground.position.z = -CROWN - SEAM_DROP - 0.012;
  ground.receiveShadow = true;

  // Cushion and ground move together when the renderer centres the top face,
  // so their relative geometry — and therefore the shadow — never shifts. The
  // lights stay out of this group: a DirectionalLight aims at its target
  // object, which is not in the scene graph, so translating one would swing
  // the key light instead of sliding the subject.
  const content = new THREE.Group();
  content.add(cushion, ground);
  scene.add(content);

  // Key light from the upper left, matching the highlight direction the SVG
  // used, so the cushion sits the same way on the table as before.
  const key = new THREE.DirectionalLight(0xfff4e2, 1.85);
  key.position.set(-3.4, 3.8, 6.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.blurSamples = 24;
  key.shadow.bias = -0.0012;
  const shadowCamera = key.shadow.camera;
  shadowCamera.left = -2.2;
  shadowCamera.right = 2.2;
  shadowCamera.top = 2.2;
  shadowCamera.bottom = -2.2;
  shadowCamera.near = 0.5;
  shadowCamera.far = 20;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.32);
  fill.position.set(4.2, -2.4, 3.4);
  scene.add(fill);

  scene.add(new THREE.HemisphereLight(0xfff1dd, 0x2a1410, 0.5));

  // A long lens: the cards sit on the top face in a symmetric cross, so
  // keystoning between the near and far edge would make them look misplaced.
  const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(
    0,
    -Math.cos(elevation) * distance,
    Math.sin(elevation) * distance,
  );
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  return { scene, camera, cushion, content };
}
