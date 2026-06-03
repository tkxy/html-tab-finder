# 发布到 GitHub 教程

## 一次性设置

### 1️⃣ 在 GitHub 创建空仓库

1. 浏览器打开 https://github.com/new
2. 填写：
   - **Repository name**: `html-tab-finder`
   - **Description**: `A Chrome extension to index, browse, and manage all HTML files on your Mac`
   - 勾选 **Public**
   - **不要**勾选 "Add a README file" / "Add .gitignore" / "Choose a license"（我们已经准备好了）
3. 点 **Create repository**

### 2️⃣ 配置 SSH（如果第一次用 GitHub）

```bash
# 检查是否已有 SSH key
ls -la ~/.ssh/id_*.pub 2>/dev/null

# 如果没有：生成一个
ssh-keygen -t ed25519 -C "your_email@example.com"
# 按三次回车（不设密码最简单）

# 复制公钥
pbcopy < ~/.ssh/id_ed25519.pub
```

然后到 GitHub：
1. 右上角头像 → **Settings**
2. 左侧 **SSH and GPG keys** → **New SSH key**
3. Title 随便填，Key 处粘贴（Cmd+V）
4. **Add SSH key**

测试连接：
```bash
ssh -T git@github.com
# 看到 "Hi xxx! You've successfully authenticated" 就 OK
```

## 发布

到这个目录跑发布脚本：

```bash
cd ~/WorkBuddy/_html_index/release/html-tab-finder
bash publish.sh <你的GitHub用户名>
```

例如：
```bash
bash publish.sh tkxy
```

输出：
```
🆕 初始化 git 仓库...
📦 添加文件...
📝 提交...
🚀 推送到 GitHub...
✅ 完成！查看你的仓库: https://github.com/tkxy/html-tab-finder
```

打开链接确认仓库内容齐全。

## 后续更新

修改代码后想更新到 GitHub：

```bash
cd ~/WorkBuddy/_html_index/release/html-tab-finder
git add .
git commit -m "你的更新描述"
git push
```

## 设置仓库的展示

发布后建议去仓库页面：

1. **About 区**（右上角齿轮）：
   - 加 Description（用 README 第一行）
   - 加 Topics：`chrome-extension`, `html`, `productivity`, `macos`, `file-manager`, `mv3`
2. **Releases**：可以打个 v1.0.0 tag 让别人有正式版下载
3. 可选 **Star** 自己的仓库 ⭐
