// 나방 기사 (오리지널 캐릭터) 절차적 드로잉 – 꾸미기(망토/가면/더듬이/장신구/검) 반영
import { CLOAKS, SLASH_COLORS } from '../core/settings.js';

// s: {x,y,w,h,facing,anim,animT,atkDir,atkT,flash,invul,cloak,mask,antenna,acc,sword,slashC,ghost,landT,vx}
export function drawMoth(ctx, s, time) {
  const cl = CLOAKS[s.cloak] || CLOAKS[0];
  const cx = s.x + s.w / 2;
  const foot = s.y + s.h;
  const f = s.facing || 1;
  let alpha = s.ghost ? 0.42 : 1;
  if (s.invul > 0 && !s.ghost && Math.floor(time * 20) % 2 === 0) alpha *= 0.35;
  ctx.save();
  ctx.globalAlpha *= alpha;
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
  } else if (a === 'swing') {
    lean = 0.25; sy = 1.06;
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
  let cloakC = flash ? '#ffffff' : cl.c;
  const cloakD = flash ? '#dddddd' : cl.d;
  if (cl.grad && !flash) {
    const g = ctx.createLinearGradient(-10, -32, 10, -4);
    g.addColorStop(0, cl.c);
    g.addColorStop(1, cl.d);
    cloakC = g;
  }

  // 목도리 (뒤로 휘날림)
  if (s.acc === 1) {
    const wv = Math.sin(time * 9) * 2, sp = Math.min(1, Math.abs(s.vx || 0) / 300);
    ctx.fillStyle = flash ? '#fff' : '#b3243a';
    ctx.beginPath();
    ctx.moveTo(-2, -30);
    ctx.quadraticCurveTo(-12 - sp * 6, -30 + wv, -20 - sp * 10, -24 + wv * 1.5);
    ctx.lineTo(-18 - sp * 10, -20 + wv);
    ctx.quadraticCurveTo(-10, -25, -1, -26);
    ctx.fill();
  }

  // 다리 (관절 + 둥근 발)
  const legC = flash ? '#fff' : '#0d0f12';
  const leg = (x, swing, lift) => {
    ctx.strokeStyle = legC;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, -9);
    ctx.lineTo(x + swing * 0.5, -4.5 - lift);
    ctx.lineTo(x + swing, -1.2 - lift);
    ctx.stroke();
    ctx.fillStyle = legC;
    ctx.beginPath();
    ctx.ellipse(x + swing + 0.8, -1 - lift, 2.2, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  if (a === 'run') {
    const p = Math.sin(s.animT * 13);
    leg(-3.5, p * 4, Math.max(0, p) * 1.5);
    leg(3, -p * 4, Math.max(0, -p) * 1.5);
  } else if (a === 'jump' || a === 'fall' || a === 'swing') {
    leg(-3.5, -1.5, 2);
    leg(3, 1.5, 1);
  } else if (a !== 'sit' && a !== 'dead') {
    leg(-3.5, 0, 0);
    leg(3, 0, 0);
  }
  ctx.lineCap = 'butt';

  // 날개 망토 (접힌 나방 날개) – 속도에 따라 밑단이 휘날림
  const flap = a === 'jump' || a === 'fall' || a === 'swing' ? Math.sin(time * 18) * 0.12 : a === 'run' ? Math.sin(s.animT * 13) * 0.05 : 0;
  const vxs = Math.max(-1, Math.min(1, ((s.vx || 0) * (s.facing || 1)) / 400));
  const vys = Math.max(-1, Math.min(1, (s.vy || 0) / 700));
  const trail = vxs * 5 + (a === 'dash' ? 4 : 0); // 뒤로 끌림
  const lift = a === 'fall' ? vys * 4 : a === 'jump' ? -2 : 0; // 낙하 때 밑단이 들림
  const breath = a === 'idle' ? Math.sin(time * 2.6) * 0.6 : 0;
  const hem = (i) => Math.sin(time * 7 + i * 1.7 + (s.x || 0) * 0.05) * (0.6 + Math.abs(vxs) * 1.2);
  // 안쪽(뒷날개) 안감
  ctx.fillStyle = cloakD;
  ctx.beginPath();
  ctx.moveTo(-3, -30);
  ctx.bezierCurveTo(-16 - flap * 40 - trail * 0.6, -26, -18 - flap * 40 - trail, -10, -13 - trail, -4 - lift + hem(0));
  ctx.lineTo(-9 - trail * 0.7, -7 - lift * 0.6 + hem(1));
  ctx.lineTo(-5 - trail * 0.4, -3 - lift * 0.4 + hem(2));
  ctx.lineTo(-1, -6);
  ctx.closePath();
  ctx.fill();
  if (!flash) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4, -27);
    ctx.quadraticCurveTo(-11 - trail * 0.5, -18, -10 - trail * 0.8, -7);
    ctx.stroke();
  }
  // 바깥 망토 (그라데이션 음영)
  let outer = cloakC;
  if (!flash && !cl.grad) {
    const g = ctx.createLinearGradient(-6, -31, 8, -3);
    g.addColorStop(0, shade(cl.c, 1.25));
    g.addColorStop(0.55, cl.c);
    g.addColorStop(1, cl.d);
    outer = g;
  }
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(-2, -31 - breath);
  ctx.bezierCurveTo(12 + flap * 30, -29 - breath, 14 + flap * 30 - trail * 0.3, -12, 10 - trail * 0.4, -5 - lift * 0.3 + hem(3));
  ctx.lineTo(6 - trail * 0.5, -8 - lift * 0.4 + hem(4));
  ctx.lineTo(3 - trail * 0.6, -4 - lift * 0.5 + hem(5));
  ctx.lineTo(-1 - trail * 0.7, -7 - lift * 0.6 + hem(6));
  ctx.lineTo(-4 - trail * 0.8, -3 - lift * 0.7 + hem(7));
  ctx.lineTo(-8 - trail, -7 - lift * 0.8 + hem(8));
  ctx.bezierCurveTo(-11 - trail * 0.6, -14, -9, -27, -2, -31 - breath);
  ctx.closePath();
  ctx.fill();
  if (!flash) {
    // 주름
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(1, -27);
    ctx.quadraticCurveTo(-1 - trail * 0.3, -17, -2 - trail * 0.6, -7);
    ctx.moveTo(6, -25);
    ctx.quadraticCurveTo(6 - trail * 0.2, -16, 4 - trail * 0.5, -6);
    ctx.stroke();
    // 앞쪽 테두리 빛 (위에서 오는 빛)
    ctx.strokeStyle = 'rgba(255,240,215,0.22)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-1, -30.5 - breath);
    ctx.bezierCurveTo(11 + flap * 30, -28.5, 13 + flap * 30, -14, 11, -9);
    ctx.stroke();
    // 날개 가장자리 장식 점선
    ctx.fillStyle = 'rgba(255,230,190,0.16)';
    for (let i = 0; i < 4; i++) ctx.fillRect(7 - i * 3 - trail * 0.2 * i, -10 + (i % 2) * 2, 1.4, 1.4);
  }
  if (!flash) {
    // 날개 무늬 (눈알 무늬: 고리 + 눈동자)
    ctx.strokeStyle = 'rgba(255,220,160,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4 - trail * 0.2, -17, 3.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,160,0.22)';
    ctx.beginPath();
    ctx.arc(4 - trail * 0.2, -17, 1.6, 0, Math.PI * 2);
    ctx.fill();
    if (cl.stars) {
      ctx.fillStyle = 'rgba(230,235,255,0.8)';
      for (const [px, py] of [[-4, -22], [6, -24], [1, -11], [8, -13], [-6, -12]]) ctx.fillRect(px + Math.sin(time * 2 + px) * 0.3, py, 1.2, 1.2);
    }
    if (cl.embers) {
      ctx.fillStyle = `rgba(255,120,50,${0.6 + Math.sin(time * 5) * 0.3})`;
      for (const [px, py] of [[-5, -8], [3, -6], [8, -9]]) ctx.fillRect(px, py, 1.6, 1.6);
    }
  }
  // 깃털 깃
  if (s.acc === 5) {
    ctx.fillStyle = flash ? '#fff' : '#eef2f5';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-6 + i * 4, -30 + Math.abs(i - 1.5) * 1.2, 2.2, 4.5, -0.6 + i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 허리 등불
  if (s.acc === 2) {
    ctx.strokeStyle = '#2a2016';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6, -14);
    ctx.lineTo(8, -10);
    ctx.stroke();
    ctx.fillStyle = '#2a2016';
    ctx.fillRect(5.5, -10, 6, 7);
    ctx.fillStyle = `rgba(255,200,110,${0.8 + Math.sin(time * 8) * 0.15})`;
    ctx.fillRect(6.5, -9, 4, 5);
  }

  // 검
  drawSword(ctx, s, flash);

  // 머리 – 가면
  const hy = -37;
  const maskC = flash ? '#ffffff' : s.mask === 3 ? '#e9d2c8' : s.mask === 7 ? '#efe4c8' : '#ebe6d9';
  drawAntenna(ctx, s, hy, flash, time);
  // 가면 아래 목 그림자
  if (!flash) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0.5, hy + 8, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (flash) ctx.fillStyle = maskC;
  else {
    const mg = ctx.createRadialGradient(-3, hy - 4, 1, 0, hy, 11);
    mg.addColorStop(0, '#ffffff');
    mg.addColorStop(0.55, maskC);
    mg.addColorStop(1, shade(maskC, 0.82));
    ctx.fillStyle = mg;
  }
  ctx.beginPath();
  if (s.mask === 1) {
    ctx.moveTo(-8.5, hy - 4);
    ctx.quadraticCurveTo(-8, hy - 10, 0, hy - 10);
    ctx.quadraticCurveTo(8, hy - 10, 8.5, hy - 4);
    ctx.quadraticCurveTo(7, hy + 5, 0, hy + 10);
    ctx.quadraticCurveTo(-7, hy + 5, -8.5, hy - 4);
  } else if (s.mask === 5) {
    // 부엉이: 넓고 귀깃
    ctx.ellipse(0, hy + 0.5, 10, 8, 0, 0, Math.PI * 2);
    ctx.moveTo(-9, hy - 4);
    ctx.lineTo(-10, hy - 11);
    ctx.lineTo(-5, hy - 7);
    ctx.moveTo(9, hy - 4);
    ctx.lineTo(10, hy - 11);
    ctx.lineTo(5, hy - 7);
  } else {
    ctx.ellipse(0, hy, 9, 8.5, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  if (!flash) {
    if (s.mask === 2) {
      ctx.strokeStyle = '#2a2622';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, hy - 8);
      ctx.lineTo(4, hy - 3);
      ctx.lineTo(2.5, hy);
      ctx.lineTo(5, hy + 4);
      ctx.stroke();
    } else if (s.mask === 3) {
      ctx.fillStyle = '#b3243a';
      ctx.beginPath();
      ctx.moveTo(-8, hy + 1);
      ctx.quadraticCurveTo(0, hy + 9, 8, hy + 1);
      ctx.quadraticCurveTo(0, hy + 5, -8, hy + 1);
      ctx.fill();
      ctx.fillStyle = '#e2b04a';
      ctx.fillRect(-0.8, hy - 9, 1.6, 4);
    } else if (s.mask === 4) {
      // 가지뿔
      ctx.strokeStyle = '#d9d0bc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const sd of [-1, 1]) {
        ctx.moveTo(sd * 5, hy - 7);
        ctx.lineTo(sd * 8, hy - 14);
        ctx.lineTo(sd * 12, hy - 16);
        ctx.moveTo(sd * 7, hy - 11);
        ctx.lineTo(sd * 4, hy - 15);
      }
      ctx.stroke();
    } else if (s.mask === 6) {
      // 반쪽 가면: 오른쪽 절반이 검게
      ctx.fillStyle = '#16181c';
      ctx.beginPath();
      ctx.ellipse(0, hy, 9, 8.5, 0, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
    } else if (s.mask === 7) {
      // 왕관
      ctx.fillStyle = '#e2b04a';
      ctx.beginPath();
      ctx.moveTo(-6, hy - 7);
      ctx.lineTo(-6, hy - 12);
      ctx.lineTo(-3, hy - 9);
      ctx.lineTo(0, hy - 14);
      ctx.lineTo(3, hy - 9);
      ctx.lineTo(6, hy - 12);
      ctx.lineTo(6, hy - 7);
      ctx.fill();
    }
  }
  // 꽃 장식 / 리본
  if (s.acc === 3 && !flash) {
    ctx.fillStyle = '#f2a3b8';
    for (let i = 0; i < 5; i++) {
      const an = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(-6 + Math.cos(an) * 2.4, hy - 6 + Math.sin(an) * 2.4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(-7, hy - 7, 2, 2);
  } else if (s.acc === 4 && !flash) {
    ctx.fillStyle = '#e04a6a';
    ctx.beginPath();
    ctx.moveTo(-7, hy - 6);
    ctx.lineTo(-12, hy - 10);
    ctx.lineTo(-12, hy - 3);
    ctx.closePath();
    ctx.moveTo(-7, hy - 6);
    ctx.lineTo(-3, hy - 10);
    ctx.lineTo(-3, hy - 3);
    ctx.closePath();
    ctx.fill();
  }
  // 눈
  ctx.fillStyle = flash ? '#888' : '#07080a';
  const blink = a === 'idle' && Math.sin(time * 0.9 + (s.x || 0)) > 0.985;
  for (const ex of [-3.6, 3.6]) {
    ctx.beginPath();
    if (blink) ctx.rect(ex - 2, hy + 1, 4, 1);
    else if (s.mask === 5) ctx.arc(ex * 1.1, hy + 0.5, 2.8, 0, Math.PI * 2);
    else ctx.ellipse(ex + 0.6, hy + 0.5, 2.3, 3.8, ex < 0 ? 0.25 : -0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  // 눈동자 반짝임
  if (!flash && !blink) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-3.6, hy - 2.2, 1.1, 1.1);
    ctx.fillRect(3.9, hy - 2.2, 1.1, 1.1);
  }
  // 가면 윗부분 반사광
  if (!flash) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, hy, 7.4, -2.5, -1.7);
    ctx.stroke();
  }
  if (s.mask === 6 && !flash && !blink) {
    ctx.fillStyle = '#ffcf70';
    ctx.fillRect(3.6, hy, 1.6, 1.6);
  }
  if (a === 'focus' && !flash) {
    ctx.fillStyle = 'rgba(255,190,100,0.9)';
    for (const ex of [-3.6, 3.6]) ctx.fillRect(ex, hy, 1.5, 1.5);
  }
  ctx.restore();
}

