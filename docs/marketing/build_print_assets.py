import qrcode, base64, os
APP_URL="https://agri.maintainflow.pro"   # <-- EDIT to your final URL
CONTACT="legops@gmail.com"                          # <-- EDIT contact

# QR (brand colours)
qr=qrcode.QRCode(border=1,box_size=12,error_correction=qrcode.constants.ERROR_CORRECT_M)
qr.add_data(APP_URL); qr.make(fit=True)
img=qr.make_image(fill_color="#0a2e1c", back_color="white").convert("RGB")
img.save("/tmp/print/qr.png")

def b64(p):
    with open(p,"rb") as f: return base64.b64encode(f.read()).decode()
QR=b64("/tmp/print/qr.png")
SHOT_LS=b64("/tmp/shots/05_livestock_home.png")
SHOT_LENDER=b64("/tmp/shots/09_lender.png")
SHOT_MONEY=b64("/tmp/shots/04_money.png")

CSS="""
*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:0}
:root{--green:#14532d;--deep:#0a2e1c;--lime:#96d25a;--teal:#10aaa0;--ink:#1a2821;--mute:#5b6b60;--sand:#f4f1ea;--hair:#e3e7e1}
body{font-family:'Segoe UI',Arial,sans-serif;color:var(--ink);width:210mm;height:297mm;background:#fff}
.page{width:210mm;height:297mm;overflow:hidden;position:relative;display:flex;flex-direction:column}
.band{background:linear-gradient(135deg,var(--green),var(--deep));color:#fff;padding:9mm 12mm 7mm}
.brand{display:flex;align-items:center;gap:10px}
.tile{width:42px;height:42px;border-radius:11px;background:var(--teal);display:flex;align-items:center;justify-content:center;font-size:22px}
.brand b{font-size:23px;letter-spacing:.2px}
.brand .ag{color:var(--lime);font-size:12px;font-weight:800;border:1.5px solid var(--lime);border-radius:6px;padding:1px 5px;margin-left:2px}
.tag{margin-top:3px;color:#cfe3d3;font-size:12.5px;letter-spacing:.3px}
h1{font-size:31px;line-height:1.07;margin-top:6mm}
h1 .l{color:var(--lime)}
.content{padding:7mm 12mm 4mm;flex:1;display:flex;flex-direction:column}
.lead{font-size:13px;color:var(--mute);line-height:1.45}
.benefits{display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm;margin:5mm 0}
.bf{display:flex;gap:11px}
.bf .ic{font-size:23px;flex:0 0 30px}
.bf b{font-size:15px;display:block;margin-bottom:2px}
.bf span{font-size:12.5px;color:var(--mute);line-height:1.45}
.hero{display:flex;gap:9mm;align-items:center}
.phone{width:45mm;border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.22);border:4px solid #fff}
.pill{display:inline-block;background:var(--lime);color:#0a2e1c;font-weight:800;font-size:13px;padding:8px 16px;border-radius:20px}
.getrow{margin-top:auto;display:flex;align-items:center;gap:9mm;background:var(--sand);border:1px solid var(--hair);border-radius:14px;padding:6mm 8mm}
.getrow .qr{width:30mm;height:30mm}
.steps b{font-size:15px}
.steps ol{margin:5px 0 0 17px;font-size:12.5px;color:var(--mute);line-height:1.7}
.url{color:var(--green);font-weight:800}
.foot{padding:3.5mm 12mm;background:var(--deep);color:#bcd3c2;font-size:10.5px;display:flex;justify-content:space-between}
/* partner specifics */
.kpis{display:flex;gap:6mm;margin:4mm 0}
.kpi{flex:1;background:var(--sand);border:1px solid var(--hair);border-radius:12px;padding:4.5mm}
.kpi b{font-size:20px;color:var(--green);display:block}
.kpi span{font-size:11.5px;color:var(--mute)}
.sec{margin:3mm 0}
.sec h3{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--teal);margin-bottom:2.5mm}
.list{list-style:none}
.list li{font-size:12.5px;line-height:1.42;margin-bottom:4px;padding-left:20px;position:relative}
.list li:before{content:'';position:absolute;left:0;top:6px;width:11px;height:11px;border-radius:3px;background:var(--lime)}
.two{display:flex;gap:9mm}
.two .col{flex:1}
.how{display:flex;gap:5mm;margin-top:3mm}
.how .st{flex:1;background:#fff;border:1px solid var(--hair);border-radius:11px;padding:3.5mm}
.how .n{width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;margin-bottom:6px}
.how b{font-size:13px}.how p{font-size:11.5px;color:var(--mute);margin-top:3px;line-height:1.4}
.cta{margin-top:auto;background:linear-gradient(135deg,var(--green),var(--deep));color:#fff;border-radius:14px;padding:4.5mm 8mm;display:flex;align-items:center;gap:8mm}
.cta .qr{width:28mm;height:28mm;background:#fff;border-radius:8px;padding:4px}
.cta b{font-size:17px}.cta p{font-size:12px;color:#cfe3d3;margin-top:4px;line-height:1.5}
.cta .c{font-weight:800;color:var(--lime)}
"""

