# Offscreen Documents Expert Guide

Manifest V3 Background Service Workers do not have access to the DOM. If your extension needs DOM-dependent APIs (audio, canvas, parsing, etc.), use the **Offscreen Documents API**.

## 1. Prerequisites
- **Manifest Permission**: `"permissions": ["offscreen"]`.
- **Environment**: Available since Chrome 109.

## 2. Typical Use Cases
- Audio playback (`<audio>`, `<video>`).
- Clipboard management (`document.execCommand('copy')`).
- Complex DOM parsing (`DOMParser`).
- Accessing local storage or IndexedDB in a persistent context.
- High-precision timers.

## 3. Creating an Offscreen Document
From your `background.js` (Service Worker):

```javascript
async function createOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['CLIPBOARD', 'DOM_PARSER', 'AUDIO_PLAYBACK'],
    justification: 'Describe why you need this document to the user/reviewer'
  });
}
```

## 4. Message Communication
Background SW and Offscreen Documents communicate via `chrome.runtime.sendMessage`.

**offscreen.js**:
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PLAY_AUDIO') {
    const audio = new Audio(message.src);
    audio.play();
    sendResponse({ status: 'playing' });
  }
});
```

## 5. Lifecycle Management
- **Automatic Closure**: Offscreen documents may close automatically after inactivity.
- **Manual Closure**: Call `chrome.offscreen.closeDocument()` when finished.
- **Persistence**: Only one offscreen document can exist at a time per extension.

## 6. Official Reference
- **[Offscreen API Reference](https://developer.chrome.com/docs/extensions/reference/offscreen/)**
- **[Using Offscreen Documents](https://developer.chrome.com/docs/extensions/mv3/offscreen_documents/)**
