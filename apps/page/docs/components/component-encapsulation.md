# Vue 组件的封装：从一页重复代码到稳定的组件接口

本文不是 Vue 组件语法清单，而是结合当前项目回答一个更实际的问题：

> 一段页面代码什么时候应该拆成组件，拆出去以后 Props、Emits、`v-model` 和 Slots 应该怎样分工？

适合读者：

- 了解 Vue 3、JavaScript 和 TypeScript；
- 会写 `<script setup lang="ts">`；
- 知道 `ref`、`reactive`、`computed` 的基本用法；
- 写过页面，但还不确定怎样封装组件。

学完后应当能够复述：

```text
父组件掌握业务数据和流程；
子组件通过 Props 接收数据，通过 Emits 报告动作；
真正需要双向同步的值使用 v-model；
结构中需要由父组件填充的位置使用 Slots；
组件内部隐藏稳定的实现细节，对外只暴露必要接口。
```

## 1. 先纠正一个常见误解

很多人把“封装组件”理解成：

```text
把一段 template 剪切到另一个 .vue 文件
```

这只是拆文件，不一定形成了有效封装。

真正的组件封装包含两部分：

```text
组件内部
  -> 隐藏实现细节

组件接口
  -> 明确外部怎样传入数据、接收事件和定制内容
```

例如一个分页组件，父组件只需要知道：

```vue
<AdminPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
```

父组件不应该再关心：

- Element Plus 的分页 `layout` 字符串；
- 手机端需要隐藏每页条数选择器；
- 总数文案怎样拼接；
- 分页栏的边框、颜色和响应式样式。

这些细节被隐藏在
[AdminPagination.vue](../../src/components/common/table/AdminPagination.vue) 中。

因此，可以这样定义组件封装：

> 用一个尽量小而稳定的接口，隐藏一组会反复出现或独立变化的实现细节。

## 2. 当前项目的组件层级

用户管理页面可以画成下面这棵树：

```text
UserManagementView.vue                    页面组件
├─ UserDepartmentPanel.vue                用户模块业务组件
│  └─ AdminTreePanel.vue                  公共组件
├─ UserSearchPanel.vue                    用户模块业务组件
│  └─ AdminSearchPanel.vue                公共组件
├─ AdminDataTable.vue                     公共组件
│  ├─ AdminTablePanel.vue                 公共组件
│  ├─ AdminTableActionButton.vue          公共组件
│  └─ AdminPagination.vue                 公共组件
└─ UserFormDialog.vue                     用户模块业务组件
```

这里有三种不同层级。

| 层级     | 示例                     | 主要职责                             |
| -------- | ------------------------ | ------------------------------------ |
| 页面组件 | `UserManagementView.vue` | 请求数据、组合状态、执行业务流程     |
| 业务组件 | `UserSearchPanel.vue`    | 表达“用户筛选”这种具体业务界面       |
| 公共组件 | `AdminSearchPanel.vue`   | 提供多个模块都能使用的稳定布局和行为 |

Element Plus 可以看作最底层基础组件库：

```text
Element Plus
    ↓ 项目统一视觉和交互
公共组件
    ↓ 组合成具体业务含义
业务组件
    ↓ 由页面连接请求、状态和路由
页面组件
```

这一层级非常重要，因为并不是所有拆出来的组件都应该放进 `components/common`。

## 3. 为什么要拆组件

不要因为“代码超过100行”就机械拆分。更可靠的判断标准是职责。

### 3.1 出现独立的视觉区域

用户管理页至少包含：

```text
部门树
筛选表单
用户表格
新增/编辑弹窗
```

每一块都能用一句话说清自己的职责，因此适合形成组件。

### 3.2 同样的结构重复出现

角色、菜单、部门和用户页面都可能需要：

- 标题栏；
- 工具按钮；
- 表格；
- 空状态；
- 分页；
- 全屏、刷新、密度切换。

如果每个页面都重新写一遍，样式和行为会逐渐不一致。

这正是 [AdminDataTable.vue](../../src/components/common/table/AdminDataTable.vue)
存在的原因。

### 3.3 某部分有自己的状态或交互规则

例如分页组件自己处理：

- 窄屏判断；
- 分页布局切换；
- 总数文案。

页面只关心当前页、每页数量和总数。

### 3.4 某部分需要独立测试

表格的列渲染、选择、插槽和工具栏行为比较复杂，把它们封装后，可以通过组件公开接口单独测试。