flyer=f"""<!doctype html><html><head><meta charset=utf-8><style>{CSS}</style></head><body>
<div class=page>
 <div class=band>
   <div class=brand><span class=tile>🌱</span><b>MaintainFlow</b><span class=ag>AG</span></div>
   <div class=tag>Run your whole farm from your pocket</div>
   <h1>Crops &amp; livestock,<br><span class=l>one simple app.</span></h1>
 </div>
 <div class=content>
   <div class=hero>
     <div style="flex:1">
       <p class=lead>Stop losing records in notebooks and memory. Track your fields <b>and</b> your animals, see exactly where your money goes, and build a record that helps you get finance — all on your phone, even with no signal.</p>
       <div style="margin-top:7mm"><span class=pill>Free &nbsp;·&nbsp; Works offline</span></div>
     </div>
     <img class=phone src="data:image/png;base64,{SHOT_LS}">
   </div>
   <div class=benefits>
     <div class=bf><span class=ic>🐄</span><div><b>Track your livestock</b><span>Herd health &amp; vaccination reminders, weights, births, deaths &amp; sales — cattle, goats, sheep, poultry &amp; pigs.</span></div></div>
     <div class=bf><span class=ic>🌱</span><div><b>Manage your crops</b><span>Field work orders, spray &amp; fertilizer schedules, re-entry windows and weather &amp; frost alerts.</span></div></div>
     <div class=bf><span class=ic>💰</span><div><b>Control your costs</b><span>Log expenses, see cost per hectare and where the money goes — plus local market prices.</span></div></div>
     <div class=bf><span class=ic>🏦</span><div><b>Get loan-ready</b><span>Turn your records into a credit-readiness report you can take to lenders and co-ops.</span></div></div>
   </div>
   <div class=getrow>
     <img class=qr src="data:image/png;base64,{QR}">
     <div class=steps><b>Get it in 30 seconds</b>
       <ol><li>Scan the code with your phone camera</li><li>Tap <b>Add to home screen</b> — it opens like an app</li><li>Add your first field or herd and start logging</li></ol>
       <div style="margin-top:5px;font-size:12.5px">No app store needed · <span class=url>{APP_URL.replace('https://','')}</span></div>
     </div>
   </div>
 </div>
 <div class=foot><span>MaintainFlow Ag · Farm management for African growers</span><span>{APP_URL.replace('https://','')}</span></div>
</div></body></html>"""

partner=f"""<!doctype html><html><head><meta charset=utf-8><style>{CSS}</style></head><body>
<div class=page>
 <div class=band style="padding-bottom:6mm">
   <div class=brand><span class=tile>🌱</span><b>MaintainFlow</b><span class=ag>AG</span><span style="margin-left:auto;font-size:11px;color:#cfe3d3;border:1px solid #3c6b4e;border-radius:20px;padding:4px 12px">Partner Brief</span></div>
   <h1 style="font-size:24px;margin-top:5mm">Lower the cost of serving<br><span class=l>smallholder &amp; emerging farmers.</span></h1>
   <div class=tag style="margin-top:5mm;font-size:13px;color:#dfeede">For lenders, MFIs, insurers &amp; co-operatives</div>
 </div>
 <div class=content style="padding-top:6mm">
   <p class=lead>Most farmers are "thin-file": no structured records, making credit assessment slow, costly and risky. MaintainFlow Ag gets farmers logging their daily crop &amp; livestock activity — and turns it into <b>verifiable records and a credit-readiness score</b> your team can act on.</p>
   <div class=kpis>
     <div class=kpi><b>Offline</b><span>Works on cheap phones, no signal needed</span></div>
     <div class=kpi><b>Whole-farm</b><span>Crops, livestock, costs &amp; equipment</span></div>
     <div class=kpi><b>Lender-ready</b><span>Structured records + PDF report</span></div>
   </div>
   <div class=two>
     <div class=col>
       <div class=sec><h3>What you get</h3>
         <ul class=list>
           <li><b>Verifiable farm records</b> — fields, herds, inputs, costs &amp; yields over time</li>
           <li><b>Credit-readiness score</b> &amp; exportable PDF summary per farmer</li>
           <li><b>Lower assessment cost</b> and faster, better-informed decisions</li>
           <li><b>A warm channel</b> to active farmers at planning &amp; purchase moments</li>
           <li><b>Impact &amp; portfolio insight</b> from consented, structured data</li>
         </ul>
       </div>
     </div>
     <div class=col>
       <div class=sec><h3>Why farmers use it</h3>
         <ul class=list>
           <li>Free to start &amp; genuinely useful day one</li>
           <li>Saves money — clear costs, fewer losses, timely treatments</li>
           <li>Their data, their consent — they choose what to share</li>
         </ul>
       </div>
       <img src="data:image/png;base64,{SHOT_LENDER}" style="width:30mm;border-radius:10px;border:3px solid #fff;box-shadow:0 8px 20px rgba(0,0,0,.18);float:right;margin-top:-1mm">
     </div>
   </div>
   <div class=sec><h3>How it works</h3>
     <div class=how>
       <div class=st><div class=n>1</div><b>Farmers log</b><p>Daily crop &amp; livestock activity, costs and yields — offline.</p></div>
       <div class=st><div class=n>2</div><b>App structures it</b><p>Records become a credit-readiness score &amp; standard report.</p></div>
       <div class=st><div class=n>3</div><b>You decide faster</b><p>Assess, lend or insure with real data — at lower cost.</p></div>
     </div>
   </div>
   <div class=cta>
     <img class=qr src="data:image/png;base64,{QR}">
     <div><b>Let's run a pilot.</b><p>We'll co-design the report your team needs and onboard a first cohort of farmers. Sponsored-Pro &amp; bulk distribution models available.</p>
       <p style="margin-top:6px">Contact: <span class=c>{CONTACT}</span> &nbsp;·&nbsp; <span class=c>{APP_URL.replace('https://','')}</span></p></div>
   </div>
 </div>
 <div class=foot><span>MaintainFlow Ag · Whole-farm records for finance &amp; inclusion</span><span>{APP_URL.replace('https://','')}</span></div>
</div></body></html>"""

open("/tmp/print/flyer.html","w").write(flyer)
open("/tmp/print/partner.html","w").write(partner)
print("html written; URL=",APP_URL)
