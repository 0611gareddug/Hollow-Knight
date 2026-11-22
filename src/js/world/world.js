// 월드: 방 정의를 전역 타일맵으로 조립하고 충돌 질의를 제공
import { TILE } from '../core/util.js';
import { T_EMPTY, T_SOLID, T_PLAT, T_SPIKE, T_LIQUID, T_BREAK, T_GATE, isSolidT } from './tiles.js';

class RoomBuilder {
  constructor(world, def) {
    this.w = world;
    this.r = def;
  }
  _set(x, y, t) {
    this.w.setLocal(this.r, x, y, t);
  }
  _rect(x, y, w, h, t) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this._set(i, j, t);
    return this;
  }
  solid(x, y, w, h) { return this._rect(x, y, w, h, T_SOLID); }
  empty(x, y, w, h) { return this._rect(x, y, w, h, T_EMPTY); }
  plat(x, y, w) { return this._rect(x, y, w, 1, T_PLAT); }
  spike(x, y, w) { return this._rect(x, y, w, 1, T_SPIKE); }
  liquid(x, y, w, h = 1) { return this._rect(x, y, w, h, T_LIQUID); }
  brk(id, x, y, w, h, hp = 3) {
    this._rect(x, y, w, h, T_BREAK);
    this.w.breakables.push({ id, room: this.r.id, x: this.r.x + x, y: this.r.y + y, w, h, hp, maxHp: hp });
    return this;
  }
  _obj(type, x, y, extra = {}) {
    const o = Object.assign({ type, room: this.r.id, x: (this.r.x + x + 0.5) * TILE, y: (this.r.y + y + 1) * TILE }, extra);
    this.w.objects.push(o);
    return o;
  }
  e(kind, x, y, extra = {}) {
    const o = Object.assign({ kind, room: this.r.id, x: (this.r.x + x + 0.5) * TILE, y: (this.r.y + y + 1) * TILE }, extra);
    this.r.enemies.push(o);
    return this;
  }
  bench(x, y) { this._obj('bench', x, y); return this; }
  shop(x, y) { this._obj('shop', x, y); return this; }
  lamp(x, y, s = 1) { this._obj('lamp', x, y, { s }); return this; }
  sign(x, y, text, req) { this._obj('sign', x, y, { text, req }); return this; }
  pickup(kind, x, y, id, amount = 0) { this._obj('pickup', x, y, { kind, id, amount }); return this; }
  // 사슬 고리 (중심 좌표)
  anchor(x, y) {
    this.w.objects.push({ type: 'anchor', room: this.r.id, x: (this.r.x + x + 0.5) * TILE, y: (this.r.y + y + 0.5) * TILE });
    return this;
  }
  // 특정 보스를 잡기 전까지 닫혀 있는 봉인
  seal(x, y, w, h, req) {
    this.w.seals.push({ x: this.r.x + x, y: this.r.y + y, w, h, req });
    return this;
  }
  shrine(ability, x, y) { this._obj('shrine', x, y, { ability, id: 'shrine_' + ability }); return this; }
  pvpSpawn(x, y) {
    this.w.pvpSpawns.push({ x: (this.r.x + x + 0.5) * TILE, y: (this.r.y + y + 1) * TILE });
    return this;
  }
  spawn(x, y) { this.w.spawn = { x: (this.r.x + x + 0.5) * TILE, y: (this.r.y + y + 1) * TILE, room: this.r.id }; return this; }
  finish(x, y, w, h) {
    this.w.finish = { x: (this.r.x + x) * TILE, y: (this.r.y + y) * TILE, w: w * TILE, h: h * TILE };
    return this;
  }
  boss(kind, x, y, trigger, gates) {
    this.r.boss = {
      kind,
      x: (this.r.x + x + 0.5) * TILE,
      y: (this.r.y + y + 1) * TILE,
      trigger: trigger * TILE + this.r.x * TILE,
      gates: gates.map(([gx, gy, gw, gh]) => ({ x: this.r.x + gx, y: this.r.y + gy, w: gw, h: gh })),
    };
    return this;
  }
}

