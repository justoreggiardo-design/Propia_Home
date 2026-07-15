/* =================================================================
   PROPIA HOME — App logic
   ================================================================= */

const state = {
  filters: {
    search: '',
    category: 'all',
    colors: new Set(),
    sizes: new Set(),
    maxPrice: 80000,
  },
  sort: 'default',
  cart: JSON.parse(localStorage.getItem('propia_cart') || '[]'),
  currentProduct: null,
};

const fmt = n => '$' + n.toLocaleString('es-AR');
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ----- Helpers ----- */
function productMinPrice(p) { return Math.min(...p.sizes.map(s => s.price)); }
function productAllSizes(p) { return [...new Set(p.sizes.map(s => s.size))]; }

function passesFilters(p) {
  const f = state.filters;
  if (f.search && !norm(p.name).includes(norm(f.search))) return false;
  if (f.category !== 'all' && p.cat !== f.category) return false;
  if (f.colors.size && !p.colors.some(c => f.colors.has(c))) return false;
  if (f.sizes.size && !p.sizes.some(s => f.sizes.has(s.size))) return false;
  if (productMinPrice(p) > f.maxPrice) return false;
  return true;
}

function getFiltered() {
  let items = PRODUCTS.filter(passesFilters);
  switch (state.sort) {
    case 'price-asc':  items.sort((a,b) => productMinPrice(a) - productMinPrice(b)); break;
    case 'price-desc': items.sort((a,b) => productMinPrice(b) - productMinPrice(a)); break;
    case 'name-asc':   items.sort((a,b) => a.name.localeCompare(b.name, 'es')); break;
  }
  return items;
}

/* =================================================================
   RENDERING
   ================================================================= */

function renderCategories() {
  const wrap = document.getElementById('categoryList');
  const counts = {};
  PRODUCTS.forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  wrap.innerHTML = CATEGORIES.map(([id, label]) => {
    const n = id === 'all' ? PRODUCTS.length : (counts[id] || 0);
    const active = state.filters.category === id ? 'active' : '';
    return `<button class="cat-btn ${active}" onclick="UI.setCategory('${id}')">
      <span>${label}</span><span class="count">${n}</span>
    </button>`;
  }).join('');
}

function renderColorFilters() {
  const allColors = new Set();
  PRODUCTS.forEach(p => p.colors.forEach(c => allColors.add(c)));
  const colorOrder = ['natural','beige','tostado','terracota','rosa','chocolate','negro','gris','verde','yute_color'];
  const sorted = colorOrder.filter(c => allColors.has(c));
  const lights = new Set(['natural','beige','rosa']);
  document.getElementById('colorFilters').innerHTML = sorted.map(c => {
    const active = state.filters.colors.has(c) ? 'active' : '';
    const light = lights.has(c) ? '1' : '0';
    return `<div class="color-swatch ${active}" data-light="${light}"
              style="background:${COLOR_HEX[c]}"
              title="${COLOR_NAMES[c]}"
              onclick="UI.toggleColor('${c}')"></div>`;
  }).join('');
}

function renderSizeFilters() {
  const allSizes = new Set();
  PRODUCTS.forEach(p => p.sizes.forEach(s => allSizes.add(s.size)));
  const sortKey = s => {
    const [w,h] = s.split('x').map(Number);
    return w * 1000 + h;
  };
  const sorted = [...allSizes].sort((a,b) => sortKey(a) - sortKey(b));
  document.getElementById('sizeFilters').innerHTML = sorted.map(s => {
    const active = state.filters.sizes.has(s) ? 'active' : '';
    return `<button class="size-pill ${active}" onclick="UI.toggleSize('${s}')">${s}</button>`;
  }).join('');
}

