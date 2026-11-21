// 나방 기사 (오리지널 캐릭터) 절차적 드로잉
import { CLOAKS } from '../core/settings.js';

// s: {x,y,w,h,facing,anim,animT,atkDir,atkT,flash,invul,cloak,mask,ghost,focus,dashT,landT,vy}
export function drawMoth(ctx, s, time) {
  const cl = CLOAKS[s.cloak] || CLOAKS[0];
  const cx = s.x + s.w / 2;
  const foot = s.y + s.h;
  const f = s.facing || 1;
  let alpha = s.ghost ? 0.42 : 1;
  if (s.invul > 0 && !s.ghost && Math.floor(time * 20) % 2 === 0) alpha *= 0.35;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, foot);

  if (s.anim === 'cocoon') {
    drawCocoon(ctx, s, time);
    ctx.restore();
    return;
  }

  // 자세별 변형
  let sx = 1, sy = 1, lean = 0, bob = 0;
  const a = s.anim;
  if (a === 'idle') bob = Math.sin(time * 2.6) * 0.8;
  else if (a === 'run') {
    bob = -Math.abs(Math.sin(s.animT * 13)) * 2.5;
    lean = 0.12;
  } else if (a === 'jump') {
    sx = 0.9; sy = 1.1;
  } else if (a === 'fall') {
    sx = 0.95; sy = 1.04; lean = -0.05;
  } else if (a === 'dash') {
    sx = 1.35; sy = 0.78; lean = 0.25;
  } else if (a === 'wall') {
    lean = -0.05;
  } else if (a === 'focus') {
    sy = 0.9; sx = 1.06; bob = Math.sin(time * 30) * 0.6;
  } else if (a === 'sit') {
    sy = 0.82;
  } else if (a === 'hurt') {
    lean = -0.3;
  } else if (a === 'dead') {
    sy = 0.4; sx = 1.3;
  }
  if (s.landT > 0) {
    const k = s.landT / 0.12;
    sy *= 1 - 0.18 * k;
    sx *= 1 + 0.15 * k;
  }
  ctx.scale(f * sx, sy);
  ctx.rotate(lean);
  ctx.translate(0, bob);

  const flash = s.flash > 0;
  const cloakC = flash ? '#ffffff' : cl.c;
  const cloakD = flash ? '#dddddd' : cl.d;

  // 다리
  ctx.fillStyle = flash ? '#fff' : '#0d0f12';
  if (a === 'run') {
    const p = Math.sin(s.animT * 13);
    ctx.fillRect(-5 + p * 4, -8, 3, 8);
    ctx.fillRect(2 - p * 4, -8, 3, 8);
  } else if (a !== 'sit' && a !== 'dead') {
    ctx.fillRect(-5, -8, 3, 8);
    ctx.fillRect(2, -8, 3, 8);
  }

  // 날개 망토 (접힌 나방 날개)
  const flap = a === 'jump' || a === 'fall' ? Math.sin(time * 18) * 0.12 : a === 'run' ? Math.sin(s.animT * 13) * 0.05 : 0;
  ctx.fillStyle = cloakD;
  ctx.beginPath();
  ctx.moveTo(-3, -30);
  ctx.bezierCurveTo(-16 - flap * 40, -26, -17 - flap * 40, -10, -12, -4);
  ctx.lineTo(-8, -7);
  ctx.lineTo(-5, -3);
  ctx.lineTo(-1, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cloakC;
  ctx.beginPath();
  ctx.moveTo(-2, -31);
  ctx.bezierCurveTo(12 + flap * 30, -29, 14 + flap * 30, -12, 10, -5);
  ctx.lineTo(6, -8);
  ctx.lineTo(3, -4);
  ctx.lineTo(-1, -7);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-8, -7);
  ctx.bezierCurveTo(-11, -14, -9, -27, -2, -31);
  ctx.closePath();
  ctx.fill();
  // 날개 무늬 (눈알 무늬)
  if (!flash) {
    ctx.fillStyle = 'rgba(255,220,160,0.18)';
    ctx.beginPath();
    ctx.arc(4, -17, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 검 (심지검) – 공격 중이 아닐 때 등 뒤에
  if (!(s.atkT > 0)) {
    ctx.strokeStyle = flash ? '#fff' : '#c9c2b3';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, -12);
    ctx.lineTo(-15, -30);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(-16.5, -32, 2.5, 2.5);
  } else {
    // 휘두르는 검
    const k = 1 - s.atkT / 0.16;
    ctx.save();
    ctx.translate(4, -18);
    let base = 0;
    if (s.atkDir === 'up') base = -Math.PI / 2;
    else if (s.atkDir === 'down') base = Math.PI / 2;
    ctx.rotate(base - 1.1 + k * 2.2);
    ctx.strokeStyle = '#e8e2d2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(25, -1.5, 3, 3);
    ctx.restore();
  }

  // 머리 – 가면
  const hy = -37;
  const maskC = flash ? '#ffffff' : s.mask === 3 ? '#e9d2c8' : '#ebe6d9';
  // 더듬이 (깃털)
  ctx.strokeStyle = flash ? '#fff' : '#ded7c6';
  ctx.lineWidth = 1.6;
  const sway = Math.sin(time * 2.2 + (s.x || 0) * 0.01) * 1.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 3, hy - 7);
    ctx.quadraticCurveTo(side * 6, hy - 18, side * 13 + sway, hy - 21);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const t = 0.35 + k * 0.18;
      const px = side * (3 + (10 + sway) * t), py = hy - 7 - 13 * t;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + side * 3.5, py + 2.5);
      ctx.stroke();
    }
    ctx.lineWidth = 1.6;
  }
  ctx.fillStyle = maskC;
  ctx.beginPath();
  if (s.mask === 1) {
    ctx.moveTo(-8.5, hy - 4);
    ctx.quadraticCurveTo(-8, hy - 10, 0, hy - 10);
    ctx.quadraticCurveTo(8, hy - 10, 8.5, hy - 4);
    ctx.quadraticCurveTo(7, hy + 5, 0, hy + 10);
    ctx.quadraticCurveTo(-7, hy + 5, -8.5, hy - 4);
  } else {
    ctx.ellipse(0, hy, 9, 8.5, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  if (s.mask === 2 && !flash) {
    ctx.strokeStyle = '#2a2622';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, hy - 8);
    ctx.lineTo(4, hy - 3);
    ctx.lineTo(2.5, hy);
    ctx.lineTo(5, hy + 4);
    ctx.stroke();
  }
  if (s.mask === 3 && !flash) {
    ctx.fillStyle = '#b3243a';
    ctx.beginPath();
    ctx.moveTo(-8, hy + 1);
    ctx.quadraticCurveTo(0, hy + 9, 8, hy + 1);
    ctx.quadraticCurveTo(0, hy + 5, -8, hy + 1);
    ctx.fill();
    ctx.fillStyle = '#e2b04a';
    ctx.fillRect(-0.8, hy - 9, 1.6, 4);
  }
  // 눈
  ctx.fillStyle = flash ? '#888' : '#07080a';
  const blink = a === 'idle' && Math.sin(time * 0.9 + (s.x || 0)) > 0.985;
  for (const ex of [-3.6, 3.6]) {
    ctx.beginPath();
    if (blink) ctx.rect(ex - 2, hy + 1, 4, 1);
    else ctx.ellipse(ex + 0.6, hy + 0.5, 2.3, 3.8, ex < 0 ? 0.25 : -0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  if (a === 'focus' && !flash) {
    ctx.fillStyle = 'rgba(255,190,100,0.9)';
    for (const ex of [-3.6, 3.6]) ctx.fillRect(ex, hy, 1.5, 1.5);
  }
  ctx.restore();
}

function drawCocoon(ctx, s, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.fillStyle = '#d9d2c2';
  ctx.beginPath();
  ctx.ellipse(0, -18, 13, 19, Math.sin(time * 1.5) * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,110,95,0.7)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-13, -30 + i * 5);
    ctx.quadraticCurveTo(0, -24 + i * 5 + Math.sin(i) * 3, 13, -32 + i * 6);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,180,90,${0.3 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(0, -18, 4 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
  // 실
  ctx.strokeStyle = 'rgba(220,215,200,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, -37);
  ctx.lineTo(0, -60);
  ctx.stroke();
  if (s.revive > 0) {
    ctx.strokeStyle = '#ffd58a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -18, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.revive);
    ctx.stroke();
  }
}

// 이름표
export function drawNameTag(ctx, s, name, color = '#e8dcc0') {
  ctx.font = '600 11px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const w = ctx.measureText(name).width + 8;
  const x = s.x + s.w / 2, y = s.y - 34;
  ctx.fillRect(x - w / 2, y - 10, w, 14);
  ctx.fillStyle = color;
  ctx.fillText(name, x, y);
}
