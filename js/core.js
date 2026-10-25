'use strict';
// 核心：路網建構、示意資料、篩選、權重與各分析方法
// 時間以 UTC 日序（days since 1970-01-01）表示

const DAY = (y, m, d) => Date.UTC(y, m - 1, d) / 864e5;
const TODAY = DAY(2026, 10, 26);
const fmtDate = d => {
  const t = new Date(d * 864e5);
  return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0');
};
const yearOf = d => new Date(d * 864e5).getUTCFullYear();

const TYPES = ['坑洞', '龜裂', '縱橫向裂縫', '車轍', '人手孔缺失', '補綻及管線回填', '薄層剝離', '其他'];
const TYPE_COLORS = {
  '坑洞': '#c2410c', '龜裂': '#7c3aed', '縱橫向裂縫': '#2563eb', '車轍': '#0d9488',
  '人手孔缺失': '#ca8a04', '補綻及管線回填': '#be185d', '薄層剝離': '#4d7c0f', '其他': '#64748b'
};
const SEVS = ['輕', '中', '重', '待確認'];
const SRCS = ['廠商巡查', '1999陳情', '隊部', '其他'];
const STATUSES = ['待確認', '待處理', '處理中', '已確認修復', '無須修復', '權責移轉', '狀態不明'];
const OPEN_STATUS = new Set(['待確認', '待處理', '處理中', '狀態不明']);
const CLS_NAME = { M: '快速道路', T: '主要幹道', P: '主要道路', S: '次要道路', t: '集散道路', r: '一般道路/巷道' };

// ---------- 亂數 ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pickW(rng, items, weights) {
  let s = 0; for (const w of weights) s += w;
  let r = rng() * s;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// ---------- 二元堆積（Dijkstra 用） ----------
class Heap {
  constructor() { this.a = []; }
  push(k, v) {
    const a = this.a; a.push([k, v]); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

// ---------- 路網 ----------
const LIXEL = 20;      // lixel 長度（公尺）
const UNIT_LEN = 150;  // 路段單元長度（公尺），僅供排序與候選範圍彙整

function buildGraph(R) {
  const N = R.nodes;
  const edges = [], adj = N.map(() => []), units = [];
  R.ways.forEach((w, wi) => {
    const [name, cls, oneway, ps] = w;
    let u = null;
    for (let i = 0; i < ps.length - 1; i++) {
      const a = ps[i], b = ps[i + 1];
      const len = Math.hypot(N[b][0] - N[a][0], N[b][1] - N[a][1]);
      if (len < 0.5) continue;
      if (!u || u.len >= UNIT_LEN) {
        u = { id: units.length, name: name || '（未命名道路）', cls, way: wi, edges: [], lix: [], len: 0, nodes: new Set() };
        units.push(u);
      }
      const e = { id: edges.length, a, b, len, way: wi, name, cls, oneway, unit: u.id, lix: [] };
      edges.push(e); adj[a].push(e.id); adj[b].push(e.id);
      u.edges.push(e.id); u.len += len; u.nodes.add(a); u.nodes.add(b);
    }
  });
  const deg = adj.map(l => l.length);
  const lix = [];
  for (const e of edges) {
    const n = Math.max(1, Math.ceil(e.len / LIXEL));
    const [ax, ay] = N[e.a], [bx, by] = N[e.b];
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const L = { id: lix.length, e: e.id, tm: (t0 + t1) / 2, x0: ax + (bx - ax) * t0, y0: ay + (by - ay) * t0, x1: ax + (bx - ax) * t1, y1: ay + (by - ay) * t1, len: e.len / n, unit: e.unit };
      lix.push(L); e.lix.push(L.id); units[e.unit].lix.push(L.id);
    }
  }
  // 路段單元鄰接（共用節點）
  const nodeUnits = new Map();
  for (const u of units) for (const n of u.nodes) { if (!nodeUnits.has(n)) nodeUnits.set(n, []); nodeUnits.get(n).push(u.id); }
  for (const u of units) {
    const nb = new Set();
    for (const n of u.nodes) for (const v of nodeUnits.get(n)) if (v !== u.id) nb.add(v);
    u.nb = [...nb];
    let sx = 0, sy = 0, c = 0;
    for (const id of u.lix) { const L = lix[id]; sx += (L.x0 + L.x1) / 2; sy += (L.y0 + L.y1) / 2; c++; }
    u.x = sx / c; u.y = sy / c;
  }
  // 格網索引（找最近線段用）
  const CELL = 100, grid = new Map();
  let maxX = 0, maxY = 0;
  for (const p of N) { if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1]; }
  for (const e of edges) {
    const [ax, ay] = N[e.a], [bx, by] = N[e.b];
    for (let gx = Math.floor(Math.min(ax, bx) / CELL); gx <= Math.floor(Math.max(ax, bx) / CELL); gx++)
      for (let gy = Math.floor(Math.min(ay, by) / CELL); gy <= Math.floor(Math.max(ay, by) / CELL); gy++) {
        const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e.id);
      }
  }
  return { N, edges, adj, deg, lix, units, grid, CELL, W: maxX, H: maxY, origin: R.origin };
}

