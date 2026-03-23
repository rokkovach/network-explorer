// request-list.js

const RequestList = {
  selectedId: null,
  _contextRequest: null,

  init() {
    document.getElementById('request-list-body').addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr?.dataset.id) return;
      this.selectRequest(parseInt(tr.dataset.id));
    });

    // Right-click context menu on request rows
    document.getElementById('request-list-body').addEventListener('contextmenu', (e) => {
      const tr = e.target.closest('tr');
      if (!tr?.dataset.id) return;
      e.preventDefault();
      const id = parseInt(tr.dataset.id);
      this._contextRequest = (window.__requestMap || {})[id];
      if (!this._contextRequest) return;

      const menu = document.getElementById('context-menu');
      menu.style.display = 'block';

      // Position the menu
      const menuRect = menu.getBoundingClientRect();
      let x = e.clientX;
      let y = e.clientY;
      // Prevent overflow off-screen
      if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 4;
      if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 4;
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';

      // Update the method label
      const ctxMethodLabel = document.getElementById('ctx-method-label');
      if (ctxMethodLabel) ctxMethodLabel.textContent = this._contextRequest.method;
    });
  },

  render() {
    const requests = window.__requests || [];
    const filtered = Filters.apply(requests);
    const tbody = document.getElementById('request-list-body');
    const emptyState = document.getElementById('empty-state');

    document.getElementById('request-count').textContent = requests.length;

    if (requests.length === 0) {
      emptyState.classList.remove('hidden');
      tbody.innerHTML = '';
      return;
    }
    emptyState.classList.add('hidden');

    let html = '';
    for (const r of filtered) {
      const sel = r.id === this.selectedId ? ' selected' : '';
      const sc = RequestDetail._statusClass(r.statusCode);
      html += `<tr class="${sel}" data-id="${r.id}">
        <td class="col-num" style="color:var(--text-muted)">${r.id}</td>
        <td class="col-method"><span class="method-badge method-${r.method}">${r.method}</span></td>
        <td class="col-url" title="${this._esc(r.url)}">${this._shortUrl(r.url)}</td>
        <td class="col-status"><span class="status-code status-${sc}">${r.statusCode || '—'}</span></td>
        <td class="col-type" style="color:var(--text-muted)">${r.type || '—'}</td>
        <td class="col-size" style="color:var(--text-muted)">${RequestDetail._formatSize(r.size)}</td>
        <td class="col-time" style="color:var(--text-muted)">${RequestDetail._formatTime(r.time)}</td>
      </tr>`;
    }
    tbody.innerHTML = html;
  },

  selectRequest(id) {
    this.selectedId = id;
    const request = (window.__requestMap || {})[id];
    if (request) RequestDetail.show(request);
    this.render();
  },

  deselect() {
    this.selectedId = null;
    RequestDetail.hide();
    this.render();
  },

  _shortUrl(url) {
    try {
      const u = new URL(url);
      let p = u.pathname;
      if (u.search) p += u.search.slice(0, 50);
      return u.host + p;
    } catch { return url.length > 80 ? url.slice(0, 80) + '…' : url; }
  },

  _esc(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
};
