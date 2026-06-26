# 作业计时器 🏠📚

双用户作业计时 PWA，支持老大/老二各自计时、按年级筛选科目、统计和记录管理。

> ⚠️ **本仓库代码全部由 AI 助手 [OpenCode](https://github.com/anomalyco/opencode) 生成。**
> 从项目初始化、功能实现到 bug 修复，所有提交均通过 AI 对话完成，未手动编写代码。

## 功能

- **双独立计时器** — 两位用户各有一个计时面板，同时计时互不干扰，支持暂停/继续
- **番茄钟模式** — 支持切换普通计时/番茄钟，预设三档时长，自动保存记录，可暂停/跳过休息
- **年级科目筛选** — 设置年级后只显示对应科目（1–9 年级，累计增加）
- **用户自定义** — 名字、年级均可修改，改名自动更新历史记录
- **手动记录** — 补录任意时间段的作业记录，支持精确输入或快速录入
- **统计** — 日视图/周视图 + 趋势图，科目用时排名，每周总用时排行
- **记录管理** — 按用户/科目筛选，编辑/删除，日期范围过滤，数据导入导出（含名字/年级配置）
- **PWA** — 可安装到手机桌面，离线可用
- **局域网同步** — 两台设备在同一 WiFi 下通过扫码配对，直接 P2P 交换数据，无需服务器
- **AI 分析** — 接入 DeepSeek API，基于当前筛选的时间范围和用户，分析学习时间分布、趋势和效率建议，结果以 Markdown 展示并保存历史
- **自动备份** — 支持定时自动备份和手动立即备份，可保存到文件系统目录

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 路由 | React Router v6 |
| 数据库 | IndexedDB (via `idb` v8) |
| AI | DeepSeek API (自定义 Markdown 渲染器，无外部依赖) |
| PWA | `vite-plugin-pwa` (Workbox) |
| 样式 | 纯 CSS，移动优先，BEM 命名 |

## 开发

```bash
npm install
npm run dev        # 开发服务器 https://localhost:5173（HTTPS，用于摄像头访问）
npm run build      # 类型检查 + 打包
npm run preview    # 预览打包结果
```

## 项目结构

```
src/
  types.ts         — 类型定义，科目/年级配置，科目颜色/图标
  utils.ts         — 工具函数，localStorage 读写
  db.ts            — IndexedDB 封装（单例，惰性迁移，软删除）
   hooks/
     useTimer.ts    — 计时器状态机（计时/暂停/完成）
     usePomodoro.ts — 番茄钟状态机（专注/休息/倒计时）
     useRecords.ts  — 记录 CRUD + 统计计算，触发同步
     useLocalSync.ts — 局域网 P2P 同步（WebRTC）
     useAI.ts       — DeepSeek API 调用 hook，loading/error 状态，历史管理
   components/      — TimerPanel, PomodoroTimer, SubjectButton, LocalSync, ApiKeyDialog, AIAnalysis, 对话框
   pages/           — Timer, Stats, Records 三个标签页
   App.tsx          — 路由 + 底部导航 + 同步初始化 + 状态指示器
   styles.css       — 全局样式
```

## 部署

```bash
npm run build
git push origin main  # GitHub Actions 自动部署到 GitHub Pages
```