当前项目对应测试：

- [AdminDataTable.spec.ts](../../src/components/common/table/AdminDataTable.spec.ts)
- [schema.spec.ts](../../src/components/common/form/schema.spec.ts)

## 4. 封装前先划分责任

以用户列表为例，页面需要掌握这些内容：

```text
请求哪些接口
当前用户是否有权限
筛选条件是什么
点击编辑时编辑谁
提交后调用新增还是修改接口
接口成功后显示什么提示
```

这些属于业务流程，应当留在
[UserManagementView.vue](../../src/views/system/users/UserManagementView.vue)。

表格组件负责：

```text
怎样显示标题和工具栏
怎样根据列配置渲染 ElTableColumn
怎样处理选择状态
怎样切换表格密度和全屏
怎样显示分页
```

这些属于通用界面行为，应当放进 `AdminDataTable.vue`。

最重要的边界是：

> 公共表格知道“用户点击了刷新”，但不应该知道“刷新用户接口”。

因此它只发出事件：

```ts
const emit = defineEmits<{
  refresh: [];
}>();
```

页面监听后决定真正做什么：

```vue
<AdminDataTable @refresh="refreshUsers" />
```

```ts
function refreshUsers() {
  void usersQuery.refetch();
  void departmentsQuery.refetch();
}
```

这就是“界面行为”和“业务行为”的分界线。

## 5. 组件接口的四种工具

一个 Vue 组件最常见的公开接口有四种：

| 工具      | 数据方向        | 适合表达什么                     |
| --------- | --------------- | -------------------------------- |
| Props     | 父组件 → 子组件 | 输入数据和配置                   |
| Emits     | 子组件 → 父组件 | 用户动作或已经发生的事情         |
| `v-model` | 父组件 ↔ 子组件 | 需要持续双向同步的值             |
| Slots     | 父组件 → 子组件 | 由父组件决定的一块模板结构或内容 |

不要混用它们的职责。

```text
数据输入      -> Props
动作通知      -> Emits
双向绑定      -> v-model
结构定制      -> Slots
```

## 6. Props：父组件给子组件的只读输入

`AdminTablePanel` 需要一个默认标题：

```ts
const props = defineProps<{
  title: string;
}>();
```

父组件这样传入：

```vue
<AdminTablePanel title="用户列表" />
```

数据方向是：

```text
父组件 title
    ↓
子组件 props.title
    ↓
模板显示
```

### 6.1 Props 为什么必须视为只读

下面的写法不应该出现：

```ts
props.title = "新标题";
```

因为 `title` 的所有者是父组件。子组件直接修改，会让数据来源变得模糊：

```text
到底是父组件控制 title，还是子组件控制？
```

正确方式是发出事件，让父组件决定是否修改。

### 6.2 Props 应该描述能力，不要暴露内部细节

较好的接口：

```ts
interface Props {
  loading?: boolean;
  rows: User[];
  title: string;
}
```

较差的接口：

```ts
interface Props {
  toolbarClass: string;
  titleMarginLeft: number;
  bodyFlexGrow: number;
  footerBorderColor: string;
}
```

后一种接口把组件内部布局泄漏给了父组件。内部样式稍有调整，所有调用者都要跟着修改。

### 6.3 默认值放在哪里

当前项目使用 `withDefaults()`：

```ts
const props = withDefaults(
  defineProps<{
    loading?: boolean;
    pageSizes?: number[];
  }>(),
  {
    loading: false,
    pageSizes: () => [10, 20, 50, 100],
  },
);
```

数组和对象默认值使用函数返回，避免不同组件实例共享同一个可变对象。

## 7. Emits：子组件只报告发生了什么

筛选组件不应该自己请求用户接口。它只报告用户动作：

```ts
const emit = defineEmits<{
  collapse: [];
  query: [];
  reset: [];
  updateFilters: [filters: Partial<UserFilters>];
}>();
```

父组件监听：

```vue
<UserSearchPanel
  @collapse="searchPanelVisible = false"
  @query="handleQuery"
  @reset="resetFilters"
  @update-filters="updateFilters"
/>
```

这形成了 Vue 最常见的数据流：

```text
父组件通过 Props 把 filters 传下去
                ↓
子组件展示 filters
                ↓
用户修改输入框
                ↓
子组件 emit("updateFilters", { username })
                ↓
父组件更新真正的 filters
                ↓
新的 Props 再传给子组件
```

