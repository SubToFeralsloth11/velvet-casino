/* Velvet — games. Each registers { id, name, sym, desc, bg, mount(view) -> cleanup? } */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Hidden lines about the crew. They surface rarely on losses, on profile names, and via the logo. */
const CREW = {
  lucas: ['Lucas\u2019s forehead has its own postcode', 'Even the reels can see Lucas\u2019s forehead from here', 'Lucas\u2019s forehead blocked the payline', 'Solar panels on Lucas\u2019s forehead would fund this casino'],
  aidan: ['Aidan still thinks red is due', 'Aidan calls this a strategy', 'Aidan\u2019s bankroll left the group chat'],
  zakhar: ['Zakhar\u2019s luck is on airplane mode', 'Zakhar has been "one spin away" since Tuesday', 'Zakhar\u2019s chips filed for divorce'],
  parsharan: ['Parsharan bets like the bank owes him money', 'Parsharan\u2019s risk management: vibes', 'Parsharan just tipped the house again'],
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
function crewLine() {
  const room = Object.values(allPlayers()).map((p) => (p.name || '').toLowerCase());
  const present = Object.keys(CREW).filter((k) => room.some((n) => n.includes(k)));
  return pick(CREW[pick(present.length ? present : Object.keys(CREW))]);
}
function lossLine(el) { if (rnd() < 0.12) { el.textContent = crewLine(); el.className = 'result l'; el.style.fontSize = '15px'; } }
let logoClicks = 0;
document.querySelector('.brand').addEventListener('click', () => {
  if (++logoClicks % 5) return;
  modal(`<h2>Wall of fame</h2>${Object.entries(CREW).map(([k, v]) => `<div class="fi"><b style="text-transform:capitalize">${k}</b><span style="color:var(--muted)">${v[0]}</span></div>`).join('')}<button class="btn" onclick="closeModal()">Close</button>`);
});

/* Shared layout: side panel with bet controls + stage */
function layout(v, title, sub) {
  v.append(h(`<div style="margin-bottom:18px"><h1>${title}</h1><p class="sub">${sub}</p></div>`));
  const g = h('<div class="game"><div class="card panel"></div><div class="stage"></div></div>');
  v.append(g);
  return { panel: g.firstChild, stage: g.lastChild };
}
function betInput(panel, def = 100) {
  const box = h(`<div><div class="lbl">Bet amount <span class="cs"></span></div><div class="betbox"><input type="number" min="1" value="${def}"><button class="btn">½</button><button class="btn">2×</button><button class="btn">Max</button></div></div>`);
  const inp = box.querySelector('input'); const [hf, db, mx] = box.querySelectorAll('button');
  const cs = () => box.querySelector('.cs').textContent = `(${Wallet.sym})`; cs();
  document.addEventListener('curchange', cs);
  hf.onclick = () => inp.value = Math.max(1, Math.floor(inp.value / 2));
  db.onclick = () => inp.value = Math.max(1, Math.min(Wallet.balance, inp.value * 2));
  mx.onclick = () => inp.value = Wallet.balance;
  panel.append(box);
  return { get value() { return Math.floor(+inp.value); }, set disabled(d) { box.querySelectorAll('input,button').forEach((e) => e.disabled = d); } };
}
function flash(el, win) { el.classList.remove('flash-w', 'flash-l'); el.offsetWidth; el.classList.add(win ? 'flash-w' : 'flash-l'); }
function show(res, win, bet, mult, cur) {
  res.style.fontSize = '';
  const sym = CUR[cur].sym;
  if (win > 0 && mult >= 1) { res.className = 'result w'; res.textContent = `+${sym} ${fmt(win)}  ×${mult.toFixed(2)}`; }
  else { res.className = 'result l'; res.textContent = `−${sym} ${fmt(bet)}`; lossLine(res); }
}
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cardEl = (c, hidden) => hidden ? h('<div class="pcard back"></div>')
  : h(`<div class="pcard ${c.s === '♥' || c.s === '♦' ? 'red' : ''}"><div>${c.r}${c.s}</div><div class="m">${c.s}</div><div class="b">${c.r}${c.s}</div></div>`);
const draw = () => ({ r: RANKS[Math.floor(rnd() * 13)], s: SUITS[Math.floor(rnd() * 4)] });

/* ---------- Slots ---------- */
GAMES.push({
  id: 'slots', name: 'Slots', sym: '❖', desc: 'Three reels, seven symbols', bg: ['#4b2bd1', '#1a1240'],
  mount(v) {
    const SY = [
      { s: '♣', c: '#4ade80', w: 30, p: 2 }, { s: '♦', c: '#38bdf8', w: 25, p: 3 }, { s: '♥', c: '#f87171', w: 20, p: 5 },
      { s: '♠', c: '#e5e7eb', w: 14, p: 8 }, { s: '★', c: '#facc15', w: 7, p: 20 }, { s: '◆', c: '#a48bff', w: 3, p: 50 }, { s: '7', c: '#ff5470', w: 1, p: 200 },
    ];
    const tot = SY.reduce((a, b) => a + b.w, 0);
    const roll = () => { let r = rnd() * tot; for (const s of SY) if ((r -= s.w) < 0) return s; return SY[0]; };
    const { panel, stage } = layout(v, 'Slots', 'Match three on the payline. Any two matching pays ×0.5 back on ♣ ♦ ♥, ×1 on higher symbols.');
    const bet = betInput(panel);
    panel.append(h(`<div><div class="lbl">Paytable — three of a kind</div>${SY.slice().reverse().map((s) => `<div class="fi"><span style="color:${s.c};font-size:18px;font-weight:800">${s.s} ${s.s} ${s.s}</span><span class="w">×${s.p}</span></div>`).join('')}</div>`));
    const btn = h('<button class="btn p big">Spin</button>'); panel.append(btn);
    const auto = h('<button class="btn">Auto ×10</button>'); panel.append(auto);
    const reels = h('<div class="reels" style="position:relative"><div class="payline"></div></div>');
    const strips = [0, 1, 2].map(() => { const r = h('<div class="reel"><div class="strip"></div></div>'); reels.append(r); return r.firstChild; });
    const res = h('<div class="result"></div>');
    stage.append(reels, res);
    const symH = () => strips[0].parentElement.clientHeight / 3;
    const symEl = (s) => `<div class="sym" style="color:${s.c}">${s.s}</div>`;
    strips.forEach((st) => st.innerHTML = [roll(), roll(), roll()].map(symEl).join(''));
    let busy = false;
    async function spin() {
      if (busy) return false; const b = bet.value, cur = Wallet.cur; if (!Wallet.take(b)) return false;
      busy = true; btn.disabled = true; res.textContent = ''; res.className = 'result';
      const out = [roll(), roll(), roll()];
      await Promise.all(strips.map((st, i) => new Promise((ok) => {
        setTimeout(ok, (1.1 + i * 0.35) * 1000 + 50);
        const n = 24 + i * 8; const list = Array.from({ length: n }, roll); list[n - 2] = out[i];
        st.style.transition = 'none'; st.style.transform = 'translateY(0)';
        st.innerHTML = list.map(symEl).join(''); st.offsetHeight;
        st.style.transition = `transform ${1.1 + i * 0.35}s cubic-bezier(.2,.75,.25,1.03)`;
        st.style.transform = `translateY(-${(n - 3) * symH()}px)`;
      })));
      let mult = 0;
      if (out[0] === out[1] && out[1] === out[2]) mult = out[0].p;
      else if (out[0] === out[1] || out[1] === out[2] || out[0] === out[2]) { const m = out[1] === out[2] ? out[1] : out[0]; mult = SY.indexOf(m) >= 3 ? 1 : 0.5; }
      const win = Wallet.pay(b, mult, 'Slots', cur);
      show(res, win, b, mult, cur); flash(stage, mult >= 1);
      busy = false; btn.disabled = false; return true;
    }
    btn.onclick = spin;
    let stop = false;
    auto.onclick = async () => { auto.disabled = true; for (let i = 0; i < 10 && !stop; i++) { if (!(await spin())) break; await sleep(400); } auto.disabled = false; };
    return () => { stop = true; };
  },
});

/* ---------- Blackjack ---------- */
GAMES.push({
  id: 'blackjack', name: 'Blackjack', sym: '♠', desc: 'Beat the dealer to 21', bg: ['#0f766e', '#062a27'],
  mount(v) {
    const { panel, stage } = layout(v, 'Blackjack', 'Blackjack pays 3:2. Dealer stands on all 17s. Double on any first two cards.');
    const bet = betInput(panel);
    const deal = h('<button class="btn p big">Deal</button>');
    const acts = h('<div class="row" style="flex-wrap:nowrap"><button class="btn" style="flex:1">Hit</button><button class="btn" style="flex:1">Stand</button><button class="btn" style="flex:1">Double</button></div>');
    panel.append(deal, acts);
    const [hit, stand, dbl] = acts.querySelectorAll('button');
    const dl = h('<div><div class="hlabel">Dealer <b></b></div><div class="hand"></div></div>');
    const pl = h('<div><div class="hlabel">You <b></b></div><div class="hand"></div></div>');
    const res = h('<div class="result"></div>');
    stage.append(dl, res, pl);
    const val = (hand) => { let t = 0, a = 0; for (const c of hand) { t += c.r === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r; if (c.r === 'A') a++; } while (t > 21 && a--) t -= 10; return t; };
    let st = null;
    const setActs = (on) => { hit.disabled = stand.disabled = !on; dbl.disabled = !on || st.p.length > 2 || Wallet.balance < st.bet; deal.disabled = on; bet.disabled = on; };
    hit.disabled = stand.disabled = dbl.disabled = true;
    const render = (hide) => {
      dl.lastChild.innerHTML = ''; pl.lastChild.innerHTML = '';
      st.d.forEach((c, i) => dl.lastChild.append(cardEl(c, hide && i === 1)));
      st.p.forEach((c) => pl.lastChild.append(cardEl(c)));
      dl.querySelector('b').textContent = hide ? val([st.d[0]]) : val(st.d);
      pl.querySelector('b').textContent = val(st.p);
    };
    async function finish() {
      setActs(false); hit.disabled = stand.disabled = dbl.disabled = true; deal.disabled = true;
      const pv = val(st.p); render(false);
      if (pv <= 21) while (val(st.d) < 17) { await sleep(500); st.d.push(draw()); render(false); }
      const dv = val(st.d); let mult = 0;
      if (pv > 21) mult = 0; else if (dv > 21 || pv > dv) mult = 2; else if (pv === dv) mult = 1;
      const win = Wallet.pay(st.bet, mult, 'Blackjack', st.cur);
      if (mult === 1) { res.className = 'result'; res.textContent = 'Push'; } else show(res, win, st.bet, mult, st.cur);
      flash(stage, mult > 1); deal.disabled = false; bet.disabled = false;
    }
    deal.onclick = async () => {
      const b = bet.value; if (!Wallet.take(b)) return;
      st = { bet: b, cur: Wallet.cur, p: [draw(), draw()], d: [draw(), draw()] }; res.textContent = '';
      render(true); setActs(true);
      const pv = val(st.p);
      if (pv === 21) {
        setActs(false); render(false); await sleep(400);
        const mult = val(st.d) === 21 ? 1 : 2.5;
        const win = Wallet.pay(b, mult, 'Blackjack', st.cur);
        res.className = 'result w'; res.textContent = mult === 1 ? 'Push' : `Blackjack  +${CUR[st.cur].sym} ${fmt(win)}`;
        flash(stage, true); deal.disabled = false; hit.disabled = stand.disabled = dbl.disabled = true;
      }
    };
    hit.onclick = () => { st.p.push(draw()); render(true); dbl.disabled = true; if (val(st.p) >= 21) finish(); };
    stand.onclick = finish;
    dbl.onclick = () => {
      if (Wallet.cur !== st.cur) { S.cur = st.cur; }
      if (!Wallet.take(st.bet)) return; st.bet *= 2; st.p.push(draw()); render(true); finish();
    };
  },
});

/* ---------- Roulette ---------- */
GAMES.push({
  id: 'roulette', name: 'Roulette', sym: '◎', desc: 'European single zero', bg: ['#b3203a', '#3a0a14'],
  mount(v) {
    const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const col = (n) => n === 0 ? '#16834f' : RED.has(n) ? '#b3203a' : '#22262f';
    const { panel, stage } = layout(v, 'Roulette', 'Click the board to place chips, then spin. Straight pays ×36, dozens ×3, even bets ×2.');
    const bet = betInput(panel, 50);
    const total = h('<div class="stat"><small>Total on table</small><b>0</b></div>');
    const spinB = h('<button class="btn p big">Spin</button>'), clr = h('<button class="btn">Clear bets</button>');
    panel.append(total, spinB, clr);
    const seg = 360 / 37;
    const grad = ORDER.map((n, i) => `${col(n)} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
    const wrap = h(`<div class="wheel-wrap"><div class="wheel" style="background:conic-gradient(from ${-seg / 2}deg,${grad})"><div class="hub">–</div></div></div>`);
    const wheel = wrap.firstChild, hub = wheel.firstChild;
    const res = h('<div class="result"></div>');
    const board = h('<div class="rboard"></div>'), outs = h('<div class="rout"></div>');
    const bets = {}; let cur = null;
    const place = (key, el) => {
      if (cur && cur !== Wallet.cur) return toast('All bets must use one currency', 'l');
      const amt = bet.value; if (!(amt > 0)) return;
      const sum = Object.values(bets).reduce((a, b) => a + b, 0);
      if (sum + amt > Wallet.balance) return toast('Not enough balance', 'l');
      cur = Wallet.cur; bets[key] = (bets[key] || 0) + amt; paint();
    };
    const zero = h(`<button class="gr" style="grid-column:span 12">0</button>`); zero.dataset.k = 'n0'; board.append(zero);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) {
      const n = c * 3 + (3 - r); const b = h(`<button class="${RED.has(n) ? 'rd' : 'bk'}">${n}</button>`); b.dataset.k = 'n' + n; board.append(b);
    }
    const OUT = [['1-12', 'd1'], ['13-24', 'd2'], ['25-36', 'd3'], ['1-18', 'lo'], ['19-36', 'hi'], ['Even', 'ev'], ['Odd', 'od'], ['Red', 'rd'], ['Black', 'bk']];
    OUT.forEach(([t, k]) => { const b = h(`<button>${t}</button>`); b.dataset.k = k; if (k === 'rd') b.style.background = '#b3203a'; if (k === 'bk') b.style.background = '#22262f'; outs.append(b); });
    outs.style.gridTemplateColumns = 'repeat(9,1fr)';
    [board, outs].forEach((el) => el.onclick = (e) => { const b = e.target.closest('button'); if (b && !busy) place(b.dataset.k); });
    function paint() {
      stage.querySelectorAll('[data-k]').forEach((b) => { b.querySelector('.chip')?.remove(); if (bets[b.dataset.k]) b.append(h(`<span class="chip">${fmt(bets[b.dataset.k])}</span>`)); });
      total.lastChild.textContent = (cur ? CUR[cur].sym + ' ' : '') + fmt(Object.values(bets).reduce((a, b) => a + b, 0));
    }
    stage.append(wrap, res, board, outs);
    clr.onclick = () => { if (busy) return; for (const k in bets) delete bets[k]; cur = null; paint(); };
    let rot = 0, busy = false;
    const pays = (k, n) => {
      if (k[0] === 'n' && k !== 'n') return +k.slice(1) === n ? 36 : 0;
      if (n === 0) return 0;
      return { d1: n <= 12 ? 3 : 0, d2: n > 12 && n <= 24 ? 3 : 0, d3: n > 24 ? 3 : 0, lo: n <= 18 ? 2 : 0, hi: n > 18 ? 2 : 0, ev: n % 2 === 0 ? 2 : 0, od: n % 2 ? 2 : 0, rd: RED.has(n) ? 2 : 0, bk: !RED.has(n) ? 2 : 0 }[k];
    };
    spinB.onclick = async () => {
      const sum = Object.values(bets).reduce((a, b) => a + b, 0);
      if (!sum) return toast('Place a bet on the board first', 'l');
      if (busy) return; S.cur = cur; if (!Wallet.take(sum)) return;
      busy = true; spinB.disabled = true; res.textContent = ''; hub.textContent = '–';
      const n = ORDER[Math.floor(rnd() * 37)], idx = ORDER.indexOf(n);
      rot += 360 * 5 + ((360 - idx * seg - (rot % 360)) + 360) % 360;
      wheel.style.transform = `rotate(${rot}deg)`;
      await sleep(4100);
      hub.textContent = n; hub.style.color = col(n) === '#22262f' ? 'var(--fg)' : col(n);
      let back = 0; for (const k in bets) back += bets[k] * pays(k, n);
      const mult = back / sum; const win = Wallet.pay(sum, mult, 'Roulette', cur);
      show(res, win, sum, mult, cur); flash(stage, mult > 1);
      busy = false; spinB.disabled = false;
    };
  },
});

/* ---------- Crash ---------- */
GAMES.push({
  id: 'crash', name: 'Crash', sym: '↗', desc: 'Cash out before it crashes', bg: ['#ea580c', '#3b1405'],
  mount(v) {
    const { panel, stage } = layout(v, 'Crash', 'The multiplier climbs until it crashes. Cash out in time to win. Set an auto cash-out to lock it in.');
    const bet = betInput(panel);
    panel.append(h('<div><div class="lbl">Auto cash-out at ×</div><input id="ac" type="number" step="0.1" min="1.01" placeholder="Off"></div>'));
    const go = h('<button class="btn p big">Bet</button>'); panel.append(go);
    const hist = h('<div class="row"></div>'); panel.append(h('<div class="lbl">Recent</div>'), hist);
    const cv = h('<canvas class="crash-c"></canvas>'), m = h('<div class="mult">1.00×</div>'), res = h('<div class="result"></div>');
    stage.append(m, cv, res); stage.style.justifyContent = 'flex-end';
    const ctx = cv.getContext('2d');
    let raf = 0, state = 'idle', st;
    const curve = (t) => Math.pow(Math.E, 0.00012 * t * 1.0);
    function drawC(t, crashed) {
      const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
      const tmax = Math.max(8000, t * 1.15), mmax = Math.max(2, curve(t) * 1.15);
      ctx.strokeStyle = '#252b38'; ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) { const y = H - (i / 5) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let s = 0; s <= t; s += t / 80 || 1) ctx.lineTo((s / tmax) * W, H - ((curve(s) - 1) / (mmax - 1)) * H * 0.9);
      const c = crashed ? '#ff5470' : '#7c5cff';
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
      ctx.lineTo((t / tmax) * W, H); ctx.closePath(); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c + '55'); g.addColorStop(1, c + '00'); ctx.fillStyle = g; ctx.fill();
    }
    drawC(0);
    const push = (x) => { hist.prepend(h(`<span class="btn" style="padding:4px 8px;font-family:var(--mono);font-size:12px;color:${x >= 2 ? 'var(--win)' : 'var(--lose)'}">${x.toFixed(2)}×</span>`)); while (hist.children.length > 8) hist.lastChild.remove(); };
    function cash() {
      if (state !== 'run' || st.out) return;
      const x = curve(performance.now() - st.t0); st.out = x;
      const win = Wallet.pay(st.bet, x, 'Crash', st.cur); show(res, win, st.bet, x, st.cur); flash(stage, true);
      go.textContent = 'Cashed out'; go.disabled = true;
    }
    go.onclick = () => {
      if (state === 'run') return cash();
      const b = bet.value; if (!Wallet.take(b)) return;
      const crashAt = Math.max(1, 0.97 / (1 - rnd())); // 3% house edge
      st = { bet: b, cur: Wallet.cur, crashAt, t0: performance.now(), out: 0, ac: +$('#ac', panel).value || 0 };
      state = 'run'; res.textContent = ''; m.style.color = ''; go.textContent = 'Cash out'; go.className = 'btn g big'; go.disabled = false; bet.disabled = true;
      const tick = () => {
        const t = performance.now() - st.t0, x = curve(t);
        if (st.ac >= 1.01 && !st.out && x >= st.ac && st.ac < st.crashAt) { st.out = st.ac; const win = Wallet.pay(st.bet, st.ac, 'Crash', st.cur); show(res, win, st.bet, st.ac, st.cur); go.disabled = true; go.textContent = 'Cashed out'; }
        if (x >= st.crashAt) {
          state = 'idle'; m.textContent = st.crashAt.toFixed(2) + '×'; m.style.color = 'var(--lose)'; drawC(t, true); push(st.crashAt);
          if (!st.out) { show(res, 0, st.bet, 0, st.cur); flash(stage, false); }
          go.textContent = 'Bet'; go.className = 'btn p big'; go.disabled = false; bet.disabled = false; return;
        }
        m.textContent = x.toFixed(2) + '×'; drawC(t); raf = requestAnimationFrame(tick);
      };
      tick();
    };
    return () => { cancelAnimationFrame(raf); if (state === 'run' && !st.out) { /* bet forfeited on leave */ } };
  },
});

/* ---------- Mines ---------- */
GAMES.push({
  id: 'mines', name: 'Mines', sym: '✦', desc: 'Find gems, avoid mines', bg: ['#059669', '#04261b'],
  mount(v) {
    const { panel, stage } = layout(v, 'Mines', 'Reveal tiles to grow the multiplier. Hit a mine and lose the bet. Cash out anytime.');
    const bet = betInput(panel);
    panel.append(h(`<div><div class="lbl">Mines</div><select id="mc">${[1, 3, 5, 8, 12, 20, 24].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`));
    const stats = h('<div class="stats"><div class="stat"><small>Multiplier</small><b>1.00×</b></div><div class="stat"><small>Next</small><b>–</b></div><div class="stat"><small>Profit</small><b>0</b></div></div>');
    const go = h('<button class="btn p big">Start</button>'); panel.append(stats, go);
    const grid = h('<div class="mgrid"></div>'), res = h('<div class="result"></div>');
    stage.append(grid, res);
    const cells = Array.from({ length: 25 }, (_, i) => { const c = h('<button class="mcell" disabled></button>'); c.onclick = () => pickCell(i); grid.append(c); return c; });
    let st = null;
    const multFor = (k, m) => { let x = 1; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return x * 0.97; };
    const upd = () => {
      const [a, b, c] = stats.querySelectorAll('b'); const x = st ? multFor(st.k, st.m) : 1;
      a.textContent = x.toFixed(2) + '×'; b.textContent = st && st.k < 25 - st.m ? multFor(st.k + 1, st.m).toFixed(2) + '×' : '–';
      c.textContent = st ? fmt(st.bet * x - st.bet) : 0;
    };
    function end(win) {
      cells.forEach((c, i) => { c.disabled = true; if (!c.textContent) { c.textContent = st.mines.has(i) ? '✕' : '◆'; c.className = 'mcell dim ' + (st.mines.has(i) ? 'bomb' : 'gem'); } });
      const mult = win ? multFor(st.k, st.m) : 0; const w = Wallet.pay(st.bet, mult, 'Mines', st.cur);
      show(res, w, st.bet, mult, st.cur); flash(stage, win);
      st = null; go.textContent = 'Start'; go.className = 'btn p big'; bet.disabled = false; $('#mc', panel).disabled = false;
    }
    function pickCell(i) {
      if (!st || cells[i].textContent) return;
      if (st.mines.has(i)) { cells[i].textContent = '✕'; cells[i].className = 'mcell bomb'; return end(false); }
      st.k++; cells[i].textContent = '◆'; cells[i].className = 'mcell gem'; cells[i].disabled = true; upd();
      if (st.k === 25 - st.m) end(true);
    }
    go.onclick = () => {
      if (st) { if (st.k) end(true); return; }
      const b = bet.value; if (!Wallet.take(b)) return;
      const m = +$('#mc', panel).value, mines = new Set();
      while (mines.size < m) mines.add(Math.floor(rnd() * 25));
      st = { bet: b, cur: Wallet.cur, m, mines, k: 0 }; res.textContent = '';
      cells.forEach((c) => { c.textContent = ''; c.className = 'mcell'; c.disabled = false; });
      go.textContent = 'Cash out'; go.className = 'btn g big'; bet.disabled = true; $('#mc', panel).disabled = true; upd();
    };
    upd();
  },
});

/* ---------- Dice ---------- */
GAMES.push({
  id: 'dice', name: 'Dice', sym: '⚄', desc: 'Pick your odds, roll 0–100', bg: ['#2563eb', '#0b1a40'],
  mount(v) {
    const { panel, stage } = layout(v, 'Dice', 'Choose a target and direction. Lower chance means a higher payout.');
    const bet = betInput(panel);
    const seg = h('<div class="seg"><button class="on" data-d="over">Roll over</button><button data-d="under">Roll under</button></div>');
    const slider = h('<div><div class="lbl">Target <span id="tv"></span></div><input type="range" min="2" max="98" value="50"></div>');
    const go = h('<button class="btn p big">Roll</button>');
    panel.append(seg, slider, go);
    const bar = h('<div style="width:100%;position:relative;margin-top:40px"><div class="dbar over"><div class="dmark" style="left:50%">50.00</div></div></div>');
    const stats = h('<div class="stats"><div class="stat"><small>Win chance</small><b></b></div><div class="stat"><small>Multiplier</small><b></b></div><div class="stat"><small>Payout</small><b></b></div></div>');
    const res = h('<div class="result"></div>');
    stage.append(h('<div style="width:100%;max-width:560px;display:flex;flex-direction:column;gap:30px"></div>'));
    stage.firstChild.append(bar, stats, res);
    let dir = 'over'; const rng = slider.querySelector('input'), dbar = bar.firstChild, mark = dbar.firstChild;
    const chance = () => dir === 'over' ? 100 - +rng.value : +rng.value;
    const mult = () => 97 / chance();
    const upd = () => {
      $('#tv', slider).textContent = rng.value; dbar.className = 'dbar ' + dir; dbar.style.setProperty('--p', rng.value + '%');
      const b = stats.querySelectorAll('b'); b[0].textContent = chance().toFixed(0) + '%'; b[1].textContent = mult().toFixed(2) + '×'; b[2].textContent = fmt(bet.value * mult());
    };
    seg.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; dir = b.dataset.d; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); upd(); };
    rng.oninput = upd; panel.querySelector('input').oninput = upd; upd();
    go.onclick = async () => {
      const b = bet.value, cur = Wallet.cur; if (!Wallet.take(b)) return;
      go.disabled = true; const roll = rnd() * 100;
      mark.style.left = roll + '%'; mark.textContent = roll.toFixed(2);
      await sleep(550);
      const win = dir === 'over' ? roll > +rng.value : roll < +rng.value;
      const x = win ? mult() : 0; const w = Wallet.pay(b, x, 'Dice', cur);
      show(res, w, b, x, cur); flash(stage, win); go.disabled = false;
    };
  },
});

/* ---------- Plinko ---------- */
GAMES.push({
  id: 'plinko', name: 'Plinko', sym: '⁘', desc: 'Drop the ball, chase the edges', bg: ['#db2777', '#3d0a22'],
  mount(v) {
    const ROWS = 12;
    const TABLE = { low: [8, 3, 1.5, 1.2, 1, 0.7, 0.5, 0.7, 1, 1.2, 1.5, 3, 8], mid: [24, 8, 3, 1.6, 0.9, 0.5, 0.3, 0.5, 0.9, 1.6, 3, 8, 24], high: [140, 24, 7, 2, 0.6, 0.2, 0.2, 0.2, 0.6, 2, 7, 24, 140] };
    const { panel, stage } = layout(v, 'Plinko', 'Each ball bounces through 12 rows of pegs. Higher risk widens the payouts.');
    const bet = betInput(panel, 20);
    const risk = h('<div class="seg"><button data-r="low">Low</button><button data-r="mid" class="on">Medium</button><button data-r="high">High</button></div>');
    const go = h('<button class="btn p big">Drop ball</button>'), res = h('<div class="result"></div>');
    panel.append(h('<div class="lbl">Risk</div>'), risk, go);
    let r = 'mid';
    risk.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; r = b.dataset.r; risk.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const cv = h('<canvas class="plinko-c"></canvas>'); stage.append(cv, res);
    const ctx = cv.getContext('2d'); const balls = []; let raf = 0; const hits = {};
    const binColor = (m) => m >= 10 ? '#ff5470' : m >= 2 ? '#ff9f43' : m >= 1 ? '#f5c451' : '#5b6376';
    function geom() { const W = cv.clientWidth, H = cv.clientHeight, gap = W / (ROWS + 3); return { W, H, gap, top: gap * 1.2 }; }
    const pegPos = (row, i, g) => ({ x: g.W / 2 + (i - row / 2) * g.gap, y: g.top + row * g.gap * 0.95 });
    function frame(now) {
      const dpr = devicePixelRatio || 1, g = geom(); cv.width = g.W * dpr; cv.height = g.H * dpr; ctx.scale(dpr, dpr);
      ctx.fillStyle = '#8b93a7';
      for (let row = 1; row <= ROWS; row++) for (let i = 0; i <= row; i++) { const p = pegPos(row, i, g); ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, 7); ctx.fill(); }
      const tb = TABLE[r], by = g.top + (ROWS + 1) * g.gap * 0.95;
      tb.forEach((m, i) => {
        const x = g.W / 2 + (i - ROWS / 2) * g.gap, w = g.gap - 4, lift = hits[i] && now - hits[i] < 250 ? 5 : 0;
        ctx.fillStyle = binColor(m); ctx.beginPath(); ctx.roundRect(x - w / 2, by - 12 + lift, w, 24, 5); ctx.fill();
        ctx.fillStyle = '#0b0d12'; ctx.font = `700 ${Math.max(8, g.gap * 0.26)}px JetBrains Mono`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m + '×', x, by + lift);
      });
      for (let k = balls.length - 1; k >= 0; k--) {
        const b = balls[k], t = (now - b.t0) / 140, step = Math.floor(t), f = t - step;
        if (step >= ROWS) {
          balls.splice(k, 1); hits[b.slot] = now;
          const m = tb.length === TABLE[b.r].length ? TABLE[b.r][b.slot] : 0; const w = Wallet.pay(b.bet, m, 'Plinko', b.cur); show(res, w, b.bet, m, b.cur); continue;
        }
        const a = pegPos(step, b.pos[step], g), c = step + 1 <= ROWS ? pegPos(step + 1, b.pos[step + 1], g) : a;
        const x = a.x + (c.x - a.x) * f, y = a.y + (c.y - a.y) * f - Math.sin(f * Math.PI) * g.gap * 0.35;
        ctx.fillStyle = '#ff5ca8'; ctx.shadowColor = '#ff5ca8'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y - 6, g.gap * 0.16, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    go.onclick = () => {
      const b = bet.value; if (!Wallet.take(b)) return;
      const pos = [0]; for (let i = 0; i < ROWS; i++) pos.push(pos[i] + (rnd() < 0.5 ? 0 : 1));
      balls.push({ t0: performance.now(), pos, slot: pos[ROWS], bet: b, cur: Wallet.cur, r });
    };
    return () => cancelAnimationFrame(raf);
  },
});

/* ---------- Coin flip ---------- */
GAMES.push({
  id: 'coinflip', name: 'Coin Flip', sym: '◐', desc: 'Double or nothing streaks', bg: ['#ca8a04', '#3a2902'],
  mount(v) {
    const { panel, stage } = layout(v, 'Coin Flip', 'Call it. Each correct call doubles the pot (×1.96). Cash out or keep the streak going.');
    const bet = betInput(panel);
    const pickR = h('<div class="seg"><button class="on" data-s="h">● Heads</button><button data-s="t">▲ Tails</button></div>');
    const go = h('<button class="btn p big">Flip</button>'), cash = h('<button class="btn g big" disabled>Cash out</button>');
    const stat = h('<div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><small>Streak</small><b>0</b></div><div class="stat"><small>Pot</small><b>0</b></div></div>');
    panel.append(pickR, go, cash, stat);
    const coin = h('<div class="coin"><div class="h">●</div><div class="t">▲</div></div>'), res = h('<div class="result"></div>');
    stage.append(h('<div style="perspective:800px"></div>'), res); stage.firstChild.append(coin);
    let side = 'h', rot = 0, st = null, busy = false;
    pickR.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; side = b.dataset.s; pickR.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const upd = () => { const b = stat.querySelectorAll('b'); b[0].textContent = st ? st.k : 0; b[1].textContent = st ? CUR[st.cur].sym + ' ' + fmt(st.bet * Math.pow(1.96, st.k)) : 0; cash.disabled = !st || !st.k || busy; bet.disabled = !!st; };
    go.onclick = async () => {
      if (busy) return;
      if (!st) { const b = bet.value; if (!Wallet.take(b)) return; st = { bet: b, cur: Wallet.cur, k: 0 }; }
      busy = true; go.disabled = true; upd(); res.textContent = '';
      const out = rnd() < 0.5 ? 'h' : 't';
      rot += 1800 + ((out === 'h' ? 0 : 180) - (rot % 360) + 360) % 360;
      coin.style.transform = `rotateY(${rot}deg)`;
      await sleep(1650);
      if (out === side) { st.k++; res.className = 'result w'; res.textContent = `Correct  ×${Math.pow(1.96, st.k).toFixed(2)}`; flash(stage, true); }
      else { Wallet.pay(st.bet, 0, 'Coin Flip', st.cur); show(res, 0, st.bet, 0, st.cur); flash(stage, false); st = null; }
      busy = false; go.disabled = false; go.textContent = st ? 'Flip again' : 'Flip'; upd();
    };
    cash.onclick = () => { if (!st || busy) return; const x = Math.pow(1.96, st.k); const w = Wallet.pay(st.bet, x, 'Coin Flip', st.cur); show(res, w, st.bet, x, st.cur); st = null; go.textContent = 'Flip'; upd(); };
    upd();
  },
});

/* ---------- Hi-Lo ---------- */
GAMES.push({
  id: 'hilo', name: 'Hi-Lo', sym: '⇅', desc: 'Higher or lower, card by card', bg: ['#7c3aed', '#25104a'],
  mount(v) {
    const { panel, stage } = layout(v, 'Hi-Lo', 'Guess whether the next card is higher or lower. Odds update every card. Ties lose.');
    const bet = betInput(panel);
    const start = h('<button class="btn p big">Start</button>');
    const hl = h('<div class="row" style="flex-wrap:nowrap"><button class="btn" style="flex:1">▲ Higher</button><button class="btn" style="flex:1">▼ Lower</button></div>');
    const cash = h('<button class="btn g big" disabled>Cash out</button>');
    const stat = h('<div class="stat"><small>Current multiplier</small><b>1.00×</b></div>');
    panel.append(start, hl, cash, stat);
    const [hi, lo] = hl.querySelectorAll('button');
    const big = h('<div class="bigcard"></div>'), row = h('<div class="hilo-row"></div>'), res = h('<div class="result"></div>');
    stage.append(big, res, row);
    const rv = (c) => RANKS.indexOf(c.r) + 1;
    let st = null;
    const odds = () => { const v0 = rv(st.c); return { hi: (13 - v0) / 13, lo: (v0 - 1) / 13 }; };
    const upd = () => {
      const on = !!st; hi.disabled = lo.disabled = !on; cash.disabled = !on || st.x <= 1; start.disabled = on; bet.disabled = on;
      if (on) { const o = odds(); hi.textContent = o.hi ? `▲ Higher ×${(0.97 / o.hi).toFixed(2)}` : '▲ Higher –'; lo.textContent = o.lo ? `▼ Lower ×${(0.97 / o.lo).toFixed(2)}` : '▼ Lower –'; hi.disabled = !o.hi; lo.disabled = !o.lo; }
      stat.lastChild.textContent = (st ? st.x : 1).toFixed(2) + '×';
    };
    const showCard = (c) => { big.innerHTML = ''; big.append(cardEl(c)); };
    start.onclick = () => { const b = bet.value; if (!Wallet.take(b)) return; st = { bet: b, cur: Wallet.cur, c: draw(), x: 1 }; row.innerHTML = ''; res.textContent = ''; showCard(st.c); upd(); };
    const guess = (up) => {
      const o = odds(), n = draw(), ok = up ? rv(n) > rv(st.c) : rv(n) < rv(st.c);
      row.append(cardEl(st.c)); showCard(n);
      if (ok) { st.x *= 0.97 / (up ? o.hi : o.lo); st.c = n; res.className = 'result w'; res.textContent = st.x.toFixed(2) + '×'; }
      else { Wallet.pay(st.bet, 0, 'Hi-Lo', st.cur); show(res, 0, st.bet, 0, st.cur); flash(stage, false); st = null; }
      upd();
    };
    hi.onclick = () => guess(true); lo.onclick = () => guess(false);
    cash.onclick = () => { const w = Wallet.pay(st.bet, st.x, 'Hi-Lo', st.cur); show(res, w, st.bet, st.x, st.cur); flash(stage, true); st = null; upd(); };
    big.append(cardEl(draw(), true)); upd();
  },
});

/* ---------- Wheel ---------- */
GAMES.push({
  id: 'wheel', name: 'Fortune Wheel', sym: '✺', desc: 'Spin for up to ×50', bg: ['#0891b2', '#052a33'],
  mount(v) {
    const SEGS = [0, 1.5, 0, 2, 0, 1.2, 0, 3, 0, 1.5, 0, 5, 0, 1.2, 0, 2, 0, 1.5, 0, 50, 0, 1.2, 0, 3];
    const COL = { 0: '#22262f', 1.2: '#4cc9f0', 1.5: '#2fd38a', 2: '#7c5cff', 3: '#f5c451', 5: '#ff9f43', 50: '#ff5470' };
    const { panel, stage } = layout(v, 'Fortune Wheel', '24 segments. Half are blanks — one of them is ×50.');
    const bet = betInput(panel);
    const go = h('<button class="btn p big">Spin</button>'); panel.append(go);
    panel.append(h(`<div>${[50, 5, 3, 2, 1.5, 1.2, 0].map((m) => `<div class="fi"><span><span style="color:${COL[m]}">■</span> ×${m}</span><span style="color:var(--muted)">${SEGS.filter((x) => x === m).length} / 24</span></div>`).join('')}</div>`));
    const a = 360 / SEGS.length;
    const wheel = h(`<div class="fwheel" style="background:conic-gradient(from ${-a / 2}deg,${SEGS.map((m, i) => `${COL[m]} ${i * a}deg ${(i + 1) * a - 0.6}deg,#0b0d12 ${(i + 1) * a - 0.6}deg ${(i + 1) * a}deg`).join(',')})"></div>`);
    const wrap = h('<div class="wheel-wrap"></div>'); wrap.append(wheel);
    const res = h('<div class="result"></div>'); stage.append(wrap, res);
    let rot = 0, busy = false;
    go.onclick = async () => {
      if (busy) return; const b = bet.value, cur = Wallet.cur; if (!Wallet.take(b)) return;
      busy = true; go.disabled = true; res.textContent = '';
      const i = Math.floor(rnd() * SEGS.length);
      rot += 360 * 6 + ((360 - i * a - (rot % 360)) + 360) % 360 + (rnd() - 0.5) * a * 0.7;
      wheel.style.transform = `rotate(${rot}deg)`;
      await sleep(4600);
      const m = SEGS[i]; const w = Wallet.pay(b, m, 'Fortune Wheel', cur); show(res, w, b, m, cur); flash(stage, m > 1);
      busy = false; go.disabled = false;
    };
  },
});
