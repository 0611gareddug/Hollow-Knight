// 마을 주민 (구출 후 등불 쉼터 마을로 이주). 각자 구출 대사 · 마을 대사 · 기능을 가짐.
export const NPCS = {
  durumi: {
    name: '두루미', title: '떠돌이 지도장이', color: '#c9b48a', shape: 'crane',
    rescue: [
      '어이쿠, 덩굴에 다리가 걸려서 꼼짝도 못 하고 있었다네.',
      '이 근처 지도를 그리다가 그만… 고맙네, 작은 기사여.',
      '등불 쉼터로 가겠네. 거기서 지도를 다듬고 있을 테니 꼭 들르게.',
    ],
    village: [
      '지도는 발로 그리는 거라네. 하지만 내 발은 이제 늙었지.',
      '불씨를 조금만 주면 내가 다녀온 길을 모두 그려 주겠네.',
    ],
    service: 'map',
  },
  moru: {
    name: '모루', title: '늙은 대장장이', color: '#8a5a3a', shape: 'smith',
    rescue: [
      '…불이 다 꺼진 줄 알았는데, 아직 숨이 붙어 있었구먼.',
      '내 망치는 아직 녹슬지 않았다. 쉼터에 화로를 피워 두마.',
    ],
    village: [
      '심지검은 두 번 담금질하면 끝이라 생각하지? 아니다.',
      '세 번째 담금질은 서리 속에서 식혀야 하지. 재료값은 받으마.',
    ],
    service: 'nail',
  },
  gomok: {
    name: '고목', title: '말하는 늙은 나무', color: '#4a6a3a', shape: 'tree',
    rescue: [
      '…오오… 누가… 내 뿌리 위의 재를 털어 주었구나…',
      '천천히… 아주 천천히… 쉼터로 뿌리를 옮기마…',
    ],
    village: ['…바람이… 들려주는 이야기가 있지…'],
    service: 'hint',
  },
  iseul: {
    name: '이슬', title: '아이 순례자', color: '#9ad0d8', shape: 'child',
    rescue: [
      '흐아앙… 길을 잃었어요. 등불이 다 꺼져서 무서웠어요.',
      '기사님 따라 쉼터로 갈래요! 고마워요!',
    ],
    village: [
      '기사님! 제가 모은 반짝이는 조각이에요. 기사님 가면에 딱 맞을 것 같아요!',
    ],
    after: ['오늘도 쉼터 등불이 따뜻해요. 기사님 덕분이에요!'],
    service: 'gift',
  },
  hyeon: {
    name: '현', title: '현악기 음유시인', color: '#7a5aa0', shape: 'bard',
    rescue: [
      '아아, 마지막 줄이 끊어지기 전에 와 주었군요.',
      '쉼터에서 연주회를 열겠습니다. 첫 곡은 당신을 위해.',
    ],
    village: [
      '들어 보시겠어요? 불이 처음 켜지던 날의 노래랍니다.',
    ],
    after: ['노래는 잊히지 않는 한 꺼지지 않는 등불이지요.'],
    service: 'music',
  },
  seorigit: {
    name: '서리깃', title: '눈보라 속의 파수꾼', color: '#c8e4f8', shape: 'guard',
    rescue: [
      '…얼음 속에 갇혀 백 년을 지낸 기분이군.',
      '변경의 파수꾼으로서 은혜는 갚겠다. 쉼터에서 기다리지.',
    ],
    village: [
      '부적을 하나 더 품을 수 있도록 홈을 새겨 주지. 서리의 칼로.',
    ],
    after: ['눈보라가 거세질수록 등불을 가까이 두어라.'],
    service: 'notch',
  },
};
export const NPC_IDS = Object.keys(NPCS);

// 고목의 귀띔: 진행도에 맞춰 다음 목적지를 알려 줌
export function gomokHint(save) {
  const b = save.bosses || {}, a = save.abilities || {};
  if (!b.mother) return '…아래쪽 굴 깊은 곳에… 촛농의 어미가 잠들어 있다…';
  if (!a.dash) return '…어미가 지키던 제단에… 바람처럼 달리는 힘이 남아 있다…';
  if (!b.bell) return '…물에 잠긴 종탑… 종지기가 아직 종을 울린다…';
  if (!b.keeper) return '…가장 높은 첨탑에서… 마지막 등불지기가 기다린다…';
  if (!b.smith) return '…다시 타오른 상층… 망치 소리를 따라가거라…';
  if (!b.devourer) return '…재를 삼킨 자가 하늘을 덮고 있다… 사슬로 높이 올라라…';
  if (!b.stag) return '…용광로 너머 얼어붙은 변경… 눈뿔 사슴이 길을 막고 있다…';
  if (!b.empress) return '…얼음 호수의 여제… 횃불을 모두 밝혀야 길이 열린다…';
  if (!b.blizzard) return '…산꼭대기의 눈보라… 그것이 마지막 불을 삼키려 한다…';
  if (!b.shademoth) return '…첫 번째 동굴의 천장 너머… 그림자 나방이 숨어 있다는 소문이…';
  return '…이제 바람도 조용하구나… 고맙다, 작은 등불이여…';
}
