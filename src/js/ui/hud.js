// 캔버스 HUD: 불씨 그릇, 가면(체력), 호박석, 동료, 보스 체력, 타이머, 지역명, 지도
import { profile } from '../core/settings.js';
import { fmtTime, clamp, TILE } from '../core/util.js';
import { DEFS } from '../entities/sim.js';
import { PALETTES } from '../render/palette.js';
import { ZONES } from '../world/data.js';

const SERIF = '"Noto Serif KR", serif';
const SANS = '"Noto Sans KR", sans-serif';

function maskIcon(ctx, x, y, s, full, flash) {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.55);
  ctx.quadraticCurveTo(x + s * 0.48, y - s * 0.55, x + s * 0.45, y);
  ctx.quadraticCurveTo(x + s * 0.4, y + s * 0.45, x, y + s * 0.6);
  ctx.quadraticCurveTo(x - s * 0.4, y + s * 0.45, x - s * 0.45, y);
  ctx.quadraticCurveTo(x - s * 0.48, y - s * 0.55, x, y - s * 0.55);
  if (full) {
    ctx.fillStyle = flash ? '#ffffff' : '#ece7da';
    ctx.fill();
    ctx.fillStyle = '#0a0c0e';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.17, y + s * 0.02, s * 0.09, s * 0.16, 0.25, 0, Math.PI * 2);
    ctx.ellipse(x + s * 0.17, y + s * 0.02, s * 0.09, s * 0.16, -0.25, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(10,14,16,0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,195,180,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export class HUD {
  constructor(game) {
    this.g = game;
    this.lastHp = -1;
    this.hpFlash = 0;
    this.emberShow = 0;
  }

  draw(ctx, W, H, dpr, dt) {
    const g = this.g;
    const P = g.player;
    if (!P) return;
    const ui = clamp(Math.min(W / dpr / 1100, H / dpr / 640), 0.72, 1.3) * dpr;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // ─── 불씨 그릇 + 가면 ───
    if (P.hp !== this.lastHp) {
      if (P.hp < this.lastHp) this.hpFlash = 0.3;
      this.lastHp = P.hp;
    }
    if (this.hpFlash > 0) this.hpFlash -= dt;
    this.emberShow += (P.ember - this.emberShow) * Math.min(1, dt * 8);
    const ox = 22 * ui + (g.menus.isTouch() ? 0 : 0), oy = 22 * ui;
    const R = 30 * ui;
    const vx = ox + R, vy = oy + R;
    ctx.fillStyle = 'rgba(5,8,10,0.75)';
    ctx.beginPath();
    ctx.arc(vx, vy, R, 0, Math.PI * 2);
    ctx.fill();
    const k = this.emberShow / 99;
    if (k > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(vx, vy, R - 4 * ui, 0, Math.PI * 2);
      ctx.clip();
      const top = vy + R - 4 * ui - (R * 2 - 8 * ui) * k;
      const gr = ctx.createLinearGradient(0, top, 0, vy + R);
      gr.addColorStop(0, '#ffe0a0');
      gr.addColorStop(0.3, '#ffb347');
      gr.addColorStop(1, '#c0561c');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(vx - R, vy + R);
      for (let x = -R; x <= R; x += 4 * ui) ctx.lineTo(vx + x, top + Math.sin(g.time * 3 + x * 0.15 / ui) * 2 * ui);
      ctx.lineTo(vx + R, vy + R);
      ctx.fill();
      ctx.restore();
    }
    const canHeal = P.ember >= 33;
    ctx.strokeStyle = canHeal ? `rgba(255,210,140,${0.7 + Math.sin(g.time * 4) * 0.3})` : 'rgba(200,195,180,0.5)';
    ctx.lineWidth = 2.5 * ui;
    ctx.beginPath();
    ctx.arc(vx, vy, R, 0, Math.PI * 2);
    ctx.stroke();
    // 등불 손잡이 장식
    ctx.strokeStyle = 'rgba(200,195,180,0.6)';
    ctx.lineWidth = 2 * ui;
    ctx.beginPath();
    ctx.arc(vx, vy - R - 4 * ui, 7 * ui, Math.PI, 0);
    ctx.stroke();
    // 눈금 (33 단위)
    for (const t of [1 / 3, 2 / 3]) {
      const y = vy + R - 4 * ui - (R * 2 - 8 * ui) * t;
      ctx.fillStyle = 'rgba(240,230,210,0.5)';
      ctx.fillRect(vx + R - 9 * ui, y, 6 * ui, 1.5 * ui);
    }

    const ms = 24 * ui;
    for (let i = 0; i < P.maxHp; i++) {
      const mx = vx + R + 18 * ui + i * (ms * 0.95), my = oy + 18 * ui;
      maskIcon(ctx, mx, my, ms, i < P.hp, this.hpFlash > 0 && i === P.hp);
    }
    // 가면 조각 진행
    const sh = (profile.shards || 0) % 4;
    if (sh > 0) {
      const mx = vx + R + 18 * ui + P.maxHp * (ms * 0.95), my = oy + 18 * ui;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ece7da';
      for (let i = 0; i < sh; i++) {
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.arc(mx, my, ms * 0.35, -Math.PI / 2 + (i * Math.PI) / 2, -Math.PI / 2 + ((i + 1) * Math.PI) / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // 호박석
    if (g.mode !== 'race') {
      const ax = vx + R + 14 * ui, ay = oy + 48 * ui;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(ax, ay - 7 * ui);
      ctx.lineTo(ax + 5 * ui, ay);
      ctx.lineTo(ax, ay + 7 * ui);
      ctx.lineTo(ax - 5 * ui, ay);
      ctx.fill();
      ctx.font = `600 ${15 * ui}px ${SANS}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8dcc0';
      ctx.fillText(String(profile.amber), ax + 12 * ui, ay + 5 * ui);
    }

    // ─── 동료 ───
    let ty = oy + 82 * ui;
    if (g.mode !== 'race')
      for (const [, p] of g.peers) {
        const s = p.rp.s;
        if (!s) continue;
        ctx.font = `600 ${12 * ui}px ${SANS}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = s.dn ? '#d88' : '#cfe8e2';
        ctx.fillText(p.name + (s.dn ? '  (고치)' : ''), ox, ty);
        for (let i = 0; i < (s.mh || 5); i++) {
          ctx.fillStyle = i < s.hp ? '#ece7da' : 'rgba(200,195,180,0.25)';
          ctx.fillRect(ox + i * 11 * ui, ty + 5 * ui, 8 * ui, 8 * ui);
        }
        ty += 30 * ui;
      }

    // ─── 보스 체력 ───
    const boss = g.sim.list().find((e) => DEFS[e.kind].boss && e.room === (g.currentRoom && g.currentRoom.id));
    if (boss && boss.st !== 'intro') {
      const def = DEFS[boss.kind];
      const bw = Math.min(W * 0.5, 520 * ui), bx = (W - bw) / 2, by = H - 46 * ui;
      ctx.font = `600 ${14 * ui}px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8dcc0';
      ctx.fillText(def.name, W / 2, by - 8 * ui);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, by, bw, 6 * ui);
      const f = clamp(boss.hp / (boss.maxHp || def.hp), 0, 1);
      ctx.fillStyle = '#d9c8a0';
      ctx.fillRect(bx, by, bw * f, 6 * ui);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(bx, by, bw * f, 2 * ui);
    }

    // ─── 레이스 ───
    if (g.race) {
      const R2 = g.race;
      ctx.textAlign = 'center';
      ctx.font = `700 ${30 * ui}px ${SERIF}`;
      ctx.fillStyle = '#ffe2a8';
      const t = R2.fin != null ? R2.fin : R2.time;
      ctx.fillText(fmtTime(t), W / 2, 44 * ui);
      ctx.font = `500 ${13 * ui}px ${SANS}`;
      ctx.fillStyle = '#b8c8c4';
      ctx.fillText(g.course.name + (profile.raceBest && profile.raceBest[g.course.id] ? `   최고 ${fmtTime(profile.raceBest[g.course.id])}` : ''), W / 2, 64 * ui);
      if (R2.state === 'count') {
        const n = Math.ceil(R2.t);
        ctx.font = `700 ${110 * ui}px ${SERIF}`;
        ctx.fillStyle = `rgba(255,226,168,${0.4 + (R2.t % 1) * 0.6})`;
        ctx.fillText(n > 0 ? String(n) : '', W / 2, H / 2 + 30 * ui);
      } else if (R2.time < 1 && R2.fin == null) {
        ctx.font = `700 ${80 * ui}px ${SERIF}`;
        ctx.fillStyle = `rgba(255,226,168,${1 - R2.time})`;
        ctx.fillText('출발!', W / 2, H / 2 + 20 * ui);
      }
      // 완주 순위
      const names = { [g.myId]: profile.name };
      for (const [id, p] of g.peers) names[id] = p.name;
      const res = Object.entries(R2.results).sort((a, b) => a[1] - b[1]);
      ctx.textAlign = 'right';
      ctx.font = `600 ${13 * ui}px ${SANS}`;
      res.forEach(([id, tm], i) => {
        ctx.fillStyle = Number(id) === g.myId ? '#ffe2a8' : '#cfe8e2';
        ctx.fillText(`${i + 1}. ${names[id] || '?'}  ${fmtTime(tm)}`, W - 20 * ui, 34 * ui + i * 20 * ui);
      });
    }
    // ─── 보스 러시 ───
    if (g.rush) {
      ctx.textAlign = 'center';
      ctx.font = `700 ${26 * ui}px ${SERIF}`;
      ctx.fillStyle = '#ffe2a8';
      ctx.fillText(fmtTime(g.rush.time), W / 2, 40 * ui);
      ctx.font = `500 ${13 * ui}px ${SANS}`;
      ctx.fillStyle = '#b8c8c4';
      ctx.fillText(`보스 ${Math.max(0, Math.min(g.rush.idx + 1, g.rush.order.length))} / ${g.rush.order.length}`, W / 2, 60 * ui);
    }

    // ─── 지역명 ───
    if (g.zoneTitle) {
      const z = g.zoneTitle;
      const a = z.t < 0.8 ? z.t / 0.8 : z.t > 3 ? Math.max(0, 1 - (z.t - 3)) : 1;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = `600 ${44 * ui}px ${SERIF}`;
      ctx.fillStyle = '#efe6d2';
      ctx.fillText(z.name, W / 2, H * 0.3);
      ctx.font = `400 ${15 * ui}px ${SERIF}`;
      ctx.fillStyle = '#b8c8c4';
      ctx.fillText(z.sub, W / 2, H * 0.3 + 28 * ui);
      const lw = 140 * ui * Math.min(1, z.t / 1.2);
      ctx.fillStyle = 'rgba(239,230,210,0.6)';
      ctx.fillRect(W / 2 - lw, H * 0.3 + 40 * ui, lw * 2, 1.5 * ui);
      ctx.globalAlpha = 1;
    }
    // ─── 보스 등장 ───
    if (g.bossTitle) {
      const z = g.bossTitle;
      const a = z.t < 0.5 ? z.t / 0.5 : z.t > 2.5 ? Math.max(0, 1 - (z.t - 2.5) / 0.7) : 1;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = `400 ${16 * ui}px ${SERIF}`;
      ctx.fillStyle = '#c8b8a0';
      ctx.fillText(z.sub, W / 2, H * 0.8);
      ctx.font = `700 ${50 * ui}px ${SERIF}`;
      ctx.fillStyle = '#f5ead0';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 12 * ui;
      ctx.fillText(z.name, W / 2, H * 0.8 + 54 * ui);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    // ─── 토스트 ───
    if (g.toast) {
      const t = g.toast;
      const a = Math.min(1, t.t * 2, (t.max - t.t) * 4);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = `600 ${20 * ui}px ${SERIF}`;
      const w = Math.max(ctx.measureText(t.text).width, t.sub ? ctx.measureText(t.sub).width * 0.8 : 0) + 50 * ui;
      const y = H * 0.8;
      ctx.fillStyle = 'rgba(5,8,10,0.72)';
      ctx.fillRect(W / 2 - w / 2, y - 30 * ui, w, t.sub ? 62 * ui : 44 * ui);
      ctx.fillStyle = '#ffe2a8';
      ctx.fillText(t.text, W / 2, y);
      if (t.sub) {
        ctx.font = `500 ${14 * ui}px ${SANS}`;
        ctx.fillStyle = '#d8d0c0';
        ctx.fillText(t.sub, W / 2, y + 22 * ui);
      }
      ctx.globalAlpha = 1;
    }
    if (g.mapOpen) this.drawMap(ctx, W, H, ui);
    ctx.restore();
  }

  drawMap(ctx, W, H, ui) {
    const g = this.g;
    const world = g.world;
    ctx.fillStyle = 'rgba(4,6,8,0.86)';
    ctx.fillRect(0, 0, W, H);
    const rooms = world.rooms.filter((r) => g.save.explored[r.id]);
    if (!rooms.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rooms) {
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
    const s = Math.min((W * 0.86) / (x1 - x0), (H * 0.72) / (y1 - y0), 14 * ui);
    const ox = (W - (x1 - x0) * s) / 2 - x0 * s, oy = (H - (y1 - y0) * s) / 2 - y0 * s + 10 * ui;
    for (const r of rooms) {
      const pal = PALETTES[r.zone];
      const cur = g.currentRoom === r;
      ctx.fillStyle = cur ? 'rgba(255,210,140,0.25)' : 'rgba(200,215,210,0.08)';
      ctx.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
      ctx.strokeStyle = cur ? '#ffd58a' : pal.rim;
      ctx.lineWidth = 1.5 * ui;
      ctx.strokeRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
      // 지형 윤곽 (간략)
      if (s >= 3) {
        ctx.fillStyle = 'rgba(200,215,210,0.28)';
        for (let j = r.y; j < r.y + r.h; j += 2)
          for (let i = r.x; i < r.x + r.w; i += 2) if (world.get(i, j) === 1 && world.get(i, j - 1) !== 1) ctx.fillRect(ox + i * s, oy + j * s, s * 2, s * 0.6);
      }
    }
    for (const o of world.objects) {
      if (!g.save.explored[o.room]) continue;
      const x = ox + (o.x / TILE) * s, y = oy + (o.y / TILE) * s;
      if (o.type === 'bench') {
        ctx.fillStyle = '#ffd58a';
        ctx.fillRect(x - 4 * ui, y - 6 * ui, 8 * ui, 4 * ui);
      } else if (o.type === 'shop') {
        ctx.fillStyle = '#7ee0d0';
        ctx.beginPath();
        ctx.arc(x, y - 6 * ui, 4 * ui, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 플레이어들
    const dot = (px, py, c, name) => {
      const x = ox + (px / TILE) * s, y = oy + (py / TILE) * s;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, 5 * ui, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `600 ${11 * ui}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText(name, x, y - 9 * ui);
    };
    for (const [, p] of g.peers) if (p.rp.s) dot(p.rp.cx, p.rp.cy, '#7ee0d0', p.name);
    dot(g.player.cx, g.player.cy, '#ffd58a', profile.name);
    ctx.textAlign = 'center';
    ctx.font = `600 ${22 * ui}px ${SERIF}`;
    ctx.fillStyle = '#efe6d2';
    const z = g.currentRoom ? ZONES[g.currentRoom.zone].name + ' · ' + g.currentRoom.name : '';
    ctx.fillText(z, W / 2, 40 * ui);
    ctx.font = `500 ${12 * ui}px ${SANS}`;
    ctx.fillStyle = '#9fb0ac';
    ctx.fillText('■ 벤치   ● 상인', W / 2, H - 20 * ui);
  }
}
