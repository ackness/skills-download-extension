let currentOwner = "";
let currentRepo = "";
let currentTree = [];
let defaultBranch = "";
let historyData = [];
let customMessages = null;

async function initI18n() {
  const { langOverride } = await chrome.storage.local.get("langOverride");
  if (langOverride && langOverride !== "system") {
    try {
      const url = chrome.runtime.getURL(`_locales/${langOverride}/messages.json`);
      const res = await fetch(url);
      customMessages = await res.json();
    } catch (e) {
      console.error("Failed to load custom locale", e);
      customMessages = null;
    }
  } else {
    customMessages = null;
  }
}

function getI18nMsg(key) {
  if (customMessages && customMessages[key] && customMessages[key].message) {
    return customMessages[key].message;
  }
  return chrome.i18n.getMessage(key);
}

function localizeHtmlPage() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageName = element.getAttribute('data-i18n');
    const message = getI18nMsg(messageName);
    if (message) element.textContent = message;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const messageName = element.getAttribute('data-i18n-title');
    const message = getI18nMsg(messageName);
    if (message) element.title = message;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const messageName = element.getAttribute('data-i18n-placeholder');
    const message = getI18nMsg(messageName);
    if (message) element.placeholder = message;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await initI18n();
  localizeHtmlPage();

  const settingsBtn = document.getElementById("settingsBtn");
  const tabCurrent = document.getElementById("tabCurrent");
  const tabHistory = document.getElementById("tabHistory");
  const backBtn = document.getElementById("backBtn");
  const saveTokenBtn = document.getElementById("saveTokenBtn");
  
  const mainView = document.getElementById("mainView");
  const settingsView = document.getElementById("settingsView");
  const historyView = document.getElementById("historyView");
  
  const tokenInput = document.getElementById("tokenInput");
  const autoDetectCheck = document.getElementById("autoDetectCheck");
  const langSelect = document.getElementById("langSelect");
  const statusDiv = document.getElementById("status");
  const skillsList = document.getElementById("skillsList");
  const historyList = document.getElementById("historyList");
  const searchInput = document.getElementById("searchInput");
  const tokenWarning = document.getElementById("tokenWarning");
  const linkToSettings = document.getElementById("linkToSettings");

  // Load settings
  const { githubToken, autoDetect, langOverride } = await chrome.storage.local.get(["githubToken", "autoDetect", "langOverride"]);
  if (githubToken) {
    tokenInput.value = githubToken;
    tokenWarning.style.display = "none";
  } else {
    tokenWarning.style.display = "block";
  }
  
  if (autoDetect) autoDetectCheck.checked = true;
  if (langOverride) langSelect.value = langOverride;

  // View navigation
  function showView(view) {
    mainView.style.display = "none";
    settingsView.style.display = "none";
    historyView.style.display = "none";
    view.style.display = "block";
    
    // Manage tab styles
    if (view === mainView) {
      tabCurrent.classList.add("active");
      tabHistory.classList.remove("active");
    } else if (view === historyView) {
      tabHistory.classList.add("active");
      tabCurrent.classList.remove("active");
    } else {
      tabCurrent.classList.remove("active");
      tabHistory.classList.remove("active");
    }
  }

  settingsBtn.addEventListener("click", () => showView(settingsView));
  linkToSettings.addEventListener("click", (e) => {
    e.preventDefault();
    showView(settingsView);
  });
  
  tabCurrent.addEventListener("click", () => {
    if (mainView.style.display !== "block") {
      showView(mainView);
      loadSkills();
    }
  });

  tabHistory.addEventListener("click", () => {
    if (historyView.style.display !== "block") {
      showView(historyView);
      loadHistory();
    }
  });
  
  backBtn.addEventListener("click", () => showView(mainView));

  saveTokenBtn.addEventListener("click", async () => {
    const newLang = langSelect.value;
    await chrome.storage.local.set({ 
      githubToken: tokenInput.value,
      autoDetect: autoDetectCheck.checked,
      langOverride: newLang
    });
    
    // Reload UI strings if language changed
    await initI18n();
    localizeHtmlPage();

    alert(getI18nMsg("settingsSaved"));
    showView(mainView);
    loadSkills(); // reload with new token
  });

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    renderHistory(historyData.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.repo.toLowerCase().includes(term) ||
      s.owner.toLowerCase().includes(term)
    ));
  });

  // Main flow
  loadSkills();

  async function loadSkills() {
    showView(mainView);
    statusDiv.style.display = "block";
    statusDiv.textContent = chrome.i18n.getMessage("detectingRepo");
    skillsList.innerHTML = "";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      statusDiv.textContent = chrome.i18n.getMessage("cannotReadUrl");
      return;
    }

    const urlPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)/;
    const match = tab.url.match(urlPattern);

    if (!match) {
      statusDiv.textContent = chrome.i18n.getMessage("notGithubRepo");
      return;
    }

    currentOwner = match[1];
    currentRepo = match[2].split('/')[0].split('?')[0].split('#')[0]; // Clean repo name

    statusDiv.textContent = chrome.i18n.getMessage("fetchingTree");

    chrome.runtime.sendMessage({
      type: "FETCH_SKILLS",
      owner: currentOwner,
      repo: currentRepo,
      tabId: tab.id
    }, (response) => {
      if (!response) {
        statusDiv.textContent = chrome.i18n.getMessage("errorCommBg");
        return;
      }
      if (!response.success) {
        // Try to translate the error if it matches a key, otherwise show raw error.
        const translatedError = getI18nMsg(response.error);
        statusDiv.textContent = getI18nMsg("errorPrefix") + (translatedError || response.error);
        return;
      }

      const { skills, isUpdated, tree, defaultBranch: db } = response;
      currentTree = tree;
      defaultBranch = db;

      if (skills.length === 0) {
        statusDiv.textContent = chrome.i18n.getMessage("noSkillsFound");
        return;
      }

      statusDiv.style.display = "none";
      skillsList.innerHTML = "";

      skills.forEach(skill => {
        const li = document.createElement("li");
        
        const infoDiv = document.createElement("div");
        infoDiv.className = "skill-info";
        
        const nameDiv = document.createElement("div");
        nameDiv.className = "skill-name";
        nameDiv.textContent = skill.name;
        
        if (isUpdated) {
          const badge = document.createElement("span");
          badge.className = "updated-badge";
          badge.textContent = chrome.i18n.getMessage("updatedBadge");
          nameDiv.appendChild(badge);
        }

        const pathDiv = document.createElement("div");
        pathDiv.className = "skill-path";
        pathDiv.textContent = skill.path;

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(pathDiv);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "skill-actions";

        const infoBtn = document.createElement("button");
        infoBtn.className = "icon-btn";
        infoBtn.innerHTML = "ℹ️";
        infoBtn.title = chrome.i18n.getMessage("infoBtn") || "View Details";
        
        const copyBtn = document.createElement("button");
        copyBtn.className = "icon-btn";
        copyBtn.innerHTML = "📋"; // Copy icon
        copyBtn.title = getI18nMsg("copyCommandBtn");
        copyBtn.addEventListener("click", () => copyCommand(currentOwner, currentRepo, skill.path, copyBtn));

        const dlBtn = document.createElement("button");
        dlBtn.className = "icon-btn primary";
        dlBtn.innerHTML = "📦"; // Zip icon
        dlBtn.title = getI18nMsg("downloadBtn");
        dlBtn.addEventListener("click", () => downloadSkill(skill.path, li));

        actionsDiv.appendChild(infoBtn);
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(dlBtn);

        const mainDiv = document.createElement("div");
        mainDiv.className = "skill-main";
        mainDiv.appendChild(infoDiv);
        mainDiv.appendChild(actionsDiv);

        const detailsDiv = document.createElement("div");
        detailsDiv.className = "skill-details";
        
        infoBtn.addEventListener("click", () => {
          if (detailsDiv.classList.contains("open")) {
            detailsDiv.classList.remove("open");
          } else {
            detailsDiv.classList.add("open");
            loadSkillMeta(currentOwner, currentRepo, defaultBranch, skill.path, detailsDiv);
          }
        });

        li.appendChild(mainDiv);
        li.appendChild(detailsDiv);
        skillsList.appendChild(li);
      });
    });
  }

  function loadHistory() {
    historyList.innerHTML = `<li>${getI18nMsg("loadingHistory")}</li>`;
    chrome.runtime.sendMessage({ type: "GET_HISTORY" }, (response) => {
      if (response && response.success) {
        historyData = response.skills;
        // Sort by lastDetected descending
        historyData.sort((a, b) => b.lastDetected - a.lastDetected);
        renderHistory(historyData);
      } else {
        historyList.innerHTML = `<li>${getI18nMsg("errorLoadingHistory")}</li>`;
      }
    });
  }

  function renderHistory(skills) {
    historyList.innerHTML = "";
    if (skills.length === 0) {
      historyList.innerHTML = `<li>${getI18nMsg("noSkillsInHistory")}</li>`;
      return;
    }

    skills.forEach(skill => {
      const li = document.createElement("li");
      
      const infoDiv = document.createElement("div");
      infoDiv.className = "skill-info";
      
      const nameDiv = document.createElement("div");
      nameDiv.className = "skill-name";
      nameDiv.textContent = skill.name;

      const repoDiv = document.createElement("div");
      repoDiv.className = "skill-repo";
      repoDiv.textContent = `${skill.owner}/${skill.repo}`;
      
      const pathDiv = document.createElement("div");
      pathDiv.className = "skill-path";
      pathDiv.textContent = skill.path;

      const metaDiv = document.createElement("div");
      metaDiv.className = "skill-meta";
      const date = new Date(skill.lastRepoUpdate || skill.lastDetected).toLocaleDateString();
      metaDiv.textContent = `${getI18nMsg("updatedPrefix")}${date}`;

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(repoDiv);
      infoDiv.appendChild(pathDiv);
      infoDiv.appendChild(metaDiv);

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "skill-actions";

      const infoBtn = document.createElement("button");
      infoBtn.className = "icon-btn";
      infoBtn.innerHTML = "ℹ️";
      infoBtn.title = chrome.i18n.getMessage("infoBtn") || "View Details";

      const copyBtn = document.createElement("button");
      copyBtn.className = "icon-btn";
      copyBtn.innerHTML = "📋";
      copyBtn.title = getI18nMsg("copyCommandBtn");
      copyBtn.addEventListener("click", () => copyCommand(skill.owner, skill.repo, skill.path, copyBtn));

      const dlBtn = document.createElement("button");
      dlBtn.className = "icon-btn primary";
      dlBtn.innerHTML = "📦";
      dlBtn.title = getI18nMsg("downloadBtn");
      dlBtn.addEventListener("click", () => downloadFromHistory(skill, li));

      actionsDiv.appendChild(infoBtn);
      actionsDiv.appendChild(copyBtn);
      actionsDiv.appendChild(dlBtn);

      const mainDiv = document.createElement("div");
      mainDiv.className = "skill-main";
      mainDiv.appendChild(infoDiv);
      mainDiv.appendChild(actionsDiv);

      const detailsDiv = document.createElement("div");
      detailsDiv.className = "skill-details";

      infoBtn.addEventListener("click", () => {
        if (detailsDiv.classList.contains("open")) {
          detailsDiv.classList.remove("open");
        } else {
          detailsDiv.classList.add("open");
          loadSkillMeta(skill.owner, skill.repo, skill.defaultBranch, skill.path, detailsDiv);
        }
      });

      li.appendChild(mainDiv);
      li.appendChild(detailsDiv);
      historyList.appendChild(li);
      });
      }
      });

      async function loadSkillMeta(owner, repo, branch, skillPath, container) {
        if (container.dataset.loaded) return;
        
        container.innerHTML = `<em>${getI18nMsg("loadingDetails")}</em>`;
        const path = skillPath === "." ? "SKILL.md" : `${skillPath}/SKILL.md`;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

        try {
          const res = await fetch(rawUrl);
          if (!res.ok) throw new Error("Failed to fetch");
          const text = await res.text();
          
          let name = "";
          let description = getI18nMsg("noDescription");
          
          // Simple frontmatter regex parser
          const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const fmContent = fmMatch[1];
            const nameMatch = fmContent.match(/name:\s*(.+)/);
            // Multi-line description might be tricky, try single or simple multi
            const descMatch = fmContent.match(/description:\s*(?:>|\|)?\s*([\s\S]*?)(?=\n[a-z]+:|$)/i);

            if (nameMatch) name = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim();
          }

          container.innerHTML = "";
          if (name) {
             const nameEl = document.createElement("strong");
             nameEl.textContent = name;
             container.appendChild(nameEl);
             container.appendChild(document.createElement("br"));
          }
          
          const descEl = document.createElement("div");
          descEl.className = "skill-desc";
          descEl.textContent = description;
          container.appendChild(descEl);
          
          container.dataset.loaded = "true";
        } catch (e) {
          container.innerHTML = `<em style="color:red;">${getI18nMsg("errorParsingMeta")}</em>`;
        }
      }

      function copyCommand(owner, repo, skillPath, btnElement) {
      // e.g. https://github.com/vercel-labs/skills
      const baseUrl = `https://github.com/${owner}/${repo}`;
      const command = `npx skills add ${baseUrl}${skillPath && skillPath !== "." ? "/" + skillPath : ""}`;

      navigator.clipboard.writeText(command).then(() => {
      const originalHtml = btnElement.innerHTML;
      btnElement.innerHTML = "✅";
      btnElement.title = chrome.i18n.getMessage("copiedState");
      setTimeout(() => {
      btnElement.innerHTML = originalHtml;
      btnElement.title = chrome.i18n.getMessage("copyCommandBtn");
      }, 2000);
      }).catch(err => {
      console.error("Could not copy text: ", err);
      });
      }

      async function downloadSkill(skillPath, listItemElement) {  await executeDownload(currentOwner, currentRepo, currentTree, skillPath, listItemElement);
}

