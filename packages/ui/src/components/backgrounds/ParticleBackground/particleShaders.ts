export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in float aBaseBrightness;
layout(location = 2) in float aPhase;

uniform mat4 uProjection;
uniform mat4 uView;
uniform float uTime;
uniform float uSizeScale;
uniform float uFlicker;
uniform float uFlickerSpeed;
uniform float uBrightness;

out float vBrightness;

void main() {
  vec4 viewPos = uView * vec4(aPosition, 1.0);
  gl_Position = uProjection * viewPos;
  // Perspective-scaled point size: nearer particles render larger.
  float dist = max(0.1, -viewPos.z);
  gl_PointSize = max(1.0, uSizeScale / dist);
  // Per-particle frequency variation derived from phase (aPhase is 0..2*PI).
  float perFreq = 0.4 + aPhase * 0.45;
  float wave = 0.5 + 0.5 * sin(uTime * 0.003 * uFlickerSpeed * perFreq + aPhase * 5.0);
  // Pinch the wave so on-states are short and bright (twinkle), not a smooth sine.
  float twinkle = pow(wave, 3.0);
  float flicker = mix(1.0, twinkle, clamp(uFlicker, 0.0, 1.0));
  vBrightness = aBaseBrightness * flicker * uBrightness;
}
`

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in float vBrightness;

uniform vec3 uColor;
uniform float uOpacity;
uniform float uGlow;
uniform float uCoreIntensity;

out vec4 outColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float r = sqrt(r2) * 2.0;          // 0 at center, 1 at edge of disc
  float t = 1.0 - r;
  // Two-lobe profile: a wide soft halo + a tight bright core. Stacked under
  // additive blending this reads as a star/flare instead of a flat dot.
  float halo = pow(t, 1.5) * 0.45 * uGlow;
  float core = pow(t, 8.0) * uCoreIntensity;
  float intensity = (halo + core) * vBrightness;
  // Saturate the core a touch so dense regions bloom toward white.
  vec3 rgb = mix(uColor, vec3(1.0), core * 0.6);
  outColor = vec4(rgb * intensity, intensity * uOpacity);
}
`
