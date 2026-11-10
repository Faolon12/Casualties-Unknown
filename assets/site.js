// LUNA community hub. Plain JS, no build step: reads data/mods.json, data/types.json and data/resources.json.
(function () {
  'use strict';
  const REPO = 'Faolon12/Casualties-Unknown'; // where uploads are posted (GitHub issues) and the files live
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|\.?\/?[\w-]+\/)/i.test(u || '') && !/^\s*javascript:/i.test(u) ? u : '');
  const getJSON = (p) => fetch(p, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  $('#shareBtn').href = 'https://github.com/' + REPO + '/issues/new?template=share-resource.yml';
  $('#shareStream').href = 'https://github.com/' + REPO + '/issues/new?template=share-stream-setup.yml';
  $('#repoLink').href = 'https://github.com/' + REPO;

  let TYPES = {}, RES = [], ALL = [], type = 'all';

  Promise.all([getJSON('data/mods.json'), getJSON('data/types.json'), getJSON('data/resources.json')]).then(([mods, types, res]) => {
    renderMods(mods);
    TYPES = types || {};
    ALL = (res && Array.isArray(res.resources)) ? res.resources : [];
    RES = ALL.filter((r) => !r.official && r.type !== 'stream' && r.type !== 'props');
    renderAuthor(); renderProps(); renderStream(); renderChips(); renderRes(); openFromHash();
  });

  function renderMods(m) {
    const box = $('#modList');
    if (!m || !Array.isArray(m.mods)) { box.innerHTML = '<div class="empty">Could not load the mod list.</div>'; return; }
    box.innerHTML = m.mods.map((x) => {
      const nexus = safeUrl(x.nexus), gh = safeUrl(x.github), img = safeUrl(x.image);
      return `<article class="card" id="mod-${esc(x.id)}">
        ${img ? `<div class="cover" style="background-image:url('${esc(img)}')"></div>` : ''}
        <div class="body">
          <h3>${esc(x.name)}</h3>
          <div class="ver">v${esc(x.version)}</div>
          <p>${esc(x.summary)}</p>
          ${x.tags && x.tags.length ? `<div class="tags">${x.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          <div class="btns">
            ${nexus ? `<a class="btn nexus" href="${esc(nexus)}" target="_blank" rel="noopener">Download on Nexus ↗</a>` : `<span class="btn off" title="Nexus page coming soon">Nexus · soon</span>`}
            ${gh ? `<a class="btn" href="${esc(gh)}" target="_blank" rel="noopener">GitHub</a>` : ''}
          </div>
        </div></article>`;
    }).join('');
    if (m.editor) {
      $('#edName').textContent = m.editor.name || 'Luna Rig Editor';
      $('#edSummary').textContent = m.editor.summary || '';
      const u = safeUrl(m.editor.url);
      if (u) { $('#edLink').href = u; $('#heroEditor').href = u; $('#heroEditor').target = '_blank'; } else $('#edLink').classList.add('off');
      const dl = safeUrl(m.editor.download), zip = safeUrl(m.editor.zip);
      if (dl) $('#edDown').href = dl; else $('#edDown').hidden = true;
      if (zip) $('#edZip').href = zip; else $('#edZip').hidden = true;
    }
  }

  function renderChips() {
    const counts = {}; RES.forEach((r) => { counts[r.type] = (counts[r.type] || 0) + 1; });
    const keys = ['all'].concat(Object.keys(TYPES).filter((k) => k !== 'stream' && k !== 'props'));
    $('#typeChips').innerHTML = keys.map((k) => {
      const lab = k === 'all' ? 'All' : TYPES[k].label, n = k === 'all' ? RES.length : (counts[k] || 0);
      return `<button class="chip" data-t="${esc(k)}" aria-pressed="${k === type}" title="${esc(k === 'all' ? '' : TYPES[k].hint)}">${esc(lab)} · ${n}</button>`;
    }).join('');
    $('#typeChips').querySelectorAll('.chip').forEach((b) => (b.onclick = () => { type = b.dataset.t; renderChips(); renderRes(); }));
  }

  function filtered() {
    const q = $('#q').value.trim().toLowerCase();
    let list = RES.filter((r) => type === 'all' || r.type === type);
    if (q) list = list.filter((r) => [r.name, r.author, r.description, (r.tags || []).join(' '), (TYPES[r.type] || {}).label].join(' ').toLowerCase().includes(q));
    if ($('#sort').value === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    else list = list.slice().sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')));
    return list;
  }

  // pixel art: blow it up by a whole number so it stays crisp and fills the box
  function pixelFit(img) {
    const fit = () => { const box = img.parentElement; if (!img.naturalWidth || !box) return; const k = Math.max(1, Math.floor(Math.min(box.clientWidth * 0.86 / img.naturalWidth, box.clientHeight * 0.86 / img.naturalHeight)));
      img.style.width = img.naturalWidth * k + 'px'; img.style.height = img.naturalHeight * k + 'px'; img.style.maxWidth = 'none'; img.style.maxHeight = 'none'; };
    if (img.complete) fit(); else img.addEventListener('load', fit, { once: true });
  }
  function cardHtml(r) {
    return `<article class="card" tabindex="0" data-id="${esc(r.id)}">
      <div class="thumb">${r.preview ? `<img loading="lazy" src="${esc(base(r) + r.preview)}" alt="${esc(r.name)}">` : ''}</div>
      <div class="body"><div class="tags"><span class="pill">${esc((TYPES[r.type] || { label: r.type }).label)}</span>${r.official ? '<span class="pill star">★ Author</span>' : ''}</div><h3>${esc(r.name)}</h3><div class="by">by ${esc(r.author || 'unknown')}</div></div>
    </article>`;
  }
  function bindCards(box) {
    box.querySelectorAll('.thumb img').forEach(pixelFit);
    box.querySelectorAll('.card').forEach((c) => {
      c.onclick = () => open(c.dataset.id);
      c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(c.dataset.id); } };
    });
  }
  // ---- stream setups: a share code instead of a file; the bot already listed what's in it
  const HOW_ICON = (h) => h.startsWith('chat ') ? '💬 ' + h.slice(5) : h.endsWith(' points') ? '🔷 ' + h : h.endsWith(' bits') ? '💎 ' + h : h === 'power-up' ? '⚡ power-up' : h;
  function renderStream() {
    const list = ALL.filter((r) => r.type === 'stream'), box = $('#streamList');
    if (!list.length) { box.innerHTML = '<div class="empty">No setups shared yet. Be the first: <a href="#share">share your code</a>!</div>'; return; }
    box.innerHTML = list.map((r) => {
      const sm = r.summary || {}, n = (sm.actions || []).length;
      const bits = [n + ' action' + (n === 1 ? '' : 's')]; if ((sm.events || []).length) bits.push('events: ' + sm.events.join(', ')); if (sm.hype) bits.push('hype bar'); if (sm.chaos) bits.push('chaos mode');
      return `<article class="card" tabindex="0" data-id="${esc(r.id)}"><div class="body">
        <span class="pill">Stream setup</span><h3>${esc(r.name)}</h3><div class="by">by ${esc(r.author || 'unknown')}</div>
        <p class="small">${esc(bits.join(' · '))}</p>
        <div class="tags">${(sm.actions || []).slice(0, 5).map((a) => `<span class="tag">${esc(a.name)}</span>`).join('')}${n > 5 ? `<span class="tag">+${n - 5}</span>` : ''}</div>
      </div></article>`;
    }).join('');
    bindCards(box);
  }
  function renderProps() {
    const list = ALL.filter((r) => r.type === 'props').sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || String(b.added || '').localeCompare(String(a.added || ''))), box = $('#propsList');
    if (!list.length) { box.innerHTML = '<div class="empty">No prop packs yet. Be the first: <a href="#share">share one</a>!</div>'; return; }
    box.innerHTML = list.map(cardHtml).join(''); bindCards(box);
  }
  function renderAuthor() {
    const list = ALL.filter((r) => r.official && r.type !== 'props' && r.type !== 'stream'), box = $('#authorList');
    if (!list.length) { $('#author').hidden = true; return; }
    box.innerHTML = list.map(cardHtml).join(''); bindCards(box);
  }
  function renderRes() {
    const box = $('#resList'), list = filtered();
    if (!RES.length) { box.innerHTML = '<div class="empty">Nothing here yet. Be the first: <a href="#share">share something</a>!</div>'; return; }
    if (!list.length) { box.innerHTML = '<div class="empty">No matches. Try another search or type.</div>'; return; }
    box.innerHTML = list.map(cardHtml).join(''); bindCards(box);
  }
  const base = (r) => 'resources/' + encodeURIComponent(r.id) + '/';
  $('#q').oninput = renderRes; $('#sort').onchange = renderRes;

  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function open(id) {
    const r = ALL.find((x) => x.id === id); if (!r) return;
    const oldActs = $('#mActs'); if (oldActs) oldActs.remove();
    $('#modal').classList.toggle('noimg', !r.preview);
    $('#mImg').src = r.preview ? base(r) + r.preview : ''; $('#mImg').alt = r.name;
    $('#mType').textContent = (TYPES[r.type] || { label: r.type }).label + (r.official ? ' · ★ from the author' : '');
    $('#mTitle').textContent = r.name;
    $('#mBy').textContent = 'by ' + (r.author || 'unknown');
    $('#mDesc').textContent = r.description || '';
    $('#mTags').innerHTML = (r.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    if (r.type === 'stream' && r.summary) {
      const sm = r.summary;
      $('#mDesc').insertAdjacentHTML('afterend', `<div class="acts" id="mActs"><b>What's in it</b>${(sm.actions || []).map((a) => `<div class="act"><span>${esc(a.name)}</span><span class="how">${(a.how || []).map((h) => esc(HOW_ICON(h))).join(' · ') || '<i>chaos / events only</i>'}</span></div>`).join('')}
        ${(sm.events || []).length ? `<div class="act"><span>Stream events</span><span class="how">${esc(sm.events.join(', '))}</span></div>` : ''}${sm.hype ? '<div class="act"><span>Hype bar</span><span class="how">on</span></div>' : ''}${sm.chaos ? '<div class="act"><span>Chaos mode</span><span class="how">on</span></div>' : ''}</div>`);
    }
    const meta = [];
    if (r.needs) meta.push('Needs: ' + esc(r.needs));
    if (r.added) meta.push('Added: ' + esc(r.added));
    if (r.size) meta.push('Size: ' + kb(r.size));
    $('#mMeta').innerHTML = meta.map((x) => `<span>${x}</span>`).join('');
    const btns = [];
    if (r.code) btns.push(`<button class="btn red" id="mCode">📋 Copy the code</button>`);
    if (r.file) btns.push(`<a class="btn red" href="${esc(base(r) + r.file)}" download>⬇ Download</a>`);
    if (r.type === 'rig' || r.type === 'addon' || r.type === 'gear' || r.type === 'props') {
      const ed = $('#edLink').href; if (ed && !ed.endsWith('#')) btns.push(`<a class="btn" href="${esc(ed)}" target="_blank" rel="noopener" title="Download first, then drop the zip into the editor">Open the editor ↗</a>`);
    }
    if (r.issue) btns.push(`<a class="btn" href="https://github.com/${REPO}/issues/${encodeURIComponent(r.issue)}" target="_blank" rel="noopener">Comments ↗</a>`);
    btns.push(`<button class="btn" id="mCopy">Copy link</button>`);
    $('#mBtns').innerHTML = btns.join('');
    if (r.code) $('#mCode').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(r.code) : Promise.reject()).then(() => ($('#mCode').textContent = 'Copied! Now F9 → Presets → Paste a code'), () => prompt('Copy this code:', r.code)); };
    $('#mCopy').onclick = () => { const u = location.href.split('#')[0] + '#r=' + encodeURIComponent(r.id); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => ($('#mCopy').textContent = 'Copied!'), () => prompt('Copy this link:', u)); };
    $('#mImg').removeAttribute('style'); $('#modal').hidden = false; pixelFit($('#mImg')); history.replaceState(null, '', '#r=' + encodeURIComponent(r.id)); $('#mClose').focus();
  }
  function close() { $('#modal').hidden = true; if (location.hash.startsWith('#r=')) history.replaceState(null, '', '#community'); }
  $('#mClose').onclick = close;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') close(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) close(); });
  function openFromHash() { const m = location.hash.match(/^#r=(.+)$/); if (m) open(decodeURIComponent(m[1])); }
  window.addEventListener('hashchange', openFromHash);
})();
