// Listen for messages from background script if needed, though mostly we will send.

// Function to extract text content of the file from GitHub's DOM.
// GitHub's DOM changes frequently, so fetching raw is more reliable, but since we are on the page, we can just grab raw.githubusercontent.com for this specific file to ensure perfect parsing without dealing with DOM tree walkers.
// Actually, since we are on the page, the user has already loaded it. Let's just fetch the raw url of the current page.

async function extractAndStoreSkillData() {
  const currentUrl = window.location.href;
  
  // URL format: https://github.com/{owner}/{repo}/blob/{branch}/{path...}/SKILL.md
  // Also handle /blame/ routes
  const match = currentUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|blame)\/([^\/]+)\/(.*?)\/?SKILL\.md$/);
  
  if (!match) return; // Not a SKILL.md page
  
  const owner = match[1];
  const repo = match[2];
  const branch = match[3];
  const skillPath = match[4] || "."; // If match[4] is empty, it's at the root.

  try {
    // Fetch raw content to guarantee we get the clean frontmatter without DOM parsing nightmares
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillPath === "." ? "SKILL.md" : skillPath + "/SKILL.md"}`;
    const response = await fetch(rawUrl);
    if (!response.ok) return;
    
    const text = await response.text();
    
    let name = "";
    let description = "";
    
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const fmContent = fmMatch[1];
      const nameMatch = fmContent.match(/name:\s*(.+)/);
      const descMatch = fmContent.match(/description:\s*(?:>|\|)?\s*([\s\S]*?)(?=\n[a-z]+:|$)/i);

      if (nameMatch) name = nameMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
    }
    
    // Only send if we found something useful, or send anyway to update timestamp
    chrome.runtime.sendMessage({
      type: "SAVE_SKILL_META",
      skillData: {
        id: `${owner}/${repo}/${skillPath}`,
        owner: owner,
        repo: repo,
        name: name || (skillPath === "." ? "Root" : skillPath.split("/").pop()),
        path: skillPath,
        defaultBranch: branch, // Approximation, as we are on a specific branch
        description: description,
        lastDetected: new Date().getTime()
      }
    });

  } catch (err) {
    console.error("Skills Downloader: Failed to fetch and parse SKILL.md from raw content", err);
  }
}

// GitHub is an SPA (uses Turbo/pjax), so content scripts don't reload on every navigation.
// We need to listen for Turbo load events or simply rely on the background script to tell us when to check.
// Using a MutationObserver on the body or listening to pushState is common, but GitHub emits custom events.
// `turbo:load` or `pjax:end` are typical for GitHub.

document.addEventListener("pjax:end", extractAndStoreSkillData);
document.addEventListener("turbo:load", extractAndStoreSkillData);

// Initial check on full page load
extractAndStoreSkillData();