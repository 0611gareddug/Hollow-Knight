// 투사체/장판 정의 (호스트가 시뮬레이션, 클라이언트는 보간 표시)
import { TILE, rand } from '../core/util.js';

const circRect = (x, y, r, b) => {
  const nx = Math.max(b.x, Math.min(x, b.x + b.w));
  const ny = Math.max(b.y, Math.min(y, b.y + b.h));
  return (nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r;
};
const rr = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function ceilY(world, x, y) {
  let yy = y - 8;
  while (yy > 0 && !world.solidAt(x, yy)) yy -= 8;
  return yy + 8;
}

export const PROJ = {
  thorn: {
    init() {},
    update(p, dt, S) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return !S.world.solidAt(p.x, p.y);
    },
    hit: (p, b) => circRect(p.x, p.y, 6, b),
    draw(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = '#1b2a1f';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-8, -3.5);
      ctx.lineTo(-8, 3.5);
      ctx.fill();
      ctx.fillStyle = '#e0505a';
      ctx.fillRect(5, -1, 5, 2);
      ctx.restore();
    },
  },
  orb: {
    light: 90, glow: 'amber',
    update(p, dt, S) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return !S.world.solidAt(p.x, p.y);
    },
    hit: (p, b) => circRect(p.x, p.y, 8, b),
    draw(ctx, p, time) {
      ctx.fillStyle = 'rgba(255,140,60,0.35)';
      ctx.beginPath();
      ctx.arc(p.x - p.vx * 0.03, p.y - p.vy * 0.03, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 + Math.sin(time * 30) * 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff1c8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  wave: {
    light: 60, glow: 'white',
    update(p, dt, S) {
      p.x += p.vx * dt;
      const W = S.world;
      if (W.solidAt(p.x + Math.sign(p.vx) * 10, p.y - 10)) return false;
      if (!W.solidAt(p.x, p.y + 6) && W.get(Math.floor(p.x / TILE), Math.floor((p.y + 6) / TILE)) !== 2) return false;
      return true;
    },
    hit: (p, b) => rr({ x: p.x - 13, y: p.y - (p.ex.big ? 42 : 28), w: 26, h: p.ex.big ? 42 : 28 }, b),
    draw(ctx, p, time) {
      const h = p.ex.big ? 42 : 28;
      const d = Math.sign(p.vx);
      ctx.fillStyle = 'rgba(230,240,235,0.85)';
      ctx.beginPath();
      ctx.moveTo(p.x - d * 16, p.y);
      ctx.quadraticCurveTo(p.x - d * 4, p.y - h * 1.1, p.x + d * 12, p.y);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,190,185,0.5)';
      ctx.beginPath();
      ctx.moveTo(p.x - d * 30, p.y);
      ctx.quadraticCurveTo(p.x - d * 18, p.y - h * 0.6, p.x - d * 6, p.y);
      ctx.fill();
    },
  },
  puddle: {
    update: () => true,
    hit: (p, b) => p.t > 0.1 && rr({ x: p.x - 30, y: p.y - 8, w: 60, h: 8 }, b),
    draw(ctx, p, time) {
      const a = Math.min(1, (p.life - p.t) * 2);
      ctx.fillStyle = `rgba(80,210,180,${0.75 * a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 2, 32, 5 + Math.sin(time * 6) * 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(180,255,230,${0.6 * a})`;
      for (let i = 0; i < 3; i++) {
        const bx = p.x - 20 + i * 18 + Math.sin(time * 3 + i) * 3;
        ctx.beginPath();
        ctx.arc(bx, p.y - 5 - ((time * 20 + i * 7) % 10), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  fire: {
    light: 100, glow: 'amber',
    update: () => true,
    hit: (p, b) => rr({ x: p.x - 14, y: p.y - 28, w: 28, h: 28 }, b),
    draw(ctx, p, time) {
      const a = Math.min(1, (p.life - p.t) * 3);
      for (let i = 0; i < 3; i++) {
        const fl = Math.sin(time * 20 + i * 2 + p.x) * 0.2 + 1;
        ctx.fillStyle = i === 2 ? `rgba(255,240,190,${a})` : i === 1 ? `rgba(255,170,60,${a})` : `rgba(230,80,40,${a * 0.8})`;
        const s = (3 - i) / 3;
        ctx.beginPath();
        ctx.moveTo(p.x - 13 * s, p.y);
        ctx.quadraticCurveTo(p.x - 12 * s, p.y - 18 * s * fl, p.x + (i - 1) * 2, p.y - 32 * s * fl);
        ctx.quadraticCurveTo(p.x + 12 * s, p.y - 18 * s * fl, p.x + 13 * s, p.y);
        ctx.fill();
      }
    },
  },
  rockwarn: {
    init(p, S) { p.ex.cy = ceilY(S.world, p.x, p.y - 20); },
    update(p, dt, S) {
      if (p.t >= p.life - 0.02) {
        S.proj('rock', p.x, p.ex.cy + 14, 0, 0, { life: 3 });
        return false;
      }
      return true;
    },
    hit: () => false,
    draw(ctx, p, time) {
      const k = p.t / p.life;
      ctx.fillStyle = `rgba(0,0,0,${0.25 + k * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 2, 10 + k * 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 천장에서 떨어지는 흙먼지
      ctx.fillStyle = 'rgba(190,190,170,0.7)';
      for (let i = 0; i < 4; i++) {
        const yy = (p.ex.cy || p.y - 300) + ((time * 300 + i * 40) % 80);
        ctx.fillRect(p.x + Math.sin(i * 3) * 8, yy, 2, 4);
      }
    },
  },
  rock: {
    update(p, dt, S) {
      p.vy += 1900 * dt;
      p.y += p.vy * dt;
      if (S.world.solidAt(p.x, p.y + 12)) {
        S.ev('rockbreak', { x: p.x, y: p.y + 10 });
        return false;
      }
      return true;
    },
    hit: (p, b) => circRect(p.x, p.y, 14, b),
    draw(ctx, p) {
      ctx.fillStyle = '#1a1714';
      ctx.beginPath();
      ctx.moveTo(p.x - 14, p.y);
      ctx.lineTo(p.x - 8, p.y - 13);
      ctx.lineTo(p.x + 9, p.y - 12);
      ctx.lineTo(p.x + 15, p.y + 2);
      ctx.lineTo(p.x + 6, p.y + 13);
      ctx.lineTo(p.x - 9, p.y + 11);
      ctx.fill();
      ctx.fillStyle = '#5a554c';
      ctx.fillRect(p.x - 6, p.y - 9, 8, 2);
    },
  },
  sring: {
    light: 0,
    update: () => true,
    hit(p, b) {
      const r = p.t * 330;
      const bx = b.x + b.w / 2, by = b.y + b.h / 2;
      const d = Math.hypot(bx - p.x, by - p.y);
      if (Math.abs(d - r) > 16) return false;
      let a = Math.atan2(by - p.y, bx - p.x) - p.ex.gap;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      return Math.abs(a) > 0.5;
    },
    draw(ctx, p) {
      const r = p.t * 330;
      const k = p.t / p.life;
      ctx.strokeStyle = `rgba(126,240,216,${0.85 * (1 - k)})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, p.ex.gap + 0.5, p.ex.gap - 0.5 + Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(230,255,250,${0.9 * (1 - k)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    },
  },
  shard: {
    update(p, dt, S) {
      p.vy += (p.ex.grav || 1500) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return !S.world.solidAt(p.x, p.y);
    },
    hit: (p, b) => circRect(p.x, p.y, 10, b),
    draw(ctx, p, time) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(time * 12 + p.id);
      ctx.fillStyle = '#3d4a3a';
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(10, -3);
      ctx.lineTo(4, 8);
      ctx.fill();
      ctx.fillStyle = '#7ef0d8';
      ctx.fillRect(-4, -4, 8, 1.5);
      ctx.restore();
    },
  },
  petal: {
    light: 40, glow: 'red',
    update(p, dt, S) {
      p.y += p.vy * dt;
      p.x += Math.sin(p.t * 3 + p.id) * 40 * dt;
      return !S.world.solidAt(p.x, p.y + 6);
    },
    hit: (p, b) => circRect(p.x, p.y, 9, b),
    draw(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.t * 3 + p.id) * 0.8);
      ctx.fillStyle = '#d42a44';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8a96';
      ctx.fillRect(-4, -1, 8, 1.5);
      ctx.restore();
    },
  },
  lantern: {
    light: 120, glow: 'amber',
    update(p, dt, S) {
      p.vy += (p.ex.grav || 1400) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (S.world.solidAt(p.x, p.y + 8) || S.world.solidAt(p.x + Math.sign(p.vx) * 8, p.y)) {
        S.proj('blast', p.x, p.y, 0, 0, { life: 0.22 });
        let fy = p.y;
        while (!S.world.solidAt(p.x, fy + 2) && fy < p.y + 200) fy += 4;
        S.proj('fire', p.x, fy, 0, 0, { life: 2.2 });
        S.ev('boom', { x: p.x, y: p.y });
        return false;
      }
      return true;
    },
    hit: (p, b) => circRect(p.x, p.y, 10, b),
    draw(ctx, p, time) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(time * 8);
      ctx.fillStyle = '#2a2016';
      ctx.fillRect(-7, -9, 14, 18);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(-5, -6, 10, 12);
      ctx.restore();
    },
  },
  blast: {
    light: 200, glow: 'amber',
    update: () => true,
    hit: (p, b) => circRect(p.x, p.y, 74, b),
    draw(ctx, p) {
      const k = p.t / p.life;
      ctx.fillStyle = `rgba(255,200,120,${1 - k})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30 + k * 50, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

export function makeProj(id, type, x, y, vx, vy, o = {}) {
  return { id, type, x, y, vx, vy, t: 0, life: o.life || 2, ex: o };
}
export { rand };
