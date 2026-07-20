# 用户手动实现项目

## 项目创建

### 背景

#### 基本架构

- 后台管理项目; vite+工具链; vue3.5+, elementPlus

#### 业务范围

##### 1. 权限闭环

前 6 项构成第一版主线：`用户 -> 角色 -> 权限 -> 菜单 / 页面 / 按钮`。

| 能力            | 第一版要求                                                                              |
| --------------- | --------------------------------------------------------------------------------------- |
| Layout 布局系统 | Vben 风格后台布局；包含侧边栏、顶部栏、面包屑、内容区、暗黑模式基础能力、响应式基础适配 |
| 路由系统        | 支持静态路由 + 前端权限过滤；预留后端动态路由和混合模式扩展点；包含路由守卫和错误页     |
| 认证体系        | 登录、登出、Token 管理、登录态恢复、未登录拦截                                          |
| 用户角色        | 支持角色定义、角色绑定权限、给用户分配角色                                              |
| 权限系统        | 支持菜单权限、页面权限、按钮级权限；数据权限作为后续扩展点                              |
| 用户管理        | 作为标准 CRUD 示范模块，包含用户列表、新增、编辑、删除、状态管理、角色绑定              |

##### 2. 基础设施

| 能力             | 第一版要求                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| API & 前端请求层 | 请求封装、Token 注入、统一错误处理、错误码约定、环境切换、基础 Mock 方案                                       |
| 状态管理         | Pinia 分层管理：认证、用户、权限、应用、字典；必要状态持久化                                                   |
| UI 系统          | Element Plus 作为实现库；视觉、布局和交互模式对齐 Vben；沉淀布局组件、菜单组件、列表页组件、权限按钮等通用组件 |

#### UI 来源约束

当前项目前端迁移遵守一条硬规则：

```text
旧项目只保留数据、接口、业务流程和权限逻辑；
页面 UI、布局、表单、表格、工具栏和交互模式统一参考 Vben 案例项目重新实现。
```

这意味着后续迁移 `admin-backend/frontend` 中的页面时，不能直接沿用旧页面样式。旧项目用于确认“有哪些页面、调用哪些接口、展示哪些数据、有哪些业务动作”，最终页面外观仍然按 Vben 风格拆解实现。

##### 3. 复用能力与工程保障

| 能力           | 第一版要求                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------- |
| 通用 CRUD 能力 | 先在用户管理模块中形成列表、搜索、分页、筛选、表单弹窗/抽屉的标准写法；沉淀 CRUD 页面组件封装 |
| 数据字典       | 建立前端字典骨架，后续对接后端字典接口                                                        |
| 国际化 i18n    | 建立中英文多语言骨架，默认中文                                                                |
| 工程化         | 使用 Vite+ 负责格式化、检查、构建；保持类型清晰、目录清晰、命令清晰                           |

## 项目架构设计

前端架构设计记录在 `docs/architecture` 目录中，用于约束后台布局、菜单、权限、页面迁移和顶部工具区的实现边界。

| 主题                          | 文档                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| v1 后台布局、菜单与 RBAC 设计 | [docs/architecture/v1-admin-layout-and-rbac.md](docs/architecture/v1-admin-layout-and-rbac.md)                 |
| 后台面板 CSS 布局最佳实践     | [docs/architecture/css-admin-layout-best-practices.md](docs/architecture/css-admin-layout-best-practices.md)   |
| 主题偏好与 CSS Token 设计     | [docs/architecture/theme-preferences-and-css-tokens.md](docs/architecture/theme-preferences-and-css-tokens.md) |

## 技术点目录

`page` 的学习文档放在 `docs` 目录，用于记录技术方案在当前项目中的用法，以及和其它方案的优缺点比较。

