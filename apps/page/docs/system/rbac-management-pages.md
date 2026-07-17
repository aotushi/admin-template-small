# RBAC 系统管理页教程：从一颗消失的按钮开始，走通用户 / 角色 / 菜单 / 部门四个页面

用两个账号先后登录后台，打开用户管理页：`super`（总管理员）能看到「新增用户」「编辑」「删除」；换成 `admin`（子管理员），「删除」按钮消失了，界面上没有任何报错，就像它从来不存在。更进一步，如果 `admin` 绕过界面直接 `curl` 删除接口，会收到一个 403：`权限不足（system:user:delete）`。

这颗按钮为什么会消失？消失就安全了吗？那串 `system:user:delete` 从哪来、存在哪、谁分配、改了之后什么时候生效？把这串问题追到底，恰好就把系统管理的四个页面（用户 / 角色 / 菜单 / 部门）全部走了一遍——它们不是四个孤立的 CRUD 页，而是同一条权限链上的四个维护入口。

配套阅读：路由级权限（进不进得了这个页面）见 [路由守卫与 RBAC](../router/route-guard-rbac.md)；请求层与查询层的通用机制见 [Axios + Pinia Colada 教程](../request/axios-pinia-colada.md)。本文只讲权限模型与四个管理页本身。

## 我们要解决的问题

| 步骤 | 问题                                           |
| ---- | ---------------------------------------------- |
| 1    | 一颗按钮的显示与消失由什么决定                 |
| 2    | 前端藏住按钮就安全了吗——后端怎么成对拦截       |
| 3    | 权限码从哪来——一条 SQL 的解析链                |
| 4    | 权限码为什么挂在"菜单"上，而不是一张权限表     |
| 5    | 维护这棵树：菜单管理页的树表格怎么搭           |
| 6    | 一个抽屉表单怎么伺候三种节点类型               |
| 7    | 上级节点怎么选才不会选出环                     |
| 8    | 删除一个节点会连带发生什么                     |
| 9    | 怎么把树勾给角色——半选状态的存储口径           |
| 10   | 角色能看到多少"行"数据——data_scope 三档        |
| 11   | 部门页与用户页：同一套路的变体与各自的特殊规则 |
| 12   | 改完权限，什么时候生效                         |

## 步骤 1：按钮为什么会消失——v-permission 与权限码

回到那颗「删除」按钮。它在模板里是这样写的（`src/views/system/users/UserManagementView.vue`）：

```html
<span v-permission="PERMISSION_CODES.systemUserDelete">
  <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
</span>
```

`v-permission` 是一个自定义指令（`src/directives/permission.ts`），逻辑只有一句话：当前登录用户的权限码列表里没有这个码，就把元素**从 DOM 里移除**：

```ts
function applyPermission(el: HTMLElement, code: string | undefined) {
  const authStore = useAuthStore();
  if (!hasPermission(authStore.currentUser, code)) {
    el.parentNode?.removeChild(el);
  }
}
```

两个容易想歪的地方：

- **为什么是移除而不是 `v-if` / `v-show`？** `v-show` 只是 `display: none`，控制台改一行样式就能复原；`v-if` 当然也行，但要在每个按钮上手写 `v-if="hasPermission(...)"`，权限判断散落在各处。指令把"取当前用户 + 判权限 + 移除元素"收敛成一个词，且移除后无法被样式复原。
- **指令没有做响应式更新**，权限变了按钮不会自己长回来。这不是偷懒——权限变更只发生在登录 / 刷新令牌之后，页面本来就会重建（步骤 12 展开）。

判定本身是个纯函数（`src/auth/permissions.ts`）：`user.permissions.includes(code)`。数据源是后端在登录 / 刷新 / 用户资料接口里下发的 `user.permissions` 数组。于是问题下移一层：这个数组是谁算出来的？先按住，步骤 3 回答。

**动手验证**：分别用 super 和 admin 登录，对比用户页操作列；在控制台跑 `document.querySelectorAll('.el-button--danger')`——admin 账号下删除按钮根本不在 DOM 里，而不是被隐藏。

## 步骤 2：藏住按钮不等于安全——后端成对拦截与共享常量

按钮消失只是体验优化：不给用户展示一个点了必失败的入口。真正的防线在后端。每条写接口都挂着与前端**同一个权限码**的中间件（`services/api-hono/src/routes/users.ts` 等四个路由文件）：

```ts
users.delete('/:userId', authMiddleware,
  requirePermission(PERMISSION_CODES.systemUserDelete), ...)
```

