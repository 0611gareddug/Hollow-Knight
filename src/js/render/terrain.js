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
    const band1 = new Path2D(); // 윗면 아래 빛 번짐 (가까운 층)
    const band2 = new Path2D(); // 더 넓고 흐린 층
    const roots = new Path2D(); // 천장에서 늘어진 뿌리/덩굴 (선)
    const pebbles = new Path2D(); // 바닥 위 조약돌/풀덩이 (실루엣)
    const snow = new Path2D(); // 3장: 쌓인 눈 / 고드름
    const flowers = []; // 하늘 정원 꽃
    const glows = []; // 빛나는 장식 {x,y,r,c,ph,kind}
    let hasSolid = false;
    const zoneAt = (i, j) => {
      const k = w.roomMap[j * w.W + i];
      return k >= 0 ? w.rooms[k].zone : 1;
    };
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
            band1.rect(x, y + 1.4, TILE, 5);
            band2.rect(x, y + 6, TILE, 12);
            const zn = zoneAt(i, j - 1);
            // 바닥 장식
            if (rnd() < 0.16) {
              const px = x + 4 + rnd() * (TILE - 8);
              pebbles.ellipse(px, y - 1, 3 + rnd() * 4, 2 + rnd() * 2.5, 0, Math.PI, 0);
            }
            if (zn === 2 && rnd() < 0.28) glows.push({ x: x + rnd() * TILE, y: y - 2 - rnd() * 4, r: 1.6 + rnd() * 1.4, c: '120,255,220', ph: rnd() * 6, kind: 'dot' });
            if (zn === 1 && rnd() < 0.08) glows.push({ x: x + rnd() * TILE, y: y - 1, r: 1.4, c: '255,170,80', ph: rnd() * 6, kind: 'dot' });
            if (zn === 3 && rnd() < 0.1) glows.push({ x: x + 6 + rnd() * (TILE - 12), y: y, r: 4 + rnd() * 4, c: '190,140,255', ph: rnd() * 6, kind: 'crystal' });
            if (zn === 6 && rnd() < 0.3) flowers.push({ x: x + rnd() * TILE, y: y - 1, c: rnd() < 0.5 ? '#f4f0ff' : '#ffc6d9', h: 4 + rnd() * 6 });
            if (zn >= 8) {
              // 쌓인 눈: 둥근 둔덕
              snow.moveTo(x - 0.5, y + 2);
              const h1 = 3 + rnd() * 3, h2 = 3 + rnd() * 3;
              snow.bezierCurveTo(x + 6, y - h1, x + TILE * 0.5, y - h2 - 1, x + TILE * 0.55, y - h2);
              snow.bezierCurveTo(x + TILE * 0.7, y - h2, x + TILE - 4, y - h1, x + TILE + 0.5, y + 2);
              snow.closePath();
              if (zn === 9 && rnd() < 0.1) glows.push({ x: x + 6 + rnd() * (TILE - 12), y: y - 2, r: 3 + rnd() * 3, c: '170,240,255', ph: rnd() * 6, kind: 'crystal' });
            }
            if (zn === 7 && rnd() < 0.12) glows.push({ x: x + rnd() * TILE, y: y + 4 + rnd() * 12, r: 2, c: '255,110,50', ph: rnd() * 6, kind: 'crack' });
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
            // 늘어진 뿌리/덩굴 (구역마다 길이 다름)
            const zn2 = zoneAt(i, j + 1);
            if (zn2 >= 8 && rnd() < 0.4) {
              // 고드름
              const gx = x + 3 + rnd() * (TILE - 6), h = 8 + rnd() * 20;
              snow.moveTo(gx - 3, y + TILE);
              snow.lineTo(gx, y + TILE + h);
              snow.lineTo(gx + 3, y + TILE);
              snow.closePath();
            }
            if (zn2 < 8 && rnd() < (zn2 === 2 || zn2 === 6 ? 0.32 : zn2 === 5 ? 0.05 : 0.18)) {
              const rx = x + 4 + rnd() * (TILE - 8);
              const len = 14 + rnd() * (zn2 === 2 ? 70 : 40);
              const sway = (rnd() - 0.5) * 16;
              roots.moveTo(rx, y + TILE);
              roots.bezierCurveTo(rx + sway, y + TILE + len * 0.4, rx - sway, y + TILE + len * 0.7, rx + sway * 0.5, y + TILE + len);
              if (zn2 === 2 && rnd() < 0.5) glows.push({ x: rx + sway * 0.5, y: y + TILE + len, r: 2.2, c: '120,255,220', ph: rnd() * 6, kind: 'dot' });
              if (zn2 === 6 && rnd() < 0.4) flowers.push({ x: rx + sway * 0.5, y: y + TILE + len + 2, c: '#f4f0ff', h: -3 });
            }
          }
          if ((lf || rt) && zoneAt(i, j) === 5 && rnd() < 0.18) glows.push({ x: lf ? x + 4 : x + TILE - 4, y: y + 6 + rnd() * 20, r: 1.6, c: '160,140,110', ph: 0, kind: 'rivet' });
          if ((lf || rt) && zoneAt(i, j) === 7 && rnd() < 0.15) glows.push({ x: lf ? x + 3 : x + TILE - 3, y: y + rnd() * TILE, r: 2, c: '255,110,50', ph: rnd() * 6, kind: 'crack' });
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
    return { solid, rim, rimSide, crack, plat, platRim, spikes, spikeTips, liquids, hasSolid, band1, band2, roots, pebbles, flowers, glows, snow };
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
    // 윗면 아래 은은한 빛 번짐 → 입체감
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = pal.rimDim;
    for (const c of list) if (c.hasSolid) ctx.fill(c.band1);
    ctx.globalAlpha = 0.12;
    for (const c of list) if (c.hasSolid) ctx.fill(c.band2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.rim;
    for (const c of list) if (c.hasSolid) ctx.fill(c.rim);
    // 장식: 뿌리/덩굴, 조약돌, 꽃
    ctx.strokeStyle = pal.solid;
    ctx.lineWidth = 2;
    for (const c of list) if (c.hasSolid) ctx.stroke(c.roots);
    ctx.fillStyle = pal.solid;
    for (const c of list) if (c.hasSolid) ctx.fill(c.pebbles);
    ctx.fillStyle = 'rgba(232,242,252,0.92)';
    for (const c of list) if (c.hasSolid && c.snow) ctx.fill(c.snow);
    for (const c of list)
      for (const f of c.flowers) {
        ctx.strokeStyle = pal.solid2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + Math.sin(time * 2 + f.x) * 1.2, f.y - f.h);
        ctx.stroke();
        ctx.fillStyle = f.c;
        ctx.fillRect(f.x - 1.5 + Math.sin(time * 2 + f.x) * 1.2, f.y - f.h - 1.5, 3, 3);
      }
    // 빛나는 장식 (이끼 점, 수정, 불씨 균열, 리벳)
    for (const c of list)
      for (const g of c.glows) {
        if (g.kind === 'rivet') {
          ctx.fillStyle = `rgb(${g.c})`;
          ctx.fillRect(g.x - 1.2, g.y - 1.2, 2.4, 2.4);
          continue;
        }
        const a = 0.55 + 0.45 * Math.sin(time * 1.8 + g.ph);
        if (g.kind === 'crystal') {
          ctx.fillStyle = `rgba(${g.c},${0.55 + a * 0.35})`;
          ctx.beginPath();
          ctx.moveTo(g.x - g.r * 0.5, g.y);
          ctx.lineTo(g.x - g.r * 0.2, g.y - g.r * 2.2);
          ctx.lineTo(g.x + g.r * 0.4, g.y - g.r * 1.4);
          ctx.lineTo(g.x + g.r * 0.6, g.y);
          ctx.fill();
          ctx.fillStyle = `rgba(${g.c},${0.12 * a})`;
          ctx.beginPath();
          ctx.arc(g.x, g.y - g.r, g.r * 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (g.kind === 'crack') {
          ctx.strokeStyle = `rgba(${g.c},${0.35 + a * 0.5})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(g.x, g.y);
          ctx.lineTo(g.x + 3, g.y + 6);
          ctx.lineTo(g.x - 1, g.y + 11);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${g.c},${0.15 * a})`;
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${g.c},${0.6 + 0.4 * a})`;
          ctx.fillRect(g.x - g.r / 2, g.y - g.r / 2, g.r, g.r);
        }
      }
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
      if (b.slamOnly) {
        // 내려찍기로만 부서지는 얼음 덮개: 금 간 얼음 + 아래 화살표 문양
        const g = ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, '#d8eefa');
        g.addColorStop(1, '#6f97b2');
        ctx.fillStyle = g;
        ctx.fillRect(x + sh, y, bw, bh);
        ctx.strokeStyle = 'rgba(40,70,95,0.7)';
        ctx.lineWidth = 1.5;
        const rr = mulberry32(b.x * 17 + b.y * 3);
        ctx.beginPath();
        for (let k = 0; k < 9; k++) {
          const sx = x + sh + rr() * bw, sy = y + rr() * bh;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (rr() - 0.5) * 26, sy + rr() * 18);
        }
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(time * 3)})`;
        for (let k = 0; k < b.w; k += 2) {
          const ax = x + sh + (k + Math.min(1, b.w - k) / 2) * TILE;
          ctx.beginPath();
          ctx.moveTo(ax - 8, y + 10);
          ctx.lineTo(ax + 8, y + 10);
          ctx.lineTo(ax, y + 22);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(x + sh, y, bw, 3);
        continue;
      }
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
    this._drawGimmicks(ctx, view, pal, time);
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

  // 3장 기믹: 바람/물살, 무너지는 얼음, 움직이는 발판
  _drawGimmicks(ctx, view, pal, time) {
    const w = this.world;
    const vis = (x, y, ww, hh) => !(x > view.x1 || x + ww < view.x0 || y > view.y1 || y + hh < view.y0);
    for (const f of w.fields) {
      if (!vis(f.x, f.y, f.w, f.h)) continue;
      if (f.kind === 'wind' && !f.fy) {
        // 옆바람: 가로로 흐르는 흰 줄
        const dir = Math.sign(f.fx) || 1;
        ctx.fillStyle = 'rgba(220,235,255,0.06)';
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.strokeStyle = 'rgba(235,245,255,0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let j = 0; j < f.h / 12; j++) {
          const yy = f.y + 6 + j * 12 + Math.sin(time * 3 + j) * 2;
          const off = ((time * 420 * dir + j * 71) % 140 + 140) % 140;
          for (let xx = f.x - 140 + off; xx < f.x + f.w; xx += 140) {
            const a = Math.max(f.x, xx), b = Math.min(f.x + f.w, xx + 46);
            if (b > a) { ctx.moveTo(a, yy); ctx.lineTo(b, yy); }
          }
        }
        ctx.stroke();
        continue;
      }
      if (f.kind === 'stream') {
        // 물살: 반투명 물 + 흐르는 줄무늬
        const g = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
        g.addColorStop(0, 'rgba(120,190,230,0.10)');
        g.addColorStop(1, 'rgba(60,130,190,0.32)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.strokeStyle = 'rgba(220,245,255,0.45)';
        ctx.lineWidth = 1.5;
        const dir = Math.sign(f.fx) || 1;
        ctx.beginPath();
        for (let j = 0; j < f.h / 14; j++) {
          const yy = f.y + 7 + j * 14;
          const off = ((time * 160 * dir + j * 53) % 90 + 90) % 90;
          for (let xx = f.x - 90 + off; xx < f.x + f.w; xx += 90) {
            const a = Math.max(f.x, xx), b = Math.min(f.x + f.w, xx + 34);
            if (b > a) {
              ctx.moveTo(a, yy);
              ctx.lineTo(b, yy);
            }
          }
        }
        ctx.stroke();
      } else {
        // 상승 기류: 옅은 기둥 + 위로 흐르는 눈송이 선
        const up = f.fy < 0;
        const g = ctx.createLinearGradient(f.x, 0, f.x + f.w, 0);
        g.addColorStop(0, 'rgba(200,235,255,0)');
        g.addColorStop(0.5, 'rgba(200,235,255,0.10)');
        g.addColorStop(1, 'rgba(200,235,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.strokeStyle = 'rgba(235,248,255,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const n = Math.ceil(f.w / 18);
        for (let i = 0; i < n; i++) {
          const xx = f.x + 9 + i * 18 + Math.sin(time * 2 + i) * 4;
          for (let k = 0; k < 3; k++) {
            const sp = up ? -1 : 1;
            const ph = ((time * 260 + i * 97 + k * (f.h / 3)) % f.h + f.h) % f.h;
            const yy = sp < 0 ? f.y + f.h - ph : f.y + ph;
            ctx.moveTo(xx, yy);
            ctx.lineTo(xx, yy + 16 * -sp);
          }
        }
        ctx.stroke();
      }
    }
    for (const c of w.crumbles) {
      if (c.st === 'gone') {
        // 다시 얼어붙는 중: 희미한 윤곽
        const k = Math.min(1, c.t / 3);
        ctx.strokeStyle = `rgba(200,235,255,${0.15 + k * 0.35})`;
        ctx.setLineDash([4, 5]);
        ctx.strokeRect(c.x * TILE + 1, c.y * TILE + 1, c.w * TILE - 2, TILE * 0.55);
        ctx.setLineDash([]);
        continue;
      }
      const x = c.x * TILE, y = c.y * TILE, cw = c.w * TILE;
      if (!vis(x, y, cw, TILE)) continue;
      const sh = c.st === 'shake' ? (Math.random() - 0.5) * (2 + c.t * 8) : 0;
      const g = ctx.createLinearGradient(0, y, 0, y + TILE);
      g.addColorStop(0, '#e6f6ff');
      g.addColorStop(0.5, '#9cc6e0');
      g.addColorStop(1, 'rgba(80,130,170,0.4)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + sh, y);
      ctx.lineTo(x + cw + sh, y);
      ctx.lineTo(x + cw + sh - 4, y + TILE * 0.55);
      for (let i = c.w * 2; i >= 0; i--) ctx.lineTo(x + sh + (i * cw) / (c.w * 2), y + TILE * (0.55 + (i % 2) * 0.35));
      ctx.lineTo(x + sh + 4, y + TILE * 0.55);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x + sh, y, cw, 2.5);
      ctx.strokeStyle = c.st === 'shake' ? 'rgba(30,60,90,0.9)' : 'rgba(60,100,130,0.45)';
      ctx.lineWidth = 1.2;
      const rr = mulberry32(c.x * 7 + c.y * 13);
      ctx.beginPath();
      const cracks = c.st === 'shake' ? 6 + Math.floor(c.t * 14) : 3;
      for (let k = 0; k < cracks; k++) {
        const sx = x + sh + rr() * cw;
        ctx.moveTo(sx, y + 2);
        ctx.lineTo(sx + (rr() - 0.5) * 14, y + TILE * 0.5);
      }
      ctx.stroke();
    }
    for (const m of w.movers) {
      if (!vis(m.x, m.y, m.w, 24)) continue;
      // 궤도 점선
      ctx.strokeStyle = 'rgba(200,225,240,0.12)';
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(m.ax + m.w / 2, m.ay + 8);
      ctx.lineTo(m.bx + m.w / 2, m.by + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      // 얼음 썰매 발판: 나무 판 + 얼음 테 + 아래 매단 등불
      ctx.fillStyle = '#3a2c22';
      ctx.fillRect(m.x, m.y + 2, m.w, 12);
      ctx.fillStyle = '#5a4434';
      for (let xx = m.x + 4; xx < m.x + m.w - 4; xx += 16) ctx.fillRect(xx, m.y + 4, 12, 3);
      ctx.fillStyle = '#d8f0ff';
      ctx.fillRect(m.x - 2, m.y, m.w + 4, 3);
      ctx.fillStyle = 'rgba(190,230,255,0.8)';
      for (let xx = m.x + 6; xx < m.x + m.w - 4; xx += 14) {
        ctx.beginPath();
        ctx.moveTo(xx, m.y + 14);
        ctx.lineTo(xx + 3, m.y + 22 + ((xx * 7) % 5));
        ctx.lineTo(xx + 6, m.y + 14);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,190,110,${0.7 + 0.2 * Math.sin(time * 5 + m.ax)})`;
      ctx.beginPath();
      ctx.arc(m.x + m.w / 2, m.y + 20, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
