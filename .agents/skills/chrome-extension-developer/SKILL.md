---
name: chrome-extension-developer
description: >
  Expert skill for developing, debugging, and optimizing modern Chrome extensions using Manifest V3 (MV3) and 2026 best practices. MAKE SURE TO USE THIS SKILL whenever the user mentions "Chrome extension", "browser plugin", "browser addon", "Manifest V3", "MV3", or wants to build a browser-based AI co-pilot, side panel, or background automation tool. Use this even if the user just casually mentions building an "extension" in the context of a web browser.
---

# Chrome Extension Developer (Manifest V3 Expert)

You are an expert at building modern Chrome extensions using Manifest V3 (MV3). This skill guides you through the architecture, constraints, and workflow for developing robust, secure, and performant extensions. 

When helping users build extensions, you should act as a senior engineer who not only writes the code but anticipates common MV3 pitfalls.

## Core Architectural Constraints (And Why They Matter)

Building for MV3 requires a specific mindset. Extensions are not normal web pages; they operate in a restricted, event-driven environment.

### 1. The Service Worker is Ephemeral (Event-Driven Persistence)
- **The Rule:** Your background script is a Service Worker. It is terminated automatically by the browser after 30 seconds of inactivity or 5 minutes of total runtime. 
- **The Implication:** You **cannot** store state in global variables. Any variable will be wiped when the worker sleeps.
- **The Solution (The Hydration Pattern):** You must shift to an "event-driven persistence" mindset. 
  - Use `chrome.storage.local` for persistent data.
  - Use `chrome.storage.session` (MV3 specific) for temporary session data (cleared when browser closes).
  - **Always hydrate state** from storage at the beginning of your event handlers (like `onMessage` or `onAlarm`) before executing logic.
  - **Never** use `setTimeout` or `setInterval`; they die when the worker sleeps. Use the `chrome.alarms` API instead.

### 2. No Remote Code (Strict CSP)
- **The Rule:** You cannot execute strings as code (`eval()`) and you cannot load scripts from external CDNs (e.g., `<script src="https://code.jquery.com/...">`).
- **The Why:** Security. Chrome requires that the code reviewed in the Web Store is the exact code that runs on the user's machine.
- **The Implication:** All libraries (React, Tailwind, utility scripts) must be downloaded and bundled locally within the extension package.

### 3. Network Request Interception
- **The Rule:** The old `chrome.webRequest` blocking API is deprecated for most use cases. You must use `chrome.declarativeNetRequest` (DNR).
- **The Why:** Privacy and performance. DNR allows Chrome to evaluate network rules at the browser level in C++ without spinning up your extension's JavaScript environment.
- **The Solution:** If the user wants to block or modify network requests, read `references/networking-dnr.md` to learn how to write JSON-based DNR rules.

## Common Pitfalls & Anti-Patterns (What NOT to do)

When building or migrating to MV3, strictly avoid these common mistakes (often carried over from MV2 habits):

- ❌ **DO NOT register listeners asynchronously:** Service workers MUST register event listeners (e.g., `chrome.runtime.onMessage.addListener`) synchronously at the top level of the script. Do not put them inside `async` functions or `chrome.storage.get` callbacks. If you do, the worker will wake up but fail to catch the event.
- ❌ **DO NOT use `window` or `document` in the Service Worker:** The background script has no DOM access. If you need to parse HTML, copy to clipboard, or play audio, you MUST use the Offscreen Documents API (`chrome.offscreen`).
- ❌ **DO NOT use `eval()` or load remote code:** Executing strings as code or fetching scripts from a CDN (e.g., `<script src="https://cdn...">`) will result in an immediate Web Store rejection due to the strict CSP.
- ❌ **DO NOT use `permissions` for URLs:** In MV3, URL patterns (like `https://*.github.com/*`) MUST be placed in the `host_permissions` array in `manifest.json`, not the general `permissions` array.

## Recommended UI Paradigms for 2026

When designing the interface, prefer modern extension surfaces depending on the user's goal:
- **Side Panel (`chrome.sidePanel`)**: The absolute best choice for AI co-pilots, chat interfaces, or anything requiring persistent interaction alongside the web page. It stays open as the user navigates.
- **Action (`chrome.action`)**: The classic popup. Good for quick toggles, settings, or small forms. Note that popups close as soon as they lose focus.
- **Offscreen Documents (`chrome.offscreen`)**: If you need access to the DOM (e.g., to parse HTML, copy to clipboard, or play audio) from the background, you **must** spin up an offscreen document. The Service Worker has no DOM access. Read `references/offscreen-document.md` if you need to do this.

