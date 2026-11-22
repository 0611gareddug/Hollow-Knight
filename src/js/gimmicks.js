// 3장 기믹 · NPC · 내려찍기를 Game 에 붙이는 확장 (game.js 를 가볍게 유지)
import { TILE, clamp, rand } from './core/util.js';
import { audio } from './core/audio.js';
import { fx } from './render/fx.js';
import { input } from './core/input.js';
import { profile, saveProfile } from './core/settings.js';
import { ensureCharms, hasCharm } from './core/charms.js';
import { saveWorld } from './core/save.js';
import { NPCS, NPC_IDS, gomokHint } from './world/npcs.js';

const TORCH_TIME = 9; // 횃불이 꺼지기 전까지 (같은 무리를 모두 밝혀야 함)
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function installGimmicks(Game) {
  Object.assign(Game.prototype, {
    // 월드 로드 직후: 저장된 횃불/문/구출 상태 반영
    _gimInit() {
      const W = this.world;
      this.chase = null;
      this.save.torches = this.save.torches || {};
      this.save.lgates = this.save.lgates || {};
      this.save.rescued = this.save.rescued || {};
      for (const o of W.objects) if (o.type === 'torch' || o.type === 'lever') o.litUntil = this.save.lgates[o.group] ? Infinity : 0;
      for (const lg of W.lgates) if (this.save.lgates[lg.group]) W.setGates([lg], false);
    },

    _gimStep(dt) {
      const W = this.world, P = this.player;
      // 무너지는 발판 소리 (흔들림 시작/붕괴)
      if (W.crumbleBroke !== this._cb) {
        if (this._cb != null) audio.play('crack', { vol: 0.5, pitch: 1.4 });
        this._cb = W.crumbleBroke;
      }
      const room = this.currentRoom;
      if (!room || this.mode !== 'story') return;
      // 횃불/레버 베기
      const box = P.attackBox();
      for (const o of W.objects) {
        if (o.room !== room.id || (o.type !== 'torch' && o.type !== 'lever')) continue;
        const r = { x: o.x - 12, y: o.y - 50, w: 24, h: 50 };
        if (box && !P.atkHit.has('t' + o.id) && overlap(box, r)) {
          P.atkHit.add('t' + o.id);
          if (o.litUntil === Infinity) continue;
          if (o.type === 'lever' && o.litUntil > 0) continue;
          fx.burst(o.x, o.y - 40, 8, { kind: 'spark', color: '#ffd58a', smin: 100, smax: 300, grav: 200, add: true, lmin: 0.1, lmax: 0.3 });
          if (this.isHost) this.event('torch', { id: o.id });
          else this.net.send({ t: 'torch', id: o.id });
        }
      }
      // 꺼지는 횃불 경고음
      for (const o of W.objects) {
        if (o.type !== 'torch' || o.room !== room.id || !o.litUntil || o.litUntil === Infinity) continue;
        if (o.litUntil < this.time && !o._out) {
          o._out = true;
          o.litUntil = 0;
          audio.play('ui', { pitch: 0.5, vol: 0.5 });
          fx.burst(o.x, o.y - 42, 10, { kind: 'dot', color: '#9aa8b4', smin: 20, smax: 80, grav: -60, lmin: 0.5, lmax: 1 });
        }
      }
      this._chaseStep(dt, room);
      this._npcStep(room);
    },

    // 이벤트 (모든 피어)
    _gimEvent(n, d) {
      const W = this.world;
      switch (n) {
        case 'torch': {
          const o = W.objects.find((q) => q.id === d.id);
          if (!o) return true;
          o.litUntil = o.type === 'lever' ? 1e9 : this.time + TORCH_TIME;
          o._out = false;
          o.litT = this.time;
          audio.play(o.type === 'lever' ? 'clank' : 'amber', { pitch: o.type === 'lever' ? 0.8 : 0.7 });
          if (o.type === 'torch') fx.burst(o.x, o.y - 44, 16, { kind: 'glow', color: '#ffb347', smin: 40, smax: 160, grav: -120, add: true, lmin: 0.3, lmax: 0.8 });
          if (this.isHost) {
            const grp = W.objects.filter((q) => (q.type === 'torch' || q.type === 'lever') && q.group === o.group);
            if (grp.every((q) => q.litUntil > this.time)) this.event('lgate', { group: o.group });
          }
          return true;
        }
        case 'lgate': {
          this.save.lgates[d.group] = true;
          for (const o of W.objects) if (o.group === d.group) o.litUntil = Infinity;
          const gs = W.lgates.filter((g) => g.group === d.group);
          W.setGates(gs, false);
          audio.play('gate');
          audio.play('ability', { vol: 0.5 });
          fx.shake(6, 0.4);
          for (const g of gs) for (let j = 0; j < g.h; j++) fx.burst((g.x + g.w / 2) * TILE, (g.y + j + 0.5) * TILE, 5, { kind: 'glow', color: '#ffd58a', smin: 60, smax: 200, grav: -40, add: true });
          this.showToast('어딘가에서 문이 열렸다', 2.2);
          if (this.isHost) saveWorld(this.save);
          return true;
        }
        case 'rescue': {
          this.save.rescued[d.id] = true;
          const o = W.objects.find((q) => q.type === 'npc' && q.id === d.id && q.spot === 'r');
          if (o) {
            fx.burst(o.x, o.y - 24, 26, { kind: 'glow', color: '#ffd58a', smin: 40, smax: 220, grav: -90, add: true, lmin: 0.5, lmax: 1.2 });
            audio.play('teleport');
          }
          const n2 = NPC_IDS.filter((id) => this.save.rescued[id]).length;
          this.showToast(`${NPCS[d.id].name} 구출 (${n2}/${NPC_IDS.length})`, 3.5, '등불 쉼터 마을로 향했습니다');
          if (this.isHost) saveWorld(this.save);
          return true;
        }
        case 'slamfx':
          this._slamFx(d.x, d.y, false);
          return true;
      }
      return false;
    },

    _bindNetGim(net) {
      net.on('torch', (m) => {
        if (this.isHost) this.event('torch', { id: m.id });
      });
      net.on('rescue', (m) => {
        if (this.isHost && !this.save.rescued[m.id]) this.event('rescue', { id: m.id });
      });
    },

    // ── 내려찍기 착지 ──
    onSlam(P) {
      const x = P.cx, y = P.y + P.h;
      this._slamFx(x, y, true);
      if (this.net && this.mode !== 'race') this.net.send({ t: 'ev', n: 'slamfx', d: { x: Math.round(x), y: Math.round(y) } });
      if (this.mode === 'race') return;
      // 발밑의 얼음 덮개 / 일반 부서지는 벽
      const foot = { x: P.x - 12, y: y - 4, w: P.w + 24, h: 20 };
      for (const b of this.world.breakables) {
        if (b.broken) continue;
        if (!overlap(foot, { x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE })) continue;
        if (this.simAuth) this.event('break', { id: b.id });
        else {
          for (let k = 0; k < b.hp; k++) this.net.send({ t: 'brk', id: b.id, slam: 1 });
        }
      }
      // 충격파 피해
      const rid = this.currentRoom && this.currentRoom.id;
      for (const e of this.sim.list()) {
        if (e.room !== rid) continue;
        const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
        const fh = hasCharm('frostheart');
        if (Math.abs(ex - x) < (fh ? 154 : 110) + e.w / 2 && ey > y - 120 && ey < y + 40) this._remoteHit(e, (10 + 3 * (profile.nail || 0)) * (fh ? 2 : 1), ex, ey);
      }
      if (this.pvp) {
        for (const [id, p] of this.peers) {
          const s = p.rp.s;
          if (!s || s.dn) continue;
          if (Math.abs(p.rp.cx - x) < 100 && p.rp.cy > y - 110 && p.rp.cy < y + 30) this._sendPHit(id, 'down');
        }
      }
    },
    _slamFx(x, y, mine) {
      audio.play('boom', { vol: mine ? 0.9 : 0.5, pitch: 1.3 });
      audio.play('crack', { vol: 0.6 });
      fx.shake(mine ? 10 : 4, 0.3);
      if (mine) fx.hitstop(0.05);
      fx.ring(x, y - 6, 8, 130, 0.35, '220,240,255', 6);
      fx.burst(x, y - 4, 22, { kind: 'shard', color: '#dff4ff', dir: -Math.PI / 2, spread: 1.3, smin: 150, smax: 520, szmin: 2, szmax: 5, lmin: 0.3, lmax: 0.7 });
      for (const d of [-1, 1]) fx.burst(x + d * 20, y - 4, 10, { kind: 'dot', color: '#f4fbff', dir: d > 0 ? -0.2 : Math.PI + 0.2, spread: 0.3, smin: 200, smax: 520, grav: 300, add: true, lmin: 0.2, lmax: 0.5 });
    },

    // ── 추격 구간 (눈사태) ──
    _chaseStep(dt, room) {
      const W = this.world, P = this.player;
      const c = W.chases.find((q) => q.room === room.id);
      if (!c) {
        this.chase = null;
        return;
      }
      if (this.save.chaseDone) return;
      let C = this.chase;
      if (!C || C.room !== room.id) C = this.chase = { room: room.id, on: false, x: 0, done: false, rum: 0 };
      if (C.done || P.busy) return;
      if (!C.on && P.cx > c.trigger && P.grounded) {
        C.on = true;
        C.x = P.cx - 460;
        C.entry = { x: P.x, y: P.y };
        audio.play('roar', { pitch: 0.5 });
        fx.shake(10, 1);
        this.showToast('눈사태다! 달려라!', 2);
      }
      if (!C.on) return;
      // 플레이어와 멀어지면 조금 빨라져 긴장 유지, 가까우면 기본 속도
      const gap = P.cx - C.x;
      const sp = c.speed * (gap > 520 ? 1.6 : 1);
      C.x += sp * dt;
      C.rum -= dt;
      if (C.rum <= 0) {
        C.rum = 0.5;
        audio.play('boom', { vol: 0.35, pitch: 0.5 });
      }
      fx.shake(clamp(3 - gap / 300, 0.6, 3), 0.1);
      if (P.cx > c.end) {
        C.done = true;
        C.on = false;
        this.save.chaseDone = true;
        audio.play('boom', { vol: 0.8, pitch: 0.4 });
        fx.shake(14, 0.8);
        this.showToast('눈사태를 따돌렸다', 2);
        return;
      }
      if (P.x < C.x + 6) {
        P.hazard('chase');
        if (P.hp <= 0) this._onZeroHp();
        P.lastSafe = Object.assign({}, C.entry);
        C.on = false;
      }
    },
    _drawChase(ctx, view, time) {
      const C = this.chase;
      if (!C || !C.on) return;
      const room = this.world.roomById[C.room];
      const top = room.py, bot = room.py + room.ph;
      const x = C.x;
      if (x < view.x0 - 40) {
        // 화면 밖: 왼쪽 가장자리에 경고 표시
        ctx.fillStyle = `rgba(230,245,255,${0.3 + 0.2 * Math.sin(time * 12)})`;
        ctx.fillRect(view.x0, view.y0, 10, view.y1 - view.y0);
        return;
      }
      const g = ctx.createLinearGradient(x - 260, 0, x + 30, 0);
      g.addColorStop(0, 'rgba(235,245,255,1)');
      g.addColorStop(0.75, 'rgba(225,240,252,0.95)');
      g.addColorStop(1, 'rgba(225,240,252,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(Math.min(view.x0, x - 600), top);
      for (let y = top; y <= bot; y += 24) {
        const k = (y - top) / (bot - top);
        const bulge = Math.sin(y * 0.03 + time * 6) * 14 + Math.sin(y * 0.011 - time * 3) * 22 + k * 40;
        ctx.lineTo(x + bulge, y);
      }
      ctx.lineTo(Math.min(view.x0, x - 600), bot);
      ctx.fill();
      // 굴러오는 눈덩이와 파편
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 14; i++) {
        const yy = top + ((i * 97 + time * 40) % (bot - top));
        const r = 8 + ((i * 13) % 14);
        ctx.beginPath();
        ctx.arc(x + 10 + Math.sin(time * 5 + i) * 18, yy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (Math.random() < 0.7) fx.add({ kind: 'dot', x: x + 20, y: rand(top, bot), vx: rand(80, 260), vy: rand(-120, 40), life: 0.5, size: 3, color: '#f4fbff', grav: 300, drag: 1 });
    },

    // ── NPC ──
    _npcVisible(o) {
      if (this.mode !== 'story') return false;
      const r = !!(this.save.rescued || {})[o.id];
      return o.spot === 'r' ? !r : r;
    },
    _npcStep(room) {
      const P = this.player;
      if (P.busy || this._dialogOpen) return;
      for (const o of this.world.objects) {
        if (o.type !== 'npc' || o.room !== room.id || !this._npcVisible(o)) continue;
        const dx = Math.abs(o.x - P.cx), dy = o.y - (P.y + P.h);
        if (dx < 46 && Math.abs(dy) < 40 && P.grounded) {
          this.prompt = { x: o.x, y: o.y - 78, text: o.spot === 'r' ? '말 걸기' : '대화' };
          if (input.pressed.up) {
            input.consume('up');
            this._talk(o);
          }
        }
      }
    },
    _talk(o) {
      const N = NPCS[o.id];
      const P = this.player;
      P.facing = o.x > P.cx ? 1 : -1;
      input.enabled = false;
      this._dialogOpen = true;
      const done = () => {
        input.enabled = true;
        input.clearAll();
        this._dialogOpen = false;
        P.maxHp = P.calcMaxHp();
      };
      if (o.spot === 'r') {
        this.menus.showDialog(N, N.rescue, null, () => {
          if (this.isHost) this.event('rescue', { id: o.id });
          else this.net.send({ t: 'rescue', id: o.id });
          done();
        });
        return;
      }
      const sv = this._npcService(o.id, N);
      const all = NPC_IDS.every((id) => this.save.rescued[id]);
      let lines = sv.lines || N.village;
      if (all && !profile.villageAll) {
        profile.villageAll = 1;
        saveProfile();
        lines = lines.concat(['…그러고 보니 마을이 꽤 북적이는군. 모두 당신 덕분이야.', '(모든 주민 구출 — 꾸미기 「쉼터의 등불」 망토 해금)']);
      }
      this.menus.showDialog(N, lines, sv.choices, done);
    },
    // NPC 기능: {lines?, choices?}
    _npcService(id, N) {
      const P = this.player;
      const bye = { label: '안녕히', fn: () => null };
      const pay = (price) => {
        if (profile.amber < price) return false;
        profile.amber -= price;
        saveProfile();
        audio.play('shard');
        return true;
      };
      switch (N.service) {
        case 'map': {
          if (this.save.mapAll) return { lines: ['지도는 이미 다 그려 두었네. 지도(M/탭)를 펼쳐 보게.'], choices: null };
          return {
            choices: [
              {
                label: '지도 완성', sub: '◆ 120 · 아직 가 보지 않은 방까지 지도에 표시', disabled: profile.amber < 120,
                fn: () => {
                  if (!pay(120)) return null;
                  this.save.mapAll = true;
                  if (this.isHost) saveWorld(this.save);
                  fx.doFlash(0.3, '255,230,180');
                  return { lines: ['자, 여기 있네. 붓 끝이 아직 살아 있군!'] };
                },
              },
              bye,
            ],
          };
        }
        case 'nail': {
          const lv = profile.nail || 0;
          if (lv >= 3) return { lines: ['더 담금질하면 검이 부러진다. 지금이 최고다.'], choices: null };
          if (lv < 2) return { lines: ['먼저 등잔 상인에게서 두 번 담금질을 받아 와라. 그다음이 내 차례다.'], choices: null };
          return {
            choices: [
              {
                label: '심지검 담금질 III', sub: '◆ 1600 · 공격력 크게 증가', disabled: profile.amber < 1600,
                fn: () => {
                  if (!pay(1600)) return null;
                  profile.nail = 3;
                  saveProfile();
                  fx.doFlash(0.5, '255,200,140');
                  audio.play('ability');
                  return { lines: ['쾅! …쾅! …치이익.', '자, 서리로 식힌 검이다. 이제 얼음도 쪼갤 수 있을 게다.'] };
                },
              },
              bye,
            ],
          };
        }
        case 'hint':
          return { lines: [N.village[0], gomokHint(this.save)], choices: null };
        case 'gift': {
          profile.npcGift = profile.npcGift || {};
          if (profile.npcGift.iseul) return { lines: N.after, choices: null };
          return {
            lines: N.village,
            choices: [
              {
                label: '고맙게 받는다', sub: '가면 조각 +1',
                fn: () => {
                  profile.npcGift.iseul = 1;
                  profile.shards = (profile.shards || 0) + 1;
                  if (profile.shards % 4 === 0) {
                    profile.bonusMasks = (profile.bonusMasks || 0) + 1;
                    P.maxHp = P.calcMaxHp();
                    P.hp = P.maxHp;
                  }
                  saveProfile();
                  audio.play('shard');
                  return { lines: [profile.shards % 4 === 0 ? '가면이 완성되었다! 최대 체력 +1' : `가면 조각 (${profile.shards % 4}/4)`] };
                },
              },
            ],
          };
        }
        case 'music': {
          profile.npcGift = profile.npcGift || {};
          return {
            lines: profile.npcGift.hyeon ? N.after : N.village,
            choices: [
              {
                label: '연주를 듣는다',
                fn: () => {
                  audio.music('ending');
                  if (!profile.npcGift.hyeon) {
                    profile.npcGift.hyeon = 1;
                    saveProfile();
                    return { lines: ['♪ ……', '(마음이 따뜻해진다 — 꾸미기 「음유시인의 보라」 망토 해금)'] };
                  }
                  return { lines: ['♪ ……'] };
                },
              },
              bye,
            ],
          };
        }
        case 'notch': {
          profile.npcGift = profile.npcGift || {};
          if (profile.npcGift.seorigit) return { lines: N.after, choices: null };
          return {
            choices: [
              {
                label: '홈을 새겨 달라고 한다', sub: '부적 칸 +1',
                fn: () => {
                  ensureCharms();
                  profile.npcGift.seorigit = 1;
                  profile.notches = Math.min(7, (profile.notches || 3) + 1);
                  saveProfile();
                  audio.play('ability');
                  fx.doFlash(0.4, '200,230,255');
                  return { lines: ['…끝났다. 이제 부적 하나를 더 품을 수 있다.'] };
                },
              },
              bye,
            ],
          };
        }
      }
      return {};
    },
  });
}

// 그리기용: NPC 목록에서 오브젝트 상태 계산
export function npcState(g, o) {
  return { visible: g._npcVisible(o), rescued: !!(g.save && g.save.rescued && g.save.rescued[o.npc || o.id]) };
}
