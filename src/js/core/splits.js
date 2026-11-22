// 스피드런 스플릿 타이머 (LiveSplit 스타일). 시간 = 게임 내 시간(일시정지 제외)
import { profile, saveProfile } from './settings.js';
import { fmtTime } from './util.js';

export const SPLITS = [
  // 1장
  { k: 'boss:mother', n: '심지의 어미', ch: 1 },
  { k: 'ab:dash', n: '대시 획득', ch: 1 },
  { k: 'zone:2', n: '침수된 회랑', ch: 1 },
  { k: 'boss:bell', n: '잠긴 종지기', ch: 1 },
  { k: 'ab:wall', n: '벽 타기 획득', ch: 1 },
  { k: 'zone:3', n: '꺼진 성소', ch: 1 },
  { k: 'ab:djump', n: '이단 점프 획득', ch: 1 },
  { k: 'boss:keeper', n: '마지막 등불지기', ch: 1, end: 1 },
  // 2장
  { k: 'zone:5', n: '녹슨 톱니 도시', ch: 2 },
  { k: 'ab:hook', n: '불씨 사슬 획득', ch: 2 },
  { k: 'boss:smith', n: '톱니 대장장이', ch: 2 },
  { k: 'zone:6', n: '하늘 정원', ch: 2 },
  { k: 'boss:queen', n: '흰 날개 여왕', ch: 2 },
  { k: 'zone:7', n: '재의 왕좌', ch: 2 },
  { k: 'boss:devourer', n: '재를 삼킨 자', ch: 2, end: 1 },
  // 3장
  { k: 'zone:8', n: '얼어붙은 변경', ch: 3 },
  { k: 'boss:stag', n: '눈뿔 사슴', ch: 3 },
  { k: 'ab:slam', n: '내려찍기 획득', ch: 3 },
  { k: 'zone:9', n: '서리 호수', ch: 3 },
  { k: 'boss:empress', n: '서리 여제', ch: 3 },
  { k: 'zone:10', n: '눈보라 산정', ch: 3 },
  { k: 'boss:blizzard', n: '눈보라 군주', ch: 3, end: 1 },
];
const IDX = Object.fromEntries(SPLITS.map((s, i) => [s.k, i]));

// 스플릿 도달 기록. 반환: 표시용 정보 또는 null(해당 없음/이미 기록)
export function hitSplit(save, k) {
  if (IDX[k] == null) return null;
  save.splits = save.splits || {};
  if (save.splits[k] != null) return null;
  const t = save.playTime;
  save.splits[k] = t;
  const i = IDX[k];
  const best = (profile.pbSplits = profile.pbSplits || {});
  const gold = (profile.goldSegs = profile.goldSegs || {});
  // 직전 스플릿(같은 장, 기록된 것) 기준 구간 시간
  let prevT = 0;
  for (let j = i - 1; j >= 0; j--) if (save.splits[SPLITS[j].k] != null) { prevT = save.splits[SPLITS[j].k]; break; }
  const seg = t - prevT;
  const delta = best[k] != null ? t - best[k] : null;
  const isGold = gold[k] == null || seg < gold[k];
  save.splitInfo = save.splitInfo || {};
  save.splitInfo[k] = { delta, gold: isGold };
  if (best[k] == null || t < best[k]) best[k] = t;
  if (isGold) gold[k] = seg;
  saveProfile();
  return { k, t, delta, gold: isGold, end: !!SPLITS[i].end };
}

const fmtDelta = (d) => (d < 0 ? '−' : '+') + (Math.abs(d) < 60 ? Math.abs(d).toFixed(1) : fmtTime(Math.abs(d)).replace(/\.\d+$/, ''));

