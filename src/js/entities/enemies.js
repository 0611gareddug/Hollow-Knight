// 일반 몹 8종 (오리지널): 행동, 공격 판정, 그리기
import { go, groundPhys, flyPhys, blockedAhead, cx, cy, rectFront } from './common.js';
import { clamp, rand } from '../core/util.js';

const body = (e, s0 = 2) => { const s = s0 + 2; return { x: e.x + s, y: e.y + s + 2, w: e.w - s * 2, h: e.h - s * 2 - 2 }; };
const C = {
  shell: '#0e1215',
  shell2: '#1a2126',
  pale: '#d8d2c2',
  amber: '#ffb347',
  teal: '#5fe0c6',
  red: '#e0505a',
};

function flashFill(ctx, e, color) {
  ctx.fillStyle = e.fl > 0 ? '#ffffff' : color;
}

export const ENEMIES = {
  // ─── 1. 심지벌레: 등에 촛불 심지를 단 애벌레 ───
  crawler: {
    w: 30, h: 20, hp: 10, amber: 3, light: 70,
    init(e) { e.st = 'walk'; e.speed = e.ex.minion ? 110 : 62; },
    update(e, dt, S) {
      if (e.kb > 0) { e.kb -= dt; } else {
        if (e.grounded && blockedAhead(e, S)) e.facing *= -1;
        e.vx = e.facing * e.speed;
        if (e.ex.minion) {
          const p = S.near(e);
          if (p && Math.abs(p.cx - cx(e)) > 40 && e.t > 0.6) { e.facing = Math.sign(p.cx - cx(e)) || 1; e.t = 0; }
        }
      }
      groundPhys(e, S, dt);
    },
    danger: (e) => [body(e, 3)],
    draw(ctx, e, time) {
      const x = cx(e), y = e.y + e.h;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(e.facing, 1);
      const w = Math.sin(time * 10 + e.id) * 1.5;
      flashFill(ctx, e, C.shell);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(-10 + i * 7, -8 - (i === 3 ? 2 : 0) + (i % 2 ? w : -w) * 0.4, 7 + (i === 3 ? 1 : 0), 7.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = e.fl > 0 ? '#fff' : C.shell2;
      for (let i = 0; i < 3; i++) ctx.fillRect(-12 + i * 7, -15, 2, 6);
      // 다리
      ctx.fillStyle = C.shell;
      for (let i = 0; i < 4; i++) ctx.fillRect(-11 + i * 7 + Math.sin(time * 14 + i) * 1.5, -2, 2, 2);
      // 눈
      ctx.fillStyle = C.pale;
      ctx.fillRect(13, -10, 2.4, 2.4);
      // 심지 + 불꽃
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -15);
      ctx.lineTo(-4, -21);
      ctx.stroke();
      const fl = 1 + Math.sin(time * 20 + e.id) * 0.15;
      ctx.fillStyle = C.amber;
      ctx.beginPath();
      ctx.ellipse(-4, -24, 2.6 * fl, 4.2 * fl, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.ellipse(-4, -23, 1.1, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  // ─── 2. 갑각 파수꾼: 방패와 창을 든 보병 ───
  guard: {
    w: 28, h: 44, hp: 25, amber: 8,
    init(e) { e.st = 'walk'; },
    update(e, dt, S) {
      const p = S.near(e);
      const see = p && Math.abs(p.cx - cx(e)) < 240 && Math.abs(p.cy - cy(e)) < 70;
      switch (e.st) {
        case 'walk':
          if (e.kb <= 0) {
            if (e.grounded && blockedAhead(e, S)) e.facing *= -1;
            e.vx = e.facing * 45;
          }
          if (see) { e.facing = Math.sign(p.cx - cx(e)) || 1; go(e, 'wind'); e.vx = 0; }
          break;
        case 'wind':
          e.vx = 0;
          if (e.t > 0.62) { go(e, 'thrust'); e.vx = e.facing * 380; }
          break;
        case 'thrust':
          e.vx *= Math.pow(0.02, dt);
          if (blockedAhead(e, S)) e.vx = 0;
          if (e.t > 0.28) { go(e, 'recover'); }
          break;
        case 'recover':
          e.vx = 0;
          if (e.t > 0.65) go(e, see ? 'wind' : 'walk');
          if (see) e.facing = Math.sign(p.cx - cx(e)) || 1;
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      groundPhys(e, S, dt);
    },
    // 정면 옆베기는 방패로 막음
    blocks: (e, fromX, dir) => dir === 'side' && Math.sign(fromX - cx(e)) === e.facing && e.st !== 'thrust',
    danger(e) {
      const b = [body(e, 3)];
      if (e.st === 'thrust' && e.t < 0.24) b.push(rectFront(e, 0, 46, 10, 2));
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const wind = e.st === 'wind' ? Math.min(1, e.t / 0.5) : 0;
      ctx.translate(-wind * 4, 0);
      // 몸통
      flashFill(ctx, e, C.shell);
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.lineTo(-13, -26);
      ctx.quadraticCurveTo(-8, -40, 2, -38);
      ctx.quadraticCurveTo(12, -34, 10, -20);
      ctx.lineTo(9, 0);
      ctx.closePath();
      ctx.fill();
      // 투구 뿔
      ctx.beginPath();
      ctx.moveTo(-6, -37);
      ctx.quadraticCurveTo(-2, -52, 8, -50);
      ctx.quadraticCurveTo(0, -46, 2, -38);
      ctx.fill();
      // 눈
      ctx.fillStyle = e.st === 'wind' ? C.amber : C.pale;
      ctx.fillRect(4, -31, 4, 3);
      // 창
      const thr = e.st === 'thrust' ? 18 : -wind * 6;
      ctx.strokeStyle = e.fl > 0 ? '#fff' : '#9c9585';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6 + thr, -18);
      ctx.lineTo(34 + thr, -18);
      ctx.stroke();
      ctx.fillStyle = '#cfc8b6';
      ctx.beginPath();
      ctx.moveTo(34 + thr, -21);
      ctx.lineTo(44 + thr, -18);
      ctx.lineTo(34 + thr, -15);
      ctx.fill();
      // 방패
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#2a3238';
      ctx.beginPath();
      ctx.ellipse(10, -20, 6, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4b5a60';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    },
  },

  // ─── 3. 떠도는 등롱나방: 빛나는 배를 가진 큰 나방 ───
  moth: {
    w: 26, h: 22, hp: 15, amber: 5, fly: true, light: 120,
    init(e) { e.st = 'idle'; e.home = { x: e.x, y: e.y }; },
    update(e, dt, S) {
      const p = S.near(e);
      const d = p ? Math.hypot(p.cx - cx(e), p.cy - cy(e)) : 9999;
      const see = p && d < 340 && S.world.lineClear(cx(e), cy(e), p.cx, p.cy);
      switch (e.st) {
        case 'idle':
          e.vx = Math.sin(e.t * 1.3 + e.id) * 40;
          e.vy = Math.cos(e.t * 2.1 + e.id) * 30;
          if (see) go(e, 'chase');
          break;
        case 'chase': {
          if (!p) { go(e, 'idle'); break; }
          const a = Math.atan2(p.cy - cy(e) - 20, p.cx - cx(e));
          e.vx += (Math.cos(a) * 110 - e.vx) * dt * 2;
          e.vy += (Math.sin(a) * 110 - e.vy) * dt * 2 + Math.sin(e.t * 6) * 6;
          e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (d < 210 && e.t > 0.8) { go(e, 'wind'); e.ex.tx = p.cx; e.ex.ty = p.cy; }
          if (!see && e.t > 3) go(e, 'idle');
          break;
        }
        case 'wind':
          e.vx *= 0.9; e.vy *= 0.9;
          if (p && e.t < 0.45) { e.ex.tx = p.cx; e.ex.ty = p.cy; }
          if (e.t > 0.85) {
            const a = Math.atan2(e.ex.ty - cy(e), e.ex.tx - cx(e));
            e.vx = Math.cos(a) * 450; e.vy = Math.sin(a) * 450;
            go(e, 'charge');
          }
          break;
        case 'charge':
          if (e.t > 0.45) go(e, 'recover');
          break;
        case 'recover':
          e.vx *= Math.pow(0.05, dt); e.vy *= Math.pow(0.05, dt);
          if (e.t > 0.7) go(e, 'chase');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      const r = flyPhys(e, S, dt);
      if (r.hitX) e.vx = -e.vx * 0.3;
      if (r.hitY) e.vy = -e.vy * 0.3;
    },
    danger: (e) => [body(e, 3)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), cy(e));
      const wind = e.st === 'wind';
      if (wind) ctx.translate(rand(-1.5, 1.5), rand(-1.5, 1.5));
      ctx.scale(e.facing, 1);
      const flap = Math.sin(time * (e.st === 'charge' ? 40 : 18) + e.id);
      flashFill(ctx, e, '#1d2328');
      // 날개
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.scale(1, s);
        ctx.rotate(-0.2 + flap * 0.45);
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.quadraticCurveTo(-18, -26, -4, -24);
        ctx.quadraticCurveTo(10, -22, 6, -2);
        ctx.fill();
        ctx.restore();
      }
      // 몸 + 빛나는 배
      ctx.fillStyle = e.fl > 0 ? '#fff' : C.shell;
      ctx.beginPath();
      ctx.ellipse(2, -2, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      const glow = wind ? 1 : 0.7 + Math.sin(time * 4 + e.id) * 0.2;
      ctx.fillStyle = `rgba(255,${wind ? 120 : 180},80,${glow})`;
      ctx.beginPath();
      ctx.ellipse(-6, 3, 6, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.pale;
      ctx.fillRect(7, -4, 2, 2);
      ctx.restore();
    },
  },

  // ─── 4. 물방울 포식자: 천장에 매달려 있다가 떨어짐 ───
  dropper: {
    w: 26, h: 26, hp: 15, amber: 6,
    init(e, S) {
      e.st = 'hang';
      // 위쪽 천장 찾기
      let y = e.y;
      while (y > 0 && !S.world.solidAt(cx(e), y - 2)) y -= 8;
      e.y = y;
      e.ex.ay = y;
    },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'hang':
          e.vx = 0; e.vy = 0;
          if (p && Math.abs(p.cx - cx(e)) < 46 && p.cy > e.y && p.cy - e.y < 500 && S.world.lineClear(cx(e), e.y + e.h + 2, p.cx, p.cy)) go(e, 'shiver');
          return;
        case 'shiver':
          if (e.t > 0.45) go(e, 'drop');
          return;
        case 'drop':
          groundPhys(e, S, dt);
          if (e.grounded) {
            go(e, 'land');
            S.proj('puddle', cx(e), e.y + e.h, 0, 0, { life: 2.6 });
            S.ev('splash', { x: cx(e), y: e.y + e.h });
          }
          return;
        case 'land':
          e.vx = 0;
          if (e.t > 0.5) go(e, 'crawl');
          break;
        case 'crawl':
          if (e.kb <= 0) {
            if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
            if (blockedAhead(e, S)) e.vx = 0;
            else e.vx = e.facing * 75;
            if (p && e.grounded && e.t > 1.4 && Math.abs(p.cx - cx(e)) < 160) {
              e.vy = -520;
              e.vx = e.facing * 200;
              e.t = 0;
            }
          }
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      groundPhys(e, S, dt);
    },
    danger: (e) => [body(e, 3)],
    draw(ctx, e, time) {
      const x = cx(e);
      ctx.save();
      if (e.st === 'hang' || e.st === 'shiver') {
        const sw = Math.sin(time * 2 + e.id) * 2 + (e.st === 'shiver' ? rand(-2, 2) : 0);
        ctx.strokeStyle = '#2a3a3e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, e.ex.ay || e.y);
        ctx.lineTo(x + sw, e.y + 6);
        ctx.stroke();
        ctx.translate(x + sw, e.y + e.h / 2 + 4);
      } else {
        ctx.translate(x, e.y + e.h / 2);
        ctx.scale(e.facing, 1);
      }
      const sq = e.st === 'land' ? 1 - Math.max(0, 0.3 - e.t) : 1;
      ctx.scale(1 / sq, sq);
      // 물방울 몸
      flashFill(ctx, e, '#10292c');
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.bezierCurveTo(10, -6, 14, 4, 0, 13);
      ctx.bezierCurveTo(-14, 4, -10, -6, 0, -15);
      ctx.fill();
      ctx.fillStyle = `rgba(95,224,198,${0.35 + Math.sin(time * 3 + e.id) * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(0, 3, 6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // 이빨
      ctx.fillStyle = C.pale;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3 - 1, 9);
        ctx.lineTo(i * 3, 13);
        ctx.lineTo(i * 3 + 1, 9);
        ctx.fill();
      }
      ctx.fillStyle = C.teal;
      ctx.fillRect(-4, -4, 2, 2);
      ctx.fillRect(2, -4, 2, 2);
      ctx.restore();
    },
  },

  // ─── 5. 가시뿌리 덩굴: 벽에 붙은 포탑 ───
  vine: {
    w: 26, h: 30, hp: 20, amber: 6, static: true,
    init(e) { e.st = 'hide'; e.facing = e.ex.dir || 1; },
    update(e, dt, S) {
      const p = S.near(e);
      const inRange = p && Math.abs(p.cx - cx(e)) < 420 && Math.abs(p.cy - cy(e)) < 260;
      switch (e.st) {
        case 'hide':
          if (inRange && e.t > 1.5) go(e, 'rise');
          break;
        case 'rise':
          if (e.t > 0.4) {
            go(e, 'shoot');
            const base = e.facing > 0 ? 0 : Math.PI;
            let aim = base;
            if (p) aim = Math.atan2(p.cy - cy(e), p.cx - cx(e));
            aim = clamp(aim - base, -0.6, 0.6) + base;
            for (const da of [-0.32, 0, 0.32]) S.proj('thorn', cx(e) + e.facing * 8, cy(e), Math.cos(aim + da) * 300, Math.sin(aim + da) * 300, { life: 2.5 });
            S.ev('sfx', { s: 'shoot', x: cx(e), y: cy(e) });
          }
          break;
        case 'shoot':
          if (e.t > 1.0) go(e, 'hide');
          break;
      }
    },
    blocks: (e) => e.st === 'hide',
    danger: (e) => (e.st === 'hide' ? [] : [body(e, 4)]),
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(e.facing > 0 ? e.x : e.x + e.w, cy(e));
      ctx.scale(e.facing, 1);
      const out = e.st === 'hide' ? 0.15 : e.st === 'rise' ? Math.min(1, e.t / 0.3) : 1;
      // 뿌리 덩어리
      ctx.fillStyle = '#0c1a14';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#183026';
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 10);
        ctx.quadraticCurveTo(-6, i * 18, -2, i * 26);
        ctx.stroke();
      }
      // 머리 (꽃봉오리)
      ctx.translate(out * 18, 0);
      flashFill(ctx, e, '#173a2b');
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 9 + out * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      if (out > 0.5) {
        ctx.fillStyle = e.st === 'rise' ? C.red : '#a8304a';
        ctx.beginPath();
        ctx.ellipse(6, 0, 4, 6 * out, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#b9c9a0';
      for (let i = 0; i < 5; i++) {
        const a = -1.2 + i * 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(a + 0.2) * 9, Math.sin(a + 0.2) * 9);
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // ─── 6. 도약 개구리기사: 크게 뛰어 내려찍고 충격파 ───
  frog: {
    w: 36, h: 34, hp: 35, amber: 10,
    init(e) { e.st = 'idle'; },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'idle':
          e.vx = 0;
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (p && e.t > 1.0 && Math.abs(p.cx - cx(e)) < 420 && Math.abs(p.cy - cy(e)) < 200) go(e, 'crouch');
          break;
        case 'crouch':
          if (e.t > 0.56) {
            const dx = p ? p.cx - cx(e) : e.facing * 100;
            e.vx = clamp(dx / 0.7, -440, 440);
            e.vy = -840;
            e.grounded = false;
            go(e, 'leap');
            S.ev('sfx', { s: 'jump', x: cx(e), y: e.y });
          }
          break;
        case 'leap':
          if (e.t > 0.1 && e.grounded) {
            e.vx = 0;
            go(e, 'land');
            for (const d of [-1, 1]) S.proj('wave', cx(e) + d * 20, e.y + e.h, d * 320, 0, { life: 0.8 });
            S.ev('slam', { x: cx(e), y: e.y + e.h, m: 5 });
          }
          break;
        case 'land':
          if (e.t > 0.7) go(e, 'idle');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      const res = groundPhys(e, S, dt);
      if (res.hitX && e.st === 'leap') e.vx = 0;
    },
    danger: (e) => [body(e, 4)],
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      let sy = 1;
      if (e.st === 'crouch') sy = 1 - Math.min(1, e.t / 0.4) * 0.3;
      if (e.st === 'land') sy = 0.75 + Math.min(1, e.t / 0.3) * 0.25;
      if (e.st === 'leap') sy = 1.15;
      ctx.scale(1 / Math.sqrt(sy), sy);
      flashFill(ctx, e, '#13242a');
      // 뒷다리
      ctx.beginPath();
      ctx.ellipse(-10, -8, 12, 9, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // 몸
      ctx.beginPath();
      ctx.ellipse(2, -18, 16, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      // 투구
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#33454a';
      ctx.beginPath();
      ctx.arc(8, -26, 10, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-2, -27, 20, 3);
      // 눈
      ctx.fillStyle = e.st === 'crouch' ? C.amber : C.teal;
      ctx.fillRect(10, -24, 4, 3);
      // 앞다리
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#13242a';
      ctx.fillRect(10, -8, 5, 8);
      ctx.restore();
    },
  },

  // ─── 7. 재의 수도승: 순간이동 후 불씨탄 3연발 ───
  monk: {
    w: 26, h: 44, hp: 30, amber: 12, light: 90,
    init(e) { e.st = 'idle'; },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'idle':
          e.vx = 0;
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (p && e.t > 1.1 && Math.abs(p.cx - cx(e)) < 520 && Math.abs(p.cy - cy(e)) < 300) go(e, 'vanish');
          break;
        case 'vanish':
          if (e.t > 0.4) {
            // 플레이어 근처 지면으로 순간이동
            if (p) {
              for (let tries = 0; tries < 12; tries++) {
                const nx = p.cx + (Math.random() < 0.5 ? -1 : 1) * rand(170, 280) - e.w / 2;
                let ny = p.y + p.h - e.h - 2;
                const room = S.room;
                if (nx < room.px + 40 || nx > room.px + room.pw - 60) continue;
                // 아래로 지면 찾기
                let ok = false;
                for (let k = 0; k < 14; k++) {
                  if (S.world.rectSolid(nx, ny, e.w, e.h)) break;
                  if (S.world.rectSolid(nx, ny + 4, e.w, e.h)) { ok = true; break; }
                  ny += 16;
                }
                if (ok) {
                  S.ev('smoke', { x: cx(e), y: cy(e) });
                  e.x = nx;
                  e.y = ny;
                  break;
                }
              }
            }
            go(e, 'appear');
            S.ev('smoke', { x: cx(e), y: cy(e), s: 'teleport' });
          }
          break;
        case 'appear':
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (e.t > 0.45) { go(e, 'cast'); e.ex.n = 0; }
          break;
        case 'cast':
          if (e.t > 0.5 + e.ex.n * 0.34 && e.ex.n < 3) {
            e.ex.n++;
            const tx = p ? p.cx : cx(e) + e.facing * 100, ty = p ? p.cy : cy(e);
            const a = Math.atan2(ty - (e.y + 14), tx - cx(e));
            S.proj('orb', cx(e) + e.facing * 12, e.y + 14, Math.cos(a) * 240, Math.sin(a) * 240, { life: 3 });
            S.ev('sfx', { s: 'shoot', x: cx(e), y: e.y });
          }
          if (e.t > 1.7) go(e, 'idle');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      if (e.st !== 'vanish' || e.t < 0.3) groundPhys(e, S, dt);
      if (e.kb <= 0) e.vx = 0;
    },
    danger: (e) => (e.st === 'vanish' && e.t > 0.25 ? [] : [body(e, 4)]),
    draw(ctx, e, time) {
      let a = 1;
      if (e.st === 'vanish') a = 1 - Math.min(1, e.t / 0.35);
      if (e.st === 'appear') a = Math.min(1, e.t / 0.25);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const hov = Math.sin(time * 3 + e.id) * 1.5;
      flashFill(ctx, e, '#1a1420');
      // 로브
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.quadraticCurveTo(-14, -30, -4, -40 + hov);
      ctx.quadraticCurveTo(8, -44 + hov, 10, -30);
      ctx.lineTo(13, 0);
      ctx.lineTo(6, -4);
      ctx.lineTo(0, 0);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
      // 두건 속 얼굴
      ctx.fillStyle = '#050307';
      ctx.beginPath();
      ctx.ellipse(3, -33 + hov, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.st === 'cast' ? '#ffd27a' : '#c8a2e8';
      ctx.fillRect(3, -34 + hov, 3, 2);
      // 향로 (손에 든 불씨)
      const glow = e.st === 'cast' ? 1 : 0.6;
      ctx.fillStyle = `rgba(255,150,70,${glow})`;
      ctx.beginPath();
      ctx.arc(13, -22 + hov, e.st === 'cast' ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  // ─── 8. 녹슨 갑옷 기사: 정예. 3연타, 돌진베기, 막기 후 반격 ───
  knight: {
    w: 34, h: 52, hp: 70, amber: 25, elite: true,
    init(e) { e.st = 'walk'; e.ex.combo = 0; },
    update(e, dt, S) {
      const p = S.near(e);
      const dx = p ? p.cx - cx(e) : 0;
      const near = p && Math.abs(p.cy - cy(e)) < 120;
      switch (e.st) {
        case 'walk':
          if (p && near) {
            e.facing = Math.sign(dx) || 1;
            if (Math.abs(dx) > 120) {
              e.vx = blockedAhead(e, S) ? 0 : e.facing * 95;
              if (Math.abs(dx) > 220 && Math.abs(dx) < 420 && e.t > 1.2 && Math.random() < 0.02) { go(e, 'dwind'); e.vx = 0; }
            } else {
              e.vx = 0;
              const r = Math.random();
              if (r < 0.55) { go(e, 'swing'); e.ex.combo = 0; }
              else if (r < 0.8) go(e, 'guard');
              else go(e, 'dwind');
            }
          } else e.vx = 0;
          break;
        case 'swing': // 3연타: 예고 0.28 + 휘두름 0.16
          e.vx = 0;
          if (e.t > 0.36 && e.t < 0.4) e.vx = e.facing * 200;
          if (e.t > 0.52) {
            e.ex.combo++;
            if (e.ex.combo >= 3) go(e, 'rest');
            else { e.t = 0.06; if (p) e.facing = Math.sign(dx) || e.facing; }
          }
          if (e.t > 0.36 && e.t < 0.38) S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e) });
          break;
        case 'dwind':
          e.vx = 0;
          if (e.t > 0.72) { go(e, 'dash'); e.vx = e.facing * 480; S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) }); }
          break;
        case 'dash':
          if (blockedAhead(e, S)) e.vx = 0;
          if (e.t > 0.38) go(e, 'rest');
          break;
        case 'guard':
          e.vx = 0;
          if (e.t > 1.1) go(e, 'walk');
          break;
        case 'bash':
          // 예고(방패를 당김) 0.45초 후 짧게 밀치기
          e.vx = e.t > 0.45 && e.t < 0.7 ? e.facing * 260 : 0;
          if (e.t > 1.0) go(e, 'rest');
          break;
        case 'counter':
          e.vx = 0;
          if (e.t > 0.2 && e.t < 0.22) S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e) });
          if (e.t > 0.4) go(e, 'rest');
          break;
        case 'rest':
          e.vx *= 0.8;
          if (e.t > 0.75) go(e, 'walk');
          break;
      }
      if (e.kb > 0) e.kb -= dt;
      groundPhys(e, S, dt);
    },
    blocks(e, fromX, dir) {
      if (e.st === 'guard' && Math.sign(fromX - cx(e)) === e.facing) return true;
      return false;
    },
    onBlock(e) { if (e.st === 'guard') { e.st = 'bash'; e.t = 0; } },
    danger(e) {
      const b = [body(e, 4)];
      if (e.st === 'swing' && e.t > 0.36 && e.t < 0.48) b.push(rectFront(e, -6, 58, 50, -6));
      if (e.st === 'dash' && e.t < 0.36) b.push(rectFront(e, -4, 40, 40, 0));
      if (e.st === 'bash' && e.t > 0.45 && e.t < 0.7) b.push(rectFront(e, -10, 22, 40, 0));
      if (e.st === 'counter' && e.t > 0.2 && e.t < 0.32) b.push(rectFront(e, -6, 64, 54, -6));
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const wind = (e.st === 'swing' && e.t < 0.36) || e.st === 'dwind';
      // 망토
      ctx.fillStyle = '#2a1416';
      ctx.beginPath();
      ctx.moveTo(-6, -46);
      ctx.quadraticCurveTo(-26, -24, -20 + Math.sin(time * 3) * 2, 0);
      ctx.lineTo(-4, -4);
      ctx.fill();
      // 갑옷 몸
      flashFill(ctx, e, '#262b2e');
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(-15, -34);
      ctx.quadraticCurveTo(-12, -48, 0, -50);
      ctx.quadraticCurveTo(14, -48, 14, -34);
      ctx.lineTo(12, 0);
      ctx.closePath();
      ctx.fill();
      // 녹 얼룩
      ctx.fillStyle = 'rgba(140,70,40,0.5)';
      ctx.fillRect(-8, -30, 6, 4);
      ctx.fillRect(4, -18, 5, 6);
      // 투구 틈
      ctx.fillStyle = wind ? '#ff7a40' : '#ffcf8a';
      ctx.fillRect(2, -42, 10, 2.5);
      // 검
      ctx.save();
      ctx.translate(8, -26);
      let ang = -0.6;
      if (wind) ang = -2.2;
      if (e.st === 'swing' && e.t >= 0.36) ang = -2.2 + Math.min(1, (e.t - 0.36) / 0.12) * 3;
      if (e.st === 'dash' || e.st === 'dwind') ang = e.st === 'dash' ? 0 : -2.6;
      if (e.st === 'counter') ang = -2.2 + Math.min(1, e.t / 0.18) * 3;
      if (e.st === 'guard') ang = -1.5;
      ctx.rotate(ang);
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#a39d90';
      ctx.fillRect(0, -2, 42, 4);
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(-6, -4, 6, 8);
      ctx.restore();
      if (e.st === 'guard' || e.st === 'bash') {
        if (e.st === 'bash') ctx.translate(e.t < 0.45 ? -4 * (e.t / 0.45) : 6, 0);
        ctx.fillStyle = e.st === 'bash' && e.t < 0.45 ? '#6a4a2a' : '#39434a';
        ctx.fillRect(12, -44, 6, 34);
        ctx.fillStyle = 'rgba(255,220,150,0.4)';
        ctx.fillRect(16, -44, 2, 34);
      }
      ctx.restore();
    },
  },

  // ─── 보조: 최종 보스의 분신 ───
  shade: {
    w: 26, h: 44, hp: 30, amber: 0, light: 60,
    init(e) { e.st = 'idle'; },
    update(e, dt, S) {
      const p = S.near(e);
      switch (e.st) {
        case 'idle':
          e.vx = 0;
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (e.t > 1.4 + (e.id % 3) * 0.3) go(e, 'wind');
          break;
        case 'wind':
          if (e.t > 0.7) { go(e, 'dash'); e.vx = e.facing * 600; }
          break;
        case 'dash':
          if (blockedAhead(e, S) || e.t > 0.3) { e.vx = 0; go(e, 'idle'); }
          break;
      }
      groundPhys(e, S, dt);
    },
    danger(e) {
      const b = [body(e, 5)];
      if (e.st === 'dash') b.push(rectFront(e, -4, 40, 30));
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const sx = e.st === 'dash' ? 1.3 : 1;
      ctx.scale(sx, 1 / sx);
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#120a18';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(-14, -30, 0, -32);
      ctx.quadraticCurveTo(14, -30, 12, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -38, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.st === 'wind' ? '#ffcf70' : '#b48bd6';
      ctx.fillRect(1, -40, 3, 3);
      ctx.fillRect(-5, -40, 3, 3);
      ctx.restore();
    },
  },
};
