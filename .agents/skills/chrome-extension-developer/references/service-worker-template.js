/**
 * Modern Service Worker Template (Manifest V3 - 2026)
 * Features: ES Modules, Persistent State, Alarm-based Keep-alive, Event Handling.
 */

// 1. Initialize Extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason);
  
  // Set initial state
  await chrome.storage.local.set({ 
    installedAt: Date.now(),
    settings: { theme: 'system', aiEnabled: true }
  });

  // Setup periodic tasks using Alarms (MV3 best practice)
  chrome.alarms.create('check-updates', { periodInMinutes: 60 });
});

// 2. Handle Message Passing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

  if (message.type === 'GET_DATA') {
    handleGetData(sendResponse);
    return true; // Keep channel open for async response
  }
});

// 3. Persistent State Management
async function handleGetData(sendResponse) {
  const data = await chrome.storage.local.get('installedAt');
  sendResponse({ status: 'success', data });
}

// 4. AI API Integration (Chrome 130+)
export async function summarizeText(text) {
  if (typeof window.ai !== 'undefined' && window.ai.summarizer) {
    const summarizer = await window.ai.summarizer.create();
    return await summarizer.summarize(text);
  }
  return 'AI Summarizer not available.';
}

// 5. Service Worker Keep-alive (if needed for long-running tasks)
// Note: Service workers are ephemeral. Use storage to bridge gaps.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-updates') {
    console.log('Performing periodic check...');
  }
});
