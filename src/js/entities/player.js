// 로컬 플레이어: 조작감(가변 점프, 코요테 타임, 입력 버퍼, 대시, 벽 점프, 이단 점프, 포고)
import { TILE, clamp, rand } from '../core/util.js';
import { audio } from '../core/audio.js';
import { fx } from '../render/fx.js';
import { profile, looks } from '../core/settings.js';
import { slashRGB } from '../render/drawPlayer.js';
import { isSolidT, T_SPIKE } from '../world/tiles.js';

export const PH = {
  RUN: 330,
  G: 2750,
  MAX_FALL: 980,
  JUMP_V: 590,
  JUMP_HOLD: 0.21,
  JUMP_MIN: 0.045,
  DJ_V: 560,
  DJ_HOLD: 0.14,
  CUT_MUL: 0.3,
  COYOTE: 0.09,
  BUFFER: 0.13,
  DASH_V: 850,
  DASH_T: 0.19,
  DASH_CD: 0.42,
  WALL_SLIDE: 230,
  WJ_LOCK: 0.15,
  POGO_V: 640,
  ATK_CD: 0.36,
  ATK_ACTIVE: 0.1,
  FOCUS_T: 0.85,
  EMBER_MAX: 99,
  EMBER_COST: 33,
  EMBER_HIT: 11,
};

export class Player {
  constructor(x, y) {
    this.w = 20;
    this.h = 38;
    this.reset(x, y);
    Object.assign(this, looks());
  }

