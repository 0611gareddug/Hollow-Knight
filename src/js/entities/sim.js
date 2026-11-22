// 적/투사체 시뮬레이션. 방장(또는 혼자)일 때만 권한 시뮬레이션, 참가자는 스냅샷 보간
import { ENEMIES } from './enemies.js';
import '../render/enemyArt.js';
import { BOSSES } from './bosses.js';
import { ENEMIES2 } from './enemies2.js';
import { BOSSES2 } from './bosses2.js';
import { PROJ, makeProj } from './projectiles.js';
import { cx, cy } from './common.js';

export const DEFS = Object.assign({}, ENEMIES, BOSSES, ENEMIES2, BOSSES2);
const KINDS = Object.keys(DEFS);
const PTYPES = Object.keys(PROJ);
const HP_SCALE = [1, 1, 1.6, 2.2, 2.8];
const HP_SCALE_MOB = [1, 1, 1.3, 1.55, 1.8];

export class Sim {
  constructor(game) {
    this.g = game;
    this.enemies = [];
    this.projs = [];
    this.nextId = 1;
    this.rooms = {}; // roomId -> {spawned, idleT}
    this.views = new Map(); // 참가자: 적 뷰
    this.pviews = new Map();
  }

  get world() {
    return this.g.world;
  }

  reset() {
    this.enemies.length = 0;
    this.projs.length = 0;
    this.rooms = {};
    this.views.clear();
    this.pviews.clear();
  }

  // 화면에 그릴/충돌 판정할 목록
  list() {
    return this.g.isHost ? this.enemies : Array.from(this.views.values());
  }
  plist() {
    return this.g.isHost ? this.projs : Array.from(this.pviews.values());
  }

  _api(room) {
    const self = this;
    return {
      world: this.world,
      room,
      near: (e) => self._nearest(e, room),
      proj: (type, x, y, vx, vy, o) => self.spawnProj(type, x, y, vx, vy, o, room.id),
      spawnEnemy: (kind, x, y, ex) => self.spawn(kind, x, y, room.id, ex),
      ev: (name, data) => self.g.event(name, data),
      count: (kind) => self.enemies.filter((e) => e.kind === kind && e.room === room.id && !e.dead).length,
      pcount: (type) => self.projs.filter((p) => p.type === type && p.room === room.id).length,
    };
  }

