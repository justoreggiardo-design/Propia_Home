/* =================================================================
   PROPIA HOME — Panel de Administración
   Arquitectura: GitHub API (fuente de verdad) + Cloudinary (imágenes)
   Auth: GitHub Personal Access Token almacenado en sessionStorage
   ================================================================= */

const SESSION_KEY = 'propia_admin_session';

const COLOR_HEX = {
  natural: '#F5F0E8', tostado: '#D4B896', chocolate: '#6B4C3B',
  negro: '#1A1A1A',   verde: '#7A8C6E',   beige: '#C4A882',
  terracota: '#A0522D', gris: '#9E9E9E',  rosa: '#E1B6A9',
  yute_color: '#8B7355'
};
const COLOR_NAMES = {
  natural: 'Natural', tostado: 'Tostado', chocolate: 'Chocolate',
  negro: 'Negro',     verde: 'Verde',     beige: 'Beige',
  terracota: 'Terracota', gris: 'Gris',   rosa: 'Rosa',
  yute_color: 'Yute'
};

/* ---- State ---- */
let session = null;   // { repo, token, cloudName, cloudPreset }
let products = [];
let currentSHA = '';  // SHA del archivo en GitHub (necesario para el PUT)
let editingIdx = -1;  // -1 = nuevo producto
let confirmCallback = null;

/* =================================================================
   AUTH
   ================================================================= */
const Admin = {

  login() {
    const repo   = document.getElementById('loginRepo').value.trim();
    const token  = document.getElementById('loginToken').value.trim();
    const cloud  = document.getElementById('loginCloud').value.trim();
    const preset = document.getElementById('loginPreset').value.trim();
    const err    = document.getElementById('loginError');

    if (!repo || !token || !cloud || !preset) {
      err.textContent = 'Completá todos los campos.';
      return;
    }
    err.textContent = 'Verificando acceso…';

    session = { repo, token, cloudName: cloud, cloudPreset: preset };
    githubGet()
      .then(({ data, sha }) => {
        currentSHA = sha;
        products = data.products;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('adminShell').classList.remove('hidden');
        renderProductList();
      })
      .catch(e => {
        err.textContent = 'Error: ' + e.message + ' — Revisá el repo y el token.';
        session = null;
      });
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    session = null;
    products = [];
    document.getElementById('adminShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginError').textContent = '';
  },

  /* =================================================================
     GITHUB API
     ================================================================= */

  /* Guardado: encode → PUT en GitHub */
  async commitToGitHub() {
    setStatus('Guardando en GitHub…');
    try {
      const current = await githubGet();
      currentSHA = current.sha;

      const payload = {
        products,
        colorHex:   current.data.colorHex,
        colorNames: current.data.colorNames,
        categories: current.data.categories
      };
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
      const res = await fetch(`https://api.github.com/repos/${session.repo}/contents/products.json`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'admin: actualizar catálogo',
          content,
          sha: currentSHA
        })
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || res.statusText);
      }
      const result = await res.json();
      currentSHA = result.content.sha;
      setStatus('✓ Guardado · Vercel redeploy en ~30s');
      setTimeout(() => setStatus(''), 5000);
    } catch (e) {
      setStatus('Error al guardar: ' + e.message);
    }
  },

  /* =================================================================
     PRODUCT LIST
     ================================================================= */

  newProduct() {
    editingIdx = -1;
    openEditor({
      id: '', name: '', desc: '', cat: 'tusor', colors: [], sizes: [], imgs: []
    });
  },

  editProduct(idx) {
    editingIdx = idx;
    openEditor(JSON.parse(JSON.stringify(products[idx])));
  },

  async deleteProduct() {
    if (editingIdx === -1) return;
    const name = products[editingIdx].name;
    this.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`, async () => {
      products.splice(editingIdx, 1);
      closeEditor();
      renderProductList();
      await Admin.commitToGitHub();
    });
  },

  async saveProduct() {
    const p = readForm();
    if (!p) return;

    if (editingIdx === -1) {
      products.push(p);
    } else {
      products[editingIdx] = p;
    }

    closeEditor();
    renderProductList();
    await Admin.commitToGitHub();
  },

  /* =================================================================
     EDITOR HELPERS
     ================================================================= */

  autoId() {
    if (editingIdx !== -1) return; // no sobreescribir ID en edición
    const name = document.getElementById('fName').value;
    const id = name
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    document.getElementById('fId').value = id;
  },

  addSizeRow(size = '', price = '', code = '') {
    const list = document.getElementById('fSizes');
    const row = document.createElement('div');
    row.className = 'size-row';
    row.innerHTML = `
      <input class="field-input size-input" type="text"   placeholder="50x50" value="${size}">
      <input class="field-input price-input" type="number" placeholder="28500" value="${price}" min="0">
      <input class="field-input code-input"  type="text"   placeholder="1234"  value="${code}">
      <button class="remove-row-btn" onclick="this.closest('.size-row').remove()" title="Eliminar fila">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>`;
    list.appendChild(row);
  },

  removeImg(btn) {
    btn.closest('.img-thumb').remove();
  },

  moveImg(btn, dir) {
    const thumb = btn.closest('.img-thumb');
    const grid = thumb.parentNode;
    if (dir === -1 && thumb.previousElementSibling) {
      grid.insertBefore(thumb, thumb.previousElementSibling);
    } else if (dir === 1 && thumb.nextElementSibling) {
      grid.insertBefore(thumb.nextElementSibling, thumb);
    }
  },

  async uploadImages(files) {
    if (!files.length) return;
    const label = document.getElementById('uploadLabel');
    label.textContent = `Subiendo ${files.length} imagen(es)…`;

    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', session.cloudPreset);

      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${session.cloudName}/image/upload`, {
          method: 'POST', body: fd
        });
        if (!res.ok) throw new Error('Error Cloudinary');
        const data = await res.json();
        addImgThumb(data.secure_url);
      } catch (e) {
        alert('Error subiendo ' + file.name + ': ' + e.message);
      }
    }

    label.textContent = 'Subir más imágenes a Cloudinary';
    document.getElementById('imgUpload').value = '';
  },

  /* =================================================================
     CONFIRM DIALOG
     ================================================================= */

  confirm(msg, onYes) {
    confirmCallback = onYes;
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmOverlay').classList.remove('hidden');
  },
  confirmYes() {
    document.getElementById('confirmOverlay').classList.add('hidden');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  },
  confirmNo() {
    document.getElementById('confirmOverlay').classList.add('hidden');
    confirmCallback = null;
  },

  closeEditor,
};

