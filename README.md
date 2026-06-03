# HTML tab finder

> 一键找到你电脑上所有 AI 生成的 HTML 文件 — Chrome 扩展

[English](./README_EN.md)

每天用 AI 生成一堆 HTML 报告/PPT/原型，散落在各个会话目录里，找起来很费劲？这个扩展帮你**一站式索引、按类型筛选、一键打开 Finder、安全删除**。

<!-- 预览截图：以后想加就在 docs/ 文件夹放 preview.png 后取消下一行注释 -->
<!-- ![preview](docs/preview.png) -->

## ✨ 特性

- 📁 **一键扫描** — 用 File System Access API 扫描本地任意目录下所有 `.html` 文件
- 🏷️ **智能分类** — 按 PPT / 用户反馈 / 竞品分析 / 研究报告 / 设计 / 资讯 / 会议 等类别自动归类
- 🔍 **全文搜索** — 标题、路径、摘要、域名一起搜
- 📊 **副标题提取** — 自动从 HTML 提取 `<meta description>` 或 `<h1>` 作为卡片副标题
- 📂 **真·在 Finder 中显示**（macOS）— 通过自定义 URL Scheme + 微型 Helper App，点击就跳 Finder 选中文件
- 🗑️ **安全删除** — 移到废纸篓而非永久删除，可恢复
- ⭐ **置顶** — 常用文件钉到顶部
- 🌙 **暗色模式** — 暖纸色 + 衬线美学，跟随系统或手动切换
- 🛡️ **零网络** — 数据全部存在本地 `chrome.storage`，不传任何东西到外部

## 🚀 安装

### 1. 安装 Chrome 扩展（所有系统）

#### 方式 A：不会用 git，直接下载 ZIP（推荐给大多数人）

1. 打开仓库页面：
   ```text
   https://github.com/tkxy/html-tab-finder
   ```
2. 点击页面右上方绿色按钮 **Code**
3. 在弹出的菜单里点击 **Download ZIP**
4. 下载完成后，双击解压，得到一个类似这样的文件夹：
   ```text
   html-tab-finder-main/
   ```
5. 打开 Chrome，在地址栏输入：
   ```text
   chrome://extensions
   ```
6. 打开页面右上角 **开发者模式**
7. 点击页面左上角 **加载未打包的扩展程序**
8. 在文件选择器里，选择解压后文件夹里的 **extension** 子文件夹：
   ```text
   html-tab-finder-main/extension/
   ```
   注意：不要选择 `html-tab-finder-main/` 根目录，必须选择里面的 `extension/` 目录。
9. 安装成功后，Chrome 扩展列表里会出现 **HTML tab**
10. 点击 Chrome 工具栏右上角的拼图图标 🧩，找到 **HTML tab**，点击图钉 📌 把它固定到工具栏
11. 点击工具栏里的 **HTML tab** 图标，即可打开索引页

#### 方式 B：会用 git，克隆仓库安装

1. 克隆本仓库：
   ```bash
   git clone https://github.com/tkxy/html-tab-finder.git
   ```
2. 打开 Chrome → 地址栏输入：
   ```text
   chrome://extensions
   ```
3. 右上角打开 **开发者模式**
4. 左上角点击 **加载未打包的扩展程序**
5. 选择仓库里的 `extension/` 目录：
   ```text
   html-tab-finder/extension/
   ```
6. 把扩展图标钉到工具栏

### 2.（可选 · macOS）装 Helper App，让"在 Finder 中显示"真正能用

```bash
bash helper/install.sh
```

输出 `✅ 安装完成！` 即可。第一次点扩展里的"在 Finder 中显示"按钮时，浏览器会问"是否允许打开 HTML tab Helper" → **勾选"始终允许"** → 之后就丝滑了。

不装 Helper 也能用，只是"打开所在目录"按钮不工作。

## 📖 用法

### 首次使用：扫描本地

1. 点击 Chrome 工具栏里的 **HTML tab** 图标，打开索引页
2. 点击页面右上角 **📁 扫描本地 HTML**
3. 在系统文件夹选择器里，选择你想扫描的目录，例如：
   ```text
   Documents/
   Downloads/
   Desktop/
   你常放 AI 生成 HTML 的文件夹/
   ```
   不建议直接选择整个用户根目录，因为 Chrome 可能会因为权限限制拒绝读取。