// 타이머 패널 그리기. 반환: 패널 높이 (다른 오버레이 배치용)
export function drawSplits(ctx, g, W, ui, SANS) {
  const save = g.save;
  if (!save) return 0;
  const sp = save.splits || {}, info = save.splitInfo || {};
  // 현재 장: 아직 끝내지 않은 첫 장
  // 현재 장: 아직 끝내지 않은 첫 장 (방금 끝낸 장은 15초 동안 최종 기록 표시)
  let ch = 1;
  for (const s of SPLITS) if (s.end && sp[s.k] != null) ch = save.playTime - sp[s.k] < 15 ? s.ch : Math.min(3, s.ch + 1);
  const list = SPLITS.filter((s) => s.ch === ch);
  const doneAll = list.every((s) => sp[s.k] != null);
  const endT = doneAll ? sp[list[list.length - 1].k] : null;
  const t = endT != null ? endT : save.playTime;
  const pw = 250 * ui, rowH = 21 * ui, pad = 10 * ui;
  const x0 = W - pw - 14 * ui, y0 = 14 * ui;
  const ph = pad * 2 + 22 * ui + list.length * rowH + 46 * ui;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,12,0.72)';
  ctx.fillRect(x0, y0, pw, ph);
  ctx.strokeStyle = 'rgba(255,213,138,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${13 * ui}px ${SANS}`;
  ctx.fillStyle = '#ffd58a';
  ctx.textAlign = 'left';
  ctx.fillText(`${ch}장 Any%`, x0 + pad, y0 + pad + 9 * ui);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9fb0ac';
  ctx.font = `500 ${11 * ui}px ${SANS}`;
  ctx.fillText('게임 내 시간', x0 + pw - pad, y0 + pad + 9 * ui);
  let y = y0 + pad + 22 * ui;
  const cur = list.findIndex((s) => sp[s.k] == null);
  list.forEach((s, i) => {
    const yy = y + i * rowH + rowH / 2;
    if (i === cur) {
      ctx.fillStyle = 'rgba(255,213,138,0.14)';
      ctx.fillRect(x0 + 2, yy - rowH / 2, pw - 4, rowH);
    }
    ctx.textAlign = 'left';
    ctx.font = `${i === cur ? 700 : 500} ${12.5 * ui}px ${SANS}`;
    ctx.fillStyle = sp[s.k] != null ? '#e8dcc0' : i === cur ? '#ffffff' : '#8a9894';
    ctx.fillText(s.n, x0 + pad, yy);
    ctx.textAlign = 'right';
    if (sp[s.k] != null) {
      const inf = info[s.k] || {};
      ctx.fillStyle = '#e8dcc0';
      ctx.fillText(fmtTime(sp[s.k]).replace(/\.\d+$/, ''), x0 + pw - pad, yy);
      if (inf.delta != null || inf.gold) {
        ctx.fillStyle = inf.gold ? '#ffd23a' : inf.delta < 0 ? '#5ee07a' : '#ff6a6a';
        ctx.fillText(inf.delta != null ? fmtDelta(inf.delta) : '★', x0 + pw - pad - 58 * ui, yy);
      }
    } else {
      const pb = (profile.pbSplits || {})[s.k];
      ctx.fillStyle = '#6a7874';
      ctx.fillText(pb != null ? fmtTime(pb).replace(/\.\d+$/, '') : '—', x0 + pw - pad, yy);
      // 진행 중인 스플릿: 최고 기록보다 늦어지면 실시간 차이 표시
      if (i === cur && pb != null && t > pb - 10) {
        ctx.fillStyle = t > pb ? '#ff6a6a' : '#5ee07a';
        ctx.fillText(fmtDelta(t - pb), x0 + pw - pad - 58 * ui, yy);
      }
    }
  });
  // 큰 타이머
  y += list.length * rowH + 6 * ui;
  ctx.textAlign = 'right';
  ctx.font = `700 ${30 * ui}px "Noto Sans KR", monospace`;
  const pbCur = cur >= 0 ? (profile.pbSplits || {})[list[cur].k] : null;
  ctx.fillStyle = doneAll ? '#ffd23a' : pbCur != null && t > pbCur ? '#ff8a7a' : '#7ef0a0';
  const tt = fmtTime(t);
  ctx.fillText(tt, x0 + pw - pad, y + 20 * ui);
  ctx.restore();
  return ph + 14 * ui;
}
