'use strict';
// 介面：狀態、分頁、控制項與各互動頁面

const G = buildGraph(window.ROADS);
let SIM = simulate(G);
let D = SIM;
let dataVer = 1;

const S = {
  types: [...TYPES], srcs: [...SRCS], sevs: [...SEVS],
  time: 'open', output: 'phys', method: 'C', bw: 150, kern: 'quartic', junction: 'short', djunc: 'cut',
  weightMode: 'none', model: 'sum', W: cloneW(WEIGHT_PRESETS.survey),
  cmpL: 'B', cmpR: 'C',
  scA: { weightMode: 'none', model: 'sum' }, scB: { weightMode: 'survey', model: 'sum' }, scMethod: 'C',
  cand: { win: '3y', minHit: 2, severe: [true, 3], cont: [true, 3], recur: [true, 2], multi: [true, 3], cpl: [true, 2], repair: [false, 3] }
};
const TIME_LABEL = { open: '目前未修復', '1y': '過去一年', '3y': '過去三年', recur: '修復後再發', all: '歷史全部' };
const OUT_LABEL = { phys: '物理損壞分布', svc: '民眾陳情與服務需求分布', renew: '年度更新候選關注程度' };
const OUT_UNIT = { phys: '每個獨立事件計一次', svc: '每筆陳情（非廠商巡查）各計一次', renew: '每個獨立事件計一次，分數整合多種資訊' };
const METHOD_LABEL = { A: 'A 不加權查報分布', B: 'B 加權平面 KDE', C: 'C 道路網絡 KDE', D: 'D 沿道路加權平滑', E: 'E 不平滑事件分布', F: 'F 統計群聚（Gi*）' };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = n => n.toLocaleString('zh-TW');

function curW(mode = S.weightMode) { return mode === 'custom' ? S.W : WEIGHT_PRESETS[mode]; }
function watermark() { return D.kind === 'sim' ? '示意資料：模擬案件，非實際查報｜路網 © OpenStreetMap contributors' : '匯入資料（未經驗證）｜路網 © OpenStreetMap contributors'; }

// ---------- 計算（含快取） ----------
const cache = new Map();
function selection(st) {
  const key = JSON.stringify(['sel', dataVer, st.types, st.srcs, st.sevs, st.time, st.output, st.weightMode, st.model, st.weightMode === 'custom' ? st.W : 0]);
  if (!cache.has(key)) { if (cache.size > 60) cache.clear(); cache.set(key, selectItems(G, D, st, curW(st.weightMode))); }
  return cache.get(key);
}
function computeLayer(st, method) {
  const sel = selection(st);
  const key = JSON.stringify(['lay', dataVer, method, st.bw, st.kern, st.junction, st.djunc, st.types, st.srcs, st.sevs, st.time, st.output, st.weightMode, st.model, st.weightMode === 'custom' ? st.W : 0]);
  if (cache.has(key)) return cache.get(key);
  let L;
  if (method === 'A') L = { points: sel.items.map(it => ({ x: it.x, y: it.y, color: TYPE_COLORS[it.type] })) };
  else if (method === 'B') L = planarKDE(G, sel.items, st.bw, st.kern);
  else if (method === 'C') L = networkKDE(G, sel.items, st.bw, st.kern, st.junction);
  else if (method === 'D') L = alongRoad(G, sel.items, st.bw, st.kern, st.djunc);
  else if (method === 'E') {
    const repSet = new Set(sel.reps);
    L = { pointStyle: 'tick', points: sel.evs.map(ev => ({ x: ev.x, y: ev.y, color: TYPE_COLORS[ev.type], sev: ev.sev, recur: !!ev.recurOf, cpl: ev.reports.filter(r => r.src === '1999陳情' && repSet.has(r)).length })) };
  } else L = giStar(G, sel.items);
  cache.set(key, L); return L;
}
function legendHTML(method, st) {
  const ramp = `<span class="ramp">${RAMP.map(c => `<i style="background:${c}"></i>`).join('')}</span>`;
  if (method === 'A') return TYPES.filter(t => st.types.includes(t)).map(t => `<span><span class="swatch" style="background:${TYPE_COLORS[t]}"></span> ${t}</span>`).join('') + `<span>每點一筆${st.output === 'svc' ? '陳情' : '事件'}</span>`;
  if (method === 'E') return TYPES.filter(t => st.types.includes(t)).map(t => `<span><span class="swatch" style="background:${TYPE_COLORS[t]}"></span> ${t}</span>`).join('') + `<span>點大小＝程度｜黑圈＝有陳情（圈越大越多）｜方框＝修復後再發</span>`;
  if (method === 'F') return `<span><span class="swatch" style="background:#f9a03f"></span> z ≥ 1.65</span><span><span class="swatch" style="background:#c2311f"></span> z ≥ 1.96</span><span><span class="swatch" style="background:#7f1d1d"></span> z ≥ 2.58</span><span>未校正多重檢定、未考慮暴露量，僅示範</span>`;
  return `<span>低 ${ramp} 高</span><span>相對強度（以本圖 99.5 百分位為上限）；不是 PCI，也不是扣分值</span>`;
}

