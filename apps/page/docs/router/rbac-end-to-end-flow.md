# RBAC 全链路教学案例：从登录权限到菜单、路由、按钮、接口与数据范围

## 1. 这篇文档解决什么问题

RBAC 经常被一句话概括为“用户绑定角色，角色绑定权限”。这句话没有错，但不足以解释一个 Vue 后台真正运行时发生了什么：

- 登录接口为什么返回 `role` 和 `permissions` 两份数据；
- `permissions` 如何进入 Pinia；
- Vue Router 如何决定能不能进入页面；
- 左侧菜单为什么会自动减少；
- `v-permission` 为什么能让按钮消失；
- 隐藏按钮为什么不等于安全；
- 后端为什么还要重新查询权限；
- “能查看用户”和“能查看哪些用户”为什么是两个问题；
- Super 在菜单管理中停用节点，究竟会影响哪些账号；
- 修改权限以后，后端、侧边栏、当前路由和按钮为什么不一定同时变化。

本文不从数据库表名开始背概念，而是沿三个账号的真实运行过程展开：

```text
User 登录
  -> 只能进入普通页面

Admin 登录
  -> 能进入用户管理
  -> 能查看、新增、编辑
  -> 不能删除
  -> 只能管理数据范围内的用户

Super 登录
  -> 能进入用户、角色、菜单、部门管理
  -> 拥有系统管理的全部 CRUD 权限
  -> 仍受防自删、防删除系统账号等业务规则保护
```

完整主线：

```text
数据库角色和菜单绑定
  -> 后端登录时解析权限码
  -> 登录响应返回 user.permissions
  -> 内存 Session 通知 Pinia
  -> 路由守卫检查 meta.permission
  -> MainLayout 用同一规则过滤侧边栏
  -> v-permission 控制按钮
  -> Axios 携带 Access Token 请求接口
  -> 后端 requirePermission 再次实时检查
  -> 数据查询继续叠加 data_scope
```

配套阅读：

- [登录请求全链路教学案例](../auth/login-request-flow.md)：登录响应如何进入 Session、Pinia 和路由；
- [静态路由、守卫与 RBAC 菜单](route-guard-rbac.md)：当前路由方案与其他方案的比较；
- [RBAC 系统管理页教程](../system/rbac-management-pages.md)：用户、角色、菜单、部门四个维护页面；
- [双 Token 会话机制教程](../auth/dual-token-session.md)：Access Token、Refresh Cookie 和会话恢复。

## 2. 先记住五个问题

当前项目把访问控制拆成五个连续问题：

| 问题                             | 当前负责位置                                       |
| -------------------------------- | -------------------------------------------------- |
| 你是谁？                         | 登录、Access Token、`currentUser`                  |
| 你属于什么基础身份？             | `user.roles` 角色码（`user_roles` 表实时解析下发） |
| 你能做什么？                     | `user.permissions` 权限码                          |
| 你能对哪些数据做？               | 角色的 `data_scope`                                |
| 即使有权限，这次操作本身合法吗？ | 后端业务规则，例如不能删除自己                     |

可以压缩成：

```text
身份
  -> 功能权限
  -> 数据范围
  -> 具体业务保护
```

例如 Admin 修改用户：

```text
已登录
  -> 有 system:user:update
  -> 目标用户属于自己的数据范围
  -> 目标不是受保护系统账号
  -> 才允许修改
```

RBAC 不是某一个 `if`，而是这几层检查的组合。

## 3. 文件地图

