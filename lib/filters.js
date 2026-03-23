// filters.js — Advanced regex filters with AND/OR logic

const Filters = {
  // Active advanced filter rules (in-memory, loaded from storage)
  _rules: [],

  async init() {
    this._rules = await Settings.getAutoFilterRules();
    this._renderRules();
  },

  getActive() {
    return {
      method: document.getElementById('filter-method').value,
      status: document.getElementById('filter-status').value,
      type: document.getElementById('filter-type').value,
      search: document.getElementById('search-input').value.toLowerCase().trim(),
    };
  },

  matchesSimple(req, f) {
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

  // Match an advanced rule against a request
  _matchRule(req, rule) {
    let value = '';
    const field = rule.field || 'url';

    if (field === 'url') {
      value = req.url || '';
    } else if (field === 'user-agent') {
      // Search in request headers for user-agent
      const ua = (req.requestHeaders || []).find(h => h.name.toLowerCase() === 'user-agent');
      value = ua ? ua.value : '';
    } else {
      // Search in request headers for any header name
      const header = (req.requestHeaders || []).find(h => h.name.toLowerCase() === field.toLowerCase());
      value = header ? header.value : '';
    }

    const pattern = rule.value || '';
    const op = rule.operator || 'contains';
    const method = rule.method || 'any';

    // Check method filter
    if (method !== 'any' && req.method !== method) return false;

    // Check value pattern
    if (!pattern) return true; // Empty pattern matches everything

    if (op === 'contains') {
      return value.toLowerCase().includes(pattern.toLowerCase());
    } else if (op === 'regex') {
      try {
        const re = new RegExp(pattern, 'i');
        return re.test(value);
      } catch {
        return false; // Invalid regex
      }
    } else if (op === 'equals') {
      return value.toLowerCase() === pattern.toLowerCase();
    } else if (op === 'starts-with') {
      return value.toLowerCase().startsWith(pattern.toLowerCase());
    } else if (op === 'ends-with') {
      return value.toLowerCase().endsWith(pattern.toLowerCase());
    }

    return true;
  },

  // Apply advanced filter rules with AND/OR logic
  _matchesAdvancedRules(req) {
    if (!this._rules || this._rules.length === 0) return true;

    // Evaluate rules with their logic operators
    // First rule has no logic operator (it's the starting condition)
    // Subsequent rules use their logic field (AND/OR) to combine with the previous result
    let result = null;

    for (const rule of this._rules) {
      if (!rule.enabled && rule.enabled !== undefined) continue;
      const match = this._matchRule(req, rule);

      if (result === null) {
        result = match;
      } else if (rule.logic === 'OR') {
        result = result || match;
      } else {
        // Default to AND
        result = result && match;
      }
    }

    return result === null ? true : result;
  },

  matches(req, f) {
    if (!this.matchesSimple(req, f)) return false;
    if (!this._matchesAdvancedRules(req)) return false;
    return true;
  },

  apply(requests) {
    const f = this.getActive();
    if (f.method === 'all' && f.status === 'all' && f.type === 'all' && !f.search && this._rules.length === 0) {
      return requests;
    }
    return requests.filter(r => this.matches(r, f));
  },

  // ===== UI for advanced filters =====
  _renderRules() {
    const container = document.getElementById('filter-rules');
    if (!container) return;

    const countEl = document.getElementById('active-filter-count');
    const enabledCount = this._rules.filter(r => r.enabled !== false).length;
    if (countEl) {
      countEl.textContent = `(${enabledCount})`;
      countEl.style.display = enabledCount > 0 ? 'inline' : 'none';
    }

    container.innerHTML = '';
    this._rules.forEach((rule, idx) => {
      const div = document.createElement('div');
      div.className = 'filter-rule';

      // Logic operator (only for rules after the first)
      if (idx > 0) {
        const logicSel = document.createElement('select');
        logicSel.className = 'logic-select';
        ['AND', 'OR'].forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          if ((rule.logic || 'AND') === v) opt.selected = true;
          logicSel.appendChild(opt);
        });
        logicSel.addEventListener('change', () => {
          this._rules[idx].logic = logicSel.value;
          this._persistRules();
        });
        div.appendChild(logicSel);
      } else {
        const spacer = document.createElement('span');
        spacer.style.width = '50px';
        spacer.style.display = 'inline-block';
        div.appendChild(spacer);
      }

      // Field select
      const fieldSel = document.createElement('select');
      fieldSel.className = 'field-select';
      [
        { value: 'url', label: 'URL' },
        { value: 'user-agent', label: 'User-Agent' },
        { value: 'content-type', label: 'Content-Type' },
        { value: 'authorization', label: 'Authorization' },
        { value: 'custom', label: 'Custom Header' },
      ].forEach(opt => {
        const el = document.createElement('option');
        el.value = opt.value;
        el.textContent = opt.label;
        if ((rule.field || 'url') === opt.value) el.selected = true;
        fieldSel.appendChild(el);
      });
      div.appendChild(fieldSel);

      // Custom header name input (shown when field === 'custom')
      if (rule.field === 'custom') {
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.placeholder = 'Header name';
        customInput.value = rule.customHeader || '';
        customInput.style.width = '80px';
        customInput.addEventListener('input', () => {
          this._rules[idx].customHeader = customInput.value;
          this._persistRules();
        });
        div.appendChild(customInput);
      }

      fieldSel.addEventListener('change', () => {
        this._rules[idx].field = fieldSel.value;
        this._persistRules();
        this._renderRules(); // Re-render to show/hide custom header input
      });

      // Operator select
      const opSel = document.createElement('select');
      opSel.className = 'op-select';
      [
        { value: 'contains', label: 'Contains' },
        { value: 'regex', label: 'Regex' },
        { value: 'equals', label: 'Equals' },
        { value: 'starts-with', label: 'Starts' },
        { value: 'ends-with', label: 'Ends' },
      ].forEach(opt => {
        const el = document.createElement('option');
        el.value = opt.value;
        el.textContent = opt.label;
        if ((rule.operator || 'contains') === opt.value) el.selected = true;
        opSel.appendChild(el);
      });
      opSel.addEventListener('change', () => {
        this._rules[idx].operator = opSel.value;
        this._persistRules();
      });
      div.appendChild(opSel);

      // Value input
      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.placeholder = 'pattern...';
      valInput.value = rule.value || '';
      valInput.addEventListener('input', () => {
        this._rules[idx].value = valInput.value;
        this._persistRules();
        RequestList.render();
      });
      div.appendChild(valInput);

      // Method select
      const methodSel = document.createElement('select');
      methodSel.className = 'method-select';
      [
        { value: 'any', label: 'Any' },
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'DELETE', label: 'DEL' },
      ].forEach(opt => {
        const el = document.createElement('option');
        el.value = opt.value;
        el.textContent = opt.label;
        if ((rule.method || 'any') === opt.value) el.selected = true;
        methodSel.appendChild(el);
      });
      methodSel.addEventListener('change', () => {
        this._rules[idx].method = methodSel.value;
        this._persistRules();
        RequestList.render();
      });
      div.appendChild(methodSel);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-rule';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => {
        this._rules.splice(idx, 1);
        this._persistRules();
        this._renderRules();
        RequestList.render();
      });
      div.appendChild(removeBtn);

      container.appendChild(div);
    });
  },

  addRule() {
    this._rules.push({
      field: 'url',
      operator: 'contains',
      value: '',
      method: 'any',
      logic: 'AND',
      enabled: true,
    });
    this._persistRules();
    this._renderRules();
  },

  async _persistRules() {
    await Settings.saveAutoFilterRules(this._rules);
  },

  // Import filters from JSON file
  async importFilters(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          let rules;
          if (Array.isArray(data)) {
            rules = data;
          } else if (data.filters && Array.isArray(data.filters)) {
            rules = data.filters;
          } else {
            reject(new Error('No filter rules found in file'));
            return;
          }
          // Validate each rule has required fields
          rules = rules.map(r => ({
            field: r.field || 'url',
            operator: r.operator || 'contains',
            value: r.value || '',
            method: r.method || 'any',
            logic: r.logic || 'AND',
            enabled: r.enabled !== false,
            customHeader: r.customHeader || '',
          }));
          this._rules = rules;
          await this._persistRules();
          this._renderRules();
          resolve(rules.length);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  },

  exportFilters() {
    const data = {
      _type: 'network-explorer-filters',
      _version: '2.0.0',
      exportedAt: new Date().toISOString(),
      filters: this._rules,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ne-filters-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
