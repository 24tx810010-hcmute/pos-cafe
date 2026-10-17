/**
 * UI Audit - deterministic in-page anomaly detector.
 * Inject into any rendered page, then call window.__uiAudit().
 * No dependencies. Returns an array of findings.
 */
(function () {
  const INTERACTIVE =
    'a[href],button,input:not([type=hidden]),select,textarea,summary,' +
    '[role=button],[role=link],[role=tab],[role=menuitem],[role=switch],' +
    '[role=checkbox],[role=radio],[onclick],[tabindex]:not([tabindex="-1"])';

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + el.id;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + node.id); break; }
      const cls = (node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) part += '.' + cls.join('.');
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function accName(el) {
    if (!el || !el.getAttribute) return '';
    const aria = el.getAttribute('aria-label') || el.getAttribute('title');
    if (aria) return aria.trim();
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map(function (id) {
        const n = document.getElementById(id);
        return n ? n.textContent : '';
      }).join(' ');
      if (t.trim()) return t.trim();
    }
    if (el.tagName === 'INPUT') {
      if (el.labels && el.labels.length) return (el.labels[0].textContent || '').trim();
      if (el.placeholder) return el.placeholder.trim();
      if (el.value && (el.type === 'submit' || el.type === 'button')) return el.value.trim();
    }
    const txt = (el.innerText || el.textContent || '').trim();
    if (txt) return txt;
    const img = el.querySelector('img[alt]');
    if (img && img.alt.trim()) return img.alt.trim();
    const svgTitle = el.querySelector('svg title');
    if (svgTitle && svgTitle.textContent.trim()) return svgTitle.textContent.trim();
    return '';
  }

  function style(el) { return window.getComputedStyle(el); }

  function visible(el) {
    const s = style(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (parseFloat(s.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function hiddenByAria(el) {
    let n = el;
    while (n && n.nodeType === 1) {
      if (n.getAttribute('aria-hidden') === 'true') return true;
      if (n.hasAttribute('inert')) return true;
      n = n.parentElement;
    }
    return false;
  }

  function parseRGB(s) {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  // Returns null when the backdrop cannot be reduced to one flat colour
  // (gradient or background image). pos-cafe's report cards are teal gradients,
  // and guessing a colour there produced a whole class of false low-contrast
  // reports on text that is perfectly readable.
  function effectiveBg(el) {
    let n = el;
    while (n && n.nodeType === 1) {
      const s = style(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parseRGB(s.backgroundColor);
      if (c && c.a > 0.85) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function lum(c) {
    const f = function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrast(a, b) {
    const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }

  function hasOwnText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length > 1) return true;
    }
    return false;
  }

  // inside an element that is deliberately horizontally scrollable
  function inScroller(el) {
    let n = el.parentElement;
    while (n && n.nodeType === 1) {
      const ox = style(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      n = n.parentElement;
    }
    return false;
  }

  // pos-cafe local patch -------------------------------------------------
  // When a drawer or modal is open, every control on the page behind it is
  // covered, so `hit-blocked` and `overlapping-controls` fire on the entire
  // background and bury the real findings. Scope the audit to the topmost
  // viewport-covering fixed layer when one exists; that is the only part of
  // the page the user can actually see or touch.
  function topLayerRoot() {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const minArea = vw * vh * 0.6;
    let best = null;
    for (const el of document.querySelectorAll('body *')) {
      const s = style(el);
      if (s.position !== 'fixed') continue;
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (parseFloat(s.opacity) < 0.05) continue;
      if (s.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < minArea) continue;
      if (!el.querySelector(INTERACTIVE)) continue;
      best = el; // later in document order paints on top
    }
    return best;
  }

  // A fixed, click-through, viewport-sized container is by construction a
  // notification layer - react-hot-toast's <Toaster> renders exactly that.
  // Its children float over the UI for a few seconds, are not part of the
  // layout under test, and made `hit-blocked` fire at random depending on how
  // long the run took. Returns the container elements, to be skipped wholesale.
  function clickThroughRoots() {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const minArea = vw * vh * 0.5;
    const roots = [];
    for (const el of document.querySelectorAll('body *')) {
      const s = style(el);
      if (s.position !== 'fixed' || s.pointerEvents !== 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height >= minArea) roots.push(el);
    }
    return roots;
  }

  function intersectArea(a, b) {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  }

  // pos-cafe local patch: measure only the part a person can actually see
  // inside scroll/clipping ancestors. A control below an overflow-auto list
  // may have a viewport coordinate underneath a footer, but it becomes
  // reachable by scrolling the list; the footer does not cover its visible
  // hit area. Keep the original layout box for size checks.
  function exposedRect(el, box) {
    let left = box.left, right = box.right, top = box.top, bottom = box.bottom;
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const s = style(n);
      const clipsX = ['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX);
      const clipsY = ['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY);
      if (!clipsX && !clipsY) continue;
      const r = n.getBoundingClientRect();
      const x = r.left + n.clientLeft, y = r.top + n.clientTop;
      if (clipsX) { left = Math.max(left, x); right = Math.min(right, x + n.clientWidth); }
      if (clipsY) { top = Math.max(top, y); bottom = Math.min(bottom, y + n.clientHeight); }
      if (right <= left || bottom <= top) return null;
    }
    left = Math.max(left, 0); right = Math.min(right, document.documentElement.clientWidth);
    top = Math.max(top, 0); bottom = Math.min(bottom, document.documentElement.clientHeight);
    return right > left && bottom > top ? { left: left, right: right, top: top, bottom: bottom,
      width: right - left, height: bottom - top } : null;
  }

  // A control fully outside overflow:clip/hidden cannot be reached by the
  // user's scrolling. Do not silently drop it along with scrollable content.
  function permanentlyClipped(el, box) {
    let left = box.left, right = box.right, top = box.top, bottom = box.bottom;
    let canScrollX = false, canScrollY = false;
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const s = style(n);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth) canScrollX = true;
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && n.scrollHeight > n.clientHeight) canScrollY = true;
      const clipsX = s.overflowX === 'hidden' || s.overflowX === 'clip';
      const clipsY = s.overflowY === 'hidden' || s.overflowY === 'clip';
      if (!clipsX && !clipsY) continue;
      const r = n.getBoundingClientRect();
      const x = r.left + n.clientLeft, y = r.top + n.clientTop;
      if (clipsX) { left = Math.max(left, x); right = Math.min(right, x + n.clientWidth); }
      if (clipsY) { top = Math.max(top, y); bottom = Math.min(bottom, y + n.clientHeight); }
      if ((right <= left && !canScrollX) || (bottom <= top && !canScrollY)) return true;
    }
    return false;
  }

  // pos-cafe local patch: measure a label's exposed, actually hittable area.
  // A wide label mostly covered by another layer is not a wide tap target.
  // Find the largest fully hittable sampled rectangle so disconnected strips
  // do not combine into a misleadingly large bounding box.
  function sampleClickableLabelRect(label, control, minTarget) {
    const r = exposedRect(label, label.getBoundingClientRect());
    if (!r) return null;
    const step = Math.max(8, Math.min(12, minTarget / 2));
    const cols = Math.max(1, Math.ceil(r.width / step));
    const rows = Math.max(1, Math.ceil(r.height / step));
    const cellW = r.width / cols, cellH = r.height / rows;
    const cells = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const hit = document.elementFromPoint(r.left + (x + 0.5) * cellW,
          r.top + (y + 0.5) * cellH);
        let activatesControl = !!hit && (hit === label || label.contains(hit));
        for (let n = hit; activatesControl && n && n !== label; n = n.parentElement) {
          if (n !== control && n.matches('a[href],button,input,select,textarea,summary,[role="button"],[contenteditable="true"]')) {
            activatesControl = false;
          }
        }
        row.push(activatesControl);
      }
      cells.push(row);
    }
    let best = null, bestArea = 0, bestMeetsTarget = false;
    for (let top = 0; top < rows; top++) {
      const common = Array(cols).fill(true);
      for (let bottom = top; bottom < rows; bottom++) {
        for (let x = 0; x < cols; x++) common[x] = common[x] && cells[bottom][x];
        let start = -1;
        for (let x = 0; x <= cols; x++) {
          if (x < cols && common[x]) { if (start < 0) start = x; continue; }
          if (start >= 0) {
            const width = (x - start) * cellW, height = (bottom - top + 1) * cellH;
            const meetsTarget = width >= minTarget && height >= minTarget;
            if ((meetsTarget && !bestMeetsTarget) ||
                (meetsTarget === bestMeetsTarget && width * height > bestArea)) {
              bestArea = width * height;
              bestMeetsTarget = meetsTarget;
              best = { width: width, height: height };
            }
            start = -1;
          }
        }
      }
    }
    return best;
  }

  function clickableLabelRect(label, control, minTarget) {
    let best = sampleClickableLabelRect(label, control, minTarget);
    if (best && best.width >= minTarget && best.height >= minTarget) return best;

    // A label below an overflow:auto/scroll viewport can be reached after
    // scrolling. Measure that state synchronously, then restore every offset.
    const scrollers = [];
    for (let n = label.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const s = style(n);
      const x = (s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth;
      const y = (s.overflowY === 'auto' || s.overflowY === 'scroll') && n.scrollHeight > n.clientHeight;
      if (x || y) scrollers.push({ el: n, x: x, y: y, left: n.scrollLeft, top: n.scrollTop });
    }
    if (!scrollers.length) return best;
    try {
      for (const scroller of scrollers) {
        const n = scroller.el;
        const bounds = n.getBoundingClientRect();
        const r = label.getBoundingClientRect();
        const left = bounds.left + n.clientLeft, right = left + n.clientWidth;
        const top = bounds.top + n.clientTop, bottom = top + n.clientHeight;
        if (scroller.x) {
          if (r.left < left) n.scrollLeft += r.left - left;
          else if (r.right > right) n.scrollLeft += r.right - right;
        }
        if (scroller.y) {
          if (r.top < top) n.scrollTop += r.top - top;
          else if (r.bottom > bottom) n.scrollTop += r.bottom - bottom;
        }
      }
      const revealed = sampleClickableLabelRect(label, control, minTarget);
      if (revealed && (!best ||
          (revealed.width >= minTarget && revealed.height >= minTarget) ||
          revealed.width * revealed.height > best.width * best.height)) best = revealed;
    } finally {
      for (const scroller of scrollers.reverse()) {
        scroller.el.scrollLeft = scroller.left;
        scroller.el.scrollTop = scroller.top;
      }
    }
    return best;
  }

  // A checkbox/radio associated with a label can be activated by touching
  // the hittable label region, which may be larger than the native input.
  function tapTargetRect(el, own, minTarget) {
    if (!el.matches('input[type=checkbox],input[type=radio]') || !el.labels) return own;
    let best = own;
    let bestMeetsTarget = own.width >= minTarget && own.height >= minTarget;
    for (const label of el.labels) {
      if (!visible(label) || style(label).pointerEvents === 'none') continue;
      const r = clickableLabelRect(label, el, minTarget);
      if (!r || r.width < own.width || r.height < own.height) continue;
      const meetsTarget = r.width >= minTarget && r.height >= minTarget;
      if ((meetsTarget && !bestMeetsTarget) ||
          (meetsTarget === bestMeetsTarget && r.width * r.height > best.width * best.height)) {
        best = r;
        bestMeetsTarget = meetsTarget;
      }
    }
    return best;
  }

  window.__uiAudit = function (opts) {
    opts = Object.assign({
      minTarget: 24,      // px, smallest acceptable clickable box
      minFont: 10,        // px
      contrastMin: 4.5,
      checkContrast: true,
      checkOverlap: true,
      scopeToTopLayer: true,        // audit only inside an open drawer/modal when one is up
      skipTransientOverlays: true,  // ignore toast/snackbar layers (fixed + pointer-events:none)
      max: 300,
      ignore: ''          // CSS selector of subtrees to skip, e.g. '.recharts-wrapper'
    }, opts || {});

    const out = [];
    const seen = new Set();
    const ignored = (opts.ignore ? Array.from(document.querySelectorAll(opts.ignore)) : [])
      .concat(opts.skipTransientOverlays === false ? [] : clickThroughRoots());
    const skip = function (el) { return ignored.some(function (ig) { return ig.contains(el); }); };

    function add(rule, severity, el, detail) {
      if (out.length >= opts.max) return;
      const sel = cssPath(el);
      const key = rule + '|' + sel;
      if (seen.has(key)) return;
      seen.add(key);
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      out.push({
        rule: rule,
        severity: severity,
        sel: sel,
        label: accName(el).replace(/\s+/g, ' ').slice(0, 60),
        detail: detail,
        rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null
      });
    }

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const root = (opts.scopeToTopLayer && topLayerRoot()) || document.body || document.documentElement;
    window.__uiAuditScope = root === document.body ? null : cssPath(root);
    const all = Array.from(root.querySelectorAll('*')).filter(function (el) { return !skip(el); });
    const interactives = all.filter(function (el) { return el.matches(INTERACTIVE); });

    // ---- interactive element rules -------------------------------------
    const boxes = [];
    for (const el of interactives) {
      const r = el.getBoundingClientRect();
      const s = style(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;

      // laid out but zero-size: invisible / unclickable control
      if (r.width === 0 || r.height === 0) {
        if (!el.matches('input[type=file],input[type=checkbox],input[type=radio]')) {
          add('zero-size-interactive', 'error', el,
            'clickable element rendered ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
        continue;
      }
      if (!visible(el)) continue;

      // icon-only button with no aria-label
      if (!accName(el) && !el.matches('input[type=text],input[type=search],input[type=email],input[type=password],input[type=number],textarea,select')) {
        add('no-accessible-name', 'error', el, 'no text, aria-label, title or alt');
      }

      // tap target too small
      const target = tapTargetRect(el, r, opts.minTarget);
      if (!el.disabled && (target.width < opts.minTarget || target.height < opts.minTarget)) {
        add('tiny-target', 'warn', el,
          Math.round(target.width) + 'x' + Math.round(target.height) + 'px < ' + opts.minTarget + 'px');
      }

      // hit test at the centre of the portion exposed by scroll/clipping.
      const exposed = exposedRect(el, r);
      if (!exposed && permanentlyClipped(el, r)) {
        add('clipped-interactive', 'error', el,
          'control is outside a non-scrollable clipped ancestor');
      }
      if (exposed) {
        const cx = exposed.left + exposed.width / 2, cy = exposed.top + exposed.height / 2;
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el) && !skip(top)) {
          const cn = top.className && typeof top.className === 'string'
            ? '.' + top.className.split(/\s+/)[0] : '';
          add('hit-blocked', 'error', el,
            'centre point hits <' + top.tagName.toLowerCase() + cn + '> instead');
        }
      }

      if (el.disabled && s.pointerEvents !== 'none' && s.cursor === 'pointer') {
        add('disabled-but-pointer', 'info', el, 'disabled element still shows pointer cursor');
      }

      if ((r.right < 0 || r.bottom < 0 || r.left > vw + 2) && r.width > 4 && r.height > 4) {
        add('offscreen-interactive', 'warn', el,
          'positioned outside viewport at x=' + Math.round(r.left) + ' y=' + Math.round(r.top));
      }

      if (exposed) boxes.push({ el: el, r: exposed });
    }

    if (opts.checkOverlap) {
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const ov = intersectArea(a.r, b.r);
          if (!ov) continue;
          const minArea = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
          if (ov / minArea > 0.35) {
            add('overlapping-controls', 'error', a.el,
              'overlaps ' + cssPath(b.el) + ' by ' + Math.round(ov / minArea * 100) + '%');
          }
        }
      }
    }

    // ---- layout / content rules ----------------------------------------
    for (const el of all) {
      const s = style(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;

      // element pushes the page wider than the viewport
      if (r.right > vw + 1 && !inScroller(el)) {
        const p = el.parentElement;
        const pr = p ? p.getBoundingClientRect() : null;
        if (!pr || pr.right <= vw + 1) {
          add('overflow-x', 'warn', el,
            'extends ' + Math.round(r.right - vw) + 'px past the ' + vw + 'px viewport');
        }
      }

      // text clipped with no ellipsis
      if (hasOwnText(el) && el.scrollWidth > el.clientWidth + 2 &&
          (s.overflow === 'hidden' || s.overflowX === 'hidden') &&
          s.textOverflow !== 'ellipsis') {
        add('clipped-text', 'warn', el,
          'content ' + el.scrollWidth + 'px clipped to ' + el.clientWidth + 'px, no text-overflow');
      }
      if (hasOwnText(el) && el.scrollHeight > el.clientHeight + 4 && s.overflowY === 'hidden') {
        add('clipped-text-vertical', 'info', el,
          'content ' + el.scrollHeight + 'px clipped to ' + el.clientHeight + 'px tall');
      }

      if (hasOwnText(el)) {
        const fs = parseFloat(s.fontSize);
        if (fs && fs < opts.minFont) add('tiny-font', 'warn', el, 'font-size ' + fs + 'px');
      }

      if (opts.checkContrast && hasOwnText(el) && !hiddenByAria(el)) {
        const fg = parseRGB(s.color);
        if (fg && fg.a > 0.3) {
          const bg = effectiveBg(el);
          if (!bg) continue;
          const cr = contrast(fg, bg);
          const fs = parseFloat(s.fontSize) || 16;
          const bold = parseInt(s.fontWeight, 10) >= 700;
          const large = fs >= 24 || (fs >= 18.66 && bold);
          const need = large ? 3 : opts.contrastMin;
          if (cr < need) {
            add('low-contrast', 'warn', el, 'contrast ' + cr.toFixed(2) + ':1, need ' + need + ':1');
          }
        }
      }

      // class="undefined" etc: template / className helper bug
      const cls = el.getAttribute('class');
      if (cls && /(^|\s)(undefined|null|NaN|false)(\s|$)/.test(cls)) {
        add('bad-class-token', 'error', el,
          'class attribute contains "' + cls.match(/(undefined|null|NaN|false)/)[0] + '"');
      }

      const st = el.getAttribute('style');
      if (st && /(NaN|undefined)/.test(st)) {
        add('bad-inline-style', 'error', el, 'style="' + st.slice(0, 60) + '"');
      }
    }

    // broken images
    for (const img of root.querySelectorAll('img')) {
      if (skip(img)) continue;
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
        add('broken-image', 'error', img, 'src failed: ' + img.getAttribute('src').slice(0, 80));
      }
      if (visible(img) && !img.alt && !hiddenByAria(img)) {
        add('image-no-alt', 'info', img, 'decorative? add alt="" or aria-hidden');
      }
    }

    // icon that rendered as nothing: icon font missing or wrong ligature
    for (const el of all) {
      if (!el.matches('i,span,svg,[class*=icon],[class*=Icon]')) continue;
      if (el.children.length) continue;
      const s = style(el);
      if (s.display === 'none') continue;
      const r = el.getBoundingClientRect();
      const declaredSize = parseFloat(s.fontSize) || 0;
      const cn = typeof el.className === 'string' ? el.className : '';
      const looksIcon = /icon|material|fa-|glyph/i.test(cn) || el.tagName.toLowerCase() === 'svg';
      if (looksIcon && (r.width < 2 || r.height < 2) && declaredSize > 4) {
        add('empty-icon', 'error', el,
          'icon rendered ' + Math.round(r.width) + 'x' + Math.round(r.height) + ', font or glyph missing');
      }
    }

    // placeholder / template leakage in visible text
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const LEAK = /(\[object Object\]|\bundefined\b|\bNaN\b|\{\{[^}]*\}\}|%[sdf]\b|\$\{[^}]*\})/;
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent;
      if (!t || t.length > 300) continue;
      const m = t.match(LEAK);
      if (!m) continue;
      const el = node.parentElement;
      if (!el || skip(el) || !visible(el)) continue;
      add('placeholder-leak', 'error', el, 'visible text contains "' + m[0] + '"');
    }

    const order = { error: 0, warn: 1, info: 2 };
    out.sort(function (a, b) { return order[a.severity] - order[b.severity]; });
    return out;
  };

  // draw boxes over findings so a screenshot shows what was flagged
  window.__uiAuditMark = function (findings) {
    document.querySelectorAll('[data-ui-audit-mark]').forEach(function (n) { n.remove(); });
    const color = { error: '#ff2d55', warn: '#ff9500', info: '#0a84ff' };
    (findings || []).forEach(function (f, i) {
      if (!f.rect || !f.rect.w) return;
      const d = document.createElement('div');
      d.setAttribute('data-ui-audit-mark', '1');
      d.style.cssText = [
        'position:absolute', 'pointer-events:none', 'z-index:2147483647',
        'left:' + (f.rect.x + window.scrollX) + 'px',
        'top:' + (f.rect.y + window.scrollY) + 'px',
        'width:' + f.rect.w + 'px', 'height:' + f.rect.h + 'px',
        'outline:2px solid ' + color[f.severity],
        'box-shadow:0 0 0 1px #fff'
      ].join(';');
      const tag = document.createElement('span');
      tag.textContent = (i + 1) + ' ' + f.rule;
      tag.style.cssText = 'position:absolute;top:-15px;left:0;font:700 9px/13px ui-monospace,monospace;' +
        'background:' + color[f.severity] + ';color:#fff;padding:0 3px;white-space:nowrap;border-radius:2px';
      d.appendChild(tag);
      document.body.appendChild(d);
    });
    return (findings || []).length;
  };
})();