| 文件                                                                                                                                           | 在 RBAC 流程中的职责                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`contracts/admin-api/src/permissions.ts`](../../../../contracts/admin-api/src/permissions.ts)                                                 | 前后端共享权限码、角色码和数据范围                       |
| [`services/api-hono/src/services/permissions.ts`](../../../../services/api-hono/src/services/permissions.ts)                                   | 从 D1 解析权限、检查权限、生成数据范围条件               |
| [`services/api-hono/src/routes/auth.ts`](../../../../services/api-hono/src/routes/auth.ts)                                                     | 登录、refresh、profile 时下发权限快照                    |
| [`services/api-hono/src/middlewares/auth.ts`](../../../../services/api-hono/src/middlewares/auth.ts)                                           | 验证 Access Token，并确认账号仍然有效                    |
| [`src/api/types.ts`](../../src/api/types.ts)                                                                                                   | 定义 `CurrentUser.permissions`                           |
| [`src/api/session.ts`](../../src/api/session.ts)                                                                                               | 保存 Access Token 和用户快照                             |
| [`src/stores/auth.ts`](../../src/stores/auth.ts)                                                                                               | 提供响应式 `currentUser`、`isSuper` 和 `isAuthenticated` |
| [`src/auth/permissions.ts`](../../src/auth/permissions.ts)                                                                                     | 判断用户是否拥有某个权限码                               |
| [`src/router/routes.ts`](../../src/router/routes.ts)                                                                                           | 声明静态路由需要的权限码                                 |
| [`src/router/access.ts`](../../src/router/access.ts)                                                                                           | 路由守卫和菜单共用的访问判断                             |
| [`src/router/guards.ts`](../../src/router/guards.ts)                                                                                           | 导航前检查登录和整条匹配路由                             |
| [`src/router/menu.ts`](../../src/router/menu.ts)                                                                                               | 从静态路由过滤生成侧边栏数据                             |
| [`src/layouts/MainLayout.vue`](../../src/layouts/MainLayout.vue)                                                                               | 响应当前用户变化并把菜单交给侧边栏                       |
| [`src/directives/permission.ts`](../../src/directives/permission.ts)                                                                           | 页面挂载时移除无权限按钮                                 |
| [`services/api-hono/src/routes/users.ts`](../../../../services/api-hono/src/routes/users.ts)                                                   | 用户接口的权限、数据范围和业务保护                       |
| [`services/api-hono/migrations/021_menus_replace_permissions.sql`](../../../../services/api-hono/migrations/021_menus_replace_permissions.sql) | 当前菜单树、角色绑定和默认权限种子                       |

## 4. 数据模型：谁把权限交给了谁

当前权限解析主链：

```text
users
  -> user_roles
  -> roles
  -> role_menus
  -> menus.auth_code
```

可以用一个 Admin 用户表示：

```text
用户：信息化运维组_admin
  -> user_roles：绑定 admin 角色
  -> roles：admin，data_scope=self，status=1
  -> role_menus：绑定用户管理相关节点
  -> menus.auth_code：
       system:user:view
       system:user:create
       system:user:update
```

这里有五张关键表：

| 表           | 作用                                                        |
| ------------ | ----------------------------------------------------------- |
| `users`      | 账号本身和所属部门（不存角色字段，角色归属见 `user_roles`） |
| `roles`      | 角色名称、状态和数据范围                                    |
| `user_roles` | 用户与角色的关联                                            |
| `menus`      | 目录、页面、按钮以及 `auth_code`                            |
| `role_menus` | 角色勾选了哪些菜单树节点                                    |

部门表 `departments` 不提供功能权限，但会参与 `dept` 数据范围计算。

### 4.1 menus 不只是左侧菜单

`menus` 有三类节点：

```text
catalog：目录，只组织层级
menu：页面，通常挂 view 权限码
button：页面内操作，通常挂 create/update/delete 权限码
```

例如：

```text
系统管理                              catalog
  -> 用户管理                         menu   system:user:view
     -> 新增用户                      button system:user:create
     -> 编辑用户                      button system:user:update
     -> 删除用户                      button system:user:delete
```

因此“角色勾选菜单树”实际是在分配页面和按钮权限，不只是决定左侧是否显示一个标题。

### 4.2 当前默认角色

共享契约中的默认种子：

| 角色    | 默认权限                                   | 数据范围 |
| ------- | ------------------------------------------ | -------- |
| `user`  | 无系统管理权限                             | `self`   |
| `admin` | 用户查看、新增、编辑                       | `self`   |
| `super` | 系统用户、角色、菜单、部门共16个 CRUD 权限 | `all`    |

最短记忆：

```text
User 使用系统
Admin 管自己范围内的用户
Super 管所有用户和权限规则
```

## 5. 权限码为什么必须前后端共享

权限码命名格式：

```text
模块:资源:动作
```

当前系统管理权限：

