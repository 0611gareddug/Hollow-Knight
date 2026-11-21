// 2장 몹 6종 (오리지널). 모든 공격은 예고 동작 후 판정.
import { go, groundPhys, flyPhys, blockedAhead, cx, cy, rectFront } from './common.js';
import { clamp, rand } from '../core/util.js';

const body = (e, s0 = 3) => {
  const s = s0 + 2;
  return { x: e.x + s, y: e.y + s + 2, w: e.w - s * 2, h: e.h - s * 2 - 2 };
};
const ff = (ctx, e, c) => (ctx.fillStyle = e.fl > 0 ? '#ffffff' : c);
const COPPER = '#7a4a26', COPPER2 = '#a8683a', DARK = '#120d0a';

export const ENEMIES2 = {
  // ─── 1. 톱니 굴림벌레: 몸을 말아 굴러옴 (굴러가는 중엔 무적) ───
  cogroller: {
    w: 30, h: 26, hp: 30, amber: 10,
    init(e) { e.st = 'walk'; },
    update(e, dt, S) {
      const p = S.near(e);
      const see = p && Math.abs(p.cx - cx(e)) < 320 && Math.abs(p.cy - cy(e)) < 60;
      switch (e.st) {
        case 'walk':
          if (e.kb <= 0) {
            if (e.grounded && blockedAhead(e, S)) e.facing *= -1;
            e.vx = e.facing * 55;
          }
          if (see && e.t > 1) { e.facing = Math.sign(p.cx - cx(e)) || 1; go(e, 'curl'); }
          break;
        case 'curl':
          e.vx = 0;
          if (e.t > 0.6) { go(e, 'roll'); e.ex.b = 0; S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) }); }
          break;
        case 'roll':
          e.vx = e.facing * 340;
          if (e.t > 2.2) go(e, 'dizzy');
          break;
        case 'dizzy':
          e.vx = 0;
          if (e.t > 1.0) go(e, 'walk');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      const r = groundPhys(e, S, dt);
      if (e.st === 'roll' && (r.hitX || blockedAhead(e, S))) {
        e.ex.b++;
        e.facing *= -1;
        S.ev('slam', { x: cx(e), y: cy(e), m: 3 });
        if (e.ex.b > 1) go(e, 'dizzy');
      }
    },
    blocks: (e) => e.st === 'roll',
    danger: (e) => [body(e, 3)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h - 12);
      ctx.scale(e.facing, 1);
      const rolling = e.st === 'roll' || e.st === 'curl';
      if (rolling) {
        ctx.rotate((e.st === 'roll' ? time * 18 : e.t * 6) * 1);
        ff(ctx, e, COPPER);
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, r = i % 2 ? 13 : 10;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
        ctx.fillStyle = DARK;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        if (e.st === 'curl') {
          ctx.fillStyle = `rgba(255,200,120,${0.5 + Math.sin(time * 30) * 0.4})`;
          ctx.fillRect(-1, -14, 2, 4);
        }
      } else {
        ff(ctx, e, COPPER);
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 11, 0, Math.PI, 0);
        ctx.lineTo(15, 4);
        ctx.lineTo(-15, 4);
        ctx.fill();
        ctx.fillStyle = COPPER2;
        for (let i = -2; i <= 2; i++) ctx.fillRect(i * 5 - 1, -10 + Math.abs(i) * 1.5, 2, 6);
        ctx.fillStyle = DARK;
        for (let i = 0; i < 3; i++) ctx.fillRect(-9 + i * 8 + Math.sin(time * 14 + i) * 1.5, 4, 2, 6);
        ctx.fillStyle = e.st === 'dizzy' ? '#ffd58a' : '#9fe8d8';
        ctx.fillRect(10, -4, 3, 3);
        if (e.st === 'dizzy') {
          ctx.fillStyle = '#ffd58a';
          for (let i = 0; i < 3; i++) ctx.fillRect(Math.cos(time * 6 + i * 2) * 10, -20 + Math.sin(time * 6 + i * 2) * 3, 2, 2);
        }
      }
      ctx.restore();
    },
  },

  // ─── 2. 증기 포탑: 조준(빛이 커짐) 후 포물선 증기탄 ───
  sentry: {
    w: 30, h: 30, hp: 28, amber: 10, static: true, light: 70,
    init(e) { e.st = 'idle'; },
    update(e, dt, S) {
      const p = S.near(e);
      if (p) e.ex.aim = clamp(Math.atan2(p.cy - cy(e), p.cx - cx(e)), -Math.PI + 0.3, -0.3);
      switch (e.st) {
        case 'idle':
          if (p && e.t > 1.2 && Math.abs(p.cx - cx(e)) < 560 && Math.abs(p.cy - cy(e)) < 320) go(e, 'aim');
          break;
        case 'aim':
          if (p && e.t < 0.6) { e.ex.tx = p.cx; e.ex.ty = p.y + p.h; }
          if (e.t > 0.9) {
            const fl = 0.95, dx = (e.ex.tx || cx(e)) - cx(e), dy = (e.ex.ty || e.y) - (e.y + 4);
            const g = 1500;
            S.proj('wax', cx(e), e.y + 4, dx / fl, dy / fl - 0.5 * g * fl, { life: 3, grav: g, steam: 1 });
            S.ev('sfx', { s: 'shoot', x: cx(e), y: cy(e) });
            go(e, 'cool');
          }
          break;
        case 'cool':
          if (e.t > 1.5) go(e, 'idle');
          break;
      }
      groundPhys(e, S, dt);
      e.vx = 0;
    },
    danger: (e) => [body(e, 4)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ff(ctx, e, '#2a2420');
      ctx.fillRect(-14, -12, 28, 12);
      ctx.fillStyle = e.fl > 0 ? '#fff' : COPPER;
      ctx.beginPath();
      ctx.arc(0, -14, 11, Math.PI, 0);
      ctx.fill();
      // 포신
      ctx.save();
      ctx.translate(0, -16);
      ctx.rotate(e.ex.aim != null ? e.ex.aim : -Math.PI / 2);
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#3a2e26';
      ctx.fillRect(0, -3.5, 18, 7);
      ctx.restore();
      const k = e.st === 'aim' ? Math.min(1, e.t / 0.9) : 0;
      ctx.fillStyle = `rgba(120,240,220,${0.3 + k * 0.7})`;
      ctx.beginPath();
      ctx.arc(0, -14, 3 + k * 4, 0, Math.PI * 2);
      ctx.fill();
      // 증기
      if (e.st === 'cool') {
        ctx.fillStyle = 'rgba(220,230,230,0.35)';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(Math.sin(time * 3 + i) * 6, -30 - ((time * 30 + i * 10) % 24), 4 + i, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  },

  // ─── 3. 구리 말벌: 조준선 예고 후 직선 급강하 ───
  wasp: {
    w: 24, h: 20, hp: 18, amber: 7, fly: true, light: 60,
    init(e) { e.st = 'hover'; e.ex.hx = e.x; e.ex.hy = e.y; },
    update(e, dt, S) {
      const p = S.near(e);
      const d = p ? Math.hypot(p.cx - cx(e), p.cy - cy(e)) : 1e9;
      const see = p && d < 380 && S.world.lineClear(cx(e), cy(e), p.cx, p.cy);
      switch (e.st) {
        case 'hover': {
          const tx = p && see ? p.cx + Math.sign(cx(e) - p.cx || 1) * 150 : e.ex.hx + 10;
          const ty = p && see ? p.cy - 130 : e.ex.hy;
          e.vx += (clamp(tx - cx(e), -120, 120) - e.vx) * dt * 2.5;
          e.vy += (clamp(ty - cy(e), -120, 120) - e.vy) * dt * 2.5 + Math.sin(e.t * 9) * 8;
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (see && e.t > 1.4) { go(e, 'aim'); e.ex.tx = p.cx; e.ex.ty = p.cy; }
          break;
        }
        case 'aim':
          e.vx *= 0.85; e.vy *= 0.85;
          if (p && e.t < 0.45) { e.ex.tx = p.cx; e.ex.ty = p.cy; }
          if (e.t > 0.8) {
            const a = Math.atan2(e.ex.ty - cy(e), e.ex.tx - cx(e));
            e.vx = Math.cos(a) * 500; e.vy = Math.sin(a) * 500;
            go(e, 'dive');
            S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) });
          }
          break;
        case 'dive':
          if (e.t > 0.5) go(e, 'recover');
          break;
        case 'recover':
          e.vx *= Math.pow(0.04, dt); e.vy *= Math.pow(0.04, dt);
          if (e.t > 0.9) go(e, 'hover');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      const r = flyPhys(e, S, dt);
      if (r.hitX) e.vx *= -0.3;
      if (r.hitY) e.vy *= -0.3;
    },
    danger: (e) => [body(e, 2)],
    draw(ctx, e, time) {
      // 조준선 예고
      if (e.st === 'aim' && e.ex.tx != null) {
        const k = Math.min(1, e.t / 0.8);
        ctx.strokeStyle = `rgba(255,190,110,${0.15 + k * 0.45})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(cx(e), cy(e));
        const a = Math.atan2(e.ex.ty - cy(e), e.ex.tx - cx(e));
        ctx.lineTo(cx(e) + Math.cos(a) * 260, cy(e) + Math.sin(a) * 260);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.translate(cx(e), cy(e));
      if (e.st === 'aim') ctx.translate(rand(-1.2, 1.2), rand(-1.2, 1.2));
      ctx.scale(e.facing, 1);
      if (e.st === 'dive') ctx.rotate(Math.atan2(e.vy, Math.abs(e.vx)) * 0.7);
      // 날개
      ctx.fillStyle = 'rgba(220,235,240,0.45)';
      const fl = Math.sin(time * 60 + e.id) * 0.5;
      ctx.beginPath();
      ctx.ellipse(-2, -8, 8, 4, -0.5 + fl, 0, Math.PI * 2);
      ctx.ellipse(-6, -7, 7, 3, -0.9 - fl, 0, Math.PI * 2);
      ctx.fill();
      // 몸통
      ff(ctx, e, COPPER2);
      ctx.beginPath();
      ctx.ellipse(-6, 2, 8, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = DARK;
      ctx.fillRect(-10, 0, 2, 5);
      ctx.fillRect(-5, -1, 2, 6);
      ff(ctx, e, '#3a2a1c');
      ctx.beginPath();
      ctx.ellipse(5, -1, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd58a';
      ctx.beginPath();
      ctx.moveTo(-13, 4);
      ctx.lineTo(-18, 7);
      ctx.lineTo(-12, 7);
      ctx.fill();
      ctx.fillStyle = e.st === 'aim' ? '#ff8040' : '#9fe8d8';
      ctx.fillRect(7, -3, 2.5, 2.5);
      ctx.restore();
    },
  },

  // ─── 4. 불꽃 포자꽃: 부풀어오른 뒤 천천히 떠오르는 포자 3개 ───
  bloom: {
    w: 26, h: 28, hp: 20, amber: 6, static: true, light: 80,
    init(e) { e.st = 'idle'; e.t = Math.random(); },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'idle':
          if (p && e.t > 2.4 && Math.abs(p.cx - cx(e)) < 460) go(e, 'swell');
          break;
        case 'swell':
          if (e.t > 0.7) {
            for (const vx of [-55, 0, 55]) S.proj('spore', cx(e), e.y + 4, vx, -75, { life: 3.6 });
            S.ev('sfx', { s: 'shoot', x: cx(e), y: cy(e), p: 0.6 });
            go(e, 'idle');
          }
          break;
      }
      groundPhys(e, S, dt);
      e.vx = 0;
    },
    danger: (e) => [body(e, 4)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      const sw = e.st === 'swell' ? 1 + Math.min(1, e.t / 0.7) * 0.35 : 1 + Math.sin(time * 2 + e.id) * 0.04;
      ctx.strokeStyle = '#2a3a1c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-4, -8, 0, -14);
      ctx.stroke();
      ctx.fillStyle = '#1e2e16';
      ctx.beginPath();
      ctx.ellipse(-7, -4, 7, 3, -0.4, 0, Math.PI * 2);
      ctx.ellipse(7, -5, 7, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, -18);
      ctx.scale(sw, sw);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + time * 0.3;
        ctx.fillStyle = e.fl > 0 ? '#fff' : '#a8401e';
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 6, 3.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,190,90,${e.st === 'swell' ? 0.95 : 0.7})`;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  // ─── 5. 바람 정령: 소용돌이 예고 후 밀어내는 돌풍(피해 없음) + 깃털 2발 ───
  gale: {
    w: 28, h: 28, hp: 24, amber: 8, fly: true, light: 70,
    init(e) { e.st = 'drift'; e.ex.n = 0; },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'drift': {
          if (p) {
            const want = p.cx + Math.sign(cx(e) - p.cx || 1) * 230;
            e.vx += (clamp(want - cx(e), -90, 90) - e.vx) * dt * 2;
            e.vy += (clamp(p.cy - 110 - cy(e), -90, 90) - e.vy) * dt * 2;
            e.facing = Math.sign(p.cx - cx(e)) || 1;
            if (e.t > 2.6 && Math.abs(p.cx - cx(e)) < 420) go(e, 'wind');
          } else {
            e.vx *= 0.95;
            e.vy = Math.sin(e.t * 2) * 30;
          }
          break;
        }
        case 'wind':
          e.vx *= 0.9; e.vy *= 0.9;
          if (e.t > 0.75) {
            e.ex.n++;
            if (e.ex.n % 2) S.proj('gust', cx(e), cy(e), e.facing * 230, 0, { life: 2.2 });
            else if (p) {
              for (const da of [-0.12, 0.12]) {
                const a = Math.atan2(p.cy - cy(e), p.cx - cx(e)) + da;
                S.proj('thorn', cx(e), cy(e), Math.cos(a) * 260, Math.sin(a) * 260, { life: 2.5, feather: 1 });
              }
            }
            S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e), p: 1.3 });
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
      const w = e.st === 'wind' ? Math.min(1, e.t / 0.75) : 0;
      ctx.strokeStyle = `rgba(220,240,255,${0.35 + w * 0.5})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 10 + i * 5 + w * 6, time * (4 + i * 2) + i, time * (4 + i * 2) + i + 2.2);
        ctx.stroke();
      }
      ff(ctx, e, '#dfe8ee');
      ctx.globalAlpha *= 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a3a48';
      ctx.fillRect(e.facing * 2 - 3, -2, 2, 3);
      ctx.fillRect(e.facing * 2 + 2, -2, 2, 3);
      ctx.restore();
    },
  },

  // ─── 6. 재의 근위병 (정예): 창 던지기, 돌진 찌르기, 막기 후 밀치기 ───
  ashknight: {
    w: 32, h: 50, hp: 80, amber: 30, elite: true,
    init(e) { e.st = 'walk'; },
    update(e, dt, S) {
      const p = S.near(e);
      const dx = p ? p.cx - cx(e) : 0;
      const near = p && Math.abs(p.cy - cy(e)) < 140;
      switch (e.st) {
        case 'walk':
          e.vx = 0;
          if (p && near) {
            e.facing = Math.sign(dx) || 1;
            const ad = Math.abs(dx);
            if (ad > 140) e.vx = blockedAhead(e, S) ? 0 : e.facing * 80;
            if (e.t > 1.1) {
              const r = Math.random();
              if (ad > 220 && r < 0.6) go(e, 'twind');
              else if (ad <= 220 && r < 0.5) go(e, 'lwind');
              else if (r < 0.8) go(e, 'guard');
              else go(e, 'twind');
            }
          }
          break;
        case 'twind':
          e.vx = 0;
          if (p && e.t < 0.4) e.facing = Math.sign(dx) || e.facing;
          if (e.t > 0.8) {
            S.proj('spear', cx(e) + e.facing * 20, e.y + 18, e.facing * 430, 0, { life: 2.2 });
            S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e) });
            go(e, 'rest');
          }
          break;
        case 'lwind':
          e.vx = 0;
          if (e.t > 0.65) { go(e, 'lunge'); e.vx = e.facing * 420; S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) }); }
          break;
        case 'lunge':
          if (blockedAhead(e, S)) e.vx = 0;
          if (e.t > 0.3) go(e, 'rest');
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
          if (e.t > 0.8) go(e, 'walk');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      groundPhys(e, S, dt);
    },
    blocks: (e, fromX) => e.st === 'guard' && Math.sign(fromX - cx(e)) === e.facing,
    onBlock(e) { if (e.st === 'guard') { e.st = 'bash'; e.t = 0; } },
    danger(e) {
      const b = [body(e, 4)];
      if (e.st === 'lunge' && e.t < 0.28) b.push(rectFront(e, -4, 44, 12, -4));
      if (e.st === 'bash' && e.t > 0.45 && e.t < 0.7) b.push(rectFront(e, -10, 22, 40, 0));
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const wind = e.st === 'twind' || e.st === 'lwind' || (e.st === 'bash' && e.t < 0.45);
      // 재 망토
      ctx.fillStyle = '#1c1414';
      ctx.beginPath();
      ctx.moveTo(-6, -44);
      ctx.quadraticCurveTo(-24, -22, -18 + Math.sin(time * 3) * 2, 0);
      ctx.lineTo(-2, -4);
      ctx.fill();
      ff(ctx, e, '#3a302c');
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-14, -32);
      ctx.quadraticCurveTo(-10, -46, 0, -48);
      ctx.quadraticCurveTo(12, -46, 12, -32);
      ctx.lineTo(11, 0);
      ctx.fill();
      // 투구 깃
      ctx.fillStyle = '#c45a3a';
      ctx.beginPath();
      ctx.moveTo(-2, -48);
      ctx.quadraticCurveTo(-14, -60, -20, -52);
      ctx.quadraticCurveTo(-10, -54, -4, -46);
      ctx.fill();
      ctx.fillStyle = wind ? '#ff8040' : '#ffcf8a';
      ctx.fillRect(3, -40, 8, 2.5);
      // 창
      if (e.st !== 'rest' || e.t > 0.4) {
        let ang = -0.2, off = 0;
        if (e.st === 'twind') { ang = -0.35; off = -10 * Math.min(1, e.t / 0.5); }
        if (e.st === 'lwind') off = -8 * Math.min(1, e.t / 0.5);
        if (e.st === 'lunge') { ang = 0; off = 14; }
        ctx.save();
        ctx.translate(4 + off, -24);
        ctx.rotate(ang);
        ctx.fillStyle = e.fl > 0 ? '#fff' : '#9a8f80';
        ctx.fillRect(-14, -1.5, 50, 3);
        ctx.fillStyle = '#e0d6c0';
        ctx.beginPath();
        ctx.moveTo(36, -4);
        ctx.lineTo(46, 0);
        ctx.lineTo(36, 4);
        ctx.fill();
        ctx.restore();
      }
      if (e.st === 'guard' || e.st === 'bash') {
        if (e.st === 'bash') ctx.translate(e.t < 0.45 ? -4 * (e.t / 0.45) : 6, 0);
        ctx.fillStyle = e.st === 'bash' && e.t < 0.45 ? '#6a4a2a' : '#4a3a30';
        ctx.fillRect(12, -44, 7, 36);
        ctx.fillStyle = 'rgba(255,200,140,0.4)';
        ctx.fillRect(17, -44, 2, 36);
      }
      ctx.restore();
    },
  },
};
