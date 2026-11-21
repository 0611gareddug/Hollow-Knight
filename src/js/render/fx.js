// 파티클 + 화면 효과(흔들림, 히트스톱, 섬광, 흑백, 슬로모션)
import { rand, clamp } from '../core/util.js';
import { settings } from '../core/settings.js';

const MAX = 700;

class FX {
  constructor() {
    this.parts = [];
    this.slashes = [];
    this.rings = [];
    this.texts = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.stop = 0; // 히트스톱 남은 시간
    this.gray = 0; // 흑백 정도
    this.grayT = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.slow = 0;
    this.slowT = 0;
    this.vignette = 0;
  }

  reset() {
    this.parts.length = 0;
    this.slashes.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.stop = this.gray = this.flash = this.slow = this.shakeT = 0;
  }

  shake(mag, time = 0.25) {
    mag *= settings.shake;
    if (mag <= 0) return;
    if (mag >= this.shakeMag || this.shakeT <= 0) {
      this.shakeMag = mag;
      this.shakeT = time;
      this.shakeDur = time;
    }
  }
  hitstop(t) {
    t *= settings.hitstop;
    this.stop = Math.max(this.stop, t);
  }
  doFlash(a = 0.6, color = '255,255,255') {
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }
  grayscale(t) {
    this.grayT = Math.max(this.grayT, t);
  }
  slowmo(scale, t) {
    this.slow = scale;
    this.slowT = t;
  }

  // 시간 배율 (히트스톱/슬로모션)
  timeScale(dt) {
    if (this.stop > 0) {
      this.stop -= dt;
      return 0;
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      return this.slow;
    }
    return 1;
  }

  updateScreen(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = clamp(this.shakeT / this.shakeDur, 0, 1);
      const m = this.shakeMag * k;
      this.shakeX = rand(-m, m);
      this.shakeY = rand(-m, m);
    } else {
      this.shakeX = this.shakeY = 0;
      this.shakeMag = 0;
    }
    if (this.grayT > 0) {
      this.grayT -= dt;
      this.gray = Math.min(1, this.gray + dt * 12);
    } else this.gray = Math.max(0, this.gray - dt * 3);
    this.flash = Math.max(0, this.flash - dt * 3.5);
  }

  // ---------- 파티클 ----------
  add(p) {
    if (this.parts.length >= MAX) this.parts.shift();
    p.t = 0;
    this.parts.push(p);
    return p;
  }
  // 기본 파티클 형태: kind = dot | spark | shard | glow | dust | ember | ring
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.dir != null ? o.dir + rand(-(o.spread || 0.6), o.spread || 0.6) : rand(0, Math.PI * 2);
      const s = rand(o.smin || 80, o.smax || 300);
      this.add({
        kind: o.kind || 'dot',
        x: x + rand(-(o.jx || 0), o.jx || 0),
        y: y + rand(-(o.jy || 0), o.jy || 0),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(o.lmin || 0.25, o.lmax || 0.6),
        size: rand(o.szmin || 2, o.szmax || 4),
        color: o.color || '#fff',
        grav: o.grav == null ? 600 : o.grav,
        drag: o.drag == null ? 2 : o.drag,
        rot: rand(0, 6.28),
        vr: rand(-12, 12),
        add: !!o.add,
      });
    }
  }
  slash(x, y, dir, facing, color = '255,255,255', big = 1) {
    this.slashes.push({ x, y, dir, facing, t: 0, life: 0.16, color, big });
  }
  ring(x, y, r0, r1, life, color = '255,255,255', width = 3) {
    this.rings.push({ x, y, r0, r1, life, t: 0, color, width });
  }
  text(x, y, str, color = '#ffd58a') {
    this.texts.push({ x, y, str, color, t: 0, life: 1.2 });
  }

  update(dt) {
    const ps = this.parts;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      p.vy += p.grav * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ps[w++] = p;
    }
    ps.length = w;
    this.slashes = this.slashes.filter((s) => (s.t += dt) < s.life);
    this.rings = this.rings.filter((r) => (r.t += dt) < r.life);
    this.texts = this.texts.filter((t) => (t.t += dt) < t.life);
  }

  draw(ctx, view) {
    const { x0, y0, x1, y1 } = view;
    // 일반 파티클
    for (const p of this.parts) {
      if (p.add || p.x < x0 - 50 || p.x > x1 + 50 || p.y < y0 - 50 || p.y > y1 + 50) continue;
      this._drawP(ctx, p);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (!p.add || p.x < x0 - 50 || p.x > x1 + 50 || p.y < y0 - 50 || p.y > y1 + 50) continue;
      this._drawP(ctx, p);
    }
    ctx.globalCompositeOperation = 'source-over';

    // 베기 궤적 (초승달)
    for (const s of this.slashes) {
      const k = s.t / s.life;
      const a = 1 - k;
      ctx.save();
      ctx.translate(s.x, s.y);
      let rot = 0;
      if (s.dir === 'up') rot = -Math.PI / 2;
      else if (s.dir === 'down') rot = Math.PI / 2;
      else if (s.facing < 0) rot = Math.PI;
      ctx.rotate(rot);
      const R = 44 * s.big;
      const sweep = 0.4 + k * 0.5;
      ctx.beginPath();
      ctx.arc(-10 * s.big, 0, R, -1.25 + sweep * 0.2, 1.25 - sweep * 0.2 + 0.1, false);
      ctx.arc(-24 * s.big, 0, R * 0.72, 1.05, -1.05, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(${s.color},${0.85 * a})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-10 * s.big, 0, R, -1.1, 1.1);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }
    for (const r of this.rings) {
      const k = r.t / r.life;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r.color},${1 - k})`;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.stroke();
    }
    ctx.font = 'bold 16px "Noto Serif KR", serif';
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.t / t.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y - k * 30);
    }
    ctx.globalAlpha = 1;
  }

  _drawP(ctx, p) {
    const k = p.t / p.life;
    const a = 1 - k;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    switch (p.kind) {
      case 'spark': {
        const len = Math.min(26, Math.hypot(p.vx, p.vy) * 0.045) + 2;
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillRect(-len, -p.size * 0.35, len, p.size * 0.7);
        ctx.restore();
        break;
      }
      case 'shard': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, s * 0.6);
        ctx.lineTo(-s * 0.6, s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'glow': {
        const s = p.size * (1 + k * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dust': {
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + k * 1.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

export const fx = new FX();
