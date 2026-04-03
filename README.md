# Toolbox

A Chrome extension for saving, categorising, and organising tools you discover across the web.

## Features

- **One-click save** — auto-fills name, description, category, and pricing from the current page
- **Auto-categorisation** — 150+ known domains + keyword detection across 10 categories
- **Scan open tabs** — bulk-save tools from all open tabs with metadata extracted in parallel
- **Smart naming** — cleans page titles into concise "Tool — tagline" format
- **Live tab sync** — side panel updates as you switch tabs
- **Hover previews** — og:image + Microlink screenshot fallback
- **Import & export** — HTML bookmark files compatible with all browsers
- **Bulk actions** — select, delete with undo, edit inline
- **Fully local** — IndexedDB storage, no account, no cloud

## Tech Stack

- React 19 + TypeScript
- Tailwind v4
- Chrome Manifest V3 + Side Panel API
- IndexedDB via Dexie.js
- Vite 6 + CRXJS

## Development

```bash
npm install
npm run dev
```

Load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `dist` folder

## Build

```bash
npm run build
```

## Privacy

See [Privacy Policy](privacy-policy.md).

All data is stored locally. No accounts, no cloud sync, no tracking.
