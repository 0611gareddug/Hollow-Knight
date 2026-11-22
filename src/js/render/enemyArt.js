// 1장 몹 리디자인 그림: 그라데이션 음영, 하이라이트, 움직이는 부위
// (행동/판정은 enemies.js 그대로, 그리기 함수만 교체)
import { ENEMIES } from '../entities/enemies.js';
import { rand } from '../core/util.js';

const cx = (e) => e.x + e.w / 2;
const cy = (e) => e.y + e.h / 2;
function vgrad(ctx, y0, y1, top, bot) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  return g;
}
const F = (e, c) => (e.fl > 0 ? '#ffffff' : c);

// ─── 심지벌레 ───
ENEMIES.crawler.draw = function (ctx, e, time) {
  ctx.save();
  ctx.translate(cx(e), e.y + e.h);
  ctx.scale(e.facing, 1);
  const wig = Math.sin(time * 10 + e.id) * 1.4;
  // 다리
  ctx.strokeStyle = '#0a0c0e';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const lx = -12 + i * 6, k = Math.sin(time * 16 + i * 1.3) * 2;
    ctx.beginPath();
    ctx.moveTo(lx, -4);
    ctx.lineTo(lx + k, 0);
    ctx.stroke();
  }
  // 몸 마디 (뒤→앞)
  for (let i = 0; i < 4; i++) {
    const sx = -11 + i * 7, sy = -9 + (i % 2 ? wig : -wig) * 0.4 - (i === 3 ? 1 : 0);
    const r = i === 3 ? 7.5 : 7 - (i === 0 ? 1 : 0);
    ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, sy - r, sy + r, '#2c3438', '#0b0e10');
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    // 등딱지 하이라이트
    ctx.strokeStyle = 'rgba(150,180,180,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, r - 1.5, -2.6, -0.9);
    ctx.stroke();
  }
  // 머리 + 큰턱
  ctx.fillStyle = F(e, '#1a1f22');
  ctx.beginPath();
  ctx.ellipse(14, -8, 5.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c8bfa8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(18, -6);
  ctx.quadraticCurveTo(22, -5 + wig * 0.3, 20, -2);
  ctx.moveTo(18, -9);
  ctx.quadraticCurveTo(22, -10 - wig * 0.3, 21, -12);
  ctx.stroke();
  ctx.fillStyle = '#f2ead6';
  ctx.beginPath();
  ctx.arc(15.5, -10, 1.5, 0, Math.PI * 2);
  ctx.arc(16.5, -7, 1.1, 0, Math.PI * 2);
  ctx.fill();
  // 초 + 촛농
  ctx.fillStyle = '#d8cfb8';
  ctx.fillRect(-6, -21, 5, 7);
  ctx.fillStyle = '#efe6cf';
  ctx.beginPath();
  ctx.moveTo(-6, -21);
  ctx.lineTo(-1, -21);
  ctx.lineTo(-1, -18);
  ctx.quadraticCurveTo(-2, -15, -3, -18);
  ctx.quadraticCurveTo(-5, -14, -6, -17);
  ctx.fill();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3.5, -21);
  ctx.lineTo(-3.5, -24);
  ctx.stroke();
  const fl = 1 + Math.sin(time * 22 + e.id) * 0.18;
  ctx.fillStyle = 'rgba(255,170,70,0.35)';
  ctx.beginPath();
  ctx.arc(-3.5, -27, 7 * fl, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(-3.5, -33 * fl - 0 + 6);
  ctx.quadraticCurveTo(0, -27, -3.5, -24);
  ctx.quadraticCurveTo(-7, -27, -3.5, -33 * fl + 6);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.ellipse(-3.5, -26, 1.2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// ─── 갑각 파수꾼 ───
ENEMIES.guard.draw = function (ctx, e, time) {
  ctx.save();
  ctx.translate(cx(e), e.y + e.h);
  ctx.scale(e.facing, 1);
  const wind = e.st === 'wind' ? Math.min(1, e.t / 0.6) : 0;
  ctx.translate(-wind * 4, 0);
  const step = e.st === 'walk' ? Math.sin(time * 8 + e.id) : 0;
  // 다리
  ctx.fillStyle = '#0a0c0e';
  ctx.fillRect(-8 + step * 2, -6, 4, 6);
  ctx.fillRect(3 - step * 2, -6, 4, 6);
  // 등껍질 (둥근 갑각)
  ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -40, 0, '#3a4a50', '#0e1416');
  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.bezierCurveTo(-18, -24, -12, -40, 0, -40);
  ctx.bezierCurveTo(10, -40, 12, -30, 10, -18);
  ctx.lineTo(9, -4);
  ctx.closePath();
  ctx.fill();
  // 갑각 이음새
  ctx.strokeStyle = 'rgba(120,150,150,0.4)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(-14 + k, -12 - k * 9);
    ctx.quadraticCurveTo(-3, -16 - k * 9, 8, -12 - k * 9);
    ctx.stroke();
  }
  // 투구 + 뿔
  ctx.fillStyle = F(e, '#1c2428');
  ctx.beginPath();
  ctx.moveTo(-4, -36);
  ctx.quadraticCurveTo(2, -50, 12, -48);
  ctx.quadraticCurveTo(5, -44, 8, -36);
  ctx.fill();
  ctx.fillStyle = F(e, '#2a363b');
  ctx.beginPath();
  ctx.ellipse(4, -33, 7, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.st === 'wind' ? '#ffb347' : '#dfe8e4';
  ctx.fillRect(5, -34, 5, 2.5);
  // 창 + 깃발
  const thr = e.st === 'thrust' ? 18 : -wind * 7;
  ctx.strokeStyle = F(e, '#8c8576');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8 + thr, -18);
  ctx.lineTo(34 + thr, -18);
  ctx.stroke();
  ctx.fillStyle = '#d9d0bc';
  ctx.beginPath();
  ctx.moveTo(34 + thr, -22);
  ctx.lineTo(46 + thr, -18);
  ctx.lineTo(34 + thr, -14);
  ctx.fill();
  ctx.fillStyle = '#7a2a2a';
  ctx.beginPath();
  ctx.moveTo(26 + thr, -18);
  ctx.lineTo(30 + thr + Math.sin(time * 6) * 2, -10);
  ctx.lineTo(24 + thr, -12);
  ctx.fill();
  // 방패 (등불 문양)
  ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -38, -4, '#46565c', '#1c2427');
  ctx.beginPath();
  ctx.ellipse(10, -20, 7, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6c7f84';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,190,110,0.7)';
  ctx.fillRect(9, -24, 3, 6);
  ctx.fillStyle = '#8fa0a3';
  for (const yy of [-32, -8]) ctx.fillRect(9.5, yy, 2, 2);
  ctx.restore();
};