4. Chrome 会弹出文件访问确认，点击 **允许**
5. 首次使用时，插件可能会要求输入你的 macOS 用户名，用于拼出本地文件路径。比如你的路径是：
   ```text
   /Users/alex/Documents/report.html
   ```
   那用户名就是：
   ```text
   alex
   ```
6. 等几秒，插件会自动扫描该目录下所有 `.html` / `.htm` 文件，并以卡片形式展示
7. 之后再次打开新的本地 HTML 文件，插件也会自动记录

### 日常使用

- **搜** — 顶部搜索框，全字段命中
- **筛** — 点类别 chip（🎤 PPT、💬 用户反馈、🏆 竞品分析 ...）
- **开** — 点卡片本体 → 在新 tab 打开 HTML
- **找** — hover 卡片 → 点 📂 → 直接在 Finder 中显示（需 Helper）
- **删** — hover 卡片 → 点 🗑️ → 移到废纸篓
- **顶** — hover 卡片 → 点 📌 置顶

## 🏗️ 工作原理

```
┌──────────────────────┐
│  Chrome 扩展（MV3）   │
│  ─ background.js     │  监听 chrome.tabs.onUpdated
│  ─ index.html / app  │  卡片墙 + 搜索 + 分类
│  ─ chrome.storage    │  本地永久存储索引数据
└──────────────────────┘
         │
         │ htmltab://reveal/<path>   (URL Scheme)
         ▼
┌──────────────────────┐
│  HTML tab Helper.app │
│  (AppleScript .app)  │  接收 URL Scheme，调 Finder
└──────────────────────┘
```

- **扩展只读取本地 HTML 元信息**（标题、文件大小、修改时间），永远不上传
- **Helper App 仅在 macOS 上**，处理 `htmltab://reveal/` 和 `htmltab://trash/` 两个动作
- **数据格式**：`chrome.storage.local` 下一个 `items` 对象，键是 file:// URL，值是元信息

## 📁 项目结构

```
html-tab-finder/
├── extension/                 # Chrome 扩展（核心）
│   ├── manifest.json          # MV3 配置
│   ├── background.js          # Service Worker
│   ├── index.html             # 索引页
│   ├── app.js                 # 主逻辑
│   ├── style.css              # 样式
│   ├── theme-init.js          # 主题切换
│   ├── fonts/ · fonts.css     # 字体（暂不用，可删）
│   └── icons/                 # 工具栏图标
├── helper/                    # macOS Helper App（可选）
│   ├── htmltab-helper.applescript
│   ├── install.sh             # 一键安装脚本
│   └── README.md
├── LICENSE                    # MIT
└── README.md
```

## 🛠️ 开发

修改代码后：
- 编辑 `extension/` 下的文件
- 在 `chrome://extensions` 找到 "HTML tab" → 点 ↻ **刷新** 即可生效

修改 Helper：
- 编辑 `helper/htmltab-helper.applescript`
- 重新跑 `bash helper/install.sh`

## ⚠️ 已知限制

- **跨浏览器**：目前只在 Chrome / Edge / Brave 上测过，Safari MV3 应该兼容但未验证
- **跨平台**：Helper 只支持 macOS。Windows / Linux 用户的"打开所在目录"功能需要自行适配（PR 欢迎）
- **目录授权**：每次重启 Chrome 后，扫描本地目录会重新弹一次授权确认（Chrome 安全机制，无法绕过）

## 📜 许可证

MIT — 随便用，标个名就行。

## 🙏 致谢

- 视觉灵感来自 [Tab Out](https://chromewebstore.google.com/detail/tab-out/imocfgofpgjhgklobbbpobhkbkjllegj)（Newsreader + DM Sans + 暖纸色）
- macOS URL Scheme 注册思路参考 [LaunchServices Programming Guide](https://developer.apple.com/library/archive/documentation/Carbon/Conceptual/LaunchServicesConcepts/)