// ---------- 控制項 ----------
function filtersHTML(opts = {}) {
  const cb = (set, v, label, color) => `<label><input type="checkbox" data-set="${set}" value="${v}">${color ? `<span class="swatch" style="background:${color}"></span>` : ''}${label || v}</label>`;
  const rd = (k, v, label) => `<label class="block"><input type="radio" name="${k}-${opts.id}" data-k="${k}" value="${v}">${label}</label>`;
  return `
  ${opts.output !== false ? `<fieldset><legend>輸出目的</legend>${Object.entries(OUT_LABEL).map(([k, v]) => rd('output', k, v)).join('')}<p class="hint" data-hint="output"></p></fieldset>` : ''}
  ${opts.method !== false ? `<fieldset><legend>方法</legend><select data-k="method">${Object.entries(METHOD_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <div class="row"><span>帶寬</span><input type="range" min="50" max="400" step="10" data-k="bw" data-num><span class="val" data-show="bw"></span>m</div>
    <div class="row"><span>核函數</span><select data-k="kern">${Object.entries(KERNELS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
    <div class="row" data-only="C"><span>交叉口</span><select data-k="junction"><option value="short">最短路徑（不分流）</option><option value="split">等分分流</option></select></div>
    <div class="row" data-only="D"><span>路口</span><select data-k="djunc"><option value="cut">遇交叉口截斷</option><option value="cont">沿同名道路延續</option></select></div>
  </fieldset>` : ''}
  <fieldset><legend>損壞類型</legend>${TYPES.map(t => cb('types', t, t, TYPE_COLORS[t])).join('')}</fieldset>
  <fieldset><legend>查報來源</legend>${SRCS.map(t => cb('srcs', t)).join('')}</fieldset>
  <fieldset><legend>損壞程度</legend>${SEVS.map(t => cb('sevs', t)).join('')}</fieldset>
  ${opts.time !== false ? `<fieldset><legend>時間範圍與修復狀態</legend><select data-k="time">${Object.entries(TIME_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <p class="hint">「目前未修復」＝待確認、待處理、處理中、狀態不明。行政結案但沒有修復證據者歸為狀態不明。</p></fieldset>` : ''}
  ${opts.weights !== false ? `<fieldset><legend>權重</legend>
    <div class="row"><span>模式</span><select data-k="weightMode"><option value="none">不加權</option><option value="survey">研究問卷推估（示意值）</option><option value="custom">使用者自訂</option></select></div>
    <div class="row"><span>組合</span><select data-k="model"><option value="sum">加權加總</option><option value="prod">乘積（加權幾何平均）</option><option value="inter">加總＋交互作用</option></select></div>
    <details class="wts"><summary>權重滑桿</summary>${weightsHTML()}</details></fieldset>` : ''}`;
}
function weightsHTML() {
  const sl = (path, label, max = 1) => `<div class="row"><span title="${label}">${label}</span><input type="range" min="0" max="${max}" step="0.05" data-w="${path}"><span class="val" data-wshow="${path}"></span></div>`;
  return `<p class="hint">滑桿顯示「使用者自訂」的數值（初始值同問卷示意值）。移動任一滑桿會自動切換為自訂。</p>
  <div class="muted" style="margin-top:4px">損壞類型</div>${TYPES.map(t => sl('type.' + t, t)).join('')}
  <div class="muted" style="margin-top:4px">損壞程度</div>${SEVS.map(t => sl('sev.' + t, t)).join('')}
  <div class="muted" style="margin-top:4px">來源（陳情分布用）</div>${SRCS.map(t => sl('src.' + t, t)).join('')}
  <div class="muted" style="margin-top:4px">分項重要性</div>
  ${sl('coef.T', '類型')}${sl('coef.S', '程度')}${sl('coef.C', '陳情')}${sl('coef.R', '再發／反覆修補')}
  ${sl('inter', '程度×再發', 1)}
  <p class="hint">物理損壞分布只用類型與程度；年度更新關注程度另加陳情與再發。陳情分布使用來源×類型。</p>`;
}
function getPath(o, p) { return p.split('.').reduce((a, k) => a[k], o); }
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }

function syncControls(root = document) {
  for (const el of $$('[data-set]', root)) el.checked = S[el.dataset.set].includes(el.value);
  for (const el of $$('[data-k]', root)) {
    const v = S[el.dataset.k];
    if (el.type === 'radio') el.checked = el.value === v; else el.value = v;
  }
  for (const el of $$('[data-show]', root)) el.textContent = S[el.dataset.show];
  const W = S.W; // 滑桿一律顯示自訂權重；未選自訂時不套用
  for (const el of $$('[data-w]', root)) el.value = getPath(W, el.dataset.w);
  for (const el of $$('[data-wshow]', root)) el.textContent = (+getPath(W, el.dataset.wshow)).toFixed(2);
  for (const el of $$('[data-only]', root)) el.style.display = S.method === el.dataset.only ? '' : 'none';
  for (const el of $$('[data-hint=output]', root)) el.textContent = '計算單位：' + OUT_UNIT[S.output];
}
function bindControls(root) {
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.set) {
      const arr = S[el.dataset.set];
      if (el.checked && !arr.includes(el.value)) arr.push(el.value);
      if (!el.checked) arr.splice(arr.indexOf(el.value), 1);
    } else if (el.dataset.k) {
      S[el.dataset.k] = el.dataset.num !== undefined ? +el.value : el.value;
    } else if (el.dataset.w) {
      if (S.weightMode !== 'custom') { S.W = cloneW(curW()); S.weightMode = 'custom'; }
      setPath(S.W, el.dataset.w, +el.value);
    } else return;
    changed();
  });
}
let changeTimer = null;
function changed() {
  syncControls();
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => renderActive(), 60);
}

// ---------- 分頁 ----------
const views = {};
let active = null;
function renderActive() { if (active && views[active] && views[active].update) views[active].update(); }
function show(id) {
  if (!PAGES.find(p => p[0] === id)) id = 'goal';
  active = id;
  for (const p of $$('.page')) p.hidden = p.id !== 'pg-' + id;
  for (const a of $$('nav.side a')) a.classList.toggle('on', a.dataset.p === id);
  const v = views[id];
  if (v && !v.inited && v.init) { v.init(); v.inited = true; }
  syncControls();
  renderActive();
  window.scrollTo(0, 0);
}

function buildShell() {
  $('#nav').innerHTML = PAGES.map((p, i) => `<a href="#${p[0]}" data-p="${p[0]}" class="${p[0] === 'contract' ? 'contract-link' : ''}"><b>${i + 1}</b>${p[1]}</a>`).join('') +
    `<div class="navfoot">路網：OpenStreetMap 中山區可行車道路（© OpenStreetMap contributors, ODbL）<br>案件：模擬資料</div>`;
  const statics = { goal: HTML_GOAL, contract: HTML_CONTRACT, data: HTML_DATA, arch: HTML_ARCH(), tree: HTML_TREE(), survey: HTML_SURVEY, plan: HTML_PLAN };
  $('#main').innerHTML = PAGES.map(p => `<section class="page${['map'].includes(p[0]) ? ' wide' : ''}" id="pg-${p[0]}" hidden>${statics[p[0]] || ''}</section>`).join('');
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  $('#btnPrint').onclick = () => window.print();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-export]'); if (!b) return;
    const k = b.dataset.export;
    if (k === 'arch') downloadText('研究架構圖.svg', svgWithStyles($('#archDiagram svg')), 'image/svg+xml');
    if (k === 'contract') downloadCSV('契約對照表.csv', tableRows($('#tblContract')));
    if (k === 'methods') downloadCSV('方法比較表.csv', tableRows($('#tblMethods')));
    if (k === 'rank') downloadCSV('情境排序比較.csv', tableRows($('#tblRank')));
    if (k === 'cand') downloadCSV('年度更新候選範圍_示意.csv', tableRows($('#tblCand')));
  });
}

// ---------- 匯出工具 ----------
function downloadText(name, text, type) {
  const a = document.createElement('a'); a.download = name;
  a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function tableRows(tbl) { return [...tbl.rows].map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim())); }
