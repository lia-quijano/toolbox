# Toolbox — Privacy Policy

*Last updated: April 2026*

## Summary

Toolbox stores all data locally in your browser. We do not collect, transmit, or sell any personal information.

## What data Toolbox accesses

When you save a tool, Toolbox reads the following from the current web page:

- **Page title** — to generate the tool name
- **Meta description and og:description** — to populate the description field
- **og:image** — to show a preview thumbnail
- **Page text** (first 3,000 characters) — to auto-detect the tool's category and pricing model

This data is read using Chrome's `scripting` API and is processed locally within your browser. Page metadata is not sent to external servers, except as noted under "External services" below.

## Where your data is stored

All saved tools, categories, tags, and notes are stored locally in your browser using IndexedDB. No data is synced to any cloud service. No account is required.

## External services

Toolbox makes requests to the following external services:

- **Google Favicons API** (`google.com/s2/favicons`) — to fetch website icons for display. Only the domain name is sent; no personal data.
- **Microlink API** (`api.microlink.io`) — to generate page screenshot previews when an og:image is not available. Only the page URL is sent; no personal data.

- **Page HTML fetch (fallback)** — if the scripting API and content script are unavailable, Toolbox may fetch the page's HTML directly to extract meta tags. This request goes to the page's own server, not to any third-party service. No data from the response is stored beyond the extracted meta description and og:image URL.

No analytics, tracking, or telemetry services are used.

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `tabs` | Read the URL and title of the active tab to auto-fill tool details |
| `storage` | Store saved tools locally in IndexedDB |
| `scripting` | Read meta tags (description, og:image) from web pages to auto-fill tool details |
| `sidePanel` | Display the Toolbox interface as a Chrome side panel |
| `host_permissions: <all_urls>` | Required to read meta tags from any website the user wants to save. Toolbox only reads data — it never modifies page content. |

## Data sharing

Toolbox does not share, sell, or transmit any user data to third parties. All data remains on your device.

## Data deletion

All data can be deleted by removing the extension from Chrome, which clears the local IndexedDB database. Individual tools can be deleted from within the extension.

## Contact

For questions about this privacy policy, contact us via the [GitHub Issues page](https://github.com/lia-quijano/toolbox/issues).
