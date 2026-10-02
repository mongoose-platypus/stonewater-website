/* ===========================================================================
   Stonewater Waves - the brand motion field.

   A single full-screen fragment shader that draws a handful of broad, warped
   surfaces ("ribbons") over a dark navy ground. Each ribbon is a band around a
   displaced centreline; it twists along its length, so where it turns edge-on
   it narrows and catches a faint highlight, the way a sheet of fabric does.
   Fine structure - a surface mesh, sparse sampling points, a hairline edge and
   background contour lines - sits at very low contrast, so it only reads when
   you look closely.

   All motion is smooth mathematics (layered sines plus one slow noise term),
   never particles, and it is non-periodic: there is no loop to restart.

   Usage
     <canvas data-swp-waves="hero"></canvas>      auto-mounts on load
     SwpWaves.mount(canvas, 'band', { speed: 0.6 }) mounts by hand

   The canvas fills its parent; give the parent a size. Text never goes in the
   canvas - it belongs in the HTML above it.

   ---------------------------------------------------------------------------
   TUNING - everything you are likely to adjust is in SETTINGS and PRESETS
   below. SETTINGS are global dials; PRESETS hold the composition.
   =========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     SETTINGS - global dials, applied on top of every preset.
     Each preset can override any of these by name.
     ------------------------------------------------------------------------ */
  var SETTINGS = {
    speed:      1.0,   // animation speed. 1.0 = main deformation cycle of ~35 s
    amplitude:  1.0,   // how far the surfaces bend away from their paths
    width:      1.0,   // how wide the surfaces are
    brightness: 1.0,   // overall luminance of the surfaces and highlights
    density:    1.0,   // how many mesh and contour lines per surface
    detail:     1.0,   // opacity of the fine work: mesh, points, contours, edges. 0 = none
    parallax:   9,     // max pointer parallax in CSS px for the nearest surface. 0 = off
    quiet:      [1, 0, 0.20, 0.84], // where the field is quieter: [dirX, dirY, start, end]
                                    // along dir, the field sits at quietFloor before
                                    // `start` and at full strength after `end` (0-1)
    quietFloor: 0.55,  // how present the field stays in the quiet zone.
                       // 0 = empty there, 1 = no quiet zone at all
    dprCap:     1.5,   // max device-pixel ratio rendered. Higher costs GPU, gains little
    fps:        60     // frame-rate ceiling
  };

  /* ------------------------------------------------------------------------
     PRESETS - compositions.

     Each ribbon is one surface, listed back to front:
       y      height of its path where it meets the right edge (0 bottom, 1 top)
       slope  rise of its path per unit of height, travelling right
       amp    how far it bends off that path
       w      half-width, in units of canvas height
       k      undulation frequency along its length
       phase  where in its undulation it starts
       speed  its own pace relative to the others (layers drift at different rates)
       depth  0 far .. 1 near: drives parallax and how much it is lit
       alpha  opacity
       twist  how often it turns edge-on along its length
       mesh   0..1 surface mesh and sampling points
       tone   colour
     ------------------------------------------------------------------------ */
  var PRESETS = {

    /* Homepage hero, desktop. One continuous field across the whole frame:
       five broad surfaces that each cross it edge to edge, two rising and two
       falling so they overlap through the middle. Intensity, detail and
       deformation build from the quiet left, where the copy sits, toward the
       lit upper right. Slopes are shallow so that every surface is still in
       frame at the left edge. */
    hero: {
      ribbons: [
        { y: 0.95, slope: 0.22, amp: 0.070, w: 0.55, k: 1.1, phase: 0.4, speed: 0.50, depth: 0.10, alpha: 0.62, twist: 0.25, mesh: 0.0, tone: '#173459' },
        { y: 1.05, slope: 0.50, amp: 0.085, w: 0.34, k: 1.4, phase: 1.9, speed: 0.75, depth: 0.35, alpha: 0.52, twist: 0.45, mesh: 0.45, tone: '#30528A' },
        { y: 0.40, slope: -0.25, amp: 0.080, w: 0.30, k: 1.7, phase: 3.2, speed: 0.90, depth: 0.55, alpha: 0.48, twist: 0.60, mesh: 1.0, tone: '#47688E' },
        { y: 0.70, slope: 0.36, amp: 0.065, w: 0.24, k: 2.1, phase: 4.7, speed: 1.05, depth: 0.75, alpha: 0.46, twist: 0.90, mesh: 1.0, tone: '#6888A0' },
        { y: 0.12, slope: -0.16, amp: 0.090, w: 0.40, k: 1.3, phase: 5.8, speed: 0.65, depth: 1.00, alpha: 0.48, twist: 0.35, mesh: 0.3, tone: '#284B82' }
      ]
    },

    /* Homepage hero, phones and narrow tablets. Fewer layers. On a phone the
       copy fills most of the hero, leaving only a band above the headline, so
       the surfaces gather there and fade out as they descend toward the type. */
    heroCompact: {
      quiet: [0, 1, 0.40, 0.96],
      quietFloor: 0.30,
      parallax: 0,
      dprCap: 1.25,
      fps: 30,
      density: 0.85,
      ribbons: [
        { y: 0.96, slope: 0.45, amp: 0.050, w: 0.26, k: 2.2, phase: 1.9, speed: 0.80, depth: 0.35, alpha: 0.55, twist: 0.7, mesh: 0.5, tone: '#2A4674' },
        { y: 1.10, slope: 1.10, amp: 0.045, w: 0.18, k: 2.8, phase: 3.2, speed: 0.95, depth: 0.55, alpha: 0.50, twist: 1.2, mesh: 1.0, tone: '#47668A' },
        { y: 0.45, slope: -0.35, amp: 0.050, w: 0.30, k: 1.8, phase: 5.8, speed: 0.70, depth: 1.00, alpha: 0.40, twist: 0.8, mesh: 0.3, tone: '#1C3A6A' }
      ]
    },

    /* Insights masthead. Quieter than the homepage and deliberately unlike it:
       three near-horizontal surfaces, slower, with more of the technical line
       work - closer to a report cover than a statement. */
    masthead: {
      quiet: [1, 0, 0.10, 0.86],
      quietFloor: 0.50,
      detail: 1.25,
      parallax: 6,
      speed: 0.8,
      ribbons: [
        { y: 0.80, slope: 0.08, amp: 0.050, w: 0.44, k: 1.1, phase: 0.8, speed: 0.50, depth: 0.20, alpha: 0.60, twist: 0.30, mesh: 0.6, tone: '#1B3A63' },
        { y: 0.46, slope: 0.15, amp: 0.060, w: 0.30, k: 1.5, phase: 2.6, speed: 0.70, depth: 0.60, alpha: 0.50, twist: 0.60, mesh: 1.0, tone: '#47688E' },
        { y: 0.12, slope: -0.08, amp: 0.050, w: 0.36, k: 1.3, phase: 4.4, speed: 0.60, depth: 1.00, alpha: 0.42, twist: 0.40, mesh: 0.5, tone: '#284B82' }
      ]
    },
    mastheadCompact: {
      quiet: [0, 1, 0.20, 0.95],
      quietFloor: 0.40,
      detail: 1.1,
      parallax: 0,
      speed: 0.8,
      dprCap: 1.25,
      fps: 30,
      ribbons: [
        { y: 0.90, slope: 0.20, amp: 0.040, w: 0.30, k: 1.8, phase: 0.8, speed: 0.50, depth: 0.20, alpha: 0.58, twist: 0.40, mesh: 0.6, tone: '#1B3A63' },
        { y: 0.62, slope: 0.35, amp: 0.045, w: 0.22, k: 2.2, phase: 2.6, speed: 0.70, depth: 0.60, alpha: 0.50, twist: 0.70, mesh: 1.0, tone: '#47688E' }
      ]
    },

    /* Not used yet. A thin horizontal band for section dividers or report
       covers: same language, quieter, no empty zone. */
    band: {
      quiet: [1, 0, -1, -0.5],
      parallax: 0,
      detail: 0.8,
      ribbons: [
        { y: 0.70, slope: 0.10, amp: 0.10, w: 0.40, k: 1.6, phase: 0.4, speed: 0.6, depth: 0.2, alpha: 0.5, twist: 0.8, mesh: 0.4, tone: '#0D2746' },
        { y: 0.40, slope: 0.18, amp: 0.12, w: 0.26, k: 2.2, phase: 3.2, speed: 0.9, depth: 0.6, alpha: 0.5, twist: 1.8, mesh: 1.0, tone: '#47668A' }
      ]
    }
  };

  /* Ground and highlight colours. The ground runs from the darkest navy at the
     left to a slightly lifted navy where the light falls, upper right; it is
     the same family as the stuck navigation bar (#061A2D). */
  var GROUND_DARK = '#020D1E';
  var GROUND_LIT  = '#061A30';
  var HIGHLIGHT   = '#C7D2DD';

  /* Below this viewport width the compact composition takes over. It must match
     the stylesheet's breakpoint for the stacked hero (styles.css, the
     max-width: 860px block), or the copy and the field disagree about where
     the empty space is. */
  var COMPACT_QUERY = '(max-width: 860px)';

  var MAX_RIBBONS = 6;

  /* ======================================================================== */

  var VERT =
    'attribute vec2 a_pos;\n' +
    'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }\n';

  /* RIBBONS is compiled in as a constant rather than passed as a uniform. The
     surface mesh and edges are drawn with fwidth(), and on Windows - where
     Chrome and Edge translate WebGL to Direct3D - screen-space derivatives
     inside a loop with a variable exit silently evaluate to zero, so every
     fine line disappears. A constant-bound loop unrolls and keeps them. */
  var FRAG = [
    '#extension GL_OES_standard_derivatives : enable',
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',

    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform vec2  u_mouse;',
    'uniform float u_parallax;',
    'uniform vec4  u_quiet;',
    'uniform float u_floor;',
    'uniform float u_bright;',
    'uniform float u_detail;',
    'uniform float u_density;',
    'uniform float u_amp;',
    'uniform float u_width;',
    'uniform vec4  u_rA[6];',   // y, slope, amp, w
    'uniform vec4  u_rB[6];',   // k, phase, speed, depth
    'uniform vec4  u_rC[6];',   // alpha, twist, twist phase, mesh
    'uniform vec3  u_rT[6];',   // tone
    'uniform vec4  u_rD[6];',   // per-frame constants, computed once on the CPU
    'uniform vec3  u_ground0;',
    'uniform vec3  u_ground1;',
    'uniform vec3  u_hi;',

    'vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }',
    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
    '  vec2 i  = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod(i, 289.0);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);',
    '  m = m * m; m = m * m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);',
    '  vec3 g;',
    '  g.x  = a0.x * x0.x + h.x * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',

    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',

    /* A one-pixel antialiased line at every integer of f. fw is fwidth(f),
       taken by the caller in uniform control flow. Lines fade out entirely
       once they would sit closer than a few pixels apart, so a surface turned
       edge-on never shimmers into moire. */
    'float gridLine(float f, float fw) {',
    '  float d = abs(fract(f - 0.5) - 0.5) / max(fw, 1e-5);',
    '  return (1.0 - smoothstep(0.0, 1.0, d)) * (1.0 - smoothstep(0.20, 0.42, fw));',
    '}',

    'void main() {',
    '  vec2 frag = gl_FragCoord.xy;',
    '  float H  = u_res.y;',
    '  float ar = u_res.x / H;',
    '  vec2 uv = frag / u_res;',
    '  vec2 P  = frag / H;',            // x: 0..ar, y: 0..1
    '  float t = u_time;',

    /* Intensity across the frame. The field runs edge to edge, but where the
       copy lives it is quieter: the broad surfaces drop to a floor rather than
       vanishing, and the fine line work fades harder still, so behind the type
       there is soft form and no crisp detail. The ramp is bowed and gently
       irregular, so it never reads as a seam. */
    '  float q = dot(uv, u_quiet.xy)',
    '          + 0.045 * sin(dot(uv, u_quiet.yx) * 4.2 + 1.3)',
    '          + 0.020 * sin(dot(uv, u_quiet.yx) * 9.7 + t * 0.020);',
    '  float ramp = smoothstep(u_quiet.z, u_quiet.w, q);',
    '  ramp *= ramp * (3.0 - 2.0 * ramp);',
    '  float mask = mix(u_floor, 1.0, ramp);',              // the surfaces
    '  float fine = mix(u_floor * 0.30, 1.0, ramp * ramp);', // the line work
    '  float calm = mix(0.45, 1.0, ramp);',                  // how far they bend

    /* One soft light, high on the right. Surfaces darken as they move away
       from it, which is most of what gives the field its depth. */
    '  vec2 L = vec2(ar * 0.94, 0.90);',
    '  float light = 1.0 - smoothstep(0.0, 1.9, length((P - L) * vec2(0.65, 1.0)));',

    '  vec3 col = mix(u_ground0, u_ground1, light * smoothstep(0.15, 0.95, uv.x));',

    /* Background topology: sparse contour lines of a slow height field. */
    '  float hgt = snoise(P * 0.80 + vec2(t * 0.0045, -t * 0.0030)) * 0.62',
    '            + 0.22 * sin(P.x * 1.6 + P.y * 2.2 + t * 0.011);',
    '  float hf = hgt * 5.5 * u_density;',
    '  float contour = gridLine(hf, fwidth(hf));',
    '  col = mix(col, u_hi * 0.5, contour * 0.030 * u_detail * fine * (0.25 + 0.75 * light));',

    '  for (int i = 0; i < RIBBONS; i++) {',
    '    vec4 A = u_rA[i];',
    '    vec4 B = u_rB[i];',
    '    vec4 C = u_rC[i];',
    '    vec4 D = u_rD[i];',            // time-only terms, see frameConstants()
    '    float fi = float(i);',
    '    float k  = B.x;',
    '    float ph = B.y;',
    '    float sp = B.z;',
    '    float depth = B.w;',

    /* Nearer surfaces answer the pointer a little more than far ones. */
    '    vec2 p = P - u_mouse * (u_parallax / H) * depth;',
    '    float xr = p.x - ar;',         // 0 at the right edge, negative leftward

    /* The path deforms mostly in place - two standing waves in quadrature, so
       the surface never flattens - with only a slow lateral drift on top. The
       standing waves' time terms are the same for every pixel, so they arrive
       precomputed in D rather than being evaluated millions of times a frame. */
    '    float dr = 0.020 * sp;',
    '    float disp = 0.55 * sin(k * xr + ph + t * dr) * D.x',
    '               + 0.55 * sin(1.37 * k * xr + ph * 2.1 + t * dr * 0.8) * D.y',
    '               + 0.22 * sin(2.30 * k * xr + ph * 0.4 - t * dr * 0.6);',
    /* Organic irregularity. It varies only along the surface and in time, so a
       product of slow, incommensurate sines does the job of a noise call at a
       fraction of the cost - this runs once per surface per pixel. */
    '    disp += 0.45 * (sin(xr * 0.91 + fi * 7.31 + t * 0.021 * sp) * sin(xr * 0.53 - t * 0.013 * sp + fi * 2.1)',
    '                  + 0.6 * sin(xr * 1.37 + t * 0.017 * sp + fi * 4.9));',
    '    float c = A.x + A.y * xr + A.z * u_amp * calm * disp;',

    /* Twist: where cos(theta) nears zero the surface is edge-on. */
    '    float th = C.y * xr + C.z',
    '             + 0.9 * sin(0.62 * k * xr + ph) * D.z',
    '             + t * 0.010 * sp;',
    '    float ct = cos(th);',
    '    float W  = A.w * u_width * (0.82 + 0.18 * sin(0.7 * k * xr + ph * 1.3 + t * 0.012 * sp));',
    '    float Wa = W * (0.30 + 0.70 * abs(ct));',
    '    float v  = (p.y - c) / Wa;',
    '    float av = abs(v);',

    /* Mesh coordinates, and every screen-space derivative, are taken here,
       before the branch below - derivatives are only defined in uniform
       control flow. */
    '    float fv = (v * 0.5 + 0.5) * 15.0 * u_density;',
    '    float fu = ((xr + 0.5) * D.w + t * 0.006 * sp + v * Wa * 0.55) * 21.0 * u_density;',
    '    float fwv  = fwidth(v);',
    '    float fwfv = fwidth(fv);',
    '    float fwfu = fwidth(fu);',

    /* Everything past this point only matters on or near the surface, and
       most pixels are nowhere near most surfaces. */
    '    if (av < 1.02) {',

    /* Shade it as a sheet, not a tube: a sheet tilted toward the light grades
       from one lit edge to one dark edge, and which edge is lit flips as the
       surface turns over. Centre-bright shading would read as a cylinder. */
    '      float side   = clamp(v * ct / max(abs(ct), 0.18), -1.0, 1.0);',
    '      float facing = 0.5 + 0.5 * ct;',
    '      float bow    = max(1.0 - v * v, 0.0);',
    '      float sheen  = 0.92 + 0.08 * sin(xr * k * 1.9 + ph + t * 0.010 * sp);',
    '      float shade  = (0.30 + 0.55 * (0.5 + 0.5 * side) * (0.55 + 0.45 * facing) + 0.15 * bow) * sheen;',
    /* A generous ambient term keeps the surfaces legible as form well away
       from the light, so the field reads edge to edge. */
    '      float lit    = mask * (0.50 + 0.50 * light) * (0.80 + 0.20 * depth);',
    '      float fineLit = fine * (0.35 + 0.65 * light) * (0.80 + 0.20 * depth);',
    '      float edge   = 1.0 - smoothstep(0.78, 1.0, av);',

    /* The body of the surface, laid over what is behind it. */
    '      vec3 tone = u_rT[i] * shade * u_bright * (0.72 + 0.42 * light);',
    '      col = mix(col, tone, C.x * edge * lit);',

    /* Where it turns edge-on, a narrow, quiet lift on its lit side - light
       falloff, not glow. */
    '      float fold = 1.0 - smoothstep(0.0, 0.26, abs(ct));',
    '      col += u_hi * fold * bow * (0.5 + 0.5 * side) * 0.045 * fineLit * u_bright;',

    /* Its boundary, as a hairline. */
    '      float bd  = abs(av - 0.965) / max(fwv, 1e-5);',
    '      float bln = (1.0 - smoothstep(0.0, 1.0, bd)) * (1.0 - smoothstep(0.05, 0.25, fwv));',
    '      col = mix(col, u_hi * 0.8, bln * 0.085 * fineLit * u_detail);',

    /* Surface mesh: lines that run with the surface, cross-lines that move
       with its drift and breathe very slightly, and sparse sampling points at
       a few of their intersections. */
    '      float lv = gridLine(fv, fwfv);',
    '      float lu = gridLine(fu, fwfu);',
    '      float meshAmt = C.w * u_detail * edge * fineLit * (0.45 + 0.55 * facing) * step(av, 0.95);',
    '      col = mix(col, u_hi * 0.72, max(lv, lu * 0.55) * 0.050 * meshAmt);',

    '      vec2 node = vec2(floor(fu + 0.5), floor(fv + 0.5));',
    '      vec2 off  = vec2((fract(fu + 0.5) - 0.5) / max(fwfu, 1e-5),',
    '                       (fract(fv + 0.5) - 0.5) / max(fwfv, 1e-5));',
    '      float pt  = (1.0 - smoothstep(0.7, 1.7, length(off)))',
    '                * step(0.955, hash(node + fi * 13.17))',
    '                * (1.0 - smoothstep(0.10, 0.30, max(fwfu, fwfv)));',
    '      col = mix(col, u_hi, pt * 0.20 * meshAmt);',
    '    }',
    '  }',

    /* Calm the strip under the navigation and the edge where the page begins. */
    '  float topCalm = smoothstep(0.84, 1.0, uv.y);',
    '  float botCalm = 1.0 - smoothstep(0.0, 0.16, uv.y);',
    '  col = mix(col, u_ground0, topCalm * 0.40 + botCalm * 0.50);',

    /* Dither by a fraction of one 8-bit step: dark navy gradients band
       visibly on most displays without it. */
    '  col += (hash(frag + fract(t * 0.37)) - 0.5) / 255.0;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ======================================================================== */

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255];
  }

  function resolve(name) {
    var preset = PRESETS[name] || PRESETS.hero;
    var out = {};
    for (var key in SETTINGS) out[key] = SETTINGS[key];
    for (var p in preset) out[p] = preset[p];
    return out;
  }

  var reduceMotion = window.matchMedia &&
                     window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer  = window.matchMedia &&
                     window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function mount(canvas, presetName, overrides) {
    if (!canvas || canvas.__swpWaves) return null;
    var host = canvas.parentNode;
    var baseName = presetName || canvas.getAttribute('data-swp-waves') || 'hero';
    var compactName = baseName + 'Compact';

    var gl;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false,
        powerPreference: 'low-power'
      });
    } catch (e) { gl = null; }
    if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (window.console) console.warn('[waves] shader:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    var prog, loc = {}, cfg, raf = null, last = 0, start = null, elapsed = 0;
    var visible = !document.hidden, onScreen = true, dead = false;
    var mouse = [0, 0], target = [0, 0];

    var builtCount = 0;
    function build(count) {
      /* The #extension line must stay first, so the constant goes after it. */
      var src = FRAG.replace('\n', '\n#define RIBBONS ' + count + '\n');
      var vs = compile(gl.VERTEX_SHADER, VERT);
      var fs = compile(gl.FRAGMENT_SHADER, src);
      if (!vs || !fs) return false;
      if (prog) gl.deleteProgram(prog);
      prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var aPos = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      ['u_res', 'u_time', 'u_mouse', 'u_parallax', 'u_quiet', 'u_floor', 'u_bright', 'u_detail',
       'u_density', 'u_amp', 'u_width', 'u_ground0', 'u_ground1', 'u_hi'
      ].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
      ['u_rA', 'u_rB', 'u_rC', 'u_rT', 'u_rD'].forEach(function (n) {
        loc[n] = gl.getUniformLocation(prog, n + '[0]');
      });

      gl.uniform3fv(loc.u_ground0, hexToRgb(GROUND_DARK));
      gl.uniform3fv(loc.u_ground1, hexToRgb(GROUND_LIT));
      gl.uniform3fv(loc.u_hi, hexToRgb(HIGHLIGHT));
      builtCount = count;
      return true;
    }

    /* Composition uniforms change only when the preset does - on load and when
       the viewport crosses the compact breakpoint - never per frame. A change
       in the number of surfaces recompiles the shader, which takes a few ms. */
    var activeName = null;
    var compactMQ = window.matchMedia ? window.matchMedia(COMPACT_QUERY) : { matches: false };
    function applyPreset() {
      var name = (compactMQ.matches && PRESETS[compactName]) ? compactName : baseName;
      if (name === activeName) return true;
      cfg = resolve(name);
      if (overrides) for (var o in overrides) cfg[o] = overrides[o];

      var rs = cfg.ribbons.slice(0, MAX_RIBBONS);
      if (rs.length !== builtCount && !build(rs.length)) return false;
      activeName = name;
      var A = new Float32Array(MAX_RIBBONS * 4), B = new Float32Array(MAX_RIBBONS * 4),
          C = new Float32Array(MAX_RIBBONS * 4), T = new Float32Array(MAX_RIBBONS * 3);
      rs.forEach(function (r, i) {
        A.set([r.y, r.slope, r.amp, r.w], i * 4);
        B.set([r.k, r.phase, r.speed, r.depth], i * 4);
        C.set([r.alpha, r.twist, r.phase * 1.7, r.mesh], i * 4);
        T.set(hexToRgb(r.tone), i * 3);
      });
      gl.uniform4fv(loc.u_rA, A);
      gl.uniform4fv(loc.u_rB, B);
      gl.uniform4fv(loc.u_rC, C);
      gl.uniform3fv(loc.u_rT, T);
      gl.uniform4fv(loc.u_quiet, cfg.quiet);
      gl.uniform1f(loc.u_floor, cfg.quietFloor);
      gl.uniform1f(loc.u_bright, cfg.brightness);
      gl.uniform1f(loc.u_detail, cfg.detail);
      gl.uniform1f(loc.u_density, cfg.density);
      gl.uniform1f(loc.u_amp, cfg.amplitude);
      gl.uniform1f(loc.u_width, cfg.width);
      return true;
    }

    /* Quality governor. If the GPU cannot hold the frame rate, the field steps
       itself down - first to 1x density, then to 30 fps - rather than dropping
       frames. The motion is slow enough that neither step is easy to see. */
    var quality = 0, slowFrames = 0, sampled = 0;
    function govern(interval) {
      if (quality >= 2) return;
      sampled++;
      if (interval > (1000 / effectiveFps()) * 1.45) slowFrames++;
      if (sampled < 90) return;
      if (slowFrames > 45) { quality++; resize(); }
      sampled = 0; slowFrames = 0;
    }
    function effectiveFps() { return quality >= 2 ? Math.min(cfg.fps, 30) : cfg.fps; }

    var dpr = 1;
    function resize() {
      if (!applyPreset()) return false;
      dpr = Math.min(window.devicePixelRatio || 1, quality >= 1 ? 1 : cfg.dprCap);
      var w = Math.max(1, Math.round(host.clientWidth * dpr));
      var h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(loc.u_res, w, h);
      gl.uniform1f(loc.u_parallax, (finePointer && !reduceMotion ? cfg.parallax : 0) * dpr);
      return true;
    }

    /* Terms that depend only on time and on the surface, never on the pixel.
       Evaluating them here once per frame - a few dozen trig calls - spares the
       GPU several million of the same calls. Must mirror the shader: w1 is the
       standing-wave rate, D.w the mesh's slow breathing. */
    var Dbuf = new Float32Array(MAX_RIBBONS * 4);
    function frameConstants(t) {
      var rs = cfg.ribbons;
      for (var i = 0; i < rs.length && i < MAX_RIBBONS; i++) {
        var sp = rs[i].speed, ph = rs[i].phase, w1 = 0.18 * sp;
        Dbuf[i * 4]     = Math.cos(t * w1 + ph);
        Dbuf[i * 4 + 1] = Math.sin(t * w1 * 0.83 + ph * 0.7);
        Dbuf[i * 4 + 2] = Math.cos(t * w1 * 0.5 + ph * 1.3);
        Dbuf[i * 4 + 3] = 1 + 0.03 * Math.sin(t * 0.07 * sp + ph);
      }
      gl.uniform4fv(loc.u_rD, Dbuf);
    }

    function draw() {
      gl.uniform1f(loc.u_time, elapsed);
      frameConstants(elapsed);
      gl.uniform2f(loc.u_mouse, mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(ts) {
      raf = window.requestAnimationFrame(frame);
      var minGap = 1000 / effectiveFps() - 2;
      if (last && ts - last < minGap) return;
      if (last) govern(ts - last);
      var dt = last ? Math.min(ts - last, 100) : 0;   // never jump after a stall
      last = ts;
      elapsed += dt * 0.001 * cfg.speed;
      /* Ease toward the pointer slowly; the field settles rather than follows. */
      mouse[0] += (target[0] - mouse[0]) * 0.035;
      mouse[1] += (target[1] - mouse[1]) * 0.035;
      draw();
    }

    function play() {
      if (raf !== null || dead || reduceMotion || !visible || !onScreen) return;
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
    function pause() {
      if (raf === null) return;
      window.cancelAnimationFrame(raf);
      raf = null;
    }

    function start_() {
      if (!resize()) return false;
      /* Reduced motion: the same composition, held on one well-composed frame. */
      elapsed = reduceMotion ? 18.0 : 6.0;
      draw();
      canvas.classList.add('is-live');
      if (host.classList) host.classList.add('has-waves');
      play();
      return true;
    }

    if (!start_()) return null;

    if (window.ResizeObserver) {
      new ResizeObserver(function () { resize(); if (raf === null) draw(); }).observe(host);
    } else {
      window.addEventListener('resize', function () { resize(); if (raf === null) draw(); });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (onScreen) play(); else pause();
      }, { threshold: 0 }).observe(host);
    }

    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible) play(); else pause();
    });

    if (finePointer && !reduceMotion) {
      window.addEventListener('pointermove', function (e) {
        if (!onScreen) return;
        var r = host.getBoundingClientRect();
        target[0] = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        target[1] = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
      }, { passive: true });
    }

    /* A lost GPU context (driver reset, too many tabs) leaves the static
       fallback showing; a restored one picks up where it left off. */
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); pause(); dead = true;
      canvas.classList.remove('is-live');      // let the CSS still show through
    });
    canvas.addEventListener('webglcontextrestored', function () {
      dead = false; activeName = null; builtCount = 0; prog = null;
      if (resize()) { draw(); canvas.classList.add('is-live'); play(); }
    });

    canvas.__swpWaves = true;
    return { pause: pause, play: play };
  }

  window.SwpWaves = { mount: mount, presets: PRESETS, settings: SETTINGS };

  function autoMount() {
    var list = document.querySelectorAll('canvas[data-swp-waves]');
    Array.prototype.forEach.call(list, function (c) { mount(c); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