  _nearest(e, room) {
    let best = null, bd = 1e18;
    for (const p of this.g.targets) {
      if (p.room !== room.id || !p.alive) continue;
      const d = (p.cx - cx(e)) ** 2 + (p.cy - cy(e)) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  spawn(kind, x, y, roomId, ex = {}) {
    const def = DEFS[kind];
    const e = {
      id: this.nextId++, kind, room: roomId,
      w: def.w, h: def.h, x: x - def.w / 2, y: y - def.h,
      vx: 0, vy: 0, facing: ex.dir || (Math.random() < 0.5 ? -1 : 1),
      st: 'idle', t: Math.random() * 0.5, kb: 0, fl: 0, ex: Object.assign({}, ex), grounded: false, dead: false,
    };
    const n = this.g.playerCount;
    const hp0 = ex.hp || def.hp;
    e.maxHp = e.hp = Math.round(hp0 * (def.boss ? HP_SCALE[n] : HP_SCALE_MOB[n]));
    const room = this.world.roomById[roomId];
    if (def.init) def.init(e, this._api(room));
    if (def.boss) e.t = 0;
    this.enemies.push(e);
    return e;
  }

  spawnProj(type, x, y, vx, vy, o = {}, roomId) {
    const p = makeProj(this.nextId++, type, x, y, vx, vy, o);
    p.room = roomId;
    const def = PROJ[type];
    if (def.init) def.init(p, this._api(this.world.roomById[roomId]));
    this.projs.push(p);
    return p;
  }

  // ───── 방장 업데이트 ─────
  updateHost(dt) {
    const g = this.g;
    const active = new Set();
    for (const p of g.targets) if (p.room) active.add(p.room);
    // 방 활성화 / 비활성화
    for (const rid of active) {
      let rs = this.rooms[rid];
      if (!rs) rs = this.rooms[rid] = { spawned: false, idleT: 0 };
      rs.idleT = 0;
      if (!rs.spawned) {
        rs.spawned = true;
        const room = this.world.roomById[rid];
        if (room && g.mode !== 'race') for (const sp of room.enemies) this.spawn(sp.kind, sp.x, sp.y, rid, Object.assign({}, sp));
      }
    }
    for (const rid in this.rooms) {
      const rs = this.rooms[rid];
      if (active.has(rid) || !rs.spawned) continue;
      rs.idleT += dt;
      if (rs.idleT > 2.5 && !this.enemies.some((e) => e.room === rid && DEFS[e.kind].boss && !e.dead)) {
        rs.spawned = false;
        this.enemies = this.enemies.filter((e) => e.room !== rid);
        this.projs = this.projs.filter((p) => p.room !== rid);
      }
    }
    // 적 업데이트
    for (const e of this.enemies) {
      if (e.dead || !active.has(e.room)) continue;
      e.t += dt;
      if (e.fl > 0) e.fl -= dt;
      const room = this.world.roomById[e.room];
      DEFS[e.kind].update(e, dt, this._api(room));
      // 방 밖으로 떨어지면 제거
      if (e.y > room.py + room.ph + 200) e.dead = true;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // 투사체
    const keep = [];
    const cur = this.projs;
    this.projs = []; // 업데이트 중 새로 생긴 투사체는 여기에 쌓임
    for (const p of cur) {
      p.t += dt;
      const api = this._api(this.world.roomById[p.room]);
      if (p.t >= p.life) {
        if (p.type === 'rockwarn') PROJ.rockwarn.update(p, dt, api);
        continue;
      }
      if (PROJ[p.type].update(p, dt, api)) keep.push(p);
    }
    this.projs = keep.concat(this.projs);
  }

  // 플레이어의 공격 적중 처리 (방장 권한)
  hit(id, dmg, fromX, dir, by) {
    const e = this.enemies.find((q) => q.id === id);
    if (!e || e.dead) return null;
    const def = DEFS[e.kind];
    if (def.boss && e.st === 'intro') return 'block';
    if (def.blocks && def.blocks(e, fromX, dir)) {
      if (def.onBlock) def.onBlock(e);
      return 'block';
    }
    e.hp -= dmg;
    e.fl = 0.09;
    if (!def.boss && !def.static) {
      const kd = Math.sign(cx(e) - fromX) || 1;
      if (dir === 'down' && def.fly) e.vy = 260;
      else if (dir === 'up' && def.fly) e.vy = -260;
      else {
        e.vx = kd * (def.elite ? 120 : 260);
        if (def.fly) e.vy = -60;
      }
      e.kb = def.elite ? 0.06 : 0.14;
    }
    if (e.hp <= 0) {
      e.dead = true;
      this.g.onEnemyKilled(e, by);
      return 'kill';
    }
    return 'hit';
  }

  killRoom(roomId, exceptBoss = false) {
    for (const e of this.enemies) if (e.room === roomId && !(exceptBoss && DEFS[e.kind].boss)) e.dead = true;
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projs = this.projs.filter((p) => p.room !== roomId);
  }
  clearProjs(roomId) {
    this.projs = this.projs.filter((p) => p.room !== roomId);
  }

  // ───── 스냅샷 ─────
  snapshot() {
    const E = [];
    for (const e of this.enemies) {
      E.push([e.id, KINDS.indexOf(e.kind), Math.round(e.x), Math.round(e.y), e.facing, e.st, Math.round(e.t * 100) / 100,
        Math.ceil(e.hp), e.fl > 0 ? 1 : 0, e.ex, e.room, Math.round(e.vx), Math.round(e.vy), e.maxHp]);
    }
    const P = [];
    for (const p of this.projs) {
      P.push([p.id, PTYPES.indexOf(p.type), Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), Math.round(p.t * 100) / 100, p.life, p.ex, p.room]);
    }
    return { e: E, p: P };
  }

  applySnapshot(s) {
    const seen = new Set();
    for (const a of s.e) {
      const [id, k, x, y, f, st, t, hp, fl, ex, room, vx, vy, mh] = a;
      seen.add(id);
      let v = this.views.get(id);
      const kind = KINDS[k];
      if (!v) {
        const d = DEFS[kind];
        v = { id, kind, w: d.w, h: d.h, x, y, tx: x, ty: y };
        this.views.set(id, v);
      }
      v.tx = x; v.ty = y; v.vx = vx; v.vy = vy;
      v.facing = f;
      if (v.st !== st || Math.abs(v.t - t) > 0.15) v.t = t;
      v.st = st;
      v.hp = hp; v.maxHp = mh;
      if (fl) v.fl = 0.09;
      v.ex = ex; v.room = room;
    }
    for (const id of this.views.keys()) if (!seen.has(id)) this.views.delete(id);
    const pseen = new Set();
    for (const a of s.p) {
      const [id, ty, x, y, vx, vy, t, life, ex, room] = a;
      pseen.add(id);
      let v = this.pviews.get(id);
      if (!v) {
        v = { id, type: PTYPES[ty], x, y };
        this.pviews.set(id, v);
      }
      v.sx = x; v.sy = y; v.vx = vx; v.vy = vy; v.life = life; v.ex = ex; v.room = room;
      if (v.t == null || Math.abs(v.t - t) > 0.1) v.t = t;
    }
    for (const id of this.pviews.keys()) if (!pseen.has(id)) this.pviews.delete(id);
  }

  updateClient(dt) {
    const k = Math.min(1, dt * 14);
    for (const v of this.views.values()) {
      v.tx += (v.vx || 0) * dt;
      v.ty += (v.vy || 0) * dt * 0.5;
      v.x += (v.tx - v.x) * k;
      v.y += (v.ty - v.y) * k;
      v.t += dt;
      if (v.fl > 0) v.fl -= dt;
    }
    for (const v of this.pviews.values()) {
      v.t += dt;
      if (v.type === 'loop') v.vx -= Math.sign(v.ex.d || v.vx || 1) * 950 * dt;
      v.sx += v.vx * dt;
      v.sy += v.vy * dt;
      if (v.type === 'shard' || v.type === 'lantern' || v.type === 'wax') v.vy += (v.ex.grav || 1400) * dt;
      v.x += (v.sx - v.x) * Math.min(1, dt * 20);
      v.y += (v.sy - v.y) * Math.min(1, dt * 20);
    }
  }
}

export { KINDS };
