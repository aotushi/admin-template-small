# Admin Backend 3 Hono API

基于 Hono、Cloudflare Workers 和 D1 的后台管理 API。第一版先部署到 Cloudflare，后续其它语言后端继续遵守 `contracts/admin-api` 中的同一份接口契约。

## 本地启动

```bash
pnpm install
pnpm --dir services/api-hono db:migrate:local
pnpm --dir services/api-hono dev
```

默认地址：

- 健康检查：`http://localhost:8788/admin/health`
- API 根路径：`http://localhost:8788/admin/`

复制 `.dev.vars.example` 为 `.dev.vars`，并把示例密钥替换为足够长的本地随机值。`.dev.vars` 已被 Git 忽略。

## 认证设计

项目使用加固后的双 Token 会话：

| 内容 | 行为 |
| ---- | ---- |
| access token | 15 分钟 JWT，通过登录或刷新响应返回；前端只保存在页面内存 |
| refresh 凭证 | 随机凭证，只通过 HttpOnly Cookie 传输；空闲 7 天、最长 30 天 |
| refresh 数据 | D1 只保存 SHA-256 摘要，不保存原始凭证 |
| 刷新 | 每次成功后作废旧凭证并签发新凭证 |
| 重放 | 已轮换凭证再次使用时，撤销整组登录会话 |
| 退出 | 服务端撤销整组 refresh 会话并清除 Cookie |
| 账号停用 | 受保护请求发现账号不可用后，撤销该账号全部 refresh 会话 |
| 错误契约 | 使用稳定认证错误码；只有明确的 access token 过期允许前端刷新 |

认证接口：

- `POST /admin/api/auth/login`
- `POST /admin/api/auth/refresh`，无请求体
- `POST /admin/api/auth/logout`
- `GET /admin/api/auth/profile`

浏览器端登录、刷新和退出必须来自精确允许的 Origin。生产前端和 API 分别为 `https://admin.9shi.cc` 与 `https://api.9shi.cc`。

## 本地演示账号

| 展示名称 | 用户名  | 密码     | 角色（user_roles 绑定） |
| -------- | ------- | -------- | ----------------------- |
| Super    | `vben`  | `123456` | super                   |
| Admin    | `admin` | `123456` | admin                   |
| User     | `jack`  | `123456` | user                    |

角色归属唯一存于 `user_roles` 表（一人可多角色），无"管理员层级"字段，详见 `docs/adr/0002-true-multi-role-rbac.md`。

## 生产部署前置条件

1. 为 Worker 设置生产密钥，不能把真实值写入仓库：

```bash
pnpm --dir services/api-hono exec wrangler secret put JWT_SECRET
```

2. 先在本地验证全部迁移，再由操作者明确确认后执行远程迁移：

```bash
pnpm --dir services/api-hono exec wrangler d1 migrations apply admin-backend-db --remote
```

3. 构建检查：

```bash
pnpm --dir services/api-hono build
```

远程 D1 迁移不会由自动化流程自行执行。

## 主要目录

```text
services/api-hono/
  migrations/       D1 数据库迁移
  src/config/       Origin 等运行配置
  src/middlewares/  认证、权限和安全中间件
  src/routes/       业务接口
  src/services/     Token、Cookie、刷新会话和业务服务
  wrangler.toml     Worker、D1、域名和定时任务配置
```
