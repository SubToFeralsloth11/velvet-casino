/* Velvet — core: state, wallet, router, multiplayer (PeerJS/WebRTC) */
const $ = (s, r = document) => r.querySelector(s);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const fmt = (n) => Math.floor(n).toLocaleString('en-US');

const CUR = {
  chips: { name: 'Chips', sym: '◆', color: '#a48bff', rate: 1 },
  gold:  { name: 'Gold',  sym: '●', color: '#f5c451', rate: 10 },
  gems:  { name: 'Gems',  sym: '▲', color: '#4cc9f0', rate: 100 },
};
const COLORS = ['#7c5cff', '#2fd38a', '#f5c451', '#4cc9f0', '#ff5470', '#ff9f43', '#e056fd', '#22d3ee'];
const KEY = 'velvet.v1';
const DAY = 864e5;

const S = Object.assign({
  name: '', color: COLORS[Math.floor(Math.random() * COLORS.length)],
  bal: { chips: 5000, gold: 100, gems: 5 }, cur: 'chips',
  stats: { wagered: 0, won: 0, bets: 0, best: 0, bestGame: '' },
  lastDaily: 0, streak: 0, room: '', roster: {},
}, JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const worth = (b = S.bal) => Object.keys(CUR).reduce((a, k) => a + (b[k] || 0) * CUR[k].rate, 0);

/* ---------- UI helpers ---------- */
function toast(msg, cls = '') {
  const t = h(`<div class="toast ${cls}">${msg}</div>`);
  $('#toasts').append(t); setTimeout(() => t.remove(), 3200);
}
function modal(html, bind) {
  $('#modalCard').innerHTML = html; $('#modal').classList.remove('hidden');
  bind && bind($('#modalCard'));
}
const closeModal = () => $('#modal').classList.add('hidden');
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
const initials = (n) => (n || '?').trim().slice(0, 2).toUpperCase();

function renderWallet(bump) {
  const w = $('#wallet'); w.innerHTML = '';
  for (const [k, c] of Object.entries(CUR)) {
    const b = h(`<button class="bal ${S.cur === k ? 'on' : ''}" title="Bet with ${c.name}"><span class="c" style="background:${c.color}">${c.sym}</span>${fmt(S.bal[k])}</button>`);
    b.onclick = () => { S.cur = k; save(); renderWallet(); document.dispatchEvent(new Event('curchange')); };
    if (bump === k) { b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 200); }
    w.append(b);
  }
  const p = $('#profileBtn'); p.textContent = initials(S.name); p.style.background = S.color;
}

/* ---------- Betting API used by games ---------- */
const Wallet = {
  get cur() { return S.cur; },
  get sym() { return CUR[S.cur].sym; },
  get balance() { return S.bal[S.cur]; },
  take(amount) {
    amount = Math.floor(amount);
    if (!(amount > 0)) { toast('Enter a bet above zero', 'l'); return false; }
    if (amount > S.bal[S.cur]) { toast('Not enough ' + CUR[S.cur].name, 'l'); return false; }
    S.bal[S.cur] -= amount; S.stats.wagered += amount * CUR[S.cur].rate; S.stats.bets++;
    save(); renderWallet(S.cur); Net.push(); return true;
  },
  // pay out amount*mult to the currency the bet was placed in
  pay(bet, mult, game, cur = S.cur) {
    const win = Math.floor(bet * mult);
    if (win > 0) { S.bal[cur] += win; S.stats.won += win * CUR[cur].rate; }
    const profit = (win - bet) * CUR[cur].rate;
    if (profit > S.stats.best) { S.stats.best = profit; S.stats.bestGame = game; }
    save(); renderWallet(cur); Net.push();
    if (mult >= 5 || profit >= 5000) Net.feed({ game, mult, win, cur });
    return win;
  },
};

/* ---------- Router ---------- */
const PAGES = [
  { id: 'home', label: 'Lobby', sym: '◈' },
  { id: 'leaderboard', label: 'Ranks', sym: '♛' },
  { id: 'online', label: 'Online', sym: '⇄' },
  { id: 'bank', label: 'Bank', sym: '⊕' },
];
window.GAMES = window.GAMES || [];
let cleanup = null;

function renderNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  const item = (id, label, sym) => {
    const a = h(`<a class="nav-i" href="#${id}"><span class="s">${sym}</span>${label}</a>`);
    if ((location.hash.slice(1) || 'home') === id) a.classList.add('on');
    return a;
  };
  PAGES.forEach((p) => nav.append(item(p.id, p.label, p.sym)));
  nav.append(h('<div class="nav-h">Games</div>'));
  GAMES.forEach((g) => nav.append(item(g.id, g.name, g.sym)));
  const tb = $('#tabbar'); tb.innerHTML = '';
  [...PAGES, { id: 'games', label: 'Games', sym: '▦' }].forEach((p) => tb.append(item(p.id === 'games' ? 'home' : p.id, p.label, p.sym)));
  tb.lastChild.onclick = (e) => { e.preventDefault(); location.hash = 'home'; setTimeout(() => $('#games')?.scrollIntoView({ behavior: 'smooth' }), 50); };
}

function route() {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const id = location.hash.slice(1) || 'home';
  const v = $('#view'); v.innerHTML = ''; v.style.animation = 'none'; v.offsetHeight; v.style.animation = '';
  const g = GAMES.find((x) => x.id === id);
  if (g) cleanup = g.mount(v) || null;
  else (Views[id] || Views.home)(v);
  renderNav(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ---------- Views ---------- */
const Views = {
  home(v) {
    const ready = Date.now() - S.lastDaily > DAY;
    v.append(h(`<div class="hero"><div class="glyph">◆</div>
      <h1>Welcome back${S.name ? ', ' + S.name : ''}.</h1>
      <p class="sub">Three currencies, ${GAMES.length} games, one leaderboard. Play with friends over a peer-to-peer room.</p>
      <div class="row" style="margin-top:20px">
        <button class="btn p" id="daily">${ready ? '⊕ Claim daily bonus' : '◷ Next bonus in ' + until()}</button>
        <a class="btn" href="#online">⇄ Play with friends</a>
      </div></div>`));
    $('#daily', v).disabled = !ready;
    $('#daily', v).onclick = claimDaily;
    v.append(h(`<div class="kpi">
      <div class="card"><small>Net worth</small><b>◆ ${fmt(worth())}</b></div>
      <div class="card"><small>Wagered</small><b>◆ ${fmt(S.stats.wagered)}</b></div>
      <div class="card"><small>Bets placed</small><b>${fmt(S.stats.bets)}</b></div>
      <div class="card"><small>Biggest win</small><b>◆ ${fmt(S.stats.best)}</b></div></div>`));
    v.append(h('<h2 id="games">Games</h2>'));
    const grid = h('<div class="grid"></div>');
    GAMES.forEach((g) => grid.append(h(`<a class="tile" href="#${g.id}" style="background:linear-gradient(150deg,${g.bg[0]},${g.bg[1]})"><span class="gl">${g.sym}</span><b>${g.name}</b><span>${g.desc}</span></a>`)));
    v.append(grid);
  },
  leaderboard(v) {
    v.append(h(`<div><h1>Leaderboard</h1><p class="sub">Ranked by net worth (all currencies converted to ◆). ${Net.code ? 'Live in room <b>' + Net.code + '</b>.' : 'Join a room to compete with friends.'}</p></div>`));
    const wrap = h('<div class="two" style="margin-top:22px"></div>');
    const board = h('<div class="card"><div class="seg" id="lbmode" style="margin-bottom:12px"><button data-m="worth" class="on">Net worth</button><button data-m="best">Biggest win</button><button data-m="wagered">Wagered</button></div><table class="lb"><thead><tr><th>#</th><th>Player</th><th style="text-align:right">Score</th></tr></thead><tbody></tbody></table></div>');
    const side = h('<div class="card"><h2>Big wins</h2><div class="feed" id="feed"></div></div>');
    wrap.append(board, side); v.append(wrap);
    let mode = 'worth';
    const draw = () => {
      const rows = Object.values(allPlayers()).sort((a, b) => b[mode] - a[mode]);
      $('tbody', board).innerHTML = rows.map((p, i) => `<tr class="${p.id === Net.id ? 'me' : ''}"><td><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span></td>
        <td><div class="who"><span class="dot" style="background:${p.color}">${initials(p.name)}</span>${esc(p.name)}${p.online ? '' : ' <small style="color:var(--dim)">offline</small>'}</div></td>
        <td class="n">◆ ${fmt(p[mode])}</td></tr>`).join('');
      renderFeed($('#feed', side));
    };
    board.querySelectorAll('#lbmode button').forEach((b) => b.onclick = () => {
      mode = b.dataset.m; board.querySelectorAll('#lbmode button').forEach((x) => x.classList.toggle('on', x === b)); draw();
    });
    draw(); Net.onUpdate = draw;
  },
  online(v) {
    if (!Net.code) {
      v.append(h(`<div><h1>Play online</h1><p class="sub">Rooms connect directly between browsers with WebRTC. Create one and send the code to friends.</p></div>`));
      const c = h(`<div class="two" style="margin-top:22px">
        <div class="card panel"><h2>Create a room</h2><p class="sub">You host the room. Keep this tab open so friends stay connected.</p><button class="btn p big" id="host">Create room</button></div>
        <div class="card panel"><h2>Join a room</h2><input id="code" placeholder="ROOM CODE" maxlength="6" style="text-transform:uppercase;font-family:var(--mono);font-size:20px;letter-spacing:.2em"><button class="btn g big" id="join">Join</button></div></div>`);
      v.append(c);
      $('#host', c).onclick = () => needName(() => Net.host());
      $('#join', c).onclick = () => needName(() => Net.join($('#code', c).value.trim().toUpperCase()));
      $('#code', c).onkeydown = (e) => e.key === 'Enter' && $('#join', c).click();
      return;
    }
    v.append(h(`<div class="row" style="justify-content:space-between"><div><h1>Room <span class="code">${Net.code}</span></h1><p class="sub">${Net.isHost ? 'You are hosting.' : 'Connected to host.'} Share the code — everyone here shows on the leaderboard.</p></div>
      <div class="row"><button class="btn" id="copy">⧉ Copy invite link</button><button class="btn" id="leave">✕ Leave</button></div></div>`));
    const w = h(`<div class="two" style="margin-top:22px">
      <div class="card"><h2>Chat</h2><div class="chat"><div class="msgs" id="msgs"></div><div class="row" style="flex-wrap:nowrap"><input id="msg" placeholder="Message the room" maxlength="200"><button class="btn p" id="send">Send</button></div></div></div>
      <div class="panel"><div class="card"><h2>Players</h2><div id="plist" class="feed"></div></div>
      <div class="card panel"><h2>Send a gift</h2><select id="gto"></select><div class="row" style="flex-wrap:nowrap"><input id="gamt" type="number" min="1" placeholder="Amount"><select id="gcur" style="width:120px">${Object.entries(CUR).map(([k, c]) => `<option value="${k}">${c.sym} ${c.name}</option>`).join('')}</select></div><button class="btn" id="gsend">Send gift</button></div></div></div>`);
    v.append(w);
    $('#copy', v).onclick = () => { navigator.clipboard.writeText(location.origin + location.pathname + '?room=' + Net.code); toast('Invite link copied'); };
    $('#leave', v).onclick = () => { Net.leave(); route(); };
    const send = () => { const t = $('#msg', w).value.trim(); if (t) { Net.chat(t); $('#msg', w).value = ''; } };
    $('#send', w).onclick = send; $('#msg', w).onkeydown = (e) => e.key === 'Enter' && send();
    $('#gsend', w).onclick = () => {
      const to = $('#gto', w).value, amt = Math.floor(+$('#gamt', w).value), cur = $('#gcur', w).value;
      if (!to) return toast('Nobody else is here yet', 'l');
      if (!(amt > 0) || amt > S.bal[cur]) return toast('Invalid amount', 'l');
      S.bal[cur] -= amt; save(); renderWallet(cur); Net.gift(to, amt, cur); Net.push();
      toast(`Sent ${CUR[cur].sym} ${fmt(amt)}`, 'w');
    };
    const draw = () => {
      const m = $('#msgs', w); const atBottom = m.scrollHeight - m.scrollTop - m.clientHeight < 40;
      m.innerHTML = Net.msgs.map((x) => x.sys ? `<div class="msg sys">${esc(x.text)}</div>` : `<div class="msg"><b style="color:${x.color}">${esc(x.name)}</b>${esc(x.text)}</div>`).join('');
      if (atBottom) m.scrollTop = m.scrollHeight;
      const ps = Object.values(Net.roster).filter((p) => p.online);
      $('#plist', w).innerHTML = ps.map((p) => `<div class="fi"><div class="who"><span class="dot" style="background:${p.color}">${initials(p.name)}</span>${esc(p.name)}${p.id === Net.id ? ' (you)' : ''}</div><span class="w">◆ ${fmt(p.worth)}</span></div>`).join('');
      const sel = $('#gto', w); const cur = sel.value;
      sel.innerHTML = ps.filter((p) => p.id !== Net.id).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
      sel.value = cur || sel.value;
    };
    draw(); Net.onUpdate = draw;
  },
  bank(v) {
    v.append(h(`<div><h1>Bank</h1><p class="sub">Exchange between currencies. Rates: ● 1 = ◆ 10, ▲ 1 = ◆ 100. A 2% spread applies.</p></div>`));
    const c = h(`<div class="two" style="margin-top:22px"><div class="card panel">
      <h2>Exchange</h2>
      <div><div class="lbl">From</div><select id="from">${opts('chips')}</select></div>
      <div><div class="lbl">Amount</div><input id="amt" type="number" min="1" value="1000"></div>
      <div><div class="lbl">To</div><select id="to">${opts('gold')}</select></div>
      <div class="stat"><small>You receive</small><b id="out">0</b></div>
      <button class="btn p big" id="go">Exchange</button></div>
      <div class="card panel"><h2>Holdings</h2>${Object.entries(CUR).map(([k, c]) => `<div class="fi"><span><span style="color:${c.color}">${c.sym}</span> ${c.name}</span><span class="w" style="color:var(--fg)">${fmt(S.bal[k])}</span></div>`).join('')}
      <div class="fi"><span>Net worth</span><span class="w">◆ ${fmt(worth())}</span></div>
      <h2 style="margin-top:12px">Bankrupt?</h2><p class="sub">If your net worth is under ◆ 500 you can take a ◆ 2,000 relief grant.</p>
      <button class="btn" id="relief" ${worth() >= 500 ? 'disabled' : ''}>Claim relief</button></div></div>`);
    v.append(c);
    const calc = () => {
      const f = $('#from', c).value, t = $('#to', c).value, a = +$('#amt', c).value || 0;
      return f === t ? 0 : Math.floor(a * CUR[f].rate / CUR[t].rate * 0.98);
    };
    const upd = () => { const t = $('#to', c).value; $('#out', c).textContent = CUR[t].sym + ' ' + fmt(calc()); };
    c.querySelectorAll('select,input').forEach((e) => e.oninput = upd); upd();
    $('#go', c).onclick = () => {
      const f = $('#from', c).value, t = $('#to', c).value, a = Math.floor(+$('#amt', c).value), out = calc();
      if (!(a > 0) || a > S.bal[f]) return toast('Not enough ' + CUR[f].name, 'l');
      if (out < 1) return toast('Amount too small to exchange', 'l');
      S.bal[f] -= a; S.bal[t] += out; save(); renderWallet(t); Net.push(); toast(`Received ${CUR[t].sym} ${fmt(out)}`, 'w'); route();
    };
    $('#relief', c).onclick = () => { S.bal.chips += 2000; save(); renderWallet('chips'); Net.push(); route(); };
  },
};
const opts = (sel) => Object.entries(CUR).map(([k, c]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${c.sym} ${c.name}</option>`).join('');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function until() { const ms = DAY - (Date.now() - S.lastDaily); return `${Math.floor(ms / 36e5)}h ${Math.floor(ms / 6e4) % 60}m`; }

function claimDaily() {
  if (Date.now() - S.lastDaily < DAY) return;
  S.streak = Date.now() - S.lastDaily < 2 * DAY ? S.streak + 1 : 1;
  const chips = 1000 + 250 * Math.min(S.streak, 10), gold = 20 * Math.min(S.streak, 5), gems = S.streak % 7 === 0 ? 10 : 1;
  S.bal.chips += chips; S.bal.gold += gold; S.bal.gems += gems; S.lastDaily = Date.now(); save(); renderWallet(); Net.push();
  toast(`Day ${S.streak} streak: ◆ ${fmt(chips)}  ● ${gold}  ▲ ${gems}`, 'w'); route();
}

function needName(next) {
  if (S.name) return next();
  editProfile(next);
}
function editProfile(next) {
  modal(`<h2>Your profile</h2><div><div class="lbl">Display name</div><input id="pn" maxlength="16" value="${esc(S.name)}" placeholder="Name"></div>
    <div><div class="lbl">Colour</div><div class="row" id="pc">${COLORS.map((c) => `<button class="dot" data-c="${c}" style="background:${c};${c === S.color ? 'outline:2px solid #fff;outline-offset:2px' : ''}"></button>`).join('')}</div></div>
    <button class="btn p big" id="ps">Save</button>`, (m) => {
    let col = S.color;
    m.querySelectorAll('#pc button').forEach((b) => b.onclick = () => { col = b.dataset.c; m.querySelectorAll('#pc button').forEach((x) => x.style.outline = x === b ? '2px solid #fff' : ''); });
    $('#ps', m).onclick = () => {
      const n = $('#pn', m).value.trim(); if (!n) return toast('Pick a name', 'l');
      S.name = n; S.color = col; save(); closeModal(); renderWallet(); Net.push(); next ? next() : route();
    };
    $('#pn', m).focus();
  });
}
$('#profileBtn').onclick = () => editProfile();

/* ---------- Multiplayer over PeerJS (WebRTC data channels) ---------- */
const PREFIX = 'velvet-casino-room-';
function allPlayers() {
  const me = { id: Net.id || 'me', name: S.name || 'You', color: S.color, worth: worth(), best: S.stats.best, wagered: S.stats.wagered, online: true };
  const r = { ...S.roster, ...Net.roster }; r[me.id] = me;
  for (const k in r) if (!Net.roster[k] && k !== me.id) r[k] = { ...r[k], online: false };
  return r;
}
function renderFeed(el) {
  if (!el) return;
  el.innerHTML = Net.feedItems.length ? Net.feedItems.map((f) => `<div class="fi"><span><b style="color:${f.color}">${esc(f.name)}</b> ${esc(f.game)} <span style="color:var(--muted)">×${f.mult.toFixed(2)}</span></span><span class="w">${CUR[f.cur].sym} ${fmt(f.win)}</span></div>`).join('')
    : '<p class="sub">Wins of ×5 or more appear here.</p>';
}

const Net = {
  peer: null, conns: [], host: null, code: '', isHost: false, id: '', roster: {}, msgs: [], feedItems: [], onUpdate: null, pushT: 0,
  status(on, text) { const n = $('#netStatus'); n.classList.toggle('on', on); n.querySelector('b').textContent = text; },
  me() { return { id: this.id, name: S.name, color: S.color, worth: worth(), best: S.stats.best, wagered: S.stats.wagered, online: true }; },
  update() { S.roster = { ...S.roster, ...this.roster }; save(); this.onUpdate && this.onUpdate(); },
  newPeer(id) {
    if (typeof Peer === 'undefined') { toast('Networking library failed to load', 'l'); return null; }
    return new Peer(id, { debug: 0 });
  },
  host(code) {
    code = code || Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(rnd() * 32)]).join('');
    const p = this.newPeer(PREFIX + code); if (!p) return;
    this.status(false, 'Connecting');
    p.on('open', (id) => {
      Object.assign(this, { peer: p, code, isHost: true, id, roster: {} });
      this.roster[id] = this.me(); S.room = code; save();
      this.sys('Room created. Share code ' + code); this.status(true, 'Host · ' + code); route();
    });
    p.on('connection', (c) => {
      c.on('open', () => { this.conns.push(c); c.send({ t: 'hello', roster: this.roster, msgs: this.msgs.slice(-50), feed: this.feedItems }); });
      c.on('data', (d) => this.hostRecv(c, d));
      c.on('close', () => {
        this.conns = this.conns.filter((x) => x !== c);
        const p0 = this.roster[c.peer]; delete this.roster[c.peer];
        if (p0) this.sys(p0.name + ' left'); this.broadcast({ t: 'roster', roster: this.roster }); this.update();
      });
    });
    p.on('error', (e) => {
      if (e.type === 'unavailable-id') { p.destroy(); this.join(code); return; }
      toast('Network: ' + e.type, 'l'); this.status(false, 'Offline');
    });
  },
  hostRecv(c, d) {
    if (d.t === 'state') {
      const isNew = !this.roster[c.peer];
      this.roster[c.peer] = { ...d.p, id: c.peer, online: true };
      if (isNew) this.sys(d.p.name + ' joined');
      this.broadcast({ t: 'roster', roster: this.roster });
    } else if (d.t === 'chat' || d.t === 'feed') {
      this.relay(d);
    } else if (d.t === 'gift') {
      this.relay(d);
    }
    this.update();
  },
  relay(d) { this.broadcast(d); this.handle(d); },
  broadcast(d) { this.conns.forEach((c) => c.open && c.send(d)); },
  join(code) {
    if (!code) return toast('Enter a room code', 'l');
    const p = this.newPeer(); if (!p) return;
    this.status(false, 'Connecting');
    p.on('open', (id) => {
      const c = p.connect(PREFIX + code, { reliable: true });
      const fail = setTimeout(() => { if (!c.open) { toast('Room not found', 'l'); p.destroy(); this.status(false, 'Offline'); } }, 9000);
      c.on('open', () => {
        clearTimeout(fail);
        Object.assign(this, { peer: p, host: c, code, isHost: false, id });
        S.room = code; save(); this.status(true, 'Room · ' + code);
        c.send({ t: 'state', p: this.me() }); route();
      });
      c.on('data', (d) => this.handle(d));
      c.on('close', () => { toast('Disconnected from room', 'l'); this.reset(); route(); });
    });
    p.on('error', (e) => { toast('Network: ' + e.type, 'l'); this.status(false, 'Offline'); });
  },
  handle(d) {
    if (d.t === 'hello') { this.roster = d.roster; this.msgs = d.msgs; this.feedItems = d.feed; }
    else if (d.t === 'roster') this.roster = d.roster;
    else if (d.t === 'chat') { this.msgs.push(d.m); this.msgs = this.msgs.slice(-100); if (location.hash !== '#online' && d.m.id !== this.id && !d.m.sys) toast(`${esc(d.m.name)}: ${esc(d.m.text)}`); }
    else if (d.t === 'feed') { this.feedItems.unshift(d.f); this.feedItems = this.feedItems.slice(0, 30); if (d.f.id !== this.id) toast(`${esc(d.f.name)} hit ×${d.f.mult.toFixed(2)} on ${esc(d.f.game)}`, 'w'); }
    else if (d.t === 'gift' && d.to === this.id) {
      S.bal[d.cur] += d.amt; save(); renderWallet(d.cur); this.push();
      toast(`${esc(d.from)} sent you ${CUR[d.cur].sym} ${fmt(d.amt)}`, 'w');
    }
    this.update();
  },
  send(d) { if (this.isHost) this.relay(d); else if (this.host?.open) this.host.send(d); },
  sys(text) { const d = { t: 'chat', m: { sys: true, text } }; this.isHost ? this.relay(d) : this.handle(d); },
  chat(text) { this.send({ t: 'chat', m: { id: this.id, name: S.name, color: S.color, text } }); },
  feed(f) {
    const item = { ...f, id: this.id, name: S.name || 'You', color: S.color };
    if (this.code) this.send({ t: 'feed', f: item }); else { this.feedItems.unshift(item); this.feedItems = this.feedItems.slice(0, 30); }
  },
  gift(to, amt, cur) { this.send({ t: 'gift', to, amt, cur, from: S.name }); },
  push() {
    if (!this.code) return;
    clearTimeout(this.pushT);
    this.pushT = setTimeout(() => {
      if (this.isHost) { this.roster[this.id] = this.me(); this.broadcast({ t: 'roster', roster: this.roster }); this.update(); }
      else this.host?.open && this.host.send({ t: 'state', p: this.me() });
    }, 250);
  },
  reset() { Object.assign(this, { peer: null, conns: [], host: null, code: '', isHost: false, roster: {}, msgs: [] }); this.status(false, 'Offline'); },
  leave() { this.peer?.destroy(); S.room = ''; save(); this.reset(); },
};

/* ---------- Boot ---------- */
window.addEventListener('DOMContentLoaded', () => {
  renderWallet(); route();
  const q = new URLSearchParams(location.search).get('room');
  const code = (q || S.room || '').toUpperCase();
  if (q) history.replaceState(null, '', location.pathname + location.hash);
  if (code) needName(() => (q ? Net.join(code) : Net.host(code)));
  else if (!S.name) editProfile();
});
