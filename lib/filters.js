// filters.js — Custom regex filters with AND/OR logic, NOT toggle, saved presets

const Filters = {
  _rules: [],
  _presets: {},
  _activePreset: null,

  async init() {
    this._rules = await Settings.getAutoFilterRules();
    this._presets = await this._loadPresets();
    this._renderRules();
    this._renderPresets();
  },

  // ===== PRESET STORAGE =====
  async _loadPresets() {
    return new Promise(resolve => {
      chrome.storage.local.get('filterPresets', result => {
        resolve(result.filterPresets || {});
      });
    });
  },

  async _savePresets() {
    return new Promise(resolve => {
      chrome.storage.local.set({ filterPresets: this._presets }, resolve);
    });
  },

  _renderPresets() {
    const sel = document.getElementById('filter-preset-select');
    if (!sel) return;
    const deleteBtn = document.getElementById('btn-delete-preset');
    const currentVal = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    const names = Object.keys(this._presets).sort();
    if (names.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No saved presets';
      opt.disabled = true;
      opt.style.color = 'var(--text-muted)';
      sel.appendChild(opt);
    } else {
      names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
    }
    if (currentVal && this._presets[currentVal]) sel.value = currentVal;
    if (deleteBtn) deleteBtn.style.display = sel.value && this._presets[sel.value] ? '' : 'none';
  },

  _onPresetChange() {
    const sel = document.getElementById('filter-preset-select');
    const deleteBtn = document.getElementById('btn-delete-preset');
    if (!sel) return;
    const name = sel.value;
    if (deleteBtn) deleteBtn.style.display = name && this._presets[name] ? '' : 'none';
    if (!name || !this._presets[name]) return;
    const preset = this._presets[name];
    if (preset && preset.rules) {
      this._rules = preset.rules.map(r => ({ ...r }));
      this._activePreset = name;
      this._persistRules();
      this._renderRules();
      RequestList.render();
      showToast('Loaded preset: ' + name);
    }
  },

  async _saveAsPreset() {
    if (this._rules.length === 0) { showToast('No filter rules to save'); return; }
    const name = prompt('Preset name:');
    if (!name || !name.trim()) return;
    const key = name.trim();
    if (this._presets[key]) {
      if (!confirm('Preset "' + key + '" already exists. Overwrite?')) return;
    }
    this._presets[key] = {
      rules: this._rules.map(r => ({ ...r })),
      savedAt: new Date().toISOString(),
    };
    this._activePreset = key;
    await this._savePresets();
    this._renderPresets();
    const sel = document.getElementById('filter-preset-select');
    if (sel) sel.value = key;
    showToast('Saved preset: ' + key);
  },

  async _deletePreset() {
    const sel = document.getElementById('filter-preset-select');
    if (!sel || !sel.value) return;
    const name = sel.value;
    if (!confirm('Delete preset "' + name + '"?')) return;
    delete this._presets[name];
    this._activePreset = null;
    await this._savePresets();
    this._renderPresets();
    showToast('Deleted preset: ' + name);
  },

  // ===== SIMPLE FILTERS =====
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

  _matchRule(req, rule) {
    let value = '';
    const field = rule.field || 'url';
    if (field === 'url') {
      value = req.url || '';
    } else if (field === 'user-agent') {
      const ua = (req.requestHeaders || []).find(h => h.name.toLowerCase() === 'user-agent');
      value = ua ? ua.value : '';
    } else {
      const header = (req.requestHeaders || []).find(h => h.name.toLowerCase() === field.toLowerCase());
      value = header ? header.value : '';
    }
    const pattern = rule.value || '';
    const op = rule.operator || 'contains';
    const method = rule.method || 'any';
    if (method !== 'any' && req.method !== method) return false;
    if (!pattern) return true;
    let matched = false;
    if (op === 'contains') {
      matched = value.toLowerCase().includes(pattern.toLowerCase());
    } else if (op === 'regex') {
      try { matched = new RegExp(pattern, 'i').test(value); } catch { matched = false; }
    } else if (op === 'equals') {
      matched = value.toLowerCase() === pattern.toLowerCase();
    } else if (op === 'starts-with') {
      matched = value.toLowerCase().startsWith(pattern.toLowerCase());
    } else if (op === 'ends-with') {
      matched = value.toLowerCase().endsWith(pattern.toLowerCase());
    }
    return rule.negate ? !matched : matched;
  },

  _matchesAdvancedRules(req) {
    if (!this._rules || this._rules.length === 0) return true;
    // First pass: check exclude rules — if any match, reject immediately
    for (const rule of this._rules) {
      if (!rule.exclude) continue;
      if (rule.enabled === false) continue;
      if (this._matchRule(req, rule)) return false;
    }
    // Second pass: apply AND/OR logic on non-exclude rules
    let result = null;
    for (const rule of this._rules) {
      if (rule.exclude) continue;
      if (rule.enabled === false) continue;
      const match = this._matchRule(req, rule);
      if (result === null) { result = match; }
      else if (rule.logic === 'OR') { result = result || match; }
      else { result = result && match; }
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
    if (f.method === 'all' && f.status === 'all' && f.type === 'all' && !f.search && this._rules.length === 0) return requests;
    return requests.filter(r => this.matches(r, f));
  },

  // ===== RULE RENDERING =====
  _renderRules() {
    const container = document.getElementById('filter-rules');
    if (!container) return;
    const countEl = document.getElementById('active-filter-count');
    const enabledCount = this._rules.filter(r => r.enabled !== false).length;
    if (countEl) {
      countEl.textContent = '(' + enabledCount + ')';
      countEl.style.display = enabledCount > 0 ? 'inline' : 'none';
    }
    container.innerHTML = '';
    this._rules.forEach((rule, idx) => {
      const div = document.createElement('div');
      div.className = 'filter-rule';
      // Logic (first row gets spacer)
      if (idx > 0) {
        const logicSel = document.createElement('select');
        logicSel.className = 'logic-select';
        [['AND','AND'],['OR','OR']].forEach(([v,l]) => {
          const opt = document.createElement('option');
          opt.value = v; opt.textContent = l;
          if ((rule.logic || 'AND') === v) opt.selected = true;
          logicSel.appendChild(opt);
        });
        logicSel.addEventListener('change', () => { this._rules[idx].logic = logicSel.value; this._persistRules(); });
        div.appendChild(logicSel);
      } else {
        const spacer = document.createElement('span');
        spacer.style.width = '50px';
        spacer.style.display = 'inline-block';
        div.appendChild(spacer);
      }
      // NOT toggle
      const notBtn = document.createElement('button');
      notBtn.className = 'btn negate-toggle' + (rule.negate ? ' active' : '');
      notBtn.textContent = rule.negate ? 'NOT' : 'IS';
      notBtn.title = 'Toggle negate';
      notBtn.style.padding = '2px 4px';
      notBtn.style.fontSize = '9px';
      notBtn.style.fontWeight = '700';
      notBtn.style.fontFamily = 'var(--font-mono)';
      notBtn.addEventListener('click', () => {
        this._rules[idx].negate = !this._rules[idx].negate;
        this._persistRules();
        this._renderRules();
        RequestList.render();
      });
      div.appendChild(notBtn);
      // EXCLUDE badge
      const excludeBtn = document.createElement('button');
      excludeBtn.className = 'btn exclude-toggle' + (rule.exclude ? ' active' : '');
      excludeBtn.textContent = 'EXCLUDE';
      excludeBtn.title = 'Toggle exclude rule';
      excludeBtn.style.padding = '2px 6px';
      excludeBtn.style.fontSize = '9px';
      excludeBtn.style.fontWeight = '700';
      excludeBtn.style.fontFamily = 'var(--font-mono)';
      excludeBtn.style.letterSpacing = '0.04em';
      if (rule.exclude) {
        excludeBtn.style.color = 'var(--red)';
        excludeBtn.style.borderColor = 'rgba(248, 81, 73, 0.4)';
        excludeBtn.style.background = 'rgba(248, 81, 73, 0.1)';
      }
      excludeBtn.addEventListener('click', () => {
        this._rules[idx].exclude = !this._rules[idx].exclude;
        this._persistRules();
        this._renderRules();
        RequestList.render();
      });
      div.appendChild(excludeBtn);
      // Field select
      const fieldSel = document.createElement('select');
      fieldSel.className = 'field-select';
      [['url','URL'],['user-agent','User-Agent'],['content-type','Content-Type'],['authorization','Authorization'],['custom','Custom Header']].forEach(([v,l]) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = l;
        if ((rule.field || 'url') === v) opt.selected = true;
        fieldSel.appendChild(opt);
      });
      div.appendChild(fieldSel);
      // Custom header input
      if (rule.field === 'custom') {
        const ci = document.createElement('input');
        ci.type = 'text'; ci.placeholder = 'Header name'; ci.value = rule.customHeader || ''; ci.style.width = '80px';
        ci.addEventListener('input', () => { this._rules[idx].customHeader = ci.value; this._persistRules(); });
        div.appendChild(ci);
      }
      fieldSel.addEventListener('change', () => { this._rules[idx].field = fieldSel.value; this._persistRules(); this._renderRules(); });
      // Operator
      const opSel = document.createElement('select');
      opSel.className = 'op-select';
      [['contains','Contains'],['regex','Regex'],['equals','Equals'],['starts-with','Starts'],['ends-with','Ends']].forEach(([v,l]) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = l;
        if ((rule.operator || 'contains') === v) opt.selected = true;
        opSel.appendChild(opt);
      });
      opSel.addEventListener('change', () => { this._rules[idx].operator = opSel.value; this._persistRules(); });
      div.appendChild(opSel);
      // Value input
      const valInput = document.createElement('input');
      valInput.type = 'text'; valInput.placeholder = 'pattern...'; valInput.value = rule.value || '';
      valInput.addEventListener('input', () => { this._rules[idx].value = valInput.value; this._persistRules(); RequestList.render(); });
      div.appendChild(valInput);
      // Method
      const methodSel = document.createElement('select');
      methodSel.className = 'method-select';
      [['any','Any'],['GET','GET'],['POST','POST'],['PUT','PUT'],['PATCH','PATCH'],['DELETE','DELETE']].forEach(([v,l]) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = l;
        if ((rule.method || 'any') === v) opt.selected = true;
        methodSel.appendChild(opt);
      });
      methodSel.addEventListener('change', () => { this._rules[idx].method = methodSel.value; this._persistRules(); RequestList.render(); });
      div.appendChild(methodSel);
      // Remove
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-rule'; removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => { this._rules.splice(idx, 1); this._persistRules(); this._renderRules(); RequestList.render(); });
      div.appendChild(removeBtn);
      container.appendChild(div);
    });
  },

  addRule(ruleOverrides) {
    this._rules.push({
      field: 'url',
      operator: 'contains',
      value: '',
      method: 'any',
      logic: 'AND',
      negate: false,
      enabled: true,
      ...ruleOverrides,
    });
    this._persistRules();
    this._renderRules();
  },

  // ===== CONTEXT MENU INTEGRATION =====
  // Add a rule from right-click on a request row
  addFromContext(action, request) {
    let pathname = '';
    try { pathname = new URL(request.url).pathname; } catch {}
    let domain = '';
    try { domain = new URL(request.url).hostname; } catch {}

    const rule = { field: 'url', operator: 'contains', method: 'any', logic: 'AND', negate: false, enabled: true };

    switch (action) {
      case 'include-url':
        rule.value = request.url;
        break;
      case 'include-domain':
        rule.value = domain;
        break;
      case 'exclude-url':
        rule.value = request.url;
        rule.exclude = true;
        break;
      case 'exclude-domain':
        rule.value = domain;
        rule.exclude = true;
        break;
      case 'exclude-method':
        rule.field = 'url';
        rule.operator = 'contains';
        rule.value = '';  // match all URLs
        rule.method = request.method;
        rule.exclude = true;
        break;
      case 'include-like':
        rule.value = pathname;
        rule.method = request.method;
        break;
      case 'exclude-like':
        rule.value = pathname;
        rule.method = request.method;
        rule.exclude = true;
        break;
    }

    this._rules.push(rule);
    this._persistRules();
    this._renderRules();
    RequestList.render();

    // Auto-open custom filters panel if not already open
    var body = document.getElementById('custom-filters-body');
    var chevron = document.getElementById('adv-chevron');
    if (body && !body.classList.contains('open')) {
      body.classList.add('open');
      if (chevron) chevron.classList.add('open');
    }

    const labels = {
      'include-url': 'Included URL: ' + (request.url.length > 40 ? request.url.slice(0, 40) + '...' : request.url),
      'include-domain': 'Included domain: ' + domain,
      'exclude-url': 'Excluded URL: ' + (request.url.length > 40 ? request.url.slice(0, 40) + '...' : request.url),
      'exclude-domain': 'Excluded domain: ' + domain,
      'exclude-method': 'Excluded method: ' + request.method,
      'include-like': 'Included: ' + request.method + ' ' + pathname,
      'exclude-like': 'Excluded: ' + request.method + ' ' + pathname,
    };
    showToast(labels[action] || 'Filter added');
  },

  resetAll() {
    this._rules = [];
    this._persistRules();
    this._renderRules();
  },

  async _persistRules() {
    await Settings.saveAutoFilterRules(this._rules);
  },

  async importFilters(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          let rules;
          if (Array.isArray(data)) { rules = data; }
          else if (data.filters && Array.isArray(data.filters)) { rules = data.filters; }
          else { reject(new Error('No filter rules found in file')); return; }
          rules = rules.map(r => ({
            field: r.field || 'url', operator: r.operator || 'contains', value: r.value || '',
            method: r.method || 'any', logic: r.logic || 'AND', enabled: r.enabled !== false,
            negate: !!r.negate, customHeader: r.customHeader || '',
          }));
          this._rules = rules;
          await this._persistRules();
          this._renderRules();
          resolve(rules.length);
        } catch (err) { reject(err); }
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
      presets: this._presets,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ne-filters-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  },
};