function edgePos(G, e, t) {
  const E = G.edges[e], [ax, ay] = G.N[E.a], [bx, by] = G.N[E.b];
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

// 最近線段：回傳 {e,t,d}
function snap(G, x, y, maxD = 30) {
  const r = Math.ceil(maxD / G.CELL), gx0 = Math.floor(x / G.CELL), gy0 = Math.floor(y / G.CELL);
  let best = null;
  for (let gx = gx0 - r; gx <= gx0 + r; gx++) for (let gy = gy0 - r; gy <= gy0 + r; gy++) {
    const l = G.grid.get(gx + ',' + gy); if (!l) continue;
    for (const id of l) {
      const E = G.edges[id], [ax, ay] = G.N[E.a], [bx, by] = G.N[E.b];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
      if (d <= maxD && (!best || d < best.d)) best = { e: id, t, d };
    }
  }
  return best;
}

// ---------- 示意資料 ----------
function simulate(G, seed = 20261026) {
  const rng = mulberry32(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const clsW = { M: 0.05, T: 0.3, P: 2.5, S: 2.2, t: 1.8, r: 1.0 };
  const eW = G.edges.map(e => e.len * clsW[e.cls]);
  const eIdx = G.edges.map(e => e.id);
  // 累積權重抽樣
  const cum = []; let acc = 0; for (const w of eW) { acc += w; cum.push(acc); }
  const randEdge = () => { const r = rng() * acc; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return eIdx[lo]; };
  // 沿路網隨機走一段距離
  const walk = (e, t, dist) => {
    let E = G.edges[e]; let dir = rng() < 0.5 ? 1 : -1; let rem = dist;
    for (let step = 0; step < 50; step++) {
      const room = dir > 0 ? (1 - t) * E.len : t * E.len;
      if (rem <= room) { t += dir * rem / E.len; return { e: E.id, t }; }
      rem -= room;
      const node = dir > 0 ? E.b : E.a;
      const nxt = G.adj[node].filter(id => id !== E.id);
      if (!nxt.length) { return { e: E.id, t: dir > 0 ? 1 : 0 }; }
      // 偏好同名道路，讓熱區沿道路延伸
      const same = nxt.filter(id => G.edges[id].name === E.name && E.name);
      const id = (same.length && rng() < 0.8) ? same[Math.floor(rng() * same.length)] : nxt[Math.floor(rng() * nxt.length)];
      E = G.edges[id]; if (E.a === node) { t = 0; dir = 1; } else { t = 1; dir = -1; }
    }
    return { e: E.id, t };
  };
  const typeBase = [12, 30, 28, 6, 10, 6, 4, 4];
  const hotspots = [];
  for (let i = 0; i < 46; i++) {
    const tw = typeBase.slice();
    const dom = Math.floor(rng() * TYPES.length); tw[dom] += 40;
    hotspots.push({ e: randEdge(), t: rng(), spread: 40 + rng() * 220, n: 10 + Math.floor(rng() * 45), tw, sevBoost: rng() < 0.5 ? 1 : 0, start: DAY(2022, 1, 1) + rng() * 1300, recur: rng() < 0.45 });
  }
  const events = [], reports = [], repairs = [];
  const span = TODAY - DAY(2022, 1, 1);
  const mkEvent = (pos, type, sev, date, recurOf, hot) => {
    const [x, y] = edgePos(G, pos.e, pos.t);
    const ev = { id: 'E' + String(events.length + 1).padStart(5, '0'), e: pos.e, t: pos.t, x, y, type, sev, date, recurOf: recurOf || null, hot, reports: [], repairs: [], status: '待確認', recurredBy: null };
    events.push(ev); return ev;
  };
  const sevPick = boost => pickW(rng, SEVS, boost ? [25, 38, 30, 7] : [48, 32, 12, 8]);
  for (const h of hotspots) {
    for (let k = 0; k < h.n; k++) {
      const pos = walk(h.e, h.t, Math.abs(gauss()) * h.spread);
      const date = Math.min(TODAY - 3, h.start + rng() * (TODAY - h.start));
      mkEvent(pos, pickW(rng, TYPES, h.tw), sevPick(h.sevBoost), Math.floor(date), null, hotspots.indexOf(h));
    }
  }
  for (let k = 0; k < 650; k++) {
    const e = randEdge();
    mkEvent({ e, t: rng() }, pickW(rng, TYPES, typeBase), sevPick(0), Math.floor(DAY(2022, 1, 1) + rng() * span), null, -1);
  }
  // 修復狀態、修復紀錄與再發
  const resolve = ev => {
    const age = TODAY - ev.date;
    let st;
    if (ev.type === '人手孔缺失' && rng() < 0.35) st = '權責移轉';
    else if (age > 120) st = pickW(rng, ['已確認修復', '無須修復', '狀態不明', '待處理'], [70, 8, 14, 8]);
    else if (age > 30) st = pickW(rng, ['已確認修復', '處理中', '待處理', '狀態不明'], [35, 25, 30, 10]);
    else st = pickW(rng, ['待確認', '待處理', '處理中'], [45, 40, 15]);
    ev.status = st;
    if (st === '已確認修復') {
      if (rng() < 0.3) repairs.push(mkRepair(ev, ev.date + 2 + Math.floor(rng() * 10), '臨時修補', true));
      ev.repairDate = Math.min(TODAY - 1, ev.date + 7 + Math.floor(rng() * 80));
      repairs.push(mkRepair(ev, ev.repairDate, ev.type === '人手孔缺失' ? '人手孔調整' : (rng() < 0.15 ? '局部刨鋪' : '局部修補'), true));
    } else if (st === '狀態不明' && rng() < 0.5) {
      repairs.push(mkRepair(ev, ev.date + 10 + Math.floor(rng() * 60), '局部修補', false));
    }
  };
  const mkRepair = (ev, date, method, verified) => {
    const r = { id: 'R' + String(repairs.length + 1).padStart(5, '0'), eid: ev.id, date: Math.min(TODAY - 1, date), method, verified };
    ev.repairs.push(r); return r;
  };
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]; resolve(ev);
    // 修復後再發：熱區內較常見
    const hr = ev.hot >= 0 && hotspots[ev.hot].recur;
    if (ev.status === '已確認修復' && rng() < (hr ? 0.42 : 0.08)) {
      const d = ev.repairDate + 60 + Math.floor(rng() * 500);
      if (d < TODAY - 5) {
        const pos = walk(ev.e, ev.t, rng() * 4);
        const sev2 = pickW(rng, SEVS, [30, 40, 25, 5]);
        const ne = mkEvent(pos, rng() < 0.75 ? ev.type : pickW(rng, TYPES, typeBase), sev2, d, ev.id, ev.hot);
        ev.recurredBy = ne.id;
      }
    }
  }
  // 查報案件
  let rc = 0;
  const mkReport = (ev, src, date, type, sev) => {
    rc++;
    const id = '11' + String(yearOf(date) - 1911).padStart(3, '0') + String(rc).padStart(6, '0');
    const admin = ev.status === '已確認修復' || ev.status === '無須修復' || ev.status === '權責移轉' || (ev.status === '狀態不明' && rng() < 0.7) ? '結案' : '未結案';
    const r = { id, eid: ev.id, src, date: Math.min(TODAY, Math.floor(date)), type, sev, admin };
    reports.push(r); ev.reports.push(r); return r;
  };
  const cplP = { '坑洞': 0.55, '人手孔缺失': 0.35, '車轍': 0.2, '薄層剝離': 0.18, '龜裂': 0.07, '縱橫向裂縫': 0.04, '補綻及管線回填': 0.1, '其他': 0.12 };
  for (const ev of events) {
    const big = ['T', 'P', 'S'].includes(G.edges[ev.e].cls);
    const complaintOnly = rng() < 0.05;
    if (!complaintOnly) {
      mkReport(ev, rng() < 0.03 ? '隊部' : (rng() < 0.02 ? '其他' : '廠商巡查'), ev.date, ev.type, ev.sev);
      const rep = rng() < 0.25 ? 1 + Math.floor(rng() * 2) : 0; // 同一損壞重複巡查登錄
      for (let k = 0; k < rep; k++) mkReport(ev, '廠商巡查', ev.date + 7 + rng() * 40, ev.type, ev.sev);
    }
    let p = cplP[ev.type] * (ev.sev === '重' ? 1.6 : ev.sev === '輕' ? 0.6 : 1) * (big ? 1.2 : 1);
    if (complaintOnly) p = 1;
    if (rng() < p) {
      const n = 1 + Math.floor(Math.pow(rng(), 2.2) * 6);
      for (let k = 0; k < n; k++) mkReport(ev, '1999陳情', ev.date + (complaintOnly && k === 0 ? 0 : 1 + rng() * 45), rng() < 0.5 ? ev.type : '其他', '待確認');
    }
  }
  reports.sort((a, b) => a.date - b.date);
  return { kind: 'sim', label: '示意資料（模擬案件，非實際查報）', events, reports, repairs, evById: new Map(events.map(e => [e.id, e])) };
}

