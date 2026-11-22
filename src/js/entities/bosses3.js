// 3장 보스 3종 + 숨겨진 보스 (오리지널). 모든 패턴은 예고 후 판정, 원형 파동 없음.
import { go, groundPhys, flyPhys, blockedAhead, cx, cy, rectFront } from './common.js';
import { clamp, rand, TILE } from '../core/util.js';

const body = (e, s0 = 6) => {
  const s = s0 + 4;
  return { x: e.x + s, y: e.y + s + 4, w: e.w - s * 2, h: e.h - s * 2 - 4 };
};
const ff = (ctx, e, c) => (ctx.fillStyle = e.fl > 0 ? '#ffffff' : c);
const roomL = (S) => S.room.px + TILE * 1.5;
const roomR = (S) => S.room.px + S.room.pw - TILE * 1.5;
const hpFrac = (e) => e.hp / e.maxHp;
function intro(e) {
  if (e.st === 'intro') {
    e.vx = 0;
    e.vy = 0;
    if (e.t > 1.9) go(e, 'idle');
    return true;
  }
  return false;
}
// 방 바닥 높이 (한 번 계산)
function floorOf(e, S) {
  if (e.ex.floor) return e.ex.floor;
  // 보스 위치에서 아래로 내려가며 바닥 탐색 (천장 장식에 걸리지 않게)
  const x = cx(e);
  let y = Math.max(S.room.py + TILE, cy(e));
  while (y < S.room.py + S.room.ph && !S.world.solidAt(x, y)) y += 8;
  e.ex.floor = Math.floor(y / TILE) * TILE;
  return e.ex.floor;
}
// 방 전체에 고드름 비 (안전한 빈칸을 반드시 남김)
function iceRain(S, e, n, warn, gapAt) {
  const L = roomL(S), R = roomR(S), fl = floorOf(e, S);
  const seg = (R - L) / n;
  const gap = gapAt != null ? gapAt : Math.floor(Math.random() * n);
  for (let i = 0; i < n; i++) {
    if (i === gap || (n > 7 && i === (gap + Math.floor(n / 2)) % n)) continue;
    S.proj('icefall', L + seg * (i + 0.5) + rand(-seg * 0.2, seg * 0.2), fl, 0, 0, { life: warn + 2, warn: warn + rand(0, 0.25) });
  }
}

