// 로컬 플레이어: 조작감(가변 점프, 코요테 타임, 입력 버퍼, 대시, 벽 점프, 이단 점프, 포고)
import { TILE, clamp, rand } from '../core/util.js';
import { audio } from '../core/audio.js';
import { fx } from '../render/fx.js';
import { profile } from '../core/settings.js';

export const PH = {
  RUN: 330,
  G: 2750,
  MAX_FALL: 980,
  JUMP_V: 630,
  JUMP_HOLD: 0.165,
  DJ_V: 580,
  DJ_HOLD: 0.12,
  CUT_V: 140,
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
    this.cloak = profile.cloak;
    this.mask = profile.mask;
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

    // 대시
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.facing * PH.DASH_V;
      this.vy = 0;
      if (Math.random() < 0.8) fx.add({ kind: 'dust', x: this.cx - this.facing * 10, y: this.cy + rand(-10, 10), vx: -this.facing * 60, vy: rand(-20, 20), life: 0.35, size: 5, color: '#cfd8d6', grav: 0, drag: 3 });
      this.trail.push({ x: this.x, y: this.y, t: 0.18, f: this.facing });
      if (this.dashT <= 0) this.vx = this.facing * PH.RUN;
    } else if (control && inp.pressed.dash && ab.dash && this.dashCD <= 0 && (this.grounded || this.airDash || sliding)) {
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
      if (inp.held.jump && this.jumpHold > 0) {
        this.jumpHold -= dt;
        this.vy = -this.jumpV;
      } else {
        if (!inp.held.jump && this.vy < -PH.CUT_V) this.vy = -PH.CUT_V;
        this.jumping = false;
      }
    }

    // 공격
    if (control && inp.pressed.attack && this.atkCD <= 0 && this.dashT <= 0) {
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
      if (d === 'up') fx.slash(cx, this.y - 6, 'up', this.facing);
      else if (d === 'down') fx.slash(cx, this.y + this.h + 8, 'down', this.facing);
      else fx.slash(cx + this.facing * 34, cy - 2, 'side', this.facing);
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

  _jump(v, hold) {
    this.vy = -v;
    this.jumpV = v;
    this.jumpHold = hold;
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
    const res = W.moveBody(this, this.vx * dt, this.vy * dt, this.dropT > 0);
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
    this.hp -= dmg;
    this.invul = 1.3;
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
      rm: room, cl: this.cloak, mk: this.mask, rv: Math.round(this.revive * 100) / 100,
      dn: this.downed ? 1 : 0, hz: this.hazardT > 0 ? 1 : 0, em: this.ember,
    };
  }
}
