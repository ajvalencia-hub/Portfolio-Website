// Coordinated site fixture family: restrained charcoal finishes, warm-white LED heads.
//   roadLight  — 9 m roadway pole with a slim arm and flat luminaire over the carriageway
//   pedLight   — 4.2 m pedestrian lantern for sidewalks, walks and the park edges
//   bollard    — 0.9 m path bollard light (park paths, pedestrian-only ends)
//   bikeHoops  — inverted-U bicycle stands
//   litterBin  — slim charcoal receptacle beside seating
//   vehicleEntrance — detailed garage / car-lift portal: white frame standing proud of the
//                facade, warm soffit light, blank signage plaque, striped clearance gantry,
//                entry / exit island with card readers and barrier arms, wheel guards,
//                bollards, pedestrian warning beacons and a trench drain across the apron
// Heads are separate 'lamp' pieces set a few centimetres off the housings so no two
// surfaces share a plane. Instanced parts; shared geometry per shape.
export const FIXTURE = {
  road: { h: 9.0, arm: 2.0, reach: 0.4 },     // reach: clearance radius used against canopies
  ped: { h: 4.2, reach: 0.35 },
  bollard: { h: 0.9 },
};

export function fixtureKit(K) {
  const C = 'context';
  const { add, column, oriented } = K;
  const bollard = (x, z, baseY) => {
    column(x, z, baseY, 0.72, 0.09, 'charcoal', C);
    add('cyl', x, baseY + 0.79, z, 0.2, 0.12, 0.2, 'lamp', C);
    add('cyl', x, baseY + 0.88, z, 0.22, 0.05, 0.22, 'charcoal', C);
  };
  return {
    // a: plan angle the arm points to (toward the street)
    roadLight(x, z, baseY, a) {
      const F = FIXTURE.road;
      const c = Math.cos(a), s = Math.sin(a);
      column(x, z, baseY, F.h, 0.1, 'charcoal', C);
      oriented(x + c * F.arm * 0.5, z + s * F.arm * 0.5, baseY + F.h - 0.14, 0.1, F.arm, 0.1, a, 'charcoal');
      const hx = x + c * F.arm, hz = z + s * F.arm;
      oriented(hx, hz, baseY + F.h - 0.2, 0.14, 0.95, 0.34, a, 'charcoal');
      oriented(hx, hz, baseY + F.h - 0.24, 0.03, 0.8, 0.24, a, 'lamp');
    },
    pedLight(x, z, baseY) {
      const F = FIXTURE.ped;
      column(x, z, baseY, F.h - 0.62, 0.065, 'charcoal', C);
      add('cyl', x, baseY + F.h - 0.34, z, 0.26, 0.52, 0.26, 'lamp', C);
      add('cyl', x, baseY + F.h - 0.05, z, 0.36, 0.06, 0.36, 'charcoal', C);
    },
    bollard,
    // stands spaced 0.9 m along plan angle a
    bikeHoops(x, z, baseY, count, a) {
      const c = Math.cos(a), s = Math.sin(a);
      for (let k = 0; k < count; k++) {
        const u = (k - (count - 1) / 2) * 0.9;
        const px = x + c * u, pz = z + s * u;
        for (const v of [-0.34, 0.34]) column(px - s * v, pz + c * v, baseY, 0.78, 0.03, 'metal', C);
        oriented(px, pz, baseY + 0.78, 0.06, 0.06, 0.74, a, 'metal');
      }
    },
    litterBin(x, z, baseY) { column(x, z, baseY, 0.9, 0.27, 'charcoal', C); },
    // Vehicle entrance on a facade. (x, z): centre of the opening on the facade line;
    // (nx, nz): outward normal; W × H: clear opening (the dark opening itself is modelled by
    // the building); maxHead: underside of anything above (arcade soffit, panels).
    // Local frame: a along the facade, d outward from it. Every piece is offset so no two
    // surfaces share a plane (heads 0.06 m deeper than jambs, strips 20 mm above paving).
    vehicleEntrance({ x, z, nx, nz, W, H, maxHead = H + 0.7, lanes = 2, lifts = false, gates = true, apron = 4.2, y = 0.03 }) {
      const ux = -nz, uz = nx, ang = Math.atan2(uz, ux);
      const P = (a, d) => [x + ux * a + nx * d, z + uz * a + nz * d];
      const bx = (a, d, y0, h, la, ld, color, phase = 'solid') => oriented(...P(a, d), y0, h, la, ld, ang, color, phase);
      const head = Math.min(H + 0.6, maxHead - 0.02);
      // portal frame
      for (const s of [-1, 1]) bx(s * (W / 2 + 0.2), 0.3, 0, head - 0.02, 0.5, 0.6, 'frame');
      bx(0, 0.33, H, head - H, W + 0.8, 0.66, 'frame');
      if (lifts) bx(0, 0.3, 0, head - 0.02, 0.8, 0.6, 'frame');                  // pier between the two lift bays
      bx(0, 0.36, H - 0.05, 0.035, W - 0.3, 0.3, 'lamp', C);                     // soffit light line
      // blank signage plaque on the head (no lettering) and lift-status lights over each bay
      if (head - H > 0.3 && !lifts) {
        bx(-W / 2 + 0.9, 0.68, H + 0.07, head - H - 0.14, 1.2, 0.04, 'charcoal', C);
        bx(-W / 2 + 0.9, 0.71, H + 0.13, head - H - 0.26, 0.5, 0.02, 'frame', C);
      }
      if (lifts) for (const s of [-1, 1]) bx(s * (W / 4 + 0.2), 0.68, H + 0.12, 0.08, 0.9, 0.04, 'lamp', C);
      // pedestrian warning beacons on the jamb faces
      for (const s of [-1, 1]) add('cyl', ...((p) => [p[0], 2.45, p[1]])(P(s * (W / 2 + 0.2), 0.66)), 0.16, 0.16, 0.16, 'lamp', C);
      // striped clearance gantry just outside the opening
      const gd = 1.6, gy = H - 0.45;
      for (const s of [-1, 1]) column(...P(s * (W / 2 + 0.25), gd), y, gy - y + 0.1, 0.06, 'charcoal', C);
      const seg = Math.max(4, Math.round((W + 0.5) / 0.6));
      for (let k = 0; k < seg; k++) bx(-(W + 0.5) / 2 + (W + 0.5) * (k + 0.5) / seg, gd, gy, 0.14, (W + 0.5) / seg - 0.01, 0.14, k % 2 ? 'frame' : 'charcoal', C);
      // wheel guards along the jambs and bollards beyond them
      for (const s of [-1, 1]) {
        bx(s * (W / 2 + 0.2), 1.3, y, 0.22, 0.35, 1.4, 'stone', C);
        bollard(...P(s * (W / 2 + 1.1), 1.0), y);
      }
      // entry / exit island with card readers and barrier arms (the exit arm raised)
      if (lanes === 2) {
        const len = apron - 1.2;
        bx(0, 0.7 + len / 2, y, 0.16, 0.9, len, 'stone', C);
        bollard(...P(0, 0.7 + len + 0.35), y);
        if (gates) {
          const armLen = W / 2 - (lifts ? 0.7 : 0.6);
          for (const s of [-1, 1]) {
            const d = s < 0 ? 2.3 : 1.9;                                             // readers ahead of each barrier
            bx(s * 0.2, d, y + 0.16, 1.0, 0.3, 0.3, 'charcoal', C);               // barrier housing
            if (s < 0) bx(-0.35 - armLen / 2, d, y + 0.98, 0.08, armLen, 0.08, 'frame', C);   // entry arm down
            else bx(0.2, d, y + 1.16, armLen, 0.08, 0.08, 'frame', C);                        // exit arm raised
            bx(s * 0.3, d - s * 1.0, y + 0.16, 1.1, 0.26, 0.26, 'charcoal', C);    // card reader pedestal
            bx(s * 0.44, d - s * 1.0, y + 1.0, 0.16, 0.02, 0.18, 'lamp', C);
          }
        }
      }
      // trench drain across the apron
      bx(0, apron, y - 0.02, 0.04, W + 0.9, 0.35, 'charcoal', C);
    },
  };
}