export class World {
  constructor(def) {
    this.rooms = [];
    this.roomById = {};
    this.objects = [];
    this.breakables = [];
    this.spawn = null;
    this.finish = null;
    this.seals = [];
    this.pvpSpawns = [];
    // 음수 좌표(위쪽 세계)를 쓰는 방이 있으면 전체를 아래로 밀어 0부터 시작하게 함
    let minY = 0;
    for (const r of def.rooms) minY = Math.min(minY, r.y);
    this.oy = -minY;
    const rooms = def.rooms.map((r) => Object.assign({}, r, { y: r.y + this.oy }));
    def = Object.assign({}, def, { doors: (def.doors || []).map(([d, x, y, len]) => [d, x, y + this.oy, len]) });
    let W = 0, H = 0;
    for (const r of rooms) {
      W = Math.max(W, r.x + r.w);
      H = Math.max(H, r.y + r.h);
    }
    this.W = W;
    this.H = H;
    this.tiles = new Uint8Array(W * H).fill(T_SOLID);
    this.roomMap = new Int16Array(W * H).fill(-1);
    rooms.forEach((rd, idx) => {
      const r = Object.assign({ enemies: [], idx, boss: null, dark: 0.55 }, rd);
      r.px = r.x * TILE;
      r.py = r.y * TILE;
      r.pw = r.w * TILE;
      r.ph = r.h * TILE;
      this.rooms.push(r);
      this.roomById[r.id] = r;
      for (let j = r.y; j < r.y + r.h; j++)
        for (let i = r.x; i < r.x + r.w; i++) {
          this.roomMap[j * W + i] = idx;
          const border = i === r.x || j === r.y || i === r.x + r.w - 1 || j === r.y + r.h - 1;
          this.tiles[j * W + i] = border ? T_SOLID : T_EMPTY;
        }
    });
    rooms.forEach((rd, idx) => {
      if (rd.build) rd.build(new RoomBuilder(this, this.rooms[idx]));
    });
    for (const d of def.doors || []) this.carveDoor(d);
    this.version = 1; // 타일이 바뀌면 증가 (렌더 캐시 갱신용)
  }

  setLocal(r, x, y, t) {
    const gx = r.x + x, gy = r.y + y;
    if (gx < 0 || gy < 0 || gx >= this.W || gy >= this.H) return;
    this.tiles[gy * this.W + gx] = t;
  }

