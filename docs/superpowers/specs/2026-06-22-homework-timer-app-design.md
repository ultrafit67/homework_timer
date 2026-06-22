# 作业计时器 App 设计文档

## 概述
一个用于记录和统计每日/每周作业时间的 PWA 应用。选择科目，计时，完成记录，自动统计排序。

## 技术栈
- **框架**: React 18 + TypeScript
- **构建**: Vite + vite-plugin-pwa
- **路由**: React Router v6
- **存储**: IndexedDB (通过 idb 库)
- **样式**: CSS Modules (纯 CSS，无 UI 框架依赖)
- **PWA**: 离线可用，可添加到 Android 主屏幕

## 页面结构 (3 Tab)
1. **计时页** (`/`) — 选科目 → 开始 → 完成
2. **统计页** (`/stats`) — 日/周切换，按用时排序
3. **记录页** (`/records`) — 历史记录列表

## 数据模型

### HomeworkRecord
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 唯一标识 |
| subject | '语'\|'数'\|'外'\|'道法'\|'历史'\|'物理'\|'化学' | 科目 |
| startTime | string (ISO 8601) | 开始时间 |
| endTime | string (ISO 8601) | 结束时间 |
| durationSeconds | number | 持续秒数 |
| date | string (YYYY-MM-DD) | 作业日期 |

## 应用状态

### 计时状态
```
idle → subjectSelected → timing → completed
  ↑                        ↓
  └────────────────────────┘
```

- idle: 无选中科目，计时器停止
- subjectSelected: 已选科目，可点击开始
- timing: 计时中
- completed: 完成一次记录

## 功能详述

### 计时页
- 7 个科目按钮（2行：语数外道法 + 历史物理化学）
- 选中的科目高亮
- "开始"按钮：选中科目后可用，点击开始计时
- 计时器显示：HH:MM:SS 实时更新
- "完成"按钮：计时中可用，点击弹出确认框
- 确认后保存记录，回到 idle 状态

### 统计页
- **日视图** (默认)
  - 顶部卡片：今日总用时
  - 列表：各科目今日用时，降序排列
- **周视图**
  - 顶部卡片：本周总用时
  - 列表：各科目本周用时，降序排列
- **周排序视图**
  - 按周分组，显示每周总用时
  - 按总用时降序排列

### 记录页
- 分页列表，每页20条
- 每条显示：科目、日期、时间段、用时
- 支持按科目筛选
- 支持删除单条记录

## 数据存储 (IndexedDB)
- 数据库名: `homework-timer`
- Object Store: `records`
- 索引: `date`(按日期查询), `subject`(按科目筛选), `startTime`(排序)

## PWA 配置
- 应用名: 作业计时器
- 图标: 使用 SVG 内联图标（时钟样式）
- 主题色: #4F46E5 (靛蓝)
- Service Worker: 通过 vite-plugin-pwa 自动生成
- 缓存策略: CacheFirst (静态资源)

## 组件树
```
App
├── BottomNav (底部 TabBar)
├── Routes
│   ├── TimerView
│   │   ├── SubjectGrid
│   │   │   └── SubjectButton × 7
│   │   ├── TimerDisplay
│   │   └── ActionButtons (开始/完成)
│   ├── StatsView
│   │   ├── PeriodToggle (日/周)
│   │   ├── TotalTimeCard
│   │   └── SubjectRanking
│   │       └── RankingItem × N
│   └── RecordsView
│       ├── FilterBar (科目筛选)
│       └── RecordList
│           └── RecordItem × N
```
