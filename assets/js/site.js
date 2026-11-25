/* One Latent World: page behaviour. The page is complete without this script; it adds the cover wall,
   lazy video, the pattern switcher, the readout viewer, two small charts, and the usual conveniences. */
(function () {
  'use strict';

  /* Narrow screens keep the desktop layout. Width-based media rules are switched off, the page is scaled to the screen width,
     and people zoom in with two fingers or a double tap (handled here, since the page may sit in a frame where the browser
     does not zoom). */
  (function fixedLayout() {
    const DW = 1180, NARROW = 900, ZMAX = 1.25, root = document.documentElement, body = document.body;
    const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
    if (!framed) {                                                     // opened directly: a desktop-width viewport, the browser zooms
      if (Math.min(screen.width, root.clientWidth) < NARROW) {
        let m = document.querySelector('meta[name=viewport]'); if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
        m.content = `width=${DW}, viewport-fit=cover`;
      }
      return;
    }
    const rules = [];
    for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
      for (const r of rs) if (r.media && /(max|min)-width/.test(r.media.mediaText)) rules.push([r, r.media.mediaText]); }
    let on = false, z = 1, fit = 1;
    const setZ = (nz, cx, cy) => {                                     // keep the page point under (cx, cy) in place
      const px = (scrollX + cx) / z, py = (scrollY + cy) / z;
      z = Math.max(fit, Math.min(ZMAX, nz)); body.style.zoom = z; void root.scrollWidth;   // reflow first, so the new width can be scrolled
      scrollTo(px * z - cx, py * z - cy);
    };
    const apply = () => {
      const w = root.clientWidth || innerWidth, want = w < NARROW;
      if (want !== on) {
        on = want; rules.forEach(([r, t]) => { r.media.mediaText = on ? 'not all' : t; });
        root.classList.toggle('fixed-layout', on); root.style.touchAction = on ? 'pan-x pan-y' : ''; root.style.overflowX = on ? 'auto' : '';
        body.style.width = on ? DW + 'px' : '';                     // the layout width stays the desktop one at every zoom
        if (!on) { body.style.zoom = ''; z = 1; }
      }
      if (on) { fit = w / DW; z = fit; body.style.zoom = z; }
      if (on) requestAnimationFrame(() => dispatchEvent(new Event('resize')));   // let charts and 3D views re-measure
    };
    apply();
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const w = root.clientWidth; if ((w < NARROW) !== on || (on && Math.abs(w / DW - fit) > .01)) apply(); }, 150); });
    let p0 = null;
    addEventListener('touchstart', e => {
      if (!on || e.touches.length !== 2 || e.target.closest('canvas')) return; const [a, b] = e.touches;   // a pinch on a 3D view zooms that view
      p0 = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, z };
    }, { passive: true });
    addEventListener('touchmove', e => {
      if (!p0 || e.touches.length !== 2) return; e.preventDefault(); const [a, b] = e.touches;
      setZ(p0.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / p0.d, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    }, { passive: false });
    addEventListener('touchend', e => { if (e.touches.length < 2) p0 = null; }, { passive: true });
    addEventListener('dblclick', e => {                                // double tap: fit width <-> readable size, at the tap point
      if (!on || e.target.closest('canvas, video, button, a, input, .seg')) return;
      setZ(z > fit * 1.5 ? fit : Math.min(ZMAX, fit * 2.6), e.clientX, e.clientY);
    });
  })();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;

  /* theme */
  const tb = $('#theme');
  if (tb) tb.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('olw-theme', root.dataset.theme); } catch (e) {}
    drawCharts();
  });

  /* cover wall: one KITTI-360 window and camera per row, decoded for five patterns (+ the recorded scan) */
  const NAMES = { hdl64: 'HDL-64E', os2_128: 'OS2-128', vlp16: 'VLP-16', aeva: 'Aeries II', avia: 'Avia', measured: 'Recorded' };
  const ROWS = [
    ['aeva', 'hdl64', 'vlp16', 'avia', 'os2_128', 'measured'],
    ['measured', 'avia', 'os2_128', 'hdl64', 'vlp16', 'aeva'],
    ['hdl64', 'vlp16', 'aeva', 'os2_128', 'avia', 'measured'],
    ['vlp16', 'os2_128', 'hdl64', 'aeva', 'avia', 'measured'],
  ];
  const grid = $('#cgrid');
  if (grid) ROWS.forEach((row, r) => {
    const cr = document.createElement('div'); cr.className = 'crow';
    row.forEach((k, c) => {
      const side = c === 0 || c === 5, f = `assets/video/cover/r${r}c${c}_${k}`;
      const d = document.createElement('div'); d.className = 'tile' + (side ? ' side' : '');
      d.innerHTML = `<video data-src="${f}.mp4" poster="${f}.jpg" muted loop playsinline preload="none" aria-hidden="true" data-auto></video><i>${NAMES[k]}</i>`;
      cr.appendChild(d);
    });
    grid.appendChild(cr);
  });

  /* lazy video: load when near the viewport, play muted loops while visible */
  const vio = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.addEventListener('error', () => v.classList.add('missing'), { once: true }); }
      if (v.muted && v.loop) { const p = v.play(); if (p) p.catch(() => {}); }
    } else if (v.muted && v.loop && !v.paused) v.pause();
  }), { rootMargin: '200px 0px' });
  $$('video[data-src]').forEach(v => vio.observe(v));

  /* keep the clips of one group in step */
  $$('#pred-clips, #seq-clips, .sync').forEach(g => {
    const vs = $$('video', g);
    setInterval(() => {
      const m = vs[0]; if (!m || m.paused || !m.duration) return;
      vs.slice(1).forEach(v => { if (!v.paused && v.duration && Math.abs(v.currentTime - m.currentTime) > 0.12) v.currentTime = m.currentTime; });
    }, 900);
  });

  /* pattern switcher */
  const sw = $('#switch');
  if (sw) {
    const btns = $$('.seg button', sw), lab = $('#sw-lab');
    let auto = true, i = 0, timer = null, vis = false;
    const show = k => {
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
      $$('.view img.scan', sw).forEach(im => im.classList.toggle('on', im.dataset.k === k));
      $$('.rays img', sw).forEach(im => im.classList.toggle('on', im.dataset.k === k));
      $('.rays', sw).style.visibility = k === 'hdl64' ? 'hidden' : 'visible';
      lab.textContent = btns.find(b => b.dataset.k === k).dataset.n + (k === 'hdl64' ? ' (training LiDAR)' : '');
    };
    btns.forEach((b, j) => b.addEventListener('click', () => { auto = false; i = j; show(b.dataset.k); }));
    new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: .4 }).observe(sw);
    timer = setInterval(() => { if (!auto || !vis || document.hidden) return; i = (i + 1) % btns.length; show(btns[i].dataset.k); }, 2400);
    show('hdl64');
  }

  /* readout viewer */
  const ro = $('#readout');
  if (ro) {
    const view = $('.view', ro), lab = $('#ro-lab');
    const MN = { 'occupancy_ssc0.2': 'Occupancy, SSCBench 0.2 m · ray marching', mesh_nksr: 'NKSR mesh · raycasting', opendwm_render: 'OpenDWM · render head', ours: 'Ours · ray decoder' };
    const st = { mask: 'vlp16', m: 'ours' }, imgs = {};
    const show = () => {
      const k = `${st.mask}_${st.m}`;
      if (!imgs[k]) { const im = new Image(); im.src = `assets/img/readout/${k}.webp`; im.alt = `${MN[st.m]}, ${st.mask === 'vlp16' ? 'VLP-16 rows' : 'Avia cells'} masked`; im.decoding = 'async'; view.insertBefore(im, view.firstChild); imgs[k] = im; }
      const on = () => Object.entries(imgs).forEach(([kk, im]) => im.classList.toggle('on', kk === k));
      imgs[k].complete ? on() : imgs[k].addEventListener('load', on, { once: true });
      lab.textContent = MN[st.m]; lab.classList.toggle('ours', st.m === 'ours');
    };
    [...$$('.seg', ro), $('#ro-mask .seg')].filter(Boolean).forEach(sg => $$('button', sg).forEach(b => b.addEventListener('click', () => {
      $$('button', sg).forEach(x => x.setAttribute('aria-pressed', String(x === b))); st[sg.dataset.g] = b.dataset.v; show();
      ro.dispatchEvent(new CustomEvent('ro', { detail: { ...st } }));
    })));
    show();
  }

  /* charts: horizontal bars, ours in green, values as text, a tooltip per bar */
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; document.body.appendChild(tip);
  const css = n => getComputedStyle(root).getPropertyValue(n).trim();
  /* bars draw themselves the first time the chart scrolls into view (as on the ODE page); a log-time chart is drawn by a
     time cursor that sweeps the axis, so each bar stops when its method is done; later redraws morph from the old widths */
  const chartIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.target._play) { chartIO.unobserve(e.target); e.target._play(); } }), { threshold: .45 });
  function bars(el, rows, opt) {
    const plot = $('.plot', el); if (!plot) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = Math.max(300, Math.min(980, plot.clientWidth || 520)), rh = opt.rh || 34, top = opt.log ? 24 : 6, lw = opt.labelW || 120, H = top + rows.length * rh + 26;
    const x0 = lw + 8, x1 = W - 64;
    const sx = opt.log ? v => x0 + (Math.log10(v) - Math.log10(opt.min)) / (Math.log10(opt.max) - Math.log10(opt.min)) * (x1 - x0)
                       : v => x0 + v / opt.max * (x1 - x0);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${opt.aria}">`;
    opt.ticks.forEach(t => { const x = sx(t); s += `<line class="grid" x1="${x}" x2="${x}" y1="${top - 2}" y2="${H - 22}"/><text class="tick" x="${x}" y="${H - 6}" text-anchor="middle">${opt.fmt ? opt.fmt(t) : t}</text>`; });
    const tw = rows.map(r => Math.max(2, sx(r.v) - x0));
    rows.forEach((r, i) => {
      const y = top + i * rh, o = (r.ours ? ' ours' : '') + (opt.sel && r.k === opt.sel ? ' sel' : '') + (opt.pick && r.k ? ' pick' : '');
      s += `<text class="lab${o}" data-i="${i}" x="${lw}" y="${y + rh / 2 + 5}" text-anchor="end">${r.n}</text>`;
      s += `<rect class="bar${o}" data-i="${i}" x="${x0}" y="${y + 7}" width="${tw[i]}" height="${rh - 14}" rx="4"/>`;
      s += `<text class="val" x="${x0 + tw[i] + 8}" y="${y + rh / 2 + 4}">${r.t}</text>`;
    });
    if (opt.log) s += `<g class="tcur" opacity="0"><line x1="${x0}" x2="${x0}" y1="${top - 4}" y2="${H - 22}"/><text x="${x0}" y="${top - 10}" text-anchor="middle"></text></g>`;
    plot.innerHTML = s + '</svg>';
    const R = $$('rect.bar', plot), V = $$('text.val', plot), set = (i, w) => { R[i].setAttribute('width', w); V[i].setAttribute('x', x0 + w + 8); };
    R.forEach(b => {
      b.addEventListener('mousemove', ev => { const r = rows[+b.dataset.i]; tip.innerHTML = `<b>${r.n}</b><span>${r.tip || r.t}</span>`; tip.hidden = false; tip.style.left = (ev.clientX + 14) + 'px'; tip.style.top = (ev.clientY + 14) + 'px'; });
      b.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
    if (opt.pick) $$('.pick', plot).forEach(n => n.addEventListener('click', () => opt.pick(rows[+n.dataset.i].k)));
    const prev = el._w || {}; el._w = Object.fromEntries(rows.map((r, i) => [r.n, tw[i]]));
    if (still || opt.instant) return;
    if (!el._seen) {                                                     // first view: start empty, play when visible
      R.forEach((_, i) => set(i, 0)); V.forEach(v => v.style.opacity = 0);
      el._play = () => {
        el._seen = true; const t0 = performance.now();
        if (opt.log) {                                                   // sweep of the log time axis
          const cur = $('.tcur', plot), cl = $('line', cur), ct = $('text', cur), D = 2600, done = new Set();
          const lab = t => t < 10 ? t.toFixed(1) + ' s' : t < 60 ? Math.round(t) + ' s' : Math.round(t / 60) + ' min';
          cur.setAttribute('opacity', 1);
          const step = now => {
            const p = Math.min(1, (now - t0) / D), u = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, xc = x0 + u * Math.max(...tw);
            cl.setAttribute('x1', xc); cl.setAttribute('x2', xc); ct.setAttribute('x', xc);
            ct.textContent = lab(Math.pow(10, Math.log10(opt.min) + (xc - x0) / (x1 - x0) * (Math.log10(opt.max) - Math.log10(opt.min))));
            R.forEach((_, i) => { set(i, Math.min(tw[i], Math.max(0, xc - x0))); if (xc - x0 >= tw[i] && !done.has(i)) { done.add(i); V[i].style.transition = 'opacity .35s'; V[i].style.opacity = 1; } });
            if (p < 1) requestAnimationFrame(step); else { cur.style.transition = 'opacity .6s'; cur.setAttribute('opacity', 0); V.forEach(v => v.style.opacity = 1); }
          };
          requestAnimationFrame(step);
        } else {                                                         // bars grow one after another
          const step = now => {
            let live = false;
            R.forEach((_, i) => { const p = Math.min(1, Math.max(0, (now - t0 - i * 90) / 900)); set(i, tw[i] * (1 - Math.pow(1 - p, 3))); V[i].style.opacity = Math.min(1, p * 1.6); if (p < 1) live = true; });
            if (live) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      };
      chartIO.observe(el);
    } else if (opt.morph) {                                              // a setting changed: morph from the old widths
      const from = rows.map((r, i) => prev[r.n] ?? 0), t0 = performance.now();
      const step = now => { const p = Math.min(1, (now - t0) / 600), e = 1 - Math.pow(1 - p, 3); R.forEach((_, i) => set(i, from[i] + (tw[i] - from[i]) * e)); if (p < 1) requestAnimationFrame(step); };
      R.forEach((_, i) => set(i, from[i])); requestAnimationFrame(step);
    }
  }
  const TIME = [
    { n: 'T2LDM++', v: 1140, t: '19 min', tip: '19 min, one sample per raster', k: 't2ldmpp_n' },
    { n: 'LidarDM', v: 16, t: '16 s', k: 'lidardm' },
    { n: 'UniScene', v: 2.1, t: '2.1 s', k: 'uniscene' },
    { n: 'Ours', v: 1.3, t: '1.3 s', ours: true },
    { n: 'OpenDWM', v: 1.0, t: '1.0 s', k: 'opendwm' },
  ];
  const DMAE = {
    vlp16: [{ n: 'Occupancy', v: 1.51 }, { n: 'LidarDM', v: 0.86 }, { n: 'NKSR mesh', v: 0.55 }, { n: 'OpenDWM', v: 0.48 }, { n: 'Ours', v: 0.35, ours: true }],
    avia: [{ n: 'Occupancy', v: 1.76 }, { n: 'LidarDM', v: 0.97 }, { n: 'OpenDWM', v: 0.77 }, { n: 'NKSR mesh', v: 0.49 }, { n: 'Ours', v: 0.40, ours: true }],
  };
  const RK = { Occupancy: 'occupancy_ssc0.2', 'NKSR mesh': 'mesh_nksr', OpenDWM: 'opendwm_render', Ours: 'ours' };
  let dset = 'vlp16', dsel = 'ours', tsel = ($('#v3-fig6 .seg[data-g="m"] button[aria-pressed="true"]') || {}).dataset?.v || 'opendwm';
  const press = (sel, v) => { const b = $(`${sel} button[data-v="${v}"]`); if (b) b.click(); };
  function drawCharts(mode) {
    const ct = $('#ch-time');
    if (ct && (!mode || mode === 'resize' || mode === 'time')) bars(ct, TIME, { log: true, min: 0.5, max: 3000, ticks: [1, 10, 100, 1000], fmt: t => `${t} s`, aria: 'Time per generated scene with four scans', labelW: 84, rh: 40,
      instant: mode === 'resize', sel: tsel, pick: k => press('#v3-fig6 .seg[data-g="m"]', k) });
    const cd = $('#ch-dmae');
    if (cd && mode !== 'time') bars(cd, DMAE[dset].map(r => ({ ...r, t: r.v.toFixed(2) + ' m', k: RK[r.n] })), { max: 2, ticks: [0, 0.5, 1, 1.5, 2], fmt: t => t.toFixed(1), aria: 'Depth error on masked rays', labelW: 96, rh: 40,
      morph: mode === 'dmae', instant: mode === 'resize', sel: dsel, pick: k => press('#readout .seg[data-g="m"]', k) });
  }
  const roEl = $('#readout');
  if (roEl) roEl.addEventListener('ro', e => { const ch = e.detail.mask !== dset; dset = e.detail.mask; dsel = e.detail.m; drawCharts(ch ? 'dmae' : 'sel'); });
  $$('#v3-fig6 .seg[data-g="m"] button').forEach(b => b.addEventListener('click', () => { tsel = b.dataset.v; drawCharts('time'); }));
  drawCharts();
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawCharts('resize'), 150); });

  /* links that are not available yet */
  $$('[data-pending]').forEach(a => { a.addEventListener('click', e => e.preventDefault()); });

  /* nav state, progress, active section */
  const nav = $('nav.top'), cover = $('.cover'), prog = $('#progress');
  const onScroll = () => {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle('on', y > (cover ? cover.offsetHeight - 80 : 40));
    if (prog) prog.style.width = (h > 0 ? y / h * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('nav.top .links a'), ind = $('nav.top .links .ind');
  const mark = a => {
    links.forEach(l => l.classList.toggle('on', l === a));
    if (ind && a) { ind.style.width = a.offsetWidth + 'px'; ind.style.transform = `translateX(${a.offsetLeft}px)`; ind.style.opacity = nav.classList.contains('on') ? '1' : '0'; }
  };
  const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) mark(links.find(l => l.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  ['video', 'idea', 'results', 'method', 'cite'].forEach(id => { const s = document.getElementById(id); if (s) sio.observe(s); });

  /* reveal */
  const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => rio.observe(el));

  /* pointer glow on cards */
  $$('.spot').forEach(el => el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));

  /* lightbox */
  const lb = $('#lb'), lbi = $('#lb-img');
  $$('img[data-lb], .plate img').forEach(im => im.addEventListener('click', () => { lbi.src = im.currentSrc || im.src; lbi.alt = im.alt; lb.hidden = false; }));
  if (lb) { lb.addEventListener('click', () => { lb.hidden = true; }); addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; }); }

  /* BibTeX */
  const cb = $('#copy-bib');
  if (cb) cb.addEventListener('click', () => {
    const t = $('#bib').textContent;
    const done = () => { cb.textContent = 'Copied'; setTimeout(() => { cb.textContent = 'Copy'; }, 1600); };
    const sel = () => { const r = document.createRange(); r.selectNodeContents($('#bib')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cb.textContent = 'Selected'; };
    try { navigator.clipboard.writeText(t).then(done, sel); } catch (e) { sel(); }
  });


  /* ---------- real-data animations (idea + method) ---------- */
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fpx = (cv, base, css) => Math.max(base, Math.round(css * cv.width / (cv.clientWidth || cv.width)));   // canvas font px, at least `css` px on screen
  const COARSE = matchMedia('(pointer: coarse)').matches;

  const M = { gen_sigmas: [1, .96, .91, .86, .79, .71, .6, .46, .28, .009, 0], pred_sigmas: [1, .96, .91, .86, .79, .71, .6, .46, .28, .009, 0], rays: [] };
  const visible = (el, th = .35) => { const o = { v: false }; new IntersectionObserver(es => { o.v = es[0].isIntersecting; }, { threshold: th }).observe(el); return o; };
  const pad = k => String(k).padStart(2, '0');
  function seq(el) {
    const n = +el.dataset.n, ims = [];
    for (let k = 0; k < n; k++) {
      const im = new Image(); im.alt = ''; im.decoding = 'async'; im.loading = 'lazy';
      im.src = `assets/m/${el.dataset.seq}${pad(k)}.webp`;
      ims.push(im); el.appendChild(im);
    }
    if (el.dataset.last) { const im = new Image(); im.alt = ''; im.loading = 'lazy'; im.src = `assets/m/${el.dataset.last}.webp`; ims.push(im); el.appendChild(im); }
    const set = k => ims.forEach((im, j) => im.classList.toggle('on', j === Math.min(k, ims.length - 1)));
    set(0); return { set, n: ims.length };
  }
  const sigmaTxt = s => `noise σ = ${s < 0.005 ? '0' : s.toFixed(2)}`;

  /* step sequences drawn as one continuous blend on a canvas (no image swaps, so nothing blinks) */
  function blender(els) {
    const L = els.map(el => {
      const n = +el.dataset.n, src = [...Array(n)].map((_, k) => `assets/m/${el.dataset.seq}${pad(k)}.webp`).concat(el.dataset.last ? [`assets/m/${el.dataset.last}.webp`] : []);
      const ims = src.map(u => { const im = new Image(); im.decoding = 'async'; im.src = u; return im; });
      const cv = document.createElement('canvas'); cv.className = 'seqc'; cv.width = cv.height = 600; el.appendChild(cv);
      return { ims, cv, c: cv.getContext('2d') };
    });
    const ok = im => im && im.complete && im.naturalWidth, sm = f => f * f * (3 - 2 * f);
    const mix = (ia, ib, e) => L.forEach(({ ims, cv, c }) => {          // ims[ia] fully, ims[ib] on top with alpha e
      const A = ims[Math.min(ia, ims.length - 1)], B = ims[Math.min(ib, ims.length - 1)]; if (!ok(A)) return;
      if (cv.width !== A.naturalWidth) { cv.width = A.naturalWidth; cv.height = A.naturalHeight; }
      c.globalAlpha = 1; c.drawImage(A, 0, 0, cv.width, cv.height);
      if (e > 0 && ok(B)) { c.globalAlpha = e; c.drawImage(B, 0, 0, cv.width, cv.height); c.globalAlpha = 1; }
    });
    return { L, sm, mix, at: u => { const i = Math.min(9, Math.floor(u)), e = sm(Math.min(1, u - i)); mix(i, i + 1, e); return [i, e]; } };
  }
  // one loop for a 10-step sequence: run, hold on the clean result, fade back to noise, rest
  function stepLoop(fig, B, onU, T = { run: 6000, hold: 2600, back: 900, rest: 500 }) {
    const vis = visible(fig), TOT = T.run + T.hold + T.back + T.rest; let t0 = performance.now(), last = 0;
    if (RM) { const go = () => { B.at(10); onU(10, 1); }; B.L.forEach(l => l.ims[10] && l.ims[10].addEventListener('load', go, { once: true })); go(); return; }
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!vis.v || document.hidden) { t0 = now - last; return; }
      const t = (now - t0) % TOT; last = t;
      if (t < T.run) { const u = t / T.run * 10, [i, e] = B.at(u); onU(u, 1, i, e); }
      else if (t < T.run + T.hold) { B.at(10); onU(10, 1, 9, 1); }
      else if (t < T.run + T.hold + T.back) { const e = B.sm((t - T.run - T.hold) / T.back); B.mix(10, 0, e); onU(10 * (1 - e), 1 - e, -1, e); }
      else { B.at(0); onU(0, 0, 0, 0); }
    })(t0);
  }

  function flow() {
    const f = $('#flow'); if (!f) return;
    const B = blender([$('[data-seq="gen_z"]', f), $('[data-seq="gen_x"]', f)]), S = M.gen_sigmas;
    const sg = $('[data-sigma]', f), lis = $$('.fl-steps li', f), five = $$('.fl-t', f);
    let done = false;
    stepLoop(f, B, (u, _, i, e) => {
      const k = Math.floor(u + 1e-6), sig = i >= 0 && i !== undefined ? S[i] + (S[i + 1] - S[i]) * e : S[0] + (S[10] - S[0]) * (u / 10);
      sg.textContent = sigmaTxt(sig);
      lis.forEach((li, j) => { const p = Math.max(0, Math.min(1, u - j)); li.style.setProperty('--p', p.toFixed(3)); li.classList.toggle('on', p >= 1); });
      const end = u >= 10;
      if (end !== done) { done = end; five.forEach((t, j) => setTimeout(() => t.classList.toggle('on', end), end ? 160 * j : 0)); }
    });
  }

  function tabs(fig, n, period, onShow) {
    const btns = $$('.an-tabs button', fig), vis = visible(fig);
    let s = 0, auto = !RM;
    const show = k => { s = k; btns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.s === k))); $$('.st', fig).forEach(e => e.classList.toggle('on', +e.dataset.s === k)); onShow && onShow(k); };
    btns.forEach(b => b.addEventListener('click', () => { auto = false; show(+b.dataset.s); }));
    setInterval(() => { if (auto && vis.v && !document.hidden) show((s + 1) % n); }, period);
    show(0); return show;
  }

  const ZSTOPS = ['#111720', '#17263A', '#22477C', '#3570C8', '#57A6EE', '#A8E6F2'].map(h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)));
  const zcol = v => { const x = Math.max(0, Math.min(1, v)) * (ZSTOPS.length - 1), i = Math.min(ZSTOPS.length - 2, Math.floor(x)), t = x - i; return `rgb(${ZSTOPS[i].map((c, j) => Math.round(c + (ZSTOPS[i + 1][j] - c) * t)).join(',')})`; };

  function encode() {
    const fig = $('#enc-anim'); if (!fig) return;
    const cells = $$('.cell', fig), ov = $('canvas.grid-ov', fig), cv = $('canvas.unroll', fig), W = 1200, C = 600, SC = W / 80, vis = visible(fig, .2);
    const g = ov.getContext('2d');
    function grid(f) {                                           // the HCS grid drawn ring by ring, f = 0..1
      g.clearRect(0, 0, W, W); g.strokeStyle = 'rgba(210,222,235,.32)'; g.lineWidth = 2;
      for (let r = 5; r <= 40 * f + .01; r += 5) { g.beginPath(); g.arc(C, C, r * SC, 0, 2 * Math.PI); g.stroke(); }
      for (let j = 0; j < 80 * f; j += 2) { const t = -Math.PI + j * 2 * Math.PI / 80; g.globalAlpha = j % 10 === 0 ? 1 : .4; g.beginPath(); g.moveTo(C, C); g.lineTo(C - Math.sin(t) * 40 * SC, C - Math.cos(t) * 40 * SC); g.stroke(); }
      g.globalAlpha = 1;
    }
    let val = null; const im = new Image(); im.src = 'assets/m/enc_dev.png';
    const ctx = cv.getContext('2d'), RW = 1120, RH = 560, RX = 40, RY = 250, cw = RW / 80, ch = RH / 40;
    const pol = (rho, j) => { const t = -Math.PI + j * 2 * Math.PI / 80; return [C - rho * Math.sin(t) * SC, C - rho * Math.cos(t) * SC]; };
    const rec = (i, j) => [RX + j * cw, RY + (40 - i) * ch];
    function unroll(t, a) {
      ctx.fillStyle = '#0E1217'; ctx.fillRect(0, 0, W, W); if (!val || a <= 0) return;
      const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; ctx.globalAlpha = a;
      for (let i = 0; i < 40; i++) for (let j = 0; j < 80; j++) {
        const q = [[i, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]].map(([u, v]) => { const p = pol(u, v), r = rec(u, v); return [p[0] + (r[0] - p[0]) * e, p[1] + (r[1] - p[1]) * e]; });
        ctx.fillStyle = zcol(val[i * 80 + j]); ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.closePath(); ctx.fill();
      }
      if (e > .98) {
        ctx.fillStyle = 'rgba(220,230,240,.85)'; ctx.font = '500 40px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        ctx.fillText('azimuth θ', C, RY + RH + 70); ctx.textAlign = 'left'; ctx.fillText('radius ρ ↑', RX, RY - 40);
      }
      ctx.globalAlpha = 1;
    }
    im.onload = () => { const c2 = document.createElement('canvas'); c2.width = 80; c2.height = 80; const x = c2.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, 80, 80).data; val = new Float32Array(6400); for (let i = 0; i < 6400; i++) val[i] = d[i * 4] / 255; };
    const op = (el, v) => { if (el) el.style.opacity = Math.max(0, Math.min(1, v)); };
    const ramp = (u, a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));
    // timeline (s): panel 1 in 0-.6; panel 2 scan in .9-1.3, grid 1.3-2.1, cells 2.1-2.7; panel 3 cells in 3.0-3.4, latent 3.6-4.2;
    // panel 4 disc in 4.5-4.9, unroll 5.2-6.8; hold to 10
    const TOT = 10;
    function frame(u) {
      op($('.sA', cells[0]), ramp(u, 0, .6));
      op($('.sA', cells[1]), ramp(u, .9, 1.3)); grid(ramp(u, 1.3, 2.1) * (1 - ramp(u, 2.1, 2.7) * .4)); op(ov, ramp(u, .9, 1.3)); op($('.sB', cells[1]), ramp(u, 2.1, 2.7));
      op($('.sA', cells[2]), ramp(u, 3.0, 3.4)); op($('.sB', cells[2]), ramp(u, 3.6, 4.2));
      unroll(ramp(u, 5.2, 6.8), ramp(u, 4.5, 4.9));
      cells.forEach((c, i) => c.classList.toggle('lit', u >= [0, .9, 3.0, 4.5][i]));
    }
    if (RM) { frame(TOT); return; }
    let t0 = performance.now();
    (function loop(now) { requestAnimationFrame(loop); if (!vis.v || document.hidden) { t0 = now - ((now - t0) % (TOT * 1000)); return; } frame(((now - t0) / 1000) % TOT); })(performance.now());
  }

  function denoise() {                                                 // Euler steps as one continuous blend
    const fig = $('#den-anim'); if (!fig) return;
    const B = blender($$('[data-seq]', fig)), S = M.pred_sigmas, sg = $('[data-sigma]', fig), bar = $('.an-meter b', fig);
    if (bar) bar.style.transition = 'none';
    stepLoop(fig, B, (u, _, i, e) => {
      const sig = i >= 0 && i !== undefined ? S[i] + (S[i + 1] - S[i]) * e : S[0] + (S[10] - S[0]) * (u / 10);
      sg.textContent = sigmaTxt(sig); if (bar) bar.style.width = (u * 10) + '%';
    });
  }

  function warp() {
    const fig = $('#warp-anim'); if (!fig) return;
    const lab = $('[data-l]', fig), L = ['Reference · t − 0.5 s', 'Aligned to t', 'Predicted · t'];
    tabs(fig, 3, 2400, k => { lab.textContent = L[k]; });
  }

  function inspector() {
    const fig = $('#insp'); if (!fig || !M.rays.length) return;
    const cv = $('canvas', fig), ctx = cv.getContext('2d'), W = 1200, C = 600, SC = W / 80;
    const segEl = $('.seg', fig), plot = $('.in-plot', fig), vals = $('.in-vals', fig), lab = $('#in-lab'), vis = visible(fig);
    const NAMES = { car: 'Car', facade: 'Wall', building: 'Building', road: 'Road', pole: 'Pole', sky: 'Sky' };
    const img = src => { const i = new Image(); i.src = src; return i; };
    const base = img('assets/m/dec_base.webp'), all = img('assets/m/dec_vs_meas.webp'), att = {};
    M.rays.forEach(r => { att[r.name] = img(`assets/m/att_${r.name}.png`); });
    const keys = M.rays.map(r => r.name).concat(['all']);
    segEl.innerHTML = keys.map(k => `<button type="button" data-k="${k}" aria-pressed="false">${k === 'all' ? 'All rays' : NAMES[k] || k}</button>`).join('');
    let cur = keys[0], t0 = 0, raf = 0, auto = !RM;
    const bev = (r, d) => { const h = d * Math.cos(r.el * Math.PI / 180), a = r.az * Math.PI / 180; return [C - h * Math.sin(a) * SC, C - h * Math.cos(a) * SC]; };
    function plotRay(r) {
      if (!r) { plot.innerHTML = ''; vals.innerHTML = `<dt>rays</dt><dd>${M.vlp16_rays || 28800}</dd><dt>returns</dt><dd>${M.vlp16_hits || ''} with p ≥ 0.5</dd>`; return; }
      const E = M.bin_edges, w = 520, h = 190, x0 = 34, x1 = w - 10, y1 = h - 34, lx = d => x0 + (Math.log(d) - Math.log(E[0])) / (Math.log(E[E.length - 1]) - Math.log(E[0])) * (x1 - x0);
      const mx = Math.max(...r.bins) || 1;
      let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Depth-bin distribution of the ray"><line class="ax" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>`;
      r.bins.forEach((p, i) => { const a = lx(E[i]), b = lx(E[i + 1]), hh = p / mx * (y1 - 16); s += `<rect class="bin" x="${a + .4}" y="${y1 - hh}" width="${Math.max(.6, b - a - .8)}" height="${hh}"/>`; });
      [2.5, 5, 10, 20, 40, 70].forEach(d => { s += `<text class="tk" x="${lx(d)}" y="${y1 + 18}" text-anchor="middle">${d} m</text>`; });
      if (r.p >= .5) {
        s += `<line class="d0" x1="${lx(r.d0)}" x2="${lx(r.d0)}" y1="8" y2="${y1}"/><line class="dh" x1="${lx(r.dhat)}" x2="${lx(r.dhat)}" y1="8" y2="${y1}"/>`;
        if (r.meas) s += `<line class="ms" x1="${lx(r.meas)}" x2="${lx(r.meas)}" y1="${y1 - 6}" y2="${y1 + 6}"/>`;
      }
      s += '</svg>';
      if (r.p >= .5) {                                                   // linear close-up: the chosen bin, d0 inside it, the refined depth and the recorded return
        const lo0 = Math.min(E[r.b], r.d0, r.dhat, r.meas || r.dhat), hi0 = Math.max(E[r.b + 1], r.d0, r.dhat, r.meas || r.dhat), pad = Math.max(.25, (hi0 - lo0) * .12);
        const lo = lo0 - pad, hi = hi0 + pad, zx = d => x0 + (d - lo) / (hi - lo) * (x1 - x0), zh = 104, zy = 70, st = hi - lo > 3 ? 1 : hi - lo > 1.2 ? .5 : .2;
        let z = `<svg class="zoom" viewBox="0 0 ${w} ${zh}" role="img" aria-label="Close-up of the depth refinement"><rect class="zb" x="${zx(E[r.b])}" y="${zy - 16}" width="${zx(E[r.b + 1]) - zx(E[r.b])}" height="22" rx="3"/>`;
        z += `<text class="tk" x="${zx(E[r.b + 1]) - 4}" y="${zy - 21}" text-anchor="end">bin ${r.b}</text><line class="ax" x1="${x0}" x2="${x1}" y1="${zy + 6}" y2="${zy + 6}"/>`;
        for (let t = Math.ceil(lo / st) * st; t <= hi; t += st) z += `<line class="ax" x1="${zx(t)}" x2="${zx(t)}" y1="${zy + 6}" y2="${zy + 10}"/><text class="tk" x="${zx(t)}" y="${zy + 26}" text-anchor="middle">${t.toFixed(st < 1 ? 1 : 0)}</text>`;
        if (r.meas) z += `<line class="ms" x1="${zx(r.meas)}" x2="${zx(r.meas)}" y1="${zy - 20}" y2="${zy + 8}"/>`;
        const dd = r.dhat - r.d0;
        if (Math.abs(dd) > .04) { const a = zx(r.d0), b = zx(r.dhat), dir = Math.sign(b - a);
          z += `<path class="za" d="M${a + dir * 7},${zy - 5} L${b - dir * 9},${zy - 5}"/><path class="zh" d="M${b - dir * 7},${zy - 5} l${-dir * 7},-4.5 v9 z"/>`;
          z += `<text class="zl" x="${Math.max(x0 + 60, Math.min(x1 - 60, (a + b) / 2))}" y="${zy - 40}" text-anchor="middle">refined ${dd >= 0 ? '+' : '−'}${Math.abs(dd).toFixed(2)} m</text>`; }
        z += `<circle class="z0" cx="${zx(r.d0)}" cy="${zy - 5}" r="6"/><circle class="z1" cx="${zx(r.dhat)}" cy="${zy - 5}" r="6"/>`;
        s += z + '</svg>';
      }
      plot.innerHTML = s;
      const f = v => v.toFixed(2) + ' m';
      vals.innerHTML = `<dt>p<sub>i</sub></dt><dd>${r.p.toFixed(3)}${r.p < .5 ? '  (miss)' : ''}</dd>` + (r.p >= .5 ? `<dt>d⁰<sub>i</sub></dt><dd>${f(r.d0)}  bin ${r.b}</dd><dt>δ<sub>i</sub></dt><dd>${Math.abs(r.delta) < 5e-4 ? '0.000' : (r.delta > 0 ? '+' : '−') + Math.abs(r.delta).toFixed(3)}  (${Math.abs(r.dhat - r.d0) < .005 ? '0.00' : (r.dhat > r.d0 ? '+' : '−') + Math.abs(r.dhat - r.d0).toFixed(2)} m)</dd><dt>d̂<sub>i</sub></dt><dd>${f(r.dhat)}</dd><dt>measured</dt><dd>${r.meas ? f(r.meas) : '—'}</dd>` : '<dt>measured</dt><dd>no return</dd>');
    }
    function draw(now) {
      const t = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - t, 3);
      ctx.fillStyle = '#0E1217'; ctx.fillRect(0, 0, W, W);
      if (cur === 'all') {
        if (all.complete) ctx.drawImage(all, 0, 0, W, W); lab.textContent = 'Decoded VLP-16 (color) over the recorded HDL-64E scan (gray)';
        const IF = fpx(cv, 30, 12); ctx.font = `600 ${IF}px Inter, sans-serif`;
        const pts = M.rays.map(r => ({ r, q: bev(r, r.p >= .5 ? r.dhat : Math.min(38, 30)) }));
        const boxes = pts.map(({ q }) => [q[0] - 16, q[1] - 16, 32, 32]), hit = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
        pts.forEach(({ r, q }) => { ctx.strokeStyle = r.p >= .5 ? '#3FBF6F' : 'rgba(233,238,244,.7)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(q[0], q[1], 12, 0, 2 * Math.PI); ctx.stroke(); });
        pts.forEach(({ r, q }) => {                                          // greedy label placement: first free spot around the marker, with a leader if moved away
          const t = NAMES[r.name] || r.name, w = ctx.measureText(t).width, h = Math.round(IF * 1.13);
          const C = [[24, 0], [-24 - w, 0], [-w / 2, -42], [-w / 2, 42], [40, -46], [40, 46], [-40 - w, -46], [-40 - w, 46], [70, -90], [70, 90], [-70 - w, -90], [-70 - w, 90], [110, 0], [-110 - w, 0]];
          let pick = C[0];
          for (const c of C) { const b = [q[0] + c[0] - 6, q[1] + c[1] - h / 2 - 4, w + 12, h + 8]; if (b[0] > 4 && b[0] + b[2] < W - 4 && b[1] > 70 && b[1] + b[3] < W - 4 && !boxes.some(x => hit(x, b))) { pick = c; boxes.push(b); break; } }
          const lx = q[0] + pick[0], ly = q[1] + pick[1];
          if (Math.abs(pick[1]) > 1 || Math.abs(pick[0]) > 30) { const ex = Math.max(lx - 4, Math.min(lx + w + 4, q[0])), ey = Math.max(ly - h / 2, Math.min(ly + h / 2, q[1]));
            const d = Math.hypot(ex - q[0], ey - q[1]) || 1; ctx.strokeStyle = 'rgba(233,238,244,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q[0] + (ex - q[0]) / d * 14, q[1] + (ey - q[1]) / d * 14); ctx.lineTo(ex, ey); ctx.stroke(); }
          ctx.fillStyle = 'rgba(14,18,23,.72)'; ctx.fillRect(lx - 5, ly - h / 2, w + 10, h);
          ctx.fillStyle = '#E9EEF4'; ctx.textBaseline = 'middle'; ctx.fillText(t, lx, ly + 1); ctx.textBaseline = 'alphabetic';
        });
        return;
      }
      const r = M.rays.find(x => x.name === cur);
      if (base.complete) ctx.drawImage(base, 0, 0, W, W);
      ctx.globalAlpha = e; if (att[cur].complete) ctx.drawImage(att[cur], 0, 0, W, W); ctx.globalAlpha = 1;
      const end = bev(r, Math.min(40 / Math.cos(r.el * Math.PI / 180), 40)), cur2 = [C + (end[0] - C) * Math.min(1, t * 1.6), C + (end[1] - C) * Math.min(1, t * 1.6)];
      ctx.strokeStyle = 'rgba(235,240,245,.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(cur2[0], cur2[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#E9EEF4'; ctx.beginPath(); ctx.arc(C, C, 8, 0, 2 * Math.PI); ctx.fill();
      if (r.p >= .5 && t > .55) {
        const p0 = bev(r, r.d0), p1 = bev(r, r.dhat);
        ctx.strokeStyle = '#F0A061'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p0[0], p0[1], 15, 0, 2 * Math.PI); ctx.stroke();
        if (t > .8) { ctx.fillStyle = '#3FBF6F'; ctx.beginPath(); ctx.arc(p1[0], p1[1], 10, 0, 2 * Math.PI); ctx.fill();
          if (r.meas) { const pm = bev(r, r.meas); ctx.strokeStyle = '#E9EEF4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pm[0], pm[1], 20, 0, 2 * Math.PI); ctx.stroke(); } }
      }
      lab.textContent = `${NAMES[cur] || cur} · azimuth ${r.az.toFixed(0)}°, elevation ${r.el.toFixed(0)}°`;
      if (t < 1) raf = requestAnimationFrame(draw);
    }
    const sel = k => { cur = k; $$('button', segEl).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k))); plotRay(M.rays.find(x => x.name === k)); cancelAnimationFrame(raf); t0 = performance.now() - (RM ? 2000 : 0); raf = requestAnimationFrame(draw); };
    $$('button', segEl).forEach(b => b.addEventListener('click', () => { auto = false; sel(b.dataset.k); }));
    [base, all].concat(Object.values(att)).forEach(i => i.addEventListener('load', () => { t0 = Math.min(t0, performance.now() - 2000); raf = requestAnimationFrame(draw); }));
    setInterval(() => { if (!auto || !vis.v || document.hidden) return; const i = keys.indexOf(cur); sel(keys[(i + 1) % keys.length]); }, 3400);
    sel(keys[0]);
  }

  fetch('assets/m/meta.json').then(r => r.json()).then(j => Object.assign(M, j)).catch(() => {}).finally(() => { flow(); encode(); denoise(); inspector(); });


  /* ---------- 3D viewers (three.js): two views that turn together ---------- */
  const HSTOPS = ['#3558E6', '#3F74EE', '#4A94F0', '#57B4EE', '#6BD0EC', '#9AE8F0'].map(h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255));
  const hcol = z => { const x = Math.max(0, Math.min(1, (z + 2.2) / 5.2)) * (HSTOPS.length - 1), i = Math.min(HSTOPS.length - 2, Math.floor(x)), t = x - i; return HSTOPS[i].map((c, j) => c + (HSTOPS[i + 1][j] - c) * t); };
  const cache3 = {};
  const loadPts = name => cache3[name] || (cache3[name] = fetch(`assets/v3/${name}.txt`).then(r => { if (!r.ok) throw new Error(name); return r.text(); }).then(t => {
    const raw = atob(t.trim()), u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    const q = new Int16Array(u8.buffer), n = q.length / 3, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const x = q[3 * i] / 100, y = q[3 * i + 1] / 100, z = q[3 * i + 2] / 100; pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z; const c = hcol(z); col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; }
    return { pos, col };
  }));
  function boxLines(T, b, color, dashed) {
    const [cx, cy, cz, l, w, h, yaw] = b, c = Math.cos(yaw), s = Math.sin(yaw), P = [];
    const pt = (dx, dy, dz) => [cx + c * dx - s * dy, cy + s * dx + c * dy, cz + dz];
    const k = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b2]) => [a * l / 2, b2 * w / 2]);
    for (let i = 0; i < 4; i++) {
      const [a1, b1] = k[i], [a2, b3] = k[(i + 1) % 4];
      [-h / 2, h / 2].forEach(z => P.push(...pt(a1, b1, z), ...pt(a2, b3, z)));
      P.push(...pt(a1, b1, -h / 2), ...pt(a1, b1, h / 2));
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    const m = dashed ? new T.LineDashedMaterial({ color, dashSize: .35, gapSize: .25, transparent: true, opacity: .95 }) : new T.LineBasicMaterial({ color, transparent: true, opacity: .9 });
    const L = new T.LineSegments(g, m); if (dashed) L.computeLineDistances(); return L;
  }
  function viewer3(fig, IDX) {
    const T = window.THREE; if (!T || !T.OrbitControls) return;
    const cvs = $$('canvas', fig), cam = new T.PerspectiveCamera(42, 4 / 3, .5, 400);
    cam.up.set(0, 0, 1);
    const HOME = fig.dataset.kind === 'edit' ? { pos: [-14, -16, 20], tgt: [6, 2, -1] } : fig.dataset.kind === 'lab' ? { pos: [-20, -24, 18], tgt: [6, 0, -1] } : fig.dataset.kind === 'cond' ? { pos: [7.6, 0, 62], tgt: [8, 0, -1] } : { pos: [5.6, 0, 72], tgt: [6, 0, -1] };
    const R = cvs.map(cv => { const r = new T.WebGLRenderer({ canvas: cv, antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setClearColor(0x0E1217, 1); return r; });
    const S = cvs.map(() => new T.Scene());
    const ctl = cvs.map(cv => { const c = new T.OrbitControls(cam, cv); c.enableDamping = false; c.screenSpacePanning = true; c.minDistance = 4; c.maxDistance = 120; c.maxPolarAngle = Math.PI * .495; return c; });
    if (fig.dataset.kind === 'fig6') ctl.forEach(c => {   // top view only: no rotation, drag pans, wheel or pinch zooms
      c.enableRotate = false; c.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN }; c.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_PAN };
    });
    let need = true; const draw = () => { need = true; };
    const home = () => { cam.position.set(...HOME.pos); ctl.forEach(c => { c.target.set(...HOME.tgt); c.update(); }); draw(); };
    ctl.forEach(c => c.addEventListener('change', () => { ctl.forEach(o => { if (o !== c) o.target.copy(c.target); }); draw(); }));
    cvs.forEach(cv => cv.addEventListener('dblclick', home));
    const size = () => { const r = { width: cvs[0].clientWidth, height: cvs[0].clientHeight }; if (!r.width) return; R.forEach(x => x.setSize(r.width, r.height, false)); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); draw(); };
    addEventListener('resize', size);
    const vis = visible(fig, .05);
    (function loop() { requestAnimationFrame(loop); if (need && vis.v) { need = false; R.forEach((r, i) => r.render(S[i], cam)); } })();
    const mat = new T.PointsMaterial({ size: 2.0, sizeAttenuation: false, vertexColors: true });
    const setPts = (i, data) => {
      S[i].children.filter(o => o.isPoints).forEach(o => { S[i].remove(o); o.geometry.dispose(); });
      if (data) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(data.pos, 3)); g.setAttribute('color', new T.BufferAttribute(data.col, 3)); S[i].add(new T.Points(g, mat)); }
      draw();
    };
    const setBoxes = (i, list) => {
      S[i].children.filter(o => o.isLineSegments).forEach(o => { S[i].remove(o); o.geometry.dispose(); });
      list.forEach(([b, c, d]) => S[i].add(boxLines(T, b, c, d))); draw();
    };
    const st = {}; $$('.seg', fig).forEach(sg => { const on = $('button[aria-pressed="true"]', sg); st[sg.dataset.g] = on && on.dataset.v; });
    const msg = $('.v3-msg', fig), labs = $$('[data-l]', fig);
    if (fig.dataset.sc) st.sc = fig.dataset.sc;
    const setRays = (i, list) => {
      S[i].children.filter(o => o.isLineSegments && o.userData.ray).forEach(o => { S[i].remove(o); o.geometry.dispose(); });
      list.forEach(([ends, rgb, fade, op]) => {
        const n = ends.length / 3, P = new Float32Array(n * 6), C = new Float32Array(n * 6);
        for (let j = 0; j < n; j++) { P[6 * j + 3] = ends[3 * j]; P[6 * j + 4] = ends[3 * j + 1]; P[6 * j + 5] = ends[3 * j + 2];
          for (let c = 0; c < 3; c++) { C[6 * j + c] = rgb[c]; C[6 * j + 3 + c] = rgb[c] * fade; } }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3));
        const L = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: op })); L.userData.ray = true; S[i].add(L);
      });
      draw();
    };
    const LN = { single: 'Single scan · 64 × 1024 rays', agg: 'Aggregated scan', pat: 'Random raster pattern · 86 × 1,829 rays' };
    const LC = {
      single: 'One recorded KITTI-360 scan. A sample of its rays is drawn: rays that return a point (teal) are supervised with that depth, and rays without a return (red) are labeled misses. Of the 65,536 rays of this scan, 49,505 return a point.',
      agg: 'The aggregated scan adds the static surfaces seen from other poses, so the decoder is also supervised between the beams of a single scan.',
      pat: 'Half of the aggregated scans are re-observed with a random pattern, here a raster of 86 × 1,829 rays. The encoder receives only the 54,372 rays of this pattern that hit (a few are drawn), so it learns to encode sparse and unusual patterns.' };
    const NM = { real: 'Reference · real HeLiPR scan', t2ldmpp_n: 'T2LDM++', uniscene: 'UniScene', opendwm: 'OpenDWM', lidardm: 'LidarDM' };
    const SN = { ouster: 'OS2-128', velodyne: 'VLP-16', aeva: 'Aeries II', avia: 'Avia' };
    function update() {
      if (fig.dataset.kind === 'cond') {
        window._condIdx = window._condIdx || fetch('assets/v4/cond_index.json').then(r => r.json());
        const want = `${st.ds}${st.i}`;
        window._condIdx.then(L => {
          const e = L.filter(x => x.ds === st.ds)[+st.i]; if (!e || `${st.ds}${st.i}` !== want) return;
          loadPack(e.key + '_real').then(f => { if (`${st.ds}${st.i}` === want) setPts(0, { pos: f[0], col: colorize(f[0], 0) }); });
          loadPack(e.key + '_gen').then(f => { if (`${st.ds}${st.i}` === want) setPts(1, { pos: f[0], col: colorize(f[0], 0) }); });
          const bx = e.boxes.map(b => [b, 0xE69F00, false]); setBoxes(0, bx); setBoxes(1, bx);
          [0, 1].forEach(i => { S[i].children.filter(o => o.userData.map).forEach(o => { S[i].remove(o); o.geometry.dispose(); });
            if (!e.map) return; const zg = -1.8, add = o => { o.userData.map = true; S[i].add(o); };
            e.map.drivable.forEach(poly => {
              const sh = new T.Shape(poly.map(([x, y]) => new T.Vector2(x, y)));
              const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: 0x5C7A99, transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false }));
              m.position.z = zg; add(m);
              const g = new T.BufferGeometry().setFromPoints(poly.map(([x, y]) => new T.Vector3(x, y, zg)));
              add(new T.Line(g, new T.LineBasicMaterial({ color: 0x8FB0D0, transparent: true, opacity: .55 })));
            });
            [['divider', 0xE8C547, .8], ['crossing', 0xE9EEF4, .6]].forEach(([k, col, op]) => e.map[k].forEach(l => {
              const g = new T.BufferGeometry().setFromPoints(l.map(([x, y]) => new T.Vector3(x, y, zg + .02)));
              add(new T.Line(g, new T.LineBasicMaterial({ color: col, transparent: true, opacity: op })));
            }));
            draw(); });
        });
        return;
      }
      if (fig.dataset.kind === 'lab') {
        labs[0].textContent = LN[st.k]; const cap = $('[data-cap]', fig); if (cap) cap.textContent = LC[st.k];
        const name = { single: 'lab_single_pts', agg: 'lab_agg_pts', pat: 'lab_pat_pts' }[st.k], want = st.k;
        loadPack(name).then(f => { if (st.k === want) setPts(0, { pos: f[0], col: colorize(f[0], 0) }); });
        if (st.k === 'single') Promise.all([loadPack('lab_single_hitray'), loadPack('lab_single_missray')]).then(([h, m]) => { if (st.k === 'single') setRays(0, [[h[0], [.42, .78, .75], .9, .35], [m[0], [.89, .2, .17], .05, .55]]); });
        else if (st.k === 'pat') loadPack('lab_pat_hitray').then(h => { if (st.k === 'pat') setRays(0, [[h[0], [.42, .78, .75], .9, .45]]); });
        else setRays(0, []);
        return;
      }
      if (fig.dataset.kind === 'fig6') {
        labs[0].textContent = NM[st.m];
        const k = `${st.m}_${st.s}`, has = IDX.fig6[k];
        if (msg) { msg.hidden = !!has; msg.textContent = has ? '' : `${NM[st.m]} has no output for the ${SN[st.s]} rays`; }
        if (has) loadPts(`f6_${k}`).then(d => setPts(0, d)); else setPts(0, null);
        loadPts(`f6_ours_${st.s}`).then(d => setPts(1, d));
      } else {
        const E = IDX.edit[st.sc], removal = st.e === 'rm';
        labs[0].textContent = removal ? 'Car removed' : 'Car added';
        const inBox = (d, b, pad) => {   // points of d inside box b (x y z l w h yaw), padded
          const [cx, cy, cz, l, w, h, yaw] = b, c = Math.cos(yaw), sn = Math.sin(yaw), out = [];
          for (let j = 0; j < d.pos.length; j += 3) { const dx = d.pos[j] - cx, dy = d.pos[j + 1] - cy, u = c * dx + sn * dy, v = -sn * dx + c * dy;
            if (Math.abs(u) < l / 2 + pad && Math.abs(v) < w / 2 + pad && Math.abs(d.pos[j + 2] - cz) < h / 2 + pad) out.push(d.pos[j], d.pos[j + 1], d.pos[j + 2]); }
          return new Float32Array(out);
        };
        const hl = (i, pos, color) => { if (!pos.length) return; const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
          S[i].add(new T.Points(g, new T.PointsMaterial({ size: 4.5, sizeAttenuation: false, color }))); draw(); };
        const want = `${st.sc}${st.e}${st.p}`;
        loadPts(`ed_${st.sc}_orig_${st.p}`).then(d => { if (`${st.sc}${st.e}${st.p}` !== want) return; setPts(0, d); if (removal) hl(0, inBox(d, E.box7.rm, .3), 0xF26B5B); });
        loadPts(`ed_${st.sc}_${st.e}_${st.p}`).then(d => { if (`${st.sc}${st.e}${st.p}` !== want) return; setPts(1, d); if (!removal) hl(1, inBox(d, E.box7.add, .3), 0x5BE08A); });
        const oth = E.box7.oth.map(b => [b, 0x8A96A3, false]);
        setBoxes(0, oth.concat([[E.box7.rm, removal ? 0xE2322B : 0x8A96A3, false]]));
        setBoxes(1, oth.concat(removal ? [[E.box7.rm, 0xE2322B, true]] : [[E.box7.rm, 0x8A96A3, false], [E.box7.add, 0x3FBF6F, false]]));
      }
    }
    $$('.seg', fig).forEach(sg => $$('button', sg).forEach(b => b.addEventListener('click', () => {
      $$('button', sg).forEach(x => x.setAttribute('aria-pressed', String(x === b))); st[sg.dataset.g] = b.dataset.v; update();
    })));
    home(); size(); update();
  }
  function viewers() {
    const figs = $$('.v3d'); if (!figs.length) return;
    fetch('assets/v3/index.json').then(r => r.json()).then(IDX => figs.forEach(f => {
      const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); viewer3(f, IDX); } }, { rootMargin: '300px 0px' }); io.observe(f);
    })).catch(() => {});
  }
  viewers();




  /* ---------- packed point sequences: [u32 n][u32 counts][i16 xyz cm], base64 ---------- */
  const packs = {};
  const loadPack = name => packs[name] || (packs[name] = fetch(`assets/v4/${name}.txt`).then(r => { if (!r.ok) throw new Error(name); return r.text(); }).then(t => {
    const raw = atob(t.trim()), u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    const dv = new DataView(u8.buffer), n = dv.getUint32(0, true), cnt = []; for (let i = 0; i < n; i++) cnt.push(dv.getUint32(4 + 4 * i, true));
    let off = 4 + 4 * n; const out = [];
    cnt.forEach(c => { const q = new Int16Array(u8.buffer.slice(off, off + c * 6)); off += c * 6; const pos = new Float32Array(c * 3); for (let i = 0; i < c * 3; i++) pos[i] = q[i] / 100; out.push(pos); });
    return out;
  }));
  const colorize = (pos, z0) => { const n = pos.length / 3, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const c = hcol(pos[3 * i + 2] - (z0 || 0)); col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; } return col; };

  /* ---------- one prediction, six synchronized views in one canvas ---------- */
  function multiPred() {
    const fig = $('#v3-pred'), T = window.THREE; if (!fig || !T || !T.OrbitControls) return;
    const cv = $('canvas', fig), wrap = $('.v3m-wrap', fig), labs = $$('.lab', wrap), vis = visible(fig, .05);
    const SRC = ['measured', 'hdl64', 'os2_128', 'vlp16', 'aeva', 'avia'];
    const R = new T.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.setClearColor(0x0E1217, 1); R.setScissorTest(true);
    const cam = new T.PerspectiveCamera(40, 1, .5, 500); cam.up.set(0, 0, 1);
    const ctl = new T.OrbitControls(cam, cv); ctl.enableDamping = false; ctl.screenSpacePanning = true; ctl.minDistance = 6; ctl.maxDistance = 160;
    const S = SRC.map(() => new T.Scene()), mat = new T.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true });
    let need = true, frames = {}, k = 0, playing = !RM, cols = 3, M = null;
    const draw = () => { need = true; }; ctl.addEventListener('change', draw);
    const tl = $('[data-tl]', fig), sl = $('[data-t]', fig), pb = $('[data-play]', fig);
    function home() {
      if (!M) return; const e = M.ego[4], y = M.yaw[4], f = [Math.cos(y), Math.sin(y)];
      const tg = [e[0] + 6 * f[0], e[1] + 6 * f[1], e[2] - 1.5];
      cam.position.set(tg[0] - f[0] * .4, tg[1] - f[1] * .4, tg[2] + 62); ctl.target.set(...tg); ctl.update(); draw();
    }
    function layout() {
      const r = { width: wrap.clientWidth }; if (!r.width) return; cols = r.width < 640 ? 2 : 3; const rows = 6 / cols;   // layout px: unchanged by page zoom
      R.setSize(r.width, r.width / cols * rows * .75, false); cv.style.height = (r.width / cols * rows * .75) + 'px';
      labs.forEach((l, i) => { l.style.left = (i % cols) * (100 / cols) + '%'; l.style.top = Math.floor(i / cols) * (100 / rows) + '%'; });
      cam.aspect = 4 / 3; cam.updateProjectionMatrix(); draw();
    }
    function setFrame(i) {
      k = i; sl.value = i; if (M) tl.textContent = `t = +${M.times[i].toFixed(1)} s`;
      SRC.forEach((s, j) => {
        const f = frames[s]; if (!f) return;
        S[j].children.slice().forEach(o => { S[j].remove(o); o.geometry.dispose(); });
        const g = new T.BufferGeometry(), pos = f[i]; g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(colorize(pos, M ? M.ego[i][2] : 0), 3)); S[j].add(new T.Points(g, mat));
      });
      draw();
    }
    (function loop() {
      requestAnimationFrame(loop); if (!need || !vis.v) return; need = false;
      const w = cv.clientWidth, h = cv.clientHeight, cw = w / cols, ch = h / (6 / cols);
      S.forEach((sc, j) => { const x = (j % cols) * cw, y = h - (Math.floor(j / cols) + 1) * ch; R.setViewport(x + 1, y + 1, cw - 2, ch - 2); R.setScissor(x + 1, y + 1, cw - 2, ch - 2); R.render(sc, cam); });
    })();
    addEventListener('resize', layout);
    sl.addEventListener('input', () => { playing = false; pb.textContent = 'Play'; setFrame(+sl.value); });
    pb.addEventListener('click', () => { playing = !playing; pb.textContent = playing ? 'Pause' : 'Play'; });
    $('[data-home]', fig).addEventListener('click', home);
    cv.addEventListener('dblclick', home);
    pb.textContent = playing ? 'Pause' : 'Play';
    fetch('assets/v4/meta.json').then(r => r.json()).then(j => { M = j.pred; layout(); home(); return Promise.all(SRC.map(s => loadPack(`pred_${s}`).then(f => { frames[s] = f; }))); })
      .then(() => { setFrame(0); setInterval(() => { if (playing && vis.v && !document.hidden) setFrame((k + 1) % M.times.length); }, 450); }).catch(() => {});
  }

  /* ---------- sequence prediction: sample picker (G = same scene, two given paths, three clips) ---------- */
  (function seqPick() {
    const seg = $('#seq-pick'), g = $('#seq-clips'); if (!seg || !g) return;
    const figs = $$('figure', g), vs = figs.map(f => $('video', f)), labs = figs.map(f => $('.lab', f)), cap = $('#seq-cf-note'), icap = $('#seq-int-note'), ccap = $('#seq-car-note');
    const set = (v, src) => { v.poster = src + '.jpg'; v.dataset.src = src + '.mp4'; v.src = v.dataset.src; const p = v.play(); if (p) p.catch(() => {}); };
    const L = { cf: ['Recorded future', 'Predicted · recorded path', 'Predicted · lane change'], int: ['Predicted · left turn', 'Predicted · straight', 'Predicted · right turn (recorded path)'],
                car: ['Predicted · car stops (recorded boxes)', 'Predicted · car goes straight', 'Predicted · car turns right'], one: ['Recorded future', 'Predicted future', ''] };
    $$('button', seg).forEach(b => b.addEventListener('click', () => {
      $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const v = b.dataset.v, three = v === 'cf' || v === 'int' || v === 'car', mode = three ? v : 'one';
      figs[2].hidden = !three; g.classList.toggle('c2', !three); if (cap) cap.hidden = v !== 'cf'; if (icap) icap.hidden = v !== 'int'; if (ccap) ccap.hidden = v !== 'car';
      if (v === 'cf') ['cf_recorded', 'cf_pred_rec', 'cf_pred_alt'].forEach((t, i) => set(vs[i], `assets/video/${t}`));
      else if (v === 'int') ['int_left', 'int_straight', 'int_right'].forEach((t, i) => set(vs[i], `assets/video/${t}`));
      else if (v === 'car') ['int_car_rec', 'int_car_straight', 'int_car_right'].forEach((t, i) => set(vs[i], `assets/video/${t}`));
      else ['measured', 'hdl64'].forEach((m, i) => set(vs[i], `assets/video/${v}_${m}`));
      labs.forEach((l, i) => { if (L[mode][i]) l.textContent = L[mode][i]; });
      labs[0].classList.toggle('ours', v === 'int' || v === 'car');    // the first panel is a prediction only in H and I
    }));
  })();

  /* ---------- place recognition along the drive (two models, same queries) ---------- */
  function lpr() {
    const cvs = $$('canvas.lpr'); if (!cvs.length) return;
    const row = cvs[0].closest('.dtask'), vis = visible(row, .2);
    fetch('assets/v4/lpr_all.json').then(r => r.json()).then(D => {
      let J = null, P = null, sc = 1, N = 0, t0 = performance.now();
      const W = 960, H = 720, T = 20000, HOLD = 2500, st = { sen: 'Avia', seq: 'Roundabout03' };
      function pick() {
        J = D.seq[`${st.seq}_${st.sen}`]; if (!J) return;
        const all = D.db.concat(J.path), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pad = 40;
        sc = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad - 30) / (y1 - y0));
        const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2 + 12;
        P = p => [ox + (p[0] - x0) * sc, H - (oy + (p[1] - y0) * sc)]; N = J.q.length; t0 = performance.now();
        const bx = $('#lpr-r1');
        if (bx) {
          const m = a => a.reduce((x, y) => x + y, 0) / a.length * 100, rv = m(J.rc), ov = m(J.oc), b = $$('.b', bx);
          $('em', bx).textContent = `Recall@1 (%), drive ${st.seq.slice(-2)}, ${st.sen === 'Aeva' ? 'Aeries II' : st.sen} queries`;
          [rv, ov].forEach((v, k) => { const ii = b[k].querySelector('i'); ii.dataset.w = v + '%'; if (bx.classList.contains('grown') || matchMedia('(prefers-reduced-motion: reduce)').matches) ii.style.width = v + '%'; b[k].querySelector('span').textContent = v.toFixed(1); });
        }
      }
      [['#lpr-sen', 'sen'], ['#lpr-seq', 'seq']].forEach(([id, key]) => { const sg = $(id); if (sg) $$('button', sg).forEach(b => b.addEventListener('click', () => { $$('button', sg).forEach(x => x.setAttribute('aria-pressed', String(x === b))); st[key] = b.dataset.v; pick(); })); });
      pick();
      function draw(now) {
        requestAnimationFrame(draw);
        if (!J || !vis.v || document.hidden) { t0 = now - ((now - t0) % (T + HOLD)); return; }
        const L = J.path.length, raw = ((now - t0) % (T + HOLD)) / T, u = Math.min(1, raw), ue = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const pf = ue * (L - 1), pi = Math.floor(pf), fr = pf - pi;                       // position along the driven path
        let k = 0; while (k < N && J.qi[k] <= pf) k++;                                  // queries already passed
        const pos = pi >= L - 1 ? J.path[L - 1] : [J.path[pi][0] + (J.path[pi + 1][0] - J.path[pi][0]) * fr, J.path[pi][1] + (J.path[pi + 1][1] - J.path[pi][1]) * fr];
        cvs.forEach(cv => {
          const c = cv.getContext('2d'), ok = cv.dataset.arm === 'r' ? J.rc : J.oc, top = cv.dataset.arm === 'r' ? J.rt : J.ot;
          c.fillStyle = '#0E1217'; c.fillRect(0, 0, W, H);
          c.fillStyle = 'rgba(90,102,115,.5)'; D.db.forEach(p => { const [a, b] = P(p); c.fillRect(a - 1.1, b - 1.1, 2.2, 2.2); });
          c.strokeStyle = 'rgba(233,238,244,.55)'; c.lineWidth = 2.5; c.beginPath();               // the path driven so far
          for (let i = 0; i <= Math.min(pi, L - 1); i++) { const [a, b] = P(J.path[i]); i ? c.lineTo(a, b) : c.moveTo(a, b); }
          const [ca, cb] = P(pos); c.lineTo(ca, cb); c.stroke();
          let good = 0;
          for (let i = 0; i < k; i++) { const [a, b] = P(J.q[i]); good += ok[i]; c.fillStyle = ok[i] ? '#3FBF6F' : '#E2322B'; c.beginPath(); c.arc(a, b, 3.2, 0, 6.2832); c.fill(); }
          if (k > 0 && u < 1) {
            const i = k - 1, [a, b] = P(J.q[i]), [e, f] = P(top[i]);
            c.strokeStyle = ok[i] ? 'rgba(63,191,111,.85)' : 'rgba(226,50,43,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(a, b); c.lineTo(e, f); c.stroke();
          }
          c.fillStyle = '#E9EEF4'; c.beginPath(); c.arc(ca, cb, 7, 0, 6.2832); c.fill();       // the vehicle
          const F1 = fpx(c.canvas, 22, 11), F2 = fpx(c.canvas, 18, 10);
          c.fillStyle = 'rgba(233,238,244,.88)'; c.font = `500 ${F1}px "JetBrains Mono", monospace`; c.textAlign = 'right';
          const rt = `correct top-1  ${good} / ${k}`, rw = c.measureText(rt).width; c.fillText(rt, W - 22, H - 22);
          c.textAlign = 'left'; c.fillStyle = 'rgba(233,238,244,.6)'; c.font = `500 ${F2}px "JetBrains Mono", monospace`;
          let lt = `${st.seq} · ${st.sen === 'Aeva' ? 'Aeries II' : st.sen} queries · 100 m`; if (c.measureText(lt).width > W - 70 - rw) lt = '100 m';
          c.fillText(lt, 22, H - 22);
          c.strokeStyle = 'rgba(233,238,244,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(22, H - 50); c.lineTo(22 + 100 * sc, H - 50); c.stroke();
        });
      }
      requestAnimationFrame(draw);
    }).catch(() => {});
  }
  lpr();
  (function () { const f = $('#v3-pred'); if (!f) return; const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); multiPred(); } }, { rootMargin: '300px 0px' }); io.observe(f); })();


  /* ---------- idea: the same rays read through three representations (side view, schematic) ---------- */
  function designAnims() {
    const cvs = $$('canvas.dz'); if (!cvs.length) return;
    const W = 800, H = 500, H0 = 1.73, X = x => 40 + x * 40, Y = y => 410 - y * 62;
    const CAR = [6.0, 9.6, 0, 1.5], WALL = [17.5, 18.1, 0, 4.0], VOX = .8, SPUR = [12.8, 13.6, 1.6, 2.4];
    const ROWS = [-16, -11, -6, -1.5, 3, 8.5];                                    // rows of the training LiDAR (schematic)
    const RAYS = [-13.5, -8.5, -4, 0.5, 6, 11];                                   // rays of a new LiDAR, between those rows
    const E0 = [.5, -.4, .6, -.55, .45, 0], E1 = [.12, -.14, .2, -.1, .16, 0];   // ours: d0 and refined errors (m), sized like the decoder's
    const SX = 3.6;                                                               // range-image screen, metres in front of the sensor
    const rad = d => d * Math.PI / 180, dir = el => [Math.cos(rad(el)), Math.sin(rad(el))];
    function hitT(el, boxes, groundY) {
      const [dx, dy] = dir(el); let best = Infinity;
      if (dy < 0) best = (groundY - H0) / dy;
      boxes.forEach(([x0, x1, y0, y1]) => {
        [[x0, 'x'], [x1, 'x'], [y0, 'y'], [y1, 'y']].forEach(([v, ax]) => {
          const t = ax === 'x' ? v / dx : (v - H0) / dy; if (!(t > 0) || t >= best) return;
          const px = t * dx, py = H0 + t * dy;
          if (ax === 'x' ? (py >= y0 - 1e-6 && py <= y1 + 1e-6) : (px >= x0 - 1e-6 && px <= x1 + 1e-6)) best = t;
        });
      });
      return best < 42 ? best : null;
    }
    const truth = el => hitT(el, [CAR, WALL], 0);
    const VX = []; for (let x = 0; x < 19.2; x += VOX) for (let y = -VOX; y < 4.8; y += VOX) {
      const occ = (y < 0) || [CAR, WALL].some(([a, b, c, d]) => x < b && x + VOX > a && y < d && y + VOX > c);
      if (occ && x > 2) VX.push([x, x + VOX, y, y + VOX]);
    }
    VX.push(SPUR);
    const P = (el, t) => { const [dx, dy] = dir(el); return [X(t * dx), Y(H0 + t * dy)]; };
    const line = (c, a, b, col, w, dash) => { c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]); };
    const dot = (c, p, r, col, ring) => { c.beginPath(); c.arc(p[0], p[1], r, 0, 6.283); if (ring) { c.strokeStyle = col; c.lineWidth = 3; c.stroke(); } else { c.fillStyle = col; c.fill(); } };
    const DSTOP = [[53, 88, 230], [74, 148, 240], [107, 208, 236], [154, 232, 240]];
    const dcol = (t, al) => { if (t === null) return `rgba(60,66,74,${al})`; const u = Math.max(0, Math.min(1, (t - 4) / 16)) * 3, i = Math.min(2, Math.floor(u)), f = u - i, a = DSTOP[i], b = DSTOP[i + 1]; return `rgba(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',')},${al})`; };
    const screenY = el => H0 + SX * Math.tan(rad(el));
    const EDGE = ROWS.map((r, i) => i === 0 ? screenY(r - 2.5) : screenY((ROWS[i - 1] + r) / 2)).concat([screenY(ROWS[ROWS.length - 1] + 2.8)]);
    const LAT = [];                                                               // latent: one cell per metre of radius, three channel rows
    for (let k = 0; k < 19; k++) { const surf = (k >= 6 && k <= 9) ? 1 : (k === 17 ? 1 : 0); LAT.push([0, 1, 2].map(j => .18 + .62 * surf * (j === 1 ? 1 : .7) + .06 * ((k * 7 + j * 3) % 4))); }
    const TAG = { range: 'range image of the training LiDAR', render: 'ray marching through occupancy', ours: 'rays read the latent directly' };
    function scene(c, kind) {
      c.fillStyle = '#0E1217'; c.fillRect(0, 0, W, H);
      if (kind === 'render') VX.forEach(([a, b, y0, y1]) => {
        const fake = a === SPUR[0] && y0 === SPUR[2];
        c.fillStyle = fake ? 'rgba(226,50,43,.30)' : 'rgba(110,122,135,.26)'; c.fillRect(X(a), Y(y1), X(b) - X(a), Y(y0) - Y(y1));
        c.strokeStyle = 'rgba(150,162,175,.35)'; c.lineWidth = 1; c.strokeRect(X(a), Y(y1), X(b) - X(a), Y(y0) - Y(y1));
      });
      c.strokeStyle = 'rgba(210,218,228,.8)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(18.8), Y(0)); c.stroke();
      [CAR, WALL].forEach(([a, b, y0, y1]) => c.strokeRect(X(a), Y(y1), X(b) - X(a), Y(y0) - Y(y1)));
      if (kind === 'range') {
        ROWS.forEach(el => { const t = truth(el); line(c, P(el, 0), P(el, t || 18.6 / Math.cos(rad(el))), 'rgba(240,160,97,.22)', 1.5); });
        ROWS.forEach((el, i) => { const y0 = EDGE[i], y1 = EDGE[i + 1]; c.fillStyle = dcol(truth(el), .95); c.fillRect(X(SX) - 9, Y(y1), 18, Y(y0) - Y(y1)); c.strokeStyle = 'rgba(14,18,23,1)'; c.lineWidth = 2; c.strokeRect(X(SX) - 9, Y(y1), 18, Y(y0) - Y(y1)); });
        c.strokeStyle = 'rgba(233,238,244,.7)'; c.lineWidth = 2; c.strokeRect(X(SX) - 9, Y(EDGE[EDGE.length - 1]), 18, Y(EDGE[0]) - Y(EDGE[EDGE.length - 1]));
        c.fillStyle = 'rgba(233,238,244,.75)'; c.font = '500 22px "JetBrains Mono", monospace'; c.fillText('one column', X(SX) - 56, Y(EDGE[EDGE.length - 1]) - 12);
      }
      if (kind === 'ours') {
        LAT.forEach((v, k) => v.forEach((s, j) => { c.fillStyle = `rgba(74,148,240,${s})`; c.fillRect(X(k) + 2, Y(-.18 - j * .3), 36, 16); }));
        c.fillStyle = 'rgba(233,238,244,.7)'; c.font = '500 22px "JetBrains Mono", monospace'; c.fillText('latent · one cell per metre of radius', 24, 492);
      }
      dot(c, [X(0), Y(H0)], 9, '#E9EEF4');
      c.fillStyle = 'rgba(233,238,244,.75)'; c.font = '500 26px "JetBrains Mono", monospace'; c.fillText(TAG[kind], 24, 40);
    }
    const st = cvs.map(cv => ({ c: cv.getContext('2d'), kind: cv.dataset.k, vis: visible(cv, .2), t0: performance.now() }));
    const PER = 1000, HOLD = 2600, TOT = RAYS.length * PER + HOLD;
    const label = (c, txt, p, col) => { c.fillStyle = col; c.font = '500 24px "JetBrains Mono", monospace'; c.fillText(txt, p[0], p[1]); };
    function drawRay(s, el, i, a) {
      const c = s.c, tt = truth(el), endT = tt === null ? 18.6 / Math.cos(rad(el)) : tt;
      if (s.kind === 'range') {
        let r = 0; ROWS.forEach((x, j) => { if (Math.abs(x - el) < Math.abs(ROWS[r] - el)) r = j; });
        const tb = truth(ROWS[r]), tS = SX / Math.cos(rad(el));
        line(c, P(el, 0), P(el, Math.min(tS, tS * a / .3)), 'rgba(233,238,244,.95)', 3);              // ray to the screen
        if (a < .3) return;
        c.strokeStyle = '#F0A061'; c.lineWidth = 4; c.strokeRect(X(SX) - 11, Y(EDGE[r + 1]) - 2, 22, Y(EDGE[r]) - Y(EDGE[r + 1]) + 4);   // borrowed pixel
        if (a < .5) return;
        if (tb === null) {
          line(c, P(el, tS), P(el, endT), 'rgba(233,238,244,.4)', 2, [8, 8]);
          if (tt !== null) { dot(c, P(el, tt), 9, 'rgba(233,238,244,.6)', true); label(c, 'no return', [P(el, endT * .6)[0] - 60, P(el, endT * .6)[1] - 16], '#E2322B'); }
          else label(c, 'miss', [P(el, endT)[0] - 64, P(el, endT)[1] - 14], 'rgba(233,238,244,.75)');
          return;
        }
        const e = Math.min(1, (a - .5) / .3);
        line(c, P(el, tS), P(el, tS + (tb - tS) * e), 'rgba(240,160,97,.95)', 3);                      // the borrowed range, laid along the new ray
        if (e < 1) return;
        const ok = tt !== null && Math.abs(tb - tt) < .3;
        if (!ok && tt !== null) dot(c, P(el, tt), 9, 'rgba(233,238,244,.6)', true);
        dot(c, P(el, tb), 8, ok ? '#6BA4E6' : '#E2322B');
      } else if (s.kind === 'render') {
        const t = hitT(el, VX, -9), reach = t === null ? endT : t, e = Math.min(1, a / .55), L = reach * e;
        line(c, P(el, 0), P(el, L), 'rgba(233,238,244,.85)', 3);
        for (let q = 2.4; q < L; q += VOX) dot(c, P(el, q), 3, 'rgba(233,238,244,.75)');            // ray-marching samples
        if (e < 1) return;
        if (t === null) { label(c, 'miss', [P(el, reach)[0] - 64, P(el, reach)[1] - 14], 'rgba(233,238,244,.75)'); return; }
        const ok = tt !== null && Math.abs(t - tt) < .3;
        if (!ok && tt !== null) dot(c, P(el, tt), 9, 'rgba(233,238,244,.55)', true);
        dot(c, P(el, t), 8, ok ? '#6BA4E6' : '#E2322B');
      } else {
        line(c, P(el, 0), P(el, endT * Math.min(1, a / .25)), 'rgba(233,238,244,.85)', 3);
        if (a < .25) return;
        const rho = tt === null ? null : tt * Math.cos(rad(el)), g = Math.min(1, (a - .25) / .15);
        LAT.forEach((v, k) => {                                                   // attention over the latent, peaked at the surface radius
          const w = rho === null ? .12 : Math.exp(-Math.pow(k + .5 - rho, 2) / 2.2);
          c.fillStyle = `rgba(240,160,97,${.85 * w * g})`; c.fillRect(X(k) + 2, Y(-.18 - 0 * .3), 36, Y(-.78) - Y(-.18) + 16);
        });
        if (tt === null) { if (a > .55) label(c, 'miss (p < τ)', [P(el, endT)[0] - 190, P(el, endT)[1] - 14], 'rgba(233,238,244,.75)'); return; }
        if (a < .45) return;
        const d0 = tt + E0[i], d1 = tt + E1[i], b = Math.min(1, (a - .45) / .15), gr = c.createLinearGradient(...P(el, d0 - 2.2), ...P(el, d0 + 2.2));
        gr.addColorStop(0, 'rgba(240,160,97,0)'); gr.addColorStop(.5, `rgba(240,160,97,${.75 * b})`); gr.addColorStop(1, 'rgba(240,160,97,0)');
        line(c, P(el, d0 - 2.2), P(el, d0 + 2.2), gr, 12);
        if (a > .6) dot(c, P(el, d0), 9, '#F0A061', true);
        if (a > .72) { const k = Math.floor(d0 * Math.cos(rad(el))); c.strokeStyle = '#E9EEF4'; c.lineWidth = 3; c.strokeRect(X(k) + 1, Y(-.16), 38, Y(-.8) - Y(-.16) + 18);   // local feature cell at d0
          line(c, P(el, d0), [X(k) + 20, Y(-.16)], 'rgba(233,238,244,.45)', 1.5, [5, 6]); }
        if (a > .84) { line(c, P(el, d0), P(el, d1), 'rgba(63,191,111,.9)', 3); dot(c, P(el, d1), 7.5, '#3FBF6F'); }
      }
    }
    function frame(now) {
      requestAnimationFrame(frame);
      st.forEach(s => {
        if (!s.vis.v || document.hidden) { s.t0 = now - ((now - s.t0) % TOT); return; }
        const u = RM ? TOT - 1 : (now - s.t0) % TOT; scene(s.c, s.kind);
        RAYS.forEach((el, i) => { const a = (u - i * PER) / PER; if (a > 0) drawRay(s, el, i, Math.min(1, a)); });
      });
    }
    requestAnimationFrame(frame);
  }
  designAnims();


  /* ---------- downstream: case pickers swap both clips of a row ---------- */
  const MOSN = {"os2a": {"frames": 50, "poster": 29, "same": 133840, "only_rel": 4876, "only_ours": 12983}, "avia": {"frames": 50, "poster": 31, "same": 30539, "only_rel": 1737, "only_ours": 4534}, "aeva": {"frames": 50, "poster": 17, "same": 152126, "only_rel": 4885, "only_ours": 36549}, "vlp16": {"frames": 50, "poster": 19, "same": 18539, "only_rel": 2086, "only_ours": 5701}};
  const mosCnt = k => { const e = $('#mos-cnt'), n = MOSN[k]; if (e && n) e.innerHTML = `This window: <b style="color:#3FE03F">${n.only_ours.toLocaleString()}</b> points ours only, <b style="color:#F59A86">${n.only_rel.toLocaleString()}</b> released only.` + (k === 'vlp16' ? ' Hard for both (IoU 39.4 vs 52.3).' : ''); };
  mosCnt('os2a');
  /* downstream bars grow when they first come into view; later changes slide (CSS transition on width) */
  (function growBars() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target);
      $$('.b i', e.target).forEach(i => { i.style.width = i.dataset.w; }); e.target.classList.add('grown'); }), { threshold: .6 });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $$('.dt .sr2, .rt .sr2').forEach(sr => { $$('.b i', sr).forEach(i => { i.dataset.w = i.style.width; i.style.width = '0%'; }); io.observe(sr); });
  })();
  const DSB = { det: {"016": {"r": [13.8, 64.1], "p": [89.1, 97.1]}, "028": {"r": [16.3, 60.3], "p": [95.1, 97.0]}, "042": {"r": [9.6, 53.1], "p": [86.9, 97.7]}, "072": {"r": [12.5, 70.0], "p": [94.9, 99.0]}, "086": {"r": [9.7, 61.5], "p": [91.7, 94.2]}}, mos: {"os2a": {"n": "OS2-128", "d": [72.0, 78.1], "o": [65.3, 73.3]}, "avia": {"n": "Avia", "d": [60.9, 66.0], "o": [53.1, 59.4]}, "aeva": {"n": "Aeries II", "d": [60.2, 78.4], "o": [56.3, 73.1]}, "vlp16": {"n": "VLP-16", "d": [34.9, 40.5], "o": [24.3, 31.2]}} };
  const setBar = (id, label, v) => { const bx = $(id); if (!bx) return; $('em', bx).textContent = label; $$('.b', bx).forEach((b, i) => { const ii = b.querySelector('i'); ii.dataset.w = v[i] + '%'; if (bx.classList.contains('grown') || !ii.dataset.w) ii.style.width = v[i] + '%'; b.querySelector('span').textContent = v[i].toFixed(1); }); };
  const dsBars = (pre, k) => {
    if (pre === 'mos') { const m = DSB.mos[k]; if (!m) return; setBar('#mos-b1', `Moving IoU, ${m.n} test split`, m.d); }
    else { const d = DSB.det[k]; if (!d) return; setBar('#det-b1', `Cars found (%), scene ${k}`, d.r); setBar('#det-b2', `Precision (%), scene ${k}`, d.p); }
  };
  $$('.ds-pick').forEach(sg => {
    const vs = $$('video', sg.closest('.dtask'));
    $$('button', sg).forEach(b => b.addEventListener('click', () => {
      $$('button', sg).forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (sg.dataset.pre === 'mos') mosCnt(b.dataset.v); dsBars(sg.dataset.pre, b.dataset.v);
      (sg.dataset.pre === 'mos' ? ['input', 'cmp'] : ['raw', 'ours']).forEach((arm, i) => { const v = vs[i], f = `assets/video/ds/${sg.dataset.pre}_${b.dataset.v}_${arm}`; v.poster = f + '.jpg'; v.dataset.src = f + '.mp4'; v.src = v.dataset.src; const pr = v.play(); if (pr) pr.catch(() => {}); });
    }));
  });


  /* ---------- step 2: a reference latent moved into the target frame (real warp coordinates) ---------- */
  function warpAnim() {
    const cv = $('#warp-cv'); if (!cv) return;
    const fig = cv.closest('.sg'), vis = visible(fig, .2), c = cv.getContext('2d'), W = 600, C = 300, S = 600 / 80;
    const lab = $('#warp-lab');
    const ZS = ['#111720', '#17263A', '#22477C', '#3570C8', '#57A6EE', '#A8E6F2'].map(h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)));
    const zc = v => { const x = Math.max(0, Math.min(1, v)) * 5, i = Math.min(4, Math.floor(x)), f = x - i; return `rgb(${ZS[i].map((q, j) => Math.round(q + (ZS[i + 1][j] - q) * f)).join(',')})`; };
    const px = (x, y) => [C - y * S, C - x * S];
    const box = (b, col, w) => {
      const [x, y, , l, wd, , yaw] = b, cs = Math.cos(yaw), sn = Math.sin(yaw);
      const q = [[l / 2, wd / 2], [l / 2, -wd / 2], [-l / 2, -wd / 2], [-l / 2, wd / 2]].map(([a, d]) => px(x + cs * a - sn * d, y + sn * a + cs * d));
      c.strokeStyle = col; c.lineWidth = w; c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
    };
    fetch('assets/m/warp_cells.json').then(r => r.json()).then(D => {
      const cells = D.cells.sort((a, b) => a[4] - b[4]), sref = D.ref_sensor_in_tgt;
      const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const T0 = 1200, T1 = 1800, T2 = 2200, TOT = T0 + T1 + T2;
      let t0 = performance.now();
      const OR = ['#2A1A10', '#5A3214', '#9A5418', '#D9771E', '#F0A061', '#FFD3A8'].map(h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)));
      const oc = v => { const x = Math.max(0, Math.min(1, v)) * 5, i = Math.min(4, Math.floor(x)), f = x - i; return `rgb(${OR[i].map((q, j) => Math.round(q + (OR[i + 1][j] - q) * f)).join(',')})`; };
      const moving = cells.some(r => r[5] && Math.hypot(r[0] - r[6], r[1] - r[7]) > .3);
      function draw(now) {
        requestAnimationFrame(draw);
        if (!vis.v || document.hidden) { t0 = now - ((now - t0) % TOT); return; }
        const u = RM ? TOT - 1 : (now - t0) % TOT, e = u < T0 ? 0 : u < T0 + T1 ? ease((u - T0) / T1) : 1;
        c.fillStyle = '#0E1217'; c.fillRect(0, 0, W, W);
        c.strokeStyle = 'rgba(200,210,222,.12)'; c.lineWidth = 1; [10, 20, 30, 40].forEach(r => { c.beginPath(); c.arc(C, C, r * S, 0, 6.283); c.stroke(); });
        if (moving && e > 0) cells.forEach(([tx, ty, sx, sy, v, isBox, gx, gy]) => {        // ego motion only: where the object's features would land
          if (!isBox) return; const [a, b] = px(sx + (gx - sx) * e, sy + (gy - sy) * e);
          c.strokeStyle = `rgba(240,160,97,${.55 * e})`; c.lineWidth = 1.2; c.strokeRect(a - 3.2, b - 3.2, 6.4, 6.4);
        });
        cells.forEach(([tx, ty, sx, sy, v, isBox]) => {
          const [a, b] = px(sx + (tx - sx) * e, sy + (ty - sy) * e); c.fillStyle = isBox ? oc(.35 + .65 * v) : zc(v); c.fillRect(a - 3.6, b - 3.6, 7.2, 7.2);
        });
        const arrow = (a, b, col) => {                                              // a path from a to b with an arrowhead at b, on a dark casing
          const [x0, y0] = px(a[0], a[1]), [x1, y1] = px(b[0], b[1]), ang = Math.atan2(y1 - y0, x1 - x0);
          const head = () => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 20 * Math.cos(ang - .45), y1 - 20 * Math.sin(ang - .45)); c.lineTo(x1 - 20 * Math.cos(ang + .45), y1 - 20 * Math.sin(ang + .45)); c.closePath(); };
          c.lineJoin = 'round'; c.strokeStyle = 'rgba(8,11,15,.9)'; c.lineWidth = 9; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); head(); c.lineWidth = 5; c.stroke();
          c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 4.5; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]); head(); c.fill();
        };
        D.box_ref.forEach((b, i) => { const t = D.box_tgt[i] || b; box([b[0] + (t[0] - b[0]) * e, b[1] + (t[1] - b[1]) * e, 0, b[3], b[4], 0, b[6] + (t[6] - b[6]) * e], 'rgba(240,160,97,.95)', 2.5); });
        const sp = px(sref[0] * e, sref[1] * e); c.fillStyle = '#9AA6B2'; c.beginPath(); c.arc(sp[0], sp[1], 7, 0, 6.283); c.fill();
        const tp = px(0, 0); c.strokeStyle = '#E9EEF4'; c.lineWidth = 3; c.beginPath(); c.arc(tp[0], tp[1], 9, 0, 6.283); c.stroke();
        const EGOP = '#FF5CC8', CARP = '#B4F03C';                                    // path colours: apart from the blue and orange cells
        arrow(sref, [0, 0], EGOP);                                                  // ego path over the 0.5 s
        D.box_ref.forEach((b, i) => { const t = D.box_tgt[i] || b; if (Math.hypot(t[0] - b[0], t[1] - b[1]) > .5) arrow(b, t, CARP); });   // moving cars, drawn on top
        const LF = fpx(cv, 19, 11), ls = LF / 19; c.font = `500 ${LF}px "JetBrains Mono", monospace`; c.textAlign = 'left';
        const leg = [['#57A6EE', 'static: ego motion'], ['#F0A061', 'in a box: box motion']].concat(moving ? [['rgba(240,160,97,.6)', '□ ego motion only']] : []).concat([[CARP, 'car path', 1], [EGOP, 'ego path', 1]]);
        leg.forEach(([col, t, ln], k) => {
          const y = W - 18 - k * 26 * ls; c.fillStyle = col;
          if (ln) { c.strokeStyle = col; c.lineWidth = 4; c.setLineDash([7, 4]); c.beginPath(); c.moveTo(18, y - 6 * ls); c.lineTo(18 + 28 * ls, y - 6 * ls); c.stroke(); c.setLineDash([]); c.fillText(t, 18 + 38 * ls, y); }
          else c.fillText(t, 16, y);
        });
        if (lab) lab.textContent = e === 0 ? 'Reference latent, t − 0.5 s' : e === 1 ? 'Aligned to the target frame' : 'Moving with the given motion';
      }
      requestAnimationFrame(draw);
    }).catch(() => {});
  }
  warpAnim();

  if (COARSE) {                                                       // touch screens: say how the 3D views respond
    const hint = [['Drag to rotate all six.', 'Swipe sideways to rotate all six, pinch to zoom.'], ['Drag to pan, scroll to zoom.', 'Swipe sideways to pan, pinch to zoom.']];
    $$('figcaption').forEach(f => hint.forEach(([a, b]) => { if (f.innerHTML.includes(a)) f.innerHTML = f.innerHTML.replace(a, b); }));
  }

  /* headline numbers count up when they first come into view (as on the ODE page). Every number in a tile counts on its own;
     "a→b" counts the right side up from a, words rise in. */
  (function countUp() {
    const tiles = $$('.numbers .num'); if (!tiles.length) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    tiles.forEach((tile, ti) => {
      const n = $('.v .n', tile); if (!n) return;
      const txt = n.textContent, parts = txt.split(/(\d+(?:\.\d+)?)/);          // odd entries are numbers
      if (parts.length < 2) { if (!still) { n.style.cssText += 'display:inline-block;opacity:0;transform:translateY(14px);transition:opacity .7s ease,transform .9s cubic-bezier(.2,.7,.2,1)'; tile._go = () => { n.style.opacity = 1; n.style.transform = 'none'; }; } }
      else {
        const nums = parts.map((p, i) => i % 2 ? { v: parseFloat(p), d: (p.split('.')[1] || '').length } : null);
        const arrow = txt.includes('→'), from = arrow && nums[1] ? nums[1].v : 0;
        const fmt = u => parts.map((p, i) => {
          if (!(i % 2)) return p; const { v, d } = nums[i];
          const start = arrow && i > 1 ? from : arrow ? v : 0;                  // with an arrow: left value fixed, right one grows from it
          return (start + (v - start) * u).toFixed(d);
        }).join('');
        if (still) return;
        n.textContent = fmt(0);
        tile._go = () => { const t0 = performance.now() + ti * 110; const step = t => { const p = Math.max(0, Math.min(1, (t - t0) / 1500)); n.textContent = fmt(1 - Math.pow(1 - p, 3)); if (p < 1) requestAnimationFrame(step); else n.textContent = txt; }; requestAnimationFrame(step); };
      }
    });
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.disconnect(); tiles.forEach(t => t._go && t._go()); }), { threshold: .5 });
    io.observe($('.numbers'));
  })();

  /* equations: on narrow screens, shrink only an equation box that would need a sideways scroll */
  function fitEqn() {
    $$('.eqn').forEach(e => { e.style.fontSize = '';
      for (let k = 0; k < 4; k++) { const over = e.scrollWidth / Math.max(1, e.clientWidth); if (over <= 1.001) break;
        e.style.fontSize = (parseFloat(getComputedStyle(e).fontSize) / over * .96).toFixed(2) + 'px'; } });
  }
  let fz; addEventListener('resize', () => { clearTimeout(fz); fz = setTimeout(fitEqn, 200); });

  /* equations */
  if (window.renderMathInElement) renderMathInElement(document.body, { output: window.KATEX_OUT || 'htmlAndMathml', delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
  requestAnimationFrame(fitEqn); setTimeout(fitEqn, 600);
})();
