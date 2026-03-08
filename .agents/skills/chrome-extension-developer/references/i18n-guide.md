# Chrome Extension i18n (Internationalization) Best Practices

Internationalizing (i18n) a Manifest V3 extension allows it to support multiple languages. This guide covers the correct approach to structuring and implementing i18n.

## 1. Directory Structure
The i18n system relies on a specific directory structure. You must place your translations in a `_locales` directory at the root of your extension.

```
/
├── manifest.json
├── _locales/
│   ├── en/
│   │   └── messages.json
│   ├── zh_CN/
│   │   └── messages.json
│   └── es/
│       └── messages.json
```

## 2. Configuration (`manifest.json`)
You must define the `default_locale` in your `manifest.json`. If a string isn't translated in the user's current locale, Chrome will fall back to the default locale.

```json
{
  "manifest_version": 3,
  "name": "__MSG_extensionName__",
  "description": "__MSG_extensionDescription__",
  "default_locale": "en",
  "action": {
    "default_title": "__MSG_actionTitle__"
  }
}
```
*Note: You can use `__MSG_messageName__` directly within the `manifest.json` and CSS files.*

## 3. Translation Files (`messages.json`)
Each `messages.json` file contains key-value pairs of the translations.

```json
// _locales/en/messages.json
{
  "extensionName": {
    "message": "My Awesome Extension",
    "description": "The name of the extension"
  },
  "greeting": {
    "message": "Hello, $USER$!",
    "description": "A greeting message",
    "placeholders": {
      "user": {
        "content": "$1",
        "example": "John"
      }
    }
  }
}
```

## 4. Usage in JavaScript
Use the `chrome.i18n.getMessage` API to retrieve translated strings in Service Workers, Content Scripts, or Popup/Options scripts.

```javascript
// Simple message
const title = chrome.i18n.getMessage("extensionName");

// Message with placeholders
const greeting = chrome.i18n.getMessage("greeting", ["Alice"]);
```

## 5. Usage in HTML (The Safe Way)
Since MV3 enforces a strict Content Security Policy, you should **avoid** injecting raw HTML translations (e.g., using `innerHTML`).
Instead, use a `data-i18n` attribute in your HTML and a JavaScript utility to populate the `textContent` safely.

**HTML:**
```html
<h1 data-i18n="popupTitle">Fallback Title</h1>
<button data-i18n="saveButton">Save</button>
```

**JavaScript (Utility function in your popup.js/options.js):**
```javascript
function localizeHtmlPage() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageName = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(messageName);
    if (message) {
      // Use textContent to avoid XSS
      element.textContent = message; 
    }
  });
}

// Call it when the DOM is ready
document.addEventListener('DOMContentLoaded', localizeHtmlPage);
```

## 6. CSS Localization
You can also use the `__MSG_messageName__` syntax directly within CSS files if needed (e.g., for locale-specific images or content values).

```css
body::before {
  content: "__MSG_greeting__";
}
```

## 7. Official Documentation
- **[chrome.i18n API Reference](https://developer.chrome.com/docs/extensions/reference/i18n/)**