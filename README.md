# 📖 码字神器 (NovelCraft Enterprise)

[![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)](https://github.com/ChaEunwooy/NovelCraft)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-brightgreen.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-34.2-lightblue.svg)](https://www.electronjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**码字神器 (NovelCraft Enterprise)** 是一款专为百万字长篇网络小说作家打造的**全要素沉浸式创作工作台与番茄小说官方签约发布系统**。融合**独立物理文件落盘、多维度大纲思维导图、人物全息档案卡、伏笔闭环推演看板、15分钟全自动快照保险箱与番茄官方免密直发**，为长篇稳定连载提供坚如磐石的技术保障。

---

## 🌟 核心功能架构 (Four Panels System)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   码字神器 顶部状态与功能栏                              │
├─────────────────┬──────────────────────────────────────────┬───────────────────────────┤
│  📁 板块一：     │  📖 板块二：小说档案与核心主线卡片         │  🧠 板块三：              │
│  大纲树与目录导航 │ ──────────────────────────────────────── │  多层级思维导图大纲        │
│  · 作品选择器    │  ✍️ 板块四：沉浸式核心码字工作区           │  · 整体宏观大纲           │
│  · 分卷折叠管理  │  · 毫秒级物理纯文本 TXT 落盘             │  · 卷剧情弧光             │
│  · 单章差分状态  │  · 实时字数/思考时速统计                  │  · 章节事件细纲           │
│  · 人物/伏笔入口 │  · 一键排版/记伏笔/存番茄草稿/差分直发    │  · 节点拖拽推演           │
└─────────────────┴──────────────────────────────────────────┴───────────────────────────┘
```

### 1. 🗄️ 真正的每书独立物理工程落盘 (True Physical Disk Storage)
* 每部作品在本地硬盘自动生成专属文件夹 `data-storage/novels/《书名》/`；
* **单章即独立纯文本 TXT**：正文直接保存为物理 `.txt` 文件，拒绝黑盒数据库锁定，用户随时可直接用记事本或外部工具编辑；
* **全要素隔离**：大纲导图（`mindmaps/`）、人物档案（`characters/`）、伏笔暗线（`foreshadows/`）与元数据（`novel.json`）完全物理解耦。

### 2. 🛡️ 15分钟全自动快照与版本时光机 (15-Min Auto Snapshot Vault)
* **后台静默多版本快照**：创作过程中每 15 分钟自动备份全书正文、大纲与人物设定至 `data-storage/backups/`；
* **一键安全无损还原**：支持随时回滚至任意历史快照点，还原前自动触发“还原保护快照”，彻底杜绝误操作导致废稿。

### 3. 🍅 官方无头后台扫码登录与差分流转 (Tomato Cloud Engine)
* **全内嵌免密扫码**：后台静默无头抓取番茄作家官方最新二维码，手机 APP（番茄免费小说或抖音）扫一扫瞬间自动捕获会话；
* **四态智能差分流转**：自动比对本地字数与番茄线上版本：
  * `🟢 已发稿 (对齐)` ➔ 本地修改后动态变为 ➔ `🔴 待更新 (🚀 提交修改后的版本)`；
  * `🔵 未提交` ➔ `🟡 草稿箱`。
* **智能合规诊断**：自动拦截 `<1,000字` 发布限制，捕获单日建书配额超限并给出指导建议。

### 4. 💻 纯本地建档 vs 🍅 番茄官方建书 双模式
* **纯本地私密模式**：100% 单机离线创作，无需登录任何账号，零网络依赖；
* **番茄签约同步模式**：本地物理建档的同时，自动在番茄作家后台同步创建官方新书骨架。

---

## 🏗️ 项目工程结构

```
E:\码字神器├── frontend/                 # Web 前端工程 (Vue 3 + Vite + TypeScript)
│   ├── src/
│   │   ├── components/       # 核心面板 (SiderPanel, EditorWorkspace, MindMapPanel 等)
│   │   ├── api/              # 本地存储与网络通信客户端
│   │   └── types/            # TypeScript 核心类型定义
│   └── vite-plugins/         # 本地物理磁盘存储 Vite 中间件
├── desktop-app/              # 独立桌面端工程 (Electron)
│   ├── main.js               # 原生主进程 (后台无头扫码抓包与窗口管理)
│   ├── preload.js            # 安全 IPC 桥接
│   └── server/               # 桌面端自包含生产级存储引擎
├── server-bridge/            # Web 端登录抓包桥接服务
└── release-package/          # 封装输出的 Windows 安装包与便携版 (已加入 .gitignore)
```

---

## 🚀 快速开始

### 环境准备
* Node.js >= 18.0.0
* npm 或 pnpm

### 1. 启动 Web 开发模式

```bash
# 启动前端与本地物理存储服务
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173` 即可开启沉浸式创作。

### 2. 打包生成桌面端独立安装包

```bash
cd desktop-app
npm install
npm run dist
```

打包完成后，将在 `release-package/` 目录下生成：
* `码字神器 Setup 1.0.0.exe`：标准 Windows 一键安装向导；
* `win-unpacked/`：解压即用的绿色免安装便携版。

---

## 🔒 隐私与数据安全说明

1. **绝对离线与隐私保护**：
   * 所有小说草稿、大纲脑图、人物卡与备份均**保存在用户本地磁盘**；
   * 本开源仓库 `.gitignore` 已默认严格剔除 `data-storage/`，绝对不会将作者的任何未公开文稿或账号凭证上传至公开网络。
2. **防代码篡改**：
   * 桌面分发版本已通过 Electron ASAR 二进制密闭打包，前后端代码已混淆封存。

---

## 📄 开源许可证

本项目遵循 [MIT License](LICENSE) 开源。

**作者：ChaEunwooy**
