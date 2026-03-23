// capture.js — MAIN world (document_start)
// This runs in the page's actual JS context, so overriding fetch/XHR works.
// Communicates with bridge.js via window.postMessage.

(function() {
  // Prevent double-patch (e.g., after a soft navigation)
  if (window.__nePatched) return;
  window.__nePatched = true;

  let nextId = 1;
  let capturing = true;

  function truncate(str, max) {
    max = max || 500000;
    if (!str || str.length <= max) return str;
    return str.slice(0, max);
  }

  function getHeadersObj(headers) {
    const result = [];
    if (headers && typeof headers.forEach === 'function') {
      headers.forEach(function(v, k) { result.push({ name: k, value: v }); });
    } else if (headers && typeof headers === 'object') {
      Object.keys(headers).forEach(function(k) {
        if (typeof headers[k] === 'string') result.push({ name: k, value: headers[k] });
      });
    }
    return result;
  }

  function contentTypeFromHeaders(headers) {
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].name.toLowerCase() === 'content-type') return headers[i].value;
    }
    return '';
  }

  function send(request) {
    if (!capturing) return;
    try {
      window.postMessage({
        source: '__network_explorer__',
        type: 'REQUEST',
        data: request
      }, '*');
    } catch(e) {}
  }

  // ===== FETCH =====
  var origFetch = window.fetch;
  window.fetch = function() {
    var startTime = performance.now();
    var args = arguments;
    var input = args[0];
    var init = args[1] || {};

    var url = typeof input === 'string' ? input
      : (input && input.url) ? input.url : String(input);
    var method = (init.method || (input && input.method) || 'GET').toUpperCase();

    var reqBody = null;
    if (init.body) {
      if (typeof init.body === 'string') reqBody = init.body;
      else if (init.body instanceof FormData) reqBody = '[FormData]';
      else if (init.body instanceof URLSearchParams) reqBody = init.body.toString();
      else if (init.body instanceof Blob) reqBody = '[Blob ' + init.body.size + 'B]';
      else if (init.body instanceof ArrayBuffer) reqBody = '[ArrayBuffer ' + init.body.byteLength + 'B]';
      else { try { reqBody = JSON.stringify(init.body); } catch(e) { reqBody = '[Object]'; } }
    }

    var reqHeaders = getHeadersObj(init.headers);

    return origFetch.apply(this, args).then(function(response) {
      var endTime = performance.now();
      var clone = response.clone();

      clone.text().then(function(body) {
        var resHeaders = getHeadersObj(clone.headers);
        send({
          id: nextId++,
          method: method,
          url: url,
          statusCode: clone.status,
          statusText: clone.statusText,
          mimeType: contentTypeFromHeaders(resHeaders),
          type: 'fetch',
          size: body ? body.length : 0,
          time: endTime - startTime,
          startedDateTime: new Date(startTime).toISOString(),
          requestHeaders: reqHeaders,
          responseHeaders: resHeaders,
          requestBody: truncate(reqBody),
          responseBody: truncate(body),
        });
      }).catch(function() {
        var resHeaders = getHeadersObj(clone.headers);
        send({
          id: nextId++, method: method, url: url,
          statusCode: response.status,
          statusText: response.statusText,
          mimeType: contentTypeFromHeaders(resHeaders),
          type: 'fetch', size: 0, time: endTime - startTime,
          startedDateTime: new Date(startTime).toISOString(),
          requestHeaders: reqHeaders, responseHeaders: resHeaders,
          requestBody: truncate(reqBody), responseBody: null,
        });
      });

      return response;
    }).catch(function(err) {
      var endTime = performance.now();
      send({
        id: nextId++, method: method, url: url,
        statusCode: 0,
        statusText: 'Error: ' + err.message,
        mimeType: '', type: 'fetch',
        size: 0, time: endTime - startTime,
        startedDateTime: new Date(startTime).toISOString(),
        requestHeaders: reqHeaders, responseHeaders: [],
        requestBody: truncate(reqBody), responseBody: null,
      });
      throw err;
    });
  };

  // ===== XMLHttpRequest =====
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  var origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url, async) {
    this.__ne_method = method.toUpperCase();
    this.__ne_url = typeof url === 'string' ? url : String(url);
    this.__ne_headers = [];
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this.__ne_headers) this.__ne_headers.push({ name: name, value: value });
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    var startTime = performance.now();
    var self = this;

    var reqBody = null;
    if (body) {
      if (typeof body === 'string') reqBody = body;
      else if (body instanceof FormData) reqBody = '[FormData]';
      else if (body instanceof URLSearchParams) reqBody = body.toString();
      else if (body instanceof ArrayBuffer) reqBody = '[ArrayBuffer]';
      else { try { reqBody = JSON.stringify(body); } catch(e) { reqBody = '[Object]'; } }
    }

    self.addEventListener('readystatechange', function handler() {
      if (self.readyState === 4) {
        self.removeEventListener('readystatechange', handler);
        var endTime = performance.now();

        var resHeaders = [];
        var raw = self.getAllResponseHeaders();
        if (raw) {
          raw.split(/\r?\n/).forEach(function(line) {
            var idx = line.indexOf(':');
            if (idx > 0) resHeaders.push({ name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
          });
        }

        var resBody = null;
        try { resBody = self.responseText; } catch(e) {}

        send({
          id: nextId++,
          method: self.__ne_method || 'GET',
          url: self.__ne_url || '',
          statusCode: self.status,
          statusText: self.statusText || '',
          mimeType: contentTypeFromHeaders(resHeaders),
          type: 'xhr',
          size: resBody ? resBody.length : 0,
          time: endTime - startTime,
          startedDateTime: new Date(startTime).toISOString(),
          requestHeaders: self.__ne_headers || [],
          responseHeaders: resHeaders,
          requestBody: truncate(reqBody),
          responseBody: truncate(resBody),
        });
      }
    });

    return origSend.apply(this, arguments);
  };

  // ===== CONTROL (called from sidepanel via chrome.scripting.executeScript) =====
  window.__neReset = function() {
    nextId = 1;
    capturing = true;
  };

  window.__neGetStatus = function() {
    return { capturing: capturing, patched: true, count: nextId - 1 };
  };
})();