`requirePermission` 是个中间件工厂（`services/api-hono/src/services/permissions.ts`）：解析当前用户的权限码集合，缺码直接 403。它还接受数组表示"任一命中即放行"——这个能力不是过度设计，部门树接口马上要用（步骤 11）。

注意 `PERMISSION_CODES` 这个常量：前端指令用它，后端中间件也用它。直觉写法是两边各写一遍字符串 `"system:user:delete"`，拼错一个冒号就会出现"按钮显示了但接口 403"或反过来的诡异现象，而且没有任何编译期提示。所以权限码收敛到 monorepo 的共享契约包（`contracts/admin-api/src/permissions.ts`），单一来源：

```ts
export const PERMISSION_CODES = {
  systemUserDelete: "system:user:delete",
  // ... 共 16 个 = system:{user,role,menu,dept} × {view,create,update,delete}
} as const;
```

命名规范是 `模块:资源:动作`。`view` 控页面路由与查询接口，`create/update/delete` 控按钮与写接口。前后端引用同一份常量，拼写错误变成 TypeScript 编译错误。

**动手验证**：用 admin 的 access token 直接 `curl -X DELETE /api/users/1`，观察返回体里的 403 与提示文案 `权限不足（system:user:delete）`。

## 步骤 3：权限码从哪来——一条 SQL 的解析链

现在回答步骤 1 按下的问题：`user.permissions` 是怎么算出来的。

后端每次需要判权限时，从 D1 实时解析（`services/api-hono/src/services/permissions.ts` 的 `resolveUserAccess`），核心是一条 JOIN 链：

```sql
SELECT u.department_id, r.data_scope, m.auth_code AS code
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r       ON r.id = ur.role_id AND r.status = 1
LEFT JOIN role_menus rm ON rm.role_id = r.id
LEFT JOIN menus m       ON m.id = rm.menu_id AND m.status = 1
                        AND m.auth_code IS NOT NULL
WHERE u.id = ?
```

读作一条链：**user → user_roles → roles(启用) → role_menus → menus(启用).auth_code**。四个管理页维护的就是这条链的四段：用户页管 `users` 和 `user_roles`，角色页管 `roles` 和 `role_menus`，菜单页管 `menus`，部门页管 `users.department_id` 挂靠的 `departments`。

链条上的几个设计都值得停一下：

- **`r.status = 1` / `m.status = 1` 写在 JOIN 条件里**：停用一个角色或一个菜单节点，它贡献的权限码即刻从解析结果中消失，不需要去动任何绑定关系。"停用"因此成为比"删除"更安全的下线手段。
- **无角色用户得到空权限集**：全是 LEFT JOIN，查不到角色的用户不会报错，而是零权限 + 最小数据范围（步骤 10），这是最小权限兜底。
- **同一请求内缓存**：解析结果挂在 Hono context 上，一个请求里 `requirePermission` 和数据范围过滤都要消费它，但只查一次库。
- **不进 JWT**：直觉方案是把权限码签进 access token，省一次查询。被否定的原因是权限变更无法即时生效——token 没过期前，被回收权限的用户照样能调接口。实时解析让**接口侧的权限变更立即生效**，代价是每个受保护请求多一次（有请求内缓存的）查询。前端 `user.permissions` 则是这个解析结果在登录 / 刷新时的一份快照——快照什么时候更新，就是步骤 12 的"生效时机"问题。

**动手验证**：本地库执行 `UPDATE roles SET status = 0 WHERE code = 'admin'`，不退出登录，直接用 admin 的 token 调 `GET /api/users`——立刻 403；把 status 改回 1 再调，立刻恢复。

## 步骤 4：权限码为什么挂在"菜单"上——menus 树表取代 permissions 扁平表

链条末端的 `menus.auth_code` 很奇怪：权限码为什么长在"菜单"表上？

直觉方案是一张扁平的 `permissions` 表：一行一个权限码，`role_permissions` 做绑定。本项目早期确实这么做（这就是**本方案否定的直觉**），迁移 021 把它换掉了。扁平表的问题在"给角色分配权限"这个动作上：管理员面对的是一个 16 项的权限码复选列表，`system:user:delete` 和哪个页面哪个按钮对应，全靠命名脑补；权限一多，列表不可维护。

换代后的 `menus` 是一棵树，节点分三类（契约里的 `MENU_TYPES`）：

