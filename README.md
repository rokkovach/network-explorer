# Network Explorer

Chrome extension that captures and inspects HTTP requests — no DevTools needed.

Click the extension icon to open a full-featured panel showing all fetch/XHR requests on the current page, with JSON pretty-printing, filtering, and export.

## Features

- **Request capture** — intercepts all `fetch()` and `XMLHttpRequest` calls via MAIN world content script
- **Full detail view** — request/response headers, bodies, timing
- **JSON viewer** — syntax highlighted with collapsible nodes
- **Filtering** — by method, status code, type, and URL search
- **Export** — download all captured requests as JSON
- **Copy as cURL** — one-click cURL command generation
- **Keyboard shortcuts** — `/` search, `Ctrl+K` clear, `Ctrl+E` export, arrow keys to navigate
- **Auto-inject** — starts capturing from page load on any tab

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `chrome-network-explorer` directory

## Usage

1. Navigate to any page
2. Click the Network Explorer icon in your toolbar
3. Requests are captured automatically from page load
4. Click any request to see full details
5. Use filters and search to narrow down
6. Click **Refresh** to reload the page and capture fresh requests
7. Click **Export** to download all captured data

## Architecture

```
capture.js (MAIN world)   → overrides fetch/XHR, posts via window.postMessage
bridge.js (ISOLATED world) → relays postMessage → chrome.runtime.sendMessage
background.js (service worker) → stores requests per tab, forwards to popup
popup.js + popup.html      → UI, loads history, listens for new requests
```

## Tech

- Manifest V3
- Vanilla JS/CSS (zero dependencies)
- MAIN world content script for real interception
- Dark theme

## License

MIT