export const BOSSES3 = {
  // ════════ 1. 눈뿔 사슴 ════════
  stag: {
    name: '눈뿔 사슴', sub: '변경의 길목을 지키는 하얀 짐승', music: 'boss',
    w: 96, h: 76, hp: 300, amber: 300, light: 170, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.n = 0; },
    update(e, dt, S) {
      if (intro(e)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      if (!P2 && hpFrac(e) <= 0.5 && e.grounded && e.st !== 'charge') {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1 });
      }
      switch (e.st) {
        case 'roar':
          e.vx = 0;
          if (e.t > 1.2) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          const d = p ? Math.abs(p.cx - cx(e)) : 0;
          e.vx = d > 260 ? e.facing * 90 : 0;
          if (e.t > (P2 ? 0.7 : 1.0)) {
            e.vx = 0;
            const r = Math.random();
            e.ex.n = 0;
            if (d > 300 && r < 0.5) go(e, 'paw');
            else if (r < 0.4) go(e, 'paw');
            else if (r < 0.72) go(e, 'lwind');
            else go(e, 'antler');
          }
          break;
        }
        case 'paw': // 앞발로 눈을 긁음 (돌진 예고)
          e.vx = 0;
          if (e.t > (P2 ? 0.65 : 0.85)) {
            go(e, 'charge');
            e.vx = e.facing * (P2 ? 600 : 540);
            S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e), p: 0.6 });
          }
          break;
        case 'charge': {
          const r = groundPhys(e, S, dt);
          if (r.hitX || blockedAhead(e, S) || e.t > 2) {
            e.vx = 0;
            go(e, 'stun');
            S.ev('slam', { x: cx(e) + e.facing * 50, y: e.y + e.h, m: 12 });
            // 벽에 부딪혀 천장의 고드름이 떨어짐 (그림자 예고)
            const L = roomL(S), R = roomR(S), fl = floorOf(e, S);
            const n = P2 ? 4 : 3;
            for (let i = 0; i < n; i++) S.proj('icefall', L + ((R - L) * (i + 0.3 + Math.random() * 0.4)) / n, fl, 0, 0, { life: 3, warn: 0.85 + i * 0.12 });
          }
          return;
        }
        case 'stun':
          e.vx = 0;
          if (e.t > (P2 ? 0.75 : 1.0)) {
            e.facing *= -1;
            e.ex.n++;
            if (P2 && e.ex.n < 2) go(e, 'paw');
            else go(e, 'idle');
          }
          break;
        case 'lwind': // 몸을 낮추고 도약 지점 표시
          e.vx = 0;
          if (p && e.t < 0.35) e.ex.tx = clamp(p.cx, roomL(S) + 50, roomR(S) - 50);
          if (e.t > 0.6) {
            go(e, 'leap');
            const T = 0.8;
            e.vy = -0.5 * 2400 * T;
            e.vx = ((e.ex.tx || cx(e)) - cx(e)) / T;
            e.grounded = false;
          }
          break;
        case 'leap': {
          const r = groundPhys(e, S, dt);
          if (r.hitX) e.vx = 0;
          if (e.t > 0.15 && e.grounded) {
            e.vx = 0;
            go(e, 'land');
            S.ev('slam', { x: cx(e), y: e.y + e.h, m: 14 });
            for (const d of [-1, 1]) S.proj('wave', cx(e) + d * 40, e.y + e.h, d * 320, 0, { life: 1.4, big: 1 });
          }
          return;
        }
        case 'land':
          if (e.t > 0.6) {
            e.ex.n++;
            if (P2 && e.ex.n < 2) go(e, 'lwind');
            else go(e, 'idle');
          }
          break;
        case 'antler': // 뿔이 빛남 → 플레이어 쪽으로 얼음 가시 줄
          e.vx = 0;
          if (e.t > 0.7 && !e.ex.sp) {
            e.ex.sp = 1;
            const fl = floorOf(e, S);
            for (let i = 0; i < 6; i++) S.proj('icespike', cx(e) + e.facing * (90 + i * 68), fl, 0, 0, { life: 1.6 + i * 0.1, warn: 0.5 + i * 0.1 });
            if (P2) for (let i = 0; i < 3; i++) S.proj('icespike', cx(e) - e.facing * (90 + i * 68), fl, 0, 0, { life: 2 + i * 0.1, warn: 0.9 + i * 0.1 });
            S.ev('sfx', { s: 'charge', x: cx(e), y: cy(e), p: 1.3 });
          }
          if (e.t > 1.3) { e.ex.sp = 0; go(e, 'idle'); }
          break;
      }
      groundPhys(e, S, dt);
    },
    danger(e) {
      const b = [body(e, 8)];
      if (e.st === 'charge') b.push(rectFront(e, -30, 40, 50, -6));
      return b;
    },
    draw(ctx, e, time) {
      // 도약 착지 지점 표시
      if ((e.st === 'lwind' || e.st === 'leap') && e.ex.tx != null) {
        const k = e.st === 'lwind' ? e.t / 0.6 : 1;
        ctx.fillStyle = `rgba(0,10,20,${0.2 + k * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(e.ex.tx, (e.ex.floor || e.y + e.h) - 2, 40 + k * 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const P2 = e.ex.p === 2;
      if (e.st === 'roar' || e.st === 'paw') ctx.translate(rand(-1.5, 1.5), 0);
      const run = e.st === 'charge' ? Math.sin(time * 24) : e.st === 'idle' && Math.abs(e.vx) > 1 ? Math.sin(time * 8) * 0.6 : 0;
      const crouch = e.st === 'lwind' ? Math.min(1, e.t / 0.4) * 8 : e.st === 'land' ? Math.max(0, 8 - e.t * 20) : 0;
      ctx.translate(0, crouch);
      // 다리 4개
      ff(ctx, e, '#3a4a5a');
      const legs = [[-34, 1], [-20, -1], [18, 1], [32, -1]];
      for (const [lx, ph] of legs) {
        const sw = run * 10 * ph;
        ctx.save();
        ctx.translate(lx, -34);
        ctx.rotate(sw * 0.03 + (e.st === 'paw' && lx > 0 && ph > 0 ? Math.sin(e.t * 18) * 0.5 : 0));
        ctx.fillRect(-4, 0, 8, 34 - crouch);
        ctx.restore();
      }
      // 몸통
      ff(ctx, e, '#e8eef4');
      ctx.beginPath();
      ctx.moveTo(-44, -36);
      ctx.quadraticCurveTo(-48, -66, -16, -68);
      ctx.quadraticCurveTo(20, -72, 36, -60);
      ctx.quadraticCurveTo(46, -44, 38, -32);
      ctx.quadraticCurveTo(0, -26, -44, -36);
      ctx.fill();
      ctx.fillStyle = e.fl > 0 ? '#fff' : 'rgba(150,180,205,0.6)';
      ctx.beginPath();
      ctx.moveTo(-40, -38);
      ctx.quadraticCurveTo(0, -30, 36, -36);
      ctx.quadraticCurveTo(0, -44, -40, -38);
      ctx.fill();
      // 목 + 머리
      ff(ctx, e, '#dfe8f0');
      ctx.beginPath();
      const hy = e.st === 'charge' || e.st === 'paw' || e.st === 'antler' ? 14 : 0;
      ctx.moveTo(26, -62);
      ctx.quadraticCurveTo(40, -84 + hy, 52, -84 + hy);
      ctx.lineTo(62, -74 + hy);
      ctx.lineTo(50, -66 + hy);
      ctx.quadraticCurveTo(42, -56, 36, -46);
      ctx.fill();
      ctx.fillStyle = P2 ? '#ff7a5a' : '#5ab8ff';
      ctx.fillRect(50, -80 + hy, 4, 3);
      // 뿔 (얼음 결정)
      const glow = e.st === 'antler' ? Math.min(1, e.t / 0.7) : 0;
      ctx.strokeStyle = e.fl > 0 ? '#fff' : `rgb(${200 + glow * 55},${230 + glow * 25},255)`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const ax = 46, ay = -84 + hy;
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 8, ay - 26);
      ctx.lineTo(ax - 22, ay - 40);
      ctx.moveTo(ax - 8, ay - 26);
      ctx.lineTo(ax + 6, ay - 42);
      ctx.moveTo(ax - 4, ay - 14);
      ctx.lineTo(ax - 20, ay - 18);
      ctx.moveTo(ax + 4, ay - 2);
      ctx.lineTo(ax + 14, ay - 30);
      ctx.lineTo(ax + 26, ay - 36);
      ctx.stroke();
      ctx.lineCap = 'butt';
      if (glow > 0) {
        ctx.fillStyle = `rgba(190,230,255,${glow * 0.35})`;
        ctx.beginPath();
        ctx.arc(ax, ay - 20, 30 * glow, 0, Math.PI * 2);
        ctx.fill();
      }
      // 꼬리 털
      ff(ctx, e, '#f4f8fb');
      ctx.beginPath();
      ctx.ellipse(-46, -54, 7, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  // ════════ 2. 서리 여제 ════════
  empress: {
    name: '서리 여제', sub: '얼음 호수 위에 홀로 선 왕관', music: 'boss',
    w: 64, h: 96, hp: 340, amber: 340, light: 200, boss: true, fly: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.vis = 1; },
    update(e, dt, S) {
      if (intro(e)) return;
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      const fl = floorOf(e, S);
      const hoverY = fl - 230;
      if (!P2 && hpFrac(e) <= 0.5) {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e) });
      }
      if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
      const drift = () => {
        e.vy += (clamp(hoverY + Math.sin(e.t * 2) * 14 - cy(e), -120, 120) - e.vy) * dt * 3;
      };
      switch (e.st) {
        case 'roar':
          e.vx *= 0.9;
          drift();
          if (e.t > 1.2) go(e, 'idle');
          break;
        case 'idle': {
          drift();
          const want = p ? clamp(p.cx + (cx(e) > p.cx ? 220 : -220), roomL(S) + 60, roomR(S) - 60) : cx(e);
          e.vx += (clamp(want - cx(e), -140, 140) - e.vx) * dt * 2;
          if (e.t > (P2 ? 0.9 : 1.3)) {
            const r = Math.random();
            if (P2 && S.count('icewisp') < 1 && r < 0.25) go(e, 'summon');
            else if (r < 0.38) go(e, 'shwind');
            else if (r < 0.6) go(e, 'rain');
            else if (r < 0.8) go(e, 'sweep');
            else go(e, 'blink');
            e.ex.n = 0;
          }
          break;
        }
        case 'shwind': // 얼음 조각을 머리 위에 모음 → 하나씩 조준 발사
          e.vx *= 0.9;
          drift();
          {
            const N = P2 ? 7 : 5;
            const fire0 = 0.8, gap = P2 ? 0.2 : 0.26;
            const k = Math.floor((e.t - fire0) / gap);
            if (e.t > fire0 && k >= e.ex.n && e.ex.n < N && p) {
              const i = e.ex.n++;
              const a0 = -Math.PI / 2 + (i - (N - 1) / 2) * 0.32;
              const sx = cx(e) + Math.cos(a0) * 54, sy = cy(e) - 20 + Math.sin(a0) * 40;
              const a = Math.atan2(p.cy - sy, p.cx - sx);
              S.proj('thorn', sx, sy, Math.cos(a) * 330, Math.sin(a) * 330, { life: 3, ice: 1 });
              S.ev('sfx', { s: 'shoot', x: sx, y: sy, p: 1.5 });
            }
            if (e.t > fire0 + gap * N + 0.4) go(e, 'idle');
          }
          break;
        case 'rain':
          e.vx *= 0.9;
          drift();
          if (e.t > 0.5 && !e.ex.rn) {
            e.ex.rn = 1;
            iceRain(S, e, P2 ? 9 : 7, 0.9);
            S.ev('sfx', { s: 'charge', x: cx(e), y: cy(e), p: 1.6 });
          }
          if (e.t > 1.6) { e.ex.rn = 0; go(e, 'idle'); }
          break;
        case 'sweep': // 한쪽 벽부터 낮은 얼음 가시가 차례로 솟음 (점프로 넘기)
          e.vx *= 0.9;
          drift();
          if (e.t > 0.6 && !e.ex.sw) {
            e.ex.sw = 1;
            const L = roomL(S), R = roomR(S);
            const fromLeft = p ? p.cx > (L + R) / 2 : true;
            const n = Math.floor((R - L) / 60);
            for (let i = 0; i <= n; i++) {
              const x = fromLeft ? L + i * 60 : R - i * 60;
              S.proj('icespike', x, fl, 0, 0, { life: 1.4 + i * 0.09, warn: 0.75 + i * 0.09, short: 1 });
            }
          }
          if (e.t > 1.6) { e.ex.sw = 0; go(e, 'idle'); }
          break;
        case 'blink': // 사라졌다가 반대편에 나타남 (사라진 동안 무해)
          e.vx = 0;
          e.vy = 0;
          if (e.t < 0.45) e.ex.vis = 1 - e.t / 0.45;
          else if (!e.ex.bl) {
            e.ex.bl = 1;
            const L = roomL(S), R = roomR(S);
            const nx = p && p.cx > (L + R) / 2 ? L + 120 : R - 120;
            e.x = nx - e.w / 2;
            e.y = hoverY - e.h / 2;
          } else e.ex.vis = Math.min(1, (e.t - 0.45) / 0.35);
          if (e.t > 0.85) { e.ex.vis = 1; e.ex.bl = 0; go(e, P2 ? 'shwind' : 'idle'); e.ex.n = 0; }
          break;
        case 'summon':
          e.vx *= 0.9;
          drift();
          if (e.t > 0.7 && !e.ex.sm) {
            e.ex.sm = 1;
            S.spawnEnemy('icewisp', cx(e) - 70, cy(e), { minion: 1, hp: 14 });
            S.spawnEnemy('icewisp', cx(e) + 70, cy(e), { minion: 1, hp: 14 });
          }
          if (e.t > 1.2) { e.ex.sm = 0; go(e, 'idle'); }
          break;
      }
      const r = flyPhys(e, S, dt);
      if (r.hitX) e.vx = 0;
      if (r.hitY) e.vy = 0;
    },
    blocks: (e) => e.st === 'blink' && e.ex.vis < 0.5,
    danger(e) {
      if (e.st === 'blink' && e.ex.vis < 0.7) return [];
      return [body(e, 10)];
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.globalAlpha *= e.ex.vis == null ? 1 : Math.max(0.05, e.ex.vis);
      ctx.translate(cx(e), cy(e));
      const P2 = e.ex.p === 2;
      // 떠 있는 얼음 조각 (공격 예고)
      if (e.st === 'shwind') {
        const N = P2 ? 7 : 5;
        for (let i = e.ex.n || 0; i < N; i++) {
          const a0 = -Math.PI / 2 + (i - (N - 1) / 2) * 0.32;
          const k = Math.min(1, e.t / 0.8);
          ctx.save();
          ctx.translate(Math.cos(a0) * 54 * k, -20 + Math.sin(a0) * 40 * k);
          ctx.rotate(time * 3 + i);
          ctx.fillStyle = 'rgba(220,245,255,0.9)';
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(4, 0);
          ctx.lineTo(0, 8);
          ctx.lineTo(-4, 0);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.scale(e.facing, 1);
      // 드레스 (아래로 갈수록 투명한 얼음)
      const g = ctx.createLinearGradient(0, -20, 0, 50);
      g.addColorStop(0, e.fl > 0 ? '#fff' : '#cfe8f8');
      g.addColorStop(1, 'rgba(120,180,220,0.1)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, -18);
      ctx.quadraticCurveTo(-34, 20, -30 + Math.sin(time * 2) * 4, 50);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-30 + i * 10 + Math.sin(time * 3 + i) * 3, 50 + (i % 2) * 8);
      ctx.quadraticCurveTo(34, 20, 10, -18);
      ctx.fill();
      // 상체
      ff(ctx, e, '#e8f4fb');
      ctx.beginPath();
      ctx.ellipse(0, -26, 11, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // 소매 / 팔
      ctx.strokeStyle = e.fl > 0 ? '#fff' : '#b8d8ec';
      ctx.lineWidth = 4;
      const lift = e.st === 'shwind' || e.st === 'rain' || e.st === 'summon' ? -1 : e.st === 'sweep' ? 0.6 : 0.2;
      ctx.beginPath();
      ctx.moveTo(-8, -32);
      ctx.quadraticCurveTo(-24, -32 + lift * 14, -30, -20 + lift * 28);
      ctx.moveTo(8, -32);
      ctx.quadraticCurveTo(24, -32 + lift * 14, 30, -20 + lift * 28);
      ctx.stroke();
      // 머리 + 왕관
      ff(ctx, e, '#f4fbff');
      ctx.beginPath();
      ctx.arc(0, -48, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a2a3a';
      ctx.fillRect(2, -50, 6, 3);
      ctx.fillStyle = P2 ? '#bfe0ff' : '#e0f4ff';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = -10 + i * 5;
        ctx.moveTo(x - 2.5, -56);
        ctx.lineTo(x, -70 - (i === 2 ? 8 : i % 2 ? 0 : 4));
        ctx.lineTo(x + 2.5, -56);
      }
      ctx.fill();
      if (P2) {
        ctx.fillStyle = `rgba(150,210,255,${0.5 + 0.3 * Math.sin(time * 6)})`;
        ctx.beginPath();
        ctx.arc(0, -66, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // ════════ 3. 눈보라 군주 (3페이즈) ════════
  blizzard: {
    name: '눈보라 군주', sub: '산꼭대기에서 마지막 불을 삼키려는 폭풍', music: 'final',
    w: 110, h: 100, hp: 480, amber: 500, light: 220, boss: true, fly: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; },
    update(e, dt, S) {
      if (intro(e)) return;
      const p = S.near(e);
      const fl = floorOf(e, S);
      const ph = e.ex.p;
      if (ph === 1 && hpFrac(e) <= 0.66) {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), dark: 1 });
      } else if (ph === 2 && hpFrac(e) <= 0.33) {
        e.ex.p = 3;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), dark: 1 });
      }
      const hoverY = fl - 260;
      const drift = () => {
        e.vy += (clamp(hoverY + Math.sin(e.t * 1.6) * 20 - cy(e), -150, 150) - e.vy) * dt * 3;
      };
      if (p && e.st !== 'dive') e.facing = Math.sign(p.cx - cx(e)) || 1;
      switch (e.st) {
        case 'roar':
          e.vx *= 0.9;
          drift();
          if (e.t > 1.3) go(e, 'idle');
          break;
        case 'idle': {
          drift();
          const want = p ? clamp(p.cx, roomL(S) + 100, roomR(S) - 100) : cx(e);
          e.vx += (clamp(want - cx(e), -110, 110) - e.vx) * dt * 2;
          if (e.t > (ph === 3 ? 0.75 : ph === 2 ? 0.9 : 1.15)) {
            const r = Math.random();
            e.ex.n = 0;
            if (ph >= 2 && r < 0.3) go(e, 'dwind');
            else if (ph === 3 && r < 0.5) go(e, 'storm');
            else if (r < 0.62) go(e, 'gust');
            else if (r < 0.82) go(e, 'orbs');
            else go(e, 'rain');
          }
          break;
        }
        case 'gust': // 한쪽에서 바람 + 눈덩이 포물선
          e.vx *= 0.9;
          drift();
          if (e.t > 0.7 && !e.ex.g) {
            e.ex.g = 1;
            const L = roomL(S), R = roomR(S);
            const fromLeft = p ? p.cx < (L + R) / 2 : true;
            S.proj('gust', fromLeft ? L : R, fl - 50, fromLeft ? 260 : -260, 0, { life: 3.4 });
            S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e), p: 0.5 });
            if (p) {
              for (let i = 0; i < 3; i++) {
                const tx = p.cx + (i - 1) * 110, T = 1.0 + i * 0.08;
                S.proj('wax', cx(e), cy(e) + 20, (tx - cx(e)) / T, (fl - 10 - (cy(e) + 20)) / T - 0.5 * 1500 * T, { life: 3, grav: 1500, snow: 1 });
              }
            }
          }
          if (e.t > 1.6) { e.ex.g = 0; go(e, 'idle'); }
          break;
        case 'orbs': // 얼음 조각 부채꼴 2회
          e.vx *= 0.9;
          drift();
          for (const tf of [0.7, 1.2]) {
            if (e.t > tf && e.ex.n < (tf === 0.7 ? 1 : 2) && p) {
              e.ex.n++;
              const a = Math.atan2(p.cy - cy(e), p.cx - cx(e));
              const n = ph === 3 ? 5 : 3;
              for (let i = 0; i < n; i++) {
                const da = (i - (n - 1) / 2) * 0.24;
                S.proj('thorn', cx(e), cy(e), Math.cos(a + da) * 280, Math.sin(a + da) * 280, { life: 3, ice: 1 });
              }
              S.ev('sfx', { s: 'shoot', x: cx(e), y: cy(e), p: 1.2 });
            }
          }
          if (e.t > 1.7) go(e, 'idle');
          break;
        case 'rain':
          e.vx *= 0.9;
          drift();
          if (e.t > 0.5 && !e.ex.rn) {
            e.ex.rn = 1;
            iceRain(S, e, ph === 1 ? 8 : 10, 0.9);
          }
          if (e.t > 1.5) { e.ex.rn = 0; go(e, 'idle'); }
          break;
        case 'dwind': // 돌진선 예고
          e.vx *= 0.85;
          e.vy *= 0.85;
          if (p && e.t < 0.55) {
            e.ex.tx = p.cx;
            e.ex.ty = Math.min(p.cy, fl - 30);
          }
          if (e.t > 0.85) {
            go(e, 'dive');
            const a = Math.atan2(e.ex.ty - cy(e), e.ex.tx - cx(e));
            e.vx = Math.cos(a) * 820;
            e.vy = Math.sin(a) * 820;
            S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e), p: 0.5 });
          }
          break;
        case 'dive': {
          const r = flyPhys(e, S, dt);
          if (r.hitX || r.hitY || e.t > 1.2) {
            e.vx = 0;
            e.vy = 0;
            if (r.hitY > 0) {
              S.ev('slam', { x: cx(e), y: e.y + e.h, m: 12 });
              for (const d of [-1, 1]) S.proj('wave', cx(e) + d * 40, fl, d * 280, 0, { life: 1.2 });
            }
            go(e, 'rise');
          }
          return;
        }
        case 'rise':
          e.vx *= 0.9;
          drift();
          if (e.t > 0.9) {
            if (e.ex.p === 3 && !e.ex.d2) { e.ex.d2 = 1; go(e, 'dwind'); }
            else { e.ex.d2 = 0; go(e, 'idle'); }
          }
          break;
        case 'storm': // 3페이즈: 한쪽부터 고드름 기둥이 차례로 (반대로 달리거나 지나간 뒤로)
          e.vx *= 0.9;
          drift();
          if (e.t > 0.6 && !e.ex.st2) {
            e.ex.st2 = 1;
            const L = roomL(S), R = roomR(S);
            const fromLeft = Math.random() < 0.5;
            const n = 11;
            for (let i = 0; i < n; i++) {
              const x = fromLeft ? L + ((R - L) * (i + 0.5)) / n : R - ((R - L) * (i + 0.5)) / n;
              S.proj('icefall', x, fl, 0, 0, { life: 3.5, warn: 0.85 + i * 0.16 });
            }
            if (S.count('icewisp') < 1) S.spawnEnemy('icewisp', cx(e), cy(e) + 40, { minion: 1, hp: 14 });
          }
          if (e.t > 2.2) { e.ex.st2 = 0; go(e, 'idle'); }
          break;
      }
      const r = flyPhys(e, S, dt);
      if (r.hitX) e.vx = 0;
      if (r.hitY) e.vy = 0;
    },
    danger(e) {
      const b = [body(e, 12)];
      return b;
    },
    draw(ctx, e, time) {
      if (e.st === 'dwind' && e.ex.tx != null) {
        const k = Math.min(1, e.t / 0.85);
        const a = Math.atan2(e.ex.ty - cy(e), e.ex.tx - cx(e));
        ctx.strokeStyle = `rgba(220,240,255,${0.15 + k * 0.55})`;
        ctx.lineWidth = 3 + k * 6;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.moveTo(cx(e), cy(e));
        ctx.lineTo(cx(e) + Math.cos(a) * 1400, cy(e) + Math.sin(a) * 1400);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.translate(cx(e), cy(e));
      const ph = e.ex.p;
      // 소용돌이 치는 눈 구름 몸
      for (let i = 0; i < 9; i++) {
        const a = time * (0.8 + ph * 0.3) + (i / 9) * Math.PI * 2;
        const r = 40 + Math.sin(time * 2 + i) * 6;
        ctx.fillStyle = e.fl > 0 ? 'rgba(255,255,255,0.9)' : `rgba(${210 - ph * 15},${225 - ph * 10},240,0.55)`;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.6, 22 + (i % 3) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = e.fl > 0 ? '#fff' : ph === 3 ? '#2a3448' : '#3a4a60';
      ctx.beginPath();
      ctx.ellipse(0, 0, 34, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      // 가면 같은 얼굴
      ctx.scale(e.facing, 1);
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#eef6fc';
      ctx.beginPath();
      ctx.moveTo(-20, -14);
      ctx.quadraticCurveTo(0, -30, 22, -14);
      ctx.quadraticCurveTo(24, 10, 0, 22);
      ctx.quadraticCurveTo(-24, 10, -20, -14);
      ctx.fill();
      const eye = ph === 3 ? '#ff6a6a' : ph === 2 ? '#ffd58a' : '#5ab8ff';
      ctx.fillStyle = eye;
      ctx.beginPath();
      ctx.ellipse(-8, -4, 5, 3, -0.3, 0, Math.PI * 2);
      ctx.ellipse(10, -4, 5, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a2230';
      ctx.fillRect(-6, 10, 14, 3);
      // 얼음 뿔 왕관
      ctx.fillStyle = '#dff4ff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 14, -20);
        ctx.quadraticCurveTo(s * 34, -40, s * 30, -62);
        ctx.quadraticCurveTo(s * 24, -40, s * 6, -24);
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // ════════ 숨겨진 보스: 그림자 나방 ════════
  shademoth: {
    name: '그림자 나방', sub: '첫 동굴 천장 너머에 숨은 또 하나의 기사', music: 'scarlet',
    w: 30, h: 44, hp: 260, amber: 280, light: 120, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; },
    update(e, dt, S) {
      if (intro(e)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      const fl = floorOf(e, S);
      if (!P2 && hpFrac(e) <= 0.5 && e.grounded) {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1 });
      }
      switch (e.st) {
        case 'roar':
          e.vx = 0;
          if (e.t > 1.0) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          const d = p ? Math.abs(p.cx - cx(e)) : 0;
          e.vx = d < 120 ? -e.facing * 120 : d > 280 ? e.facing * 140 : 0;
          if (e.vx && blockedAhead({ x: e.x, y: e.y, w: e.w, h: e.h, facing: Math.sign(e.vx) }, S)) e.vx = 0;
          if (e.t > (P2 ? 0.6 : 0.85)) {
            e.vx = 0;
            e.ex.n = 0;
            const r = Math.random();
            if (r < 0.45) go(e, 'dwind');
            else if (r < 0.72) go(e, 'jwind');
            else go(e, 'wisps');
          }
          break;
        }
        case 'dwind': // 웅크림 + 눈빛 (돌진베기 예고)
          e.vx = 0;
          if (p && e.t < 0.3) e.facing = Math.sign(p.cx - cx(e)) || 1;
          if (e.t > (P2 ? 0.45 : 0.55)) {
            go(e, 'dash');
            e.vx = e.facing * 760;
            S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e), p: 1.2 });
          }
          break;
        case 'dash': {
          const r = groundPhys(e, S, dt);
          if (r.hitX || blockedAhead(e, S) || e.t > 0.42) {
            e.vx = 0;
            e.ex.n++;
            e.facing *= -1;
            go(e, P2 && e.ex.n < 2 ? 'dwind' : 'rest');
          }
          return;
        }
        case 'jwind':
          e.vx = 0;
          if (e.t > 0.35) {
            e.vy = -1050;
            e.grounded = false;
            go(e, 'jump');
          }
          break;
        case 'jump':
          e.vx = 0;
          if (p) e.ex.tx = clamp(p.cx, roomL(S) + 20, roomR(S) - 20);
          if (e.vy >= 0 || e.t > 0.5) {
            go(e, 'hang');
            e.vy = 0;
          }
          break;
        case 'hang': // 공중에 멈춰 착지 지점 표시
          e.vy = 0;
          e.vx = ((e.ex.tx || cx(e)) - cx(e)) * 6;
          if (e.t > 0.55) {
            e.vx = 0;
            e.vy = 1300;
            go(e, 'dive');
          }
          flyPhys(e, S, dt);
          return;
        case 'dive': {
          e.vx = 0;
          e.vy = 1300;
          const r = flyPhys(e, S, dt);
          if (r.hitY > 0 || S.world.grounded(e)) {
            e.vy = 0;
            S.ev('slam', { x: cx(e), y: e.y + e.h, m: 8 });
            for (const d of [-1, 1]) S.proj('wave', cx(e) + d * 20, fl, d * 300, 0, { life: 1.0 });
            go(e, 'rest');
          }
          return;
        }
        case 'wisps':
          e.vx = 0;
          if (e.t > 0.6 && !e.ex.w) {
            e.ex.w = 1;
            for (let i = 0; i < (P2 ? 3 : 2); i++) S.proj('wisp', cx(e) + (i - 1) * 30, e.y - 10, (i - 1) * 80, -120, { life: 5, shade: 1 });
            S.ev('sfx', { s: 'charge', x: cx(e), y: cy(e), p: 0.8 });
          }
          if (e.t > 1.0) { e.ex.w = 0; go(e, 'rest'); }
          break;
        case 'rest':
          e.vx = 0;
          if (e.t > (P2 ? 0.45 : 0.7)) go(e, 'idle');
          break;
      }
      groundPhys(e, S, dt);
    },
    danger(e) {
      const b = [body(e, 2)];
      if (e.st === 'dash') b.push(rectFront(e, -10, 40, 34, 0));
      return b;
    },
    draw(ctx, e, time) {
      if ((e.st === 'hang' || e.st === 'jump') && e.ex.tx != null && e.ex.floor) {
        const k = e.st === 'hang' ? e.t / 0.55 : 0.2;
        ctx.fillStyle = `rgba(120,60,160,${0.2 + k * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(e.ex.tx, e.ex.floor - 2, 18 + k * 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const crouch = e.st === 'dwind' || e.st === 'jwind' ? 6 : 0;
      ctx.translate(0, crouch);
      // 잔상
      if (e.st === 'dash') {
        ctx.fillStyle = 'rgba(90,40,130,0.3)';
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(-i * 18, -18, 12, 18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 망토
      ff(ctx, e, '#1a1024');
      ctx.beginPath();
      ctx.moveTo(-6, -34);
      ctx.quadraticCurveTo(-22, -16, -16 + Math.sin(time * 6) * 2, 0);
      ctx.lineTo(12, 0);
      ctx.quadraticCurveTo(14, -18, 6, -34);
      ctx.fill();
      // 머리 (어두운 가면)
      ff(ctx, e, '#2a1e34');
      ctx.beginPath();
      ctx.ellipse(1, -40, 11, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // 더듬이
      ctx.strokeStyle = e.fl > 0 ? '#fff' : '#2a1e34';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -48);
      ctx.quadraticCurveTo(-12, -62, -20, -60);
      ctx.moveTo(4, -48);
      ctx.quadraticCurveTo(10, -64, 18, -62);
      ctx.stroke();
      const eye = e.st === 'dwind' || e.st === 'hang' ? '#ff9aff' : '#c48aff';
      ctx.fillStyle = eye;
      ctx.fillRect(1, -43, 4, 5);
      ctx.fillRect(-6, -43, 4, 5);
      // 검
      ctx.fillStyle = '#c8b0e0';
      if (e.st === 'dash') ctx.fillRect(8, -24, 34, 3);
      else {
        ctx.save();
        ctx.translate(8, -22);
        ctx.rotate(e.st === 'dwind' ? -0.9 : 0.6);
        ctx.fillRect(0, -1.5, 26, 3);
        ctx.restore();
      }
      ctx.restore();
    },
  },
};
