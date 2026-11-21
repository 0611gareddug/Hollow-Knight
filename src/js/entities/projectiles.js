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
    hit: (p, b) => circRect(p.x, p.y, 4.5, b),
    draw(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      if (p.ex.feather) {
        ctx.fillStyle = '#eef2f5';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8aa0b4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(11, 0);
        ctx.stroke();
        ctx.restore();
        return;
      }
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
    hit: (p, b) => circRect(p.x, p.y, 6, b),
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
    hit: (p, b) => rr({ x: p.x - 9, y: p.y - (p.ex.big ? 32 : 20), w: 18, h: p.ex.big ? 32 : 20 }, b),
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
    hit: (p, b) => p.t > 0.25 && rr({ x: p.x - 26, y: p.y - 6, w: 52, h: 6 }, b),
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
    hit: (p, b) => p.t > 0.15 && rr({ x: p.x - 10, y: p.y - 22, w: 20, h: 22 }, b),
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
    hit: (p, b) => circRect(p.x, p.y, 11, b),
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
      const r = p.t * 280;
      const bx = b.x + b.w / 2, by = b.y + b.h / 2;
      const d = Math.hypot(bx - p.x, by - p.y);
      if (Math.abs(d - r) > 10) return false;
      let a = Math.atan2(by - p.y, bx - p.x) - p.ex.gap;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      return Math.abs(a) > 0.75;
    },
    draw(ctx, p) {
      const r = p.t * 280;
      const k = p.t / p.life;
      ctx.strokeStyle = `rgba(126,240,216,${0.85 * (1 - k)})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, p.ex.gap + 0.75, p.ex.gap - 0.75 + Math.PI * 2);
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
    hit: (p, b) => circRect(p.x, p.y, 7, b),
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
    hit: (p, b) => circRect(p.x, p.y, 6, b),
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
    hit: (p, b) => circRect(p.x, p.y, 60, b),
    draw(ctx, p) {
      const k = p.t / p.life;
      ctx.fillStyle = `rgba(255,200,120,${1 - k})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30 + k * 50, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

// ───── 교체된 공정한 패턴들 (모두 예고 후 판정) ─────
Object.assign(PROJ, {
  // 촛농 방울: 포물선 낙하
  wax: {
    light: 60, glow: 'amber',
    update(p, dt, S) {
      p.vy += (p.ex.grav || 1500) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (S.world.solidAt(p.x, p.y + 6) || S.world.solidAt(p.x + Math.sign(p.vx) * 6, p.y)) {
        S.ev('splash', { x: p.x, y: p.y });
        return false;
      }
      return true;
    },
    hit: (p, b) => circRect(p.x, p.y, 8, b),
    draw(ctx, p, time) {
      if (p.ex.steam || p.ex.ash) {
        ctx.fillStyle = p.ex.steam ? 'rgba(160,240,225,0.45)' : 'rgba(120,90,80,0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.ex.steam ? '#dffcf6' : '#3a2a24';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        if (p.ex.ash) {
          ctx.fillStyle = '#ff7a3a';
          ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        }
        return;
      }
      ctx.fillStyle = '#e8d9b0';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 10);
      ctx.quadraticCurveTo(p.x + 8, p.y + 2, p.x, p.y + 8);
      ctx.quadraticCurveTo(p.x - 8, p.y + 2, p.x, p.y - 10);
      ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(p.x - 1.5, p.y - 2, 3, 3);
    },
  },
  // 물기둥: 거품 예고 → 솟음
  geyser: {
    light: 80, glow: 'teal',
    update: () => true,
    hit: (p, b) => p.t > p.ex.warn && p.t < p.ex.warn + 0.45 && rr({ x: p.x - 17, y: p.y - 130, w: 34, h: 130 }, b),
    draw(ctx, p, time) {
      const w = p.ex.warn;
      if (p.t < w) {
        const k = p.t / w;
        ctx.fillStyle = p.ex.steam ? `rgba(230,235,235,${0.25 + k * 0.5})` : `rgba(120,240,220,${0.25 + k * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 2, 20, 4 + k * 3, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const yy = p.y - ((time * 70 + i * 13) % (20 + k * 30));
          ctx.beginPath();
          ctx.arc(p.x - 12 + i * 8, yy, 2 + k * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const k = Math.min(1, (p.t - w) / 0.12), fade = Math.max(0, 1 - (p.t - w - 0.35) / 0.3);
        const h = 130 * k;
        const g = ctx.createLinearGradient(0, p.y - h, 0, p.y);
        g.addColorStop(0, `rgba(220,255,250,${0.9 * fade})`);
        g.addColorStop(1, `rgba(60,200,180,${0.7 * fade})`);
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 15 + Math.sin(time * 40) * 1.5, p.y - h, 30, h);
      }
    },
  },
  // 무대 조명: 따라오다 멈춘 뒤 내리침
  spot: {
    light: 160, glow: 'red',
    update(p, dt, S) {
      if (p.t < 0.95) {
        const t = S.near({ x: p.x - 1, y: p.y - 60, w: 2, h: 2 });
        if (t) p.x += Math.max(-280 * dt, Math.min(280 * dt, t.cx - p.x));
      }
      return true;
    },
    hit: (p, b) => p.t > 1.4 && p.t < 1.6 && rr({ x: p.x - 30, y: p.y - 420, w: 60, h: 420 }, b),
    draw(ctx, p, time) {
      const locked = p.t >= 0.95;
      if (p.t < 1.4) {
        const a = locked ? 0.35 + Math.sin(time * 30) * 0.15 : 0.18;
        const g = ctx.createLinearGradient(0, p.y - 420, 0, p.y);
        g.addColorStop(0, `rgba(255,90,100,0)`);
        g.addColorStop(1, `rgba(255,90,100,${a})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y - 420);
        ctx.lineTo(p.x + 12, p.y - 420);
        ctx.lineTo(p.x + 32, p.y);
        ctx.lineTo(p.x - 32, p.y);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,140,150,${locked ? 0.9 : 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 2, 32, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const k = (p.t - 1.4) / 0.35;
        ctx.fillStyle = `rgba(255,230,230,${Math.max(0, 1 - k)})`;
        ctx.fillRect(p.x - 30, p.y - 420, 60, 420);
      }
    },
  },
  // 리본 고리: 앞으로 날아갔다 되돌아옴 (점프로 피함)
  loop: {
    light: 50, glow: 'red',
    update(p, dt) {
      if (p.ex.d == null) p.ex.d = Math.sign(p.vx) || 1;
      p.vx -= p.ex.d * 950 * dt;
      p.x += p.vx * dt;
      return !(p.t > 0.6 && Math.sign(p.vx) !== p.ex.d && (p.x - p.ex.ox) * p.ex.d < 0);
    },
    hit: (p, b) => circRect(p.x, p.y, 11, b),
    draw(ctx, p, time) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(time * 18);
      ctx.strokeStyle = '#e0304a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  // 등불 정령: 느리게 따라옴
  wisp: {
    light: 110, glow: 'amber',
    update(p, dt, S) {
      const t = S.near({ x: p.x - 1, y: p.y - 1, w: 2, h: 2 });
      if (t && p.t > 0.6) {
        const a = Math.atan2(t.cy - p.y, t.cx - p.x);
        p.vx += Math.cos(a) * 160 * dt;
        p.vy += Math.sin(a) * 160 * dt;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 125) { p.vx *= 125 / sp; p.vy *= 125 / sp; }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return true;
    },
    hit: (p, b) => p.t > 0.6 && circRect(p.x, p.y, 9, b),
    draw(ctx, p, time) {
      const f = Math.min(1, (p.life - p.t) * 2);
      ctx.globalAlpha = f;
      ctx.fillStyle = 'rgba(255,170,80,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe2a8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2016';
      ctx.fillRect(p.x - 3, p.y - 1, 2, 2);
      ctx.fillRect(p.x + 1, p.y - 1, 2, 2);
      ctx.globalAlpha = 1;
    },
  },
  // 반쪽 바닥 화염: 지정된 절반만 예고 후 타오름
  halfline: {
    light: 0,
    update: () => true,
    hit: (p, b) => p.t > p.ex.warn && p.t < p.ex.warn + 0.35 && rr({ x: p.ex.l, y: p.y - 46, w: p.ex.r - p.ex.l, h: 46 }, b),
    draw(ctx, p, time) {
      const w = p.ex.warn, L = p.ex.l, R = p.ex.r;
      if (p.t < w) {
        const k = p.t / w;
        ctx.fillStyle = `rgba(255,170,80,${0.12 + k * 0.35 + Math.sin(time * 25) * 0.06 * k})`;
        ctx.fillRect(L, p.y - 6 - k * 8, R - L, 6 + k * 8);
        ctx.fillStyle = `rgba(255,230,160,${0.5 + k * 0.5})`;
        for (let x = L + 20; x < R; x += 40) ctx.fillRect(x, p.y - 4 - k * 10 - ((time * 40 + x) % 8), 2, 3);
      } else {
        const k = Math.max(0, 1 - (p.t - w - 0.2) / 0.25);
        for (let x = L; x < R; x += 22) {
          const h = (34 + Math.sin(time * 30 + x) * 10) * k;
          ctx.fillStyle = `rgba(255,140,50,${0.85 * k})`;
          ctx.beginPath();
          ctx.moveTo(x, p.y);
          ctx.quadraticCurveTo(x + 11, p.y - h * 1.4, x + 22, p.y);
          ctx.fill();
        }
      }
    },
  },
});