function downloadCSV(name, rows) {
  const body = rows.map(r => r.map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\r\n');
  downloadText(name, '﻿' + body, 'text/csv');
}
function svgWithStyles(svg) {
  const css = getComputedStyle(document.documentElement);
  let s = new XMLSerializer().serializeToString(svg);
  s = s.replace(/var\(--([a-z0-9-]+)\)/g, (m, v) => css.getPropertyValue('--' + v).trim() || '#000');
  if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + s;
}

// ---------- 7 地圖 ----------
function unitDetailHTML(u, st, opts = {}) {
  const U = G.units[u]; if (!U) return '<p class="muted">點選地圖上的道路，查看該路段（約 150 m）的事件與案件。</p>';
  const sel = selection(st); const inSel = new Set(sel.evs.map(e => e.id));
  const evs = D.events.filter(e => G.edges[e.e].unit === u).sort((a, b) => b.date - a.date);
  const nRep = evs.reduce((s, e) => s + e.reports.length, 0), nCpl = evs.reduce((s, e) => s + e.reports.filter(r => r.src === '1999陳情').length, 0);
  const pill = s => `<span class="statuspill ${OPEN_STATUS.has(s) ? 'open' : s === '已確認修復' ? 'fixed' : ''}">${s}</span>`;
  return `<h4 style="margin:0">${esc(U.name)}</h4>
  <div class="muted">路段單元 #${u}｜${CLS_NAME[U.cls]}｜長 ${Math.round(U.len)} m</div>
  <p style="margin:6px 0">歷史全部：事件 <b>${evs.length}</b>｜案件 <b>${nRep}</b>｜陳情 <b>${nCpl}</b><br><small class="muted">淡色＝不在目前篩選條件內</small></p>
  ${evs.slice(0, 60).map(ev => {
    const bySrc = {}; for (const r of ev.reports) bySrc[r.src] = (bySrc[r.src] || 0) + 1;
    return `<div class="ev ${inSel.has(ev.id) ? '' : 'dim'}">
      <div><span class="swatch" style="background:${TYPE_COLORS[ev.type]}"></span> <b>${ev.type}</b>｜${ev.sev}｜${pill(ev.status)}</div>
      <div class="muted">${ev.id}｜首次 ${fmtDate(ev.date)}${ev.recurOf ? `｜再發自 ${ev.recurOf}` : ''}${ev.recurredBy ? `｜後續再發 ${ev.recurredBy}` : ''}</div>
      <div>案件：${Object.entries(bySrc).map(([k, v]) => `${k} ${v}`).join('、')}</div>
      ${opts.history ? `<div class="muted">${[...ev.reports.map(r => [r.date, `查報（${r.src}）`]), ...ev.repairs.map(r => [r.date, `${r.method}${r.verified ? '（有修復證據）' : '（無修復證據）'}`])].sort((a, b) => a[0] - b[0]).map(x => `${fmtDate(x[0])} ${x[1]}`).join('<br>')}</div>` : ''}
      ${ev.repairs.length && !opts.history ? `<div class="muted">修復紀錄 ${ev.repairs.length} 筆${ev.repairs.some(r => !r.verified) ? '（含無證據者）' : ''}</div>` : ''}
    </div>`; }).join('')}
  ${evs.length > 60 ? `<p class="muted">僅列最近 60 筆</p>` : ''}
  <p class="hint">照片：${D.kind === 'sim' ? '示意資料無照片；實際資料以案件詳情網址連結。' : '依匯入資料的照片網址欄位。'}</p>`;
}

views.map = {
  init() {
    const pg = $('#pg-map');
    pg.innerHTML = `<h2 style="margin-bottom:8px">7 互動式查報地圖</h2>
    <div class="mappage">
      <aside class="ctrl" id="mapCtrl">${filtersHTML({ id: 'm' })}</aside>
      <section class="mapwrap">
        <div class="counters">
          <div><small>案件數</small><b id="cRep">0</b></div>
          <div><small>獨立損壞事件數</small><b id="cEv">0</b></div>
          <div><small>民眾陳情數</small><b id="cCpl">0</b></div>
          <div><small>本圖計算單位</small><div id="cUnit" style="font-size:.82rem;line-height:1.3"></div></div>
        </div>
        <div class="mapbar"><b id="mapTitle"></b><span style="flex:1"></span><button id="mapFit">全區</button><button id="mapPng">匯出 PNG</button></div>
        <div id="map7"></div>
        <div class="maplegend" id="mapLegend"></div>
      </section>
      <aside class="detail" id="mapDetail"></aside>
    </div>`;
    bindControls($('#mapCtrl'));
    this.sel = null;
    this.mv = new MapView($('#map7'), G, { watermark, onClick: ([x, y], mv) => { this.sel = mv.pickUnit(x, y); mv.sel = this.sel; mv.draw(); this.detail(); } });
    $('#mapFit').onclick = () => this.mv.fit();
    $('#mapPng').onclick = () => this.mv.exportPNG(`查報地圖_${METHOD_LABEL[S.method]}_${OUT_LABEL[S.output]}`);
  },
  detail() { $('#mapDetail').innerHTML = unitDetailHTML(this.sel, S); },
  update() {
    const sel = selection(S);
    $('#cRep').textContent = fmtN(sel.counts.reports); $('#cEv').textContent = fmtN(sel.counts.events); $('#cCpl').textContent = fmtN(sel.counts.complaints);
    $('#cUnit').textContent = OUT_UNIT[S.output] + `（${fmtN(sel.counts.items)}）`;
    $('#mapTitle').textContent = `${OUT_LABEL[S.output]}｜${METHOD_LABEL[S.method]}｜${TIME_LABEL[S.time]}｜${S.weightMode === 'none' ? '不加權' : S.weightMode === 'survey' ? '問卷推估（示意值）' : '自訂權重'}`;
    this.mv.setLayer(computeLayer(S, S.method));
    $('#mapLegend').innerHTML = legendHTML(S.method, S);
    this.detail();
  }
};

// ---------- 8 方法比較 ----------
views.methods = {
  init() {
    const opt = k => Object.entries(METHOD_LABEL).map(([m, v]) => `<option value="${m}" ${m === S[k] ? 'selected' : ''}>${v}</option>`).join('');
    $('#pg-methods').innerHTML = `<h2>8 KDE、NKDE 及其他方法比較</h2>
    <p class="lead">同一份資料、同一組篩選條件，左右並排比較。兩張圖的視野同步移動。篩選條件與帶寬沿用分頁 7 的設定。</p>
    <div class="ctrl" style="margin-bottom:10px" id="cmpCtrl">
      <div class="row" style="flex-wrap:wrap;gap:14px"><span style="width:auto">輸出</span>${Object.entries(OUT_LABEL).map(([k, v]) => `<label><input type="radio" name="output-c" data-k="output" value="${k}">${v}</label>`).join('')}
      <span style="width:auto;margin-left:10px">帶寬</span><input type="range" min="50" max="400" step="10" data-k="bw" data-num style="max-width:180px"><span class="val" data-show="bw"></span>m
      <span style="width:auto;margin-left:10px">NKDE 交叉口</span><select data-k="junction"><option value="short">最短路徑（不分流）</option><option value="split">等分分流</option></select>
      <span style="width:auto">D 路口</span><select data-k="djunc"><option value="cut">截斷</option><option value="cont">延續</option></select></div>
    </div>
    <div class="twomaps">
      <section class="mapwrap"><div class="mapbar">左圖 <select id="cmpL">${opt('cmpL')}</select><span style="flex:1"></span><button id="pngL">PNG</button></div><div id="mapL"></div><div class="maplegend" id="legL"></div></section>
      <section class="mapwrap"><div class="mapbar">右圖 <select id="cmpR">${opt('cmpR')}</select><span style="flex:1"></span><button id="pngR">PNG</button></div><div id="mapR"></div><div class="maplegend" id="legR"></div></section>
    </div>
    <div class="callout info">觀察重點：平面 KDE 的熱區會延伸到平行的相鄰道路與街廓內部；NKDE 只沿路網擴散；沿道路平滑在「截斷」模式下不跨越交叉口；Gi* 的結果取決於分析單位與鄰接定義。</div>
    <h3>方法比較表</h3>${methodTableHTML()}
    <p class="hint">比較表只描述特性，不打總分、不排名。最終採用哪種方法，或多種方法並列，待資料與驗證結果討論。</p>
    <p class="noprint"><button data-export="methods">匯出比較表 CSV</button></p>`;
    bindControls($('#cmpCtrl'));
    let lock = false;
    const sync = (a, b) => mv => { if (lock) return; lock = true; b().syncFrom(mv); lock = false; };
    this.L = new MapView($('#mapL'), G, { watermark, onView: sync(0, () => this.R) });
    this.R = new MapView($('#mapR'), G, { watermark, onView: sync(0, () => this.L) });
    $('#cmpL').onchange = e => { S.cmpL = e.target.value; this.update(); };
    $('#cmpR').onchange = e => { S.cmpR = e.target.value; this.update(); };
    $('#pngL').onclick = () => this.L.exportPNG('方法比較_' + METHOD_LABEL[S.cmpL]);
    $('#pngR').onclick = () => this.R.exportPNG('方法比較_' + METHOD_LABEL[S.cmpR]);
  },
  update() {
    this.L.title = METHOD_LABEL[S.cmpL]; this.R.title = METHOD_LABEL[S.cmpR];
    this.L.setLayer(computeLayer(S, S.cmpL)); this.R.setLayer(computeLayer(S, S.cmpR));
    $('#legL').innerHTML = legendHTML(S.cmpL, S); $('#legR').innerHTML = legendHTML(S.cmpR, S);
  }
};

// ---------- 9 權重與情境 ----------
views.weights = {
  init() {
    const scCtl = k => `<select data-sc="${k}.weightMode"><option value="none">不加權</option><option value="survey">問卷推估（示意值）</option><option value="custom">使用者自訂</option></select>
      <select data-sc="${k}.model"><option value="sum">加權加總</option><option value="prod">乘積</option><option value="inter">加總＋交互作用</option></select>`;
    $('#pg-weights').innerHTML = `<h2>9 權重調整與不同情境比較</h2>
    <p class="lead">權重只代表其定義下的評價目的。這裡比較不同權重組合會讓哪些路段的排序改變，不代表任何一組權重是正確的。</p>
    <div class="callout">「研究問卷推估」目前沒有問卷結果 ${TAG.none}，選用時套用的是示意值。</div>
    <div class="grid2" style="grid-template-columns:320px 1fr">
      <aside class="ctrl" id="wCtrl">
        <fieldset><legend>輸出目的</legend>${Object.entries(OUT_LABEL).map(([k, v]) => `<label class="block"><input type="radio" name="output-w" data-k="output" value="${k}">${v}</label>`).join('')}</fieldset>
        <fieldset><legend>自訂權重（情境選「使用者自訂」時套用）</legend>${weightsHTML()}</fieldset>
      </aside>
      <div>
        <div class="ctrl" id="scCtrl" style="margin-bottom:10px">
          <div class="row" style="flex-wrap:wrap;gap:8px"><b>情境 A</b>${scCtl('scA')}<span style="width:1em"></span><b>情境 B</b>${scCtl('scB')}
          <span style="width:1em"></span>地圖方法 <select data-scm><option value="C">C 道路網絡 KDE</option><option value="B">B 平面 KDE</option><option value="D">D 沿道路平滑</option><option value="A">A 不加權分布</option></select></div>
        </div>
        <div class="twomaps">
          <section class="mapwrap" style="height:400px"><div class="mapbar"><b>情境 A</b><span id="scAlab" class="muted"></span></div><div id="mapA"></div></section>
          <section class="mapwrap" style="height:400px"><div class="mapbar"><b>情境 B</b><span id="scBlab" class="muted"></span></div><div id="mapB"></div></section>
        </div>
        <h3>路段排序比較（路段單元加權總和，未平滑）</h3>
        <p id="rho" class="muted"></p>
        <div class="tablewrap"><table class="t" id="tblRank"></table></div>
        <p class="noprint"><button data-export="rank">匯出排序比較 CSV</button></p>
        <h3>敏感度：以情境 B 為基準，單一分項重要性變動 ±50%</h3>
        <div class="tablewrap"><table class="t" id="tblSens"></table></div>
        <p class="hint">前 20 名重疊數越低，表示排序對這個分項越敏感。情境 B 若為「不加權」，敏感度分析改以示意問卷權重為基準。</p>
      </div>
    </div>`;
    bindControls($('#wCtrl'));
    $('#scCtrl').addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.sc) { const [k, f] = el.dataset.sc.split('.'); S[k][f] = el.value; }
      if (el.dataset.scm !== undefined) S.scMethod = el.value;
      this.update();
    });
    let lock = false;
    this.A = new MapView($('#mapA'), G, { watermark, onView: mv => { if (lock) return; lock = true; this.B.syncFrom(mv); lock = false; } });
    this.B = new MapView($('#mapB'), G, { watermark, onView: mv => { if (lock) return; lock = true; this.A.syncFrom(mv); lock = false; } });
  },
  stFor(sc) { return Object.assign({}, S, { weightMode: sc.weightMode, model: sc.model }); },
  update() {
    for (const el of $$('[data-sc]')) { const [k, f] = el.dataset.sc.split('.'); el.value = S[k][f]; }
    $('[data-scm]').value = S.scMethod;
    const stA = this.stFor(S.scA), stB = this.stFor(S.scB);
    const lab = sc => `｜${sc.weightMode === 'none' ? '不加權' : sc.weightMode === 'survey' ? '問卷推估（示意）' : '自訂'}｜${{ sum: '加權加總', prod: '乘積', inter: '加總＋交互作用' }[sc.model]}`;
    $('#scAlab').textContent = lab(S.scA); $('#scBlab').textContent = lab(S.scB);
    this.A.setLayer(computeLayer(stA, S.scMethod)); this.B.setLayer(computeLayer(stB, S.scMethod));
    const a = unitScores(G, selection(stA).items), b = unitScores(G, selection(stB).items);
    const top = (v, n) => [...v.keys()].filter(i => v[i] > 0).sort((p, q) => v[q] - v[p]).slice(0, n);
    const rk = v => { const o = top(v, Infinity); const m = new Map(); o.forEach((u, i) => m.set(u, i + 1)); return m; };
    const ra = rk(a), rb = rk(b);
    const ta = top(a, 15), tb = top(b, 15);
    const units = [...new Set([...ta, ...tb])].sort((p, q) => (ra.get(p) || 1e9) - (ra.get(q) || 1e9));
    const rho = spearman(a, b);
    const ov = ta.filter(u => tb.includes(u)).length;
    $('#rho').textContent = `有分數的路段單元排序相關（Spearman）＝ ${isNaN(rho) ? '—' : rho.toFixed(3)}；前 15 名重疊 ${ov} 個。`;
    $('#tblRank').innerHTML = `<tr><th>路段單元</th><th>道路</th><th class="num">情境 A 名次</th><th class="num">情境 B 名次</th><th class="num">名次變化</th></tr>` +
      units.map(u => { const x = ra.get(u), y = rb.get(u); const d = x && y ? x - y : null;
        return `<tr><td>#${u}</td><td>${esc(G.units[u].name)}</td><td class="num">${x ?? '—'}</td><td class="num">${y ?? '—'}</td><td class="num" style="color:${d > 0 ? 'var(--have)' : d < 0 ? 'var(--warn)' : ''}">${d == null ? '—' : d > 0 ? '↑' + d : d < 0 ? '↓' + (-d) : '0'}</td></tr>`; }).join('');
    // 敏感度
    const baseSc = S.scB.weightMode === 'none' ? { weightMode: 'survey', model: S.scB.model } : S.scB;
    const baseW = cloneW(curW(baseSc.weightMode));
    const keys = S.output === 'renew' ? ['T', 'S', 'C', 'R'] : S.output === 'phys' ? ['T', 'S'] : [];
    const kname = { T: '類型', S: '程度', C: '陳情', R: '再發／反覆修補' };
    const st0 = Object.assign({}, S, { weightMode: 'custom', model: baseSc.model, W: baseW });
    const base = unitScores(G, selectItems(G, D, st0, baseW).items), btop = top(base, 20);
    const rows = [];
    for (const k of keys) for (const f of [0.5, 1.5]) {
      const W2 = cloneW(baseW); W2.coef[k] = Math.min(1.5, W2.coef[k] * f);
      const v = unitScores(G, selectItems(G, D, Object.assign({}, st0, { W: W2 }), W2).items);
      rows.push([kname[k] + (f < 1 ? ' −50%' : ' +50%'), btop.filter(u => top(v, 20).includes(u)).length, spearman(base, v)]);
    }
    for (const m of ['sum', 'prod', 'inter'].filter(m => m !== baseSc.model)) {
      const v = unitScores(G, selectItems(G, D, Object.assign({}, st0, { model: m }), baseW).items);
      rows.push(['組合模型改為' + { sum: '加權加總', prod: '乘積', inter: '加總＋交互作用' }[m], btop.filter(u => top(v, 20).includes(u)).length, spearman(base, v)]);
    }
    $('#tblSens').innerHTML = `<tr><th>變動</th><th class="num">前 20 名重疊</th><th class="num">排序相關</th></tr>` +
      (rows.length ? rows.map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]} / 20</td><td class="num">${isNaN(r[2]) ? '—' : r[2].toFixed(3)}</td></tr>`).join('') : `<tr><td colspan="3" class="muted">陳情分布的權重只有來源與類型，請改用其他輸出目的查看分項敏感度。</td></tr>`);
  }
};

// ---------- 10 修復時間軸 ----------
views.timeline = {
  init() {
    $('#pg-timeline').innerHTML = `<h2>10 修復狀態與歷史時間軸</h2>
    <p class="lead">原始案件與損壞事件分開管理。已確認修復的事件可從「目前未修復」排除，但案件、陳情與修復紀錄都保留。</p>
    <div class="seg noprint" id="tlBtns" style="margin-bottom:10px">${Object.entries(TIME_LABEL).map(([k, v]) => `<button data-t="${k}">${v}</button>`).join('')}</div>
    <div class="chart" id="tlChart"></div>
    <p class="hint">長條為每月案件數（依來源堆疊），線為每月有修復證據的修復紀錄數。篩選條件（類型、來源、程度）沿用分頁 7。</p>
    <div class="grid2" style="grid-template-columns:1fr 340px;margin-top:10px">
      <section class="mapwrap" style="height:520px"><div class="mapbar"><b id="tlTitle"></b></div><div id="mapT"></div>
        <div class="maplegend"><span><span class="swatch" style="background:#c2311f"></span> 未修復</span><span><span class="swatch" style="background:#2f7d4a"></span> 已確認修復</span><span><span class="swatch" style="background:#9aa0a6"></span> 無須修復／權責移轉</span><span><span class="swatch" style="background:#7c3aed"></span> 修復後再發</span></div></section>
      <aside class="detail" id="tlDetail" style="max-height:520px"></aside>
    </div>
    <h3>案件狀態定義</h3>
    <table class="t"><tr><th>狀態</th><th>說明</th><th>列入「目前未修復」</th></tr>
      <tr><td>待確認</td><td>已查報，尚未確認損壞是否存在或屬於哪一事件</td><td>是</td></tr>
      <tr><td>待處理</td><td>已確認，尚未派工</td><td>是</td></tr>
      <tr><td>處理中</td><td>已派工或施工中</td><td>是</td></tr>
      <tr><td>已確認修復</td><td>有修復證據（工作單、施工照片或現場確認）</td><td>否</td></tr>
      <tr><td>無須修復</td><td>經確認不需處理</td><td>否</td></tr>
      <tr><td>權責移轉</td><td>屬其他單位權責（例如部分人手孔）</td><td>否</td></tr>
      <tr><td>狀態不明</td><td>行政上已結案但沒有修復證據，或資料不足</td><td>是</td></tr></table>`;
    $('#tlBtns').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; S.time = b.dataset.t; changed(); });
    this.sel = null;
    this.mv = new MapView($('#mapT'), G, { watermark, onClick: ([x, y], mv) => { this.sel = mv.pickUnit(x, y); mv.sel = this.sel; mv.draw(); $('#tlDetail').innerHTML = unitDetailHTML(this.sel, S, { history: true }); } });
  },
  update() {
    for (const b of $$('#tlBtns button')) b.classList.toggle('on', b.dataset.t === S.time);
    // 每月統計
    const m0 = DAY(2022, 1, 1); const months = [];
    for (let y = 2022; y <= 2026; y++) for (let m = 1; m <= 12; m++) { if (y === 2026 && m > 10) break; months.push([y, m]); }
    const mi = d => { const t = new Date(d * 864e5); return (t.getUTCFullYear() - 2022) * 12 + t.getUTCMonth(); };
    const cnt = months.map(() => ({ v: 0, c: 0, o: 0, r: 0 }));
    const tSet = new Set(S.types), sSet = new Set(S.srcs), vSet = new Set(S.sevs);
    for (const ev of D.events) {
      if (!tSet.has(ev.type) || !vSet.has(ev.sev)) continue;
      for (const r of ev.reports) { if (!sSet.has(r.src)) continue; const i = mi(r.date); if (!cnt[i]) continue; if (r.src === '廠商巡查') cnt[i].v++; else if (r.src === '1999陳情') cnt[i].c++; else cnt[i].o++; }
      for (const r of ev.repairs) { if (!r.verified) continue; const i = mi(r.date); if (cnt[i]) cnt[i].r++; }
    }
    const W = 1100, H = 240, pl = 44, pb = 28, pt = 12, bw = (W - pl - 10) / months.length;
    const mx = Math.max(1, ...cnt.map(c => Math.max(c.v + c.c + c.o, c.r)));
    const yy = v => pt + (H - pt - pb) * (1 - v / mx);
    const winStart = S.time === '1y' ? TODAY - 365 : S.time === '3y' ? TODAY - 1095 : null;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每月案件數與修復數">`;
    if (winStart) { const x = pl + mi(winStart) * bw; svg += `<rect x="${x}" y="${pt}" width="${W - 10 - x}" height="${H - pt - pb}" fill="var(--accent-soft)"/>`; }
    for (let k = 0; k <= 4; k++) { const v = Math.round(mx * k / 4); svg += `<line x1="${pl}" x2="${W - 10}" y1="${yy(v)}" y2="${yy(v)}" stroke="var(--soft)"/><text x="${pl - 6}" y="${yy(v) + 4}" font-size="11" text-anchor="end" fill="var(--ink2)">${v}</text>`; }
    cnt.forEach((c, i) => {
      const x = pl + i * bw + 1, w = bw - 2; let base = 0;
      for (const [val, col] of [[c.v, '#8fa9bf'], [c.c, '#e8642c'], [c.o, '#b9b4a8']]) { if (!val) continue; svg += `<rect x="${x}" y="${yy(base + val)}" width="${w}" height="${yy(base) - yy(base + val)}" fill="${col}"><title>${months[i][0]}-${months[i][1]}：${val}</title></rect>`; base += val; }
      if (months[i][1] === 1) svg += `<text x="${x}" y="${H - 10}" font-size="11" fill="var(--ink2)">${months[i][0]}</text>`;
    });
    svg += `<polyline fill="none" stroke="#2f7d4a" stroke-width="2" points="${cnt.map((c, i) => `${pl + i * bw + bw / 2},${yy(c.r)}`).join(' ')}"/>`;
    svg += `<g font-size="12" fill="var(--ink)"><rect x="${pl + 10}" y="${pt + 4}" width="10" height="10" fill="#8fa9bf"/><text x="${pl + 24}" y="${pt + 13}">廠商巡查</text><rect x="${pl + 94}" y="${pt + 4}" width="10" height="10" fill="#e8642c"/><text x="${pl + 108}" y="${pt + 13}">1999 陳情</text><rect x="${pl + 186}" y="${pt + 4}" width="10" height="10" fill="#b9b4a8"/><text x="${pl + 200}" y="${pt + 13}">其他來源</text><line x1="${pl + 262}" x2="${pl + 282}" y1="${pt + 9}" y2="${pt + 9}" stroke="#2f7d4a" stroke-width="2"/><text x="${pl + 288}" y="${pt + 13}">有證據的修復</text></g></svg>`;
    $('#tlChart').innerHTML = svg;
    const sel = selection(S);
    const colOf = ev => ev.recurOf ? '#7c3aed' : OPEN_STATUS.has(ev.status) ? '#c2311f' : ev.status === '已確認修復' ? '#2f7d4a' : '#9aa0a6';
    this.mv.setLayer({ points: sel.evs.map(ev => ({ x: ev.x, y: ev.y, color: colOf(ev) })) });
    $('#tlTitle').textContent = `${TIME_LABEL[S.time]}｜獨立事件 ${fmtN(sel.counts.events)}｜案件 ${fmtN(sel.counts.reports)}｜陳情 ${fmtN(sel.counts.complaints)}`;
    $('#tlDetail').innerHTML = this.sel == null ? '<p class="muted">點選地圖上的道路，查看該路段每個事件的查報、修復與再發紀錄。</p>' : unitDetailHTML(this.sel, S, { history: true });
  }
};