```text
catalog 目录   只组织层级，不挂权限码            如「系统管理」
menu    菜单页  挂 view 码，可挂路由/组件路径     如「用户管理」→ system:user:view
button  按钮   挂 create/update/delete 码        如「新增用户」→ system:user:create
```

于是"分配权限"从勾权限码列表变成**勾菜单树**：树结构直接表达"哪个页面的哪个按钮"，与 vben.pro 的交互一致。16 个权限码没变，变的是它们的载体和可解释性。

一个必须划清的边界：**菜单表当前只作为权限数据源，不下发动态路由**。vben 完整版会用菜单表在登录后动态生成路由，这是另一个直觉方案——"都有菜单树了，路由也从后端下发吧"。被否定的原因：动态路由要求组件路径协议（`component` 字段 ↔ 前端文件）长期稳定，而本项目静态路由 + `meta.permission`（见 [路由守卫文档](../router/route-guard-rbac.md)）已满足需求，动态路由属于提前引入的复杂度。菜单节点上的 `path` / `component` 字段目前只是登记信息，为未来切换动态路由保留数据形态。

权限的"数据"（menus 表）需要一个维护界面——这就是菜单管理页，也是接下来的主线：四个页面里它把公共组件范式的每个关键点都踩了一遍，沿它从零走通，其余页面就都是变体。

**动手验证**：本地库执行 `SELECT type, title, auth_code FROM menus ORDER BY sort`，对照三类节点与 16 个权限码的挂载位置。

## 步骤 5：菜单管理页——树表格怎么搭

页面在 `src/views/system/menus/MenuManagementView.vue`。第一个问题：怎么把一棵树渲染成表格？

列表页的通用容器是 `AdminDataTable`（`src/components/common/table/AdminDataTable.vue`，封装 ElTable + 工具栏 + 分页，通用用法见公共组件范式）。它对"树"没有做任何特殊封装，只是把 Element Plus 表格的树能力透传出去：

```html
<!-- src/views/system/menus/MenuManagementView.vue -->
<AdminDataTable
  :rows="menuTree"
  row-key="id"
  default-expand-all
  :tree-props="{ children: 'children' }"
  :show-pagination="false"
  :total="totalCount"
  ...
/>
```

两个决定：

- **不分页**（`:show-pagination="false"`）。直觉是"列表页都该分页"，但分页会把一棵树拦腰截断——父节点在第 1 页、子节点在第 2 页，展开语义就碎了。演示库节点量小（菜单十几个、部门二十几个），全量渲染没有压力。数据量大的树该换"懒加载子树"方案，而不是分页。
- **分页 model 仍要传占位值**。`AdminDataTable` 的 `currentPage` / `pageSize` 是 `defineModel({ required: true })`，为了让用户页这类分页场景类型安全，树页也得给两个用不上的 `shallowRef` 占位。这是组件通用性的一个小代价，源码里有注释标明。

列定义抽在纯配置文件 `src/views/system/menus/menuTableColumns.ts`：`satisfies AdminTableColumn<AdminMenuNode>[]` 让列的 `formatter` / `slot` 都有类型检查，视图文件里只剩插槽渲染（类型 Tag、状态 Tag、操作列——操作列的每个按钮照例挂 `v-permission`，与步骤 2 成对）。

数据从哪来：`useMenusTreeQuery()`（`src/queries/menus.ts`，Pinia Colada）调 `GET /api/menus/tree`，后端把平表按 `pid` 组装成树再返回（`services/api-hono/src/routes/menus.ts` 的 `buildMenuTree`）。前端不做组树，保持"树的口径由后端唯一定义"。

**动手验证**：菜单页打开开发者工具看 `GET /api/menus/tree` 的响应——`children` 已经嵌套好；再数一数页面右下角"共 N 条记录"是不是等于递归节点总数（`countNodes`），而不是顶层节点数。

## 步骤 6：一个抽屉伺候三种节点——schema 表单与类型联动

点「新增菜单」，同一个抽屉要伺候目录 / 菜单 / 按钮三种节点，而三种节点的字段集合不同：

```text
catalog 目录   无权限标识、无组件路径（只有名称/路由地址/状态/排序）
menu    菜单   全字段
button  按钮   无路由地址、无组件路径，且权限标识必填
```

直觉方案一：写三个表单组件，或在一个模板里铺满 `v-if="type === ..."`。字段一多，模板成了泥潭。本项目的表单已经 schema 化（`AdminFormDrawer`，`src/components/common/form/AdminFormDrawer.vue`）：字段是一个数组，条件显隐是字段上的一个函数（`src/components/common/form/types.ts` 的 `visible`）：

