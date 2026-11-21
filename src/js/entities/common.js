// 적/보스 공용 헬퍼
export const GRAV = 2400;

export function go(e, st) {
  e.st = st;
  e.t = 0;
}

export function groundPhys(e, S, dt, opts = {}) {
  e.vy = Math.min(e.vy + GRAV * dt, 1100);
  const res = S.world.moveBody(e, e.vx * dt, e.vy * dt);
  if (res.hitY) e.vy = 0;
  e.grounded = res.hitY > 0 || S.world.grounded(e);
  if (e.grounded && e.vy > 0) e.vy = 0;
  return res;
}

export function flyPhys(e, S, dt) {
  return S.world.moveBody(e, e.vx * dt, e.vy * dt);
}

// 앞에 낭떠러지/벽이 있으면 true
export function blockedAhead(e, S) {
  const W = S.world;
  const ax = e.facing > 0 ? e.x + e.w + 2 : e.x - 2;
  const wall = W.solidAt(ax, e.y + e.h * 0.5) || W.solidAt(ax, e.y + 4);
  const groundAhead = W.solidAt(ax, e.y + e.h + 6) || isPlatAt(W, ax, e.y + e.h + 6);
  return wall || !groundAhead;
}
function isPlatAt(W, x, y) {
  return W.get(Math.floor(x / 32), Math.floor(y / 32)) === 2;
}

export const cx = (e) => e.x + e.w / 2;
export const cy = (e) => e.y + e.h / 2;

export function rectFront(e, dist, w, h, yoff = 0) {
  const x = e.facing > 0 ? e.x + e.w + dist : e.x - dist - w;
  return { x, y: e.y + e.h / 2 - h / 2 + yoff, w, h };
}
