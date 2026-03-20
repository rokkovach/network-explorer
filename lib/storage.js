// storage.js — Export, import, clear functionality

const Storage = {
  exportJSON() {
    if (!window.__requests || window.__requests.length === 0) return;
    const data = window.__requests.map(r => ({
      id: r.id, method: r.method, url: r.url,
      statusCode: r.statusCode, statusText: r.statusText,
      type: r.type, mimeType: r.mimeType,
      size: r.size, time: r.time, startedDateTime: r.startedDateTime,
      requestHeaders: r.requestHeaders, responseHeaders: r.responseHeaders,
      requestBody: r.requestBody, responseBody: r.responseBody,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `network-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  clear() {
    window.__requests = [];
    window.__requestMap = {};
    window.__nextId = 1;
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  },

  generateCurl(request) {
    if (!request) return '';
    let curl = `curl '${request.url}'`;
    if (request.method !== 'GET') curl += ` \\\n  -X ${request.method}`;
    if (request.requestHeaders) {
      for (const h of request.requestHeaders) {
        const name = h.name.toLowerCase();
        if (name.startsWith('sec-') || name === 'cookie' || name === 'referer' || name === 'accept-encoding') continue;
        curl += ` \\\n  -H '${h.name}: ${h.value.replace(/'/g, "\\'")}'`;
      }
    }
    if (request.requestBody && request.requestBody !== '[FormData]' && request.requestBody !== '[Blob]' && request.requestBody !== '[ArrayBuffer]' && request.requestBody !== '[Object]') {
      curl += ` \\\n  --data-raw '${request.requestBody.replace(/'/g, "\\'")}'`;
    }
    return curl;
  }
};