// ─── 등롱나방 ───
ENEMIES.moth.draw = function (ctx, e, time) {
  ctx.save();
  ctx.translate(cx(e), cy(e));
  const wind = e.st === 'wind';
  if (wind) ctx.translate(rand(-1.5, 1.5), rand(-1.5, 1.5));
  ctx.scale(e.facing, 1);
  if (e.st === 'charge') ctx.rotate(Math.atan2(e.vy, Math.abs(e.vx)) * 0.4);
  const flap = Math.sin(time * (e.st === 'charge' ? 40 : 16) + e.id);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(1, s);
    ctx.rotate(-0.2 + flap * 0.5);
    // 날개 본체 + 무늬
    ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -26, 0, '#4a4a52', '#16181c');
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.bezierCurveTo(-20, -30, 4, -32, 8, -4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,130,0.45)';
    ctx.beginPath();
    ctx.arc(1, -16, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(1, -16, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,170,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.quadraticCurveTo(-6, -18, 2, -26);
    ctx.stroke();
    ctx.restore();
  }
  // 털 많은 몸
  ctx.fillStyle = F(e, '#2a2522');
  ctx.beginPath();
  ctx.ellipse(3, -2, 7, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,140,120,0.4)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-1 + i * 2, -7);
    ctx.lineTo(-2 + i * 2.2, -9);
    ctx.stroke();
  }
  // 더듬이
  ctx.strokeStyle = '#cfc6b2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.quadraticCurveTo(13, -14, 17, -12);
  ctx.moveTo(7, -6);
  ctx.quadraticCurveTo(10, -15, 14, -16);
  ctx.stroke();
  // 등불 배
  const glow = wind ? 1 : 0.65 + Math.sin(time * 4 + e.id) * 0.2;
  const lg = ctx.createRadialGradient(-6, 3, 0, -6, 3, 7);
  lg.addColorStop(0, `rgba(255,240,190,${glow})`);
  lg.addColorStop(0.6, `rgba(255,${wind ? 110 : 170},70,${glow})`);
  lg.addColorStop(1, 'rgba(120,50,20,0.6)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.ellipse(-6, 3, 6.5, 5.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2ead6';
  ctx.fillRect(8, -4, 2, 2);
  ctx.restore();
};

