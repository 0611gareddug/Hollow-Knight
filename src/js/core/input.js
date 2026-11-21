// 키보드 / 게임패드 / 터치를 하나의 액션 입력으로 통합
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'heal', 'map', 'pause'];

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', Space: 'jump', KeyK: 'jump',
  KeyX: 'attack', KeyJ: 'attack',
  KeyC: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash',
  KeyV: 'heal', KeyF: 'heal', KeyI: 'heal',
  Tab: 'map', KeyM: 'map',
  Escape: 'pause', KeyP: 'pause',
};

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
    for (const a of ACTIONS) {
      this.held[a] = this.pressed[a] = this.released[a] = this.prev[a] = false;
    }
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const a = KEYMAP[e.code];
      if (a) {
        e.preventDefault();
        if (!this.keys[e.code]) this.kbPress[a] = true;
        this.keys[e.code] = true;
        this.lastDevice = 'kb';
      }
    });
    window.addEventListener('keyup', (e) => {
      if (KEYMAP[e.code]) this.keys[e.code] = false;
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
    for (const code in this.keys) if (this.keys[code]) now[KEYMAP[code]] = true;
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
    }
    this.kbPress = {};
    this.virtualPress = {};
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
