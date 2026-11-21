// 스크립트 컨트롤러로 벽 오르기 / 사슬 다리 통과 가능 여부 확인
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = globalThis;
const { World } = await import('../src/js/world/world.js');
const { STORY } = await import('../src/js/world/data.js');
const { Player } = await import('../src/js/entities/player.js');
const T = 32, DT = 1 / 120;
const w = new World(STORY);
const g = { world: w, abilities: { dash: true, wall: true, djump: true, hook: true }, anchors: w.objects.filter((o) => o.type === 'anchor'), allyNeedsHeal: () => false, healAlly() {}, onHeal() {}, onSlash() {} };
const tile = (room, x, y) => { const r = w.roomById[room]; return [(r.x + x + 0.5) * T, (r.y + y + 1) * T]; };
const mk = () => ({ held: {}, pressed: {}, released: {}, consume() {} });

// 1) C6 오른쪽 벽 오르기
{
  const P = new Player(...tile('c6', 41, 14));
  const inp = mk();
  let best = 1e9;
  for (let t = 0; t < 8; t += DT) {
    for (const k in inp.pressed) inp.pressed[k] = false;
    inp.held.right = true; // 벽 쪽으로 계속 누름
    if (P.anim === 'wall' || (P.grounded && t < 0.1)) inp.pressed.jump = true;
    inp.held.jump = true;
    P.update(DT, inp, g);
    best = Math.min(best, P.y);
  }
  const r = w.roomAt(P.cx, P.cy);
  console.log('벽 오르기: 최고 높이 row', ((best / T) - w.oy).toFixed(1), '(c6 바닥 row 15, 승강로는 row<0) 최종 방', r && r.id);
}
// 2) 사슬 다리: 고리마다 걸고, 고리를 지나면 놓고 다음 고리
{
  const P = new Player(...tile('d3', 7, 22));
  const inp = mk();
  const anchors = g.anchors.filter((a) => a.room === 'd3').sort((a, b) => a.x - b.x);
  let ai = 0, phase = 'run', log = [];
  for (let t = 0; t < 14; t += DT) {
    for (const k in inp.pressed) inp.pressed[k] = false;
    inp.held.right = true;
    const a = anchors[ai];
    if (phase === 'run' && P.cx > tile('d3', 8, 22)[0]) { inp.pressed.jump = true; inp.held.jump = true; phase = 'jump'; }
    else if (phase === 'jump' && t > 0) {
      inp.held.jump = P.vy < 0;
      if (P.vy > -200 && a) { inp.pressed.hook = true; inp.held.hook = true; inp.held.up = true; phase = 'hang'; }
    } else if (phase === 'hang') {
      inp.held.hook = true;
      inp.held.up = false;
      if (P.hook && P.hook.phase === 'swing' && P.cx > P.hook.x + 40 && P.vy < 60) {
        inp.held.hook = false; // 앞쪽 정점 근처에서 놓기
        ai++;
        phase = 'jump';
        log.push(`놓음@${(P.cx / T - w.roomById.d3.x).toFixed(1)}`);
      }
      if (!P.hook && P.grounded) phase = 'run';
    }
    const hadHook = !!P.hook;
    P.update(DT, inp, g);
    if (inp.pressed.hook && 0) log.push(`발사@${(P.cx / T - w.roomById.d3.x).toFixed(1)},${(P.y / T - w.roomById.d3.y - w.oy).toFixed(1)} 목표:${P.hook ? P.hook.type + '(' + ((P.hook.x / T) - w.roomById.d3.x).toFixed(0) + ',' + ((P.hook.y / T) - w.roomById.d3.y - w.oy).toFixed(0) + ')' : '없음'}`);
    if (w.rectHazard(P.x + 3, P.y + 4, P.w - 6, P.h - 4)) { log.push('가시!'); break; }
    if (w.roomAt(P.cx, P.cy) && w.roomAt(P.cx, P.cy).id === 'd4') { log.push('d4 도착'); break; }
  }
  console.log('사슬 다리:', log.join(' '), '최종 x tile', (P.cx / T - w.roomById.d3.x).toFixed(1));
}
{
  const { findHookTarget } = await import('../src/js/entities/player.js');
  const r = w.roomById.d3;
  const an = g.anchors.filter((a) => a.room === 'd3').map((a) => [(a.x / T - r.x).toFixed(1), (a.y / T - r.y).toFixed(1)]);
  console.log('d3 room y', r.y, 'anchors local', JSON.stringify(an));
  const ox = (r.x + 16.6) * T, oy = (r.y + 13) * T;
  for (const [ax, ay] of [[0.707, -0.707], [1, 0]]) {
    console.log('aim', ax, ay, JSON.stringify(findHookTarget(ox, oy, ax, ay, g, true)));
  }
  const a = g.anchors.filter((a) => a.room === 'd3')[1];
  console.log('lineClear to anchor2', w.lineClear(ox, oy, a.x, a.y), 'dist', Math.hypot(a.x - ox, a.y - oy).toFixed(0));
}
