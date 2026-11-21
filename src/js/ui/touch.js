// 모바일 터치 조작: 가상 조이스틱 + 버튼, 드래그로 배치 편집
import { input } from '../core/input.js';
import { settings, saveSettings } from '../core/settings.js';

const DEFAULT = {
  stick: { x: 0.13, y: 0.72 },
  jump: { x: 0.9, y: 0.74 },
  attack: { x: 0.78, y: 0.82 },
  dash: { x: 0.8, y: 0.6 },
  heal: { x: 0.92, y: 0.5 },
  hook: { x: 0.68, y: 0.7 },
};
const LABEL = { jump: '점프', attack: '공격', dash: '대시', heal: '회복', hook: '사슬' };
const SIZE = { stick: 150, jump: 84, attack: 74, dash: 64, heal: 60, hook: 64 };

export class TouchUI {
  constructor(root) {
    this.root = root;
    this.els = {};
    this.editing = false;
    this.visible = false;
    this.stickId = null;
    this._build();
    window.addEventListener('resize', () => this.layout());
  }

  _pos(id) {
    const L = settings.touchLayout || {};
    return L[id] || DEFAULT[id];
  }

  _build() {
    const r = this.root;
    r.innerHTML = '';
    // 조이스틱
    const st = document.createElement('div');
    st.className = 'tc-stick';
    st.innerHTML = '<div class="tc-knob"></div>';
    r.appendChild(st);
    this.els.stick = st;
    this.knob = st.firstChild;
    for (const id of ['jump', 'attack', 'dash', 'heal', 'hook']) {
      const b = document.createElement('div');
      b.className = 'tc-btn tc-' + id;
      b.textContent = LABEL[id];
      r.appendChild(b);
      this.els[id] = b;
    }
    // 상단 바
    const top = document.createElement('div');
    top.className = 'tc-top';
    top.innerHTML = '<button data-a="map">지도</button><button data-a="pause">Ⅱ</button><button data-a="fs">⛶</button>';
    r.appendChild(top);
    this.top = top;
    top.addEventListener('pointerdown', (e) => {
      const a = e.target.dataset && e.target.dataset.a;
      if (!a) return;
      e.preventDefault();
      if (a === 'fs') toggleFullscreen();
      else {
        input.setVirtual(a, true);
        setTimeout(() => input.setVirtual(a, false), 80);
      }
    });

    // 조이스틱 입력
    st.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      st.setPointerCapture(e.pointerId);
      this._stick(e);
    });
    st.addEventListener('pointermove', (e) => {
      if (this.editing || e.pointerId !== this.stickId) return;
      this._stick(e);
    });
    const endStick = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.knob.style.transform = 'translate(-50%,-50%)';
      for (const a of ['left', 'right', 'up', 'down']) input.setVirtual(a, false);
    };
    st.addEventListener('pointerup', endStick);
    st.addEventListener('pointercancel', endStick);

    for (const id of ['jump', 'attack', 'dash', 'heal', 'hook']) {
      const b = this.els[id];
      const down = (e) => {
        if (this.editing) return;
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('on');
        input.setVirtual(id, true);
      };
      const up = () => {
        b.classList.remove('on');
        input.setVirtual(id, false);
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    }

    // 편집 모드 드래그
    for (const id in this.els) {
      const el = this.els[id];
      el.addEventListener('pointerdown', (e) => {
        if (!this.editing) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.drag = { id, pid: e.pointerId };
      });
      el.addEventListener('pointermove', (e) => {
        if (!this.editing || !this.drag || this.drag.pid !== e.pointerId) return;
        const L = (settings.touchLayout = settings.touchLayout || JSON.parse(JSON.stringify(DEFAULT)));
        L[this.drag.id] = { x: Math.max(0.04, Math.min(0.96, e.clientX / innerWidth)), y: Math.max(0.1, Math.min(0.95, e.clientY / innerHeight)) };
        this.layout();
      });
      el.addEventListener('pointerup', () => {
        if (this.drag) {
          this.drag = null;
          saveSettings();
        }
      });
    }
    this.layout();
  }

  _stick(e) {
    const r = this.els.stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const R = r.width / 2;
    const d = Math.hypot(dx, dy);
    const lim = R * 0.55;
    const kx = d > lim ? (dx / d) * lim : dx, ky = d > lim ? (dy / d) * lim : dy;
    this.knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const nx = dx / R, ny = dy / R;
    const dead = 0.22;
    input.setVirtual('left', nx < -dead && Math.abs(nx) > Math.abs(ny) * 0.45);
    input.setVirtual('right', nx > dead && Math.abs(nx) > Math.abs(ny) * 0.45);
    input.setVirtual('up', ny < -0.45 && Math.abs(ny) > Math.abs(nx) * 0.6);
    input.setVirtual('down', ny > 0.45 && Math.abs(ny) > Math.abs(nx) * 0.6);
  }

  layout() {
    const sc = settings.touchSize * Math.min(1.25, Math.max(0.75, Math.min(innerWidth, innerHeight) / 420));
    for (const id in this.els) {
      const el = this.els[id];
      const p = this._pos(id);
      const s = SIZE[id] * sc;
      el.style.width = el.style.height = s + 'px';
      el.style.left = p.x * innerWidth - s / 2 + 'px';
      el.style.top = p.y * innerHeight - s / 2 + 'px';
      el.style.opacity = this.editing ? 0.9 : settings.touchAlpha;
      el.style.fontSize = Math.max(11, s * 0.2) + 'px';
    }
    this.top.style.opacity = Math.max(0.5, settings.touchAlpha);
  }

  show(v) {
    this.visible = v;
    this.root.style.display = v ? 'block' : 'none';
    if (!v) for (const a of ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'heal', 'hook']) input.setVirtual(a, false);
  }

  // 능력이 없으면 사슬 버튼 숨김
  setHook(on) {
    if (this.els.hook) this.els.hook.style.display = on || this.editing ? '' : 'none';
  }

  setEditing(on) {
    this.editing = on;
    this.root.classList.toggle('editing', on);
    this.layout();
  }

  resetLayout() {
    settings.touchLayout = null;
    saveSettings();
    this.layout();
  }
}

export function toggleFullscreen() {
  const d = document;
  try {
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      const el = d.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        const p = req.call(el, { navigationUI: 'hide' });
        if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
      }
    } else {
      const ex = d.exitFullscreen || d.webkitExitFullscreen;
      if (ex) ex.call(d);
    }
  } catch (e) {}
}
