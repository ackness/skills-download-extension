// --- IndexedDB Setup ---
const DB_NAME = "SkillsDB";
const DB_VERSION = 1;
const STORE_NAME = "skills";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("owner", "owner", { unique: false });
        store.createIndex("repo", "repo", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSkillsToDB(skillsData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    skillsData.forEach(skill => {
      store.put(skill);
    });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllSkillsFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearAllSkillsFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}


// --- Message Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_SKILLS") {
    // When called from popup, the tabId might not be in sender.tab if it's not a content script.
    // The popup will pass it, or we just rely on sender.tab.id if available.
    // Actually popup can pass tabId in the request.
    const tabId = request.tabId || (sender.tab ? sender.tab.id : undefined);
    handleFetchSkills(request.owner, request.repo, tabId).then(sendResponse);
    return true; 
  }
  
  if (request.type === "GET_HISTORY") {
    getAllSkillsFromDB().then(skills => sendResponse({ success: true, skills })).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === "GET_TREE_BY_SHA") {
    fetchTreeBySha(request.owner, request.repo, request.treeSha).then(sendResponse);
    return true;
  }
  
  if (request.type === "SAVE_SKILL_META") {
    // Save passively detected skill from content script
    saveSkillsToDB([request.skillData]).catch(e => console.error("Failed to passively save skill meta", e));
    // Provide a dummy response
    sendResponse({ success: true });
    return false;
  }
  
  if (request.type === "CLEAR_HISTORY") {
    clearAllSkillsFromDB().then(() => sendResponse({ success: true })).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});


// --- Auto-Detect Logic ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // GitHub uses soft navigation (Turbo/pjax), so we should check for URL changes
  // We can also trigger on status complete to catch initial page loads correctly
  if (changeInfo.url || changeInfo.status === "complete") {
    const currentUrl = changeInfo.url || tab.url;
    if (!currentUrl) return;

    const urlPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)/;
    const match = currentUrl.match(urlPattern);

    if (match) {
      const { autoDetect } = await chrome.storage.local.get("autoDetect");
      if (autoDetect) {
        const owner = match[1];
        const repo = match[2];
        const cleanRepo = repo.split('/')[0].split('?')[0].split('#')[0];
        
        // 1. Immediately show cached badge if exists
        const cacheKey = `repo_${owner}_${cleanRepo}`;
        const cacheData = await chrome.storage.local.get(cacheKey);
        if (cacheData[cacheKey] && cacheData[cacheKey].skills) {
           const count = cacheData[cacheKey].skills.length;
           if (count > 0) {
             const badgeText = count > 99 ? "99+" : count.toString();
             chrome.action.setBadgeText({ text: badgeText, tabId: tabId });
             chrome.action.setBadgeBackgroundColor({ color: "#0366d6", tabId: tabId });
           }
        } else {
           chrome.action.setBadgeText({ text: "", tabId: tabId });
        }

        // 2. Fetch latest to update cache and badge if needed
        console.log(`Auto-detecting skills for ${owner}/${cleanRepo}...`);
        handleFetchSkills(owner, cleanRepo, tabId);
      }
    } else {
      // Clear badge if not a repo
      chrome.action.setBadgeText({ text: "", tabId: tabId });
    }
  }
});

// --- Core API Logic ---
async function fetchTreeBySha(owner, repo, sha) {
  try {
    const { githubToken } = await chrome.storage.local.get("githubToken");
    const headers = { "Accept": "application/vnd.github.v3+json" };
    if (githubToken) headers["Authorization"] = `Bearer ${githubToken}`;

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error("Failed to fetch tree.");
    const treeData = await treeRes.json();
    
    return { success: true, tree: treeData.tree };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFetchSkills(owner, repo, tabId) {
  try {
    const { githubToken } = await chrome.storage.local.get("githubToken");
    const headers = {
      "Accept": "application/vnd.github.v3+json"
    };
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    // 1. Get default branch & metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) throw new Error("errorFetchRepo");
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;
    const repoUpdatedAt = repoData.pushed_at || repoData.updated_at || new Date().toISOString();

    // 2. Get tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error("errorFetchTree");
    const treeData = await treeRes.json();
    
    if (treeData.truncated) {
        console.warn("Tree is truncated, might miss some skills.");
    }

    // 3. Find skills
    const skillPaths = new Set();
    
    treeData.tree.forEach(item => {
      if (item.type === "blob" && item.path.endsWith("SKILL.md")) {
        const parts = item.path.split("/");
        parts.pop(); 
        const dir = parts.join("/");
        skillPaths.add(dir === "" ? "." : dir);
      }
    });

    const skillList = Array.from(skillPaths).map(dir => ({
      path: dir,
      name: dir === "." ? "Root" : dir.split("/").pop()
    }));

    // Set badge text for the tab if we have a tabId
    if (tabId) {
      if (skillList.length > 0) {
        const badgeText = skillList.length > 99 ? "99+" : skillList.length.toString();
        chrome.action.setBadgeText({ text: badgeText, tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#0366d6", tabId: tabId });
      } else {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
      }
    }

    // 4. Cache & IndexedDB logic
    const cacheKey = `repo_${owner}_${repo}`;
    const cacheData = await chrome.storage.local.get(cacheKey);
    const oldTreeSha = cacheData[cacheKey]?.treeSha;
    const isUpdated = oldTreeSha && oldTreeSha !== treeData.sha;

    await chrome.storage.local.set({
      [cacheKey]: {
        treeSha: treeData.sha,
        skills: skillList,
        defaultBranch: defaultBranch
      }
    });
    
    // Save to IndexedDB for History
    if (skillList.length > 0) {
      const dbSkills = skillList.map(skill => ({
        id: `${owner}/${repo}/${skill.path}`,
        owner: owner,
        repo: repo,
        name: skill.name,
        path: skill.path,
        defaultBranch: defaultBranch,
        treeSha: treeData.sha,
        lastDetected: new Date().getTime(),
        lastRepoUpdate: repoUpdatedAt
      }));
      await saveSkillsToDB(dbSkills);
    }

    return { success: true, skills: skillList, isUpdated, defaultBranch, tree: treeData.tree };

  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
}