#!/bin/bash
# 一键安装 HTML tab Helper
# 1. 把 .applescript 编译成 .app
# 2. 修改 Info.plist 注入 htmltab:// URL Scheme
# 3. 注册到 LaunchServices

set -e

cd "$(dirname "$0")"

APP_NAME="HTML tab Helper.app"
INSTALL_DIR="$HOME/Applications"
APP_PATH="$INSTALL_DIR/$APP_NAME"

mkdir -p "$INSTALL_DIR"

echo "📦 编译 AppleScript 成 .app..."
osacompile -o "$APP_PATH" htmltab-helper.applescript

echo "📝 修改 Info.plist 注入 URL Scheme..."
PLIST="$APP_PATH/Contents/Info.plist"

# 用 plutil 添加 CFBundleURLTypes
plutil -insert CFBundleURLTypes -xml '
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>HTML tab Reveal</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>htmltab</string>
    </array>
  </dict>
</array>
' "$PLIST" 2>/dev/null || plutil -replace CFBundleURLTypes -xml '
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>HTML tab Reveal</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>htmltab</string>
    </array>
  </dict>
</array>
' "$PLIST"

# 也加个图标识别（可选）
plutil -replace LSMinimumSystemVersion -string "10.12" "$PLIST" 2>/dev/null || true

echo "🔄 触发 LaunchServices 重新扫描..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$APP_PATH"

echo ""
echo "✅ 安装完成！"
echo "   位置: $APP_PATH"
echo ""
echo "🧪 测试一下 (会在 Finder 中显示这个文件)："
echo "   open \"htmltab://reveal\$HOME/Documents\""
echo ""
echo "📒 日志路径: /tmp/htmltab-helper.log"
echo ""
echo "💡 第一次点击 htmltab:// 链接时，浏览器会问你"
echo "   '是否允许打开 HTML tab Helper?' → 勾选'始终允许' → 允许"
