export const DEFAULT_VERT = `\
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const DEFAULT_FRAG = `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

void main() {
  vec2 uv  = gl_FragCoord.xy / iResolution.xy;
  vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0, 2.0, 4.0));
  gl_FragColor = vec4(col, 1.0);
}`;

export const PRESETS = [
  {
    name: 'UV Gradient',
    category: 'Basics',
    teaches: 'How UV coordinates map to color',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  gl_FragColor = vec4(uv, 0.0, 1.0);
}`,
  },
  {
    name: 'Solid Color',
    category: 'Basics',
    teaches: 'Uniform usage, vec3 output',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

uniform vec3 uColor;

void main() {
  gl_FragColor = vec4(uColor, 1.0);
}`,
  },
  {
    name: 'Sine Wave',
    category: 'Animation',
    teaches: 'iTime, sin(), color animation',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

void main() {
  vec2  uv   = gl_FragCoord.xy / iResolution.xy;
  float wave = 0.5 + 0.5 * sin(uv.x * 10.0 - iTime * 2.0);
  vec3  col  = vec3(uv.x, wave, 0.5 + 0.5 * sin(iTime));
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: 'Checkerboard',
    category: 'Patterns',
    teaches: 'floor(), mod(), UV math',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

void main() {
  vec2  uv      = gl_FragCoord.xy / iResolution.xy;
  vec2  grid    = floor(uv * 8.0);
  float checker = mod(grid.x + grid.y, 2.0);
  vec3  col     = mix(vec3(0.08), vec3(0.92), checker);
  gl_FragColor  = vec4(col, 1.0);
}`,
  },
  {
    name: 'Circle SDF',
    category: 'SDFs',
    teaches: 'Signed distance fields intro',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

float sdCircle(vec2 p, float r) { return length(p) - r; }

void main() {
  vec2  uv   = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  float d    = sdCircle(uv, 0.3);
  float edge = smoothstep(0.005, -0.005, d);
  vec3  col  = mix(vec3(0.05), vec3(0.0, 0.9, 1.0), edge);
  col = mix(col, vec3(0.5 + 0.5 * sin(d * 30.0 - iTime)), 0.3 * (1.0 - edge));
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: 'Smooth Blob',
    category: 'SDFs',
    teaches: 'SDF combination, smoothstep',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

float sdCircle(vec2 p, float r) { return length(p) - r; }

float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

void main() {
  vec2  uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  float t  = iTime * 0.7;
  vec2  p1 = vec2(sin(t) * 0.25,       cos(t * 1.3) * 0.2);
  vec2  p2 = vec2(cos(t * 0.8) * 0.2,  sin(t * 1.1) * 0.25);
  vec2  p3 = vec2(sin(t * 1.5) * 0.15, sin(t * 0.9) * 0.2);
  float d1 = sdCircle(uv - p1, 0.18);
  float d2 = sdCircle(uv - p2, 0.15);
  float d3 = sdCircle(uv - p3, 0.12);
  float d  = opSmoothUnion(opSmoothUnion(d1, d2, 0.1), d3, 0.08);
  float e  = smoothstep(0.005, -0.005, d);
  vec3  col = mix(vec3(0.04, 0.04, 0.1), vec3(0.0, 0.8, 1.0), e);
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: 'Perlin Noise',
    category: 'Noise',
    teaches: 'Classic noise function, fbm',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
                 dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
             mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
                 dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p  = p * 2.0 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2  uv  = gl_FragCoord.xy / iResolution.xy * 3.0;
  float n   = fbm(uv + iTime * 0.2);
  vec3  col = 0.5 + 0.5 * cos(n * 6.28 + vec3(0.0, 2.1, 4.2));
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: 'Phong Lighting',
    category: 'Lighting',
    teaches: 'Normal reconstruction, diffuse+specular',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

float sdSphere(vec3 p, float r) { return length(p) - r; }

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    sdSphere(p + e.xyy, 1.0) - sdSphere(p - e.xyy, 1.0),
    sdSphere(p + e.yxy, 1.0) - sdSphere(p - e.yxy, 1.0),
    sdSphere(p + e.yyx, 1.0) - sdSphere(p - e.yyx, 1.0)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro  = vec3(0.0, 0.0, 3.0);
  vec3 rd  = normalize(vec3(uv, -1.5));
  float t  = 0.0;
  for (int i = 0; i < 64; i++) {
    float d = sdSphere(ro + rd * t, 1.0);
    if (d < 0.001 || t > 10.0) break;
    t += d;
  }
  vec3 col = vec3(0.05);
  if (t < 10.0) {
    vec3  p    = ro + rd * t;
    vec3  n    = calcNormal(p);
    vec3  l    = normalize(vec3(2.0 * cos(iTime), 1.5, 3.0) - p);
    vec3  h    = normalize(l - rd);
    float diff = max(dot(n, l), 0.0);
    float spec = pow(max(dot(n, h), 0.0), 64.0);
    col = vec3(0.2, 0.5, 1.0) * (0.08 + diff) + vec3(1.0) * spec;
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: 'Cel Shading',
    category: 'Lighting',
    teaches: 'Toon shading, step() function',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

float sdSphere(vec3 p, float r) { return length(p) - r; }

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    sdSphere(p + e.xyy, 1.0) - sdSphere(p - e.xyy, 1.0),
    sdSphere(p + e.yxy, 1.0) - sdSphere(p - e.yxy, 1.0),
    sdSphere(p + e.yyx, 1.0) - sdSphere(p - e.yyx, 1.0)
  ));
}

void main() {
  vec2  uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec3  ro = vec3(0.0, 0.0, 3.0);
  vec3  rd = normalize(vec3(uv, -1.5));
  float t  = 0.0;
  for (int i = 0; i < 64; i++) {
    float d = sdSphere(ro + rd * t, 1.0);
    if (d < 0.001 || t > 10.0) break;
    t += d;
  }
  vec3 col = vec3(0.08, 0.05, 0.12);
  if (t < 10.0) {
    vec3  p    = ro + rd * t;
    vec3  n    = calcNormal(p);
    vec3  l    = normalize(vec3(2.0 * cos(iTime), 1.5, 2.0));
    float diff = max(dot(n, l), 0.0);
    float toon = step(0.0, diff) * 0.15
               + step(0.3, diff) * 0.25
               + step(0.6, diff) * 0.30
               + step(0.9, diff) * 0.30;
    float rim  = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col = vec3(0.9, 0.3, 0.2) * toon + vec3(1.0, 0.6, 0.2) * rim * 0.5;
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: 'Rainbow',
    category: 'Fun',
    teaches: 'Hue rotation, hsv2rgb',
    frag: `\
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

vec3 hsv2rgb(vec3 c) {
  vec4  K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3  p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2  uv  = gl_FragCoord.xy / iResolution.xy;
  float hue = uv.x + iTime * 0.1;
  float sat = 0.8 + 0.2 * sin(uv.y * 6.28 + iTime);
  vec3  col = hsv2rgb(vec3(hue, sat, 0.9));
  gl_FragColor = vec4(col, 1.0);
}`,
  },
];