/* =================================================================
   INTERNAL FUNCTIONS
   ================================================================= */

async function githubGet() {
  const res = await fetch(`https://api.github.com/repos/${session.repo}/contents/products.json`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || res.statusText);
  }
  const file = await res.json();
  const decoded = JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g, '')))));
  return { data: decoded, sha: file.sha };
}

function setStatus(msg) {
  document.getElementById('saveStatus').textContent = msg;
}

function renderProductList() {
  const count = products.length;
  document.getElementById('productCount').textContent = `(${count})`;

  document.getElementById('productList').innerHTML = products.map((p, i) => {
    const img = p.imgs[0] || '';
    const minP = p.sizes.length ? Math.min(...p.sizes.map(s => s.price)) : 0;
    const colorDots = p.colors.slice(0, 6).map(c =>
      `<span class="mini-dot" style="background:${COLOR_HEX[c]}" title="${COLOR_NAMES[c]}"></span>`
    ).join('');
    return `
      <div class="pl-row" onclick="Admin.editProduct(${i})">
        <div class="pl-thumb">
          ${img ? `<img src="${img}" alt="" loading="lazy">` : '<div class="pl-no-img">?</div>'}
        </div>
        <div class="pl-info">
          <div class="pl-name">${p.name}</div>
          <div class="pl-desc">${p.desc}</div>
          <div class="pl-meta">
            <span class="pl-cat">${p.cat}</span>
            <span class="pl-colors">${colorDots}</span>
            <span class="pl-price">${minP ? '$' + minP.toLocaleString('es-AR') + (p.sizes.length > 1 ? ' desde' : '') : '—'}</span>
          </div>
        </div>
        <button class="edit-arrow" title="Editar" tabindex="-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m9 6 6 6-6 6"/></svg>
        </button>
      </div>`;
  }).join('');
}

