# 角色 / 菜单 / 部门管理页与菜单权限模型

## 模块定位

这三个页面与用户管理页一起构成系统管理的完整闭环，形态对齐 vben.pro 的纯模板演示：

```text
用户管理  用户 ↔ 角色绑定、用户 ↔ 部门挂靠
角色管理  角色 ↔ 菜单（权限）绑定、数据范围
菜单管理  权限数据源本身的维护（目录/菜单/按钮三类节点）
部门管理  部门树维护，作为用户挂靠与数据范围的载体
```

## 权限模型：菜单表取代权限表

迁移 021 完成了权限模型换代：`menus` 树表取代扁平的 `permissions` 表，`role_menus` 取代 `role_permissions`。

```text
解析链：user -> user_roles -> roles(status=1) -> role_menus -> menus(status=1).auth_code
权限码：16 个 = system:{user,role,menu,dept}:{view,create,update,delete}
       页面节点携带 view 码，按钮节点携带 create/update/delete 码
```

| 对比点   | 旧：permissions 扁平表   | 新：menus 树表                                     |
| -------- | ------------------------ | -------------------------------------------------- |
| 数据形态 | 一行一个权限码           | 目录/菜单/按钮三类节点，auth_code 挂在菜单和按钮上 |
| 角色分配 | 勾权限码列表             | 勾菜单树（半选=父链，与 vben 一致）                |
| 可解释性 | 权限码与页面的关系靠命名 | 树结构直接表达"哪个页面的哪个按钮"                 |
| 动态路由 | 无法支撑                 | 未来可作为后端动态路由数据源（当前不启用）         |

**前端路由方案不变**：仍是静态路由 + `meta.permission`（见 `docs/router/route-guard-rbac.md`）。菜单表当前只作为权限数据源（角色分配时的勾选树），不下发动态路由。

## 源码位置

| 页面     | 文件                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| 角色管理 | `src/views/system/roles/RoleManagementView.vue` + `components/RoleMenuTree.vue`    |
| 菜单管理 | `src/views/system/menus/MenuManagementView.vue` + `menuTableColumns.ts`            |
| 部门管理 | `src/views/system/depts/DeptManagementView.vue` + `deptTableColumns.ts`            |
| 请求层   | `src/api/modules/{roles,menus,departments}.ts`                                     |
| 查询层   | `src/queries/{roles,menus,departments}.ts`（Pinia Colada，mutation 成功统一失效）  |
| 公共组件 | `src/components/common` 的 `AdminDataTable` / `AdminFormDrawer`（schema 驱动表单） |

## 页面模式：树表格 + schema 抽屉

菜单页和部门页共用同一套模式，是"公共组件范式"的树形样板：

| 设计点       | 做法                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| 树表格       | `AdminDataTable` 透传 `default-expand-all` + `tree-props`，关闭分页（`show-pagination=false`） |
| 表单         | `AdminFormDrawer` schema 声明字段；`visible` 回调做条件显隐（隐藏字段不渲染不校验）            |
| 类型联动     | 菜单表单按 type 显隐：目录无权限标识/组件路径，按钮无路由地址/组件路径，按钮必填 auth_code     |
| 上级节点选择 | 抽屉 slot 内 `ElTreeSelect`（check-strictly）；候选树剔除自身子树防环（后端递归 CTE 兜底）     |
| 编辑锁定     | 菜单类型编辑时禁用（`field.props.disabled`），避免已有子节点/绑定的节点切换类型                |
| 按钮权限     | 新增/编辑/删除按钮均挂 `v-permission`，与后端 `requirePermission` 成对                         |

## 后端业务规则（前端交互与之对齐）

| 规则             | 说明                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| 菜单删除级联     | 删除菜单节点连带清除 `role_menus` 绑定（确认弹窗文案已提示）              |
| 部门禁删保护     | 存在子部门或仍有用户归属时返回 400，前端透出后端错误文案                  |
| 用户挂末级部门   | 用户只能分配到叶子部门；部门树选择器把非叶子节点置灰                      |
| super 不归属部门 | 角色选超级管理员时部门选择禁用置空，后端强制清空兜底                      |
| 部门树接口放行   | `GET /departments/tree` 对 `dept:view / user:view` 任一放行（用户页共用） |
| super 内置保护   | super 角色的菜单绑定不可改，权限解析对其短路放行                          |
| 权限生效时机     | 角色/菜单绑定变更后，成员在下次刷新令牌时拿到新权限码                     |

## 设计取舍

| 取舍                   | 原因                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 菜单表先不下发动态路由 | 静态路由 + meta.permission 已满足当前需求；动态路由需要组件路径协议稳定，属提前复杂度                            |
| 树表格不分页           | 演示库节点量小（菜单 17、部门 24），分页会破坏树的展开语义                                                       |
| 写接口返回无 data      | 后端写接口普遍返回 `{success, message}`；`unwrapApiResponse` 对 `success=true` 一律视为成功（无 data 返回 null） |
| 权限码前后端共享常量   | `contracts/admin-api/permissions.ts` 单一来源，避免裸字符串拼错                                                  |