function drawAntenna(ctx, s, hy, flash, time) {
  const col = flash ? '#fff' : '#ded7c6';
  const sway = Math.sin(time * 2.2 + (s.x || 0) * 0.01) * 1.5;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  const kind = s.antenna || 0;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (kind === 0) {
      ctx.lineWidth = 2.4;
      ctx.moveTo(side * 3, hy - 7);
      ctx.quadraticCurveTo(side * 4.5, hy - 12, side * 6.5, hy - 15);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(side * 6.5, hy - 15);
      ctx.quadraticCurveTo(side * 8.5, hy - 19, side * 13 + sway, hy - 21);
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
    } else if (kind === 1) {
      ctx.moveTo(side * 3, hy - 7);
      ctx.bezierCurveTo(side * 2, hy - 20, side * 14 + sway, hy - 18, side * 11 + sway, hy - 12);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(side * 11 + sway, hy - 12, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 2) {
      ctx.lineWidth = 2.6;
      ctx.moveTo(side * 4, hy - 6);
      ctx.lineTo(side * 7, hy - 13);
      ctx.stroke();
      ctx.lineWidth = 1.6;
    } else if (kind === 3) {
      ctx.moveTo(side * 3, hy - 7);
      for (let k = 1; k <= 12; k++) {
        const t = k / 12;
        ctx.lineTo(side * (3 + t * 8 + Math.sin(t * 12) * 2.5) + sway * t, hy - 7 - t * 15);
      }
      ctx.stroke();
    } else {
      // 불꽃 더듬이
      ctx.moveTo(side * 3, hy - 7);
      ctx.quadraticCurveTo(side * 5, hy - 15, side * 9 + sway, hy - 18);
      ctx.stroke();
      const fl = 1 + Math.sin(time * 18 + side) * 0.2;
      ctx.fillStyle = flash ? '#fff' : '#ff9a3c';
      ctx.beginPath();
      ctx.ellipse(side * 9 + sway, hy - 21, 2 * fl, 3.6 * fl, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff1c4';
      ctx.fillRect(side * 9 + sway - 0.6, hy - 21, 1.2, 2);
    }
  }
}

function swordShape(ctx, kind, len, flash) {
  const blade = flash ? '#fff' : kind === 3 ? '#d8b25a' : kind === 4 ? '#b9b4aa' : '#e8e2d2';
  ctx.fillStyle = blade;
  ctx.strokeStyle = blade;
  if (kind === 1) {
    // 곡도
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.6, -5, len, -1);
    ctx.stroke();
  } else if (kind === 2) {
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 1.25, 0);
    ctx.stroke();
  } else if (kind === 3) {
    // 촛대검: 끝에 작은 불꽃
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.fillRect(len * 0.3, -3, 2, 6);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(len + 2, 0, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  } else if (kind === 4) {
    // 사슬검: 마디
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(i * (len / 6) + 2, 0, 2.6, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(len - 1, -1.5, 3, 3);
}

function drawSword(ctx, s, flash) {
  const kind = s.sword || 0;
  if (!(s.atkT > 0)) {
    ctx.save();
    ctx.translate(-7, -12);
    ctx.rotate(-2.0);
    swordShape(ctx, kind, 20, flash);
    ctx.restore();
  } else {
    const k = 1 - s.atkT / 0.16;
    ctx.save();
    ctx.translate(4, -18);
    let base = 0;
    if (s.atkDir === 'up') base = -Math.PI / 2;
    else if (s.atkDir === 'down') base = Math.PI / 2;
    ctx.rotate(base - 1.1 + k * 2.2);
    swordShape(ctx, kind, 26, flash);
    // 손
    ctx.fillStyle = flash ? '#fff' : '#101215';
    ctx.beginPath();
    ctx.arc(1, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 색 밝기 조절 (#rrggbb)
function shade(hex, k) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export function slashRGB(i) {
  return (SLASH_COLORS[i] || SLASH_COLORS[0]).rgb;
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
