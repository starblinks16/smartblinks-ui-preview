(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {
    connected: false, sound: false, balance: 10000, positions: [], selectedSide: 'BUY',
    symbol: 'XAUUSD', timeframe: '15m', page: 'overview', auditFilter: 'all',
    showBanner: true, notifications: true, compactNumbers: false, maxRisk: 1,
    marketTimer: null, pnlTimer: null, activity: []
  };
  const market = {
    XAUUSD: { name: 'Gold / US Dollar', short: 'Gold', price: 2746.82, change: 0.42, step: 0.65, digits: 2, multiplier: 100 },
    EURUSD: { name: 'Euro / US Dollar', short: 'Euro', price: 1.08542, change: 0.18, step: 0.00012, digits: 5, multiplier: 100000 },
    GBPUSD: { name: 'British Pound / US Dollar', short: 'Pound', price: 1.29412, change: -0.11, step: 0.00015, digits: 5, multiplier: 100000 }
  };
  let price = market.XAUUSD.price;
  let chartValues = [];
  let chartResizeObserver = null;

  const fmt = (n, digits = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const cash = n => (n < 0 ? '−' : '') + '$' + fmt(Math.abs(n));
  const pct = n => (n >= 0 ? '+' : '') + fmt(n, 2) + '%';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digitsFor = symbol => market[symbol].digits;
  const moneyPnl = position => (position.side === 'BUY' ? 1 : -1) * (position.mark - position.entry) * position.volume * market[position.symbol].multiplier;
  const floatingPnl = () => state.positions.reduce((sum, position) => sum + moneyPnl(position), 0);
  const pageInfo = {
    overview: ['Overview', 'A clear view of your trading environment.'],
    markets: ['Markets', 'A focused watchlist with illustrative market movement.'],
    brain: ['Brain', 'See how a transparent, illustrative decision review could be presented.'],
    audit: ['Audit trail', 'A readable timeline of actions inside this local preview.'],
    risk: ['Risk controls', 'Explore the safeguards and exposure context shown in the interface.'],
    settings: ['Preferences', 'Adjust this preview on your device.']
  };

  function playSound(kind = 'tap') {
    if (!state.sound) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = kind === 'success' ? 660 : kind === 'error' ? 190 : 440;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(kind === 'success' ? 0.028 : 0.014, context.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.095);
      oscillator.onended = () => context.close();
    } catch (_) {}
  }

  function toast(title, detail = '') {
    if (!state.notifications) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = '<b>' + esc(title) + '</b>' + (detail ? '<small>' + esc(detail) + '</small>' : '');
    $('#toast-region').append(node);
    window.setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(4px)';
      node.style.transition = 'opacity .2s, transform .2s';
      window.setTimeout(() => node.remove(), 220);
    }, 3200);
  }

  function addActivity(title, detail, type = 'neutral') {
    state.activity.unshift({ id: Date.now() + Math.random(), title, detail, type, time: new Date() });
    state.activity = state.activity.slice(0, 60);
    if ($('#activity-list')) renderActivity();
    if ($('#audit-list')) renderAudit();
  }

  function relativeTime(date) {
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 10) return 'JUST NOW';
    if (seconds < 60) return seconds + 'S AGO';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'M AGO';
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  }

  function iconFor(type) {
    return type === 'gold' ? '◇' : type === 'green' ? '✓' : type === 'red' ? '!' : '•';
  }

  function activityMarkup(item) {
    return '<div class="activity-item"><span class="activity-marker ' + esc(item.type) + '">' + iconFor(item.type) + '</span><div><b>' + esc(item.title) + '</b><p>' + esc(item.detail) + '</p><small>' + relativeTime(item.time) + '</small></div></div>';
  }

  function renderActivity() {
    const list = $('#activity-list');
    if (!list) return;
    list.innerHTML = state.activity.slice(0, 5).map(activityMarkup).join('') || '<div class="audit-empty">No activity recorded yet.</div>';
  }

  function metricsMarkup() {
    const pnl = floatingPnl();
    const positions = state.positions.length;
    return '<section class="metric-grid" aria-label="Simulated account summary">' +
      '<article class="metric-card"><div class="metric-top"><span>Account balance</span><span class="metric-symbol">◉</span></div><div class="metric-value">' + cash(state.balance) + '</div><div class="metric-foot"><span class="muted">Demo account · USD</span><span class="tiny-tag">SIMULATED</span></div></article>' +
      '<article class="metric-card"><div class="metric-top"><span>Equity</span><span class="metric-symbol">↗</span></div><div class="metric-value">' + cash(state.balance + pnl) + '</div><div class="metric-foot"><span class="muted">Balance + floating P&amp;L</span></div></article>' +
      '<article class="metric-card"><div class="metric-top"><span>Floating P&amp;L</span><span class="metric-symbol">±</span></div><div class="metric-value ' + (pnl >= 0 ? 'positive' : 'negative') + '">' + (pnl >= 0 ? '+' : '−') + '$' + fmt(Math.abs(pnl)) + '</div><div class="metric-foot"><span class="muted">Open positions only</span><span class="pnl-change ' + (pnl >= 0 ? 'positive' : 'negative') + '">' + pct(state.balance ? pnl / state.balance * 100 : 0) + '</span></div></article>' +
      '<article class="metric-card"><div class="metric-top"><span>Open positions</span><span class="metric-symbol">⌗</span></div><div class="metric-value">' + positions + '</div><div class="metric-foot"><span class="muted">Simulated exposure</span><button class="text-action" data-action="open-order">Open test position ↗</button></div></article></section>';
  }

  function chartMarkup() {
    return '<article class="panel chart-panel"><div class="panel-header"><div><div class="panel-kicker">MARKET OVERVIEW <span class="subtle-separator">/</span> SIMULATED FEED</div><h2>Price action</h2></div><div class="chart-tools"><select id="symbol-select" aria-label="Select market">' +
      Object.keys(market).map(symbol => '<option value="' + symbol + '"' + (state.symbol === symbol ? ' selected' : '') + '>' + symbol + '</option>').join('') +
      '</select><div class="segmented" role="group" aria-label="Chart timeframe">' + [['15m', '15m'], ['1h', '1H'], ['4h', '4H']].map(pair => '<button class="timeframe' + (state.timeframe === pair[0] ? ' active' : '') + '" data-time="' + pair[0] + '">' + pair[1] + '</button>').join('') +
      '</div></div></div><div class="instrument-line"><div><strong id="chart-symbol">' + state.symbol + '</strong><span class="instrument-name" id="instrument-name">' + market[state.symbol].name + '</span></div><div class="quote"><strong id="market-price">' + fmt(price, digitsFor(state.symbol)) + '</strong><span id="market-change" class="' + (market[state.symbol].change >= 0 ? 'positive' : 'negative') + '">' + pct(market[state.symbol].change) + '</span></div></div><div class="chart-wrap"><canvas id="price-chart" role="img" aria-label="Illustrative simulated price chart for ' + state.symbol + '"></canvas><div class="chart-tooltip">SIMULATED PRICE FEED</div></div><div class="chart-footer"><span><i class="legend-line"></i>Price</span><span>Illustrative market data</span><span id="chart-time">Updated just now</span></div></article>';
  }

  function monitorMarkup() {
    return '<article class="panel monitoring-panel"><div class="panel-header"><div><div class="panel-kicker">SYSTEM STATUS</div><h2>Monitoring</h2></div><span class="monitor-icon">⌁</span></div><div class="monitor-status"><span class="status-ring"><span>✓</span></span><div><b>' + (state.connected ? 'Simulation running' : 'Ready to explore') + '</b><p>' + (state.connected ? 'Local sample prices are updating.' : 'Start the simulation to animate sample prices.') + '</p></div></div><div class="monitor-list"><div class="monitor-row"><span>Market data</span><b><i class="status-dot ' + (state.connected ? '' : 'gray') + '"></i>' + (state.connected ? 'Simulated stream' : 'Paused') + '</b></div><div class="monitor-row"><span>Risk gate display</span><b><i class="status-dot"></i>Illustrative</b></div><div class="monitor-row"><span>Order execution</span><b><i class="status-dot gray"></i>Local only</b></div></div><button class="button button-secondary full-width" data-navigate="risk">Review risk controls <span>→</span></button></article>';
  }

  function positionsMarkup() {
    let body;
    if (!state.positions.length) {
      body = '<tr class="empty-row"><td colspan="7"><div class="empty-state"><span class="empty-icon">⌁</span><b>No open positions</b><p>Add a simulated position to explore how account metrics and P&amp;L respond.</p><button class="text-action" data-action="open-order">Add simulated position →</button></div></td></tr>';
    } else {
      body = state.positions.map(position => {
        const pnl = moneyPnl(position);
        return '<tr><td><span class="symbol-cell">' + position.symbol + '</span></td><td><span class="side-badge ' + position.side.toLowerCase() + '">' + position.side + '</span></td><td>' + fmt(position.volume, 2) + '</td><td>' + fmt(position.entry, digitsFor(position.symbol)) + '</td><td>' + fmt(position.mark, digitsFor(position.symbol)) + '</td><td class="' + (pnl >= 0 ? 'positive' : 'negative') + '">' + (pnl >= 0 ? '+' : '−') + '$' + fmt(Math.abs(pnl)) + '</td><td><button class="text-action" data-action="close-position" data-id="' + position.id + '">Close ×</button></td></tr>';
      }).join('');
    }
    return '<section class="panel positions-panel"><div class="panel-header"><div><div class="panel-kicker">ACCOUNT ACTIVITY</div><h2>Open positions <span class="count-pill">' + state.positions.length + '</span></h2></div><button class="button button-secondary small-button" data-action="open-order">＋ Test position</button></div><div class="table-scroll"><table><thead><tr><th>INSTRUMENT</th><th>DIRECTION</th><th>VOLUME</th><th>ENTRY PRICE</th><th>MARK PRICE</th><th>UNREALIZED P&amp;L</th><th></th></tr></thead><tbody id="positions-body">' + body + '</tbody></table></div></section>';
  }

  function riskSummaryMarkup() {
    return '<article class="panel risk-summary"><div class="panel-header"><div><div class="panel-kicker">PRE-TRADE CHECKS</div><h2>Risk gate</h2></div><span class="check-badge">● PREVIEW</span></div><div class="risk-check"><span class="checkmark">✓</span><div><b>Market session</b><small>Session state is simulated</small></div><span class="check-result">DEMO</span></div><div class="risk-check"><span class="checkmark">✓</span><div><b>Data feed</b><small>' + (state.connected ? 'Illustrative prices are updating' : 'Sample feed is paused') + '</small></div><span class="check-result">' + (state.connected ? 'ACTIVE' : 'PAUSED') + '</span></div><div class="risk-check"><span class="checkmark">✓</span><div><b>Position sizing</b><small>Preset test volumes only</small></div><span class="check-result">LOCAL</span></div><p class="panel-intro">These are interface examples, not a live risk engine or a guarantee that a trade is safe.</p></article>';
  }

  function overviewPage() {
    return metricsMarkup() + '<section class="primary-grid">' + chartMarkup() + monitorMarkup() + '</section>' + positionsMarkup() + '<section class="lower-grid"><article class="panel activity-panel"><div class="panel-header"><div><div class="panel-kicker">EVENT STREAM</div><h2>Recent activity</h2></div><button class="text-action" data-navigate="audit">View audit trail →</button></div><div class="activity-list" id="activity-list"></div></article>' + riskSummaryMarkup() + '</section>';
  }

  function marketRows() {
    return Object.keys(market).map(symbol => {
      const m = market[symbol];
      const current = symbol === state.symbol ? price : m.price;
      return '<tr><td><div class="market-name"><span class="instrument-badge">' + (symbol === 'XAUUSD' ? 'Au' : symbol === 'EURUSD' ? '€' : '£') + '</span><div><b>' + symbol + '</b><small>' + m.name + '</small></div></div></td><td>' + fmt(current, m.digits) + '</td><td class="' + (m.change >= 0 ? 'positive' : 'negative') + '">' + pct(m.change) + '</td><td><span class="tag">' + (state.connected ? 'SIMULATING' : 'SAMPLE') + '</span></td><td><button class="watch-action" data-action="select-market" data-symbol="' + symbol + '">' + (symbol === state.symbol ? 'Selected ✓' : 'View chart') + '</button></td></tr>';
    }).join('');
  }

  function marketsPage() {
    return '<div class="page-grid"><article class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">WATCHLIST</div><h2>Tracked instruments</h2><p class="panel-intro">Three illustrative markets are included in this preview.</p></div><span class="tag gold">3 SYMBOLS</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>INSTRUMENT</th><th>PRICE</th><th>CHANGE</th><th>FEED</th><th></th></tr></thead><tbody id="market-table-body">' + marketRows() + '</tbody></table></div></article><div><div class="page-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div class="mini-stat"><span>Markets tracked</span><b>03</b><small>Illustrative watchlist</small></div><div class="mini-stat"><span>Feed status</span><b style="font-size:15px">' + (state.connected ? 'RUNNING' : 'PAUSED') + '</b><small>Browser-only simulation</small></div></div><article class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">SELECTED MARKET</div><h2>' + state.symbol + '</h2></div><span class="tag gold">' + state.timeframe.toUpperCase() + '</span></div><p class="panel-intro">' + market[state.symbol].name + '. Select “View chart” to change the active instrument, then use the overview chart to inspect the price line.</p><div class="instrument-line"><div><strong>' + state.symbol + '</strong><span class="instrument-name">' + market[state.symbol].short + '</span></div><div class="quote"><strong>' + fmt(price, digitsFor(state.symbol)) + '</strong><span class="' + (market[state.symbol].change >= 0 ? 'positive' : 'negative') + '">' + pct(market[state.symbol].change) + '</span></div></div><div style="margin-top:16px"><button class="button button-primary" data-navigate="overview">Open price chart →</button></div></article></div></div><section class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">PRICE ACTION</div><h2>Selected market chart</h2><p class="panel-intro">The line is generated in your browser and is not a real-time broker quote.</p></div></div>' + chartMarkup() + '</section>';
  }

  function brainPage() {
    return '<div class="signal-disclaimer"><span>i</span><div><b>CONCEPT PREVIEW ONLY</b> — No AI model, live strategy, or trading engine is running here. The content below demonstrates how SmartBlinks could explain a decision without pretending to produce a real signal.</div></div><section class="page-grid"><article class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">STRATEGY STATUS</div><h2>Decision monitor</h2></div><span class="tag gold">DEMO STATE</span></div><div class="monitor-status"><span class="status-ring"><span>◈</span></span><div><b>Observing market context</b><p>Illustrative state only — no recommendation generated.</p></div></div><div class="mini-stat" style="margin-top:14px"><span>Current preview mode</span><b style="font-size:16px">OBSERVING</b><small>Signal execution is intentionally disabled.</small></div></article><article class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">EXAMPLE SIGNAL CARD</div><h2>What a signal could show</h2></div><span class="tag">NOT A SIGNAL</span></div><div class="signal-card" style="margin-top:14px"><div class="signal-top"><b>' + state.symbol + ' · Context review</b><span class="signal-score">— / 100</span></div><p>No trade direction is being recommended. A real implementation should display strategy evidence, data freshness, invalidation level, and explicit reasons for passing or rejecting a setup.</p><div class="signal-meta"><span class="tag">Evidence required</span><span class="tag">Risk gate required</span><span class="tag">Fresh data required</span></div></div></article></section><section class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">DECISION TRANSPARENCY</div><h2>Example reasoning sequence</h2><p class="panel-intro">A proposed presentation pattern—not the actual SmartBlinks decision engine.</p></div></div><div class="decision-list"><div class="decision-row"><span class="decision-step">01</span><div><b>Validate the market data</b><p>Check quote freshness, spread, session state, and whether the feed is complete before evaluating any setup.</p></div></div><div class="decision-row"><span class="decision-step">02</span><div><b>Evaluate the setup</b><p>Show which strategy conditions passed or failed, with evidence and a timestamp rather than a vague AI confidence number.</p></div></div><div class="decision-row"><span class="decision-step">03</span><div><b>Apply the risk gate</b><p>Show position sizing, exposure limits, news restrictions, and the exact reason a candidate is blocked.</p></div></div><div class="decision-row"><span class="decision-step">04</span><div><b>Record the outcome</b><p>Write a timestamped audit event so the user can review why the system acted—or deliberately did nothing.</p></div></div></div></section>';
  }

  function auditPage() {
    return '<section class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">BLACK-BOX RECORDER</div><h2>System event history</h2><p class="panel-intro">Events created by this browser preview only. No broker records are read.</p></div><button class="button button-secondary small-button" data-action="export-audit">Export CSV</button></div><div class="audit-filter" role="group" aria-label="Filter audit events">' + [['all', 'All events'], ['green', 'State changes'], ['gold', 'Positions'], ['red', 'Warnings']].map(pair => '<button class="filter-button' + (state.auditFilter === pair[0] ? ' active' : '') + '" data-filter="' + pair[0] + '">' + pair[1] + '</button>').join('') + '</div><div class="audit-list" id="audit-list"></div></section><section class="page-grid"><div class="mini-stat"><span>Events in session</span><b>' + state.activity.length.toString().padStart(2, '0') + '</b><small>Stored in memory until refresh</small></div><div class="mini-stat"><span>Source</span><b style="font-size:16px">LOCAL ONLY</b><small>No account or backend data</small></div></section>';
  }

  function renderAudit() {
    const list = $('#audit-list');
    if (!list) return;
    const filtered = state.activity.filter(item => state.auditFilter === 'all' || item.type === state.auditFilter);
    list.innerHTML = filtered.length ? filtered.map(item => '<div class="audit-row"><div class="audit-time">' + item.time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) + '<br>UTC</div><div class="audit-line"><i></i></div><div class="audit-copy"><b>' + esc(item.title) + '</b><p>' + esc(item.detail) + '</p></div><span class="tag">' + esc(item.type.toUpperCase()) + '</span></div>').join('') : '<div class="audit-empty">No events match this filter yet.</div>';
  }

  function riskPage() {
    const pnl = floatingPnl();
    const exposure = state.positions.reduce((sum, p) => sum + p.volume * market[p.symbol].multiplier * p.mark, 0);
    return '<div class="page-grid"><article class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">ACCOUNT EXPOSURE</div><h2>Simulated risk snapshot</h2><p class="panel-intro">Calculated from the local test positions shown in this preview.</p></div></div><div class="page-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:15px;margin-bottom:0"><div class="mini-stat"><span>Open positions</span><b>' + state.positions.length + '</b><small>Local test orders</small></div><div class="mini-stat"><span>Floating P&amp;L</span><b class="' + (pnl >= 0 ? 'positive' : 'negative') + '" style="font-size:18px">' + (pnl >= 0 ? '+' : '−') + '$' + fmt(Math.abs(pnl)) + '</b><small>Illustrative only</small></div><div class="mini-stat"><span>Gross notional estimate</span><b style="font-size:17px">' + cash(exposure) + '</b><small>Simple estimate, not margin</small></div><div class="mini-stat"><span>Balance</span><b style="font-size:18px">' + cash(state.balance) + '</b><small>Simulated account currency: USD</small></div></div></article><article class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">RISK GATE DISPLAY</div><h2>Pre-trade checks</h2></div><span class="check-badge">PREVIEW</span></div><div class="risk-check"><span class="checkmark">✓</span><div><b>Market data label</b><small>Simulated feed clearly identified</small></div><span class="check-result">PASS</span></div><div class="risk-check"><span class="checkmark">✓</span><div><b>Order scope</b><small>Local-only, no broker execution</small></div><span class="check-result">PASS</span></div><div class="risk-check"><span class="checkmark">✓</span><div><b>Real trading protection</b><small>Not applicable in this UI-only preview</small></div><span class="check-result">N/A</span></div><p class="panel-intro">These are interface indicators only. They do not validate real trading conditions or enforce live risk limits.</p></article></div><section class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">INTERFACE EXPLORATION</div><h2>Risk threshold control</h2><p class="panel-intro">A visual control to test the UI. It does not change or enforce any trading rule.</p></div><span class="tag gold">UI ONLY</span></div><div class="setting-row"><div><b>Illustrative risk per idea</b><p>Move the control to see the threshold display update.</p></div><b id="risk-value">' + fmt(state.maxRisk, 1) + '%</b></div><input id="risk-slider" aria-label="Illustrative risk threshold" type="range" min="0.5" max="3" step="0.5" value="' + state.maxRisk + '" style="width:100%;accent-color:var(--gold)"><div class="risk-meter"><span id="risk-meter-fill" style="width:' + (state.maxRisk / 3 * 100) + '%"></span></div><div class="risk-labels"><span>0.5% · LOWER</span><span>3.0% · HIGHER</span></div></section>';
  }

  function settingsPage() {
    return '<div class="page-grid"><section class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">DISPLAY</div><h2>Interface preferences</h2><p class="panel-intro">These settings apply to this browser session only.</p></div></div><div class="setting-row"><div><b>Interface sounds</b><p>Enable a subtle tone for selected actions.</p></div><button class="toggle" data-setting="sound" role="switch" aria-label="Interface sounds" aria-checked="' + state.sound + '"></button></div><div class="setting-row"><div><b>Action notifications</b><p>Show brief confirmation messages.</p></div><button class="toggle" data-setting="notifications" role="switch" aria-label="Action notifications" aria-checked="' + state.notifications + '"></button></div><div class="setting-row"><div><b>Compact numeric display</b><p>Reserved display preference for future refinements.</p></div><button class="toggle" data-setting="compactNumbers" role="switch" aria-label="Compact numeric display" aria-checked="' + state.compactNumbers + '"></button></div></section><section class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">PREVIEW SESSION</div><h2>Local demo controls</h2><p class="panel-intro">No preferences or positions are saved to a server.</p></div></div><div class="setting-row"><div><b>Simulation state</b><p>' + (state.connected ? 'Price animation is running.' : 'Price animation is paused.') + '</p></div><span class="tag ' + (state.connected ? 'active' : '') + '">' + (state.connected ? 'RUNNING' : 'PAUSED') + '</span></div><div class="setting-row"><div><b>Browser session data</b><p>' + state.positions.length + ' open simulated position(s), ' + state.activity.length + ' event(s).</p></div><button class="button button-secondary small-button" data-action="reset-demo">Reset preview</button></div><div class="settings-actions"><button class="button button-primary" data-action="start-stop">' + (state.connected ? 'Pause simulation' : 'Start simulation') + '</button><button class="button button-secondary" data-action="open-order">Add test position</button></div></section></div><section class="panel page-panel"><div class="panel-header"><div><div class="panel-kicker">ABOUT THIS BUILD</div><h2>SmartBlinks UI preview</h2></div><span class="tag gold">STATIC SITE</span></div><div class="decision-list"><div class="decision-row"><span class="decision-step">01</span><div><b>Independent front-end prototype</b><p>Plain HTML, CSS and JavaScript. No package installation, build step, environment variables, or Docker required.</p></div></div><div class="decision-row"><span class="decision-step">02</span><div><b>Safe by design</b><p>All quotes, account values, events and positions are generated locally. No cTrader, broker, AI API, or backend is connected.</p></div></div><div class="decision-row"><span class="decision-step">03</span><div><b>Designed for interface evaluation</b><p>Use it to assess layout, navigation, terminology, responsiveness, and interaction patterns—not trading performance.</p></div></div></div></section>';
  }

  function navigate(page, scroll = true) {
    if (!pageInfo[page]) return;
    state.page = page;
    $$('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    $('#page-crumb').textContent = pageInfo[page][0];
    $('#page-title').textContent = pageInfo[page][0];
    $('#page-subtitle').textContent = pageInfo[page][1];
    const root = $('#page-content');
    root.innerHTML = page === 'overview' ? overviewPage() :
      page === 'markets' ? marketsPage() :
      page === 'brain' ? brainPage() :
      page === 'audit' ? auditPage() :
      page === 'risk' ? riskPage() : settingsPage();
    if (state.showBanner) $('#sim-banner').hidden = false;
    else $('#sim-banner').hidden = true;
    if (page === 'overview') renderActivity();
    if (page === 'audit') renderAudit();
    if (page === 'overview' || page === 'markets') {
      initSeries();
      drawChart();
      if (chartResizeObserver) chartResizeObserver.disconnect();
      const canvas = $('#price-chart');
      if (canvas && 'ResizeObserver' in window) {
        chartResizeObserver = new ResizeObserver(drawChart);
        chartResizeObserver.observe(canvas.parentElement);
      }
    }
    updateHeaderState();
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    playSound();
  }

  function updateHeaderState() {
    const status = $('#connection-state');
    status.classList.toggle('connected', state.connected);
    status.innerHTML = '<i></i><span>' + (state.connected ? 'Simulation running' : 'Simulation paused') + '</span>';
    const button = $('#connect-btn');
    button.innerHTML = state.connected ? '<span class="button-symbol">Ⅱ</span> Pause simulation' : '<span class="button-symbol">▶</span> Start simulation';
    button.classList.toggle('button-secondary', state.connected);
    button.classList.toggle('button-primary', !state.connected);
  }

  function initSeries() {
    const base = market[state.symbol].price;
    let current = base;
    chartValues = [];
    for (let i = 0; i < 76; i++) {
      current += (Math.random() - 0.5) * market[state.symbol].step * 2.1;
      chartValues.push(current);
    }
    chartValues[chartValues.length - 1] = priceFor(state.symbol);
    price = chartValues[chartValues.length - 1];
  }

  function priceFor(symbol) {
    return symbol === state.symbol ? price : market[symbol].price;
  }

  function drawChart() {
    const canvas = $('#price-chart');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width, height = rect.height;
    const pad = { top: 15, right: 54, bottom: 22, left: 5 };
    const values = chartValues.length ? chartValues : [market[state.symbol].price];
    const min = Math.min(...values), max = Math.max(...values);
    const range = (max - min) || market[state.symbol].step * 8;
    const low = min - range * 0.18, high = max + range * 0.18;
    const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
    const x = i => pad.left + i * plotWidth / Math.max(1, values.length - 1);
    const y = value => pad.top + (high - value) / (high - low) * plotHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.font = '9px "DM Mono", monospace';
    for (let i = 0; i < 5; i++) {
      const yy = pad.top + i * plotHeight / 4;
      ctx.strokeStyle = '#26313d'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(width - pad.right, yy); ctx.stroke();
      const value = high - i * (high - low) / 4;
      ctx.fillStyle = '#748293'; ctx.textAlign = 'left';
      ctx.fillText(fmt(value, digitsFor(state.symbol)), width - pad.right + 5, yy + 3);
    }
    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, 'rgba(216,173,96,.19)');
    gradient.addColorStop(1, 'rgba(216,173,96,0)');
    ctx.beginPath();
    values.forEach((value, i) => i ? ctx.lineTo(x(i), y(value)) : ctx.moveTo(x(i), y(value)));
    ctx.lineTo(x(values.length - 1), height - pad.bottom);
    ctx.lineTo(x(0), height - pad.bottom);
    ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath();
    values.forEach((value, i) => i ? ctx.lineTo(x(i), y(value)) : ctx.moveTo(x(i), y(value)));
    ctx.strokeStyle = '#d8ad60'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
    const last = values.length - 1, currentY = y(values[last]);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = '#d8ad6070';
    ctx.beginPath(); ctx.moveTo(pad.left, currentY); ctx.lineTo(width - pad.right, currentY); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x(last), currentY, 3, 0, Math.PI * 2); ctx.fillStyle = '#f0ce8b'; ctx.fill();
    ctx.fillStyle = '#302719'; ctx.fillRect(width - pad.right + 1, Math.max(pad.top, Math.min(height - pad.bottom - 18, currentY - 9)), pad.right - 3, 18);
    ctx.fillStyle = '#f0ce8b'; ctx.textAlign = 'center';
    ctx.fillText(fmt(values[last], digitsFor(state.symbol)), width - pad.right / 2, Math.max(pad.top + 12, Math.min(height - pad.bottom - 5, currentY + 3)));
    ctx.fillStyle = '#748293'; ctx.textAlign = 'left';
    ctx.fillText(state.timeframe === '15m' ? '− 3H' : state.timeframe === '1h' ? '− 12H' : '− 2D', 5, height - 4);
    ctx.textAlign = 'right'; ctx.fillText('NOW', width - pad.right - 4, height - 4);
  }

  function refreshChartLabels() {
    const symbolLabel = $('#chart-symbol');
    if (!symbolLabel) return;
    $('#chart-symbol').textContent = state.symbol;
    $('#instrument-name').textContent = market[state.symbol].name;
    $('#market-price').textContent = fmt(priceFor(state.symbol), digitsFor(state.symbol));
    $('#market-change').textContent = pct(market[state.symbol].change);
    $('#market-change').classList.toggle('positive', market[state.symbol].change >= 0);
    $('#market-change').classList.toggle('negative', market[state.symbol].change < 0);
    $('#chart-time').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC';
    const entry = $('#order-entry');
    if (entry) entry.textContent = fmt(priceFor($('#order-symbol').value), digitsFor($('#order-symbol').value));
  }

  function updateMarket() {
    Object.keys(market).forEach(symbol => {
      const m = market[symbol];
      if (symbol === state.symbol) {
        const factor = state.timeframe === '15m' ? 1 : state.timeframe === '1h' ? 1.7 : 2.6;
        price += (Math.random() - 0.49) * m.step * factor;
        chartValues.push(price);
        if (chartValues.length > 76) chartValues.shift();
      }
      m.change = ((symbol === state.symbol ? price : m.price) - m.price) / m.price * 100 + m.change * 0.12;
    });
    state.positions.forEach(position => {
      const m = market[position.symbol];
      const current = position.symbol === state.symbol ? price : m.price + (Math.random() - 0.5) * m.step * 2;
      position.mark = current;
    });
    refreshChartLabels();
    drawChart();
    if ($('#positions-body')) renderPositions();
    if ($('#market-table-body')) $('#market-table-body').innerHTML = marketRows();
    if ($('#page-title') && state.page === 'overview') {
      const root = $('#page-content');
      const old = root.querySelector('.metric-grid');
      if (old) {
        const holder = document.createElement('div');
        holder.innerHTML = metricsMarkup();
        old.replaceWith(holder.firstElementChild);
      }
    }
  }

  function startSimulation() {
    if (state.connected) return;
    state.connected = true;
    clearInterval(state.marketTimer);
    clearInterval(state.pnlTimer);
    state.marketTimer = window.setInterval(updateMarket, 1500);
    state.pnlTimer = window.setInterval(() => {
      state.positions.forEach(position => {
        const m = market[position.symbol];
        position.mark += (Math.random() - 0.49) * m.step * 2.2;
      });
      if ($('#positions-body')) renderPositions();
      updateOverviewMetrics();
    }, 2300);
    updateHeaderState();
    addActivity('Simulation started', 'Local sample prices are updating. No broker API is connected.', 'green');
    toast('Simulation started', 'Sample data will now animate locally.');
    if (state.page === 'overview') navigate('overview', false);
    else if (state.page === 'markets') navigate('markets', false);
    playSound('success');
  }

  function stopSimulation() {
    state.connected = false;
    clearInterval(state.marketTimer);
    clearInterval(state.pnlTimer);
    updateHeaderState();
    addActivity('Simulation paused', 'Price animation paused; test positions remain available.', 'neutral');
    toast('Simulation paused', 'Your local preview positions have been kept.');
    if (state.page === 'overview') navigate('overview', false);
    else if (state.page === 'markets') navigate('markets', false);
    playSound();
  }

  function updateOverviewMetrics() {
    const grid = $('.metric-grid');
    if (grid && state.page === 'overview') {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = metricsMarkup();
      grid.replaceWith(wrapper.firstElementChild);
    }
  }

  function renderPositions() {
    const body = $('#positions-body');
    if (!body) return;
    if (!state.positions.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="7"><div class="empty-state"><span class="empty-icon">⌁</span><b>No open positions</b><p>Add a simulated position to explore how account metrics and P&amp;L respond.</p><button class="text-action" data-action="open-order">Add simulated position →</button></div></td></tr>';
      return;
    }
    body.innerHTML = state.positions.map(position => {
      const pnl = moneyPnl(position);
      return '<tr><td><span class="symbol-cell">' + position.symbol + '</span></td><td><span class="side-badge ' + position.side.toLowerCase() + '">' + position.side + '</span></td><td>' + fmt(position.volume, 2) + '</td><td>' + fmt(position.entry, digitsFor(position.symbol)) + '</td><td>' + fmt(position.mark, digitsFor(position.symbol)) + '</td><td class="' + (pnl >= 0 ? 'positive' : 'negative') + '">' + (pnl >= 0 ? '+' : '−') + '$' + fmt(Math.abs(pnl)) + '</td><td><button class="text-action" data-action="close-position" data-id="' + position.id + '">Close ×</button></td></tr>';
    }).join('');
  }

  function openOrder() {
    $('#order-symbol').value = state.symbol;
    $$('.direction-btn').forEach(button => {
      const active = button.dataset.side === state.selectedSide;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    refreshChartLabels();
    $('#position-dialog').showModal();
    playSound();
  }

  function createPosition(event) {
    event.preventDefault();
    const symbol = $('#order-symbol').value;
    const side = state.selectedSide;
    const volume = Number($('#order-volume').value);
    const entry = priceFor(symbol);
    const position = { id: Date.now(), symbol, side, volume, entry, mark: entry, openedAt: new Date() };
    state.positions.unshift(position);
    addActivity('Simulated position opened', side + ' ' + fmt(volume, 2) + ' lots · ' + symbol + ' at ' + fmt(entry, digitsFor(symbol)), 'gold');
    $('#position-dialog').close();
    toast('Test position opened', side + ' ' + fmt(volume, 2) + ' lots of ' + symbol + '.');
    if (!state.connected) {
      state.connected = true;
      state.marketTimer = window.setInterval(updateMarket, 1500);
      state.pnlTimer = window.setInterval(() => {
        state.positions.forEach(p => { p.mark += (Math.random() - 0.49) * market[p.symbol].step * 2.2; });
        if ($('#positions-body')) renderPositions();
        updateOverviewMetrics();
      }, 2300);
      updateHeaderState();
      addActivity('Simulation started', 'Local prices are animating to demonstrate position updates.', 'green');
    }
    navigate(state.page, false);
    playSound('success');
  }

  function closePosition(id) {
    const index = state.positions.findIndex(position => position.id === Number(id));
    if (index < 0) return;
    const position = state.positions[index];
    const realized = moneyPnl(position);
    state.balance += realized;
    state.positions.splice(index, 1);
    addActivity('Simulated position closed', position.symbol + ' · illustrative realized P&L ' + (realized >= 0 ? '+' : '−') + '$' + fmt(Math.abs(realized)), realized >= 0 ? 'green' : 'red');
    toast('Test position closed', 'Illustrative result: ' + (realized >= 0 ? '+' : '−') + '$' + fmt(Math.abs(realized)) + '.');
    navigate(state.page, false);
    playSound('success');
  }

  function selectMarket(symbol) {
    if (!market[symbol]) return;
    state.symbol = symbol;
    price = market[symbol].price;
    initSeries();
    addActivity('Market selected', symbol + ' selected in the local preview.', 'neutral');
    navigate(state.page === 'markets' ? 'markets' : 'overview', false);
  }

  function exportAudit() {
    const rows = [['Timestamp UTC', 'Type', 'Event', 'Details']];
    state.activity.slice().reverse().forEach(item => rows.push([
      item.time.toISOString(), item.type, item.title, item.detail
    ]));
    const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smartblinks-preview-audit.csv';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Audit exported', 'Downloaded the current local event list as CSV.');
    playSound('success');
  }

  function resetDemo() {
    clearInterval(state.marketTimer);
    clearInterval(state.pnlTimer);
    state.connected = false;
    state.balance = 10000;
    state.positions = [];
    state.symbol = 'XAUUSD';
    state.timeframe = '15m';
    state.maxRisk = 1;
    state.activity = [];
    price = market.XAUUSD.price;
    addActivity('Preview reset', 'Local positions and event history were cleared.', 'neutral');
    navigate('overview');
    toast('Preview reset', 'Simulated account restored to its starting state.');
  }

  function handleAction(action, element) {
    if (action === 'open-order') openOrder();
    else if (action === 'close-position') closePosition(element.dataset.id);
    else if (action === 'select-market') selectMarket(element.dataset.symbol);
    else if (action === 'export-audit') exportAudit();
    else if (action === 'reset-demo') {
      if (window.confirm('Reset the local preview? This clears simulated positions and event history.')) resetDemo();
    } else if (action === 'start-stop') state.connected ? stopSimulation() : startSimulation();
  }

  function updateClock() {
    $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC';
  }

  document.addEventListener('click', event => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) {
      navigate(pageButton.dataset.page);
      return;
    }
    const navigateButton = event.target.closest('[data-navigate]');
    if (navigateButton) {
      navigate(navigateButton.dataset.navigate);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      handleAction(actionButton.dataset.action, actionButton);
      return;
    }
    const filterButton = event.target.closest('[data-filter]');
    if (filterButton) {
      state.auditFilter = filterButton.dataset.filter;
      $$('.filter-button').forEach(button => button.classList.toggle('active', button === filterButton));
      renderAudit();
      playSound();
      return;
    }
    const settingButton = event.target.closest('[data-setting]');
    if (settingButton) {
      const key = settingButton.dataset.setting;
      state[key] = !state[key];
      if (key === 'sound') {
        $('#sound-state').textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
        $('#sound-toggle').setAttribute('aria-pressed', String(state.sound));
      }
      addActivity('Preference updated', key + ' ' + (state[key] ? 'enabled' : 'disabled') + ' for this browser session.', 'neutral');
      navigate('settings', false);
      playSound();
    }
  });

  $('#connect-btn').addEventListener('click', () => state.connected ? stopSimulation() : startSimulation());
  $('#sound-toggle').addEventListener('click', () => {
    state.sound = !state.sound;
    $('#sound-state').textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
    $('#sound-toggle').setAttribute('aria-pressed', String(state.sound));
    if (state.page === 'settings') navigate('settings', false);
    toast('Interface sounds ' + (state.sound ? 'enabled' : 'disabled'), state.sound ? 'Subtle local feedback tones are on.' : 'Sounds are muted.');
    playSound('success');
  });
  $('#profile-button').addEventListener('click', () => toast('Preview profile', 'This is a standalone UI demo; no user account is signed in.'));
  $('#banner-dismiss').addEventListener('click', () => {
    state.showBanner = false;
    $('#sim-banner').hidden = true;
  });
  $('#position-form').addEventListener('submit', createPosition);
  $('#dialog-close').addEventListener('click', () => $('#position-dialog').close());
  $('#dialog-cancel').addEventListener('click', () => $('#position-dialog').close());
  $('#position-dialog').addEventListener('click', event => {
    if (event.target === $('#position-dialog')) $('#position-dialog').close();
  });
  $$('.direction-btn').forEach(button => button.addEventListener('click', () => {
    state.selectedSide = button.dataset.side;
    $$('.direction-btn').forEach(other => {
      const active = other === button;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    playSound();
  }));
  document.addEventListener('change', event => {
    if (event.target.id === 'symbol-select') {
      state.symbol = event.target.value;
      price = market[state.symbol].price;
      initSeries();
      navigate(state.page, false);
    }
    if (event.target.id === 'order-symbol') refreshChartLabels();
  });
  document.addEventListener('click', event => {
    const timeframe = event.target.closest('[data-time]');
    if (!timeframe) return;
    state.timeframe = timeframe.dataset.time;
    navigate(state.page, false);
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'risk-slider') {
      state.maxRisk = Number(event.target.value);
      $('#risk-value').textContent = fmt(state.maxRisk, 1) + '%';
      $('#risk-meter-fill').style.width = (state.maxRisk / 3 * 100) + '%';
    }
  });
  window.addEventListener('resize', drawChart);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) drawChart(); });

  addActivity('Preview initialized', 'Simulation is ready. All figures and events are illustrative.', 'neutral');
  addActivity('Risk gate display ready', 'The risk panel is a visual example and does not enforce live trading rules.', 'gold');
  updateClock();
  window.setInterval(updateClock, 1000);
  navigate('overview', false);
})();