/*
  Deliberately small, top-down roulette model.
  Coordinates use polar position (r,a) and velocities (radial, tangential).
  It is a visual physics prototype, not a certified RNG or casino outcome system.
*/
const canvas = document.querySelector('#roulette');
const ctx = canvas.getContext('2d');
const C = canvas.width / 2;
const TAU = Math.PI * 2;
const POCKETS = ['0','32','15','19','4','21','2','25','17','34','6','27','13','36','11','30','8','23','10','5','24','16','33','1','20','14','31','9','22','18','29','7','28','12','35','3','26'];
const RED = new Set(['32','19','21','25','34','27','36','30','23','5','16','1','14','9','18','7','12','3']);
const N = POCKETS.length, STEP = TAU / N;
// IDs are passed without a CSS '#' prefix, so use the ID lookup directly.
const $ = id => document.getElementById(id);
const FIXED_STEP = 1 / 120;
let wheel, ball, physics, spinSeed, last = performance.now(), accumulator = 0, running = false, finished = false, result;

function wrap(a) { return (a % TAU + TAU) % TAU; }
function signedAngle(a) { return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function randomSeed() {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0];
}
function makePhysics(seed) {
  const next = seededRng(seed ^ 0xA5314C7D);
  return {
    // Small, bounded variations model surface texture and contact differences for this spin.
    trackFriction: .76 + next() * .52,
    pocketFriction: .72 + next() * .62,
    outerSlope: .75 + next() * .54,
    innerSlope: .74 + next() * .58,
    innerThreshold: 28 + next() * 20,
    pinRestitution: Array.from({ length: 8 }, () => .25 + next() * .40),
    pinLift: Array.from({ length: 8 }, () => .72 + next() * .58),
    pinAngleOffset: Array.from({ length: 8 }, () => (next() - .5) * .042),
    wallKick: Array.from({ length: N }, () => (next() - .5) * 24),
  };
}
function reset() {
  wheel = { a: 0, v: 0 };
  physics = makePhysics(0);
  ball = { r: 357, a: -0.65, vr: 0, va: 0, z: 0, vz: 0, age: 0, hits: 0, pinCooldown: 0, innerReturn: false, innerVisits: 0 };
  running = false; finished = false; result = null;
  $('result').textContent = 'SPIN을 눌러 시작하세요'; $('state').textContent = 'READY';
}
function spin(seed = randomSeed()) {
  spinSeed = seed >>> 0;
  const next = seededRng(spinSeed);
  physics = makePhysics(spinSeed);
  wheel = { a: next() * TAU, v: .92 + next() * 1.25 };
  ball = { r: 349 + next() * 16, a: next() * TAU, vr: -5 + next() * 10, va: -(4.05 + next() * 2.05), z: 0, vz: 0, age: 0, hits: 0, pinCooldown: 0, innerReturn: false, innerVisits: 0 };
  accumulator = 0;
  running = true; finished = false; result = null;
  $('seed').textContent = spinSeed.toString(16).padStart(8, '0').toUpperCase();
  $('result').textContent = 'BALL IN OUTER TRACK';
}
function pocketAt(a) {
  const local = wrap(a - wheel.a + STEP / 2);
  return Math.floor(local / STEP) % N;
}
function update(dt) {
  // Keep contact resolution stable even on a dropped render frame.
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < steps; i++) updateStep(dt / steps);
}
function updateStep(dt) {
  if (!running) return;
  ball.age += dt;
  ball.pinCooldown = Math.max(0, ball.pinCooldown - dt);
  // Vertical motion is a lightweight third dimension used for pin hops and landing.
  ball.vz -= 255 * dt;
  ball.z += ball.vz * dt;
  if (ball.z <= 0) {
    ball.z = 0;
    if (ball.vz < -24) ball.vz *= -.23; // a small visible landing bounce
    else ball.vz = 0;
  }
  const onTrack = ball.z < .5;
  wheel.a = wrap(wheel.a + wheel.v * dt);
  wheel.v *= Math.exp(-.035 * dt);

  // Bowl profile: after a short outer-track phase, a shallow downhill pull moves the ball inward.
  const descent = Math.max(0, ball.age - 2.0);
  if (onTrack) {
    if (ball.r > 277) ball.vr += (-2.3 * physics.outerSlope * descent - .20 * ball.vr) * dt;
    else if (ball.r > 242) ball.vr += (-10 * physics.innerSlope - .75 * ball.vr) * dt;
    else if (ball.r > 221) ball.vr += (-4.5 * physics.innerSlope - .9 * ball.vr) * dt;
    // The inner rotor rises toward the hub. A rolling ball loses inward speed on this reverse slope
    // and normally rolls back into the pocket ring before it reaches the central bumper.
    else if (ball.r < 205) ball.vr += ((205 - ball.r) * 1.65 - ball.vr * .65) * dt;
  }
  const surfaceFriction = ball.r > 278 ? physics.trackFriction : physics.pocketFriction;
  ball.va *= Math.exp(-(ball.r > 278 ? .17 : .42) * surfaceFriction * dt * (onTrack ? 1 : .12));

  // Outer track rims.
  if (ball.r > 367) { ball.r = 367; ball.vr = -Math.abs(ball.vr) * .40; }
  // Only an exceptionally energetic hop can crest the reverse slope and reach the hub.
  // This remains a final safety contact, not the normal way a ball returns to the pockets.
  if (ball.r < 118) {
    ball.r = 118;
    ball.vr = Math.abs(ball.vr) * .48;
    ball.va = wheel.v + (ball.va - wheel.v) * .55;
    ball.vz = Math.max(ball.vz, 34);
    ball.innerReturn = true;
    ball.innerVisits++;
  }

  // Fixed diamond rebounders.  Each pin is an actual four-face diamond in radial/tangential space.
  // The reflected velocity therefore depends on the face that the ball touches.
  if (ball.r < 330 && ball.r > 262 && ball.z < 1.5 && ball.pinCooldown === 0) {
    for (let i = 0; i < 8; i++) {
      const pinA = i * TAU / 8 + .09 + physics.pinAngleOffset[i];
      const radial = ball.r - 302;
      const tangent = 302 * signedAngle(ball.a - pinA);
      // Includes the ball radius, giving the pin a believable contact envelope.
      const halfRadial = 17, halfTangent = 16;
      if (Math.abs(radial) / halfRadial + Math.abs(tangent) / halfTangent < 1 && ball.hits < 24) {
        // Outward normal of the diamond face currently occupied by the ball.
        let nr = (radial >= 0 ? 1 : -1) / halfRadial;
        let nt = (tangent >= 0 ? 1 : -1) / halfTangent;
        const nLength = Math.hypot(nr, nt); nr /= nLength; nt /= nLength;
        // Convert polar velocity to the pin's radial/tangential coordinate frame.
        const vr = ball.vr, vt = ball.va * ball.r;
        const towardFace = vr * nr + vt * nt;
        if (towardFace < 0) {
          const restitution = physics.pinRestitution[i];
          const reflectedR = vr - (1 + restitution) * towardFace * nr;
          const reflectedT = vt - (1 + restitution) * towardFace * nt;
          ball.vr = reflectedR;
          ball.va = reflectedT / ball.r;
          // The diamond face also turns a little of the impact into vertical energy.
          ball.vz = Math.max(ball.vz, (76 + Math.min(56, Math.abs(towardFace) * .18)) * physics.pinLift[i]);
          // Tiny separation is contact correction, not a visible teleport.
          ball.r += nr * 1.2;
          ball.a = wrap(ball.a + nt * 1.2 / ball.r);
          ball.pinCooldown = .075;
          ball.hits++;
        }
        if (ball.pinCooldown > 0) {
          // One resolved contact per update: nearby pins are considered next substep.
          break;
        }
      }
    }
  }

  // Rotating pocket separators.  Collision uses velocity relative to the wheel, then transfers wheel momentum.
  if (ball.r < 266 && ball.r > 211) {
    // Number/pocket centres are at i * STEP; separator walls live halfway between them.
    const phase = wrap(ball.a - wheel.a);
    const wallAngle = (Math.floor(phase / STEP) + .5) * STEP;
    const boundary = Math.abs(signedAngle(phase - wallAngle));
    const relAngular = ball.va - wheel.v;
    if (boundary < .023 && Math.abs(relAngular) > .16) {
      ball.va = wheel.v - relAngular * .35;
      const wallIndex = Math.floor(phase / STEP) % N;
      ball.vr += physics.wallKick[wallIndex];
      ball.a += Math.sign(relAngular) * .018;
    }
  }
  ball.r += ball.vr * dt;
  ball.a = wrap(ball.a + ball.va * dt);

  // Pocket floor: once the ball crosses the pocket lip it runs in a shallow, rounded well.
  // This creates a few physical-looking bounces rather than snapping directly to the result.
  const rel = Math.abs(ball.va - wheel.v);
  // A slow entry falls into the nearest pocket. A fast inward run may pass across the inner wheel;
  // after the hub reflection, the same rounded pocket floor catches it on the way back out.
  if (ball.r < 238 && ball.age > 4 && (ball.innerReturn || ball.vr > -physics.innerThreshold)) {
    const p = pocketAt(ball.a);
    const center = wheel.a + p * STEP;
    const offset = signedAngle(ball.a - center);
    const relativeVa = ball.va - wheel.v;
    // Radial and angular spring/damper terms approximate the concave pocket bottom.
    ball.vr += ((217 - ball.r) * 5.8 - ball.vr * 3.5) * dt;
    ball.va += (-42 * offset - relativeVa * 4.2) * dt;
    if (Math.abs(offset) < .006 && Math.abs(ball.r - 217) < .7 && Math.abs(ball.vr) < .7 && rel < .12) finish(p);
  }
  if (ball.age > 18) finish(pocketAt(ball.a)); // guard for an intentionally playful, non-deterministic model
}
function finish(p) {
  if (finished) return;
  finished = true; running = false; result = POCKETS[p];
  $('result').textContent = `RESULT  ·  ${result}`; $('state').textContent = `POCKET ${result}`;
}
function polar(r, a) { return [C + Math.cos(a) * r, C + Math.sin(a) * r]; }
function circle(r, fill, stroke) { ctx.beginPath(); ctx.arc(C,C,r,0,TAU); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.stroke();} }
function wedge(r0,r1,a0,a1,fill) { ctx.beginPath(); ctx.arc(C,C,r1,a0,a1); ctx.arc(C,C,r0,a1,a0,true); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); }
// These variants are for the wheel's translated coordinate system (its hub is 0,0).
function wheelCircle(r, fill, stroke) { ctx.beginPath(); ctx.arc(0,0,r,0,TAU); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.stroke();} }
function wheelWedge(r0,r1,a0,a1,fill) { ctx.beginPath(); ctx.arc(0,0,r1,a0,a1); ctx.arc(0,0,r0,a1,a0,true); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); }
function draw() {
  ctx.clearRect(0,0,900,900);
  const bg = ctx.createRadialGradient(C,C,0,C,C,440); bg.addColorStop(0,'#211c13'); bg.addColorStop(.7,'#120f0a'); bg.addColorStop(1,'#050605'); ctx.fillStyle=bg;ctx.fillRect(0,0,900,900);
  circle(415,'#b58d42'); circle(404,'#17130d'); circle(385,'#433219'); circle(374,'#0d0e0d');
  // Outer concave ball track and its gold inner lip.
  circle(368,'#252720','#6f6344'); circle(345,'#101511','#8b7a4a'); circle(329,'#20231e'); circle(275,'#10120e','#655936');
  // Stationary diamond-shaped deflectors.
  for(let i=0;i<8;i++) { const a=i*TAU/8+.09, [x,y]=polar(302,a); ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/4);ctx.fillStyle='#d8c597';ctx.strokeStyle='#5c512f';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,0);ctx.lineTo(0,12);ctx.lineTo(-9,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore(); }
  // Rotating numbered wheel, pocket colors, separators and labels.
  ctx.save();ctx.translate(C,C);ctx.rotate(wheel.a);
  for(let i=0;i<N;i++) { const a=i*STEP; const val=POCKETS[i]; const color=val==='0' ? '#15714b' : RED.has(val) ? '#a42422' : '#171918'; wheelWedge(205,267,a-STEP/2+.008,a+STEP/2-.008,color); wheelWedge(228,260,a-STEP/2+.025,a+STEP/2-.025,'#0d0e0c'); }
  for(let i=0;i<N;i++) { const a=i*STEP, [x,y]=[Math.cos(a)*246,Math.sin(a)*246]; ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);ctx.fillStyle='#e8ddc1';ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(POCKETS[i],0,0);ctx.restore(); }
  for(let i=0;i<N;i++) { const a=(i+.5)*STEP; ctx.strokeStyle='#c6a960';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(Math.cos(a)*205,Math.sin(a)*205);ctx.lineTo(Math.cos(a)*267,Math.sin(a)*267);ctx.stroke(); }
  // The central rotating rotor: a recessed wood field, twelve subtle spokes and a metal hub.
  wheelCircle(202,'#7b612f','#d4b25e'); wheelCircle(194,'#1b2119','#5e542f');
  wheelCircle(171,'#2a2013','#9b7b3d'); wheelCircle(164,'#181b17','#4d452c');
  for(let i=0;i<12;i++) { const a=i*TAU/12; ctx.save();ctx.rotate(a);ctx.fillStyle=i%2?'#302615':'#241c12';ctx.beginPath();ctx.moveTo(24,-8);ctx.lineTo(158,-3);ctx.lineTo(158,3);ctx.lineTo(24,8);ctx.closePath();ctx.fill();ctx.restore(); }
  wheelCircle(84,'#21251f','#af9049'); wheelCircle(75,'#373022','#756033');
  ctx.beginPath();ctx.arc(0,0,66,0,TAU);ctx.fillStyle='#b58d42';ctx.fill();ctx.beginPath();ctx.arc(0,0,54,0,TAU);ctx.fillStyle='#22251f';ctx.fill();
  wheelCircle(30,'#c09c50','#ead27e'); wheelCircle(19,'#24251f'); wheelCircle(7,'#d8c386');ctx.restore();
  // Ball shadow + ball.
  const [x,y]=polar(ball.r,ball.a);const bx=x-ball.z*.32, by=y-ball.z*.40;ctx.beginPath();ctx.ellipse(x+5,y+7,10+ball.z*.11,7+ball.z*.06,0,0,TAU);ctx.fillStyle=`rgba(0,0,0,${Math.max(.16,.55-ball.z*.012)})`;ctx.fill(); const g=ctx.createRadialGradient(bx-4,by-5,1,bx,by,12);g.addColorStop(0,'#fff');g.addColorStop(.45,'#eee9dc');g.addColorStop(1,'#77766c');ctx.beginPath();ctx.arc(bx,by,11,0,TAU);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#faf4e6';ctx.stroke();
  $('wheelSpeed').textContent = `${wheel.v.toFixed(2)} rad/s`; $('ballSpeed').textContent = `${(Math.abs(ball.va)*ball.r).toFixed(0)} px/s`; if(running) $('state').textContent = ball.z > 2 ? 'AIRBORNE' : ball.r > 277 ? 'OUTER TRACK' : ball.r > 240 ? 'DEFLECTING' : ball.r < 200 ? 'INNER ROTOR' : 'POCKET RING';
}
function frame(now) {
  accumulator += Math.min(.05, (now - last) / 1000); last = now;
  while (accumulator >= FIXED_STEP) { updateStep(FIXED_STEP); accumulator -= FIXED_STEP; }
  draw(); requestAnimationFrame(frame);
}
$('spin').addEventListener('click', () => spin());
$('replay').addEventListener('click', () => { if (spinSeed !== undefined) spin(spinSeed); });
$('reset').addEventListener('click', reset); reset(); requestAnimationFrame(frame);
