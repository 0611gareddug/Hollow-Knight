// 보스 4종 (오리지널) – 예고 동작이 있는 패턴 + 페이즈 전환
import { go, groundPhys, cx, cy, rectFront } from './common.js';
import { clamp, rand, pick, TILE } from '../core/util.js';

const body = (e, s = 6) => ({ x: e.x + s, y: e.y + s, w: e.w - s * 2, h: e.h - s * 2 });
const ff = (ctx, e, c) => (ctx.fillStyle = e.fl > 0 ? '#ffffff' : c);
const roomL = (S) => S.room.px + TILE * 1.5;
const roomR = (S) => S.room.px + S.room.pw - TILE * 1.5;
const hpFrac = (e) => e.hp / e.maxHp;

function intro(e, dt) {
  if (e.st === 'intro') {
    e.vx = 0;
    if (e.t > 1.9) go(e, 'idle');
    return true;
  }
  return false;
}

// 바닥 바로 위 빈 타일 2줄을 독수로 채움 (모든 피어에서 동일하게 계산)
export function floodTiles(world, room, floorPx) {
  const list = [];
  const fy = Math.round(floorPx / TILE);
  for (let j = fy - 2; j < fy; j++)
    for (let i = room.x + 1; i < room.x + room.w - 1; i++) if (world.get(i, j) === 0) list.push(i, j);
  return list;
}

