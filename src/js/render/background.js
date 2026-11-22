// 패럴랙스 배경: 구역별 이음새 없는 실루엣 레이어를 절차적으로 생성
import { mulberry32, rand } from '../core/util.js';
import { PALETTES } from './palette.js';

const S = 768;

function wrapDraw(g, fn) {
  // 이음새 없는 타일링을 위해 9방향으로 복제해 그림
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    g.save();
    g.translate(ox, oy);
    fn(g);
    g.restore();
  }
}

function spire(g, r, x, base, w, h, up) {
  g.beginPath();
  g.moveTo(x - w / 2, base);
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const ww = (w / 2) * (1 - t) + 1;
    g.lineTo(x - ww + (r() - 0.5) * w * 0.15, base + (up ? -h : h) * t);
  }
  for (let i = segs; i >= 0; i--) {
    const t = i / segs;
    const ww = (w / 2) * (1 - t) + 1;
    g.lineTo(x + ww + (r() - 0.5) * w * 0.15, base + (up ? -h : h) * t);
  }
  g.closePath();
  g.fill();
}

function chain(g, x, y0, y1, lw) {
  g.lineWidth = lw;
  for (let y = y0; y < y1; y += lw * 3) {
    g.beginPath();
    g.ellipse(x, y, lw * 0.9, lw * 1.6, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

function column(g, x, w, h) {
  g.fillRect(x - w / 2, 0, w, h);
  g.fillRect(x - w * 0.75, 40, w * 1.5, 18);
  g.fillRect(x - w * 0.7, h - 120, w * 1.4, 14);
  for (let i = -1; i <= 1; i++) {
    g.globalAlpha *= 0.6;
    g.fillRect(x + i * w * 0.25 - 1, 60, 2, h - 190);
    g.globalAlpha /= 0.6;
  }
}

function arch(g, x, y, w, h, t) {
  g.beginPath();
  g.moveTo(x - w / 2 - t, y + h);
  g.lineTo(x - w / 2 - t, y);
  g.arc(x, y, w / 2 + t, Math.PI, 0);
  g.lineTo(x + w / 2 + t, y + h);
  g.lineTo(x + w / 2, y + h);
  g.lineTo(x + w / 2, y);
  g.arc(x, y, w / 2, 0, Math.PI, true);
  g.lineTo(x - w / 2, y + h);
  g.closePath();
  g.fill();
}

function mothStatue(g, x, base, s) {
  g.beginPath();
  g.ellipse(x, base - s * 1.5, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.5, base - s * 1.2);
  g.quadraticCurveTo(x - s * 1.6, base - s * 0.6, x - s * 0.4, base);
  g.lineTo(x + s * 0.4, base);
  g.quadraticCurveTo(x + s * 1.6, base - s * 0.6, x + s * 0.5, base - s * 1.2);
  g.fill();
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.moveTo(x - s * 0.2, base - s * 1.9);
  g.quadraticCurveTo(x - s * 0.7, base - s * 2.6, x - s * 0.9, base - s * 2.4);
  g.moveTo(x + s * 0.2, base - s * 1.9);
  g.quadraticCurveTo(x + s * 0.7, base - s * 2.6, x + s * 0.9, base - s * 2.4);
  g.stroke();
  g.fillRect(x - s * 0.7, base, s * 1.4, s * 0.3);
}

function gear(g, x, y, r, teeth) {
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 0.85;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.moveTo(x + r * 0.35, y);
  g.arc(x, y, r * 0.35, 0, Math.PI * 2, true);
  g.fill('evenodd');
}

function cloud(g, x, y, s) {
  g.beginPath();
  for (let i = 0; i < 6; i++) g.arc(x + (i - 2.5) * s * 0.28, y + Math.sin(i * 1.7) * s * 0.12, s * (0.22 + (i % 3) * 0.06), 0, Math.PI * 2);
  g.fill();
}

function makeLayer(zone, depth, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const pal = PALETTES[zone];
  const r = mulberry32(seed);
  const col = depth === 0 ? pal.far : depth === 1 ? pal.mid : pal.near;
  g.fillStyle = col;
  g.strokeStyle = col;
  const alpha = depth === 0 ? 0.5 : depth === 1 ? 0.62 : 0.5;
  g.globalAlpha = alpha;
  const items = [];
  const n = depth === 0 ? 7 : depth === 1 ? 6 : 4;
  for (let i = 0; i < n; i++) items.push({ x: (i + r() * 0.6) * (S / n), y: r() * S, a: r(), b: r(), c: r() });

  wrapDraw(g, (gg) => {
    const rr = mulberry32(seed + 7);
    for (const it of items) {
      if (zone === 1) {
        if (depth === 0) {
          spire(gg, rr, it.x, S, 60 + it.a * 90, 250 + it.b * 300, true);
          spire(gg, rr, it.x + 50, 0, 40 + it.c * 60, 120 + it.a * 220, false);
        } else if (depth === 1) {
          chain(gg, it.x, 0, 120 + it.b * 380, 3 + it.a * 2);
          spire(gg, rr, it.x + 80, S, 40 + it.c * 50, 150 + it.a * 160, true);
        } else {
          spire(gg, rr, it.x, 0, 90 + it.a * 80, 60 + it.b * 120, false);
          spire(gg, rr, it.x + 120, S, 120 + it.c * 100, 80 + it.a * 100, true);
        }
      } else if (zone === 2) {
        if (depth === 0) {
          arch(gg, it.x, 260 + it.b * 200, 140 + it.a * 120, 600, 22);
        } else if (depth === 1) {
          gg.lineWidth = 3 + it.a * 3;
          gg.beginPath();
          gg.moveTo(it.x, 0);
          for (let y = 0; y < 300 + it.b * 300; y += 20) gg.lineTo(it.x + Math.sin(y * 0.03 + it.c * 6) * 12, y);
          gg.stroke();
          spire(gg, rr, it.x + 60, S, 50, 160 + it.c * 140, true);
        } else {
          gg.lineWidth = 8;
          gg.beginPath();
          gg.moveTo(it.x, S);
          for (let y = S; y > S - 200 - it.a * 200; y -= 20) gg.lineTo(it.x + Math.sin(y * 0.02 + it.b * 6) * 20, y);
          gg.stroke();
          spire(gg, rr, it.x + 100, 0, 110, 90 + it.b * 90, false);
        }
      } else if (zone === 3) {
        if (depth === 0) {
          column(gg, it.x, 46 + it.a * 30, S);
        } else if (depth === 1) {
          mothStatue(gg, it.x, S - 40 - it.b * 200, 50 + it.a * 40);
          chain(gg, it.x + 90, 0, 100 + it.c * 250, 3);
        } else {
          column(gg, it.x, 70 + it.a * 30, S);
        }
      } else if (zone === 5) {
        if (depth === 0) {
          gear(gg, it.x, it.y, 80 + it.a * 90, 12 + ((it.b * 8) | 0));
        } else if (depth === 1) {
          // 굵은 파이프와 밸브
          gg.fillRect(it.x - 8, 0, 16, S);
          gg.fillRect(it.x - 14, it.y, 28, 10);
          gear(gg, it.x + 70, it.y + 120, 30 + it.c * 30, 10);
        } else {
          gear(gg, it.x + 40, it.y, 60 + it.b * 40, 12);
        }
      } else if (zone === 6) {
        if (depth === 0) {
          cloud(gg, it.x, it.y, 120 + it.a * 100);
        } else if (depth === 1) {
          // 떠 있는 섬 + 늘어진 덩굴
          gg.beginPath();
          gg.moveTo(it.x - 70, it.y);
          gg.lineTo(it.x + 70, it.y);
          gg.lineTo(it.x + 30, it.y + 50 + it.b * 40);
          gg.lineTo(it.x - 10, it.y + 90 + it.b * 50);
          gg.lineTo(it.x - 40, it.y + 40);
          gg.fill();
          gg.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            gg.beginPath();
            gg.moveTo(it.x - 30 + k * 25, it.y + 20);
            gg.quadraticCurveTo(it.x - 25 + k * 25, it.y + 80, it.x - 32 + k * 25, it.y + 120 + k * 20);
            gg.stroke();
          }
        } else {
          cloud(gg, it.x, it.y, 80 + it.c * 60);
        }
      } else if (zone === 7) {
        if (depth === 0) {
          arch(gg, it.x, 200 + it.b * 200, 160 + it.a * 80, 600, 26);
        } else if (depth === 1) {
          // 부서진 기둥
          const h = 200 + it.a * 260;
          gg.fillRect(it.x - 22, S - h, 44, h);
          gg.beginPath();
          gg.moveTo(it.x - 22, S - h);
          gg.lineTo(it.x - 4, S - h - 30);
          gg.lineTo(it.x + 8, S - h - 6);
          gg.lineTo(it.x + 22, S - h - 20);
          gg.lineTo(it.x + 22, S - h);
          gg.fill();
        } else {
          spire(gg, rr, it.x, S, 140, 90 + it.b * 80, true);
        }
      } else {
        if (depth === 0) {
          // 커튼 주름
          for (let k = 0; k < 4; k++) {
            gg.beginPath();
            const x = it.x + k * 22;
            gg.moveTo(x, 0);
            gg.quadraticCurveTo(x + 14, S / 2, x + 4, S);
            gg.lineTo(x + 16, S);
            gg.quadraticCurveTo(x + 26, S / 2, x + 18, 0);
            gg.fill();
          }
        } else if (depth === 1) {
          gg.beginPath();
          gg.moveTo(it.x - 30, 0);
          gg.lineTo(it.x + 30, 0);
          gg.lineTo(it.x + 30, 160 + it.a * 100);
          gg.lineTo(it.x, 130 + it.a * 100);
          gg.lineTo(it.x - 30, 160 + it.a * 100);
          gg.fill();
          chain(gg, it.x + 120, 0, 200, 3);
        } else {
          spire(gg, rr, it.x, S, 100, 120 + it.b * 80, true);
        }
      }
    }
  });
  // 먼 레이어에 은은한 빛점 (멀리 있는 등불)
  if (depth === 1) {
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const x = r() * S, y = r() * S;
      const gr = g.createRadialGradient(x, y, 0, x, y, 26);
      const lc = zone === 6 ? '255,255,240' : zone === 7 ? '255,120,70' : '255,190,110';
      gr.addColorStop(0, `rgba(${lc},0.55)`);
      gr.addColorStop(1, `rgba(${lc},0)`);
      g.fillStyle = gr;
      g.fillRect(x - 26, y - 26, 52, 52);
      g.fillStyle = 'rgba(255,220,160,0.9)';
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }
  return c;
}

// 부드러운 원형 스프라이트 (안개, 빛)
export function makeSoft(size, color) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeFore(zone) {
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 120;
  const g = c.getContext('2d');
  const pal = PALETTES[zone];
  const r = mulberry32(zone * 77 + 5);
  g.fillStyle = pal.solid;
  g.strokeStyle = pal.solid;
  // 듬성듬성한 풀/돌무더기 (가운데는 비워 시야 확보)
  for (let i = 0; i < 7; i++) {
    const x = r() * 900;
    if (r() < 0.5) {
      g.beginPath();
      g.ellipse(x, 120, 40 + r() * 70, 30 + r() * 30, 0, Math.PI, 0);
      g.fill();
    }
    g.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const bx = x + (r() - 0.5) * 90, h = 30 + r() * 60;
      g.beginPath();
      g.moveTo(bx, 120);
      g.quadraticCurveTo(bx + (r() - 0.5) * 20, 120 - h * 0.6, bx + (r() - 0.5) * 30, 120 - h);
      g.stroke();
    }
  }
  return c;
}

export class Background {
  constructor() {
    this.zone = 0;
    this.layers = null;
    this.fogBlob = null;
    this.motes = [];
    for (let i = 0; i < 70; i++) this.motes.push({ x: Math.random(), y: Math.random(), z: rand(0.3, 1), ph: rand(0, 6.28), s: rand(0.8, 2.2) });
  }

  setZone(zone) {
    if (zone === this.zone) return;
    this.zone = zone;
    const seed = zone * 1000;
    this.layers = [makeLayer(zone, 0, seed + 1), makeLayer(zone, 1, seed + 2), makeLayer(zone, 2, seed + 3)];
    const [r, g, b] = PALETTES[zone].fog;
    this.fogBlob = makeSoft(256, `rgba(${r},${g},${b},0.22)`);
  }

  draw(ctx, cam, W, H, zoom, time) {
    const pal = PALETTES[this.zone];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(1, pal.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    const factors = [0.12, 0.3, 0.55];
    const scales = [0.8, 1, 1.25];
    for (let i = 0; i < 3; i++) {
      const L = this.layers[i];
      const sc = zoom * scales[i];
      const size = S * sc;
      let ox = -((cam.x * factors[i] * zoom) % size);
      let oy = -((cam.y * factors[i] * zoom) % size);
      if (ox > 0) ox -= size;
      if (oy > 0) oy -= size;
      for (let x = ox; x < W; x += size) for (let y = oy; y < H; y += size) ctx.drawImage(L, x, y, size + 1, size + 1);
      // 레이어 사이 안개 (멀수록 흐리게)
      const [r, g, b] = pal.fog;
      ctx.fillStyle = `rgba(${r},${g},${b},${i === 0 ? 0.08 : i === 1 ? 0.06 : 0.035})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 흐르는 안개 덩어리
    for (let k = 0; k < 5; k++) {
      const fx = ((k * 0.27 + time * 0.008 * (k % 2 ? 1 : -0.7) - cam.x * 0.0004) % 1.4 + 1.4) % 1.4 - 0.2;
      const fy = 0.25 + ((k * 0.37) % 0.7);
      ctx.drawImage(this.fogBlob, fx * W - W * 0.35, fy * H - H * 0.25, W * 0.7, H * 0.5);
    }
  }

  // 위에서 비스듬히 내려오는 빛줄기 (화면 공간, 가산)
  drawShafts(ctx, W, H, zoom, time, cam) {
    const z = this.zone;
    if (z === 7 || z === 4) return;
    const col = z === 6 ? '255,250,230' : z === 2 ? '150,240,230' : z === 3 ? '200,170,255' : z === 5 ? '255,200,140' : '210,230,220';
    const strength = z === 6 ? 0.09 : 0.055;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const base = ((i * 0.31 + 0.12 - cam.x * 0.00012) % 1.2 + 1.2) % 1.2 - 0.1;
      const x = base * W + Math.sin(time * 0.25 + i * 2) * W * 0.02;
      const wTop = W * (0.03 + (i % 2) * 0.025), wBot = wTop * 3.2;
      const a = strength * (0.6 + 0.4 * Math.sin(time * 0.5 + i * 1.7));
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + wTop, 0);
      ctx.lineTo(x + wTop + H * 0.35 + wBot, H);
      ctx.lineTo(x + H * 0.35, H);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // 화면 가장자리 전경 실루엣 (카메라보다 빠르게 움직여 깊이감)
  drawFore(ctx, cam, W, H, zoom) {
    if (!this.fore || this.foreZone !== this.zone) {
      this.foreZone = this.zone;
      this.fore = makeFore(this.zone);
    }
    const f = this.fore;
    const sc = zoom * 1.3;
    const fw = f.width * sc, fh = f.height * sc;
    let ox = -((cam.x * 1.3 * zoom) % fw);
    if (ox > 0) ox -= fw;
    ctx.globalAlpha = 0.92;
    for (let x = ox; x < W; x += fw) ctx.drawImage(f, x, H - fh * 0.62, fw + 1, fh);
    ctx.globalAlpha = 1;
  }

  drawMotes(ctx, cam, W, H, zoom, time) {
    const pal = PALETTES[this.zone];
    const [r, g, b] = pal.fog;
    for (const m of this.motes) {
      const px = (((m.x * W - cam.x * zoom * m.z * 0.6 + Math.sin(time * 0.4 + m.ph) * 20) % W) + W) % W;
      const py = (((m.y * H - cam.y * zoom * m.z * 0.6 - time * 12 * m.z) % H) + H) % H;
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 1.3 + m.ph));
      ctx.fillStyle = m.ph > 5 ? `rgba(255,200,130,${a})` : `rgba(${r + 60},${g + 60},${b + 60},${a})`;
      const s = m.s * zoom;
      ctx.fillRect(px, py, s, s);
    }
  }
}