```ts
// src/views/system/menus/MenuManagementView.vue
{
  component: "input",
  key: "auth_code",
  label: "权限标识",
  placeholder: "如 system:user:view",
  visible: (model) => model.type !== "catalog", // 目录不挂权限码
},
{
  component: "input",
  key: "component",
  label: "组件路径",
  visible: (model) => model.type === "menu",    // 只有菜单页挂组件
},
```

`AdminFormDrawer` 内部对 `visible` 的处理有一个关键细节：**隐藏字段不渲染，也就不参与校验**——ElForm 只校验已注册的表单项，所以选了"目录"之后，被藏起来的 `auth_code` 不会拦提交。字段值仍留在 model 里，提交时由使用方按类型归一（`handleDrawerSubmit` 里 `catalog` 强制 `auth_code: null`、非 `menu` 强制 `component: null`），保证藏起来的残留值不会误入 payload。

另外两处联动：

- **按钮必填权限标识**：`visible` 管显隐管不了"条件必填"，所以提交前手工拦一道 `type === "button" && !authCode`，后端 `validateMenuPayload` 同样校验——又一处前后端成对。
- **编辑时类型字段禁用**（`props: { disabled: Boolean(editingMenu.value) }`）：一个已有子节点的目录若被改成按钮，子节点挂在按钮下就违反了树的约束；一个已被角色绑定的按钮改成目录，权限码会凭空蒸发。禁止切换比处理这些连锁清理简单得多，需要换类型就删了重建。

抽屉每次打开都用"schema 默认值 + initialValues"重建内部 model（`AdminFormDrawer` 的 `watch(open)`），新增和编辑互不残留——使用方不需要自己写重置逻辑。

**动手验证**：新增抽屉里把类型在三档间切换，观察字段增减；选"按钮"留空权限标识提交，看前端拦截；再用 curl 直接 POST 一个无 `auth_code` 的 button，看后端 400。

## 步骤 7：上级节点怎么选才不出环

表单里的「上级菜单」是个树选择器。schema 的五种基础控件里没有"树选择"，这正好展示 schema 的逃生舱：字段声明 `slot: "parent"`，抽屉把这一格的控件区域交回给使用方的 `#field-parent` 插槽，里面放 `ElTreeSelect`（`check-strictly`，父子不联动，因为这里选的是单个节点）。

候选树不能是原始树。两个剔除（`buildParentOptions`，`src/views/system/menus/MenuManagementView.vue`）：

```ts
// 按钮不能作为父节点；编辑时剔除自身（连带其子树），防止选出环
function buildParentOptions(nodes: AdminMenuNode[], excludeId: null | number): AdminMenuNode[] {
  return nodes
    .filter((node) => node.type !== "button" && node.id !== excludeId)
    .map((node) => ({ ...node, children: buildParentOptions(node.children, excludeId) }));
}
```

剔除自身时子树随之整棵消失（不"提升"孤儿节点），因为把 A 挂到 A 的子孙下面会形成环——树从此有一段够不着的孤岛，组树函数还可能死循环。

**被否定的直觉：前端过滤就够了。** 候选树只是 UI 层的善意，curl 一句就绕过去了。后端在更新时用递归 CTE 做兜底（`services/api-hono/src/routes/menus.ts` 的 `validateMenuPayload`）：

```sql
WITH RECURSIVE subtree(id) AS (
  SELECT id FROM menus WHERE pid = ?          -- 我的直接子节点
  UNION ALL
  SELECT m.id FROM menus m JOIN subtree s ON m.pid = s.id
)
SELECT id FROM subtree WHERE id = ?           -- 新父节点在我的子树里？
```

新 `pid` 落在自己的子树内即 400。同一段 CTE 在部门页（步骤 11）和数据范围（步骤 10）还会各出现一次——递归 CTE 是本项目处理"树上的祖先/后代"问题的统一工具。

**动手验证**：编辑「系统管理」目录，展开上级菜单下拉——它自己和它的子节点都不在候选里；再 curl 一个 `pid` 指向自己子节点的 PUT，看后端返回"父级菜单不能是自己的子节点"。

## 步骤 8：删除节点——级联清理与禁删保护

删除一个菜单节点，牵动两头：下面可能有子节点，旁边可能有 `role_menus` 绑定。后端的处理是一严一宽（`services/api-hono/src/routes/menus.ts`）：