  reset(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = this.vy = 0;
    this.facing = 1;
    this.anim = 'idle';
    this.animT = 0;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumpHold = 0;
    this.jumping = false;
    this.djUsed = false;
    this.airDash = true;
    this.dashT = 0;
    this.dashCD = 0;
    this.atkBuf = 0;
    this.dashBuf = 0;
    this.jumpT = 0;
    this.atkCD = 0;
    this.atkT = 0;
    this.atkDir = 'side';
    this.atkHit = new Set();
    this.atkId = 0;
    this.recoilT = 0;
    this.wjLock = 0;
    this.wallDir = 0;
    this.wallGrace = 0;
    this.invul = 0;
    this.hurtT = 0;
    this.flash = 0;
    this.focusT = 0;
    this.focusSnd = null;
    this.landT = 0;
    this.stepT = 0;
    this.dropT = 0;
    this.dead = false;
    this.downed = false;
    this.revive = 0;
    this.deadT = 0;
    this.sitting = false;
    this.hazardT = 0;
    this.lastSafe = { x: this.x, y: this.y };
    this.safeT = 0;
    this.maxHp = 5 + (profile.bonusMasks || 0);
    this.hp = this.maxHp;
    this.ember = 0;
    this.airT = 0;
    this.trail = [];
    this.hook = null;
    this.hookCD = 0;
    this.hookMiss = null;
    this.extVx = 0;
    this.hookBuf = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get nailDmg() { return 5 + 4 * (profile.nail || 0); }
  get busy() { return this.dead || this.downed || this.hazardT > 0; }

  attackBox() {
    if (this.atkT <= 0.16 - PH.ATK_ACTIVE) return null;
    const cx = this.cx, f = this.facing;
    if (this.atkDir === 'up') return { x: cx - 28, y: this.y - 62, w: 56, h: 72 };
    if (this.atkDir === 'down') return { x: cx - 26, y: this.y + this.h - 8, w: 52, h: 66 };
    return { x: f > 0 ? cx + 4 : cx - 4 - 74, y: this.cy - 26, w: 74, h: 46 };
  }

  update(dt, inp, g) {
    const W = g.world;
    const ab = g.abilities;
    this.animT += dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.atkT > 0) this.atkT -= dt;
    if (this.atkCD > 0) this.atkCD -= dt;
    if (this.dashCD > 0) this.dashCD -= dt;
    if (this.recoilT > 0) this.recoilT -= dt;
    if (this.wjLock > 0) this.wjLock -= dt;
    if (this.dropT > 0) this.dropT -= dt;
    if (this.wallGrace > 0) this.wallGrace -= dt;

    // 사망/고치 상태
    if (this.dead) {
      this.deadT += dt;
      this.anim = 'dead';
      this.vy = Math.min(this.vy + PH.G * dt, PH.MAX_FALL);
      W.moveBody(this, this.vx * dt, this.vy * dt);
      this.vx *= 0.9;
      return;
    }
    if (this.downed) {
      this.anim = 'cocoon';
      this.vy = Math.min(this.vy + PH.G * dt, PH.MAX_FALL);
      W.moveBody(this, 0, this.vy * dt);
      return;
    }
    // 위험지형 리스폰 연출 중
    if (this.hazardT > 0) {
      this.hazardT -= dt;
      if (this.hazardT <= 0.35 && !this.hazardMoved) {
        this.hazardMoved = true;
        this.x = this.lastSafe.x;
        this.y = this.lastSafe.y;
        this.vx = this.vy = 0;
      }
      return;
    }

    // 벤치에 앉아 있음
    if (this.sitting) {
      this.anim = 'sit';
      if (inp.pressed.left || inp.pressed.right || inp.pressed.jump || inp.pressed.down || inp.pressed.attack) {
        this.sitting = false;
        inp.consume('jump');
      }
      return;
    }

    const left = inp.held.left, right = inp.held.right;
    const dirX = (right ? 1 : 0) - (left ? 1 : 0);
    const control = this.hurtT <= 0;
    if (this.hurtT > 0) this.hurtT -= dt;

    // ── 불씨 사슬 ──
    if (this.hookCD > 0) this.hookCD -= dt;
    if (this.hookMiss) {
      this.hookMiss.t -= dt;
      if (this.hookMiss.t <= 0) this.hookMiss = null;
    }
    if (this.hook) {
      if (this._hookStep(dt, inp, g, dirX)) return;
    } else {
      // 입력 여유: 쿨다운 중에 누른 사슬도 곧바로 발사
      if (inp.pressed.hook) this.hookBuf = 0.15;
      else if (this.hookBuf > 0) this.hookBuf -= dt;
      if (control && this.hookBuf > 0 && inp.held.hook !== false && ab.hook && this.hookCD <= 0 && this.dashT <= 0) {
        this.hookBuf = 0;
        this._fireHook(inp, g, dirX);
      }
    }

    // 회복(집중)
    const canFocus = this.grounded && this.ember >= PH.EMBER_COST && (this.hp < this.maxHp || g.allyNeedsHeal(this)) && this.atkT <= 0 && this.dashT <= 0;
    if (control && inp.held.heal && canFocus && dirX === 0) {
      if (this.focusT === 0) this.focusSnd = audio.play('focus');
      this.focusT += dt;
      this.vx = 0;
      if (Math.random() < 0.5) {
        const a = rand(0, 6.28);
        fx.add({ kind: 'glow', x: this.cx + Math.cos(a) * 40, y: this.cy + Math.sin(a) * 40, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90, life: 0.4, size: 2, color: '#ffc27a', grav: 0, drag: 0, add: true });
      }
      if (this.focusT >= PH.FOCUS_T) {
        this.ember -= PH.EMBER_COST;
        if (this.hp < this.maxHp) this.hp++;
        else g.healAlly(this);
        this.focusT = 0.0001;
        if (this.focusSnd) this.focusSnd.stop();
        this.focusSnd = audio.play('focus');
        audio.play('heal');
        fx.burst(this.cx, this.cy, 18, { kind: 'glow', color: '#ffd58a', smin: 60, smax: 220, grav: -100, add: true, szmin: 2, szmax: 4 });
        fx.ring(this.cx, this.cy, 10, 70, 0.4, '255,210,140', 3);
        g.onHeal(this);
      }
      this.anim = 'focus';
      this._physics(dt, W, 0);
      return;
    } else if (this.focusT > 0) {
      this.focusT = 0;
      if (this.focusSnd) {
        this.focusSnd.stop();
        this.focusSnd = null;
      }
    }

    // 점프 버퍼
    if (inp.pressed.jump) this.jumpBuf = PH.BUFFER;
    else if (this.jumpBuf > 0) this.jumpBuf -= dt;

    // 벽 감지
    let touchWall = 0;
    if (ab.wall && !this.grounded) {
      if (W.rectSolid(this.x - 3, this.y + 6, 3, this.h - 14)) touchWall = -1;
      else if (W.rectSolid(this.x + this.w, this.y + 6, 3, this.h - 14)) touchWall = 1;
    }
    const sliding = touchWall !== 0 && dirX === touchWall && this.vy > -60 && this.dashT <= 0 && control;
    if (sliding) {
      this.wallDir = touchWall;
      this.wallGrace = 0.1;
      this.airDash = true;
      this.djUsed = false;
    }

    // 대시 (입력 버퍼)
    if (inp.pressed.dash && (this.dashCD > 0 || !(this.grounded || this.airDash))) this.dashBuf = 0.1;
    else if (this.dashBuf > 0) this.dashBuf -= dt;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.facing * PH.DASH_V;
      this.vy = 0;
      if (Math.random() < 0.8) fx.add({ kind: 'dust', x: this.cx - this.facing * 10, y: this.cy + rand(-10, 10), vx: -this.facing * 60, vy: rand(-20, 20), life: 0.35, size: 5, color: '#cfd8d6', grav: 0, drag: 3 });
      this.trail.push({ x: this.x, y: this.y, t: 0.18, f: this.facing });
      if (this.dashT <= 0) this.vx = this.facing * PH.RUN;
    } else if (control && (inp.pressed.dash || this.dashBuf > 0) && ab.dash && this.dashCD <= 0 && (this.grounded || this.airDash || sliding)) {
      this.dashBuf = 0;
      if (sliding) this.facing = -touchWall;
      else if (dirX) this.facing = dirX;
      this.dashT = PH.DASH_T;
      this.dashCD = PH.DASH_CD;
      if (!this.grounded && !sliding) this.airDash = false;
      this.vy = 0;
      this.jumping = false;
      audio.play('dash');
      fx.burst(this.cx - this.facing * 10, this.cy, 8, { kind: 'dust', color: '#d9e2df', dir: this.facing > 0 ? Math.PI : 0, spread: 0.5, smin: 80, smax: 200, grav: 0 });
    }