// ---------- 權重 ----------
const WEIGHT_PRESETS = {
  none: { label: '不加權', type: Object.fromEntries(TYPES.map(t => [t, 1])), sev: { '輕': 1, '中': 1, '重': 1, '待確認': 1 }, src: Object.fromEntries(SRCS.map(s => [s, 1])), coef: { T: 1, S: 1, C: 1, R: 1 }, inter: 0 },
  // 問卷尚未執行，以下僅為操作示範用的假設值
  survey: { label: '研究問卷推估（尚無結果，示意值）', type: { '坑洞': 1, '龜裂': 0.7, '縱橫向裂縫': 0.4, '車轍': 0.8, '人手孔缺失': 0.6, '補綻及管線回填': 0.3, '薄層剝離': 0.5, '其他': 0.2 }, sev: { '輕': 0.3, '中': 0.6, '重': 1, '待確認': 0.5 }, src: { '廠商巡查': 1, '1999陳情': 1, '隊部': 1, '其他': 0.8 }, coef: { T: 0.8, S: 1, C: 0.5, R: 0.7 }, inter: 0.3 }
};
function cloneW(w) { return JSON.parse(JSON.stringify(w)); }

// 事件層級分項（0–1）
function eventParts(ev, W, rep) {
  const nC = rep.filter(r => r.src === '1999陳情').length;
  return {
    T: W.type[ev.type] ?? 1,
    S: W.sev[ev.sev] ?? 1,
    C: Math.min(nC, 5) / 5,
    R: Math.min((ev.recurOf ? 1 : 0) + Math.max(0, ev.repairs.length - 1) * 0.5, 1)
  };
}
// 組合模型：sum 加權平均；prod 加權幾何平均；inter 加權平均＋程度×再發交互項
function combine(parts, keys, W, model) {
  const c = W.coef;
  if (model === 'prod') {
    let lg = 0, s = 0;
    for (const k of keys) { const v = k === 'C' || k === 'R' ? 0.5 + 0.5 * parts[k] : parts[k]; lg += c[k] * Math.log(Math.max(v, 1e-3)); s += c[k]; }
    return s ? Math.exp(lg / s) : 0;
  }
  let a = 0, s = 0;
  for (const k of keys) { a += c[k] * parts[k]; s += c[k]; }
  let v = s ? a / s : 0;
  if (model === 'inter') v += W.inter * parts.S * parts.R;
  return v;
}