```text
system:user:view
system:user:create
system:user:update
system:user:delete

system:role:view
system:role:create
system:role:update
system:role:delete

system:menu:view
system:menu:create
system:menu:update
system:menu:delete

system:dept:view
system:dept:create
system:dept:update
system:dept:delete
```

前端路由、按钮和后端中间件都导入：

```ts
PERMISSION_CODES.systemUserDelete;
```

而不是各自手写：

```ts
"system:user:delete";
```

这样可以避免：

```text
前端写 system:user:remove
后端写 system:user:delete
```

造成“按钮显示但接口403”之类的拼写漂移。

## 6. 登录时，后端如何算出 permissions

登录接口验证账号和密码后调用：

```ts
const permissions = await loadPermissionCodes(c.env.DB, user.id);
```

`loadPermissionCodes()` 最终进入 `resolveUserAccess()`。核心 SQL 可以简化为：

```sql
SELECT
  u.department_id,
  r.data_scope,
  m.auth_code AS code
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r
  ON r.id = ur.role_id
  AND r.status = 1
LEFT JOIN role_menus rm ON rm.role_id = r.id
LEFT JOIN menus m
  ON m.id = rm.menu_id
  AND m.status = 1
  AND m.auth_code IS NOT NULL
WHERE u.id = ?
```

按顺序读：

```text
找到这个用户
  -> 找到绑定角色
  -> 只接受启用角色
  -> 找到角色绑定节点
  -> 只接受启用且有 auth_code 的节点
  -> 收集权限码
```

同时计算数据范围：

```text
all > dept > self
```

如果一个用户有多个角色，设计上：

- 权限码取并集；
- 数据范围取最强档；
- 重复权限码用 `Set` 去重。

如果用户没有任何有效角色：

```text
permissions = 空集合
dataScope = self
```

这是最小权限兜底。

## 7. 权限为什么不放进 Access Token

Access Token 只携带识别用户所需的基础字段：

```text
id
username
```

角色码不依赖 token：`authMiddleware` 每次请求都从 `user_roles` 表实时解析。

权限码不签进 JWT。原因是：

```text
如果权限在15分钟 token 里
  -> Super 回收权限
  -> 旧 token 没过期
  -> 后端仍可能接受旧权限
```

当前后端对受保护接口实时查询 D1，因此角色、角色绑定或菜单状态改变后，下一次接口请求立即按新规则执行。

登录、refresh 和 profile 返回给前端的 `user.permissions` 则是一个界面快照，用于菜单、路由和按钮体验。

## 8. 权限快照如何进入 Pinia

后端返回：

```ts
{
  accessToken: "eyJ...",
  user: {
    username: "jack",
    roles: ["user"],
    permissions: [],
  },
}
```

前端登录协调器执行：

```text
acceptSession(result)
  -> authSessionStore.save(result)
  -> saveAuthSession(result)
  -> session.currentUser = result.user
  -> notifySessionListeners()
  -> Pinia currentUser.value = nextSession.currentUser
```

详细调用链见[登录请求全链路教学案例](../auth/login-request-flow.md)。本篇从 Pinia 已经得到以下状态继续：

```ts
authStore.currentUser;
authStore.isSuper;
authStore.isAuthenticated;
```

## 9. roles 和 permissions 为什么同时存在

后端在每次登录/刷新时下发两个数组，分工不同：

```text
roles：角色码列表（user_roles 表实时解析），只用于展示和 super 专属规则
permissions：权限码列表，路由、菜单、按钮显隐的唯一判定依据
```

角色码目前用于：

- Dashboard 顶部的角色展示；
- "只有 Super 才能分配角色"的入口显隐（`authStore.isSuper`）。

权限码用于：

- 系统管理四个业务页面的路由和菜单；
- 新增、编辑、删除按钮；
- 后端 CRUD 接口。

前端不再做"后端字段 -> 前端访问角色"的归一映射（原 `src/auth/rbac.ts` 已随 `users.role / users.admin_level` 字段删除一并移除，见迁移 022）。

## 10. 路由如何声明访问条件

前端路由是静态代码，不是登录后从 `menus` 表动态生成。

Dashboard（无权限码，登录即可访问）：

```ts
meta: {
  requiresAuth: true,
  title: "概览",
}
```

系统管理父容器（自身不设权限码，子项全被过滤后菜单整组隐藏）：

