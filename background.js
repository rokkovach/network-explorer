// background.js — Service worker: stores requests, relays to side panel, manages settings

const state = {
  // tabId -> [requests]
  requests: {},
};

const DEFAULT_SETTINGS = {
  enabled: true,
  theme: 'system', // 'dark', 'light', 'system'
  maxRequests: 1000,
  maxBodySize: 500000,
  autoFilterRules: [],
  siteRules: {}, // domain -> 'allow' | 'block'
};

// ===== SETTINGS HELPERS =====
function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get('settings', result => {
      resolve(result.settings || { ...DEFAULT_SETTINGS });
    });
  });
}

function saveSettings(settings) {
  return new Promise(resolve => {
    chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings } }, resolve);
  });
}

// ===== AUTO-FILTER RULES HELPERS =====
function getAutoFilterRules() {
  return new Promise(resolve => {
    chrome.storage.local.get('autoFilterRules', result => {
      resolve(result.autoFilterRules || []);
    });
  });
}

function saveAutoFilterRules(rules) {
  return new Promise(resolve => {
    chrome.storage.local.set({ autoFilterRules: rules }, resolve);
  });
}

// ===== SITE RULES HELPERS =====
function getSiteRules() {
  return new Promise(resolve => {
    getSettings().then(s => resolve(s.siteRules || {}));
  });
}

function shouldCapture(tabId, url) {
  return new Promise(async resolve => {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
      resolve(false);
      return;
    }
    const settings = await getSettings();
    if (!settings.enabled) {
      resolve(false);
      return;
    }
    let domain;
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      resolve(true);
      return;
    }
    const rule = settings.siteRules[domain];
    if (rule === 'block') {
      resolve(false);
      return;
    }
    // If rule is 'allow', capture even if globally off (but we already checked enabled above)
    resolve(true);
  });
}

// ===== MESSAGE HANDLER =====
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'CAPTURED') {
    var tabId = sender.tab ? sender.tab.id : 0;
    if (!tabId) return;

    shouldCapture(tabId, message.request?.url).then(should => {
      if (!should) {
        sendResponse({ ok: true, filtered: true });
        return;
      }

      if (!state.requests[tabId]) state.requests[tabId] = [];
      state.requests[tabId].push(message.request);

      // Enforce max requests
      getSettings().then(settings => {
        const max = settings.maxRequests || 1000;
        if (state.requests[tabId].length > max) {
          state.requests[tabId] = state.requests[tabId].slice(-max);
        }
      });

      // Forward to side panel if open
      chrome.runtime.sendMessage({
        type: 'FORWARD',
        request: message.request,
        tabId: tabId
      }).catch(function() {
        // Panel not open, that's fine
      });

      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'GET_REQUESTS') {
    var tabId = message.tabId;
    sendResponse({
      requests: state.requests[tabId] || []
    });
    return true;
  }

  if (message.type === 'CLEAR_REQUESTS') {
    var tabId = message.tabId;
    if (tabId) {
      state.requests[tabId] = [];
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(settings => sendResponse(settings));
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'GET_AUTO_FILTER_RULES') {
    getAutoFilterRules().then(rules => sendResponse({ rules: rules }));
    return true;
  }

  if (message.type === 'SAVE_AUTO_FILTER_RULES') {
    saveAutoFilterRules(message.rules).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'GET_SITE_RULES') {
    getSiteRules().then(rules => sendResponse({ rules: rules }));
    return true;
  }
});

// Clean up on tab close
chrome.tabs.onRemoved.addListener(function(tabId) {
  delete state.requests[tabId];
});

// Open side panel on action click
chrome.action.onClicked.addListener(async function(tab) {
  await chrome.sidePanel.open({ tabId: tab.id });
});