// ---------- 11 年度更新候選 ----------
const CRIT = [
  ['severe', '高度集中的嚴重損壞', '單元內「重」程度事件數 ≥', '件'],
  ['cont', '沿道路連續分布的損壞', '同名道路相連且皆有 ≥2 件事件的單元數 ≥', '個'],
  ['recur', '同位置反覆損壞', '修復後再發事件數 ≥', '件'],
  ['multi', '多種類型損壞共同出現', '損壞類型數 ≥', '種'],
  ['cpl', '民眾陳情長期集中', '有陳情的年份數 ≥', '年'],
  ['repair', '局部修復頻繁', '修復紀錄筆數 ≥', '筆']
];
function renewMetrics(win) {
  const n = G.units.length;
  const M = Array.from({ length: n }, () => ({ ev: 0, severe: 0, types: new Set(), recur: 0, cplY: new Set(), repair: 0 }));
  for (const ev of D.events) {
    if (ev.date < win) continue;
    const m = M[G.edges[ev.e].unit];
    m.ev++; if (ev.sev === '重') m.severe++; m.types.add(ev.type); if (ev.recurOf) m.recur++;
    for (const r of ev.reports) if (r.src === '1999陳情' && r.date >= win) m.cplY.add(yearOf(r.date));
    for (const r of ev.repairs) if (r.date >= win) m.repair++;
  }
  // 連續性：同名且相鄰、事件數 ≥2 的單元串
  const flag = M.map(m => m.ev >= 2), comp = new Int32Array(n).fill(-1), size = [];
  for (let i = 0; i < n; i++) {
    if (!flag[i] || comp[i] >= 0) continue;
    const c = size.length; let cnt = 0; const st = [i]; comp[i] = c;
    while (st.length) { const u = st.pop(); cnt++; for (const v of G.units[u].nb) if (flag[v] && comp[v] < 0 && G.units[v].name === G.units[u].name) { comp[v] = c; st.push(v); } }
    size.push(cnt);
  }
  M.forEach((m, i) => { m.cont = comp[i] >= 0 ? size[comp[i]] : 0; m.multi = m.types.size; m.cpl = m.cplY.size; });
  return M;
}
views.renew = {
  init() {
    const c = S.cand;
    $('#pg-renew').innerHTML = `<h2>11 年度道路更新候選範圍示意</h2>
    <p class="lead">依勾選的條件找出候選路段，再把相鄰的同名候選路段合併成候選範圍。這是提出候選，不是判定必須全面刨鋪。</p>
    <div class="callout">候選範圍須再對照道路現況、修復紀錄、工程可行性與更新範圍，經現場複查後才形成年度更新候選清單。門檻數值為示範用，尚未經討論。</div>
    <div class="grid2" style="grid-template-columns:330px 1fr">
      <aside class="ctrl" id="rCtrl">
        <fieldset><legend>資料期間</legend><select id="rWin"><option value="1y">過去一年</option><option value="3y">過去三年</option><option value="all">歷史全部</option></select></fieldset>
        <fieldset><legend>候選條件</legend>
          ${CRIT.map(([k, name, rule, u]) => `<label class="block"><input type="checkbox" data-c="${k}" ${c[k][0] ? 'checked' : ''}><b>${name}</b></label>
            <div class="row" style="padding-left:20px"><span style="width:auto" class="muted">${rule}</span><input type="number" min="1" max="20" value="${c[k][1]}" data-cv="${k}" style="width:4em">${u}</div>`).join('')}
          <label class="block" style="opacity:.6"><input type="checkbox" disabled><b>與歷史 PCI 變化一致或不一致</b></label>
          <p class="hint" style="padding-left:20px">需接入歷史 PCI 資料 ${TAG.pend}</p>
        </fieldset>
        <fieldset><legend>判定</legend><div class="row"><span style="width:auto">至少符合</span><input type="number" min="1" max="6" id="rMin" value="${c.minHit}" style="width:4em">項</div></fieldset>
      </aside>
      <div>
        <section class="mapwrap" style="height:480px"><div class="mapbar"><b id="rTitle"></b><span style="flex:1"></span><button id="rPng">匯出 PNG</button></div><div id="mapRn"></div>
          <div class="maplegend"><span><span class="swatch" style="background:#f9a03f"></span> 剛好達到「至少符合」項數</span><span><span class="swatch" style="background:#c2311f"></span> 多符合 1 項</span><span><span class="swatch" style="background:#7f1d1d"></span> 多符合 2 項以上</span><span>灰點＝期間內事件</span></div></section>
      </div>
    </div>
    <h3>候選範圍（同名相鄰路段合併）</h3>
    <div class="tablewrap"><table class="t" id="tblCand"></table></div>
    <p class="hint">面積與工程數量需在範圍確定後，以市府道路面資料的寬度與工程範圍估算 ${TAG.pend}；這裡不先切 PCI 調查單元。</p>
    <p class="noprint"><button data-export="cand">匯出候選範圍 CSV</button></p>`;
    $('#rWin').value = c.win;
    $('#rCtrl').addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.c) c[el.dataset.c][0] = el.checked;
      if (el.dataset.cv) c[el.dataset.cv][1] = Math.max(1, +el.value || 1);
      if (el.id === 'rWin') c.win = el.value;
      if (el.id === 'rMin') c.minHit = Math.max(1, +el.value || 1);
      this.update();
    });
    this.sel = null;
    this.mv = new MapView($('#mapRn'), G, { watermark, onClick: ([x, y], mv) => { this.sel = mv.pickUnit(x, y); mv.sel = this.sel; mv.draw(); } });
    $('#rPng').onclick = () => this.mv.exportPNG('年度更新候選範圍_示意');
  },
  update() {
    const c = S.cand;
    const win = c.win === '1y' ? TODAY - 365 : c.win === '3y' ? TODAY - 1095 : -Infinity;
    const M = renewMetrics(win);
    const on = CRIT.filter(([k]) => c[k][0]);
    const hits = M.map(m => on.filter(([k]) => m[k] >= c[k][1]).map(([k]) => k));
    const cand = []; hits.forEach((h, u) => { if (h.length >= c.minHit && h.length) cand.push(u); });
    const extra = h => h.length - c.minHit;
    const colOf = h => extra(h) >= 2 ? '#7f1d1d' : extra(h) === 1 ? '#c2311f' : '#f9a03f';
    // 合併為範圍
    const cs = new Set(cand), seen = new Set(), ranges = [];
    for (const u of cand) {
      if (seen.has(u)) continue;
      const st = [u], grp = []; seen.add(u);
      while (st.length) { const x = st.pop(); grp.push(x); for (const v of G.units[x].nb) if (cs.has(v) && !seen.has(v) && G.units[v].name === G.units[x].name) { seen.add(v); st.push(v); } }
      const crit = new Set(grp.flatMap(x => hits[x]));
      ranges.push({ name: G.units[u].name, units: grp, len: grp.reduce((s, x) => s + G.units[x].len, 0), crit, ev: grp.reduce((s, x) => s + M[x].ev, 0), severe: grp.reduce((s, x) => s + M[x].severe, 0), maxHit: Math.max(...grp.map(x => hits[x].length)) });
    }
    ranges.sort((a, b) => b.maxHit - a.maxHit || b.crit.size - a.crit.size || b.len - a.len);
    const pts = D.events.filter(e => e.date >= win).map(e => ({ x: e.x, y: e.y, color: 'rgba(90,90,90,.35)' }));
    this.mv.setLayer({ kind: 'units', units: cand.map(u => [u, colOf(hits[u])]), points: pts });
    $('#rTitle').textContent = `候選路段單元 ${cand.length} 個，合併為 ${ranges.length} 個範圍，總長約 ${(ranges.reduce((s, r) => s + r.len, 0) / 1000).toFixed(2)} km`;
    const cname = Object.fromEntries(CRIT.map(x => [x[0], x[1]]));
    $('#tblCand').innerHTML = `<tr><th>#</th><th>道路</th><th class="num">單元數</th><th class="num">長度 (m)</th><th class="num">期間內事件</th><th class="num">重度事件</th><th>符合條件</th><th>寬度／面積</th></tr>` +
      (ranges.length ? ranges.slice(0, 80).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="num">${r.units.length}</td><td class="num">${Math.round(r.len)}</td><td class="num">${r.ev}</td><td class="num">${r.severe}</td><td>${[...r.crit].map(k => cname[k]).join('、')}</td><td class="muted">待接寬度資料</td></tr>`).join('')
        : `<tr><td colspan="8" class="muted">沒有符合條件的路段，請放寬門檻或減少「至少符合」項數。</td></tr>`);
  }
};

// ---------- 5 決策樹 ----------
views.tree = {
  init() { this.path = []; this.sev = null; this.render(); },
  render() {
    let node = TREE, crumbs = [];
    for (const i of this.path) { const o = node.o[i]; crumbs.push(o.a); if (o.next) node = o.next; else { node = o; break; } }
    const el = $('#stepper');
    for (const li of $$('#treeOutline li')) li.classList.remove('hit');
    for (let k = 1; k <= this.path.length; k++) { const li = document.getElementById('tn-' + this.path.slice(0, k).join('-')); if (li) li.classList.add('hit'); }
    const pathHTML = `<div class="path">${crumbs.length ? crumbs.map(esc).join(' → ') : '開始'}</div>`;
    if (node.leaf) {
      const sevStep = !node.nosev;
      el.innerHTML = `${pathHTML}<h3 style="margin-top:0">判讀結果：${node.leaf}</h3>${node.note ? `<p class="muted">${node.note}</p>` : ''}
        ${sevStep ? `<p><b>程度判斷</b>：依 ASTM D6433 對「${node.leaf}」的輕、中、重定義判讀。各類型的判定門檻將由教材與標準原文填入，這裡不列數值。</p>
        <div class="seg">${['輕', '中', '重', '無法判定'].map(s => `<button data-sev="${s}" class="${this.sev === s ? 'on' : ''}">${s}</button>`).join('')}</div>` : ''}
        ${this.sev ? `<p style="margin-top:10px">紀錄：<b>${node.leaf}</b>｜程度 <b>${this.sev}</b>${this.sev === '無法判定' ? '（列入現場確認）' : ''}</p>` : ''}
        <p style="margin-top:12px"><button data-back>上一步</button> <button data-reset>重新開始</button></p>`;
    } else {
      el.innerHTML = `${pathHTML}<h3 style="margin-top:0">${node.q}</h3><div class="opts">${node.o.map((o, i) => `<button data-i="${i}">${o.a}</button>`).join('')}</div>
        ${this.path.length ? `<p style="margin-top:12px"><button data-back>上一步</button> <button data-reset>重新開始</button></p>` : ''}`;
    }
    el.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.i !== undefined) { this.path.push(+b.dataset.i); this.sev = null; }
      else if (b.dataset.sev) this.sev = b.dataset.sev;
      else if (b.dataset.back !== undefined) { this.path.pop(); this.sev = null; }
      else if (b.dataset.reset !== undefined) { this.path = []; this.sev = null; }
      this.render();
    };
  }
};

// ---------- 6 問卷 ----------
views.survey = {
  init() {
    this.q1 = 1; this.aid = true; this.s2q = 'phys'; this.logs = { phys: [], check: [], renew: [] }; this.card = null; this.bwsN = 0; this.bwsCnt = {};
    this.renderS1(); this.renderS2(); this.renderBWS();
  },
  renderS1() {
    $('#s1no').textContent = this.q1;
    $('#s1form').innerHTML = `<h4>第 ${this.q1} 題</h4>
      <div class="row"><span style="width:6em">決策樹輔助</span><div class="seg"><button data-aid="0" class="${!this.aid ? 'on' : ''}">無</button><button data-aid="1" class="${this.aid ? 'on' : ''}">有</button></div></div>
      ${this.aid ? `<p class="hint">有輔助時，受訪者可依分頁 5 的流程逐題判讀。</p>` : `<p class="hint">無輔助時，受訪者只看照片直接判斷。</p>`}
      <div class="row"><span style="width:6em">損壞類型</span><select id="s1t"><option value="">請選擇</option>${['坑洞', '龜裂', '縱橫向裂縫', '塊狀裂縫', '車轍', '人手孔缺失', '補綻及管線回填', '薄層剝離', '其他'].map(t => `<option>${t}</option>`).join('')}</select></div>
      <div class="row"><span style="width:6em">損壞程度</span><select id="s1s"><option value="">請選擇</option><option>輕</option><option>中</option><option>重</option></select></div>
      <label class="block"><input type="checkbox" id="s1c">有複合損壞</label>
      <label class="block"><input type="checkbox" id="s1u">照片無法判定</label>
      <p><button class="primary" id="s1go">送出並下一題</button></p>`;
    $('#s1form').onclick = e => { const b = e.target.closest('[data-aid]'); if (b) { this.aid = b.dataset.aid === '1'; this.renderS1(); } };
    $('#s1go').onclick = () => {
      const t = $('#s1t').value, s = $('#s1s').value, u = $('#s1u').checked;
      if (!u && (!t || !s)) { alert('請選擇類型與程度，或勾選無法判定。'); return; }
      $('#s1log').insertAdjacentHTML('beforeend', `<tr><td>${this.q1}</td><td>${this.aid ? '有' : '無'}</td><td>${u ? '—' : t}</td><td>${u ? '—' : s}</td><td>${$('#s1c').checked ? '是' : '否'}</td><td>${u ? '是' : '否'}</td></tr>`);
      this.q1++; this.renderS1();
    };
  },
  ATTR: [['PCI（示意）', ['45', '60', '75']], ['主要損壞類型', ['坑洞', '龜裂', '車轍']], ['損壞程度', ['輕', '中', '重']], ['一年內修補次數', ['0 次', '2 次', '4 次']], ['一年內陳情件數', ['0 件', '3 件', '8 件']], ['道路服務問題', ['無', '行車顛簸', '積水']]],
  QS: { phys: '哪條道路的物理狀況較差？', check: '哪條道路應優先現場複查？', renew: '哪條道路較值得列入年度全面更新候選名單？' },
  newCard() {
    const r = mulberry32(1000 + this.logs[this.s2q].length * 7 + Object.keys(this.QS).indexOf(this.s2q));
    let a, b;
    do { a = this.ATTR.map(x => Math.floor(r() * 3)); b = this.ATTR.map(x => Math.floor(r() * 3)); } while (a.join() === b.join());
    this.card = [a, b];
  },
  renderS2() {
    $('#s2tabs').innerHTML = Object.entries(this.QS).map(([k, v]) => `<button data-q="${k}" class="${k === this.s2q ? 'on' : ''}">${v}</button>`).join('');
    $('#s2tabs').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { this.s2q = b.dataset.q; this.card = null; this.renderS2(); } };
    if (!this.card) this.newCard();
    const [a, b] = this.card;
    $('#s2card').innerHTML = `<div class="card" style="padding:10px"><b>${this.QS[this.s2q]}</b>
      <div class="dce" style="margin-top:8px"><div class="h"></div><div class="h">道路甲</div><div class="h">道路乙</div>
      ${this.ATTR.map((x, i) => `<div class="lab">${x[0]}</div><div>${x[1][a[i]]}</div><div>${x[1][b[i]]}</div>`).join('')}
      <div></div><div><button data-pick="0">選道路甲</button></div><div><button data-pick="1">選道路乙</button></div></div>
      ${this.s2q === 'renew' ? `<p style="margin:8px 0 0"><button data-pick="-1">兩者皆不列入</button></p>` : ''}</div>`;
    $('#s2card').onclick = e => {
      const p = e.target.closest('[data-pick]'); if (!p) return;
      const k = +p.dataset.pick; this.logs[this.s2q].push({ card: this.card, pick: k }); this.card = null; this.renderS2();
    };
    const L = this.logs[this.s2q];
    if (!L.length) { $('#s2log').innerHTML = '尚未作答'; return; }
    // 計數：被選道路中各屬性水準出現次數（不估計模型）
    const tally = this.ATTR.map(x => x[1].map(() => 0));
    for (const l of L) if (l.pick >= 0) l.card[l.pick].forEach((lv, i) => tally[i][lv]++);
    $('#s2log').innerHTML = `<p>已作答 ${L.length} 題${L.filter(l => l.pick < 0).length ? `（其中「皆不列入」${L.filter(l => l.pick < 0).length} 題）` : ''}。被選道路的屬性水準次數：</p>
      <table class="t">${this.ATTR.map((x, i) => `<tr><td>${x[0]}</td>${x[1].map((v, j) => `<td>${v}：${tally[i][j]}</td>`).join('')}</tr>`).join('')}</table>
      <p class="hint">實際分析會以條件 logit 等模型估計，且三種問題各自估計。</p>`;
  },
  BWS: ['嚴重坑洞集中', '一年內反覆修補', '民眾陳情多', 'PCI 偏低', '多種損壞共同出現', '沿道路連續龜裂', '車轍明顯'],
  renderBWS() {
    const r = mulberry32(77 + this.bwsN); const items = [...this.BWS].sort(() => r() - 0.5).slice(0, 4);
    this.bwsItems = items; this.best = null; this.worst = null;
    const draw = () => {
      $('#bws').innerHTML = `<h4>第 ${this.bwsN + 1} 組：判斷是否列入年度更新候選時，哪一項最重要、哪一項最不重要？</h4>
        <table class="t"><tr><th class="num">最重要</th><th>項目</th><th>最不重要</th></tr>${items.map((it, i) => `<tr><td class="num"><input type="radio" name="bb" data-b="${i}" ${this.best === i ? 'checked' : ''}></td><td>${it}</td><td><input type="radio" name="bw" data-w2="${i}" ${this.worst === i ? 'checked' : ''}></td></tr>`).join('')}</table>
        <p><button class="primary" id="bwsGo">送出並下一組</button></p>`;
      $('#bws').onchange = e => { if (e.target.dataset.b) this.best = +e.target.dataset.b; if (e.target.dataset.w2) this.worst = +e.target.dataset.w2; };
      $('#bwsGo').onclick = () => {
        if (this.best == null || this.worst == null || this.best === this.worst) { alert('請各選一項最重要與最不重要，且兩者不同。'); return; }
        const c = this.bwsCnt; c[items[this.best]] = (c[items[this.best]] || 0) + 1; c[items[this.worst]] = (c[items[this.worst]] || 0) - 1;
        this.bwsN++;
        $('#bwsLog').innerHTML = `<table class="t">${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${k}</td><td class="num">${v > 0 ? '+' : ''}${v}</td></tr>`).join('')}</table><p class="hint">已作答 ${this.bwsN} 組。計數法只作示範。</p>`;
        this.renderBWS();
      };
    };
    draw();
  }
};

