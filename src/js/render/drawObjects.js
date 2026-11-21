// 월드 오브젝트 (벤치, 등불, 상인, 표지판, 제단, 줍는 물건, 호박석 동전) 그리기
export function drawObject(ctx, o, time, pal, state) {
  const x = o.x, y = o.y;
  switch (o.type) {
    case 'lamp': {
      ctx.fillStyle = pal.solid;
      ctx.fillRect(x - 2, y - 62, 4, 62);
      ctx.fillRect(x - 8, y - 4, 16, 4);
      ctx.fillRect(x - 2, y - 64, 14, 3);
      ctx.strokeStyle = pal.solid;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 62);
      ctx.lineTo(x + 10, y - 54);
      ctx.stroke();
      const fl = 0.85 + Math.sin(time * 7 + x) * 0.08 + Math.sin(time * 13 + x * 0.3) * 0.05;
      ctx.fillStyle = '#1b1510';
      ctx.fillRect(x + 4, y - 54, 12, 15);
      ctx.fillStyle = `rgba(255,190,100,${fl})`;
      ctx.fillRect(x + 6, y - 52, 8, 11);
      ctx.fillStyle = '#fff1c8';
      ctx.fillRect(x + 9, y - 49, 2, 5);
      break;
    }
    case 'bench': {
      const lit = state && state.benchLit;
      ctx.fillStyle = '#0b0d0e';
      ctx.fillRect(x - 30, y - 18, 60, 5);
      ctx.fillRect(x - 26, y - 13, 4, 13);
      ctx.fillRect(x + 22, y - 13, 4, 13);
      ctx.fillRect(x - 30, y - 34, 60, 4);
      ctx.fillRect(x - 28, y - 34, 3, 16);
      ctx.fillRect(x + 25, y - 34, 3, 16);
      // 등받이 장식 (나방 문양)
      ctx.strokeStyle = '#2b3235';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 30);
      ctx.quadraticCurveTo(x - 12, y - 44, x - 18, y - 34);
      ctx.moveTo(x, y - 30);
      ctx.quadraticCurveTo(x + 12, y - 44, x + 18, y - 34);
      ctx.stroke();
      // 벤치 옆 작은 등
      ctx.fillStyle = '#0b0d0e';
      ctx.fillRect(x + 34, y - 30, 3, 30);
      const a = lit ? 0.95 : 0.35 + Math.sin(time * 2) * 0.1;
      ctx.fillStyle = `rgba(255,190,100,${a})`;
      ctx.beginPath();
      ctx.arc(x + 35.5, y - 34, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shop': {
      // 등잔 상인: 등에 등잔을 잔뜩 짊어진 딱정벌레
      const b = Math.sin(time * 1.6) * 1.2;
      ctx.fillStyle = '#0d0b0a';
      ctx.beginPath();
      ctx.ellipse(x, y - 22 + b, 22, 22, 0, Math.PI, 0);
      ctx.lineTo(x + 22, y);
      ctx.lineTo(x - 22, y);
      ctx.fill();
      // 짐
      ctx.fillStyle = '#17120e';
      ctx.fillRect(x - 30, y - 70 + b, 36, 40);
      ctx.strokeStyle = '#17120e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 70 + b);
      ctx.lineTo(x - 12, y - 86 + b);
      ctx.stroke();
      const cols = ['255,180,90', '120,230,210', '255,140,110', '200,170,255'];
      for (let i = 0; i < 4; i++) {
        const lx = x - 26 + (i % 2) * 18, ly = y - 64 + Math.floor(i / 2) * 16 + b;
        ctx.fillStyle = `rgba(${cols[i]},${0.75 + Math.sin(time * 3 + i) * 0.15})`;
        ctx.fillRect(lx, ly, 9, 10);
      }
      ctx.fillStyle = `rgba(255,200,120,0.9)`;
      ctx.beginPath();
      ctx.arc(x - 12, y - 88 + b, 4, 0, Math.PI * 2);
      ctx.fill();
      // 얼굴
      ctx.fillStyle = '#1c1714';
      ctx.beginPath();
      ctx.ellipse(x + 16, y - 24 + b, 10, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9dcc0';
      ctx.fillRect(x + 18, y - 27 + b, 3, 3);
      ctx.fillRect(x + 23, y - 27 + b, 2, 2);
      // 더듬이
      ctx.strokeStyle = '#1c1714';
      ctx.beginPath();
      ctx.moveTo(x + 18, y - 32 + b);
      ctx.quadraticCurveTo(x + 26, y - 48 + b, x + 34, y - 44 + b);
      ctx.stroke();
      break;
    }
    case 'anchor': {
      // 사슬 고리: 공중에 떠 있는 등불 고리
      const b = Math.sin(time * 2 + x * 0.1) * 2;
      ctx.strokeStyle = 'rgba(60,50,40,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 14 + b);
      ctx.lineTo(x, y - 40 + b);
      ctx.stroke();
      ctx.strokeStyle = '#2a2016';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y + b, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,190,100,${0.7 + Math.sin(time * 4 + x) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + b, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffe2a8';
      ctx.beginPath();
      ctx.arc(x, y + b, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sign': {
      ctx.fillStyle = '#0c0f10';
      ctx.fillRect(x - 10, y - 22, 20, 22);
      ctx.fillStyle = '#273034';
      ctx.fillRect(x - 7, y - 18, 14, 2);
      ctx.fillRect(x - 7, y - 13, 10, 2);
      ctx.fillRect(x - 7, y - 8, 12, 2);
      break;
    }
    case 'shrine': {
      const avail = state && state.shrineAvail;
      const taken = state && state.shrineTaken;
      if (!avail && !taken) return;
      ctx.fillStyle = pal.solid;
      ctx.fillRect(x - 16, y - 10, 32, 10);
      ctx.fillRect(x - 10, y - 30, 20, 20);
      ctx.fillRect(x - 14, y - 34, 28, 5);
      if (!taken) {
        const p = 0.75 + Math.sin(time * 3) * 0.25;
        const col = o.ability === 'mask3' ? '255,90,110' : '255,210,140';
        ctx.fillStyle = `rgba(${col},${p})`;
        ctx.beginPath();
        ctx.arc(x, y - 50 + Math.sin(time * 2) * 4, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${p * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y - 50 + Math.sin(time * 2) * 4, 14 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'pickup': {
      if (state && state.taken) return;
      const by = y - 14 + Math.sin(time * 2.5 + x) * 3;
      if (o.kind === 'shard') {
        ctx.fillStyle = '#f2eee2';
        ctx.beginPath();
        ctx.moveTo(x, by - 9);
        ctx.lineTo(x + 8, by - 2);
        ctx.lineTo(x + 4, by + 8);
        ctx.lineTo(x - 6, by + 6);
        ctx.lineTo(x - 7, by - 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(x, by, 14 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(x - 12, by - 4, 24, 12);
        ctx.fillStyle = '#ffb347';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(x - 8 + i * 5.5, by - 4 + (i % 2) * 2, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
}

export function drawCoin(ctx, c, time) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rot);
  const s = c.v >= 10 ? 7 : c.v >= 5 ? 5.5 : 4.5;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.8, 0);
  ctx.fill();
  ctx.fillStyle = '#fff0c8';
  ctx.fillRect(-1, -s * 0.5, 2, s * 0.6);
  ctx.restore();
}