// ---------- 篩選 ----------
// 回傳 { items:[{x,y,e,t,w,eid}], evs, reps, counts }
function selectItems(G, D, st, W) {
  const tSet = new Set(st.types), sSet = new Set(st.srcs), vSet = new Set(st.sevs);
  const win = st.time === '1y' ? TODAY - 365 : st.time === '3y' ? TODAY - 1095 : -Infinity;
  const evs = [], reps = [], items = [];
  let nRep = 0, nCpl = 0;
  for (const ev of D.events) {
    if (!tSet.has(ev.type) || !vSet.has(ev.sev)) continue;
    if (st.time === 'open' && !OPEN_STATUS.has(ev.status)) continue;
    if (st.time === 'recur' && !ev.recurOf) continue;
    const rep = ev.reports.filter(r => sSet.has(r.src) && r.date >= win);
    if (!rep.length) continue;
    evs.push(ev); nRep += rep.length;
    for (const r of rep) { reps.push(r); if (r.src === '1999陳情') nCpl++; }
    if (st.output === 'phys') {
      const p = eventParts(ev, W, rep);
      items.push({ x: ev.x, y: ev.y, e: ev.e, t: ev.t, w: st.weightMode === 'none' ? 1 : combine(p, ['T', 'S'], W, st.model), eid: ev.id, type: ev.type, sev: ev.sev });
    } else if (st.output === 'svc') {
      for (const r of rep) {
        if (r.src === '廠商巡查') continue;
        items.push({ x: ev.x, y: ev.y, e: ev.e, t: ev.t, w: st.weightMode === 'none' ? 1 : (W.src[r.src] ?? 1) * (W.type[ev.type] ?? 1), eid: ev.id, type: ev.type, sev: ev.sev });
      }
    } else {
      const p = eventParts(ev, W, ev.reports);
      items.push({ x: ev.x, y: ev.y, e: ev.e, t: ev.t, w: st.weightMode === 'none' ? 1 : combine(p, ['T', 'S', 'C', 'R'], W, st.model), eid: ev.id, type: ev.type, sev: ev.sev });
    }
  }
  return { items, evs, reps, counts: { reports: nRep, events: evs.length, complaints: nCpl, items: items.length } };
}