- **有子节点：禁删**（400「存在子节点，不可删除」）。级联删整棵子树影响面不可预估，逼着操作者自底向上删。
- **有角色绑定：级联清理**。先 `DELETE FROM role_menus WHERE menu_id = ?` 再删节点。绑定只是关系行，清掉的后果可解释：绑定它的角色少一个权限码。前端确认弹窗的文案「关联的角色绑定将一并清除」提前把这个后果说给操作者听。

删除成功后表格如何刷新？这里接上查询层的统一套路（`src/queries/menus.ts`，机制详见 [Pinia Colada 教程](../request/axios-pinia-colada.md)）：每个 mutation 的 `onSuccess` 失效以 `["menus"]` 为根的所有查询，列表自动重拉，页面代码里没有一行手动 refetch。四个页面的查询文件（`src/queries/{users,roles,menus,departments}.ts`）全是同一个模子：`defineQueryOptions` 定义 key 层级 + mutation 成功统一失效根 key。

还有一个约定要知道：**写接口普遍返回 `{ success, message }`，没有 data**。请求层的 `unwrapApiResponse` 对 `success: true` 一律视为成功（无 data 返回 null），所以 mutation 的返回值不要指望拿到新实体——数据以失效后重拉的列表为准。

**动手验证**：删除一个还有子节点的目录，看后端 400 文案被 `getApiErrorMessage` 透传到 ElMessage；删除一个已被角色勾选的按钮节点，再打开角色编辑抽屉，确认勾选树里它已消失。

## 步骤 9：把树勾给角色——角色页与半选闭包

菜单树维护好了，现在把它勾给角色。角色管理页（`src/views/system/roles/RoleManagementView.vue`）整体仍是熟悉的套路：`AdminSearchForm` 提交式筛选（点「查询」才应用，本地过滤 + 本地分页）+ `AdminDataTable` + `AdminFormDrawer`。真正的新问题在抽屉里那棵勾选树：`RoleMenuTree`（`src/views/system/roles/components/RoleMenuTree.vue`）。

**问题一：存储口径。半选的父节点存不存？** 勾了「用户管理」页下的两个按钮，父节点「用户管理」和祖父「系统管理」处于半选态。直觉是只存"全选"的叶子。但看步骤 3 的解析链就知道不行：解析只认 `role_menus` 里有没有这一行，如果不存半选的「用户管理」（携带 `system:user:view`），角色就有了按钮码却没有页面码——能调删除接口却进不了页面。所以存储口径是**勾选闭包 = 全选节点 + 半选父链**，与 vben 一致：

```ts
// RoleMenuTree.vue：读取树当前勾选闭包，与 role_menus 存储口径一致
return [
  ...(tree.getCheckedKeys(false) as number[]),
  ...(tree.getHalfCheckedKeys() as number[]),
].sort((a, b) => a - b);
```

**问题二：回填。** 编辑角色时要把存好的闭包还原到 ElTree 上。直觉写法 `setCheckedKeys(menu_ids)` 有个坑：默认父子联动模式下，setChecked 一个父节点会**级联勾选它的整棵子树**——存的是"半选父 + 部分子"，还原出来却成了"全选整枝"，一保存权限就凭空变多。解法是回填期间临时开启 `check-strictly`（父子不联动），逐个原样勾选，再关掉恢复联动交互：

```ts
checkStrictly.value = true; // 父节点原样勾选，不向下级联
await nextTick();
treeRef.value?.setCheckedKeys(expected);
await nextTick();
checkStrictly.value = false; // 恢复用户交互时的父子联动
```

菜单树数据本身复用步骤 5 的 `useMenusTreeQuery()`——同一个缓存 key，菜单页拉过的树在这里直接命中。这也解释了后端 `GET /menus/tree` 为什么对 `system:menu:view` / `system:role:view` **任一放行**（步骤 2 预留的数组能力）：只有角色权限、没有菜单管理权限的管理员，也得看得见这棵勾选树。

**问题三：super 不能把自己锁在门外。** 如果有人把 super 角色的菜单绑定清空，就再也没有人能进角色管理页恢复它。所以 super 是内置保护角色：前端操作列不渲染编辑/删除（显示「内置角色不可操作」），后端更新/删除直接 403，权限解析对 super 用户短路放行。此外普通角色**仍有成员绑定时禁删**（400，带出人数），避免删除后一批用户悄悄失权。

