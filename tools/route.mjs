// 스피드런 가이드 영상용 경로 계산: 실제 플레이어 물리로 탐색한 착지점 경로(웨이포인트)를 구간별로 출력
// 사용: node tools/route.mjs > tools/route_ch1.json
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = globalThis;
const { World } = await import('../src/js/world/world.js');
const { STORY } = await import('../src/js/world/data.js');
const { Player } = await import('../src/js/entities/player.js');
const T = 32, DT = 1 / 120;

function mkRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function search(abilities, start, goal, opts = {}) {
  const w = new World(STORY);
  const g = { world: w, abilities, anchors: [], allyNeedsHeal: () => false, healAlly() {}, onHeal() {}, onSlash() {}, onSlam() {} };
  const key = (x, y) => Math.round(x / 16) + ',' + Math.round(y / 8);
  const nodes = new Map();
  const queue = [];
  let found = null;
  const push = (x, y, parent, t, traj) => {
    const k = key(x, y);
    if (nodes.has(k)) return;
    const n = { x, y, parent, d: parent ? parent.d + t : 0, traj: traj ? traj.slice() : [] };
    nodes.set(k, n);
    queue.push(n);
    if (Math.abs(x - goal.x) < 24 && Math.abs(y - goal.y) < 12 && !found) found = n;
  };
  push(start.x, start.y, null, 0);
  const P = new Player(0, 0);
  const inp = { held: {}, pressed: {}, released: {}, consume() {} };
  const rnd = mkRand(opts.seed || 1);
  while (queue.length && !found) {
    // 목표 방향 우선: 큐를 진행 거리 순으로 (BFS + 약한 휴리스틱)
    const s = queue.shift();
    for (let r = 0; r < 40; r++) {
      P.reset(s.x, s.y);
      P.grounded = true;
      let dir = r % 3 === 0 ? 0 : r % 3 === 1 ? 1 : -1;
      let wasAir = false;
      const jumpAt = rnd() < 0.85 ? rnd() * 0.25 : 99;
      const holdJ = [0.03, 0.08, 0.14, 0.4][Math.floor(rnd() * 4)];
      const dashAt = abilities.dash && rnd() < 0.45 ? 0.05 + rnd() * 0.5 : 99;
      const djAt = abilities.djump && rnd() < 0.6 ? 0.15 + rnd() * 0.45 : 99;
      const turnAt = rnd() < 0.35 ? 0.1 + rnd() * 0.5 : 99;
      const wallMode = abilities.wall && rnd() < 0.6;
      const zig = rnd() < 0.5;
      const drop = rnd() < 0.15;
      let jHeldUntil = -1, wallCd = 0, step = 0;
      const traj = [];
      for (let t = 0; t < 4.5; t += DT) {
        if (step++ % 8 === 0) traj.push([Math.round(P.cx), Math.round(P.y + P.h)]);
        for (const k in inp.pressed) inp.pressed[k] = false;
        if (t >= turnAt && t < turnAt + DT) dir = dir === 0 ? (rnd() < 0.5 ? 1 : -1) : -dir;
        inp.held.left = dir < 0;
        inp.held.right = dir > 0;
        inp.held.down = drop && t < 0.1;
        if ((t >= jumpAt && t < jumpAt + DT) || (t >= djAt && t < djAt + DT)) {
          inp.pressed.jump = true;
          jHeldUntil = t + holdJ;
        }
        if (t >= dashAt && t < dashAt + DT) inp.pressed.dash = true;
        if (wallMode && P.anim === 'wall' && wallCd <= 0) {
          inp.pressed.jump = true;
          jHeldUntil = t + 0.12;
          wallCd = 0.2;
          dir = zig ? P.facing : P.facing === 1 ? -1 : 1;
        }
        if (wallCd > 0) wallCd -= DT;
        inp.held.jump = t <= jHeldUntil;
        P.update(DT, inp, g);
        if (P.hazardT > 0 || w.rectHazard(P.x + 3, P.y + 4, P.w - 6, P.h - 4)) break;
        if (!P.grounded) wasAir = true;
        if (P.grounded && (wasAir || t > 0.25)) {
          push(P.cx, P.y + P.h, s, t, traj);
          if (wasAir) break;
        }
      }
      if (found) break;
    }
    if (nodes.size > (opts.maxNodes || 30000)) break;
  }
  if (!found) return null;
  const path = [];
  for (let n = found; n; n = n.parent) {
    path.push([Math.round(n.x), Math.round(n.y), 1]);
    for (let i = n.traj.length - 1; i >= 1; i--) path.push([n.traj[i][0], n.traj[i][1], 0]);
  }
  return { path: path.reverse(), nodes: nodes.size, hops: 0 };
}

const w0 = new World(STORY);
const at = (room, x, y) => {
  const r = w0.roomById[room];
  return { x: (r.x + x + 0.5) * T, y: (r.y + y + 1) * T };
};
const LEGS = [
  { id: 'L1', ab: {}, from: w0.spawn, to: at('a6', 10, 17), then: 'boss' },
  { id: 'L2', ab: {}, from: at('a6', 10, 17), to: at('a6', 22, 17), then: 'shrine' },
  { id: 'L3', ab: { dash: true }, from: at('a6', 22, 17), to: at('b5', 9, 23), then: 'boss' },
  { id: 'L4', ab: { dash: true }, from: at('b5', 9, 23), to: at('b5', 9, 23), then: 'shrine' },
  { id: 'L5', ab: { dash: true, wall: true }, from: at('b5', 9, 23), to: at('c4', 16, 26), then: 'shrine' },
  { id: 'L6', ab: { dash: true, wall: true, djump: true }, from: at('c4', 16, 26), to: at('c6', 12, 14), then: 'boss' },
];
const out = [];
for (const L of LEGS) {
  let best = null;
  for (let seed = 1; seed <= 3; seed++) {
    const r = search(L.ab, L.from, L.to, { seed });
    if (r && (!best || r.path.length < best.path.length)) best = r;
  }
  console.error(L.id, best ? `${best.path.length} pts, ${best.nodes} nodes` : 'FAILED');
  out.push({ id: L.id, ab: L.ab, then: L.then, goal: [L.to.x, L.to.y], path: best ? best.path : [] });
}
console.log(JSON.stringify(out));
