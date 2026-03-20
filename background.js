// background.js — Service worker: stores requests, relays to popup

const state = {
  // tabId -> [requests]
  requests: {},
};

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'CAPTURED') {
    // From bridge.js (content script)
    var tabId = sender.tab ? sender.tab.id : 0;
    if (!tabId) return;

    if (!state.requests[tabId]) state.requests[tabId] = [];

    var request = message.request;
    state.requests[tabId].push(request);

    // Forward to popup if it's open
    chrome.runtime.sendMessage({
      type: 'FORWARD',
      request: request,
      tabId: tabId
    }).catch(function() {
      // Popup not open, that's fine
    });

    sendResponse({ ok: true });
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
});

// Clean up on tab close
chrome.tabs.onRemoved.addListener(function(tabId) {
  delete state.requests[tabId];
});
