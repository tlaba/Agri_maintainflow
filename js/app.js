/* ===================================================================
   MaintainFlow Ag — offline-first PWA
   Data persists in localStorage (falls back to in-memory if blocked).
   =================================================================== */
(function () {
  'use strict';

  /* ---------------- storage ---------------- */
  var BASE_KEY = 'mfag.v1';                 // local (no-login) data
  var mem = null;                           // in-memory fallback
  /* cloud sync state (inactive until Firebase is configured + signed in) */
  var cloud = { enabled: false, on: false, uid: null, email: null, applying: false, saveTimer: null, db: null, auth: null, unsub: null };
  function canStore() { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; } catch (e) { return false; } }
  var STORE_OK = canStore();
  function storeKey() { return cloud.uid ? 'mfag.u.' + cloud.uid : BASE_KEY; }
  function load() {
    if (!STORE_OK) return mem;
    try { var r = localStorage.getItem(storeKey()); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function save() {
    if (!STORE_OK) { mem = DB; }
    else { try { localStorage.setItem(storeKey(), JSON.stringify(DB)); } catch (e) {} }
    if (cloud.on && !cloud.applying) scheduleCloudSave();
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
    maize:       { e: '🌽', c: 'crop-maize', label: 'Maize',        art: 'maize' },
    sorghum:     { e: '🌾', c: 'crop-wheat', label: 'Sorghum',      art: 'grain' },
    millet:      { e: '🌾', c: 'crop-wheat', label: 'Millet',       art: 'grain' },
    wheat:       { e: '🌾', c: 'crop-wheat', label: 'Wheat',        art: 'grain' },
    rice:        { e: '🌾', c: 'crop-veg',   label: 'Rice',         art: 'grain' },
    soybean:     { e: '🫛', c: 'crop-soy',   label: 'Soybean',      art: 'legume' },
    beans:       { e: '🫘', c: 'crop-soy',   label: 'Beans',        art: 'legume' },
    groundnut:   { e: '🥜', c: 'crop-soy',   label: 'Groundnut',    art: 'legume' },
    cowpea:      { e: '🫛', c: 'crop-soy',   label: 'Cowpea',       art: 'legume' },
    sunflower:   { e: '🌻', c: 'crop-maize', label: 'Sunflower',    art: 'sunflower' },
    cotton:      { e: '🌿', c: 'crop-other', label: 'Cotton',       art: 'cotton' },
    tobacco:     { e: '🍂', c: 'crop-other', label: 'Tobacco',      art: 'leafy' },
    cassava:     { e: '🍠', c: 'crop-other', label: 'Cassava',      art: 'bush' },
    sweetpotato: { e: '🍠', c: 'crop-other', label: 'Sweet potato', art: 'bush' },
    potato:      { e: '🥔', c: 'crop-other', label: 'Potato',       art: 'bush' },
    tomato:      { e: '🍅', c: 'crop-veg',   label: 'Tomato',       art: 'leafy' },
    cabbage:     { e: '🥬', c: 'crop-veg',   label: 'Cabbage',      art: 'leafy' },
    onion:       { e: '🧅', c: 'crop-veg',   label: 'Onion',        art: 'leafy' },
    pumpkin:     { e: '🎃', c: 'crop-maize', label: 'Pumpkin',      art: 'leafy' },
    vegetables:  { e: '🥬', c: 'crop-veg',   label: 'Vegetables',   art: 'leafy' },
    other:       { e: '🌱', c: 'crop-other', label: 'Other',        art: 'seedling' }
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
  var DB = null; // initialized in boot (local mode) or after sign-in (cloud mode)
  function initLocalDB() {
    DB = load();
    if (!DB) { DB = seed(); seedTasks(); save(); }
    if (!DB.tasks || !DB.tasks.length) { /* keep */ }
  }

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
    // weather forecast (sample — works offline)
    v.appendChild(weatherCard());
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
  function weatherCard() {
    return el(
      '<div class="weather">' +
        '<span class="wic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15A0A2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13a4 4 0 0 0-3.5-3.97 5 5 0 0 0-9.69 1.32A3.5 3.5 0 0 0 4 17h11a3 3 0 0 0 1-3.84Z"/><path d="M8 19v1.5"/><path d="M12 19.5V21"/><path d="M16 19v1.5"/></svg></span>' +
        '<div class="wmeta"><div class="wlbl">Weather forecast</div><div class="wtemp">22°C</div><div class="wcond">Light rain · gentle breeze</div></div>' +
        '<span class="wday">Today</span>' +
      '</div>');
  }
  /* lightweight crop-family plant art (base anchored at 0,0, drawn upward) */
  function cropPlant(art) {
    switch (art) {
      case 'maize': return '<path d="M0 0 V-54" stroke="#2F7D33" stroke-width="3.5" fill="none"/>' +
        '<path d="M0 -16 C-16 -22 -24 -18 -28 -8 C-16 -12 -6 -14 0 -8Z" fill="#4E9E4F"/>' +
        '<path d="M0 -26 C16 -32 24 -28 28 -18 C16 -22 6 -24 0 -18Z" fill="#3F8F40"/>' +
        '<path d="M0 -36 C-14 -42 -20 -40 -24 -32 C-14 -34 -5 -36 0 -30Z" fill="#5CB85C"/>' +
        '<ellipse cx="4" cy="-44" rx="6.5" ry="13" fill="#F4C84B"/>' +
        '<path d="M4 -57 C-1 -52 -1 -46 4 -42" stroke="#A5D26A" stroke-width="2.5" fill="none"/>';
      case 'grain': return '<path d="M0 0 V-48" stroke="#CDA12C" stroke-width="2.5"/>' +
        '<path d="M0 -52 V-62" stroke="#CDA12C" stroke-width="1.4"/>' +
        '<g fill="#E3B12C"><ellipse cx="0" cy="-50" rx="3.6" ry="6"/>' +
        '<ellipse cx="-6" cy="-44" rx="3.2" ry="5.6"/><ellipse cx="6" cy="-44" rx="3.2" ry="5.6"/>' +
        '<ellipse cx="-6" cy="-36" rx="3.2" ry="5.6"/><ellipse cx="6" cy="-36" rx="3.2" ry="5.6"/>' +
        '<ellipse cx="-5" cy="-28" rx="3" ry="5.2"/><ellipse cx="5" cy="-28" rx="3" ry="5.2"/></g>';
      case 'legume': return '<path d="M0 0 V-32" stroke="#3F8F40" stroke-width="2.5"/>' +
        '<ellipse cx="-13" cy="-28" rx="9" ry="6" fill="#4E9E4F" transform="rotate(-22 -13 -28)"/>' +
        '<ellipse cx="13" cy="-28" rx="9" ry="6" fill="#4E9E4F" transform="rotate(22 13 -28)"/>' +
        '<ellipse cx="0" cy="-38" rx="9" ry="6.5" fill="#5CB85C"/>' +
        '<g fill="#9CCC65" stroke="#558B2F" stroke-width=".8">' +
        '<path d="M-5 -8 q-7 5 -3 13 q6 1 5 -7Z"/><path d="M6 -12 q7 4 4 13 q-6 2 -6 -6Z"/></g>';
      case 'leafy': return '<path d="M-16 -2 a16 12 0 0 1 32 0Z" fill="#3F8F40"/>' +
        '<circle cx="0" cy="-12" r="14" fill="#56B65A"/>' +
        '<path d="M-12 -16 q-6 -8 -2 -16 q8 4 6 14Z" fill="#4E9E4F"/>' +
        '<path d="M0 -26 q-8 7 -3 16 q8 -3 4 -14Z" fill="#6FCF6F"/>' +
        '<circle cx="13" cy="-3" r="5" fill="#E2533B"/>';
      case 'sunflower':
        var pet = '';
        for (var a = 0; a < 12; a++) {
          var r = a * Math.PI / 6, px = (Math.cos(r) * 12).toFixed(1), py = (-46 + Math.sin(r) * 12).toFixed(1);
          pet += '<ellipse cx="' + px + '" cy="' + py + '" rx="3" ry="6.5" fill="#F6C026" transform="rotate(' + (a * 30) + ' ' + px + ' ' + py + ')"/>';
        }
        return '<path d="M0 0 V-40" stroke="#3F8F40" stroke-width="3"/>' +
          '<path d="M0 -20 C-14 -22 -20 -16 -22 -8 C-12 -10 -4 -14 0 -12Z" fill="#4E9E4F"/>' +
          pet + '<circle cx="0" cy="-46" r="8" fill="#7A4B22"/>';
      case 'cotton': return '<path d="M0 0 V-30" stroke="#4E7D3A" stroke-width="2.5"/>' +
        '<path d="M0 -12 C-12 -14 -18 -22 -18 -30 C-8 -26 -2 -20 0 -12Z" fill="#4E9E4F"/>' +
        '<path d="M0 -16 C12 -18 18 -26 18 -34 C8 -30 2 -24 0 -16Z" fill="#3F8F40"/>' +
        '<g fill="#FAFAF5" stroke="#E0E0D6" stroke-width=".6"><circle cx="0" cy="-34" r="6"/>' +
        '<circle cx="-11" cy="-24" r="5"/><circle cx="11" cy="-26" r="5"/></g>';
      case 'bush': return '<path d="M0 0 V-26" stroke="#3F8F40" stroke-width="2.5"/>' +
        '<ellipse cx="-12" cy="-22" rx="9" ry="7" fill="#5CB85C"/>' +
        '<ellipse cx="12" cy="-22" rx="9" ry="7" fill="#3F8F40"/>' +
        '<ellipse cx="0" cy="-30" rx="11" ry="9" fill="#4E9E4F"/>' +
        '<ellipse cx="0" cy="-18" rx="10" ry="7" fill="#56B65A"/>';
      default: return '<path d="M0 0 V-20" stroke="#3F8F40" stroke-width="2.5"/>' +
        '<path d="M0 -16 C-12 -20 -18 -28 -18 -36 C-8 -32 -2 -26 0 -16Z" fill="#5CB85C"/>' +
        '<path d="M0 -18 C12 -22 18 -30 18 -38 C8 -34 2 -28 0 -18Z" fill="#4E9E4F"/>';
    }
  }
  function fieldHeroSVG(fld, c) {
    var pos = [[24, .82, 136], [80, .72, 132], [138, .86, 137], [196, .74, 133], [252, .84, 136], [308, .72, 132], [362, .8, 135]];
    var row = pos.map(function (p) {
      return '<use href="#fhPlant" transform="translate(' + p[0] + ',' + p[2] + ') scale(' + p[1] + ')"/>';
    }).join('');
    return el(
      '<div class="field-hero">' +
        '<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice">' +
          '<defs>' +
            '<linearGradient id="fhSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f5"/><stop offset="1" stop-color="#eaf6ee"/></linearGradient>' +
            '<linearGradient id="fhField" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5BA45C"/><stop offset="1" stop-color="#2E7D32"/></linearGradient>' +
            '<g id="fhPlant">' + cropPlant(c.art || 'seedling') + '</g>' +
          '</defs>' +
          '<rect width="400" height="150" fill="url(#fhSky)"/>' +
          '<circle cx="332" cy="40" r="34" fill="#fff6d6" opacity=".7"/>' +
          '<circle cx="332" cy="40" r="20" fill="#FBDD7A"/>' +
          '<path d="M0 98 Q100 80 200 94 T400 88 V150 H0 Z" fill="#A7D49B"/>' +
          '<path d="M0 120 Q120 108 240 120 T400 116 V150 H0 Z" fill="#74B665"/>' +
          row +
          '<path d="M0 136 Q200 128 400 134 V150 H0 Z" fill="url(#fhField)"/>' +
        '</svg>' +
        '<div class="fh-cap"><span class="fh-emoji">' + c.e + '</span><span>' + c.label + ' · ' + esc(fld.variety) + '</span></div>' +
      '</div>');
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
    v.appendChild(fieldHeroSVG(fld, c));
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
    syncInstallBanner();
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
  function wireSyncPill() {
    var p = $('#syncPill'); if (!p) return;
    p.onclick = function () {
      if (cloud.on) return openAccountSheet();
      if (cloudConfigured()) return promptSignIn();
      toast(navigator.onLine ? 'All changes saved on this device' : 'Offline — changes saved locally, will be safe');
    };
  }
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
  /* The home dashboard renders its own install card; suppress the duplicate
     fixed banner whenever that card is on screen, show it on other views. */
  function syncInstallBanner() {
    if ($('#cardInstall')) { hideInstallUI(); return; }
    showBanner();
  }

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
    e.preventDefault(); deferredPrompt = e; render();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null; hideInstallUI(); toast('Added to home screen 🎉'); render();
  });

  $('#ibInstall').addEventListener('click', triggerInstall);
  $('#ibClose').addEventListener('click', function () { DB.dismissInstall = true; save(); hideInstallUI(); });
  $('#iosClose').addEventListener('click', function () { $('#iosSheet').hidden = true; });
  $('#iosSheet').addEventListener('click', function (e) { if (e.target.id === 'iosSheet') e.currentTarget.hidden = true; });

  /* ---------------- service worker ---------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* ===================================================================
     CLOUD ACCOUNTS (Firebase Auth + Firestore) — optional, config-gated
     =================================================================== */
  function cloudConfigured() {
    var c = window.MFAG_FIREBASE;
    return !!(c && c.apiKey && c.apiKey !== 'REPLACE_ME');
  }
  // Lazy-load the Firebase compat SDK from the CDN (only when cloud is configured).
  function loadFirebaseSDK(cb) {
    if (window.firebase && firebase.auth && firebase.firestore) return cb();
    var base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    var parts = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
    (function next(i) {
      if (i >= parts.length) return cb();
      var s = document.createElement('script');
      s.src = base + parts[i];
      s.onload = function () { next(i + 1); };
      s.onerror = function () { cb(new Error('sdk')); };
      document.head.appendChild(s);
    })(0);
  }
  function userDoc() { return cloud.db.collection('users').doc(cloud.uid); }

  function scheduleCloudSave() {
    clearTimeout(cloud.saveTimer);
    cloud.saveTimer = setTimeout(function () {
      if (!cloud.on) return;
      userDoc().set({ db: DB, updatedAt: Date.now(), client: 'web' }, { merge: true })
        .then(function () { updateSyncPill(); })
        .catch(function () { /* queued by Firestore offline persistence; will flush when online */ });
    }, 700);
  }

  // Apply a DB coming FROM the cloud without echoing it back up.
  function applyRemoteDB(remote) {
    cloud.applying = true;
    DB = remote;
    save();            // writes the local cache only (cloud.applying guards the push)
    cloud.applying = false;
    render();
  }

  function startCloudSync(user, onReady) {
    cloud.on = true; cloud.uid = user.uid; cloud.email = user.email;
    var cached = load();                 // per-user offline cache (instant, offline-friendly)
    var booted = false;
    function bootOnce(db) { DB = db; if (!booted) { booted = true; onReady(); } else { render(); } }

    if (cached) bootOnce(cached);        // show cached data immediately if we have it

    userDoc().get().then(function (snap) {
      if (snap.exists && snap.data().db) {
        applyOrBoot(snap.data().db);
      } else {
        // First sign-in: migrate any existing on-device data, else seed a fresh farm.
        var legacy = cached;
        if (!legacy && STORE_OK) { try { var r = localStorage.getItem(BASE_KEY); legacy = r ? JSON.parse(r) : null; } catch (e) {} }
        DB = legacy || (function () { var s = seed(); var keep = DB; DB = s; seedTasks(); var out = DB; DB = keep; return out; })();
        if (cloud.pendingFarm) { DB.settings = DB.settings || {}; DB.settings.farmName = cloud.pendingFarm; cloud.pendingFarm = null; }
        cloud.applying = true; save(); cloud.applying = false;
        userDoc().set({ db: DB, updatedAt: Date.now(), client: 'web', createdAt: Date.now() }, { merge: true }).catch(function () {});
        if (!booted) { booted = true; onReady(); } else { render(); }
      }
    }).catch(function () {
      // Offline and no cloud copy yet: fall back to cache or a fresh seed so the app still opens.
      if (!booted) { if (!DB) { DB = cached || seed(); if (!cached) seedTasks(); } booted = true; onReady(); }
    });

    function applyOrBoot(remoteDb) {
      if (!booted) { DB = remoteDb; cloud.applying = true; save(); cloud.applying = false; booted = true; onReady(); }
      else applyRemoteDB(remoteDb);
    }

    // Live updates from other devices.
    cloud.unsub = userDoc().onSnapshot(function (snap) {
      if (!snap.exists || snap.metadata.hasPendingWrites) return; // ignore our own local echoes
      var d = snap.data(); if (d && d.db && booted) applyRemoteDB(d.db);
    }, function () {});
  }

  function cloudSignOut() {
    if (cloud.unsub) { try { cloud.unsub(); } catch (e) {} cloud.unsub = null; }
    cloud.on = false; cloud.uid = null; cloud.email = null;
    if (cloud.auth) cloud.auth.signOut();
  }

  /* ---- auth gate UI ---- */
  var LEAF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V11"/><path d="M12 11c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z"/></svg>';
  function authMsg(code, fallback) {
    var m = {
      'auth/invalid-email': 'That email address looks invalid.',
      'auth/missing-password': 'Please enter your password.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/email-already-in-use': 'That email already has an account — try signing in.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/user-not-found': 'No account found for that email.',
      'auth/network-request-failed': 'No connection. Check your signal and try again.',
      'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.'
    };
    return m[code] || fallback || 'Something went wrong. Please try again.';
  }
  function showAuthGate(mode) { var g = $('#authGate'); if (g) { g.hidden = false; renderAuth(mode || 'signin'); } }
  function hideAuthGate() { var g = $('#authGate'); if (g) { g.hidden = true; g.innerHTML = ''; } }
  function guestChosen() { try { return localStorage.getItem('mfag.guest') === '1'; } catch (e) { return false; } }
  function setGuest(v) { try { if (v) localStorage.setItem('mfag.guest', '1'); else localStorage.removeItem('mfag.guest'); } catch (e) {} }
  function continueAsGuest() { setGuest(true); cloud.on = false; hideAuthGate(); if (!DB || cloud.uid) initLocalDB(); bootUI(); }
  // From local/guest mode, let the user reach the sign-in screen (loads the SDK on demand).
  function promptSignIn() {
    if (cloud.enabled && cloud.auth) { showAuthGate('signin'); return; }
    toast('Connecting…');
    loadFirebaseSDK(function (err) {
      if (err || !(window.firebase && firebase.auth)) { toast('No connection — signing in needs internet.'); return; }
      startCloud();
    });
  }
  function renderAuth(mode) {
    var g = $('#authGate'); if (!g) return;
    var head = '<div class="ag-brand"><span class="ag-logo">' + LEAF + '</span>MaintainFlow <span class="ag-tag">AG</span></div>';
    var card;
    if (mode === 'signup') {
      card = '<h2>Create your account</h2><p class="ag-sub">Your fields, tasks and costs, backed up and synced across devices.</p>' +
        '<label>Farm name</label><input id="agFarm" type="text" autocomplete="organization" placeholder="e.g. Kgosi’s Farm">' +
        '<label>Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">' +
        '<label>Password</label><input id="agPass" type="password" autocomplete="new-password" placeholder="At least 6 characters">' +
        '<div class="ag-msg" id="agMsg" hidden></div>' +
        '<button class="ag-btn" id="agGo">Create account</button>' +
        '<div class="ag-alt">Already have an account? <button class="ag-link" id="agToSignin">Sign in</button></div>' +
        '<button class="ag-guest" id="agGuest">Continue without an account</button>';
    } else if (mode === 'reset') {
      card = '<h2>Reset password</h2><p class="ag-sub">We’ll email you a link to set a new password.</p>' +
        '<label>Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">' +
        '<div class="ag-msg" id="agMsg" hidden></div>' +
        '<button class="ag-btn" id="agGo">Send reset link</button>' +
        '<div class="ag-alt"><button class="ag-link" id="agToSignin">Back to sign in</button></div>';
    } else {
      card = '<h2>Welcome back</h2><p class="ag-sub">Sign in to reach your farm from any device.</p>' +
        '<label>Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">' +
        '<label>Password</label><input id="agPass" type="password" autocomplete="current-password" placeholder="Your password">' +
        '<div class="ag-msg" id="agMsg" hidden></div>' +
        '<button class="ag-btn" id="agGo">Sign in</button>' +
        '<div class="ag-alt"><button class="ag-link" id="agToReset">Forgot password?</button></div>' +
        '<div class="ag-alt">New here? <button class="ag-link" id="agToSignup">Create an account</button></div>' +
        '<button class="ag-guest" id="agGuest">Continue without an account</button>';
    }
    g.innerHTML = '<div class="ag-wrap">' + head + '<div class="ag-card">' + card + '</div><div class="ag-foot">Works offline after your first sign-in.</div></div>';
    var msg = $('#agMsg', g);
    function showErr(t) { msg.textContent = t; msg.hidden = false; }
    function busy(b) { var go = $('#agGo', g); go.disabled = b; go.textContent = b ? 'Please wait…' : (mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'); }
    var toSignin = $('#agToSignin', g); if (toSignin) toSignin.onclick = function () { renderAuth('signin'); };
    var toSignup = $('#agToSignup', g); if (toSignup) toSignup.onclick = function () { renderAuth('signup'); };
    var toReset = $('#agToReset', g); if (toReset) toReset.onclick = function () { renderAuth('reset'); };
    var guestBtn = $('#agGuest', g); if (guestBtn) guestBtn.onclick = continueAsGuest;
    $('#agGo', g).onclick = function () {
      if (!cloud.auth) return showErr('Still connecting — try again in a moment.');
      var email = ($('#agEmail', g).value || '').trim();
      msg.hidden = true;
      if (mode === 'reset') {
        if (!email) return showErr('Please enter your email.');
        busy(true);
        cloud.auth.sendPasswordResetEmail(email).then(function () { busy(false); showErr('Done — check your email for the reset link.'); })
          .catch(function (e) { busy(false); showErr(authMsg(e.code)); });
        return;
      }
      var pass = ($('#agPass', g).value || '');
      if (!email) return showErr('Please enter your email.');
      if (pass.length < 6) return showErr('Password must be at least 6 characters.');
      busy(true);
      if (mode === 'signup') {
        cloud.pendingFarm = ($('#agFarm', g).value || '').trim();
        cloud.auth.createUserWithEmailAndPassword(email, pass)
          .catch(function (e) { busy(false); showErr(authMsg(e.code)); });
      } else {
        cloud.auth.signInWithEmailAndPassword(email, pass)
          .catch(function (e) { busy(false); showErr(authMsg(e.code)); });
      }
    };
  }
  function openAccountSheet() {
    var host = openModal(
      '<div class="modal-head"><h3>Account</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="acct-row"><span class="acct-ic">' + LEAF + '</span><div class="acct-meta"><b>' + esc(cloud.email || 'Signed in') + '</b><span>' + (navigator.onLine ? 'Synced to your cloud account' : 'Offline — will sync when back online') + '</span></div></div>' +
      '<button class="btn-danger" id="acctOut">Sign out</button>');
    $('#mx', host).onclick = closeModal;
    $('#acctOut', host).onclick = function () { closeModal(); cloudSignOut(); toast('Signed out'); };
  }

  function bootUI() {
    /* deep link from manifest shortcuts */
    var p = new URLSearchParams(location.search).get('view');
    if (p && ['fields', 'tasks', 'money', 'pests'].indexOf(p) >= 0) state.view = p;
    /* iOS install banner (no beforeinstallprompt on iOS) */
    if (isIOS() && !isStandalone() && DB && !DB.dismissInstall) { setTimeout(syncInstallBanner, 1200); }
    render();
  }

  function startCloud() {
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(window.MFAG_FIREBASE);
      cloud.enabled = true;
      cloud.auth = firebase.auth();
      cloud.db = firebase.firestore();
      cloud.db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
      cloud.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
      cloud.auth.onAuthStateChanged(function (user) {
        if (user) {
          setGuest(false);          // they have an account now
          hideAuthGate();
          startCloudSync(user, bootUI);
        } else {
          cloudSignOut();
          if (!DB) DB = seed();     // harmless placeholder so the (hidden) app never refs null
          showAuthGate('signin');
        }
      });
    } catch (e) {
      cloud.enabled = false; if (!DB) initLocalDB(); bootUI();
    }
  }

  /* ---------------- boot ---------------- */
  if (cloudConfigured() && !guestChosen()) {
    showAuthGate('signin');           // show branded gate immediately while the SDK loads
    loadFirebaseSDK(function (err) {
      if (err || !(window.firebase && firebase.auth)) {
        // SDK unreachable (e.g. first run with no signal): degrade to local mode.
        hideAuthGate(); initLocalDB(); bootUI();
        return;
      }
      startCloud();
    });
  } else {
    // Local mode, or a returning guest (cloud available but they opted out).
    initLocalDB();
    bootUI();
  }
})();