  carveDoor([dir, x, y, len]) {
    for (let k = 0; k < len; k++) {
      if (dir === 'v') {
        this.set(x - 1, y + k, T_EMPTY);
        this.set(x, y + k, T_EMPTY);
      } else {
        this.set(x + k, y - 1, T_EMPTY);
        this.set(x + k, y, T_EMPTY);
      }
    }
  }

  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return T_SOLID;
    return this.tiles[ty * this.W + tx];
  }
  set(tx, ty, t) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return;
    if (this.tiles[ty * this.W + tx] === t) return;
    this.tiles[ty * this.W + tx] = t;
    this.version++;
    if (this.dirty) this.dirty.add((tx >> 4) + ',' + (ty >> 4));
  }

  solidAt(px, py) {
    return isSolidT(this.get(Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  roomAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return null;
    const i = this.roomMap[ty * this.W + tx];
    return i >= 0 ? this.rooms[i] : null;
  }

  // 사각형이 고체와 겹치는지
  rectSolid(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (isSolidT(this.get(i, j))) return true;
    return false;
  }

  // 사각형이 특정 타일 종류와 겹치는지 (가시는 아래쪽 절반만 판정)
  rectHazard(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const t = this.get(i, j);
        if (t === T_SPIKE) {
          if (y + h > j * TILE + TILE * 0.45 && x + w > i * TILE + 4 && x < (i + 1) * TILE - 4) return 'spike';
        } else if (t === T_LIQUID) {
          if (y + h > j * TILE + 10) return 'liquid';
        }
      }
    return null;
  }

  // 축 분리 이동 + 충돌. 반환: {hitX, hitY, ground, ceil}
  moveBody(b, dx, dy, dropThrough = false) {
    const res = { hitX: 0, hitY: 0 };
    // X축
    if (dx !== 0) {
      const steps = Math.ceil(Math.abs(dx) / (TILE * 0.45));
      const sdx = dx / steps;
      for (let s = 0; s < steps; s++) {
        const nx = b.x + sdx;
        if (this.rectSolid(nx, b.y, b.w, b.h)) {
          if (sdx > 0) b.x = Math.floor((nx + b.w) / TILE) * TILE - b.w - 0.001;
          else b.x = Math.floor(nx / TILE + 1) * TILE + 0.001;
          res.hitX = Math.sign(sdx);
          break;
        }
        b.x = nx;
      }
    }
    // Y축
    if (dy !== 0) {
      const steps = Math.ceil(Math.abs(dy) / (TILE * 0.45));
      const sdy = dy / steps;
      for (let s = 0; s < steps; s++) {
        const ny = b.y + sdy;
        let blocked = this.rectSolid(b.x, ny, b.w, b.h);
        // 일방 발판: 아래로 이동 중이고 발이 발판 윗면을 넘어설 때
        if (!blocked && sdy > 0 && !dropThrough) {
          const footOld = b.y + b.h;
          const footNew = ny + b.h;
          const ty = Math.floor((footNew - 0.001) / TILE);
          if (footOld <= ty * TILE + 0.5) {
            const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.001) / TILE);
            for (let i = x0; i <= x1; i++)
              if (this.get(i, ty) === T_PLAT) {
                blocked = true;
                break;
              }
          }
        }
        if (blocked) {
          if (sdy > 0) b.y = Math.floor((ny + b.h) / TILE) * TILE - b.h - 0.001;
          else b.y = Math.floor(ny / TILE + 1) * TILE + 0.001;
          res.hitY = Math.sign(sdy);
          break;
        }
        b.y = ny;
      }
    }
    return res;
  }

  // 발 아래가 땅인지 (발판 포함)
  grounded(b) {
    const y = b.y + b.h + 1;
    const ty = Math.floor(y / TILE);
    const x0 = Math.floor((b.x + 1) / TILE), x1 = Math.floor((b.x + b.w - 1) / TILE);
    for (let i = x0; i <= x1; i++) {
      const t = this.get(i, ty);
      if (isSolidT(t)) return true;
      if (t === T_PLAT && b.y + b.h <= ty * TILE + 1.5) return true;
    }
    return false;
  }
  onPlatformOnly(b) {
    const ty = Math.floor((b.y + b.h + 1) / TILE);
    const x0 = Math.floor((b.x + 1) / TILE), x1 = Math.floor((b.x + b.w - 1) / TILE);
    let plat = false;
    for (let i = x0; i <= x1; i++) {
      const t = this.get(i, ty);
      if (isSolidT(t)) return false;
      if (t === T_PLAT) plat = true;
    }
    return plat;
  }

  // 시야(레이) 판정 – 적 AI 용
  lineClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  // 보스 문 열고 닫기
  setGates(gates, closed) {
    for (const g of gates)
      for (let j = g.y; j < g.y + g.h; j++)
        for (let i = g.x; i < g.x + g.w; i++) this.set(i, j, closed ? T_GATE : T_EMPTY);
  }

  breakWall(id) {
    const b = this.breakables.find((q) => q.id === id);
    if (!b || b.broken) return null;
    b.broken = true;
    for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) this.set(i, j, T_EMPTY);
    return b;
  }
}
