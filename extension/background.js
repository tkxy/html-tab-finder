/**
 * background.js — Service Worker
 *
 * 两件事：
 *   1. 监听所有标签页加载完成 → 如果是 HTML 页面，记录到 storage
 *   2. 工具栏点击 / 快捷键 → 打开/聚焦索引页
 *
 * 数据格式 (chrome.storage.local):
 *   {
 *     "items": {
 *       "<url>": {
 *         url, title, favicon, host, isLocal, path,
 *         firstSeen, lastVisit, visitCount,
 *         pinned: bool, note: string, tags: string[]
 *       }
 *     }
 *   }
 */

const DASHBOARD_URL = chrome.runtime.getURL("index.html");

// ─── 判断 URL 是不是「值得记录的 HTML 页面」 ────────────────────────────
// 只收录本地 file:// 的 .html / .htm 文件 —— 也就是大模型/工具生成的 HTML 产物
// 网页历史一律忽略
function shouldRecord(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "file:") return false;
    const p = u.pathname.toLowerCase();
    return p.endsWith(".html") || p.endsWith(".htm");
  } catch {
    return false;
  }
}

// 提取友好的路径展示（file:// 显示完整路径，http 显示 host+path）
function deriveMeta(url) {
  try {
    const u = new URL(url);
    const isLocal = u.protocol === "file:";
    return {
      host: isLocal ? "local" : u.hostname,
      path: isLocal ? decodeURIComponent(u.pathname) : (u.pathname + (u.search || "")),
      isLocal,
    };
  } catch {
    return { host: "?", path: url, isLocal: false };
  }
}

// 写一条记录（合并 visitCount / lastVisit）
async function recordVisit(tab) {
  const url = tab.url;
  if (!shouldRecord(url)) return;
  const now = Date.now();

  const { items = {} } = await chrome.storage.local.get("items");
  const prev = items[url];
  const meta = deriveMeta(url);

  items[url] = {
    url,
    title: tab.title || prev?.title || meta.path.split("/").pop() || url,
    favicon: tab.favIconUrl || prev?.favicon || "",
    host: meta.host,
    path: meta.path,
    isLocal: meta.isLocal,
    firstSeen: prev?.firstSeen || now,
    lastVisit: now,
    visitCount: (prev?.visitCount || 0) + 1,
    // 用户字段：保留之前的值
    pinned: prev?.pinned || false,
    note: prev?.note || "",
    tags: prev?.tags || [],
  };
  await chrome.storage.local.set({ items });
}

// 打开/聚焦 dashboard
async function openDashboard() {
  const all = await chrome.tabs.query({});
  const exist = all.find(t => t.url === DASHBOARD_URL);
  if (exist) {
    await chrome.tabs.update(exist.id, { active: true });
    if (typeof exist.windowId === "number") {
      await chrome.windows.update(exist.windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: DASHBOARD_URL });
}

// ─── 事件监听 ───────────────────────────────────────────────────────────
chrome.action.onClicked.addListener(openDashboard);

// 页面加载完成时记录（捕获到 title 和 favIcon 的好时机）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab && tab.url) {
    recordVisit(tab);
  }
});

// ─── 启动时扫一遍当前所有打开的标签页 ─────────────────────────────────
// 解决"装扩展前已经打开的 HTML 没被记录"的问题
async function scanCurrentTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (shouldRecord(t.url)) {
        await recordVisit(t);
      }
    }
  } catch (e) {
    console.log("scanCurrentTabs failed:", e);
  }
}

// service worker 每次激活都扫一次
scanCurrentTabs();
chrome.runtime.onStartup.addListener(scanCurrentTabs);
chrome.runtime.onInstalled.addListener(scanCurrentTabs);