function renderActiveChips() {
  const f = state.filters;
  const wrap = document.getElementById('activeChips');
  const chips = [];
  if (f.search) chips.push({ k: 'search', label: `"${f.search}"`, fn: `UI.clearSearch()` });
  if (f.category !== 'all') {
    const cat = CATEGORIES.find(c => c[0] === f.category);
    if (cat) chips.push({ k: 'cat', label: cat[1], fn: `UI.setCategory('all')` });
  }
  f.colors.forEach(c => chips.push({ k: 'color', label: COLOR_NAMES[c], fn: `UI.toggleColor('${c}')` }));
  f.sizes.forEach(s => chips.push({ k: 'size', label: s, fn: `UI.toggleSize('${s}')` }));
  if (f.maxPrice < 80000) chips.push({ k: 'price', label: `Hasta ${fmt(f.maxPrice)}`, fn: `UI.resetPrice()` });
  wrap.innerHTML = chips.map(c =>
    `<span class="chip">${c.label}<button onclick="${c.fn}" aria-label="Quitar">×</button></span>`
  ).join('');
}

function renderProducts() {
  const items = getFiltered();
  const grid = document.getElementById('productGrid');
  document.getElementById('resultCount').textContent =
    `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">
      <h3>No encontramos almohadones con esos filtros</h3>
      <p>Probá ajustando o limpiando los filtros</p>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(p => {
    const main = p.imgs[0];
    const alt = p.imgs[1] || p.imgs[0];
    const minP = productMinPrice(p);
    const sizes = productAllSizes(p);
    const sizeLabel = sizes.length === 1 ? sizes[0] : `${sizes.length} medidas`;
    const colorDots = p.colors.slice(0, 4).map(c =>
      `<span class="color-dot" style="background:${COLOR_HEX[c]}" title="${COLOR_NAMES[c]}"></span>`
    ).join('');
    const moreColors = p.colors.length > 4 ? `<span style="font-size:10px;color:var(--ink-muted);margin-left:2px">+${p.colors.length-4}</span>` : '';
    const imgCount = p.imgs.length > 1
      ? `<div class="card-img-count">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          ${p.imgs.length}
        </div>` : '';

    const sizeOptions = p.sizes.map(s =>
      `<option value="${s.code}">${s.size} — ${fmt(s.price)}</option>`
    ).join('');

    return `<article class="product-card" data-id="${p.id}">
      <div class="card-img-wrap" onclick="UI.openQuickView('${p.id}')">
        <img class="main" src="${main}" alt="${p.name}" loading="lazy">
        <img class="alt"  src="${alt}"  alt="" loading="lazy">
        ${imgCount}
      </div>
      <div class="card-body">
        <div class="card-row1">
          <div class="card-name">${p.name}</div>
          <div class="card-price">${fmt(minP)}<small>${p.sizes.length > 1 ? ' desde' : ''}</small></div>
        </div>
        <div class="card-desc">${p.desc}</div>
        <div class="card-meta-row">
          <div class="card-colors">${colorDots}${moreColors}</div>
          <div class="card-sizes">${sizeLabel}</div>
        </div>
        <div class="card-actions">
          <select class="size-select" id="select-${p.id}" onclick="event.stopPropagation()">
            ${sizeOptions}
          </select>
          <div class="qty-stepper" onclick="event.stopPropagation()">
            <button class="qty-step" onclick="UI.stepCardQty('${p.id}',-1)" aria-label="Menos">−</button>
            <input type="number" class="qty-input" id="qty-${p.id}" value="1" min="1" max="99" onclick="event.stopPropagation()" oninput="UI.clampQty(this)">
            <button class="qty-step" onclick="UI.stepCardQty('${p.id}',1)" aria-label="Más">+</button>
          </div>
          <button class="add-btn" onclick="event.stopPropagation();UI.addFromCard('${p.id}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Sumar
          </button>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderAll() {
  renderCategories();
  renderColorFilters();
  renderSizeFilters();
  renderActiveChips();
  renderProducts();
  renderCart();
}

/* =================================================================
   QUICK VIEW
   ================================================================= */

function renderQuickView(p) {
  state.currentProduct = p;
  state.qvIdx = 0;
  const colorChips = p.colors.map(c =>
    `<span class="qv-color-chip"><span class="dot" style="background:${COLOR_HEX[c]}"></span>${COLOR_NAMES[c]}</span>`
  ).join('');
  const sizeRows = p.sizes.map((s, i) =>
    `<div class="qv-size-row ${i===0?'selected':''}" data-code="${s.code}" onclick="UI.selectQVSize(this)">
      <span class="code">${s.code}</span>
      <span class="size">${s.size} cm</span>
      <span class="price">${fmt(s.price)}</span>
    </div>`
  ).join('');
  const thumbs = p.imgs.map((src, i) =>
    `<div class="qv-thumb ${i===0?'active':''}" onclick="UI.setQVImg(${i})">
      <img src="${src}" alt="" loading="lazy">
    </div>`
  ).join('');
  const catLabel = (CATEGORIES.find(c => c[0] === p.cat) || [,p.cat])[1];

  document.getElementById('qvModal').innerHTML = `
    <div class="qv-gallery">
      <button class="qv-close" onclick="UI.closeQuickView()" aria-label="Cerrar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div class="qv-main-img">
        <img id="qvMainImg" src="${p.imgs[0]}" alt="${p.name}">
        ${p.imgs.length > 1 ? `
          <button class="qv-nav qv-prev" onclick="UI.navQV(-1)" aria-label="Anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m15 6-6 6 6 6"/></svg>
          </button>
          <button class="qv-nav qv-next" onclick="UI.navQV(1)" aria-label="Siguiente">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m9 6 6 6-6 6"/></svg>
          </button>
          <div class="qv-img-counter"><span id="qvImgIdx">1</span> / ${p.imgs.length}</div>
        ` : ''}
      </div>
      ${p.imgs.length > 1 ? `<div class="qv-thumbs">${thumbs}</div>` : ''}
    </div>
    <div class="qv-info">
      <div class="qv-cat">${catLabel}</div>
      <h2 class="qv-name">${p.name}</h2>
      <p class="qv-desc">${p.desc}</p>

      <div class="qv-section-h">Colores disponibles</div>
      <div class="qv-colors">${colorChips}</div>

      <div class="qv-section-h">Medidas y precio</div>
      <div class="qv-sizes-table">${sizeRows}</div>

      <div class="qv-actions">
        <div class="qty-stepper qv-qty">
          <button class="qty-step" onclick="UI.stepQVQty(-1)" aria-label="Menos">−</button>
          <input type="number" class="qty-input" id="qvQty" value="1" min="1" max="99" oninput="UI.clampQty(this)">
          <button class="qty-step" onclick="UI.stepQVQty(1)" aria-label="Más">+</button>
        </div>
        <button class="primary-btn" onclick="UI.addFromQV()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Agregar a la canasta
        </button>
      </div>
    </div>
  `;
  document.getElementById('qvOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* =================================================================
   CART
   ================================================================= */

function saveCart() {
  localStorage.setItem('propia_cart', JSON.stringify(state.cart));
}

function addToCart(productId, sizeCode, qty = 1) {
  const p = PRODUCTS.find(x => x.id === productId);
  const s = p.sizes.find(x => x.code === sizeCode);
  if (!p || !s) return;
  const key = `${productId}-${sizeCode}`;
  const existing = state.cart.find(i => i.key === key);
  if (existing) existing.qty += qty;
  else state.cart.push({
    key, productId, sizeCode,
    name: p.name, size: s.size, price: s.price,
    img: p.imgs[0], qty,
  });
  saveCart();
  renderCart();
  flashCart();
}

function flashCart() {
  const btn = document.querySelector('.cart-trigger');
  btn.style.transform = 'scale(1.05)';
  setTimeout(() => { btn.style.transform = ''; }, 200);
}

function renderCart() {
  const body = document.getElementById('cartBody');
  const count = state.cart.reduce((s,i) => s + i.qty, 0);
  const total = state.cart.reduce((s,i) => s + i.qty * i.price, 0);
  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotal').textContent = fmt(total);
  document.getElementById('cartItemCount').textContent =
    `${count} ${count === 1 ? 'artículo' : 'artículos'}`;

  if (!state.cart.length) {
    body.innerHTML = `<div class="cart-empty">
      <p>Tu canasta está vacía</p>
      <small>Sumá almohadones para armar tu presupuesto</small>
    </div>`;
    return;
  }

  body.innerHTML = state.cart.map(i => `
    <div class="cart-item">
      <div class="cart-item-thumb"><img src="${i.img}" alt=""></div>
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
        <div class="cart-item-meta">${i.size} cm · cód. ${i.sizeCode}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="UI.changeQty('${i.key}',-1)">−</button>
          <span class="qty-val">${i.qty}</span>
          <button class="qty-btn" onclick="UI.changeQty('${i.key}',1)">+</button>
        </div>
      </div>
      <div>
        <div class="cart-item-price">${fmt(i.qty * i.price)}</div>
        <button class="cart-item-remove" onclick="UI.removeFromCart('${i.key}')">Quitar</button>
      </div>
    </div>
  `).join('');
}

/* =================================================================
   PRESUPUESTO
   ================================================================= */

function showPresupuesto() {
  if (!state.cart.length) { alert('Tu canasta está vacía. Sumá almohadones primero.'); return; }
  const total = state.cart.reduce((s,i) => s + i.qty * i.price, 0);
  const totalQty = state.cart.reduce((s,i) => s + i.qty, 0);

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });
  document.getElementById('modalDate').textContent = `Presupuesto al ${dateStr}`;

  document.getElementById('modalItems').innerHTML = state.cart.map(i => `
    <div class="modal-item">
      <div>
        <div class="modal-item-name">${i.name}</div>
        <div class="modal-item-detail">${i.size} cm · cód. ${i.sizeCode} · ${i.qty} ${i.qty===1?'unidad':'unidades'} × ${fmt(i.price)}</div>
      </div>
      <div class="modal-item-price">${fmt(i.qty * i.price)}</div>
    </div>
  `).join('') + `
    <div class="modal-subtotal">
      <span>${totalQty} ${totalQty===1?'artículo':'artículos'}</span>
      <span>${fmt(total)}</span>
    </div>
    <div class="modal-total">
      <span>Total</span>
      <span>${fmt(total)}</span>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function buildWhatsappMessage() {
  let msg = '*Hola Propia Home!* Quiero consultar por este presupuesto:%0A%0A';
  state.cart.forEach(i => {
    msg += `• ${i.name} (${i.size} cm) — ${i.qty} u. × ${fmt(i.price)} = *${fmt(i.qty * i.price)}*%0A`;
  });
  const total = state.cart.reduce((s,i) => s + i.qty * i.price, 0);
  msg += `%0A*Total: ${fmt(total)}*`;
  return msg;
}

/* =================================================================
   UI ACTIONS (called from inline handlers)
   ================================================================= */

window.UI = {
  setCategory(c)  { state.filters.category = c; renderAll(); },
  toggleColor(c)  {
    const s = state.filters.colors;
    if (s.has(c)) s.delete(c); else s.add(c);
    renderAll();
  },
  toggleSize(sz)  {
    const s = state.filters.sizes;
    if (s.has(sz)) s.delete(sz); else s.add(sz);
    renderAll();
  },
  applyFilters() {
    state.filters.search = document.getElementById('searchInput').value;
    state.sort = document.getElementById('sortSelect').value;
    renderActiveChips();
    renderProducts();
  },
  updatePrice() {
    state.filters.maxPrice = +document.getElementById('priceSlider').value;
    document.getElementById('priceLabel').textContent = fmt(state.filters.maxPrice);
    renderActiveChips();
    renderProducts();
  },
  resetPrice() {
    state.filters.maxPrice = 80000;
    document.getElementById('priceSlider').value = 80000;
    document.getElementById('priceLabel').textContent = '$80.000';
    renderActiveChips();
    renderProducts();
  },
  clearSearch() {
    state.filters.search = '';
    document.getElementById('searchInput').value = '';
    renderActiveChips();
    renderProducts();
  },
  clearFilters() {
    state.filters = { search:'', category:'all', colors:new Set(), sizes:new Set(), maxPrice:80000 };
    state.sort = 'default';
    document.getElementById('searchInput').value = '';
    document.getElementById('sortSelect').value = 'default';
    document.getElementById('priceSlider').value = 80000;
    document.getElementById('priceLabel').textContent = '$80.000';
    renderAll();
  },

  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarBackdrop').classList.add('open');
  },
  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('open');
  },

  openQuickView(id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (p) renderQuickView(p);
  },
  closeQuickView() {
    document.getElementById('qvOverlay').classList.remove('open');
    document.body.style.overflow = '';
  },
  setQVImg(idx) {
    const imgs = state.currentProduct.imgs;
    state.qvIdx = idx;
    document.getElementById('qvMainImg').src = imgs[idx];
    const c = document.getElementById('qvImgIdx');
    if (c) c.textContent = idx + 1;
    document.querySelectorAll('.qv-thumb').forEach((t, i) =>
      t.classList.toggle('active', i === idx));
  },
  navQV(delta) {
    const imgs = state.currentProduct.imgs;
    const cur = state.qvIdx ?? 0;
    const next = (cur + delta + imgs.length) % imgs.length;
    this.setQVImg(next);
  },
  selectQVSize(row) {
    document.querySelectorAll('.qv-size-row').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  },
  addFromQV() {
    const code = document.querySelector('.qv-size-row.selected')?.dataset.code;
    if (!code) return;
    const qty = Math.max(1, parseInt(document.getElementById('qvQty').value) || 1);
    addToCart(state.currentProduct.id, code, qty);
    this.closeQuickView();
    this.toggleCart(true);
  },
  stepQVQty(delta) {
    const input = document.getElementById('qvQty');
    input.value = Math.max(1, Math.min(99, (parseInt(input.value) || 1) + delta));
  },
  addFromCard(id) {
    const code = document.getElementById(`select-${id}`).value;
    const qtyInput = document.getElementById(`qty-${id}`);
    const qty = Math.max(1, parseInt(qtyInput.value) || 1);
    addToCart(id, code, qty);
    qtyInput.value = 1;
    const btn = event.currentTarget;
    btn.classList.add('added');
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 5 5L20 7"/></svg> +${qty}`;
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Sumar';
    }, 1400);
  },
  stepCardQty(id, delta) {
    const input = document.getElementById(`qty-${id}`);
    input.value = Math.max(1, Math.min(99, (parseInt(input.value) || 1) + delta));
  },
  clampQty(input) {
    const v = parseInt(input.value) || 1;
    input.value = Math.max(1, Math.min(99, v));
  },

  toggleCart(forceOpen) {
    const drawer = document.getElementById('cartDrawer');
    const ov = document.getElementById('cartOverlay');
    const isOpen = drawer.classList.contains('open');
    const open = forceOpen === true ? true : !isOpen;
    drawer.classList.toggle('open', open);
    ov.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  },
  changeQty(key, delta) {
    const item = state.cart.find(i => i.key === key);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    saveCart();
    renderCart();
  },
  removeFromCart(key) {
    state.cart = state.cart.filter(i => i.key !== key);
    saveCart();
    renderCart();
  },

  showPresupuesto,
  closeModal() { document.getElementById('modalOverlay').classList.remove('open'); },
  sendWhatsapp() {
    if (!state.cart.length) { alert('Tu canasta está vacía.'); return; }
    window.open(`https://wa.me/?text=${buildWhatsappMessage()}`, '_blank');
  },
};

/* ----- Hamburger ----- */
document.getElementById('hamburger').addEventListener('click', () => UI.openSidebar());

/* ----- Esc closes overlays ----- */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('modalOverlay').classList.contains('open')) return UI.closeModal();
  if (document.getElementById('qvOverlay').classList.contains('open')) return UI.closeQuickView();
  if (document.getElementById('cartDrawer').classList.contains('open')) return UI.toggleCart();
  UI.closeSidebar();
});

/* ----- Init ----- */
fetch('products.json?v=' + Date.now(), { cache: 'no-store' })
  .then(r => r.json())
  .then(data => {
    window.PRODUCTS    = data.products;
    window.COLOR_HEX   = data.colorHex;
    window.COLOR_NAMES = data.colorNames;
    window.CATEGORIES  = data.categories;
    renderAll();
  })
  .catch(() => {
    document.getElementById('productGrid').innerHTML =
      '<div class="empty-state"><h3>No se pudo cargar el catálogo.</h3><p>Revisá tu conexión e intentá de nuevo.</p></div>';
  });
