/* Home page */
(async function () {
  const { $, loadMedia, tile, openLb, compare, reveal, esc } = VD;
  const media = await loadMedia();

  // hero: slow cross-fade between featured photos
  const photos = media.filter(m => (m.type === 'photo' || m.type === 'compare') && m.featured);
  const heroItems = (photos.length ? photos : media.filter(m => m.type !== 'video')).slice(0, 4);
  if (heroItems.length) {
    const arch = $('#heroArch'), title = $('#heroTitle');
    arch.innerHTML = heroItems.map((m, i) => `<img class="${i ? '' : 'on'}" src="${esc(m.src)}" alt="${esc(m.title)}"${i ? ' loading="lazy"' : ''}>`).join('');
    title.textContent = heroItems[0].title;
    if (heroItems.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const imgs = [...arch.children]; let k = 0;
      setInterval(() => { imgs[k].classList.remove('on'); k = (k + 1) % imgs.length; imgs[k].classList.add('on'); title.textContent = heroItems[k].title; }, 5200);
    }
  }

  // featured grid
  const nonVid = media.filter(m => m.type !== 'video');
  const feat = (media.filter(m => m.featured && m.type !== 'video').length ? media.filter(m => m.featured && m.type !== 'video') : nonVid).slice(0, 6);
  const grid = $('#featGrid');
  feat.forEach((m, i) => { const t = tile(m, () => openLb(feat, i)); t.classList.add('rv'); grid.append(t); });
  if (!feat.length) grid.innerHTML = '<p class="empty">Our portfolio is coming soon.</p>';

  // before / after
  const cmp = media.find(m => m.type === 'compare');
  if (cmp) { $('#ba').hidden = false; $('#baBox').append(compare(cmp.before, cmp.src, cmp.title)); }

  // reels
  const vids = media.filter(m => m.type === 'video');
  if (vids.length) {
    $('#reels').hidden = false;
    const row = $('#reelRow');
    vids.forEach((m, i) => row.append(tile(m, () => openLb(vids, i))));
  }
  reveal();
})();
