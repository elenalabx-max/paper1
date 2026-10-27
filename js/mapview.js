'use strict';
// 自繪 canvas 地圖：不需要線上圖磚，可直接匯出 PNG

const RAMP = ['#fff3c4', '#fdd27a', '#f9a03f', '#e8642c', '#c2311f', '#7f1d1d'];
function rampColor(v) { // v: 0–1
  if (v <= 0) return null;
  const i = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length));
  return RAMP[i];
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const RAMP_RGB = RAMP.map(hexToRgb);
function quantileNZ(arr, q) {
  const a = []; for (const x of arr) if (x > 0) a.push(x);
  if (!a.length) return 1; a.sort((p, r) => p - r);
  return a[Math.min(a.length - 1, Math.floor(q * a.length))] || 1;
}

class MapView {
  constructor(host, G, opts = {}) {
    this.G = G; this.opts = opts;
    this.host = host; host.classList.add('mapview');
    this.cv = document.createElement('canvas'); host.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.layer = null; this.sel = null; this.highlightUnits = null; this.title = opts.title || '';
    this.dpr = window.devicePixelRatio || 1;
    this.fit();
    // 滑鼠與觸控共用 pointer 事件：單指／左鍵拖曳平移，雙指縮放，未移動即視為點選
    const pts = new Map();
    let drag = null, moved = false, pinch = null;
    this.cv.style.touchAction = 'none';
    this.cv.addEventListener('pointerdown', e => {
      this.cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { drag = [e.clientX, e.clientY, this.cx, this.cy]; moved = false; }
      else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, k: this.k }; moved = true; }
    });
    this.cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()], r = this.cv.getBoundingClientRect();
        const mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
        const [wx, wy] = this.toWorld(mx, my);
        this.k = Math.max(0.02, Math.min(3, pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
        const [nx, ny] = this.toWorld(mx, my); this.cx += wx - nx; this.cy += wy - ny;
      } else if (drag) {
        const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
        if (Math.abs(dx) + Math.abs(dy) > (e.pointerType === 'touch' ? 8 : 3)) moved = true;
        if (!moved) return;
        this.cx = drag[2] - dx / this.k; this.cy = drag[3] + dy / this.k;
      } else return;
      this.draw(); if (this.opts.onView) this.opts.onView(this);
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        if (drag && !moved && e.type === 'pointerup' && this.opts.onClick) {
          const r = this.cv.getBoundingClientRect();
          this.opts.onClick(this.toWorld(e.clientX - r.left, e.clientY - r.top), this);
        }
        drag = null; pinch = null;
      } else if (pts.size === 1) {
        const [p] = [...pts.values()]; drag = [p[0], p[1], this.cx, this.cy]; pinch = null;
      }
    };
    this.cv.addEventListener('pointerup', end);
    this.cv.addEventListener('pointercancel', end);
    this.cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = this.cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const [wx, wy] = this.toWorld(sx, sy);
      this.k *= e.deltaY < 0 ? 1.2 : 1 / 1.2; this.k = Math.max(0.02, Math.min(this.k, 3));
      const [nx, ny] = this.toWorld(sx, sy); this.cx += wx - nx; this.cy += wy - ny;
      this.draw(); if (this.opts.onView) this.opts.onView(this);
    }, { passive: false });
    new ResizeObserver(() => { this.resize(); }).observe(host);
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.cv.width = w * this.dpr; this.cv.height = h * this.dpr;
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.w = w; this.h = h;
    if (!this._fitted) { this._fitted = true; this.fit(); } else this.draw();
  }
  fit() {
    const w = this.host.clientWidth || 600, h = this.host.clientHeight || 500;
    this.cx = this.G.W / 2; this.cy = this.G.H / 2;
    this.k = Math.min(w / this.G.W, h / this.G.H) * 0.95;
    this.draw();
  }
  syncFrom(o) { this.cx = o.cx; this.cy = o.cy; this.k = o.k; this.draw(); }
  toScreen(x, y) { return [(x - this.cx) * this.k + this.w / 2, (this.cy - y) * this.k + this.h / 2]; }
  toWorld(sx, sy) { return [(sx - this.w / 2) / this.k + this.cx, this.cy - (sy - this.h / 2) / this.k]; }
  setLayer(layer) { this.layer = layer; this.draw(); }

  draw() {
    if (!this.w) return;
    const c = this.ctx, G = this.G, N = G.N, k = this.k;
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue('--map-bg').trim() || '#f6f5f1';
    const roadC = css.getPropertyValue('--map-road').trim() || '#c9c6bd';
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = bg; c.fillRect(0, 0, this.w, this.h);
    const L = this.layer || {};
    // 平面 KDE 底層
    if (L.kind === 'grid') this.drawGrid(L);
    // 道路底圖
    const wid = { M: 2.2, T: 2.2, P: 2, S: 1.8, t: 1.4, r: 0.9 };
    c.lineCap = 'round'; c.strokeStyle = roadC;
    for (const cls of ['r', 't', 'S', 'P', 'T', 'M']) {
      c.lineWidth = Math.max(0.5, wid[cls] * Math.min(1, k * 1.6 + 0.3));
      c.beginPath();
      for (const E of G.edges) { if (E.cls !== cls) continue;
        const [x0, y0] = this.toScreen(N[E.a][0], N[E.a][1]), [x1, y1] = this.toScreen(N[E.b][0], N[E.b][1]);
        if ((x0 < -20 && x1 < -20) || (x0 > this.w + 20 && x1 > this.w + 20) || (y0 < -20 && y1 < -20) || (y0 > this.h + 20 && y1 > this.h + 20)) continue;
        c.moveTo(x0, y0); c.lineTo(x1, y1); }
      c.stroke();
    }
    if (this.highlightUnits) this.drawUnits(this.highlightUnits, true);
    if (L.kind === 'lixel') this.drawLixels(L);
    if (L.kind === 'unit') this.drawGi(L);
    if (L.kind === 'units') this.drawUnits(L.units, false);
    if (L.points) this.drawPoints(L.points, L.pointStyle || 'dot');
    if (this.sel) this.drawSel();
    this.drawScale();
    if (this.opts.watermark && this.opts.watermark()) {
      c.save(); c.font = '600 12px system-ui, sans-serif'; c.fillStyle = 'rgba(180,40,30,.85)';
      c.textAlign = 'right'; let wm = this.opts.watermark();
      if (c.measureText(wm).width > this.w - 20) {
        const [a, ...b] = wm.split('｜');
        c.fillText(a, this.w - 10, 20); c.fillText(b.join('｜'), this.w - 10, 36);
      } else c.fillText(wm, this.w - 10, 20); c.restore();
    }
    if (this.title) { c.save(); c.font = '600 13px system-ui, sans-serif'; c.fillStyle = css.getPropertyValue('--ink').trim() || '#222'; c.fillText(this.title, 10, 54); c.restore(); }
  }
  drawGrid(L) {
    const { nx, ny, cell, v } = L, max = L.vmax || quantileNZ(v, 0.995);
    if (!this._gc || this._gc.width !== nx || this._gcSrc !== v) {
      const oc = document.createElement('canvas'); oc.width = nx; oc.height = ny;
      const oc2 = oc.getContext('2d'), im = oc2.createImageData(nx, ny);
      for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
        const val = v[gy * nx + gx] / max; if (val <= 0.02) continue;
        const i = Math.min(RAMP_RGB.length - 1, Math.floor(Math.min(val, 0.999) * RAMP_RGB.length));
        const p = ((ny - 1 - gy) * nx + gx) * 4, [r, g, b] = RAMP_RGB[i];
        im.data[p] = r; im.data[p + 1] = g; im.data[p + 2] = b; im.data[p + 3] = Math.min(230, 70 + 200 * val);
      }
      oc2.putImageData(im, 0, 0); this._gc = oc; this._gcSrc = v;
    }
    const c = this.ctx; c.save(); c.imageSmoothingEnabled = true;
    const [sx, sy] = this.toScreen(-cell / 2, (ny - 0.5) * cell);
    c.drawImage(this._gc, sx, sy, nx * cell * this.k, ny * cell * this.k); c.restore();
  }
  drawLixels(L) {
    const c = this.ctx, G = this.G, v = L.v, max = L.vmax || quantileNZ(v, 0.995);
    const order = []; for (let i = 0; i < v.length; i++) if (v[i] / max > 0.02) order.push(i);
    order.sort((a, b) => v[a] - v[b]);
    c.lineCap = 'round';
    for (const i of order) {
      const x = G.lix[i], val = Math.min(v[i] / max, 1);
      const [x0, y0] = this.toScreen(x.x0, x.y0), [x1, y1] = this.toScreen(x.x1, x.y1);
      c.strokeStyle = rampColor(Math.min(val, 0.999)); c.lineWidth = 1.5 + 4.5 * val * Math.min(1.4, this.k * 2 + 0.5);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  drawGi(L) {
    const c = this.ctx, G = this.G;
    const cls = z => z >= 2.58 ? '#7f1d1d' : z >= 1.96 ? '#c2311f' : z >= 1.65 ? '#f9a03f' : null;
    c.lineCap = 'round';
    for (let u = 0; u < G.units.length; u++) {
      const col = cls(L.z[u]); if (!col) continue;
      c.strokeStyle = col; c.lineWidth = 4;
      c.beginPath();
      for (const eid of G.units[u].edges) { const E = G.edges[eid];
        const [x0, y0] = this.toScreen(G.N[E.a][0], G.N[E.a][1]), [x1, y1] = this.toScreen(G.N[E.b][0], G.N[E.b][1]);
        c.moveTo(x0, y0); c.lineTo(x1, y1); }
      c.stroke();
    }
  }
  drawUnits(units, faint) {
    const c = this.ctx, G = this.G;
    c.lineCap = 'round';
    for (const [u, col] of units) {
      c.strokeStyle = col; c.lineWidth = faint ? 9 : 5; c.globalAlpha = faint ? 0.35 : 1;
      c.beginPath();
      for (const eid of G.units[u].edges) { const E = G.edges[eid];
        const [x0, y0] = this.toScreen(G.N[E.a][0], G.N[E.a][1]), [x1, y1] = this.toScreen(G.N[E.b][0], G.N[E.b][1]);
        c.moveTo(x0, y0); c.lineTo(x1, y1); }
      c.stroke(); c.globalAlpha = 1;
    }
  }
  drawPoints(pts, style) {
    const c = this.ctx, r = Math.max(1.6, Math.min(5, this.k * 4));
    for (const p of pts) {
      const [x, y] = this.toScreen(p.x, p.y);
      if (x < -10 || y < -10 || x > this.w + 10 || y > this.h + 10) continue;
      c.fillStyle = p.color || '#333';
      if (style === 'tick') {
        const s = r * (p.sev === '重' ? 1.6 : p.sev === '中' ? 1.25 : 1);
        c.beginPath(); c.arc(x, y, s, 0, 7); c.fill();
        if (p.cpl) { c.strokeStyle = '#111'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, s + 2 + Math.min(p.cpl, 5), 0, 7); c.stroke(); }
        if (p.recur) { c.strokeStyle = p.color; c.lineWidth = 1.5; c.strokeRect(x - s - 3, y - s - 3, 2 * s + 6, 2 * s + 6); }
      } else { c.globalAlpha = 0.8; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = 1; }
    }
  }
  drawSel() {
    const c = this.ctx, G = this.G, u = G.units[this.sel];
    if (!u) return;
    c.strokeStyle = '#0f172a'; c.lineWidth = 2; c.setLineDash([4, 3]);
    c.beginPath();
    for (const eid of u.edges) { const E = G.edges[eid];
      const [x0, y0] = this.toScreen(G.N[E.a][0], G.N[E.a][1]), [x1, y1] = this.toScreen(G.N[E.b][0], G.N[E.b][1]);
      c.moveTo(x0, y0); c.lineTo(x1, y1); }
    c.stroke(); c.setLineDash([]);
    const [x, y] = this.toScreen(u.x, u.y);
    c.beginPath(); c.arc(x, y, 14, 0, 7); c.stroke();
  }
  drawScale() {
    const c = this.ctx; const target = 100 / this.k;
    const nice = [50, 100, 200, 250, 500, 1000, 2000, 5000].find(v => v >= target) || 5000;
    const px = nice * this.k, x = 12, y = this.h - 14;
    const css = getComputedStyle(document.documentElement);
    c.strokeStyle = css.getPropertyValue('--ink').trim() || '#222'; c.fillStyle = c.strokeStyle; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x, y); c.lineTo(x + px, y); c.lineTo(x + px, y - 4); c.stroke();
    c.font = '11px system-ui, sans-serif'; c.fillText(nice >= 1000 ? nice / 1000 + ' km' : nice + ' m', x + px + 6, y);
  }
  // 點擊位置附近的路段單元
  pickUnit(x, y) {
    const s = snap(this.G, x, y, 12 / this.k + 5); return s ? this.G.edges[s.e].unit : null;
  }
  exportPNG(name, legendHTML) {
    const a = document.createElement('a'); a.download = name + '.png'; a.href = this.cv.toDataURL('image/png'); a.click();
  }
}