这叫：

> Props Down，Events Up。

### 7.1 事件名应描述事实或意图

推荐：

```text
submit
reset
refresh
selectionChange
toggleSearch
```

不推荐：

```text
change
doIt
handle
click2
```

事件名越模糊，父组件越难知道它代表什么。

### 7.2 不要把父组件函数作为普通 Prop 传下去

不推荐：

```vue
<UserSearchPanel :on-query="handleQuery" />
```

推荐：

```vue
<UserSearchPanel @query="handleQuery" />
```

Emits 能明确表达“这是子组件向上的通知”，也能获得更好的类型提示。

## 8. `v-model`：真正需要双向同步时使用

分页组件需要持续同步两个值：

```ts
const currentPage = defineModel<number>("currentPage", { required: true });
const pageSize = defineModel<number>("pageSize", { required: true });
```

父组件使用：

```vue
<AdminPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
```

它等价于更长的写法：

```vue
<AdminPagination
  :current-page="currentPage"
  :page-size="pageSize"
  @update:current-page="currentPage = $event"
  @update:page-size="pageSize = $event"
/>
```

### 8.1 什么值适合 `v-model`

适合：

- 输入框的值；
- 弹窗是否打开；
- 当前页；
- 每页数量；
- 树当前选中的节点；
- 当前 Tab。

不适合：

- `loading`；
- 接口错误；
- 用户权限；
- 根据其它状态计算出来的结果；
- “点击了刷新”这种瞬时动作。

例如“刷新”是事件，不是一个持续存在的值：

```vue
<!-- 正确 -->
<AdminDataTable @refresh="refreshUsers" />
```

不要为了统一形式写成：

```vue
<!-- 不推荐 -->
<AdminDataTable v-model:refreshing="refreshing" />
```

## 9. Slots：子组件固定骨架，父组件填内容

`AdminTablePanel` 固定了下面的骨架：

```text
标题区
操作区
表格主体
底部区域
```

但是它不知道具体页面要放什么按钮和表格，因此提供 Slots：

```ts
defineSlots<{
  actions?: () => unknown;
  default?: () => unknown;
  footer?: () => unknown;
  selection?: () => unknown;
  title?: () => unknown;
}>();
```

组件内部：

```vue
<div class="admin-table-panel__toolbar">
  <slot name="title">
    <h2>{{ props.title }}</h2>
  </slot>

  <slot name="actions" />
</div>

<div class="admin-table-panel__body">
  <slot />
</div>

<slot name="footer" />
```

这里体现了一种很重要的封装方式：

> 子组件控制布局，父组件控制具体内容。

### 9.1 默认插槽和具名插槽

默认插槽：

```vue
<AdminSearchPanel>
  <ElFormItem label="用户名">...</ElFormItem>
</AdminSearchPanel>
```

具名插槽：

```vue
<AdminDataTable>
  <template #toolbarActions>
    <ElButton>新增用户</ElButton>
  </template>
</AdminDataTable>
```

### 9.2 作用域插槽

表格组件掌握当前行数据，但不知道用户名这一列应该怎样展示。

因此它把 `row` 交给父组件：

```vue
<template #cell-username="{ row }">
  <span>{{ row.username }}</span>
  <ElTag v-if="row.is_system">系统</ElTag>
</template>
```

数据方向是：

```text
AdminDataTable 掌握 row
          ↓ 通过插槽参数提供
父组件决定这一格的模板
```

这种方式非常适合“整体规律固定、局部显示不同”的场景。

### 9.3 Slot 和 Prop 怎样选择

如果父组件只需要传一个值，用 Prop：

```vue
<AdminTablePanel title="用户列表" />
```

如果父组件要传入一段模板结构，用 Slot：

```vue
<template #title>
  <h2>用户列表 <ElTag>实时</ElTag></h2>
</template>
```

不要把复杂模板硬塞进字符串 Prop。

## 10. `$attrs`：包装第三方组件时保留扩展能力

`AdminDataTable` 包装了 Element Plus 的 `ElTable`。

如果每个 `ElTable` 属性都重新定义成 Prop，公共组件的接口会越来越大：

```text
stripe
highlightCurrentRow
treeProps
defaultExpandAll
rowClassName
……
```

当前组件使用：

```ts
defineOptions({
  inheritAttrs: false,
});
```

然后把未声明的 Attributes 转交给真正的 `ElTable`：

