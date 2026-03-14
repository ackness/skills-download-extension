const DB_NAME = "SkillsDB";
const DB_VERSION = 2;
const SKILLS_STORE_NAME = "skills";
const COLLECTIONS_STORE_NAME = "collections";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(SKILLS_STORE_NAME)) {
        const skillsStore = db.createObjectStore(SKILLS_STORE_NAME, { keyPath: "id" });
        skillsStore.createIndex("owner", "owner", { unique: false });
        skillsStore.createIndex("repo", "repo", { unique: false });
        skillsStore.createIndex("name", "name", { unique: false });
      }

      if (!db.objectStoreNames.contains(COLLECTIONS_STORE_NAME)) {
        const collectionsStore = db.createObjectStore(COLLECTIONS_STORE_NAME, { keyPath: "id" });
        collectionsStore.createIndex("name", "name", { unique: false });
        collectionsStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function normalizeSkillRecord(skill) {
  const path = skill.path || ".";
  const now = Date.now();

  return {
    id: skill.id || `${skill.owner}/${skill.repo}/${path}`,
    owner: skill.owner,
    repo: skill.repo,
    name: skill.name || (path === "." ? "Root" : path.split("/").pop()),
    path,
    defaultBranch: skill.defaultBranch || "",
    treeSha: skill.treeSha || "",
    description: skill.description || "",
    lastDetected: skill.lastDetected || now,
    lastRepoUpdate: skill.lastRepoUpdate || skill.lastDetected || now,
  };
}

function normalizeCollectionItem(skill) {
  const normalized = normalizeSkillRecord(skill);
  return {
    id: normalized.id,
    owner: normalized.owner,
    repo: normalized.repo,
    name: normalized.name,
    path: normalized.path,
    defaultBranch: normalized.defaultBranch,
    treeSha: normalized.treeSha,
    description: normalized.description,
    lastDetected: normalized.lastDetected,
    lastRepoUpdate: normalized.lastRepoUpdate,
    addedAt: skill.addedAt || Date.now(),
  };
}

function createCollectionRecord(name) {
  const now = Date.now();
  const id = self.crypto?.randomUUID?.() || `collection_${now}_${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

function sortCollections(collections) {
  return [...collections].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function saveSkillsToDB(skillsData) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SKILLS_STORE_NAME, "readwrite");
    const store = tx.objectStore(SKILLS_STORE_NAME);
    let failed = false;

    const fail = (error) => {
      if (failed) {
        return;
      }
      failed = true;
      reject(error);
      try {
        tx.abort();
      } catch (abortError) {
        console.warn("Failed to abort skills transaction", abortError);
      }
    };

    skillsData.forEach((rawSkill) => {
      const skill = normalizeSkillRecord(rawSkill);
      const getRequest = store.get(skill.id);

      getRequest.onerror = () => fail(getRequest.error || new Error("Failed to read skill record."));
      getRequest.onsuccess = () => {
        const existing = getRequest.result || {};
        store.put({ ...existing, ...skill });
      };
    });

    tx.oncomplete = () => {
      if (!failed) {
        resolve();
      }
    };
    tx.onerror = () => fail(tx.error || new Error("Failed to save skills."));
    tx.onabort = () => fail(tx.error || new Error("Skills transaction was aborted."));
  });
}

async function getAllSkillsFromDB() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SKILLS_STORE_NAME, "readonly");
    const store = tx.objectStore(SKILLS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearAllSkillsFromDB() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SKILLS_STORE_NAME, "readwrite");
    const store = tx.objectStore(SKILLS_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllCollectionsFromDB() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COLLECTIONS_STORE_NAME, "readonly");
    const store = tx.objectStore(COLLECTIONS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(sortCollections(request.result));
    request.onerror = () => reject(request.error);
  });
}

async function getCollectionById(collectionId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COLLECTIONS_STORE_NAME, "readonly");
    const store = tx.objectStore(COLLECTIONS_STORE_NAME);
    const request = store.get(collectionId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function putCollectionToDB(collection) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COLLECTIONS_STORE_NAME, "readwrite");
    const store = tx.objectStore(COLLECTIONS_STORE_NAME);
    const request = store.put(collection);

    request.onsuccess = () => resolve(collection);
    request.onerror = () => reject(request.error);
  });
}

async function deleteCollectionFromDB(collectionId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COLLECTIONS_STORE_NAME, "readwrite");
    const store = tx.objectStore(COLLECTIONS_STORE_NAME);
    const request = store.delete(collectionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function assertUniqueCollectionName(name, excludedId = null) {
  const lowered = name.toLowerCase();
  const collections = await getAllCollectionsFromDB();
  const exists = collections.some((collection) => collection.id !== excludedId && collection.name.trim().toLowerCase() === lowered);

  if (exists) {
    throw new Error("collectionAlreadyExists");
  }
}

async function createCollection(name) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new Error("collectionNameRequired");
  }

  await assertUniqueCollectionName(trimmedName);
  const collection = createCollectionRecord(trimmedName);
  await putCollectionToDB(collection);
  return collection;
}

async function renameCollection(collectionId, name) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new Error("collectionNameRequired");
  }

  const collection = await getCollectionById(collectionId);
  if (!collection) {
    throw new Error("collectionNotFound");
  }

  await assertUniqueCollectionName(trimmedName, collectionId);
  const updatedCollection = {
    ...collection,
    name: trimmedName,
    updatedAt: Date.now(),
  };

  await putCollectionToDB(updatedCollection);
  return updatedCollection;
}

async function deleteCollection(collectionId) {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    throw new Error("collectionNotFound");
  }

  await deleteCollectionFromDB(collectionId);
}

async function addSkillToCollection(collectionId, rawSkill) {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    throw new Error("collectionNotFound");
  }

  const skill = normalizeCollectionItem(rawSkill);
  await saveSkillsToDB([skill]);

  const existingItem = collection.items.find((item) => item.id === skill.id);
  const items = existingItem
    ? collection.items.map((item) => (item.id === skill.id ? { ...item, ...skill, addedAt: item.addedAt || skill.addedAt } : item))
    : [...collection.items, skill];

  const updatedCollection = {
    ...collection,
    items,
    updatedAt: Date.now(),
  };

  await putCollectionToDB(updatedCollection);
  return updatedCollection;
}

async function removeSkillFromCollection(collectionId, skillId) {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    throw new Error("collectionNotFound");
  }

  const updatedCollection = {
    ...collection,
    items: collection.items.filter((item) => item.id !== skillId),
    updatedAt: Date.now(),
  };

  await putCollectionToDB(updatedCollection);
  return updatedCollection;
}

function respondWith(promise, sendResponse) {
  promise
    .then((data) => sendResponse({ success: true, ...data }))
    .catch((error) => {
      console.error(error);
      sendResponse({ success: false, error: error.message || String(error) });
    });
  return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "FETCH_SKILLS": {
      const tabId = request.tabId || (sender.tab ? sender.tab.id : undefined);
      return respondWith(handleFetchSkills(request.owner, request.repo, tabId), sendResponse);
    }

    case "GET_HISTORY":
      return respondWith(getAllSkillsFromDB().then((skills) => ({ skills })), sendResponse);

    case "GET_TREE_BY_SHA":
      return respondWith(fetchTreeBySha(request.owner, request.repo, request.treeSha), sendResponse);

    case "SAVE_SKILL_META":
      saveSkillsToDB([request.skillData]).catch((error) => {
        console.error("Failed to passively save skill meta", error);
      });
      sendResponse({ success: true });
      return false;

    case "CLEAR_HISTORY":
      return respondWith(clearAllSkillsFromDB().then(() => ({})), sendResponse);

    case "GET_COLLECTIONS":
      return respondWith(getAllCollectionsFromDB().then((collections) => ({ collections })), sendResponse);

    case "CREATE_COLLECTION":
      return respondWith(createCollection(request.name).then((collection) => ({ collection })), sendResponse);

    case "RENAME_COLLECTION":
      return respondWith(renameCollection(request.collectionId, request.name).then((collection) => ({ collection })), sendResponse);

    case "DELETE_COLLECTION":
      return respondWith(deleteCollection(request.collectionId).then(() => ({})), sendResponse);

    case "ADD_SKILL_TO_COLLECTION":
      return respondWith(
        addSkillToCollection(request.collectionId, request.skill).then((collection) => ({ collection })),
        sendResponse
      );

    case "REMOVE_SKILL_FROM_COLLECTION":
      return respondWith(
        removeSkillFromCollection(request.collectionId, request.skillId).then((collection) => ({ collection })),
        sendResponse
      );

    default:
      return false;
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") {
    return;
  }

  const currentUrl = changeInfo.url || tab.url;
  if (!currentUrl) {
    return;
  }

  const urlPattern = /^https:\/\/github\.com\/([^/]+)\/([^/]+)/;
  const match = currentUrl.match(urlPattern);

  if (!match) {
    chrome.action.setBadgeText({ text: "", tabId });
    return;
  }

  const { autoDetect } = await chrome.storage.local.get("autoDetect");
  if (!autoDetect) {
    return;
  }

  const owner = match[1];
  const repo = match[2].split("/")[0].split("?")[0].split("#")[0];
  const cacheKey = `repo_${owner}_${repo}`;
  const cacheData = await chrome.storage.local.get(cacheKey);

  if (cacheData[cacheKey]?.skills?.length) {
    const count = cacheData[cacheKey].skills.length;
    chrome.action.setBadgeText({ text: count > 99 ? "99+" : String(count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#0366d6", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }

  console.log(`Auto-detecting skills for ${owner}/${repo}...`);
  handleFetchSkills(owner, repo, tabId).catch((error) => {
    console.error(`Auto-detect failed for ${owner}/${repo}`, error);
  });
});

async function fetchTreeBySha(owner, repo, treeSha) {
  const { githubToken } = await chrome.storage.local.get("githubToken");
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, { headers });
  if (!treeRes.ok) {
    throw new Error("errorFetchTree");
  }

  const treeData = await treeRes.json();
  return { tree: treeData.tree };
}

async function handleFetchSkills(owner, repo, tabId) {
  const { githubToken } = await chrome.storage.local.get("githubToken");
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    throw new Error("errorFetchRepo");
  }

  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch;
  const repoUpdatedAt = repoData.pushed_at || repoData.updated_at || new Date().toISOString();

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
  if (!treeRes.ok) {
    throw new Error("errorFetchTree");
  }

  const treeData = await treeRes.json();
  if (treeData.truncated) {
    console.warn("Tree is truncated, some skills may be missing.");
  }

  const skillPaths = new Set();
  treeData.tree.forEach((item) => {
    if (item.type === "blob" && item.path.endsWith("SKILL.md")) {
      const parts = item.path.split("/");
      parts.pop();
      const dir = parts.join("/");
      skillPaths.add(dir === "" ? "." : dir);
    }
  });

  const skillList = Array.from(skillPaths)
    .sort((a, b) => a.localeCompare(b))
    .map((dir) => ({
      id: `${owner}/${repo}/${dir}`,
      owner,
      repo,
      path: dir,
      name: dir === "." ? "Root" : dir.split("/").pop(),
      defaultBranch,
      treeSha: treeData.sha,
      lastDetected: Date.now(),
      lastRepoUpdate: new Date(repoUpdatedAt).getTime(),
    }));

  if (tabId) {
    if (skillList.length > 0) {
      chrome.action.setBadgeText({ text: skillList.length > 99 ? "99+" : String(skillList.length), tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#0366d6", tabId });
    } else {
      chrome.action.setBadgeText({ text: "", tabId });
    }
  }

  const cacheKey = `repo_${owner}_${repo}`;
  const cacheData = await chrome.storage.local.get(cacheKey);
  const oldTreeSha = cacheData[cacheKey]?.treeSha;
  const isUpdated = Boolean(oldTreeSha && oldTreeSha !== treeData.sha);

  await chrome.storage.local.set({
    [cacheKey]: {
      treeSha: treeData.sha,
      skills: skillList,
      defaultBranch,
    },
  });

  if (skillList.length > 0) {
    const dbSkills = skillList.map((skill) => ({
      ...skill,
      lastRepoUpdate: new Date(repoUpdatedAt).getTime(),
    }));
    await saveSkillsToDB(dbSkills);
  }

  return {
    skills: skillList,
    isUpdated,
    defaultBranch,
    treeSha: treeData.sha,
    tree: treeData.tree,
  };
}
