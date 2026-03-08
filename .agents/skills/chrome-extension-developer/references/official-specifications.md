# Chrome Extension Official Specifications (2026)

This document summarizes the official development, security, and privacy specifications required by Google for modern Chrome extensions.

## 1. Architectural Specifications (Manifest V3)
All extensions must use Manifest V3. The key architectural mandates are:
- **Event-Driven Service Workers**: Replace persistent background pages. SWs must be designed to terminate and restart. Global variables are NOT persistent.
- **Declarative Net Request**: Use `chrome.declarativeNetRequest` for network modification. The blocking `webRequest` is strictly limited or deprecated.
- **Promise-based APIs**: Modern `chrome.*` APIs return Promises. Callback patterns are legacy.

## 2. Security Specifications
Security is audited during the Web Store review process.
- **No Remote Code Execution**: All JavaScript, WebAssembly, and CSS MUST be bundled with the extension. No `eval()`, `new Function()`, or loading from CDNs.
- **Strict Content Security Policy (CSP)**:
    - No inline scripts.
    - No `unsafe-eval`.
    - Content scripts run in an "isolated world" to prevent page interference.
- **HTTPS Only**: All external network requests must use HTTPS.

## 3. Privacy & User Data Policy
Compliance with the [User Data Policy](https://developer.chrome.com/docs/webstore/user-data-policy/) is mandatory.
- **Principle of Least Privilege**: Request the absolute minimum permissions. "Broad" permissions (e.g., `*://*/*`) require strong justification.
- **Purpose Limitation**: Data collected must be used strictly for the extension's stated functionality.
- **Clear Disclosure**: Personal or sensitive data handling must be declared in the Developer Dashboard and a privacy policy.
- **Encryption**: Sensitive user data stored locally (via `chrome.storage`) should be treated as potentially accessible; sensitive keys should never be hardcoded.

## 4. Design & UX Guidelines
- **Native-Like Integration**: Use the **Side Panel API** or **Action Popups**. Avoid "clunky" DOM injections that might break the host website's layout.
- **Accessibility (a11y)**: Follow WCAG standards for UI components.
- **Responsive Design**: Popups and Side Panels should be usable at various browser window sizes.

## 5. Chrome Web Store Listing Policy
- **One Core Function**: Extensions must have a single, clear purpose. "Multi-tool" extensions with unrelated features are often rejected.
- **Accurate Metadata**: Icons, screenshots, and descriptions must accurately represent the extension's current functionality.
- **Regular Updates**: Extensions that remain unmaintained for extended periods may be flagged or removed.

## 🔗 Official Policy Links
- **[Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)**
- **[Review Process Overview](https://developer.chrome.com/docs/webstore/review-process/)**
- **[Developer Terms of Service](https://developer.chrome.com/docs/webstore/terms/)**
