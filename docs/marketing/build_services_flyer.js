const fs=require('fs');
const { chromium }=require('/opt/node22/lib/node_modules/playwright');
const QR=fs.readFileSync('/tmp/print/qr.png').toString('base64');
const APP='agri.maintainflow.pro';
const services=[
 ['🌱','Crop Management','Fields, work orders, spray &amp; fertilizer schedules with safe re-entry windows.',''],
 ['🐄','Livestock Management','Herds, health &amp; vaccination reminders, weights, births, sales &amp; production.',''],
 ['🗓️','Smart Schedule','Every task, health check &amp; service due-date in one simple timeline.',''],
 ['💰','Cost &amp; Money Tracking','Log expenses, see cost per hectare, and track every pula you spend.',''],
 ['📈','Yield &amp; Herd Analytics','Season-by-season trends across crops &amp; livestock — farm smarter.','PRO'],
 ['🏦','Lender-Ready Reports','Turn your records into a credit-readiness report banks &amp; co-ops accept.','PRO'],
 ['🔧','Equipment Maintenance','Service reminders so your tractor, pump &amp; sprayer never let you down.',''],
 ['🛒','Input Marketplace','Seed, fertilizer, chemicals &amp; services — find suppliers in one place.',''],
];
const CSS=`
*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:0}
:root{--green:#14532d;--deep:#0a2e1c;--lime:#96d25a;--teal:#10aaa0;--ink:#1a2821;--mute:#5b6b60;--sand:#f4f1ea;--hair:#e3e7e1}
body{font-family:'Segoe UI',Arial,sans-serif;color:var(--ink);width:210mm;height:297mm}
.page{width:210mm;height:297mm;display:flex;flex-direction:column;overflow:hidden}
.band{background:linear-gradient(135deg,var(--green),var(--deep));color:#fff;padding:8mm 13mm 7mm}
.brand{display:flex;align-items:center;gap:10px}
.tile{width:44px;height:44px;border-radius:11px;background:var(--teal);display:flex;align-items:center;justify-content:center;font-size:23px}
.brand b{font-size:24px}
.brand .ag{color:var(--lime);font-size:12px;font-weight:800;border:1.5px solid var(--lime);border-radius:6px;padding:1px 5px;margin-left:2px}
.band h1{font-size:26px;line-height:1.1;margin-top:5mm}
.band h1 .l{color:var(--lime)}
.band p{color:#cfe3d3;font-size:13px;margin-top:2.5mm}
.wrap{padding:6mm 13mm 5mm;flex:1;display:flex;flex-direction:column}
.sec{font-size:11.5px;text-transform:uppercase;letter-spacing:1.5px;color:var(--teal);font-weight:800;margin-bottom:4mm}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:3.5mm 6mm}
.card{background:var(--sand);border:1px solid var(--hair);border-radius:13px;padding:4.5mm 5mm;position:relative}
.card .ic{font-size:26px;line-height:1}
.card b{display:block;font-size:14px;margin:7px 0 3px}
.card span{font-size:11.5px;color:var(--mute);line-height:1.4}
.pro{position:absolute;top:4.5mm;right:5mm;background:var(--lime);color:var(--deep);font-size:9.5px;font-weight:800;letter-spacing:.05em;padding:3px 8px;border-radius:999px}
.also{margin-top:4mm;font-size:12px;color:var(--mute);text-align:center}
.also b{color:var(--ink)}
.getrow{margin-top:auto;display:flex;align-items:center;gap:8mm;background:#fff;border:1.5px solid var(--hair);border-radius:14px;padding:5mm 7mm}
.getrow .qr{width:26mm;height:26mm}
.getrow b{font-size:16px}
.getrow ol{margin:5px 0 0 17px;font-size:12.5px;color:var(--mute);line-height:1.7}
.getrow .url{color:var(--green);font-weight:800}
.pill{display:inline-block;background:var(--lime);color:#0a2e1c;font-weight:800;font-size:11.5px;padding:6px 14px;border-radius:20px;margin-top:3mm}
.foot{padding:4mm 13mm;background:var(--deep);color:#bcd3c2;font-size:11px;display:flex;justify-content:space-between}
`;
const cards=services.map(s=>`<div class="card">${s[3]?`<span class="pro">${s[3]}</span>`:''}<span class="ic">${s[0]}</span><b>${s[1]}</b><span>${s[2]}</span></div>`).join('');
const html=`<!doctype html><html><head><meta charset=utf-8><style>${CSS}</style></head><body>
<div class="page">
 <div class="band">
  <div class="brand"><span class="tile">🌱</span><b>MaintainFlow</b><span class="ag">AG</span></div>
  <h1>Everything your farm needs,<br><span class="l">in one simple app.</span></h1>
  <p>Crops · Livestock · Money · Maintenance — built for African farmers, works offline.</p>
 </div>
 <div class="wrap">
  <div class="sec">What we help you do</div>
  <div class="grid">${cards}</div>
  <div class="also">Also includes <b>weather &amp; frost alerts</b>, <b>offline access</b> &amp; <b>automatic backup</b> across your devices.</div>
  <div class="pill" style="align-self:center">Free to start · Works offline · No app store needed</div>
  <div class="getrow">
   <img class="qr" src="data:image/png;base64,${QR}">
   <div><b>Get started in 30 seconds</b>
     <ol><li>Scan the code with your phone camera</li><li>Tap <b>Add to home screen</b> — it opens like an app</li><li>Add your first field or herd and go</li></ol>
     <div style="margin-top:5px;font-size:12.5px">No download needed · <span class="url">${APP}</span></div>
   </div>
  </div>
 </div>
 <div class="foot"><span>MaintainFlow Ag · Farm management for African growers</span><span>${APP}</span></div>
</div></body></html>`;
fs.writeFileSync('/tmp/print/services.html',html);
(async()=>{
 const b=await chromium.launch();
 const p=await b.newPage();
 await p.goto('file:///tmp/print/services.html',{waitUntil:'networkidle'});
 await p.waitForTimeout(300);
 // measure fit
 const m=await p.evaluate(()=>{var pg=document.querySelector('.page');var h0=pg.style.height;pg.style.height='auto';var h=pg.scrollHeight;pg.style.height=h0;return Math.round(h-Math.round(297/25.4*96));});
 await p.pdf({path:'/tmp/print/MaintainFlow_services_flyer.pdf',format:'A4',printBackground:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}});
 await p.setViewportSize({width:794,height:1123});
 await p.screenshot({path:'/tmp/print/services_preview.png'});
 console.log('overflow px (negative = fits):',m);
 await b.close();
})();