```vue
<ElTable v-bind="$attrs" />
```

父组件于是可以直接写：

```vue
<AdminDataTable default-expand-all :tree-props="{ children: 'children' }" />
```

这两个属性不需要由 `AdminDataTable` 重复声明。

不过 `$attrs` 不能代替所有 Props。

如果某个属性：

- 会影响公共组件自己的逻辑；
- 需要默认值；
- 需要类型约束；
- 会被频繁使用；

它仍然应该成为正式 Prop。

## 11. 外部状态和内部状态怎样划分

`AdminDataTable` 同时有外部状态和内部状态。

### 11.1 外部状态

```text
rows
loading
currentPage
pageSize
total
```

这些状态会影响请求、筛选或页面其它区域，因此由父组件掌握。

### 11.2 内部状态

```text
表格密度 tableSize
当前是否全屏 isFullscreen
组件内部选中的 selectedRows
```

它们主要服务于表格自身，可以留在组件内部。

当父组件需要知道选择结果时，组件发出：

```ts
emit("selectionChange", rows);
```

可以用下面的问题判断状态应该放哪：

> 组件之外是否需要读取、修改，或者根据这个状态发请求？

如果答案是“是”，通常应该提升到父组件；如果只影响组件内部展示，通常留在内部。

## 12. TypeScript 让组件接口可以被检查

JavaScript 组件也能运行，但 TypeScript 能让错误更早暴露。

### 12.1 Typed Props

```ts
defineProps<{
  loading?: boolean;
  rows: User[];
}>();
```

如果父组件把字符串传给 `rows`，类型检查会直接报错。

### 12.2 Typed Emits

```ts
const emit = defineEmits<{
  submit: [value: UserFormValue];
}>();
```

下面的错误会被识别：

```ts
emit("submit", "错误的字符串");
```

### 12.3 Typed Slots

```ts
defineSlots<{
  selection?: (props: { clearSelection: () => void; rows: User[] }) => unknown;
}>();
```

父组件使用 `rows` 和 `clearSelection` 时能得到类型提示。

### 12.4 泛型表格

`AdminDataTable` 使用 Vue SFC 泛型：

```vue
<script setup lang="ts" generic="TRow extends object">
```

因此同一个表格既能展示用户，也能展示角色、菜单和部门，同时保持每一行的类型信息。

这比把所有行都写成 `any` 更安全。

## 13. 公共组件和业务组件的边界

### 13.1 `AdminSearchPanel` 为什么是公共组件

它只知道：

```text
这是一个搜索区域
需要统一背景、间距和响应式网格
里面具体放什么由默认插槽决定
```

它不知道用户名、角色或创建时间，因此可以跨业务复用。

### 13.2 `UserSearchPanel` 为什么是业务组件

它知道：

- `UserFilters`；
- 用户角色选项；
- 用户状态选项；
- 用户创建时间；
- 点击查询后通知用户页面。

这些知识只属于用户模块，所以它应该留在：

```text
views/system/users/components/
```

而不是进入：

```text
components/common/
```

### 13.3 一个简单判断方法

问自己：

> 把“用户”两个字全部替换成“订单”，这个组件仍然合理吗？

如果完全不合理，它多半是业务组件。

如果只需要换 Props 数据就能使用，它可能适合成为公共组件。

## 14. Schema 驱动表单：更进一步的封装

当前项目的 `AdminSearchForm` 和 `AdminFormDrawer` 支持通过字段配置生成表单：

```ts
const fields: AdminFormField[] = [
  {
    component: "input",
    key: "username",
    label: "用户名",
  },
  {
    component: "select",
    key: "status",
    label: "状态",
    options: [
      { label: "启用", value: 1 },
      { label: "停用", value: 0 },
    ],
  },
];
```

它隐藏了：

- 表单 Model 初始化；
- 字段循环；
- 默认值；
- 重置；
- 校验规则；
- 通用输入控件选择。

源码：

- [AdminSearchForm.vue](../../src/components/common/form/AdminSearchForm.vue)
- [AdminFormDrawer.vue](../../src/components/common/form/AdminFormDrawer.vue)
- [AdminFormFieldControl.vue](../../src/components/common/form/AdminFormFieldControl.vue)
- [types.ts](../../src/components/common/form/types.ts)

Schema 驱动适合字段结构高度相似的后台 CRUD 表单。

