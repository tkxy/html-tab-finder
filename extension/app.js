/**
 * app.js — 索引页主逻辑
 * - 从 chrome.storage.local 读 items
 * - 渲染卡片墙、搜索、筛选、排序
 * - 编辑标签/备注、置顶、删除
 */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

let allItems = [];          // 数组形式的全部记录
let state = {
  query: "",
  scope: "all",   // all | pinned
  category: "all", // all | ppt | feedback | competitor | ...
};
let editingUrl = null;

// ─── 工具函数 ───────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "刚刚";
  if (diff < hr) return `${Math.floor(diff/min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff/hr)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff/day)} 天前`;
  // > 1 周显示具体日期
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"),
        dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// 标题处理：移除前后空白和多余的"-"等
function cleanTitle(t) {
  return (t || "").replace(/\s+/g, " ").trim();
}

// 显示路径：本地文件显示完整路径，网页显示 host + 短路径
function displayPath(it) {
  if (it.isLocal) {
    // 把 /Users/<name> 简写成 ~
    return it.path.replace(/^\/Users\/[^\/]+/, "~");
  }
  return it.host + (it.path === "/" ? "" : it.path);
}

// 提取"所在会话"chip：当前 UI 已不显示，保留给未来可能的扩展用
function extractSession(it) {
  if (!it.isLocal) return null;
  return null;
}

// 提取"父目录名" - 用于显示在哪个文件夹
function extractParentDir(it) {
  if (!it.isLocal) return null;
  const parts = it.path.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 2];
}

// 提取文件名（不含扩展名前缀路径）
function extractFilename(it) {
  if (!it.isLocal) return null;
  return it.path.split("/").pop();
}

// favicon fallback：用 host 首字母
function faviconHTML(it) {
  if (it.favicon) {
    return `<img class="favicon" src="${escapeHtml(it.favicon)}" alt="" onerror="this.outerHTML='<span class=&quot;favicon-fallback&quot;>${escapeHtml(it.host[0]?.toUpperCase() || '?')}</span>'">`;
  }
  if (it.isLocal) {
    return `<span class="favicon-fallback" title="本地文件">📄</span>`;
  }
  return `<span class="favicon-fallback">${escapeHtml(it.host[0]?.toUpperCase() || "?")}</span>`;
}

// ─── 数据加载 ───────────────────────────────────────────────────────────
async function loadAll() {
  const { items = {} } = await chrome.storage.local.get("items");
  // 严格过滤：必须是 file:// 协议 + .html/.htm 后缀的，否则一律剔除
  let cleaned = false;
  const cleanedItems = {};
  for (const [url, it] of Object.entries(items)) {
    if (!it) { cleaned = true; continue; }
    if (!url.startsWith("file://")) { cleaned = true; continue; }
    const lower = url.toLowerCase().split("?")[0];
    if (!lower.endsWith(".html") && !lower.endsWith(".htm")) {
      cleaned = true;
      continue;
    }
    // 修正 isLocal 字段（防御）
    cleanedItems[url] = { ...it, isLocal: true };
  }
  if (cleaned) {
    await chrome.storage.local.set({ items: cleanedItems });
  }
  allItems = Object.values(cleanedItems);
  render();
}

async function saveItem(url, patch) {
  const { items = {} } = await chrome.storage.local.get("items");
  if (!items[url]) return;
  items[url] = { ...items[url], ...patch };
  await chrome.storage.local.set({ items });
  // 更新本地副本
  const idx = allItems.findIndex(x => x.url === url);
  if (idx >= 0) allItems[idx] = items[url];
}

async function deleteItem(url) {
  const { items = {} } = await chrome.storage.local.get("items");
  delete items[url];
  await chrome.storage.local.set({ items });
  allItems = allItems.filter(x => x.url !== url);
}

