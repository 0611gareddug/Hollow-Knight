// 게임 본체: 루프, 카메라, 방 전환, 전투 판정, 모드별 흐름, 네트워크 동기화
import { TILE, VIEW_H, clamp, rand, overlap, fmtTime, lsGet } from './core/util.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { settings, profile, saveProfile, MASKS, looks, LIGHT_COLORS } from './core/settings.js';
import { loadWorld, saveWorld, newWorldSave } from './core/save.js';
import { World } from './world/world.js';
import { STORY, COURSES, RUSH, RUSH_ORDER, ZONES, PVP_ARENAS } from './world/data.js';
import { T_LIQUID, T_EMPTY, T_SPIKE, T_GATE } from './world/tiles.js';
import { PALETTES } from './render/palette.js';
import { TerrainRenderer } from './render/terrain.js';
import { Background, makeSoft } from './render/background.js';
import { Lighting } from './render/lighting.js';
import { fx } from './render/fx.js';
import { drawMoth, drawNameTag, slashRGB } from './render/drawPlayer.js';
import { drawObject, drawCoin } from './render/drawObjects.js';
import { Player, findHookTarget } from './entities/player.js';
import { RemotePlayer } from './entities/remote.js';
import { Sim, DEFS } from './entities/sim.js';
import { PROJ } from './entities/projectiles.js';
import { floodTiles } from './entities/bosses.js';
import { cx as ecx, cy as ecy } from './entities/common.js';
import { HUD } from './ui/hud.js';
import { installGimmicks } from './gimmicks.js';
import { drawTorch, drawLever, drawNpc, drawHouse } from './render/drawNpc.js';
import { hasCharm, grantCharm, BOSS_CHARM, CHARM_BY_ID, ensureCharms, charmState } from './core/charms.js';

const STEP = 1 / 120;
const NET_RATE = 1 / 20;
const ABILITY_TEXT = {
  dash: { name: '대시', desc: '{D} : 빠르게 돌진. 공중에서도 한 번 사용 가능' },
  wall: { name: '벽 타기', desc: '벽에 붙어 미끄러지는 중 {J} : 벽 점프' },
  djump: { name: '이단 점프', desc: '공중에서 {J}를 한 번 더' },
  hook: { name: '불씨 사슬', desc: '{K} : 고리·벽·적에 사슬을 걸기 · 누른 채 매달리기 · {J}로 날아오르기' },
  slam: { name: '내려찍기', desc: '공중에서 {DN} + {D} : 땅을 내려찍어 충격파 · 얼음 덮개 파괴' },
};

