// request-list.js

const RequestList = {
  selectedId: null,

  init() {
    document.getElementById('request-list-body').addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr?.dataset.id) return;
      this.selectRequest(parseInt(tr.dataset.id));
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
