#!/bin/bash
# HTML tab Helper — 处理 htmltab:// URL scheme
# 由 LaunchServices 在用户点击 htmltab:// 链接时调用
# 参数: $1 = 完整 URL，例如 htmltab://reveal/Users/yourname/Documents/foo.html
#
# 支持的 action：
#   reveal/<absolute-path>  → 在 Finder 中选中该文件/目录
#   open/<absolute-path>    → 用 Finder 打开该目录

set -u

URL="${1:-}"
LOG="/tmp/htmltab-helper.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] called with: $URL" >> "$LOG"

if [ -z "$URL" ]; then
  echo "no URL given" >> "$LOG"
  exit 1
fi

# 去掉 htmltab:// 前缀
PAYLOAD="${URL#htmltab://}"

# 解析 action 和 path
ACTION="${PAYLOAD%%/*}"
PATH_PART="${PAYLOAD#*/}"

# URL decode（处理空格、中文等）
PATH_PART=$(printf '%b' "${PATH_PART//%/\\x}")

# 路径必须以 / 开头（绝对路径）
if [[ "$PATH_PART" != /* ]]; then
  PATH_PART="/$PATH_PART"
fi

echo "  action=$ACTION path=$PATH_PART" >> "$LOG"

case "$ACTION" in
  reveal)
    # 在 Finder 中选中（高亮）这个文件/目录
    if [ -e "$PATH_PART" ]; then
      open -R "$PATH_PART"
      echo "  → revealed in Finder" >> "$LOG"
    else
      # 文件不存在：退回到打开父目录
      PARENT=$(dirname "$PATH_PART")
      if [ -d "$PARENT" ]; then
        open "$PARENT"
        echo "  → file not found, opened parent: $PARENT" >> "$LOG"
      else
        osascript -e "display notification \"路径不存在: $PATH_PART\" with title \"HTML tab\""
      fi
    fi
    ;;
  open)
    # 直接打开目录
    if [ -d "$PATH_PART" ]; then
      open "$PATH_PART"
      echo "  → opened directory" >> "$LOG"
    elif [ -e "$PATH_PART" ]; then
      # 是文件就打开它所在目录
      open "$(dirname "$PATH_PART")"
    else
      osascript -e "display notification \"路径不存在: $PATH_PART\" with title \"HTML tab\""
    fi
    ;;
  *)
    echo "  unknown action: $ACTION" >> "$LOG"
    osascript -e "display notification \"未知操作: $ACTION\" with title \"HTML tab\""
    ;;
esac
