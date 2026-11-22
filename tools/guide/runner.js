// 스피드런 가이드 자동 주행: 경로(착지점 궤적)를 예측 제어로 따라가고, 보스는 전투 AI로 상대
// window.__route 에 구간 목록을 넣은 뒤 이 스크립트를 실행. window.__run.frame(dt) 로 한 프레임 진행.
(() => {
  const g = __game, inp = __input, T = 32, DT = 1 / 120;
  const ACTS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'heal', 'hook'];
  let held = {};
  const apply = (h) => {
    for (const a of ACTS) {
      const on = !!h[a];
      if (on !== !!held[a]) inp.setVirtual(a, on);
    }
    held = Object.assign({}, h);
  };
  const P = () => g.player;
  const ecx = (e) => e.x + e.w / 2, ecy = (e) => e.y + e.h / 2;
  const legs = window.__route;
  // 각 구간 경로 위의 벤치 (체력이 깎였으면 앉아서 회복 + 저장)
  for (const L of legs) {
    L.benches = g.world.objects.filter((o) => o.type === 'bench' && L.path.some(([x, y]) => Math.abs(x - o.x) < 40 && Math.abs(y - o.y) < 20));
  }
  const R = {
    leg: 0, cur: 0, mode: 'route', ex: null, exT: 0, replanT: 0, stuckT: 0, bestCur: 0,
    techShown: {}, slow: 0, caption: null, events: [], log: [], done: false, t: 0, deaths: 0, healing: 0,
  };
  window.__run = R;

  // ── 효과음/이펙트를 끈 채로 시뮬레이션 ──
  const FXK = ['add', 'burst', 'ring', 'shake', 'hitstop', 'slowmo', 'doFlash', 'grayscale', 'slash', 'text'];
  const noop = () => {};
  function quiet(fn) {
    const saved = {};
    for (const k of FXK) { saved[k] = __fx[k]; __fx[k] = noop; }
    const ap = __audio.play;
    __audio.play = noop;
    try { return fn(); } finally {
      for (const k of FXK) __fx[k] = saved[k];
      __audio.play = ap;
    }
  }
  const g2 = () => ({
    world: g.world, abilities: g.abilities, anchors: [], allyNeedsHeal: () => false, healAlly() {}, onHeal() {}, onSlash() {}, onSlam() {},
    hookEnemies: () => [], enemyPos: () => null, hookStrike() {}, mouseWorld: () => null,
  });
  function clonePlayer(p) {
    const s = Object.create(Object.getPrototypeOf(p));
    for (const k of Object.keys(p)) s[k] = p[k];
    s.trail = [];
    s.atkHit = new Set();
    s.hook = null;
    s.focusSnd = null;
    return s;
  }

  // ── 계획: 시간에 따른 입력 (벽 점프는 상태 기반) ──
  function randPlan(ab) {
    const r = Math.random;
    const d0 = r() < 0.15 ? 0 : r() < 0.5 ? 1 : -1;
    return {
      dir: d0, turnAt: r() < 0.3 ? 0.08 + r() * 0.6 : 99, dir2: r() < 0.3 ? 0 : -d0 || (r() < 0.5 ? 1 : -1),
      jumpAt: r() < 0.75 ? r() * 0.3 : 99, holdJ: [0.04, 0.1, 0.16, 0.3][Math.floor(r() * 4)],
      dashAt: ab.dash && r() < 0.4 ? r() * 0.6 : 99,
      djAt: ab.djump && r() < 0.5 ? 0.15 + r() * 0.5 : 99, djHold: [0.06, 0.14, 0.25][Math.floor(r() * 3)],
      wall: ab.wall && r() < 0.5, zig: r() < 0.5, drop: r() < 0.08,
    };
  }
  function mkExec(plan) {
    return { plan, t: 0, dir: plan.dir, wallCd: 0, jUntil: -1, turned: false, prevJump: false };
  }
  const cloneExec = (e) => Object.assign({}, e);
  // 한 스텝 입력 계산 (e 갱신)
  function execStep(e, p) {
    const pl = e.plan, t = e.t, h = {};
    if (!e.turned && t >= pl.turnAt) { e.turned = true; e.dir = pl.dir2; }
    let jump = (t >= pl.jumpAt && t < pl.jumpAt + pl.holdJ) || (t >= pl.djAt && t < pl.djAt + pl.djHold) || t <= e.jUntil;
    if (pl.wall && p.anim === 'wall' && e.wallCd <= 0) {
      e.jUntil = t + 0.12;
      e.wallCd = 0.2;
      e.dir = pl.zig ? p.facing : -p.facing;
      jump = true;
      e.relJ = 1; // 벽 점프 전 한 스텝 떼기
    }
    if (e.wallCd > 0) e.wallCd -= DT;
    if (e.relJ) { e.relJ = 0; if (e.prevJump) jump = false; }
    h.left = e.dir < 0;
    h.right = e.dir > 0;
    if (pl.drop && t < 0.1) h.down = true;
    h.jump = jump;
    h.dash = t >= pl.dashAt && t < pl.dashAt + 0.025;
    e.prevJump = jump;
    e.t += DT;
    return h;
  }

  // ── 경로 진행도 ──
  const legPath = () => legs[R.leg].path;
  function reachIdx(p, from, span = 60) {
    const path = legPath();
    let best = -1;
    const fx = p.x + p.w / 2, fy = p.y + p.h;
    for (let i = from; i < Math.min(path.length, from + span); i++) {
      const [x, y, land] = path[i];
      const tol = land ? 22 : 30;
      if (Math.abs(x - fx) < tol && Math.abs(y - fy) < (land ? 14 : 30)) best = i;
    }
    return best;
  }
  function evalExec(e, horizon, th) {
    return quiet(() => {
      let hitPen = 0;
      const p = clonePlayer(P());
      const gg = g2();
      const W = g.world;
      const sin = { held: {}, pressed: {}, released: {}, consume(a) { this.pressed[a] = false; } };
      let prev = {};
      let idx = R.cur, tReach = 0;
      const path = legPath();
      for (let t = 0; t < horizon; t += DT) {
        const h = execStep(e, p);
        for (const a of ACTS) {
          sin.pressed[a] = !!h[a] && !prev[a];
          sin.held[a] = !!h[a];
        }
        prev = h;
        p.update(DT, sin, gg);
        if (p.hazardT > 0 || W.rectHazard(p.x + 3, p.y + 4, p.w - 6, p.h - 4)) return { score: -1e9 + idx * 100 };
        if (th && !hitPen && t < 0.7 && P().invul - t <= 0.02 && hitByThreat(th, { x: p.x + 3, y: p.y + 3, w: p.w - 6, h: p.h - 4 }, t)) hitPen = 2500 - t * 1500;
        const k = reachIdx(p, idx + 1, 50);
        if (k > idx) { idx = k; tReach = t; }
        if (idx >= path.length - 1) break;
      }
      const nx = path[Math.min(path.length - 1, idx + 1)];
      const d = Math.hypot(nx[0] - (p.x + p.w / 2), nx[1] - (p.y + p.h));
      const pl = e.plan, H = horizon;
      let style = 0;
      if (pl.jumpAt < H) style -= 14;
      if (pl.djAt < H) style -= 8;
      if (pl.turnAt < H) style -= 12;
      if (pl.drop) style -= 6;
      if (pl.dashAt < H) style += 8;
      if (pl.dir === 0) style -= 10;
      return { score: idx * 100 - tReach * 90 - d / 6 - hitPen + style, idx };
    });
  }
  function replan() {
    const ab = g.abilities;
    let best = null;
    const th0 = threatsNow();
    const th = th0.en.length || th0.pr.length ? th0 : null;
    const curDir = R.ex ? R.ex.dir : 0;
    const tryE = (e, cont) => {
      const r = evalExec(cloneExec(e), 1.2, th);
      let sc = r.score;
      if (cont) sc += 28; // 사람처럼: 하던 동작을 쉽게 바꾸지 않음
      else if (curDir && e.dir && e.dir !== curDir) sc -= 24; // 급반전 감점
      if (!best || sc > best.score) best = { score: sc, e, idx: r.idx };
    };
    if (R.ex) tryE(R.ex, true);
    for (let i = 0; i < 44; i++) tryE(mkExec(randPlan(ab)));
    if (best.score < -1e8 && R.ex) best = { e: R.ex, score: best.score };
    R.ex = best.e;
    R.exScore = best.score;
    noteTech(best.e);
  }

  // ── 핵심 테크 슬로모션 ──
  const TECH = {
    dash: '공중 대시로 물길 넘기',
    wall: '벽 점프로 수직 벽 오르기',
    djump: '이단 점프로 높은 턱 넘기',
    pogo: '아래 베기 포고 — 적·가시를 밟고 튀어오르기',
  };
  function slowmo(kind, dur = 0.7) {
    if (R.techShown[kind] >= 1 || R.slow > 0) return;
    R.techShown[kind] = (R.techShown[kind] || 0) + 1;
    R.slow = dur;
    R.caption = { text: TECH[kind], t: 0 };
    R.events.push({ t: R.t, kind });
  }
  function noteTech(e) {
    const pl = e.plan, t = e.t, p = P();
    if (!p.grounded && pl.dashAt > t && pl.dashAt < t + 0.25 && g.currentRoom && g.currentRoom.zone === 2) slowmo('dash');
    if (pl.wall && g.abilities.wall && p.anim === 'wall' && g.currentRoom && g.currentRoom.zone === 3) slowmo('wall');
    if (pl.djAt > t && pl.djAt < t + 0.3 && g.abilities.djump && !p.grounded) slowmo('djump');
  }

  // ── 전투 ──
  const DANGER = /wind|crouch|aim|curl|charge|^dash$|sweep|spin|thrust|dive|swoop|slam|leap|lunge|roll|bash/;
  const RUSH = /charge|^dash$|sweep|spin|thrust|roll|lunge|swoop/;
  const fb = { cd: 0, evadeT: 0, jumping: 0, pogos: 0, prevVy: 0 };
  function fight(e, dt) {
    const pl = P(), h = {};
    fb.cd -= dt;
    const dx = ecx(e) - pl.cx, dy = ecy(e) - pl.cy, dist = Math.abs(dx);
    const dir = Math.sign(dx) || pl.facing;
    const rushing = RUSH.test(e.st), winding = DANGER.test(e.st) && !rushing;
    const tap = (a) => { h[a] = !held[a]; };
    const side = (d) => { h[d > 0 ? 'right' : 'left'] = true; };
    // 투사체 회피: 가까이 날아오는 것이 있으면 점프
    for (const q of g.sim.plist()) {
      const qx = q.x - pl.cx, qy = q.y - pl.cy;
      if (Math.abs(qx) < 110 && Math.abs(qy) < 60 && Math.sign(q.vx || 0) === -Math.sign(qx) && pl.grounded) { h.jump = true; side(-Math.sign(qx) || 1); return h; }
    }
    if (pl.vy < -560 && fb.prevVy >= -560 && !pl.grounded) {
      fb.pogos++;
      if (fb.pogos === 1) slowmo('pogo', 0.75);
    }
    fb.prevVy = pl.vy;
    const above = pl.y + pl.h < e.y + 14 && dist < e.w / 2 + 26;
    if (!pl.grounded && above) {
      h.down = true;
      if (dist > 6) side(dir);
      if (pl.atkCD <= 0) tap('attack');
      return h;
    }
    if (rushing && dist < 260 && pl.grounded) {
      h.jump = true;
      side(dir);
      fb.evadeT = 0.45;
      return h;
    }
    if (fb.evadeT > 0) {
      fb.evadeT -= dt;
      h.jump = pl.vy < 0;
      side(dir);
      if (g.abilities.djump && !pl.djUsed && pl.vy > -100 && !pl.grounded) tap('jump');
      return h;
    }
    if (winding && dist < 130 && pl.grounded && pl.dashCD <= 0 && g.abilities.dash) {
      side(-dir);
      tap('dash');
      fb.cd = 0.4;
      return h;
    }
    if (winding && dist < 110 && pl.grounded) {
      side(-dir);
      return h;
    }
    if (pl.grounded && dist < 170 && fb.cd <= 0 && e.y + e.h > pl.y) {
      h.jump = true;
      side(dir);
      fb.cd = 0.6;
      fb.jumping = 0.24;
      return h;
    }
    if (fb.jumping > 0) {
      fb.jumping -= dt;
      h.jump = true;
      if (dist > 10) side(dir);
      if (dy < -30 && pl.atkCD <= 0) { h.up = true; tap('attack'); }
      return h;
    }
    if (!pl.grounded) {
      if (dist > 10) side(dir);
      if (dist < 90 && pl.atkCD <= 0) {
        if (dy < -30) h.up = true;
        tap('attack');
      }
      return h;
    }
    if (dist > 64) side(dir);
    else if (pl.facing !== dir) side(dir);
    if (dist < 100 && pl.atkCD <= 0) {
      if (dy < -50) h.up = true;
      tap('attack');
    }
    return h;
  }


  // ── 예측 전투: 후보 행동을 0.6초 시뮬레이션, 적 판정/투사체를 앞으로 외삽해 피격을 피하고 타격 기회를 찾음 ──
  const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const GRAVP = { wax: 1500, shard: 1400, lantern: 1400, rock: 1900 };
  function threatsNow() {
    const room = g.currentRoom && g.currentRoom.id;
    const en = [];
    for (const e of g.sim.list()) {
      if (e.room !== room || e.dead) continue;
      const D = __DEFS[e.kind];
      let boxes = [];
      try { boxes = D.danger ? D.danger(e) : []; } catch (err) { boxes = []; }
      // 땅 적도 떨어지는 중이면 바닥까지 낙하 예측
      let floorDy = 0;
      if (!D.fly && (e.vy || 0) > 0) {
        const Wd = g.world;
        while (floorDy < 600 && !Wd.solidAt(e.x + e.w / 2, e.y + e.h + floorDy + 2)) floorDy += 8;
      }
      en.push({ e, boxes, vx: e.vx || 0, vy: e.vy || 0, fly: !!D.fly, floorDy, boss: !!D.boss });
    }
    const pr = [];
    for (const q of g.sim.plist()) {
      if (q.room !== room) continue;
      pr.push(q);
    }
    return { en, pr };
  }
  // 예고 동작 → 곧 나올 공격의 판정을 미리 예측
  function anticipate(o, t) {
    const e = o.e, st = e.st, f = e.facing || 1;
    const bx = { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 6 };
    const room = g.currentRoom;
    const clampX = (x, w) => room ? Math.max(room.px + 32, Math.min(room.px + room.pw - 32 - w, x)) : x;
    if (e.kind === 'keeper') {
      if (st === 'dwind') {
        const rem = 0.44 - e.t;
        if (t > rem && t < rem + 0.32) { const dx = f * 760 * Math.min(t - rem, 0.26); return [{ x: clampX(bx.x + dx, bx.w) - (f < 0 ? 40 : 0), y: bx.y, w: bx.w + 40, h: bx.h }]; }
      } else if (st === 'swind') {
        const rem = 0.31 - e.t;
        const ex = e.x + (o.vx || 0) * Math.max(0, Math.min(t, rem)) + f * 140 * Math.max(0, t - rem) * 0.5;
        if (t > rem - 0.05 && t < rem + 0.16) return [{ x: f > 0 ? ex + e.w - 8 : ex - 74, y: e.y + e.h / 2 - 33, w: 82, h: 54 }];
      } else if (st === 'phang') {
        const rem = 0.3 - e.t;
        if (t > rem) return [{ x: e.x - 14, y: e.y, w: e.w + 28, h: 400 }];
      }
    } else if (e.kind === 'mother' && st === 'cwind') {
      const rem = 0.95 - e.t, sp = e.ex.p === 2 ? 600 : 470;
      if (t > rem) return [{ x: clampX(bx.x + f * sp * (t - rem), bx.w), y: bx.y + 8, w: bx.w, h: bx.h - 8 }];
    }
    return null;
  }
  function hitByThreat(th, box, t) {
    for (const o of th.en) {
      const dy = o.fly ? o.vy * t : o.vy > 0 ? Math.min(o.vy * t, o.floorDy) : o.vy * t;
      for (const b of o.boxes) if (ov(box, { x: b.x + o.vx * t, y: b.y + dy, w: b.w, h: b.h })) return true;
      const a = anticipate(o, t);
      if (a) for (const b of a) if (ov(box, b)) return true;
    }
    for (const q of th.pr) {
      const D = __PROJ[q.type];
      if (q.type === 'lantern') {
        // 포물선 착지 지점 예측 → 폭발(반경 60) + 바닥 불
        if (q._land === undefined) {
          let x = q.x, y = q.y, vx = q.vx || 0, vy = q.vy || 0, tt = 0;
          const W = g.world;
          q._land = null;
          for (; tt < 2.5; tt += 1 / 60) {
            vy += 1400 / 60; x += vx / 60; y += vy / 60;
            if (W.solidAt(x, y + 8) || W.solidAt(x + Math.sign(vx) * 8, y)) { q._land = { x, y, t: tt }; break; }
          }
        }
        const Ld = q._land;
        if (Ld) {
          if (t > Ld.t - 0.05 && t < Ld.t + 0.3) { const nx = Math.max(box.x, Math.min(Ld.x, box.x + box.w)), ny = Math.max(box.y, Math.min(Ld.y, box.y + box.h)); if ((nx - Ld.x) ** 2 + (ny - Ld.y) ** 2 < 66 * 66) return true; }
          if (t > Ld.t + 0.1 && ov(box, { x: Ld.x - 14, y: Ld.y - 10, w: 28, h: 40 })) return true;
        }
        continue;
      }
      if (q.type === 'lantern') {
        // 포물선 착지 지점 예측 → 폭발(반경 60) + 바닥 불
        if (q._land === undefined || q._lt !== q.t) {
          let x = q.x, y = q.y, vx = q.vx || 0, vy = q.vy || 0, tt = 0;
          const Wd = g.world;
          q._land = null;
          q._lt = q.t;
          for (; tt < 2.5; tt += 1 / 60) {
            vy += 1400 / 60; x += vx / 60; y += vy / 60;
            if (Wd.solidAt(x, y + 8) || Wd.solidAt(x + Math.sign(vx) * 8, y)) { q._land = { x, y, t: tt }; break; }
          }
        }
        const Ld = q._land;
        if (Ld) {
          if (t < Ld.t) {
            const f = { x: q.x + (q.vx || 0) * t, y: q.y + (q.vy || 0) * t + 700 * t * t };
            const nx = Math.max(box.x, Math.min(f.x, box.x + box.w)), ny = Math.max(box.y, Math.min(f.y, box.y + box.h));
            if ((nx - f.x) ** 2 + (ny - f.y) ** 2 < 14 * 14) return true;
          }
          if (t > Ld.t - 0.04 && t < Ld.t + 0.26) {
            const nx = Math.max(box.x, Math.min(Ld.x, box.x + box.w)), ny = Math.max(box.y, Math.min(Ld.y, box.y + box.h));
            if ((nx - Ld.x) ** 2 + (ny - Ld.y) ** 2 < 66 * 66) return true;
          }
          if (t > Ld.t + 0.1 && ov(box, { x: Ld.x - 14, y: Ld.y - 10, w: 28, h: 40 })) return true;
        }
        continue;
      }
      if (q.type === 'rockwarn') {
        // 남은 시간 뒤 천장에서 바위가 떨어짐: 그 무렵 그림자 위에 있으면 위험
        const rem = q.life - q.t;
        if (t > rem - 0.15 && t < rem + 0.7 && Math.abs(box.x + box.w / 2 - q.x) < 30) return true;
        continue;
      }
      if (!D || !D.hit) continue;
      const gr = q.ex && q.ex.grav ? q.ex.grav : GRAVP[q.type] || 0;
      const f = Object.assign({}, q, { x: q.x + (q.vx || 0) * t, y: q.y + (q.vy || 0) * t + 0.5 * gr * t * t, t: q.t + t });
      try { if (D.hit(f, box)) return true; } catch (err) {}
    }
    return false;
  }
  function fightPlans(dir, ab) {
    const L = [];
    const mk = (o) => L.push(Object.assign({ mv: 0, mvT: 99, j: 99, jh: 0.3, d: 99, dd: 0, atk: 99, ad: 'side', dj: 99, face: dir }, o));
    mk({});
    for (const m of [dir, -dir]) {
      mk({ mv: m });
      mk({ mv: m, atk: 0.02 });
      // 조금 다가가서 멈추고 베기 / 조금 물러서기 (사람처럼 거리 조절)
      for (const mvT of [0.1, 0.2, 0.32]) {
        mk({ mv: m, mvT });
        if (m === dir) mk({ mv: m, mvT, atk: Math.max(0.02, mvT - 0.04) });
      }
      for (const j of [0, 0.06, 0.12, 0.2]) mk({ mv: m, j, jh: 0.3 });
      mk({ mv: m, j: 0, jh: 0.12 });
      mk({ mv: m, j: 0, jh: 0.3, atk: 0.3, ad: 'down' });
      mk({ mv: m, j: 0, jh: 0.3, atk: 0.12, ad: 'up' });
      if (ab.dash) { mk({ mv: m, d: 0, dd: m }); mk({ mv: m, j: 0, jh: 0.3, d: 0.18, dd: m }); }
      if (ab.djump) mk({ mv: m, j: 0, jh: 0.3, dj: 0.3 });
    }
    mk({ mv: 0, atk: 0.02 });
    mk({ mv: 0, j: 0, jh: 0.3 });
    mk({ mv: 0, j: 0, jh: 0.3, atk: 0.28, ad: 'down' });
    mk({ mv: 0, atk: 0.02, ad: 'up' });
    return L;
  }
  function planKeys(pl, t, p) {
    const h = {};
    let mv = t < pl.mvT ? pl.mv : 0;
    if (mv === 0 && t < 0.03 && p.facing !== pl.face) mv = pl.face; // 공격 방향 맞추기
    if (mv > 0) h.right = true; else if (mv < 0) h.left = true;
    h.jump = (t >= pl.j && t < pl.j + pl.jh) || (t >= pl.dj && t < pl.dj + 0.2);
    if (t >= pl.d && t < pl.d + 0.02) h.dash = true;
    if (t >= pl.atk && t < pl.atk + 0.02) {
      h.attack = true;
      if (pl.ad === 'down') h.down = true;
      if (pl.ad === 'up') h.up = true;
    }
    if (pl.ad === 'down' && t >= pl.atk - 0.05 && t < pl.atk + 0.05) h.down = true;
    return h;
  }
  const FH = 0.6;
  function evalFight(pl, th, target, wantFar) {
    return quiet(() => {
      const p = clonePlayer(P());
      const gg = g2();
      const W = g.world;
      const sin = { held: {}, pressed: {}, released: {}, consume(a) { this.pressed[a] = false; } };
      let prev = {}, score = 0, hitBonus = 0;
      for (let t = 0, i = 0; t < FH; t += DT, i++) {
        const h = planKeys(pl, t, p);
        for (const a of ACTS) { sin.pressed[a] = !!h[a] && !prev[a]; sin.held[a] = !!h[a]; }
        prev = h;
        p.update(DT, sin, gg);
        if (W.rectHazard(p.x + 3, p.y + 4, p.w - 6, p.h - 4)) return -1e6;
        const body = { x: p.x + 3, y: p.y + 3, w: p.w - 6, h: p.h - 4 };
        if (P().invul - t <= 0.02 && hitByThreat(th, body, t)) return -10000 + t * 8000;
        if (target && i % 3 === 0 && !hitBonus) {
          const ab = p.attackBox();
          if (ab) {
            const te = target.e;
            const tb = { x: te.x + target.vx * t, y: te.y + target.vy * t, w: te.w, h: te.h };
            if (ov(ab, tb)) hitBonus = pl.ad === 'down' ? 140 : 110;
          }
        }
      }
      score += hitBonus;
      if (!hitBonus && pl.atk < FH) score -= 16;
      if (pl.j < FH) score -= 12;
      if (pl.dj < FH) score -= 4;
      if (target) {
        const te = target.e;
        const gap = Math.max(0, Math.abs(te.x + te.w / 2 + target.vx * FH - p.cx) - te.w / 2);
        const want = wantFar ? 170 : 40;
        score -= Math.abs(gap - want) * (wantFar ? 0.4 : 0.25);
        // 끝 상태의 안전 여유: 적 판정과의 거리
        for (const o of th.en) for (const b of o.boxes) {
          const bx = b.x + o.vx * FH, cxb = bx + b.w / 2;
          const dd = Math.abs(cxb - p.cx) - b.w / 2;
          if (dd < 30 && Math.abs(b.y + b.h / 2 - p.cy) < b.h / 2 + 40) score -= (30 - dd) * 2;
        }
      }
      for (const o of th.en) if (o.e.kind === 'keeper' && o.e.st === 'lwind' && Math.abs(p.cx - P().cx) < 110) score -= 160;
      // 착지 예정 등불 근처에 머무르지 않기
      for (const q of th.pr) if (q.type === 'lantern' && q._land && Math.abs(p.cx - q._land.x) < 80) score -= 250;
      // 반쪽 바닥 화염: 예고 중이면 반대편으로 미리 피하기
      for (const q of th.pr) {
        if (q.type === 'halfline' && q.ex && q.t < q.ex.warn + 0.35 && p.cx > q.ex.l - 10 && p.cx < q.ex.r + 10) score -= 1500 * (1 - Math.max(0, q.ex.warn - q.t) / 1.6);
        if (q.type === 'rockwarn' && Math.abs(p.cx - q.x) < 34) score -= 300;
      }
      // 벽에 몰리지 않게
      const room = g.currentRoom;
      if (room) {
        const edge = Math.min(p.cx - room.px, room.px + room.pw - p.cx);
        if (edge < 90) score -= (90 - edge) * 0.6;
      }
      return score;
    });
  }
  const FS = { pl: null, t: 0, re: 0 };
  function fightMPC(target, dt) {
    const pl = P();
    FS.re -= dt;
    if (!FS.pl || FS.re <= 0) {
      const th = threatsNow();
      const tg = th.en.find((o) => o.e === target) || null;
      const dir = Math.sign(ecx(target) - pl.cx) || pl.facing;
      const wantFar = DANGER.test(target.st) || target.st === 'idle' && false;
      let best = null;
      const cands = fightPlans(dir, g.abilities);
      if (FS.pl && FS.t < FH - 0.1) {
        // 진행 중인 계획을 이어서 (시간 이동)
        const c = Object.assign({}, FS.pl);
        for (const k of ['j', 'd', 'atk', 'dj']) c[k] = c[k] - FS.t;
        if (c.j < 0 && c.j + c.jh > 0) { c.jh = c.j + c.jh; c.j = 0; }
        c.cont = true;
        cands.push(c);
      }
      const prevMv = FS.pl ? FS.pl.mv : 0;
      for (const c of cands) {
        if (c.j < 0 && c.j > -50) c.j = 99;
        let s = evalFight(c, th, tg, wantFar) + Math.random() * 2;
        if (s > -5000) {
          if (c.cont) s += c.mv ? 30 : 8;
          else if (prevMv && c.mv && c.mv !== prevMv) s -= 22;
          if (!c.mv && !(c.atk < FH)) s -= 14; // 가만히 서 있기만 하는 건 감점
          else if (!c.mv) s -= 4;
        }
        if (!best || s > best.s) best = { s, c };
      }
      FS.pl = best.c;
      FS.t = 0;
      FS.re = 0.1;
      R.fightScore = best.s;
    }
    const h = planKeys(FS.pl, FS.t, pl);
    FS.t += dt;
    // 포고 슬로모션
    if (pl.vy < -560 && fb.prevVy >= -560 && !pl.grounded) {
      fb.pogos++;
      if (fb.pogos === 2) slowmo('pogo', 0.75);
    }
    fb.prevVy = pl.vy;
    return h;
  }
  // ── 매 스텝 결정 ──
  function decide(dt) {
    const pl = P();
    const room = g.currentRoom && g.currentRoom.id;
    if (g.paused || g.ended) return {};
    // 고치/리스폰 대기
    if (pl.downed || pl.hazardT > 0) { R.ex = null; if (pl.downed) R.lost = true; return {}; }
    // 보스 전투
    const boss = g.sim.enemies.find((e) => e.room === room && e.maxHp > 100 && !e.dead && e.st !== 'intro');
    const bossIntro = g.sim.enemies.find((e) => e.room === room && e.maxHp > 100 && e.st === 'intro');
    if (bossIntro) return {};
    if (boss) {
      R.mode = 'boss';
      return heal(pl, true) || fightMPC(boss, dt);
    }
    if (R.mode === 'boss') R.mode = 'route';
    const L = legs[R.leg];
    if (!L) { R.done = true; return {}; }
    if (R.detour && (R.cur >= L.path.length - 6 || (Math.abs(P().cx - L.goal[0]) < 40 && Math.abs(P().y + P().h - L.goal[1]) < 30))) {
      // 다음 구간으로 이어서 (목표 구간에 닿으면 우회 종료)
      R.leg++;
      R.cur = 0;
      R.ex = null;
      if (R.leg >= R.detour.leg) { R.leg = R.detour.leg; R.detour = null; }
      return {};
    }
    // 구간 목표 도달
    const [gx, gy] = L.goal;
    if (Math.abs(pl.cx - gx) < 26 && Math.abs(pl.y + pl.h - gy) < 20) {
      if (L.then === 'shrine') {
        if (g.abilities[L.shrineAb]) nextLeg();
        return {};
      }
      if (L.then === 'boss') {
        if (g.save.bosses[L.bossKind]) nextLeg();
        else return { [pl.facing > 0 ? 'right' : 'left']: false };
      }
    }
    if (!R.detour && L.then === 'boss' && g.save.bosses[L.bossKind]) { nextLeg(); return {}; }
    if (!R.detour && L.then === 'shrine' && g.abilities[L.shrineAb]) { nextLeg(); return {}; }
    // 벤치
    if (pl.sitting) {
      R.sitT = (R.sitT || 0) + dt;
      if (R.sitT > 0.35) { R.sitT = 0; return { right: true }; }
      return {};
    }
    for (const b of L.benches) {
      if (R.satAt === b || pl.hp >= pl.maxHp) continue;
      if (Math.abs(b.x - pl.cx) < 34 && Math.abs(b.y - (pl.y + pl.h)) < 16 && pl.grounded) {
        R.satAt = b;
        R.ex = null;
        return { up: true };
      }
    }
    const hh = heal(pl, false);
    if (hh) return hh;
    // 보스 직전: 불씨가 있으면 체력 채우기
    if (L.then === 'boss' && R.cur > legPath().length * 0.85 && pl.hp < pl.maxHp && pl.ember >= 33 && pl.grounded) {
      const busy = g.sim.list().some((e) => e.room === room && Math.hypot(ecx(e) - pl.cx, ecy(e) - pl.cy) < 240);
      if (!busy) return { heal: true };
    }
    // 진행도 갱신
    const k = reachIdx(pl, R.cur, 60);
    if (k > R.cur) { R.cur = k; R.stuckT = 0; }
    R.stuckT += dt;
    if (R.stuckT > 3 || R.lost) {
      // 막힘/리스폰: 모든 구간에서 가장 가까운 점을 찾아 그 구간의 경로를 임시로 따라감
      let bl = R.leg, bi = R.cur, bd = 1e9;
      for (let li = 0; li <= R.leg; li++) {
        const path = legs[li].path;
        for (let i = 0; i < path.length; i++) {
          const d = Math.hypot(path[i][0] - pl.cx, path[i][1] - (pl.y + pl.h));
          if (d < bd - 40 || (li === R.leg && d < bd + 40)) { bd = Math.min(bd, d); bl = li; bi = i; }
        }
      }
      if (bl !== R.leg) {
        // 이전 구간 경로 끝까지 간 뒤 현재 구간으로 복귀
        R.detour = { leg: R.leg };
        R.leg = bl;
      }
      R.cur = Math.max(0, bi - 2);
      R.stuckT = 0;
      R.lost = false;
      R.ex = null;
    }
    R.replanT -= dt;
    if (!R.ex || R.replanT <= 0) {
      replan();
      R.replanT = 0.1;
    }
    const h = execStep(R.ex, pl);
    // 길을 막는 잡몹은 지나가며 베기
    for (const e of g.sim.list()) {
      if (e.room !== room || e.maxHp > 100) continue;
      const dx = ecx(e) - pl.cx, dy = ecy(e) - pl.cy;
      if (Math.abs(dx) < 68 && Math.abs(dy) < 42 && pl.atkCD <= 0) {
        if (Math.sign(dx) === pl.facing || Math.abs(dx) < 20) {
          if (dy > 30 && !pl.grounded) h.down = true;
          else if (dy < -35) h.up = true;
          h.attack = !held.attack;
        }
        break;
      }
    }
    return h;
  }
  function heal(pl, inBoss) {
    if (pl.hp >= pl.maxHp || pl.ember < 33 || !pl.grounded) { R.healing = 0; return null; }
    if (pl.hp > (inBoss ? 2 : 3) && !R.healing) return null;
    const room = g.currentRoom && g.currentRoom.id;
    for (const e of g.sim.list()) {
      if (e.room !== room) continue;
      const d = Math.hypot(ecx(e) - pl.cx, ecy(e) - pl.cy);
      // 보스가 쉬는 중(빈틈)이면 조금 더 가까워도 회복
      const calm = e.maxHp > 100 && /rest|phase|roar|stun/.test(e.st);
      const need = e.maxHp > 100 ? (calm ? 170 : 300) : 220;
      if (d < need) { R.healing = 0; return null; }
    }
    for (const q of g.sim.plist()) if (q.type !== 'fire' && Math.hypot(q.x - pl.cx, q.y - pl.cy) < 220) return null;
    // 회복 중에 맞을 위험 예측: 지금 자리에 0.9초 서 있을 때 판정에 걸리면 포기
    const th = threatsNow();
    const box = { x: pl.x + 3, y: pl.y + 3, w: pl.w - 6, h: pl.h - 4 };
    for (let t = 0; t < 0.9; t += 0.05) if (hitByThreat(th, box, t)) { R.healing = 0; return null; }
    R.healing = 1;
    return { heal: true };
  }
  function nextLeg() {
    R.leg++;
    R.cur = 0;
    R.ex = null;
    R.stuckT = 0;
    R.log.push({ t: R.t, leg: R.leg });
    if (R.leg >= legs.length) R.done = true;
  }

  // ── 한 프레임 진행 (영상 프레임 dt) ──
  const STEP = 1 / 120;
  let acc = 0;
  R.frame = (vdt) => {
    R.t += vdt;
    let gdt = vdt;
    if (R.slow > 0) {
      gdt = vdt * 0.35;
      R.slow -= gdt;
    }
    if (R.caption) {
      R.caption.t += vdt;
      if (R.caption.t > 3.2) R.caption = null;
    }
    __fx.updateScreen(gdt);
    acc += gdt * __fx.timeScale(gdt);
    window.__simRng = true;
    while (acc >= STEP) {
      const h = decide(STEP);
      apply(h);
      inp.update();
      g.step(STEP);
      acc -= STEP;
    }
    window.__simRng = false;
    if (!R.fast) {
      // 렌더링이 쓰는 난수는 시뮬레이션에 영향을 주지 않도록 되돌림
      const rs = window.__rng ? __rng.get() : 0;
      g.render(gdt);
      if (window.__rng) __rng.set(rs);
    }
    if (P().downed && !R._dn) { R._dn = 1; R.deaths++; } else if (!P().downed) R._dn = 0;
  };
})();
