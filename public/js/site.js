/* Vastu Design – shared site code */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const I = {
    lotus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M12 3c2 3 2 7 0 11-2-4-2-8 0-11zM3 10c4 0 7 2 9 6-4 0-7-2-9-6zm18 0c-4 0-7 2-9 6 4 0 7-2 9-6zM5 18h14"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>'
  };

  async function api(url, opts = {}) {
    const o = { credentials: 'same-origin', ...opts };
    if (o.body && !(o.body instanceof FormData)) { o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) }; o.body = JSON.stringify(o.body); }
    const r = await fetch(url, o);
    let data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((data && data.error) || 'Something went wrong.'); err.status = r.status; throw err; }
    return data;
  }

  /* ---------- settings ---------- */
  let settings = { phone: '9876543285', tagline: '', address: 'Alibaug, Maharashtra', about: '', certifications: [] };
  const fmtPhone = p => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
  function applySettings() {
    const p = settings.phone;
    $$('[data-phone]').forEach(e => e.textContent = fmtPhone(p));
    $$('[data-tel]').forEach(e => e.href = 'tel:+91' + p);
    $$('[data-wa]').forEach(e => e.href = `https://wa.me/91${p}?text=${encodeURIComponent('Hello Vastu Design, I would like to discuss my interior project.')}`);
    $$('[data-tagline]').forEach(e => e.textContent = settings.tagline);
    $$('[data-address]').forEach(e => e.textContent = settings.address);
    $$('[data-about]').forEach(e => e.textContent = settings.about);
    $$('[data-certs]').forEach(e => { e.innerHTML = (settings.certifications || []).map(c => `<li>${esc(c)}</li>`).join(''); });
  }
  const settingsReady = api('/api/settings').then(s => { settings = s; }).catch(() => {}).then(applySettings);

  /* ---------- header / footer ---------- */
  function mountChrome() {
    const page = document.body.dataset.page;
    const link = (href, label, key) => `<a href="${href}"${page === key ? ' aria-current="page"' : ''}>${label}</a>`;
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `<div class="wrap nav">
      <a class="brand" href="/" aria-label="Vastu Design home"><img src="/img/logo.png" alt="" width="46" height="46"><span><b>VASTU DESIGN</b><small class="deva">वास्तु डिझाईन</small></span></a>
      <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu"><span></span><span></span><span></span></button>
      <nav class="links" id="menu" aria-label="Main">
        ${link('/', 'Home', 'home')}${link('/portfolio', 'Our Work', 'work')}${link('/about', 'About', 'about')}${link('/contact', 'Contact', 'contact')}
        <a class="btn" data-tel href="tel:+919876543285">Call us</a>
      </nav></div>`;
    document.body.prepend(header);
    const skip = document.createElement('a'); skip.className = 'skip'; skip.href = '#main'; skip.textContent = 'Skip to content'; document.body.prepend(skip);
    const burger = $('.burger', header), menu = $('#menu', header);
    burger.onclick = () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); };
    $$('a', menu).forEach(a => a.addEventListener('click', () => { menu.classList.remove('open'); burger.setAttribute('aria-expanded', false); }));
    const onScroll = () => header.classList.toggle('solid', scrollY > 30 || page !== 'home');
    onScroll(); addEventListener('scroll', onScroll, { passive: true });

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `<div class="wrap"><div class="foot">
      <div><a class="brand" href="/"><img src="/img/logo.png" alt="" width="46" height="46"><span><b>VASTU DESIGN</b><small class="deva">वास्तु डिझाईन</small></span></a>
        <p style="margin-top:16px;max-width:26em" data-tagline></p></div>
      <div><h4>Explore</h4><ul><li><a href="/portfolio">Our Work</a></li><li><a href="/about">About Varad</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Get in touch</h4><ul><li><a data-tel data-phone href="tel:+919876543285">+91 98765 43285</a></li><li><span data-address>Alibaug, Maharashtra</span></li><li><a href="/admin" rel="nofollow">Owner login</a></li></ul></div>
    </div><div class="copy"><span>© ${new Date().getFullYear()} Vastu Design. All rights reserved.</span><span>Varad Langi · Civil Engineer · Alibaug</span></div></div>`;
    document.body.append(footer);
    const fab = document.createElement('a');
    fab.className = 'fab'; fab.setAttribute('data-wa', ''); fab.target = '_blank'; fab.rel = 'noopener'; fab.setAttribute('aria-label', 'Chat on WhatsApp'); fab.innerHTML = I.chat;
    document.body.append(fab);
    applySettings();
  }

  /* ---------- reveal on scroll ---------- */
  let io;
  function reveal() {
    if (!('IntersectionObserver' in window)) { $$('.rv').forEach(e => e.classList.add('in')); return; }
    io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    $$('.rv:not(.in)').forEach(e => io.observe(e));
  }

  /* ---------- compare slider ---------- */
  function compare(before, after, alt) {
    const d = document.createElement('div');
    d.className = 'compare';
    d.innerHTML = `<img src="${esc(before)}" alt="Before: ${esc(alt)}" draggable="false"><img class="after" src="${esc(after)}" alt="After: ${esc(alt)}" draggable="false">
      <span class="lbl b">Before</span><span class="lbl a">After</span><div class="handle"></div>
      <input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after">`;
    const r = $('input', d);
    r.addEventListener('input', () => d.style.setProperty('--pos', r.value + '%'));
    return d;
  }

  /* ---------- tiles ---------- */
  const thumbOf = m => m.type === 'video' ? m.poster : (m.thumb || m.src);
  function tile(m, onOpen) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile' + (m.type === 'video' ? ' vid' : '');
    const th = thumbOf(m);
    const media = th ? `<img src="${esc(th)}" alt="${esc(m.title)}" loading="lazy">` : `<video src="${esc(m.src)}#t=0.8" preload="metadata" muted playsinline></video>`;
    const badge = m.type === 'compare' ? `<span class="badge">${I.compare} Before / After</span>` : '';
    b.innerHTML = `${media}${badge}${m.type === 'video' ? `<span class="play">${I.play}</span>` : ''}<span class="cap"><b>${esc(m.title)}</b><span>${esc(m.category)}</span></span>`;
    b.setAttribute('aria-label', `${m.title} – ${m.type === 'video' ? 'play video' : 'view'}`);
    b.addEventListener('click', onOpen);
    if (m.type === 'video' && matchMedia('(hover:hover)').matches) {
      let v;
      b.addEventListener('mouseenter', () => { v = document.createElement('video'); v.src = m.src; v.muted = true; v.loop = true; v.playsInline = true; v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'; b.insertBefore(v, b.querySelector('.play')); v.play().catch(() => {}); });
      b.addEventListener('mouseleave', () => { if (v) { v.remove(); v = null; } });
    }
    return b;
  }

  /* ---------- lightbox ---------- */
  let lb, lbItems = [], lbIdx = 0;
  function buildLb() {
    lb = document.createElement('div');
    lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Gallery viewer');
    lb.innerHTML = '<button class="x" aria-label="Close">✕</button><button class="pv" aria-label="Previous">‹</button><button class="nx" aria-label="Next">›</button><div class="lb-stage"></div><div class="lb-cap"></div>';
    document.body.append(lb);
    $('.x', lb).onclick = closeLb; $('.pv', lb).onclick = () => step(-1); $('.nx', lb).onclick = () => step(1);
    lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-stage')) closeLb(); });
    addEventListener('keydown', e => { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });
    let x0 = null;
    lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => { if (x0 == null || e.target.closest('.compare, video')) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); x0 = null; });
  }
  function showLb() {
    const m = lbItems[lbIdx], stage = $('.lb-stage', lb);
    stage.innerHTML = '';
    if (m.type === 'video') {
      const v = document.createElement('video'); v.src = m.src; if (m.poster) v.poster = m.poster; v.controls = true; v.autoplay = true; v.playsInline = true; v.setAttribute('controlsList', 'nodownload'); stage.append(v); v.play().catch(() => {});
    } else if (m.type === 'compare') stage.append(compare(m.before, m.src, m.title));
    else { const i = document.createElement('img'); i.src = m.src; i.alt = m.title; stage.append(i); }
    $('.lb-cap', lb).innerHTML = `<b>${esc(m.title)}</b><span>${esc(m.category)} · ${lbIdx + 1} / ${lbItems.length}</span>`;
    const multi = lbItems.length > 1; $('.pv', lb).style.display = $('.nx', lb).style.display = multi ? '' : 'none';
  }
  function step(d) { lbIdx = (lbIdx + d + lbItems.length) % lbItems.length; showLb(); }
  let lastFocus;
  function openLb(items, i) {
    if (!lb) buildLb();
    lastFocus = document.activeElement; lbItems = items; lbIdx = i; showLb();
    lb.classList.add('open'); document.body.style.overflow = 'hidden'; $('.x', lb).focus();
  }
  function closeLb() {
    lb.classList.remove('open'); document.body.style.overflow = ''; $('.lb-stage', lb).innerHTML = '';
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- media cache ---------- */
  let mediaP;
  const loadMedia = () => mediaP || (mediaP = api('/api/media').catch(() => []));

  window.VD = { $, $$, esc, api, I, tile, compare, openLb, reveal, loadMedia, settingsReady, thumbOf, fmtPhone, getSettings: () => settings };
  document.addEventListener('DOMContentLoaded', () => { if (document.body.dataset.page !== 'admin') mountChrome(); reveal(); });
})();
