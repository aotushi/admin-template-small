# 删除前端零引用的遗留模块与数据表

## 背景

项目由旧模板演化而来，后端残留一批前端零引用的模块：daily-stats、products、data-reports、user-api、api-keys、files、get-async-routes，以及 auth 路由里的 register/users 端点和配套 cron 任务。它们不参与当前 RBAC 主线，却持续增加维护与审计面。

## 决定

以"前端零引用"为判据整块删除：

1. 删除对应路由、服务与 cron 代码（含 wrangler.toml 中的 triggers）。
2. 迁移 023 DROP 11 张遗留表；保留 `users`/`departments`/`roles`/`menus`/`user_roles`/`role_menus`/`refresh_sessions` 共 7 张。
3. 删除范围略超最初列举的五个模块：`files.ts`、`get-async-routes`、auth 的 `register`/`users` 端点同样满足零引用判据，一并删除。

## 已考虑并否决的替代方案

- **只下线路由、保留表结构**：回滚容易，但"表在代码无"的漂移会误导后续开发与审计，且 D1 存储持续计费，否决。
- **标记 deprecated 渐进移除**：模板项目无外部调用方，渐进期没有受益者，否决。

## 后果

- Worker 构建产物与绑定收敛（dry-run 构建 211KB，绑定只剩 DB/ENVIRONMENT/ALLOWED_ORIGINS）。
- 远程 D1 需另行执行迁移 022/023（须用户明确同意后操作，严禁自动 `--remote`）。
- 若未来需要文件上传等能力，按当前 RBAC 模型重新设计，不复用旧实现。
