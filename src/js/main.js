// 진입점
import { audio } from './core/audio.js';
import { input } from './core/input.js';
import { protect } from './core/protect.js';
import { Menus } from './ui/menus.js';
import { TouchUI } from './ui/touch.js';
import { Game } from './game.js';
import { fx } from './render/fx.js';

/* global __PROD__ */
if (typeof __PROD__ !== 'undefined' && __PROD__) protect();

const canvas = document.getElementById('game');
const menus = new Menus(document.getElementById('ui'));
const touch = new TouchUI(document.getElementById('touch'));
menus.touch = touch;
touch.show(false);
const game = new Game(canvas, menus, touch);
menus.game = game;
if (typeof __PROD__ !== 'undefined' && !__PROD__) {
  window.__game = game;
  window.__input = input;
  window.__fx = fx;
}

// 첫 입력에서 오디오 활성화 (브라우저 정책)
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('touchstart', unlock, { passive: true });

// 터치를 쓰면 터치 버튼 표시, 키보드를 쓰면 숨김
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    input.lastDevice = 'touch';
    if (game.running && !touch.visible) touch.show(true);
  }
});
window.addEventListener('keydown', () => {
  if (game.running && touch.visible && !touch.editing) touch.show(false);
});

// 더블탭 확대, 핀치 확대 방지
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// 탭이 숨겨지면 혼자 플레이 중일 때 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.running && !game.net && !game.paused && !game.ended) game.openPause();
});

const room = new URLSearchParams(location.search).get('room');
if (room) menus.showCoop(room.toUpperCase().slice(0, 5));
else menus.showTitle();

window.addEventListener('load', () => document.body.classList.add('ready'));