**动手验证**：编辑一个只勾了部分按钮的角色，打开抽屉确认父节点是半选而非全选；本地库 `SELECT menu_id FROM role_menus WHERE role_id = ?` 对照勾选闭包。

## 步骤 10：角色能看多少行——data_scope 三档

权限码回答"能不能调这个接口"，还有一个正交的问题：调用后**能看到 / 改到哪些行**。admin 也有 `system:user:view`，但他应该看到全公司用户，还是只看自己部门的？

这就是角色上的第二个属性：数据范围 `data_scope`，三档（契约 `DATA_SCOPES`）：

```text
all   全部数据
dept  本部门及所有子部门（锚点 = 用户挂靠的部门）
self  仅本人创建的行
```

角色抽屉里它只是一个单选框，真正的机制在后端（`services/api-hono/src/services/permissions.ts`）：

- **多角色取最强**：用户可能同时有多个角色，按 `DATA_SCOPE_RANK`（all 3 > dept 2 > self 1）取最大值——数据范围是放权，取并集语义。
- **翻译成 WHERE 片段**：`buildUsersScopeCondition` 把范围翻译进列表查询。`dept` 档又是那段递归 CTE（步骤 7 的老朋友），从用户的 `department_id` 向下收拢整棵子树的部门 id。
- **降级兜底**：`dept` 档但用户没挂部门时，降级为 `self`——没有锚点的部门范围宁可收紧也不放开。

`dept` 档能工作的前提，是每个用户都挂靠在一棵**部门树**上。这棵树谁来维护？下一步的部门页。

**动手验证**：把 admin 角色的数据范围从「仅本人创建」改为「本部门及子部门」，用一个挂了部门的 admin 账号刷新后再看用户列表行数变化。

## 步骤 11：部门页与用户页——同一套路的两个变体

主线到此已经建立了全部概念，剩下两个页面横向对比即可，不需要新推导。

**部门管理页**（`src/views/system/depts/DeptManagementView.vue`）几乎是菜单页的镜像：同样的树表格（`default-expand-all` + `tree-props` + 不分页 + 占位分页 model）、同样的 schema 抽屉、同样的 `#field-parent` 树选择器、同样的前端剔除自身子树 + 后端递归 CTE 防环。差异只有业务规则：

- 部门没有"类型"概念，表单更简单；
- **禁删保护方向相反**：菜单是"绑定级联清理、子节点禁删"，部门是"有子部门**或**仍有用户归属都禁删"（400）——用户挂靠不是可以悄悄清掉的关系行，必须先把人挪走。前端确认弹窗只提示规则，真正的拦截靠透出后端错误文案；
- `code` 由后端自动生成 `dept_<id>`（角色同理是 `role_<id>`），不让用户手填唯一标识。

**用户管理页**（`src/views/system/users/UserManagementView.vue`）是四页中最早建成的，形态上有两个"考古层"值得注意：

- 布局最复杂：左侧部门筛选树（`UserDepartmentPanel`）+ 右侧搜索面板 + 表格。选中部门节点即筛选**该部门及其整棵子树**的用户（`departmentTree.ts` 的 `collectDepartmentIds`），筛选、分页全部是本地纯函数（`userFilters.ts`，带单测）。
- 表单没有用 `AdminFormDrawer`，而是手写的 `ElDialog`（`UserFormDialog.vue`）——它诞生于 schema 三件套封装之前，是"公共组件范式出现之前长什么样"的活标本。对比它和菜单页的表单代码量，就能体会 schema 化省掉了什么。

用户页承载的链条环节是"人怎么挂进来"，三条双端成对的规则：

| 规则                   | 前端                                                   | 后端（`services/api-hono/src/routes/users.ts`） |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| 只有总管理员能分配角色 | 角色下拉禁用 + 仅在 super 且角色确有变化时提交角色字段 | 拒绝非 super 的角色变更                         |
| 用户只能挂末级部门     | 部门树选择器把非叶子节点置灰（只作展开用）             | 校验目标部门必须是叶子                          |
| super 不归属部门       | 选 super 时部门选择禁用并置空                          | 强制清空 `department_id` 兜底                   |

"末级部门"规则是为了让 `dept` 数据范围（步骤 10）的锚点无歧义：人都挂在叶子上，"本部门及子部门"的收拢才不会出现挂在中间节点的例外。