export const BOSSES = {
  // ════════ 1. 심지의 어미 ════════
  mother: {
    name: '심지의 어미', sub: '둥지를 지키는 촛불 여왕', music: 'boss',
    w: 124, h: 62, hp: 110, amber: 120, light: 220, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.minions = 0; },
    update(e, dt, S) {
      if (intro(e, dt)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      if (!P2 && hpFrac(e) <= 0.5 && e.st !== 'charge') {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1 });
      }
      switch (e.st) {
        case 'roar':
          e.vx = 0;
          if (e.t > 1.1) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          e.vx = e.facing * 45;
          if (e.t > (P2 ? 0.55 : 0.95)) {
            const d = p ? Math.abs(p.cx - cx(e)) : 0;
            const mins = S.count('crawler');
            const r = Math.random();
            if (d > 260 && r < 0.6) go(e, 'cwind');
            else if (r < 0.35) go(e, 'cwind');
            else if (r < 0.62 && mins < 3) go(e, 'bwind');
            else go(e, 'qwind');
            e.vx = 0;
          }
          break;
        }
        case 'cwind':
          e.vx = 0;
          if (p && e.t < 0.4) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (e.t > 0.7) { go(e, 'charge'); e.ex.lastFire = cx(e); S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) }); }
          break;
        case 'charge':
          e.vx = e.facing * (P2 ? 700 : 540);
          if (P2 && Math.abs(cx(e) - e.ex.lastFire) > 50) {
            e.ex.lastFire = cx(e);
            S.proj('fire', cx(e) - e.facing * 50, e.y + e.h, 0, 0, { life: 1.7 });
          }
          break;
        case 'stun':
          e.vx = 0;
          if (e.t > 0.65) { e.facing *= -1; go(e, 'idle'); }
          break;
        case 'bwind':
          e.vx = 0;
          if (e.t > 0.65) {
            for (let i = 0; i < 3; i++) S.spawnEnemy('crawler', cx(e) + (i - 1) * 30, e.y + e.h - 4, { minion: true, hp: 5 });
            S.ev('smoke', { x: cx(e), y: e.y + e.h - 10 });
            go(e, 'idle');
          }
          break;
        case 'qwind':
          e.vx = 0;
          if (e.t > 0.65) {
            go(e, 'slam');
            S.ev('slam', { x: cx(e), y: e.y + e.h, m: 14 });
            const L = roomL(S), R = roomR(S);
            const n = P2 ? 7 : 5;
            const seg = (R - L) / n;
            for (let i = 0; i < n; i++) {
              const x = L + seg * i + rand(10, seg - 10);
              S.proj('rockwarn', x, e.y + e.h, 0, 0, { life: 0.8 + i * 0.05 });
            }
          }
          break;
        case 'slam':
          if (e.t > 0.6) go(e, 'idle');
          break;
      }
      const res = groundPhys(e, S, dt);
      if (e.st === 'charge' && (res.hitX || e.t > 2.6)) {
        go(e, 'stun');
        S.ev('slam', { x: cx(e) + e.facing * 60, y: cy(e), m: 10 });
      }
    },
    danger(e) {
      return [body(e, 8)];
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const P2 = e.ex.p === 2;
      const rear = e.st === 'qwind' ? Math.min(1, e.t / 0.5) : e.st === 'slam' ? Math.max(0, 1 - e.t * 6) : 0;
      const shake = e.st === 'cwind' || e.st === 'roar' ? rand(-2, 2) : 0;
      ctx.translate(shake, 0);
      const wig = e.st === 'charge' ? time * 30 : time * 4;
      // 몸통 마디 (뒤→앞)
      const segs = 6;
      const pts = [];
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const x = -54 + t * 100;
        let y = -24 + Math.sin(wig + i) * 2;
        y -= rear * t * t * 46;
        pts.push([x, y, 22 - Math.abs(t - 0.6) * 10]);
      }
      ff(ctx, e, '#140f0c');
      for (const [x, y, r] of pts) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 다리
      ctx.strokeStyle = '#140f0c';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const [x, y] = pts[i];
        const k = Math.sin(wig * 1.4 + i * 1.3) * 5;
        ctx.beginPath();
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x + k, 0);
        ctx.stroke();
      }
      // 등의 촛불들
      for (let i = 0; i < 5; i++) {
        const [x, y, r] = pts[i];
        ctx.fillStyle = '#d8cfb8';
        ctx.fillRect(x - 3, y - r - 10, 6, 12);
        const fl = 1 + Math.sin(time * 18 + i * 2) * 0.2;
        const big = P2 ? 1.8 : 1;
        ctx.fillStyle = P2 ? '#ff7a2a' : '#ffb347';
        ctx.beginPath();
        ctx.ellipse(x, y - r - 15 * big, 3.5 * fl * big, 7 * fl * big, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.ellipse(x, y - r - 13 * big, 1.5, 3 * big, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 머리
      const [hx, hy] = pts[segs - 1];
      ff(ctx, e, '#1b1410');
      ctx.beginPath();
      ctx.ellipse(hx + 12, hy, 22, 18, -rear * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // 큰턱
      ctx.fillStyle = '#d8cfb8';
      const open = e.st === 'roar' || e.st === 'cwind' ? 0.5 : 0.15;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + 28, hy + s * 4);
        ctx.quadraticCurveTo(hx + 48, hy + s * (10 + open * 20), hx + 40, hy + s * (2 + open * 6));
        ctx.lineTo(hx + 30, hy + s * 1);
        ctx.fill();
      }
      // 눈들
      ctx.fillStyle = e.st === 'cwind' || P2 ? '#ff8040' : '#f2e6c8';
      for (const [ox, oy] of [[16, -8], [24, -4], [20, -12], [26, -10]]) {
        ctx.beginPath();
        ctx.arc(hx + ox, hy + oy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // ════════ 2. 잠긴 종지기 ════════
  bell: {
    name: '잠긴 종지기', sub: '가라앉은 종탑의 마지막 파수', music: 'boss',
    w: 70, h: 92, hp: 200, amber: 200, light: 160, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.bell = 1; e.ex.fcd = 6; e.ex.fl = 0; e.ex.n = 0; },
    update(e, dt, S) {
      if (intro(e, dt)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      // 범람 타이머
      if (e.ex.fl > 0) {
        e.ex.fl -= dt;
        if (e.ex.fl <= 0) S.ev('flood', { on: 0, room: S.room.id, fy: e.ex.floor });
      } else if (e.ex.fcd > 0) e.ex.fcd -= dt;
      if (!e.ex.floor) e.ex.floor = e.y + e.h;

      if (!P2 && hpFrac(e) <= 0.5 && e.grounded && e.st !== 'leap') {
        e.ex.p = 2;
        go(e, 'break');
        S.ev('bellbreak', { x: cx(e), y: e.y + 20 });
      }
      switch (e.st) {
        case 'break':
          e.vx = 0;
          if (e.t > 0.4) e.ex.bell = 0;
          if (e.t > 1.3) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          const d = p ? Math.abs(p.cx - cx(e)) : 0;
          e.vx = d > 160 ? e.facing * 70 : 0;
          if (e.t > (P2 ? 0.5 : 0.85)) {
            const r = Math.random();
            if (!P2 && e.ex.fcd <= 0 && e.ex.fl <= 0) go(e, 'fwind');
            else if (!P2) go(e, r < 0.5 ? 'lwind' : 'toll');
            else go(e, r < 0.4 ? 'swind' : r < 0.7 ? 'lwind' : 'throw');
            e.ex.n = 0;
            e.vx = 0;
          }
          break;
        }
        case 'lwind':
          e.vx = 0;
          if (e.t > 0.5) {
            const dx = p ? p.cx - cx(e) : 0;
            e.vx = clamp(dx / 0.95, -480, 480);
            e.vy = -1080;
            e.grounded = false;
            go(e, 'leap');
          }
          break;
        case 'leap':
          if (e.t > 0.15 && e.grounded) {
            e.vx = 0;
            go(e, 'land');
            for (const d of [-1, 1]) S.proj('wave', cx(e) + d * 30, e.y + e.h, d * 400, 0, { life: 1.1, big: 1 });
            S.ev('slam', { x: cx(e), y: e.y + e.h, m: 14, bell: e.ex.bell });
          }
          break;
        case 'land':
          if (e.t > (P2 ? 0.45 : 0.7)) go(e, 'idle');
          break;
        case 'toll':
          e.vx = 0;
          if (e.t > 0.45 + e.ex.n * 0.6 && e.ex.n < 3) {
            e.ex.n++;
            S.proj('sring', cx(e), e.y + 26, 0, 0, { life: 2.2, gap: rand(-Math.PI, Math.PI) });
            S.ev('sfx', { s: 'bell', x: cx(e), y: e.y });
          }
          if (e.t > 2.4) go(e, 'idle');
          break;
        case 'fwind':
          e.vx = 0;
          if (e.t > 0.9) {
            e.ex.fl = 4.6;
            e.ex.fcd = 11;
            S.ev('flood', { on: 1, room: S.room.id, fy: e.ex.floor });
            S.ev('sfx', { s: 'bell', x: cx(e), y: e.y });
            go(e, 'toll');
            e.ex.n = 1;
          }
          break;
        case 'swind':
          e.vx = 0;
          if (p && e.t < 0.2) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (e.t > 0.36) { go(e, 'sweep'); S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e) }); }
          break;
        case 'sweep':
          e.vx = e.facing * 640;
          if (e.t > 0.42) {
            e.vx = 0;
            e.ex.n++;
            if (e.ex.n < (Math.random() < 0.5 ? 2 : 3)) go(e, 'swind');
            else go(e, 'land');
          }
          break;
        case 'throw':
          e.vx = 0;
          if (e.t > 0.5 && e.ex.n === 0) {
            e.ex.n = 1;
            for (let i = 0; i < 5; i++) {
              const vx = e.facing * (120 + i * 95);
              S.proj('shard', cx(e), e.y + 20, vx, -700 - i * 30, { life: 3, grav: 1500 });
            }
            S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e) });
          }
          if (e.t > 1.0) go(e, 'idle');
          break;
      }
      const res = groundPhys(e, S, dt);
      if (res.hitX && (e.st === 'sweep' || e.st === 'leap')) e.vx = 0;
    },
    danger(e) {
      const b = [body(e, 8)];
      if (e.st === 'sweep') b.push(rectFront(e, -10, 70, 70, 4));
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const crouch = e.st === 'lwind' ? Math.min(1, e.t / 0.4) * 10 : e.st === 'land' ? Math.max(0, 10 - e.t * 40) : 0;
      ctx.translate(0, crouch);
      const P2 = e.ex.p === 2;
      // 다리
      ff(ctx, e, '#101b1f');
      ctx.fillRect(-18, -24, 10, 24);
      ctx.fillRect(6, -24, 10, 24);
      // 몸
      ctx.beginPath();
      ctx.moveTo(-24, -20);
      ctx.quadraticCurveTo(-30, -62, -4, -72);
      ctx.quadraticCurveTo(24, -70, 24, -40);
      ctx.lineTo(20, -20);
      ctx.closePath();
      ctx.fill();
      // 투구
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#22363c';
      ctx.beginPath();
      ctx.ellipse(6, -78, 16, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P2 ? '#ff7a50' : '#7ef0d8';
      ctx.fillRect(10, -80, 10, 3);
      // 종 (등에 짊어짐)
      if (e.ex.bell) {
        const ring = e.st === 'toll' || e.st === 'fwind' ? Math.sin(time * 30) * 0.12 : Math.sin(time * 1.5) * 0.03;
        ctx.save();
        ctx.translate(-18, -76);
        ctx.rotate(ring);
        ctx.fillStyle = e.fl > 0 ? '#fff' : '#3d4a3a';
        ctx.beginPath();
        ctx.moveTo(-6, -22);
        ctx.quadraticCurveTo(-26, -20, -28, 22);
        ctx.lineTo(16, 22);
        ctx.quadraticCurveTo(14, -20, -6, -22);
        ctx.fill();
        ctx.fillStyle = '#617054';
        ctx.fillRect(-28, 18, 44, 5);
        ctx.fillStyle = 'rgba(126,240,216,0.35)';
        ctx.fillRect(-20, -4, 28, 2);
        if (e.st === 'fwind') {
          ctx.fillStyle = `rgba(90,230,210,${0.3 + Math.sin(time * 20) * 0.2})`;
          ctx.beginPath();
          ctx.arc(-6, 4, 26, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        // 깨진 종 조각을 휘두름
        ctx.save();
        ctx.translate(18, -46);
        const sw = e.st === 'sweep' ? -0.2 : e.st === 'swind' ? -1.8 : -1.0;
        ctx.rotate(sw);
        ctx.fillStyle = e.fl > 0 ? '#fff' : '#3d4a3a';
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(54, -14);
        ctx.lineTo(58, 6);
        ctx.lineTo(0, 4);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
  },

  // ════════ 3. 주홍 광대 (숨겨진 보스) ════════
  scarlet: {
    name: '주홍 광대', sub: '관객 없는 무대의 무희', music: 'scarlet',
    w: 38, h: 64, hp: 280, amber: 300, light: 140, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.chain = 0; e.ex.petal = 5; },
    update(e, dt, S) {
      if (intro(e, dt)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      if (!P2 && hpFrac(e) <= 0.5 && e.grounded && e.st !== 'spin') {
        e.ex.p = 2;
        go(e, 'bowP');
        S.ev('phase', { x: cx(e), y: cy(e), stage: 1 });
      }
      if (P2) {
        e.ex.petal -= dt;
        if (e.ex.petal <= 0) {
          e.ex.petal = 7;
          const L = roomL(S), R = roomR(S);
          const n = 14;
          const g1 = Math.floor(rand(1, n - 3));
          for (let i = 0; i < n; i++) {
            if (i === g1 || i === g1 + 1) continue;
            S.proj('petal', L + ((R - L) * (i + 0.5)) / n, S.room.py + TILE * 1.5, 0, 140, { life: 5 });
          }
        }
      }
      const next = () => {
        if (P2 && e.ex.chain < 1 && Math.random() < 0.55) { e.ex.chain++; pickAtk(); }
        else { e.ex.chain = 0; go(e, 'idle'); }
      };
      const pickAtk = () => {
        const d = p ? Math.abs(p.cx - cx(e)) : 0;
        const r = Math.random();
        if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
        if (d < 230 && r < 0.35) go(e, 'rwind');
        else if (r < 0.55) go(e, 'swind');
        else if (r < 0.78) go(e, 'bow');
        else go(e, 'jwind');
        e.vx = 0;
      };
      switch (e.st) {
        case 'bowP':
          e.vx = 0;
          if (e.t > 1.2) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          const d = p ? Math.abs(p.cx - cx(e)) : 0;
          e.vx = d > 260 ? e.facing * 200 : d < 120 ? -e.facing * 160 : 0;
          if (e.t > (P2 ? 0.35 : 0.6)) pickAtk();
          break;
        }
        case 'swind':
          e.vx = 0;
          if (e.t > 0.42) { go(e, 'spin'); e.vx = e.facing * 520; e.ex.b = 0; S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e) }); }
          break;
        case 'spin':
          if (e.t > 1.15) { e.vx = 0; next(); }
          break;
        case 'rwind':
          e.vx = 0;
          if (e.t > 0.45) { go(e, 'ribbon'); S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e), p: 0.7 }); }
          break;
        case 'ribbon':
          if (e.t > (P2 ? 0.55 : 0.3)) next();
          break;
        case 'bow':
          e.vx = 0;
          if (e.t > 0.6) {
            if (Math.random() < 0.6) { go(e, 'thrust'); e.vx = e.facing * 780; S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) }); }
            else { go(e, 'flip'); e.vx = -e.facing * 360; e.vy = -620; e.grounded = false; }
          }
          break;
        case 'thrust':
          if (e.t > 0.32) { e.vx = 0; next(); }
          break;
        case 'flip':
          if (e.t > 0.15 && e.grounded) { e.vx = 0; go(e, 'rwind'); e.t = 0.2; }
          break;
        case 'jwind':
          e.vx = 0;
          if (e.t > 0.35) {
            const dx = p ? p.cx - cx(e) : 0;
            e.vx = clamp(dx / 0.5, -400, 400);
            e.vy = -1150;
            e.grounded = false;
            go(e, 'jump');
          }
          break;
        case 'jump':
          if (e.vy > -50) {
            go(e, 'hang');
            e.vx = 0;
          }
          break;
        case 'hang':
          e.vy = 0;
          if (e.t > 0.25) {
            const tx = p ? p.cx : cx(e), ty = p ? p.cy : e.y + 300;
            const a = Math.atan2(ty - cy(e), tx - cx(e));
            e.vx = Math.cos(a) * 760;
            e.vy = Math.max(200, Math.sin(a) * 760);
            e.facing = Math.sign(e.vx) || 1;
            go(e, 'dive');
            S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) });
          }
          break;
        case 'dive':
          if (e.grounded) {
            e.vx = 0;
            S.ev('slam', { x: cx(e), y: e.y + e.h, m: 8 });
            for (const d of [-1, 1]) S.proj('wave', cx(e) + d * 20, e.y + e.h, d * 330, 0, { life: 0.6 });
            go(e, 'drest');
          }
          break;
        case 'drest':
          if (e.t > 0.45) next();
          break;
      }
      const hang = e.st === 'hang';
      if (hang) {
        S.world.moveBody(e, 0, 0);
      } else if (e.st === 'dive') {
        const r = S.world.moveBody(e, e.vx * dt, e.vy * dt);
        if (r.hitY > 0) e.grounded = true;
        if (r.hitX) e.vx = 0;
      } else {
        const res = groundPhys(e, S, dt);
        if (e.st === 'spin' && res.hitX) {
          e.ex.b++;
          if (e.ex.b > 1) { e.vx = 0; next(); }
          else { e.facing *= -1; e.vx = e.facing * 520; S.ev('slam', { x: cx(e), y: cy(e), m: 4 }); }
        }
        if (e.st === 'thrust' && res.hitX) e.vx = 0;
      }
    },
    danger(e) {
      const b = [body(e, 6)];
      if (e.st === 'spin') b.push({ x: e.x - 22, y: e.y + 4, w: e.w + 44, h: e.h - 8 });
      if (e.st === 'ribbon' && e.t < 0.26) b.push(rectFront(e, -6, 250, 26, -6));
      if (e.st === 'ribbon' && e.ex.p === 2 && e.t > 0.26 && e.t < 0.5) {
        const f = e.facing;
        for (let k = 1; k <= 5; k++) b.push({ x: cx(e) + f * k * 34 - 16, y: e.y - k * 26 + 20, w: 32, h: 26 });
      }
      if (e.st === 'thrust') b.push(rectFront(e, -4, 60, 20, -8));
      if (e.st === 'dive') b.push({ x: e.x - 8, y: e.y, w: e.w + 16, h: e.h + 10 });
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const P2 = e.ex.p === 2;
      if (e.st === 'spin') ctx.rotate(Math.sin(time * 40) * 0.15);
      if (e.st === 'bow' || e.st === 'bowP') ctx.rotate(0.35 * Math.min(1, e.t / 0.3));
      if (e.st === 'dive') ctx.rotate(Math.atan2(e.vy, Math.abs(e.vx)) * 0.6);
      // 리본 다리/치마
      ff(ctx, e, '#1a0508');
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-4, -14);
      ctx.lineTo(2, 0);
      ctx.lineTo(8, -14);
      ctx.lineTo(12, 0);
      ctx.lineTo(14, -18);
      ctx.closePath();
      ctx.fill();
      // 몸통
      ctx.beginPath();
      ctx.moveTo(-12, -18);
      ctx.quadraticCurveTo(-14, -42, 0, -46);
      ctx.quadraticCurveTo(14, -42, 12, -18);
      ctx.fill();
      // 주름 칼라
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#b3243a';
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 4, -46, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 가면
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#efe8dc';
      ctx.beginPath();
      ctx.ellipse(1, -56, 9, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a0508';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(-2, -57, 2.5, Math.PI * 0.1, Math.PI * 0.9, true);
      ctx.arc(5, -57, 2.5, Math.PI * 0.1, Math.PI * 0.9, true);
      ctx.stroke();
      ctx.fillStyle = '#b3243a';
      ctx.beginPath();
      ctx.moveTo(-2, -51);
      ctx.quadraticCurveTo(1, -48, 5, -51);
      ctx.fill();
      // 모자 (두 갈래 + 방울)
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#7a1020';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-6, -63);
        ctx.quadraticCurveTo(s * 14, -78, s * 18, -66 + Math.sin(time * 4 + s) * 3);
        ctx.lineTo(6, -63);
        ctx.fill();
        ctx.fillStyle = '#e2b04a';
        ctx.beginPath();
        ctx.arc(s * 18, -66 + Math.sin(time * 4 + s) * 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = e.fl > 0 ? '#fff' : '#7a1020';
      }
      // 리본 지팡이
      ctx.save();
      ctx.translate(10, -32);
      let ang = -0.4;
      if (e.st === 'rwind') ang = -2.4;
      if (e.st === 'ribbon') ang = -2.4 + Math.min(1, e.t / 0.1) * 2.4;
      if (e.st === 'thrust') ang = 0;
      if (e.st === 'spin') ang = time * 30;
      ctx.rotate(ang);
      ctx.fillStyle = '#d9c9a8';
      ctx.fillRect(0, -1.5, 46, 3);
      ctx.restore();
      // 휘날리는 리본 (공격 판정 시각화)
      if (e.st === 'ribbon') {
        const k = Math.min(1, e.t / 0.12);
        ctx.strokeStyle = '#e0304a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(14, -32);
        for (let i = 1; i <= 10; i++) ctx.lineTo(14 + i * 25 * k, -32 + Math.sin(time * 30 + i) * 6);
        ctx.stroke();
        if (P2 && e.t > 0.26) {
          ctx.beginPath();
          ctx.moveTo(14, -32);
          for (let i = 1; i <= 6; i++) ctx.lineTo(14 + i * 34, -32 - i * 26 + Math.sin(time * 30 + i) * 5);
          ctx.stroke();
        }
      }
      if (e.st === 'rwind' || e.st === 'swind' || e.st === 'jwind' || e.st === 'bow') {
        ctx.fillStyle = `rgba(255,80,90,${0.5 + Math.sin(time * 30) * 0.3})`;
        ctx.fillRect(-2, -58, 3, 3);
        ctx.fillRect(4, -58, 3, 3);
      }
      ctx.restore();
    },
  },

  // ════════ 4. 마지막 등불지기 (최종 보스) ════════
  keeper: {
    name: '마지막 등불지기', sub: '꺼지지 않는 불을 지키는 자', music: 'final',
    w: 30, h: 54, hp: 330, amber: 500, light: 260, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.n = 0; e.ex.icd = 6; },
    update(e, dt, S) {
      if (intro(e, dt)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const ph = e.ex.p;
      const sp = ph === 3 ? 1.3 : ph === 2 ? 1.12 : 1;
      const T = (v) => v / sp;
      if (ph === 1 && hpFrac(e) <= 0.66 && e.grounded) {
        e.ex.p = 2;
        go(e, 'phase');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1 });
        for (const d of [-1, 1]) S.spawnEnemy('shade', cx(e) + d * 140, e.y + e.h - 2, {});
      } else if (ph === 2 && hpFrac(e) <= 0.33 && e.grounded) {
        e.ex.p = 3;
        go(e, 'phase');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1, dark: 1 });
      }
      e.ex.icd -= dt;
      const L = roomL(S), R = roomR(S);
      switch (e.st) {
        case 'phase':
          e.vx = 0;
          if (e.t > 1.3) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          const d = p ? Math.abs(p.cx - cx(e)) : 0;
          e.vx = d > 300 ? e.facing * 240 : d < 90 ? -e.facing * 200 : 0;
          if (e.t > T(0.6)) {
            const r = Math.random();
            if (e.ex.icd <= 0 && r < 0.45) go(e, 'vanish');
            else if (d < 160 && r < 0.5) { go(e, 'swind'); e.ex.n = 0; }
            else if (r < 0.62) go(e, 'dwind');
            else if (r < 0.82) go(e, 'pjump');
            else { go(e, 'lwind'); e.ex.n = 0; }
            e.vx = 0;
          }
          break;
        }
        case 'dwind':
          e.vx = 0;
          if (p && e.t < T(0.15)) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (e.t > T(0.34)) { go(e, 'dash'); e.vx = e.facing * 920; S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) }); }
          break;
        case 'dash':
          if (e.t > 0.26) { e.vx = 0; go(e, 'rest'); }
          break;
        case 'swind':
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          e.vx = p && Math.abs(p.cx - cx(e)) > 80 ? e.facing * 260 : 0;
          if (e.t > T(0.26)) { go(e, 'slash'); e.vx = e.facing * 160; S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e) }); }
          break;
        case 'slash':
          e.vx *= 0.85;
          if (e.t > 0.16) {
            e.ex.n++;
            if (e.ex.n < (ph >= 2 ? 3 : 2)) go(e, 'swind');
            else go(e, 'rest');
          }
          break;
        case 'pjump': {
          if (!e.ex.pjs) {
            e.ex.pjs = 1;
            const dx = p ? p.cx - cx(e) : 0;
            e.vx = clamp(dx / 0.42, -700, 700);
            e.vy = -1050;
            e.grounded = false;
          }
          if (e.vy > -80 && e.t > 0.1) { go(e, 'phang'); e.vx = 0; e.ex.pjs = 0; }
          break;
        }
        case 'phang':
          e.vy = 0;
          if (e.t > T(0.2)) { go(e, 'pdive'); e.vy = 950; S.ev('sfx', { s: 'slash', x: cx(e), y: cy(e) }); }
          break;
        case 'pdive':
          if (e.grounded) {
            S.ev('slam', { x: cx(e), y: e.y + e.h, m: 8 });
            if (ph >= 2) for (const d of [-1, 1]) S.proj('wave', cx(e) + d * 16, e.y + e.h, d * 360, 0, { life: 0.7 });
            go(e, 'rest');
          }
          break;
        case 'lwind':
          e.vx = 0;
          if (e.t > T(0.45) && e.ex.n < (ph === 3 ? 3 : 1)) {
            const tx = p ? p.cx + rand(-60, 60) : cx(e);
            const fl = 0.85;
            S.proj('lantern', cx(e), e.y + 6, (tx - cx(e)) / fl, -560, { life: 3, grav: 1400 });
            S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e), p: 1.3 });
            e.ex.n++;
            e.t = T(0.25);
          }
          if (e.ex.n >= (ph === 3 ? 3 : 1) && e.t > T(0.7)) go(e, 'rest');
          break;
        case 'vanish':
          e.vx = 0;
          if (e.t > 0.3) {
            S.ev('smoke', { x: cx(e), y: cy(e) });
            const pl = p ? p.cx : (L + R) / 2;
            e.x = (pl > (L + R) / 2 ? L + 10 : R - 10 - e.w);
            e.facing = pl > cx(e) ? 1 : -1;
            e.ex.iy = e.y + e.h;
            go(e, 'iwind');
            S.ev('issenWarn', { y: e.y + e.h, l: S.room.px, r: S.room.px + S.room.pw });
          }
          break;
        case 'iwind':
          e.vx = 0;
          if (e.t > T(1.05)) {
            go(e, 'issen');
            S.ev('issen', { y: e.y + e.h, l: S.room.px, r: S.room.px + S.room.pw });
            e.x = e.facing > 0 ? R - 10 - e.w : L + 10;
            e.facing *= -1;
          }
          break;
        case 'issen':
          if (e.t > 0.14) { go(e, 'rest'); e.ex.icd = ph === 3 ? 5 : 8; }
          break;
        case 'rest':
          e.vx *= 0.8;
          if (e.t > T(0.5)) go(e, 'idle');
          break;
      }
      if (e.st === 'phang' || e.st === 'issen' || e.st === 'vanish' || e.st === 'iwind') {
        if (e.st !== 'phang') groundPhys(e, S, dt);
      } else {
        const res = groundPhys(e, S, dt);
        if (res.hitX && e.st === 'dash') e.vx = 0;
      }
    },
    danger(e) {
      const b = [];
      if (e.st !== 'vanish' || e.t < 0.2) b.push(body(e, 5));
      if (e.st === 'dash') b.push(rectFront(e, -6, 48, 30, -4));
      if (e.st === 'slash' && e.t < 0.12) b.push(rectFront(e, -4, 84, 52, -8));
      if (e.st === 'pdive') b.push({ x: e.x - 10, y: e.y + e.h - 4, w: e.w + 20, h: 40 });
      if (e.st === 'issen' && e.t < 0.12) b.push({ x: -1e6, y: (e.ex.iy || e.y + e.h) - 58, w: 2e6, h: 52, dmg: 2, line: true });
      return b;
    },
    draw(ctx, e, time) {
      let a = 1;
      if (e.st === 'vanish') a = 1 - Math.min(1, e.t / 0.3);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const ph = e.ex.p;
      let sx = 1, sy = 1;
      if (e.st === 'dash') { sx = 1.35; sy = 0.8; }
      if (e.st === 'pjump' || e.st === 'pdive') { sx = 0.85; sy = 1.15; }
      if (e.st === 'iwind') { sy = 0.86; sx = 1.08; }
      ctx.scale(sx, sy);
      // 너덜너덜한 망토
      ff(ctx, e, '#0c0910');
      ctx.beginPath();
      ctx.moveTo(-4, -44);
      ctx.bezierCurveTo(-24, -40, -26 + Math.sin(time * 5) * 3, -10, -20, 0);
      ctx.lineTo(-14, -6);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(2, 0);
      ctx.lineTo(7, -5);
      ctx.lineTo(13, 0);
      ctx.bezierCurveTo(16, -18, 14, -38, -4, -44);
      ctx.fill();
      // 등의 등불
      const lg = 0.75 + Math.sin(time * 6) * 0.2;
      ctx.fillStyle = '#2a2016';
      ctx.fillRect(-20, -50, 12, 16);
      ctx.fillStyle = `rgba(255,${ph === 3 ? 120 : 190},80,${lg})`;
      ctx.fillRect(-18, -47, 8, 10);
      ctx.strokeStyle = '#2a2016';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -50);
      ctx.lineTo(-14, -56);
      ctx.stroke();
      // 가면
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#dcd4c2';
      ctx.beginPath();
      ctx.ellipse(1, -51, 10, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a2420';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-3, -61);
      ctx.lineTo(-1, -54);
      ctx.lineTo(-4, -49);
      ctx.lineTo(-2, -43);
      ctx.stroke();
      // 더듬이 (부러진)
      ctx.strokeStyle = '#cfc6b2';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(4, -60);
      ctx.quadraticCurveTo(8, -72, 16, -74);
      ctx.moveTo(-3, -60);
      ctx.quadraticCurveTo(-6, -66, -8, -66);
      ctx.stroke();
      // 눈
      const wind = e.st.endsWith('wind') || e.st === 'phang';
      ctx.fillStyle = wind || ph === 3 ? '#ffb347' : '#0a0608';
      ctx.beginPath();
      ctx.ellipse(-2.5, -50, 2.4, 3.6, 0.2, 0, Math.PI * 2);
      ctx.ellipse(5, -50, 2.4, 3.6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // 바늘검
      ctx.save();
      ctx.translate(8, -28);
      let ang = 0.6;
      if (e.st === 'swind') ang = -2.1;
      if (e.st === 'slash') ang = -2.1 + Math.min(1, e.t / 0.08) * 2.8;
      if (e.st === 'dash' || e.st === 'dwind') ang = e.st === 'dash' ? 0 : -2.8;
      if (e.st === 'pdive' || e.st === 'phang') ang = Math.PI / 2;
      if (e.st === 'iwind') ang = Math.PI - 0.3;
      if (e.st === 'issen') ang = 0;
      ctx.rotate(ang);
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#ece4d0';
      ctx.fillRect(0, -1.2, 44, 2.4);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(42, -2, 4, 4);
      ctx.restore();
      ctx.restore();
    },
  },
};
