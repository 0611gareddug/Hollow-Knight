// 기록된 효과음/음악 이벤트를 게임 오디오 엔진 그대로 OfflineAudioContext 에서 렌더링 → WAV
const { chromium } = require('playwright');
const fs = require('fs');
const OUTDIR = process.env.OUTDIR || 'guide';
(async () => {
  const { dur, log } = JSON.parse(fs.readFileSync(`${OUTDIR}/audio_log.json`, 'utf8'));
  // 시작 음악 보정: 인트로는 타이틀 곡, 주행 시작 시 1구역 곡
  const ev = log.slice().sort((a, b) => a[0] - b[0]);
  if (!ev.some((e) => e[1] === 'm' && e[0] < 3.2)) ev.unshift([3, 'm', 'zone1']);
  ev.unshift([0, 'm', 'title']);
  ev.push([dur - 6.5, 'm', 'ending']);
  ev.sort((a, b) => a[0] - b[0]);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:8765/');
  await p.waitForTimeout(800);
  const SR = 44100;
  const n = await p.evaluate(async ([ev, dur, SR]) => {
    const off = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
    let tNow = 0;
    const proxy = new Proxy(off, {
      get(tg, pr) {
        if (pr === 'currentTime') return tNow;
        const v = Reflect.get(tg, pr);
        return typeof v === 'function' ? v.bind(tg) : v;
      },
    });
    const AC0 = window.AudioContext;
    window.AudioContext = function () { return proxy; };
    const A = __audio;
    A.ctx = null;
    A.unlock();
    window.AudioContext = AC0;
    clearInterval(A._schedTimer);
    let i = 0;
    for (let t = 0; t <= dur; t += 0.05) {
      while (i < ev.length && ev[i][0] <= t) {
        const e = ev[i++];
        tNow = Math.max(0, e[0]);
        try {
          if (e[1] === 'p') A.play(e[2], e[3]);
          else if (e[1] === 'm') A.music(e[2]);
          else A.setHeartbeat(e[2]);
        } catch (err) {}
      }
      tNow = t;
      A._schedule();
    }
    const buf = await off.startRendering();
    const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
    const out = new Int16Array(L.length * 2);
    for (let k = 0; k < L.length; k++) {
      out[k * 2] = Math.max(-1, Math.min(1, L[k])) * 32767;
      out[k * 2 + 1] = Math.max(-1, Math.min(1, Rr[k])) * 32767;
    }
    window.__pcm = new Uint8Array(out.buffer);
    return window.__pcm.length;
  }, [ev, dur, SR]);
  const chunks = [];
  const CH = 8 * 1024 * 1024;
  for (let o = 0; o < n; o += CH) {
    const b64 = await p.evaluate(([o, CH]) => {
      const a = __pcm.subarray(o, o + CH);
      let s = '';
      for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
      return btoa(s);
    }, [o, CH]);
    chunks.push(Buffer.from(b64, 'base64'));
  }
  const pcm = Buffer.concat(chunks);
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(`${OUTDIR}/audio.wav`, Buffer.concat([hdr, pcm]));
  console.log('wav', (pcm.length / SR / 4).toFixed(1), 's');
  await b.close();
})();
