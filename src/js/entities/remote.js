// 원격 플레이어: 스냅샷 버퍼를 100ms 늦게 재생해 부드럽게 보간
const DELAY = 0.1;

export class RemotePlayer {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.buf = [];
    this.w = 20;
    this.h = 38;
    this.x = 0;
    this.y = 0;
    this.s = null;
    this.lastRecv = 0;
  }

  push(state, now) {
    this.buf.push({ t: now, s: state });
    if (this.buf.length > 30) this.buf.shift();
    this.lastRecv = now;
    if (!this.s) {
      this.s = Object.assign({}, state);
      this.x = state.x;
      this.y = state.y;
    }
  }

  update(now) {
    const rt = now - DELAY;
    const b = this.buf;
    if (!b.length) return;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > rt) i--;
    const A = b[Math.max(0, i - 1)], B = b[i];
    let k = 1;
    if (B.t !== A.t) k = Math.max(0, Math.min(1, (rt - A.t) / (B.t - A.t)));
    // 순간이동(리스폰 등)은 보간하지 않음
    const jump = Math.abs(B.s.x - A.s.x) > 200 || Math.abs(B.s.y - A.s.y) > 200;
    this.x = jump ? B.s.x : A.s.x + (B.s.x - A.s.x) * k;
    this.y = jump ? B.s.y : A.s.y + (B.s.y - A.s.y) * k;
    const s = k < 0.5 ? A.s : B.s;
    this.s = s;
    // 오래된 버퍼 정리
    while (b.length > 2 && b[1].t < rt - 0.5) b.shift();
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  // 그리기용 상태
  drawState(time) {
    const s = this.s || {};
    return {
      x: this.x, y: this.y, w: this.w, h: this.h,
      facing: s.f || 1, anim: s.a || 'idle', animT: (s.at || 0) + (s.a === 'run' ? time : 0),
      atkDir: s.ad, atkT: s.ak || 0, invul: s.inv ? 1 : 0, flash: 0,
      cloak: s.cl || 0, mask: s.mk || 0, antenna: s.an || 0, acc: s.ac || 0, sword: s.sw || 0, slashC: s.sc || 0, lightC: s.lc || 0, vx: s.vx || 0, revive: s.rv || 0, landT: 0,
    };
  }
}
