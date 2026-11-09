// LUNA community hub. Plain JS, no build step: reads data/mods.json, data/types.json and data/resources.json.
(function () {
  'use strict';
  const REPO = 'Faolon12/Casualties-Unknown'; // where uploads are posted (GitHub issues) and the files live
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|\.?\/?[\w-]+\/)/i.test(u || '') && !/^\s*javascript:/i.test(u) ? u : '');
  const getJSON = (p) => fetch(p, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  $('#shareBtn').href = 'https://github.com/' + REPO + '/issues/new?template=share-resource.yml';
  $('#repoLink').href = 'https://github.com/' + REPO;

  let TYPES = {}, RES = [], ALL = [], type = 'all';

  Promise.all([getJSON('data/mods.json'), getJSON('data/types.json'), getJSON('data/resources.json')]).then(([mods, types, res]) => {
    renderMods(mods);
    TYPES = types || {};
    ALL = (res && Array.isArray(res.resources)) ? res.resources : [];
    RES = ALL.filter((r) => !r.official);
    renderAuthor(); renderChips(); renderRes(); openFromHash();
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
    }
  }

  function renderChips() {
    const counts = {}; RES.forEach((r) => { counts[r.type] = (counts[r.type] || 0) + 1; });
    const keys = ['all'].concat(Object.keys(TYPES));
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
  function renderAuthor() {
    const list = ALL.filter((r) => r.official), box = $('#authorList');
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
    $('#mImg').src = r.preview ? base(r) + r.preview : ''; $('#mImg').alt = r.name;
    $('#mType').textContent = (TYPES[r.type] || { label: r.type }).label + (r.official ? ' · ★ from the author' : '');
    $('#mTitle').textContent = r.name;
    $('#mBy').textContent = 'by ' + (r.author || 'unknown');
    $('#mDesc').textContent = r.description || '';
    $('#mTags').innerHTML = (r.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    const meta = [];
    if (r.needs) meta.push('Needs: ' + esc(r.needs));
    if (r.added) meta.push('Added: ' + esc(r.added));
    if (r.size) meta.push('Size: ' + kb(r.size));
    $('#mMeta').innerHTML = meta.map((x) => `<span>${x}</span>`).join('');
    const btns = [];
    if (r.file) btns.push(`<a class="btn red" href="${esc(base(r) + r.file)}" download>⬇ Download</a>`);
    if (r.type === 'rig' || r.type === 'addon' || r.type === 'gear' || r.type === 'props') {
      const ed = $('#edLink').href; if (ed && !ed.endsWith('#')) btns.push(`<a class="btn" href="${esc(ed)}" target="_blank" rel="noopener" title="Download first, then drop the zip into the editor">Open the editor ↗</a>`);
    }
    if (r.issue) btns.push(`<a class="btn" href="https://github.com/${REPO}/issues/${encodeURIComponent(r.issue)}" target="_blank" rel="noopener">Comments ↗</a>`);
    btns.push(`<button class="btn" id="mCopy">Copy link</button>`);
    $('#mBtns').innerHTML = btns.join('');
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
