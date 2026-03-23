// settings.js — Settings management, theme, site rules, profile import/export

const Settings = {
  _settings: {},

  async init() {
    await this.load();
    this.applyTheme();
  },

  async load() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, settings => {
        if (chrome.runtime.lastError || !settings) {
          settings = { enabled: true, theme: 'system', maxRequests: 1000, maxBodySize: 500000, autoFilterRules: [], siteRules: {} };
        }
        this._settings = settings;
        resolve(settings);
      });
    });
  },

  async save(settings) {
    this._settings = { ...this._settings, ...settings };
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: this._settings }, resp => {
        resolve(resp);
      });
    });
  },

  get(key) {
    return this._settings[key];
  },

  getAll() {
    return { ...this._settings };
  },

  // ===== THEME =====
  applyTheme() {
    const theme = this._settings.theme || 'system';
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  async setTheme(theme) {
    await this.save({ theme: theme });
    this.applyTheme();
  },

  // ===== AUTO FILTER RULES =====
  async getAutoFilterRules() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_AUTO_FILTER_RULES' }, resp => {
        resolve(resp?.rules || []);
      });
    });
  },

  async saveAutoFilterRules(rules) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'SAVE_AUTO_FILTER_RULES', rules: rules }, resp => {
        resolve(resp);
      });
    });
  },

  // ===== SITE RULES =====
  async saveSiteRules(siteRules) {
    await this.save({ siteRules: siteRules });
  },

  // ===== PROFILE IMPORT / EXPORT =====
  async exportFullProfile() {
    const settings = this.getAll();
    const filters = await this.getAutoFilterRules();
    const profile = {
      _type: 'network-explorer-profile',
      _version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings: {
        enabled: settings.enabled,
        theme: settings.theme,
        maxRequests: settings.maxRequests,
        maxBodySize: settings.maxBodySize,
        siteRules: settings.siteRules,
      },
      filters: filters,
    };
    this._downloadJSON(profile, `ne-profile-${this._ts()}.json`);
  },

  async exportSettingsOnly() {
    const settings = this.getAll();
    const data = {
      _type: 'network-explorer-settings',
      _version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings: {
        enabled: settings.enabled,
        theme: settings.theme,
        maxRequests: settings.maxRequests,
        maxBodySize: settings.maxBodySize,
        siteRules: settings.siteRules,
      },
    };
    this._downloadJSON(data, `ne-settings-${this._ts()}.json`);
  },

  async exportFiltersOnly() {
    const filters = await this.getAutoFilterRules();
    const data = {
      _type: 'network-explorer-filters',
      _version: '2.0.0',
      exportedAt: new Date().toISOString(),
      filters: filters,
    };
    this._downloadJSON(data, `ne-filters-${this._ts()}.json`);
  },

  async importProfile(jsonData) {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

    if (data._type === 'network-explorer-profile' || (data.settings && data.filters)) {
      // Full profile
      if (data.settings) await this.save(data.settings);
      if (data.filters) await this.saveAutoFilterRules(data.filters);
      return 'full';
    } else if (data._type === 'network-explorer-settings' || (data.settings && !data.filters)) {
      // Settings only
      if (data.settings) await this.save(data.settings);
      return 'settings';
    } else if (data._type === 'network-explorer-filters' || (data.filters && !data.settings)) {
      // Filters only
      if (data.filters) await this.saveAutoFilterRules(data.filters);
      return 'filters';
    } else if (Array.isArray(data)) {
      // Legacy: just an array of filter rules
      await this.saveAutoFilterRules(data);
      return 'filters';
    }

    throw new Error('Unrecognized profile format');
  },

  _downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  _ts() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  },
};
