// DOM 메뉴: 타이틀, 로비, 설정, 꾸미기, 상점, 일시정지, 결과, 엔딩
import { settings, profile, saveSettings, saveProfile, CLOAKS, MASKS, ANTENNAS, ACCS, SWORDS, SLASH_COLORS, LIGHT_COLORS, REQ_TEXT, isUnlocked, looks } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { input, ACTIONS, getKeys, setKey, resetKeys } from '../core/input.js';
import { fmtTime, isTouchDevice } from '../core/util.js';
import { hasWorldSave, clearWorld, loadWorld } from '../core/save.js';
import { COURSES, RUSH_ORDER } from '../world/data.js';
import { BOSSES } from '../entities/bosses.js';
import { Net, makeCode } from '../net/net.js';
import { drawMoth } from '../render/drawPlayer.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const KEYS = {
  kb: { J: 'Z', A: 'X', D: 'C', H: 'V', U: '↑', DN: '↓', LR: '← →' },
  pad: { J: 'Ⓐ', A: 'Ⓧ', D: 'Ⓑ', H: 'Ⓨ', U: '↑', DN: '↓', LR: '스틱' },
  touch: { J: '[점프]', A: '[공격]', D: '[대시]', H: '[회복]', U: '조이스틱↑', DN: '조이스틱↓', LR: '조이스틱' },
};

const ACTION_NAME = {
  left: '왼쪽', right: '오른쪽', up: '위 (앉기·위 베기)', down: '아래 (아래 베기)', jump: '점프', attack: '공격',
  dash: '대시', heal: '회복 (길게)', map: '지도', pause: '일시정지',
};
const SPECIAL = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Tab: 'Tab', Escape: 'Esc',
  Enter: 'Enter', Backspace: 'Backspace', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', ControlLeft: '왼쪽 Ctrl',
  ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt', CapsLock: 'CapsLock', Semicolon: ';',
  Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-',
  Equal: '=', Backquote: '`',
};
export function keyName(code) {
  if (!code) return '—';
  if (SPECIAL[code]) return SPECIAL[code];
  if (code === 'Mouse0') return '좌클릭';
  if (code === 'Mouse1') return '휠클릭';
  if (code === 'Mouse2') return '우클릭';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return '숫자패드 ' + code.slice(6);
  return code;
}
const kbName = (a) => keyName(getKeys(a)[0] || getKeys(a)[1]);
const kbBoth = (a) => getKeys(a).filter(Boolean).map(keyName).join(' / ') || '—';

export class Menus {
  constructor(root) {
    this.root = root;
    this.game = null;
    this.net = null;
    this.roster = [];
    this.modal = null;
    this.lobbyMode = { mode: 'story', course: 0 };
  }

  isTouch() {
    if (input.lastDevice === 'touch') return true;
    if (input.lastDevice === 'pad' || input.lastDevice === 'kb') return false;
    return isTouchDevice() && !matchMedia('(pointer:fine)').matches;
  }

  keyText(str) {
    const dev = input.lastDevice === 'pad' ? 'pad' : this.isTouch() ? 'touch' : 'kb';
    const kb = { J: kbName('jump'), A: kbName('attack'), D: kbName('dash'), H: kbName('heal'), U: kbName('up'), DN: kbName('down'), LR: kbName('left') + ' ' + kbName('right') };
    return String(str).replace(/\{(J|A|D|H|U|DN|LR)\}/g, (_, k) => (dev === 'kb' ? kb : KEYS[dev])[k]);
  }

  _screen(html, cls = '') {
    this.root.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    this.root.style.display = 'flex';
    const s = this.root.firstChild;
    s.querySelectorAll('button').forEach((b) => {
      b.addEventListener('pointerenter', () => audio.play('ui', { pitch: 1 }));
      b.addEventListener('click', () => audio.unlock());
    });
    return s;
  }

  hideAll() {
    this.root.innerHTML = '';
    this.root.style.display = 'none';
    this.modal = null;
  }

  modalOpen() {
    return !!this.modal;
  }
  closeModal() {
    if (this.modal && this.modal.close) this.modal.close();
  }

