# 扩展核心源码

这个目录是 Chrome 扩展的源码。要安装请回到仓库根目录的 [README](../README.md)。

## 文件说明

| 文件 | 用途 |
|---|---|
| `manifest.json` | MV3 配置 |
| `background.js` | Service Worker：监听 tab 加载，自动入库 |
| `index.html` | 索引页主结构 |
| `app.js` | 卡片墙渲染、搜索、分类筛选、置顶、删除 |
| `style.css` | 样式 |
| `theme-init.js` | 防闪主题注入 |
| `fonts/` `fonts.css` | 字体（已不主动使用，等待清理） |
| `icons/` | 工具栏图标 |

## 修改后如何看效果

1. 编辑文件
2. `chrome://extensions` → 找到 "HTML tab" → 点 ↻ **刷新**
3. 重新打开扩展页查看