// ─── 渲染 ───────────────────────────────────────────────────────────────
// 检测 title 是否是"加载失败/错误页"，这些页面应该过滤掉
function isErrorTitle(title) {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t.length < 2) return true;
  const errorPatterns = [
    "系统维护", "维护中", "服务暂不可用", "暂不可用",
    "找不到", "无法访问", "加载失败", "出错了", "页面错误",
    "404", "403", "500", "502", "503",
    "not found", "error", "unavailable", "forbidden",
    "this site can", "this page isn", "无法连接",
  ];
  return errorPatterns.some(p => t.includes(p));
}

function applyFilter(items) {
  const q = state.query.toLowerCase().trim();
  return items.filter(it => {
    // 过滤掉加载失败的页面
    if (isErrorTitle(it.title)) return false;
    if (state.scope === "pinned" && !it.pinned) return false;
    if (state.category !== "all") {
      const cat = categorize(it);
      if (cat.key !== state.category) return false;
    }
    if (!q) return true;
    const blob = (
      (it.title || "") + " " +
      (it.url || "") + " " +
      (it.path || "") + " " +
      (it.host || "") + " " +
      (it.summary || "")
    ).toLowerCase();
    return blob.includes(q);
  });
}

function applySort(items) {
  const arr = items.slice();
  arr.sort((a,b) => (b.lastVisit||0) - (a.lastVisit||0));
  return arr;
}

// 按类型分类（关键词规则）
// 顺序很重要：从特殊到一般，先匹配的赢
const CATEGORY_RULES = [
  { key: "ppt",       icon: "🎤", label: "PPT / 演示",
    patterns: [/ppt/i, /slide/i, /deck/i, /presentation/i, /演示/, /分享/, /\.ppt/, /pitch/i] },
  { key: "feedback",  icon: "💬", label: "用户反馈",
    patterns: [/feedback/i, /反馈/, /调研/, /满意度/, /survey/i, /用户.*意见/, /用户.*评/, /用户反馈/, /comment/i] },
  { key: "competitor",icon: "🏆", label: "竞品分析",
    patterns: [/竞品/, /competitor/i, /\bvs\b/i, /对比/, /benchmark/i, /竞争/, /市场.*分析/] },
  { key: "experience",icon: "🗺️", label: "体验地图 / 流程",
    patterns: [/experience/i, /journey/i, /体验.*地图/, /体验地图/, /用户.*路径/, /\bflow\b/i, /流程/, /路径图/, /map/i] },
  { key: "report",    icon: "📊", label: "研究报告 / 周报",
    patterns: [/report/i, /报告/, /周报/, /月报/, /日报/, /总结/, /research/i, /分析/, /analysis/i, /study/i, /research/i] },
  { key: "design",    icon: "🎨", label: "设计 / 原型",
    patterns: [/design/i, /设计/, /mockup/i, /prototype/i, /\bui\b/i, /\bux\b/i, /原型/, /组件/] },
  { key: "news",      icon: "📰", label: "资讯 / 仪表盘",
    patterns: [/insights/i, /hub/i, /daily/i, /news/i, /资讯/, /builders/i, /周刊/, /dashboard/i, /面板/] },
  { key: "meeting",   icon: "📋", label: "会议 / 纪要",
    patterns: [/meeting/i, /会议/, /纪要/, /minutes?/i, /讨论/, /复盘/] },
];

function categorize(it) {
  // 把可用文本拼起来扫
  const haystack = [
    it.title || "",
    it.path || "",
    it.summary || "",
    (it.tags || []).join(" "),
  ].join(" ").toLowerCase();
  for (const cat of CATEGORY_RULES) {
    for (const p of cat.patterns) {
      if (p.test(haystack)) return cat;
    }
  }
  return { key: "other", icon: "📦", label: "其他" };
}

function groupKey(it) {
  const cat = categorize(it);
  return { key: "cat:" + cat.key, label: cat.label, kind: cat.key, icon: cat.icon };
}

