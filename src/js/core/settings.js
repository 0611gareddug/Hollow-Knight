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
  timer: false, // 스피드런 스플릿 타이머 (스토리)
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
  antenna: 0,
  acc: 0,
  sword: 0,
  slashC: 0,
  lightC: 0,
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

// ───────── 꾸미기 ─────────
// req: 잠금 해제 조건 (없으면 처음부터 사용 가능)
export const CLOAKS = [
  { name: '잿빛', c: '#3b4652', d: '#232a31' },
  { name: '호박', c: '#9a5a1e', d: '#5c3410' },
  { name: '청록', c: '#1f6b6b', d: '#123f40' },
  { name: '자주', c: '#5d3b7a', d: '#372249' },
  { name: '진홍', c: '#8a2632', d: '#52141c' },
  { name: '상아', c: '#b9ad94', d: '#7a705c' },
  { name: '촛농 금빛', c: '#b8862a', d: '#6e4c12', req: 'boss:mother' },
  { name: '심해', c: '#1d4a6a', d: '#0f283a', req: 'boss:bell' },
  { name: '밤하늘', c: '#23285a', d: '#11132e', req: 'boss:keeper', stars: 1 },
  { name: '주홍 비단', c: '#b0143a', d: '#5e0a1e', req: 'boss:scarlet' },
  { name: '구리 톱니', c: '#9a5c32', d: '#5a3218', req: 'boss:smith' },
  { name: '흰 날개', c: '#d9dde2', d: '#9aa3ab', req: 'boss:queen' },
  { name: '재의 왕', c: '#2e2624', d: '#140f0e', req: 'boss:devourer', embers: 1 },
  { name: '오로라', c: '#2f7a6e', d: '#3b2f6e', req: 'race:all', grad: 1 },
  { name: '눈뿔 순백', c: '#e4ecf2', d: '#9fb2c2', req: 'boss:stag' },
  { name: '서리 여제', c: '#8fc8e8', d: '#3e6e8e', req: 'boss:empress' },
  { name: '눈보라', c: '#b8bccc', d: '#3c3e52', req: 'boss:blizzard', grad: 1 },
  { name: '그림자 장막', c: '#2a1e3a', d: '#120a1c', req: 'boss:shademoth', stars: 1 },
  { name: '쉼터의 등불', c: '#c88a3a', d: '#6a4018', req: 'village', embers: 1 },
  { name: '음유시인의 보라', c: '#7a5aa0', d: '#3e2a58', req: 'hyeon' },
];
export const MASKS = [
  { name: '둥근 가면' },
  { name: '뾰족 가면' },
  { name: '금 간 가면' },
  { name: '주홍 가면', req: 'mask3' },
  { name: '가지뿔 가면' },
  { name: '부엉이 가면' },
  { name: '반쪽 가면', req: 'rush' },
  { name: '왕관 가면', req: 'boss:devourer' },
];
export const ANTENNAS = [
  { name: '깃털' },
  { name: '곡선' },
  { name: '짧은 뿔' },
  { name: '나선' },
  { name: '불꽃', req: 'boss:smith' },
];
export const ACCS = [
  { name: '없음' },
  { name: '목도리' },
  { name: '허리 등불' },
  { name: '꽃 장식' },
  { name: '리본' },
  { name: '깃털 깃', req: 'boss:queen' },
];
export const SWORDS = [
  { name: '심지검' },
  { name: '곡도' },
  { name: '장침' },
  { name: '촛대검', req: 'boss:keeper' },
  { name: '사슬검', req: 'boss:devourer' },
];
export const SLASH_COLORS = [
  { name: '흰빛', rgb: '255,255,255' },
  { name: '호박', rgb: '255,190,110' },
  { name: '청록', rgb: '120,240,220' },
  { name: '진홍', rgb: '255,90,110' },
  { name: '보라', rgb: '200,150,255' },
  { name: '금빛', rgb: '255,220,120', req: 'boss:keeper' },
  { name: '하늘', rgb: '150,210,255', req: 'boss:queen' },
  { name: '서리', rgb: '200,240,255', req: 'boss:empress' },
  { name: '그림자', rgb: '190,140,255', req: 'boss:shademoth' },
];
export const LIGHT_COLORS = [
  { name: '호박', kind: 'amber', css: '#ffb347' },
  { name: '청록', kind: 'teal', css: '#5fe0c6' },
  { name: '보라', kind: 'violet', css: '#b48bff' },
  { name: '흰빛', kind: 'white', css: '#dfeeff' },
  { name: '진홍', kind: 'red', css: '#ff5a64' },
  { name: '서리빛', kind: 'sky', css: '#a8d8ff', req: 'boss:blizzard' },
];
export const REQ_TEXT = {
  'boss:mother': '심지의 어미 처치', 'boss:bell': '잠긴 종지기 처치', 'boss:keeper': '마지막 등불지기 처치',
  'boss:scarlet': '주홍 광대 처치', 'boss:smith': '톱니 대장장이 처치', 'boss:queen': '흰 날개 여왕 처치',
  'boss:devourer': '재를 삼킨 자 처치 (2장 클리어)', 'race:all': '레이스 3코스 모두 완주', rush: '보스 러시 완주',
  mask3: '숨겨진 무대의 제단',
  'boss:stag': '눈뿔 사슴 처치', 'boss:empress': '서리 여제 처치', 'boss:blizzard': '눈보라 군주 처치 (3장 클리어)',
  'boss:shademoth': '숨겨진 보스 그림자 나방 처치', village: '마을 주민 6명 모두 구출', hyeon: '음유시인 현의 연주 듣기',
};
export function isUnlocked(item) {
  const r = item && item.req;
  if (!r) return true;
  if (r.startsWith('boss:')) return (profile.beaten || []).includes(r.slice(5));
  if (r === 'race:all') return ['ash', 'water', 'climb'].every((id) => profile.raceBest && profile.raceBest[id]);
  if (r === 'rush') return !!profile.rushBest;
  if (r === 'mask3') return (profile.unlockedMasks || []).includes(3);
  if (r === 'village') return !!profile.villageAll;
  if (r === 'hyeon') return !!(profile.npcGift && profile.npcGift.hyeon);
  return false;
}
// 저장된 선택이 잠겨 있으면 기본값으로
export function looks() {
  const pick = (list, i) => (list[i] && isUnlocked(list[i]) ? i : 0);
  return {
    cloak: pick(CLOAKS, profile.cloak), mask: pick(MASKS, profile.mask), antenna: pick(ANTENNAS, profile.antenna),
    acc: pick(ACCS, profile.acc), sword: pick(SWORDS, profile.sword), slashC: pick(SLASH_COLORS, profile.slashC),
    lightC: pick(LIGHT_COLORS, profile.lightC),
  };
}
