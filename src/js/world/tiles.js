// 타일 종류
export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_PLAT = 2; // 아래에서 통과 가능한 발판
export const T_SPIKE = 3;
export const T_LIQUID = 4;
export const T_BREAK = 5; // 부술 수 있는 벽
export const T_GATE = 6; // 보스 문 (닫힘)

export const isSolidT = (t) => t === T_SOLID || t === T_BREAK || t === T_GATE;
