/**
 * A compact, self-contained Perlin Noise implementation.
 * Classic improved Perlin noise by Ken Perlin (2002).
 * Produces smooth, continuous pseudorandom values between roughly -1 and 1.
 */

const PERM = new Uint8Array(512);
const PERM_MOD12 = new Uint8Array(512);

// Gradient table for 3D Perlin — only the XZ plane used here for 2D
const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

// Seed with a deterministic shuffle so the pattern is the same on every load
const p: number[] = [];
for (let i = 0; i < 256; i++) p[i] = i;
// Fisher-Yates using a simple LCG for determinism
let seed = 31415926;
for (let i = 255; i > 0; i--) {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  const j = ((seed >>> 0) % (i + 1));
  [p[i], p[j]] = [p[j], p[i]];
}
for (let i = 0; i < 512; i++) {
  PERM[i] = p[i & 255];
  PERM_MOD12[i] = PERM[i] % 12;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const g = GRAD3[hash % 12];
  return g[0] * x + g[1] * y;
}

/**
 * 2D Perlin noise value at (x, y). Returns a value in roughly [-1, 1].
 */
export function perlin2(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = PERM[PERM[xi    ] + yi    ];
  const ab = PERM[PERM[xi    ] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi    ];
  const bb = PERM[PERM[xi + 1] + yi + 1];

  return lerp(
    lerp(grad(aa, xf,     yf    ), grad(ba, xf - 1, yf    ), u),
    lerp(grad(ab, xf,     yf - 1), grad(bb, xf - 1, yf - 1), u),
    v
  );
}

/**
 * Fractal / Octave Perlin noise. Sums multiple octaves for a richer signal.
 * Returns value normalized to roughly [0, 1].
 * @param x  X coordinate
 * @param y  Y coordinate
 * @param octaves  Number of octaves (2-6 typical)
 * @param persistence  Amplitude falloff per octave (0.4-0.6 typical)
 * @param lacunarity  Frequency multiplier per octave (2.0 typical)
 */
export function fractalNoise(
  x: number,
  y: number,
  octaves = 4,
  persistence = 0.5,
  lacunarity = 2.0
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += perlin2(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  // Normalize to [0, 1]
  return (value / maxValue) * 0.5 + 0.5;
}
