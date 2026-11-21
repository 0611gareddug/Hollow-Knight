// 월드 데이터 검증: 문 연결, 스폰/적/오브젝트가 고체에 박히지 않았는지, 방 사이 연결성
import { World } from '../src/js/world/world.js';
import { STORY, COURSES, RUSH } from '../src/js/world/data.js';
import { ENEMIES } from '../src/js/entities/enemies.js';
import { BOSSES } from '../src/js/entities/bosses.js';

const T = 32;
let errors = 0;
const err = (m) => { console.log('  ✗ ' + m); errors++; };

function checkWorld(name, def) {
  console.log(`[${name}]`);
  const w = new World(def);
  const defs = Object.assign({}, ENEMIES, BOSSES);
  // 겹치는 방
  for (let i = 0; i < w.rooms.length; i++)
    for (let j = i + 1; j < w.rooms.length; j++) {
      const a = w.rooms[i], b = w.rooms[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) err(`rooms overlap ${a.id} ${b.id}`);
    }
  if (w.spawn && w.rectSolid(w.spawn.x - 10, w.spawn.y - 38, 20, 37)) err('spawn inside solid');
  for (const r of w.rooms) {
    for (const e of r.enemies) {
      const d = defs[e.kind];
      if (!d) { err(`unknown enemy ${e.kind}`); continue; }
      const x = e.x - d.w / 2, y = e.y - d.h;
      if (d.static) continue;
      if (w.rectSolid(x, y, d.w, d.h - 1)) err(`${r.id}: enemy ${e.kind} at tile ${(e.x / T - 0.5) - r.x},${e.y / T - 1 - r.y} inside solid`);
      if (!w.roomAt(e.x, e.y - 5) || w.roomAt(e.x, e.y - 5).id !== r.id) err(`${r.id}: enemy ${e.kind} outside its room`);
    }
    if (r.boss) {
      const d = defs[r.boss.kind];
      if (w.rectSolid(r.boss.x - d.w / 2, r.boss.y - d.h, d.w, d.h - 1)) err(`${r.id}: boss inside solid`);
    }
  }
  for (const o of w.objects) {
    if (['bench', 'shop', 'shrine', 'lamp', 'sign'].includes(o.type)) {
      if (w.solidAt(o.x, o.y - 4)) err(`${o.room}: ${o.type} inside solid`);
      if (!w.solidAt(o.x, o.y + 4) && w.get(Math.floor(o.x / T), Math.floor((o.y + 4) / T)) !== 2) err(`${o.room}: ${o.type} floating at ${o.x / T - 0.5},${o.y / T - 1}`);
    }
    if (o.type === 'pickup' && w.solidAt(o.x, o.y - 14)) err(`${o.room}: pickup ${o.id} inside solid`);
  }
  // 연결성: 스폰에서 플러드필 (빈 공간), 각 방이 닿는지 (능력/벽 무시한 위상 검사)
  if (w.spawn) {
    const seen = new Uint8Array(w.W * w.H);
    const st = [[Math.floor(w.spawn.x / T), Math.floor((w.spawn.y - 10) / T)]];
    const passable = (t) => t === 0 || t === 2 || t === 3 || t === 4 || t === 5;
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
      const k = y * w.W + x;
      if (seen[k] || !passable(w.tiles[k])) continue;
      seen[k] = 1;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const r of w.rooms) {
      let ok = false;
      for (let j = r.y; j < r.y + r.h && !ok; j++) for (let i = r.x; i < r.x + r.w; i++) if (seen[j * w.W + i]) { ok = true; break; }
      if (!ok) err(`room ${r.id} unreachable`);
    }
  }
  // 방 테두리의 구멍이 다른 방으로 이어지는지 (월드 밖으로 새는 구멍)
  for (const r of w.rooms) {
    for (let i = r.x; i < r.x + r.w; i++)
      for (const j of [r.y, r.y + r.h - 1]) {
        if (w.get(i, j) === 1) continue;
        const ny = j === r.y ? j - 1 : j + 1;
        const nr = w.roomAt(i * T + 16, ny * T + 16);
        if (!nr || w.get(i, ny) === 1) err(`${r.id}: hole in ${j === r.y ? 'top' : 'bottom'} border at x=${i - r.x}`);
      }
    for (let j = r.y; j < r.y + r.h; j++)
      for (const i of [r.x, r.x + r.w - 1]) {
        if (w.get(i, j) === 1) continue;
        const nx = i === r.x ? i - 1 : i + 1;
        const nr = w.roomAt(nx * T + 16, j * T + 16);
        if (!nr || w.get(nx, j) === 1) err(`${r.id}: hole in ${i === r.x ? 'left' : 'right'} border at y=${j - r.y}`);
      }
  }
  console.log(`  rooms=${w.rooms.length} size=${w.W}x${w.H}`);
}

checkWorld('story', STORY);
COURSES.forEach((c) => checkWorld('course ' + c.id, c));
checkWorld('rush', RUSH);
console.log(errors ? `\n${errors} errors` : '\nall good');
process.exit(errors ? 1 : 0);
