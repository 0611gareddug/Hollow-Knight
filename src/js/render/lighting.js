// 저해상도 어둠 레이어에 빛 구멍을 뚫는 방식의 조명 (가볍고 부드러움)
import { makeSoft } from './background.js';

export class Lighting {
  constructor() {
    this.c = document.createElement('canvas');
    this.g = this.c.getContext('2d');
    this.hole = makeSoft(128, 'rgba(0,0,0,1)');
    this.glowAmber = makeSoft(128, 'rgba(255,170,80,0.55)');
    this.glowWhite = makeSoft(128, 'rgba(220,240,255,0.45)');
    this.glowRed = makeSoft(128, 'rgba(255,70,60,0.5)');
    this.glowTeal = makeSoft(128, 'rgba(90,230,210,0.45)');
    this.lights = [];
    this.glows = [];
  }

  begin() {
    this.lights.length = 0;
    this.glows.length = 0;
  }
  light(x, y, r, i = 1) {
    this.lights.push(x, y, r, i);
  }
  glow(x, y, r, kind = 'amber', a = 1) {
    this.glows.push({ x, y, r, kind, a });
  }

  // 월드 변환이 적용된 ctx에 가산 발광
  drawGlows(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const img = g.kind === 'white' ? this.glowWhite : g.kind === 'red' ? this.glowRed : g.kind === 'teal' ? this.glowTeal : this.glowAmber;
      ctx.globalAlpha = g.a;
      ctx.drawImage(img, g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 화면 좌표계 ctx에 어둠 합성
  drawDark(ctx, W, H, cam, zoom, darkRGB, amount) {
    if (amount <= 0.01) return;
    const q = 3;
    const w = Math.ceil(W / q), h = Math.ceil(H / q);
    if (this.c.width !== w || this.c.height !== h) {
      this.c.width = w;
      this.c.height = h;
    }
    const g = this.g;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.fillStyle = `rgba(${darkRGB[0]},${darkRGB[1]},${darkRGB[2]},${amount})`;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const L = this.lights;
    const s = zoom / q;
    for (let i = 0; i < L.length; i += 4) {
      const x = (L[i] - cam.x) * s, y = (L[i + 1] - cam.y) * s, r = L[i + 2] * s;
      if (x + r < 0 || y + r < 0 || x - r > w || y - r > h) continue;
      g.globalAlpha = Math.min(1, L[i + 3]);
      g.drawImage(this.hole, x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.c, 0, 0, W, H);
  }
}
