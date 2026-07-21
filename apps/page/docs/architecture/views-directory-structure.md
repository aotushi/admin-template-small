# views 目录组织规范

## 定位

约束 `src/views/` 的目录形态：页面按什么单位分夹、页面配套文件放在哪里、什么时候允许上提共享。目标是"看目录就能读出路由结构，删页面等于删文件夹"。

样板模块：`src/views/system/users/`——页面入口、私有组件、纯逻辑、测试全部就近收在一个模块夹内。

## 四条规则

### 1. views 镜像路由树

`views/` 的文件夹层级和路由路径一一对应：`/system/users` 对应 `views/system/users/`，`/components/table` 对应 `views/showcase/`（示例页模块）。新增路由页面时先建模块夹，不把 `.vue` 文件散放在 `views/` 顶层。

| 路由                         | 模块夹                   |
| ---------------------------- | ------------------------ |
| `/login`                     | `views/login/`           |
| `/dashboard`                 | `views/dashboard/`       |
| `/403` `/404` `/500`         | `views/error/`           |
| `/components/**`（组件示例） | `views/showcase/`        |
| `/system/**`                 | `views/system/<module>/` |

分组路由（`/components`、`/system` 这类只提供路径前缀和菜单结构的父级）**不需要任何组件文件**：Vue Router 4.1+ 支持父路由省略 `component`，子页面直接渲染进 `MainLayout` 的 `RouterView`。不要为分组创建空壳透传组件（`<template><RouterView/></template>`）——那是 Vue Router 3 时代 `ParentView` 模式的遗产，还会因 RouterView 直接子组件不变而抑制路由切换动画。`views/` 只收业务页面。

### 2. 页面私有资产就近放（colocation）

一个模块夹内允许出现的内容：

```text
views/system/users/
  UserManagementView.vue     页面入口（组合层）
  components/                页面私有组件（UserFormDialog 等）
  userFilters.ts             页面纯逻辑（可测试）
  userFilters.spec.ts        纯逻辑测试，与被测文件同夹
  types.ts                   页面私有类型
```

配套文件跟着页面走：`loginAccounts.ts` 只被登录页使用，就放 `views/login/`，不放 `views/` 顶层，更不放 `src/utils/`。

这样做的回报是**删除成本恒定**：下线一个页面时整夹删除，加上路由表里的一条记录，零残留。

### 3. 共享按作用域逐级提升

| 使用范围                                         | 放置位置                                                 |
| ------------------------------------------------ | -------------------------------------------------------- |
| 只有一个页面用                                   | 该页面模块夹内                                           |
| 同域多个页面共用（如 system 四页共用的表格模式） | `src/components/common/`（当前项目域较少，直接进公共层） |
| 跨域共用                                         | `src/components/` `src/composables/`                     |

反向约束同样成立：**没有被第二个页面用到的东西不许提前上提**。"以后可能有用"不是上提理由——这是防止公共层变垃圾场的关键。真正需要复用的那天再提升，成本只是移动文件加改导入。

### 4. 入口命名全仓统一

页面入口统一用 `XxxView.vue` 多词命名（`UserManagementView.vue`），不用 `index.vue`。两种风格都是生态里的合法方案（vben/RuoYi 用 `index.vue` 靠夹名表意），本项目选 `XxxView.vue` 的理由：编辑器多标签页可直接辨识文件，且天然满足 Vue 风格指南的多词组件名要求。选定后不混用。

## 深度约束

模块夹内**最多一层** `components/` 子目录，不出现 `users/components/dialog/parts/` 式深巢。需要更深的目录时，说明页面本身过大，正确动作是拆页面或把稳定部分提升为公共组件，而不是增加目录深度。

## 反例存档（2026-07-21 重构动因）

| 反例                                                     | 问题                                                                                            | 修正                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| `views/` 顶层散放 `LoginView.vue` `DashboardView.vue` 等 | 与模块夹并存，结构不一致                                                                        | 全部入夹               |
| `views/components/`（组件示例页模块）                    | 与 `src/components`（公共组件）、模块夹内 `components/`（页面私有组件）三个同名目录语义互相冲突 | 改名 `views/showcase/` |
| `views/test.vue`                                         | 试验残留文件                                                                                    | 删除                   |

命名教训：**模块夹的名字不要复用基础设施目录名**（components/utils/api 等），否则读代码时每次都要靠上下文消歧。
