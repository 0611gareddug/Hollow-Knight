# 🏮 Lanternfall (랜턴폴)

꺼져가는 등불의 지하 왕국을 나방 기사들이 함께 탐험하는 **2D 메트로배니아 액션** (오리지널 작품).
PC · 모바일 브라우저에서 바로 플레이할 수 있고, 설치나 서버가 필요 없습니다.

## 모드
| 모드 | 설명 |
|---|---|
| 혼자 하기 | **1장** 3개 구역 + 숨겨진 구역 (방 19개, 보스 4) · **2장 「되살아난 불의 상층」** 3개 구역 (방 13개, 보스 3, 새 능력 불씨 사슬) |
| 함께 하기 (최대 4인) | 방 코드로 P2P 접속 → **협동 이야기 / 스피드런 레이스 / 보스 러시** |
| 스피드런 연습 | 레이스 코스 3개, 개인 최고 기록 저장 |
| 보스 러시 | 처치한 보스들과 연속 전투, 시간 기록 |

## 조작
| | 키보드 | 게임패드 | 모바일 |
|---|---|---|---|
| 이동 | ← → / A D | 스틱 | 조이스틱 |
| 점프 (길게 = 높게) | Z / Space | Ⓐ | 점프 |
| 공격 (↑↓ 조합) | X / J | Ⓧ | 공격 |
| 대시 | C / Shift | Ⓑ | 대시 |
| 회복 (길게) | V / F | Ⓨ | 회복 |
| 불씨 사슬 (2장) | Q / 좌클릭(커서 조준) | RB | 사슬 |
| 지도 / 메뉴 | Tab / Esc | Back / Start | 지도 / Ⅱ |

## 폴더 구조
```
src/            ← 원본 소스 (난독화 전, 유지보수용)
  index.html, style.css
  js/core/      입력·사운드·설정·저장·보호
  js/world/     맵 데이터(data.js)·충돌
  js/entities/  플레이어·몹 8종·보스 4종·투사체·시뮬레이션
  js/render/    지형·배경·조명·이펙트·캐릭터 그리기
  js/net/       P2P 네트워크 (PeerJS)
  js/ui/        HUD·메뉴·터치 조작
docs/           ← 배포용 (난독화된 빌드 결과, GitHub Pages가 여기를 서비스)
tools/          빌드·맵 검증·도달성 검증 봇
```

## 빌드
```bash
npm install
npm run build      # src → docs (번들 + 난독화 + 보호)
npm run dev        # .build/dev (난독화 없는 개발용)
npm run check      # 맵 데이터 검증
node tools/reach.mjs story   # 실제 물리로 진행 가능 여부 검증
```

## GitHub Pages 배포
1. 이 브랜치를 `main`에 병합합니다.
2. 저장소 **Settings → Pages → Build and deployment**로 이동합니다.
3. Source를 `Deploy from a branch`, Branch를 `main` / `/docs`로 지정하고 저장합니다.
4. 1~2분 뒤 `https://0611gareddug.github.io/Hollow-Knight/` 에서 플레이할 수 있습니다.

> 멀티플레이는 PeerJS 공개 시그널링 서버 + WebRTC를 사용합니다. 일부 회사·학교 네트워크(대칭형 NAT)에서는 연결이 안 될 수 있습니다.
