// ===== Daily — Diego's training & life app =====
const DATA = {};
let TAB = "today";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const prettyDate = () => new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});

// ---- local log (per day) ----
const logKey = () => `daily-${todayStr()}`;
function getLog(){
  try { return JSON.parse(localStorage.getItem(logKey())) || {}; }
  catch { return {}; }
}
function saveLog(log){
  localStorage.setItem(logKey(), JSON.stringify(log));
  flash();
}
function patch(fn){ const l = getLog(); fn(l); saveLog(l); }

let flashT;
function flash(){
  const f = document.getElementById("flash");
  if(!f) return;
  f.classList.add("show");
  clearTimeout(flashT);
  flashT = setTimeout(()=>f.classList.remove("show"), 900);
}

// ---- helpers ----
function daysUntil(dateStr){
  const t = new Date(); t.setHours(0,0,0,0);
  const d = new Date(dateStr+"T00:00:00");
  return Math.round((d - t)/86400000);
}
function nextComp(){
  const comps = (DATA.schedule?.competitions||[])
    .map(c=>({...c,d:daysUntil(c.date)}))
    .filter(c=>c.d>=0)
    .sort((a,b)=>a.d-b.d);
  return comps[0] || null;
}
const esc = s => (s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ---- load data ----
async function loadData(){
  const files = ["today","plan","nutrition","schedule"];
  await Promise.all(files.map(async f=>{
    try { DATA[f] = await (await fetch(`data/${f}.json?_=${Date.now()}`)).json(); }
    catch(e){ DATA[f] = null; }
  }));
}

// ===== tabs =====
function setTab(t){
  TAB = t;
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active", b.dataset.tab===t));
  render();
}

function render(){
  document.getElementById("hdr-date").textContent = prettyDate();
  const el = document.getElementById("content");
  if(TAB==="today") el.innerHTML = viewToday();
  else if(TAB==="train") el.innerHTML = viewTrain();
  else if(TAB==="eat") el.innerHTML = viewEat();
  else if(TAB==="schedule") el.innerHTML = viewSchedule();
  bindInputs();
}

// ===== TODAY =====
function viewToday(){
  const t = DATA.today, n = DATA.nutrition, log = getLog();
  const nc = nextComp();
  if(!t) return `<div class="empty">Couldn't load today's plan.</div>`;
  const tds = t.todos||[];
  const doneN = tds.filter(td=>log.todos?.[td.id] ?? td.done).length;
  const pct = tds.length ? Math.round(doneN/tds.length*100) : 0;
  const todos = tds.map(td=>{
    const done = log.todos?.[td.id] ?? td.done;
    return `<div class="todo ${done?"done":""}">
      <input type="checkbox" data-todo="${esc(td.id)}" ${done?"checked":""}>
      <label>${esc(td.text)}</label></div>`;
  }).join("");
  const C=175.9, off=C*(1-pct/100);
  return `
    <div class="hero">
      <div><div class="hero-title">${esc(t.focus||"Today")}</div>
        <div class="hero-sub">${esc(t.phase||"")}</div></div>
      <div class="ring"><svg width="64" height="64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="7"></circle>
        <circle cx="32" cy="32" r="28" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"></circle>
      </svg><div class="ring-txt">${pct}%</div></div>
    </div>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-label">Next comp</div>
        <div class="stat-val">${nc?nc.d+"d":"—"}</div>
        <div class="stat-sub">${nc?esc(nc.name.split("—")[0]):"none set"}</div></div>
      <div class="stat-card"><div class="stat-label">Protein target</div>
        <div class="stat-val">${esc(n?.protein_g||"—")}g</div>
        <div class="stat-sub">${esc(n?.bodyweight_kg||"")}kg bodyweight</div></div>
    </div>
    <div class="section-title">To-do today</div>
    <div class="card">${todos||'<div class="note">No to-dos.</div>'}</div>
    <div class="section-title">Body</div>
    <div class="card">
      <div class="field"><label>Bodyweight (kg)</label>
        <input type="text" inputmode="decimal" id="bw" value="${esc(log.bodyweight||"")}" placeholder="73"></div>
      <div class="field"><label>How I feel / energy</label>
        <input type="text" id="felt" value="${esc(log.felt||"")}" placeholder="e.g. fresh, sore legs, tired"></div>
    </div>
    ${t.note?`<div class="note">${esc(t.note)}</div>`:""}`;
}

// ===== set logger (scroll wheels) =====
const LIFTS = {};                 // working sets per exercise: name -> [{w,r}]
const LIFTUI = { sel:{}, manual:{} };
const ITEM_W = 56;

function exByName(name){
  for(const d of (DATA.plan?.days||[])) for(const ex of (d.exercises||[])) if(ex.name===name) return ex;
  return { name };
}

// Per-exercise weight/rep estimate (kg) for a ~73kg returning athlete in a base block.
// All editable — these just center the wheel on a sensible starting point.
function exConfig(ex){
  const n = (ex.name||"").toLowerCase();
  const SPECIAL = ["force-velocity","jump","bound","pogo","nordic","copenhagen",
                   "plank","landing","interval","pallof","dead bug","strides","mobility"];
  if(SPECIAL.some(k=>n.includes(k))) return { kind:"special" };
  let wDef=20, wMax=100, wStep=2.5;
  const S=(d,mx,st)=>{ wDef=d; wMax=mx; wStep=st; };
  if(/romanian|rdl/.test(n))                    S(50,180,5);
  else if(/trap|deadlift/.test(n))              S(70,220,5);
  else if(/goblet/.test(n))                     S(24,120,2);
  else if(/back squat|squat/.test(n))           S(40,180,2.5);
  else if(/split squat|bulgarian/.test(n))      S(14,50,2);
  else if(/step-?up/.test(n))                   S(12,60,2);
  else if(/calf/.test(n))                       S(30,160,5);
  else if(/push press/.test(n))                 S(18,70,2);
  else if(/shoulder press|overhead|ohp/.test(n))S(16,60,2);
  else if(/lateral raise|side raise/.test(n))   S(8,30,1);
  else if(/bench|db press|press/.test(n))       S(20,80,2.5);
  else if(/pulldown|pull-?up|lat\b/.test(n))    S(45,120,2.5);
  else if(/row/.test(n))                        S(24,60,2);
  else if(/wrist|forearm/.test(n))              S(5,25,1);
  else if(/lunge/.test(n))                      S(0,40,2);   // often bodyweight
  const rDef = parseInt(ex.reps) || 8;
  return { kind:"weighted", wDef, wMax, wStep, rDef, rMin:1, rMax:20 };
}

const fmtW = w => (w%1===0 ? String(w) : w.toFixed(1));
const setLabel = s => (s.w>0 ? fmtW(s.w) : "BW") + "×" + s.r;

function serializeSets(sets){ return sets.map(setLabel).join(", "); }
function parseSets(str){
  const out=[]; const re=/([\d.]+|bw)\s*[x×]\s*(\d+)/gi; let m;
  while((m=re.exec(str||""))) out.push({ w: m[1].toLowerCase()==="bw"?0:+m[1], r:+m[2] });
  return out;
}

function getSets(ex){
  const key=ex.name, cfg=exConfig(ex), log=getLog();
  if(LIFTS[key]) return LIFTS[key];
  let sets = (log.liftsData?.[key]?.map(s=>({w:+s.w||0, r:+s.r||0}))) ||
             (log.lifts?.[key] ? parseSets(log.lifts[key]) : null);
  if(!sets || !sets.length){
    const n = parseInt(ex.sets) || 3;
    sets = Array.from({length:n}, ()=>({ w:cfg.wDef, r:cfg.rDef }));
  }
  LIFTS[key]=sets; return sets;
}

let saveT;
function saveSets(key){
  clearTimeout(saveT);
  saveT = setTimeout(()=>{
    patch(l=>{
      l.liftsData = l.liftsData||{}; l.liftsData[key]=LIFTS[key];
      l.lifts     = l.lifts||{};     l.lifts[key]=serializeSets(LIFTS[key]);
    });
  }, 250);
}

function wheelValues(kind,cfg){
  if(kind==="r"){ const a=[]; for(let v=cfg.rMin;v<=cfg.rMax;v++) a.push(v); return a; }
  const a=[]; for(let v=0;v<=cfg.wMax+1e-9;v+=cfg.wStep) a.push(+v.toFixed(2)); return a;
}
const wheelLabel = (kind,v)=> kind==="w" ? (v===0?"BW":fmtW(v)) : String(v);
const nearestIdx = (arr,v)=> arr.reduce((bi,x,i)=> Math.abs(x-v)<Math.abs(arr[bi]-v)?i:bi, 0);

function wheelHTML(kind,cfg){
  const vals = wheelValues(kind,cfg);
  const items = vals.map(v=>`<button class="wheel-item" data-v="${v}">${wheelLabel(kind,v)}</button>`).join("");
  return `<div class="wheel-col">
    <div class="wheel-cap">${kind==="w"?"Weight (kg)":"Reps"}</div>
    <div class="stepper">
      <button class="step" data-kind="${kind}" data-d="-1">−</button>
      <div class="wheel" data-kind="${kind}">
        <div class="wheel-center"></div>
        <div class="wheel-track"><div class="wheel-pad"></div>${items}<div class="wheel-pad"></div></div>
      </div>
      <button class="step" data-kind="${kind}" data-d="1">＋</button>
    </div>
  </div>`;
}

function liftEditorHTML(ex){
  const key=ex.name, cfg=exConfig(ex);
  if(cfg.kind==="special" || LIFTUI.manual[key]){
    const val = getLog().lifts?.[key] || "";
    return `<input type="text" class="lift-manual" data-lift="${esc(key)}" value="${esc(val)}" placeholder="log e.g. 80x5, 85x5">
      ${cfg.kind!=="special" ? `<div class="lift-actions"><span></span><button class="type-toggle" data-mode="wheel">↩ Use wheels</button></div>` : ""}`;
  }
  const sets = getSets(ex);
  const sel  = Math.min(LIFTUI.sel[key] ?? 0, sets.length-1);
  LIFTUI.sel[key]=sel;
  const chips = sets.map((s,i)=>`<button class="set-chip ${i===sel?"sel":""}" data-set="${i}">${setLabel(s)}</button>`).join("")
    + `<button class="set-add">＋ set</button>`;
  return `<div class="lift" data-wrap2="${esc(key)}">
    <div class="set-chips">${chips}</div>
    <div class="wheels">${wheelHTML("w",cfg)}${wheelHTML("r",cfg)}</div>
    <div class="lift-actions">
      ${sets.length>1 ? `<button class="set-del">🗑 remove set ${sel+1}</button>` : `<span></span>`}
      <button class="type-toggle" data-mode="manual">✎ Type manually</button>
    </div>
  </div>`;
}

function setWheel(wheel, idx){ wheel.scrollTo({ left: idx*ITEM_W, behavior:"smooth" }); }
function markOn(items, idx){ items.forEach((it,i)=>it.classList.toggle("on", i===idx)); }

function initOneLift(wrap){
  const key = wrap.dataset.wrap, ex = exByName(key), cfg = exConfig(ex);
  if(cfg.kind==="special" || LIFTUI.manual[key]){
    const tog = wrap.querySelector(".type-toggle");
    if(tog) tog.onclick = ()=>{ LIFTUI.manual[key]=false; renderLiftBlock(key); };
    return;
  }
  const sets = getSets(ex);
  const sel  = LIFTUI.sel[key] ?? 0;

  wrap.querySelectorAll(".wheel").forEach(wheel=>{
    const kind  = wheel.dataset.kind;
    const items = [...wheel.querySelectorAll(".wheel-item")];
    const vals  = items.map(it=>+it.dataset.v);
    const cur   = kind==="w" ? sets[sel].w : sets[sel].r;
    let idx = vals.indexOf(cur); if(idx<0) idx = nearestIdx(vals,cur);
    requestAnimationFrame(()=>{ wheel.scrollLeft = idx*ITEM_W; markOn(items, idx); });
    let t;
    wheel.addEventListener("scroll", ()=>{
      const i = Math.max(0, Math.min(vals.length-1, Math.round(wheel.scrollLeft/ITEM_W)));
      markOn(items, i);
      clearTimeout(t);
      t = setTimeout(()=>setVal(key, kind, vals[i]), 90);
    });
    items.forEach((it,i)=> it.onclick = ()=> setWheel(wheel, i));
  });

  wrap.querySelectorAll(".step").forEach(b=> b.onclick = ()=>{
    const wheel = wrap.querySelector(`.wheel[data-kind="${b.dataset.kind}"]`);
    const n = wheel.querySelectorAll(".wheel-item").length;
    const i = Math.max(0, Math.min(n-1, Math.round(wheel.scrollLeft/ITEM_W) + (+b.dataset.d)));
    setWheel(wheel, i);
  });

  wrap.querySelectorAll(".set-chip").forEach(c=> c.onclick = ()=>{ LIFTUI.sel[key]=+c.dataset.set; renderLiftBlock(key); });
  const add = wrap.querySelector(".set-add");
  if(add) add.onclick = ()=>{ const s=getSets(ex); const last=s[s.length-1]; s.push({w:last.w,r:last.r}); LIFTUI.sel[key]=s.length-1; saveSets(key); renderLiftBlock(key); };
  const del = wrap.querySelector(".set-del");
  if(del) del.onclick = ()=>{ const s=getSets(ex); if(s.length<=1) return; s.splice(LIFTUI.sel[key],1); LIFTUI.sel[key]=Math.max(0,(LIFTUI.sel[key]||0)-1); saveSets(key); renderLiftBlock(key); };
  const tog = wrap.querySelector(".type-toggle");
  if(tog) tog.onclick = ()=>{ LIFTUI.manual[key]=true; renderLiftBlock(key); };
}

function setVal(key, kind, v){
  const ex=exByName(key), sets=getSets(ex), sel=LIFTUI.sel[key]??0;
  if(kind==="w") sets[sel].w=v; else sets[sel].r=v;
  const wrap=document.querySelector(`.lift-wrap[data-wrap="${key}"]`);
  const chip=wrap?.querySelector(`.set-chip[data-set="${sel}"]`);
  if(chip) chip.textContent=setLabel(sets[sel]);
  saveSets(key);
}

function renderLiftBlock(key){
  const wrap=document.querySelector(`.lift-wrap[data-wrap="${key}"]`);
  if(!wrap) return;
  wrap.innerHTML = liftEditorHTML(exByName(key));
  const mc = wrap.querySelector("[data-lift]"); // re-wire manual field if present
  if(mc) mc.onchange = e=>{ delete LIFTS[key]; patch(l=>{ l.lifts=l.lifts||{}; l.lifts[key]=e.target.value; if(l.liftsData) delete l.liftsData[key]; }); };
  initOneLift(wrap);
}

function initLiftEditors(){ document.querySelectorAll(".lift-wrap").forEach(initOneLift); }

// ===== TRAIN =====
function viewTrain(){
  const p = DATA.plan, log = getLog();
  if(!p) return `<div class="empty">Couldn't load training plan.</div>`;
  const principles = (p.principles||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  const days = (p.days||[]).map(d=>{
    const exs = (d.exercises||[]).map(ex=>{
      const key = ex.name;
      const tgt = [ex.sets&&`${ex.sets} sets`, ex.reps&&`${ex.reps} reps`, ex.target].filter(Boolean).join(" · ");
      const cues = (ex.cues||[]).map(c=>`<li>${esc(c)}</li>`).join("");
      const q = encodeURIComponent(ex.video || (ex.name+" technique"));
      const how = (cues || ex.video) ? `<details class="ex-how">
        <summary>How to do it ▾</summary>
        ${cues?`<ul class="cues">${cues}</ul>`:""}
        <a class="demo-link" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶ Watch demo</a>
      </details>` : "";
      return `<div class="ex">
        <div class="ex-name">${esc(ex.name)}</div>
        <div class="ex-target">${esc(tgt)}</div>
        <div class="lift-wrap" data-wrap="${esc(key)}">${liftEditorHTML(ex)}</div>
        ${how}
        ${ex.notes?`<div class="ex-note">${esc(ex.notes)}</div>`:""}
      </div>`;
    }).join("");
    const extras = [
      d.power&&d.power!=="—"?`<div class="note"><b>Power:</b> ${esc(d.power)}</div>`:"",
      d.conditioning&&d.conditioning!=="—"?`<div class="note"><b>Conditioning:</b> ${esc(d.conditioning)}</div>`:"",
      d.mobility?`<div class="note"><b>Mobility:</b> ${esc(d.mobility)}</div>`:""
    ].join("");
    return `<div class="day-head">${esc(d.day)}<div class="day-focus">${esc(d.focus||"")}</div></div>
      <div class="card" style="border-radius:0 0 10px 10px;margin-top:0">
        ${d.warmup?`<div class="note" style="margin-bottom:8px"><b>Warmup:</b> ${esc(d.warmup)}</div>`:""}
        ${exs}${extras}</div>`;
  }).join("");
  return `
    <div class="hero">
      <div class="hero-title">${esc(p.phase||"Training")}</div>
      <div class="hero-sub">${esc(p.week||"")}</div>
    </div>
    ${principles?`<div class="section-title">Principles</div><div class="card"><ul style="margin-left:16px;font-size:13px;line-height:1.6">${principles}</ul></div>`:""}
    <div class="section-title">Sessions</div>
    ${days}
    ${p.note?`<div class="note">${esc(p.note)}</div>`:""}`;
}

// ===== EAT =====
function viewEat(){
  const n = DATA.nutrition, log = getLog();
  if(!n) return `<div class="empty">Couldn't load nutrition.</div>`;
  const habits = (n.habits||[]).map((h,i)=>{
    const done = log.habits?.[i] ?? false;
    return `<div class="todo ${done?"done":""}">
      <input type="checkbox" data-habit="${i}" ${done?"checked":""}>
      <label>${esc(h)}</label></div>`;
  }).join("");
  return `
    <div class="hero"><div class="hero-title">Nutrition</div>
      <div class="hero-sub">${esc(n.bodyweight_kg)}kg · targets</div></div>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-label">Calories (full-time)</div><div class="stat-val">${esc(n.calories_fulltime)}</div><div class="stat-sub">now: ${esc(n.calories_now)}</div></div>
      <div class="stat-card"><div class="stat-label">Protein</div><div class="stat-val">${esc(n.protein_g)}g</div><div class="stat-sub">~4 meals</div></div>
      <div class="stat-card"><div class="stat-label">Carbs (training)</div><div class="stat-val">${esc(n.carbs_g_training_day)}g</div><div class="stat-sub">lower on rest days</div></div>
      <div class="stat-card"><div class="stat-label">Fat</div><div class="stat-val">${esc(n.fat_g)}g</div><div class="stat-sub"></div></div>
    </div>
    <div class="section-title">Daily habits</div>
    <div class="card">${habits}</div>
    ${log.totals?`<div class="section-title">Today so far</div>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-label">Calories eaten</div><div class="stat-val">${Math.round(log.totals.calories)}</div><div class="stat-sub">target ${esc(n.calories_fulltime)}</div></div>
      <div class="stat-card"><div class="stat-label">Protein eaten</div><div class="stat-val">${Math.round(log.totals.protein)}g</div><div class="stat-sub">target ${esc(n.protein_g)}</div></div>
    </div>`:""}
    <div class="section-title">📸 Snap a meal → instant macros</div>
    <div class="card" id="snap-card">${mealCardHTML()}</div>
    <div class="section-title">Food log</div>
    <div class="card"><div class="field"><label>What I ate today</label>
      <textarea id="food" placeholder="meals, rough amounts...">${esc(log.food||"")}</textarea></div></div>
    ${n.note?`<div class="note">${esc(n.note)}</div>`:""}`;
}

// ===== SCHEDULE =====
function viewSchedule(){
  const s = DATA.schedule;
  if(!s) return `<div class="empty">Couldn't load schedule.</div>`;
  const comps = (s.competitions||[]).map(c=>{
    const d = daysUntil(c.date);
    return `<div class="ev"><div><div class="ev-name">${esc(c.name)}</div>
      <div class="ev-meta">${esc(c.date)} · ${esc(c.location)} · ${esc(c.status||"")}</div></div>
      <div class="ev-days">${d>=0?d+"d":"past"}</div></div>`;
  }).join("");
  const flights = (s.flights||[]).map(f=>
    `<div class="ev"><div><div class="ev-name">${esc(f.route||f.name||"Flight")}</div>
      <div class="ev-meta">${esc(f.date)} · ${esc(f.notes||"")}</div></div></div>`).join("");
  return `
    <div class="hero"><div class="hero-title">Schedule</div><div class="hero-sub">comps + travel</div></div>
    <div class="section-title">Competitions</div>
    <div class="card">${comps||'<div class="note">None yet.</div>'}</div>
    <div class="section-title">Flights</div>
    <div class="card">${flights||'<div class="note">No flights yet — tell Claude to add them.</div>'}</div>
    ${s.note?`<div class="note">${esc(s.note)}</div>`:""}`;
}

// ===== input binding =====
function bindInputs(){
  document.querySelectorAll("[data-todo]").forEach(c=>c.onchange=e=>{
    patch(l=>{ l.todos=l.todos||{}; l.todos[e.target.dataset.todo]=e.target.checked; });
    render();
  });
  document.querySelectorAll("[data-habit]").forEach(c=>c.onchange=e=>{
    patch(l=>{ l.habits=l.habits||{}; l.habits[e.target.dataset.habit]=e.target.checked; });
    render();
  });
  document.querySelectorAll("[data-lift]").forEach(i=>i.onchange=e=>{
    const k=e.target.dataset.lift;
    delete LIFTS[k];
    patch(l=>{ l.lifts=l.lifts||{}; l.lifts[k]=e.target.value; if(l.liftsData) delete l.liftsData[k]; });
  });
  if(TAB==="train") initLiftEditors();
  const bw=document.getElementById("bw"); if(bw) bw.onchange=e=>patch(l=>l.bodyweight=e.target.value);
  const felt=document.getElementById("felt"); if(felt) felt.onchange=e=>patch(l=>l.felt=e.target.value);
  const food=document.getElementById("food"); if(food) food.onchange=e=>patch(l=>l.food=e.target.value);
  const mc=document.getElementById("mealcam"); if(mc) mc.onchange=onMeal;
}

// ===== snap a meal → instant macros via Claude vision (bring-your-own-key) =====
const KEY = "anthropic_key";
const hasKey = () => !!localStorage.getItem(KEY);

function mealCardHTML(){
  if(!hasKey()){
    return `
      <div class="field"><label>Anthropic API key (one-time)</label>
        <input type="password" id="apikey" placeholder="sk-ant-..." autocomplete="off"></div>
      <button class="snap-btn" onclick="saveKey()">Save key</button>
      <div class="note">Get one at <b>console.anthropic.com → API Keys</b> and add a few $ of credit. Stored only on this device. Then snap meals for instant macros (~1–2¢ each).</div>`;
  }
  return `
    <button class="snap-btn" onclick="snapMeal()">📸 Photo my meal</button>
    <input type="file" id="mealcam" accept="image/*" capture="environment" style="display:none">
    <div id="meal-result"></div>
    <div class="note"><a href="#" onclick="changeKey();return false;">Change API key</a> · estimates are approximate</div>`;
}
function saveKey(){
  const v=(document.getElementById("apikey")||{}).value;
  if(v && v.trim()){ localStorage.setItem(KEY, v.trim()); flash(); render(); }
  else alert("Paste your Anthropic API key first.");
}
function changeKey(){ if(confirm("Remove the saved API key?")){ localStorage.removeItem(KEY); render(); } }

function snapMeal(){ const i=document.getElementById("mealcam"); if(i) i.click(); }
async function onMeal(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if(file) analyzeMeal(file);
}

async function analyzeMeal(file){
  const res = document.getElementById("meal-result");
  if(res) res.innerHTML = `<div class="meal-loading">Analyzing your meal… 🔎</div>`;
  let dataUrl;
  try { dataUrl = await new Promise((ok,no)=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=no; r.readAsDataURL(file); }); }
  catch{ if(res) res.innerHTML=`<div class="meal-err">Couldn't read the image.</div>`; return; }
  const m = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
  if(!m){ if(res) res.innerHTML=`<div class="meal-err">Unsupported image.</div>`; return; }
  const prompt = 'Estimate the nutrition of the food in this photo. Respond with ONLY compact JSON, no prose, no code fences: {"items":["..."],"calories":N,"protein_g":N,"carbs_g":N,"fat_g":N,"confidence":"low|med|high","note":"one short line"}. Estimate typical portion sizes from the image.';
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-api-key": localStorage.getItem(KEY),
        "anthropic-version":"2023-06-01",
        "anthropic-dangerous-direct-browser-access":"true"
      },
      body: JSON.stringify({
        model:"claude-haiku-4-5-20251001",
        max_tokens:400,
        messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:m[1],data:m[2]}},
          {type:"text",text:prompt}
        ]}]
      })
    });
    const j = await r.json();
    if(!r.ok){ if(res) res.innerHTML=`<div class="meal-err">Error: ${esc(j.error?.message||("HTTP "+r.status))}. Check your key + API credit.</div>`; return; }
    let txt = (j.content && j.content[0] && j.content[0].text || "").trim()
      .replace(/^```json/i,"").replace(/^```/,"").replace(/```$/,"").trim();
    const macro = JSON.parse(txt);
    renderMeal(res, macro);
  } catch(err){
    if(res) res.innerHTML=`<div class="meal-err">Failed: ${esc(err.message)}. Check your connection, key, and API credit.</div>`;
  }
}
function renderMeal(res, mc){
  window.__lastMeal = mc;
  if(!res) return;
  res.innerHTML = `
    <div class="meal-card">
      <div class="meal-items">${esc((mc.items||[]).join(", "))}</div>
      <div class="meal-macros">
        <div class="mm"><b>${mc.calories??"?"}</b><span>kcal</span></div>
        <div class="mm"><b>${mc.protein_g??"?"}</b><span>protein</span></div>
        <div class="mm"><b>${mc.carbs_g??"?"}</b><span>carbs</span></div>
        <div class="mm"><b>${mc.fat_g??"?"}</b><span>fat</span></div>
      </div>
      ${mc.note?`<div class="note">${esc(mc.note)} · confidence: ${esc(mc.confidence||"?")}</div>`:""}
      <button class="snap-btn" onclick="logMeal()">＋ Log this meal</button>
    </div>`;
}
function logMeal(){
  const mc = window.__lastMeal; if(!mc) return;
  patch(l=>{
    l.meals = l.meals||[];
    l.meals.push({ calories:+mc.calories||0, protein:+mc.protein_g||0, carbs:+mc.carbs_g||0, fat:+mc.fat_g||0, items:mc.items||[] });
    l.totals = l.meals.reduce((a,x)=>({calories:a.calories+x.calories,protein:a.protein+x.protein,carbs:a.carbs+x.carbs,fat:a.fat+x.fat}),{calories:0,protein:0,carbs:0,fat:0});
  });
  setTab("eat");
}

// ===== share my day =====
function buildDayText(){
  const log = getLog();
  const t = DATA.today, n = DATA.nutrition;
  let out = `# My day — ${todayStr()}\n`;
  if(log.bodyweight) out += `Bodyweight: ${log.bodyweight} kg\n`;
  if(log.felt) out += `Feel/energy: ${log.felt}\n`;
  const todos = (t?.todos||[]).map(td=>`- [${(log.todos?.[td.id]??td.done)?"x":" "}] ${td.text}`);
  if(todos.length) out += `\n## To-dos\n${todos.join("\n")}\n`;
  const lifts = Object.entries(log.lifts||{}).filter(([,v])=>v && v.trim());
  if(lifts.length) out += `\n## Lifts logged\n${lifts.map(([k,v])=>`- ${k}: ${v}`).join("\n")}\n`;
  const habits = (n?.habits||[]).map((h,i)=>`- [${log.habits?.[i]?"x":" "}] ${h}`);
  if(habits.length) out += `\n## Nutrition habits\n${habits.join("\n")}\n`;
  if(log.food) out += `\n## Food\n${log.food}\n`;
  out += `\n(Paste this to Claude to update my plan.)`;
  return out;
}
function shareDay(){
  const out = buildDayText();
  if(navigator.share){ navigator.share({title:"My day", text:out}).catch(()=>copyText(out)); }
  else copyText(out);
}
function copyText(txt){
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(txt)
      .then(()=>alert("Copied your day ✓ — paste it into a Claude chat to update your plan."))
      .catch(()=>fallbackCopy(txt));
  } else fallbackCopy(txt);
}
function fallbackCopy(txt){
  try {
    const ta=document.createElement("textarea");
    ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta);
    alert("Copied your day ✓ — paste it into a Claude chat.");
  } catch(e){ alert("Couldn't auto-copy — long-press to select your day text."); }
}