```ts
meta: {
  requiresAuth: true,
  title: "系统管理",
}
```

用户管理子页面：

```ts
meta: {
  permission: PERMISSION_CODES.systemUserView,
  title: "用户管理",
}
```

菜单管理子页面：

```ts
meta: {
  permission: PERMISSION_CODES.systemMenuView,
  title: "菜单管理",
}
```

判定是单轨的：

```text
声明了 permission 的路由看权限码
未声明的路由登录即可访问
```

## 11. 路由访问算法

`access.ts` 的核心规则：

```ts
function canAccessMeta(meta, user) {
  if (meta?.permission) {
    return hasPermission(user, meta.permission);
  }

  return true;
}
```

解释：

```text
声明了 permission
  -> 只检查权限码

没有声明 permission
  -> 这一层不增加额外限制（登录检查由 requiresAuth 负责）
```

路由守卫对 `to.matched` 中的每一层执行：

```ts
to.matched.every((record) => canAccessMeta(record.meta, user));
```

所以访问 `/system/users` 时，不只检查最后的用户页面，还会检查：

```text
根布局 /
  -> 系统管理父路由 /system
     -> 用户管理 /system/users
```

任意一层失败，就进入 `/403`。

## 12. User 登录后的完整过程

以 `jack` 为例，后端返回：

```ts
currentUser = {
  username: "jack",
  roles: ["user"],
  permissions: [],
};
```

### 12.1 进入 Dashboard

检查：

```text
根布局：需要登录，jack 已登录，通过
Dashboard：无权限码声明，登录即可访问，通过
```

因此渲染：

```text
App.vue
  -> MainLayout.vue
     -> DashboardView.vue
```

### 12.2 生成侧边栏

`MainLayout` 计算：

```ts
const menus = computed(() => createMenuItems(appRoutes, authStore.currentUser));
```

逐条过滤：

```text
概览：无权限码限制，保留
公共组件：无权限码限制，保留
系统管理：四个子页面的权限码 jack 都没有，子项全被过滤，整组隐藏
```

jack 最终看到：

```text
概览
公共组件
```

### 12.3 强行输入 `/system/users`

匹配链：

```text
根布局：通过
/system：无权限码声明，通过
/system/users：需要 system:user:view，jack 没有，失败
```

守卫跳转 `/403`，`UserManagementView` 不进入正常挂载。

### 12.4 强行调用后端接口

即使绕过 Vue，直接请求：

```http
GET /admin/api/users/list
Authorization: Bearer <jack-access-token>
```

后端仍执行：

```text
authMiddleware：token 有效、账号启用
requirePermission(system:user:view)：权限集合不包含该码
返回 403 FORBIDDEN
```

最短复述：

> User 登录后有身份但没有系统管理权限；前端不显示入口，路由守卫不挂载页面，后端接口仍会独立返回403。

## 13. Admin 登录后的完整过程

默认 Admin 返回：

```ts
currentUser = {
  roles: ["admin"],
  permissions: ["system:user:view", "system:user:create", "system:user:update"],
};
```

### 13.1 侧边栏过滤

系统管理父路由自身无权限码，逐条过滤子路由：

| 子页面   | 所需权限           | Admin 是否拥有 | 结果 |
| -------- | ------------------ | -------------- | ---- |
| 用户管理 | `system:user:view` | 是             | 显示 |
| 角色管理 | `system:role:view` | 否             | 隐藏 |
| 菜单管理 | `system:menu:view` | 否             | 隐藏 |
| 部门管理 | `system:dept:view` | 否             | 隐藏 |

最终侧边栏：

```text
系统管理
  -> 用户管理
```

### 13.2 进入用户管理

路由匹配链：

```text
根布局：已登录，通过
/system：无权限码声明，通过
/system/users：有 system:user:view，通过
```

所以 `UserManagementView.vue` 被加载并挂载。

### 13.3 页面按钮

用户管理页声明：

```vue
<ElButton v-permission="PERMISSION_CODES.systemUserCreate">
  新增用户
</ElButton>

<span v-permission="PERMISSION_CODES.systemUserUpdate">
  <ElButton>编辑</ElButton>
</span>

<span v-permission="PERMISSION_CODES.systemUserDelete">
  <ElButton>删除</ElButton>
</span>
```

