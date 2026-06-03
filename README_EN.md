# HTML tab finder

> Find every HTML file on your Mac in one place — a Chrome extension.

[中文文档](./README.md)

Tired of hunting down AI-generated HTML reports/decks/prototypes scattered across countless folders? This extension indexes them all, auto-categorizes by type, gives you full-text search, lets you reveal-in-Finder with one click, and trashes them safely when you don't need them anymore.

<!-- Preview screenshot: drop a preview.png into docs/ and uncomment the next line -->
<!-- ![preview](docs/preview.png) -->

## ✨ Features

- 📁 **One-click scan** — Use the File System Access API to scan any local folder for `.html` files
- 🏷️ **Smart categories** — Auto-classifies into PPT/Slides, User Feedback, Competitor Analysis, Reports, Design, Insights, Meetings, etc.
- 🔍 **Full-text search** — Search across title, path, summary, and domain
- 📊 **Auto subtitle** — Extracts `<meta description>` or first `<h1>` as a card subtitle
- 📂 **True "Reveal in Finder"** (macOS) — Via a custom URL scheme + tiny Helper App, click to jump straight into Finder with the file selected
- 🗑️ **Safe delete** — Moves to Trash instead of permanently deleting; recoverable
- ⭐ **Pinning** — Stick frequently-used files to the top
- 🌙 **Dark mode** — Warm paper aesthetic, follows system or toggles manually
- 🛡️ **Zero network** — All data lives in `chrome.storage`; nothing ever leaves your machine

## 🚀 Installation

### 1. Install the Chrome extension (all platforms)

1. Clone the repo:
   ```bash
   git clone https://github.com/tkxy/html-tab-finder.git
   ```
2. Open Chrome → go to `chrome://extensions`
3. Toggle on **Developer mode** (top right)
4. Click **Load unpacked** (top left)
5. Select the `extension/` folder inside the repo
6. Pin the toolbar icon for quick access

### 2. (Optional · macOS) Install the Helper App for true "Reveal in Finder"

```bash
bash helper/install.sh
```

You should see `✅ Installation complete!`. The first time you click "Reveal in Finder" in the extension, the browser will ask whether to allow opening HTML tab Helper — **check "Always allow"** and click Open. After that, it's instant.

The extension works without the Helper, but the "Open containing folder" button won't function.

## 📖 Usage

### First run: scan your local folder

1. Click the extension icon (or press `Cmd/Ctrl + Shift + H`) to open the index page
2. Click **📁 Scan local HTML** in the top right
3. Pick a folder you want indexed (e.g. `~/Documents/`) → grant read permission
4. After a few seconds, all HTML files show up as cards

### Daily use

- **Search** — Top search box matches every text field
- **Filter** — Click a category chip (🎤 PPT, 💬 Feedback, 🏆 Competitor...)
- **Open** — Click a card body → opens the HTML in a new tab
- **Locate** — Hover a card → click 📂 → reveals it in Finder (Helper required)
- **Delete** — Hover a card → click 🗑️ → moves to Trash
- **Pin** — Hover a card → click 📌 to keep it on top

## 🏗️ How it works

```
┌──────────────────────┐
│  Chrome extension    │
│  ─ background.js     │  Listens to chrome.tabs.onUpdated
│  ─ index.html / app  │  Card grid + search + categories
│  ─ chrome.storage    │  Local persistent index
└──────────────────────┘
         │
         │ htmltab://reveal/<path>   (URL scheme)
         ▼
┌──────────────────────┐
│  HTML tab Helper.app │
│  (AppleScript .app)  │  Receives URL scheme, drives Finder
└──────────────────────┘
```

- The extension only reads metadata (title, size, mtime) of local HTML files. **Nothing ever uploads.**
- The Helper app exists only on macOS and handles two actions: `htmltab://reveal/` and `htmltab://trash/`.
- Storage format: under `chrome.storage.local`, an `items` object keyed by `file://` URL.

## 📁 Project structure

```
html-tab-finder/
├── extension/                 # Chrome extension (core)
│   ├── manifest.json          # MV3 manifest
│   ├── background.js          # Service worker
│   ├── index.html             # Index page
│   ├── app.js                 # Main logic
│   ├── style.css              # Styles
│   ├── theme-init.js          # Theme bootstrap (anti-flash)
│   ├── fonts/ · fonts.css     # Bundled fonts (currently unused, keep or strip)
│   └── icons/                 # Toolbar icons
├── helper/                    # macOS Helper app (optional)
│   ├── htmltab-helper.applescript
│   ├── install.sh             # One-shot installer
│   └── README.md
├── LICENSE                    # MIT
└── README.md
```

## 🛠️ Development

After editing files in `extension/`:
- Open `chrome://extensions`
- Find "HTML tab" → click the ↻ **Reload** button

After editing the Helper:
- Edit `helper/htmltab-helper.applescript`
- Re-run `bash helper/install.sh`

## ⚠️ Known limitations

- **Browser support**: Tested on Chrome / Edge / Brave. Safari MV3 should work but isn't verified yet.
- **Cross-platform Helper**: The Helper is macOS-only. Windows / Linux users would need to adapt the "Open containing folder" path themselves (PRs welcome).
- **Folder authorization**: Chrome resets folder permissions on browser restart. You may need to re-authorize the scan target. This is a Chrome security policy, not something the extension controls.

## 📜 License

MIT. Use it however you want — just keep the copyright line.

## 🙏 Credits

- Visual design inspired by [Tab Out](https://chromewebstore.google.com/detail/tab-out/imocfgofpgjhgklobbbpobhkbkjllegj) — Newsreader / DM Sans / warm-paper aesthetic
- macOS URL scheme registration approach borrowed from the [LaunchServices Programming Guide](https://developer.apple.com/library/archive/documentation/Carbon/Conceptual/LaunchServicesConcepts/)