最后一个跨页面的小机关：用户 CRUD 成功后，左侧部门树上的人数（`user_count`）会自动刷新。看 `src/queries/users.ts` 的 key 设计——部门树查询的 key 是 `["users", "departments"]`，挂在 users 根 key **之下**，所以 mutation 统一失效 `["users"]` 根时部门树顺带重拉。查询 key 的层级就是失效的传播路径。

另外，`GET /departments/tree` 对 `system:dept:view` / `system:user:view` 任一放行（步骤 2 的数组能力第二次出场）：只有用户管理权限的 admin 也需要左侧那棵筛选树。

**动手验证**：用 super 新增一个用户挂到某叶子部门，观察左侧树该部门人数 +1（没有任何手动 refetch 代码）；再把角色切成"总管理员"，看部门字段被禁用清空。

## 步骤 12：改完权限，什么时候生效

四个页面都走通了，收尾回答最后一个问题。角色页保存成功的提示是「角色更新成功，**成员下次刷新令牌后生效**」——为什么不是立即生效？答案要把步骤 3 拆成两半：

- **接口侧：即时生效。** 后端每个受保护请求都实时解析 D1（不进 JWT），角色绑定一改，成员的下一次接口调用就按新权限判定。回收权限没有窗口期。
- **按钮侧：下次刷新令牌生效。** 前端 `v-permission` 依据的 `user.permissions` 是登录 / 刷新令牌时下发的快照。access token 有效期内不会重新下发，所以界面上的按钮要等下一次令牌刷新（最长约 15 分钟，见[请求层教程](../request/axios-pinia-colada.md)的主动刷新）才更新。

这个组合的含义：权限**回收**在安全上即时兑现（接口立刻 403），界面最多短暂显示一个"点了会失败"的按钮；权限**授予**则要等快照更新按钮才出现。两侧都不需要为"权限变更推送"引入额外机制——这是步骤 1 里指令不做响应式更新的最终解释。

**动手验证**：给 admin 角色勾上「删除用户」按钮节点保存，用已登录的 admin 账号立刻 curl 删除接口（已放行），但页面按钮还没出现；等一次令牌刷新（或重新登录）后按钮长出来。

## 总复习：一颗按钮的完整链路

```text
维护数据（本文四个页面）
  部门页维护 departments 树 ──┐
  用户页把 user 挂到叶子部门、绑定角色（user_roles）
  菜单页维护 menus 树（catalog/menu/button + auth_code）
  角色页把菜单勾选闭包写入 role_menus，并设置 data_scope
                              │
登录 / 刷新令牌               ▼
  后端 resolveUserAccess：user → user_roles → roles(status=1)
    → role_menus → menus(status=1).auth_code
  ⇒ 下发 user.permissions 快照 + 计算最强 data_scope
                              │
前端渲染                      ▼
  路由守卫查 meta.permission（静态路由，菜单表不下发路由）
  v-permission 对照快照，缺码的按钮从 DOM 移除
                              │
用户操作                      ▼
  接口请求 → requirePermission 实时解析（同请求缓存）→ 403 或放行
  查询类接口再叠加 data_scope 的 WHERE 片段（dept = 递归 CTE）
  mutation 成功 → 失效查询根 key → 列表自动重拉
```

## 文件地图

| 文件                                                                    | 角色                                               | 步骤     |
| ----------------------------------------------------------------------- | -------------------------------------------------- | -------- |
| `contracts/admin-api/src/permissions.ts`                                | 权限码 / 菜单类型 / 数据范围契约（前后端单一来源） | 2、4、10 |
| `src/directives/permission.ts` + `src/auth/permissions.ts`              | 按钮级权限指令与判定纯函数                         | 1        |
| `services/api-hono/src/services/permissions.ts`                         | 解析链 SQL、`requirePermission`、数据范围翻译      | 2、3、10 |
| `services/api-hono/src/routes/menus.ts`                                 | 菜单树组装、防环 CTE、级联删除                     | 5、7、8  |
| `services/api-hono/src/routes/roles.ts`                                 | 角色 CRUD、super 保护、绑定重建                    | 9        |
| `services/api-hono/src/routes/departments.ts`                           | 部门树、禁删保护、防环 CTE                         | 11       |
| `services/api-hono/src/routes/users.ts`                                 | 用户 CRUD、叶子部门 / super 无部门校验             | 11       |
| `src/views/system/menus/MenuManagementView.vue` + `menuTableColumns.ts` | 主线页面：树表格 + 类型联动抽屉                    | 5–8      |
| `src/views/system/roles/RoleManagementView.vue` + `roleTableColumns.ts` | 角色页：提交式筛选 + 本地分页                      | 9        |
| `src/views/system/roles/components/RoleMenuTree.vue`                    | 勾选闭包与 check-strictly 回填                     | 9        |
| `src/views/system/depts/DeptManagementView.vue` + `deptTableColumns.ts` | 部门页（菜单页变体）                               | 11       |
| `src/views/system/users/` 目录                                          | 用户页（前 schema 时代形态 + 纯函数工具与单测）    | 11       |
| `src/components/common/table/AdminDataTable.vue`                        | 表格容器（树模式透传、占位分页 model）             | 5        |
| `src/components/common/form/AdminFormDrawer.vue` + `form/types.ts`      | schema 抽屉（条件显隐、slot 逃生舱、开抽屉重建）   | 6、7     |
| `src/queries/{users,roles,menus,departments}.ts`                        | 查询层：key 层级 + mutation 统一失效               | 8、11    |

