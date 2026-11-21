// 지형 렌더러: 16x16 타일 청크 단위로 Path2D를 캐시해 매 프레임 빠르게 그림
import { TILE, mulberry32 } from '../core/util.js';
import { T_SOLID, T_PLAT, T_SPIKE, T_LIQUID, T_BREAK, T_GATE, isSolidT } from '../world/tiles.js';

const CH = 16;

export class TerrainRenderer {
  constructor(world) {
    this.world = world;
    this.chunks = new Map();
    world.dirty = new Set();
  }

  _chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (!c || this.world.dirty.has(key)) {
      this.world.dirty.delete(key);
      c = this._build(cx, cy);
      this.chunks.set(key, c);
    }
    return c;
  }

  _build(cx, cy) {
    const w = this.world;
    const solid = new Path2D();
    const rim = new Path2D();
    const rimSide = new Path2D();
    const crack = new Path2D();
    const plat = new Path2D();
    const platRim = new Path2D();
    const spikes = new Path2D();
    const spikeTips = new Path2D();
    const liquids = [];
    let hasSolid = false;
    const tx0 = cx * CH, ty0 = cy * CH;
    const S = (i, j) => isSolidT(w.get(i, j)) && w.get(i, j) === T_SOLID;
    for (let j = ty0; j < ty0 + CH; j++) {
      // 고체 가로 런 병합
      let run = -1;
      for (let i = tx0; i <= tx0 + CH; i++) {
        const t = i < tx0 + CH ? w.get(i, j) : -1;
        if (t === T_SOLID) {
          if (run < 0) run = i;
        } else if (run >= 0) {
          solid.rect(run * TILE - 0.6, j * TILE - 0.6, (i - run) * TILE + 1.2, TILE + 1.2);
          hasSolid = true;
          run = -1;
        }
      }
      for (let i = tx0; i < tx0 + CH; i++) {
        const t = w.get(i, j);
        const x = i * TILE, y = j * TILE;
        const rnd = mulberry32(i * 7919 + j * 104729);
        if (t === T_SOLID) {
          const up = !isSolidT(w.get(i, j - 1)) && w.get(i, j - 1) !== T_GATE;
          const dn = !isSolidT(w.get(i, j + 1));
          const lf = !isSolidT(w.get(i - 1, j));
          const rt = !isSolidT(w.get(i + 1, j));
          if (up) {
            // 울퉁불퉁한 윗면 + 풀/뿌리 술
            solid.moveTo(x, y + 1);
            let px = x;
            while (px < x + TILE) {
              const nx = Math.min(x + TILE, px + 5 + rnd() * 7);
              solid.lineTo((px + nx) / 2, y - rnd() * 4);
              solid.lineTo(nx, y + 1);
              px = nx;
            }
            solid.closePath();
            rim.rect(x, y - 1, TILE, 2.4);
            if (rnd() < 0.5) {
              const gx = x + rnd() * TILE;
              const h = 4 + rnd() * 9;
              rim.moveTo(gx - 1.5, y);
              rim.lineTo(gx + (rnd() - 0.5) * 6, y - h);
              rim.lineTo(gx + 1.5, y);
              rim.closePath();
            }
            if (rnd() < 0.35) {
              const gx = x + rnd() * TILE;
              const h = 3 + rnd() * 6;
              rim.moveTo(gx - 1, y);
              rim.lineTo(gx + (rnd() - 0.5) * 5, y - h);
              rim.lineTo(gx + 1, y);
              rim.closePath();
            }
          }
          if (dn) {
            // 천장 – 매달린 종유석/뿌리
            solid.moveTo(x, y + TILE - 1);
            let px = x;
            while (px < x + TILE) {
              const nx = Math.min(x + TILE, px + 6 + rnd() * 8);
              solid.lineTo((px + nx) / 2, y + TILE + rnd() * 5);
              solid.lineTo(nx, y + TILE - 1);
              px = nx;
            }
            solid.closePath();
            if (rnd() < 0.22) {
              const gx = x + 6 + rnd() * (TILE - 12);
              const h = 10 + rnd() * 22;
              solid.moveTo(gx - 4, y + TILE);
              solid.lineTo(gx, y + TILE + h);
              solid.lineTo(gx + 4, y + TILE);
              solid.closePath();
            }
            rimSide.rect(x, y + TILE - 1.5, TILE, 1.5);
          }
          if (lf) {
            solid.moveTo(x + 1, y);
            let py = y;
            while (py < y + TILE) {
              const ny = Math.min(y + TILE, py + 6 + rnd() * 8);
              solid.lineTo(x - rnd() * 4, (py + ny) / 2);
              solid.lineTo(x + 1, ny);
              py = ny;
            }
            solid.closePath();
            rimSide.rect(x - 1, y, 1.6, TILE);
          }
          if (rt) {
            solid.moveTo(x + TILE - 1, y);
            let py = y;
            while (py < y + TILE) {
              const ny = Math.min(y + TILE, py + 6 + rnd() * 8);
              solid.lineTo(x + TILE + rnd() * 4, (py + ny) / 2);
              solid.lineTo(x + TILE - 1, ny);
              py = ny;
            }
            solid.closePath();
            rimSide.rect(x + TILE - 0.6, y, 1.6, TILE);
          }
          // 표면 근처 금/결
          const near = up || dn || lf || rt || !S(i, j - 2) || !S(i, j + 2) || !S(i - 2, j) || !S(i + 2, j);
          if (near && rnd() < 0.45) {
            const sx = x + rnd() * TILE, sy = y + rnd() * TILE;
            crack.moveTo(sx, sy);
            crack.lineTo(sx + (rnd() - 0.5) * 18, sy + (rnd() - 0.5) * 18);
            crack.lineTo(sx + (rnd() - 0.5) * 26, sy + (rnd() - 0.5) * 26);
          }
        } else if (t === T_PLAT) {
          const l = w.get(i - 1, j) === T_PLAT || isSolidT(w.get(i - 1, j));
          const r = w.get(i + 1, j) === T_PLAT || isSolidT(w.get(i + 1, j));
          plat.rect(x, y, TILE, 9);
          plat.moveTo(x, y + 9);
          plat.lineTo(x + TILE * 0.5, y + 13 + rnd() * 4);
          plat.lineTo(x + TILE, y + 9);
          plat.closePath();
          if (!l) {
            plat.moveTo(x + 2, y + 9);
            plat.lineTo(x + 7, y + 26 + rnd() * 10);
            plat.lineTo(x + 11, y + 9);
            plat.closePath();
          }
          if (!r) {
            plat.moveTo(x + TILE - 11, y + 9);
            plat.lineTo(x + TILE - 7, y + 26 + rnd() * 10);
            plat.lineTo(x + TILE - 2, y + 9);
            plat.closePath();
          }
          platRim.rect(x, y - 1, TILE, 2);
          hasSolid = true;
        } else if (t === T_SPIKE) {
          const n = 3;
          for (let k = 0; k < n; k++) {
            const bx = x + (k * TILE) / n;
            const bw = TILE / n;
            const h = 18 + rnd() * 10;
            spikes.moveTo(bx, y + TILE + 1);
            spikes.lineTo(bx + bw * 0.5 + (rnd() - 0.5) * 3, y + TILE - h);
            spikes.lineTo(bx + bw, y + TILE + 1);
            spikes.closePath();
            spikeTips.moveTo(bx + bw * 0.5 - 1.2, y + TILE - h + 7);
            spikeTips.lineTo(bx + bw * 0.5, y + TILE - h);
            spikeTips.lineTo(bx + bw * 0.5 + 1.2, y + TILE - h + 7);
            spikeTips.closePath();
          }
          hasSolid = true;
        } else if (t === T_LIQUID) {
          const top = w.get(i, j - 1) !== T_LIQUID;
          liquids.push({ x, y, top });
        }
      }
    }
    return { solid, rim, rimSide, crack, plat, platRim, spikes, spikeTips, liquids, hasSolid };
  }

  draw(ctx, view, pal, time) {
    const cx0 = Math.floor(view.x0 / TILE / CH), cx1 = Math.floor(view.x1 / TILE / CH);
    const cy0 = Math.floor(view.y0 / TILE / CH), cy1 = Math.floor(view.y1 / TILE / CH);
    const list = [];
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0 || cx * CH >= this.world.W || cy * CH >= this.world.H) continue;
        list.push(this._chunk(cx, cy));
      }
    // 액체 (뒤쪽) – 타일 경계에서도 이어지는 물결
    const [lr, lg, lb] = pal.liquid;
    const wave = (x) => Math.sin(time * 2.2 + x * 0.05) * 2.5 + Math.sin(time * 3.7 + x * 0.11) * 1.5;
    const body = `rgba(${lr},${lg},${lb},0.5)`;
    const deep = `rgba(${lr * 0.5 | 0},${lg * 0.5 | 0},${lb * 0.5 | 0},0.8)`;
    const top = `rgba(${Math.min(255, lr + 120)},${Math.min(255, lg + 60)},${Math.min(255, lb + 60)},0.9)`;
    for (const c of list) {
      for (const L of c.liquids) {
        if (L.top) {
          const w0 = wave(L.x), w1 = wave(L.x + TILE);
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(L.x, L.y + 8 + w0);
          ctx.lineTo(L.x + TILE + 0.5, L.y + 8 + w1);
          ctx.lineTo(L.x + TILE + 0.5, L.y + TILE + 0.5);
          ctx.lineTo(L.x, L.y + TILE + 0.5);
          ctx.fill();
          ctx.strokeStyle = top;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(L.x, L.y + 8 + w0);
          ctx.lineTo(L.x + TILE + 0.5, L.y + 8 + w1);
          ctx.stroke();
        } else {
          ctx.fillStyle = deep;
          ctx.fillRect(L.x, L.y, TILE + 0.5, TILE + 0.5);
        }
      }
    }
    ctx.fillStyle = pal.solid2;
    for (const c of list) if (c.hasSolid) ctx.fill(c.plat);
    ctx.fillStyle = pal.rim;
    for (const c of list) if (c.hasSolid) ctx.fill(c.platRim);
    ctx.fillStyle = pal.solid;
    for (const c of list) if (c.hasSolid) ctx.fill(c.solid);
    ctx.strokeStyle = pal.crack;
    ctx.lineWidth = 1.4;
    for (const c of list) if (c.hasSolid) ctx.stroke(c.crack);
    ctx.fillStyle = pal.rimDim;
    for (const c of list) if (c.hasSolid) ctx.fill(c.rimSide);
    ctx.fillStyle = pal.rim;
    for (const c of list) if (c.hasSolid) ctx.fill(c.rim);
    ctx.fillStyle = pal.solid;
    for (const c of list) if (c.hasSolid) ctx.fill(c.spikes);
    ctx.fillStyle = 'rgba(230,225,210,0.75)';
    for (const c of list) if (c.hasSolid) ctx.fill(c.spikeTips);
  }

  // 부서지는 벽, 보스 문 (동적)
  drawDynamic(ctx, view, pal, time, shakeIds) {
    const w = this.world;
    for (const b of w.breakables) {
      if (b.broken) continue;
      const x = b.x * TILE, y = b.y * TILE, bw = b.w * TILE, bh = b.h * TILE;
      if (x > view.x1 || x + bw < view.x0 || y > view.y1 || y + bh < view.y0) continue;
      const sh = shakeIds && shakeIds[b.id] > 0 ? (Math.random() - 0.5) * 6 : 0;
      ctx.fillStyle = pal.solid2;
      ctx.fillRect(x + sh, y, bw, bh);
      ctx.strokeStyle = pal.rimDim;
      ctx.lineWidth = 2;
      const rnd = mulberry32(b.x * 31 + b.y);
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const sx = x + sh + rnd() * bw, sy = y + rnd() * bh;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rnd() - 0.5) * 30, sy + (rnd() - 0.5) * 30);
      }
      ctx.stroke();
      const dmg = 1 - b.hp / b.maxHp;
      if (dmg > 0) {
        ctx.strokeStyle = pal.rim;
        ctx.beginPath();
        for (let k = 0; k < dmg * 8; k++) {
          const sx = x + sh + rnd() * bw, sy = y + rnd() * bh;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (rnd() - 0.5) * 40, sy + (rnd() - 0.5) * 40);
        }
        ctx.stroke();
      }
    }
    // 게이트: 타일이 T_GATE인 열을 찾아 그림
    const tx0 = Math.max(0, Math.floor(view.x0 / TILE)), tx1 = Math.min(w.W - 1, Math.floor(view.x1 / TILE));
    const ty0 = Math.max(0, Math.floor(view.y0 / TILE)), ty1 = Math.min(w.H - 1, Math.floor(view.y1 / TILE));
    for (let j = ty0; j <= ty1; j++)
      for (let i = tx0; i <= tx1; i++) {
        if (w.tiles[j * w.W + i] !== T_GATE) continue;
        const x = i * TILE, y = j * TILE;
        ctx.fillStyle = '#0c0a08';
        ctx.fillRect(x + 4, y, TILE - 8, TILE);
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 4 + j);
        ctx.fillRect(x + 8, y, 3, TILE);
        ctx.fillRect(x + TILE - 11, y, 3, TILE);
        ctx.globalAlpha = 1;
        if (w.get(i, j + 1) !== T_GATE) {
          ctx.fillStyle = '#1a1510';
          ctx.beginPath();
          ctx.moveTo(x + 2, y + TILE);
          ctx.lineTo(x + TILE / 2, y + TILE + 10);
          ctx.lineTo(x + TILE - 2, y + TILE);
          ctx.fill();
        }
      }
  }
}
