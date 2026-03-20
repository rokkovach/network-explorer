// request-detail.js — Detail panel with tabs

const RequestDetail = {
  currentRequest: null,
  currentTab: 'general',

  init() {
    document.querySelectorAll('#detail-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    document.getElementById('btn-copy-curl').addEventListener('click', () => {
      if (!this.currentRequest) return;
      Storage.copyToClipboard(Storage.generateCurl(this.currentRequest));
      showToast('cURL copied to clipboard');
    });
    document.getElementById('btn-copy-raw').addEventListener('click', () => {
      if (!this.currentRequest) return;
      const text = this.currentRequest.responseBody || this.currentRequest.requestBody || '';
      if (!text) return;
      Storage.copyToClipboard(text);
      showToast('Copied to clipboard');
    });
  },

  show(request) {
    this.currentRequest = request;
    document.getElementById('detail-panel').classList.remove('hidden');
    document.querySelectorAll('#detail-tabs .tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`#detail-tabs .tab[data-tab="${this.currentTab}"]`);
    if (activeTab) activeTab.classList.add('active');
    this.renderContent();
  },

  hide() {
    document.getElementById('detail-panel').classList.add('hidden');
    this.currentRequest = null;
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('#detail-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#detail-tabs .tab[data-tab="${tabId}"]`).classList.add('active');
    this.renderContent();
  },

  renderContent() {
    const el = document.getElementById('detail-content');
    if (!this.currentRequest) { el.innerHTML = '<div class="empty-tab">Select a request</div>'; return; }
    const r = this.currentRequest;
    switch (this.currentTab) {
      case 'general': this._renderGeneral(el, r); break;
      case 'req-headers': this._renderHeaders(el, r.requestHeaders, 'No request headers'); break;
      case 'res-headers': this._renderHeaders(el, r.responseHeaders, 'No response headers'); break;
      case 'req-body': this._renderBody(el, r.requestBody, 'No request body'); break;
      case 'response': this._renderResponse(el, r); break;
      case 'timing': this._renderTiming(el, r); break;
    }
  },

  _renderGeneral(el, r) {
    let html = '<table class="detail-table">';
    html += this._row('Request URL', r.url);
    html += this._row('Method', `<span class="method-badge method-${r.method}">${r.method}</span>`);
    html += this._row('Status', `<span class="status-code status-${this._statusClass(r.statusCode)}">${r.statusCode} ${r.statusText || ''}</span>`);
    html += this._row('Type', r.type || '—');
    html += this._row('MIME', r.mimeType || '—');
    html += this._row('Size', this._formatSize(r.size));
    html += this._row('Time', this._formatTime(r.time));
    html += this._row('Started', r.startedDateTime || '—');
    html += '</table>';
    el.innerHTML = html;
  },

  _renderHeaders(el, headers, emptyMsg) {
    if (!headers || headers.length === 0) { el.innerHTML = `<div class="empty-tab">${emptyMsg}</div>`; return; }
    let html = '<table class="detail-table">';
    for (const h of headers) html += this._row(h.name, this._escapeHtml(h.value));
    html += '</table>';
    el.innerHTML = html;
  },

  _renderBody(el, body, emptyMsg) {
    if (!body || body === '[FormData]' || body === '[Blob]' || body === '[ArrayBuffer]') {
      el.innerHTML = `<div class="empty-tab">${body === '[FormData]' ? 'FormData (not serializable)' : emptyMsg}</div>`;
      return;
    }
    JsonViewer.render(body, el);
  },

  _renderResponse(el, r) {
    if (!r.responseBody) { el.innerHTML = '<div class="empty-tab">No response body</div>'; return; }
    if (r.mimeType && r.mimeType.includes('json')) {
      JsonViewer.render(r.responseBody, el);
    } else {
      try { JSON.parse(r.responseBody); JsonViewer.render(r.responseBody, el); }
      catch { el.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-all;">${this._escapeHtml(r.responseBody.slice(0, 50000))}</pre>`; }
    }
  },

  _renderTiming(el, r) {
    if (!r.time) { el.innerHTML = '<div class="empty-tab">No timing data</div>'; return; }
    el.innerHTML = `<div style="padding:12px;">
      <div style="color:var(--text-secondary);margin-bottom:4px;">Total Duration</div>
      <div style="font-size:22px;font-weight:700;color:var(--text-primary);">${r.time.toFixed(1)} ms</div>
      <div style="color:var(--text-muted);font-size:11px;margin-top:4px;">Client-side measurement (fetch start → response end)</div>
    </div>`;
  },

  _row(key, value) { return `<tr><td class="key">${key}</td><td class="value">${value}</td></tr>`; },
  _escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
  _statusClass(c) { if (!c) return ''; if (c < 300) return 'ok'; if (c < 400) return 'redirect'; return 'client-err'; },
  _formatSize(b) { if (!b || b <= 0) return '—'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(2) + ' MB'; },
  _formatTime(ms) { if (!ms || ms <= 0) return '—'; if (ms < 1000) return ms.toFixed(1) + ' ms'; return (ms / 1000).toFixed(2) + ' s'; },
};
