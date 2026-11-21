// P2P 네트워크 (PeerJS / WebRTC). 방장이 권한을 가진 스타 구조.
import Peer from 'peerjs';

const PREFIX = 'lanternfall-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function peerOptions() {
  const o = {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    },
  };
  // 개발용: ?peer=localhost:9000 으로 로컬 시그널링 서버 사용
  const q = new URLSearchParams(location.search).get('peer');
  if (q) {
    const [host, port] = q.split(':');
    Object.assign(o, { host, port: Number(port) || 9000, path: '/', secure: false });
  }
  return o;
}

export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export class Net {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.conns = new Map(); // 방장: id -> conn
    this.hostConn = null; // 참가자
    this.myId = 0;
    this.handlers = {};
    this.nextId = 1;
    this.closed = false;
  }

  on(type, fn) {
    (this.handlers[type] = this.handlers[type] || []).push(fn);
  }
  _emit(type, msg, from) {
    const hs = this.handlers[type];
    if (hs) for (const h of hs) h(msg, from);
  }

  // 방 만들기
  host(code, maxPlayers = 4) {
    this.isHost = true;
    this.myId = 0;
    this.code = code;
    return new Promise((resolve, reject) => {
      const peer = (this.peer = new Peer(PREFIX + code, peerOptions()));
      const to = setTimeout(() => reject(new Error('시그널링 서버에 연결할 수 없습니다.')), 12000);
      peer.on('open', () => {
        clearTimeout(to);
        resolve(code);
      });
      peer.on('error', (err) => {
        clearTimeout(to);
        if (err.type === 'unavailable-id') reject(new Error('이미 사용 중인 방 코드입니다. 다시 시도해 주세요.'));
        else if (!this.opened) reject(new Error('연결 오류: ' + (err.type || err.message)));
        else this._emit('error', { msg: err.type });
      });
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          if (this.conns.size >= maxPlayers - 1 || this.locked) {
            conn.send({ t: 'reject', msg: this.locked ? '이미 게임이 진행 중입니다.' : '방이 가득 찼습니다.' });
            setTimeout(() => conn.close(), 300);
            return;
          }
          const id = this.nextId++;
          conn.pid = id;
          this.conns.set(id, conn);
          conn.on('data', (m) => this._emit(m.t, m, id));
          conn.on('close', () => {
            if (this.conns.has(id)) {
              this.conns.delete(id);
              this._emit('leave', { id }, id);
            }
          });
          conn.on('error', () => {});
          this._emit('join', { id }, id);
        });
      });
      peer.on('disconnected', () => {
        if (!this.closed) peer.reconnect();
      });
    });
  }

  // 참가
  join(code) {
    this.isHost = false;
    return new Promise((resolve, reject) => {
      const peer = (this.peer = new Peer(peerOptions()));
      const to = setTimeout(() => reject(new Error('방에 연결할 수 없습니다. 코드를 확인해 주세요.')), 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
        this.hostConn = conn;
        conn.on('open', () => {
          clearTimeout(to);
          resolve();
        });
        conn.on('data', (m) => {
          if (m.t === 'reject') {
            clearTimeout(to);
            reject(new Error(m.msg));
            return;
          }
          this._emit(m.t, m, 0);
        });
        conn.on('close', () => {
          if (!this.closed) this._emit('hostLost', {});
        });
        conn.on('error', () => {});
      });
      peer.on('error', (err) => {
        clearTimeout(to);
        if (err.type === 'peer-unavailable') reject(new Error('해당 코드의 방이 없습니다.'));
        else reject(new Error('연결 오류: ' + (err.type || err.message)));
      });
    });
  }

  // 방장: 모두에게 / 참가자: 방장에게
  send(msg, to) {
    if (this.isHost) {
      if (to != null) {
        const c = this.conns.get(to);
        if (c && c.open) c.send(msg);
      } else for (const c of this.conns.values()) if (c.open) c.send(msg);
    } else if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
  }
  broadcastExcept(msg, except) {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  }

  get peerCount() {
    return this.isHost ? this.conns.size : 0;
  }

  close() {
    this.closed = true;
    try {
      for (const c of this.conns.values()) c.close();
      if (this.hostConn) this.hostConn.close();
      if (this.peer) this.peer.destroy();
    } catch (e) {}
    this.conns.clear();
  }
}