## 没有照搬的常见写法

| 常见写法                           | 本项目做法                                         | 推导见     |
| ---------------------------------- | -------------------------------------------------- | ---------- |
| 菜单表下发动态路由（vben 完整版）  | 静态路由 + `meta.permission`，菜单表只作权限数据源 | 步骤 4     |
| 扁平 permissions 表 + 勾权限码列表 | menus 树表 + 勾菜单树                              | 步骤 4     |
| 权限码签进 JWT                     | 每请求实时解析 D1（请求内缓存）                    | 步骤 3、12 |
| `v-if` / `v-show` 控制按钮         | 指令移除 DOM 元素                                  | 步骤 1     |
| 树表格分页                         | 关闭分页，保全展开语义                             | 步骤 5     |
| 模板里 `v-if` 铺条件字段           | schema `visible` 函数，隐藏即不校验                | 步骤 6     |
| 防环只靠前端过滤候选树             | 前端剔除子树 + 后端递归 CTE 兜底                   | 步骤 7     |
| `setCheckedKeys` 直接回填勾选      | 临时 `check-strictly` 防级联扩权                   | 步骤 9     |
| 手动 refetch 刷新列表              | mutation 统一失效查询根 key                        | 步骤 8、11 |

## 新旧权限模型对照

| 对比点   | 旧：permissions 扁平表   | 新：menus 树表（迁移 021）                             |
| -------- | ------------------------ | ------------------------------------------------------ |
| 数据形态 | 一行一个权限码           | 目录 / 菜单 / 按钮三类节点，auth_code 挂在菜单和按钮上 |
| 角色分配 | 勾权限码列表             | 勾菜单树（半选父链一并入库）                           |
| 可解释性 | 权限码与页面的关系靠命名 | 树结构直接表达"哪个页面的哪个按钮"                     |
| 动态路由 | 无法支撑                 | 保留了数据形态，当前不启用                             |

## 自测题

1. admin 看不到「删除」按钮，但拿它的 token 直接 curl 删除接口，会发生什么？两道防线分别在哪个文件？（答案：步骤 1、2）
2. 把某个角色 `status` 置 0，成员的接口权限和页面按钮分别何时失效？为什么不同步？（答案：步骤 3、12）
3. 目录节点为什么不允许挂 `auth_code`？按钮节点为什么必填？隐藏字段的残留值靠什么机制不进 payload？（答案：步骤 4、6）
4. 编辑菜单时类型字段为什么被禁用？（答案：步骤 6）
5. 前端已经把"自己和子树"从上级候选里剔除了，后端那段递归 CTE 还有必要吗？（答案：步骤 7）
6. `role_menus` 里为什么要存半选的父节点？回填时不开 `check-strictly` 会出什么事故？（答案：步骤 9）
7. `GET /menus/tree` 为什么对 `role:view` 也放行？`GET /departments/tree` 的对应场景是什么？（答案：步骤 9、11）
8. 挂了 `dept` 数据范围但没有部门的用户能看到哪些行？为什么这样设计？（答案：步骤 10）
9. 用户为什么只能挂末级部门？（答案：步骤 11）
10. 用户 CRUD 成功后，左侧部门树的人数为什么会自动刷新——代码里并没有 refetch 部门树？（答案：步骤 11）
11. 树表格明明关了分页，为什么还要传 `currentPage` / `pageSize` 两个占位 ref？（答案：步骤 5）
12. 如果有人试图清空 super 角色的菜单绑定或删除它，会在哪几层被拦住？（答案：步骤 9）
