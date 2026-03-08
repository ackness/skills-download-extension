# AI Agent Skills Downloader (Chrome Extension)

A Manifest V3 Chrome Extension that helps you discover, manage, and download AI Agent "Skills" (directories containing a `SKILL.md` file) directly from GitHub repositories.

## 🌟 Features

- **Instant Discovery**: Automatically scans GitHub repositories for any valid AI Agent Skills using the efficient GitHub Git Trees API.
- **Background Auto-Detect**: Optionally enable background scanning so skills are silently logged to your history just by browsing GitHub.
- **History & Search**: All discovered skills are saved to a local database (IndexedDB) with a built-in search to easily find and download them later, even if you are no longer on the GitHub page.
- **Passive Metadata Caching**: If you view a `SKILL.md` file natively on GitHub, the extension quietly extracts its metadata (name, description) in the background and enriches your history database.
- **On-Demand Details**: Click the info icon (ℹ️) next to any skill to lazily load and view its metadata instantly without navigating away.
- **Dual Installation Modes**:
  - 📋 **Copy CLI Command**: Instantly copies the `npx skills add <url>` command for quick terminal installation.
  - 📦 **Direct ZIP Download**: Downloads all files related to the skill bundled securely in a `.zip` archive without leaving the browser.
- **Repository Update Tracking**: Identifies if a repository has been updated since your last visit.
- **Custom GitHub Token**: Add your Personal Access Token (PAT) to bypass the standard GitHub API rate limits.
- **Localization (i18n)**: Fully supports English and Simplified Chinese (简体中文) with an in-app language switcher.

## 🚀 Installation (Developer Mode)

1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left corner.
5. Select the folder containing this extension's files.
6. The extension is now installed! Click the puzzle icon 🧩 in Chrome to pin it to your toolbar.

## ⚙️ Configuration

To ensure uninterrupted usage, it is highly recommended to configure a GitHub token:
1. Click the **Settings (⚙️)** icon in the extension popup.
2. Click the "Get one here" link to generate a new Personal Access Token on GitHub (no specific scopes are required for public repos, just the base token).
3. Paste the token into the input field and click **Save Settings**.
4. You can also change the display language or toggle background auto-detection on this page.

## 🛠️ Architecture

Built strictly adhering to modern Chrome Extension (Manifest V3) standards:
- **Service Worker (`background.js`)**: Ephemeral, event-driven background processing. Handles GitHub API requests, background tab monitoring, and IndexedDB interactions.
- **No Remote Code**: Uses a locally bundled version of [JSZip](https://stuk.github.io/jszip/) (`libs/jszip.min.js`) for secure, client-side ZIP generation.
- **Storage**: Uses `chrome.storage.local` for settings and lightweight caching, and `IndexedDB` for robust, searchable history logs.

## 📄 License

MIT
