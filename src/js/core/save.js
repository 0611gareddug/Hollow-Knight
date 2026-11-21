// 방장 기준 월드 진행 저장
import { lsGet, lsSet } from './util.js';

const KEY = 'lf_world_v1';

export function newWorldSave() {
  return {
    abilities: { dash: false, wall: false, djump: false },
    bosses: {}, // kind -> true
    broken: {}, // breakable id -> true
    explored: {}, // room id -> true
    bench: null, // {room, x, y}
    playTime: 0,
    cleared: false,
  };
}

export function loadWorld() {
  const s = lsGet(KEY, null);
  if (!s) return null;
  return Object.assign(newWorldSave(), s);
}
export function saveWorld(s) {
  lsSet(KEY, s);
}
export function hasWorldSave() {
  return !!lsGet(KEY, null);
}
export function clearWorld() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}