// 把列表按 groupKey 聚合
// - 组之间：按 CATEGORY_RULES 的固定顺序（"其他"垫底）
// - 组内：按文件名倒序
function groupItems(items) {
  const groups = new Map();
  for (const it of items) {
    const g = groupKey(it);
    if (!groups.has(g.key)) {
      groups.set(g.key, { ...g, items: [] });
    }
    groups.get(g.key).items.push(it);
  }
  // 转数组：按 CATEGORY_RULES 顺序
  const order = [...CATEGORY_RULES.map(c => "cat:" + c.key), "cat:other"];
  const arr = Array.from(groups.values());
  arr.sort((a, b) => {
    const ai = order.indexOf(a.key);
    const bi = order.indexOf(b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  // 组内按创建时间倒序（最新的在前）
  for (const g of arr) {
    g.items.sort((a, b) => (b.firstSeen || 0) - (a.firstSeen || 0));
  }
  return arr;
}

function renderGroup(g) {
  const groupActions = `
    <button class="group-trash" data-act="trash-group" data-group-key="${escapeHtml(g.key)}" title="删除整组（移到废纸篓）">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <span>删除全部 ${g.items.length} 个</span>
    </button>
  `;
  return `
    <div class="group" data-group-key="${escapeHtml(g.key)}">
      <div class="group-header">
        <span class="group-icon">${g.icon || "📦"}</span>
        <h3 class="group-label">${escapeHtml(g.label)}</h3>
        <span class="group-line"></span>
        <span class="group-count">${g.items.length}</span>
        ${groupActions}
      </div>
      <div class="grid">
        ${g.items.map(cardHTML).join("")}
      </div>
    </div>
  `;
}

function cardHTML(it) {
  const tags = (it.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const noteBlock = it.note ? `<div class="card-note">${escapeHtml(it.note)}</div>` : "";
  const filename = extractFilename(it);

  // 文件名小字（仅本地，且与卡片标题不同时显示）
  const cleanT = cleanTitle(it.title) || filename || it.path.split("/").pop();
  const showFilename = it.isLocal && filename && filename !== cleanT;

  // 本地文件 hover 出现的动作（底部那一排，纯图标，节省空间）
  const localHoverActions = it.isLocal ? `
    <button class="act-btn" data-act="open-dir" title="在 Finder 中显示" aria-label="在 Finder 中显示">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
    <button class="act-btn act-danger" data-act="trash" title="移到废纸篓" aria-label="移到废纸篓">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
      </svg>
    </button>
  ` : "";

  return `
    <div class="card ${it.pinned ? 'pinned' : ''} ${it.isLocal ? 'is-local' : 'is-web'}" data-url="${escapeHtml(it.url)}">
      <button class="pin-btn ${it.pinned ? 'is-pinned' : ''}" data-act="pin" title="${it.pinned ? '取消置顶' : '置顶'}" aria-label="pin">
        <svg viewBox="0 0 24 24" fill="${it.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
        </svg>
      </button>
      <div class="card-title">${escapeHtml(cleanT)}</div>
      ${showFilename ? `<div class="card-filename">${escapeHtml(filename)}</div>` : ""}
      ${it.summary ? `<div class="card-summary">${escapeHtml(it.summary)}</div>` : ""}
      ${tags ? `<div class="card-tags">${tags}</div>` : ""}
      ${noteBlock}
      <div class="card-meta">
        <span class="meta-time" title="文件创建时间">${fmtTime(it.firstSeen)}</span>
        <span class="card-actions">
          ${localHoverActions}
        </span>
      </div>
    </div>
  `;
}

// 渲染分类 chips（带数量）
function renderCategoryBar() {
  // 计算每类有多少
  const counts = { all: 0 };
  for (const it of allItems) {
    if (state.scope === "pinned" && !it.pinned) continue;
    counts.all++;
    const cat = categorize(it);
    counts[cat.key] = (counts[cat.key] || 0) + 1;
  }
  // 只显示有内容的类别
  const visible = [
    { key: "all", icon: "✦", label: "全部" },
    ...CATEGORY_RULES.filter(c => counts[c.key] > 0),
    ...(counts.other > 0 ? [{ key: "other", icon: "📦", label: "其他" }] : []),
  ];
  $("#category-bar").innerHTML = visible.map(c => `
    <button class="cat-chip ${state.category === c.key ? 'active' : ''}" data-cat="${c.key}">
      <span class="cat-icon">${c.icon || ""}</span>
      <span>${escapeHtml(c.label)}</span>
    </button>
  `).join("");
}

function render() {
  renderCategoryBar();

  const filtered = applyFilter(allItems);
  // 按创建时间倒序
  const sorted = filtered.slice().sort((a, b) => (b.firstSeen || 0) - (a.firstSeen || 0));

  const pinned = sorted.filter(x => x.pinned);
  const rest = sorted.filter(x => !x.pinned);

  // pinned 区
  if (pinned.length && state.scope !== "pinned") {
    $("#section-pinned").style.display = "";
    $("#grid-pinned").innerHTML = pinned.map(cardHTML).join("");
    $("#count-pinned").textContent = pinned.length;
  } else {
    $("#section-pinned").style.display = "none";
  }

  // 主区域：直接平铺 grid，不分组
  const mainList = state.scope === "pinned" ? sorted : rest;
  $("#grid-recent").innerHTML = mainList.map(cardHTML).join("");
  $("#grid-recent").className = "grid";

  // 空状态
  $("#empty").style.display = (sorted.length === 0) ? "" : "none";
  $("#section-recent").style.display = (mainList.length === 0 && state.scope !== "pinned") ? "none" : "";
}

// ─── 交互 ───────────────────────────────────────────────────────────────
$("#search").addEventListener("input", e => {
  state.query = e.target.value;
  render();
});

document.querySelectorAll('.chips[data-group="scope"] .chip').forEach(c => {
  c.addEventListener("click", () => {
    document.querySelectorAll('.chips[data-group="scope"] .chip').forEach(x => x.classList.remove("active"));
    c.classList.add("active");
    state.scope = c.dataset.scope;
    render();
  });
});

// 类别 chip 点击
document.body.addEventListener("click", (e) => {
  const chip = e.target.closest(".cat-chip");
  if (!chip) return;
  state.category = chip.dataset.cat;
  render();
});

// 分组级删除已经不存在（改成了类别筛选+平铺），这里保留一个空监听以兼容旧 DOM
document.body.addEventListener("click", async (e) => {
  const groupTrashBtn = e.target.closest('[data-act="trash-group"]');
  if (!groupTrashBtn) return;
  e.stopPropagation();
  // 当前 UI 不再有这个按钮；如果未来加回类别批量删除，这里可以扩展
});

// 卡片点击委托
document.body.addEventListener("click", async (e) => {
  // 分组级删除按钮在上面那个监听处理过，避免被卡片监听吞掉
  if (e.target.closest('[data-act="trash-group"]')) return;
  const card = e.target.closest(".card");
  if (!card) return;
  const url = card.dataset.url;
  const item = allItems.find(x => x.url === url);
  if (!item) return;

  // 置顶按钮
  const pinBtn = e.target.closest('[data-act="pin"]');
  if (pinBtn) {
    e.stopPropagation();
    await saveItem(url, { pinned: !item.pinned });
    render();
    return;
  }
  // 编辑按钮
  const editBtn = e.target.closest('[data-act="edit"]');
  if (editBtn) {
    e.stopPropagation();
    openEditModal(url);
    return;
  }
  // 打开所在目录（仅本地文件）→ 调用 htmltab:// helper App，让 Finder 真正打开
  const dirBtn = e.target.closest('[data-act="open-dir"]');
  if (dirBtn) {
    e.stopPropagation();
    if (!item.isLocal) return;
    const encoded = item.path.split("/").map(encodeURIComponent).join("/");
    triggerScheme("htmltab://reveal" + encoded);
    return;
  }
  // 复制完整路径
  const copyBtn = e.target.closest('[data-act="copy-path"]');
  if (copyBtn) {
    e.stopPropagation();
    if (!item.isLocal) return;
    try {
      await navigator.clipboard.writeText(item.path);
      showToast(`✓ 已复制路径，去 Finder 按 Cmd+Shift+G 粘贴`);
    } catch {
      showToast("复制失败，请手动选中地址");
    }
    return;
  }

  // 删除（移到废纸篓 + 从索引里移除）
  const trashBtn = e.target.closest('[data-act="trash"]');
  if (trashBtn) {
    e.stopPropagation();
    if (!item.isLocal) return;
    const filename = item.path.split("/").pop();
    if (!confirm(`确认把这个文件移到废纸篓？\n\n${filename}\n\n（可在废纸篓恢复）`)) return;

    // 1. 调 Helper 移到废纸篓（用 iframe，不开新 tab）
    const encoded = item.path.split("/").map(encodeURIComponent).join("/");
    triggerScheme("htmltab://trash" + encoded);

    // 2. 从扩展索引里删除
    await deleteItem(url);
    render();
    showToast(`🗑️ 已移到废纸篓：${filename}`);
    return;
  }

  // 卡片本体点击 → 打开页面
  chrome.tabs.create({ url });
});

// 触发系统 URL Scheme（如 htmltab://...）的最干净方式：用 hidden iframe
// 比 chrome.tabs.create 好——不会开新tab、用户无感
function triggerScheme(schemeUrl) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = schemeUrl;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 1000);
}

// 简易 toast
let toastTimer = null;
function showToast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

// 编辑模态框
function openEditModal(url) {
  const item = allItems.find(x => x.url === url);
  if (!item) return;
  editingUrl = url;
  $("#modal-title").textContent = cleanTitle(item.title) || item.path.split("/").pop();
  $("#modal-url").textContent = item.url;
  $("#modal-tags").value = (item.tags || []).join(", ");
  $("#modal-note").value = item.note || "";
  // 仅本地文件显示 quick actions
  $("#modal-quick").style.display = item.isLocal ? "flex" : "none";
  $("#modal-mask").classList.add("show");
  setTimeout(() => $("#modal-tags").focus(), 50);
}

function closeModal() {
  $("#modal-mask").classList.remove("show");
  editingUrl = null;
}

$("#modal-cancel").addEventListener("click", closeModal);
$("#modal-mask").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeModal();
});
$("#modal-open-dir").addEventListener("click", () => {
  if (!editingUrl) return;
  const item = allItems.find(x => x.url === editingUrl);
  if (!item || !item.isLocal) return;
  const dirPath = item.path.replace(/\/[^\/]+$/, "");
  chrome.tabs.create({ url: "file://" + dirPath + "/" });
});
$("#modal-copy-path").addEventListener("click", async () => {
  if (!editingUrl) return;
  const item = allItems.find(x => x.url === editingUrl);
  if (!item || !item.isLocal) return;
  try {
    await navigator.clipboard.writeText(item.path);
    showToast(`✓ 已复制路径，去 Finder 按 Cmd+Shift+G 粘贴`);
  } catch {
    showToast("复制失败");
  }
});
$("#modal-save").addEventListener("click", async () => {
  if (!editingUrl) return;
  const tagsRaw = $("#modal-tags").value || "";
  const tags = tagsRaw.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  const note = $("#modal-note").value.trim();
  await saveItem(editingUrl, { tags, note });
  closeModal();
  render();
});
$("#modal-delete").addEventListener("click", async () => {
  if (!editingUrl) return;
  if (!confirm("确认删除这条记录？\n（不会影响磁盘上的真实文件）")) return;
  await deleteItem(editingUrl);
  closeModal();
  render();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
  // Cmd/Ctrl + K 聚焦搜索
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    $("#search").focus();
    $("#search").select();
  }
});

