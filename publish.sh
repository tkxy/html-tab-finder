#!/bin/bash
# 一键发布到 GitHub
# 用法：bash publish.sh <github-username>
# 例如：bash publish.sh tkxy
#
# 前置条件：
# 1. 已经在 GitHub 上手动创建了一个名为 html-tab-finder 的空仓库（不勾选初始化 README）
# 2. 本地配置了 git 用户名和邮箱
# 3. 配置了 SSH key 或 HTTPS 凭证（git push 时不会反复要密码）

set -e

USERNAME="${1:-}"
if [ -z "$USERNAME" ]; then
  echo "用法: bash publish.sh <github-username>"
  echo "例如: bash publish.sh tkxy"
  exit 1
fi

REPO_NAME="html-tab-finder"
cd "$(dirname "$0")"

# 初始化（如果还没初始化过）
if [ ! -d ".git" ]; then
  echo "🆕 初始化 git 仓库..."
  git init
  git branch -M main
fi

# 加 remote（如果还没加过）
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "git@github.com:$USERNAME/$REPO_NAME.git"
fi

echo "📦 添加文件..."
git add .

echo "📝 提交..."
git commit -m "Initial release: html-tab-finder

A Chrome extension to index, browse, search and manage all HTML files on your Mac.
Includes optional macOS Helper App for true 'reveal in Finder' integration." || echo "（已无新改动可提交）"

echo "🚀 推送到 GitHub..."
git push -u origin main

echo ""
echo "✅ 完成！查看你的仓库: https://github.com/$USERNAME/$REPO_NAME"