// ---------- 核函數 ----------
const KERNELS = {
  quartic: { label: '二次（Quartic）', f: u => u < 1 ? (15 / 16) * (1 - u * u) ** 2 : 0 },
  tri: { label: '三角', f: u => u < 1 ? 1 - u : 0 },
  gauss: { label: '高斯（截斷於帶寬）', f: u => u < 1 ? Math.exp(-0.5 * (u * 2.5) ** 2) : 0 }
};

// ---------- B：平面 KDE ----------
function planarKDE(G, items, h, kern, cell = 20) {
  const nx = Math.ceil(G.W / cell) + 1, ny = Math.ceil(G.H / cell) + 1;
  const v = new Float32Array(nx * ny), K = KERNELS[kern].f, r = Math.ceil(h / cell);
  for (const it of items) {
    const cx = Math.round(it.x / cell), cy = Math.round(it.y / cell);
    for (let gx = cx - r; gx <= cx + r; gx++) { if (gx < 0 || gx >= nx) continue;
      for (let gy = cy - r; gy <= cy + r; gy++) { if (gy < 0 || gy >= ny) continue;
        const d = Math.hypot(gx * cell - it.x, gy * cell - it.y); if (d >= h) continue;
        v[gy * nx + gx] += it.w * K(d / h);
      } }
  }
  return { kind: 'grid', nx, ny, cell, v };
}

// ---------- 由點沿路網擴散 ----------
// 最短路徑版：Dijkstra，edgeOk 過濾可通行線段，stopNode 為不可穿越節點
function spreadShortest(G, it, h, K, out, edgeOk, stopNode) {
  const E0 = G.edges[it.e];
  for (const lid of E0.lix) { const d = Math.abs(G.lix[lid].tm - it.t) * E0.len; if (d < h) out[lid] += it.w * K(d / h); }
  const dist = new Map(), hp = new Heap();
  const da = it.t * E0.len, db = (1 - it.t) * E0.len;
  if (da < h) hp.push(da, E0.a); if (db < h) hp.push(db, E0.b);
  const done = new Set([E0.id]);
  while (hp.size) {
    const [d, n] = hp.pop();
    if (dist.has(n)) continue; dist.set(n, d);
    if (stopNode && stopNode(n)) continue;
    for (const eid of G.adj[n]) {
      if (eid === E0.id) continue;
      const E = G.edges[eid];
      if (edgeOk && !edgeOk(E)) continue;
      const o = E.a === n ? E.b : E.a;
      if (d + E.len < h && !dist.has(o)) hp.push(d + E.len, o);
    }
  }
  // 由已到達節點計算各 lixel 的最短距離
  for (const n of dist.keys()) {
    for (const eid of G.adj[n]) {
      if (done.has(eid)) continue;
      const E = G.edges[eid];
      if (edgeOk && !edgeOk(E)) continue;
      if (stopNode && stopNode(n)) continue;
      done.add(eid);
      const dA = dist.has(E.a) && !(stopNode && stopNode(E.a)) ? dist.get(E.a) : Infinity;
      const dB = dist.has(E.b) && !(stopNode && stopNode(E.b)) ? dist.get(E.b) : Infinity;
      for (const lid of E.lix) {
        const L = G.lix[lid]; const dd = Math.min(dA + L.tm * E.len, dB + (1 - L.tm) * E.len);
        if (dd < h) out[lid] += it.w * K(dd / h);
      }
    }
  }
}
// 等分分流版（equal-split discontinuous）：在交叉口將質量平均分給其他分支
function spreadSplit(G, it, h, K, out) {
  const E0 = G.edges[it.e];
  for (const lid of E0.lix) { const d = Math.abs(G.lix[lid].tm - it.t) * E0.len; if (d < h) out[lid] += it.w * K(d / h); }
  let budget = 30000;
  const go = (node, from, d, mult) => {
    if (d >= h || --budget < 0) return;
    const k = G.deg[node]; if (k <= 1) return;
    const m = mult / (k - 1);
    for (const eid of G.adj[node]) {
      if (eid === from) continue;
      const E = G.edges[eid]; const fwd = E.a === node;
      for (const lid of E.lix) {
        const L = G.lix[lid]; const dd = d + (fwd ? L.tm : 1 - L.tm) * E.len;
        if (dd < h) out[lid] += it.w * m * K(dd / h);
      }
      go(fwd ? E.b : E.a, eid, d + E.len, m);
    }
  };
  go(E0.a, E0.id, it.t * E0.len, 1);
  go(E0.b, E0.id, (1 - it.t) * E0.len, 1);
}