// ─── 물방울 포식자 ───
ENEMIES.dropper.draw = function (ctx, e, time) {
  const x = cx(e);
  ctx.save();
  if (e.st === 'hang' || e.st === 'shiver') {
    const sw = Math.sin(time * 2 + e.id) * 2 + (e.st === 'shiver' ? rand(-2, 2) : 0);
    ctx.strokeStyle = 'rgba(120,200,190,0.5)';
    ctx.lineWidth = 1.2;
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
  // 반투명 젤리 몸
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 2, 16);
  g.addColorStop(0, e.fl > 0 ? '#fff' : 'rgba(150,255,235,0.85)');
  g.addColorStop(0.5, e.fl > 0 ? '#fff' : 'rgba(30,110,100,0.85)');
  g.addColorStop(1, 'rgba(8,30,30,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.bezierCurveTo(11, -6, 15, 5, 0, 13);
  ctx.bezierCurveTo(-15, 5, -11, -6, 0, -15);
  ctx.fill();
  // 핵
  ctx.fillStyle = `rgba(20,60,55,${0.7 + Math.sin(time * 3 + e.id) * 0.2})`;
  ctx.beginPath();
  ctx.arc(1, 3, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // 반짝임
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-4, -6, 1.6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // 이빨 + 눈
  ctx.fillStyle = '#e8e2d2';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3 - 1.2, 9);
    ctx.lineTo(i * 3, 13.5);
    ctx.lineTo(i * 3 + 1.2, 9);
    ctx.fill();
  }
  ctx.fillStyle = e.st === 'shiver' ? '#ffb347' : '#e8fff8';
  ctx.fillRect(-4, -3, 2, 2);
  ctx.fillRect(3, -3, 2, 2);
  ctx.restore();
};

