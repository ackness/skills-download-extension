# Declarative Net Request (DNR) Expert Guide

Manifest V3 replaces blocking `webRequest` with `declarativeNetRequest`. Instead of intercepting requests in JS, you declare **rules** that Chrome evaluates on your behalf.

## 1. Static vs. Dynamic Rules
- **Static Rules**: Defined in JSON files, bundled with the extension. Up to **30,000** per extension.
- **Dynamic Rules**: Added at runtime via `chrome.declarativeNetRequest.updateDynamicRules`.

## 2. Rule Structure
A rule consists of an `id`, `priority`, `action`, and `condition`.

```json
{
  "id": 1,
  "priority": 1,
  "action": { "type": "block" },
  "condition": {
    "urlFilter": "*://ads.com/*",
    "resourceTypes": ["main_frame", "sub_frame", "script"]
  }
}
```

## 3. Implementation in `manifest.json`
To use static rules, you must declare the `declarativeNetRequest` permission and point to your JSON ruleset.

```json
{
  "permissions": ["declarativeNetRequest", "declarativeNetRequestFeedback"],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "ruleset_1",
      "enabled": true,
      "path": "rules.json"
    }]
  }
}
```

## 4. Modifying Request Headers
A common use case for MV3 extensions is modifying headers for authentication or privacy.

```json
{
  "id": 10,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "requestHeaders": [
      { "header": "X-Custom-Auth", "operation": "set", "value": "TOKEN" },
      { "header": "User-Agent", "operation": "remove" }
    ]
  },
  "condition": { "urlFilter": "api.example.com", "resourceTypes": ["xmlhttprequest"] }
}
```

## 5. Debugging DNR
- Use the **`declarativeNetRequestFeedback`** permission to see which rules matched.
- Chrome's "NetLog" (`chrome://net-export/`) is the ultimate tool for low-level network debugging.
- Host permissions are **NOT** required for static blocking rules, but **ARE** required for `modifyHeaders` or redirecting requests.

## 6. Official Reference
- **[DNR API Reference](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/)**
- **[DNR Concepts & Limits](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/#network-request-modification)**
