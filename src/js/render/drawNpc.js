// 3장/마을 오브젝트: 횃불, 레버, NPC, 마을 집
import { NPCS } from '../world/npcs.js';

export function drawTorch(ctx, o, time, state) {
  const x = o.x, y = o.y;
  const lit = state.lit, rem = state.rem; // rem: 남은 비율(0~1) / Infinity면 영구
  // 받침대 (얼음 낀 철 화로)
  ctx.fillStyle = '#0d1114';
  ctx.fillRect(x - 3, y - 34, 6, 34);
  ctx.fillRect(x - 10, y - 3, 20, 3);
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 40);
  ctx.lineTo(x + 12, y - 40);
  ctx.lineTo(x + 7, y - 32);
  ctx.lineTo(x - 7, y - 32);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,240,255,0.7)';
  ctx.fillRect(x - 12, y - 41, 24, 2);
  if (lit) {
    const k = rem === Infinity ? 1 : Math.max(0.35, rem);
    const fl = Math.sin(time * 14 + x) * 2;
    ctx.fillStyle = `rgba(255,140,60,${0.85 * k})`;
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y - 41);
    ctx.quadraticCurveTo(x - 6, y - 52 - 10 * k, x + fl, y - 58 - 14 * k);
    ctx.quadraticCurveTo(x + 6, y - 52 - 10 * k, x + 9 * k, y - 41);
    ctx.fill();
    ctx.fillStyle = `rgba(255,236,170,${0.95 * k})`;
    ctx.beginPath();
    ctx.moveTo(x - 4 * k, y - 41);
    ctx.quadraticCurveTo(x, y - 50 - 6 * k, x + fl * 0.5, y - 50 - 8 * k);
    ctx.quadraticCurveTo(x + 2, y - 46, x + 4 * k, y - 41);
    ctx.fill();
    // 남은 시간 고리
    if (rem !== Infinity) {
      ctx.strokeStyle = `rgba(255,210,140,${rem < 0.3 ? 0.5 + 0.5 * Math.sin(time * 20) : 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 18, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rem);
      ctx.stroke();
    }
  } else {
    // 꺼진 횃불: 얼음 덮인 숯 + 희미한 숨결
    ctx.fillStyle = '#2a3036';
    ctx.beginPath();
    ctx.ellipse(x, y - 41, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,150,80,${0.15 + 0.1 * Math.sin(time * 3 + x)})`;
    ctx.fillRect(x - 2, y - 43, 4, 2);
  }
}

