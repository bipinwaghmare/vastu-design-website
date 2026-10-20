/* Contact page */
(function () {
  const { $, api, I } = VD;
  $('#i1').innerHTML = I.pin; $('#i2').innerHTML = I.phone;
  const form = $('#form'), box = $('#fmsg'), btn = $('#send');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    box.className = 'msg'; box.textContent = '';
    if (!d.name.trim() || !/^[+\d][\d\s-]{6,18}$/.test(d.phone.trim()) || !d.message.trim()) {
      box.className = 'msg err'; box.textContent = 'Please fill in your name, a valid phone number and a short message.'; return;
    }
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await api('/api/enquiries', { method: 'POST', body: d });
      form.reset(); box.className = 'msg ok'; box.textContent = 'Thank you! Varad will call you back soon.';
    } catch (err) { box.className = 'msg err'; box.textContent = err.message; }
    btn.disabled = false; btn.textContent = 'Send message';
  });
})();