Admin 权限：

```text
create：有
update：有
delete：没有
```

页面挂载后：

```text
新增：保留
编辑：保留
删除：从 DOM 移除
```

### 13.4 用户列表仍然不是全部数据

Admin 默认 `data_scope=self`。用户列表接口虽然通过 `system:user:view`，还会追加：

```sql
u.created_by = 当前Admin用户ID
```

因此：

```text
权限问题：Admin 能不能查看用户？能。
范围问题：Admin 能查看哪些用户？默认只看自己创建的。
```

### 13.5 编辑接口还有行级检查

Admin 调用：

```http
PUT /api/users/123
```

后端检查：

```text
有 system:user:update
  -> 目标用户是否由当前 Admin 创建
  -> 是否试图修改受保护账号
  -> 是否试图越权修改角色
```

权限码通过，不代表任何一行都能修改。

最短复述：

> Admin 能进入用户管理并看到新增、编辑，但没有删除权限；接口还会按 `self` 范围限制只能管理自己创建的用户。

## 14. Super 登录后的完整过程

Super 返回：

```ts
currentUser = {
  roles: ["super"],
  permissions: [
    // system:user/role/menu/dept 的全部 CRUD，共16个
  ],
};
```

### 14.1 侧边栏和页面

Super：

- 拥有用户、角色、菜单、部门四个 `view` 权限；
- 所以看到四个系统管理页面；
- 拥有全部 create/update/delete，所以看到全部操作按钮。

### 14.2 数据范围

Super 默认：

```text
data_scope=all
```

用户列表查询不追加范围条件，因此可以查看所有用户。

### 14.3 Super 仍然不是无条件绕过

后端还有业务保护：

```text
不能删除自己
不能删除受保护系统账号
不能删除最后一个总管理员
不能编辑或删除内置 super 角色
不能删除仍绑定用户的角色
不能删除存在子节点的菜单
不能删除存在子部门或成员的部门
```

所以 Super 的含义是“默认拥有全部权限码和全部数据范围”，不是“后端所有规则都跳过”。

## 15. 侧边栏为什么与路由守卫一致

侧边栏不是另外维护一份权限配置。

数据流：

```text
appRoutes 静态路由
  -> createMenuItems(routes, currentUser)
  -> canAccessRouteMeta
  -> 与路由守卫相同的 canAccessMeta
  -> 过滤无权限节点
  -> AdminSidebar props
  -> AdminMenuItems 递归渲染
```

菜单和守卫共用：

```ts
canAccessMeta(meta, user);
```

因此正常情况下：

```text
菜单看不到
  -> 手动输入地址也会被守卫拦截
```

但要记住：这仍然只是浏览器体验层，不能代替后端授权。

## 16. 按钮指令的真实行为

`v-permission` 注册在应用入口，页面挂载时执行：

```ts
function applyPermission(el: HTMLElement, code: string | undefined) {
  const authStore = useAuthStore();
  if (!hasPermission(authStore.currentUser, code)) {
    el.parentNode?.removeChild(el);
  }
}

export const permissionDirective = {
  mounted(el, binding) {
    applyPermission(el, binding.value);
  },
};
```

判断本身：

```ts
user?.permissions?.includes(code) ?? false;
```

缺少权限时是移除 DOM，不是 `display: none`。

### 16.1 当前指令的响应式边界

指令只有 `mounted`，没有 `updated`。因此：

```text
组件首次挂载
  -> 按当时的 currentUser.permissions 处理按钮

页面保持挂载时静默 refresh
  -> Pinia currentUser 会替换
  -> 已存在按钮不会自动再次执行 mounted
  -> 已移除按钮也不会凭空恢复
```

所以当前准确行为是：

- 重新登录、F5 或离开再回来导致组件重新挂载时，按钮按最新权限重建；
- 同一页面静默 refresh 后，侧边栏 `computed` 会响应，但按钮不保证立刻同步；
- 无论按钮是否暂时陈旧，后端权限都按数据库立即执行。

这是当前实现边界，不应把按钮显隐当作安全来源。

## 17. 后端为什么还要 `requirePermission`

浏览器中的所有前端代码都可以被绕过：

