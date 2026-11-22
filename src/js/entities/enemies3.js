// 3장 몹 6종 (얼어붙은 변경). 모든 공격은 예고 동작 후 판정.
import { go, groundPhys, flyPhys, blockedAhead, cx, cy, rectFront } from './common.js';
import { clamp, rand } from '../core/util.js';

const body = (e, s0 = 3) => {
  const s = s0 + 2;
  return { x: e.x + s, y: e.y + s + 2, w: e.w - s * 2, h: e.h - s * 2 - 2 };
};
const F = (e, c) => (e.fl > 0 ? '#ffffff' : c);
const ICE = '#bfe6ff', ICE2 = '#7fb6d8', DEEP = '#1c2c3c';
const vg = (ctx, y0, y1, a, b) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
};

export const ENEMIES3 = {
  // ─── 서리 뜀벌레: 웅크린 뒤 플레이어 쪽으로 깡충 ───
  frostling: {
    w: 24, h: 20, hp: 16, amber: 5,
    init(e) { e.st = 'idle'; },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'idle':
          e.vx *= 0.8;
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (p && e.t > 1.1 && Math.abs(p.cx - cx(e)) < 360) go(e, 'crouch');
          break;
        case 'crouch':
          e.vx = 0;
          if (e.t > 0.4) {
            e.vy = -560;
            e.vx = e.facing * 220;
            e.grounded = false;
            go(e, 'hop');
          }
          break;
        case 'hop':
          if (e.t > 0.1 && e.grounded) { e.vx = 0; go(e, 'idle'); }
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      groundPhys(e, S, dt);
    },
    danger: (e) => [body(e, 2)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const sq = e.st === 'crouch' ? 0.75 : e.st === 'hop' ? 1.15 : 1;
      ctx.scale(1 / Math.sqrt(sq), sq);
      ctx.fillStyle = e.fl > 0 ? '#fff' : vg(ctx, -20, 0, '#e8f6ff', '#6a9cc0');
      ctx.beginPath();
      ctx.ellipse(0, -9, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // 서리 가시
      ctx.fillStyle = '#f4fbff';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 4 - 2, -15);
        ctx.lineTo(i * 4, -22 - Math.abs(i));
        ctx.lineTo(i * 4 + 2, -15);
        ctx.fill();
      }
      ctx.fillStyle = DEEP;
      ctx.fillRect(5, -11, 3, 3);
      ctx.fillStyle = '#2a3a4a';
      for (let i = 0; i < 3; i++) ctx.fillRect(-7 + i * 6, -1, 2, 2);
      ctx.restore();
    },
  },

  // ─── 고드름 매달이: 아래로 오면 흔들리다 떨어짐 (다시 자람) ───
  icicle: {
    w: 20, h: 34, hp: 8, amber: 3, static: true,
    init(e, S) {
      let y = e.y;
      while (y > 0 && !S.world.solidAt(cx(e), y - 2)) y -= 8;
      e.y = y;
      e.ex.ay = y;
      e.st = 'hang';
    },
    update(e, dt, S) {
      const p = S.near(e);
      if (e.st === 'hang' && p && Math.abs(p.cx - cx(e)) < 50 && p.cy > e.y && e.t > 1) go(e, 'crack');
      else if (e.st === 'crack' && e.t > 0.7) {
        S.proj('icefall', cx(e), e.y + 20, 0, 0, { life: 3 });
        go(e, 'grow');
      } else if (e.st === 'grow' && e.t > 3.5) go(e, 'hang');
    },
    blocks: (e) => e.st === 'grow',
    danger: (e) => (e.st === 'grow' ? [] : [body(e, 4)]),
    draw(ctx, e, time) {
      const k = e.st === 'grow' ? Math.min(1, e.t / 3.5) : 1;
      if (k < 0.05) return;
      ctx.save();
      ctx.translate(cx(e) + (e.st === 'crack' ? rand(-1.5, 1.5) : 0), e.ex.ay || e.y);
      ctx.fillStyle = e.fl > 0 ? '#fff' : vg(ctx, 0, 34 * k, '#f2fbff', '#7fb6d8');
      ctx.beginPath();
      ctx.moveTo(-9 * k, 0);
      ctx.lineTo(9 * k, 0);
      ctx.lineTo(1, 34 * k);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(-4 * k, 2);
      ctx.lineTo(0, 24 * k);
      ctx.stroke();
      if (e.st === 'crack') {
        ctx.strokeStyle = '#2a4a66';
        ctx.beginPath();
        ctx.moveTo(-5, 4);
        ctx.lineTo(2, 10);
        ctx.lineTo(-2, 16);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // ─── 눈털 짐승: 포효(예고) 후 돌진, 눈덩이 던지기 ───
  yeti: {
    w: 44, h: 40, hp: 48, amber: 14,
    init(e) { e.st = 'walk'; },
    update(e, dt, S) {
      const p = S.near(e);
      const dx = p ? p.cx - cx(e) : 0;
      switch (e.st) {
        case 'walk':
          if (e.kb <= 0) {
            if (e.grounded && blockedAhead(e, S)) e.facing *= -1;
            e.vx = e.facing * 50;
          }
          if (p && e.t > 1.2 && Math.abs(dx) < 380 && Math.abs(p.cy - cy(e)) < 120) {
            e.facing = Math.sign(dx) || 1;
            go(e, Math.abs(dx) > 200 && Math.random() < 0.5 ? 'twind' : 'roar');
            e.vx = 0;
          }
          break;
        case 'roar':
          e.vx = 0;
          if (e.t > 0.75) { go(e, 'charge'); e.vx = e.facing * 360; S.ev('sfx', { s: 'roar', x: cx(e), y: cy(e), p: 1.5 }); }
          break;
        case 'charge':
          if (blockedAhead(e, S) || e.t > 1.2) { e.vx = 0; go(e, 'rest'); }
          break;
        case 'twind':
          e.vx = 0;
          if (e.t > 0.7) {
            const fl = 0.9, ddx = dx, dy = p ? p.y + p.h - (e.y + 10) : 0;
            S.proj('wax', cx(e), e.y + 10, ddx / fl, dy / fl - 0.5 * 1500 * fl, { life: 3, grav: 1500, snow: 1 });
            go(e, 'rest');
          }
          break;
        case 'rest':
          e.vx *= 0.8;
          if (e.t > 0.9) go(e, 'walk');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      groundPhys(e, S, dt);
    },
    danger: (e) => [body(e, 4)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const roar = e.st === 'roar' || e.st === 'twind';
      if (roar) ctx.translate(rand(-1.2, 1.2), 0);
      const step = e.st === 'walk' || e.st === 'charge' ? Math.sin(time * (e.st === 'charge' ? 18 : 7)) * 3 : 0;
      ctx.fillStyle = '#4a5a6a';
      ctx.fillRect(-12 + step, -10, 8, 10);
      ctx.fillRect(4 - step, -10, 8, 10);
      // 털뭉치 몸
      ctx.fillStyle = e.fl > 0 ? '#fff' : vg(ctx, -40, -6, '#f2f6fa', '#9fb4c6');
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i / 13) * Math.PI;
        const r = 22 + (i % 2) * 3;
        ctx.lineTo(Math.cos(a) * r, -16 + Math.sin(a) * r * 0.9);
      }
      ctx.lineTo(22, -6);
      ctx.lineTo(-22, -6);
      ctx.fill();
      // 얼굴
      ctx.fillStyle = '#3a4a5a';
      ctx.beginPath();
      ctx.ellipse(12, -24, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = roar ? '#ff6a4a' : '#bfe6ff';
      ctx.fillRect(13, -27, 3, 2.5);
      if (roar) {
        ctx.fillStyle = '#1a1010';
        ctx.beginPath();
        ctx.ellipse(16, -20, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 뿔
      ctx.fillStyle = '#e8e2d2';
      ctx.beginPath();
      ctx.moveTo(6, -30);
      ctx.quadraticCurveTo(0, -42, 8, -44);
      ctx.quadraticCurveTo(4, -38, 10, -31);
      ctx.fill();
      ctx.restore();
    },
  },

  // ─── 얼음 정령: 빛을 모은 뒤 얼음 조각 3발 ───
  icewisp: {
    w: 24, h: 24, hp: 22, amber: 7, fly: true, light: 90,
    init(e) { e.st = 'drift'; e.ex.hy = e.y; },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'drift':
          if (p) {
            const want = p.cx + Math.sign(cx(e) - p.cx || 1) * 200;
            e.vx += (clamp(want - cx(e), -80, 80) - e.vx) * dt * 2;
            e.vy += (clamp(p.cy - 120 - cy(e), -80, 80) - e.vy) * dt * 2;
            e.facing = Math.sign(p.cx - cx(e)) || 1;
            if (e.t > 2.2 && Math.hypot(p.cx - cx(e), p.cy - cy(e)) < 420) go(e, 'glow');
          } else e.vy = Math.sin(e.t * 2) * 20;
          break;
        case 'glow':
          e.vx *= 0.9; e.vy *= 0.9;
          if (p && e.t < 0.5) e.ex.a = Math.atan2(p.cy - cy(e), p.cx - cx(e));
          if (e.t > 0.85) {
            for (const da of [-0.28, 0, 0.28]) S.proj('thorn', cx(e), cy(e), Math.cos(e.ex.a + da) * 240, Math.sin(e.ex.a + da) * 240, { life: 2.6, ice: 1 });
            S.ev('sfx', { s: 'shoot', x: cx(e), y: cy(e), p: 1.4 });
            go(e, 'drift');
          }
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      const r = flyPhys(e, S, dt);
      if (r.hitX) e.vx = 0;
      if (r.hitY) e.vy = 0;
    },
    danger: (e) => [body(e, 4)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), cy(e));
      const k = e.st === 'glow' ? Math.min(1, e.t / 0.85) : 0;
      ctx.fillStyle = `rgba(190,230,255,${0.2 + k * 0.35})`;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + k * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(time * 1.5);
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#e8f6ff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a + 0.52) * 5, Math.sin(a + 0.52) * 5);
      }
      ctx.fill();
      ctx.fillStyle = '#5aa8ff';
      ctx.beginPath();
      ctx.arc(0, 0, 3 + k * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  // ─── 눈부엉이: 높이 앉아 있다 울음(예고) 후 곡선 급강하 ───
  owl: {
    w: 30, h: 26, hp: 24, amber: 8, fly: true,
    init(e) { e.st = 'perch'; e.ex.hx = e.x; e.ex.hy = e.y; },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'perch':
          e.vx = (e.ex.hx - e.x) * 2;
          e.vy = (e.ex.hy - e.y) * 2;
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (p && e.t > 1.6 && Math.abs(p.cx - cx(e)) < 360 && p.cy > cy(e)) { go(e, 'screech'); e.ex.tx = p.cx; e.ex.ty = p.cy; }
          break;
        case 'screech':
          e.vx = 0; e.vy = 0;
          if (p && e.t < 0.5) { e.ex.tx = p.cx; e.ex.ty = p.cy; }
          if (e.t > 0.85) { go(e, 'swoop'); S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) }); }
          break;
        case 'swoop': {
          const k = e.t / 0.9;
          if (k >= 1) { go(e, 'perch'); break; }
          // 목표 지점을 지나 반대편 위로 올라가는 곡선
          const sx = e.ex.sx != null ? e.ex.sx : (e.ex.sx = cx(e)), sy = e.ex.sy != null ? e.ex.sy : (e.ex.sy = cy(e));
          const ex2 = e.ex.tx + (e.ex.tx - sx), ey2 = sy;
          const x = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * e.ex.tx + k * k * ex2;
          const y = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * (e.ex.ty + 40) + k * k * ey2;
          e.vx = (x - cx(e)) / dt;
          e.vy = (y - cy(e)) / dt;
          if (k > 0.95) { e.ex.hx = ex2 - e.w / 2; e.ex.hy = ey2 - e.h / 2; e.ex.sx = e.ex.sy = null; }
          break;
        }
      }
      if (e.kb > 0) e.kb -= dt;
      const r = flyPhys(e, S, dt);
      if ((r.hitX || r.hitY) && e.st === 'swoop') { e.ex.hx = e.x; e.ex.hy = e.y - 60; e.ex.sx = e.ex.sy = null; go(e, 'perch'); }
    },
    danger: (e) => [body(e, 4)],
    draw(ctx, e, time) {
      if (e.st === 'screech' && e.ex.tx != null) {
        const k = Math.min(1, e.t / 0.85);
        ctx.strokeStyle = `rgba(200,230,255,${0.15 + k * 0.45})`;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(cx(e), cy(e));
        ctx.quadraticCurveTo(e.ex.tx, e.ex.ty + 80, e.ex.tx * 2 - cx(e), cy(e));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.translate(cx(e), cy(e));
      ctx.scale(e.facing, 1);
      const flap = e.st === 'swoop' ? Math.sin(time * 30) * 0.4 : e.st === 'perch' ? 0 : Math.sin(time * 12) * 0.2;
      for (const sd of [-1, 1]) {
        ctx.save();
        ctx.rotate(sd * (0.6 + flap));
        ctx.fillStyle = e.fl > 0 ? '#fff' : '#cfd9e2';
        ctx.beginPath();
        ctx.ellipse(-sd * 4, 2, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = e.fl > 0 ? '#fff' : vg(ctx, -12, 12, '#f4f8fb', '#9aaabb');
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.st === 'screech' ? '#ffb347' : '#f2c85a';
      ctx.beginPath();
      ctx.arc(-3, -4, 3, 0, Math.PI * 2);
      ctx.arc(4, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-4, -5, 2, 2);
      ctx.fillRect(3, -5, 2, 2);
      ctx.fillStyle = '#7a6a4a';
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(2, 2);
      ctx.lineTo(-1, 2);
      ctx.fill();
      ctx.restore();
    },
  },

  // ─── 서리 창기사 (정예): 찌르기, 얼음 가시 줄 (균열 예고) ───
  frostknight: {
    w: 32, h: 50, hp: 90, amber: 32, elite: true,
    init(e) { e.st = 'walk'; },
    update(e, dt, S) {
      const p = S.near(e);
      const dx = p ? p.cx - cx(e) : 0;
      switch (e.st) {
        case 'walk':
          e.vx = 0;
          if (p && Math.abs(p.cy - cy(e)) < 140) {
            e.facing = Math.sign(dx) || 1;
            if (Math.abs(dx) > 130) e.vx = blockedAhead(e, S) ? 0 : e.facing * 75;
            if (e.t > 1.2) go(e, Math.abs(dx) < 140 ? 'lwind' : Math.random() < 0.6 ? 'swind' : 'guard');
          }
          break;
        case 'lwind':
          e.vx = 0;
          if (e.t > 0.65) { go(e, 'lunge'); e.vx = e.facing * 400; }
          break;
        case 'lunge':
          if (blockedAhead(e, S)) e.vx = 0;
          if (e.t > 0.3) go(e, 'rest');
          break;
        case 'swind':
          // 창을 땅에 꽂음 → 앞쪽으로 얼음 가시가 차례로 (각각 균열 예고)
          e.vx = 0;
          if (e.t > 0.6 && !e.ex.sp) {
            e.ex.sp = 1;
            for (let i = 0; i < 5; i++) S.proj('icespike', cx(e) + e.facing * (60 + i * 52), e.y + e.h, 0, 0, { life: 1.4 + i * 0.12, warn: 0.6 + i * 0.12 });
          }
          if (e.t > 1.1) { e.ex.sp = 0; go(e, 'rest'); }
          break;
        case 'guard':
          e.vx = 0;
          if (e.t > 1.2) go(e, 'walk');
          break;
        case 'bash':
          e.vx = e.t > 0.45 && e.t < 0.7 ? e.facing * 240 : 0;
          if (e.t > 1.0) go(e, 'rest');
          break;
        case 'rest':
          e.vx *= 0.8;
          if (e.t > 0.85) go(e, 'walk');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      groundPhys(e, S, dt);
    },
    blocks: (e, fromX) => e.st === 'guard' && Math.sign(fromX - cx(e)) === e.facing,
    onBlock(e) { if (e.st === 'guard') { e.st = 'bash'; e.t = 0; } },
    danger(e) {
      const b = [body(e, 4)];
      if (e.st === 'lunge' && e.t < 0.28) b.push(rectFront(e, -4, 46, 12, -4));
      if (e.st === 'bash' && e.t > 0.45 && e.t < 0.7) b.push(rectFront(e, -10, 22, 40, 0));
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const wind = e.st.endsWith('wind') || (e.st === 'bash' && e.t < 0.45);
      ctx.fillStyle = '#2a3a4c';
      ctx.beginPath();
      ctx.moveTo(-6, -44);
      ctx.quadraticCurveTo(-26, -22, -20 + Math.sin(time * 3) * 2, 0);
      ctx.lineTo(-2, -4);
      ctx.fill();
      ctx.fillStyle = e.fl > 0 ? '#fff' : vg(ctx, -48, -4, '#9fc4e0', '#34506a');
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-14, -32);
      ctx.quadraticCurveTo(-10, -46, 0, -48);
      ctx.quadraticCurveTo(12, -46, 12, -32);
      ctx.lineTo(11, 0);
      ctx.fill();
      ctx.fillStyle = '#e8f6ff';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-6 + i * 5, -46);
        ctx.lineTo(-4 + i * 5, -56 - (i === 1 ? 4 : 0));
        ctx.lineTo(-2 + i * 5, -46);
        ctx.fill();
      }
      ctx.fillStyle = wind ? '#5aa8ff' : '#dff4ff';
      ctx.fillRect(3, -40, 8, 2.5);
      // 얼음 창
      let off = 0, ang = -0.2;
      if (e.st === 'lwind') off = -8 * Math.min(1, e.t / 0.5);
      if (e.st === 'lunge') { off = 14; ang = 0; }
      if (e.st === 'swind') ang = 1.1;
      ctx.save();
      ctx.translate(4 + off, -24);
      ctx.rotate(ang);
      ctx.fillStyle = '#8fb0c8';
      ctx.fillRect(-14, -1.5, 50, 3);
      ctx.fillStyle = ICE;
      ctx.beginPath();
      ctx.moveTo(36, -5);
      ctx.lineTo(48, 0);
      ctx.lineTo(36, 5);
      ctx.fill();
      ctx.restore();
      if (e.st === 'guard' || e.st === 'bash') {
        if (e.st === 'bash') ctx.translate(e.t < 0.45 ? -4 * (e.t / 0.45) : 6, 0);
        ctx.fillStyle = e.st === 'bash' && e.t < 0.45 ? '#6a8aa8' : '#c8e4f8';
        ctx.globalAlpha *= 0.85;
        ctx.fillRect(12, -44, 8, 36);
      }
      ctx.restore();
    },
  },
};