    // 좌우 이동 (즉각 반응)
    if (this.dashT <= 0) {
      if (this.recoilT > 0) {
        // 반동 유지
      } else if (this.wjLock > 0) {
        // 벽 점프 직후 잠시 방향 고정
      } else if (control) {
        this.vx = dirX * PH.RUN;
        if (dirX) this.facing = dirX;
      } else {
        this.vx *= 0.92;
      }
    }

    // 점프
    if (control && this.jumpBuf > 0 && this.dashT <= 0) {
      if (inp.held.down && this.grounded && W.onPlatformOnly(this)) {
        this.dropT = 0.22;
        this.jumpBuf = 0;
        this.y += 2;
      } else if (this.grounded || this.coyote > 0) {
        this._jump(PH.JUMP_V, PH.JUMP_HOLD);
        audio.play('jump');
        fx.burst(this.cx, this.y + this.h, 5, { kind: 'dust', color: '#cfd8d6', dir: -Math.PI / 2, spread: 1.2, smin: 30, smax: 90, grav: 0 });
      } else if (ab.wall && (sliding || this.wallGrace > 0 || touchWall)) {
        const wd = touchWall || this.wallDir;
        this._jump(PH.JUMP_V * 0.95, PH.JUMP_HOLD * 0.75);
        this.vx = -wd * PH.RUN * 1.15;
        this.facing = -wd;
        this.wjLock = PH.WJ_LOCK;
        this.wallGrace = 0;
        audio.play('walljump');
        fx.burst(this.cx + wd * 10, this.cy, 6, { kind: 'dust', color: '#cfd8d6', dir: wd > 0 ? Math.PI : 0, spread: 0.7, smin: 60, smax: 160, grav: 0 });
      } else if (ab.djump && !this.djUsed) {
        this.djUsed = true;
        this._jump(PH.DJ_V, PH.DJ_HOLD);
        audio.play('djump');
        // 날개짓 파티클
        for (const s of [-1, 1]) fx.burst(this.cx + s * 8, this.y + this.h - 6, 6, { kind: 'shard', color: '#efe8d8', dir: Math.PI / 2 + s * 0.8, spread: 0.4, smin: 80, smax: 180, grav: 200, szmin: 3, szmax: 5 });
        fx.ring(this.cx, this.y + this.h, 4, 34, 0.25, '230,225,210', 2);
      }
    }
    // 가변 점프: 누르고 있는 동안 상승 속도 유지
    if (this.jumping) {
      // 누른 시간에 비례: 최소 시간은 보장, 떼면 상승 속도를 비율로 줄여 부드럽게 끊음
      this.jumpT += dt;
      if ((inp.held.jump || this.jumpT < PH.JUMP_MIN) && this.jumpHold > 0) {
        this.jumpHold -= dt;
        this.vy = -this.jumpV;
      } else {
        if (!inp.held.jump && this.vy < 0) this.vy *= PH.CUT_MUL;
        this.jumping = false;
      }
    }

