/* Portfolio page */
(async function () {
  const { $, loadMedia, tile, openLb, reveal, esc } = VD;
  const all = await loadMedia();
  const grid = $('#grid'), filters = $('#filters'), empty = $('#empty');
  const cats = [...new Set(all.map(m => m.category))].sort();
  const opts = [['all', 'All'], ['photo', 'Photos'], ['video', 'Videos'], ...cats.map(c => ['c:' + c, c])];
  let cur = decodeURIComponent((location.hash || '#all').slice(1)) || 'all';
  if (!opts.some(o => o[0] === cur)) cur = 'all';

  function draw() {
    const list = all.filter(m => cur === 'all' || (cur === 'photo' && m.type !== 'video') || (cur === 'video' && m.type === 'video') || cur === 'c:' + m.category);
    grid.innerHTML = '';
    list.forEach((m, i) => grid.append(tile(m, () => openLb(list, i))));
    empty.hidden = list.length > 0;
    [...filters.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cur));
    if (grid.firstChild) grid.firstChild.animate && [...grid.children].forEach((t, i) => t.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: Math.min(i, 12) * 40, fill: 'backwards', easing: 'ease-out' }));
  }
  filters.innerHTML = opts.map(([k, l]) => `<button class="chip" type="button" data-k="${esc(k)}" aria-pressed="false">${esc(l)}</button>`).join('');
  filters.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cur = b.dataset.k; history.replaceState(null, '', '#' + encodeURIComponent(cur)); draw(); });
  draw(); reveal();
})();
