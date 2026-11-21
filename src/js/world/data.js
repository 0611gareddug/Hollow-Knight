// Lanternfall 월드 데이터 (전역 타일 좌표). 모든 방은 오리지널 디자인.
// 표기: {J}=점프 {A}=공격 {D}=대시 {H}=회복 {U}=위 {DN}=아래 {LR}=좌우

export const ZONES = {
  1: { name: '잿빛 입구', sub: 'Ashen Gate', music: 'zone1' },
  2: { name: '침수된 회랑', sub: 'Drowned Gallery', music: 'zone2' },
  3: { name: '꺼진 성소', sub: 'Unlit Sanctum', music: 'zone3' },
  4: { name: '주홍 무대', sub: 'Scarlet Stage', music: 'zone2' },
};

export const STORY = {
  rooms: [
    // ───────── 구역 1: 잿빛 입구 ─────────
    {
      id: 'a1', zone: 1, name: '추락 지점', x: 0, y: 0, w: 40, h: 22, dark: 0.35,
      build: (r) => {
        r.solid(0, 17, 40, 5).solid(1, 14, 5, 3).solid(15, 15, 4, 2);
        r.solid(10, 1, 3, 3).solid(26, 1, 2, 4).solid(32, 1, 4, 2);
        r.spawn(9, 16);
        r.lamp(12, 16);
        r.sign(8, 16, '{LR} 이동    {J} 점프 (길게 누르면 높게)');
        r.sign(24, 16, '{A} 공격    {U}/{DN} + {A} 위·아래 베기');
        r.pickup('amber', 3, 13, 'a1_amb', 15);
        r.e('crawler', 31, 16);
      },
    },
    {
      id: 'a2', zone: 1, name: '잿빛 길', x: 40, y: 0, w: 60, h: 22, dark: 0.4,
      build: (r) => {
        r.solid(0, 17, 60, 5);
        r.empty(20, 17, 6, 3).spike(20, 19, 6);
        r.sign(14, 16, '공중에서 {DN}+{A} : 가시나 적을 밟고 튀어오르기');
        r.plat(32, 13, 5).plat(40, 10, 5).solid(48, 7, 11, 2);
        r.pickup('shard', 55, 6, 'a2_shard');
        r.solid(6, 1, 4, 2).solid(28, 1, 3, 3);
        r.lamp(4, 16);
        r.e('crawler', 11, 16).e('guard', 44, 16).e('moth', 36, 6);
      },
    },
    {
      id: 'a3', zone: 1, name: '등불 쉼터', x: 100, y: 0, w: 34, h: 22, dark: 0.15,
      build: (r) => {
        r.solid(0, 17, 34, 5).solid(14, 1, 6, 2);
        r.bench(12, 16).shop(24, 16);
        r.lamp(8, 16).lamp(20, 16).lamp(29, 16);
        r.sign(17, 16, '{U} 벤치에 앉기 : 저장 · 체력 회복');
        r.sign(5, 16, '적을 베어 불씨를 모으고 {H} 길게 : 회복');
      },
    },
    {
      id: 'a4', zone: 1, name: '갈라진 낭떠러지', x: 134, y: 0, w: 30, h: 52, dark: 0.5,
      build: (r) => {
        r.solid(0, 17, 8, 2);
        r.plat(12, 21, 9).plat(20, 25, 9).plat(8, 29, 9).plat(1, 33, 9).plat(12, 37, 9).plat(20, 41, 9).plat(6, 44, 9);
        r.solid(0, 48, 30, 4).spike(1, 47, 5);
        r.sign(4, 16, '{DN}+{J} : 발판 아래로 내려가기');
        r.lamp(3, 16);
        r.pickup('amber', 27, 40, 'a4_amb', 30);
        r.e('crawler', 24, 24).e('moth', 15, 27).e('moth', 10, 39).e('crawler', 16, 36);
      },
    },
    {
      id: 'a5', zone: 1, name: '둥지 앞 길목', x: 164, y: 36, w: 40, h: 16, dark: 0.45,
      build: (r) => {
        r.solid(0, 12, 40, 4).solid(14, 1, 8, 2).solid(30, 1, 3, 3);
        r.bench(6, 11).lamp(10, 11).lamp(2, 11);
        r.e('guard', 20, 11).e('crawler', 28, 11).e('moth', 25, 5);
      },
    },
    {
      id: 'a6', zone: 1, name: '심지의 둥지', x: 204, y: 30, w: 44, h: 22, dark: 0.5, bossRoom: true,
      build: (r) => {
        r.solid(0, 18, 44, 4).solid(10, 1, 2, 3).solid(30, 1, 3, 2).solid(20, 1, 4, 1);
        r.boss('mother', 26, 17, 7, [[1, 13, 1, 5], [42, 13, 1, 5]]);
        r.shrine('dash', 22, 17);
        r.sign(15, 17, '{D} 대시 : 공중에서도 한 번', 'dash');
      },
    },
    // ───────── 구역 2: 침수된 회랑 ─────────
    {
      id: 'b1', zone: 2, name: '물길 입구', x: 248, y: 38, w: 50, h: 14, dark: 0.45,
      build: (r) => {
        r.solid(0, 10, 50, 4);
        r.empty(14, 10, 10, 2).liquid(14, 11, 10, 1);
        r.sign(7, 9, '점프 후 {D} : 넓은 물길 건너기');
        r.lamp(3, 9).lamp(27, 9);
        r.e('dropper', 33, 1).e('frog', 41, 9);
      },
    },
    {
      id: 'b2', zone: 2, name: '침수 회랑', x: 298, y: 30, w: 56, h: 22, dark: 0.5,
      build: (r) => {
        r.solid(0, 18, 56, 4);
        r.empty(12, 18, 6, 2).liquid(12, 19, 6, 1);
        r.empty(28, 18, 8, 2).liquid(28, 19, 8, 1).plat(30, 15, 4);
        r.solid(38, 6, 18, 2).plat(33, 13, 4);
        r.brk('b2_secret', 53, 2, 2, 4, 4);
        r.solid(6, 1, 3, 3).solid(20, 1, 5, 2);
        r.lamp(4, 17).lamp(24, 17);
        r.pickup('amber', 47, 5, 'b2_amb', 60);
        r.e('dropper', 20, 3).e('dropper', 45, 8).e('frog', 23, 17).e('frog', 46, 17).e('vine', 54, 14, { dir: -1 });
      },
    },
    {
      id: 'b3', zone: 2, name: '덩굴 갱도', x: 354, y: 38, w: 32, h: 40, dark: 0.55,
      build: (r) => {
        r.solid(0, 10, 8, 2);
        r.plat(12, 14, 9).plat(22, 18, 9).plat(10, 22, 9).plat(1, 26, 9).plat(12, 30, 9).plat(21, 33, 9);
        r.solid(0, 36, 32, 4).empty(8, 36, 14, 2).liquid(8, 37, 14, 1).solid(14, 36, 3, 2);
        r.pickup('shard', 15, 35, 'b3_shard');
        r.lamp(27, 35).lamp(3, 9);
        r.e('vine', 1, 17, { dir: 1 }).e('vine', 30, 24, { dir: -1 }).e('vine', 1, 31, { dir: 1 }).e('moth', 16, 20);
      },
    },
    {
      id: 'b4', zone: 2, name: '종탑 아래', x: 386, y: 60, w: 36, h: 18, dark: 0.35,
      build: (r) => {
        r.solid(0, 14, 36, 4).solid(16, 1, 6, 3);
        r.bench(8, 13).lamp(5, 13).lamp(12, 13);
        r.e('frog', 23, 13).e('dropper', 29, 1);
      },
    },
    {
      id: 'b5', zone: 2, name: '가라앉은 종탑', x: 422, y: 50, w: 40, h: 28, dark: 0.5, bossRoom: true,
      build: (r) => {
        r.solid(0, 24, 40, 4).solid(30, 8, 10, 16);
        r.plat(3, 18, 6).plat(13, 15, 6).plat(22, 18, 6);
        r.boss('bell', 15, 23, 6, [[1, 19, 1, 5], [39, 3, 1, 5]]);
        r.shrine('wall', 9, 23);
        r.sign(20, 23, '벽에 붙어 {J} : 벽 점프로 오르기', 'wall');
      },
    },
    // ───────── 구역 3: 꺼진 성소 ─────────
    {
      id: 'c1', zone: 3, name: '성소 계단', x: 462, y: 40, w: 40, h: 24, dark: 0.6,
      build: (r) => {
        r.solid(0, 18, 12, 6).solid(12, 22, 28, 2).spike(12, 21, 27);
        r.solid(16, 12, 3, 10).solid(24, 8, 3, 14).solid(32, 7, 7, 2);
        r.lamp(4, 17);
        r.pickup('shard', 25, 7, 'c1_shard');
        r.e('moth', 21, 5).e('monk', 35, 6);
      },
    },
    {
      id: 'c2', zone: 3, name: '재의 회랑', x: 502, y: 34, w: 60, h: 16, dark: 0.6,
      build: (r) => {
        r.solid(0, 13, 60, 3).solid(8, 1, 4, 3).solid(26, 1, 6, 2).solid(44, 1, 3, 4);
        r.lamp(3, 12).lamp(30, 12).lamp(57, 12);
        r.pickup('amber', 28, 12, 'c2_amb', 80);
        r.e('monk', 18, 12).e('knight', 40, 12).e('moth', 30, 5).e('monk', 52, 12);
      },
    },
    {
      id: 'c3', zone: 3, name: '마지막 쉼터', x: 562, y: 34, w: 30, h: 16, dark: 0.2,
      build: (r) => {
        r.solid(0, 13, 30, 3).solid(12, 1, 6, 2);
        r.bench(10, 12).shop(20, 12);
        r.lamp(6, 12).lamp(15, 12).lamp(25, 12);
      },
    },
    {
      id: 'c4', zone: 3, name: '날개의 시련', x: 592, y: 20, w: 34, h: 30, dark: 0.55,
      build: (r) => {
        r.solid(0, 27, 34, 3).solid(1, 1, 13, 14).solid(19, 1, 14, 14);
        r.plat(20, 23, 5).plat(11, 19, 5);
        r.shrine('djump', 16, 26);
        r.sign(6, 26, '공중에서 {J} 한 번 더 : 이단 점프', 'djump');
        r.lamp(3, 26).lamp(30, 26);
        r.e('knight', 8, 26).e('knight', 26, 26);
      },
    },
    {
      id: 'c5', zone: 3, name: '등불의 계단', x: 592, y: 4, w: 34, h: 16, dark: 0.45,
      build: (r) => {
        r.solid(12, 1, 10, 2);
        r.bench(6, 14);
        r.lamp(3, 14).lamp(10, 14).lamp(24, 14).lamp(30, 14);
        r.sign(27, 14, '이 너머, 마지막 등불지기가 기다린다');
      },
    },
    {
      id: 'c6', zone: 3, name: '꺼지지 않는 제단', x: 626, y: 0, w: 44, h: 20, dark: 0.55, bossRoom: true,
      build: (r) => {
        r.solid(0, 15, 44, 5).solid(15, 1, 14, 1);
        r.boss('keeper', 30, 14, 7, [[1, 10, 1, 5]]);
      },
    },
    // ───────── 숨겨진 구역: 주홍 무대 ─────────
    {
      id: 'h1', zone: 4, name: '무대 뒤편', x: 354, y: 12, w: 30, h: 26, dark: 0.55,
      build: (r) => {
        r.solid(0, 24, 30, 2).solid(22, 20, 8, 4).spike(6, 23, 14);
        r.plat(9, 19, 3).plat(15, 17, 3);
        r.pickup('shard', 3, 23, 'h1_shard');
        r.lamp(26, 19);
        r.e('moth', 12, 10).e('moth', 20, 8);
      },
    },
    {
      id: 'h2', zone: 4, name: '주홍 무대', x: 384, y: 12, w: 36, h: 22, dark: 0.45, bossRoom: true,
      build: (r) => {
        r.solid(0, 20, 36, 2);
        r.boss('scarlet', 22, 19, 6, [[1, 16, 1, 4]]);
        r.shrine('mask3', 18, 19);
      },
    },
  ],
  doors: [
    ['v', 40, 12, 5], ['v', 100, 12, 5], ['v', 134, 12, 5], ['v', 164, 43, 5], ['v', 204, 43, 5],
    ['v', 248, 43, 5], ['v', 298, 43, 5], ['v', 354, 43, 5], ['v', 354, 32, 4], ['v', 386, 69, 5],
    ['v', 422, 69, 5], ['v', 462, 53, 5], ['v', 502, 42, 5], ['v', 562, 42, 5], ['v', 592, 42, 5],
    ['h', 606, 20, 5], ['v', 626, 10, 5], ['v', 384, 28, 4],
  ],
};