| 技术点                               | 文档                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| CSS 布局：后台面板布局最佳实践       | [docs/architecture/css-admin-layout-best-practices.md](docs/architecture/css-admin-layout-best-practices.md)   |
| 主题系统：偏好设置与 CSS Token       | [docs/architecture/theme-preferences-and-css-tokens.md](docs/architecture/theme-preferences-and-css-tokens.md) |
| 请求层：Axios + Pinia Colada         | [docs/request/axios-pinia-colada.md](docs/request/axios-pinia-colada.md)                                       |
| 认证体系：双 Token 会话与刷新判断    | [docs/auth/dual-token-session.md](docs/auth/dual-token-session.md)                                             |
| 登录接口：为什么使用 mutation        | [docs/auth/login-mutation.md](docs/auth/login-mutation.md)                                                     |
| 路由系统：静态路由、守卫与 RBAC 菜单 | [docs/router/route-guard-rbac.md](docs/router/route-guard-rbac.md)                                             |
| 状态管理：Pinia 与 Pinia Colada 边界 | [docs/state/pinia-vs-pinia-colada.md](docs/state/pinia-vs-pinia-colada.md)                                     |
| 系统模块：用户管理模块 v1            | [docs/system/user-management-v1.md](docs/system/user-management-v1.md)                                         |
| 工程化：Vite+ 工具链                 | [docs/toolchain/vite-plus.md](docs/toolchain/vite-plus.md)                                                     |

文档总入口：[docs/README.md](docs/README.md)

## 当前基础设施基线

本项目先通过 `vp create vue` 生成 Vue 项目，再手动标准化到 `apps/page` 的基础配置。

### 创建选择

| 项目         | 选择                       | 说明                                   |
| ------------ | -------------------------- | -------------------------------------- |
| TypeScript   | 启用                       | 后台管理项目默认使用类型约束           |
| Router       | 启用                       | 后续承载登录页、布局页、业务页和守卫   |
| Pinia        | 启用                       | 承载认证、用户、权限、应用等本地状态   |
| Pinia Colada | 手动添加                   | 承载接口数据缓存、刷新、失效和查询状态 |
| Vitest       | 启用                       | 用于基础设施和业务逻辑测试             |
| ESLint       | 不启用                     | 由 Vite+ 的 `vp check` 统一覆盖        |
| Prettier     | 不启用                     | 由 Vite+ 的 `vp check --fix` 统一覆盖  |
| E2E          | 暂不启用                   | 等核心页面稳定后再引入                 |
| UI           | 后续添加 Element Plus 依赖 | 与 `apps/page` 保持一致                |

### 命令基线

在 `apps/page` 内可执行：

```text
pnpm dev
pnpm build
pnpm check
pnpm fix
pnpm test
```

在项目根目录可执行：

```text
pnpm dev:page
pnpm build:page
pnpm test:page
pnpm fix:page
```

### 配置基线

| 文件             | 当前策略                                                           |
| ---------------- | ------------------------------------------------------------------ |
| `package.json`   | 使用 `vp` 统一开发、检查、修复、测试和构建命令                     |
| `vite.config.ts` | 集中配置 Vite、Vite+、Element Plus、代理、构建、格式化、检查、测试 |
| `tsconfig.json`  | 使用单文件 TypeScript 配置，不保留 Vue 官方脚手架的多文件拆分      |
| `.env.*`         | 使用和 `apps/page` 一致的环境变量命名                              |

### 请求与状态基线

| 层级         | 当前工具     | 说明                                                   |
| ------------ | ------------ | ------------------------------------------------------ |
| HTTP 传输层  | Axios        | 负责请求发送、内存 Token 注入、Cookie 刷新、错误归一化 |
| 服务端状态层 | Pinia Colada | 负责接口数据查询缓存、去重、刷新和失效                 |
| 客户端状态层 | Pinia        | 负责登录态、用户、权限、布局等本地状态                 |

`page` 已经完成 Pinia Colada 基础接入，并保留同名 `auth` query/mutation key 作为学习样板。登录页现在通过 `auth.login` mutation 调用登录接口。

## 本地演示账号

`page` 的快速登录账号和本地 Hono D1 数据库保持一致：

| 展示名称 | 用户名  | 密码     | 角色（user_roles 绑定） |
| -------- | ------- | -------- | ----------------------- |
| Super    | `vben`  | `123456` | super                   |
| Admin    | `admin` | `123456` | admin                   |
| User     | `jack`  | `123456` | user                    |
