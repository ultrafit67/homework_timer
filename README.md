# 作业计时器 🏠📚

双用户作业计时 PWA，支持老大/老二各自计时、按年级筛选科目、统计和记录管理。

> ⚠️ **本仓库代码全部由 AI 助手 [OpenCode](https://github.com/anomalyco/opencode) 生成。**
> 从项目初始化、功能实现到 bug 修复，所有提交均通过 AI 对话完成，未手动编写代码。

## 功能

- **双独立计时器** — 兄弟俩各有一个计时面板，同时计时互不干扰
- **年级科目筛选** — 设置年级后只显示对应科目（1–9 年级，累计增加）
- **用户自定义** — 名字、年级均可修改，改名自动更新历史记录
- **手动记录** — 补录任意时间段的作业记录
- **统计** — 日视图/周视图，科目用时排名，每周总用时排行
- **记录管理** — 按用户/科目筛选，编辑/删除，数据导入导出
- **PWA** — 可安装到手机桌面，离线可用

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 路由 | React Router v6 |
| 数据库 | IndexedDB (via `idb` v8) |
| PWA | `vite-plugin-pwa` (Workbox) |
| 样式 | 纯 CSS，移动优先，BEM 命名 |

## 开发

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 类型检查 + 打包
npm run preview    # 预览打包结果
```

## 项目结构

```
src/
  types.ts         — 类型定义，科目/年级配置
  utils.ts         — 工具函数，localStorage 读写
  db.ts            — IndexedDB 封装（单例，惰性迁移）
  hooks/
    useTimer.ts    — 计时器状态机
    useRecords.ts  — 记录 CRUD + 统计计算
  components/      — TimerPanel, SubjectButton, 对话框等
  pages/           — Timer, Stats, Records 三个标签页
  App.tsx          — 路由 + 底部导航
  styles.css       — 全局样式
```

## 部署

```bash
npm run build
npx surge dist/ --domain <name>.surge.sh   # Surge
# 或
npx vercel deploy dist/ --prod              # Vercel
```
