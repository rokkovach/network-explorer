// sidepanel.js — Main app for side panel

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.classList.remove('show'); }, 1800);
}

(async function() {
  window.__requests = [];
  window.__requestMap = {};
  window.__myTabId = null;
  window.__capturePaused = false;

  // Initialize modules
  await Settings.init();
  RequestDetail.init();
  RequestList.init();
  await Filters.init();

  var statusPill = document.getElementById('status-pill');
  var statusLabel = document.getElementById('status-label');
  var toggleBtn = document.getElementById('btn-toggle');

  function setStatus(state, label) {
    statusPill.classList.remove('active', 'paused');
    if (state === 'active') statusPill.classList.add('active');
    if (state === 'paused') statusPill.classList.add('paused');
    statusLabel.textContent = label;
  }

  function updateToggleIcon() {
    if (window.__capturePaused) {
      toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2v10M10 2v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      toggleBtn.title = 'Resume capture';
      toggleBtn.classList.add('toggle-off');
    } else {
      toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 1.5l8 5.5-8 5.5z" fill="currentColor"/></svg>';
      toggleBtn.title = 'Pause capture';
      toggleBtn.classList.remove('toggle-off');
    }
  }

  // ===== POP OUT TO SEPARATE WINDOW =====
  var popoutBtn = document.getElementById('btn-popout');
  var urlParams = new URLSearchParams(window.location.search);
  var isStandalone = !!urlParams.get('tabId');

  // Hide pop-out button if already in standalone window
  if (isStandalone && popoutBtn) {
    popoutBtn.style.display = 'none';
  }

  if (popoutBtn) {
    popoutBtn.addEventListener('click', async function() {
      var tabId = window.__myTabId;
      if (!tabId) return;
      chrome.windows.create({
        url: chrome.runtime.getURL('window.html?tabId=' + tabId),
        type: 'popup',
        width: 900,
        height: 680,
        focused: true,
      });
    });
  }

  // ===== GET CURRENT TAB =====
  async function getTabId() {
    // If opened as standalone window, tabId comes from URL params
    if (isStandalone) {
      var tid = parseInt(urlParams.get('tabId'));
      return isNaN(tid) ? null : tid;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab ? tab.id : null;
    } catch(e) { return null; }
  }

  // ===== LOAD STORED REQUESTS FROM BACKGROUND =====
  function loadStoredRequests(tabId) {
    if (!tabId) return;
    chrome.runtime.sendMessage({ type: 'GET_REQUESTS', tabId: tabId }, function(resp) {
      if (chrome.runtime.lastError) return;
      if (!resp || !resp.requests) return;
      window.__requests = resp.requests;
      window.__requestMap = {};
      var maxId = 0;
      for (var i = 0; i < window.__requests.length; i++) {
        var r = window.__requests[i];
        window.__requestMap[r.id] = r;
        if (r.id > maxId) maxId = r.id;
      }
      window.__nextId = maxId + 1;
      RequestList.render();
      if (window.__requests.length > 0) {
        setStatus('active', window.__requests.length + ' captured');
      }
    });
  }

  // ===== LISTEN FOR NEW REQUESTS FROM BACKGROUND =====
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.type !== 'FORWARD') return;
    if (msg.tabId !== window.__myTabId) return;
    if (window.__capturePaused) return; // Don't display when paused

    var r = msg.request;
    if (window.__requestMap[r.id]) return;

    window.__requests.push(r);
    window.__requestMap[r.id] = r;
    if (r.id >= (window.__nextId || 0)) window.__nextId = r.id + 1;
    RequestList.render();
    var c = document.getElementById('request-list-container');
    c.scrollTop = c.scrollHeight;
    setStatus('active', window.__requests.length + ' captured');
    sendResponse({ ok: true });
  });

  // ===== TOGGLE CAPTURE (pause/resume display) =====
  toggleBtn.addEventListener('click', function() {
    window.__capturePaused = !window.__capturePaused;
    updateToggleIcon();
    if (window.__capturePaused) {
      setStatus('paused', 'Paused');
      showToast('Capture display paused');
    } else {
      setStatus('active', window.__requests.length + ' captured');
      showToast('Capture resumed');
    }
  });
  updateToggleIcon();

  // ===== SETTINGS =====
  var settingsView = document.getElementById('settings-view');
  var mainView = document.getElementById('main-view');

  document.getElementById('btn-settings').addEventListener('click', async function() {
    mainView.style.display = 'none';
    settingsView.classList.add('open');
    await SettingsPage.init();
  });

  document.getElementById('btn-settings-back').addEventListener('click', function() {
    settingsView.classList.remove('open');
    mainView.style.display = '';
  });

  // ===== REFRESH =====
  document.getElementById('btn-refresh').addEventListener('click', async function() {
    var tabId = window.__myTabId || await getTabId();
    if (!tabId) return;

    chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS', tabId: tabId });
    window.__requests = [];
    window.__requestMap = {};
    window.__nextId = 1;
    RequestList.deselect();
    RequestList.render();
    setStatus('active', 'Reloading...');

    chrome.tabs.reload(tabId, { bypassCache: true });
    showToast('Page reloading — capturing fresh requests');
  });

  // ===== CLEAR =====
  document.getElementById('btn-clear').addEventListener('click', async function() {
    var tabId = window.__myTabId || await getTabId();
    if (tabId) chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS', tabId: tabId });
    window.__requests = [];
    window.__requestMap = {};
    window.__nextId = 1;
    RequestList.deselect();
    RequestList.render();
    setStatus('active', 'Listening');
    showToast('Cleared');
  });

  // ===== EXPORT (filtered) =====
  document.getElementById('btn-export').addEventListener('click', function() {
    Storage.exportJSON(true); // true = respect current filters
    showToast('Exported (filtered)');
  });

  // ===== SIMPLE FILTERS =====
  document.getElementById('filter-method').addEventListener('change', function() { RequestList.render(); });
  document.getElementById('filter-status').addEventListener('change', function() { RequestList.render(); });
  document.getElementById('filter-type').addEventListener('change', function() { RequestList.render(); });
  var searchTimer;
  document.getElementById('search-input').addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() { RequestList.render(); }, 100);
  });

  // ===== ADVANCED FILTERS TOGGLE =====
  var advFiltersOpen = false;
  document.getElementById('advanced-filters-header').addEventListener('click', function() {
    advFiltersOpen = !advFiltersOpen;
    document.getElementById('advanced-filters-body').classList.toggle('open', advFiltersOpen);
    document.getElementById('adv-chevron').classList.toggle('open', advFiltersOpen);
  });

  // ===== ADVANCED FILTERS ACTIONS =====
  document.getElementById('btn-add-filter-rule').addEventListener('click', function() {
    Filters.addRule();
    // Open the panel if not already open
    if (!advFiltersOpen) {
      advFiltersOpen = true;
      document.getElementById('advanced-filters-body').classList.add('open');
      document.getElementById('adv-chevron').classList.add('open');
    }
  });

  document.getElementById('btn-import-filters').addEventListener('click', function() {
    document.getElementById('import-filters-input').click();
  });

  document.getElementById('import-filters-input').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const count = await Filters.importFilters(file);
      showToast(`Imported ${count} filter rule(s)`);
      RequestList.render();
    } catch(err) {
      showToast('Import failed: ' + err.message);
    }
    e.target.value = '';
  });

  document.getElementById('btn-export-filters').addEventListener('click', function() {
    Filters.exportFilters();
    showToast('Filters exported');
  });

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', function(e) {
    // Don't capture shortcuts when typing in inputs
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('btn-clear').click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); Storage.exportJSON(true); showToast('Exported'); }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); document.getElementById('search-input').focus();
    }
    if (e.key === 'Escape') {
      RequestList.deselect();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var reqs = Filters.apply(window.__requests);
      if (!reqs.length) return;
      var idx = reqs.findIndex(function(r) { return r.id === RequestList.selectedId; });
      var ni = e.key === 'ArrowDown'
        ? (idx < reqs.length - 1 ? idx + 1 : 0)
        : (idx > 0 ? idx - 1 : reqs.length - 1);
      RequestList.selectRequest(reqs[ni].id);
      var row = document.querySelector('tr[data-id="' + reqs[ni].id + '"]');
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  // ===== RESIZE =====
  var detailPanel = document.getElementById('detail-panel');
  var resizeHandle = document.createElement('div');
  resizeHandle.id = 'resize-handle';
  document.getElementById('main').insertBefore(resizeHandle, detailPanel);
  var isResizing = false, startY = 0, startH = 0;
  resizeHandle.addEventListener('mousedown', function(e) {
    isResizing = true; startY = e.clientY; startH = detailPanel.offsetHeight;
    document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'; e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!isResizing) return;
    detailPanel.style.height = Math.max(80, Math.min(startH + startY - e.clientY, window.innerHeight - 120)) + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (isResizing) { isResizing = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });

  // ===== LISTEN FOR SYSTEM THEME CHANGES =====
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (Settings.get('theme') === 'system') Settings.applyTheme();
  });

  // ===== INIT =====
  async function init() {
    var tabId = await getTabId();
    if (!tabId) { setStatus('paused', 'No tab'); RequestList.render(); return; }
    window.__myTabId = tabId;

    // Check if globally enabled
    if (!Settings.get('enabled')) {
      setStatus('paused', 'Disabled');
      showToast('Capture is disabled globally — enable in Settings');
    } else {
      // Check if capture script is active on this page
      try {
        var results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          world: 'MAIN',
          func: function() { return !!(window.__nePatched); }
        });
        if (results && results[0] && results[0].result) {
          setStatus('active', 'Listening');
        } else {
          setStatus('paused', 'Not injected');
        }
      } catch(e) {
        setStatus('paused', 'Cannot access');
      }
    }

    // Check site rules
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const domain = new URL(tab.url).hostname.replace(/^www\./, '');
        const siteRules = Settings.get('siteRules') || {};
        if (siteRules[domain] === 'block') {
          setStatus('paused', 'Blocked for ' + domain);
          showToast('Capture blocked for this domain — change in Settings');
        } else if (siteRules[domain] === 'allow') {
          setStatus('active', 'Listening (allowed)');
        }
      }
    } catch(e) {}

    loadStoredRequests(tabId);
    RequestList.render();
  }

  init();
})();
