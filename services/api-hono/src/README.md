<!-- 自维护声明：本目录的结构或核心职责变化后，请同步更新本文档。 -->

# 后端源代码

**架构定位**：Cloudflare Workers + Hono + D1 后端。

## 目录结构

| 目录/文件 | 职责 |
| --------- | ---- |
| `index.ts` | Worker 入口、全局中间件、路由挂载和定时任务 |
| `config/` | 精确 Origin 白名单等环境配置 |
| `middlewares/` | access token 验证、权限和基础安全策略 |
| `models/` | D1 数据访问兼容封装 |
| `routes/` | 认证、用户、部门、文件、报告和 API Key 接口 |
| `services/` | access token、refresh 会话、Cookie 及业务服务 |
| `utils/` | 日志、日期和验证工具 |

## 认证模块

| 文件 | 职责 |
| ---- | ---- |
| `routes/auth.ts` | 登录、刷新、退出、资料和用户认证接口 |
| `services/tokens.ts` | 15 分钟、带唯一标识的 access JWT 签发和验证 |
| `services/refresh-sessions.ts` | refresh 随机凭证、摘要、轮换、期限、重放检测和撤销 |
| `services/auth-cookies.ts` | HttpOnly、SameSite、Secure 和 Path 属性 |
| `services/auth-responses.ts` | 稳定认证错误码、Bearer challenge 和 no-store 响应头 |
| `config/origins.ts` | CORS 与认证动作共用的精确来源白名单 |
| `middlewares/auth.ts` | 保护普通 API，只接受 access token |

数据库表和并发轮换约束位于 `../migrations/017_create_refresh_sessions.sql`，账号状态和绝对会话期限位于 `../migrations/018_harden_auth_sessions.sql`。

**最后更新**：2026-07-14
