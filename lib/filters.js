// filters.js

const Filters = {
  getActive() {
    return {
      method: document.getElementById('filter-method').value,
      status: document.getElementById('filter-status').value,
      type: document.getElementById('filter-type').value,
      search: document.getElementById('search-input').value.toLowerCase().trim(),
    };
  },

  matches(req, f) {
    if (f.method !== 'all' && req.method !== f.method) return false;
    if (f.status !== 'all') {
      const c = req.statusCode || 0;
      const r = f.status;
      if (r === '2xx' && (c < 200 || c > 299)) return false;
      if (r === '3xx' && (c < 300 || c > 399)) return false;
      if (r === '4xx' && (c < 400 || c > 499)) return false;
      if (r === '5xx' && (c < 500 || c > 599)) return false;
    }
    if (f.type !== 'all' && req.type !== f.type) return false;
    if (f.search && !req.url.toLowerCase().includes(f.search)) return false;
    return true;
  },

  apply(requests) {
    const f = this.getActive();
    if (f.method === 'all' && f.status === 'all' && f.type === 'all' && !f.search) return requests;
    return requests.filter(r => this.matches(r, f));
  }
};