    // 공격
    if (inp.pressed.attack) this.atkBuf = 0.14;
    else if (this.atkBuf > 0) this.atkBuf -= dt;
    if (control && this.atkBuf > 0 && this.atkCD <= 0 && this.dashT <= 0) {
      this.atkBuf = 0;
      let d = 'side';
      if (inp.held.up) d = 'up';
      else if (inp.held.down && !this.grounded) d = 'down';
      this.atkDir = d;
      this.atkT = 0.16;
      this.atkCD = PH.ATK_CD;
      this.atkHit.clear();
      this.atkId++;
      audio.play('slash');
      const cx = this.cx, cy = this.cy;
      const sc = slashRGB(this.slashC);
      if (d === 'up') fx.slash(cx, this.y - 6, 'up', this.facing, sc);
      else if (d === 'down') fx.slash(cx, this.y + this.h + 8, 'down', this.facing, sc);
      else fx.slash(cx + this.facing * 34, cy - 2, 'side', this.facing, sc);
      g.onSlash(this);
    }

    // 중력 + 벽 미끄러짐
    this._physics(dt, W, sliding ? PH.WALL_SLIDE : PH.MAX_FALL);

    // 애니메이션 결정
    if (this.hurtT > 0) this.anim = 'hurt';
    else if (this.dashT > 0) this.anim = 'dash';
    else if (sliding && this.vy > 0) {
      this.anim = 'wall';
      this.facing = -touchWall;
      if (Math.random() < 0.3) fx.add({ kind: 'dust', x: this.cx + touchWall * 10, y: this.y + 8, vx: 0, vy: -30, life: 0.3, size: 3, color: '#cfd8d6', grav: 0, drag: 2 });
    } else if (!this.grounded) this.anim = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 10) this.anim = 'run';
    else this.anim = 'idle';

    // 발소리
    if (this.anim === 'run') {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.27;
        audio.play('step');
      }
    }
    // 대시 잔상
    for (const t of this.trail) t.t -= dt;
    while (this.trail.length && this.trail[0].t <= 0) this.trail.shift();

    // 안전 지점 기록 (위험지형 리스폰용)
    if (this.grounded && !W.onPlatformOnly(this) && this.hurtT <= 0) {
      const b = { x: this.x - TILE, y: this.y, w: this.w + TILE * 2, h: this.h + 4 };
      if (!W.rectHazard(b.x, b.y, b.w, b.h)) {
        this.safeT += dt;
        if (this.safeT > 0.12) this.lastSafe = { x: this.x, y: this.y };
      } else this.safeT = 0;
    } else this.safeT = 0;
  }

  // 사슬 발사: 조준 방향으로 고리 > 적 > 벽 순서로 목표 선택
  hookAim(inp, g, dirX) {
    const ox = this.cx + this.facing * 4, oy = this.y + 12;
    let ax, ay;
    const m = inp.hookMouse && g.mouseWorld ? g.mouseWorld() : null;
    if (m) {
      ax = m.x - ox;
      ay = m.y - oy;
    } else {
      ax = dirX;
      ay = (inp.held.down ? 1 : 0) - (inp.held.up ? 1 : 0);
      if (!ax && !ay) {
        ax = this.facing;
        ay = -1;
      } else if (!ay) ay = -0.75;
    }
    const d = Math.hypot(ax, ay) || 1;
    return { ox, oy, ax: ax / d, ay: ay / d, wide: !m };
  }

  _fireHook(inp, g, dirX) {
    const a = this.hookAim(inp, g, dirX);
    const tg = findHookTarget(a.ox, a.oy, a.ax, a.ay, g, a.wide);
    this.hookCD = 0.18;
    audio.play('hookFire');
    if (!tg) {
      this.hookMiss = { x: a.ox + a.ax * 300, y: a.oy + a.ay * 300, t: 0.16 };
      return;
    }
    const dist = Math.hypot(tg.x - a.ox, tg.y - a.oy);
    this.hook = Object.assign({ phase: 'fly', t: 0, travel: Math.max(0.04, dist / 2600), len: dist }, tg);
  }

  _hookStep(dt, inp, g, dirX) {
    const H = this.hook;
    const W = g.world;
    H.t += dt;
    if (H.type === 'enemy') {
      const ep = g.enemyPos ? g.enemyPos(H.eid) : null;
      if (!ep) {
        this.hook = null;
        return false;
      }
      H.x = ep.x;
      H.y = ep.y;
    }
    const hx = this.cx, hy = this.y + 12;
    if (H.phase === 'fly') {
      if (H.t < H.travel) return false; // 사슬이 날아가는 동안은 평소처럼 움직임
      H.phase = H.type === 'enemy' ? 'pull' : 'swing';
      H.t = 0;
      H.len = Math.max(52, Math.hypot(H.x - hx, H.y - hy));
      this.airDash = true;
      this.djUsed = false;
      this.jumping = false;
      this.dashT = 0;
      audio.play('hookHit');
      fx.burst(H.x, H.y, 8, { kind: 'spark', color: '#ffd58a', smin: 150, smax: 380, grav: 0, add: true, lmin: 0.1, lmax: 0.25 });
    }
    if (H.phase === 'pull') {
      // 적에게 끌려가며 베기
      const dx = H.x - hx, dy = H.y - hy, d = Math.hypot(dx, dy) || 1;
      if (d < 36 || H.t > 0.45) {
        if (g.hookStrike) g.hookStrike(H.eid, this);
        this.hook = null;
        this.vy = -480;
        this.vx = -this.facing * 160;
        this.recoilT = 0.12;
        this.invul = Math.max(this.invul, 0.35);
        this.airDash = true;
        this.djUsed = false;
        return true;
      }
      this.vx = (dx / d) * 1050;
      this.vy = (dy / d) * 1050;
      if (Math.abs(dx) > 4) this.facing = Math.sign(dx);
      this.invul = Math.max(this.invul, 0.12);
      W.moveBody(this, this.vx * dt, this.vy * dt);
      this.grounded = false;
      this.anim = 'dash';
      this.trail.push({ x: this.x, y: this.y, t: 0.18, f: this.facing });
      return true;
    }
    // ── 매달리기 / 흔들기 ──
    if (!inp.held.hook) {
      this.hook = null;
      if (this.vy < 0) this.vy *= 1.1;
      this.hookCD = 0;
      return false;
    }
    if (inp.pressed.jump) {
      this.hook = null;
      this.vy = Math.min(this.vy - 120, -520);
      this.vx *= 1.05;
      this.jumpBuf = 0;
      this.jumping = false;
      this.djUsed = false;
      this.airDash = true;
      audio.play('jump');
      fx.burst(this.cx, this.y + this.h, 6, { kind: 'dust', color: '#ffd58a', smin: 60, smax: 160, grav: 0 });
      W.moveBody(this, this.vx * dt, this.vy * dt);
      return true;
    }
    H.len = Math.max(54, H.len - 330 * dt); // 감아올림
    this.vx += dirX * 1300 * dt;
    this.vy += PH.G * 0.85 * dt;
    this.vx *= 1 - 0.12 * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 1150) {
      this.vx *= 1150 / sp;
      this.vy *= 1150 / sp;
    }
    const res = W.moveBody(this, this.vx * dt, this.vy * dt);
    if (res.hitX) this.vx *= -0.15;
    if (res.hitY) this.vy = 0;
    // 줄 길이 제약
    const cx = this.cx, cy = this.y + 12;
    const dx = cx - H.x, dy = cy - H.y, d = Math.hypot(dx, dy) || 1;
    if (d > H.len) {
      const nx = dx / d, ny = dy / d;
      W.moveBody(this, H.x + nx * H.len - cx, H.y + ny * H.len - cy);
      const vr = this.vx * nx + this.vy * ny;
      if (vr > 0) {
        this.vx -= vr * nx;
        this.vy -= vr * ny;
      }
    }
    this.grounded = this.vy >= 0 && W.grounded(this);
    if (this.grounded) {
      this.airDash = true;
      this.djUsed = false;
    }
    if (Math.abs(this.vx) > 30) this.facing = Math.sign(this.vx);
    this.anim = 'swing';
    if (Math.random() < 0.25) fx.add({ kind: 'glow', x: H.x, y: H.y, vx: (Math.random() - 0.5) * 60, vy: 40, life: 0.4, size: 2, color: '#ffb347', grav: 200, drag: 1, add: true });
    return true;
  }

  _jump(v, hold) {
    this.vy = -v;
    this.jumpV = v;
    this.jumpHold = hold;
    this.jumpT = 0;
    this.jumping = true;
    this.jumpBuf = 0;
    this.coyote = 0;
    this.grounded = false;
  }

  _physics(dt, W, maxFall) {
    if (this.dashT <= 0) {
      if (!this.jumping) this.vy += PH.G * dt;
      if (this.vy > maxFall) this.vy = Math.max(maxFall, this.vy - PH.G * 3 * dt);
    }
    const wasGround = this.grounded;
    const fallV = this.vy;
    // 머리 모서리 보정: 천장 모서리에 살짝 걸리면 옆으로 밀어줌
    if (this.vy < 0) {
      const ny = this.y + this.vy * dt;
      if (W.rectSolid(this.x, ny, this.w, this.h)) {
        for (let d = 1; d <= 9; d++) {
          let done = false;
          for (const s of [1, -1]) {
            if (!W.rectSolid(this.x + s * d, ny, this.w, this.h) && !W.rectSolid(this.x + s * d, this.y, this.w, this.h)) {
              this.x += s * d;
              done = true;
              break;
            }
          }
          if (done) break;
        }
      }
    }
    // 턱 보정: 발끝이 턱에 아주 살짝 걸리면 올려줌
    if (this.vx !== 0 && !this.grounded) {
      const nx = this.x + this.vx * dt;
      if (W.rectSolid(nx, this.y, this.w, this.h)) {
        for (let up = 1; up <= 10; up++) {
          if (!W.rectSolid(nx, this.y - up, this.w, this.h) && !W.rectSolid(this.x, this.y - up, this.w, this.h)) {
            this.y -= up;
            if (this.vy > 0) this.vy = 0;
            break;
          }
        }
      }
    }
    if (this.extVx) {
      this.extVx *= Math.exp(-5 * dt);
      if (Math.abs(this.extVx) < 4) this.extVx = 0;
    }
    const res = W.moveBody(this, (this.vx + this.extVx) * dt, this.vy * dt, this.dropT > 0);
    if (res.hitY < 0) {
      this.vy = 0;
      this.jumping = false;
    }
    if (res.hitY > 0) this.vy = 0;
    this.grounded = this.vy >= 0 && W.grounded(this) && !(this.dropT > 0 && W.onPlatformOnly(this));
    if (this.grounded) {
      this.coyote = PH.COYOTE;
      this.djUsed = false;
      this.airDash = true;
      this.airT = 0;
      if (!wasGround && fallV > 200) {
        this.landT = 0.12;
        audio.play('land', { vol: clamp(fallV / 900, 0.3, 1) });
        fx.burst(this.cx, this.y + this.h, 6, { kind: 'dust', color: '#cfd8d6', dir: -Math.PI / 2, spread: 1.4, smin: 40, smax: 120, grav: 0 });
      }
    } else {
      this.airT += dt;
      if (this.coyote > 0) this.coyote -= dt;
    }
  }

  // 공격이 무언가를 맞혔을 때 반동
  onHitRecoil(kind) {
    if (this.atkDir === 'down') {
      if (kind === 'wall') return;
      this.vy = -PH.POGO_V;
      this.jumping = false;
      this.djUsed = false;
      this.airDash = true;
      this.dashT = 0;
    } else if (this.atkDir === 'side') {
      this.vx = -this.facing * (kind === 'wall' ? 160 : 240);
      this.recoilT = 0.085;
    } else if (this.atkDir === 'up' && this.vy < 0) {
      this.vy *= 0.5;
      this.jumping = false;
    }
  }

  gainEmber(n) {
    this.ember = Math.min(PH.EMBER_MAX, this.ember + n);
  }

  // 피격. true면 실제로 맞음
  hurt(dmg, srcX) {
    if (this.invul > 0 || this.dead || this.downed || this.hazardT > 0 || this.sitting) return false;
    this.hook = null;
    this.hp -= dmg;
    this.invul = 1.5;
    this.hurtT = 0.22;
    this.flash = 0.1;
    this.focusT = 0;
    if (this.focusSnd) {
      this.focusSnd.stop();
      this.focusSnd = null;
    }
    this.jumping = false;
    this.dashT = 0;
    const away = this.cx < srcX ? -1 : 1;
    this.vx = away * 300;
    this.vy = -420;
    this.recoilT = 0.2;
    audio.play('hurt');
    fx.hitstop(0.28);
    fx.grayscale(0.3);
    fx.shake(12, 0.4);
    fx.burst(this.cx, this.cy, 16, { kind: 'shard', color: '#11161a', smin: 150, smax: 420, grav: 900, szmin: 4, szmax: 9, lmin: 0.4, lmax: 0.9 });
    fx.burst(this.cx, this.cy, 10, { kind: 'spark', color: '#ffffff', smin: 300, smax: 700, grav: 0, add: true, lmin: 0.15, lmax: 0.3 });
    fx.ring(this.cx, this.cy, 10, 120, 0.35, '255,255,255', 5);
    if (this.hp <= 0) this.hp = 0;
    return true;
  }

  // 가시/독수 – 1 피해 후 마지막 안전 지점으로
  hazard(kind) {
    if (this.hazardT > 0 || this.dead || this.downed) return;
    // 무적 중이면 피해 없이 안전 지점으로만 이동
    if (this.invul <= 0) this.hurt(1, this.cx);
    else {
      fx.shake(6, 0.2);
      audio.play('hurt', { vol: 0.5 });
    }
    if (kind === 'liquid') {
      audio.play('splash');
      fx.burst(this.cx, this.y + this.h, 14, { kind: 'dot', color: '#6fe0c8', dir: -Math.PI / 2, spread: 0.8, smin: 150, smax: 380, add: true });
    }
    if (this.hp > 0) {
      this.hazardT = 0.75;
      this.hazardMoved = false;
      this.invul = 1.6;
    }
  }

  serialize(room) {
    return {
      x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10,
      vx: Math.round(this.vx), vy: Math.round(this.vy),
      f: this.facing, a: this.anim, at: Math.round(this.animT * 100) / 100,
      ad: this.atkDir, ak: Math.round(Math.max(0, this.atkT) * 1000) / 1000,
      hp: this.hp, mh: this.maxHp, inv: this.invul > 0 ? 1 : 0,
      rm: room, cl: this.cloak, mk: this.mask, an: this.antenna, ac: this.acc, sw: this.sword, sc: this.slashC, lc: this.lightC, rv: Math.round(this.revive * 100) / 100,
      hk: this.hook ? [Math.round(this.hook.x), Math.round(this.hook.y), this.hook.phase === 'fly' ? Math.round(Math.min(1, this.hook.t / this.hook.travel) * 100) / 100 : 1] : 0,
      dn: this.downed ? 1 : 0, hz: this.hazardT > 0 ? 1 : 0, em: this.ember,
    };
  }
}