// ───── 2장 투사체 ─────
Object.assign(PROJ, {
  // 포자: 천천히 떠오름
  spore: {
    light: 50, glow: 'amber',
    update(p, dt, S) {
      p.vx *= 1 - 0.6 * dt;
      p.x += (p.vx + Math.sin(p.t * 3 + p.id) * 25) * dt;
      p.y += p.vy * dt;
      return !S.world.solidAt(p.x, p.y - 6);
    },
    hit: (p, b) => p.t > 0.3 && circRect(p.x, p.y, 6, b),
    draw(ctx, p, time) {
      const a = Math.min(1, (p.life - p.t) * 2);
      ctx.fillStyle = `rgba(255,150,70,${0.35 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,220,150,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 + Math.sin(time * 8 + p.id) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  // 돌풍: 피해 없이 밀어냄
  gust: {
    update(p, dt, S) {
      p.x += p.vx * dt;
      return !S.world.solidAt(p.x + Math.sign(p.vx) * 20, p.y);
    },
    hit: () => false,
    push: (p, b) => (rr({ x: p.x - 22, y: p.y - 50, w: 44, h: 100 }, b) ? { x: Math.sign(p.vx) * 620, y: 0 } : null),
    draw(ctx, p, time) {
      const a = Math.min(1, (p.life - p.t) * 2, p.t * 4);
      ctx.strokeStyle = `rgba(220,240,255,${0.55 * a})`;
      ctx.lineWidth = 2;
      const d = Math.sign(p.vx);
      for (let i = 0; i < 6; i++) {
        const yy = p.y - 45 + i * 18;
        const ox = ((time * 300 + i * 37) % 40) * d;
        ctx.beginPath();
        ctx.moveTo(p.x - 20 * d + ox * 0.3, yy);
        ctx.quadraticCurveTo(p.x + ox * 0.5, yy - 6, p.x + 22 * d, yy);
        ctx.stroke();
      }
    },
  },
  // 빨아들이는 소용돌이: 피해 없이 중심으로 당김
  vortex: {
    light: 120, glow: 'red',
    update: () => true,
    hit: () => false,
    push: (p, b) => {
      if (p.t < 0.3) return null;
      const bx = b.x + b.w / 2, dx = p.x - bx;
      if (Math.abs(dx) > 520 || Math.abs(dx) < 70) return null;
      return { x: Math.sign(dx) * 210, y: 0 };
    },
    draw(ctx, p, time) {
      const a = Math.min(1, (p.life - p.t) * 2, p.t * 3);
      for (let i = 0; i < 4; i++) {
        const r = 520 - ((time * 260 + i * 130) % 520);
        ctx.strokeStyle = `rgba(150,90,80,${0.22 * a * (r / 520)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },
  // 던지는 창
  spear: {
    update(p, dt, S) {
      p.x += p.vx * dt;
      return !S.world.solidAt(p.x + Math.sign(p.vx) * 22, p.y);
    },
    hit: (p, b) => rr({ x: p.x - 18, y: p.y - 3, w: 36, h: 6 }, b),
    draw(ctx, p) {
      const d = Math.sign(p.vx);
      ctx.fillStyle = '#9a8f80';
      ctx.fillRect(p.x - 24, p.y - 1.5, 44, 3);
      ctx.fillStyle = '#e0d6c0';
      ctx.beginPath();
      ctx.moveTo(p.x + 20 * d, p.y - 4);
      ctx.lineTo(p.x + 30 * d, p.y);
      ctx.lineTo(p.x + 20 * d, p.y + 4);
      ctx.fill();
    },
  },
  // 굴러오는 톱니 (점프로 넘김, 벽에서 한 번 튕김)
  cog: {
    update(p, dt, S) {
      if (p.ex.b == null) p.ex.b = 0;
      p.x += p.vx * dt;
      if (S.world.solidAt(p.x + Math.sign(p.vx) * 18, p.y)) {
        p.ex.b++;
        if (p.ex.b > 1) return false;
        p.vx = -p.vx;
        S.ev('slam', { x: p.x, y: p.y, m: 3 });
      }
      return true;
    },
    hit: (p, b) => circRect(p.x, p.y, 14, b),
    draw(ctx, p, time) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(time * 10 * Math.sign(p.vx));
      ctx.fillStyle = '#8a5530';
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2, r = i % 2 ? 18 : 14;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
      ctx.fillStyle = '#2a1e16';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  // 거대한 주먹 착지
  fist: {
    update: () => true,
    hit: (p, b) => p.t < 0.14 && rr({ x: p.x - 34, y: p.y - 64, w: 68, h: 64 }, b),
    draw(ctx, p) {
      const k = p.t / p.life;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#221a16';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 28 + k * 10, 36, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,120,60,0.5)';
      ctx.fillRect(p.x - 30, p.y - 6, 60, 4);
      ctx.globalAlpha = 1;
    },
  },
});

export function makeProj(id, type, x, y, vx, vy, o = {}) {
  return { id, type, x, y, vx, vy, t: 0, life: o.life || 2, ex: o };
}
export { rand };
