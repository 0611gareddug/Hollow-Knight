// 실제 플레이어 물리로 도달 가능성 검증 (몬테카를로 BFS)
// 능력 단계별로 스폰에서 어떤 방/지점까지 갈 수 있는지 확인
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = globalThis;
const { World } = await import('../src/js/world/world.js');
const { STORY, COURSES } = await import('../src/js/world/data.js');
const { Player } = await import('../src/js/entities/player.js');
const T = 32;
const DT = 1 / 120;

function mkInput() {
  const held = {}, pressed = {}, released = {};
  return { held, pressed, released, consume() {} };
}

function explore(def, abilities, start, opts = {}) {
  const w = new World(def);
  for (const id of opts.broken || []) w.breakWall(id);
  const g = { world: w, abilities, anchors: w.objects.filter((o) => o.type === 'anchor'), allyNeedsHeal: () => false, healAlly() {}, onHeal() {}, onSlash() {} };
  const key = (x, y) => Math.round(x / 16) + ',' + Math.round(y / 8);
  const seen = new Map();
  const queue = [];
  const push = (x, y) => {
    const k = key(x, y);
    if (seen.has(k)) return;
    seen.set(k, { x, y });
    queue.push({ x, y });
  };
  push(start.x, start.y);
  const P = new Player(0, 0);
  const inp = mkInput();
  let rollouts = 0;
  const R = opts.rollouts || 36;
  while (queue.length) {
    const s = queue.shift();
    for (let r = 0; r < R; r++) {
      rollouts++;
      P.reset(s.x, s.y);
      P.grounded = true;
      let dir = r % 3 === 0 ? 0 : r % 3 === 1 ? 1 : -1;
      let airT = 0;
      let wasAir = false;
      const jumpAt = Math.random() < 0.85 ? Math.random() * 0.25 : 99;
      const holdJ = [0.03, 0.08, 0.14, 0.4][Math.floor(Math.random() * 4)];
      const dashAt = abilities.dash && Math.random() < 0.45 ? 0.05 + Math.random() * 0.5 : 99;
      const djAt = abilities.djump && Math.random() < 0.6 ? 0.15 + Math.random() * 0.45 : 99;
      const turnAt = Math.random() < 0.35 ? 0.1 + Math.random() * 0.5 : 99;
      const wallMode = abilities.wall && Math.random() < 0.6;
      const zig = Math.random() < 0.5;
      const drop = Math.random() < 0.15;
      // 사슬 정책: 공중에서 위쪽 앞으로 발사, 잠시 매달렸다 놓기 (여러 번)
      const useHook = abilities.hook && Math.random() < 0.7;
      let hookAt = 0.05 + Math.random() * 0.35, hookRel = 99, hookAim = Math.random() < 0.7 ? 'up' : 'none';
      let jHeldUntil = -1;
      let wallCd = 0;
      let lastWallJump = -1;
      for (let t = 0; t < 4.5; t += DT) {
        for (const k in inp.pressed) inp.pressed[k] = false;
        if (t >= turnAt && t < turnAt + DT) dir = dir === 0 ? (Math.random() < 0.5 ? 1 : -1) : -dir;
        inp.held.left = dir < 0;
        inp.held.right = dir > 0;
        inp.held.down = drop && t < 0.1;
        if (t >= jumpAt && t < jumpAt + DT) {
          inp.pressed.jump = true;
          jHeldUntil = t + holdJ;
        }
        if (t >= djAt && t < djAt + DT) {
          inp.pressed.jump = true;
          jHeldUntil = t + holdJ;
        }
        if (t >= dashAt && t < dashAt + DT) inp.pressed.dash = true;
        // 벽 오르기 정책: 미끄러지면 점프, 잠시 뒤 다시 벽 쪽으로
        if (wallMode && P.anim === 'wall' && wallCd <= 0) {
          inp.pressed.jump = true;
          jHeldUntil = t + 0.12;
          wallCd = 0.2;
          lastWallJump = t;
          // single: 같은 벽을 계속 오름, zig: 반대편 벽으로 지그재그
          dir = zig ? P.facing : P.facing === 1 ? -1 : 1;
        }
        if (wallCd > 0) wallCd -= DT;
        if (wallMode && lastWallJump > 0 && t - lastWallJump > 0.14 && t - lastWallJump < 0.2) {
          // 벽 점프 후 다시 벽 쪽으로
        }
        inp.held.jump = t <= jHeldUntil;
        if (useHook) {
          if (t >= hookAt && t < hookAt + DT && !P.hook) {
            inp.pressed.hook = true;
            inp.held.hook = true;
            hookRel = t + 0.25 + Math.random() * 1.1;
            inp.held.up = hookAim === 'up';
          }
          if (t >= hookRel) {
            inp.held.hook = false;
            inp.held.up = false;
            if (Math.random() < 0.5) { inp.pressed.jump = true; jHeldUntil = t + 0.1; }
            hookRel = 99;
            hookAt = t + 0.1 + Math.random() * 0.4;
            hookAim = Math.random() < 0.7 ? 'up' : 'none';
            if (Math.random() < 0.3) dir = dir === 0 ? 1 : dir;
          }
        }
        P.update(DT, inp, g);
        if (P.hazardT > 0 || w.rectHazard(P.x + 3, P.y + 4, P.w - 6, P.h - 4)) break;
        if (!P.grounded) {
          airT += DT;
          wasAir = true;
        }
        if (P.grounded && (wasAir || t > 0.25)) {
          push(P.cx, P.y + P.h);
          if (wasAir) break;
        }
      }
    }
    if (seen.size > (opts.maxNodes || 6000)) break;
  }
  const rooms = new Set();
  for (const v of seen.values()) {
    const r = w.roomAt(v.x, v.y - 10);
    if (r) rooms.add(r.id);
  }
  return { rooms, seen, w, rollouts };
}