## Tech Stack & Framework Selection

Chrome extensions are built with standard web technologies (HTML, CSS, JS/TS). However, the strict Content Security Policy (CSP) of MV3 heavily influences how you build:
- **Vanilla JS (Default & Preferred)**: For simple utilities, always default to Vanilla JavaScript using ES Modules (`import`/`export`). Do not introduce a bundler unless the UI complexity demands it. It keeps the extension lightweight and easier to debug.
- **Modern Frameworks (React, Vue, Svelte, Tailwind)**: If the extension requires complex, state-driven UI (like an interactive Side Panel), it's acceptable to use these frameworks. **HOWEVER**, because remote CDNs are forbidden, you **MUST** use a bundler (like **Vite** with plugins like `@crxjs/vite-plugin`) to compile all assets into static local files.
- **TypeScript**: Highly recommended to prevent `chrome.*` API typos. If using TS, make sure the user sets up `@types/chrome`.

## UI Design & State Management

When designing the UI (Frontend) and managing state (Backend/Service Worker), adhere to these principles:

### 1. Frontend: Styling & UI Components
- **Native Look & Feel**: Extensions should feel like a native part of the browser. Prefer system fonts (`font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **CSS Isolation (Crucial for Content Scripts)**: When injecting UI into a webpage via a Content Script, **always use a Shadow DOM**. This prevents the host page's CSS from breaking your extension's UI, and prevents your CSS from leaking into the host page.
- **Styling Frameworks**: For complex UIs (Side Panel, Options Page), using Tailwind CSS or component libraries (e.g., shadcn/ui) is highly recommended. For simple Content Scripts, Vanilla CSS is safer to avoid bundle bloat.
- **Theme Support**: Always support `prefers-color-scheme: dark` using CSS variables.

### 2. Backend: Service Worker as the "Server"
- Think of the Service Worker (`background.js`) as the "backend" of your extension. It should handle all external data fetching, authentication, 3rd-party API calls, and global state management (`chrome.storage`).
- The UI components (Popups, Side Panels) and Content Scripts act as "frontend" clients. They should remain as "dumb" as possible, focusing primarily on presentation and user interaction.
- **Message Passing**: The frontend and backend MUST communicate strictly via asynchronous message passing (`chrome.runtime.sendMessage` and `chrome.runtime.onMessage.addListener`). 

## Integrating Native AI (Chrome 130+)

Modern Chrome includes built-in local AI models.
- **When to use:** If the user wants to add AI features (summarization, translation, text generation) without requiring external API keys (like OpenAI) or backend servers.
- **How to use:** Read `references/ai-api-guide.md` for the exact APIs, such as `window.ai.createTextSession()`. Always remind the user to build fallbacks, as these APIs are experimental and might not be available on all devices.

## Your Workflow

When asked to build or modify an extension, follow this sequence:

### 1. Plan the Architecture (Think Aloud)
Before writing code, explicitly state your plan to the user:
- What UI surfaces will be used? (Popup, Side Panel, Content Script?)
- What permissions are needed in `manifest.json`? (Keep them minimal; use `optional_permissions` where possible).
- How will the different parts communicate? (e.g., Content Script sending messages to the Service Worker).

### 2. Scaffold the Extension
Always start with a modern, modular setup.
- Use `"type": "module"` in `manifest.json` for your background script so you can use modern ES `import`/`export` syntax.
- Read `references/manifest-reference.md` if you are unsure about the correct MV3 fields.

### 3. Implement with `async/await`
Almost all MV3 APIs return Promises. Do not use callbacks unless you are attaching event listeners.
```javascript
// DO THIS:
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

// NOT THIS:
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { ... });
```

## Available Reference Files

Do not guess syntax if you are unsure. Read the corresponding reference file before writing code:

- **`references/manifest-reference.md`**: Read this when setting up or modifying `manifest.json`.
- **`references/service-worker-template.js`**: Read this when writing background logic to ensure correct lifecycle handling.
- **`references/offscreen-document.md`**: Read this if you need to access the DOM from the background script.
- **`references/networking-dnr.md`**: Read this if you need to block or modify network requests.
- **`references/ai-api-guide.md`**: Read this if implementing Chrome's built-in local AI features.
- **`references/i18n-guide.md`**: Read this when adding multi-language (Internationalization/i18n) support to the extension.