```text
用户可以手写 fetch
可以用 curl/Postman
可以修改浏览器里的 JavaScript
可以直接请求已知 API
```

所以写接口成对声明后端权限：

```ts
users.post(
  "/create",
  authMiddleware,
  requirePermission(PERMISSION_CODES.systemUserCreate),
  handler,
);
```

请求链：

```text
Axios 加 Authorization Bearer
  -> authMiddleware 验证 token
  -> 再查 users，确认账号仍存在且启用
  -> requirePermission 实时解析角色和启用菜单
  -> 有权限才进入 handler
```

`getUserAccess()` 会把解析结果缓存在当前 Hono 请求的 context 中。同一个请求里权限检查和数据范围过滤可以重复读取，但只查一次权限链。

## 18. 功能权限与数据范围

功能权限回答：

```text
能不能查看用户？
能不能编辑用户？
```

数据范围回答：

```text
能查看哪些用户？
能编辑哪些用户？
```

三档范围：

| 范围   | 含义                 | 用户列表条件                        |
| ------ | -------------------- | ----------------------------------- |
| `all`  | 全部                 | 不追加限制                          |
| `dept` | 本部门及全部下级部门 | 递归部门树后按 `department_id` 过滤 |
| `self` | 自己创建             | `created_by = currentUser.id`       |

`dept` 用户没有所属部门时降级为 `self`，不会扩大到全部数据。

当前数据范围已经用于用户列表和相关部门分配场景，但不是自动覆盖所有业务表的全局框架。其他报表、文件、API Key 等业务仍需要各自接入。

## 19. 菜单管理的启用/停用影响谁

只有默认 Super 拥有：

```text
system:menu:view
```

所以默认只有 Super 能打开 `/system/menus`。这表示：

```text
谁有资格修改权限规则
```

不表示：

```text
修改只对 Super 自己生效
```

菜单节点状态是全局数据。后端解析任何用户时都会要求：

```sql
m.status = 1
```

因此停用某节点，会影响所有通过角色绑定了该节点的用户。

### 19.1 停用编辑用户按钮节点

停用：

```text
system:user:update
```

默认影响：

| 用户  | 原本拥有 | 停用后          |
| ----- | -------- | --------------- |
| User  | 否       | 无明显变化      |
| Admin | 是       | 编辑接口立即403 |
| Super | 是       | 编辑接口立即403 |

### 19.2 停用用户管理页面节点

停用：

```text
system:user:view
```

Admin 和 Super 都失去该权限码：

- 后端用户列表接口立即403；
- 下次登录或 refresh 后，前端权限快照删除该码；
- 侧边栏响应新快照并隐藏用户管理；
- 当前已经打开的页面不会因为数据库变化自动收到推送，需等 refresh/导航等事件；
- 路由守卫在下一次相关导航时按新快照拦截。

### 19.3 停用菜单管理自身

如果停用：

```text
system:menu:view
```

Super 自己也会失去菜单管理页面权限，因为当前后端没有“Super 永远绕过 menus.status”的特殊分支。

如果继续停用：

```text
system:menu:update
```

后续连直接调用更新接口也会403，可能造成权限管理锁死。当前项目保护了内置 `super` 角色不可编辑/删除，但没有对关键菜单节点做同等级的防锁死保护。

### 19.4 停用 catalog 不会自动停用子节点

“系统管理”目录是 `catalog`，通常没有 `auth_code`。当前后端只检查每个具体菜单记录自己的 `status`，没有沿父链检查祖先状态。

因此：

```text
系统管理 catalog：停用
用户管理 menu：启用
system:user:view：仍可能被解析
```

当前没有“父目录停用自动让整棵子树权限失效”的级联语义。

## 20. 修改权限后的生效时间

需要分四个位置看：

| 位置                            | 何时读取权限                   | 生效时间                 |
| ------------------------------- | ------------------------------ | ------------------------ |
| 后端接口                        | 每个受保护请求实时查 D1        | 下一次请求立即生效       |
| Pinia `currentUser.permissions` | 登录、refresh、profile 响应    | 下一次快照刷新           |
| 侧边栏 `menus`                  | `computed` 依赖 Pinia 当前用户 | Pinia 快照更新后自动重算 |
| 当前路由守卫                    | 每次导航                       | 下一次导航时检查最新快照 |
| `v-permission` 按钮             | 指令 `mounted`                 | 组件重新挂载时完整同步   |