function report(label, res, expectRooms, points = []) {
  const miss = expectRooms.filter((r) => !res.rooms.has(r));
  const pmiss = points.filter(([name, x, y]) => {
    for (const v of res.seen.values()) if (Math.abs(v.x - x) < 40 && Math.abs(v.y - y) < 20) return false;
    return true;
  });
  console.log(`${label}: nodes=${res.seen.size} rollouts=${res.rollouts} rooms=[${[...res.rooms].join(',')}]`);
  if (miss.length) console.log(`   ✗ 도달 못함: ${miss.join(', ')}`);
  for (const p of pmiss) console.log(`   ✗ 지점 도달 못함: ${p[0]}`);
  if (!miss.length && !pmiss.length) console.log('   ✓ OK');
}

const which = process.argv[2] || 'story';
if (which === 'story') {
  const w0 = new World(STORY);
  const spawn = w0.spawn;
  const obj = (room, type) => w0.objects.find((o) => o.room === room && o.type === type);
  const tile = (room, x, y) => {
    const r = w0.roomById[room];
    return [(r.x + x + 0.5) * T, (r.y + y + 1) * T];
  };
  // 0단계: 능력 없음 → 첫 보스 방까지 + 상자 위 조각
  let r0 = explore(STORY, { dash: false, wall: false, djump: false }, spawn);
  report('능력 없음', r0, ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], [['a2 가면 조각', ...tile('a2', 55, 6)]]);
  if (r0.rooms.has('b1')) console.log('   ! 대시 없이 b1 진입 가능 (게이트 확인 필요: b1은 보스 문 뒤)');
  // 보스 방에서 벤치로 돌아갈 수 있는지
  const a6 = tile('a6', 22, 17);
  let back = explore(STORY, { dash: false, wall: false, djump: false }, { x: a6[0], y: a6[1] });
  report('a6→복귀(능력 없음)', back, ['a3', 'a1']);
  // 1단계: 대시
  let r1 = explore(STORY, { dash: true, wall: false, djump: false }, { x: a6[0], y: a6[1] });
  report('대시', r1, ['b1', 'b2', 'b3', 'b4', 'b5'], [['b3 조각', ...tile('b3', 15, 35)]]);
  if (r1.rooms.has('c1')) console.log('   ! 벽 타기 없이 c1 진입');
  if (r1.rooms.has('h1')) console.log('   ! 이단 점프 없이 숨겨진 구역 진입');
  // 2단계: 대시 + 벽
  const b5 = tile('b5', 15, 23);
  let r2 = explore(STORY, { dash: true, wall: true, djump: false }, { x: b5[0], y: b5[1] }, { maxNodes: 9000 });
  report('대시+벽', r2, ['c1', 'c2', 'c3', 'c4'], [['c1 조각', ...tile('c1', 25, 7)], ['c4 제단', ...tile('c4', 16, 26)]]);
  // 3단계: 전부
  const c4 = tile('c4', 16, 26);
  let r3 = explore(STORY, { dash: true, wall: true, djump: true }, { x: c4[0], y: c4[1] }, { maxNodes: 12000 });
  report('전부', r3, ['c5', 'c6'], []);
  const b2 = tile('b2', 40, 17);
  let r4 = explore(STORY, { dash: true, wall: true, djump: true }, { x: b2[0], y: b2[1] }, { broken: ['b2_secret'], maxNodes: 12000 });
  report('숨겨진 구역(벽 부순 뒤)', r4, ['h1', 'h2'], [['h1 조각', ...tile('h1', 3, 23)]]);
  // 보스 방 c6 → c5 벤치 복귀
  // 2장: 봉인을 지나 승강로 → 톱니 광장 (사슬 없이)
  const c6b = tile('d1', 5, 44);
  let q0 = explore(STORY, { dash: true, wall: true, djump: true }, { x: c6b[0], y: c6b[1] }, { maxNodes: 14000 });
  report('2장 승강로(사슬 없음)', q0, ['d1', 'd2'], [['d2 사슬 제단', ...tile('d2', 33, 18)]]);
  if (q0.rooms.has('d4')) console.log('   ! 사슬 없이 d4 도달 (d3 사슬 다리 우회 가능)');
  const d2 = tile('d2', 33, 18);
  let q1 = explore(STORY, { dash: true, wall: true, djump: true, hook: true }, { x: d2[0], y: d2[1] }, { maxNodes: 16000, rollouts: 44 });
  report('2장 전체(사슬)', q1, ['d3', 'd4', 'd5', 'd6', 'e1', 'e2', 'e3', 'e4', 'f1', 'f2', 'f3']);
  const c6 = tile('c6', 20, 14);
  let r5 = explore(STORY, { dash: true, wall: true, djump: true }, { x: c6[0], y: c6[1] });
  report('c6→c5 복귀', r5, ['c5']);
} else {
  for (const c of COURSES) {
    const w0 = new World(c);
    const r = explore(c, { dash: true, wall: true, djump: true }, w0.spawn, { maxNodes: 8000 });
    let fin = false;
    const f = w0.finish;
    for (const v of r.seen.values()) if (v.x > f.x && v.x < f.x + f.w && v.y > f.y && v.y < f.y + f.h + 40) fin = true;
    // 결승선은 땅 위가 아닐 수 있으니 결승 영역 근처 도달 확인
    let near = false;
    for (const v of r.seen.values()) if (v.x > f.x - 40 && v.x < f.x + f.w + 40 && v.y > f.y - 40 && v.y < f.y + f.h + 64) near = true;
    console.log(`${c.name}: nodes=${r.seen.size} ${fin || near ? '✓ 결승 도달' : '✗ 결승 도달 못함'}`);
  }
}

