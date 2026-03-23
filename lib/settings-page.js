// Settings page controller (injected into sidepanel.js context)

const SettingsPage = {
  _initialized: false,

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    await Settings.load();

    // Theme buttons
    const currentTheme = Settings.get('theme') || 'system';
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === currentTheme);
      btn.addEventListener('click', async () => {
        await Settings.setTheme(btn.dataset.themeVal);
        document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast('Theme updated');
      });
    });

    // Enabled toggle
    document.getElementById('setting-enabled').checked = Settings.get('enabled') !== false;

    // Max requests
    document.getElementById('setting-max-requests').value = Settings.get('maxRequests') || 1000;

    // Max body size
    document.getElementById('setting-max-body-size').value = Math.round((Settings.get('maxBodySize') || 500000) / 1024);

    // Site rules
    this._renderSiteRules();

    // Event listeners for save
    document.getElementById('setting-enabled').addEventListener('change', async (e) => {
      await Settings.save({ enabled: e.target.checked });
      showToast(e.target.checked ? 'Capture enabled globally' : 'Capture disabled globally');
    });

    document.getElementById('setting-max-requests').addEventListener('change', async (e) => {
      const val = Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000));
      e.target.value = val;
      await Settings.save({ maxRequests: val });
      showToast('Max requests updated');
    });

    document.getElementById('setting-max-body-size').addEventListener('change', async (e) => {
      const valKB = Math.max(10, Math.min(5000, parseInt(e.target.value) || 500));
      e.target.value = valKB;
      await Settings.save({ maxBodySize: valKB * 1024 });
      showToast('Max body size updated');
    });

    // Site rules
    document.getElementById('btn-add-site-rule').addEventListener('click', () => {
      this._addSiteRule();
    });

    // Profile export
    document.getElementById('btn-export-full-profile').addEventListener('click', async () => {
      await Settings.exportFullProfile();
      showToast('Full profile exported');
    });

    document.getElementById('btn-export-settings-only').addEventListener('click', async () => {
      await Settings.exportSettingsOnly();
      showToast('Settings exported');
    });

    document.getElementById('btn-export-filters-only').addEventListener('click', async () => {
      await Settings.exportFiltersOnly();
      showToast('Filters exported');
    });

    // Profile import
    document.getElementById('btn-import-profile').addEventListener('click', () => {
      document.getElementById('import-profile-input').click();
    });

    document.getElementById('import-profile-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const type = await Settings.importProfile(text);
        const labels = { full: 'Full profile', settings: 'Settings', filters: 'Filters' };
        showToast(`Imported ${labels[type] || 'profile'}`);
        // Re-render site rules if settings were imported
        if (type === 'full' || type === 'settings') {
          this._renderSiteRules();
        }
        // Re-render filters if filters were imported
        if (type === 'full' || type === 'filters') {
          await Filters.init();
        }
        // Re-apply theme
        Settings.applyTheme();
        // Update UI controls
        document.getElementById('setting-enabled').checked = Settings.get('enabled') !== false;
        document.getElementById('setting-max-requests').value = Settings.get('maxRequests') || 1000;
        document.getElementById('setting-max-body-size').value = Math.round((Settings.get('maxBodySize') || 500000) / 1024);
        document.querySelectorAll('.theme-option').forEach(b => {
          b.classList.toggle('active', b.dataset.themeVal === (Settings.get('theme') || 'system'));
        });
      } catch(err) {
        showToast('Import failed: ' + err.message);
      }
      e.target.value = '';
    });

    // Filter import/export (moved here from custom filters panel)
    document.getElementById('btn-export-filters').addEventListener('click', function() {
      Filters.exportFilters();
      showToast('Filters exported');
    });

    document.getElementById('btn-import-filters').addEventListener('click', function() {
      document.getElementById('import-filters-input').click();
    });

    document.getElementById('import-filters-input').addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const count = await Filters.importFilters(file);
        showToast('Imported ' + count + ' filter rule(s)');
      } catch(err) {
        showToast('Import failed: ' + err.message);
      }
      e.target.value = '';
    });
  },

  _renderSiteRules() {
    const container = document.getElementById('site-rules-list');
    if (!container) return;

    const siteRules = Settings.get('siteRules') || {};
    container.innerHTML = '';

    Object.keys(siteRules).forEach(domain => {
      const rule = siteRules[domain];
      const div = document.createElement('div');
      div.className = 'site-rule-item';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = domain;
      input.disabled = true;
      div.appendChild(input);

      const select = document.createElement('select');
      select.innerHTML = '<option value="allow"' + (rule === 'allow' ? ' selected' : '') + '>Allow</option>' +
                          '<option value="block"' + (rule === 'block' ? ' selected' : '') + '>Block</option>';
      select.addEventListener('change', async () => {
        const rules = Settings.get('siteRules') || {};
        rules[domain] = select.value;
        await Settings.saveSiteRules(rules);
        showToast(`Updated rule for ${domain}: ${select.value}`);
      });
      div.appendChild(select);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-rule';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', async () => {
        const rules = Settings.get('siteRules') || {};
        delete rules[domain];
        await Settings.saveSiteRules(rules);
        this._renderSiteRules();
        showToast(`Removed rule for ${domain}`);
      });
      div.appendChild(removeBtn);

      container.appendChild(div);
    });
  },

  _addSiteRule() {
    const container = document.getElementById('site-rules-list');
    const div = document.createElement('div');
    div.className = 'site-rule-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'example.com';
    div.appendChild(input);

    const select = document.createElement('select');
    select.innerHTML = '<option value="allow">Allow</option><option value="block">Block</option>';
    div.appendChild(select);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = 'Save';
    saveBtn.style.fontSize = '10px';
    saveBtn.style.padding = '3px 8px';
    saveBtn.addEventListener('click', async () => {
      const domain = input.value.trim().replace(/^www\./, '').toLowerCase();
      if (!domain) { showToast('Enter a domain'); return; }
      const rules = Settings.get('siteRules') || {};
      rules[domain] = select.value;
      await Settings.saveSiteRules(rules);
      this._renderSiteRules();
      showToast(`Added rule for ${domain}: ${select.value}`);
    });
    div.appendChild(saveBtn);

    container.appendChild(div);
    input.focus();
  },
};
