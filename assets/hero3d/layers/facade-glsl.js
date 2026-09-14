// Shared facade shading for every lit building surface (box masses and curved
// masses). One procedural facade system with per-use treatments:
//   1 ribbon windows · 2 residential glazing recessed behind balconies · 3 water
//   4 residential podium (liner units on street/plaza faces, screened parking with
//     expressed ramps elsewhere) · 5 office floors · 6 office podium (office liner
//     south/west, screened parking north/east) · 7 Art Deco hotel rooms
//   8 mechanical screens · 9 storefront · 10 glass guard · 11 penthouse glazing
//   12 Art Deco hotel centrepiece (reeded piers around a central glazed slot)
//   13 residential garage recess behind the wave screen · 14 perforated metal · 15 breeze block
//   19 office crown glazing
//   16–18 paving patterns on horizontal surfaces (square, running bond, concentric)
// Everything resolves to three channels — glass coverage, white louvre screen
// coverage and shade — then shares one material response (glass/water sheen,
// IBL balance). Patterns fade to an average tone when floors get small on
// screen (no shimmer).
import * as THREE from 'three';

export const GLASS_COLOR = '#56697a'; // clear, subtly blue-grey glazing; reflections come from the environment

// Shared clock for water movement. It is advanced only when a frame is already being
// rendered (scroll, drag, parallax), so render-on-demand pauses are preserved.
export const WATER_TIME = { value: 0 };

export const DITHER_GLSL = /* glsl */`
  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
`;

