// 부적(장신구) 빌드 시스템: 칸(비용) 안에서 조합. 벤치에서만 교체.
import { profile, saveProfile } from './settings.js';

export const CHARMS = [
  { id: 'ember', name: '불씨 그릇', cost: 1, icon: '◉', color: '#ffb347', desc: '적을 벨 때 얻는 불씨 +50%', from: '심지의 어미 처치' },
  { id: 'swiftfocus', name: '빠른 집중', cost: 2, icon: '✺', color: '#ffd58a', desc: '회복(집중) 시간 35% 단축', from: '등잔 상인' },
  { id: 'longwick', name: '긴 심지', cost: 2, icon: '⟋', color: '#e8e2d2', desc: '베기 범위 +25%', from: '재의 회랑 어딘가' },
  { id: 'swiftwing', name: '날랜 날개', cost: 1, icon: '❯', color: '#9fe8d8', desc: '이동 속도 +12%', from: '갈라진 낭떠러지 어딘가' },
  { id: 'shadedash', name: '그림자 대시', cost: 2, icon: '◐', color: '#b48bff', desc: '대시하는 동안 무적', from: '흰 날개 여왕 처치' },
  { id: 'ironchain', name: '강철 사슬', cost: 1, icon: '⛓', color: '#ffcf70', desc: '사슬 사거리 +20%, 끌려가 베기 피해 2배', from: '톱니 대장장이 처치' },
  { id: 'hardmask', name: '단단한 가면', cost: 2, icon: '⬭', color: '#ece7da', desc: '최대 체력 +1', from: '침수 회랑의 비밀 선반' },
  { id: 'thorns', name: '반격의 가시', cost: 1, icon: '✷', color: '#ff7a6a', desc: '맞으면 주변 적에게 가시 피해', from: '잠긴 종지기 처치' },
  { id: 'amberlure', name: '호박 자석', cost: 1, icon: '◆', color: '#ffb347', desc: '호박석을 멀리서 끌어오고 획득량 +20%', from: '등잔 상인' },
  { id: 'fury', name: '맹렬한 검', cost: 2, icon: '⚔', color: '#ff9a5a', desc: '베기 피해 +3', from: '마지막 등불지기 처치' },
  { id: 'deepfocus', name: '깊은 집중', cost: 3, icon: '❂', color: '#ffe2a8', desc: '회복이 느려지는 대신 가면 2개 회복', from: '바람 탑 어딘가' },
  { id: 'wisp', name: '떠도는 불씨', cost: 3, icon: '✧', color: '#ff8a5a', desc: '주위를 도는 작은 불씨가 적을 공격', from: '주홍 광대 처치' },
  { id: 'ashcrown', name: '재의 왕관', cost: 2, icon: '♛', color: '#ff7a3a', desc: '회복을 마치면 주변 적에게 불길 피해', from: '재를 삼킨 자 처치' },
  { id: 'frostheart', name: '서리 심장', cost: 2, icon: '❄', color: '#bfe6ff', desc: '내려찍기 피해 2배 · 충격파 범위 +40%', from: '눈뿔 사슴 처치' },
  { id: 'icemirror', name: '얼음 갑주', cost: 1, icon: '◇', color: '#dff4ff', desc: '피격 후 무적 시간 +50%', from: '서리 여제 처치' },
  { id: 'galecloak', name: '눈보라 망토', cost: 2, icon: '≋', color: '#e8eef8', desc: '대시 거리 +35%', from: '눈보라 군주 처치' },
  { id: 'shadowveil', name: '그림자 장막', cost: 1, icon: '☾', color: '#b48bff', desc: '체력이 1칸일 때 베기 피해 +6', from: '그림자 나방 처치' },
];
export const CHARM_BY_ID = Object.fromEntries(CHARMS.map((c) => [c.id, c]));
export const BOSS_CHARM = { mother: 'ember', bell: 'thorns', keeper: 'fury', scarlet: 'wisp', smith: 'ironchain', queen: 'shadedash', devourer: 'ashcrown', stag: 'frostheart', empress: 'icemirror', blizzard: 'galecloak', shademoth: 'shadowveil' };

export const charmState = { disabled: false }; // PvP 등에서 모든 부적 효과 끔

export function ensureCharms() {
  if (!Array.isArray(profile.charms)) profile.charms = [];
  if (!Array.isArray(profile.equip)) profile.equip = [];
  if (!profile.notches) profile.notches = 3;
}
export function hasCharm(id) {
  if (charmState.disabled) return false;
  return Array.isArray(profile.equip) && profile.equip.includes(id);
}
export function usedNotches() {
  ensureCharms();
  return profile.equip.reduce((s, id) => s + (CHARM_BY_ID[id] ? CHARM_BY_ID[id].cost : 0), 0);
}
export function grantCharm(id) {
  ensureCharms();
  if (!CHARM_BY_ID[id] || profile.charms.includes(id)) return false;
  profile.charms.push(id);
  saveProfile();
  return true;
}
export function toggleEquip(id) {
  ensureCharms();
  const i = profile.equip.indexOf(id);
  if (i >= 0) profile.equip.splice(i, 1);
  else {
    if (!profile.charms.includes(id)) return 'locked';
    if (usedNotches() + CHARM_BY_ID[id].cost > profile.notches) return 'full';
    profile.equip.push(id);
  }
  saveProfile();
  return 'ok';
}