// 主题切换
$("#themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch {}
});

// 导出（保留逻辑，按钮已移除；可通过控制台调用 exportHistory()）
async function exportHistory() {
  const { items = {} } = await chrome.storage.local.get("items");
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `html-history-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
window.exportHistory = exportHistory;

// ─── 从 Chrome 浏览器历史导入 ──────────────────────────────────────────
function shouldImport(url) {
  if (!url) return false;
  if (url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("brave://") ||
      url.startsWith("about:") ||
      url.startsWith("view-source:")) return false;
  try {
    const u = new URL(url);
    if (u.protocol === "file:") {
      const p = u.pathname.toLowerCase();
      return p.endsWith(".html") || p.endsWith(".htm");
    }
    if (u.protocol === "http:" || u.protocol === "https:") {
      const p = u.pathname.toLowerCase();
      if (/\.(png|jpe?g|gif|webp|svg|pdf|mp4|mov|mp3|wav|zip|tar|gz|json|xml|css|js|woff2?|ttf)(\?|$)/.test(p)) return false;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function deriveMetaInPage(url) {
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

$("#btn-import")?.addEventListener("click", async () => {
  if (!chrome.history) {
    alert("浏览器历史 API 不可用，请确认扩展权限。");
    return;
  }

  // 让用户选范围
  const choice = prompt(
    "从 Chrome 浏览器历史导入 HTML 页面：\n\n" +
    "1 = 仅本地 HTML 文件（file://）— 推荐\n" +
    "2 = 本地 + 网页（数量可能很大）\n" +
    "3 = 取消\n\n" +
    "输入 1 / 2 / 3：",
    "1"
  );
  if (!choice || choice === "3") return;
  const includeWeb = (choice.trim() === "2");

  showToast("正在扫描浏览器历史，请稍候...");

  // 抓最近 5 年的所有历史
  const fiveYears = 5 * 365 * 24 * 60 * 60 * 1000;
  const startTime = Date.now() - fiveYears;
  // chrome.history.search 单次最多返回 maxResults，给个大值
  const results = await chrome.history.search({
    text: "",          // 空字符串 = 全部
    startTime,
    maxResults: 100000,
  });

  const filtered = results.filter(r => {
    if (!shouldImport(r.url)) return false;
    if (!includeWeb && !r.url.startsWith("file:")) return false;
    return true;
  });

  if (filtered.length === 0) {
    alert("没有找到可导入的页面。\n（确认你打开过本地 HTML 后再试）");
    return;
  }

  if (!confirm(`找到 ${filtered.length} 条历史记录，导入？\n（不会覆盖已有的标签/备注/置顶）`)) return;

  // 合并到 storage
  const { items = {} } = await chrome.storage.local.get("items");
  let added = 0, merged = 0;
  for (const r of filtered) {
    const url = r.url;
    const prev = items[url];
    const meta = deriveMetaInPage(url);
    // chrome.history 给的是 lastVisitTime 和 visitCount
    const lastVisit = r.lastVisitTime || Date.now();
    const visitCount = r.visitCount || 1;

    if (prev) {
      // 已存在：合并访问次数（取大）+ 更新 lastVisit（取大）
      items[url] = {
        ...prev,
        title: prev.title || r.title || meta.path.split("/").pop() || url,
        lastVisit: Math.max(prev.lastVisit || 0, lastVisit),
        visitCount: Math.max(prev.visitCount || 0, visitCount),
        firstSeen: Math.min(prev.firstSeen || lastVisit, lastVisit),
      };
      merged++;
    } else {
      items[url] = {
        url,
        title: r.title || meta.path.split("/").pop() || url,
        favicon: "",
        host: meta.host,
        path: meta.path,
        isLocal: meta.isLocal,
        firstSeen: lastVisit,
        lastVisit,
        visitCount,
        pinned: false,
        note: "",
        tags: [],
      };
      added++;
    }
  }
  await chrome.storage.local.set({ items });
  await loadAll();
  showToast(`✓ 新增 ${added} 条，合并 ${merged} 条`);
});

// ─── 扫描本地文件夹（File System Access API） ────────────────────────────
// 递归扫一个目录，找出所有 .html / .htm 文件
async function* walkDir(dirHandle, basePath, depth = 0) {
  if (depth > 8) return;  // 限制递归深度防爆
  // 跳过这些目录
  const SKIP = new Set(["node_modules", ".git", "__pycache__", ".cache",
    "dist", "build", ".next", ".nuxt", "venv", ".venv", "env",
    "Library", "Pictures", "Movies", "Music"]);
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith(".") || SKIP.has(name)) continue;
    const newPath = basePath + "/" + name;
    if (handle.kind === "directory") {
      yield* walkDir(handle, newPath, depth + 1);
    } else if (handle.kind === "file") {
      const lower = name.toLowerCase();
      if (lower.endsWith(".html") || lower.endsWith(".htm")) {
        yield { handle, name, path: newPath };
      }
    }
  }
}

// 从 HTML 文件里提取 <title>
async function extractTitleFromFile(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    const head = await file.slice(0, 16384).text();
    const m = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m) {
      return m[1].replace(/\s+/g, " ").trim().slice(0, 200);
    }
  } catch {}
  return null;
}

// 提取副标题摘要：优先 meta description，然后是 og:description，
// 然后第一个 <h1>/<h2>，最后是第一段实际文字
async function extractSummaryFromFile(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    // 读前 64KB 找内容
    const text = await file.slice(0, 65536).text();

    // 1. meta description
    let m = text.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (m && m[1].trim()) return cleanSummary(m[1]);

    // 2. og:description
    m = text.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (m && m[1].trim()) return cleanSummary(m[1]);

    // 3. 第一个 h1/h2（非 <title>）
    m = text.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
    if (m) {
      const t = stripTags(m[1]);
      if (t.length > 4) return cleanSummary(t);
    }

    // 4. 第一段长度足够的文本（>=15 字符）
    const bodyMatch = text.match(/<body[^>]*>([\s\S]+?)(<\/body>|$)/i);
    const bodyText = bodyMatch ? bodyMatch[1] : text;
    // 移除 script/style 块
    const cleaned = bodyText
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    // 取前几个 <p>
    const paragraphs = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    for (const p of paragraphs) {
      const t = stripTags(p[1]);
      if (t.length >= 15) return cleanSummary(t);
    }
    // 实在没 <p>，取所有可见文本里第一段足够长的
    const allText = stripTags(cleaned);
    if (allText.length >= 15) return cleanSummary(allText);
  } catch {}
  return null;
}

function stripTags(s) {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function cleanSummary(s) {
  return s.replace(/\s+/g, " ").trim().slice(0, 200);
}

$("#btn-scan-folder").addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    alert("当前浏览器不支持选择文件夹（需 Chrome/Edge）");
    return;
  }

  // 让用户选目录 - Chrome 安全机制要求必须用户点击授权一次
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({
      mode: "read",
      startIn: "documents",  // 启动位置：默认从家目录开始，用户可往上点到 Macintosh HD/Users/xxx
    });
  } catch (e) {
    if (e.name !== "AbortError") alert("无法选择文件夹: " + e.message);
    return;
  }

  // 自动猜路径前缀：通过 dirHandle.name 拼出
  // - 选了 home（用户名目录）→ /Users/<rootName>
  // - 选了常见子目录 → /Users/<当前 OS 用户名>/<...>
  // - 其他情况让用户确认
  const rootName = dirHandle.name;
  // 从 storage 读取上次保存的用户名，如果没有则首次让用户输入
  let { osUsername } = await chrome.storage.local.get("osUsername");
  if (!osUsername) {
    osUsername = prompt(
      "首次使用，请输入你的 macOS 用户名（比如 johnsmith）。\n" +
      "用于把扫描到的文件路径转换成可点击的 file:// URL。",
      ""
    );
    if (!osUsername) return;
    osUsername = osUsername.trim();
    await chrome.storage.local.set({ osUsername });
  }
  const guessedUserName = osUsername;

  // 启发式生成 absPrefix
  let absPrefix;
  if (rootName === guessedUserName) {
    // 用户选的是 ~/
    absPrefix = `/Users/${rootName}`;
  } else if (["Desktop","Downloads","Documents","Movies","Music","Pictures"].includes(rootName)) {
    // 用户选的是家目录下的常见目录
    absPrefix = `/Users/${guessedUserName}/${rootName}`;
  } else {
    // 其他情况：让用户确认（仅在不确定时弹）
    const ans = prompt(
      `已选目录: ${rootName}\n\n` +
      `请确认这个目录在磁盘上的完整路径：\n` +
      `（如果不知道，从 Finder 把目录拖到终端里能看到完整路径）`,
      `/Users/${guessedUserName}/${rootName}`
    );
    if (!ans) return;
    absPrefix = ans.replace(/\/+$/, "");
  }

  showToast(`正在扫描 ${rootName}，可能需要几十秒...`);

  let bar = document.getElementById("scan-progress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "scan-progress";
    bar.className = "scan-progress";
    document.body.appendChild(bar);
  }
  bar.classList.add("show");

  const found = [];
  let scannedCount = 0;
  for await (const f of walkDir(dirHandle, "")) {
    found.push(f);
    scannedCount++;
    if (scannedCount % 5 === 0) {
      bar.textContent = `扫描中... 已找到 ${scannedCount} 个 HTML`;
      await new Promise(r => setTimeout(r, 0));
    }
  }
  bar.textContent = `共 ${found.length} 个，正在提取标题...`;

  if (found.length === 0) {
    bar.classList.remove("show");
    alert("没找到 HTML 文件");
    return;
  }

  const { items = {} } = await chrome.storage.local.get("items");
  const now = Date.now();
  let added = 0, merged = 0;
  for (let i = 0; i < found.length; i++) {
    const f = found[i];
    const absPath = absPrefix + f.path;
    const cleanUrl = "file://" + absPath;

    const title = await extractTitleFromFile(f.handle) || f.name;
    const summary = await extractSummaryFromFile(f.handle) || "";

    let modTime = now;
    try {
      const file = await f.handle.getFile();
      modTime = file.lastModified || now;
    } catch {}

    const prev = items[cleanUrl];
    if (prev) {
      items[cleanUrl] = {
        ...prev,
        title: prev.title || title,
        summary: prev.summary || summary,  // 已存在的不覆盖（用户可能改过）
        firstSeen: Math.min(prev.firstSeen || now, modTime),
      };
      merged++;
    } else {
      items[cleanUrl] = {
        url: cleanUrl,
        title: title,
        summary: summary,
        favicon: "",
        host: "local",
        path: absPath,
        isLocal: true,
        firstSeen: modTime,
        lastVisit: modTime,
        visitCount: 0,
        pinned: false,
        note: "",
        tags: [],
      };
      added++;
    }
    if (i % 10 === 0) {
      bar.textContent = `处理中 ${i+1}/${found.length}...`;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  await chrome.storage.local.set({ items });
  bar.classList.remove("show");
  await loadAll();
  showToast(`✓ 扫描完成！新增 ${added} 个，合并 ${merged} 个`);
});

// 监听 storage 变化，实时更新（其他 tab 打开新页面时）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.items) {
    allItems = Object.values(changes.items.newValue || {});
    render();
  }
});

// 初始加载
async function init() {
  // 1. 抓当前所有打开的 tab，把本地 HTML 收录一次
  try {
    const tabs = await chrome.tabs.query({});
    const { items = {} } = await chrome.storage.local.get("items");
    let added = false;
    for (const t of tabs) {
      if (!t.url || !t.url.startsWith("file:")) continue;
      const lower = t.url.toLowerCase();
      if (!lower.endsWith(".html") && !lower.endsWith(".htm")) continue;
      if (items[t.url]) continue;  // 已有就跳过
      const u = new URL(t.url);
      const path = decodeURIComponent(u.pathname);
      const now = Date.now();
      items[t.url] = {
        url: t.url,
        title: t.title || path.split("/").pop(),
        summary: "",
        favicon: t.favIconUrl || "",
        host: "local",
        path,
        isLocal: true,
        firstSeen: now,
        lastVisit: now,
        visitCount: 1,
        pinned: false,
        note: "",
        tags: [],
      };
      added = true;
    }
    if (added) {
      await chrome.storage.local.set({ items });
    }
  } catch {}
  // 2. 然后正常加载
  await loadAll();
}
init();
