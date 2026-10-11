/* ==============================================================
   RISO B-ROLL · 动效库  (依赖 gsap.min.js，先于本文件加载)

   一条 composition 的全部时间都在这里登记：画面 tween 和逐帧函数。
   渲染器只认 window.__riso，逐帧 seek，任意一帧都可复现。成片不带音轨。

     Riso.comp({ duration: 4.5, seed: 3 }, C => {
       C.camera();                       // 慢推镜
       C.count('#n', .2, { to: 7000 });  // 计数
       C.stamp('#u', .9);                // 盖章落位
     });

   约定：所有时间参数都是“绝对秒”；helper 返回“落地时间”，可以接着串下一个动作。
   ============================================================== */
(function () {
  'use strict';

  const Q = new URLSearchParams(location.search);
  const RENDER = Q.has('render');
  if (Q.has('alpha')) document.documentElement.classList.add('alpha');

  /* 可复现随机：同一个 seed 永远同一个结果 */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const els = s => typeof s === 'string' ? [...document.querySelectorAll(s)] : (s && s.length != null ? [...s] : [s]);
  const fmtThousands = v => Math.round(v).toLocaleString('en-US');

  /* ── 文本：逐字拆分 + [重点] 标记 ──────────────────────────
     Riso.text(el, '直接丢给 AI\n它根本[消化不了]')
     → 每行一个 .ln（溢出裁切，用于升起），每字一个 .ch，[ ] 内的字带 .em */
  function text(el, str) {
    el = els(el)[0];
    el.innerHTML = '';
    let em = false;
    for (const line of String(str).split('\n')) {
      const ln = document.createElement('span');
      ln.className = 'ln';
      for (const c of line) {
        if (c === '[') { em = true; continue; }
        if (c === ']') { em = false; continue; }
        const ch = document.createElement('span');
        ch.className = em ? 'ch em' : 'ch';
        ch.textContent = c === ' ' ? ' ' : c;
        ln.appendChild(ch);
      }
      el.appendChild(ln);
    }
    return el;
  }

  /* 单行/多行自适应：从 max 字号往下缩，直到最宽的一行 ≤ width。缩到 min 仍放不下 → 标记给 QA */
  function fit(el, { width, max, min = 28 }) {
    el = els(el)[0];
    let size = max;
    el.style.fontSize = size + 'px';
    while (el.scrollWidth > width && size > min) { size -= 2; el.style.fontSize = size + 'px'; }
    if (el.scrollWidth > width) el.dataset.overflow = '1';
    return size;
  }

  /* 字形墨迹框：Oswald 等数字字体的字形会超出行框，排版要按“墨迹”对齐而不是按盒子。
     返回 #stage 坐标系里的 {top, bottom, left, right}（单行元素；先排版、后建时间轴时调用） */
  function inkBox(el) {
    el = els(el)[0];
    const cs = getComputedStyle(el), ctx = inkBox.ctx || (inkBox.ctx = document.createElement('canvas').getContext('2d'));
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(el.textContent);
    const s = document.getElementById('stage').getBoundingClientRect(), r = el.getBoundingClientRect();
    const fa = m.fontBoundingBoxAscent, fd = m.fontBoundingBoxDescent;
    const base = r.top - s.top + (r.height - (fa + fd)) / 2 + fa, left = r.left - s.left;
    return { top: base - m.actualBoundingBoxAscent, bottom: base + m.actualBoundingBoxDescent,
             left: left - m.actualBoundingBoxLeft, right: left + m.actualBoundingBoxRight };
  }
  /* 元素在 #stage 坐标系里的盒子 */
  function box(el) {
    el = els(el)[0];
    const s = document.getElementById('stage').getBoundingClientRect(), r = el.getBoundingClientRect();
    return { top: r.top - s.top, bottom: r.bottom - s.top, left: r.left - s.left, right: r.right - s.left, width: r.width, height: r.height };
  }

  /* 网点画布：density(u, v, t) ∈ [0,1]，u/v 是 0–1 的画布坐标。45° 网线角，点径 ∝ √密度 */
  function halftone(canvas, { cell = 18, angle = 45, density }) {
    canvas = els(canvas)[0];
    const w = canvas.width = canvas.offsetWidth, h = canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    const color = getComputedStyle(canvas).color;
    const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const R = Math.hypot(w, h), cx = w / 2, cy = h / 2, rmax = cell * 0.72;
    return function draw(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (let i = -R / cell; i <= R / cell; i++) {
        for (let j = -R / cell; j <= R / cell; j++) {
          const x = cx + (i * ca - j * sa) * cell, y = cy + (i * sa + j * ca) * cell;
          if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
          const d = density(x / w, y / h, t);
          if (d <= 0.01) continue;
          ctx.beginPath();
          ctx.arc(x, y, rmax * Math.sqrt(Math.min(d, 1)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
  }

  /* ── composition ─────────────────────────────────────── */
  function comp(o, build) {
    const C = {
      id: o.id || decodeURIComponent(location.pathname.split('/').pop().replace(/\.html$/, '')),
      duration: o.duration || 5,
      fps: o.fps || 30,
      poster: o.poster == null ? null : o.poster,   // 末帧海报时间，默认 = duration
      tl: gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } }),
      fns: [], rand: rng(o.seed || 1),
    };
    const frame = document.getElementById('frame');
    const stage = document.getElementById('stage');
    const root = document.documentElement;

    /* 逐帧函数：f(t) 在每次 seek 时调用（计数器、网点、质感呼吸都走这里，保证可复现） */
    C.at = f => { C.fns.push(f); return C; };

    /* 慢推镜：整条匀速推进。B-roll 会被剪在任意一帧切入，匀速比缓入缓出更自然 */
    C.camera = ({ push = 0.03, drift = 0 } = {}) => {
      C.tl.fromTo(stage, { scale: 1, y: 0 }, { scale: 1 + push, y: drift, duration: C.duration, ease: 'none' }, 0);
      return C;
    };

    /* 油墨呼吸：质感层逐两帧换位（12–15fps 的颗粒闪烁，静止段也是活的） */
    C.boil = () => {
      const press = frame.querySelector('.press');
      C.at(t => {
        const k = Math.floor(t * C.fps / 2), r = rng(k * 7919 + 17);
        if (press) press.style.backgroundPosition = `${(r() * 240) | 0}px ${(r() * 240) | 0}px`;
      });
      return C;
    };

    /* 套印归位：B 版从大偏移跳 4 格回到正常错位 —— “咔”一下，两色对准 */
    C.register = (t, { dx = 22, dy = -14 } = {}) => {
      const f = 2 / C.fps;
      const keys = [[dx, dy], [-6, 5], [7, -4], [1, 0], [3, -2]];
      C.tl.set(root, { '--rx': dx + 'px', '--ry': dy + 'px' }, 0);
      keys.forEach(([x, y], i) => C.tl.set(root, { '--rx': x + 'px', '--ry': y + 'px' }, t + i * f));
      return t + 4 * f;
    };

    /* 网点显影：一层油墨从小点长成满版 */
    C.print = (sel, t, { dur = .7, stagger = 0, ease = 'power2.inOut', to, from = 0 } = {}) => {
      const list = els(sel);
      list.forEach((el, i) => {
        const t0 = t + i * stagger, t1 = t0 + dur;
        if (to != null || el.classList.contains('tint')) {          // 平网：长到指定点径后停住
          C.tl.fromTo(el, { '--td': '0px' }, { '--td': (to ?? 3.1) + 'px', duration: dur, ease, immediateRender: true }, t0);
          return;
        }
        el.classList.add('print');
        C.tl.fromTo(el, { '--dot': from + 'px' }, { '--dot': '8.6px', duration: dur, ease, immediateRender: true }, t0);
        C.at(tt => { el.style.webkitMaskImage = tt >= t1 ? 'none' : ''; });
      });
      return t + dur + stagger * (list.length - 1);
    };

    /* 逐字升起（配合 Riso.text）。sel 是文本容器 */
    C.rise = (sel, t, { stagger = .034, dur = .62, y = 108 } = {}) => {
      const chars = els(sel).flatMap(el => [...el.querySelectorAll('.ch')]);
      C.tl.from(chars, { yPercent: y, duration: dur, stagger, ease: 'expo.out' }, t);
      return t + dur * .6 + stagger * chars.length;
    };

    /* 盖章：从空中加速砸到纸面（power3.in），落地一瞬间镜头震 2 帧 */
    C.stamp = (sel, t, { from = 1.55, rot = -5, dur = .17, shake = 5 } = {}) => {
      const land = t + dur;
      C.tl.fromTo(els(sel), { scale: from, rotation: rot, autoAlpha: 0 },
        { scale: 1, rotation: 0, autoAlpha: 1, duration: dur, ease: 'power3.in', immediateRender: true }, t);
      if (shake) C.shake(land, shake);
      return land;
    };

    /* 镜头震：作用在 #frame，3 帧回正 */
    C.shake = (t, a = 5) => {
      const f = 1 / C.fps;
      C.tl.set(frame, { x: a, y: -a * .7 }, t)
        .set(frame, { x: -a * .55, y: a * .45 }, t + f)
        .set(frame, { x: a * .2, y: 0 }, t + 2 * f)
        .set(frame, { x: 0, y: 0 }, t + 3 * f);
      return C;
    };

    /* 滚筒刷过：clip-path 从一侧扫开（文字、色带都可以） */
    C.roll = (sel, t, { dur = .55, dir = 'right', stagger = 0 } = {}) => {
      // 四周多留 30% 余量：数字字体的墨迹会超出行框，裁到 inset(0) 会把字头切掉
      const o = '-30%', from = { right: `inset(${o} 100% ${o} ${o})`, left: `inset(${o} ${o} ${o} 100%)`, down: `inset(${o} ${o} 100% ${o})`, up: `inset(100% ${o} ${o} ${o})` }[dir];
      C.tl.fromTo(els(sel), { clipPath: from }, { clipPath: `inset(${o} ${o} ${o} ${o})`, duration: dur, stagger, ease: 'expo.inOut', immediateRender: true }, t);
      C.at(tt => { if (tt >= t + dur + stagger * (els(sel).length - 1)) els(sel).forEach(e => { e.style.clipPath = 'none'; }); });
      return t + dur + stagger * (els(sel).length - 1);
    };

    /* 条形伸展：scaleX/scaleY 从 0 长出（transform-origin 由 CSS 决定） */
    C.bar = (sel, t, { dur = .6, axis = 'x', stagger = 0, ease = 'expo.inOut' } = {}) => {
      const k = axis === 'x' ? 'scaleX' : 'scaleY';
      C.tl.fromTo(els(sel), { [k]: 0 }, { [k]: 1, duration: dur, stagger, ease, immediateRender: true }, t);
      return t + dur + stagger * (els(sel).length - 1);
    };

    /* 计数：值是时间的纯函数（不依赖回调），任意帧可复现 */
    C.count = (sel, t, { from = 0, to, dur = 1.1, ease = 'expo.out', fmt = fmtThousands } = {}) => {
      const el = els(sel)[0], e = gsap.parseEase(ease);
      C.at(tt => { el.textContent = fmt(from + (to - from) * e(clamp01((tt - t) / dur))); });
      return t + dur;
    };

    /* 描线：SVG path/line/polyline 从头画到尾 */
    C.draw = (sel, t, { dur = .8, stagger = 0, ease = 'power2.inOut' } = {}) => {
      els(sel).forEach((p, i) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = len + ' ' + len;
        C.tl.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: dur, ease, immediateRender: true }, t + i * stagger);
      });
      return t + dur + stagger * (els(sel).length - 1);
    };

    /* 弹出：小元素（点、徽章）从 0 弹到 1 */
    C.pop = (sel, t, { dur = .45, stagger = 0 } = {}) => {
      C.tl.fromTo(els(sel), { scale: 0 }, { scale: 1, duration: dur, stagger, ease: 'back.out(2.2)', immediateRender: true }, t);
      return t + dur + stagger * (els(sel).length - 1);
    };

    /* 滑入：通用位移入场 */
    C.slide = (sel, t, { x = 0, y = 0, dur = .6, stagger = 0, ease = 'expo.out' } = {}) => {
      C.tl.from(els(sel), { x, y, duration: dur, stagger, ease }, t);
      return t + dur + stagger * (els(sel).length - 1);
    };

    /* 网点地层：字幕床里的装饰，越往下越密；开场 0.6s 从 70% 长满 —— 第 0 帧就不是空的 */
    C.floor = (sel, { top = .0, power = 2.1, max = .62, cell = 16, grow = .6 } = {}) => {
      const draw = halftone(sel, {
        cell, density: (u, v, t) => {
          const g = .7 + .3 * clamp01(t / grow);
          return Math.pow(clamp01((v - top) / (1 - top)), power) * max * g;
        }
      });
      C.at(draw);
      return C;
    };

    C.seek = t => { C.tl.seek(t, false); for (const f of C.fns) f(t); };

    /* ── 构建：等字体就绪再量尺寸 ── */
    const fams = ['900 100px "Riso Serif"', '700 100px "Riso Num"', '600 40px "Riso Sans"', '500 28px "Riso Mono"'];
    const ready = Promise.all(fams.map(f => document.fonts.load(f).catch(() => null)))
      .then(() => document.fonts.ready)
      .then(() => {
        // 字体随 skill 分发；没加载上（assets/fonts 缺失或路径错）时报错，不要悄悄换成系统字体出片
        const miss = fams.filter(f => !document.fonts.check(f));
        if (miss.length) console.error('字体没加载上：' + miss.join(', ') + '（检查 assets/fonts/）');
        if (!frame.querySelector('.fiber')) frame.insertAdjacentHTML('beforeend', '<div class="fiber"></div><div class="press"></div>');
        build(C);
        C.seek(0);
      });

    const posterT = () => C.poster == null ? C.duration : C.poster;
    window.__riso = {
      ready,
      meta: () => ({ id: C.id, duration: C.duration, fps: C.fps, width: 1080, height: 1920, poster: posterT() }),
      seek: t => { C.seek(t === 'end' ? posterT() : +t); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); },
      audit: () => audit(C),
    };

    if (!RENDER) ready.then(() => preview(C, posterT));
    return C;
  }

  /* ── 浏览器预览：循环播放；?t=end / ?t=2.4 定格 ── */
  function preview(C, posterT) {
    const fixed = Q.get('t');
    if (fixed != null) { C.seek(fixed === 'end' ? posterT() : +fixed); return; }
    const t0 = performance.now(), loop = C.duration + 1;
    (function tick(now) {
      const t = Math.min(((now - t0) / 1000) % loop, C.duration);
      C.seek(t);
      requestAnimationFrame(tick);
    })(t0);
  }

  /* ── 版面自检（scripts/qa.mjs 调用）── */
  const ZONE = { top: 168, bottom: 1330, left: 56, right: 1024, rail: { x: 930, y0: 880, y1: 1500 } };
  function lum([r, g, b]) {
    const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
  }
  const rgb = s => (s.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  function contrast(c1, c2) { const a = lum(c1), b = lum(c2); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }
  function visible(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  /* 在“镜头归零”的版面坐标里量（推镜 3–4% 是设计内的轻微裁切，不算越界）；
     数字元素按字形墨迹量，不按行框量 */
  function audit(C) {
    const out = [];
    document.getElementById('stage').style.transform = 'none';
    document.getElementById('frame').style.transform = 'none';
    const rectOf = el => {
      const r = el.getBoundingClientRect();
      if (!el.classList.contains('num')) return r;
      const k = inkBox(el);
      return { left: k.left, right: k.right, top: k.top, bottom: k.bottom, width: k.right - k.left, height: k.bottom - k.top };
    };
    const name = el => el.id ? '#' + el.id : (el.className ? '.' + String(el.className).split(' ').join('.') : el.tagName) + ' “' + el.textContent.trim().slice(0, 10) + '”';
    const texts = [...document.querySelectorAll('#stage .t')].filter(visible);
    const css = getComputedStyle(document.getElementById('frame'));
    const paper = hex(css.getPropertyValue('--paper'));
    const flood = document.getElementById('frame').classList.contains('flood');
    const bg = flood ? hex(css.getPropertyValue('--a')) : paper;
    for (const el of texts) {
      const r = rectOf(el), cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
      const flag = (level, msg) => out.push([level, name(el), msg, [r.left | 0, r.top | 0, r.width | 0, r.height | 0]]);
      if (r.top < ZONE.top - 2 || r.bottom > ZONE.bottom + 2) flag('error', `文字越出信息区：y ${r.top | 0}–${r.bottom | 0}（允许 ${ZONE.top}–${ZONE.bottom}）`);
      if (r.left < ZONE.left - 2 || r.right > ZONE.right + 2) flag('error', `文字贴边或出画：x ${r.left | 0}–${r.right | 0}（允许 ${ZONE.left}–${ZONE.right}）`);
      const lines = el.querySelectorAll(':scope > .ln');            // 多行文本逐行量，不按整块的外框量
      const parts = lines.length ? [...lines].filter(l => l.lastElementChild).map(l => {   // .ln 是块级，宽度=容器；用首尾字量真实行宽
        const a = l.firstElementChild.getBoundingClientRect(), b = l.lastElementChild.getBoundingClientRect();
        return { left: a.left, right: b.right, top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
      }) : [r];
      if (parts.some(p => p.right > ZONE.rail.x && p.bottom > ZONE.rail.y0 && p.top < ZONE.rail.y1)) flag('warn', '压到短视频右侧按钮栏（x>930, y 880–1500）');
      if (fs < 28) flag('error', `字号 ${fs}px < 28px，手机上读不清`);
      if (el.dataset.overflow) flag('error', 'fit() 缩到最小字号仍放不下：删字，不要硬塞');
      let col = rgb(cs.color);
      if (cs.mixBlendMode === 'multiply' && !flood) col = col.map((c, i) => c * paper[i] / 255);
      const cr = contrast(col, bg);
      if (fs < 100 && cr < 4.5) flag('error', `对比度 ${cr.toFixed(2)} < 4.5（小于 100px 的字只能用 A 墨）`);
      else if (fs >= 100 && cr < (fs >= 200 ? 1.3 : 2.0)) flag('warn', `大字对比度 ${cr.toFixed(2)} 偏低`);   // 越大的字越能扛低对比（黄墨大数字 ≈ 1.4）
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const A = texts[i], B = texts[j];
      if (A.contains(B) || B.contains(A)) continue;
      if (A.closest('[data-overprint]') || B.closest('[data-overprint]')) continue;
      const a = rectOf(A), b = rectOf(B);
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 4 && iy > 4) {
        const share = ix * iy / Math.min(a.width * a.height, b.width * b.height);
        if (share > .03) out.push(['error', name(A) + ' × ' + name(B), `文字互相压住 ${(share * 100) | 0}%（有意叠印请给其中一个加 data-overprint）`, [Math.max(a.left, b.left) | 0, Math.max(a.top, b.top) | 0, ix | 0, iy | 0]]);
      }
    }
    return { id: C.id, texts: texts.length, issues: out };
  }
  function hex(s) {
    s = String(s).trim();
    if (s[0] !== '#') return rgb(s);
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  window.Riso = { comp, text, fit, inkBox, box, halftone, rng };
})();