// C：NKDE
function networkKDE(G, items, h, kern, junction) {
  const out = new Float32Array(G.lix.length), K = KERNELS[kern].f;
  for (const it of items) junction === 'split' ? spreadSplit(G, it, h, K, out) : spreadShortest(G, it, h, K, out);
  return { kind: 'lixel', v: out };
}
// D：沿同名道路平滑
function alongRoad(G, items, h, kern, jmode) {
  const out = new Float32Array(G.lix.length), K = KERNELS[kern].f;
  for (const it of items) {
    const E0 = G.edges[it.e], nm = E0.name, wy = E0.way;
    const ok = E => nm ? E.name === nm : E.way === wy;
    const stop = jmode === 'cut' ? n => G.adj[n].some(id => !ok(G.edges[id])) : null;
    spreadShortest(G, it, h, K, out, ok, stop);
  }
  return { kind: 'lixel', v: out };
}
// F：Getis–Ord Gi*（以路段單元為分析單位，鄰接＝共用節點，二元權重）
function giStar(G, items) {
  const n = G.units.length, x = new Float64Array(n);
  for (const it of items) x[G.edges[it.e].unit] += it.w;
  let s = 0, s2 = 0; for (let i = 0; i < n; i++) { s += x[i]; s2 += x[i] * x[i]; }
  const mean = s / n, S = Math.sqrt(Math.max(s2 / n - mean * mean, 1e-12));
  const z = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const nb = [i, ...G.units[i].nb]; const wsum = nb.length;
    let lx = 0; for (const j of nb) lx += x[j];
    const den = S * Math.sqrt((n * wsum - wsum * wsum) / (n - 1));
    z[i] = den > 0 ? (lx - mean * wsum) / den : 0;
  }
  return { kind: 'unit', z, x };
}

// 路段單元加權總和（不平滑，供排序比較）
function unitScores(G, items) {
  const v = new Float64Array(G.units.length);
  for (const it of items) v[G.edges[it.e].unit] += it.w;
  return v;
}
function spearman(a, b) {
  const idx = []; for (let i = 0; i < a.length; i++) if (a[i] > 0 || b[i] > 0) idx.push(i);
  const rank = arr => { const o = idx.map(i => [arr[i], i]).sort((p, q) => p[0] - q[0]); const r = new Map(); let k = 0;
    while (k < o.length) { let j = k; while (j + 1 < o.length && o[j + 1][0] === o[k][0]) j++; const rr = (k + j) / 2 + 1; for (let m = k; m <= j; m++) r.set(o[m][1], rr); k = j + 1; } return r; };
  const ra = rank(a), rb = rank(b); const n = idx.length; if (n < 3) return NaN;
  let ma = 0, mb = 0; for (const i of idx) { ma += ra.get(i); mb += rb.get(i); } ma /= n; mb /= n;
  let num = 0, da = 0, db = 0; for (const i of idx) { const p = ra.get(i) - ma, q = rb.get(i) - mb; num += p * q; da += p * p; db += q * q; }
  return num / Math.sqrt(da * db);
}

