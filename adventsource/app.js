(async function () {
  'use strict';

  const DATA_FILE = document.body.dataset.catalogFile || 'catalog-data.json';
  const TABLE_FORMAT = document.body.dataset.catalogFormat === 'tables';
  const PROGRAM = document.body.dataset.catalogProgram || 'Pathfinder';
  const STORAGE_KEY = document.body.dataset.catalogStorage || 'pf-tshirt-catalog';
  const list = document.getElementById('list');
  const search = document.getElementById('search');
  const count = document.getElementById('count');
  const status = document.getElementById('status');
  const editToggle = document.getElementById('editToggle');
  const imagePicker = document.getElementById('imagePicker');
  const toastEl = document.getElementById('toast');

  const money = n => (n == null || isNaN(n)) ? '—' : '$' + Number(n).toFixed(2);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Data model ---------- */

  const ASSETS_DIR = 'assets/';
  // Image references are relative to the catalog page; bare file names live in assets/.
  function normalizeImage(v) {
    const s = String(v == null ? '' : v).trim().replace(/\\/g, '/');
    if (!s) return null;
    return s.includes('/') ? s : ASSETS_DIR + s;
  }

  let uidSeq = 0;
  const newUid = () => 'u' + (++uidSeq);

  function toNumber(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  // Plain, serializable form (what goes into catalog-data.json / localStorage).
  function toPlain(items) {
    return items.map(s => ({
      id: s.sizes.length ? s.sizes[0].item : '',
      description: s.description,
      image: s.image || null,
      sizes: s.sizes.map(z => ({ item: z.item, size: z.size, price: z.price }))
    }));
  }

  function fromPlain(arr) {
    return (arr || []).map(s => ({
      uid: newUid(),
      description: String(s.description || ''),
      image: normalizeImage(s.image),
      sizes: (s.sizes || []).map(z => ({
        item: String(z.item == null ? '' : z.item),
        size: String(z.size == null ? '' : z.size),
        price: toNumber(z.price)
      }))
    }));
  }

  function validateCatalog(data) {
    if (!Array.isArray(data) || !data.every(s =>
      s && typeof s.description === 'string' &&
      (s.image === null || typeof s.image === 'string') &&
      Array.isArray(s.sizes) && s.sizes.every(z =>
        z && typeof z.item === 'string' && typeof z.size === 'string' &&
        (z.price === null || (typeof z.price === 'number' && Number.isFinite(z.price)))))) {
      throw new Error('The catalog must be an array of styles with descriptions, images, and valid size rows.');
    }
    return data;
  }

  function decodeCatalog(data) {
    if (!TABLE_FORMAT) return validateCatalog(data);
    const columns = ['Item #', 'Description', 'Size', 'Price'];
    if (!data || !Array.isArray(data.tables)) {
      throw new Error('The catalog must contain a tables array.');
    }
    return validateCatalog(data.tables.map(table => {
      if (!table || typeof table.title !== 'string' ||
          JSON.stringify(table.columns) !== JSON.stringify(columns) ||
          !Array.isArray(table.rows) ||
          !table.rows.every(row => Array.isArray(row) && row.length === 4 &&
            row.every(cell => typeof cell === 'string') && row[1] === table.title)) {
        throw new Error('Each table must have a title, Item #/Description/Size/Price columns, and matching description rows.');
      }
      const sizes = table.rows.map(([item, , size, price]) => {
        const text = price.trim();
        if (text && !/^\$?-?\d+(?:\.\d{1,2})?$/.test(text)) {
          throw new Error('Invalid price for item ' + item + ': ' + price);
        }
        return { item, size, price: text ? Number(text.replace('$', '')) : null };
      });
      return {
        id: sizes[0]?.item || '',
        description: table.title,
        image: Object.hasOwn(table, 'image') ? table.image
          : sizes.length ? ASSETS_DIR + 'Cat' + sizes[0].item + '.jpg' : null,
        sizes
      };
    }));
  }

  function catalogData() {
    const data = toPlain(items);
    if (!TABLE_FORMAT) return data;
    return {
      tables: data.map(style => {
        const table = {
          title: style.description,
          columns: ['Item #', 'Description', 'Size', 'Price'],
          rows: style.sizes.map(size => [
            size.item, style.description, size.size,
            size.price === null ? '' : '$' + size.price.toFixed(2)
          ])
        };
        const defaultImage = style.sizes.length
          ? ASSETS_DIR + 'Cat' + style.sizes[0].item + '.jpg' : null;
        if (style.image !== defaultImage) table.image = style.image;
        return table;
      })
    };
  }

  const controls = document.querySelectorAll('header input, header button');
  controls.forEach(control => { control.disabled = true; });
  list.textContent = 'Loading catalog...';
  let fileJson;
  try {
    const response = await fetch(DATA_FILE, { cache: 'no-store' });
    if (!response.ok) throw new Error(DATA_FILE + ' returned HTTP ' + response.status + '.');
    fileJson = JSON.stringify(toPlain(fromPlain(decodeCatalog(await response.json()))));
  } catch (error) {
    list.textContent = 'Could not load catalog: ' + error.message +
      ' Serve this page over HTTP and make sure ' + DATA_FILE + ' is available.';
    status.textContent = 'Catalog loading failed';
    list.setAttribute('role', 'alert');
    return;
  }
  controls.forEach(control => { control.disabled = false; });
  let baseJson = fileJson;          // last version known to be in the catalog file
  let items = loadInitial();
  let editing = false;
  const openSet = new Set();
  const previewUrls = {};           // uid -> object URL for newly chosen images
  let pendingImageUid = null;
  let fileHandle = null;

  function loadInitial() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* ignore */ }
    if (!stored || !Array.isArray(stored.items)) return fromPlain(JSON.parse(fileJson));

    const storedJson = JSON.stringify(stored.items);
    if (storedJson === fileJson) return fromPlain(stored.items);
    if (stored.base === fileJson) {
      baseJson = fileJson;
      return fromPlain(stored.items);
    }
    // The catalog file changed since the browser edits were made.
    const keep = confirm(
      DATA_FILE + ' has changed since you last edited in this browser, and you have browser edits that were never saved to the file.\n\n' +
      'OK = keep your browser edits\nCancel = discard them and load the file version');
    if (keep) return fromPlain(stored.items);
    localStorage.removeItem(STORAGE_KEY);
    return fromPlain(JSON.parse(fileJson));
  }

  const currentJson = () => JSON.stringify(toPlain(items));
  const isDirty = () => currentJson() !== baseJson;

  function persist() {
    try {
      if (isDirty()) localStorage.setItem(STORAGE_KEY, JSON.stringify({ base: baseJson, items: toPlain(items) }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      toast('Could not auto-save in this browser: ' + e.message);
    }
    updateStatus();
  }

  function updateStatus() {
    const dirty = isDirty();
    status.classList.toggle('dirty', dirty);
    status.textContent = dirty ? 'Changes saved in browser · not yet saved to file' : (editing ? 'All changes saved to file' : '');
    document.getElementById('discard').disabled = !dirty;
  }

  const findItem = uid => items.find(s => s.uid === uid);
  const cardEl = uid => list.querySelector(`.shirt[data-uid="${uid}"]`);

  /* ---------- Display helpers ---------- */

  // Orders sizes Youth -> Adult, then Small -> 4XL.
  const SIZE_ORDER = [
    [/\b(4xl|4x-large)\b/i, 7],
    [/\b(3xl|3x-large)\b/i, 6],
    [/\b(2xl|xxl|2x-large)\b/i, 5],
    [/\b(xl|x-large)\b/i, 4],
    [/\b(large|l)\b/i, 3],
    [/\b(medium|m)\b/i, 2],
    [/\b(small|s)\b/i, 1]
  ];
  function sizeRank(size) {
    const youth = /youth|\b(10\/12|14\/16)\b/i.test(size) ? 0 : 10;
    for (const [re, rank] of SIZE_ORDER) if (re.test(size)) return youth + rank;
    return 100;
  }
  function sortedSizes(s) {
    const ranks = s.sizes.map(z => sizeRank(z.size));
    // Duplicate ranks mean multiple colors/variants per size, so keep spreadsheet grouping.
    if (new Set(ranks).size !== ranks.length) return s.sizes.slice();
    return s.sizes.map((z, i) => ({ z, r: ranks[i], i })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.z);
  }
  function startPrice(s) {
    const prices = s.sizes.map(z => z.price).filter(p => p != null);
    return prices.length ? Math.min(...prices) : null;
  }

  /* ---------- Rendering ---------- */

  function headHtml(s) {
    const src = previewUrls[s.uid] || s.image;
    const thumb = src
      ? `<img src="${esc(src)}" alt="${esc(s.description)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;placeholder&quot;>Image not found</span>'">`
      : `<span class="placeholder">No image available</span>`;
    const n = s.sizes.length;
    const id = n ? s.sizes[0].item : '';
    return `
      <button class="card-head" type="button" aria-expanded="${openSet.has(s.uid)}" aria-controls="sizes-${s.uid}">
        <div class="thumb">${thumb}</div>
        <div class="info">
          <p class="desc">${esc(s.description) || '<em>(no description)</em>'}</p>
          <div class="meta">${id ? 'Item # ' + esc(id) + ' &middot; ' : ''}${n} size${n === 1 ? '' : 's'}</div>
        </div>
        <div class="price-block">
          <div class="label">${n > 1 ? 'Starting at' : 'Price'}</div>
          <div class="price">${money(startPrice(s))}</div>
        </div>
        <span class="chevron" aria-hidden="true"></span>
      </button>`;
  }

  function viewBodyHtml(s) {
    const rows = sortedSizes(s).map(z => `
      <tr>
        <td>${esc(z.item)}</td>
        <td>${esc(s.description)}</td>
        <td>${esc(z.size)}</td>
        <td class="num">${money(z.price)}</td>
      </tr>`).join('');
    return `
      <table>
        <thead><tr><th>Item #</th><th>Description</th><th>Size</th><th class="num">Price</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="no-rows">No sizes listed</td></tr>'}</tbody>
      </table>`;
  }

  function editBodyHtml(s) {
    const rows = s.sizes.map((z, i) => `
      <tr data-row="${i}">
        <td><input type="text" data-field="item" value="${esc(z.item)}" aria-label="Item number"></td>
        <td><input type="text" data-field="size" value="${esc(z.size)}" aria-label="Size"></td>
        <td><input type="number" data-field="price" value="${z.price == null ? '' : z.price.toFixed(2)}" step="0.01" min="0" aria-label="Price"></td>
        <td class="center"><button type="button" class="btn icon danger" data-action="del-row" title="Remove this size" aria-label="Remove this size">✕</button></td>
      </tr>`).join('');
    return `
      <div class="edit-fields">
        <label class="grow">Description
          <input type="text" data-shirt-field="description" value="${esc(s.description)}" placeholder="e.g. ${esc(PROGRAM)} T-Shirt - Navy">
        </label>
        <label class="img">Image file
          <input type="text" data-shirt-field="image" value="${esc(s.image || '')}" placeholder="e.g. assets/Cat994159.jpg">
        </label>
        <button type="button" class="btn" data-action="choose-image" title="Pick an image from the assets folder">Choose image…</button>
        <button type="button" class="btn danger" data-action="del-shirt">Delete T-shirt</button>
      </div>
      <table class="edit-table">
        <thead><tr>
          <th class="col-item">Item #</th><th>Size</th><th class="col-price num">Price ($)</th>
          <th class="col-del"></th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="no-rows">No sizes yet — click “+ Add size”.</td></tr>'}</tbody>
      </table>
      <div class="edit-actions">
        <button type="button" class="btn" data-action="add-row">+ Add size</button>
        <span class="problems"></span>
      </div>`;
  }

  function buildCard(s) {
    const el = document.createElement('article');
    el.className = 'shirt' + (openSet.has(s.uid) ? ' open' : '');
    el.dataset.uid = s.uid;
    el.innerHTML = headHtml(s) + `<div class="sizes" id="sizes-${s.uid}">${editing ? editBodyHtml(s) : viewBodyHtml(s)}</div>`;
    return el;
  }

  function render() {
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = `<p class="empty">${editing ? 'The catalog is empty — click “+ Add T-shirt”.' : 'No styles listed in ' + esc(DATA_FILE) + '.'}</p>`;
      count.textContent = '0 items';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(s => frag.appendChild(buildCard(s)));
    list.appendChild(frag);
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.hidden = true;
    empty.textContent = 'No items match your search.';
    list.appendChild(empty);
    applyFilter();
    validate();
  }

  function refreshCard(s) {
    const old = cardEl(s.uid);
    if (!old) return render();
    const el = buildCard(s);
    el.hidden = old.hidden;
    old.replaceWith(el);
    validate();
    return el;
  }

  function refreshHead(s) {
    const head = cardEl(s.uid).querySelector('.card-head');
    head.outerHTML = headHtml(s);
  }

  function setOpen(card, open) {
    const uid = card.dataset.uid;
    if (open) openSet.add(uid); else openSet.delete(uid);
    card.classList.toggle('open', open);
    card.querySelector('.card-head').setAttribute('aria-expanded', String(open));
  }

  /* ---------- Search ---------- */

  function applyFilter() {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach(s => {
      const el = cardEl(s.uid);
      if (!el) return;
      const hay = (s.description + ' ' + s.sizes.map(z => z.item).join(' ')).toLowerCase();
      el.hidden = !terms.every(t => hay.includes(t));
      if (!el.hidden) shown++;
    });
    count.textContent = `${shown} of ${items.length} items`;
    const empty = list.querySelector('p.empty');
    if (empty) empty.hidden = shown > 0;
  }

  const visibleCards = () => [...list.querySelectorAll('.shirt')].filter(c => !c.hidden);

  /* ---------- Validation ---------- */

  function findProblems() {
    const problems = [];
    const seen = {};
    items.forEach(s => s.sizes.forEach(z => {
      const k = z.item.trim();
      if (k) seen[k] = (seen[k] || 0) + 1;
    }));
    items.forEach(s => {
      const label = s.description.trim() || '(T-shirt with no description)';
      if (!s.description.trim()) problems.push({ uid: s.uid, field: 'description', msg: 'Description is required' });
      if (!s.sizes.length) problems.push({ uid: s.uid, msg: `${label}: has no sizes` });
      s.sizes.forEach((z, i) => {
        if (!z.item.trim()) problems.push({ uid: s.uid, row: i, field: 'item', msg: `${label}: item # is missing` });
        else if (seen[z.item.trim()] > 1) problems.push({ uid: s.uid, row: i, field: 'item', msg: `${label}: item # ${z.item} is used more than once` });
        if (!z.size.trim()) problems.push({ uid: s.uid, row: i, field: 'size', msg: `${label}: a size is blank` });
        if (z.price == null || z.price < 0) problems.push({ uid: s.uid, row: i, field: 'price', msg: `${label}: a price is missing or invalid` });
      });
    });
    return problems;
  }

  function validate() {
    if (!editing) return [];
    const problems = findProblems();
    list.querySelectorAll('.sizes input.invalid').forEach(i => i.classList.remove('invalid'));
    list.querySelectorAll('.problems').forEach(p => { p.textContent = ''; });
    const perCard = {};
    problems.forEach(p => {
      const card = cardEl(p.uid);
      if (!card) return;
      perCard[p.uid] = (perCard[p.uid] || 0) + 1;
      let input = null;
      if (p.row != null) input = card.querySelector(`tr[data-row="${p.row}"] [data-field="${p.field}"]`);
      else if (p.field) input = card.querySelector(`[data-shirt-field="${p.field}"]`);
      if (input) input.classList.add('invalid');
    });
    Object.keys(perCard).forEach(uid => {
      const el = cardEl(uid).querySelector('.problems');
      if (el) el.textContent = `⚠ ${perCard[uid]} issue${perCard[uid] === 1 ? '' : 's'} to fix (highlighted in red)`;
    });
    return problems;
  }

  function confirmProblems() {
    const problems = findProblems();
    if (!problems.length) return true;
    const lines = [...new Set(problems.map(p => '• ' + p.msg))].slice(0, 10);
    return confirm(`There ${problems.length === 1 ? 'is 1 problem' : 'are ' + problems.length + ' problems'} in the catalog:\n\n${lines.join('\n')}${problems.length > 10 ? '\n…' : ''}\n\nSave anyway?`);
  }

  /* ---------- Editing actions ---------- */

  function nextItemNumber(s) {
    const last = s.sizes.length ? s.sizes[s.sizes.length - 1].item.trim() : '';
    if (!/^\d+$/.test(last)) return '';
    const used = new Set(items.flatMap(x => x.sizes.map(z => z.item.trim())));
    let n = Number(last);
    let candidate;
    do { candidate = String(++n).padStart(last.length, '0'); } while (used.has(candidate));
    return candidate;
  }

  function addRow(s) {
    const prev = s.sizes[s.sizes.length - 1];
    s.sizes.push({ item: nextItemNumber(s), size: '', price: prev ? prev.price : null });
    persist();
    const el = refreshCard(s);
    refreshCounts();
    const input = el.querySelector(`tr[data-row="${s.sizes.length - 1}"] [data-field="size"]`);
    if (input) input.focus();
  }

  function deleteRow(s, i) {
    const z = s.sizes[i];
    const what = [z.item, z.size].filter(Boolean).join(' – ') || 'this blank row';
    if ((z.item || z.size) && !confirm(`Remove size ${what}?`)) return;
    s.sizes.splice(i, 1);
    persist();
    refreshCard(s);
  }

  function addShirt() {
    const s = { uid: newUid(), description: '', image: null, sizes: [{ item: '', size: '', price: null }] };
    items.push(s);
    openSet.add(s.uid);
    if (search.value) search.value = '';
    persist();
    render();
    const el = cardEl(s.uid);
    el.classList.add('new-flash');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector('[data-shirt-field="description"]').focus({ preventScroll: true });
  }

  function deleteShirt(s) {
    if (!confirm(`Delete "${s.description || 'this T-shirt'}" and all of its ${s.sizes.length} size(s)?`)) return;
    items = items.filter(x => x !== s);
    openSet.delete(s.uid);
    persist();
    render();
    toast('T-shirt deleted');
  }

  function refreshCounts() { applyFilter(); }

  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    editToggle.setAttribute('aria-pressed', String(on));
    editToggle.textContent = on ? 'Done editing' : 'Edit mode';
    render();
    updateStatus();
  }

  /* ---------- Events ---------- */

  list.addEventListener('click', e => {
    const head = e.target.closest('.card-head');
    if (head) {
      const card = head.closest('.shirt');
      setOpen(card, !card.classList.contains('open'));
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.shirt');
    const s = findItem(card.dataset.uid);
    switch (btn.dataset.action) {
      case 'add-row': addRow(s); break;
      case 'del-row': deleteRow(s, Number(btn.closest('tr').dataset.row)); break;
      case 'del-shirt': deleteShirt(s); break;
      case 'choose-image': pendingImageUid = s.uid; imagePicker.value = ''; imagePicker.click(); break;
    }
  });

  function handleFieldChange(e) {
    const t = e.target;
    const card = t.closest('.shirt');
    if (!card) return;
    const s = findItem(card.dataset.uid);

    if (t.dataset.shirtField) {
      if (t.dataset.shirtField === 'image') {
        s.image = normalizeImage(t.value);
        delete previewUrls[s.uid];
      } else {
        s.description = t.value;
      }
    } else if (t.dataset.field) {
      const z = s.sizes[Number(t.closest('tr').dataset.row)];
      if (t.dataset.field === 'price') z.price = toNumber(t.value);
      else z[t.dataset.field] = t.value;
    } else {
      return;
    }
    persist();
    refreshHead(s);
    validate();
  }
  list.addEventListener('input', handleFieldChange);
  list.addEventListener('change', e => {
    // Tidy price formatting once the user leaves the field.
    if (e.target.dataset.field === 'price' && e.target.value !== '') {
      const n = toNumber(e.target.value);
      if (n != null) e.target.value = n.toFixed(2);
    }
  });

  imagePicker.addEventListener('change', () => {
    const file = imagePicker.files[0];
    const s = pendingImageUid && findItem(pendingImageUid);
    pendingImageUid = null;
    if (!file || !s) return;
    s.image = ASSETS_DIR + file.name;
    previewUrls[s.uid] = URL.createObjectURL(file);
    persist();
    refreshCard(s);
    toast(`Image set to ${s.image} — make sure ${file.name} is in the assets folder.`);
  });

  search.addEventListener('input', applyFilter);
  document.getElementById('expandAll').addEventListener('click', () => visibleCards().forEach(c => setOpen(c, true)));
  document.getElementById('collapseAll').addEventListener('click', () => visibleCards().forEach(c => setOpen(c, false)));
  editToggle.addEventListener('click', () => setEditing(!editing));
  document.getElementById('addShirt').addEventListener('click', addShirt);
  document.getElementById('saveFile').addEventListener('click', saveToFile);
  document.getElementById('exportJson').addEventListener('click', exportJson);
  const catalogPicker = document.getElementById('catalogPicker');
  document.getElementById('importJson').addEventListener('click', () => catalogPicker.click());
  catalogPicker.addEventListener('change', async () => {
    const file = catalogPicker.files[0];
    catalogPicker.value = '';
    if (file) await importJson(file);
  });
  document.getElementById('discard').addEventListener('click', () => {
    if (!confirm('Discard all browser changes and reload the catalog from ' + DATA_FILE + '?')) return;
    localStorage.removeItem(STORAGE_KEY);
    items = fromPlain(JSON.parse(baseJson));
    render();
    updateStatus();
    toast('Browser changes discarded');
  });

  /* ---------- Toast ---------- */

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4500);
  }

  /* ---------- Save catalog JSON ---------- */

  function catalogJson() {
    return JSON.stringify(catalogData(), null, 2) + '\n';
  }

  function download(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Remembers each catalog's chosen JSON file between visits (Edge/Chrome).
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(STORAGE_KEY, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', mode);
        const r = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(r && r.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  const idbGet = key => idb('readonly', st => st.get(key)).catch(() => null);
  const idbSet = (key, val) => idb('readwrite', st => st.put(val, key)).catch(() => null);

  async function saveToFile() {
    if (!confirmProblems()) return;
    const text = catalogJson();

    if (window.showSaveFilePicker) {
      try {
        let handle = fileHandle || await idbGet('catalogJsonHandle');
        if (handle) {
          const opts = { mode: 'readwrite' };
          if ((await handle.queryPermission(opts)) !== 'granted' && (await handle.requestPermission(opts)) !== 'granted') handle = null;
        }
        if (!handle) {
          toast('Choose ' + DATA_FILE + ' in the catalog folder to overwrite it.');
          handle = await window.showSaveFilePicker({
            suggestedName: DATA_FILE,
            types: [{ description: 'Catalog data', accept: { 'application/json': ['.json'] } }]
          });
        }
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        fileHandle = handle;
        idbSet('catalogJsonHandle', handle);
        baseJson = currentJson();
        persist();
        toast(`Saved to ${handle.name}`);
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.error(e);
        fileHandle = null;
      }
    }
    download(DATA_FILE, text, 'application/json');
    toast('Downloaded ' + DATA_FILE + ' — move it into the catalog folder, replacing the old one.');
  }

  /* ---------- JSON import and export ---------- */

  function exportJson() {
    if (!confirmProblems()) return;
    download(DATA_FILE, catalogJson(), 'application/json');
    toast('Downloaded ' + DATA_FILE + '.');
  }

  async function importJson(file) {
    let imported;
    try {
      imported = decodeCatalog(JSON.parse(await file.text()));
    } catch (error) {
      toast('Could not import JSON: ' + error.message);
      return;
    }
    if (!confirm('Replace the current catalog with this JSON file? Your current browser edits will be replaced.')) return;
    items = fromPlain(imported);
    Object.keys(previewUrls).forEach(uid => {
      URL.revokeObjectURL(previewUrls[uid]);
      delete previewUrls[uid];
    });
    pendingImageUid = null;
    openSet.clear();
    search.value = '';
    persist();
    render();
    toast('JSON imported. Use Save to file to update ' + DATA_FILE + '.');
  }

  // Exposed for testing/debugging from the browser console.
  window.__catalogApp = { getItems: () => toPlain(items) };

  render();
  updateStatus();
})();
