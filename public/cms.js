/* Add to the portfolio's index.html before </body>:
   <script src="https://YOUR-BACKEND-URL/cms.js"></script>
   Then mark elements:  data-cms="about.bio" (text) | data-cms-src="hero.image" | data-cms-href="contact.email" data-cms-prefix="mailto:"
   | data-cms-width="percent" (skill bars) | data-cms-list="services" on a container whose FIRST child is the repeating template
   (inside a list item use item field names, e.g. data-cms="title"). Empty values leave the original page content untouched. */
(() => {
  const API = new URL(document.currentScript.src).origin;
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const url = v => (/^\/uploads\//.test(v) ? API + v : v);
  const SEL = '[data-cms],[data-cms-src],[data-cms-href],[data-cms-width]';
  const fill = (el, scope) => {
    const use = (attr, fn) => { const p = el.getAttribute(attr); if (p == null) return; const v = get(scope, p); if (v != null && v !== '') fn(String(v)); };
    use('data-cms', v => (el.textContent = v));
    use('data-cms-src', v => (el.src = url(v)));
    use('data-cms-href', v => (el.href = (el.dataset.cmsPrefix || '') + url(v)));
    use('data-cms-width', v => (el.style.width = v + '%'));
  };
  const render = d => {
    document.querySelectorAll('[data-cms-list]').forEach(box => {
      const items = get(d, box.dataset.cmsList), tpl = box.firstElementChild;
      if (!Array.isArray(items) || !items.length || !tpl) return;
      tpl.remove();
      items.forEach(it => { const c = tpl.cloneNode(true); [c, ...c.querySelectorAll(SEL)].forEach(e => fill(e, it)); box.appendChild(c); });
    });
    document.querySelectorAll(SEL).forEach(e => { if (!e.closest('[data-cms-list]')) fill(e, d); });
  };
  const send = async e => {
    e.preventDefault(); e.stopImmediatePropagation();
    const form = document.querySelector('#contact form'), body = {};
    form.querySelectorAll('input,textarea').forEach(i => { if (i.value && !['submit', 'button', 'hidden'].includes(i.type)) body[i.name || i.id || i.placeholder || 'field'] = i.value; });
    try {
      const r = await fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      alert(r.ok ? 'Message sent. Thank you!' : 'Could not send your message. Please fill in the form and try again.');
      if (r.ok) form.reset();
    } catch { alert('Network error. Please try again.'); }
  };
  const init = () => {
    fetch(API + '/api/content').then(r => r.json()).then(render).catch(() => {});
    const form = document.querySelector('#contact form');
    if (form) form.addEventListener('submit', send, true);
    document.querySelectorAll('[data-cms-send]').forEach(b => b.addEventListener('click', send, true));
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
