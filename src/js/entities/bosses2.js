// 2장 보스 3종 (오리지널). 모든 패턴은 예고 후 판정, 피할 공간을 남김.
import { go, groundPhys, flyPhys, cx, cy, rectFront } from './common.js';
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
    if (e.t > 1.9) go(e, 'idle');
    return true;
  }
  return false;
}

export const BOSSES2 = {
  // ════════ 1. 톱니 대장장이 ════════
  smith: {
    name: '톱니 대장장이', sub: '꺼진 용광로를 지키는 망치', music: 'boss',
    w: 92, h: 88, hp: 260, amber: 260, light: 220, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.vcd = 4; },
    update(e, dt, S) {
      if (intro(e)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      if (!e.ex.floor && e.grounded) e.ex.floor = e.y + e.h;
      if (!P2 && hpFrac(e) <= 0.5 && e.grounded) {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1 });
      }
      e.ex.vcd -= dt;
      switch (e.st) {
        case 'roar':
          e.vx = 0;
          if (e.t > 1.2) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          const d = p ? Math.abs(p.cx - cx(e)) : 0;
          e.vx = d > 180 ? e.facing * 70 : 0;
          if (e.t > (P2 ? 0.8 : 1.1)) {
            const r = Math.random();
            if (P2 && e.ex.vcd <= 0) go(e, 'vwind');
            else if (d < 220 && r < 0.55) go(e, 'hwind');
            else if (r < 0.75) go(e, 'cwind');
            else go(e, 'hwind');
            e.vx = 0;
          }
          break;
        }
        case 'hwind': // 망치 들어올림
          e.vx = 0;
          if (e.t > 0.8) {
            go(e, 'slam');
            S.ev('slam', { x: cx(e) + e.facing * 50, y: e.y + e.h, m: 12 });
            for (const d of [-1, 1]) S.proj('wave', cx(e) + e.facing * 50 + d * 20, e.y + e.h, d * 300, 0, { life: 1.0, big: 1 });
            // 불꽃 낙하: 예고 그림자가 먼저 보임
            const L = roomL(S), R = roomR(S);
            const n = P2 ? 4 : 3, seg = (R - L) / n;
            for (let i = 0; i < n; i++) S.proj('rockwarn', L + seg * i + rand(20, seg - 20), e.y + e.h, 0, 0, { life: 1.25 + i * 0.1 });
          }
          break;
        case 'slam':
          if (e.t > 0.8) go(e, 'idle');
          break;
        case 'cwind': // 톱니 던지기
          e.vx = 0;
          if (e.t > 0.7 && !e.ex.thrown) {
            e.ex.thrown = 1;
            S.proj('cog', cx(e) + e.facing * 40, e.y + e.h - 18, e.facing * 250, 0, { life: 4.5 });
            if (P2) S.proj('cog', cx(e) - e.facing * 40, e.y + e.h - 18, -e.facing * 200, 0, { life: 4.5 });
            S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e), p: 0.7 });
          }
          if (e.t > 1.2) { e.ex.thrown = 0; go(e, 'idle'); }
          break;
        case 'vwind': // 바닥 증기구가 한쪽부터 차례로 분출 (2페이즈)
          e.vx = 0;
          if (e.t > 0.6 && !e.ex.vented) {
            e.ex.vented = 1;
            e.ex.vcd = 9;
            const L = roomL(S), R = roomR(S);
            const fromLeft = p ? p.cx > (L + R) / 2 : Math.random() < 0.5;
            const n = 7;
            for (let i = 0; i < n; i++) {
              const k = fromLeft ? i : n - 1 - i;
              S.proj('geyser', L + ((R - L) * (k + 0.5)) / n, e.ex.floor || e.y + e.h, 0, 0, { life: 1.5 + i * 0.3, warn: 1.0 + i * 0.3, steam: 1 });
            }
            S.ev('sfx', { s: 'charge', x: cx(e), y: cy(e) });
          }
          if (e.t > 1.4) { e.ex.vented = 0; go(e, 'idle'); }
          break;
      }
      groundPhys(e, S, dt);
    },
    danger(e) {
      const b = [body(e, 8)];
      if (e.st === 'slam' && e.t < 0.15) b.push(rectFront(e, -10, 70, 40, 24));
      return b;
    },
    draw(ctx, e, time) {
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const P2 = e.ex.p === 2;
      const shake = e.st === 'roar' ? rand(-2, 2) : 0;
      ctx.translate(shake, 0);
      // 다리
      ff(ctx, e, '#2a1e16');
      ctx.fillRect(-30, -22, 16, 22);
      ctx.fillRect(10, -22, 16, 22);
      // 몸통 (화로)
      ff(ctx, e, '#5a3a22');
      ctx.beginPath();
      ctx.moveTo(-40, -20);
      ctx.quadraticCurveTo(-46, -70, -10, -80);
      ctx.quadraticCurveTo(30, -82, 36, -50);
      ctx.lineTo(32, -20);
      ctx.fill();
      // 화로 창
      const glow = 0.6 + Math.sin(time * 5) * 0.2 + (P2 ? 0.3 : 0);
      ctx.fillStyle = `rgba(255,${P2 ? 110 : 160},60,${glow})`;
      ctx.beginPath();
      ctx.arc(-4, -46, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a1e16';
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-4 + i * 7, -58);
        ctx.lineTo(-4 + i * 7, -34);
        ctx.stroke();
      }
      // 머리 (톱니 투구)
      ff(ctx, e, '#7a4a26');
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + time * 0.5, r = i % 2 ? 15 : 12;
        ctx.lineTo(20 + Math.cos(a) * r, -82 + Math.sin(a) * r);
      }
      ctx.fill();
      ctx.fillStyle = e.st === 'hwind' || e.st === 'vwind' ? '#ff7a40' : '#ffd58a';
      ctx.fillRect(22, -85, 7, 4);
      // 망치
      ctx.save();
      ctx.translate(26, -56);
      let ang = 0.6;
      if (e.st === 'hwind') ang = 0.6 - Math.min(1, e.t / 0.6) * 2.6;
      if (e.st === 'slam') ang = Math.min(1.4, -2 + e.t * 30);
      if (e.st === 'cwind') ang = -1.2 + Math.min(1, e.t / 0.7) * 1.8;
      ctx.rotate(ang);
      ctx.fillStyle = '#3a2e26';
      ctx.fillRect(0, -3, 50, 6);
      ff(ctx, e, '#4a3a30');
      ctx.fillRect(42, -16, 22, 32);
      ctx.fillStyle = 'rgba(255,170,90,0.5)';
      ctx.fillRect(42, -16, 4, 32);
      ctx.restore();
      ctx.restore();
    },
  },

  // ════════ 2. 흰 날개 여왕 (비행) ════════
  queen: {
    name: '흰 날개 여왕', sub: '바람 위의 정원을 다스리는 자', music: 'boss',
    w: 76, h: 58, hp: 300, amber: 320, light: 240, boss: true, fly: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.n = 0; },
    update(e, dt, S) {
      if (e.st === 'intro') {
        e.vx = 0; e.vy = Math.sin(e.t * 3) * 20;
        flyPhys(e, S, dt);
        if (e.t > 1.9) go(e, 'idle');
        return;
      }
      const p = S.near(e);
      const P2 = e.ex.p === 2;
      if (!P2 && hpFrac(e) <= 0.5) {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1 });
      }
      // 바닥에서 약 220px 위를 맴돌아 항상 화면 안에 보이게
      const fl = e.ex.floor || S.room.py + S.room.ph - TILE * 9;
      const hoverY = fl - 230 + Math.sin(e.t * 2) * 16;
      const steer = (tx, ty, sp) => {
        e.vx += (clamp(tx - cx(e), -sp, sp) - e.vx) * dt * 2.2;
        e.vy += (clamp(ty - cy(e), -sp, sp) - e.vy) * dt * 2.2;
      };
      switch (e.st) {
        case 'roar':
          e.vx *= 0.9; e.vy *= 0.9;
          if (e.t > 1.2) go(e, 'idle');
          break;
        case 'idle':
          if (p) {
            e.facing = Math.sign(p.cx - cx(e)) || 1;
            steer(p.cx - e.facing * 160, hoverY, 160);
          }
          if (e.t > (P2 ? 0.9 : 1.2)) {
            const r = Math.random();
            if (r < 0.38) go(e, 'fwind');
            else if (r < 0.7) go(e, 'swind');
            else if (P2 && r < 0.88) go(e, 'rwind');
            else go(e, 'gwind');
          }
          break;
        case 'fwind': // 깃털 부채 (사이에 빈틈)
          e.vx *= 0.9; e.vy *= 0.9;
          if (e.t > 0.75) {
            const a0 = p ? Math.atan2(p.cy - cy(e), p.cx - cx(e)) : Math.PI / 2;
            for (const da of [-0.56, -0.28, 0, 0.28, 0.56]) S.proj('thorn', cx(e), cy(e), Math.cos(a0 + da) * 290, Math.sin(a0 + da) * 290, { life: 3, feather: 1 });
            S.ev('sfx', { s: 'swing', x: cx(e), y: cy(e), p: 1.2 });
            go(e, 'rest');
          }
          break;
        case 'swind': // 급강하: 목표 지점에 점선 예고
          e.vx *= 0.85; e.vy *= 0.85;
          if (p && e.t < 0.5) { e.ex.tx = p.cx; e.ex.ty = p.y + p.h - 10; }
          if (e.t > 0.95) {
            const a = Math.atan2(e.ex.ty - cy(e), e.ex.tx - cx(e));
            e.vx = Math.cos(a) * 600; e.vy = Math.sin(a) * 600;
            go(e, 'swoop');
            S.ev('sfx', { s: 'dash', x: cx(e), y: cy(e) });
          }
          break;
        case 'swoop':
          if (e.t > 0.75 || e.grounded) { go(e, 'rise'); }
          break;
        case 'rise':
          steer(cx(e), hoverY, 260);
          if (e.t > 0.9) go(e, 'idle');
          break;
        case 'gwind': // 돌풍 벽 (밀어냄, 피해 없음)
          e.vx *= 0.9; e.vy *= 0.9;
          if (e.t > 0.7) {
            for (const d of [-1, 1]) S.proj('gust', cx(e), (e.ex.floor || S.room.py + S.room.ph - TILE * 3) - 40, d * 200, 0, { life: 3 });
            go(e, 'rest');
          }
          break;
        case 'rwind': // 깃털 고리: 천천히 퍼지며 두 칸이 비어 있음 (2페이즈)
          e.vx *= 0.9; e.vy *= 0.9;
          if (e.t > 0.9) {
            const gap = rand(0, 12) | 0;
            for (let i = 0; i < 12; i++) {
              if (i === gap || i === (gap + 1) % 12) continue;
              const a = (i / 12) * Math.PI * 2;
              S.proj('thorn', cx(e), cy(e), Math.cos(a) * 170, Math.sin(a) * 170, { life: 3.5, feather: 1 });
            }
            go(e, 'rest');
          }
          break;
        case 'rest':
          e.vx *= 0.92; e.vy *= 0.92;
          if (e.t > 0.7) go(e, 'idle');
          break;
      }
      const r = flyPhys(e, S, dt);
      e.grounded = r.hitY > 0;
      if (!e.ex.floor) {
        let fy = cy(e);
        while (!S.world.solidAt(cx(e), fy) && fy < S.room.py + S.room.ph) fy += 16;
        e.ex.floor = Math.floor(fy / TILE) * TILE;
      }
    },
    danger(e) {
      return [body(e, 6)];
    },
    draw(ctx, e, time) {
      if (e.st === 'swind' && e.ex.tx != null) {
        const k = Math.min(1, e.t / 0.95);
        ctx.strokeStyle = `rgba(180,220,255,${0.15 + k * 0.5})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(cx(e), cy(e));
        ctx.lineTo(e.ex.tx, e.ex.ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(e.ex.tx, e.ex.ty, 14 + k * 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(cx(e), cy(e));
      ctx.scale(e.facing, 1);
      const flap = Math.sin(time * (e.st === 'swoop' ? 4 : 7)) * (e.st === 'swoop' ? 0.1 : 0.4);
      const P2 = e.ex.p === 2;
      // 날개 (큰 흰 나방 날개)
      for (const sd of [-1, 1]) {
        ctx.save();
        ctx.scale(1, 1);
        ctx.rotate(sd * (0.2 + flap));
        ff(ctx, e, sd < 0 ? '#c9d2da' : '#eef2f5');
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.bezierCurveTo(-30 * sd, -60, -78 * sd, -40, -70 * sd, -6);
        ctx.bezierCurveTo(-60 * sd, 10, -30 * sd, 6, 0, 4);
        ctx.fill();
        ctx.fillStyle = P2 ? 'rgba(255,120,130,0.4)' : 'rgba(150,200,255,0.35)';
        ctx.beginPath();
        ctx.arc(-44 * sd, -24, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // 몸
      ff(ctx, e, '#e6e9ec');
      ctx.beginPath();
      ctx.ellipse(0, 6, 10, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      // 가면 + 왕관
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#fbfaf5';
      ctx.beginPath();
      ctx.ellipse(4, -16, 11, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e2b04a';
      ctx.beginPath();
      ctx.moveTo(-4, -24);
      ctx.lineTo(-2, -32);
      ctx.lineTo(2, -26);
      ctx.lineTo(5, -34);
      ctx.lineTo(8, -26);
      ctx.lineTo(12, -31);
      ctx.lineTo(12, -23);
      ctx.fill();
      const wind = e.st.endsWith('wind');
      ctx.fillStyle = wind ? '#5aa8ff' : '#1a2430';
      ctx.beginPath();
      ctx.ellipse(1, -15, 2.4, 3.6, 0.2, 0, Math.PI * 2);
      ctx.ellipse(9, -15, 2.4, 3.6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  // ════════ 3. 재를 삼킨 자 (최종) ════════
  devourer: {
    name: '재를 삼킨 자', sub: '왕국의 불을 삼킨 거대한 어둠', music: 'final',
    w: 104, h: 116, hp: 440, amber: 600, light: 260, boss: true,
    init(e) { e.st = 'intro'; e.ex.p = 1; e.ex.tcd = 6; },
    update(e, dt, S) {
      if (intro(e)) return groundPhys(e, S, dt);
      const p = S.near(e);
      const ph = e.ex.p;
      if (!e.ex.floor && e.grounded) e.ex.floor = e.y + e.h;
      if (ph === 1 && hpFrac(e) <= 0.66) {
        e.ex.p = 2;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1 });
      } else if (ph === 2 && hpFrac(e) <= 0.33) {
        e.ex.p = 3;
        go(e, 'roar');
        S.ev('phase', { x: cx(e), y: cy(e), roar: 1, dark: 1 });
      }
      e.ex.tcd -= dt;
      const sp = ph === 3 ? 1.15 : 1;
      const L = roomL(S), R = roomR(S);
      switch (e.st) {
        case 'roar':
          e.vx = 0;
          if (e.t > 1.4) go(e, 'idle');
          break;
        case 'idle': {
          if (p) e.facing = Math.sign(p.cx - cx(e)) || 1;
          const d = p ? Math.abs(p.cx - cx(e)) : 0;
          e.vx = d > 220 ? e.facing * 60 : 0;
          if (e.t > 1.0 / sp) {
            const r = Math.random();
            if (ph >= 2 && e.ex.tcd <= 0 && r < 0.4) go(e, 'twind');
            else if (ph >= 2 && r < 0.55) go(e, 'vwind');
            else if (r < 0.7) go(e, 'fwind');
            else go(e, 'bwind');
            e.vx = 0;
          }
          break;
        }
        case 'fwind': // 주먹 내려치기: 착지 지점 그림자 예고
          e.vx = 0;
          if (p && e.t < 0.5) e.ex.fx = clamp(p.cx, L + 40, R - 40);
          if (e.t > 0.95 / sp && !e.ex.fist) {
            e.ex.fist = 1;
            S.proj('fist', e.ex.fx, e.ex.floor || e.y + e.h, 0, 0, { life: 0.9, warn: 0.01 });
            S.ev('slam', { x: e.ex.fx, y: e.ex.floor || e.y + e.h, m: 12 });
            for (const d of [-1, 1]) S.proj('wave', e.ex.fx + d * 30, e.ex.floor || e.y + e.h, d * 280, 0, { life: 0.9 });
          }
          if (e.t > 1.5 / sp) { e.ex.fist = 0; go(e, 'idle'); }
          break;
        case 'bwind': // 재 숨결: 포물선 재 덩어리 3개
          e.vx = 0;
          if (e.t > 0.9 / sp && !e.ex.breathed) {
            e.ex.breathed = 1;
            const px = p ? p.cx : cx(e) + e.facing * 200;
            for (const off of [-150, 0, 150]) {
              const tx = clamp(px + off, L, R), fl = 1.0;
              const dx = tx - cx(e), dy = (e.ex.floor || e.y + e.h) - (e.y + 30);
              S.proj('wax', cx(e) + e.facing * 30, e.y + 30, dx / fl, dy / fl - 0.5 * 1400 * fl, { life: 3, grav: 1400, ash: 1 });
            }
            S.ev('sfx', { s: 'roar', x: cx(e), y: cy(e), p: 1.4 });
          }
          if (e.t > 1.5 / sp) { e.ex.breathed = 0; go(e, 'idle'); }
          break;
        case 'vwind': // 빨아들이기: 몸쪽으로 당김(피해 없음) + 바닥에 재 장판 없음
          e.vx = 0;
          if (e.t > 0.7 && !e.ex.vort) {
            e.ex.vort = 1;
            S.proj('vortex', cx(e), cy(e), 0, 0, { life: 2.2 });
          }
          if (e.t > 3.0) { e.ex.vort = 0; go(e, 'idle'); }
          break;
        case 'twind': // 재의 물결: 한쪽 벽에서 낮은 파도 (점프/고리로 넘김)
          e.vx = 0;
          if (e.t > 0.9 && !e.ex.tide) {
            e.ex.tide = 1;
            e.ex.tcd = ph === 3 ? 8 : 11;
            const fromLeft = p ? p.cx > cx(e) : true;
            S.proj('wave', fromLeft ? L + 10 : R - 10, e.ex.floor || e.y + e.h, (fromLeft ? 1 : -1) * 260, 0, { life: 4.5, big: 1 });
            S.ev('sfx', { s: 'boom', x: cx(e), y: cy(e) });
          }
          if (e.t > 1.6) { e.ex.tide = 0; go(e, 'idle'); }
          break;
      }
      groundPhys(e, S, dt);
    },
    danger(e) {
      return [body(e, 10)];
    },
    draw(ctx, e, time) {
      // 주먹 그림자 예고
      if (e.st === 'fwind' && e.ex.fx != null && !e.ex.fist) {
        const k = Math.min(1, e.t / 0.95);
        ctx.fillStyle = `rgba(0,0,0,${0.3 + k * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(e.ex.fx, (e.ex.floor || e.y + e.h) - 2, 30 + k * 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,120,80,${0.3 + k * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(cx(e), e.y + e.h);
      ctx.scale(e.facing, 1);
      const ph = e.ex.p;
      const breathe = Math.sin(time * 1.5) * 3;
      // 몸 (재 덩어리)
      ff(ctx, e, '#1a1412');
      ctx.beginPath();
      ctx.moveTo(-52, 0);
      ctx.bezierCurveTo(-64, -60, -40, -112 - breathe, 0, -116 - breathe);
      ctx.bezierCurveTo(44, -112 - breathe, 62, -60, 52, 0);
      ctx.fill();
      // 재 부스러기
      ctx.fillStyle = 'rgba(90,70,60,0.6)';
      for (let i = 0; i < 10; i++) {
        const a = time * 0.8 + i;
        ctx.fillRect(Math.cos(a) * 50, -60 + Math.sin(a * 1.3) * 50, 3, 3);
      }
      // 배 안의 삼킨 등불들
      for (let i = 0; i < 5; i++) {
        const lx = -24 + i * 12, ly = -40 + Math.sin(time * 2 + i) * 4;
        const a = ph === 3 ? 0.3 : 0.75;
        ctx.fillStyle = `rgba(255,${150 + i * 15},80,${a * (0.6 + Math.sin(time * 4 + i) * 0.3)})`;
        ctx.fillRect(lx - 3, ly - 4, 6, 8);
      }
      // 얼굴: 큰 입과 금 간 가면
      ctx.fillStyle = e.fl > 0 ? '#fff' : '#d8cfbc';
      ctx.beginPath();
      ctx.ellipse(10, -92 - breathe, 22, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1412';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -110);
      ctx.lineTo(8, -96);
      ctx.lineTo(2, -86);
      ctx.stroke();
      const open = e.st === 'bwind' || e.st === 'vwind' || e.st === 'roar' ? 1 : 0.25;
      ctx.fillStyle = '#0a0606';
      ctx.beginPath();
      ctx.ellipse(14, -82 - breathe, 12, 4 + open * 8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (open > 0.5) {
        ctx.fillStyle = 'rgba(255,120,60,0.6)';
        ctx.beginPath();
        ctx.ellipse(14, -80 - breathe, 6, 3 + open * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = ph === 3 || e.st.endsWith('wind') ? '#ff6a3a' : '#2a1a14';
      ctx.beginPath();
      ctx.ellipse(6, -96 - breathe, 3, 4, 0.2, 0, Math.PI * 2);
      ctx.ellipse(20, -96 - breathe, 3, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // 팔
      ff(ctx, e, '#221a16');
      const raise = e.st === 'fwind' && !e.ex.fist ? Math.min(1, e.t / 0.6) : 0;
      ctx.beginPath();
      ctx.ellipse(46, -40 - raise * 50, 14, 26, 0.3 - raise, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
};
