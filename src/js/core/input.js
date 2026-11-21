// 키보드 / 게임패드 / 터치를 하나의 액션 입력으로 통합
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'heal', 'map', 'pause'];

import { settings, saveSettings } from './settings.js';

// 기본 키 배치 (동작마다 주 키 + 보조 키)
export const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'],
  attack: ['KeyX', 'KeyJ'],
  dash: ['KeyC', 'ShiftLeft'],
  heal: ['KeyV', 'KeyF'],
  map: ['Tab', 'KeyM'],
  pause: ['Escape', 'KeyP'],
};

// 코드 → 동작 목록 (같은 키가 여러 동작에 묶일 수 있음)
let KEYMAP = {};
export function rebuildKeymap() {
  const k = settings.keys || {};
  KEYMAP = {};
  for (const a of ACTIONS) {
    const list = Array.isArray(k[a]) ? k[a] : DEFAULT_KEYS[a];
    for (const code of list) if (code) (KEYMAP[code] = KEYMAP[code] || []).push(a);
  }
  // Esc는 항상 일시정지 (키 설정으로 잠기지 않도록)
  if (!KEYMAP.Escape) KEYMAP.Escape = ['pause'];
}
export function getKeys(a) {
  const k = settings.keys && settings.keys[a];
  return Array.isArray(k) ? k.slice(0, 2).concat([null, null]).slice(0, 2) : DEFAULT_KEYS[a].slice();
}
export function setKey(a, slot, code) {
  if (!settings.keys) settings.keys = {};
  for (const b of ACTIONS) if (!settings.keys[b]) settings.keys[b] = getKeys(b);
  settings.keys[a][slot] = code;
  saveSettings();
  rebuildKeymap();
}
export function resetKeys() {
  settings.keys = null;
  saveSettings();
  rebuildKeymap();
}
rebuildKeymap();

class Input {
  constructor() {
    this.held = {};
    this.pressed = {};
    this.released = {};
    this.prev = {};
    this.keys = {};
    this.kbPress = {};
    this.virtual = {};
    this.virtualPress = {};
    this.padIndex = -1;
    this.lastDevice = null;
    this.enabled = true;
    this.counting = false;
    this.resetCounts();
    for (const a of ACTIONS) {
      this.held[a] = this.pressed[a] = this.released[a] = this.prev[a] = false;
    }
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (this.capture) {
        e.preventDefault();
        e.stopPropagation();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const acts = KEYMAP[e.code];
      if (acts) {
        e.preventDefault();
        if (!this.keys[e.code]) for (const a of acts) this.kbPress[a] = true;
        this.keys[e.code] = true;
        this.lastDevice = 'kb';
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.virtual = {};
    });
    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
    });
  }

  setVirtual(action, on) {
    if (on && !this.virtual[action]) this.virtualPress[action] = true;
    this.virtual[action] = on;
    if (on) this.lastDevice = 'touch';
  }

  update() {
    const now = {};
    for (const a of ACTIONS) now[a] = false;
    for (const code in this.keys) if (this.keys[code] && KEYMAP[code]) for (const a of KEYMAP[code]) now[a] = true;
    for (const a in this.virtual) if (this.virtual[a]) now[a] = true;

    // 게임패드
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    if (pads) {
      if (this.padIndex >= 0) pad = pads[this.padIndex];
      if (!pad) for (const p of pads) if (p) { pad = p; this.padIndex = p.index; break; }
    }
    if (pad && pad.connected) {
      const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      const padNow = {
        left: b(14) || ax < -0.45,
        right: b(15) || ax > 0.45,
        up: b(12) || ay < -0.55,
        down: b(13) || ay > 0.55,
        jump: b(0),
        attack: b(2),
        dash: b(1) || b(5) || b(7),
        heal: b(3) || b(4) || b(6),
        map: b(8),
        pause: b(9),
      };
      let any = false;
      for (const a of ACTIONS) if (padNow[a]) { now[a] = true; any = true; }
      if (any) this.lastDevice = 'pad';
    }

    for (const a of ACTIONS) {
      const p = this.kbPress[a] || this.virtualPress[a];
      this.pressed[a] = this.enabled && ((now[a] && !this.prev[a]) || !!p);
      this.released[a] = this.enabled && !now[a] && this.prev[a];
      this.held[a] = this.enabled && (now[a] || !!p);
      this.prev[a] = now[a];
      // 스트리머 모드 통계 (게임 중 입력만)
      if (this.pressed[a] && this.counting) {
        this.counts[a] = (this.counts[a] || 0) + 1;
        this.total++;
        this.pressTimes.push(performance.now());
      }
    }
    this.kbPress = {};
    this.virtualPress = {};
  }

  resetCounts() {
    this.counts = {};
    this.total = 0;
    this.pressTimes = [];
  }
  // 최근 1초 입력 수
  kps() {
    const now = performance.now();
    const t = this.pressTimes;
    while (t.length && now - t[0] > 1000) t.shift();
    return t.length;
  }

  // UI에서 입력을 소비 (메뉴 닫을 때 같은 키가 게임으로 새지 않게)
  consume(a) {
    this.pressed[a] = false;
  }
  clearAll() {
    for (const a of ACTIONS) this.pressed[a] = false;
  }
}

export const input = new Input();
