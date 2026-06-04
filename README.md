# 考勤管理系统 (Attendance Management System)

基于 Next.js + Supabase 的轻量级考勤管理系统，支持员工管理、每日打卡、考勤日历、请假审批、加班记录和统计报表。

## 技术栈

- Next.js 14
- React 18
- TypeScript
- Supabase (PostgreSQL)

## 安装

```bash
npm install
```

## 配置

复制 `.env.local.example` 为 `.env.local`，填入 Supabase 项目 URL 和 Anon Key：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 数据库初始化

编辑 `migrate.mjs`，填入 Supabase 凭据，然后运行：

```bash
node migrate.mjs
```

或直接在 Supabase SQL Editor 中执行 `migrate.mjs` 中打印的 SQL。

## 运行

```bash
npm run dev
```

默认运行在 http://localhost:3000

## 功能

- 👥 **员工管理** — 添加、编辑、删除员工，按部门筛选
- ⏰ **每日考勤** — 签到、签退、标记缺勤，自动判断迟到/早退
- 📅 **考勤日历** — 按月查看全员考勤状态，快速跳转某日
- 📝 **请假管理** — 提交/审批年假、病假、事假等申请
- ⏱️ **加班记录** — 提交/审批加班，记录时长
- 📊 **统计报表** — 出勤率、迟到/早退/缺勤统计、部门对比、7天趋势