export class Game {
  constructor(canvas, menus, touch) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.menus = menus;
    this.touch = touch;
    this.bg = new Background();
    this.light = new Lighting();
    this.hud = new HUD(this);
    this.vignette = null;
    this.running = false;
    this.mode = null;
    this.time = 0;
    this.acc = 0;
    this.last = 0;
    this.quality = 1;
    this.frameAvg = 16;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const mobile = Math.min(innerWidth, innerHeight) < 600;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2) * this.quality;
    this.dpr = dpr;
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    const W = this.canvas.width, H = this.canvas.height;
    const v = document.createElement('canvas');
    v.width = 256;
    v.height = 256;
    const g = v.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    this.vignette = v;
    this.zoom = Math.max(H / VIEW_H, W / 1200);
  }

  // ═══════════════ 시작 ═══════════════
  _common(net, mode) {
    charmState.disabled = mode === 'pvp';
    this.pvp = null;
    input.resetCounts();
    input.counting = true;
    this.net = net || null;
    this.mode = mode;
    this.isHost = !net || net.isHost;
    this.simAuth = this.isHost || mode === 'race';
    this.myId = net ? net.myId : 0;
    this.peers = this.peers || new Map();
    this.coins = [];
    this.netT = 0;
    this.snapT = 0;
    this.bossActive = {};
    this.floods = {};
    this.warnLine = null;
    this.darkBoost = 0;
    this.stageLights = false;
    this.paused = false;
    this.mapOpen = false;
    this.ended = false;
    this.wipeT = 0;
    this.toast = null;
    this.zoneTitle = null;
    this.bossTitle = null;
    this.breakShake = {};
    this.currentRoom = null;
    this.lastZone = 0;
    this.fade = 1;
    this.race = null;
    this.rush = null;
    fx.reset();
    if (net && !net._gameBound) {
      net._gameBound = true;
      this._bindNet(net);
    }
    this.running = true;
    this.touch.show(this.menus.isTouch());
  }

  _loadWorld(def) {
    this.world = new World(def);
    this.terrain = new TerrainRenderer(this.world);
    this.sim = new Sim(this);
  }

  startStory(net, save, roster) {
    this._common(net, 'story');
    if (net && !net.isHost) this.save = Object.assign(newWorldSave(), save ? JSON.parse(JSON.stringify(save)) : {});
    else this.save = save || loadWorld() || newWorldSave();
    this._loadWorld(STORY);
    for (const id in this.save.broken) this.world.breakWall(id);
    // 봉인: 조건 보스를 잡기 전까지 닫힘
    for (const sl of this.world.seals) if (!this.save.bosses[sl.req]) this.world.setGates([sl], true);
    this._gimInit();
    this.abilities = this.save.abilities;
    const b = this.save.bench;
    // 이전 버전 저장(월드 기준점이 달랐던 경우) 보정
    if (b && (b.oy || 0) !== this.world.oy) {
      b.y += (this.world.oy - (b.oy || 0)) * TILE;
      b.oy = this.world.oy;
    }
    const sp = b || this.world.spawn;
    this.myBench = sp;
    this._setupPeers(roster);
    this.player = new Player(sp.x, sp.y);
    this._snapCamera();
    this.menus.hideAll();
  }

  startRace(net, courseIdx, roster) {
    this._common(net, 'race');
    const c = COURSES[courseIdx];
    this.course = c;
    this._loadWorld(c);
    this.abilities = { dash: true, wall: true, djump: true, hook: true, slam: true };
    this.save = newWorldSave();
    this._setupPeers(roster);
    this.myBench = this.world.spawn;
    this.player = new Player(this.world.spawn.x, this.world.spawn.y);
    this.race = { state: 'count', t: 3.2, time: 0, fin: null, results: {}, endT: null, courseIdx };
    input.enabled = true;
    audio.music(null);
    this._snapCamera();
    this.menus.hideAll();
  }

  startRush(net, order, roster) {
    this._common(net, 'rush');
    this._loadWorld(RUSH);
    this.abilities = { dash: true, wall: true, djump: true, hook: true, slam: true };
    this.save = newWorldSave();
    this._setupPeers(roster);
    this.myBench = this.world.spawn;
    this.player = new Player(this.world.spawn.x, this.world.spawn.y);
    this.rush = { order, idx: -1, t: 2.5, time: 0, state: 'break', done: false };
    this._snapCamera();
    this.menus.hideAll();
    audio.music('zone3');
  }

  // ═══ PvP 아레나 ═══
  startPvp(net, arenaIdx, roster) {
    this._common(net, 'pvp');
    const A = PVP_ARENAS[arenaIdx] || PVP_ARENAS[0];
    this.arena = A;
    this._loadWorld(A);
    this.abilities = { dash: true, wall: true, djump: true, hook: true, slam: true };
    this.save = newWorldSave();
    charmState.disabled = true; // 모두 같은 조건
    this._setupPeers(roster);
    this.roster = (roster || [{ id: this.myId, name: profile.name }]).slice().sort((a, b) => a.id - b.id);
    const scores = {};
    for (const r of this.roster) scores[r.id] = 0;
    this.pvp = { round: 0, scores, state: 'count', t: 2.5, msg: '', arenaIdx };
    this.player = new Player(0, 0);
    this.player.pvp = true;
    this._pvpSpawn();
    audio.music('boss');
    this.menus.hideAll();
  }
  _pvpSpawn() {
    const P = this.player;
    const i = Math.max(0, this.roster.findIndex((r) => r.id === this.myId));
    const sp = this.world.pvpSpawns[i % this.world.pvpSpawns.length];
    P.reset(sp.x, sp.y);
    P.pvp = true;
    P.maxHp = P.hp = 5;
    P.facing = sp.x < (this.world.rooms[0].px + this.world.rooms[0].pw / 2) ? 1 : -1;
    P.invul = 1.2;
    this.myBench = sp;
    fx.reset();
    this.fade = 0.8;
    this.currentRoom = null;
    this._snapCamera();
  }
  // 방장: 라운드 종료 판정
  _pvpCheck() {
    const V = this.pvp;
    if (!this.isHost || V.state !== 'fight' || this.targets.length < 2) return;
    const alive = this.targets.filter((t) => !t.downed);
    if (alive.length <= 1) {
      V.state = 'over';
      const w = alive.length ? alive[0].id : null;
      const scores = Object.assign({}, V.scores);
      if (w != null) scores[w] = (scores[w] || 0) + 1;
      const end = w != null && scores[w] >= 3;
      this.event('pround', { w, scores, end: end ? 1 : 0 });
      if (!end) setTimeout(() => { if (this.running && this.mode === 'pvp') this.event('pstart', { round: V.round + 1 }); }, 2600);
    }
  }
  _pvpNames() {
    const n = { [this.myId]: profile.name };
    for (const [id, p] of this.peers) n[id] = p.name;
    return n;
  }

  _setupPeers(roster) {
    this.peers = new Map();
    if (!roster) return;
    for (const r of roster) if (r.id !== this.myId) this.peers.set(r.id, { name: r.name, rp: new RemotePlayer(r.id, r.name), lastAi: 0 });
  }

  stop(keepNet) {
    this.running = false;
    charmState.disabled = false;
    this.pvp = null;
    input.counting = false;
    if (this.net && !keepNet) this.net.close();
    this.net = null;
    this.peers = new Map();
    this.touch.show(false);
    audio.setHeartbeat(false);
    input.enabled = true;
  }

  get playerCount() {
    return 1 + (this.peers ? this.peers.size : 0);
  }

  // ═══════════════ 네트워크 ═══════════════
  _bindNet(net0) {
    const net = { on: (t, fn) => net0.on(t, (m, f) => { if (this.running && this.net === net0) fn(m, f); }) };
    net.on('st', (m, from) => {
      const p = this.peers.get(from);
      if (p) p.rp.push(m.s, performance.now() / 1000);
    });
    net.on('ps', (m) => {
      const now = performance.now() / 1000;
      for (const [id, s] of m.l) {
        if (id === this.myId) continue;
        let p = this.peers.get(id);
        if (!p) continue;
        p.rp.push(s, now);
      }
    });
    net.on('snap', (m) => {
      if (!this.isHost && this.mode !== 'race') this.sim.applySnapshot(m);
    });
    net.on('ev', (m) => this.playEvent(m.n, m.d));
    net.on('hit', (m, from) => {
      if (!this.isHost) return;
      const r = this.sim.hit(m.id, m.dmg, m.fx, m.dir, from);
      if (r === 'hit' || r === 'kill' || r === 'block') this.net.broadcastExcept({ t: 'ev', n: 'hfx', d: { x: m.hx, y: m.hy, b: r === 'block' ? 1 : 0, by: from } }, from);
      if (r !== 'block') this.playEvent('hfx', { x: m.hx, y: m.hy, by: from });
    });
    net.on('brk', (m) => {
      if (this.isHost) this._damageBreakable(m.id);
    });
    net.on('shrine', (m) => {
      if (this.isHost && !this.abilities[m.ab]) this.event('ability', { ab: m.ab });
    });
    net.on('heal', (m, from) => {
      if (this.isHost && m.to !== this.myId) this.net.send({ t: 'heal', to: m.to }, m.to);
      else if (m.to === this.myId) this._receiveHeal();
    });
    net.on('phit', (m, from) => {
      if (this.mode !== 'pvp') return;
      if (this.isHost && m.to !== this.myId) this.net.send(m, m.to);
      else if (m.to === this.myId) this._receivePHit(m);
    });
    net.on('fin', (m, from) => {
      if (this.isHost && this.race) this._raceFinish(from, m.time);
    });
    net.on('race', (m) => {
      if (this.race) {
        this.race.results = m.r;
        if (m.end) this._raceEnd();
      }
    });
    net.on('rushNext', (m) => {});
    net.on('leave', (m) => {
      const p = this.peers.get(m.id);
      if (p) {
        this.showToast(`${p.name} 님이 나갔습니다`, 2.5);
        this.peers.delete(m.id);
        if (this.isHost) this.net.send({ t: 'gone', id: m.id });
      }
    });
    net.on('gone', (m) => {
      const p = this.peers.get(m.id);
      if (p) {
        this.showToast(`${p.name} 님이 나갔습니다`, 2.5);
        this.peers.delete(m.id);
      }
    });
    net.on('hostLost', () => {
      if (!this.running) return;
      this.stop();
      this.menus.showTitle('방장과의 연결이 끊어졌습니다.');
    });
    this._bindNetGim(net);
  }

  // 방장: 이벤트 실행 + 전파
  event(name, data) {
    this.playEvent(name, data);
    if (this.net && this.isHost && this.mode !== 'race') this.net.send({ t: 'ev', n: name, d: data });
  }

  // ═══════════════ 메인 루프 ═══════════════
  frame(ts) {
    requestAnimationFrame((t) => this.frame(t));
    if (this.manual) return; // 트레일러 촬영: 프레임을 외부에서 직접 진행
    const now = ts / 1000;
    let dt = this.last ? now - this.last : 1 / 60;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    // 적응형 해상도
    this.frameAvg = this.frameAvg * 0.95 + dt * 1000 * 0.05;
    this._qualityCheck(dt);
    if (!this.running) return;
    input.update();
    this._uiInput();
    if (!this.paused) {
      fx.updateScreen(dt);
      const ts2 = fx.timeScale(dt);
      this.acc += dt * ts2;
      let first = true;
      let n = 0;
      while (this.acc >= STEP && n < 12) {
        if (!first) input.clearAll();
        this.step(STEP);
        this.acc -= STEP;
        first = false;
        n++;
      }
      if (n === 0 && ts2 === 0) this._frozenTick(dt);
      this._netTick(dt);
    }
    this.render(dt);
  }

  // 개발용: 게임 시간을 dt만큼 정확히 진행하고 한 프레임 그림 (트레일러 촬영)
  manualFrame(dt) {
    input.update();
    fx.updateScreen(dt);
    const ts2 = fx.timeScale(dt);
    this.acc += dt * ts2;
    let first = true;
    while (this.acc >= STEP) {
      if (!first) input.clearAll();
      this.step(STEP);
      this.acc -= STEP;
      first = false;
    }
    this.render(dt);
  }

  _qualityCheck(dt) {
    this.qT = (this.qT || 0) + dt;
    if (this.qT < 3) return;
    this.qT = 0;
    if (this.frameAvg > 24 && this.quality > 0.6) {
      this.quality = Math.max(0.6, this.quality - 0.15);
      this.resize();
    } else if (this.frameAvg < 15 && this.quality < 1) {
      this.quality = Math.min(1, this.quality + 0.1);
      this.resize();
    }
  }

  _frozenTick() {}

  _uiInput() {
    if (input.pressed.pause) {
      input.consume('pause');
      if (this.mapOpen) this.mapOpen = false;
      else if (this.menus.modalOpen()) this.menus.closeModal();
      else this.openPause();
    }
    if (input.pressed.map && this.mode === 'story') {
      input.consume('map');
      this.mapOpen = !this.mapOpen;
    }
  }

  openPause() {
    if (this.ended) return;
    if (!this.net) this.paused = true;
    input.enabled = false;
    this.menus.showPause(!!this.net);
  }
  resume() {
    this.paused = false;
    input.enabled = true;
    input.clearAll();
  }

  // ═══════════════ 한 스텝 ═══════════════
  step(dt) {
    this.time += dt;
    const P = this.player;
    const W = this.world;

    // 레이스 카운트다운 동안 정지
    let canMove = true;
    if (this.pvp) {
      const V = this.pvp;
      if (V.state === 'count') {
        canMove = false;
        V.t -= dt;
        const sec = Math.ceil(V.t);
        if (sec !== V.lastSec && sec <= 3 && sec > 0) audio.play('beep');
        V.lastSec = sec;
        if (V.t <= 0) {
          V.state = 'fight';
          audio.play('go');
        }
      }
    }
    if (this.race && this.race.state === 'count') {
      canMove = false;
      this.race.t -= dt;
      const sec = Math.ceil(this.race.t);
      if (sec !== this.race.lastSec && sec <= 3 && sec > 0) audio.play('beep');
      this.race.lastSec = sec;
      if (this.race.t <= 0) {
        this.race.state = 'run';
        audio.play('go');
        audio.music('race');
      }
    }
    if (this.race && this.race.state === 'run' && this.race.fin == null) this.race.time += dt;
    if (this.rush && !this.rush.done && this.rush.idx >= 0) this.rush.time += dt;
    if (this.mode === 'story' && this.isHost) this.save.playTime += dt;

    W.tick(dt, this.time);
    if (canMove) P.update(dt, input, this);
    else P.update(dt, { held: {}, pressed: {}, released: {} }, this);

    // 방 전환
    const room = W.roomAt(P.cx, P.cy);
    if (room && room !== this.currentRoom) this._enterRoom(room);

    // 위험 지형
    if (!P.busy) {
      const hz = W.rectHazard(P.x + 3, P.y + 4, P.w - 6, P.h - 4);
      if (hz && P.hazardT <= 0) {
        if (this.mode === 'race') {
          const hp = P.hp;
          P.hazard(hz);
          P.hp = hp;
        } else P.hazard(hz);
        if (P.hp <= 0) this._onZeroHp();
      }
    }

    this._combat(dt);
    this._wisp(dt);
    this._interact(dt);
    this._gimStep(dt);
    this._coins(dt);

    // 원격 플레이어
    const now = performance.now() / 1000;
    for (const p of this.peers.values()) {
      p.rp.update(now);
      const s = p.rp.s;
      if (s && s.ai != null && s.ai !== p.lastAi) {
        p.lastAi = s.ai;
        if (s.ak > 0 && this.mode !== 'race' && s.rm === (this.currentRoom && this.currentRoom.id)) {
          const r = p.rp;
          const f = s.f;
          const sc = slashRGB(s.sc || 0);
          if (s.ad === 'up') fx.slash(r.cx, r.y - 6, 'up', f, sc);
          else if (s.ad === 'down') fx.slash(r.cx, r.y + r.h + 8, 'down', f, sc);
          else fx.slash(r.cx + f * 34, r.cy - 2, 'side', f, sc);
          audio.play('slash', { vol: 0.4 });
        }
      }
    }

    // 고치 부활
    if (P.downed && this.mode !== 'pvp') {
      let near = false;
      for (const p of this.peers.values()) {
        const s = p.rp.s;
        if (!s || s.dn || s.hz) continue;
        if (Math.abs(p.rp.cx - P.cx) < 80 && Math.abs(p.rp.cy - P.cy) < 70) near = true;
      }
      P.revive = near ? P.revive + dt / 2.4 : Math.max(0, P.revive - dt * 0.4);
      if (P.revive >= 1) {
        P.downed = false;
        P.revive = 0;
        P.hp = Math.ceil(P.maxHp / 2);
        P.invul = 2;
        audio.play('revive');
        fx.burst(P.cx, P.cy, 24, { kind: 'glow', color: '#ffd58a', smin: 60, smax: 260, grav: -60, add: true });
        fx.ring(P.cx, P.cy, 10, 90, 0.5, '255,220,150', 4);
      }
    }

    if (this.touch) this.touch.setHook(!!this.abilities.hook);
    // 타깃 목록 (방장 시뮬레이션용)
    this._buildTargets();

    if (this.simAuth) {
      this.sim.updateHost(dt);
      if (this.mode === 'story') this._bossTriggers();
      if (this.mode === 'pvp') this._pvpCheck();
      else if (this.mode !== 'race') this._wipeCheck(dt);
      if (this.rush) this._rushStep(dt);
    } else this.sim.updateClient(dt);

    if (this.race && this.race.endT != null && this.isHost) {
      this.race.endT -= dt;
      if (this.race.endT <= 0) this._broadcastRace(true);
    }

    // 하단 계열 타이머
    for (const k in this.breakShake) this.breakShake[k] -= dt;
    if (this.warnLine) {
      this.warnLine.t -= dt;
      if (this.warnLine.t <= 0) this.warnLine = null;
    }
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
    if (this.zoneTitle) {
      this.zoneTitle.t += dt;
      if (this.zoneTitle.t > 4) this.zoneTitle = null;
    }
    if (this.bossTitle) {
      this.bossTitle.t += dt;
      if (this.bossTitle.t > 3.2) this.bossTitle = null;
    }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 3);

    fx.update(dt);
    this._camera(dt);
    audio.setHeartbeat(P.hp === 1 && !P.downed && this.mode !== 'race');
  }

  _buildTargets() {
    const P = this.player;
    const t = [{ id: this.myId, room: this.currentRoom && this.currentRoom.id, alive: !P.downed && !P.dead && P.hazardT <= 0, x: P.x, y: P.y, w: P.w, h: P.h, cx: P.cx, cy: P.cy, downed: P.downed }];
    if (this.mode !== 'race')
      for (const [id, p] of this.peers) {
        const s = p.rp.s;
        if (!s) continue;
        t.push({ id, room: s.rm, alive: !s.dn && !s.hz, x: p.rp.x, y: p.rp.y, w: 20, h: 38, cx: p.rp.cx, cy: p.rp.cy, downed: !!s.dn });
      }
    this.targets = t;
  }

  _enterRoom(room) {
    const first = !this.currentRoom;
    this.currentRoom = room;
    this.fade = first ? 1 : 0.85;
    this._snapCamera();
    if (this.mode === 'story') {
      this.save.explored[room.id] = true;
      if (room.zone !== this.lastZone) {
        this.lastZone = room.zone;
        const z = ZONES[room.zone];
        this.zoneTitle = { name: z.name, sub: z.sub, t: 0 };
        if (!this._bossRunning()) audio.music(z.music);
      }
    } else if (this.mode === 'race') {
      if (room.zone !== this.lastZone) this.lastZone = room.zone;
    } else this.lastZone = room.zone;
    this.bg.setZone(room.zone);
    // 방 고유 음악 (마을 등) – 같은 곡이면 audio.music 이 무시
    if (this.mode === 'story' && !first && !this._bossRunning()) audio.music(room.music || ZONES[room.zone].music);
  }

  _bossRunning() {
    for (const k in this.bossActive) if (this.bossActive[k]) return true;
    return false;
  }

  // ═══════════════ 전투 ═══════════════
  _combat(dt) {
    const P = this.player;
    const W = this.world;
    const roomId = this.currentRoom && this.currentRoom.id;
    const enemies = this.sim.list();
    const box = P.attackBox();
    if (box && !P.busy) {
      // 적
      for (const e of enemies) {
        if (e.room !== roomId || P.atkHit.has(e.id)) continue;
        const def = DEFS[e.kind];
        const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (def.danger && e.kind === 'vine' && e.st === 'hide') eb.w = e.w * 0.6;
        if (!overlap(box, eb)) continue;
        if (e.kind === 'monk' && e.st === 'vanish' && e.t > 0.25) continue;
        P.atkHit.add(e.id);
        const hx = clamp(P.cx + P.facing * 30, e.x, e.x + e.w), hy = clamp(P.cy, e.y, e.y + e.h);
        let res;
        if (this.simAuth) res = this.sim.hit(e.id, P.nailDmg, P.cx, P.atkDir, this.myId);
        else {
          const blk = (def.boss && e.st === 'intro') || (def.blocks && def.blocks(e, P.cx, P.atkDir));
          res = blk ? 'block' : 'hit';
          if (!blk) e.fl = 0.09;
          this.net.send({ t: 'hit', id: e.id, dmg: P.nailDmg, fx: P.cx, dir: P.atkDir, hx, hy });
        }
        if (this.net && this.isHost && this.mode !== 'race' && res) this.net.send({ t: 'ev', n: 'hfx', d: { x: hx, y: hy, b: res === 'block' ? 1 : 0, by: this.myId } });
        if (res === 'block') {
          audio.play('clank');
          fx.burst(hx, hy, 8, { kind: 'spark', color: '#fff6d8', smin: 200, smax: 500, grav: 0, add: true, lmin: 0.1, lmax: 0.2 });
          fx.hitstop(0.04);
          P.onHitRecoil('wall');
          if (P.atkDir === 'side') P.vx = -P.facing * 300;
        } else {
          const boss = def.boss;
          audio.play(boss ? 'bossHit' : 'hit');
          fx.hitstop(res === 'kill' ? 0.075 : 0.05);
          fx.shake(boss ? 4 : 3, 0.12);
          const dirA = P.atkDir === 'up' ? -Math.PI / 2 : P.atkDir === 'down' ? Math.PI / 2 : P.facing > 0 ? 0 : Math.PI;
          fx.burst(hx, hy, 6, { kind: 'spark', color: '#ffffff', dir: dirA, spread: 0.9, smin: 300, smax: 700, grav: 0, add: true, lmin: 0.08, lmax: 0.18 });
          fx.burst(hx, hy, 5, { kind: 'shard', color: '#0e1215', dir: dirA, spread: 0.8, smin: 120, smax: 320, grav: 900, szmin: 3, szmax: 6 });
          fx.ring(hx, hy, 4, 34, 0.18, '255,255,255', 2.5);
          P.gainEmber(11);
          P.onHitRecoil('enemy');
        }
      }
      // PvP: 다른 플레이어 베기 (맞는 쪽이 무적 여부를 판단)
      if (this.mode === 'pvp' && this.pvp.state === 'fight')
        for (const [id, p] of this.peers) {
          const s = p.rp.s;
          if (!s || s.dn || s.hz || P.atkHit.has('p' + id)) continue;
          const rb = { x: p.rp.x + 2, y: p.rp.y + 2, w: 16, h: 34 };
          if (!overlap(box, rb)) continue;
          P.atkHit.add('p' + id);
          this._sendPHit(id, P.atkDir);
          const hx = p.rp.cx, hy = p.rp.cy;
          audio.play('hit');
          fx.hitstop(0.06);
          fx.shake(4, 0.12);
          fx.burst(hx, hy, 8, { kind: 'spark', color: '#ffffff', smin: 300, smax: 700, grav: 0, add: true, lmin: 0.08, lmax: 0.18 });
          P.onHitRecoil('enemy');
        }
      // 부서지는 벽
      for (const b of W.breakables) {
        if (b.broken || P.atkHit.has('b' + b.id)) continue;
        if (!overlap(box, { x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE })) continue;
        P.atkHit.add('b' + b.id);
        if (b.slamOnly) {
          // 얼음 덮개: 베기로는 튕겨남 (내려찍기 필요)
          audio.play('clank', { vol: 0.7, pitch: 1.3 });
          fx.burst(P.cx + P.facing * 30, P.cy, 6, { kind: 'spark', color: '#dff4ff', smin: 200, smax: 400, grav: 0, add: true, lmin: 0.08, lmax: 0.16 });
          P.onHitRecoil(P.atkDir === 'down' ? 'spike' : 'wall');
          if (!this._slamHintT || this.time > this._slamHintT) {
            this._slamHintT = this.time + 6;
            this.showToast(this.abilities.slam ? '단단한 얼음이다 — 내려찍기로 부술 수 있다' : '단단한 얼음이다… 베어서는 부서지지 않는다', 2.5);
          }
          continue;
        }
        audio.play('crack');
        this.breakShake[b.id] = 0.2;
        fx.burst(P.cx + P.facing * 40, P.cy, 10, { kind: 'shard', color: '#1b2428', dir: P.facing > 0 ? Math.PI : 0, spread: 0.9, smin: 100, smax: 300 });
        fx.shake(4, 0.15);
        P.onHitRecoil('wall');
        if (this.simAuth) this._damageBreakable(b.id);
        else {
          b.hp = Math.max(1, b.hp - 1);
          this.net.send({ t: 'brk', id: b.id });
        }
      }
      // 아래 베기로 가시 밟기 (포고)
      if (P.atkDir === 'down' && !P.atkHit.has('spike')) {
        const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w) / TILE);
        const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h) / TILE);
        let hitSp = false;
        for (let j = y0; j <= y1 && !hitSp; j++) for (let i = x0; i <= x1; i++) if (W.get(i, j) === T_SPIKE) { hitSp = true; break; }
        if (hitSp) {
          P.atkHit.add('spike');
          audio.play('clank', { vol: 0.6 });
          fx.burst(P.cx, P.y + P.h + 20, 8, { kind: 'spark', color: '#fff6d8', dir: -Math.PI / 2, spread: 1, smin: 200, smax: 400, grav: 0, add: true, lmin: 0.08, lmax: 0.16 });
          P.onHitRecoil('spike');
        }
      }
      // 옆베기로 벽 치기
      if (P.atkDir === 'side' && !P.atkHit.has('wall') && P.atkHit.size === 0) {
        const wx = P.facing > 0 ? P.x + P.w + 28 : P.x - 28;
        if (W.solidAt(wx, P.cy)) {
          P.atkHit.add('wall');
          audio.play('clank', { vol: 0.35, pitch: 0.8 });
          fx.burst(wx, P.cy, 5, { kind: 'spark', color: '#fff6d8', dir: P.facing > 0 ? Math.PI : 0, spread: 0.9, smin: 150, smax: 350, grav: 0, add: true, lmin: 0.06, lmax: 0.14 });
          P.onHitRecoil('wall');
        }
      }
    }

    // 밀어내기 (피해 없음): 돌풍, 소용돌이
    if (!P.busy && !P.sitting)
      for (const p of this.sim.plist()) {
        if (p.room !== roomId) continue;
        const def = PROJ[p.type];
        if (!def.push) continue;
        const v = def.push(p, { x: P.x, y: P.y, w: P.w, h: P.h });
        if (v) P.extVx = clamp(P.extVx + v.x * dt * 4, -460, 460);
      }
    // 피격 판정
    if (P.invul > 0 || P.busy || P.sitting) return;
    const pb = { x: P.x + 5, y: P.y + 10, w: P.w - 10, h: P.h - 13 }; // 관대한 피격 판정
    for (const e of enemies) {
      if (e.room !== roomId) continue;
      const def = DEFS[e.kind];
      if (def.boss && e.st === 'intro') continue;
      const boxes = def.danger(e);
      for (const b of boxes) {
        if (overlap(pb, b)) {
          this._playerHurt(b.dmg || 1, ecx(e));
          return;
        }
      }
    }
    for (const p of this.sim.plist()) {
      if (p.room !== roomId) continue;
      if (PROJ[p.type].hit(p, pb)) {
        this._playerHurt(p.ex.dmg || 1, p.x);
        return;
      }
    }
  }

  _playerHurt(dmg, srcX) {
    const P = this.player;
    const hp = P.hp;
    if (P.hurt(dmg, srcX)) {
      if (this.mode === 'race') P.hp = hp;
      if (hasCharm('thorns') && this.mode !== 'race') this._thorns();
      if (P.hp <= 0) this._onZeroHp();
    }
  }

  // 반격의 가시: 주변 적에게 피해
  _thorns() {
    const P = this.player;
    const rid = this.currentRoom && this.currentRoom.id;
    fx.ring(P.cx, P.cy, 10, 130, 0.35, '255,120,100', 4);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      fx.add({ kind: 'spark', x: P.cx, y: P.cy, vx: Math.cos(a) * 500, vy: Math.sin(a) * 500, life: 0.2, size: 3, color: '#ff9a8a', grav: 0, drag: 2, add: true });
    }
    for (const e of this.sim.list()) {
      if (e.room !== rid) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      if (Math.hypot(ex - P.cx, ey - P.cy) > 140) continue;
      this._remoteHit(e, 8, ex, ey);
    }
  }
  // 부가 피해 (가시, 떠도는 불씨): 방장/참가자 공통 경로
  _remoteHit(e, dmg, hx, hy) {
    const P = this.player;
    if (this.simAuth) this.sim.hit(e.id, dmg, P.cx, 'side', this.myId);
    else {
      e.fl = 0.09;
      this.net.send({ t: 'hit', id: e.id, dmg, fx: P.cx, dir: 'side', hx, hy });
    }
    fx.burst(hx, hy, 5, { kind: 'spark', color: '#ffd58a', smin: 200, smax: 400, grav: 0, add: true, lmin: 0.08, lmax: 0.16 });
    audio.play('hit', { vol: 0.45, pitch: 1.3 });
  }

  _wisp(dt) {
    const P = this.player;
    if (!hasCharm('wisp') || this.mode === 'race' || this.mode === 'pvp' || P.busy) {
      this.wisp = null;
      return;
    }
    const w = (this.wisp = this.wisp || { a: 0, cd: 1, x: P.cx, y: P.cy });
    w.a += dt * 3;
    const tx = P.cx + Math.cos(w.a) * 42, ty = P.cy - 14 + Math.sin(w.a) * 26;
    w.x += (tx - w.x) * Math.min(1, dt * 10);
    w.y += (ty - w.y) * Math.min(1, dt * 10);
    w.cd -= dt;
    if (w.cd <= 0) {
      const rid = this.currentRoom && this.currentRoom.id;
      let best = null, bd = 190;
      for (const e of this.sim.list()) {
        if (e.room !== rid) continue;
        const d = Math.hypot(e.x + e.w / 2 - P.cx, e.y + e.h / 2 - P.cy);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        w.cd = 1.1;
        const hx = best.x + best.w / 2, hy = best.y + best.h / 2;
        w.shot = { x0: w.x, y0: w.y, x1: hx, y1: hy, t: 0.12 };
        this._remoteHit(best, 4, hx, hy);
      } else w.cd = 0.2;
    }
    if (w.shot) {
      w.shot.t -= dt;
      if (w.shot.t <= 0) w.shot = null;
    }
  }

  _onZeroHp() {
    const P = this.player;
    P.downed = true;
    P.revive = 0;
    P.hazardT = 0;
    audio.play('cocoon');
    fx.grayscale(0.8);
    fx.burst(P.cx, P.cy, 20, { kind: 'shard', color: '#dcd4c2', smin: 80, smax: 300, szmin: 3, szmax: 6 });
    if (this.mode === 'pvp') this.showToast('쓰러졌다… 다음 라운드를 기다리세요', 2.2);
    else if (this.peers.size > 0 && this.mode !== 'race') this.showToast('고치가 되었습니다 — 동료가 곁에 머물면 부활합니다', 3);
  }

  _wipeCheck(dt) {
    if (!this.isHost) return;
    const all = this.targets.length && this.targets.every((t) => t.downed);
    if (all) {
      this.wipeT += dt;
      if (this.wipeT > 1.4) {
        this.wipeT = 0;
        this.event('wipe', {});
      }
    } else this.wipeT = 0;
  }

  _damageBreakable(id) {
    const b = this.world.breakables.find((q) => q.id === id);
    if (!b || b.broken) return;
    b.hp--;
    if (b.hp <= 0) this.event('break', { id });
  }

  // ═══════════════ 보스 ═══════════════
  _bossTriggers() {
    for (const t of this.targets) {
      if (!t.alive || !t.room) continue;
      const room = this.world.roomById[t.room];
      if (!room || !room.boss || this.bossActive[room.id]) continue;
      if (this.save.bosses[room.boss.kind]) continue;
      if (room.boss.fromRight ? t.cx < room.boss.trigger : t.cx > room.boss.trigger) this._startBoss(room, room.boss.kind, room.boss.x, room.boss.y);
    }
  }

  _startBoss(room, kind, x, y) {
    this.sim.killRoom(room.id);
    const e = this.sim.spawn(kind, x, y, room.id, {});
    e.facing = room.boss && room.boss.fromRight ? 1 : -1;
    this.bossActive[room.id] = e.id;
    this.event('bossIntro', { kind, room: room.id });
  }

  onEnemyKilled(e, by) {
    const def = DEFS[e.kind];
    if (def.boss) {
      this.bossActive[e.room] = 0;
      this.sim.killRoom(e.room, true);
      this.event('bossDead', { kind: e.kind, x: ecx(e), y: ecy(e), room: e.room, amber: def.amber });
    } else {
      this.event('kill', { x: ecx(e), y: ecy(e), k: e.kind, a: e.ex.minion ? 1 : def.amber || 0, by });
    }
  }

  _rushStep(dt) {
    const R = this.rush;
    if (R.done || !this.isHost) return;
    if (R.state === 'break') {
      R.t -= dt;
      if (R.t <= 0) {
        R.idx++;
        if (R.idx >= R.order.length) {
          R.done = true;
          this.event('rushEnd', { ok: 1, time: R.time });
          return;
        }
        R.state = 'fight';
        const room = this.world.rooms[0];
        this._startBoss(room, R.order[R.idx], room.px + room.pw * 0.62, room.py + 15 * TILE);
      }
    }
  }

  // ═══════════════ 이벤트 (모든 피어에서 실행) ═══════════════
  playEvent(n, d) {
    const P = this.player;
    if (this._gimEvent(n, d)) return;
    switch (n) {
      case 'sfx':
        if (this._near(d.x, d.y)) audio.play(d.s, { pitch: d.p || 1, vol: 0.8 });
        break;
      case 'slam':
        if (this._near(d.x, d.y)) {
          audio.play(d.bell ? 'bell' : 'boom', { vol: 0.8 });
          fx.shake(d.m || 6, 0.3);
          fx.burst(d.x, d.y, 14, { kind: 'dust', color: '#cfd8d6', dir: -Math.PI / 2, spread: 1.5, smin: 60, smax: 260, grav: 100, szmin: 4, szmax: 9 });
        }
        break;
      case 'smoke':
        fx.burst(d.x, d.y, 16, { kind: 'dust', color: '#8d7fa0', smin: 30, smax: 160, grav: -40, szmin: 5, szmax: 10, lmin: 0.4, lmax: 0.8 });
        if (d.s && this._near(d.x, d.y)) audio.play(d.s, { vol: 0.7 });
        break;
      case 'splash':
        if (d.ice) {
          fx.burst(d.x, d.y, 10, { kind: 'shard', color: '#e8f6ff', dir: -Math.PI / 2, spread: 1.3, smin: 100, smax: 320, szmin: 2, szmax: 5 });
          if (this._near(d.x, d.y)) audio.play('crack', { vol: 0.45, pitch: 1.5 });
          break;
        }
        fx.burst(d.x, d.y, 12, { kind: 'dot', color: '#6fe0c8', dir: -Math.PI / 2, spread: 1.2, smin: 100, smax: 300, add: true });
        if (this._near(d.x, d.y)) audio.play('splash', { vol: 0.6 });
        break;
      case 'rockbreak':
        fx.burst(d.x, d.y, 10, { kind: 'shard', color: '#2a2520', dir: -Math.PI / 2, spread: 1.4, smin: 100, smax: 300 });
        if (this._near(d.x, d.y)) audio.play('break', { vol: 0.5 });
        fx.shake(3, 0.12);
        break;
      case 'boom':
        fx.burst(d.x, d.y, 24, { kind: 'glow', color: '#ffb347', smin: 100, smax: 400, grav: -50, add: true });
        fx.ring(d.x, d.y, 10, 90, 0.3, '255,200,120', 5);
        fx.shake(7, 0.25);
        audio.play('boom', { vol: 0.8 });
        break;
      case 'hfx':
        if (d.by === this.myId) break;
        fx.burst(d.x, d.y, 5, { kind: 'spark', color: d.b ? '#fff6d8' : '#ffffff', smin: 250, smax: 600, grav: 0, add: true, lmin: 0.08, lmax: 0.16 });
        if (this._near(d.x, d.y)) audio.play(d.b ? 'clank' : 'hit', { vol: 0.5 });
        break;
      case 'kill': {
        audio.play('kill', { vol: this._near(d.x, d.y) ? 1 : 0.2 });
        fx.burst(d.x, d.y, 14, { kind: 'shard', color: '#0e1215', smin: 120, smax: 380, szmin: 3, szmax: 7, lmin: 0.4, lmax: 0.8 });
        fx.burst(d.x, d.y, 8, { kind: 'glow', color: '#ffcf8a', smin: 60, smax: 200, grav: -80, add: true });
        this._dropCoins(d.x, d.y, d.a);
        break;
      }
      case 'bossIntro': {
        const def = DEFS[d.kind];
        const room = this.world.roomById[d.room];
        if (room.boss && this.mode === 'story') this.world.setGates(room.boss.gates, true);
        this.bossActive[d.room] = this.bossActive[d.room] || -1;
        this.bossTitle = { name: def.name, sub: def.sub, t: 0 };
        audio.play('gate');
        setTimeout(() => audio.play('roar'), 500);
        fx.shake(8, 1.2);
        audio.music(def.music);
        break;
      }
      case 'bossDead': {
        const room = this.world.roomById[d.room];
        this.bossActive[d.room] = 0;
        fx.slowmo(0.22, 1.3);
        fx.doFlash(0.9);
        fx.shake(16, 0.9);
        audio.play('kill');
        audio.play('flash');
        setTimeout(() => audio.play('victory'), 700);
        fx.burst(d.x, d.y, 40, { kind: 'shard', color: '#0e1215', smin: 150, smax: 600, szmin: 4, szmax: 10, lmin: 0.6, lmax: 1.4 });
        fx.burst(d.x, d.y, 30, { kind: 'glow', color: '#ffd58a', smin: 80, smax: 400, grav: -50, add: true, lmin: 0.6, lmax: 1.5 });
        fx.ring(d.x, d.y, 10, 260, 0.8, '255,230,180', 8);
        this._dropCoins(d.x, d.y, d.amber || 100);
        if (this.floods[d.room]) this._flood(d.room, 0);
        if (this.mode === 'story') {
          this.save.bosses[d.kind] = true;
          if (room.boss) this.world.setGates(room.boss.gates, false);
          if (!profile.beaten) profile.beaten = [];
          if (BOSS_CHARM[d.kind] && grantCharm(BOSS_CHARM[d.kind])) {
            const C = CHARM_BY_ID[BOSS_CHARM[d.kind]];
            setTimeout(() => this.showToast(`부적 획득: ${C.name}`, 4, `${C.desc} · 벤치에서 장착`), 2600);
          }
          if (d.kind === 'keeper' && !profile.notchKeeper) {
            ensureCharms();
            profile.notchKeeper = 1;
            profile.notches = Math.min(7, profile.notches + 1);
          }
          if (!profile.beaten.includes(d.kind)) {
            profile.beaten.push(d.kind);
            saveProfile();
          }
          if (this.isHost) saveWorld(this.save);
          setTimeout(() => {
            if (this.running && this.mode === 'story') audio.music(room.music || ZONES[room.zone].music);
          }, 2500);
          for (const sl of this.world.seals) if (sl.req === d.kind) this.world.setGates([sl], false);
          if (d.kind === 'keeper') {
            this.save.cleared = true;
            if (this.isHost) saveWorld(this.save);
            setTimeout(() => this._ending(1), 4200);
          } else if (d.kind === 'devourer') {
            this.save.cleared2 = true;
            if (this.isHost) saveWorld(this.save);
            setTimeout(() => this._ending(2), 4200);
          } else if (d.kind === 'blizzard') {
            this.save.cleared3 = true;
            if (this.isHost) saveWorld(this.save);
            setTimeout(() => this._ending(3), 4200);
          }
        } else if (this.mode === 'rush' && this.rush) {
          this.rush.state = 'break';
          this.rush.t = 3.5;
          this.darkBoost = 0;
          this.stageLights = false;
          const P2 = this.player;
          if (!P2.downed) P2.hp = P2.maxHp;
          if (this.rush.idx < this.rush.order.length - 1) this.showToast('잠시 숨을 고르세요… 체력 회복', 2.5);
          audio.music('zone3');
        }
        this.darkBoost = 0;
        this.stageLights = false;
        break;
      }
      case 'phase':
        audio.play('roar', { vol: 0.9 });
        fx.shake(10, 0.8);
        fx.ring(d.x, d.y, 10, 200, 0.6, '255,200,150', 6);
        if (d.dark) this.darkBoost = 0.38;
        if (d.stage) this.stageLights = true;
        break;
      case 'bellbreak':
        audio.play('break');
        audio.play('bell', { pitch: 0.7 });
        fx.burst(d.x, d.y, 22, { kind: 'shard', color: '#3d4a3a', smin: 150, smax: 500, szmin: 4, szmax: 9, lmin: 0.5, lmax: 1.1 });
        fx.shake(12, 0.6);
        break;
      case 'flood':
        this._flood(d.room, d.on, d.fy);
        break;
      case 'issenWarn':
        this.warnLine = { y: d.y, l: d.l, r: d.r, t: 1.45, max: 1.45 };
        audio.play('charge');
        break;
      case 'issen':
        this.warnLine = null;
        fx.doFlash(0.75);
        fx.shake(14, 0.4);
        audio.play('flash');
        audio.play('slash', { pitch: 0.6 });
        fx.slashes.push({ x: (d.l + d.r) / 2, y: d.y - 32, dir: 'line', facing: 1, t: 0, life: 0.3, color: '255,255,255', big: 1, line: { l: d.l, r: d.r } });
        for (let x = d.l; x < d.r; x += 60) fx.burst(x, d.y - 30, 2, { kind: 'spark', color: '#fff', smin: 300, smax: 700, grav: 0, add: true, lmin: 0.1, lmax: 0.25, dir: 0, spread: 0.2 });
        break;
      case 'gates': {
        const room = this.world.roomById[d.room];
        if (room && room.boss) this.world.setGates(room.boss.gates, !!d.close);
        break;
      }
      case 'ability': {
        this.abilities[d.ab] = true;
        this.save.abilities[d.ab] = true;
        if (this.isHost && this.mode === 'story') saveWorld(this.save);
        const A = ABILITY_TEXT[d.ab];
        audio.play('ability');
        fx.doFlash(0.6, '255,220,160');
        fx.burst(P.cx, P.cy, 30, { kind: 'glow', color: '#ffd58a', smin: 80, smax: 360, grav: -40, add: true, lmin: 0.6, lmax: 1.2 });
        this.showToast(`${A.name} 획득!`, 5, this.menus.keyText(A.desc));
        break;
      }
      case 'break': {
        const b = this.world.breakWall(d.id);
        this.save.broken[d.id] = true;
        if (b) {
          audio.play('break');
          fx.shake(8, 0.35);
          for (let j = 0; j < b.h; j++) fx.burst((b.x + b.w / 2) * TILE, (b.y + j + 0.5) * TILE, 6, { kind: 'shard', color: '#1b2428', smin: 100, smax: 380, szmin: 4, szmax: 9 });
          if (this.isHost && this.mode === 'story') saveWorld(this.save);
        }
        break;
      }
      case 'wipe':
        this._wipe();
        break;
      case 'rushEnd':
        if (this.rush) this._rushEnd(d.ok, d.time);
        break;
      case 'pround': {
        const V = this.pvp;
        if (!V) break;
        V.state = 'over';
        V.scores = d.scores;
        const names = this._pvpNames();
        V.msg = d.w == null ? '무승부' : `${names[d.w] || '?'} 승리!`;
        V.msgT = 2.5;
        audio.play(d.w === this.myId ? 'victory' : 'bell');
        fx.slowmo(0.3, 0.8);
        if (d.end) {
          setTimeout(() => {
            if (!this.running) return;
            this.ended = true;
            input.enabled = false;
            const list = Object.keys(names).map((id) => ({ name: names[id], score: V.scores[id] || 0, me: Number(id) === this.myId }));
            list.sort((a, b) => b.score - a.score);
            this.menus.showPvpResults(list, this.isHost, !!this.net);
          }, 2200);
        }
        break;
      }
      case 'pstart': {
        const V = this.pvp;
        if (!V) break;
        V.round = d.round;
        V.state = 'count';
        V.t = 2.2;
        V.msg = '';
        this._pvpSpawn();
        break;
      }
      case 'rushHeal':
        break;
    }
  }

  _near(x, y) {
    const r = this.currentRoom;
    if (!r) return true;
    return x > r.px - 200 && x < r.px + r.pw + 200 && y > r.py - 200 && y < r.py + r.ph + 200;
  }

  _flood(roomId, on, fy) {
    const room = this.world.roomById[roomId];
    if (on) {
      if (this.floods[roomId]) return;
      const list = floodTiles(this.world, room, fy);
      this.floods[roomId] = list;
      for (let i = 0; i < list.length; i += 2) this.world.set(list[i], list[i + 1], T_LIQUID);
      audio.play('splash');
      fx.shake(5, 0.6);
      this.showToast('물이 차오른다! 발판 위로!', 2);
    } else {
      const list = this.floods[roomId];
      if (!list) return;
      for (let i = 0; i < list.length; i += 2) if (this.world.get(list[i], list[i + 1]) === T_LIQUID) this.world.set(list[i], list[i + 1], T_EMPTY);
      this.floods[roomId] = null;
    }
  }

  _wipe() {
    // 진행 중인 보스전 초기화
    for (const rid in this.bossActive) {
      if (!this.bossActive[rid]) continue;
      const room = this.world.roomById[rid];
      if (this.simAuth) this.sim.killRoom(rid);
      if (room.boss) this.world.setGates(room.boss.gates, false);
      if (this.floods[rid]) this._flood(rid, 0);
      this.bossActive[rid] = 0;
    }
    this.darkBoost = 0;
    this.stageLights = false;
    if (this.mode === 'rush') {
      this._rushEnd(0, this.rush ? this.rush.time : 0);
      return;
    }
    this.respawn();
    if (this.currentRoom) audio.music(ZONES[this.currentRoom.zone].music);
  }

  respawn() {
    const P = this.player;
    const b = this.myBench || this.world.spawn;
    const ember = P.ember;
    P.reset(b.x, b.y);
    P.ember = ember;
    Object.assign(P, looks());
    fx.reset();
    this.fade = 1;
    const room = this.world.roomAt(P.cx, P.cy);
    if (room) this._enterRoom(room);
    this._snapCamera();
  }

  _receiveHeal() {
    const P = this.player;
    if (P.downed || P.hp >= P.maxHp) return;
    P.hp++;
    audio.play('heal');
    fx.burst(P.cx, P.cy, 14, { kind: 'glow', color: '#ffd58a', smin: 60, smax: 200, grav: -100, add: true });
    this.showToast('동료가 불씨를 나눠주었습니다', 1.8);
  }

  // ── 불씨 사슬 지원 ──
  get anchors() {
    const r = this.currentRoom;
    if (!r) return [];
    if (this._anchorRoom !== r) {
      this._anchorRoom = r;
      this._anchors = this.world.objects.filter((o) => o.type === 'anchor' && o.room === r.id);
    }
    return this._anchors;
  }
  mouseWorld() {
    if (input.mouseX == null || !this.cam) return null;
    return { x: (input.mouseX * this.dpr) / this.zoom + this.cam.x, y: (input.mouseY * this.dpr) / this.zoom + this.cam.y };
  }
  _sendPHit(id, dir) {
    const P = this.player;
    const m = { t: 'phit', to: id, fx: P.cx, by: this.myId };
    if (this.isHost) this.net.send(m, id);
    else this.net.send(m);
  }
  _receivePHit(m) {
    const P = this.player;
    if (!this.pvp || this.pvp.state !== 'fight') return;
    if (P.hurt(1, m.fx) && P.hp <= 0) {
      P.downed = true;
      audio.play('cocoon');
      fx.grayscale(1);
      this.showToast('쓰러졌다… 다음 라운드를 기다리세요', 2.2);
    }
  }
  hookEnemies() {
    const rid = this.currentRoom && this.currentRoom.id;
    if (this.mode === 'pvp') {
      const out = [];
      for (const [id, p] of this.peers) {
        const s = p.rp.s;
        if (s && !s.dn && !s.hz) out.push({ id: 'p' + id, x: p.rp.x, y: p.rp.y, w: 20, h: 38 });
      }
      return out;
    }
    return this.sim.list().filter((e) => {
      if (e.room !== rid) return false;
      const d = DEFS[e.kind];
      if (d.boss && e.st === 'intro') return false;
      if (e.kind === 'vine' && e.st === 'hide') return false;
      if (e.kind === 'monk' && e.st === 'vanish') return false;
      return true;
    });
  }
  enemyPos(id) {
    if (typeof id === 'string' && id[0] === 'p') {
      const p = this.peers.get(Number(id.slice(1)));
      return p && p.rp.s && !p.rp.s.dn ? { x: p.rp.cx, y: p.rp.cy } : null;
    }
    const e = this.sim.list().find((q) => q.id === id);
    return e ? { x: e.x + e.w / 2, y: e.y + e.h / 2 } : null;
  }
  // 사슬로 끌려가 베기 (일반 베기와 같은 판정)
  hookStrike(id, P) {
    if (typeof id === 'string' && id[0] === 'p') {
      this._sendPHit(Number(id.slice(1)), 'side');
      audio.play('hit');
      audio.play('slash', { pitch: 1.2 });
      fx.hitstop(0.07);
      const pp = this.enemyPos(id);
      if (pp) fx.burst(pp.x, pp.y, 10, { kind: 'spark', color: '#ffd58a', smin: 300, smax: 700, grav: 0, add: true, lmin: 0.08, lmax: 0.2 });
      return;
    }
    const e = this.sim.list().find((q) => q.id === id);
    if (!e) return;
    const def = DEFS[e.kind];
    const hx = e.x + e.w / 2, hy = e.y + e.h / 2;
    let res;
    const hdmg = P.nailDmg * (hasCharm('ironchain') ? 2 : 1);
    if (this.simAuth) res = this.sim.hit(e.id, hdmg, P.cx, 'down', this.myId);
    else {
      const blk = (def.boss && e.st === 'intro') || (def.blocks && def.blocks(e, P.cx, 'down'));
      res = blk ? 'block' : 'hit';
      if (!blk) e.fl = 0.09;
      this.net.send({ t: 'hit', id: e.id, dmg: hdmg, fx: P.cx, dir: 'down', hx, hy });
    }
    if (this.net && this.isHost && this.mode !== 'race' && res) this.net.send({ t: 'ev', n: 'hfx', d: { x: hx, y: hy, b: res === 'block' ? 1 : 0, by: this.myId } });
    if (res === 'block') {
      audio.play('clank');
      fx.burst(hx, hy, 8, { kind: 'spark', color: '#fff6d8', smin: 200, smax: 500, grav: 0, add: true, lmin: 0.1, lmax: 0.2 });
      return;
    }
    audio.play(def.boss ? 'bossHit' : 'hit');
    audio.play('slash', { pitch: 1.2 });
    fx.hitstop(0.07);
    fx.shake(5, 0.15);
    fx.slash(hx, hy, 'side', P.facing, slashRGB(P.slashC), 1.2);
    fx.burst(hx, hy, 10, { kind: 'spark', color: '#ffd58a', smin: 300, smax: 700, grav: 0, add: true, lmin: 0.08, lmax: 0.2 });
    fx.ring(hx, hy, 6, 50, 0.22, '255,220,150', 3);
    P.gainEmber(11);
  }

  allyNeedsHeal(P) {
    if (this.mode === 'race') return false;
    for (const p of this.peers.values()) {
      const s = p.rp.s;
      if (!s || s.dn || s.hp >= s.mh) continue;
      if (Math.abs(p.rp.cx - P.cx) < 130 && Math.abs(p.rp.cy - P.cy) < 100) return true;
    }
    return false;
  }
  healAlly(P) {
    let best = null;
    for (const [id, p] of this.peers) {
      const s = p.rp.s;
      if (!s || s.dn || s.hp >= s.mh) continue;
      if (Math.abs(p.rp.cx - P.cx) < 130 && Math.abs(p.rp.cy - P.cy) < 100) best = id;
    }
    if (best == null) return;
    if (this.isHost) this.net.send({ t: 'heal', to: best }, best);
    else this.net.send({ t: 'heal', to: best });
    this.showToast('동료에게 불씨를 나눠주었습니다', 1.8);
  }
  onHeal(P) {
    if (!hasCharm('ashcrown') || this.mode === 'race' || this.mode === 'pvp') return;
    const rid = this.currentRoom && this.currentRoom.id;
    fx.ring(P.cx, P.cy, 10, 160, 0.4, '255,140,60', 6);
    fx.burst(P.cx, P.cy, 24, { kind: 'glow', color: '#ff8a3a', smin: 120, smax: 420, grav: -40, add: true, lmin: 0.3, lmax: 0.7 });
    audio.play('boom', { vol: 0.5, pitch: 1.4 });
    for (const e of this.sim.list()) {
      if (e.room !== rid) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      if (Math.hypot(ex - P.cx, ey - P.cy) < 160) this._remoteHit(e, 12, ex, ey);
    }
  }
  onSlash() {}

  // ═══════════════ 상호작용 ═══════════════
  _interact(dt) {
    const P = this.player;
    this.prompt = null;
    if (P.busy) return;
    const room = this.currentRoom;
    if (!room) return;
    for (const o of this.world.objects) {
      if (o.room !== room.id) continue;
      const dx = Math.abs(o.x - P.cx), dy = o.y - (P.y + P.h);
      switch (o.type) {
        case 'bench':
          if (dx < 36 && Math.abs(dy) < 20 && P.grounded && !P.sitting) {
            this.prompt = { x: o.x, y: o.y - 60, text: '앉기' };
            if (input.pressed.up) this._sit(o);
          } else if (P.sitting && dx < 40 && this.mode === 'story') {
            this.prompt = { x: o.x, y: o.y - 72, text: '벤치 메뉴 (부적 · 빠른 이동)' };
            if (input.pressed.up) {
              input.consume('up');
              audio.play('uiOk');
              input.enabled = false;
              this.menus.openBench(this, () => {
                input.enabled = true;
                input.clearAll();
                P.maxHp = P.calcMaxHp();
                if (P.hp > P.maxHp) P.hp = P.maxHp;
              });
            }
          }
          break;
        case 'shop':
          if (dx < 50 && Math.abs(dy) < 30 && P.grounded) {
            this.prompt = { x: o.x, y: o.y - 100, text: '상점' };
            if (input.pressed.up) {
              input.consume('up');
              audio.play('uiOk');
              input.enabled = false;
              this.menus.openShop(() => {
                input.enabled = true;
                input.clearAll();
                P.maxHp = P.calcMaxHp();
              });
            }
          }
          break;
        case 'shrine': {
          const st = this._shrineState(o);
          if (st.shrineAvail && !st.shrineTaken && dx < 26 && dy > -40 && dy < 30) this._takeShrine(o);
          break;
        }
        case 'pickup':
          if (this.mode === 'story' && !(profile.collected || {})[o.id] && dx < 24 && Math.abs(o.y - 14 - P.cy) < 36) this._takePickup(o);
          break;
      }
    }
    if (this.race && this.race.state === 'run' && this.race.fin == null && this.world.finish && overlap(P, this.world.finish)) this._myFinish();
  }

  // 다녀간 벤치 목록 (빠른 이동)
  benchList() {
    return this.world.objects.filter((o) => o.type === 'bench' && this.save.explored[o.room]).map((o) => ({ o, room: this.world.roomById[o.room] }));
  }
  warpTo(o) {
    const P = this.player;
    audio.play('teleport');
    fx.reset();
    P.reset(o.x, o.y);
    Object.assign(P, looks());
    this.fade = 1;
    const room = this.world.roomAt(P.cx, P.cy);
    if (room) this._enterRoom(room);
    this._snapCamera();
    this._sit(o);
  }

  _sit(o) {
    const P = this.player;
    P.sitting = true;
    P.x = o.x - P.w / 2;
    P.vx = 0;
    P.hp = P.maxHp;
    this.myBench = { x: o.x, y: o.y, room: o.room, oy: this.world.oy };
    audio.play('bench');
    fx.burst(o.x, o.y - 20, 16, { kind: 'glow', color: '#ffd58a', smin: 40, smax: 160, grav: -80, add: true });
    if (this.isHost && this.mode === 'story') {
      this.save.bench = this.myBench;
      saveWorld(this.save);
    }
    saveProfile();
    this.showToast('저장되었습니다', 1.5);
  }

  _shrineState(o) {
    if (o.ability === 'mask3') {
      return { shrineAvail: !!this.save.bosses.scarlet, shrineTaken: (profile.unlockedMasks || []).includes(3) };
    }
    const req = { dash: 'mother', wall: 'bell', djump: null, hook: 'keeper', slam: 'stag' }[o.ability];
    return { shrineAvail: this.mode === 'story' && (!req || !!this.save.bosses[req]), shrineTaken: !!this.abilities[o.ability] };
  }

  _takeShrine(o) {
    if (o.ability === 'mask3') {
      profile.unlockedMasks = profile.unlockedMasks || [0, 1, 2];
      profile.unlockedMasks.push(3);
      saveProfile();
      audio.play('ability');
      fx.doFlash(0.5, '255,120,130');
      this.showToast('주홍 가면 획득!', 4, '꾸미기 메뉴에서 착용할 수 있습니다');
      return;
    }
    if (this._shrineReq && this._shrineReq > this.time) return;
    this._shrineReq = this.time + 1;
    if (this.isHost) this.event('ability', { ab: o.ability });
    else this.net.send({ t: 'shrine', ab: o.ability });
  }

  _takePickup(o) {
    profile.collected = profile.collected || {};
    profile.collected[o.id] = true;
    const P = this.player;
    if (o.kind === 'shard') {
      profile.shards = (profile.shards || 0) + 1;
      audio.play('shard');
      fx.burst(o.x, o.y - 14, 20, { kind: 'glow', color: '#ffffff', smin: 60, smax: 260, grav: -40, add: true });
      if (profile.shards % 4 === 0) {
        profile.bonusMasks = (profile.bonusMasks || 0) + 1;
        P.maxHp = P.calcMaxHp();
        P.hp = P.maxHp;
        this.showToast('가면이 완성되었다! 최대 체력 +1', 3.5);
      } else this.showToast(`가면 조각 (${profile.shards % 4}/4)`, 2.5);
    } else if (o.kind === 'charm') {
      grantCharm(o.amount);
      const C = CHARM_BY_ID[o.amount];
      audio.play('ability');
      fx.burst(o.x, o.y - 14, 24, { kind: 'glow', color: C.color, smin: 60, smax: 260, grav: -40, add: true });
      this.showToast(`부적 획득: ${C.name}`, 4, `${C.desc} · 벤치에서 장착`);
    } else {
      profile.amber += o.amount;
      audio.play('amber');
      this.showToast(`호박석 +${o.amount}`, 1.5);
    }
    saveProfile();
  }

  // ═══════════════ 호박석 동전 ═══════════════
  _dropCoins(x, y, total) {
    if (!total || this.mode === 'race' || this.mode === 'pvp') return;
    if (hasCharm('amberlure')) total = Math.round(total * 1.2);
    let left = total;
    let n = 0;
    while (left > 0 && n < 30) {
      const v = left >= 25 ? 10 : left >= 8 ? 5 : 1;
      left -= v;
      n++;
      this.coins.push({ x, y, vx: rand(-220, 220), vy: rand(-520, -220), v, rot: rand(0, 6), vr: rand(-10, 10), t: 0, w: 8, h: 8 });
    }
  }

  _coins(dt) {
    const P = this.player;
    const W = this.world;
    for (const c of this.coins) {
      c.t += dt;
      const dx = P.cx - c.x, dy = P.cy - c.y;
      const d = Math.hypot(dx, dy);
      if (c.t > 0.45 && d < (hasCharm('amberlure') ? 330 : 110) && !P.busy) {
        c.vx += (dx / d) * 2400 * dt;
        c.vy += (dy / d) * 2400 * dt;
        c.vx *= 0.92;
        c.vy *= 0.92;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      } else {
        c.vy += 1800 * dt;
        const b = { x: c.x - 4, y: c.y - 4, w: 8, h: 8 };
        const r = W.moveBody(b, c.vx * dt, c.vy * dt);
        c.x = b.x + 4;
        c.y = b.y + 4;
        if (r.hitY > 0) {
          c.vy = c.vy > 300 ? -c.vy * 0.35 : 0;
          c.vx *= 0.7;
          c.vr *= 0.6;
        } else if (r.hitY < 0) c.vy = 0;
        if (r.hitX) c.vx = -c.vx * 0.5;
      }
      c.rot += c.vr * dt;
      if (c.t > 0.3 && d < 20 && !P.busy) {
        c.dead = true;
        profile.amber += c.v;
        audio.play('amber', { vol: 0.6 });
        this._amberDirty = true;
      }
      if (c.t > 30) c.dead = true;
    }
    if (this.coins.some((c) => c.dead)) this.coins = this.coins.filter((c) => !c.dead);
    if (this._amberDirty && this.coins.length === 0) {
      this._amberDirty = false;
      saveProfile();
    }
  }

  // ═══════════════ 레이스 ═══════════════
  _myFinish() {
    const R = this.race;
    R.fin = R.time;
    audio.play('victory');
    fx.doFlash(0.5, '255,220,160');
    const id = this.course.id;
    profile.raceBest = profile.raceBest || {};
    const pb = profile.raceBest[id];
    const newPb = !pb || R.time < pb;
    if (newPb) profile.raceBest[id] = R.time;
    saveProfile();
    this.showToast(`완주! ${fmtTime(R.time)}${newPb ? '  (개인 최고 기록!)' : ''}`, 4);
    if (this.isHost) this._raceFinish(this.myId, R.time);
    else this.net.send({ t: 'fin', time: R.time });
  }

  _raceFinish(id, time) {
    const R = this.race;
    if (R.results[id] != null) return;
    R.results[id] = time;
    const total = this.playerCount;
    const done = Object.keys(R.results).length;
    if (done >= total) R.endT = 1.5;
    else if (R.endT == null) R.endT = 45;
    this._broadcastRace(false);
  }

  _broadcastRace(end) {
    const R = this.race;
    if (end) R.endT = null;
    if (this.net) this.net.send({ t: 'race', r: R.results, end: end ? 1 : 0 });
    if (end) this._raceEnd();
  }

  _raceEnd() {
    if (this.race.shown) return;
    this.race.shown = true;
    this.ended = true;
    const names = { [this.myId]: profile.name };
    for (const [id, p] of this.peers) names[id] = p.name;
    const list = Object.keys(names).map((id) => ({ name: names[id], time: this.race.results[id], me: Number(id) === this.myId }));
    list.sort((a, b) => (a.time == null ? 1e9 : a.time) - (b.time == null ? 1e9 : b.time));
    input.enabled = false;
    this.menus.showRaceResults(list, this.course, this.isHost, !!this.net);
  }

  _rushEnd(ok, time) {
    if (this.rush.shown) return;
    this.rush.shown = true;
    this.rush.done = true;
    this.ended = true;
    let best = false;
    if (ok && this.rush.order.length === RUSH_ORDER.length) {
      if (!profile.rushBest || time < profile.rushBest) {
        profile.rushBest = time;
        best = true;
        saveProfile();
      }
    }
    input.enabled = false;
    audio.play(ok ? 'victory' : 'cocoon');
    this.menus.showRushResults(!!ok, time, this.rush.idx + (ok ? 0 : 0), this.rush.order.length, best, this.isHost, !!this.net);
  }

  _ending(ch = 1) {
    if (!this.running) return;
    this.ended = true;
    input.enabled = false;
    audio.music('ending');
    this.menus.showEnding(this.save.playTime, ch, () => {
      this.ended = false;
      input.enabled = true;
      input.clearAll();
      if (this.currentRoom) audio.music(ZONES[this.currentRoom.zone].music);
    });
  }

  showToast(text, t = 2.5, sub = '') {
    this.toast = { text, sub, t, max: t };
  }

  // ═══════════════ 네트워크 틱 ═══════════════
  _netTick(dt) {
    if (!this.net) return;
    this.netT += dt;
    if (this.netT < NET_RATE) return;
    this.netT = 0;
    const P = this.player;
    const s = P.serialize(this.currentRoom && this.currentRoom.id);
    s.ai = P.atkId;
    if (this.isHost) {
      const l = [[this.myId, s]];
      for (const [id, p] of this.peers) {
        const b = p.rp.buf;
        if (b.length) l.push([id, b[b.length - 1].s]);
      }
      this.net.send({ t: 'ps', l });
      if (this.mode !== 'race') this.net.send(Object.assign({ t: 'snap' }, this.sim.snapshot()));
    } else this.net.send({ t: 'st', s });
  }

  // ═══════════════ 카메라 ═══════════════
  _camTarget() {
    const P = this.player;
    const vw = this.canvas.width / this.zoom, vh = this.canvas.height / this.zoom;
    let tx = P.cx + P.facing * 50 + clamp(P.vx * 0.12, -60, 60) - vw / 2;
    let ty = P.cy - vh * 0.55;
    if (input.held.down && P.grounded && Math.abs(P.vx) < 1) {
      this.lookT = (this.lookT || 0) + 1 / 60;
      if (this.lookT > 0.5) ty += 160;
    } else if (input.held.up && P.grounded && Math.abs(P.vx) < 1 && !this.prompt) {
      this.lookT = (this.lookT || 0) + 1 / 60;
      if (this.lookT > 0.5) ty -= 140;
    } else this.lookT = 0;
    if (P.vy > 500) ty += 80;
    const r = this.currentRoom;
    if (r) {
      if (r.pw <= vw) tx = r.px + r.pw / 2 - vw / 2;
      else tx = clamp(tx, r.px, r.px + r.pw - vw);
      if (r.ph <= vh) ty = r.py + r.ph / 2 - vh / 2;
      else ty = clamp(ty, r.py, r.py + r.ph - vh);
    }
    return { x: tx, y: ty };
  }
  _snapCamera() {
    if (!this.player) return;
    if (!this.currentRoom) {
      const r = this.world.roomAt(this.player.cx, this.player.cy);
      if (r) {
        this.currentRoom = r;
        this.bg.setZone(r.zone);
      }
    }
    this.cam = this._camTarget();
  }
  _camera(dt) {
    const t = this._camTarget();
    const k = 1 - Math.exp(-dt * 7);
    this.cam.x += (t.x - this.cam.x) * k;
    this.cam.y += (t.y - this.cam.y) * (1 - Math.exp(-dt * 5));
  }

  // 발밑 그림자: 아래 땅까지 거리에 따라 옅어짐
  _shadow(ctx, x, foot, w) {
    const W = this.world;
    let d = 0;
    while (d < 140 && !W.solidAt(x, foot + d + 1) && W.get(Math.floor(x / TILE), Math.floor((foot + d + 1) / TILE)) !== 2) d += 4;
    if (d >= 140) return;
    const k = 1 - d / 140;
    const gy = Math.floor((foot + d + 1) / TILE) * TILE;
    ctx.fillStyle = `rgba(0,0,0,${0.38 * k})`;
    ctx.beginPath();
    ctx.ellipse(x, gy, w * 0.75 * (0.6 + 0.4 * k), 3.2 * k + 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ═══════════════ 렌더 ═══════════════
  render(dt) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    if (!this.running || !this.world) {
      ctx.fillStyle = '#05080a';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const z = this.zoom;
    const cam = { x: this.cam.x + fx.shakeX, y: this.cam.y + fx.shakeY };
    const view = { x0: cam.x, y0: cam.y, x1: cam.x + W / z, y1: cam.y + H / z };
    const zone = this.currentRoom ? this.currentRoom.zone : 1;
    const pal = PALETTES[zone];
    const time = this.time;

    this.bg.draw(ctx, cam, W, H, z, time);
    ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
    this.light.begin();
    const P = this.player;

    // 일섬 예고선
    if (this.warnLine) {
      const w = this.warnLine;
      const k = 1 - w.t / w.max;
      ctx.fillStyle = `rgba(255,220,150,${0.15 + k * 0.5 + Math.sin(time * 40) * 0.1})`;
      ctx.fillRect(w.l, w.y - 30 - k * 2, w.r - w.l, 4 + k * 6);
      ctx.fillStyle = `rgba(255,220,150,${0.06 + k * 0.1})`;
      ctx.fillRect(w.l, w.y - 48, w.r - w.l, 40);
      this.light.light((w.l + w.r) / 2, w.y - 30, 600, 0.4 * k);
    }

    this.terrain.draw(ctx, view, pal, time);
    this.terrain.drawDynamic(ctx, view, pal, time, this.breakShake);

    // 오브젝트
    const inView = (x, y, m = 120) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;
    for (const o of this.world.objects) {
      if (!inView(o.x, o.y)) continue;
      let st = null;
      if (o.type === 'bench') st = { benchLit: this.myBench && this.myBench.x === o.x && this.myBench.y === o.y };
      else if (o.type === 'shrine') st = this._shrineState(o);
      else if (o.type === 'pickup') {
        st = { taken: this.mode !== 'story' || !!(profile.collected || {})[o.id] };
      }
      if (o.type === 'torch' || o.type === 'lever') {
        const lit = o.litUntil === Infinity || o.litUntil > time;
        const rem = o.litUntil === Infinity || o.type === 'lever' ? Infinity : Math.max(0, (o.litUntil - time) / 9);
        if (o.type === 'torch') drawTorch(ctx, o, time, { lit, rem });
        else drawLever(ctx, o, time, { lit });
        if (lit && o.type === 'torch') {
          this.light.light(o.x, o.y - 50, 210, 1);
          this.light.glow(o.x, o.y - 50, 44, 'amber', 0.9);
        } else if (o.type === 'torch') this.light.light(o.x, o.y - 42, 60, 0.4);
        continue;
      } else if (o.type === 'npc') {
        if (!this._npcVisible(o)) continue;
        drawNpc(ctx, o, time, P.cx);
        this.light.light(o.x, o.y - 40, 150, 0.7);
        continue;
      } else if (o.type === 'house') {
        const r = this.mode === 'story' && !!(this.save.rescued || {})[o.npc];
        drawHouse(ctx, o, time, r);
        if (r) {
          this.light.light(o.x, o.y - 45, 160, 0.8);
          this.light.glow(o.x - 23, o.y - 45, 22, 'amber', 0.6);
          this.light.glow(o.x + 31, o.y - 45, 22, 'amber', 0.6);
        }
        continue;
      }
      drawObject(ctx, o, time, pal, st);
      if (o.type === 'lamp') {
        this.light.light(o.x + 10, o.y - 46, 230, 1);
        this.light.glow(o.x + 10, o.y - 46, 46, 'amber', 0.8);
      } else if (o.type === 'bench') {
        this.light.light(o.x, o.y - 30, 170, 0.8);
        this.light.glow(o.x + 35, o.y - 34, 26, 'amber', st.benchLit ? 0.9 : 0.4);
      } else if (o.type === 'shop') {
        this.light.light(o.x - 10, o.y - 60, 200, 0.9);
        this.light.glow(o.x - 12, o.y - 70, 50, 'amber', 0.6);
      } else if (o.type === 'shrine' && st.shrineAvail && !st.shrineTaken) {
        this.light.light(o.x, o.y - 50, 200, 1);
        this.light.glow(o.x, o.y - 50, 60, o.ability === 'mask3' ? 'red' : 'amber', 0.9);
      } else if (o.type === 'anchor') {
        this.light.light(o.x, o.y, 120, 0.7);
        this.light.glow(o.x, o.y, 30, 'amber', 0.6);
      } else if (o.type === 'pickup' && !st.taken) {
        this.light.light(o.x, o.y - 14, 110, 0.7);
        this.light.glow(o.x, o.y - 14, 30, o.kind === 'shard' ? 'white' : 'amber', 0.7);
      }
    }
    // 표지판 글씨
    ctx.textAlign = 'center';
    for (const o of this.world.objects) {
      if (o.type !== 'sign' || !inView(o.x, o.y)) continue;
      if (o.req && !this.abilities[o.req]) continue;
      if (typeof __PROD__ !== 'undefined' && !__PROD__ && window.__noHud) continue;
      const d = Math.hypot(o.x - P.cx, o.y - (P.y + P.h));
      const a = clamp(1 - (d - 90) / 160, 0, 1);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.font = '600 14px "Noto Sans KR", sans-serif';
      const txt = this.menus.keyText(o.text);
      const w = ctx.measureText(txt).width + 22;
      ctx.fillStyle = 'rgba(5,8,10,0.6)';
      ctx.fillRect(o.x - w / 2, o.y - 112, w, 26);
      ctx.fillStyle = '#e8dcc0';
      ctx.fillText(txt, o.x, o.y - 94);
      ctx.globalAlpha = 1;
    }

    // 동전
    for (const c of this.coins) if (inView(c.x, c.y)) drawCoin(ctx, c, time);

    // 적
    for (const e of this.sim.list()) {
      if (!inView(e.x, e.y, 200)) continue;
      const def = DEFS[e.kind];
      if (!def.fly && !def.static) this._shadow(ctx, e.x + e.w / 2, e.y + e.h, e.w);
      def.draw(ctx, e, time);
      if (def.light) {
        this.light.light(ecx(e), ecy(e), def.light, 0.85);
        if (e.kind === 'crawler') this.light.glow(ecx(e) - e.facing * 4, e.y - 6, 22, 'amber', 0.8);
        else if (e.kind === 'moth') this.light.glow(ecx(e), ecy(e), 30, 'amber', 0.6);
        else if (def.boss) this.light.glow(ecx(e), ecy(e), 70, e.kind === 'scarlet' ? 'red' : e.kind === 'bell' ? 'teal' : e.kind === 'shademoth' ? 'violet' : e.kind === 'stag' || e.kind === 'empress' || e.kind === 'blizzard' ? 'sky' : 'amber', 0.35);
        else if (e.kind === 'icewisp') this.light.glow(ecx(e), ecy(e), 30, 'sky', 0.6);
      }
    }
    // 투사체
    for (const p of this.sim.plist()) {
      if (!inView(p.x, p.y, 700)) continue;
      const def = PROJ[p.type];
      def.draw(ctx, p, time);
      if (def.light) this.light.light(p.x, p.y, def.light, 0.8);
      if (def.glow) this.light.glow(p.x, p.y, 30, def.glow, 0.6);
    }

    // 원격 플레이어
    for (const [id, p] of this.peers) {
      const s = p.rp.s;
      if (!s || s.hz) continue;
      if (this.mode !== 'race' && s.rm !== (this.currentRoom && this.currentRoom.id)) continue;
      const ds = p.rp.drawState(time);
      ds.ghost = this.mode === 'race';
      if (s.hk) drawChain(ctx, p.rp.cx, p.rp.y + 12, s.hk[0], s.hk[1], s.hk[2], time);
      this._shadow(ctx, p.rp.cx, p.rp.y + p.rp.h, 20);
      drawMoth(ctx, ds, time);
      drawNameTag(ctx, ds, p.name, this.mode === 'race' ? '#b8d8d4' : '#ffd58a');
      if (this.mode === 'pvp' && !s.dn)
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i < s.hp ? '#ece7da' : 'rgba(200,195,180,0.25)';
          ctx.fillRect(p.rp.cx - 14 + i * 6, p.rp.y - 30, 4, 4);
        }
      if (this.mode !== 'race') {
        this.light.light(p.rp.cx, p.rp.cy, 200, 0.8);
        this.light.glow(p.rp.cx, p.rp.cy - 10, 60, LIGHT_COLORS[s.lc || 0].kind, 0.2);
        if (s.dn) this.light.glow(p.rp.cx, p.rp.cy, 40, 'amber', 0.5);
      }
    }

    // 로컬 플레이어
    for (const t of P.trail) {
      ctx.globalAlpha = (t.t / 0.18) * 0.35;
      drawMoth(ctx, { x: t.x, y: t.y, w: P.w, h: P.h, facing: t.f, anim: 'dash', animT: 0, cloak: P.cloak, mask: P.mask, antenna: P.antenna, acc: P.acc, sword: P.sword, ghost: false }, time);
    }
    ctx.globalAlpha = 1;
    if (P.hook) {
      const H = P.hook;
      const k = H.phase === 'fly' ? Math.min(1, H.t / H.travel) : 1;
      drawChain(ctx, P.cx, P.y + 12, H.x, H.y, k, time);
      this.light.glow(H.x, H.y, 26, 'amber', 0.7);
    } else if (P.hookMiss) {
      drawChain(ctx, P.cx, P.y + 12, P.hookMiss.x, P.hookMiss.y, P.hookMiss.t / 0.16, time);
    }
    // 조준 표시: 지금 사슬을 쏘면 걸릴 곳
    if (this.abilities.hook && !P.hook && !P.busy && this.mode !== 'race') {
      const dirX = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      const a = P.hookAim(input, this, dirX);
      const tg = findHookTarget(a.ox, a.oy, a.ax, a.ay, this, a.wide);
      if (tg) {
        const pulse = 1 + Math.sin(time * 8) * 0.12;
        ctx.strokeStyle = tg.type === 'enemy' ? 'rgba(255,120,100,0.8)' : tg.type === 'anchor' ? 'rgba(255,220,150,0.85)' : 'rgba(220,210,190,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, (tg.type === 'wall' ? 6 : 13) * pulse, 0, Math.PI * 2);
        ctx.stroke();
        if (tg.type !== 'wall') {
          for (let i = 0; i < 4; i++) {
            const an = i * Math.PI / 2 + time * 2;
            ctx.beginPath();
            ctx.moveTo(tg.x + Math.cos(an) * 16 * pulse, tg.y + Math.sin(an) * 16 * pulse);
            ctx.lineTo(tg.x + Math.cos(an) * 21 * pulse, tg.y + Math.sin(an) * 21 * pulse);
            ctx.stroke();
          }
        }
      }
    }
    if (this.wisp) {
      const w = this.wisp;
      ctx.fillStyle = 'rgba(255,140,80,0.35)';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 9 + Math.sin(time * 9) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe2a8';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      this.light.light(w.x, w.y, 90, 0.6);
      if (w.shot) {
        ctx.strokeStyle = `rgba(255,200,120,${w.shot.t / 0.12})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(w.shot.x0, w.shot.y0);
        ctx.lineTo(w.shot.x1, w.shot.y1);
        ctx.stroke();
      }
    }
    if (P.hazardT <= 0 || P.hazardT > 0.55) {
      this._shadow(ctx, P.cx, P.y + P.h, P.w);
      drawMoth(ctx, P, time);
    }
    this.light.light(P.cx, P.cy - 10, P.downed ? 140 : 300, 1);
    this.light.glow(P.cx, P.cy - 10, 70, LIGHT_COLORS[P.lightC || 0].kind, 0.22);
    if (P.focusT > 0) this.light.glow(P.cx, P.cy, 50 + P.focusT * 30, 'amber', 0.6);

    // 상호작용 안내
    if (this.prompt) {
      const pr = this.prompt;
      ctx.font = '600 13px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      const txt = this.menus.keyText('{U} ') + pr.text;
      const w = ctx.measureText(txt).width + 18;
      ctx.fillStyle = 'rgba(5,8,10,0.7)';
      ctx.fillRect(pr.x - w / 2, pr.y - 16 + Math.sin(time * 3) * 2, w, 22);
      ctx.fillStyle = '#ffe2a8';
      ctx.fillText(txt, pr.x, pr.y + Math.sin(time * 3) * 2);
    }

    // 레이스 결승선
    if (this.world.finish) {
      const f = this.world.finish;
      const g = ctx.createLinearGradient(f.x, 0, f.x + f.w, 0);
      g.addColorStop(0, 'rgba(255,210,140,0)');
      g.addColorStop(0.5, `rgba(255,210,140,${0.25 + Math.sin(time * 3) * 0.08})`);
      g.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x, f.y, f.w, f.h);
      this.light.light(f.x + f.w / 2, f.y + f.h / 2, 300, 1);
      ctx.font = '700 20px "Noto Serif KR", serif';
      ctx.fillStyle = '#ffe2a8';
      ctx.textAlign = 'center';
      ctx.fillText('결 승', f.x + f.w / 2, f.y + f.h / 2);
    }

    // 일섬 효과선 (fx.slashes의 line 타입)
    for (const s of fx.slashes) {
      if (!s.line) continue;
      const k = s.t / s.life;
      ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
      ctx.fillRect(s.line.l, s.y - (1 - k) * 22, s.line.r - s.line.l, (1 - k) * 44);
    }
    fx.slashes = fx.slashes.filter((s) => !s.line || s.t < s.life);
    const normal = fx.slashes.filter((s) => !s.line);
    const saved = fx.slashes;
    fx.slashes = normal;
    this._drawChase(ctx, view, time);
    fx.draw(ctx, view);
    fx.slashes = saved;

    this.light.drawGlows(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 어둠
    let dark = (this.currentRoom ? this.currentRoom.dark : 0.4) * 0.82;
    dark = clamp(dark + this.darkBoost + (this.stageLights ? 0.2 : 0), 0, 0.95);
    this.light.drawDark(ctx, W, H, cam, z, pal.dark, dark);
    this.bg.drawShafts(ctx, W, H, z, time, cam);
    this.bg.drawMotes(ctx, cam, W, H, z, time);
    this.bg.drawFore(ctx, cam, W, H, z);

    // 화면 효과
    if (this.stageLights) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const sx = W * (0.2 + i * 0.3) + Math.sin(time * 0.7 + i * 2) * W * 0.1;
        const g = ctx.createLinearGradient(sx, 0, sx, H);
        g.addColorStop(0, 'rgba(255,80,90,0.18)');
        g.addColorStop(1, 'rgba(255,80,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx - 20, 0);
        ctx.lineTo(sx + 20, 0);
        ctx.lineTo(sx + W * 0.12, H);
        ctx.lineTo(sx - W * 0.12, H);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fx.gray > 0.01) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${fx.gray})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,255,255,${fx.gray * 0.08})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vignette, 0, 0, W, H);
    if (P.hp === 1 && !P.downed && this.mode !== 'race') {
      ctx.globalAlpha = 0.35 + Math.sin(time * 6.5) * 0.15;
      ctx.drawImage(this.vignette, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
      ctx.globalAlpha = 1;
    }
    if (fx.flash > 0.01) {
      ctx.fillStyle = `rgba(${fx.flashColor},${fx.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 위험지형 리스폰 페이드
    let fade = this.fade;
    if (P.hazardT > 0) fade = Math.max(fade, P.hazardT > 0.35 ? 1 - (P.hazardT - 0.35) / 0.4 : P.hazardT / 0.35);
    if (fade > 0.01) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (!(typeof __PROD__ !== 'undefined' && !__PROD__ && window.__noHud)) this.hud.draw(ctx, W, H, this.dpr, dt);
    if (typeof __PROD__ !== 'undefined' && !__PROD__ && window.__overlay) window.__overlay(ctx, W, H);
  }
}

// 불씨 사슬 그리기: 손에서 고리까지 빛나는 사슬 마디
function drawChain(ctx, x0, y0, x1, y1, k, time) {
  const ex = x0 + (x1 - x0) * k, ey = y0 + (y1 - y0) * k;
  const dx = ex - x0, dy = ey - y0, d = Math.hypot(dx, dy);
  if (d < 2) return;
  const ang = Math.atan2(dy, dx);
  const n = Math.floor(d / 8);
  ctx.save();
  for (let i = 0; i <= n; i++) {
    const t = i / Math.max(1, n);
    const x = x0 + dx * t, y = y0 + dy * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + (i % 2 ? Math.PI / 2 : 0));
    const glow = 0.55 + 0.45 * Math.sin(time * 12 - i * 0.6);
    ctx.strokeStyle = `rgba(255,${170 + glow * 60},${90 + glow * 60},0.95)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // 고리 끝
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd58a';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-3, -5);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-3, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

installGimmicks(Game);