### 回收权限

```text
Super 取消 Admin 的 delete
  -> Admin 下一次删除接口立即403
  -> 当前按钮可能暂时存在
  -> 下次 Session 快照更新后 Pinia 得到新 permissions
  -> 组件重新挂载后按钮消失
```

安全边界没有延迟，因为后端已经拒绝。

### 授予权限

```text
Super 给 Admin 增加 delete
  -> 后端下一次删除接口已经允许
  -> 前端旧快照仍不知道
  -> 登录/refresh/profile 后 Pinia 得到新码
  -> 组件重新挂载后按钮出现
```

当前项目没有使用 WebSocket 主动推送权限变更。

## 21. 页面刷新时权限如何恢复

F5 后，内存 Access Token 和 Pinia 消失，但 HttpOnly Refresh Cookie 仍在。

路由守卫执行：

```text
restoreSession
  -> POST /api/auth/refresh
  -> 浏览器自动携带 Refresh Cookie
  -> 后端重新查询用户、角色、菜单状态
  -> 返回新 Access Token + 最新 permissions
  -> saveAuthSession
  -> Pinia 恢复
  -> 路由守卫继续
  -> 菜单和按钮按新组件实例重新生成
```

所以 F5 是最完整的一次前端权限重新同步：Session、Pinia、路由导航和组件挂载都会重新发生。

## 22. 当前静态路由与后端 menus 的关系

当前有两套“菜单形态”，职责不同：

```text
前端 appRoutes
  -> 真正注册 Vue Router 组件
  -> 派生左侧侧边栏

后端 menus 表
  -> 角色分配页面/按钮权限的数据树
  -> 当前不直接生成 Vue 路由
```

因此在数据库新增一条：

```text
path=/system/example
component=views/system/ExampleView.vue
```

不会自动让前端拥有这个页面。仍需在 `routes.ts` 注册组件和权限码。

当前方案优点是容易阅读和调试；代价是新增页面需要前后端同时登记。

## 23. 当前模型尚未闭环的地方

### 23.1 自定义角色分配（已闭环）

用户表单的角色选项从 `/api/roles` 动态加载（仅总管理员会拉取），多选提交 `roles: string[]`，自定义角色可直接从页面分配，一人可绑定多个角色。`super` 不可与其他角色叠加（前后端同规则校验）。详见 ADR-0002。

### 23.2 `/system` 父路由的角色限制（已闭环）

历史上父路由声明 `roles: ["super", "admin"]`，导致绑定了 `system:user:view` 的自定义角色仍进不了 `/system/users`。`meta.roles` 删除后父容器不再设限：任何角色只要拿到子页面权限码即可访问，菜单层在子项全被过滤时整体隐藏空目录。

### 23.3 部分旧接口仍使用角色中间件

系统管理四个主要 CRUD 已使用 `requirePermission`，但部分接口仍使用角色码判断：

```text
isAnyAdmin / isSuperAdmin（基于每请求从 user_roles 实时解析的 role_codes，不来自 token）
```

因此后端目前是权限码 RBAC 与角色码判断并存，不是所有接口都已经迁移到纯权限码。

### 23.4 按钮指令不是响应式权限组件

`v-permission` 只在 `mounted` 时移除元素。要实现无刷新即时增删按钮，需要重新设计成响应式组件、`v-if` 判定或支持更新/重建的指令方案。

## 24. 推荐调试顺序

### 24.1 登录权限快照

依次观察：

```text
后端 serializeUser(..., permissions)
  -> 前端登录 result.user.permissions
  -> session.currentUser.permissions
  -> authStore.currentUser.permissions
```

### 24.2 路由与菜单

断点顺序：

```text
router/guards.ts
  -> canAccessMatchedRoute
  -> access.ts canAccessMeta
  -> hasPermission
```

侧边栏：

```text
MainLayout menus computed
  -> createMenuItems
  -> canAccessRouteMeta
  -> AdminSidebar props.menus
```

对比三个账号时重点观察：

