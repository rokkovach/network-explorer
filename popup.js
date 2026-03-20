// popup.js — Main app for popup

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.classList.remove('show'); }, 1800);
}

(function() {
  window.__requests = [];
  window.__requestMap = {};
  window.__myTabId = null;

  RequestDetail.init();
  RequestList.init();

  var statusPill = document.getElementById('status-pill');
  var statusLabel = document.getElementById('status-label');

  function setStatus(active, label) {
    statusPill.classList.toggle('active', active);
    statusLabel.textContent = label;
  }

  // ===== GET CURRENT TAB =====
  async function getTabId() {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] ? tabs[0].id : null;
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
        setStatus(true, window.__requests.length + ' captured');
      }
    });
  }

  // ===== LISTEN FOR NEW REQUESTS FROM BACKGROUND =====
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    // Ignore our own messages and non-FORWARD messages
    if (msg.type !== 'FORWARD') return;
    if (msg.tabId !== window.__myTabId) return;
    // Don't add duplicates
    var r = msg.request;
    if (window.__requestMap[r.id]) return;

    window.__requests.push(r);
    window.__requestMap[r.id] = r;
    if (r.id >= (window.__nextId || 0)) window.__nextId = r.id + 1;
    RequestList.render();
    // Auto-scroll
    var c = document.getElementById('request-list-container');
    c.scrollTop = c.scrollHeight;
    setStatus(true, window.__requests.length + ' captured');
    sendResponse({ ok: true });
  });

  // ===== CLOSE =====
  document.getElementById('btn-close').addEventListener('click', function() { window.close(); });

  // ===== REFRESH =====
  document.getElementById('btn-refresh').addEventListener('click', async function() {
    var tabId = window.__myTabId || await getTabId();
    if (!tabId) return;

    // Clear everything
    chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS', tabId: tabId });
    window.__requests = [];
    window.__requestMap = {};
    window.__nextId = 1;
    RequestList.deselect();
    RequestList.render();
    setStatus(true, 'Reloading...');

    // Reload the actual page tab — content scripts re-inject at document_start
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
    setStatus(true, 'Listening');
    showToast('Cleared');
  });

  // ===== EXPORT =====
  document.getElementById('btn-export').addEventListener('click', function() {
    Storage.exportJSON();
    showToast('Exported');
  });

  // ===== FILTERS =====
  document.getElementById('filter-method').addEventListener('change', function() { RequestList.render(); });
  document.getElementById('filter-status').addEventListener('change', function() { RequestList.render(); });
  document.getElementById('filter-type').addEventListener('change', function() { RequestList.render(); });
  var searchTimer;
  document.getElementById('search-input').addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() { RequestList.render(); }, 100);
  });

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('btn-clear').click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); Storage.exportJSON(); showToast('Exported'); }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault(); document.getElementById('search-input').focus();
    }
    if (e.key === 'Escape') {
      var si = document.getElementById('search-input');
      if (document.activeElement === si) { si.value = ''; RequestList.render(); si.blur(); }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
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

  // ===== INIT =====
  async function init() {
    var tabId = await getTabId();
    if (!tabId) { setStatus(false, 'No tab'); RequestList.render(); return; }
    window.__myTabId = tabId;

    // Check if capture script is active on this page
    try {
      var results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: 'MAIN',
        func: function() { return !!(window.__nePatched); }
      });
      if (results && results[0] && results[0].result) {
        setStatus(true, 'Listening');
      } else {
        setStatus(false, 'Not injected');
      }
    } catch(e) {
      setStatus(false, 'Cannot access');
    }

    // Load any requests already captured (before popup opened)
    loadStoredRequests(tabId);
    RequestList.render();
  }

  init();
})();