  // ═══════════════ 타이틀 ═══════════════
  showTitle(msg) {
    if (this.net && (!this.game || !this.game.running)) {
      this.net.close();
      this.net = null;
    }
    audio.music('title');
    const has = hasWorldSave();
    const beaten = (profile.beaten || []).length;
    const s = this._screen(`
      <div class="title-wrap">
        <div class="logo"><span class="logo-en">LANTERNFALL</span><span class="logo-ko">랜턴폴 · 꺼져가는 등불의 왕국</span></div>
        ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
        <div class="menu">
          <button data-a="solo" class="primary">${has ? '이어하기' : '혼자 시작하기'}</button>
          ${has ? '<button data-a="new">새로 시작</button>' : ''}
          <button data-a="coop" class="primary">함께 하기 <small>최대 4인 · 협동 / 레이스 / 보스 러시</small></button>
          <button data-a="race">스피드런 연습</button>
          <button data-a="rush" ${beaten ? '' : 'disabled'}>보스 러시 ${beaten ? '' : '<small>보스를 처치하면 열립니다</small>'}</button>
          <div class="row">
            <button data-a="cos">꾸미기</button>
            <button data-a="set">설정</button>
            <button data-a="help">조작법</button>
          </div>
        </div>
        <div class="foot">오리지널 작품 · ${esc(profile.name)}</div>
      </div>`, 'title');
    this._titleCanvas(s);
    s.addEventListener('click', (e) => {
      const a = e.target.closest('button') && e.target.closest('button').dataset.a;
      if (!a) return;
      audio.play('uiOk');
      if (a === 'solo') this.game.startStory(null, null, null);
      else if (a === 'new') this.confirm('새로 시작하면 이전 진행이 지워집니다. 계속할까요?', () => {
        clearWorld();
        this.game.startStory(null, null, null);
      });
      else if (a === 'coop') this.showCoop();
      else if (a === 'race') this.showCourses();
      else if (a === 'rush') this.game.startRush(null, RUSH_ORDER.filter((k) => profile.beaten.includes(k)), null);
      else if (a === 'cos') this.showCosmetics(() => this.showTitle());
      else if (a === 'set') this.showSettings(() => this.showTitle());
      else if (a === 'help') this.showHelp(() => this.showTitle());
    });
  }