```text
currentUser.roles
currentUser.permissions
route.meta.permission
```

### 24.3 按钮

在指令中观察：

```ts
binding.value
authStore.currentUser.permissions
hasPermission(...)
```

Admin 的删除按钮应看到：

```text
binding.value = system:user:delete
permissions 不包含该码
hasPermission = false
元素被移除
```

### 24.4 后端接口

观察：

```text
authMiddleware 中 currentUser
resolveUserAccess 返回 permissionCodes/dataScope
requirePermission 需要的 code
buildUsersScopeCondition 生成的 condition/params
```

## 25. 三个账号的一页式对比

| 观察点             | User       | Admin                   | Super                         |
| ------------------ | ---------- | ----------------------- | ----------------------------- |
| `user.roles`       | `["user"]` | `["admin"]`             | `["super"]`                   |
| 默认系统权限       | 无         | 用户 view/create/update | 全部16个                      |
| 系统管理菜单目录   | 整组隐藏   | 显示                    | 显示                          |
| 用户管理           | 不显示     | 显示                    | 显示                          |
| 角色/菜单/部门管理 | 不显示     | 不显示                  | 显示                          |
| 新增用户           | 不可访问   | 显示                    | 显示                          |
| 编辑用户           | 不可访问   | 显示                    | 显示                          |
| 删除用户           | 不可访问   | 不显示、接口403         | 显示，但仍不能自删/删系统账号 |
| 用户数据范围       | 无管理入口 | 默认自己创建            | 全部                          |

## 26. 完整流程总复习

```text
Super 在角色管理勾选 menus 树
  -> role_menus 保存绑定

用户登录或 refresh
  -> 后端 resolveUserAccess
  -> user -> user_roles -> roles(status=1)
  -> role_menus -> menus(status=1).auth_code
  -> 返回 user.permissions 快照

前端保存 Session
  -> notifySessionListeners
  -> Pinia currentUser 更新

Vue Router 导航
  -> matched 每层检查
  -> 声明了 permission 的层查权限码
  -> 未声明的层不加额外限制
  -> 失败跳 /403

MainLayout
  -> 同一访问函数过滤 appRoutes
  -> 生成侧边栏

页面挂载
  -> v-permission 对照 permissions
  -> 缺码按钮从 DOM 移除

用户操作
  -> Axios 携带 Access Token
  -> authMiddleware 验证身份和账号状态
  -> requirePermission 实时查 D1
  -> 数据查询叠加 data_scope
  -> 业务规则继续检查目标对象
  -> 放行或返回403
```

## 27. 最短复述

> 用户登录或刷新会话时，后端沿“用户—角色—菜单节点”关系计算权限码，并把权限快照放进 `user.permissions`。前端保存用户后，路由守卫用 `meta.permission` 决定页面能否进入，`MainLayout` 用同一规则过滤静态路由生成侧边栏，`v-permission` 在组件挂载时移除无权限按钮。真正调用接口时，后端不会相信前端，而是重新实时解析权限；查询数据时还会叠加 `all/dept/self` 数据范围。User 默认没有系统管理权限，Admin 默认能查看、新增、编辑自己范围内的用户，Super 默认拥有系统管理全部权限和全部数据，但仍受具体业务保护。

再压缩成一句：

```text
角色给能力，数据范围管对象；前端管入口，后端管安全。
```

## 28. 自测题

1. User 没有系统菜单时，手动输入 `/system/users` 会在哪几层失败？
2. Admin 为什么能进入用户管理，却看不到删除按钮？
3. Admin 有 `system:user:view`，为什么仍然看不到所有用户？
4. 为什么前端隐藏删除按钮后，后端还必须挂 `requirePermission`？
5. Super 停用 `system:user:update`，会只影响自己吗？
6. 为什么停用“系统管理”catalog 不一定让子页面权限失效？
7. 后端权限为什么不签进 Access Token？
8. 权限回收后，后端接口、侧边栏、当前路由和按钮分别何时变化？
9. 给普通 user 角色增加 `system:user:view` 后，已登录用户为什么要等下一次令牌刷新才能进 `/system/users`？
10. `publish()` 和 RBAC 本身是什么关系？它只负责把包含权限快照的 Session 同步给其他标签页，不负责计算权限。