export function drawLever(ctx, o, time, state) {
  const x = o.x, y = o.y;
  ctx.fillStyle = '#0d1114';
  ctx.fillRect(x - 12, y - 8, 24, 8);
  ctx.fillStyle = '#26303a';
  ctx.fillRect(x - 9, y - 12, 18, 4);
  const a = state.lit ? 0.7 : -0.7;
  ctx.save();
  ctx.translate(x, y - 10);
  ctx.rotate(a);
  ctx.fillStyle = '#3a4650';
  ctx.fillRect(-2, -32, 4, 32);
  ctx.fillStyle = state.lit ? '#ffd58a' : '#bfe6ff';
  ctx.beginPath();
  ctx.arc(0, -34, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 마을 집: 구출 전엔 판자로 막힌 빈집, 구출 후엔 창에 불이 켜짐
export function drawHouse(ctx, o, time, rescued) {
  const x = o.x, y = o.y;
  const W = 92, H = 70;
  ctx.fillStyle = '#0e0c0b';
  ctx.fillRect(x - W / 2, y - H, W, H);
  // 지붕
  ctx.beginPath();
  ctx.moveTo(x - W / 2 - 12, y - H + 2);
  ctx.lineTo(x, y - H - 38);
  ctx.lineTo(x + W / 2 + 12, y - H + 2);
  ctx.fill();
  ctx.fillStyle = '#1c1714';
  for (let i = 0; i < 5; i++) ctx.fillRect(x - W / 2 - 6 + i * 4, y - H - 2 - i * 6, W + 12 - i * 8, 2);
  // 굴뚝 + 연기
  ctx.fillStyle = '#0e0c0b';
  ctx.fillRect(x + 20, y - H - 30, 10, 22);
  if (rescued) {
    for (let i = 0; i < 4; i++) {
      const k = ((time * 0.4 + i * 0.25) % 1);
      ctx.fillStyle = `rgba(180,170,160,${0.25 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(x + 25 + Math.sin(time + i) * 6 * k, y - H - 34 - k * 50, 4 + k * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 문
  ctx.fillStyle = rescued ? '#3a2616' : '#151210';
  ctx.beginPath();
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x - 12, y - 30);
  ctx.quadraticCurveTo(x, y - 42, x + 12, y - 30);
  ctx.lineTo(x + 12, y);
  ctx.fill();
  // 창
  for (const wx of [-30, 24]) {
    if (rescued) {
      const fl = 0.8 + Math.sin(time * 5 + wx) * 0.08;
      ctx.fillStyle = `rgba(255,190,100,${fl})`;
      ctx.fillRect(x + wx, y - 52, 14, 14);
      ctx.fillStyle = '#0e0c0b';
      ctx.fillRect(x + wx + 6, y - 52, 2, 14);
      ctx.fillRect(x + wx, y - 46, 14, 2);
    } else {
      ctx.fillStyle = '#060505';
      ctx.fillRect(x + wx, y - 52, 14, 14);
      ctx.fillStyle = '#2a221c';
      ctx.save();
      ctx.translate(x + wx + 7, y - 45);
      ctx.rotate(0.5);
      ctx.fillRect(-10, -2, 20, 4);
      ctx.rotate(-1);
      ctx.fillRect(-10, -2, 20, 4);
      ctx.restore();
    }
  }
  // 문패 (구출된 주민 이름)
  if (rescued && NPCS[o.npc]) {
    ctx.fillStyle = 'rgba(232,220,192,0.75)';
    ctx.font = '600 11px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(NPCS[o.npc].name, x, y - H + 14);
  }
}

// NPC: 종류별 실루엣. trapped=구출 전(갇힌 상태)
export function drawNpc(ctx, o, time, px) {
  const N = NPCS[o.id];
  if (!N) return;
  const x = o.x, y = o.y;
  const trapped = o.spot === 'r';
  const face = px != null && Math.abs(px - x) < 260 ? (px > x ? 1 : -1) : 1;
  const br = Math.sin(time * 2 + x) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  if (trapped) ctx.translate(Math.sin(time * 9 + x) * 0.6, 0);
  ctx.scale(face, 1);
  const dark = '#0c0d0e';
  ctx.fillStyle = dark;
  switch (N.shape) {
    case 'crane': {
      // 다리 긴 학 모양 지도장이, 등에 두루마리
      ctx.fillRect(-4, -26, 2, 26);
      ctx.fillRect(3, -26, 2, 26);
      ctx.beginPath();
      ctx.ellipse(0, -36 + br, 14, 11, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, -42 + br);
      ctx.quadraticCurveTo(16, -60, 10, -70 + br);
      ctx.lineTo(14, -70 + br);
      ctx.quadraticCurveTo(20, -58, 10, -40 + br);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(14, -72 + br, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9b48a';
      ctx.beginPath();
      ctx.moveTo(19, -73 + br);
      ctx.lineTo(30, -70 + br);
      ctx.lineTo(19, -70 + br);
      ctx.fill();
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(15, -75 + br, 2, 2);
      ctx.fillStyle = '#b8a070';
      ctx.save();
      ctx.rotate(-0.5);
      ctx.fillRect(-4, -46, 26, 6);
      ctx.restore();
      break;
    }
    case 'smith': {
      // 땅딸막한 대장장이 + 앞치마 + 망치
      ctx.beginPath();
      ctx.ellipse(0, -22 + br * 0.5, 18, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -46 + br * 0.5, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(-10, -30 + br * 0.5, 22, 28);
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(8, -49 + br * 0.5, 3, 3);
      ctx.fillStyle = '#c9c0b0';
      ctx.fillRect(0, -56 + br * 0.5, 16, 3); // 눈썹 같은 투구 챙
      ctx.fillStyle = dark;
      ctx.fillRect(18, -30, 3, 26);
      ctx.fillStyle = '#3a3a40';
      ctx.fillRect(13, -36, 14, 9);
      break;
    }
    case 'tree': {
      // 말하는 고목: 굵은 줄기, 얼굴 옹이, 가지
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.quadraticCurveTo(-16, -40, -12, -70);
      ctx.lineTo(12, -70);
      ctx.quadraticCurveTo(16, -40, 22, 0);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-8, -66);
      ctx.quadraticCurveTo(-30, -90, -40, -86 + br);
      ctx.moveTo(8, -66);
      ctx.quadraticCurveTo(28, -96, 42, -94 - br);
      ctx.moveTo(0, -70);
      ctx.lineTo(2, -104);
      ctx.stroke();
      ctx.fillStyle = '#4a6a3a';
      for (const [lx, ly] of [[-40, -88], [42, -96], [2, -106], [-22, -96], [24, -104]]) {
        ctx.beginPath();
        ctx.arc(lx, ly + br, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      const eye = 0.6 + Math.sin(time * 0.8) * 0.4;
      ctx.fillStyle = `rgba(200,230,150,${eye})`;
      ctx.fillRect(-8, -46, 4, 3);
      ctx.fillRect(4, -46, 4, 3);
      ctx.fillStyle = '#060706';
      ctx.beginPath();
      ctx.ellipse(0, -34, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'child': {
      // 작은 순례자: 큰 두건 + 지팡이 등불
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-12, -18, -8, -24 + br);
      ctx.lineTo(8, -24 + br);
      ctx.quadraticCurveTo(12, -18, 10, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -30 + br, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9ad0d8';
      ctx.beginPath();
      ctx.moveTo(-12, -28 + br);
      ctx.quadraticCurveTo(0, -48 + br, 12, -28 + br);
      ctx.lineTo(8, -24 + br);
      ctx.quadraticCurveTo(0, -36 + br, -8, -24 + br);
      ctx.fill();
      ctx.fillStyle = '#e8f6ff';
      ctx.fillRect(1, -31 + br, 2.5, 3);
      ctx.fillRect(5, -31 + br, 2.5, 3);
      ctx.fillStyle = dark;
      ctx.fillRect(14, -40, 2, 40);
      ctx.fillStyle = trapped ? 'rgba(120,120,120,0.6)' : `rgba(255,200,120,${0.8 + Math.sin(time * 6) * 0.1})`;
      ctx.beginPath();
      ctx.arc(15, -43, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bard': {
      // 음유시인: 긴 망토 + 현악기
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.quadraticCurveTo(-16, -34, -6, -46 + br);
      ctx.lineTo(8, -46 + br);
      ctx.quadraticCurveTo(16, -30, 14, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(1, -52 + br, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5aa0';
      ctx.beginPath();
      ctx.moveTo(-10, -56 + br);
      ctx.quadraticCurveTo(-2, -76 + br, 14, -66 + br);
      ctx.lineTo(6, -58 + br);
      ctx.fill();
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(4, -54 + br, 2.5, 2.5);
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath();
      ctx.ellipse(10, -24, 9, 12, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(12, -50, 3, 24);
      if (!trapped) {
        ctx.strokeStyle = 'rgba(232,220,192,0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          ctx.moveTo(11 + i, -48);
          ctx.lineTo(9 + i, -18);
        }
        ctx.stroke();
        // 음표
        const k = (time * 0.6) % 1;
        ctx.fillStyle = `rgba(232,220,192,${1 - k})`;
        ctx.font = '14px serif';
        ctx.fillText('♪', 20 + k * 12, -50 - k * 30);
      }
      break;
    }
    case 'guard': {
      // 파수꾼: 높은 투구 + 창
      ctx.fillRect(-10, -36, 20, 36);
      ctx.beginPath();
      ctx.moveTo(-10, -36);
      ctx.quadraticCurveTo(0, -64 + br, 10, -36);
      ctx.fill();
      ctx.fillStyle = '#c8e4f8';
      ctx.fillRect(2, -46 + br * 0.5, 8, 2.5);
      ctx.beginPath();
      ctx.moveTo(-2, -58 + br);
      ctx.lineTo(0, -74 + br);
      ctx.lineTo(3, -58 + br);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.fillRect(14, -72, 3, 72);
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.moveTo(11, -72);
      ctx.lineTo(15.5, -86);
      ctx.lineTo(20, -72);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
  // 갇힌 상태 표현
  if (trapped) {
    if (N.shape === 'guard') {
      // 얼음 감옥
      ctx.fillStyle = 'rgba(190,225,250,0.35)';
      ctx.strokeStyle = 'rgba(235,248,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 26, y);
      ctx.lineTo(x - 30, y - 60);
      ctx.lineTo(x - 8, y - 96);
      ctx.lineTo(x + 18, y - 90);
      ctx.lineTo(x + 30, y - 50);
      ctx.lineTo(x + 26, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 덩굴/재 사슬
      ctx.strokeStyle = N.shape === 'tree' ? 'rgba(90,80,75,0.9)' : 'rgba(40,60,40,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const yy = y - 10 - i * 16;
        ctx.moveTo(x - 20, yy);
        ctx.quadraticCurveTo(x, yy - 8 + Math.sin(time + i) * 2, x + 20, yy + 4);
      }
      ctx.stroke();
    }
    // 도움 요청 말풍선
    const b = Math.sin(time * 3) * 2;
    ctx.fillStyle = 'rgba(12,14,16,0.8)';
    ctx.beginPath();
    ctx.arc(x, y - 112 + b, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd58a';
    ctx.font = '700 16px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 106 + b);
  }
}