// ───────── 스피드런 레이스 코스 ─────────
export const COURSES = [
  {
    id: 'ash', name: '잿빛 질주', zone: 1, music: 'race',
    rooms: [{
      id: 'r1', zone: 1, name: '잿빛 질주', x: 0, y: 0, w: 150, h: 20, dark: 0.3,
      build: (r) => {
        r.solid(0, 16, 150, 4);
        r.spawn(3, 15);
        r.empty(14, 16, 5, 2).spike(14, 17, 5);
        r.solid(24, 12, 4, 4);
        r.empty(34, 16, 9, 2).liquid(34, 17, 9);
        r.spike(50, 15, 20).plat(53, 12, 3).plat(59, 10, 3).plat(65, 12, 3);
        r.solid(76, 1, 12, 11);
        r.solid(92, 6, 3, 10);
        r.spike(104, 15, 10).plat(108, 12, 2).e('crawler', 100, 15);
        r.solid(120, 10, 6, 6).empty(126, 16, 8, 2).liquid(126, 17, 8);
        r.plat(130, 11, 3);
        r.lamp(5, 15).lamp(30, 15).lamp(73, 15).lamp(98, 15).lamp(137, 15);
        r.finish(140, 6, 9, 10);
      },
    }],
  },
  {
    id: 'water', name: '물길 질주', zone: 2, music: 'race',
    rooms: [{
      id: 'r2', zone: 2, name: '물길 질주', x: 0, y: 0, w: 160, h: 24, dark: 0.35,
      build: (r) => {
        r.solid(0, 20, 160, 4);
        r.spawn(3, 19);
        r.empty(12, 20, 6, 2).liquid(12, 21, 6);
        r.solid(22, 15, 3, 5).solid(30, 12, 3, 8);
        r.empty(40, 20, 40, 3).liquid(40, 21, 40, 2);
        r.solid(48, 1, 2, 7).solid(60, 1, 2, 8).solid(72, 1, 2, 7);
        r.plat(44, 16, 3).plat(52, 14, 3).plat(58, 16, 3).plat(65, 14, 3).plat(73, 15, 3);
        r.solid(86, 6, 20, 14);
        r.spike(110, 19, 16).plat(113, 15, 3).plat(120, 13, 3);
        r.e('dropper', 116, 1);
        r.solid(130, 14, 3, 6).solid(136, 10, 3, 10);
        r.lamp(4, 19).lamp(35, 19).lamp(96, 5).lamp(128, 19);
        r.finish(146, 8, 13, 12);
      },
    }],
  },
  {
    id: 'climb', name: '성소 등반', zone: 3, music: 'race',
    rooms: [{
      id: 'r3', zone: 3, name: '성소 등반', x: 0, y: 0, w: 32, h: 90, dark: 0.45,
      build: (r) => {
        r.solid(0, 86, 32, 4);
        r.spawn(5, 85);
        r.plat(10, 82, 6).plat(18, 78, 6).plat(8, 74, 6);
        r.solid(1, 58, 10, 14).solid(16, 58, 15, 14).spike(1, 57, 10);
        r.plat(17, 53, 5).plat(25, 49, 5).plat(14, 45, 5);
        r.solid(1, 40, 8, 2).plat(14, 38, 4).solid(22, 36, 9, 2).plat(13, 34, 4).solid(1, 32, 8, 2);
        r.solid(8, 12, 3, 14).solid(20, 14, 3, 12);
        r.e('moth', 16, 20).e('moth', 24, 42);
        r.lamp(4, 85).lamp(28, 57).lamp(4, 31);
        r.finish(1, 1, 30, 9);
      },
    }],
  },
];

// ───────── 보스 러시 무대 ─────────
export const RUSH = {
  rooms: [{
    id: 'rush', zone: 3, name: '기억의 무대', x: 0, y: 0, w: 44, h: 20, dark: 0.45, bossRoom: true,
    build: (r) => {
      r.solid(0, 15, 44, 5);
      r.plat(5, 11, 6).plat(19, 8, 6).plat(33, 11, 6);
      r.spawn(6, 14);
      r.lamp(3, 14).lamp(40, 14);
    },
  }],
  doors: [],
};
export const RUSH_ORDER = ['mother', 'bell', 'scarlet', 'keeper'];