  _titleCanvas(s) {
    // 타이틀 배경: 떠다니는 불씨
    const c = document.createElement('canvas');
    c.className = 'title-bg';
    s.prepend(c);
    const g = c.getContext('2d');
    const parts = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, v: Math.random() * 0.03 + 0.01, p: Math.random() * 6 }));
    const loop = (t) => {
      if (!c.isConnected) return;
      c.width = innerWidth;
      c.height = innerHeight;
      const W = c.width, H = c.height;
      const gr = g.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, Math.max(W, H) * 0.7);
      gr.addColorStop(0, '#1c3033');
      gr.addColorStop(1, '#04080a');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      // 거대한 등불 실루엣
      const cx = W / 2, cy = H * 0.3;
      const glow = 0.5 + Math.sin(t / 900) * 0.15;
      const lg = g.createRadialGradient(cx, cy, 0, cx, cy, H * 0.35);
      lg.addColorStop(0, `rgba(255,180,90,${glow * 0.35})`);
      lg.addColorStop(1, 'rgba(255,180,90,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      for (const p of parts) {
        p.y -= p.v / 60;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        const x = (p.x + Math.sin(t / 1500 + p.p) * 0.01) * W, y = p.y * H;
        g.fillStyle = `rgba(255,${180 + p.s * 20},120,${0.3 + Math.sin(t / 300 + p.p) * 0.2})`;
        g.fillRect(x, y, p.s, p.s);
      }
      // 땅 + 나방 기사 (왼쪽 아래)
      g.fillStyle = '#03060a';
      g.fillRect(0, H * 0.88, W, H * 0.12);
      const ms = Math.max(1.6, Math.min(3, H / 300));
      const mx = W * 0.14, my = H * 0.88;
      const lg2 = g.createRadialGradient(mx, my - 30 * ms, 0, mx, my - 30 * ms, 90 * ms);
      lg2.addColorStop(0, 'rgba(255,190,110,0.18)');
      lg2.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg2;
      g.fillRect(mx - 90 * ms, my - 120 * ms, 180 * ms, 180 * ms);
      g.save();
      g.translate(mx, my);
      g.scale(ms, ms);
      drawMoth(g, { x: -10, y: -38, w: 20, h: 38, facing: 1, anim: 'idle', animT: 0, landT: 0, ...looks() }, t / 1000);
      g.restore();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  confirm(text, ok) {
    const prev = this.root.innerHTML;
    const box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = `<div class="panel small"><p>${esc(text)}</p><div class="row"><button data-a="y" class="primary">확인</button><button data-a="n">취소</button></div></div>`;
    this.root.appendChild(box);
    box.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (!a) return;
      box.remove();
      if (a === 'y') ok();
    });
  }

  // ═══════════════ 조작법 ═══════════════
  showHelp(back) {
    const s = this._screen(`
      <div class="panel">
        <h2>조작법</h2>
        <table class="keys">
          <tr><th></th><th>키보드</th><th>게임패드</th><th>모바일</th></tr>
          <tr><td>이동</td><td>${kbBoth('left')} · ${kbBoth('right')}</td><td>스틱 · 방향키</td><td>조이스틱</td></tr>
          <tr><td>점프</td><td>${kbBoth('jump')}</td><td>Ⓐ</td><td>점프</td></tr>
          <tr><td>공격</td><td>${kbBoth('attack')}</td><td>Ⓧ</td><td>공격</td></tr>
          <tr><td>위·아래 베기</td><td>${kbName('up')} / ${kbName('down')} + 공격</td><td>스틱 + Ⓧ</td><td>조이스틱 + 공격</td></tr>
          <tr><td>대시</td><td>${kbBoth('dash')}</td><td>Ⓑ · RB · RT</td><td>대시</td></tr>
          <tr><td>회복 (길게)</td><td>${kbBoth('heal')}</td><td>Ⓨ · LB · LT</td><td>회복</td></tr>
          <tr><td>앉기 · 상점</td><td>${kbName('up')}</td><td>↑</td><td>조이스틱 ↑</td></tr>
          <tr><td>지도</td><td>${kbBoth('map')}</td><td>Back</td><td>지도</td></tr>
          <tr><td>일시정지</td><td>${kbBoth('pause')}</td><td>Start</td><td>Ⅱ</td></tr>
        </table>
        <ul class="tips">
          <li>점프 버튼을 <b>길게</b> 누를수록 높이 뜁니다.</li>
          <li>공중에서 아래 베기로 적이나 가시를 밟으면 튀어오릅니다.</li>
          <li>적을 베면 불씨가 모이고, 33 이상이면 회복 버튼을 꾹 눌러 가면 하나를 되찾습니다.</li>
          <li>협동 중 체력이 가득 찼다면 다친 동료 곁에서 회복해 불씨를 나눠줄 수 있습니다.</li>
        </ul>
        <button data-a="back" class="primary">돌아가기</button>
      </div>`);
    s.querySelector('[data-a=back]').onclick = () => back();
  }

  // ═══════════════ 설정 ═══════════════
  showSettings(back, inGame) {
    const sl = (id, label, v, min = 0, max = 1, step = 0.05) =>
      `<label class="slider"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><em id="${id}v">${Math.round(v * 100)}%</em></label>`;
    const s = this._screen(`
      <div class="panel">
        <h2>설정</h2>
        ${sl('s_music', '배경음악', settings.music)}
        ${sl('s_sfx', '효과음', settings.sfx)}
        ${sl('s_shake', '화면 흔들림', settings.shake)}
        ${sl('s_hitstop', '타격 정지(히트스톱)', settings.hitstop)}
        <h3>키보드</h3>
        <button data-a="keys">키 설정</button>
        <h3>스트리머 모드</h3>
        <div class="row"><button data-a="streamer" class="${settings.streamer ? 'on' : ''}">입력 키 표시: ${settings.streamer ? '켜짐' : '꺼짐'}</button></div>
        <div class="row spos">${[['tl', '왼쪽 위'], ['tr', '오른쪽 위'], ['bl', '왼쪽 아래'], ['br', '오른쪽 아래']].map(([k, n]) => `<button data-sp="${k}" class="${settings.streamerPos === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <h3>모바일 버튼</h3>
        ${sl('s_tsize', '버튼 크기', settings.touchSize, 0.7, 1.5)}
        ${sl('s_talpha', '버튼 투명도', settings.touchAlpha, 0.2, 1)}
        <div class="row"><button data-a="edit">버튼 배치 편집</button><button data-a="reset">배치 초기화</button></div>
        <button data-a="back" class="primary">돌아가기</button>
      </div>`);
    const bind = (id, key) => {
      const el = $('#' + id, s);
      el.oninput = () => {
        settings[key] = parseFloat(el.value);
        $('#' + id + 'v', s).textContent = Math.round(settings[key] * 100) + '%';
        audio.applyVolume();
        if (key.startsWith('touch')) this.touch.layout();
        saveSettings();
      };
    };
    bind('s_music', 'music');
    bind('s_sfx', 'sfx');
    bind('s_shake', 'shake');
    bind('s_hitstop', 'hitstop');
    bind('s_tsize', 'touchSize');
    bind('s_talpha', 'touchAlpha');
    s.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'back') back();
      else if (a === 'reset') {
        this.touch.resetLayout();
        audio.play('uiOk');
      } else if (a === 'edit') this.editTouch(() => this.showSettings(back, inGame));
      else if (a === 'keys') this.showKeys(() => this.showSettings(back, inGame));
      else if (a === 'streamer') {
        settings.streamer = !settings.streamer;
        saveSettings();
        this.showSettings(back, inGame);
      } else if (e.target.dataset.sp) {
        settings.streamerPos = e.target.dataset.sp;
        saveSettings();
        this.showSettings(back, inGame);
      }
    });
  }

  // ═══════════════ 키 설정 ═══════════════
  showKeys(back) {
    const prevModal = this.modal;
    const render = (waiting) => {
      // 겹치는 키 찾기
      const owner = {};
      for (const a of ACTIONS) for (const c of getKeys(a)) if (c) (owner[c] = owner[c] || []).push(a);
      const cell = (a, i) => {
        const c = getKeys(a)[i];
        const dup = c && owner[c].length > 1;
        const others = dup ? owner[c].filter((b) => b !== a).map((b) => ACTION_NAME[b]).join(', ') : '';
        const wait = waiting && waiting[0] === a && waiting[1] === i;
        return `<button class="kb ${dup ? 'dup' : ''} ${wait ? 'wait' : ''}" data-k="${a}:${i}" ${dup ? `title="다른 동작과 겹침: ${others}"` : ''}>${wait ? '키 또는 클릭…' : esc(keyName(c))}${dup ? `<small>겹침: ${esc(others)}</small>` : ''}</button>`;
      };
      const anyDup = Object.values(owner).some((l) => l.length > 1);
      const s = this._screen(`
        <div class="panel keys-panel">
          <h2>키 설정</h2>
          <p class="sub">칸을 누른 뒤 원하는 키를 누르거나 마우스를 클릭하세요 (좌클릭·우클릭·휠클릭). <b>Backspace</b> = 비우기, <b>Esc</b> = 취소. Esc는 항상 일시정지로도 동작합니다.</p>
          ${anyDup ? '<div class="notice">겹치는 키가 있습니다. 한 키로 두 동작이 동시에 실행됩니다.</div>' : ''}
          <div class="kgrid">
            <div class="kh">동작</div><div class="kh">주 키</div><div class="kh">보조 키</div>
            ${ACTIONS.map((a) => `<div class="kn">${ACTION_NAME[a]}</div>${cell(a, 0)}${cell(a, 1)}`).join('')}
          </div>
          <div class="row"><button data-a="reset">기본값으로</button><button data-a="back" class="primary">완료</button></div>
        </div>`, this.game && this.game.running ? 'dim' : '');
      s.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || input.capture) return;
        if (b.dataset.a === 'back') {
          this.modal = prevModal;
          return back();
        }
        if (b.dataset.a === 'reset') {
          resetKeys();
          audio.play('uiOk');
          return render();
        }
        if (b.dataset.k) {
          const [a, i] = b.dataset.k.split(':');
          audio.play('ui');
          render([a, Number(i)]);
          input.capture = (code) => {
            if (code === 'Escape') return render();
            setKey(a, Number(i), code === 'Backspace' || code === 'Delete' ? null : code);
            audio.play('uiOk');
            render();
          };
        }
      });
    };
    this.modal = { close: () => { input.capture = null; this.modal = prevModal; back(); } };
    render();
  }

  editTouch(back) {
    const wasVisible = this.touch.visible;
    this.hideAll();
    this.touch.show(true);
    this.touch.setEditing(true);
    const bar = document.createElement('div');
    bar.className = 'edit-bar';
    bar.innerHTML = '<span>버튼을 끌어서 원하는 위치로 옮기세요</span><button class="primary">완료</button>';
    document.body.appendChild(bar);
    bar.querySelector('button').onclick = () => {
      bar.remove();
      this.touch.setEditing(false);
      this.touch.show(wasVisible);
      audio.play('uiOk');
      back();
    };
  }

  // ═══════════════ 꾸미기 ═══════════════
  showCosmetics(back) {
    const CATS = [
      ['cloak', '망토', CLOAKS], ['mask', '가면', MASKS], ['antenna', '더듬이', ANTENNAS], ['acc', '장신구', ACCS],
      ['sword', '검', SWORDS], ['slashC', '베기 색', SLASH_COLORS], ['lightC', '등불 빛', LIGHT_COLORS],
    ];
    let tab = this._cosTab || 'cloak';
    const s = this._screen(`
      <div class="panel cos-panel">
        <h2>꾸미기</h2>
        <label class="field"><span>이름</span><input id="c_name" maxlength="10" value="${esc(profile.name)}"></label>
        <div class="cos">
          <canvas id="c_prev" width="240" height="240"></canvas>
          <div class="cos-right">
            <div class="tabs">${CATS.map(([k, n]) => `<button data-tab="${k}">${n}</button>`).join('')}</div>
            <div class="opts" id="c_opts"></div>
            <p class="sub" id="c_hint"></p>
          </div>
        </div>
        <button data-a="back" class="primary">저장하고 돌아가기</button>
      </div>`);
    const renderOpts = () => {
      this._cosTab = tab;
      s.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      const [key, , list] = CATS.find((c) => c[0] === tab);
      const colorish = key === 'cloak' || key === 'slashC' || key === 'lightC';
      $('#c_opts', s).innerHTML = list
        .map((it, i) => {
          const ok = isUnlocked(it);
          const on = (profile[key] || 0) === i;
          const bg = key === 'cloak' ? (it.grad ? `linear-gradient(135deg, ${it.c}, ${it.d})` : it.c) : key === 'slashC' ? `rgb(${it.rgb})` : key === 'lightC' ? it.css : '';
          if (colorish)
            return `<button class="sw ${on ? 'on' : ''} ${ok ? '' : 'lock'}" data-o="${i}" style="background:${bg}" title="${esc(it.name)}${ok ? '' : ' — ' + esc(REQ_TEXT[it.req] || '')}">${ok ? '' : '🔒'}</button>`;
          return `<button class="mk ${on ? 'on' : ''} ${ok ? '' : 'lock'}" data-o="${i}">${ok ? esc(it.name) : '🔒 ???'}</button>`;
        })
        .join('');
      const cur = list[profile[key] || 0];
      $('#c_hint', s).textContent = cur ? `선택: ${cur.name}` : '';
    };
    renderOpts();
    const cv = $('#c_prev', s);
    const g = cv.getContext('2d');
    let atkT = 0, last = 0, dir = 0;
    const draw = (t) => {
      if (!cv.isConnected) return;
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      // 미리보기: 주기적으로 베기 시연
      atkT -= dt;
      if (atkT < -1.2) { atkT = 0.16; dir = (dir + 1) % 3; }
      g.setTransform(1, 0, 0, 1, 0, 0);
      const lc = LIGHT_COLORS[looks().lightC];
      const bg = g.createRadialGradient(120, 130, 10, 120, 130, 150);
      bg.addColorStop(0, '#1a2a2c');
      bg.addColorStop(1, '#070b0c');
      g.fillStyle = bg;
      g.fillRect(0, 0, 240, 240);
      g.globalAlpha = 0.25;
      const lg = g.createRadialGradient(120, 120, 0, 120, 120, 110);
      lg.addColorStop(0, lc.css);
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, 240, 240);
      g.globalAlpha = 1;
      g.fillStyle = '#03060a';
      g.fillRect(0, 196, 240, 44);
      g.setTransform(3.2, 0, 0, 3.2, 120 - 10 * 3.2, 196 - 38 * 3.2);
      const L = looks();
      const st = Object.assign({ x: 0, y: 0, w: 20, h: 38, facing: 1, anim: 'idle', animT: 0, landT: 0, vx: 120, atkT: Math.max(0, atkT), atkDir: ['side', 'up', 'side'][dir] }, L);
      drawMoth(g, st, t / 1000);
      if (atkT > 0) {
        const k = 1 - atkT / 0.16;
        const rgb = SLASH_COLORS[L.slashC].rgb;
        g.save();
        g.translate(10 + (dir === 1 ? 0 : 24), dir === 1 ? -8 : 18);
        g.rotate(dir === 1 ? -Math.PI / 2 : 0);
        g.beginPath();
        g.arc(-6, 0, 16, -1.2, 1.2);
        g.arc(-12, 0, 12, 1.0, -1.0, true);
        g.closePath();
        g.fillStyle = `rgba(${rgb},${0.85 * (1 - k)})`;
        g.fill();
        g.restore();
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    s.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tab) {
        tab = b.dataset.tab;
        renderOpts();
      } else if (b.dataset.o != null) {
        const [key, , list] = CATS.find((c) => c[0] === tab);
        const it = list[Number(b.dataset.o)];
        if (!isUnlocked(it)) {
          $('#c_hint', s).textContent = `잠김 — ${REQ_TEXT[it.req] || ''}`;
          audio.play('ui', { pitch: 0.6 });
          return;
        }
        profile[key] = Number(b.dataset.o);
        renderOpts();
      } else if (b.dataset.a === 'back') {
        const n = $('#c_name', s).value.trim().slice(0, 10);
        if (n) profile.name = n;
        saveProfile();
        back();
      }
      audio.play('ui');
    });
  }

  // ═══════════════ 레이스 코스 선택 ═══════════════
  showCourses() {
    const s = this._screen(`
      <div class="panel">
        <h2>스피드런 연습</h2>
        <p class="sub">모든 능력을 가진 채로 출발합니다. 결승선까지 최단 시간에!</p>
        <div class="list">${COURSES.map((c, i) => `<button data-i="${i}">${c.name}<small>${profile.raceBest && profile.raceBest[c.id] ? '최고 ' + fmtTime(profile.raceBest[c.id]) : '기록 없음'}</small></button>`).join('')}</div>
        <button data-a="back">돌아가기</button>
      </div>`);
    s.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.a === 'back') return this.showTitle();
      audio.play('uiOk');
      this.game.startRace(null, Number(b.dataset.i), null);
    });
  }

  // ═══════════════ 함께 하기 (로비) ═══════════════
  showCoop(prefill = '') {
    const s = this._screen(`
      <div class="panel">
        <h2>함께 하기</h2>
        <label class="field"><span>내 이름</span><input id="l_name" maxlength="10" value="${esc(profile.name)}"></label>
        <div class="coop-grid">
          <div class="card"><h3>방 만들기</h3><p>방 코드를 친구에게 알려주세요.</p><button data-a="host" class="primary">방 만들기</button></div>
          <div class="card"><h3>참가하기</h3><input id="l_code" maxlength="5" placeholder="방 코드 5자리" value="${esc(prefill)}" autocapitalize="characters"><button data-a="join" class="primary">참가</button></div>
        </div>
        <p class="sub">P2P 연결이라 서버 비용이 없습니다. 일부 회사·학교 네트워크에서는 연결이 막힐 수 있습니다.</p>
        <button data-a="back">돌아가기</button>
      </div>`);
    s.addEventListener('click', async (e) => {
      const a = e.target.dataset.a;
      if (!a) return;
      const n = $('#l_name', s).value.trim().slice(0, 10);
      if (n) {
        profile.name = n;
        saveProfile();
      }
      if (a === 'back') return this.showTitle();
      if (a === 'host') this._host();
      if (a === 'join') {
        const code = $('#l_code', s).value.trim().toUpperCase();
        if (code.length !== 5) return this._flash(s, '5자리 코드를 입력해 주세요');
        this._join(code);
      }
    });
  }

  _flash(s, text) {
    let n = s.querySelector('.notice');
    if (!n) {
      n = document.createElement('div');
      n.className = 'notice';
      s.querySelector('.panel').prepend(n);
    }
    n.textContent = text;
  }

  _busy(text) {
    this._screen(`<div class="panel small"><div class="spinner"></div><p>${esc(text)}</p><button data-a="cancel">취소</button></div>`).addEventListener('click', (e) => {
      if (e.target.dataset.a === 'cancel') {
        if (this.net) this.net.close();
        this.net = null;
        this.showCoop();
      }
    });
  }

  async _host() {
    this._busy('방을 만드는 중…');
    let tries = 0;
    while (tries < 3) {
      const net = new Net();
      try {
        const code = makeCode();
        await net.host(code);
        this.net = net;
        this.roster = [{ id: 0, name: profile.name }];
        this._bindLobby(net);
        this.showLobby();
        return;
      } catch (err) {
        net.close();
        tries++;
        if (tries >= 3 || !/사용 중/.test(err.message)) {
          this.showCoop();
          this._flash(this.root.firstChild, err.message);
          return;
        }
      }
    }
  }

  async _join(code) {
    this._busy(`방 ${code}에 연결하는 중…`);
    const net = new Net();
    try {
      await net.join(code);
      this.net = net;
      this.roster = [];
      this._bindLobby(net);
      net.send({ t: 'hello', name: profile.name });
      this.showLobby();
    } catch (err) {
      net.close();
      this.showCoop(code);
      this._flash(this.root.firstChild, err.message);
    }
  }

  _bindLobby(net) {
    const guard = (fn) => (m, f) => {
      if (this.net === net) fn(m, f);
    };
    if (net.isHost) {
      net.on('hello', guard((m, from) => {
        if (this.roster.some((r) => r.id === from)) return;
        this.roster.push({ id: from, name: String(m.name || '나방').slice(0, 10) });
        net.send({ t: 'welcome', id: from }, from);
        net.send({ t: 'roster', list: this.roster, lm: this.lobbyMode });
        audio.play('uiOk');
        this._refreshLobby();
      }));
      net.on('leave', guard((m) => {
        this.roster = this.roster.filter((r) => r.id !== m.id);
        net.send({ t: 'roster', list: this.roster, lm: this.lobbyMode });
        this._refreshLobby();
      }));
    } else {
      net.on('welcome', guard((m) => (net.myId = m.id)));
      net.on('roster', guard((m) => {
        this.roster = m.list;
        this.lobbyMode = m.lm || this.lobbyMode;
        this._refreshLobby();
      }));
      net.on('start', guard((m) => this._startFromMsg(m)));
      net.on('lobby', guard(() => {
        this.game.stop(true);
        this.showLobby();
      }));
      net.on('hostLost', guard(() => {
        if (this.game.running) return;
        net.close();
        this.net = null;
        this.showTitle('방장과의 연결이 끊어졌습니다.');
      }));
    }
  }

  showLobby() {
    const net = this.net;
    const host = net.isHost;
    const url = location.origin + location.pathname + '?room=' + (net.code || '');
    const beaten = (profile.beaten || []).length;
    const s = this._screen(`
      <div class="panel lobby">
        <h2>로비</h2>
        ${host ? `<div class="code">방 코드 <b>${net.code}</b> <button data-a="copy">링크 복사</button></div>` : '<div class="code">방장이 시작하기를 기다리는 중…</div>'}
        <div class="players" id="l_players"></div>
        ${host ? `
        <h3>모드</h3>
        <div class="modes">
          <button data-m="story">협동 이야기</button>
          <button data-m="race">스피드런 레이스</button>
          <button data-m="rush" ${beaten ? '' : 'disabled title="방장이 보스를 처치해야 열립니다"'}>보스 러시</button>
        </div>
        <div class="courses" id="l_courses">${COURSES.map((c, i) => `<button data-c="${i}">${c.name}</button>`).join('')}</div>
        <p class="sub" id="l_desc"></p>
        <button data-a="start" class="primary">시작</button>` : '<p class="sub" id="l_desc"></p>'}
        <button data-a="leave">나가기</button>
      </div>`);
    this._refreshLobby();
    s.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.a === 'leave') {
        net.close();
        this.net = null;
        return this.showTitle();
      }
      if (b.dataset.a === 'copy') {
        try {
          navigator.clipboard.writeText(url);
          b.textContent = '복사됨!';
        } catch (err) {}
      }
      if (b.dataset.m) {
        this.lobbyMode.mode = b.dataset.m;
        net.send({ t: 'roster', list: this.roster, lm: this.lobbyMode });
      }
      if (b.dataset.c != null) {
        this.lobbyMode.course = Number(b.dataset.c);
        net.send({ t: 'roster', list: this.roster, lm: this.lobbyMode });
      }
      if (b.dataset.a === 'start') this._hostStart();
      this._refreshLobby();
    });
  }

  _refreshLobby() {
    const el = $('#l_players', this.root);
    if (!el) return;
    el.innerHTML = this.roster.map((r) => `<div class="pl">${r.id === 0 ? '👑 ' : ''}${esc(r.name)}${this.net && r.id === this.net.myId ? ' (나)' : ''}</div>`).join('') + `<div class="pl dim">${this.roster.length} / 4</div>`;
    const lm = this.lobbyMode;
    this.root.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === lm.mode));
    this.root.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', Number(b.dataset.c) === lm.course));
    const cs = $('#l_courses', this.root);
    if (cs) cs.style.display = lm.mode === 'race' ? 'flex' : 'none';
    const d = $('#l_desc', this.root);
    if (d) {
      const desc = {
        story: '방장의 저장 진행으로 함께 탐험합니다. 쓰러지면 고치가 되고, 동료가 곁에 머물면 부활합니다.',
        race: `코스: ${COURSES[lm.course].name} — 동시에 출발해 결승선까지 경주합니다. 상대는 유령으로 보입니다.`,
        rush: '처치한 보스들과 연속으로 싸웁니다. 처치 시간이 기록됩니다.',
      }[lm.mode];
      d.textContent = desc;
    }
  }

  _hostStart() {
    const net = this.net;
    const lm = this.lobbyMode;
    net.locked = true;
    const roster = this.roster;
    if (lm.mode === 'story') {
      const save = loadWorld();
      const msg = { t: 'start', mode: 'story', roster, save: save || null };
      net.send(msg);
      this.game.startStory(net, save, roster);
    } else if (lm.mode === 'race') {
      net.send({ t: 'start', mode: 'race', roster, course: lm.course });
      this.game.startRace(net, lm.course, roster);
    } else {
      const order = RUSH_ORDER.filter((k) => (profile.beaten || []).includes(k));
      net.send({ t: 'start', mode: 'rush', roster, order });
      this.game.startRush(net, order, roster);
    }
  }

  _startFromMsg(m) {
    const net = this.net;
    if (m.mode === 'story') {
      this.game.startStory(net, m.save || null, m.roster);
    } else if (m.mode === 'race') this.game.startRace(net, m.course, m.roster);
    else this.game.startRush(net, m.order, m.roster);
  }

  backToLobby() {
    const net = this.game.net;
    this.game.stop(true);
    if (net && net.isHost) {
      net.locked = false;
      net.send({ t: 'lobby' });
    }
    this.net = net;
    this.showLobby();
  }

  // ═══════════════ 일시정지 ═══════════════
  showPause(online) {
    const s = this._screen(`
      <div class="panel small">
        <h2>${online ? '메뉴' : '일시정지'}</h2>
        <button data-a="resume" class="primary">계속하기</button>
        <button data-a="set">설정</button>
        <button data-a="help">조작법</button>
        <button data-a="quit">타이틀로</button>
      </div>`, 'dim');
    this.modal = { close: () => resume() };
    const resume = () => {
      this.hideAll();
      this.game.resume();
    };
    s.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'resume') resume();
      else if (a === 'set') {
        this.modal = { close: () => this.showPause(online) };
        this.showSettings(() => this.showPause(online), true);
      } else if (a === 'help') {
        this.modal = { close: () => this.showPause(online) };
        this.showHelp(() => this.showPause(online));
      } else if (a === 'quit') {
        this.confirm(online ? '세션에서 나갈까요?' : '타이틀로 돌아갈까요? (마지막 벤치까지 저장됨)', () => {
          this.game.stop();
          this.net = null;
          this.showTitle();
        });
      }
    });
  }

  // ═══════════════ 상점 ═══════════════
  openShop(onClose) {
    const items = () => {
      const shopShards = profile.shopShards || 0;
      return [
        { id: 'shard', name: '가면 조각', desc: '4개를 모으면 최대 체력 +1', price: [150, 300, 500, 800][shopShards], sold: shopShards >= 4 },
        { id: 'nail', name: profile.nail >= 1 ? '심지검 담금질 II' : '심지검 담금질', desc: '공격력 증가', price: [400, 900][profile.nail || 0], sold: (profile.nail || 0) >= 2 },
      ];
    };
    const render = () => {
      const s = this._screen(`
        <div class="panel shop">
          <h2>등잔 상인</h2>
          <p class="sub">"어둠 속에서 길을 잃었나? 호박석만 있다면 뭐든 내어주지."</p>
          <div class="amber">◆ ${profile.amber}</div>
          <div class="list">${items().map((it) => `<button data-i="${it.id}" ${it.sold || profile.amber < it.price ? 'disabled' : ''}>${it.name}<small>${it.sold ? '품절' : it.desc + ' · ◆ ' + it.price}</small></button>`).join('')}</div>
          <button data-a="close" class="primary">나가기</button>
        </div>`, 'dim');
      s.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.a === 'close') return close();
        const it = items().find((q) => q.id === b.dataset.i);
        if (!it || it.sold || profile.amber < it.price) return;
        profile.amber -= it.price;
        if (it.id === 'shard') {
          profile.shopShards = (profile.shopShards || 0) + 1;
          profile.shards = (profile.shards || 0) + 1;
          if (profile.shards % 4 === 0) profile.bonusMasks = (profile.bonusMasks || 0) + 1;
        } else profile.nail = (profile.nail || 0) + 1;
        saveProfile();
        audio.play('shard');
        render();
      });
    };
    const close = () => {
      this.hideAll();
      onClose();
    };
    this.modal = { close };
    render();
  }

  // ═══════════════ 결과 화면 ═══════════════
  showRaceResults(list, course, isHost, online) {
    const s = this._screen(`
      <div class="panel">
        <h2>${esc(course.name)} 결과</h2>
        <div class="results">${list.map((r, i) => `<div class="res ${r.me ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.name)}</b><em>${r.time != null ? fmtTime(r.time) : '미완주'}</em></div>`).join('')}</div>
        ${profile.raceBest && profile.raceBest[course.id] ? `<p class="sub">개인 최고 기록 ${fmtTime(profile.raceBest[course.id])}</p>` : ''}
        <div class="row">
          ${!online ? '<button data-a="again" class="primary">다시 도전</button>' : isHost ? '<button data-a="lobby" class="primary">로비로</button>' : '<p class="sub">방장이 다음을 고르는 중…</p>'}
          <button data-a="title">타이틀로</button>
        </div>
      </div>`, 'dim');
    s.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'again') this.game.startRace(null, this.game.race.courseIdx, null);
      else if (a === 'lobby') this.backToLobby();
      else if (a === 'title') {
        this.game.stop();
        this.net = null;
        this.showTitle();
      }
    });
  }

  showRushResults(ok, time, idx, total, best, isHost, online) {
    const s = this._screen(`
      <div class="panel">
        <h2>${ok ? '보스 러시 완료!' : '쓰러졌다…'}</h2>
        <p class="big">${fmtTime(time)}</p>
        ${ok ? '' : `<p class="sub">${Math.max(0, idx)} / ${total} 처치</p>`}
        ${best ? '<p class="gold">새로운 최고 기록!</p>' : profile.rushBest ? `<p class="sub">최고 기록 ${fmtTime(profile.rushBest)}</p>` : ''}
        <div class="row">
          ${!online ? '<button data-a="again" class="primary">다시 도전</button>' : isHost ? '<button data-a="lobby" class="primary">로비로</button>' : ''}
          <button data-a="title">타이틀로</button>
        </div>
      </div>`, 'dim');
    s.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'again') this.game.startRush(null, this.game.rush.order, null);
      else if (a === 'lobby') this.backToLobby();
      else if (a === 'title') {
        this.game.stop();
        this.net = null;
        this.showTitle();
      }
    });
  }

  showEnding(playTime, onContinue) {
    const s = this._screen(`
      <div class="ending">
        <p class="l1">마지막 등불지기가 쓰러지고,</p>
        <p class="l2">꺼져가던 불씨가 다시 숨을 쉬었다.</p>
        <p class="l3">가라앉은 왕국에, 아주 작은 빛이 돌아왔다.</p>
        <h1>LANTERNFALL</h1>
        <p class="sub">플레이 시간 ${fmtTime(playTime)}</p>
        <p class="sub">숨겨진 무대에서 주홍 광대가 당신을 기다리고 있을지도…</p>
        <div class="row"><button data-a="cont" class="primary">계속 탐험하기</button><button data-a="title">타이틀로</button></div>
      </div>`, 'ending-screen');
    s.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'cont') {
        this.hideAll();
        onContinue();
      } else if (a === 'title') {
        this.game.stop();
        this.net = null;
        this.showTitle();
      }
    });
  }
}
