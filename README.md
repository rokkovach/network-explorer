# Network Explorer

Chrome extension that captures and inspects HTTP requests — no DevTools needed.

Click the extension icon to open a side panel showing all fetch/XHR requests on the current tab, with JSON pretty-printing, advanced regex filtering, masked cURL export, and per-site capture rules.

## Features

- **Request capture** — intercepts all `fetch()` and `XMLHttpRequest` calls via MAIN world content script
- **Full detail view** — request/response headers, bodies, timing
- **JSON viewer** — syntax highlighted with collapsible nodes
- **Simple filtering** — by method, status code, type, and URL search
- **Advanced regex filters** — AND/OR logic chains, pair with HTTP methods, filter by URL, User-Agent, or any custom header; import/export as JSON
- **Right-click to filter** — right-click any request row to quickly include/exclude by URL, domain, or pattern
- **Saved filter presets** — save, load, and delete filter presets with include/exclude rules
- **Export** — download captured requests as JSON (respects current filters)
- **Copy as cURL** — one-click cURL generation with masked header option
- **Side panel** — lives in its own panel per tab, can be popped out to a separate window
- **Pause/Resume** — explicit capture toggle without disabling the extension
- **Site rules** — always allow or block capture on specific domains
- **Memory management** — configurable max requests per tab (default 1000), auto-pruning
- **Settings page** — dark/light/system theme, profile import/export
- **Profile system** — export Full Profile (settings + filters), Settings Only, or Filters Only as JSON
- **Keyboard shortcuts** — `/` search, `Ctrl+K` clear, `Ctrl+E` export, arrow keys to navigate

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `network-explorer` directory

## Usage

1. Navigate to any page
2. Click the Network Explorer icon in your toolbar to open the side panel
3. Requests are captured automatically from page load
4. Click any request to see full details
5. Use simple filters (method/status/type/search) or advanced regex filters
6. Click **Export** to download filtered data as JSON
7. Click **cURL** or **cURL (masked)** to copy the request as a cURL command
8. Use the pause button to temporarily stop displaying new requests
9. Open Settings (gear icon) to configure theme, site rules, memory limits, and import/export profiles

## Architecture

```
capture.js (MAIN world)     → overrides fetch/XHR, posts via window.postMessage
bridge.js (ISOLATED world)  → relays postMessage → chrome.runtime.sendMessage
background.js (service worker) → stores requests per tab, enforces site rules, manages settings via chrome.storage.local
sidepanel.js + sidepanel.html → UI, loads history, listens for new requests
lib/settings.js             → Settings, theme, profile import/export
lib/settings-page.js        → Settings UI controller
lib/storage.js              → Export, cURL generation (plain + masked)
lib/filters.js              → Simple + advanced regex filters with AND/OR
lib/request-list.js         → Request list rendering
lib/request-detail.js       → Detail panel with tabs
lib/json-viewer.js          → JSON pretty-print with collapsible nodes
```

## Tech

- Manifest V3
- Side Panel API (per-tab, can be detached to own window)
- Vanilla JS/CSS (zero dependencies)
- MAIN world content script for real interception
- chrome.storage.local for persistent settings
- Dark / Light / System theme

## v2.0 Changes

- Converted from popup to side panel (unpinnable, per-tab, own window)
- Added explicit pause/resume toggle
- Added site allow/block rules per domain
- Added configurable max requests (auto-pruning) and max body size
- Added advanced regex filters with AND/OR logic, HTTP method pairing, User-Agent/header filtering
- Added cURL masked export (header values replaced with `***`)
- Added export respects current filters
- Added Settings page with dark/light/system theme
- Added profile import/export (full profile, settings only, filters only)
- Added filter rules import/export as JSON
- All settings persisted via chrome.storage.local

## v2.1 Changes

- Added "Include requests like this" / "Exclude requests like this" right-click context menu options (filters by pathname + method)
- Added exclude rules with dedicated EXCLUDE toggle badge per filter rule (red-tinted when active)
- Exclude rules now properly reject matching requests regardless of AND/OR logic on include rules
- Increased custom filters panel max-height from 220px to 300px for better scrolling with many rules
- Converted main layout to flex-based height (no more calc height) for better responsiveness
- Added min-width styling to filter preset select for better readability
- Updated delete preset button with proper danger styling (red border + hover state)

## License

MIT
