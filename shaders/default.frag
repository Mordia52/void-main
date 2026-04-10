uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
uniform int   iFrame;

void main() {
  vec2 uv  = gl_FragCoord.xy / iResolution.xy;
  vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0, 2.0, 4.0));
  gl_FragColor = vec4(col, 1.0);
}
