# HTML tab Helper

让 Chrome 扩展点"📂 在 Finder 中显示"按钮时，**真正打开访达并选中文件**。

## 原理

注册一个 macOS URL Scheme `htmltab://`。当扩展点击此 URL 时：

```
Chrome 点击 htmltab://reveal/Users/.../foo.html
        ↓
LaunchServices 把请求路由给 HTML tab Helper.app
        ↓
.app 运行 AppleScript: tell Finder to reveal "..."
        ↓
Finder 自动跳出来并选中文件 ✨
```

## 安装（一次性）

打开终端，运行：

```bash
bash helper/install.sh
```

输出大概是：

```
📦 编译 AppleScript 成 .app...
📝 修改 Info.plist 注入 URL Scheme...
🔄 触发 LaunchServices 重新扫描...
✅ 安装完成！
   位置: /Users/<你>/Applications/HTML tab Helper.app
```

## 使用

装完后回到扩展，hover 卡片 → 点 **📂 在 Finder 中显示**。

**第一次点会弹一个对话框**：
> "网站想要打开 HTML tab Helper"

→ 勾选 ✅ "始终允许从 chrome-extension..." → 点"打开应用程序"

之后再点就会直接弹 Finder，没任何二次确认。

## 调试

```bash
# 看 helper 是否被调用
tail -f /tmp/htmltab-helper.log

# 命令行测试
open "htmltab://reveal$HOME/Documents"
```

## 卸载

```bash
rm -rf "$HOME/Applications/HTML tab Helper.app"
```

## 文件清单

```
helper/
├── htmltab-helper.applescript   # 源代码
├── install.sh                   # 一键安装
├── htmltab-helper.sh            # 备选 bash 实现（不需要 .app 时用）
└── README.md
```
