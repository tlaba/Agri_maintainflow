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
  var APP_VERSION = '1.3.0';
  var CONTACT_EMAIL = 'info@maintainflow.pro';
  var CONTACT_TOPICS = ['Bug report', 'Feature request', 'Billing & Pro', 'Account & login', 'Partnership / sales', 'Something else'];

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
      ],
      equipment: [
        { id: f(), name: 'Massey Ferguson 375', kind: 'tractor', make: '4WD · 75 hp', hours: 3120, note: '', lastServiceISO: addDays(-78), intervalDays: 90, logs: [] },
        { id: f(), name: 'Boom sprayer', kind: 'sprayer', make: '600 L trailed', hours: 0, note: 'Calibrate before season', lastServiceISO: addDays(-200), intervalDays: 180, logs: [] },
        { id: f(), name: 'Borehole pump', kind: 'pump', make: 'Submersible 2.2 kW', hours: 0, note: '', lastServiceISO: addDays(-30), intervalDays: 180, logs: [] }
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
  /* ---------------- localization (auto-detected, overridable) ---------------- */
  var CUR = {
    BWP: { sym: 'P', loc: 'en-BW' }, ZAR: { sym: 'R', loc: 'en-ZA' }, USD: { sym: '$', loc: 'en-US' },
    ZMW: { sym: 'ZK', loc: 'en-ZM' }, NAD: { sym: 'N$', loc: 'en-NA' }, MZN: { sym: 'MT', loc: 'pt-MZ' },
    MWK: { sym: 'MK', loc: 'en-MW' }, LSL: { sym: 'L', loc: 'en-LS' }, SZL: { sym: 'E', loc: 'en-SZ' },
    KES: { sym: 'KSh', loc: 'en-KE' }, TZS: { sym: 'TSh', loc: 'en-TZ' }, UGX: { sym: 'USh', loc: 'en-UG' },
    NGN: { sym: '₦', loc: 'en-NG' }, GHS: { sym: '₵', loc: 'en-GH' }, RWF: { sym: 'FRw', loc: 'en-RW' }, ETB: { sym: 'Br', loc: 'en-ET' }
  };
  var COUNTRIES = {
    BW: { name: 'Botswana', flag: '🇧🇼', dial: '+267', cur: 'BWP', greet: 'Dumela' },
    ZA: { name: 'South Africa', flag: '🇿🇦', dial: '+27', cur: 'ZAR', greet: 'Sawubona' },
    ZW: { name: 'Zimbabwe', flag: '🇿🇼', dial: '+263', cur: 'USD', greet: 'Mhoro' },
    ZM: { name: 'Zambia', flag: '🇿🇲', dial: '+260', cur: 'ZMW', greet: 'Muli bwanji' },
    NA: { name: 'Namibia', flag: '🇳🇦', dial: '+264', cur: 'NAD', greet: 'Moro' },
    MZ: { name: 'Mozambique', flag: '🇲🇿', dial: '+258', cur: 'MZN', greet: 'Olá' },
    MW: { name: 'Malawi', flag: '🇲🇼', dial: '+265', cur: 'MWK', greet: 'Moni' },
    LS: { name: 'Lesotho', flag: '🇱🇸', dial: '+266', cur: 'LSL', greet: 'Lumela' },
    SZ: { name: 'Eswatini', flag: '🇸🇿', dial: '+268', cur: 'SZL', greet: 'Sawubona' },
    KE: { name: 'Kenya', flag: '🇰🇪', dial: '+254', cur: 'KES', greet: 'Jambo' },
    TZ: { name: 'Tanzania', flag: '🇹🇿', dial: '+255', cur: 'TZS', greet: 'Jambo' },
    UG: { name: 'Uganda', flag: '🇺🇬', dial: '+256', cur: 'UGX', greet: 'Oli otya' },
    NG: { name: 'Nigeria', flag: '🇳🇬', dial: '+234', cur: 'NGN', greet: 'Sannu' },
    GH: { name: 'Ghana', flag: '🇬🇭', dial: '+233', cur: 'GHS', greet: 'Akwaaba' },
    RW: { name: 'Rwanda', flag: '🇷🇼', dial: '+250', cur: 'RWF', greet: 'Muraho' },
    ET: { name: 'Ethiopia', flag: '🇪🇹', dial: '+251', cur: 'ETB', greet: 'Selam' },
    OT: { name: 'Other', flag: '🌍', dial: '+', cur: 'USD', greet: 'Hello' }
  };
  var TZ_COUNTRY = { 'Africa/Gaborone': 'BW', 'Africa/Johannesburg': 'ZA', 'Africa/Harare': 'ZW', 'Africa/Lusaka': 'ZM', 'Africa/Windhoek': 'NA', 'Africa/Maputo': 'MZ', 'Africa/Blantyre': 'MW', 'Africa/Maseru': 'LS', 'Africa/Mbabane': 'SZ', 'Africa/Nairobi': 'KE', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kampala': 'UG', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Kigali': 'RW', 'Africa/Addis_Ababa': 'ET' };
  function detectCountry() {
    try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz]; } catch (e) {}
    try { var l = (navigator.language || '').split('-')[1]; if (l && COUNTRIES[l.toUpperCase()]) return l.toUpperCase(); } catch (e) {}
    return 'BW';
  }
  function countryInfo() { return (DB && DB.settings && COUNTRIES[DB.settings.country]) || COUNTRIES.BW; }
  function curInfo() { return CUR[countryInfo().cur] || CUR.BWP; }
  function curSym() { return curInfo().sym; }
  function greetOf() { return countryInfo().greet; }
  function symFor(code) { return (CUR[code] && CUR[code].sym) || code; }
  function money(n) {
    var c = curInfo(), v = Math.round(+n || 0), s;
    try { s = new Intl.NumberFormat(c.loc).format(v); } catch (e) { s = v.toLocaleString('en-US'); }
    return c.sym + ' ' + s;
  }
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
      '<div class="tb-greet">' + esc(greetOf()) + ',<b>' + esc(DB.settings.farmName) + '</b></div>';
    wireSyncPill(); updateSyncPill();
  }

  /* ---- FIELDS ---- */
  function viewFields() {
    homeTopbar();
    var v = $('#view'); v.innerHTML = '';
    // frost risk alert — only when real weather data shows a low ≤ 3°C
    var frost = frostAlertEl(); if (frost) v.appendChild(frost);
    // back-up / sign-in prompt for guests (cloud available but not signed in)
    if (cloudConfigured() && !cloud.on) {
      var sc = el(
        '<div class="signin-card"><span class="ic2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13V3"/><path d="m8 7 4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0 0 16 9h-1.3A7 7 0 1 0 5 17.3"/></svg></span>' +
        '<div class="t"><b>Back up your farm</b><span>Sign in to sync across devices and keep your data safe.</span></div>' +
        '<button id="cardSignin">Sign in</button></div>');
      v.appendChild(sc);
      $('#cardSignin', sc).addEventListener('click', promptSignIn);
    }
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
    // input-supplier marketplace entry
    var sup = el('<button class="link-card"><span class="lc-ic">🛒</span><div class="lc-t"><b>Input suppliers</b><span>Seed, fertilizer, chemicals &amp; services</span></div><span class="lc-arrow">›</span></button>');
    sup.addEventListener('click', function () { go('suppliers'); });
    v.appendChild(sup);
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
  /* ---------------- weather (Open-Meteo, cached for offline) + geolocation ---------------- */
  var WX_KEY = 'mfag.wx';
  var wxState = null;      // { ts, lat, lng, temp, code, wind, tmin }
  var wxBusy = false;      // fetching current location for weather
  var geoBusy = false;     // pinning a field's location
  function wxLoad() { try { return JSON.parse(localStorage.getItem(WX_KEY) || 'null'); } catch (e) { return null; } }
  function wxStore(o) { try { localStorage.setItem(WX_KEY, JSON.stringify(o)); } catch (e) {} }
  var WXCODE = {
    0: ['Clear sky', 'sun'], 1: ['Mainly clear', 'sun'], 2: ['Partly cloudy', 'cloud'], 3: ['Overcast', 'cloud'],
    45: ['Fog', 'cloud'], 48: ['Rime fog', 'cloud'],
    51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'], 56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
    61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'], 66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
    71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
    80: ['Rain showers', 'rain'], 81: ['Rain showers', 'rain'], 82: ['Violent showers', 'rain'],
    85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'], 95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm', 'storm'], 99: ['Thunderstorm', 'storm']
  };
  function wxIcon(kind) {
    var s = 'fill="none" stroke="#15A0A2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    if (kind === 'sun') return '<svg width="24" height="24" viewBox="0 0 24 24" ' + s + '><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    if (kind === 'rain') return '<svg width="24" height="24" viewBox="0 0 24 24" ' + s + '><path d="M16 13a4 4 0 0 0-3.5-3.97 5 5 0 0 0-9.69 1.32A3.5 3.5 0 0 0 4 17h11a3 3 0 0 0 1-3.84Z"/><path d="M8 19v1.5M12 19.5V21M16 19v1.5"/></svg>';
    if (kind === 'storm') return '<svg width="24" height="24" viewBox="0 0 24 24" ' + s + '><path d="M16 13a4 4 0 0 0-3.5-3.97 5 5 0 0 0-9.69 1.32A3.5 3.5 0 0 0 4 17h9"/><path d="m13 12-3 5h3l-2 4"/></svg>';
    if (kind === 'snow') return '<svg width="24" height="24" viewBox="0 0 24 24" ' + s + '><path d="M16 13a4 4 0 0 0-3.5-3.97 5 5 0 0 0-9.69 1.32A3.5 3.5 0 0 0 4 17h11a3 3 0 0 0 1-3.84Z"/><path d="M8 20h.01M12 20h.01M16 20h.01"/></svg>';
    return '<svg width="24" height="24" viewBox="0 0 24 24" ' + s + '><path d="M17.5 19a4.5 4.5 0 1 0 0-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6 19Z"/></svg>';
  }
  function wxFetch(lat, lng, cb) {
    if (!window.fetch) { if (cb) cb(); return; }
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(3) + '&longitude=' + lng.toFixed(3) +
      '&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_min&forecast_days=1&timezone=auto';
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.current) { if (cb) cb(); return; }
      wxState = {
        ts: Date.now(), lat: lat, lng: lng,
        temp: Math.round(j.current.temperature_2m),
        code: j.current.weather_code,
        wind: Math.round(j.current.wind_speed_10m),
        tmin: (j.daily && j.daily.temperature_2m_min) ? Math.round(j.daily.temperature_2m_min[0]) : null
      };
      wxStore(wxState);
      if (cb) cb();
      if (state.view === 'fields') render();
    }).catch(function () { if (cb) cb(); });
  }
  function ensureWeather() {
    if (!wxState) wxState = wxLoad();
    var geo = DB && DB.settings && DB.settings.geo;
    if (!geo || !navigator.onLine) return;
    if (wxState && Date.now() - wxState.ts < 30 * 60 * 1000) return; // fresh enough
    wxFetch(geo.lat, geo.lng);
  }
  function enableWeather() {
    if (!navigator.geolocation) { toast('Location isn’t available on this device'); return; }
    wxBusy = true; if (state.view === 'fields') render();
    navigator.geolocation.getCurrentPosition(function (pos) {
      wxBusy = false;
      DB.settings = DB.settings || {};
      DB.settings.geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      save();
      wxFetch(pos.coords.latitude, pos.coords.longitude, function () { if (state.view === 'fields') render(); });
    }, function (err) {
      wxBusy = false; if (state.view === 'fields') render();
      toast(err && err.code === 1 ? 'Location permission denied' : 'Couldn’t get your location');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }
  function weatherCard() {
    if (!wxState) wxState = wxLoad();
    if (!wxState) {
      var cta = el('<div class="weather"><span class="wic">' + wxIcon('cloud') + '</span>' +
        '<div class="wmeta"><div class="wlbl">Local weather</div><div class="wcond">' + (wxBusy ? 'Getting your location…' : 'See current weather for your farm') + '</div></div>' +
        '<button class="wbtn" id="wxEnable"' + (wxBusy ? ' disabled' : '') + '>' + (wxBusy ? '…' : 'Enable') + '</button></div>');
      var bn = $('#wxEnable', cta); if (bn) bn.addEventListener('click', enableWeather);
      return cta;
    }
    var info = WXCODE[wxState.code] || ['—', 'cloud'];
    var stale = (Date.now() - wxState.ts) > 60 * 60 * 1000 || !navigator.onLine;
    var sub = info[0] + ' · ' + wxState.wind + ' km/h' + (wxState.tmin != null ? ' · low ' + wxState.tmin + '°' : '');
    return el('<div class="weather"><span class="wic">' + wxIcon(info[1]) + '</span>' +
      '<div class="wmeta"><div class="wlbl">Weather forecast</div><div class="wtemp">' + wxState.temp + '°C</div><div class="wcond">' + esc(sub) + '</div></div>' +
      '<span class="wday">' + (stale ? 'as of ' + relTime(wxState.ts) : 'Now') + '</span></div>');
  }
  function frostAlertEl() {
    var wx = wxState || wxLoad();
    if (!wx || wx.tmin == null) return null;        // no real data → no (fake) frost warning
    if (wx.tmin > 3) return null;                   // no frost risk
    return el('<div class="alert"><span class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4543A" stroke-width="2" stroke-linecap="round"><path d="M12 2v6"/><path d="M12 22v-3"/><path d="M2 14h3"/><path d="M19 14h3"/><circle cx="12" cy="14" r="4"/></svg></span><div><b>Frost risk tonight</b><p>Low ' + wx.tmin + '°C · cover seedlings &amp; tender crops</p></div></div>');
  }
  /* field GPS pin + open in maps */
  function pinField(fld) {
    if (!navigator.geolocation) { toast('Location isn’t available on this device'); return; }
    geoBusy = true; viewField();
    navigator.geolocation.getCurrentPosition(function (pos) {
      geoBusy = false;
      fld.lat = pos.coords.latitude; fld.lng = pos.coords.longitude;
      DB.settings = DB.settings || {};
      if (!DB.settings.geo) DB.settings.geo = { lat: fld.lat, lng: fld.lng }; // seed weather location too
      save(); viewField(); toast('Field location pinned');
    }, function (err) {
      geoBusy = false; viewField();
      toast(err && err.code === 1 ? 'Location permission denied' : 'Couldn’t get your location');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  function openInMaps(lat, lng) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat + ',' + lng), '_blank', 'noopener');
  }
  function fieldLocRow(fld) {
    if (fld.lat != null && fld.lng != null) {
      var row = el('<div class="loc-row"><span class="loc-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>' +
        '<div class="loc-meta"><b>Field location</b><span>' + fld.lat.toFixed(5) + ', ' + fld.lng.toFixed(5) + ' · <button class="loc-link" id="locRepin">' + (geoBusy ? 'updating…' : 'update') + '</button></span></div>' +
        '<button class="loc-open" id="locOpen">Open in Maps</button></div>');
      $('#locOpen', row).addEventListener('click', function () { openInMaps(fld.lat, fld.lng); });
      var rp = $('#locRepin', row); if (rp) rp.addEventListener('click', function () { pinField(fld); });
      return row;
    }
    var row2 = el('<div class="loc-row"><span class="loc-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5e7080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>' +
      '<div class="loc-meta"><b>No location set</b><span>Pin this field to open it in Maps</span></div>' +
      '<button class="loc-open" id="locPin"' + (geoBusy ? ' disabled' : '') + '>' + (geoBusy ? '…' : 'Pin location') + '</button></div>');
    $('#locPin', row2).addEventListener('click', function () { pinField(fld); });
    return row2;
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
    v.appendChild(fieldLocRow(fld));

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

    // harvest / yield records
    v.appendChild(el('<div class="sec-h" style="margin-top:18px"><h3>Harvest records</h3><span class="link" id="addYield">+ Add harvest</span></div>'));
    $('#addYield', v).addEventListener('click', function () { openYieldForm(fld.id); });
    var ys = DB.yields.filter(function (y) { return y.fieldId === fld.id; }).sort(function (a, b) { return a.harvestISO < b.harvestISO ? 1 : -1; });
    if (!ys.length) {
      v.appendChild(el('<p class="hint">No harvests logged yet. Recording yields builds the history lenders and insurers look for.</p>'));
    } else {
      ys.forEach(function (y) {
        var row = el('<button class="yield-row"><span class="yic">' + cropOf(y.crop).e + '</span>' +
          '<div class="ym"><div class="yn">' + (y.totalKg).toLocaleString('en-US') + ' kg · ' + fmtDate(y.harvestISO) + '</div>' +
          '<div class="ys">' + (y.areaHa || fld.sizeHa) + ' ha · ' + yieldPerHa(y, fld) + ' kg/ha' + (y.note ? ' · ' + esc(y.note) : '') + '</div></div></button>');
        row.addEventListener('click', function () { openYieldForm(fld.id, y); });
        v.appendChild(row);
      });
    }
    setFab('+ Task', function () { openTaskForm(fld.id); });
  }
  function yieldPerHa(y, fld) {
    var ha = +(y.areaHa || (fld && fld.sizeHa) || 0);
    return ha ? Math.round(y.totalKg / ha).toLocaleString('en-US') : '—';
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
      '<div class="big2"><div class="big-card"><div class="l">Spend to date</div><div class="v"><span class="c">' + curSym() + ' </span>' + Math.round(spend).toLocaleString('en-US') + '</div><div class="trend">across ' + DB.fields.length + ' fields</div></div>' +
      '<div class="big-card"><div class="l">Cost per ha</div><div class="v"><span class="c">' + curSym() + ' </span>' + Math.round(perHa).toLocaleString('en-US') + '</div><div class="trend">' + ha.toFixed(1) + ' ha total</div></div></div>'));

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
    // market prices — sample feed only available for Botswana for now
    if ((DB.settings.country || 'BW') === 'BW') {
      v.appendChild(el('<div class="sec-h"><h3>Market prices · Gaborone</h3><span class="link">sample</span></div>'));
      var mk = el('<div class="market"></div>');
      [['🌽', 'Maize (white)', 'per tonne', 'P 3,950', 'up', '▲ 2.1%'],
       ['🌾', 'Wheat', 'per tonne', 'P 5,400', 'down', '▼ 0.8%'],
       ['🫛', 'Soybean', 'per tonne', 'P 7,200', 'up', '▲ 1.4%'],
       ['🥬', 'Cabbage', 'per crate', 'P 95', 'up', '▲ 3.0%']].forEach(function (r) {
        mk.appendChild(el('<div class="mrow"><div class="cn"><span class="ci crop-veg">' + r[0] + '</span><div><div class="cnm">' + r[1] + '</div><div class="cu">' + r[2] + '</div></div></div><div class="pr"><div class="px">' + r[3] + '</div><div class="ch ' + r[4] + '">' + r[5] + '</div></div></div>'));
      });
      v.appendChild(mk);
    } else {
      v.appendChild(el('<div class="sec-h"><h3>Market prices · ' + esc(countryInfo().name) + '</h3></div>'));
      v.appendChild(el('<p class="hint">Local market prices for ' + esc(countryInfo().name) + ' are coming soon.</p>'));
    }

    // recent expenses
    v.appendChild(el('<div class="sec-h"><h3>Recent expenses</h3><span class="link" id="addExp2">+ Log</span></div>'));
    $('#addExp2', v).addEventListener('click', openExpenseForm);
    var recent = DB.expenses.slice().sort(function (a, b) { return a.dateISO < b.dateISO ? 1 : -1; }).slice(0, 8);
    recent.forEach(function (e) {
      var fld = fieldById(e.fieldId);
      var sub = (fld ? fld.tag + ' · ' : 'Whole farm · ') + fmtDate(e.dateISO) + (e.note ? ' · ' + esc(e.note) : '');
      v.appendChild(el('<div class="expense-row"><span class="ec" style="background:' + (CATCOLOR[e.category] || '#5e7080') + '"></span><div class="em"><div class="ename">' + esc(e.category) + '</div><div class="esub">' + sub + '</div></div><div class="eamt">' + money(e.amount) + '</div></div>'));
    });
    // pointer to reports/export (now centralised under More)
    var rep = el('<button class="link-card" style="margin-top:16px"><span class="lc-ic">📊</span><div class="lc-t"><b>Reports &amp; export</b><span>Analytics, lender summary, CSV / PDF — in More</span></div><span class="lc-arrow">›</span></button>');
    rep.addEventListener('click', function () { go('more'); });
    v.appendChild(rep);
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

  /* ===================================================================
     EQUIPMENT MAINTENANCE
     =================================================================== */
  var EQUIP_KINDS = {
    tractor:   { e: '🚜', label: 'Tractor' },
    implement: { e: '⚙️', label: 'Implement' },
    sprayer:   { e: '🌫️', label: 'Sprayer' },
    pump:      { e: '💧', label: 'Pump' },
    vehicle:   { e: '🛻', label: 'Vehicle' },
    other:     { e: '🧰', label: 'Other' }
  };
  var SERVICE_TYPES = ['Service', 'Inspection', 'Repair', 'Part replaced', 'Other'];
  var INTERVALS = [ [30, 'Monthly'], [90, 'Every 3 months'], [180, 'Every 6 months'], [365, 'Yearly'] ];
  function kindOf(k) { return EQUIP_KINDS[k] || EQUIP_KINDS.other; }
  function nextServiceISO(eq) {
    var base = eq.lastServiceISO || addDays(0);
    var d = new Date(base + 'T00:00'); d.setDate(d.getDate() + (eq.intervalDays || 90));
    return d.toISOString().slice(0, 10);
  }
  // returns 'over' | 'soon' | 'ok' and days until next service (negative = overdue)
  function serviceState(eq) {
    var days = daysBetween(nextServiceISO(eq));
    if (days < 0) return { st: 'over', days: days };
    if (days <= 14) return { st: 'soon', days: days };
    return { st: 'ok', days: days };
  }
  function equipDueCount() {
    if (!DB || !DB.equipment) return 0;
    return DB.equipment.filter(function (eq) { return serviceState(eq).st !== 'ok'; }).length;
  }

  function viewEquipment() {
    homeTopbar();
    var v = $('#view'); v.innerHTML = '';
    var due = equipDueCount();
    v.appendChild(el('<div class="sec-h"><h3>Equipment &amp; maintenance</h3><span class="link">' + (due ? due + ' due' : DB.equipment.length + ' assets') + '</span></div>'));
    if (!DB.equipment.length) {
      v.appendChild(emptyState('No equipment yet', 'Add a tractor, pump or implement to track its service schedule and repair history.'));
    } else {
      DB.equipment.slice().sort(function (a, b) { return nextServiceISO(a) < nextServiceISO(b) ? -1 : 1; }).forEach(function (eq) {
        v.appendChild(equipCard(eq));
      });
    }
    setFab('+ Equipment', function () { openEquipForm(); });
  }

  function equipCard(eq) {
    var ss = serviceState(eq);
    var k = kindOf(eq.kind);
    var pill = { over: ['p-over', 'Service overdue ' + Math.abs(ss.days) + 'd'], soon: ['p-due', ss.days === 0 ? 'Service due today' : 'Service in ' + ss.days + 'd'], ok: ['p-sched', 'Next ' + fmtDate(nextServiceISO(eq))] }[ss.st];
    var meta = [];
    if (eq.make) meta.push(esc(eq.make));
    if (eq.hours) meta.push(esc(eq.hours) + ' hrs');
    meta.push('Last serviced ' + (eq.lastServiceISO ? fmtDate(eq.lastServiceISO) : '—'));
    var spend = (eq.logs || []).reduce(function (s, l) { return s + (l.cost || 0); }, 0);
    if (spend > 0) meta.push(money(spend) + ' upkeep');
    var card = el(
      '<div class="wo ' + ss.st + '"><div class="wo-top"><span class="type">' + k.e + ' ' + esc(k.label.toUpperCase()) + '</span><span class="pill ' + pill[0] + '">' + pill[1] + '</span></div>' +
      '<div class="name">' + esc(eq.name) + '</div><div class="det">' + meta.join(' · ') + (eq.note ? '<br><span style="color:var(--muted)">' + esc(eq.note) + '</span>' : '') + '</div>' +
      '<div class="wo-actions"></div></div>');
    var act = $('.wo-actions', card);
    var log = el('<button class="done-btn">Log service</button>');
    log.addEventListener('click', function () { openServiceForm(eq); });
    act.appendChild(log);
    var edit = el('<button>Edit</button>');
    edit.addEventListener('click', function () { openEquipForm(eq); });
    act.appendChild(edit);
    if ((eq.logs || []).length) {
      var hist = el('<button>History</button>');
      hist.addEventListener('click', function () { openServiceHistory(eq); });
      act.appendChild(hist);
    }
    return card;
  }

  function openEquipForm(existing) {
    var ed = existing && existing.id ? existing : null;
    var host = openModal(
      '<div class="modal-head"><h3>' + (ed ? 'Edit equipment' : 'New equipment') + '</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="field-group"><label>Type</label><div class="seg" id="kindSeg"></div></div>' +
      '<div class="field-group"><label>Name</label><input id="qName" value="' + esc(ed ? ed.name : '') + '" placeholder="e.g. Massey Ferguson 375"></div>' +
      '<div class="row2"><div class="field-group"><label>Make / spec (optional)</label><input id="qMake" value="' + esc(ed ? ed.make : '') + '" placeholder="e.g. 75 hp"></div>' +
      '<div class="field-group"><label>Engine hours (optional)</label><input id="qHours" type="number" inputmode="numeric" value="' + (ed && ed.hours ? ed.hours : '') + '" placeholder="0"></div></div>' +
      '<div class="row2"><div class="field-group"><label>Last serviced</label><input id="qLast" type="date" value="' + (ed ? (ed.lastServiceISO || addDays(0)) : addDays(0)) + '"></div>' +
      '<div class="field-group"><label>Service every</label><select id="qInt">' + INTERVALS.map(function (i) { return '<option value="' + i[0] + '"' + (ed && ed.intervalDays === i[0] ? ' selected' : (!ed && i[0] === 90 ? ' selected' : '')) + '>' + i[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field-group"><label>Note (optional)</label><input id="qNote" value="' + esc(ed ? ed.note : '') + '" placeholder="e.g. needs new tyre"></div>' +
      '<button class="btn-primary" id="qSave">' + (ed ? 'Save changes' : 'Add equipment') + '</button>' +
      (ed ? '<button class="btn-danger" id="qDel">Delete equipment</button>' : ''));
    var kind = ed ? ed.kind : 'tractor';
    var seg = $('#kindSeg', host);
    Object.keys(EQUIP_KINDS).forEach(function (key) {
      var b = el('<button' + (key === kind ? ' class="on"' : '') + '>' + EQUIP_KINDS[key].e + ' ' + EQUIP_KINDS[key].label + '</button>');
      b.addEventListener('click', function () { kind = key; seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); });
      seg.appendChild(b);
    });
    $('#mx', host).onclick = closeModal;
    $('#qSave', host).onclick = function () {
      var name = $('#qName', host).value.trim();
      if (!name) { toast('Give the equipment a name'); return; }
      var make = $('#qMake', host).value.trim();
      var hours = parseInt($('#qHours', host).value, 10) || 0;
      var last = $('#qLast', host).value || addDays(0);
      var intv = parseInt($('#qInt', host).value, 10) || 90;
      var note = $('#qNote', host).value.trim();
      if (ed) { ed.kind = kind; ed.name = name; ed.make = make; ed.hours = hours; ed.lastServiceISO = last; ed.intervalDays = intv; ed.note = note; }
      else { DB.equipment.push({ id: f(), kind: kind, name: name, make: make, hours: hours, lastServiceISO: last, intervalDays: intv, note: note, logs: [] }); }
      save(); closeModal(); render(); toast(ed ? 'Equipment updated' : 'Equipment added');
    };
    if (ed) $('#qDel', host).onclick = function () {
      DB.equipment = DB.equipment.filter(function (x) { return x.id !== ed.id; });
      save(); closeModal(); render(); toast('Equipment deleted');
    };
  }

  function openServiceForm(eq) {
    var host = openModal(
      '<div class="modal-head"><h3>Log service · ' + esc(eq.name) + '</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="field-group"><label>Type</label><select id="sType">' + SERVICE_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="row2"><div class="field-group"><label>Date</label><input id="sDate" type="date" value="' + addDays(0) + '"></div>' +
      '<div class="field-group"><label>Cost (' + curSym() + ', optional)</label><input id="sCost" type="number" inputmode="decimal" placeholder="0"></div></div>' +
      '<div class="field-group"><label>Engine hours now (optional)</label><input id="sHours" type="number" inputmode="numeric" value="' + (eq.hours || '') + '"></div>' +
      '<div class="field-group"><label>Note (optional)</label><input id="sNote" placeholder="e.g. oil + filters, greased"></div>' +
      '<label class="chk"><input type="checkbox" id="sReset" checked> Reset service schedule from this date</label>' +
      '<button class="btn-primary" id="sSave">Log it</button>');
    $('#mx', host).onclick = closeModal;
    $('#sSave', host).onclick = function () {
      var type = $('#sType', host).value;
      var date = $('#sDate', host).value || addDays(0);
      var cost = parseFloat($('#sCost', host).value) || 0;
      var hours = parseInt($('#sHours', host).value, 10);
      var note = $('#sNote', host).value.trim();
      eq.logs = eq.logs || [];
      eq.logs.push({ id: f(), dateISO: date, type: type, cost: cost, note: note });
      if (!isNaN(hours) && hours > 0) eq.hours = hours;
      if ($('#sReset', host).checked) eq.lastServiceISO = date;
      if (cost > 0) DB.expenses.push({ id: f(), fieldId: null, category: 'Maintenance', amount: cost, dateISO: date, note: eq.name + ' — ' + type });
      save(); closeModal(); render();
      toast(cost > 0 ? 'Service logged — ' + money(cost) + ' to expenses' : 'Service logged');
    };
  }

  function openServiceHistory(eq) {
    var logs = (eq.logs || []).slice().sort(function (a, b) { return a.dateISO < b.dateISO ? 1 : -1; });
    var rows = logs.map(function (l) {
      return '<div class="hist-row"><div><b>' + esc(l.type) + '</b><span>' + fmtDate(l.dateISO) + (l.note ? ' · ' + esc(l.note) : '') + '</span></div>' + (l.cost > 0 ? '<span class="hist-cost">' + money(l.cost) + '</span>' : '') + '</div>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>Service log · ' + esc(eq.name) + '</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="hist">' + (rows || '<p style="color:var(--muted);font-size:13px">No entries yet.</p>') + '</div>' +
      '<button class="btn-soft" id="hClose">Close</button>');
    var host = $('#modalHost');
    $('#mx', host).onclick = closeModal;
    $('#hClose', host).onclick = closeModal;
  }

  /* ===================================================================
     RECORDS / PRO / CONSENT / EXPORT / MARKETPLACE
     =================================================================== */
  function normalizeDB() {
    if (!DB) return;
    DB.settings = DB.settings || {};
    if (!DB.yields) DB.yields = [];
    if (!DB.equipment) DB.equipment = [];
    if (!DB.settings.plan) DB.settings.plan = 'free';
    if (!DB.settings.country) DB.settings.country = detectCountry();
  }
  function billingConfigured() { var b = window.MFAG_BILLING; return !!(b && b.provider === 'stripe' && b.enabled); }
  function isPro() {
    var ent = cloud.entitlement;
    if (ent && ent.pro && (!ent.proUntil || ent.proUntil > Date.now())) return true;   // server-verified
    if (!billingConfigured()) return !!(DB && DB.settings && DB.settings.plan === 'pro'); // evaluation mode
    return false;
  }
  function requirePro(cb) { if (isPro()) return cb(); openUpgradeSheet(); }

  function loadFunctionsSDK(cb) {
    if (window.firebase && firebase.functions) return cb();
    var s = document.createElement('script'); s.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js';
    s.onload = function () { cb(); }; s.onerror = function () { cb(new Error('fn')); };
    document.head.appendChild(s);
  }
  // Stripe Checkout: ask the Cloud Function for a hosted session URL, then redirect.
  function startCheckout() {
    if (!cloud.on) { promptSignIn(); return; }
    toast('Opening secure checkout…');
    loadFunctionsSDK(function (err) {
      if (err || !(window.firebase && firebase.functions)) { toast('Couldn’t reach checkout — check your connection.'); return; }
      try {
        var fns = firebase.app().functions((window.MFAG_BILLING && window.MFAG_BILLING.functionsRegion) || 'us-central1');
        fns.httpsCallable('createCheckoutSession')({ origin: location.origin })
          .then(function (res) {
            var url = res && res.data && res.data.url;
            if (url) { window.location.assign(url); }
            else { toast('Couldn’t start checkout. Please try again.'); }
          })
          .catch(function () { toast('Couldn’t start checkout. Please try again.'); });
      } catch (e) { toast('Couldn’t start checkout. Please try again.'); }
    });
  }
  // After returning from Stripe Checkout (success_url = /?pro=1), entitlement
  // is granted by the webhook; the entitlements snapshot flips Pro on shortly.
  function handleCheckoutReturn() {
    var q = new URLSearchParams(location.search);
    var pro = q.get('pro');
    if (!pro) return;
    history.replaceState(null, '', location.pathname);  // clean the URL
    if (pro === '1') toast('Payment received — activating Pro…');
    else if (pro === 'cancel') toast('Checkout cancelled');
  }

  function openYieldForm(fieldId, existing) {
    var fld = fieldById(fieldId); if (!fld) return;
    var ed = existing && existing.id ? existing : null;
    var host = openModal(
      '<div class="modal-head"><h3>' + (ed ? 'Edit harvest' : 'Add harvest') + '</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="acct-row"><span class="acct-ic" style="background:var(--green-soft)">' + cropOf(fld.crop).e + '</span><div class="acct-meta"><b>' + esc(fld.tag) + ' · ' + cropOf(fld.crop).label + '</b><span>' + fld.sizeHa + ' ha</span></div></div>' +
      '<div class="row2"><div class="field-group"><label>Harvest date</label><input id="yDate" type="date" value="' + (ed ? ed.harvestISO : addDays(0)) + '"></div>' +
      '<div class="field-group"><label>Area harvested (ha)</label><input id="yArea" type="number" inputmode="decimal" step="0.1" value="' + (ed ? ed.areaHa : fld.sizeHa) + '"></div></div>' +
      '<div class="field-group"><label>Total yield (kg)</label><input id="yKg" type="number" inputmode="decimal" step="1" value="' + (ed ? ed.totalKg : '') + '" placeholder="e.g. 1250"></div>' +
      '<div class="field-group"><label>Yield per hectare</label><input id="yPerHa" type="text" readonly></div>' +
      '<div class="field-group"><label>Notes (optional)</label><textarea id="yNote" rows="2" placeholder="Variety, conditions, buyer…">' + esc(ed ? (ed.note || '') : '') + '</textarea></div>' +
      '<button class="btn-primary" id="ySave">' + (ed ? 'Save changes' : 'Add harvest') + '</button>' +
      (ed ? '<button class="btn-danger" id="yDel">Delete harvest</button>' : ''));
    function recompute() {
      var kg = parseFloat($('#yKg', host).value) || 0, ha = parseFloat($('#yArea', host).value) || 0;
      $('#yPerHa', host).value = ha ? Math.round(kg / ha).toLocaleString('en-US') + ' kg/ha' : '—';
    }
    $('#yKg', host).addEventListener('input', recompute);
    $('#yArea', host).addEventListener('input', recompute);
    recompute();
    $('#mx', host).onclick = closeModal;
    $('#ySave', host).onclick = function () {
      var kg = parseFloat($('#yKg', host).value) || 0;
      if (kg <= 0) return toast('Enter the total yield in kg');
      var area = parseFloat($('#yArea', host).value) || fld.sizeHa;
      var date = $('#yDate', host).value || addDays(0);
      var note = $('#yNote', host).value.trim();
      if (ed) { ed.harvestISO = date; ed.areaHa = area; ed.totalKg = kg; ed.note = note; }
      else { DB.yields.push({ id: f(), fieldId: fld.id, crop: fld.crop, harvestISO: date, areaHa: area, totalKg: kg, note: note }); }
      save(); closeModal(); render(); toast(ed ? 'Harvest updated' : 'Harvest logged');
    };
    if (ed) $('#yDel', host).onclick = function () { DB.yields = DB.yields.filter(function (x) { return x.id !== ed.id; }); save(); closeModal(); render(); toast('Harvest deleted'); };
  }

  function openUpgradeSheet() {
    var pro = isPro(), b = window.MFAG_BILLING || {};
    var head = '<div class="modal-head"><h3>MaintainFlow Pro</h3><button class="x" id="mx">&times;</button></div>' +
      '<p class="modal-note">Tools for growing and financing your farm:</p>' +
      '<ul class="pro-list"><li>Printable PDF records for lenders &amp; buyers</li><li>Yield analytics &amp; lender summary</li><li>Input-supplier marketplace &amp; quotes</li><li>Priority support</li></ul>';
    var body;
    if (pro) {
      var until = (cloud.entitlement && cloud.entitlement.proUntil) ? ' · valid until ' + fmtDate(new Date(cloud.entitlement.proUntil).toISOString().slice(0, 10)) : '';
      body = '<div class="pro-on">✓ Pro is active' + until + '</div>' +
        (billingConfigured() ? '<button class="btn-soft" id="proRenew">Extend Pro · ' + esc(b.displayPrice || '') + '</button>' : '<button class="btn-soft" id="proOff">Switch back to Free</button>');
    } else if (billingConfigured()) {
      body = (!cloud.on)
        ? '<button class="btn-primary" id="proSignin">Sign in to upgrade</button><p class="hint" style="text-align:center;margin-top:8px">Pro is tied to your account so it works across devices.</p>'
        : '<button class="btn-primary" id="proPay">Get Pro · ' + esc(b.displayPrice || '') + '</button><p class="hint" style="text-align:center;margin-top:8px">Secure card payment via Stripe.</p>';
    } else {
      body = '<button class="btn-primary" id="proGo">Activate Pro</button><p class="hint" style="text-align:center;margin-top:8px">Billing isn’t connected yet — this enables Pro for evaluation.</p>';
    }
    var host = openModal(head + body);
    $('#mx', host).onclick = closeModal;
    function bind(id, fn) { var e = $('#' + id, host); if (e) e.onclick = fn; }
    bind('proGo', function () { DB.settings.plan = 'pro'; save(); closeModal(); render(); toast('Pro activated 🎉'); });
    bind('proOff', function () { DB.settings.plan = 'free'; save(); closeModal(); render(); toast('Switched to Free'); });
    bind('proPay', function () { closeModal(); startCheckout(); });
    bind('proRenew', function () { closeModal(); startCheckout(); });
    bind('proSignin', function () { closeModal(); promptSignIn(); });
  }

  function greetOfCode(code) { return (COUNTRIES[code] || COUNTRIES.BW).greet; }
  function openRegionSheet() {
    var cur = (DB.settings && DB.settings.country) || 'BW';
    var opts = Object.keys(COUNTRIES).map(function (k) {
      var c = COUNTRIES[k];
      return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + c.flag + ' ' + c.name + ' · ' + symFor(c.cur) + '</option>';
    }).join('');
    var host = openModal('<div class="modal-head"><h3>Region &amp; currency</h3><button class="x" id="mx">&times;</button></div>' +
      '<p class="modal-note">Sets your greeting and the currency shown across the app.</p>' +
      '<div class="field-group"><label>Country</label><select id="rgSel">' + opts + '</select></div>' +
      '<button class="btn-primary" id="rgSave">Save</button>');
    $('#mx', host).onclick = closeModal;
    $('#rgSave', host).onclick = function () {
      DB.settings = DB.settings || {};
      DB.settings.country = $('#rgSel', host).value;
      DB.settings.greeting = greetOfCode(DB.settings.country);
      save(); closeModal(); render(); toast('Region updated');
    };
  }
  function privacyHtml() {
    return '<p>MaintainFlow Ag stores your farm records (fields, work orders, expenses, harvests and, if you choose, your location) to run the app and — when you sign in — to sync them across your devices.</p>' +
      '<p>Your data is yours. We do not sell personal data. Aggregated, anonymised insights may be used to improve the service. You can export or delete your data any time from the Account screen.</p>' +
      '<p>Sign-in uses Firebase (Google) for authentication and storage; weather uses Open-Meteo based on a location you provide.</p>';
  }
  function openPrivacy() {
    var host = openModal('<div class="modal-head"><h3>Privacy</h3><button class="x" id="mx">&times;</button></div><div class="legal">' + privacyHtml() + '</div><button class="btn-soft" id="pClose">Close</button>');
    $('#mx', host).onclick = closeModal; $('#pClose', host).onclick = closeModal;
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('Copied ' + t); }).catch(function () { toast(t); });
    } else { toast(t); }
  }
  function formEncode(data) {
    return Object.keys(data).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]); }).join('&');
  }
  function mailtoFallback(topic, email, msg) {
    var subject = '[' + topic + '] MaintainFlow Ag';
    var body = msg + '\n\n—\nFrom: ' + (email || '(no email given)') + '\nSent from MaintainFlow Ag · v' + APP_VERSION + ' · ' + countryInfo().name + ' · ' + (isPro() ? 'Pro' : 'Free');
    window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function openContactSheet(presetTopic) {
    var prefill = (cloud.on && cloud.email) ? cloud.email : '';
    var host = openModal(
      '<div class="modal-head"><h3>Contact us</h3><button class="x" id="mx">&times;</button></div>' +
      '<p class="sheet-note">Pick a topic and write your message — we usually reply within 1–2 working days.</p>' +
      '<div class="field-group"><label>What’s this about?</label><select id="cTopic">' + CONTACT_TOPICS.map(function (t) { return '<option' + (t === presetTopic ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="field-group"><label>Your email</label><input id="cEmail" type="email" inputmode="email" value="' + esc(prefill) + '" placeholder="you@example.com"></div>' +
      '<div class="field-group"><label>Message</label><textarea id="cMsg" rows="5" placeholder="Tell us what’s happening…"></textarea></div>' +
      '<button class="btn-primary" id="cSend">Send message</button>' +
      '<div class="contact-alt">or email <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> <button class="link-btn" id="cCopy">Copy</button></div>');
    $('#mx', host).onclick = closeModal;
    $('#cCopy', host).onclick = function () { copyText(CONTACT_EMAIL); };
    $('#cSend', host).onclick = function () {
      var topic = $('#cTopic', host).value;
      var email = $('#cEmail', host).value.trim();
      var msg = $('#cMsg', host).value.trim();
      if (!msg) { toast('Add a short message first'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Add your email so we can reply'); return; }
      var btn = $('#cSend', host); btn.disabled = true; btn.textContent = 'Sending…';
      var payload = {
        'form-name': 'contact', 'bot-field': '', topic: topic, email: email, message: msg,
        context: 'v' + APP_VERSION + ' · ' + countryInfo().name + ' · ' + (isPro() ? 'Pro' : 'Free')
      };
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formEncode(payload) })
        .then(function (r) { if (!r.ok) throw new Error('bad status'); closeModal(); toast('Message sent — thank you'); })
        .catch(function () {
          // offline or Forms unavailable: fall back to the user's mail app so nothing is lost
          closeModal(); mailtoFallback(topic, email, msg); toast('Opening your email app…');
        });
    };
  }
  function showConsent() {
    var host = openModal('<div class="modal-head"><h3>Welcome to MaintainFlow Ag</h3></div><p class="modal-note">A quick note on your data before you start:</p><div class="legal">' + privacyHtml() + '</div><button class="btn-primary" id="cAgree">Agree &amp; continue</button>');
    $('#modalHost').onclick = null; // must choose Agree
    $('#cAgree', host).onclick = function () { DB.settings = DB.settings || {}; DB.settings.consent = true; save(); closeModal(); };
  }

  function csvCell(s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }
  function downloadFile(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  function exportCSV() {
    var rows = [['Record', 'Field', 'Crop', 'Date', 'Detail', 'Amount/Yield', 'Area ha', 'Note']];
    DB.fields.forEach(function (fl) { rows.push(['Field', fl.tag, cropOf(fl.crop).label, fl.plantedISO, fl.variety, '', fl.sizeHa, (fl.lat != null ? fl.lat.toFixed(5) + ',' + fl.lng.toFixed(5) : '')]); });
    DB.tasks.forEach(function (t) { var fl = fieldById(t.fieldId); rows.push(['Task', fl ? fl.tag : '', fl ? cropOf(fl.crop).label : '', t.dueISO, t.type + ': ' + t.name, t.cost || 0, '', t.completed ? 'done' : 'open']); });
    DB.expenses.forEach(function (e) { var fl = fieldById(e.fieldId); rows.push(['Expense', fl ? fl.tag : 'Whole farm', '', e.dateISO, e.category, e.amount, '', e.note || '']); });
    DB.yields.forEach(function (y) { var fl = fieldById(y.fieldId); rows.push(['Harvest', fl ? fl.tag : '', cropOf(y.crop).label, y.harvestISO, 'yield (kg)', y.totalKg, y.areaHa, y.note || '']); });
    downloadFile('maintainflow-records-' + addDays(0) + '.csv', toCSV(rows));
    toast('CSV exported');
  }
  function printReport() {
    var w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to create the PDF'); return; }
    function rowsHtml(arr) { return arr.join(''); }
    var fields = DB.fields.map(function (fl) { return '<tr><td>' + esc(fl.tag) + '</td><td>' + cropOf(fl.crop).label + ' · ' + esc(fl.variety) + '</td><td>' + fl.sizeHa + ' ha</td><td>' + fmtDate(fl.plantedISO) + '</td></tr>'; });
    var harvests = DB.yields.map(function (y) { var fl = fieldById(y.fieldId); return '<tr><td>' + (fl ? esc(fl.tag) : '') + '</td><td>' + cropOf(y.crop).label + '</td><td>' + fmtDate(y.harvestISO) + '</td><td>' + y.totalKg.toLocaleString('en-US') + ' kg</td><td>' + yieldPerHa(y, fl) + ' kg/ha</td></tr>'; });
    var totalSp = totalSpend();
    var cs = creditSummary();
    var facRows = cs.factors.map(function (f) { return '<tr><td>' + f[0] + '</td><td>' + f[1] + ' / ' + f[2] + '</td><td>' + esc(f[3]) + '</td></tr>'; }).join('');
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Farm records</title><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#13202b;margin:28px}h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 8px;color:#1B5E20}' +
      '.sub{color:#5e7080;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #e7e3d8}th{color:#5e7080;text-transform:uppercase;font-size:10px;letter-spacing:.04em}' +
      '.tot{margin-top:8px;font-size:13px}.score{display:flex;align-items:center;gap:14px;margin:10px 0 4px}.score .n{font-size:34px;font-weight:bold;color:#1B5E20}.score .b{font-size:13px;color:#5e7080}</style></head><body>' +
      '<h1>' + esc(DB.settings.farmName || 'Farm') + ' — records</h1>' +
      '<div class="sub">Generated ' + fmtDate(addDays(0)) + ' · MaintainFlow Ag</div>' +
      '<h2>Credit-readiness summary</h2><div class="score"><div class="n">' + cs.score + '/100</div><div class="b"><b>' + cs.band + '</b><br>' + cs.totalHa.toFixed(1) + ' ha · ' + cs.crops + ' crops · ' + cs.seasons + ' season(s) of records</div></div>' +
      '<table><tr><th>Factor</th><th>Score</th><th>Basis</th></tr>' + facRows + '</table>' +
      '<h2>Fields</h2><table><tr><th>Tag</th><th>Crop</th><th>Size</th><th>Planted</th></tr>' + rowsHtml(fields) + '</table>' +
      '<h2>Harvests</h2>' + (harvests.length ? '<table><tr><th>Field</th><th>Crop</th><th>Date</th><th>Yield</th><th>Per ha</th></tr>' + rowsHtml(harvests) + '</table>' : '<div class="sub">No harvests recorded.</div>') +
      '<h2>Costs</h2><div class="tot">Total spend to date: <b>' + money(totalSp) + '</b> across ' + DB.fields.length + ' fields.</div>' +
      '</body></html>';
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 350);
  }
  function openExportSheet() {
    var host = openModal(
      '<div class="modal-head"><h3>Export records</h3><button class="x" id="mx">&times;</button></div>' +
      '<p class="modal-note">Share your farm history with a lender, buyer or co-op.</p>' +
      '<button class="btn-soft" id="exCsv">Download CSV (all records)</button>' +
      '<button class="btn-primary" id="exPdf">Printable PDF report' + (isPro() ? '' : ' · Pro') + '</button>');
    $('#mx', host).onclick = closeModal;
    $('#exCsv', host).onclick = function () { closeModal(); exportCSV(); };
    $('#exPdf', host).onclick = function () { closeModal(); requirePro(printReport); };
  }

  /* ---- INPUT SUPPLIER MARKETPLACE (hosted JSON + offline fallback) ---- */
  var SUPPLIERS_FALLBACK = [
    { e: '🌽', name: 'AgriSeed Botswana', cat: 'Seed', loc: 'Gaborone', items: 'Maize, soybean, sorghum & sunflower seed', tel: '+2673190000', whatsapp: '2673190000' },
    { e: '🧪', name: 'GrowChem Supplies', cat: 'Fertilizer & chemicals', loc: 'Francistown', items: 'Compound D, LAN, urea, herbicides & fungicides', tel: '+2672410000', whatsapp: '2672410000' },
    { e: '🚜', name: 'FarmMech Hire', cat: 'Mechanisation', loc: 'Lobatse', items: 'Tractor, planter & sprayer hire; land prep', tel: '+2675330000', whatsapp: '2675330000' },
    { e: '💧', name: 'Kalahari Irrigation', cat: 'Irrigation', loc: 'Gaborone', items: 'Drip kits, pumps, piping & boreholes', tel: '+2673950000', whatsapp: '2673950000' }
  ];
  var SUP_KEY = 'mfag.suppliers';
  var suppliersData = null;
  function loadSuppliers(cb) {
    if (!suppliersData) { try { var c = JSON.parse(localStorage.getItem(SUP_KEY) || 'null'); if (c && c.length) suppliersData = c; } catch (e) {} }
    if (window.fetch) {
      fetch('suppliers.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
        var list = (j && j.suppliers) || (Array.isArray(j) ? j : null);
        if (!list || !list.length) return;
        var s = JSON.stringify(list);
        if (s === JSON.stringify(suppliersData)) return;     // unchanged → no re-render
        suppliersData = list;
        try { localStorage.setItem(SUP_KEY, s); } catch (e) {}
        if (state.view === 'suppliers') render();
      }).catch(function () {});
    }
    if (cb) cb();
  }
  function contactSupplier(s) {
    var num = (s.whatsapp || '').replace(/\D/g, '');
    if (num) { window.open('https://wa.me/' + num + '?text=' + encodeURIComponent('Hello ' + s.name + ', I’m a MaintainFlow Ag farmer and would like a quote.'), '_blank', 'noopener'); return; }
    if (s.tel) { window.location.href = 'tel:' + s.tel; return; }
    toast('No contact on file for ' + s.name);
  }
  function viewSuppliers() {
    $('#topbar').innerHTML =
      '<div class="tb-back"><button class="bk" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<button class="offline" id="syncPill" type="button" style="margin-left:auto"><span class="dot"></span><span id="syncText">Offline-ready</span></button></div>' +
      '<div class="tb-title"><div class="t">Input suppliers</div><div class="row">Seed, fertilizer, chemicals &amp; services</div></div>';
    $('#backBtn').addEventListener('click', function () { go('fields'); });
    wireSyncPill(); updateSyncPill();
    loadSuppliers();
    var list = suppliersData && suppliersData.length ? suppliersData : SUPPLIERS_FALLBACK;
    var v = $('#view'); v.innerHTML = '';
    v.appendChild(el('<p class="hint">' + (isPro() ? 'Tap Quote to message a supplier on WhatsApp.' : 'Requesting a quote is a Pro feature.') + '</p>'));
    list.forEach(function (s) {
      var row = el('<div class="supplier"><span class="sic">' + (s.e || '🏬') + '</span>' +
        '<div class="sm"><div class="snm">' + esc(s.name) + '</div><div class="scat">' + esc(s.cat || '') + (s.loc ? ' · ' + esc(s.loc) : '') + '</div><div class="sit">' + esc(s.items || '') + '</div></div>' +
        '<button class="s-contact">Quote</button></div>');
      $('.s-contact', row).addEventListener('click', function () { requirePro(function () { contactSupplier(s); }); });
      v.appendChild(row);
    });
    hideFab();
  }

  /* ---- YIELD ANALYTICS + LENDER SUMMARY (Pro) ---- */
  var YIELD_BENCH = { maize: 2200, sorghum: 1100, millet: 800, wheat: 2500, rice: 3000, soybean: 1500, beans: 1100, groundnut: 1100, cowpea: 900, sunflower: 1400, cotton: 1200, tobacco: 1800, cassava: 12000, sweetpotato: 9000, potato: 15000, tomato: 25000, cabbage: 30000, onion: 20000, pumpkin: 12000, vegetables: 20000, other: 1500 };
  function benchFor(crop) { return YIELD_BENCH[crop] || 1500; }
  function seasonOf(iso) { return (iso || '').slice(0, 4); }
  function backTopbar(title, sub) {
    $('#topbar').innerHTML =
      '<div class="tb-back"><button class="bk" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<button class="offline" id="syncPill" type="button" style="margin-left:auto"><span class="dot"></span><span id="syncText">Offline-ready</span></button></div>' +
      '<div class="tb-title"><div class="t">' + esc(title) + '</div><div class="row">' + esc(sub) + '</div></div>';
    $('#backBtn').addEventListener('click', function () { go('fields'); });
    wireSyncPill(); updateSyncPill();
  }
  function yieldAnalytics() {
    var byCrop = {};
    DB.yields.forEach(function (y) {
      var fl = fieldById(y.fieldId);
      var crop = y.crop || (fl && fl.crop) || 'other';
      var yr = seasonOf(y.harvestISO) || '—';
      byCrop[crop] = byCrop[crop] || {};
      var s = byCrop[crop][yr] = byCrop[crop][yr] || { totalKg: 0, ha: 0 };
      s.totalKg += (+y.totalKg || 0); s.ha += (+y.areaHa || (fl && fl.sizeHa) || 0);
    });
    return Object.keys(byCrop).map(function (crop) {
      var seasons = Object.keys(byCrop[crop]).sort().map(function (yr) {
        var s = byCrop[crop][yr]; return { year: yr, totalKg: s.totalKg, ha: s.ha, perHa: s.ha ? Math.round(s.totalKg / s.ha) : 0 };
      });
      var avg = Math.round(seasons.reduce(function (a, s) { return a + s.perHa; }, 0) / seasons.length);
      var trend = seasons.length > 1 ? seasons[seasons.length - 1].perHa - seasons[0].perHa : 0;
      return { crop: crop, label: cropOf(crop).label, e: cropOf(crop).e, seasons: seasons, avgPerHa: avg, trend: trend, bench: benchFor(crop) };
    });
  }
  function viewAnalytics() {
    backTopbar('Yield analytics', 'Trends across your seasons');
    var v = $('#view'); v.innerHTML = '';
    var data = yieldAnalytics();
    if (!data.length) { v.appendChild(emptyState('No harvests yet', 'Log harvests on your fields to see season-by-season yield trends.')); hideFab(); return; }
    data.forEach(function (c) {
      var maxv = Math.max(c.bench, c.seasons.reduce(function (m, s) { return Math.max(m, s.perHa); }, 0)) || 1;
      var bars = c.seasons.map(function (s) {
        var pct = Math.max(4, Math.round(s.perHa / maxv * 100));
        return '<div class="abar"><span class="abar-v">' + s.perHa.toLocaleString('en-US') + '</span><div class="abar-fill" style="height:' + pct + '%"></div><span class="abar-y">' + s.year + '</span></div>';
      }).join('');
      var trendTxt = c.seasons.length < 2 ? '1 season' : (c.trend > 0 ? '▲ improving' : (c.trend < 0 ? '▼ declining' : 'steady'));
      v.appendChild(el('<div class="an-card"><div class="an-head"><span class="an-ic">' + c.e + '</span><div class="an-meta"><b>' + c.label + '</b><span>avg ' + c.avgPerHa.toLocaleString('en-US') + ' kg/ha · ' + trendTxt + '</span></div></div>' +
        '<div class="an-chart"><div class="bench-line" style="bottom:' + Math.round(c.bench / maxv * 100) + '%"></div>' + bars + '</div>' +
        '<div class="an-foot">dashed line = benchmark ~' + c.bench.toLocaleString('en-US') + ' kg/ha</div></div>'));
    });
    hideFab();
  }
  function uniqueCropCount() { var s = {}; DB.fields.forEach(function (f) { s[f.crop] = 1; }); return Object.keys(s).length; }
  function creditSummary() {
    var seasonsSet = {}; DB.yields.forEach(function (y) { seasonsSet[seasonOf(y.harvestISO)] = 1; });
    var seasons = Object.keys(seasonsSet).length;
    var fHistory = seasons >= 3 ? 30 : seasons === 2 ? 22 : seasons === 1 ? 12 : 0;
    var fComplete = (DB.fields.length ? 5 : 0) + (DB.expenses.length ? 8 : 0) + (DB.yields.length ? 7 : 0);
    var ratios = []; DB.yields.forEach(function (y) { var fl = fieldById(y.fieldId); var ha = +(y.areaHa || (fl && fl.sizeHa) || 0); if (ha) ratios.push((y.totalKg / ha) / benchFor(y.crop || (fl && fl.crop) || 'other')); });
    var avgRatio = ratios.length ? ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length : 0;
    var fYield = Math.round(Math.max(0, Math.min(1, avgRatio)) * 30);
    var done = DB.tasks.filter(function (t) { return t.completed; }).length, total = DB.tasks.length;
    var fTask = total ? Math.round(done / total * 20) : 0;
    var score = Math.min(100, fHistory + fComplete + fYield + fTask);
    var band = score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Building' : 'Early-stage';
    return {
      score: score, band: band, seasons: seasons, totalHa: totalHa(), crops: uniqueCropCount(), spend: totalSpend(),
      factors: [
        ['Records history', fHistory, 30, seasons + ' season' + (seasons === 1 ? '' : 's') + ' of harvests'],
        ['Data completeness', fComplete, 20, 'fields, costs & yields logged'],
        ['Yield performance', fYield, 30, avgRatio ? Math.round(avgRatio * 100) + '% of benchmark yield' : 'no yield data yet'],
        ['Task discipline', fTask, 20, total ? Math.round(done / total * 100) + '% of work orders done' : 'no work orders yet']
      ]
    };
  }
  function viewLender() {
    backTopbar('Lender summary', 'Credit-readiness from your records');
    var v = $('#view'); v.innerHTML = '';
    var c = creditSummary();
    v.appendChild(el('<div class="score-card"><div class="score-ring" style="background:conic-gradient(var(--green) ' + (c.score * 3.6) + 'deg,var(--hair) 0)"><div class="score-num">' + c.score + '</div></div><div class="score-meta"><b>' + c.band + '</b><span>Farm credit-readiness score</span></div></div>'));
    v.appendChild(el('<div class="kpis"><div class="kpi"><div class="v">' + c.totalHa.toFixed(1) + '</div><div class="l">Hectares</div></div><div class="kpi"><div class="v">' + c.seasons + '</div><div class="l">Seasons</div></div><div class="kpi"><div class="v sm">' + money(c.spend) + '</div><div class="l">Tracked spend</div></div></div>'));
    v.appendChild(el('<div class="sec-h"><h3>What lenders look at</h3></div>'));
    c.factors.forEach(function (f) {
      var pct = Math.round(f[1] / f[2] * 100);
      v.appendChild(el('<div class="factor"><div class="factor-top"><span>' + f[0] + '</span><b>' + f[1] + '/' + f[2] + '</b></div><div class="factor-bar"><i style="width:' + pct + '%"></i></div><div class="factor-sub">' + esc(f[3]) + '</div></div>'));
    });
    v.appendChild(el('<p class="hint" style="margin-top:14px">Generated from your own records to help you approach lenders, cooperatives and insurers. Keep logging harvests and costs to strengthen it.</p>'));
    var exp = el('<button class="btn-primary" id="lenderPdf">Export PDF report</button>'); v.appendChild(exp);
    exp.onclick = function () { requirePro(printReport); };
    hideFab();
  }

  /* ---- MORE (hub: account, records, settings) ---- */
  function viewMore() {
    homeTopbar();
    var v = $('#view'); v.innerHTML = '';
    function row(icon, label, value, fn, badge) {
      var r = el('<button class="menu-row"><span class="m-ic">' + icon + '</span><span class="m-l">' + esc(label) + (badge ? ' <span class="m-badge">' + badge + '</span>' : '') + '</span>' + (value ? '<span class="m-v">' + esc(value) + '</span>' : '') + '<span class="m-ch">›</span></button>');
      r.addEventListener('click', fn); return r;
    }
    function sec(t) { v.appendChild(el('<div class="menu-sec">' + t + '</div>')); }

    // Account
    sec('Account');
    if (cloud.on) {
      var initial = ((DB.settings.farmName || 'F').trim()[0] || 'F').toUpperCase();
      var acc = el('<button class="menu-row acct-head"><span class="m-av">' + esc(initial) + '</span><span class="m-l"><b>' + esc(DB.settings.farmName || 'My farm') + '</b><span class="m-sub">' + esc(cloud.email || cloud.phone || 'Signed in') + '</span></span><span class="m-ch">›</span></button>');
      acc.addEventListener('click', openAccountSheet); v.appendChild(acc);
    } else if (cloudConfigured()) {
      v.appendChild(row('☁️', 'Sign in & back up', '', promptSignIn));
    } else {
      v.appendChild(el('<div class="menu-row"><span class="m-av">' + esc(((DB.settings.farmName || 'F').trim()[0] || 'F').toUpperCase()) + '</span><span class="m-l"><b>' + esc(DB.settings.farmName || 'My farm') + '</b><span class="m-sub">Saved on this device</span></span></div>'));
    }

    // Records & reports
    sec('Records & reports');
    v.appendChild(row('📈', 'Yield analytics', '', function () { requirePro(function () { go('analytics'); }); }, isPro() ? '' : 'Pro'));
    v.appendChild(row('📊', 'Lender summary', '', function () { requirePro(function () { go('lender'); }); }, isPro() ? '' : 'Pro'));
    v.appendChild(row('📤', 'Export records', '', openExportSheet));

    // Reference & marketplace
    sec('Reference');
    v.appendChild(row('🐛', 'Pest & disease library', '', function () { go('pests'); }));
    v.appendChild(row('🛒', 'Input suppliers', '', function () { go('suppliers'); }));

    // Support
    sec('Support');
    v.appendChild(row('✉️', 'Contact us', '', function () { openContactSheet(); }));

    // Settings
    sec('Settings');
    v.appendChild(row('🌍', 'Region & currency', countryInfo().name, openRegionSheet));
    v.appendChild(row('⭐', 'Plan', isPro() ? 'Pro' : 'Free', openUpgradeSheet));
    v.appendChild(row('🔒', 'Privacy', '', openPrivacy));
    v.appendChild(row('ℹ️', 'Version', 'v' + APP_VERSION, function () { openContactSheet(); }));

    if (cloud.on) {
      var out = el('<button class="btn-soft" id="moreOut" style="margin-top:16px">Sign out</button>');
      out.addEventListener('click', function () { cloudSignOut(); toast('Signed out'); });
      v.appendChild(out);
    }
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

  var EXP_CATS = ['Seed', 'Fertilizer', 'Chemicals', 'Fuel', 'Labour', 'Maintenance', 'Other'];
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
    normalizeDB();
    document.querySelectorAll('.nav-item').forEach(function (b) {
      var moreish = ['suppliers', 'analytics', 'lender', 'pests', 'more'].indexOf(state.view) >= 0;
      var match = b.dataset.view === state.view || (state.view === 'field' && b.dataset.view === 'fields') || (moreish && b.dataset.view === 'more');
      b.classList.toggle('on', match);
    });
    if (state.view === 'fields') viewFields();
    else if (state.view === 'field') viewField();
    else if (state.view === 'tasks') viewAllTasks();
    else if (state.view === 'money') viewMoney();
    else if (state.view === 'pests') viewPests();
    else if (state.view === 'suppliers') viewSuppliers();
    else if (state.view === 'analytics') viewAnalytics();
    else if (state.view === 'lender') viewLender();
    else if (state.view === 'equipment') viewEquipment();
    else if (state.view === 'more') viewMore();
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
  function relTime(ts) {
    if (!ts) return '';
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }
  function updateSyncPill() {
    var p = $('#syncPill'), t = $('#syncText'); if (!p || !t) return;
    if (!navigator.onLine) { p.classList.add('is-offline'); t.textContent = cloud.on ? 'Offline' : 'Offline-ready'; return; }
    p.classList.remove('is-offline');
    if (cloud.on) {
      t.textContent = cloud.saving ? 'Saving…' : (cloud.lastSync ? 'Synced ' + relTime(cloud.lastSync) : 'Synced');
    } else if (cloudConfigured()) {
      t.textContent = 'Saved on device';
    } else {
      t.textContent = 'Synced';
    }
  }
  setInterval(function () { if (cloud.on && !cloud.saving) updateSyncPill(); }, 30000);
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
    cloud.saving = true; updateSyncPill();
    cloud.saveTimer = setTimeout(function () {
      if (!cloud.on) return;
      userDoc().set({ db: DB, updatedAt: Date.now(), client: 'web' }, { merge: true })
        .then(function () { cloud.saving = false; cloud.lastSync = Date.now(); updateSyncPill(); })
        .catch(function () { cloud.saving = false; updateSyncPill(); /* queued by Firestore offline persistence; flushes when online */ });
    }, 700);
  }

  // Apply a DB coming FROM the cloud without echoing it back up.
  function applyRemoteDB(remote) {
    cloud.applying = true;
    DB = remote;
    save();            // writes the local cache only (cloud.applying guards the push)
    cloud.applying = false;
    cloud.lastSync = Date.now(); updateSyncPill();
    render();
  }

  function startCloudSync(user, onReady) {
    cloud.on = true; cloud.uid = user.uid; cloud.email = user.email; cloud.phone = user.phoneNumber;
    cloud.saving = false; cloud.lastSync = null;
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
      cloud.lastSync = Date.now();
      if (!booted) { DB = remoteDb; cloud.applying = true; save(); cloud.applying = false; booted = true; onReady(); }
      else applyRemoteDB(remoteDb);
    }

    // Live updates from other devices.
    cloud.unsub = userDoc().onSnapshot(function (snap) {
      if (!snap.exists || snap.metadata.hasPendingWrites) return; // ignore our own local echoes
      var d = snap.data(); if (d && d.db && booted) applyRemoteDB(d.db);
    }, function () {});

    // Server-verified Pro entitlement (client can read but not write it).
    if (cloud.entUnsub) { try { cloud.entUnsub(); } catch (e) {} }
    cloud.entitlement = null;
    cloud.entUnsub = cloud.db.collection('entitlements').doc(cloud.uid).onSnapshot(function (snap) {
      cloud.entitlement = snap.exists ? snap.data() : null;
      if (booted) render();
    }, function () {});
  }

  function cloudSignOut() {
    if (cloud.unsub) { try { cloud.unsub(); } catch (e) {} cloud.unsub = null; }
    if (cloud.entUnsub) { try { cloud.entUnsub(); } catch (e) {} cloud.entUnsub = null; }
    cloud.entitlement = null;
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
      'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
      'auth/invalid-phone-number': 'That phone number looks invalid — include your country code.',
      'auth/missing-phone-number': 'Please enter your phone number.',
      'auth/invalid-verification-code': 'That code is incorrect. Check the SMS and try again.',
      'auth/code-expired': 'That code has expired — request a new one.',
      'auth/quota-exceeded': 'SMS limit reached for now. Please try again later.',
      'auth/operation-not-allowed': 'Phone sign-in isn’t enabled on the server yet.',
      'auth/billing-not-enabled': 'Phone sign-in needs the Firebase Blaze plan enabled.',
      'auth/captcha-check-failed': 'Verification failed. Reload the page and try again.'
    };
    return m[code] || fallback || 'Something went wrong. Please try again.';
  }
  var COUNTRY_CODES = [
    ['+267', '🇧🇼 Botswana'], ['+27', '🇿🇦 South Africa'], ['+263', '🇿🇼 Zimbabwe'],
    ['+260', '🇿🇲 Zambia'], ['+264', '🇳🇦 Namibia'], ['+258', '🇲🇿 Mozambique'],
    ['+265', '🇲🇼 Malawi'], ['+266', '🇱🇸 Lesotho'], ['+268', '🇸🇿 Eswatini'],
    ['+254', '🇰🇪 Kenya'], ['+255', '🇹🇿 Tanzania'], ['+256', '🇺🇬 Uganda'], ['+234', '🇳🇬 Nigeria']
  ];
  function ccOptions() { return COUNTRY_CODES.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + ' (' + c[0] + ')</option>'; }).join(''); }
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
        '<div class="ag-alt">No email? <button class="ag-link" id="agToPhone">Use your phone number</button></div>' +
        '<div class="ag-alt">Already have an account? <button class="ag-link" id="agToSignin">Sign in</button></div>' +
        '<button class="ag-guest" id="agGuest">Continue without an account</button>';
    } else if (mode === 'reset') {
      card = '<h2>Reset password</h2><p class="ag-sub">We’ll email you a link to set a new password.</p>' +
        '<label>Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">' +
        '<div class="ag-msg" id="agMsg" hidden></div>' +
        '<button class="ag-btn" id="agGo">Send reset link</button>' +
        '<div class="ag-alt"><button class="ag-link" id="agToSignin">Back to sign in</button></div>';
    } else if (mode === 'phone') {
      card = '<h2>Sign in with phone</h2><p class="ag-sub">We’ll text you a one-time code. Standard SMS rates may apply.</p>' +
        '<label>Farm name <span class="ag-opt">(new accounts)</span></label><input id="agFarm" type="text" placeholder="e.g. Kgosi’s Farm">' +
        '<label>Phone number</label><div class="ag-phone"><select id="agCC">' + ccOptions() + '</select><input id="agPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="71 234 567"></div>' +
        '<div class="ag-msg" id="agMsg" hidden></div>' +
        '<button class="ag-btn" id="agGo">Send code</button>' +
        '<div id="agRecaptcha"></div>' +
        '<div class="ag-alt"><button class="ag-link" id="agToSignin">Use email instead</button></div>' +
        '<button class="ag-guest" id="agGuest">Continue without an account</button>';
    } else if (mode === 'phonecode') {
      card = '<h2>Enter the code</h2><p class="ag-sub">Sent by SMS to ' + esc(cloud.phoneNumber || 'your phone') + '.</p>' +
        '<label>6-digit code</label><input id="agCode" type="tel" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456">' +
        '<div class="ag-msg" id="agMsg" hidden></div>' +
        '<button class="ag-btn" id="agGo">Verify &amp; sign in</button>' +
        '<div id="agRecaptcha"></div>' +
        '<div class="ag-alt"><button class="ag-link" id="agResend">Resend code</button> · <button class="ag-link" id="agToPhone">Change number</button></div>';
    } else {
      card = '<h2>Welcome back</h2><p class="ag-sub">Sign in to reach your farm from any device.</p>' +
        '<label>Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">' +
        '<label>Password</label><input id="agPass" type="password" autocomplete="current-password" placeholder="Your password">' +
        '<div class="ag-msg" id="agMsg" hidden></div>' +
        '<button class="ag-btn" id="agGo">Sign in</button>' +
        '<div class="ag-alt"><button class="ag-link" id="agToReset">Forgot password?</button></div>' +
        '<div class="ag-alt">No email? <button class="ag-link" id="agToPhone">Use your phone number</button></div>' +
        '<div class="ag-alt">New here? <button class="ag-link" id="agToSignup">Create an account</button></div>' +
        '<button class="ag-guest" id="agGuest">Continue without an account</button>';
    }
    g.innerHTML = '<div class="ag-wrap">' + head + '<div class="ag-card">' + card + '</div><div class="ag-foot">Works offline after your first sign-in.</div></div>';
    var msg = $('#agMsg', g);
    function showErr(t) { msg.textContent = t; msg.hidden = false; }
    function busy(b) {
      var go = $('#agGo', g); if (!go) return; go.disabled = b;
      var labels = { signup: 'Create account', reset: 'Send reset link', phone: 'Send code', phonecode: 'Verify & sign in' };
      go.innerHTML = b ? 'Please wait…' : (labels[mode] || 'Sign in');
    }
    var toSignin = $('#agToSignin', g); if (toSignin) toSignin.onclick = function () { renderAuth('signin'); };
    var toSignup = $('#agToSignup', g); if (toSignup) toSignup.onclick = function () { renderAuth('signup'); };
    var toReset = $('#agToReset', g); if (toReset) toReset.onclick = function () { renderAuth('reset'); };
    var toPhone = $('#agToPhone', g); if (toPhone) toPhone.onclick = function () { renderAuth('phone'); };
    var resend = $('#agResend', g); if (resend) resend.onclick = function () { msg.hidden = true; sendPhoneCode(); };
    var guestBtn = $('#agGuest', g); if (guestBtn) guestBtn.onclick = continueAsGuest;

    function newVerifier() {
      try { if (cloud.recaptcha) cloud.recaptcha.clear(); } catch (e) {}
      cloud.recaptcha = new firebase.auth.RecaptchaVerifier('agRecaptcha', { size: 'invisible' });
      return cloud.recaptcha;
    }
    function sendPhoneCode() {
      if (!cloud.auth) return showErr('Still connecting — try again in a moment.');
      if ($('#agPhone', g)) {
        var cc = $('#agCC', g).value;
        var nat = ($('#agPhone', g).value || '').replace(/\D/g, '').replace(/^0+/, '');
        if (!nat) return showErr('Please enter your phone number.');
        cloud.phoneNumber = cc + nat;
        cloud.pendingFarm = ($('#agFarm', g).value || '').trim();
      }
      if (!cloud.phoneNumber) return renderAuth('phone');
      busy(true);
      var verifier;
      try { verifier = newVerifier(); } catch (e) { busy(false); return showErr('Verification could not start. Reload and try again.'); }
      cloud.auth.signInWithPhoneNumber(cloud.phoneNumber, verifier)
        .then(function (cr) { cloud.phoneConfirm = cr; busy(false); renderAuth('phonecode'); })
        .catch(function (e) { busy(false); try { cloud.recaptcha.clear(); } catch (x) {} showErr(authMsg(e.code)); });
    }
    function verifyPhoneCode() {
      if (!cloud.phoneConfirm) return renderAuth('phone');
      var code = ($('#agCode', g).value || '').replace(/\D/g, '');
      if (code.length < 6) return showErr('Enter the 6-digit code from the SMS.');
      busy(true);
      cloud.phoneConfirm.confirm(code).catch(function (e) { busy(false); showErr(authMsg(e.code)); });
      // success → onAuthStateChanged boots the app
    }

    $('#agGo', g).onclick = function () {
      msg.hidden = true;
      if (mode === 'phone') return sendPhoneCode();
      if (mode === 'phonecode') return verifyPhoneCode();
      if (!cloud.auth) return showErr('Still connecting — try again in a moment.');
      var email = ($('#agEmail', g).value || '').trim();
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
    var synced = cloud.lastSync ? 'Synced ' + relTime(cloud.lastSync) : (navigator.onLine ? 'Synced to your cloud account' : 'Offline — will sync when back online');
    var pwBlock = cloud.email
      ? '<div class="field-group"><label>Password</label><button class="btn-soft" id="acctPw">Send password reset email</button></div>'
      : '';
    var host = openModal(
      '<div class="modal-head"><h3>Account</h3><button class="x" id="mx">&times;</button></div>' +
      '<div class="acct-row"><span class="acct-ic">' + LEAF + '</span><div class="acct-meta"><b>' + esc(cloud.email || cloud.phone || 'Signed in') + '</b><span>' + synced + '</span></div></div>' +
      '<div class="field-group"><label>Farm name</label><input id="acctFarm" type="text" value="' + esc((DB.settings && DB.settings.farmName) || '') + '" placeholder="Your farm name"></div>' +
      '<button class="btn-primary" id="acctSave">Save changes</button>' +
      pwBlock +
      '<div class="acct-links"><button class="acct-link" id="acctExport">Export records</button>' +
      '<button class="acct-link" id="acctRegion">Region: ' + esc(countryInfo().name) + '</button>' +
      '<button class="acct-link" id="acctPro">' + (isPro() ? 'Manage Pro' : 'Upgrade to Pro') + '</button>' +
      '<button class="acct-link" id="acctPriv">Privacy</button></div>' +
      '<button class="btn-soft" id="acctOut">Sign out</button>' +
      '<button class="acct-del" id="acctDel">Delete account</button>');
    $('#mx', host).onclick = closeModal;
    $('#acctExport', host).onclick = function () { closeModal(); openExportSheet(); };
    $('#acctRegion', host).onclick = function () { closeModal(); openRegionSheet(); };
    $('#acctPro', host).onclick = function () { closeModal(); openUpgradeSheet(); };
    $('#acctPriv', host).onclick = function () { closeModal(); openPrivacy(); };
    $('#acctSave', host).onclick = function () {
      var name = ($('#acctFarm', host).value || '').trim();
      if (!name) return toast('Farm name can’t be empty');
      DB.settings = DB.settings || {}; DB.settings.farmName = name;
      save(); closeModal(); render(); toast('Farm name updated');
    };
    var pw = $('#acctPw', host); if (pw) pw.onclick = function () {
      if (!cloud.auth || !cloud.email) return;
      cloud.auth.sendPasswordResetEmail(cloud.email)
        .then(function () { toast('Reset link sent to ' + cloud.email); })
        .catch(function (e) { toast(authMsg(e.code)); });
    };
    $('#acctOut', host).onclick = function () { closeModal(); cloudSignOut(); toast('Signed out'); };
    $('#acctDel', host).onclick = function () { closeModal(); confirmDeleteAccount(); };
  }
  function confirmDeleteAccount() {
    var host = openModal(
      '<div class="modal-head"><h3>Delete account?</h3><button class="x" id="mx">&times;</button></div>' +
      '<p class="modal-note">This permanently deletes your account and all farm data in the cloud. This cannot be undone.</p>' +
      '<button class="btn-danger" id="delYes">Delete everything</button>' +
      '<button class="btn-soft" id="delNo">Cancel</button>');
    $('#mx', host).onclick = closeModal;
    $('#delNo', host).onclick = closeModal;
    $('#delYes', host).onclick = function () {
      var btn = $('#delYes', host); btn.disabled = true; btn.textContent = 'Deleting…';
      var uid = cloud.uid;
      userDoc().delete().catch(function () {}).then(function () {
        var u = cloud.auth && cloud.auth.currentUser;
        if (!u) { finishDelete(uid); return; }
        u.delete().then(function () { finishDelete(uid); })
          .catch(function (e) {
            btn.disabled = false; btn.textContent = 'Delete everything';
            if (e && e.code === 'auth/requires-recent-login') toast('Please sign out, sign in again, then delete.');
            else toast(authMsg(e && e.code));
          });
      });
    };
  }
  function finishDelete(uid) {
    try { localStorage.removeItem('mfag.u.' + uid); } catch (e) {}
    closeModal(); cloudSignOut(); toast('Account deleted');
  }

  function bootUI() {
    /* deep link from manifest shortcuts */
    var p = new URLSearchParams(location.search).get('view');
    if (p && ['fields', 'tasks', 'money', 'pests'].indexOf(p) >= 0) state.view = p;
    /* iOS install banner (no beforeinstallprompt on iOS) */
    if (isIOS() && !isStandalone() && DB && !DB.dismissInstall) { setTimeout(syncInstallBanner, 1200); }
    handleCheckoutReturn();   // toast after returning from Stripe Checkout
    render();
    ensureWeather();   // refresh local weather if a farm location is known
    if (DB && DB.settings && !DB.settings.consent) setTimeout(showConsent, 400);
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
