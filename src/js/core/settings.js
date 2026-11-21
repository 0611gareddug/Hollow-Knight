// 개인 설정 + 개인 프로필 (각자 브라우저에 저장)
import { lsGet, lsSet } from './util.js';

const SKEY = 'lf_settings_v1';
const PKEY = 'lf_profile_v1';

const defSettings = {
  music: 0.6,
  sfx: 0.8,
  shake: 1, // 0~1
  hitstop: 1, // 0~1
  touchSize: 1,
  touchAlpha: 0.55,
  touchLayout: null, // {id:{x,y}} 화면 비율 좌표
  showFps: false,
  streamer: false, // 스트리머 모드: 입력 키 표시
  streamerPos: 'br', // br | bl | tr | tl
};

const defProfile = {
  name: '',
  cloak: 0,
  mask: 0,
  unlockedMasks: [0, 1, 2],
  amber: 0,
  shards: 0, // 가면 조각 (4개 = 최대 체력 +1)
  bonusMasks: 0,
  nail: 0, // 검 강화 단계 0~2
  raceBest: {}, // courseId -> sec
  rushBest: null,
};

export const settings = Object.assign({}, defSettings, lsGet(SKEY, {}));
export const profile = Object.assign({}, defProfile, lsGet(PKEY, {}));
if (!profile.name) profile.name = '나방' + Math.floor(100 + Math.random() * 900);

export function saveSettings() {
  lsSet(SKEY, settings);
}
export function saveProfile() {
  lsSet(PKEY, profile);
}

export const CLOAKS = [
  { name: '잿빛', c: '#3b4652', d: '#232a31' },
  { name: '호박', c: '#9a5a1e', d: '#5c3410' },
  { name: '청록', c: '#1f6b6b', d: '#123f40' },
  { name: '자주', c: '#5d3b7a', d: '#372249' },
  { name: '진홍', c: '#8a2632', d: '#52141c' },
  { name: '상아', c: '#b9ad94', d: '#7a705c' },
];
export const MASKS = [
  { name: '둥근 가면' },
  { name: '뾰족 가면' },
  { name: '금 간 가면' },
  { name: '주홍 가면', hidden: true },
];