但不要把所有表单都强行 Schema 化。出现下面情况时，直接写业务组件通常更清楚：

- 字段之间有复杂联动；
- 模板布局很特别；
- 大量字段需要自定义 Slot；
- 阅读配置比阅读模板更困难。

封装的目标是降低理解成本，不是消灭所有模板。

## 15. 组件封装与 Composable 的区别

组件主要复用：

```text
模板结构 + 交互 + 样式
```

Composable 主要复用：

```text
响应式状态 + 逻辑 + 生命周期副作用
```

例如：

```text
表格布局和分页 UI
    -> 组件

分页计算、筛选算法、请求状态组合
    -> 纯函数或 Composable
```

不要为了复用一个纯函数创建“没有界面的组件”；也不要把复杂模板塞进 Composable。

## 16. 样式也属于组件边界

组件自己的样式使用：

```vue
<style scoped>
```

这样样式默认不会影响其它组件。

包装 Element Plus 时，当前项目会谨慎使用 `:deep()`：

```css
.admin-table-panel :deep(.el-table__header-wrapper th) {
  height: 46px;
}
```

意思是：

```text
只修改 AdminTablePanel 内部的 ElTable
不修改整个项目所有 ElTable
```

` :deep()` 应当以本组件根类作为前缀，避免样式无意扩散。

通用颜色没有写死在组件中，而是使用主题 Token：

```css
background: hsl(var(--card));
border-color: hsl(var(--border));
color: hsl(var(--foreground));
```

这让公共组件不用知道当前是亮色还是暗色主题。

## 17. 常见的错误封装

### 17.1 万能组件

```vue
<AdminEverything
  :is-user-page="true"
  :show-role="true"
  :special-mode="3"
  :disable-something="false"
/>
```

大量布尔开关通常说明多个业务场景被硬塞进一个组件。

### 17.2 公共组件直接请求业务接口

```ts
// 不推荐出现在 AdminDataTable 内
await getUsersApi();
```

这样表格就不能用于角色、菜单或部门。

### 17.3 子组件修改 Prop

```ts
props.filters.username = value;
```

即使对象嵌套属性在运行时可能修改成功，也会破坏单向数据流。应当 Emit 新值，由父组件更新。

### 17.4 复制一份 Prop 后永远不再同步

```ts
const form = reactive({ ...props.user });
```

如果父组件后来切换了编辑用户，本地 `form` 不会自动重新初始化。

当前 `UserFormDialog` 在弹窗打开时通过 `watch(visible)` 重建表单数据，明确了同步时机。

源码：[UserFormDialog.vue](../../src/views/system/users/components/UserFormDialog.vue)

### 17.5 为了复用而过早封装

只有一个调用方、代码很短、未来变化方式也不清楚时，先保留在业务组件中通常更好。

错误的抽象比少量重复更难维护。

## 18. 从页面代码到组件的实际步骤

可以按照下面的顺序做。

### 第一步：先把页面写正确

先确认请求、状态和交互可以工作。不要在业务还没理解时急着设计万能组件。

### 第二步：圈出独立职责

例如：

```text
筛选区域
列表区域
编辑表单
部门树
```

### 第三步：写出组件的一句话职责

```text
UserSearchPanel：展示用户筛选条件，并向父组件报告筛选修改和查询动作。
```

一句话里如果出现多个“并且”，可能还需要继续拆分。

### 第四步：列出真正的外部输入

```text
filters
loading
```

这些成为 Props。

### 第五步：列出要通知父组件的动作

```text
query
reset
collapse
updateFilters
```

这些成为 Emits。

### 第六步：判断是否需要 Slots 或 `v-model`

```text
需要父组件填一段模板       -> Slot
需要持续同步一个值         -> v-model
只是发生了一次动作         -> Emit
```

### 第七步：再判断是否值得进入公共目录

先在业务目录中验证接口是否稳定。真正出现第二个使用场景后，再提炼为公共组件往往更可靠。

## 19. 如何测试一个封装组件

测试重点不是组件内部每一行代码，而是公开接口。

### Props 测试

```text
传入 rows 后是否显示对应数据？
loading=true 时是否显示加载状态？
```

### Emits 测试

```text
点击刷新按钮是否 emit refresh？
选择行后是否 emit selectionChange？
```

### `v-model` 测试

```text
切换页码是否发出 update:currentPage？
修改每页数量是否发出 update:pageSize？
```

### Slots 测试