function openEditor(p) {
  document.getElementById('editorTitle').textContent =
    editingIdx === -1 ? 'Nuevo almohadón' : `Editar · ${p.name}`;
  document.getElementById('deleteBtn').classList.toggle('hidden', editingIdx === -1);

  // Basic fields
  document.getElementById('fId').value   = p.id;
  document.getElementById('fName').value = p.name;
  document.getElementById('fDesc').value = p.desc;
  document.getElementById('fCat').value  = p.cat;

  // Colors checkboxes
  const colorGrid = document.getElementById('fColors');
  colorGrid.innerHTML = Object.keys(COLOR_HEX).map(c => {
    const checked = p.colors.includes(c) ? 'checked' : '';
    const light = ['natural','beige','rosa'].includes(c) ? 'border:1px solid #ccc;' : '';
    return `
      <label class="color-check-item">
        <input type="checkbox" value="${c}" ${checked}>
        <span class="color-swatch-sm" style="background:${COLOR_HEX[c]};${light}" title="${COLOR_NAMES[c]}"></span>
        <span class="color-check-label">${COLOR_NAMES[c]}</span>
      </label>`;
  }).join('');

  // Sizes
  const sizesList = document.getElementById('fSizes');
  sizesList.innerHTML = `
    <div class="sizes-header">
      <span>Medida</span><span>Precio ($)</span><span>Código</span><span></span>
    </div>`;
  p.sizes.forEach(s => Admin.addSizeRow(s.size, s.price, s.code));

  // Images
  const imgsGrid = document.getElementById('fImgs');
  imgsGrid.innerHTML = '';
  p.imgs.forEach(src => addImgThumb(src));

  document.getElementById('editorOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function addImgThumb(src) {
  const grid = document.getElementById('fImgs');
  const thumb = document.createElement('div');
  thumb.className = 'img-thumb';
  thumb.innerHTML = `
    <img src="${src}" alt="" loading="lazy">
    <div class="img-thumb-actions">
      <button onclick="Admin.moveImg(this,-1)" title="Mover izquierda">←</button>
      <button onclick="Admin.moveImg(this,1)"  title="Mover derecha">→</button>
      <button onclick="Admin.removeImg(this)"  title="Eliminar" class="remove-img">✕</button>
    </div>`;
  grid.appendChild(thumb);
}

function closeEditor() {
  document.getElementById('editorOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function readForm() {
  const id   = document.getElementById('fId').value.trim();
  const name = document.getElementById('fName').value.trim();
  const desc = document.getElementById('fDesc').value.trim();
  const cat  = document.getElementById('fCat').value;

  if (!id || !name) {
    alert('El ID y el Nombre son obligatorios.');
    return null;
  }

  // Check duplicate ID (allow same ID when editing)
  const dupIdx = products.findIndex(p => p.id === id);
  if (dupIdx !== -1 && dupIdx !== editingIdx) {
    alert(`Ya existe un almohadón con el ID "${id}".`);
    return null;
  }

  const colors = [...document.querySelectorAll('#fColors input:checked')].map(i => i.value);

  const sizes = [...document.querySelectorAll('#fSizes .size-row')].map(row => ({
    size:  row.querySelector('.size-input').value.trim(),
    price: Number(row.querySelector('.price-input').value) || 0,
    code:  row.querySelector('.code-input').value.trim()
  })).filter(s => s.size);

  const imgs = [...document.querySelectorAll('#fImgs .img-thumb img')].map(i => i.src);

  return { id, name, desc, cat, colors, sizes, imgs };
}

/* =================================================================
   BOOT
   ================================================================= */
(function boot() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      session = JSON.parse(saved);
      document.getElementById('loginRepo').value  = session.repo;
      document.getElementById('loginCloud').value = session.cloudName;
      document.getElementById('loginPreset').value = session.cloudPreset;
    } catch (_) { session = null; }
  }

  if (session) {
    githubGet()
      .then(({ data, sha }) => {
        currentSHA = sha;
        products = data.products;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('adminShell').classList.remove('hidden');
        renderProductList();
      })
      .catch(() => {
        session = null;
        sessionStorage.removeItem(SESSION_KEY);
      });
  }
})();