// ===== boot =====
(async function(){
  await loadData();
  render();
  if("serviceWorker" in navigator){
    try { await navigator.serviceWorker.register("sw.js"); } catch(e){}
  }
})();
// ===== Obsidian vault sync (GitHub) — tailored for Daily =====
// Auto-saves the whole day as daily/<date>.md into calderonator/daily-vault.
// Hooks into the app's existing saveLog(), so every change syncs (debounced).
// Token is fine-grained, stored ONLY in this browser's localStorage.
(function(){
  const OWNER = "calderonator", REPO = "daily-vault", TKEY = "gh_vault_token";
  const getTok = () => localStorage.getItem(TKEY);
  const setTok = t => localStorage.setItem(TKEY, t.trim());
  const b64    = s => btoa(unescape(encodeURIComponent(s)));   // UTF-8 safe

  function dayMarkdown(){
    const log = getLog(), t = DATA.today, n = DATA.nutrition, date = todayStr();
    const tot = log.totals || {};
    const fm = [
      "---", "date: " + date,
      log.bodyweight ? ("bodyweight_kg: " + log.bodyweight) : null,
      "calories: "  + Math.round(tot.calories || 0),
      "protein_g: " + Math.round(tot.protein  || 0),
      "carbs_g: "   + Math.round(tot.carbs    || 0),
      "fat_g: "     + Math.round(tot.fat      || 0),
      "---", ""
    ].filter(x => x !== null).join("\n");

    let out = fm + "# " + date + "\n";
    if (log.felt) out += "\nFeel/energy: " + log.felt + "\n";

    const meals = log.meals || [];
    if (meals.length){
      out += "\n## Meals\n";
      meals.forEach((m, i) => {
        out += `\n### Meal ${i+1} — ${Math.round(m.calories||0)} kcal\n`;
        if (m.items && m.items.length) out += m.items.join(", ") + "\n";
        out += `- Protein: ${Math.round(m.protein||0)} g\n- Carbs: ${Math.round(m.carbs||0)} g\n- Fat: ${Math.round(m.fat||0)} g\n`;
      });
      out += `\n## Totals\n- Calories: ${Math.round(tot.calories||0)}\n- Protein: ${Math.round(tot.protein||0)} g\n- Carbs: ${Math.round(tot.carbs||0)} g\n- Fat: ${Math.round(tot.fat||0)} g\n`;
    }

    const todos = (t?.todos||[]).map(td => `- [${(log.todos?.[td.id] ?? td.done) ? "x":" "}] ${td.text}`);
    if (todos.length) out += "\n## To-dos\n" + todos.join("\n") + "\n";

    const lifts = Object.entries(log.lifts||{}).filter(([,v]) => v && v.trim());
    if (lifts.length) out += "\n## Lifts\n" + lifts.map(([k,v]) => `- ${k}: ${v}`).join("\n") + "\n";

    const habits = (n?.habits||[]).map((h,i) => `- [${log.habits?.[i] ? "x":" "}] ${h}`);
    if (habits.length) out += "\n## Nutrition habits\n" + habits.join("\n") + "\n";

    if (log.food) out += "\n## Food notes\n" + log.food + "\n";
    return out;
  }

  async function push(){
    const tok = getTok();
    if (!tok){ setStatus("connect"); return; }
    const path = `daily/${todayStr()}.md`;
    const url  = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
    const headers = { Authorization: "Bearer " + tok, Accept: "application/vnd.github+json" };
    setStatus("syncing");
    try {
      let sha;
      const head = await fetch(url, { headers });
      if (head.status === 401){ localStorage.removeItem(TKEY); setStatus("connect"); alert("Vault token rejected — tap the chip to reconnect."); return; }
      if (head.ok) sha = (await head.json()).sha;
      const res = await fetch(url, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Update ${path}`, content: b64(dayMarkdown()), ...(sha ? { sha } : {}) })
      });
      if (!res.ok){ setStatus("error"); console.error("vault push failed:", await res.text()); return; }
      setStatus("ok");
    } catch(e){ setStatus("error"); console.error(e); }
  }

  let debT;
  function scheduleSync(){ if (!getTok()) return; clearTimeout(debT); debT = setTimeout(push, 3000); }
  const _saveLog = window.saveLog;
  window.saveLog = function(log){ _saveLog(log); scheduleSync(); };

  let chip;
  function setStatus(s){
    if (!chip) return;
    chip.textContent = { connect:"☁ Connect vault", syncing:"☁ Syncing…", ok:"☁ Synced ✓", error:"⚠ Sync failed — tap to retry" }[s] || "☁ Connect vault";
    chip.dataset.state = s;
  }
  function onChip(){
    if (!getTok()){
      const t = prompt("Paste your GitHub fine-grained token for daily-vault (Contents: Read/Write).\nStored only on this device.");
      if (t && t.trim()){ setTok(t); push(); }
      return;
    }
    push();
  }
  function mountChip(){
    chip = document.createElement("button");
    chip.id = "vault-chip";
    chip.style.cssText = "position:fixed;right:12px;bottom:78px;z-index:999;border:none;border-radius:18px;padding:8px 14px;font-size:13px;font-weight:600;background:#1f2937;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer";
    chip.onclick = onChip;
    document.body.appendChild(chip);
    setStatus(getTok() ? "ok" : "connect");
  }
  if (document.readyState !== "loading") mountChip();
  else document.addEventListener("DOMContentLoaded", mountChip);

  window.Vault = { push, dayMarkdown };
})();