const FACADE_GLSL = /* glsl */`
  // anti-aliased band [a, b] and repeating thin line, widths in world metres
  float band(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }
  float repLine(float x, float spacing, float halfW, float w) {
    float d = abs(fract(x / spacing + 0.5) - 0.5) * spacing;
    return 1.0 - smoothstep(halfW - w, halfW + w, d);
  }

  // punched ribbon glazing within a floor band, with 3 m mullions
  float ribbon(float fy, float fH, float across, float aaY, float aaX, float detail, float coverage) {
    float crisp = band(fy, 0.9, fH - 0.3, aaY) * (1.0 - 0.8 * repLine(across, 3.0, 0.08, aaX));
    return mix(coverage, crisp, detail);
  }

  // screened parking: white louvres between structural piers and deck edges,
  // with switchback ramp slabs expressed on north elevations (ramp = x0, x1, y0, rise)
  vec2 parkingScreen(float y, float fy, float fH, float across, float wx, float aaY, float aaX, float detail, vec4 ramp, float north) {
    float pier = repLine(across, 8.4, 0.45, aaX);
    float field = (1.0 - pier) * band(fy, 0.55, fH - 0.05, aaY);
    if (north > 0.5 && ramp.y > ramp.x) {
      float t = clamp((wx - ramp.x) / (ramp.y - ramp.x), 0.0, 1.0);
      float run = step(ramp.x, wx) * step(wx, ramp.y);
      float up = ramp.z + t * ramp.w;
      float back = ramp.z + ramp.w + (1.0 - t) * ramp.w;
      float slab = max(1.0 - smoothstep(0.2, 0.2 + aaY * 2.0, abs(y - up)), 1.0 - smoothstep(0.2, 0.2 + aaY * 2.0, abs(y - back)));
      field *= 1.0 - slab * run;
    }
    float blades = mix(0.55, repLine(across, 0.6, 0.15, aaX), detail);
    // the gaps between louvres read as shadowed openings into the deck
    return vec2(field * blades, 1.0 - 0.62 * field * (1.0 - blades));
  }

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // Paving drawn in the surface shader instead of as thin joint geometry (which would sit
  // millimetres above the slab and z-fight / shimmer). Returns a shade multiplier.
  //   16 square pavers (module.x by module.y) · 17 running bond, long side along x
  //   18 concentric rings with radial joints around ramp.xy (ring width module.x)
  float paving(float glaze, vec3 wp, vec2 module, vec4 ramp) {
    vec2 q = wp.xz;
    vec2 aa = max(fwidth(q), vec2(1e-4));
    float px = max(aa.x, aa.y);
    float detail = 1.0 - smoothstep(0.06, 0.28, px / min(module.x, module.y));
    float jw = 0.012 + px * 0.25;
    vec2 cell, d;
    if (glaze < 16.5) {
      cell = q / module;
      d = abs(fract(cell + 0.5) - 0.5) * module;
    } else if (glaze < 17.5 || glaze > 19.5) {
      float row = floor(q.y / module.y);
      float x = q.x / module.x + 0.5 * mod(row, 2.0);
      cell = vec2(floor(x), row);
      d = vec2(abs(fract(x + 0.5) - 0.5) * module.x, abs(fract(q.y / module.y + 0.5) - 0.5) * module.y);
    } else {
      vec2 r = q - ramp.xy;
      float rad = length(r);
      float ring = floor(rad / module.x);
      float arc = atan(r.y, r.x) * max(ring + 0.5, 1.0) * module.x;
      cell = vec2(ring, floor(arc / module.y));
      d = vec2(abs(fract(rad / module.x + 0.5) - 0.5) * module.x, abs(fract(arc / module.y + 0.5) - 0.5) * module.y);
    }
    float joint = max(1.0 - smoothstep(jw, jw + px * 1.5, d.x), 1.0 - smoothstep(jw, jw + px * 1.5, d.y));
    float tone = hash21(cell);
    // 20: promenade — the running bond with a darker transverse band every 7.2 m
    float bandK = glaze > 19.5 ? 1.0 - smoothstep(0.24, 0.24 + px * 1.5, abs(fract(q.x / 7.2 + 0.5) - 0.5) * 7.2) : 0.0;
    return mix(0.985 - 0.1 * bandK, (1.0 - 0.15 * joint) * (0.955 + 0.07 * tone) * (1.0 - 0.13 * bandK), detail);
  }

  // returns (glass, screen, shade)
  vec3 facade(float glaze, vec3 wp, float across, vec3 nrm, float botY, float topY, vec2 module, vec4 ramp) {
    if ((glaze > 15.5 && glaze < 18.5) || (glaze > 19.5 && glaze < 20.5)) return vec3(0.0, 0.0, nrm.y > 0.5 ? paving(glaze, wp, module, ramp) : 1.0);
    if (glaze < 0.5 || abs(nrm.y) > 0.5 || (glaze > 2.5 && glaze < 3.5)) return vec3(0.0, 0.0, 1.0);
    float y = wp.y;
    float gH = module.x;
    float fH = module.y;
    float aaY = max(fwidth(y), 1e-4) * 0.75;
    float aaX = max(fwidth(across), 1e-4) * 0.75;

    if (glaze > 9.5 && glaze < 10.5) {
      // glass guard: optional solid upstand (module.x), light glass, slim white top rail
      float g = band(y, botY + gH, topY - 0.07, aaY);
      return vec3(0.3 * g, 0.0, 1.0);
    }

    float detail = 1.0 - smoothstep(0.16, 0.38, aaY / fH);
    float inside = band(y, botY + 0.25, topY - 0.45, aaY);
    float fy = mod(y - gH, fH);
    float ground = 1.0 - step(gH, y);
    float north = step(nrm.z, -0.5);
    float mullion3 = repLine(across, 3.0, 0.08, aaX);
    float storefront = band(y, 0.3, gH - 0.55, aaY) * (1.0 - 0.8 * mullion3);
    float glass = 0.0;
    float screen = 0.0;
    float shade = 1.0;

    if (glaze < 1.5) {
      glass = mix(ribbon(fy, fH, across, aaY, aaX, detail, 0.5), storefront, ground);
    } else if (glaze < 2.5) {
      // residential: floor-to-ceiling glass set back behind the balcony slab edge
      float vision = band(fy, 0.32, fH - 0.22, aaY) * (1.0 - 0.75 * repLine(across, 1.6, 0.06, aaX));
      glass = mix(0.82, vision, detail);
      shade = 1.0 - 0.3 * band(fy, fH - 0.95, fH - 0.22, aaY) * detail;
    } else if (glaze < 4.5) {
      if (nrm.z > 0.35 || nrm.x > 0.55) {
        glass = ribbon(fy, fH, across, aaY, aaX, detail, 0.5);      // occupied liner on street + plaza faces
      } else {
        vec2 p = parkingScreen(y, fy, fH, across, wp.x, aaY, aaX, detail, ramp, north);
        screen = p.x; shade = p.y;
      }
    } else if (glaze < 5.5) {
      // office: large recessed glazing bays, slim spandrel at each slab
      float crisp = band(fy, 0.6, fH - 0.15, aaY) * (1.0 - 0.8 * mullion3);
      glass = mix(0.78, crisp, detail);
    } else if (glaze < 6.5) {
      float liner = max(step(0.5, nrm.z), step(nrm.x, -0.5));
      if (ground > 0.5) {
        glass = storefront * liner;
      } else if (liner > 0.5) {
        glass = mix(0.72, band(fy, 0.75, fH - 0.2, aaY) * (1.0 - 0.8 * mullion3), detail);
      } else {
        vec2 p = parkingScreen(y, fy, fH, across, wp.x, aaY, aaX, detail, vec4(0.0), 0.0);
        screen = p.x; shade = p.y;
      }
    } else if (glaze < 7.5) {
      if (ground > 0.5) {
        // storefronts between pale stone piers; solid service frontage on the north
        float pier = repLine(across, 7.2, 0.45, aaX);
        glass = band(y, 0.35, gH - 1.0, aaY) * (1.0 - pier) * (1.0 - north) * (1.0 - 0.7 * repLine(across, 1.8, 0.05, aaX));
        shade = 1.0 - 0.08 * pier;
      } else {
        // guest rooms: tall paired windows (sill at 0.45 m, head at 2.6 m) on a 3.6 m bay,
        // each set in a shadowed reveal, a fluted pier every sixth bay, eyebrows above
        float bayIdx = floor((across + 720.0) / 3.6);
        float bay = mod(across + 720.0, 3.6);
        float pier = step(mod(bayIdx, 6.0), 0.5);
        float win = band(bay, 0.55, 3.05, aaX) * band(fy, 0.45, 2.6, aaY);
        float reveal = band(bay, 0.42, 3.18, aaX) * band(fy, 0.36, 2.66, aaY) - win;
        win *= 1.0 - 0.85 * (1.0 - smoothstep(0.04, 0.04 + aaX, abs(bay - 1.8)));   // central mullion
        win *= 1.0 - 0.6 * (1.0 - smoothstep(0.03, 0.03 + aaY, abs(fy - 2.2)));      // transom
        float flutes = pier * band(bay, 0.5, 3.1, aaX) * repLine(bay, 0.65, 0.09, aaX);
        glass = mix(0.42, win * (1.0 - pier), detail);
        // reveal and eyebrow shadows give the white stucco controlled relief
        shade = (1.0 - 0.28 * band(fy, 2.62, 2.72, aaY) * detail) * (1.0 - 0.2 * flutes * detail) * (1.0 - 0.22 * max(reveal, 0.0) * (1.0 - pier) * detail);
      }
    } else if (glaze < 8.5) {
      // screens and crowns: fine vertical louvres with a solid coping
      float blades = mix(0.5, repLine(across, 0.5, 0.12, aaX), detail);
      float field = band(y, botY + 0.3, topY - 0.45, aaY);
      shade = 1.0 - 0.3 * field * (1.0 - blades);
    } else if (glaze < 9.5) {
      // storefront: full-height glazing with a transom on tall frontages; solid on the service (north) side
      float tall = band(y, botY + 0.3, topY - 0.5, aaY);
      float transom = band(y, botY + 3.55, botY + 3.8, aaY) * step(6.0, topY - botY);
      glass = tall * (1.0 - 0.8 * mullion3) * (1.0 - 0.8 * transom) * (1.0 - north);
    } else if (glaze > 13.5 && glaze < 14.5) {
      // perforated metal panel: a hole grid whose diameter swells in a slow abstract relief
      // (bands of density), reading at distance as a soft tonal gradient
      vec2 cell = vec2(across, y) / 0.16;
      vec2 f = abs(fract(cell) - 0.5) * 0.16;
      float rel = 0.5 + 0.5 * sin(across * 0.42 + y * 0.9) * cos(across * 0.11 - y * 0.35);
      float r = 0.018 + 0.05 * rel;
      float hole = 1.0 - smoothstep(r - aaX, r + aaX, length(f));
      float coverage = 3.1416 * r * r / (0.16 * 0.16);
      shade = 1.0 - 0.62 * mix(coverage, hole, detail);
      return vec3(0.0, 0.0, shade);
    } else if (glaze > 14.5 && glaze < 15.5) {
      // breeze block: 0.4 m blocks, each pierced by a rotated-square opening inside a round rim
      vec2 cell = vec2(across, y) / 0.4;
      vec2 q = abs(fract(cell) - 0.5) * 0.4;
      float open = 1.0 - smoothstep(0.1 - aaX, 0.1 + aaX, q.x + q.y);
      float rim = 1.0 - smoothstep(0.02 - aaX, 0.02 + aaX, abs(length(q) - 0.13));
      shade = 1.0 - mix(0.3, 0.62 * open + 0.15 * rim, detail);
      return vec3(0.0, 0.0, shade);
    } else if (glaze > 18.5 && glaze < 19.5) {
      // office crown: floor-to-ceiling glass bays between slim mullions, spandrel at each slab
      float vision = band(fy, 0.35, fH - 0.1, aaY) * (1.0 - 0.7 * repLine(across, 1.8, 0.05, aaX));
      glass = mix(0.85, vision, detail);
    } else if (glaze > 12.5 && glaze < 13.5) {
      // residential garage behind the wave screen: occupied liner glazing on the street and
      // plaza faces; elsewhere the decks read as deep shadowed openings between white slab edges
      if (nrm.z > 0.35 || nrm.x > 0.55) {
        glass = ribbon(fy, fH, across, aaY, aaX, detail, 0.5);
      } else {
        float slabEdge = max(band(fy, 0.0, 0.32, aaY), band(fy, fH - 0.05, fH, aaY));
        float pier = repLine(across, 8.4, 0.3, aaX);
        shade = mix(0.34, 1.0, max(slabEdge, 0.55 * pier));
      }
    } else if (glaze < 11.5) {
      // penthouse: tall frameless glazing between a slim sill and a deep white fascia
      float wall = band(y, botY + 0.3, topY - 0.7, aaY);
      glass = wall * mix(0.86, 1.0 - 0.7 * repLine(across, 1.8, 0.04, aaX), detail);
      return vec3(glass, 0.0, 1.0);
    } else {
      // Art Deco centrepiece: a central glazed slot (ramp.xy = centre, ramp.z = half width)
      // framed by reeded piers with small paired windows
      float coord = abs(nrm.z) > 0.5 ? wp.x - ramp.x : wp.z - ramp.y;
      float slotW = abs(nrm.z) > 0.5 ? ramp.z : ramp.z * 0.6;
      if (ground > 0.5) {
        glass = band(y, 0.3, gH - 0.4, aaY) * band(coord, -slotW - 1.2, slotW + 1.2, aaX) * (1.0 - north) * (1.0 - 0.7 * repLine(coord, 1.5, 0.05, aaX));
      } else {
        float slot = band(coord, -slotW, slotW, aaX);
        float lights = band(fy, 0.4, fH - 0.18, aaY) * (1.0 - 0.75 * repLine(coord, 1.2, 0.05, aaX));
        float sideWin = band(abs(coord), slotW + 1.6, slotW + 3.2, aaX) * band(fy, 0.9, 2.45, aaY);
        glass = slot * mix(0.8, lights, detail) + (1.0 - slot) * mix(0.18, sideWin, detail);
        float reeds = (1.0 - slot) * (1.0 - sideWin) * repLine(coord, 0.7, 0.1, aaX);
        shade = 1.0 - 0.24 * reeds * detail;
      }
    }
    return vec3(glass * inside, screen * inside, mix(1.0, shade, inside));
  }
`;