// 사슬 목표 찾기: 조준 원뿔 안의 고리 → 적 → 조준선 위 벽 (가시 제외)
export function findHookTarget(ox, oy, ax, ay, g, wide = false) {
  // 마우스는 정밀 조준, 키보드·패드·터치는 넓은 자동 조준
  const cone = wide ? 1.05 : 0.6, econe = wide ? 0.75 : 0.42;
  const W = g.world;
  let best = null, bs = 1e9;
  for (const a of g.anchors || []) {
    const dx = a.x - ox, dy = a.y - oy, d = Math.hypot(dx, dy);
    if (d > 400 || d < 24) continue;
    const ang = Math.acos(clamp((dx * ax + dy * ay) / d, -1, 1));
    if (ang > cone) continue;
    if (!W.lineClear(ox, oy, a.x, a.y)) continue;
    const sc = ang * 320 + d * 0.25;
    if (sc < bs) {
      bs = sc;
      best = { type: 'anchor', x: a.x, y: a.y };
    }
  }
  if (g.hookEnemies)
    for (const e of g.hookEnemies()) {
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      const dx = ex - ox, dy = ey - oy, d = Math.hypot(dx, dy);
      if (d > 340 || d < 24) continue;
      const ang = Math.acos(clamp((dx * ax + dy * ay) / d, -1, 1));
      if (ang > econe) continue;
      if (!W.lineClear(ox, oy, ex, ey)) continue;
      const sc = ang * 320 + d * 0.25 + 30;
      if (sc < bs) {
        bs = sc;
        best = { type: 'enemy', eid: e.id, x: ex, y: ey };
      }
    }
  if (best) return best;
  for (let t = 18; t <= 330; t += 6) {
    const x = ox + ax * t, y = oy + ay * t;
    const tile = W.get(Math.floor(x / TILE), Math.floor(y / TILE));
    if (tile === T_SPIKE) return null;
    if (isSolidT(tile)) return { type: 'wall', x: ox + ax * (t - 5), y: oy + ay * (t - 5) };
  }
  return null;
}