// ─── 가시뿌리 덩굴 ───
ENEMIES.vine.draw = function (ctx, e, time) {
  ctx.save();
  ctx.translate(e.facing > 0 ? e.x : e.x + e.w, cy(e));
  ctx.scale(e.facing, 1);
  const out = e.st === 'hide' ? 0.15 : e.st === 'rise' ? Math.min(1, e.t / 0.35) : 1;
  // 뿌리 뭉치
  ctx.strokeStyle = '#10241a';
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 6);
    ctx.bezierCurveTo(-4, i * 12, 2, i * 18, -3, i * 26);
    ctx.stroke();
  }
  ctx.fillStyle = vgrad(ctx, -20, 20, '#1c3826', '#0a160f');
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // 잎
  ctx.fillStyle = '#20402c';
  for (const [ly, la] of [[-14, -0.8], [12, 0.8], [-4, -0.2]]) {
    ctx.save();
    ctx.translate(4, ly);
    ctx.rotate(la + Math.sin(time * 2 + ly) * 0.1);
    ctx.beginPath();
    ctx.ellipse(8, 0, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 꽃봉오리 머리
  ctx.translate(out * 18, 0);
  ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -12, 12, '#2f5a3e', '#12261a');
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 9 + out * 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (out > 0.3) {
    // 벌어지는 붉은 꽃잎
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.6;
      ctx.fillStyle = e.st === 'rise' ? '#ff5a64' : '#b8304a';
      ctx.save();
      ctx.rotate(a * out);
      ctx.beginPath();
      ctx.ellipse(8, 0, 6 * out, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffd58a';
    ctx.beginPath();
    ctx.arc(7, 0, 2.2 * out, 0, Math.PI * 2);
    ctx.fill();
  }
  // 가시
  ctx.fillStyle = '#c9d6b0';
  for (let i = 0; i < 6; i++) {
    const a = -1.4 + i * 0.56;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
    ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
    ctx.lineTo(Math.cos(a + 0.22) * 9, Math.sin(a + 0.22) * 9);
    ctx.fill();
  }
  ctx.restore();
};

// ─── 도약 개구리기사 ───
ENEMIES.frog.draw = function (ctx, e, time) {
  ctx.save();
  ctx.translate(cx(e), e.y + e.h);
  ctx.scale(e.facing, 1);
  let sy = 1;
  if (e.st === 'crouch') sy = 1 - Math.min(1, e.t / 0.5) * 0.3;
  if (e.st === 'land') sy = 0.75 + Math.min(1, e.t / 0.3) * 0.25;
  if (e.st === 'leap') sy = 1.15;
  ctx.scale(1 / Math.sqrt(sy), sy);
  // 뒷다리
  ctx.fillStyle = F(e, '#123038');
  ctx.beginPath();
  ctx.ellipse(-11, -8, 12, 8.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a1a1f';
  ctx.fillRect(-20, -2, 10, 2);
  // 몸
  ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -32, -2, '#2a5a5e', '#0e2428');
  ctx.beginPath();
  ctx.ellipse(2, -18, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // 점무늬
  ctx.fillStyle = 'rgba(120,220,200,0.35)';
  for (const [px, py, pr] of [[-6, -22, 2.5], [-1, -12, 1.8], [-9, -14, 1.5], [4, -26, 1.6]]) {
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  // 목주머니
  ctx.fillStyle = e.st === 'crouch' ? 'rgba(255,190,110,0.8)' : 'rgba(200,210,180,0.55)';
  ctx.beginPath();
  ctx.ellipse(12, -12, 5, 4 + (e.st === 'crouch' ? 2 : 0), 0, 0, Math.PI * 2);
  ctx.fill();
  // 투구 + 깃털 장식
  ctx.fillStyle = F(e, '#3d5258');
  ctx.beginPath();
  ctx.arc(8, -26, 10, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-3, -27, 22, 3);
  ctx.fillStyle = '#b8443a';
  ctx.beginPath();
  ctx.moveTo(6, -36);
  ctx.quadraticCurveTo(-4, -46 + Math.sin(time * 5) * 2, -10, -38);
  ctx.quadraticCurveTo(-2, -40, 4, -35);
  ctx.fill();
  ctx.fillStyle = e.st === 'crouch' ? '#ffb347' : '#9ff0dc';
  ctx.fillRect(11, -24, 4, 3);
  // 앞다리
  ctx.fillStyle = F(e, '#123038');
  ctx.fillRect(10, -9, 5, 9);
  ctx.restore();
};

// ─── 재의 수도승 ───
ENEMIES.monk.draw = function (ctx, e, time) {
  let a = 1;
  if (e.st === 'vanish') a = 1 - Math.min(1, e.t / 0.35);
  if (e.st === 'appear') a = Math.min(1, e.t / 0.25);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx(e), e.y + e.h);
  ctx.scale(e.facing, 1);
  const hov = Math.sin(time * 3 + e.id) * 1.5;
  // 겹친 로브
  ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -44, 0, '#3a2a48', '#120c18');
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-15, -30, -4, -40 + hov);
  ctx.quadraticCurveTo(9, -44 + hov, 11, -30);
  ctx.lineTo(14, 0);
  ctx.lineTo(8, -5);
  ctx.lineTo(2, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,160,220,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 + i * 6, -28);
    ctx.quadraticCurveTo(-9 + i * 6, -14, -7 + i * 7, -2);
    ctx.stroke();
  }
  // 염주
  ctx.fillStyle = '#c8a26a';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(-6 + i * 2.6, -26 + Math.sin(i * 0.8) * 3 + hov * 0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // 두건
  ctx.fillStyle = F(e, '#24182e');
  ctx.beginPath();
  ctx.moveTo(-6, -32 + hov);
  ctx.quadraticCurveTo(-4, -48 + hov, 6, -46 + hov);
  ctx.quadraticCurveTo(12, -40 + hov, 9, -30 + hov);
  ctx.fill();
  ctx.fillStyle = '#050307';
  ctx.beginPath();
  ctx.ellipse(4, -36 + hov, 4.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.st === 'cast' ? '#ffd27a' : '#c8a2e8';
  ctx.fillRect(3, -37 + hov, 3, 1.8);
  ctx.fillRect(6.5, -37 + hov, 1.6, 1.8);
  // 향로 + 사슬 + 연기
  const glow = e.st === 'cast' ? 1 : 0.6;
  ctx.strokeStyle = '#6a5a48';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, -26 + hov);
  ctx.lineTo(14 + Math.sin(time * 2) * 2, -16 + hov);
  ctx.stroke();
  ctx.fillStyle = '#3a2e22';
  ctx.beginPath();
  ctx.arc(14 + Math.sin(time * 2) * 2, -13 + hov, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,150,70,${glow})`;
  ctx.beginPath();
  ctx.arc(14 + Math.sin(time * 2) * 2, -13 + hov, e.st === 'cast' ? 3.5 : 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,130,180,0.25)';
  for (let i = 0; i < 3; i++) {
    const yy = -20 - ((time * 18 + i * 9) % 26);
    ctx.beginPath();
    ctx.arc(14 + Math.sin(time + i) * 3, yy + hov, 2.5 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

// ─── 녹슨 갑옷 기사 ───
const knightDrawOld = ENEMIES.knight.draw;
ENEMIES.knight.draw = function (ctx, e, time) {
  ctx.save();
  ctx.translate(cx(e), e.y + e.h);
  ctx.scale(e.facing, 1);
  const wind = (e.st === 'swing' && e.t < 0.36) || e.st === 'dwind';
  // 너덜너덜한 망토
  ctx.fillStyle = '#2e1214';
  ctx.beginPath();
  ctx.moveTo(-6, -46);
  ctx.quadraticCurveTo(-28, -24, -22 + Math.sin(time * 3) * 2, 0);
  ctx.lineTo(-18, -4);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-10, -5);
  ctx.lineTo(-4, -4);
  ctx.fill();
  // 다리 갑옷
  ctx.fillStyle = '#1a1d1f';
  ctx.fillRect(-10, -12, 7, 12);
  ctx.fillRect(3, -12, 7, 12);
  // 몸통 판금
  ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -50, -8, '#4a4f52', '#16191b');
  ctx.beginPath();
  ctx.moveTo(-13, -8);
  ctx.lineTo(-15, -34);
  ctx.quadraticCurveTo(-12, -48, 0, -50);
  ctx.quadraticCurveTo(14, -48, 14, -34);
  ctx.lineTo(12, -8);
  ctx.closePath();
  ctx.fill();
  // 견갑
  ctx.fillStyle = F(e, '#3a3f42');
  ctx.beginPath();
  ctx.ellipse(-10, -40, 8, 5, -0.4, 0, Math.PI * 2);
  ctx.ellipse(11, -40, 7, 4.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // 녹 + 판금 선
  ctx.fillStyle = 'rgba(150,72,38,0.55)';
  ctx.fillRect(-8, -30, 6, 4);
  ctx.fillRect(5, -20, 5, 6);
  ctx.fillRect(-12, -16, 4, 3);
  ctx.strokeStyle = 'rgba(180,180,170,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-13, -26);
  ctx.lineTo(13, -26);
  ctx.moveTo(-12, -18);
  ctx.lineTo(12, -18);
  ctx.stroke();
  // 투구 틈
  ctx.fillStyle = F(e, '#2a2f32');
  ctx.beginPath();
  ctx.ellipse(4, -44, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = wind ? '#ff7a40' : '#ffcf8a';
  ctx.fillRect(3, -45, 10, 2.5);
  if (wind) {
    ctx.fillStyle = 'rgba(255,120,60,0.35)';
    ctx.beginPath();
    ctx.arc(8, -44, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // 검/방패는 기존 그림 재사용 (몸통 위에 겹쳐 그림)
  ctx.save();
  ctx.translate(cx(e), e.y + e.h);
  ctx.scale(e.facing, 1);
  ctx.save();
  ctx.translate(8, -26);
  let ang = -0.6;
  if (wind) ang = -2.2;
  if (e.st === 'swing' && e.t >= 0.36) ang = -2.2 + Math.min(1, (e.t - 0.36) / 0.12) * 3;
  if (e.st === 'dash' || e.st === 'dwind') ang = e.st === 'dash' ? 0 : -2.6;
  if (e.st === 'guard' || e.st === 'bash') ang = -1.5;
  ctx.rotate(ang);
  ctx.fillStyle = e.fl > 0 ? '#fff' : vgrad(ctx, -2, 2, '#c8c2b4', '#7d776a');
  ctx.beginPath();
  ctx.moveTo(0, -2.5);
  ctx.lineTo(44, -1.5);
  ctx.lineTo(48, 0);
  ctx.lineTo(44, 1.5);
  ctx.lineTo(0, 2.5);
  ctx.fill();
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(-7, -5, 7, 10);
  ctx.fillStyle = '#8a6a3a';
  ctx.fillRect(-1, -6, 2, 12);
  ctx.restore();
  if (e.st === 'guard' || e.st === 'bash') {
    if (e.st === 'bash') ctx.translate(e.t < 0.45 ? -4 * (e.t / 0.45) : 6, 0);
    ctx.fillStyle = e.st === 'bash' && e.t < 0.45 ? '#6a4a2a' : vgrad(ctx, -46, -8, '#4a565c', '#22292c');
    ctx.fillRect(12, -46, 8, 38);
    ctx.fillStyle = 'rgba(255,220,150,0.45)';
    ctx.fillRect(18, -46, 2, 38);
  }
  ctx.restore();
  void knightDrawOld;
};
