# Chrome Built-in AI API Guide (2026)

Chrome 130+ introduced native, privacy-first AI capabilities that run locally on the user's device. This guide covers how to use them in Manifest V3 extensions.

## 1. Prerequisites
- **Chrome Version**: 130 or later.
- **Manifest Permission**: `"permissions": ["ai"]`.
- **Environment**: Available in Service Workers, Popups, Options, and Side Panels.

## 2. Text Generation (Prompt API)
Used for direct LLM interaction.

```javascript
async function askLocalAI(prompt) {
  if (!window.ai || !window.ai.createTextSession) {
    throw new Error('Local AI not supported');
  }
  
  const session = await window.ai.createTextSession();
  const result = await session.prompt(prompt);
  session.destroy(); // Always cleanup sessions
  return result;
}
```

## 3. Summarization API
Highly optimized for condensing long text or web pages.

```javascript
async function getSummary(content) {
  const options = {
    type: 'key-points',
    format: 'markdown',
    length: 'short'
  };
  
  const summarizer = await window.ai.summarizer.create(options);
  const summary = await summarizer.summarize(content);
  return summary;
}
```

## 4. Side Panel Integration
The Side Panel is the ideal UI for AI-powered "co-pilots".

```javascript
// background.js - Trigger Side Panel on Action click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: 'sidepanel.html',
    enabled: true
  });
  chrome.sidePanel.open({ tabId: tab.id });
});
```

## 5. Security & Privacy
- **Local Inference**: Data never leaves the browser.
- **Quota Management**: Chrome manages memory; large models may be offloaded if the system is low on RAM.
- **Fallbacks**: Always provide an alternative (e.g., external API) if local AI is unavailable or the hardware doesn't support it.