// ---------- 座標轉換：WGS84 → TWD97 TM2（中央經線121°） ----------
function wgs84ToTwd97(lon, lat) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9999, dx = 250000, lon0 = 121 * Math.PI / 180;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
  const Nn = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = (lam - lon0) * Math.cos(phi);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const x = dx + k0 * Nn * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = k0 * (M + Nn * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [x, y];
}

// ---------- 匯入：CSV ----------
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
function parseDateLoose(s) {
  if (!s) return null; s = String(s).trim();
  let m = s.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})/); // 民國
  if (m) return DAY(+m[1] + 1911, +m[2], +m[3]);
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return DAY(+m[1], +m[2], +m[3]);
  return null;
}
const SRC_MAP = s => /1999|陳情|民眾/.test(s) ? '1999陳情' : /廠商|巡查|巡/.test(s) ? '廠商巡查' : /隊部/.test(s) ? '隊部' : '其他';
const TYPE_MAP = s => { s = s || ''; for (const t of TYPES) if (s.includes(t)) return t; if (/縱向|橫向/.test(s)) return '縱橫向裂縫'; if (/補綻|管線/.test(s)) return '補綻及管線回填'; if (/人手孔|人孔/.test(s)) return '人手孔缺失'; return '其他'; };
const SEV_MAP = s => /重/.test(s) ? '重' : /中/.test(s) ? '中' : /輕/.test(s) ? '輕' : '待確認';
// 行政結案不等於已確認修復，未提供修復證據者一律歸為「狀態不明」
const STATUS_MAP = s => { s = s || ''; for (const t of STATUSES) if (s === t) return t; if (/觀察|派工|待/.test(s)) return '待處理'; if (/處理中|施工/.test(s)) return '處理中'; return '狀態不明'; };

// rows: [{id,date,x,y,src,type,sev,status,eventId}]，crs: 'twd97'|'wgs84'
function buildImported(G, rows, crs, mergeRule) {
  const events = [], reports = [], drop = { coord: 0, far: 0, date: 0 };
  const [ox, oy] = G.origin;
  const recent = new Map(); // 合併規則用：路段單元→最近事件列表
  const byEid = new Map();
  for (const r of rows) {
    const date = parseDateLoose(r.date); if (date == null) { drop.date++; continue; }
    let x = parseFloat(r.x), y = parseFloat(r.y);
    if (!isFinite(x) || !isFinite(y) || x === 0) { drop.coord++; continue; }
    if (crs === 'wgs84') [x, y] = wgs84ToTwd97(x, y);
    x -= ox; y -= oy;
    const s = snap(G, x, y, 30); if (!s) { drop.far++; continue; }
    const type = TYPE_MAP(r.type), sev = SEV_MAP(r.sev), src = SRC_MAP(r.src || '');
    let ev = null;
    if (r.eventId) ev = byEid.get(r.eventId);
    else if (mergeRule) {
      const u = G.edges[s.e].unit; const l = recent.get(u) || [];
      const [px, py] = edgePos(G, s.e, s.t);
      ev = l.find(o => o.type === type && Math.hypot(o.x - px, o.y - py) <= 5 && date - o.date <= 30) || null;
    }
    if (!ev) {
      const [px, py] = edgePos(G, s.e, s.t);
      ev = { id: r.eventId || ('E' + String(events.length + 1).padStart(6, '0')), e: s.e, t: s.t, x: px, y: py, type, sev, date, recurOf: null, hot: -1, reports: [], repairs: [], status: STATUS_MAP(r.status) };
      events.push(ev); if (r.eventId) byEid.set(r.eventId, ev);
      const u = G.edges[s.e].unit; if (!recent.has(u)) recent.set(u, []); recent.get(u).push(ev);
    }
    const rep = { id: r.id || ('row' + reports.length), eid: ev.id, src, date, type, sev, admin: r.status || '' };
    reports.push(rep); ev.reports.push(rep);
    if (sev !== '待確認' && (ev.sev === '待確認' || SEVS.indexOf(sev) > SEVS.indexOf(ev.sev))) ev.sev = sev;
  }
  reports.sort((a, b) => a.date - b.date);
  return { kind: 'import', label: '匯入資料（未經驗證）', events, reports, repairs: [], evById: new Map(events.map(e => [e.id, e])), drop, total: rows.length };
}
