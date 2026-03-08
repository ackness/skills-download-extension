# Manifest V3 Configuration Reference (2026)

This document provides a detailed explanation of the most critical fields in `manifest.json` for modern Chrome extensions.

## 1. Core Fields
- **`manifest_version`**: MUST be `3`.
- **`name`**: Extension's user-facing name.
- **`version`**: Semantic versioning (e.g., `1.0.0`).

## 2. Background Service Worker
- **`service_worker`**: The main JS file for background logic.
- **`type`**: Set to `"module"` to use ES Module `import`/`export`.

```json
"background": {
  "service_worker": "background.js",
  "type": "module"
}
```

## 3. UI Components
- **`action`**: Unified UI for popup and toolbar icon.
- **`side_panel`**: Configures the persistent side panel sidebar.
- **`options_page`**: Path to the extension's settings page.

```json
"action": {
  "default_popup": "popup.html",
  "default_title": "My Extension"
},
"side_panel": {
  "default_path": "sidepanel.html"
}
```

## 4. Permissions & Host Access
MV3 distinguishes between **APIs** (`permissions`) and **Sites** (`host_permissions`).

- **`permissions`**: Non-site-specific API access (e.g., `storage`, `alarms`, `sidePanel`, `ai`).
- **`optional_permissions`**: APIs requested at runtime.
- **`host_permissions`**: Site patterns (e.g., `https://*.google.com/*`).
- **`optional_host_permissions`**: Site patterns requested at runtime (recommended for privacy).

```json
"permissions": ["storage", "sidePanel", "contextMenus", "ai"],
"host_permissions": ["https://api.myapp.com/*"],
"optional_host_permissions": ["https://*/*"]
```

## 5. Content Scripts
- **`matches`**: URL patterns where the script should run.
- **`js`**: List of scripts to inject.
- **`run_at`**: `document_start`, `document_end`, or `document_idle`.

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }
]
```

## 6. Resources & Security
- **`web_accessible_resources`**: Files that web pages can access (e.g., images, styles).
- **`content_security_policy`**: Strict by default in MV3.

```json
"web_accessible_resources": [
  {
    "resources": ["icon.png"],
    "matches": ["https://*.example.com/*"]
  }
]
```

## 7. Official Documentation
- **[Manifest File Format](https://developer.chrome.com/docs/extensions/mv3/manifest/)**
- **[Permission List](https://developer.chrome.com/docs/extensions/reference/permissions/)**
