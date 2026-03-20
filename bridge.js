// bridge.js — ISOLATED world (document_start)
// Relays postMessage from capture.js to the extension background.

(function() {
  window.addEventListener('message', function(event) {
    // Only handle our messages
    if (!event.data || event.data.source !== '__network_explorer__') return;
    if (event.data.type !== 'REQUEST') return;

    try {
      chrome.runtime.sendMessage({
        type: 'CAPTURED',
        request: event.data.data
      });
    } catch(e) {
      // Extension context may be invalidated during navigation
    }
  });
})();
