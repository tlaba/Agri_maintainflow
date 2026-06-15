/* ===================================================================
   MaintainFlow Ag — offline-first PWA
   Data persists in localStorage (falls back to in-memory if blocked).
   =================================================================== */
(function () {
  'use strict';

  /* ---------------- storage ---------------- */
  var KEY = 'mfag.v1';
  var mem = null; // in-memory fallback
  function canStore() { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; } catch (e) { return false; } }
  var STORE_OK = canStore();
  function load() {
    if (!STORE_OK) return mem;
    try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function save() {
    if (!STORE_OK) { mem = DB; return; }
    try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {}
  }

  /* ---------------- seed ---------------- */
  function today() { return new Date(); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function iso(y, m, d) { return new Date(y, m - 1, d).toISOString().slice(0, 10); }
  var YR = today().getFullYear();

  function seed() {
    return {
      settings: { farmName: "Kgosi's Farm", greeting: 'Dumela', season: (YR - 1) + '/' + String(YR).slice(2) },
      dismissInstall: false,
      fields: [
        { id: f(), tag: 'FLD-01', crop: 'maize',      variety: 'SC Duma 43',     sizeHa: 2.4, plantedISO: iso(YR, 3, 12), status: 'healthy' },
        { id: f(), tag: 'FLD-02', crop: 'soybean',    variety: 'Dina',           sizeHa: 1.1, plantedISO: iso(YR, 3, 20), status: 'watch' },
        { id: f(), tag: 'FLD-03', crop: 'wheat',      variety: 'PAN 3471',       sizeHa: 3.0, plantedISO: iso(YR, 5, 2),  status: 'healthy' },
        { id: f(), tag: 'FLD-04', crop: 'vegetables', variety: 'rape & spinach', sizeHa: 0.3, plantedISO: iso(YR, 4, 1),  status: 'healthy' }
      ],
      tasks: [],
      expenses: [
        { id: f(), fieldId: null, category: 'Fertilizer', amount: 1928, dateISO: addDays(-40), note: 'Compound D + LAN' },
        { id: f(), fieldId: null, category: 'Seed',       amount: 1542, dateISO: addDays(-60), note: 'Maize & soybean seed' },
        { id: f(), fieldId: null, category: 'Fuel',       amount: 771,  dateISO: addDays(-25), note: 'Tractor diesel' },
        { id: f(), fieldId: null, category: 'Labour',     amount: 579,  dateISO: addDays(-10), note: 'Weeding crew' }
      ]
    };
  }
  function seedTasks() {
    var m = DB.fields[0].id, s = DB.fields[1].id, w = DB.fields[2].id, v = DB.fields[3].id;
    DB.tasks = [
      { id: f(), fieldId: v, type: 'Weeding',     name: 'Second-pass weeding',  detail: 'Whole plot',            dueISO: addDays(-2), completed: false, cost: 0 },
      { id: f(), fieldId: m, type: 'Fertilizer',  name: 'Top-dress LAN',        detail: '50 kg',                 dueISO: addDays(3),  completed: false, cost: 640 },
      { id: f(), fieldId: s, type: 'Scouting',    name: 'Scout for aphids',     detail: 'Check leaf undersides', dueISO: addDays(1),  completed: false, cost: 0 },
      { id: f(), fieldId: w, type: 'Irrigation',  name: 'Irrigate',             detail: 'If no rain',            dueISO: addDays(4),  completed: false, cost: 0 },
      { id: f(), fieldId: m, type: 'Spray',       name: 'Fungicide — leaf rust',detail: '14-day re-entry',       dueISO: addDays(17), completed: false, cost: 380 },
      { id: f(), fieldId: m, type: 'Fertilizer',  name: 'Basal compound D',     detail: '120 kg',                dueISO: iso(YR,3,12), completed: true, completedISO: iso(YR,3,12), cost: 1560 },
      { id: f(), fieldId: m, type: 'Planting',    name: 'Sowing — 75 cm rows',  detail: '22 kg seed',            dueISO: iso(YR,3,12), completed: true, completedISO: iso(YR,3,12), cost: 0 }
    ];
  }

  /* ---------------- helpers ---------------- */
  function f() { return 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return 'P ' + Math.round(n).toLocaleString('en-US'); }
  function $(s, r) { return (r || document).querySelector(s); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  var CROP = {
    maize: { e: '🌽', c: 'crop-maize', label: 'Maize' }, soybean: { e: '🫛', c: 'crop-soy', label: 'Soybean' },
    wheat: { e: '🌾', c: 'crop-wheat', label: 'Wheat' }, vegetables: { e: '🥬', c: 'crop-veg', label: 'Vegetables' },
    other: { e: '🌱', c: 'crop-other', label: 'Other' }
  };
  function cropOf(k) { return CROP[k] || CROP.other; }
  function fmtDate(isoStr) { if (!isoStr) return ''; var d = new Date(isoStr + 'T00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function daysBetween(isoStr) { var d = new Date(isoStr + 'T00:00'), n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((d - n) / 86400000); }
  function taskState(t) {
    if (t.completed) return 'done';
    var dd = daysBetween(t.dueISO);
    if (dd < 0) return 'over';
    if (dd <= 4) return 'due';
    return 'sched';
  }
  function fieldById(id) { return DB.fields.filter(function (x) { return x.id === id; })[0]; }

  /* ---------------- KPI ---------------- */
  function totalSpend() {
    var e = DB.expenses.reduce(function (a, x) { return a + (+x.amount || 0); }, 0);
    return e;
  }
  function totalHa() { return DB.fields.reduce(function (a, x) { return a + (+x.sizeHa || 0); }, 0); }
  function tasksDueCount() { return DB.tasks.filter(function (t) { var s = taskState(t); return s === 'over' || s === 'due'; }).length; }
  function expenseByCat() {
    var cats = { Fertilizer: 0, Seed: 0, Fuel: 0, Labour: 0, Chemicals: 0, Other: 0 };
    DB.expenses.forEach(function (x) { cats[x.category] = (cats[x.category] || 0) + (+x.amount || 0); });
    return cats;
  }
  var CATCOLOR = { Fertilizer: '#3E8E5A', Seed: '#E8A93C', Fuel: '#15A0A2', Labour: '#C4543A', Chemicals: '#6f6fb0', Other: '#5e7080' };

  /* ---------------- state ---------------- */
  var DB = load();
  if (!DB) { DB = seed(); seedTasks(); save(); }
  if (!DB.tasks || !DB.tasks.length) { /* keep */ }

  var state = { view: 'fields', fieldId: null, taskFilter: 'All' };

  /* ===================================================================
     VIEWS
     =================================================================== */
  function setTopbar(html) { $('#topbarExtra').innerHTML = html || ''; }
  function homeTopbar() {
    $('#topbar').innerHTML =
      '<div class="brandrow">' +
        '<div class="wordmark"><span class="logo-tile"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V11"/><path d="M12 11c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z"/></svg></span>MaintainFlow <span class="ag-tag">AG</span></div>' +
        '<button class="offline" id="syncPill" type="button"><span class="dot"></span><span id="syncText">Offline-ready</span></button>' +
      '</div>' +
      '<div class="tb-greet">' + esc(DB.settings.greeting) + ',<b>' + esc(DB.settings.farmName) + '</b></div>';
    wireSyncPill(); updateSyncPill();
  }

  /* ---- FIELDS ---- */
  function viewFields() {
    homeTopbar();
    var v = $('#view'); v.innerHTML = '';
    // alert (frost) — only if user has veg/seedlings
    v.appendChild(el(
      '<div class="alert"><span class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4543A" stroke-width="2" stroke-linecap="round"><path d="M12 2v6"/><path d="M12 22v-3"/><path d="M2 14h3"/><path d="M19 14h3"/><circle cx="12" cy="14" r="4"/></svg></span><div><b>Frost warning tonight</b><p>Low 2°C · cover seedlings &amp; tender crops</p></div></div>'
    ));
    // install card (if not installed)
    if (!isStandalone() && installAvailable()) {
      var ic = el(
        '<div class="install-card"><span class="ic2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M5 21h14"/></svg></span>' +
        '<div class="t"><b>Add to home screen</b><span>One tap — opens like an app and works with no signal.</span></div>' +
        '<button id="cardInstall">Install</button></div>');
      v.appendChild(ic);
      $('#cardInstall', ic).addEventListener('click', triggerInstall);
    }
    // KPIs
    v.appendChild(el(
      '<div class="kpis">' +
        '<div class="kpi"><div class="v">' + DB.fields.length + '</div><div class="l">Fields</div></div>' +
        '<div class="kpi"><div class="v">' + tasksDueCount() + '</div><div class="l">Tasks due</div></div>' +
        '<div class="kpi"><div class="v sm">' + money(totalSpend()) + '</div><div class="l">Spend</div></div>' +
      '</div>'));
    v.appendChild(el('<div class="sec-h"><h3>Your fields</h3><span class="link" id="addField2">+ Add field</span></div>'));
    $('#addField2', v).addEventListener('click', openFieldForm);

    if (!DB.fields.length) {
      v.appendChild(emptyState('No fields yet', 'Add your first field to start tracking tasks, costs and yields.'));
    } else {
      DB.fields.forEach(function (fld) {
        var c = cropOf(fld.crop);
        var next = nextTaskFor(fld.id);
        var statusClass = 'healthy', statusLabel = 'Healthy';
        if (next && taskState(next) === 'over') { statusClass = 'over'; statusLabel = 'Overdue'; }
        else if (fld.status === 'watch') { statusClass = 'watch'; statusLabel = 'Watch'; }
        var nextHtml = next
          ? '<div class="next">' + dueIcon(taskState(next)) + esc(next.name) + ' · ' + dueLabel(next) + '</div>'
          : '<div class="next">' + dueIcon('sched') + 'No upcoming tasks</div>';
        var card = el(
          '<button class="field"><span class="crop-ic ' + c.c + '">' + c.e + '</span>' +
          '<div class="meta"><span class="tag">' + esc(fld.tag) + '</span>' +
          '<div class="name">' + c.label + ' · ' + esc(fld.variety) + '</div>' +
          '<div class="sub">' + fld.sizeHa + ' ha · planted ' + fmtDate(fld.plantedISO) + '</div>' +
          nextHtml + '</div>' +
          '<span class="status s-' + statusClass + '">' + statusLabel + '</span></button>');
        card.addEventListener('click', function () { state.fieldId = fld.id; go('field'); });
        v.appendChild(card);
      });
    }
    setFab('+ Field', openFieldForm);
  }
  function nextTaskFor(fid) {
    var open = DB.tasks.filter(function (t) { return t.fieldId === fid && !t.completed; });
    open.sort(function (a, b) { return a.dueISO < b.dueISO ? -1 : 1; });
    return open[0] || null;
  }
  function dueLabel(t) {
    var dd = daysBetween(t.dueISO);
    if (dd < 0) return 'overdue ' + (-dd) + 'd';
    if (dd === 0) return 'due today';
    if (dd === 1) return 'due tomorrow';
    return 'in ' + dd + ' days';
  }
  function dueIcon(st) {
    var col = st === 'over' ? '#C4543A' : '#15A0A2';
    if (st === 'over') return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round"><path d="M12 8v5"/><path d="M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>';
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg>';
  }

  /* ---- FIELD DETAIL (work orders) ---- */
  function viewField() {
    var fld = fieldById(state.fieldId);
    if (!fld) { go('fields'); return; }
    var c = cropOf(fld.crop);
    $('#topbar').innerHTML =
      '<div class="tb-back"><button class="bk" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<button class="offline" id="syncPill" type="button" style="margin-left:auto"><span class="dot"></span><span id="syncText">Offline-ready</span></button></div>' +
      '<div class="tb-title"><div class="t"><span class="tg">' + esc(fld.tag) + '</span> ' + c.label + '</div>' +
      '<div class="row">' + esc(fld.variety) + ' · ' + fld.sizeHa + ' ha · planted ' + fmtDate(fld.plantedISO) + '</div></div>';
    $('#backBtn').addEventListener('click', function () { go('fields'); });
    wireSyncPill(); updateSyncPill();

    var v = $('#view'); v.innerHTML = '';
    var days = daysBetween(fld.plantedISO) * -1; if (days < 0) days = 0;
    v.appendChild(el(
      '<div class="mini-kpis"><div><div class="v">' + days + '</div><div class="l">Days in</div></div>' +
      '<div><div class="v">' + openCount(fld.id) + '</div><div class="l">Open tasks</div></div>' +
      '<div><div class="v">' + money(spendForField(fld.id)) + '</div><div class="l">Spend</div></div></div>'));

    var filters = ['All', 'Fertilizer', 'Spray', 'Done'];
    var chips = el('<div class="chips"></div>');
    filters.forEach(function (fl) {
      var b = el('<button class="chip' + (state.taskFilter === fl ? ' on' : '') + '">' + fl + '</button>');
      b.addEventListener('click', function () { state.taskFilter = fl; viewField(); });
      chips.appendChild(b);
    });
    v.appendChild(chips);

    var tasks = DB.tasks.filter(function (t) { return t.fieldId === fld.id; });
    tasks = tasks.filter(function (t) {
      if (state.taskFilter === 'All') return true;
      if (state.taskFilter === 'Done') return t.completed;
      return t.type === state.taskFilter && !t.completed;
    });
    tasks.sort(function (a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.dueISO < b.dueISO ? -1 : 1;
    });
    if (!tasks.length) {
      v.appendChild(emptyState('No tasks here', 'Add a work order — planting, fertilizer, spraying, scouting and more.'));
    } else {
      tasks.forEach(function (t) { v.appendChild(woCard(t)); });
    }
    setFab('+ Task', function () { openTaskForm(fld.id); });
  }
  function openCount(fid) { return DB.tasks.filter(function (t) { return t.fieldId === fid && !t.completed; }).length; }
  function spendForField(fid) { return DB.expenses.filter(function (e) { return e.fieldId === fid; }).reduce(function (a, x) { return a + (+x.amount || 0); }, 0); }
  function woCard(t) {
    var st = taskState(t);
    var pill = { over: ['p-over', 'Overdue ' + Math.abs(daysBetween(t.dueISO)) + 'd'], due: ['p-due', dueLabel(t)], sched: ['p-sched', 'Scheduled'], done: ['p-done', '✓ Logged'] }[st];
    var detLine = t.completed ? (t.completedISO ? fmtDate(t.completedISO) : 'done') : ('Due ' + fmtDate(t.dueISO));
    if (t.detail) detLine += ' · ' + esc(t.detail);
    if (t.cost > 0) detLine += ' · ' + money(t.cost);
    var card = el(
      '<div class="wo ' + st + '"><div class="wo-top"><span class="type">' + esc(t.type.toUpperCase()) + '</span><span class="pill ' + pill[0] + '">' + pill[1] + '</span></div>' +
      '<div class="name">' + esc(t.name) + '</div><div class="det">' + detLine + '</div>' +
      '<div class="wo-actions"></div></div>');
    var act = $('.wo-actions', card);
    if (!t.completed) {
      var done = el('<button class="done-btn">Mark done</button>');
      done.addEventListener('click', function () { completeTask(t); });
      act.appendChild(done);
    }
    var edit = el('<button>Edit</button>');
    edit.addEventListener('click', function () { openTaskForm(t.fieldId, t); });
    act.appendChild(edit);
    return card;
  }

  /* ---- MONEY ---- */
  function viewMoney() {
    homeTopbar();
    var v = $('#view'); v.innerHTML = '';
    var spend = totalSpend(), ha = totalHa();
    var perHa = ha ? spend / ha : 0;
    v.appendChild(el('<div class="tb-greet" style="color:var(--muted);margin:2px 2px 14px"><b style="color:var(--navy);font-family:\'Space Grotesk\';font-size:15px;display:block">Season ' + esc(DB.settings.season) + ' · whole farm</b></div>'));
    v.appendChild(el(
      '<div class="big2"><div class="big-card"><div class="l">Spend to date</div><div class="v"><span class="c">P </span>' + Math.round(spend).toLocaleString('en-US') + '</div><div class="trend">across ' + DB.fields.length + ' fields</div></div>' +
      '<div class="big-card"><div class="l">Cost per ha</div><div class="v"><span class="c">P </span>' + Math.round(perHa).toLocaleString('en-US') + '</div><div class="trend">' + ha.toFixed(1) + ' ha total</div></div></div>'));

    // breakdown
    var cats = expenseByCat();
    var order = ['Fertilizer', 'Seed', 'Chemicals', 'Fuel', 'Labour', 'Other'];
    var active = order.filter(function (k) { return cats[k] > 0; });
    var bd = el('<div class="breakdown"><h4>Where the money went</h4><div class="stacked"></div><div class="legend"></div></div>');
    var stacked = $('.stacked', bd), legend = $('.legend', bd);
    active.forEach(function (k) {
      var pct = spend ? (cats[k] / spend * 100) : 0;
      stacked.appendChild(el('<i style="width:' + pct.toFixed(1) + '%;background:' + CATCOLOR[k] + '"></i>'));
      legend.appendChild(el('<span class="lg"><span class="sw" style="background:' + CATCOLOR[k] + '"></span>' + k + ' <b>' + money(cats[k]) + '</b></span>'));
    });
    if (!active.length) bd = emptyState('No expenses yet', 'Log seed, fertilizer, fuel and labour to see your cost breakdown.');
    v.appendChild(bd);

    // market prices (sample, offline)
    v.appendChild(el('<div class="sec-h"><h3>Market prices · Gaborone</h3><span class="link">sample</span></div>'));
    var mk = el('<div class="market"></div>');
    [['🌽', 'Maize (white)', 'per tonne', 'P 3,950', 'up', '▲ 2.1%'],
     ['🌾', 'Wheat', 'per tonne', 'P 5,400', 'down', '▼ 0.8%'],
     ['🫛', 'Soybean', 'per tonne', 'P 7,200', 'up', '▲ 1.4%'],
     ['🥬', 'Cabbage', 'per crate', 'P 95', 'up', '▲ 3.0%']].forEach(function (r) {
      mk.appendChild(el('<div class="mrow"><div class="cn"><span class="ci crop-veg">' + r[0] + '</span><div><div class="cnm">' + r[1] + '</div><div class="cu">' + r[2] + '</div></div></div><div class="pr"><div class="px">' + r[3] + '</div><div class="ch ' + r[4] + '">' + r[5] + '</div></div></div>'));
    });
    v.appendChild(mk);

    // recent expenses
    v.appendChild(el('<div class="sec-h"><h3>Recent expenses</h3><span class="link" id="addExp2">+ Log</span></div>'));
    $('#addExp2', v).addEventListener('click', openExpenseForm);
    var recent = DB.expenses.slice().sort(function (a, b) { return a.dateISO < b.dateISO ? 1 : -1; }).slice(0, 8);
    recent.forEach(function (e) {
      var fld = fieldById(e.fieldId);
      var sub = (fld ? fld.tag + ' · ' : 'Whole farm · ') + fmtDate(e.dateISO) + (e.note ? ' · ' + esc(e.note) : '');
      v.appendChild(el('<div class="expense-row"><span class="ec" style="background:' + (CATCOLOR[e.category] || '#5e7080') + '"></span><div class="em"><div class="ename">' + esc(e.category) + '</div><div class="esub">' + sub + '</div></div><div class="eamt">' + money(e.amount) + '</div></div>'));
    });
    setFab('+ Expense', openExpenseForm);
  }

  /* ---- PESTS ---- */
  var PESTS = [
    { e: '🐛', name: 'Fall armyworm', crop: 'Maize, sorghum', body: 'Ragged holes and "windowing" on young leaves; sawdust-like frass in the funnel. <b>Treatment:</b> scout weekly at dawn; apply registered insecticide into the funnel early morning while larvae are small. Rotate actives to avoid resistance.' },
    { e: '🦗', name: 'Aphids', crop: 'Soybean, vegetables', body: 'Clusters on stems and leaf undersides; sticky honeydew and curling leaves. <b>Treatment:</b> encourage ladybirds; spray soapy water or a registered systemic only above threshold. Avoid blanket spraying.' },
    { e: '🍂', name: 'Maize leaf rust', crop: 'Maize', body: 'Small reddish-brown pustules on both leaf surfaces. <b>Treatment:</b> plant tolerant varieties; apply a registered fungicide at first sign, observing the re-entry interval before re-entering the field.' },
    { e: '🐌', name: 'Cutworms', crop: 'Vegetables, seedlings', body: 'Seedlings cut off at soil level overnight. <b>Treatment:</b> clear weeds before planting; use bait or a registered drench around the stem base in the evening.' }
  ];
  function viewPests() {
    homeTopbar();
    var v = $('#view'); v.innerHTML = '';
    v.appendChild(el('<div class="sec-h"><h3>Pest &amp; disease library</h3></div>'));
    v.appendChild(el('<p style="font-size:12.5px;color:var(--muted);margin:-6px 2px 14px;line-height:1.5">Quick reference, available offline. Always follow the product label and local regulations. When unsure, consult your extension officer.</p>'));
    PESTS.forEach(function (p) {
      v.appendChild(el('<div class="pest"><div class="ph"><span class="pic">' + p.e + '</span><div><div class="pname">' + p.name + '</div><div class="pcrop">' + p.crop + '</div></div></div><div class="pbody">' + p.body + '</div></div>'));
    });
    hideFab();
  }

  /* ---------------- shared UI ---------------- */
  function emptyState(title, body) {
    return el('<div class="empty"><div class="eic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15A0A2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V11"/><path d="M12 11c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z"/></svg></div><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></div>');
  }
  function setFab(label, fn) {
    var fab = $('#fab'); fab.hidden = false;
    fab.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' + label;
    fab.onclick = fn;
  }
  function hideFab() { $('#fab').hidden = true; }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------------- modals / forms ---------------- */
  function openModal(html) {
    var host = $('#modalHost'); host.hidden = false;
    host.innerHTML = '<div class="modal">' + html + '</div>';
    host.onclick = function (e) { if (e.target === host) closeModal(); };
    return host;
  }
  function closeModal() { var h = $('#modalHost'); h.hidden = true; h.innerHTML = ''; }

  function openFieldForm(existing) {
    var ed = existing && existing.id ? existing : null;
    var nextTag = 'FLD-' + String(DB.fields.length + 1).padStart(2, '0');
    var host = openModal(
      '<div class="modal-head"><h3>' + (ed ? 'Edit field' : 'New field') + '</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="field-group"><label>Crop</label><div class="seg" id="cropSeg"></div></div>' +
      '<div class="row2"><div class="field-group"><label>Field tag</label><input id="fTag" value="' + esc(ed ? ed.tag : nextTag) + '"></div>' +
      '<div class="field-group"><label>Size (hectares)</label><input id="fSize" type="number" inputmode="decimal" step="0.1" value="' + (ed ? ed.sizeHa : '') + '" placeholder="2.4"></div></div>' +
      '<div class="field-group"><label>Seed variety</label><input id="fVar" value="' + esc(ed ? ed.variety : '') + '" placeholder="e.g. SC Duma 43"></div>' +
      '<div class="field-group"><label>Planting date</label><input id="fPlant" type="date" value="' + (ed ? ed.plantedISO : addDays(0)) + '"></div>' +
      '<button class="btn-primary" id="fSave">' + (ed ? 'Save changes' : 'Add field') + '</button>' +
      (ed ? '<button class="btn-danger" id="fDel">Delete field</button>' : ''));
    var crop = ed ? ed.crop : 'maize';
    var seg = $('#cropSeg', host);
    Object.keys(CROP).forEach(function (k) {
      var b = el('<button' + (k === crop ? ' class="on"' : '') + '>' + CROP[k].e + ' ' + CROP[k].label + '</button>');
      b.addEventListener('click', function () { crop = k; seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); });
      seg.appendChild(b);
    });
    $('#mx', host).onclick = closeModal;
    $('#fSave', host).onclick = function () {
      var tag = $('#fTag', host).value.trim() || nextTag;
      var size = parseFloat($('#fSize', host).value) || 0;
      var vr = $('#fVar', host).value.trim() || cropOf(crop).label;
      var pl = $('#fPlant', host).value || addDays(0);
      if (ed) { ed.tag = tag; ed.crop = crop; ed.variety = vr; ed.sizeHa = size; ed.plantedISO = pl; }
      else { DB.fields.push({ id: f(), tag: tag, crop: crop, variety: vr, sizeHa: size, plantedISO: pl, status: 'healthy' }); }
      save(); closeModal(); render(); toast(ed ? 'Field updated' : 'Field added');
    };
    if (ed) $('#fDel', host).onclick = function () {
      DB.fields = DB.fields.filter(function (x) { return x.id !== ed.id; });
      DB.tasks = DB.tasks.filter(function (x) { return x.fieldId !== ed.id; });
      save(); closeModal(); go('fields'); toast('Field deleted');
    };
  }

  var TASK_TYPES = ['Planting', 'Fertilizer', 'Spray', 'Weeding', 'Irrigation', 'Scouting', 'Harvest', 'Other'];
  function openTaskForm(fid, existing) {
    var ed = existing && existing.id ? existing : null;
    var host = openModal(
      '<div class="modal-head"><h3>' + (ed ? 'Edit task' : 'New work order') + '</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="field-group"><label>Type</label><select id="tType">' + TASK_TYPES.map(function (t) { return '<option' + (ed && ed.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="field-group"><label>Task name</label><input id="tName" value="' + esc(ed ? ed.name : '') + '" placeholder="e.g. Top-dress LAN"></div>' +
      '<div class="field-group"><label>Detail (optional)</label><input id="tDet" value="' + esc(ed ? ed.detail : '') + '" placeholder="e.g. 50 kg"></div>' +
      '<div class="row2"><div class="field-group"><label>Due date</label><input id="tDue" type="date" value="' + (ed ? ed.dueISO : addDays(3)) + '"></div>' +
      '<div class="field-group"><label>Est. cost (P)</label><input id="tCost" type="number" inputmode="decimal" value="' + (ed && ed.cost ? ed.cost : '') + '" placeholder="0"></div></div>' +
      '<button class="btn-primary" id="tSave">' + (ed ? 'Save changes' : 'Add work order') + '</button>' +
      (ed ? '<button class="btn-danger" id="tDel">Delete task</button>' : ''));
    $('#mx', host).onclick = closeModal;
    $('#tSave', host).onclick = function () {
      var type = $('#tType', host).value;
      var name = $('#tName', host).value.trim() || type;
      var det = $('#tDet', host).value.trim();
      var due = $('#tDue', host).value || addDays(3);
      var cost = parseFloat($('#tCost', host).value) || 0;
      if (ed) { ed.type = type; ed.name = name; ed.detail = det; ed.dueISO = due; ed.cost = cost; }
      else { DB.tasks.push({ id: f(), fieldId: fid, type: type, name: name, detail: det, dueISO: due, completed: false, cost: cost }); }
      save(); closeModal(); render(); toast(ed ? 'Task updated' : 'Work order added');
    };
    if (ed) $('#tDel', host).onclick = function () {
      DB.tasks = DB.tasks.filter(function (x) { return x.id !== ed.id; });
      save(); closeModal(); render(); toast('Task deleted');
    };
  }
  var TYPE2CAT = { Fertilizer: 'Fertilizer', Spray: 'Chemicals', Planting: 'Seed', Weeding: 'Labour', Harvest: 'Labour', Irrigation: 'Fuel', Scouting: 'Other', Other: 'Other' };
  function completeTask(t) {
    t.completed = true; t.completedISO = addDays(0);
    if (t.cost > 0) {
      DB.expenses.push({ id: f(), fieldId: t.fieldId, category: TYPE2CAT[t.type] || 'Other', amount: t.cost, dateISO: t.completedISO, note: t.name });
    }
    save(); render(); toast(t.cost > 0 ? 'Done — ' + money(t.cost) + ' logged to expenses' : 'Marked done');
  }

  var EXP_CATS = ['Seed', 'Fertilizer', 'Chemicals', 'Fuel', 'Labour', 'Other'];
  function openExpenseForm() {
    var host = openModal(
      '<div class="modal-head"><h3>Log expense</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="field-group"><label>Category</label><select id="eCat">' + EXP_CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="row2"><div class="field-group"><label>Amount (P)</label><input id="eAmt" type="number" inputmode="decimal" placeholder="0"></div>' +
      '<div class="field-group"><label>Date</label><input id="eDate" type="date" value="' + addDays(0) + '"></div></div>' +
      '<div class="field-group"><label>Field (optional)</label><select id="eField"><option value="">Whole farm</option>' + DB.fields.map(function (x) { return '<option value="' + x.id + '">' + esc(x.tag + ' · ' + cropOf(x.crop).label) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field-group"><label>Note (optional)</label><input id="eNote" placeholder="e.g. tractor diesel"></div>' +
      '<button class="btn-primary" id="eSave">Log expense</button>');
    $('#mx', host).onclick = closeModal;
    $('#eSave', host).onclick = function () {
      var amt = parseFloat($('#eAmt', host).value) || 0;
      if (amt <= 0) { toast('Enter an amount'); return; }
      DB.expenses.push({ id: f(), fieldId: $('#eField', host).value || null, category: $('#eCat', host).value, amount: amt, dateISO: $('#eDate', host).value || addDays(0), note: $('#eNote', host).value.trim() });
      save(); closeModal(); render(); toast('Expense logged');
    };
  }

  /* ---------------- router ---------------- */
  function go(view) { state.view = view; if (view !== 'field') state.taskFilter = 'All'; render(); window.scrollTo(0, 0); $('#view').scrollTop = 0; }
  function render() {
    document.querySelectorAll('.nav-item').forEach(function (b) {
      var match = b.dataset.view === state.view || (state.view === 'field' && b.dataset.view === 'fields');
      b.classList.toggle('on', match);
    });
    if (state.view === 'fields') viewFields();
    else if (state.view === 'field') viewField();
    else if (state.view === 'tasks') viewAllTasks();
    else if (state.view === 'money') viewMoney();
    else if (state.view === 'pests') viewPests();
  }
  // global "Tasks" tab = all open work orders across fields
  function viewAllTasks() {
    homeTopbar();
    var v = $('#view'); v.innerHTML = '';
    v.appendChild(el('<div class="sec-h"><h3>All work orders</h3><span class="link">' + tasksDueCount() + ' due</span></div>'));
    var open = DB.tasks.filter(function (t) { return !t.completed; }).sort(function (a, b) { return a.dueISO < b.dueISO ? -1 : 1; });
    var done = DB.tasks.filter(function (t) { return t.completed; });
    if (!open.length && !done.length) {
      v.appendChild(emptyState('No tasks yet', 'Open a field and add a work order to get started.'));
    }
    open.forEach(function (t) {
      var fld = fieldById(t.fieldId);
      var card = woCard(t);
      var det = $('.det', card);
      if (fld) det.insertAdjacentHTML('afterbegin', '<span style="color:var(--teal-deep);font-weight:600">' + esc(fld.tag) + '</span> · ');
      v.appendChild(card);
    });
    if (done.length) {
      v.appendChild(el('<div class="sec-h" style="margin-top:14px"><h3>Completed</h3></div>'));
      done.slice(-6).reverse().forEach(function (t) { v.appendChild(woCard(t)); });
    }
    hideFab();
  }

  /* nav wiring */
  document.querySelectorAll('.nav-item').forEach(function (b) {
    b.addEventListener('click', function () { go(b.dataset.view); });
  });

  /* ---------------- sync pill / online state ---------------- */
  function wireSyncPill() { var p = $('#syncPill'); if (p) p.onclick = function () { toast(navigator.onLine ? 'All changes saved on this device' : 'Offline — changes saved locally, will be safe'); }; }
  function updateSyncPill() {
    var p = $('#syncPill'), t = $('#syncText'); if (!p || !t) return;
    if (navigator.onLine) { p.classList.remove('is-offline'); t.textContent = 'Synced'; }
    else { p.classList.add('is-offline'); t.textContent = 'Offline'; }
  }
  window.addEventListener('online', updateSyncPill);
  window.addEventListener('offline', updateSyncPill);

  /* ===================================================================
     INSTALL / ADD TO HOME SCREEN
     =================================================================== */
  var deferredPrompt = null;
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
  function isIOSSafari() { return isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent); }
  function installAvailable() { return !!deferredPrompt || isIOS(); }

  function showBanner() {
    if (isStandalone() || DB.dismissInstall) return;
    if (!installAvailable()) return;
    var b = $('#installBanner');
    if (isIOS() && !deferredPrompt) {
      $('#ibTitle').textContent = 'Add MaintainFlow Ag';
      $('#ibSub').textContent = 'Tap to add it to your home screen — works offline.';
      $('#ibInstall').textContent = 'How';
    }
    b.hidden = false;
  }
  function hideInstallUI() { $('#installBanner').hidden = true; }

  function triggerInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (c) {
        if (c.outcome === 'accepted') { hideInstallUI(); toast('Installing…'); }
        deferredPrompt = null;
      });
    } else if (isIOS()) {
      $('#iosSheet').hidden = false;
    } else {
      toast('Use your browser menu → "Add to Home screen"');
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredPrompt = e; showBanner(); render();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null; hideInstallUI(); toast('Added to home screen 🎉'); render();
  });

  $('#ibInstall').addEventListener('click', triggerInstall);
  $('#ibClose').addEventListener('click', function () { DB.dismissInstall = true; save(); hideInstallUI(); });
  $('#iosClose').addEventListener('click', function () { $('#iosSheet').hidden = true; });
  $('#iosSheet').addEventListener('click', function (e) { if (e.target.id === 'iosSheet') e.currentTarget.hidden = true; });

  /* show iOS banner on load (no beforeinstallprompt fires on iOS) */
  if (isIOS() && !isStandalone() && !DB.dismissInstall) { setTimeout(showBanner, 1200); }

  /* deep link from manifest shortcuts */
  (function () {
    var p = new URLSearchParams(location.search).get('view');
    if (p && ['fields', 'tasks', 'money', 'pests'].indexOf(p) >= 0) state.view = p;
  })();

  /* ---------------- service worker ---------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* ---------------- boot ---------------- */
  render();
})();
