// 스피드런 가이드 영상 촬영: 시드 고정 주행을 1080p 30fps로 캡처 (ffmpeg로 바로 인코딩) + 효과음/음악 이벤트 기록
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn } = require('child_process');
const SEED = Number(process.env.SEED || 1);
const OUTDIR = process.env.OUTDIR || 'guide';
const FPS = 30;
const NOSHOT = !!process.env.NOSHOT;
const MAXT = Number(process.env.MAXT || 0);
(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
  await p.addInitScript((seed) => {
    // 시뮬레이션(주행 중 게임 스텝)만 고정 시드 난수를 쓰고, 렌더링·메뉴는 일반 난수 → 재현 가능
    let st = seed >>> 0;
    const seeded = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const orig = Math.random;
    window.__simRng = false;
    Math.random = () => (window.__simRng ? seeded() : orig());
    window.__rng = { get: () => st, set: (v) => { st = v; } };
    localStorage.clear();
    localStorage.setItem('lf_settings_v1', JSON.stringify({ streamer: true, timer: true, streamerPos: 'br' }));
    localStorage.setItem('lf_profile_v1', JSON.stringify({ name: '가이드' }));
  }, SEED);
  await p.goto('http://localhost:8765/');
  await p.waitForTimeout(1200);
  await p.evaluate(() => { __game.manual = true; });
  await p.click('button[data-a=solo]');
  await p.waitForTimeout(500);
  const route = JSON.parse(fs.readFileSync('/home/user/Hollow-Knight/tools/route_ch1.json', 'utf8'));
  const meta = [['mother', null], [null, 'dash'], ['bell', null], [null, 'wall'], [null, 'djump'], ['keeper', null]];
  route.forEach((L, i) => { L.bossKind = meta[i][0]; L.shrineAb = meta[i][1]; });
  await p.evaluate((r) => { window.__route = r; __game.manual = true; }, route);
  await p.addScriptTag({ path: 'runner.js' });
  await p.evaluate(() => { __game._ending = () => {}; });
  // 오디오 이벤트 기록 + 화면 오버레이
  await p.evaluate(() => {
    const A = __audio, R = __run;
    window.__alog = [];
    const vt = () => (window.__vt || 0);
    const play0 = A.play.bind(A), music0 = A.music.bind(A), hb0 = A.setHeartbeat.bind(A);
    A.play = (name, opt) => { __alog.push([vt(), 'p', name, opt || {}]); return play0(name, opt); };
    A.music = (name) => { __alog.push([vt(), 'm', name]); return music0(name); };
    A.setHeartbeat = (on) => { if (!!on !== !!A._hbLogged) { A._hbLogged = !!on; __alog.push([vt(), 'h', !!on]); } return hb0(on); };
    const SERIF = '"Noto Serif KR", serif', SANS = '"Noto Sans KR", sans-serif';
    window.__overlay = (ctx, W, H) => {
      const t = window.__vt || 0;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const s = H / 1080;
      // 인트로 카드
      if (window.__phase === 'intro') {
        const k = Math.min(1, t / 0.8), out = window.__introOut || 0;
        ctx.globalAlpha = 1 - out;
        ctx.fillStyle = 'rgba(4,6,8,0.86)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = (1 - out) * k;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd58a';
        ctx.font = `600 ${30 * s}px ${SANS}`;
        ctx.fillText('LANTERNFALL  스피드런 가이드', W / 2, H * 0.36);
        ctx.fillStyle = '#f4ecd8';
        ctx.font = `700 ${96 * s}px ${SERIF}`;
        ctx.fillText('1장 Any%', W / 2, H * 0.48);
        ctx.fillStyle = '#c8c0ac';
        ctx.font = `500 ${28 * s}px ${SANS}`;
        ctx.fillText('새 게임 시작 → 마지막 등불지기 처치까지 · 게임 내 시간(IGT) 기준', W / 2, H * 0.56);
        ctx.fillStyle = '#9fb0ac';
        ctx.font = `500 ${24 * s}px ${SANS}`;
        ctx.fillText('설정 → 스트리머 모드: 입력 키 표시 · 스피드런 스플릿 타이머 켜짐', W / 2, H * 0.62);
        ctx.fillText('핵심 테크는 0.35배속 슬로모션으로 보여 줍니다', W / 2, H * 0.66);
      }
      // 테크 자막
      const c = R.caption;
      if (c) {
        const a = Math.min(1, c.t / 0.25, (3.2 - c.t) / 0.4);
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = `700 ${34 * s}px ${SANS}`;
        ctx.textAlign = 'center';
        const label = c.text;
        const w = ctx.measureText(label).width + 90 * s;
        const y = H * 0.8;
        ctx.fillStyle = 'rgba(6,8,12,0.78)';
        ctx.fillRect(W / 2 - w / 2, y - 52 * s, w, 92 * s);
        ctx.fillStyle = '#ffd58a';
        ctx.fillRect(W / 2 - w / 2, y - 52 * s, 6 * s, 92 * s);
        ctx.font = `600 ${20 * s}px ${SANS}`;
        ctx.fillStyle = '#ffd58a';
        ctx.fillText(R.slow > 0 ? '핵심 테크 · 0.35배속' : '핵심 테크', W / 2, y - 20 * s);
        ctx.font = `700 ${34 * s}px ${SANS}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, W / 2, y + 22 * s);
        ctx.globalAlpha = 1;
      }
      // 슬로모션 표시 (화면 가장자리 띠)
      if (R.slow > 0) {
        ctx.fillStyle = 'rgba(255,213,138,0.5)';
        ctx.fillRect(0, 0, W, 5 * s);
        ctx.fillRect(0, H - 5 * s, W, 5 * s);
      }
      // 아웃트로
      if (window.__phase === 'outro') {
        const k = Math.min(1, (t - window.__outro0) / 1.0);
        ctx.globalAlpha = k;
        ctx.fillStyle = 'rgba(4,6,8,0.88)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd58a';
        ctx.font = `600 ${30 * s}px ${SANS}`;
        ctx.fillText('1장 Any% 완주', W / 2, H * 0.22);
        ctx.fillStyle = '#f4ecd8';
        ctx.font = `700 ${110 * s}px "Noto Sans KR", monospace`;
        ctx.fillText(window.__final || '', W / 2, H * 0.35);
        const rows = window.__rows || [];
        ctx.font = `500 ${27 * s}px ${SANS}`;
        rows.forEach((r, i) => {
          const y = H * 0.45 + i * 40 * s;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#c8c0ac';
          ctx.fillText(r[0], W / 2 - 300 * s, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = '#f4ecd8';
          ctx.fillText(r[1], W / 2 + 300 * s, y);
        });
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9fb0ac';
        ctx.font = `500 ${24 * s}px ${SANS}`;
        ctx.fillText('설정에서 스피드런 스플릿 타이머를 켜고 기록에 도전해 보세요', W / 2, H * 0.9);
      }
      ctx.restore();
    };
  });
  const ff = NOSHOT ? { stdin: { write: () => true, end() {} }, on: (e, f) => f() } : spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', `${OUTDIR}/video.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  let frames = 0;
  const shot = async () => {
    if (NOSHOT) { frames++; return; }
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    frames++;
  };
  const vdt = 1 / FPS;
  // 인트로 4.5초: 첫 화면 위에 제목 카드
  await p.evaluate(() => { window.__phase = 'intro'; window.__vt = 0; const rs = __rng.get(); __game.render(0); __rng.set(rs); });
  for (let i = 0; i < 3 * FPS; i++) {
    await p.evaluate(([i, vdt]) => {
      window.__vt = i * vdt;
      window.__introOut = Math.max(0, Math.min(1, (window.__vt - 2.5) / 0.5));
      const rs = __rng.get(); __game.render(0); __rng.set(rs);
    }, [i, vdt]);
    await shot();
  }
  // 주행
  await p.evaluate(() => { window.__phase = 'run'; });
  const t0 = Date.now();
  let endAt = null;
  for (let i = 0; i < FPS * 900; i++) {
    const st = await p.evaluate(([vdt, base]) => {
      window.__vt = base + __run.t + vdt;
      __run.frame(vdt);
      return { done: !!__game.save.bosses.keeper, deaths: __run.deaths, t: __run.t };
    }, [vdt, 3]);
    await shot();
    if (MAXT && st.t > MAXT) break;
    if (st.deaths) { console.log('DEATH at', st.t); if (NOSHOT) { console.log('RESULT death'); await b.close(); return; } break; }
    if (st.done && endAt == null) endAt = i + FPS * 3.2;
    if (endAt != null && i >= endAt) break;
    if (i % (FPS * 20) === 0) console.log('t', st.t.toFixed(1), 'frames', frames, 'real', ((Date.now() - t0) / 1000).toFixed(0));
  }
  if (NOSHOT) { console.log('RESULT ok', await p.evaluate(() => __game.save.playTime)); await b.close(); return; }
  // 아웃트로 7초
  const fin = await p.evaluate(() => {
    const sp = __game.save.splits || {};
    const names = { 'boss:mother': '심지의 어미', 'ab:dash': '대시 획득', 'zone:2': '침수된 회랑', 'boss:bell': '잠긴 종지기', 'ab:wall': '벽 타기 획득', 'zone:3': '꺼진 성소', 'ab:djump': '이단 점프 획득', 'boss:keeper': '마지막 등불지기' };
    const f = (x) => { const m = Math.floor(x / 60), s = Math.floor(x % 60), c = Math.floor((x * 100) % 100); return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
    window.__rows = Object.keys(names).filter((k) => sp[k] != null).map((k) => [names[k], f(sp[k])]);
    window.__final = f(sp['boss:keeper'] || __game.save.playTime);
    window.__phase = 'outro';
    window.__outro0 = window.__vt;
    return { final: window.__final, rows: window.__rows };
  });
  for (let i = 0; i < 7 * FPS; i++) {
    await p.evaluate((vdt) => { window.__vt += vdt; __run.frame(vdt); }, vdt);
    await shot();
  }
  const dur = frames / FPS;
  const alog = await p.evaluate(() => window.__alog);
  fs.writeFileSync(`${OUTDIR}/audio_log.json`, JSON.stringify({ dur, log: alog }));
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('FINAL', JSON.stringify(fin), 'frames', frames, 'dur', dur.toFixed(1), 'events', alog.length);
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
