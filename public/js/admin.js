/* Owner area: log in, add / delete photos and videos, read messages */
(function () {
  const { $, $$, esc, api, I } = VD;
  const app = $('#app');
  let media = [], enquiries = [], tab = 'gallery';

  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2600); }

  /* ---------- login ---------- */
  function showLogin(msg) {
    app.innerHTML = `<div class="login"><div class="card">
      <img src="/img/logo.png" alt=""><h2 style="margin:0">Owner login</h2><p class="muted" style="margin:6px 0 0">Vastu Design · manage your photos and videos</p>
      <form id="lf" novalidate>
        <div class="field"><label for="u">Username</label><input id="u" type="text" autocomplete="username" autocapitalize="none" required></div>
        <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <button class="btn" style="width:100%" type="submit">Log in</button>
        <div id="lm" class="msg err" role="alert" ${msg ? '' : 'hidden'}>${esc(msg || '')}</div>
      </form><p style="margin:20px 0 0"><a class="muted" href="/">← Back to website</a></p></div></div>`;
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      try { await api('/api/login', { method: 'POST', body: { username: $('#u').value, password: $('#pw').value } }); await boot(); }
      catch (err) { const m = $('#lm'); m.hidden = false; m.textContent = err.message; }
    };
    $('#u').focus();
  }

  /* ---------- shell ---------- */
  function shell() {
    app.innerHTML = `<div class="bar"><div class="wrap">
        <a class="brand" href="/"><img src="/img/logo.png" alt=""><span><b>VASTU DESIGN</b><small>Owner area</small></span></a>
        <div class="acts"><a class="btn ghost sm" href="/" target="_blank" rel="noopener">View website</a><button class="btn sm" id="lo">Log out</button></div>
      </div></div>
      <main class="adm"><div class="wrap">
        <div class="tabs" role="tablist">
          <button class="tab" role="tab" data-t="gallery">Photos &amp; videos</button>
          <button class="tab" role="tab" data-t="add">+ Add new</button>
          <button class="tab" role="tab" data-t="msgs">Messages <small id="mc" hidden></small></button>
          <button class="tab" role="tab" data-t="settings">Settings</button>
        </div><div id="pane"></div></div></main>`;
    $('#lo').onclick = async () => { await api('/api/logout', { method: 'POST' }); showLogin(); };
    $$('.tab').forEach(b => b.onclick = () => go(b.dataset.t));
    go(tab);
  }
  function go(t) {
    tab = t;
    $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
    ({ gallery: pGallery, add: pAdd, msgs: pMsgs, settings: pSettings })[t]();
  }
  const cats = () => [...new Set(['Interiors', 'Exteriors', 'Renovation', 'On Site', ...media.map(m => m.category)])];
  const catList = () => `<datalist id="cats">${cats().map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;

  /* ---------- gallery ---------- */
  function pGallery() {
    const pane = $('#pane');
    if (!media.length) { pane.innerHTML = '<p class="empty">Nothing here yet. Click <b>+ Add new</b> to upload your first photo or video.</p>'; return; }
    pane.innerHTML = `<p class="muted" style="margin-bottom:18px">${media.length} items. Change a title or category and it saves automatically. Tick “Show on home page” for your best work.</p>${catList()}<div class="grid" id="mg"></div>`;
    const g = $('#mg');
    media.forEach(m => {
      const th = VD.thumbOf(m);
      const c = document.createElement('div'); c.className = 'mc';
      c.innerHTML = `<div class="th">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : `<video src="${esc(m.src)}#t=0.8" preload="metadata" muted playsinline></video>`}
          <span class="badge">${m.type === 'video' ? 'Video' : m.type === 'compare' ? 'Before / After' : 'Photo'}</span></div>
        <div class="bd">
          <input type="text" value="${esc(m.title)}" maxlength="100" aria-label="Title" data-f="title">
          <input type="text" value="${esc(m.category)}" list="cats" maxlength="40" aria-label="Category" data-f="category">
          ${m.type !== 'video' ? `<label class="chk"><input type="checkbox" data-f="featured" ${m.featured ? 'checked' : ''}> Show on home page</label>` : ''}
          <div class="row"><span class="saved">Saved ✓</span><button class="btn danger sm" data-del>Delete</button></div>
        </div>`;
      const saved = $('.saved', c);
      $$('[data-f]', c).forEach(inp => inp.addEventListener('change', async () => {
        const f = inp.dataset.f, v = f === 'featured' ? inp.checked : inp.value;
        try { const r = await api('/api/media/' + m.id, { method: 'PATCH', body: { [f]: v } }); Object.assign(m, r); saved.classList.add('on'); setTimeout(() => saved.classList.remove('on'), 1500); }
        catch (e) { toast(e.message); }
      }));
      $('[data-del]', c).onclick = async () => {
        if (!confirm(`Delete “${m.title}” permanently? This cannot be undone.`)) return;
        try { await api('/api/media/' + m.id, { method: 'DELETE' }); media = media.filter(x => x.id !== m.id); toast('Deleted'); pGallery(); }
        catch (e) { toast(e.message); }
      };
      g.append(c);
    });
  }

  /* ---------- add ---------- */
  function makePoster(file) {
    return new Promise(res => {
      const v = document.createElement('video'), url = URL.createObjectURL(file); let done = false;
      const fin = b => { if (done) return; done = true; URL.revokeObjectURL(url); res(b); };
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onloadeddata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch (e) { fin(null); } };
      v.onseeked = () => { const c = document.createElement('canvas'); c.width = 540; c.height = Math.round(540 * v.videoHeight / v.videoWidth) || 960; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); c.toBlob(fin, 'image/jpeg', .8); };
      v.onerror = () => fin(null); setTimeout(() => fin(null), 10000);
    });
  }
  function send(fd, onProg) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest(); x.open('POST', '/api/media'); x.withCredentials = true;
      x.upload.onprogress = e => e.lengthComputable && onProg(e.loaded / e.total);
      x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch (e) {} x.status < 300 ? res(d) : rej(new Error(d.error || 'Upload failed (' + x.status + ')')); };
      x.onerror = () => rej(new Error('Network error. Please check your connection.'));
      x.send(fd);
    });
  }
  function pAdd() {
    let mode = 'photo', queue = [], pair = { before: null, after: null };
    const pane = $('#pane');
    pane.innerHTML = `${catList()}<div class="panel" style="max-width:820px">
      <div class="seg" role="group" aria-label="What are you adding?"><button data-m="photo" aria-pressed="true">Photos</button><button data-m="video" aria-pressed="false">Videos</button><button data-m="compare" aria-pressed="false">Before &amp; After</button></div>
      <div class="field" style="max-width:340px"><label for="cat">Category</label><input id="cat" type="text" list="cats" value="Interiors" maxlength="40"></div>
      <div id="zone"></div><div class="q" id="q"></div>
      <button class="btn" id="go" disabled>Upload</button> <span id="gs" class="muted"></span>
      <p class="hint">Photos: JPG, PNG or WebP. Videos: MP4 (up to 300 MB each). Large photos are resized automatically.</p></div>`;
    const zone = $('#zone'), q = $('#q'), goBtn = $('#go');

    function renderZone() {
      if (mode === 'compare') {
        zone.innerHTML = `<div class="pair">${['before', 'after'].map(k => `<label class="drop" for="f-${k}" style="text-transform:none;letter-spacing:0;color:var(--ink)"><b>${k === 'before' ? 'Before' : 'After'} photo</b><span class="muted">${pair[k] ? esc(pair[k].name) : 'Tap to choose'}</span>${pair[k] ? `<img src="${URL.createObjectURL(pair[k])}" alt="">` : ''}</label><input id="f-${k}" type="file" accept="image/*" hidden>`).join('')}</div>
          <div class="field" style="margin-top:16px;max-width:420px"><label for="pt">Title</label><input id="pt" type="text" maxlength="100" placeholder="e.g. Master bedroom makeover" value="${esc(pair.title || '')}"></div>
          <p class="hint">Use two photos taken from the same spot for the best slider effect.</p>`;
        ['before', 'after'].forEach(k => $('#f-' + k).onchange = e => { pair[k] = e.target.files[0] || null; pair.title = $('#pt').value; renderZone(); upd(); });
        $('#pt').oninput = e => { pair.title = e.target.value; };
      } else {
        zone.innerHTML = `<label class="drop" id="dz" for="fi" style="display:block;text-transform:none;letter-spacing:0;color:var(--ink)"><b>Drop ${mode === 'video' ? 'videos' : 'photos'} here</b><span class="muted">or tap to choose from your ${/Mobi|Android/i.test(navigator.userAgent) ? 'phone' : 'computer'}</span></label>
          <input id="fi" type="file" multiple accept="${mode === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/*'}" hidden>`;
        const add = fl => { [...fl].forEach(f => { if (mode === 'video' ? f.type.startsWith('video/') : f.type.startsWith('image/')) queue.push({ file: f, title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }); }); drawQ(); };
        $('#fi').onchange = e => { add(e.target.files); e.target.value = ''; };
        const dz = $('#dz');
        ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
        ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
        dz.addEventListener('drop', e => add(e.dataTransfer.files));
      }
      drawQ();
    }
    function drawQ() {
      q.innerHTML = '';
      if (mode !== 'compare') queue.forEach((it, i) => {
        const url = URL.createObjectURL(it.file), r = document.createElement('div'); r.className = 'qi';
        r.innerHTML = `<div class="pv">${mode === 'video' ? `<video src="${url}#t=0.5" muted preload="metadata"></video>` : `<img src="${url}" alt="">`}</div>
          <div><input type="text" value="${esc(it.title)}" maxlength="100" aria-label="Title"><div class="bar2"><i></i></div></div>
          <div class="st"><span>${(it.file.size / 1048576).toFixed(1)} MB</span> <button class="chip" data-rm aria-label="Remove">✕</button></div>`;
        $('input', r).oninput = e => it.title = e.target.value;
        $('[data-rm]', r).onclick = () => { queue.splice(i, 1); drawQ(); };
        it.row = r; q.append(r);
      });
      upd();
    }
    function upd() { goBtn.disabled = mode === 'compare' ? !(pair.before && pair.after) : !queue.length; goBtn.textContent = mode === 'compare' ? 'Upload before & after' : `Upload ${queue.length || ''} ${mode === 'video' ? 'video' : 'photo'}${queue.length === 1 ? '' : 's'}`.replace('  ', ' '); }

    $$('.seg button', pane).forEach(b => b.onclick = () => { mode = b.dataset.m; queue = []; $$('.seg button', pane).forEach(x => x.setAttribute('aria-pressed', x === b)); renderZone(); });

    goBtn.onclick = async () => {
      const category = $('#cat').value.trim() || 'Interiors';
      goBtn.disabled = true; const gs = $('#gs'); let ok = 0, fail = 0;
      if (mode === 'compare') {
        const fd = new FormData(); fd.append('title', pair.title || 'Before & After'); fd.append('category', category); fd.append('before', pair.before); fd.append('file', pair.after);
        gs.textContent = 'Uploading…';
        try { media.unshift(await send(fd, p => gs.textContent = `Uploading… ${Math.round(p * 100)}%`)); ok++; } catch (e) { fail++; toast(e.message); }
        pair = { before: null, after: null };
      } else {
        for (const it of queue) {
          const bar = $('.bar2 i', it.row), st = $('.st span', it.row);
          const fd = new FormData(); fd.append('title', it.title); fd.append('category', category); fd.append('file', it.file);
          if (mode === 'video') { st.textContent = 'Preparing…'; const p = await makePoster(it.file); if (p) fd.append('poster', p, 'poster.jpg'); }
          try { const r = await send(fd, p => { bar.style.width = p * 100 + '%'; st.textContent = Math.round(p * 100) + '%'; }); media.unshift(r); st.textContent = 'Done ✓'; ok++; }
          catch (e) { st.textContent = 'Failed'; st.title = e.message; fail++; toast(e.message); }
        }
        queue = queue.filter(it => $('.st span', it.row).textContent !== 'Done ✓');
      }
      gs.textContent = `${ok} uploaded${fail ? `, ${fail} failed` : ''}.`;
      if (ok && !fail) { toast('Uploaded! It is now live on the website.'); setTimeout(() => go('gallery'), 900); } else { drawQ(); renderZone(); }
    };
    renderZone();
  }

  /* ---------- messages ---------- */
  function pMsgs() {
    const pane = $('#pane');
    if (!enquiries.length) { pane.innerHTML = '<p class="empty">No messages yet. When someone fills in the contact form, it will show up here.</p>'; return; }
    pane.innerHTML = '';
    enquiries.forEach(e => {
      const d = document.createElement('div'); d.className = 'enq';
      d.innerHTML = `<h3>${esc(e.name)}</h3><div class="muted">${new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · ${esc(e.interest || '')}</div>
        <div class="m">${esc(e.message)}</div><div class="cta-row"><a class="btn sm" href="tel:${esc(e.phone)}">Call ${esc(e.phone)}</a><a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${esc(e.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1'))}">WhatsApp</a><button class="btn ghost sm" data-d>Delete</button></div>`;
      $('[data-d]', d).onclick = async () => { if (!confirm('Delete this message?')) return; await api('/api/enquiries/' + e.id, { method: 'DELETE' }); enquiries = enquiries.filter(x => x.id !== e.id); badge(); pMsgs(); };
      pane.append(d);
    });
  }
  function badge() { const b = $('#mc'); if (!b) return; b.hidden = !enquiries.length; b.textContent = enquiries.length; }

  /* ---------- settings ---------- */
  function pSettings() {
    const s = VD.getSettings();
    $('#pane').innerHTML = `<div class="panel">
      <form class="card" id="sf"><h3>Website details</h3>
        <div class="field"><label for="s1">Phone number (10 digits)</label><input id="s1" type="tel" inputmode="numeric" value="${esc(s.phone)}"></div>
        <div class="field"><label for="s2">Tagline (home page)</label><input id="s2" type="text" maxlength="160" value="${esc(s.tagline)}"></div>
        <div class="field"><label for="s3">Location</label><input id="s3" type="text" maxlength="160" value="${esc(s.address)}"></div>
        <div class="field"><label for="s4">About you</label><textarea id="s4" maxlength="1500" rows="6">${esc(s.about)}</textarea></div>
        <div class="field"><label for="s5">Certifications &amp; qualifications (one per line)</label><textarea id="s5" rows="5">${esc((s.certifications || []).join('\n'))}</textarea><p class="hint">Add each certificate here and it will appear on the About page.</p></div>
        <button class="btn" type="submit">Save details</button></form>
      <form class="card" id="pf" style="margin-top:24px"><h3>Change password</h3>
        <div class="field"><label for="p1">Current password</label><input id="p1" type="password" autocomplete="current-password"></div>
        <div class="field"><label for="p2">New password (8+ characters)</label><input id="p2" type="password" autocomplete="new-password"></div>
        <button class="btn" type="submit">Change password</button></form></div>`;
    $('#sf').onsubmit = async e => { e.preventDefault(); try { const r = await api('/api/settings', { method: 'PUT', body: { phone: $('#s1').value, tagline: $('#s2').value, address: $('#s3').value, about: $('#s4').value, certifications: $('#s5').value.split('\n') } }); Object.assign(s, r); toast('Saved. Website updated.'); } catch (er) { toast(er.message); } };
    $('#pf').onsubmit = async e => { e.preventDefault(); try { await api('/api/password', { method: 'POST', body: { current: $('#p1').value, next: $('#p2').value } }); e.target.reset(); toast('Password changed.'); } catch (er) { toast(er.message); } };
  }

  /* ---------- boot ---------- */
  async function boot() {
    const me = await api('/api/me').catch(() => ({ authed: false }));
    if (!me.authed) return showLogin();
    [media, enquiries] = await Promise.all([api('/api/media'), api('/api/enquiries')]);
    await VD.settingsReady; shell(); badge();
  }
  boot();
})();
