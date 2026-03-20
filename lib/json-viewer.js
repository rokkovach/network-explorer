// json-viewer.js — JSON pretty-print with collapsible nodes

const JsonViewer = {
  MAX_STRING: 5000,
  COLLAPSE_DEPTH: 4,

  render(data, el) {
    el.innerHTML = '';
    el.className = 'json-viewer';
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      this._renderValue(parsed, el, 0);
    } catch {
      el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  },

  _span(cls, text) {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  },

  _renderValue(val, el, depth) {
    if (val === null) { el.appendChild(this._span('json-null', 'null')); return; }
    if (typeof val === 'boolean') { el.appendChild(this._span('json-boolean', String(val))); return; }
    if (typeof val === 'number') { el.appendChild(this._span('json-number', String(val))); return; }
    if (typeof val === 'string') {
      const display = val.length > this.MAX_STRING ? val.slice(0, this.MAX_STRING) + '…' : val;
      el.appendChild(this._span('json-string', JSON.stringify(display)));
      return;
    }
    if (Array.isArray(val)) return this._renderArr(val, el, depth);
    if (typeof val === 'object') return this._renderObj(val, el, depth);
    el.appendChild(document.createTextNode(String(val)));
  },

  _renderCollapsible(el, items, depth, openChar, closeChar) {
    if (items.length === 0) {
      el.appendChild(this._span('json-bracket', openChar + closeChar));
      return;
    }

    const collapsed = depth >= this.COLLAPSE_DEPTH;
    const wrapper = document.createElement('span');
    wrapper.style.display = collapsed ? 'none' : 'inline';

    const toggle = document.createElement('span');
    toggle.className = 'json-toggle';
    toggle.textContent = collapsed ? '▶ ' : '▼ ';

    const hint = document.createElement('span');
    hint.className = 'json-collapsed-indicator';
    hint.textContent = Array.isArray(items) ? `Array(${items.length})` : `{${Object.keys(items).length}}`;
    hint.style.display = collapsed ? 'inline' : 'none';

    el.appendChild(toggle);
    el.appendChild(this._span('json-bracket', openChar));
    el.appendChild(hint);
    el.appendChild(wrapper);
    el.appendChild(this._span('json-bracket', closeChar));

    const keys = Array.isArray(items) ? items.map((_, i) => i) : Object.keys(items);
    keys.forEach((key, i) => {
      if (!Array.isArray(items)) {
        el !== wrapper || true; // keys are added to wrapper below
        const ks = this._span('json-key', `"${key}"`);
        wrapper.appendChild(ks);
        wrapper.appendChild(this._span('json-bracket', ': '));
      }
      this._renderValue(items[key], wrapper, depth + 1);
      if (i < keys.length - 1) wrapper.appendChild(this._span('json-comma', ','));
      if (!Array.isArray(items) && i < keys.length - 1) wrapper.appendChild(document.createTextNode(' '));
    });

    toggle.addEventListener('click', () => {
      const hidden = wrapper.style.display === 'none';
      wrapper.style.display = hidden ? 'inline' : 'none';
      hint.style.display = hidden ? 'none' : 'inline';
      toggle.textContent = hidden ? '▼ ' : '▶ ';
    });
  },

  _renderArr(arr, el, depth) { this._renderCollapsible(el, arr, depth, '[', ']'); },

  _renderObj(obj, el, depth) {
    if (Object.keys(obj).length === 0) { el.appendChild(this._span('json-bracket', '{}')); return; }
    const collapsed = depth >= this.COLLAPSE_DEPTH;
    const wrapper = document.createElement('span');
    wrapper.style.display = collapsed ? 'none' : 'inline';

    const toggle = document.createElement('span');
    toggle.className = 'json-toggle';
    toggle.textContent = collapsed ? '▶ ' : '▼ ';

    const hint = document.createElement('span');
    hint.className = 'json-collapsed-indicator';
    hint.textContent = `{${Object.keys(obj).length}}`;
    hint.style.display = collapsed ? 'inline' : 'none';

    el.appendChild(toggle);
    el.appendChild(this._span('json-bracket', '{'));
    el.appendChild(hint);
    el.appendChild(wrapper);
    el.appendChild(this._span('json-bracket', '}'));

    const keys = Object.keys(obj);
    keys.forEach((key, i) => {
      wrapper.appendChild(this._span('json-key', `"${key}"`));
      wrapper.appendChild(this._span('json-bracket', ': '));
      this._renderValue(obj[key], wrapper, depth + 1);
      if (i < keys.length - 1) wrapper.appendChild(this._span('json-comma', ', '));
    });

    toggle.addEventListener('click', () => {
      const hidden = wrapper.style.display === 'none';
      wrapper.style.display = hidden ? 'inline' : 'none';
      hint.style.display = hidden ? 'none' : 'inline';
      toggle.textContent = hidden ? '▼ ' : '▶ ';
    });
  }
};