async function downloadFromHistory(skill, listItemElement) {
  const btn = listItemElement.querySelector("button");
  const originalText = btn.textContent;
  btn.textContent = chrome.i18n.getMessage("fetchingBtn");
  listItemElement.classList.add("downloading");

  chrome.runtime.sendMessage({
    type: "GET_TREE_BY_SHA",
    owner: skill.owner,
    repo: skill.repo,
    treeSha: skill.treeSha
  }, async (response) => {
    if (!response || !response.success) {
      alert(chrome.i18n.getMessage("failedToFetchTree"));
      btn.textContent = originalText;
      listItemElement.classList.remove("downloading");
      return;
    }
    
    await executeDownload(skill.owner, skill.repo, response.tree, skill.path, listItemElement, skill.defaultBranch);
  });
}

async function executeDownload(owner, repo, tree, skillPath, listItemElement, branchOrSha = null) {
  const btn = listItemElement.querySelector("button");
  const originalText = btn.textContent;
  btn.textContent = chrome.i18n.getMessage("zippingBtn");
  listItemElement.classList.add("downloading");

  try {
    const zip = new JSZip();

    // Find all files in the tree that are under skillPath
    const prefix = skillPath === "." ? "" : skillPath + "/";
    const filesToDownload = tree.filter(item => {
      if (item.type !== "blob") return false;
      return prefix === "" || item.path.startsWith(prefix);
    });

    // Use defaultBranch from global if not provided
    const targetRef = branchOrSha || defaultBranch;

    // Fetch in parallel but with limits
    const batchSize = 10;
    for (let i = 0; i < filesToDownload.length; i += batchSize) {
      const batch = filesToDownload.slice(i, i + batchSize);
      await Promise.all(batch.map(async (file) => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${targetRef}/${file.path}`;
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${file.path}`);
        const blob = await res.blob();
        
        const zipPath = prefix === "" ? file.path : file.path.substring(prefix.length);
        zip.file(zipPath, blob);
      }));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    
    chrome.downloads.download({
      url: url,
      filename: `${skillPath === "." ? repo : skillPath.split("/").pop()}.zip`,
      saveAs: true
    }, () => {
      URL.revokeObjectURL(url);
    });

  } catch (error) {
    alert(chrome.i18n.getMessage("downloadFailed") + error.message);
  } finally {
    btn.textContent = chrome.i18n.getMessage("downloadBtn");
    listItemElement.classList.remove("downloading");
  }
}