// ── 발판 전수 검사: 각 구역 도달 시점의 능력으로 닿지 않는 윗면 찾기 ──
if (which === 'surfaces') {
  const w0 = new World(STORY);
  const tile = (room, x, y) => { const r = w0.roomById[room]; return { x: (r.x + x + 0.5) * T, y: (r.y + y + 1) * T }; };
  const stages = [
    { ab: { dash: false, wall: false, djump: false }, start: w0.spawn, zones: [1] },
    { ab: { dash: true, wall: false, djump: false }, start: tile('a6', 22, 17), zones: [2] },
    { ab: { dash: true, wall: true, djump: false }, start: tile('b5', 15, 23), zones: [3] },
    { ab: { dash: true, wall: true, djump: true }, start: tile('b2', 40, 17), zones: [4], broken: ['b2_secret'] },
    { ab: { dash: true, wall: true, djump: true, hook: true }, start: tile('d2', 33, 18), zones: [5, 6, 7] },
  ];
  for (const st of stages) {
    const res = explore(STORY, st.ab, st.start, { maxNodes: 16000, rollouts: 44, broken: st.broken });
    const nodes = [...res.seen.values()];
    const W = res.w;
    const solid = (i, j) => { const t = W.get(i, j); return t === 1 || t === 5 || t === 6; };
    for (const r of W.rooms) {
      if (!st.zones.includes(r.zone)) continue;
      const segs = [];
      for (let j = r.y + 2; j < r.y + r.h; j++) {
        let run = null;
        for (let i = r.x + 1; i < r.x + r.w - 1; i++) {
          const t = W.get(i, j);
          const top = (t === 1 || t === 2) && !solid(i, j - 1) && W.get(i, j - 1) !== 2 && !solid(i, j - 2) && W.get(i, j - 1) !== 3;
          if (top) { if (!run) run = { i0: i, i1: i, j }; else run.i1 = i; }
          else if (run) { segs.push(run); run = null; }
        }
        if (run) segs.push(run);
      }
      for (const sg of segs) {
        const hit = nodes.some((n) => n.x > sg.i0 * T - 12 && n.x < (sg.i1 + 1) * T + 12 && Math.abs(n.y - sg.j * T) < 10);
        if (!hit) console.log(`  ✗ ${r.id} 윗면 x=${sg.i0 - r.x}~${sg.i1 - r.x} y=${sg.j - r.y} (${W.get(sg.i0, sg.j) === 2 ? '발판' : '바닥/턱'})`);
      }
    }
  }
}