// ---------- 匯入 ----------
const IMPORT_FIELDS = [['id', '案件編號'], ['date', '查報日期'], ['x', 'X 座標／經度'], ['y', 'Y 座標／緯度'], ['src', '查報來源'], ['type', '損壞類型'], ['sev', '損壞程度'], ['status', '案件狀態'], ['eventId', '事件編號（選填）']];
const GUESS = { id: /案件編號|case_?id|^id$/i, date: /查報日期|日期|date/i, x: /^x|經度|lon|twd97.*x|X座標/i, y: /^y|緯度|lat|twd97.*y|Y座標/i, src: /查報來源|來源|source/i, type: /損壞情形|損壞類型|type/i, sev: /損壞狀況|程度|severity|sev/i, status: /案件狀態|狀態|status/i, eventId: /事件|event/i };
function setupImport() {
  const dlg = $('#dlgImport');
  $('#btnImport').onclick = () => dlg.showModal();
  $('#impCancel').onclick = () => dlg.close();
  $('#impSim').onclick = () => { D = SIM; dataVer++; cache.clear(); setProv(); dlg.close(); renderActive(); };
  let table = null;
  $('#impFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    try {
      if (/\.(geo)?json$/i.test(f.name)) {
        const gj = JSON.parse(text);
        const feats = (gj.features || []).filter(ft => ft.geometry && ft.geometry.type === 'Point');
        const keys = [...new Set(feats.flatMap(ft => Object.keys(ft.properties || {})))];
        table = { head: ['__x', '__y', ...keys], rows: feats.map(ft => [ft.geometry.coordinates[0], ft.geometry.coordinates[1], ...keys.map(k => ft.properties[k])]) };
      } else {
        const rows = parseCSV(text.replace(/^﻿/, ''));
        table = { head: rows[0].map(h => h.replace(/\s+/g, '')), rows: rows.slice(1) };
      }
    } catch (err) { $('#impMap').innerHTML = `<p class="callout">讀取失敗：${esc(err.message)}</p>`; return; }
    const sample = table.rows[0] || [];
    const guess = k => { if (k === 'x' && table.head[0] === '__x') return 0; if (k === 'y' && table.head[1] === '__y') return 1; return table.head.findIndex(h => GUESS[k].test(h)); };
    const xs = +sample[guess('x')];
    $('#impMap').innerHTML = `<p>共 ${fmtN(table.rows.length)} 列。請確認欄位對應：</p>
      <div class="maprow">${IMPORT_FIELDS.map(([k, l]) => `<label>${l}</label><select data-f="${k}"><option value="-1">（無）</option>${table.head.map((h, i) => `<option value="${i}" ${guess(k) === i ? 'selected' : ''}>${esc(h === '__x' ? '幾何經度/X' : h === '__y' ? '幾何緯度/Y' : h)}</option>`).join('')}</select>`).join('')}
      <label>座標系統</label><select id="impCrs"><option value="twd97" ${!(Math.abs(xs) < 180) ? 'selected' : ''}>TWD97 TM2（EPSG:3826）</option><option value="wgs84" ${Math.abs(xs) < 180 ? 'selected' : ''}>WGS84 經緯度</option></select>
      <label>事件合併</label><label><input type="checkbox" id="impMerge" checked> 無事件編號時，同類型、相距 ≤5 m、30 天內的案件暫視為同一事件</label></div>
      <p class="hint">行政「結案」不視為已確認修復，會歸為「狀態不明」。距路網超過 30 m 的案件不納入。路網目前只涵蓋中山區。</p>`;
    $('#impGo').disabled = false;
  };
  $('#impGo').onclick = () => {
    if (!table) return;
    const idx = Object.fromEntries($$('[data-f]').map(s => [s.dataset.f, +s.value]));
    if (idx.x < 0 || idx.y < 0 || idx.date < 0) { alert('至少需要日期與座標欄位。'); return; }
    const rows = table.rows.map(r => Object.fromEntries(IMPORT_FIELDS.map(([k]) => [k, idx[k] >= 0 ? r[idx[k]] : ''])));
    const res = buildImported(G, rows, $('#impCrs').value, $('#impMerge').checked);
    if (!res.events.length) { alert(`沒有可用的案件（日期無法解析 ${res.drop.date}、座標缺漏 ${res.drop.coord}、距路網過遠 ${res.drop.far}）。`); return; }
    D = res; dataVer++; cache.clear(); setProv();
    alert(`已匯入 ${fmtN(res.reports.length)} 筆案件、${fmtN(res.events.length)} 個事件。\n未納入：日期無法解析 ${res.drop.date}、座標缺漏 ${res.drop.coord}、距路網超過 30 m ${res.drop.far}。`);
    $('#dlgImport').close(); renderActive();
  };
}
function setProv() {
  const p = $('#prov');
  p.className = 'prov ' + (D.kind === 'sim' ? 'sim' : 'import');
  p.textContent = D.kind === 'sim' ? '示意資料' : '匯入資料（未驗證）';
  $('.navfoot').innerHTML = `路網：OpenStreetMap 中山區可行車道路（© OpenStreetMap contributors, ODbL）<br>案件：${D.kind === 'sim' ? '模擬資料' : '匯入資料'}`;
}

// ---------- 啟動 ----------
buildShell();
for (const k of ['goal', 'contract', 'data', 'arch', 'plan']) views[k] = {};
setupImport();
show(location.hash.slice(1) || 'goal');
// 預先初始化互動頁，讓列印時各頁都有內容
for (const k of ['tree', 'survey']) { if (!views[k].inited) { views[k].init(); views[k].inited = true; } }