// Patch a MeshStandardMaterial shader. Expression options are GLSL strings
// evaluated in the fragment shader: fill (0..1), glaze, base (vec3), worldPos
// (vec3), across, nrm (vec3), botY, topY, module (vec2), ramp (vec4).
// `screen` is the louvre colour (hex).
export function injectFacade(shader, o) {
  shader.uniforms.uGlassColor = { value: new THREE.Color(GLASS_COLOR) };
  shader.uniforms.uScreen = { value: new THREE.Color(o.screen || '#dcdedd') };
  shader.uniforms.uTime = WATER_TIME;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${o.vertexDecl}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${o.vertexBody}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform vec3 uGlassColor;
      uniform vec3 uScreen;
      uniform float uTime;
      ${o.fragmentDecl}
      ${DITHER_GLSL}
      ${FACADE_GLSL}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      if (bayer4(gl_FragCoord.xy) + 0.03125 > ${o.fill}) discard;
      vec3 fac = facade(${o.glaze}, ${o.worldPos}, ${o.across}, ${o.nrm}, ${o.botY}, ${o.topY}, ${o.module}, ${o.ramp});
      float glass = fac.x;
      float water = step(2.5, ${o.glaze}) * (1.0 - step(3.5, ${o.glaze}));
      float sheen = max(glass, water);
      // a faint sky gradient inside the glass reads as depth without transparency
      vec3 glassTone = mix(uGlassColor, uGlassColor * 1.3, smoothstep(${o.botY}, ${o.topY}, (${o.worldPos}).y));
      vec3 surface = mix(${o.base}, uScreen, fac.y);
      diffuseColor.rgb = mix(surface, glassTone, glass) * fac.z;
      // water surfaces: soft ripples (concentric around a fountain or spa when ramp.w = 1)
      if (water > 0.5 && (${o.nrm}).y > 0.5) {
        vec2 wq = (${o.worldPos}).xz;
        vec4 wr = ${o.ramp};
        float rip = wr.w > 0.5
          ? sin(length(wq - wr.xy) * 3.4 - uTime * 1.8) * exp(-length(wq - wr.xy) * 0.15)
          : sin(wq.x * 0.9 + uTime * 0.5) * sin(wq.y * 0.7 - uTime * 0.4);
        diffuseColor.rgb *= 1.0 + 0.07 * rip;
      }
      // gentle grounding on walls, like a model sitting on a base board
      if (abs((${o.nrm}).y) < 0.5) diffuseColor.rgb *= mix(0.86, 1.0, smoothstep(0.0, 8.0, (${o.worldPos}).y));`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.06, sheen);`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      // partial metalness turns the glazing into a tinted mirror of the sky
      metalnessFactor = mix(metalnessFactor, 0.72, glass);
      metalnessFactor = mix(metalnessFactor, 0.3, water);`)
    .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      // matte surfaces take only a little image-based light (the scene lights
      // carry them); glazing and water take the full reflection
      iblIrradiance *= mix(0.3, 1.0, sheen);
      radiance *= mix(0.25, 1.25, sheen);`);
}