```text
toolbarActions 是否出现在工具栏？
cell-username 是否收到正确的 row？
没有提供 Slot 时默认内容是否正常？
```

### `$attrs` 测试

```text
传给 AdminDataTable 的 tree-props 是否真正到达 ElTable？
```

组件公开接口稳定，内部实现以后才能放心重构。

## 20. 本项目组件封装的完整数据流

以用户点击“查询”为例：

```text
UserManagementView 持有 filters
            ↓ Props
UserSearchPanel 显示 filters
            ↓ 用户修改用户名
emit updateFilters({ username })
            ↓
UserManagementView 执行 Object.assign(filters, nextFilters)
            ↓ computed
filteredUsers 重新计算
            ↓ Props
AdminDataTable 收到新的 rows
            ↓
页面重新渲染筛选后的用户
```

这里没有任何子组件偷偷修改父组件状态，也没有公共组件直接调用用户接口。

以点击“刷新”为例：

```text
用户点击 AdminDataTable 的刷新按钮
            ↓
AdminDataTable emit("refresh")
            ↓
UserManagementView.refreshUsers()
            ↓
Pinia Colada refetch
            ↓
query.data 更新
            ↓ computed
users / filteredUsers / pagedUsers 更新
            ↓ Props
AdminDataTable 重新显示数据
```

## 21. 封装前检查清单

### 是否值得拆

- 这部分能否用一句话描述独立职责？
- 它是否拥有独立的视觉区域、状态或交互？
- 页面是否已经出现三个以上相对独立的区域？
- 是否存在重复结构，或者很可能出现第二个使用场景？

### 接口是否清楚

- 输入是否都通过 Typed Props？
- Props 是否保持只读？
- 用户动作是否通过 Typed Emits 通知？
- 只有真正双向同步的值才使用 `v-model`？
- 需要模板定制的地方是否使用 Typed Slots？
- 是否暴露了太多内部样式或第三方组件细节？

### 边界是否合理

- 公共组件是否导入了具体业务接口或 Store？
- 页面组件是否仍然掌握请求和业务流程？
- 纯逻辑是否更适合纯函数或 Composable？
- 业务组件是否被过早放进 `components/common`？

### 是否容易验证

- 能否只通过公开接口测试主要行为？
- 默认内容和自定义 Slot 是否都有测试？
- 组件重构内部实现时，调用方是否不需要修改？

## 22. 最短复述

如果需要向别人复述“什么是组件封装”，可以说：

> 组件封装不是单纯把代码移到另一个文件，而是划清责任并设计稳定接口。父组件掌握业务数据和请求，子组件用 Props 接收输入、用 Emits 报告动作；需要双向同步的值用 `v-model`，需要父组件定制模板的地方用 Slots。公共组件只保存跨业务都稳定的布局和行为，具体用户、角色等知识留在业务组件里。

再压缩成一句话：

> Props 传数据，Emits 报动作，`v-model` 同步值，Slots 填结构，组件内部隐藏实现。

## 23. 对照源码阅读顺序

建议按照从简单到复杂的顺序阅读：

1. [AdminTablePanel.vue](../../src/components/common/table/AdminTablePanel.vue)：最简单的 Props + Slots。
2. [AdminPagination.vue](../../src/components/common/table/AdminPagination.vue)：多个 `v-model` + 内部派生状态。
3. [UserDepartmentPanel.vue](../../src/views/system/users/components/UserDepartmentPanel.vue)：业务组件包装公共组件。
4. [UserSearchPanel.vue](../../src/views/system/users/components/UserSearchPanel.vue)：Props Down + Events Up。
5. [AdminSearchForm.vue](../../src/components/common/form/AdminSearchForm.vue)：内部表单状态 + Schema。
6. [AdminFormDrawer.vue](../../src/components/common/form/AdminFormDrawer.vue)：`v-model`、Watch、校验和动态 Slots。
7. [AdminDataTable.vue](../../src/components/common/table/AdminDataTable.vue)：泛型、动态作用域 Slots、`$attrs`、Expose 和组合组件。
8. [UserManagementView.vue](../../src/views/system/users/UserManagementView.vue)：页面怎样组合业务组件与公共组件。

读源码时不要先陷入每一行实现，先找四类接口：

```text
defineProps
defineEmits
defineModel
defineSlots
```

看懂这四部分，就先看懂了组件对外承诺什么；剩余代码才是它隐藏的内部实现。
